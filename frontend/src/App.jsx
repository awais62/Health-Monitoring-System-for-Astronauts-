import React, { useState, useEffect } from 'react';
import {
  Activity,
  Heart,
  Droplet,
  Thermometer,
  Wind,
  AlertTriangle,
  Radio,
  Wifi,
  WifiOff,
  RefreshCw,
  Cpu,
  FileText,
  User,
  ShieldAlert,
  Play,
  CheckCircle,
  Clock,
  Send
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

const API_BASE = "http://127.0.0.1:8000/api/v1";

export default function App() {
  const [astronauts, setAstronauts] = useState([]);
  const [selectedId, setSelectedId] = useState("AST-01");
  const [astronautStatus, setAstronautStatus] = useState(null);
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [syncStatus, setSyncStatus] = useState({ is_connected_to_earth: true, pending_count: 0 });
  const [scenarios, setScenarios] = useState({});
  const [mlResult, setMlResult] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [healthSummary, setHealthSummary] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [ackModalAlert, setAckModalAlert] = useState(null);
  const [ackNote, setAckNote] = useState("Verified by Flight Medical Officer");
  const [missionClock, setMissionClock] = useState("MET 04:18:22:09");

  // Mission Clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const sec = String(now.getSeconds()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      setMissionClock(`MET 04:18:${min}:${sec}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial astronauts roster
  useEffect(() => {
    fetchAstronauts();
    fetchSyncStatus();
    fetchScenarios();
  }, []);

  // Poll telemetry and status every 2.5 seconds
  useEffect(() => {
    fetchAstronautData(selectedId);
    const interval = setInterval(() => {
      fetchAstronautData(selectedId);
      fetchSyncStatus();
    }, 2500);
    return () => clearInterval(interval);
  }, [selectedId]);

  const fetchAstronauts = async () => {
    try {
      const res = await fetch(`${API_BASE}/astronauts`);
      if (res.ok) {
        const data = await res.json();
        setAstronauts(data);
      }
    } catch (e) {
      console.warn("Backend not yet connected:", e);
    }
  };

  const fetchAstronautData = async (id) => {
    try {
      // 1. Status & latest metrics
      const statusRes = await fetch(`${API_BASE}/astronauts/${id}/status`);
      if (statusRes.ok) {
        setAstronautStatus(await statusRes.json());
      }

      // 2. Telemetry history for charts (last 30 readings)
      const readRes = await fetch(`${API_BASE}/readings/${id}?limit=40`);
      if (readRes.ok) {
        const raw = await readRes.json();
        // Pivot readings by timestamp for Recharts
        const grouped = {};
        raw.reverse().forEach(r => {
          const timeLabel = new Date(r.measured_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
          if (!grouped[timeLabel]) {
            grouped[timeLabel] = { time: timeLabel };
          }
          grouped[timeLabel][r.metric] = r.value;
        });
        setTelemetryHistory(Object.values(grouped));
      }

      // 3. Alerts
      const alertsRes = await fetch(`${API_BASE}/alerts?astronaut_id=${id}&limit=20`);
      if (alertsRes.ok) {
        setAlerts(await alertsRes.json());
      }
    } catch (e) {
      console.error("Data polling error:", e);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/sync/status`);
      if (res.ok) setSyncStatus(await res.json());
    } catch (e) {}
  };

  const fetchScenarios = async () => {
    try {
      const res = await fetch(`${API_BASE}/simulator/scenarios`);
      if (res.ok) setScenarios(await res.json());
    } catch (e) {}
  };

  const setScenario = async (scenario) => {
    try {
      await fetch(`${API_BASE}/simulator/scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ astronaut_id: selectedId, scenario })
      });
      fetchScenarios();
      // Trigger instant tick
      await fetch(`${API_BASE}/simulator/tick/${selectedId}`, { method: "POST" });
      fetchAstronautData(selectedId);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleConnection = async () => {
    try {
      await fetch(`${API_BASE}/sync/toggle-connection?connected=${!syncStatus.is_connected_to_earth}`, {
        method: "POST"
      });
      fetchSyncStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const flushSyncQueue = async () => {
    try {
      const res = await fetch(`${API_BASE}/sync/flush`, { method: "POST" });
      const data = await res.json();
      alert(data.message);
      fetchSyncStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const runMlAnalysis = async () => {
    setMlLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ml/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ astronaut_id: selectedId, window_minutes: 15 })
      });
      if (res.ok) {
        setMlResult(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMlLoading(false);
    }
  };

  const acknowledgeAlert = async () => {
    if (!ackModalAlert) return;
    try {
      await fetch(`${API_BASE}/alerts/${ackModalAlert.id}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "FlightSurgeon-1", note: ackNote })
      });
      setAckModalAlert(null);
      fetchAstronautData(selectedId);
    } catch (e) {
      console.error(e);
    }
  };

  const generateReport = async () => {
    try {
      const res = await fetch(`${API_BASE}/reports/astronauts/${selectedId}?hours=24`);
      if (res.ok) {
        setHealthSummary(await res.json());
        setShowSummaryModal(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const latest = astronautStatus?.latest_metrics || {};

  return (
    <div className="app-container">
      {/* Top Aerospace Header */}
      <header className="aerospace-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="logo-badge">
            <Radio size={20} color="#06b6d4" />
            <span>BIOAEGIS-SPACE</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', borderLeft: '1px solid #1e293b', paddingLeft: '16px' }}>
            NASA ARTEMIS LUNAR MEDICAL TELEMETRY
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#94a3b8' }}>
            <Clock size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-top' }} />
            {missionClock}
          </div>

          {/* DSN Connection Indicator */}
          <button
            onClick={toggleConnection}
            className={`btn btn-sm ${syncStatus.is_connected_to_earth ? 'btn-secondary' : 'btn-danger'}`}
            title="Click to simulate Deep Space Network blackout"
          >
            {syncStatus.is_connected_to_earth ? (
              <>
                <Wifi size={14} color="#10b981" />
                <span>DSN LINK: ONLINE</span>
              </>
            ) : (
              <>
                <WifiOff size={14} color="#ef4444" />
                <span>DSN: BLACKOUT</span>
              </>
            )}
          </button>

          {/* Queue & Sync Button */}
          {syncStatus.pending_count > 0 && (
            <button onClick={flushSyncQueue} className="btn btn-sm btn-primary" title="Dump store-and-forward telemetry to Earth MCC">
              <Send size={13} />
              <span>SYNC ({syncStatus.pending_count} QUEUED)</span>
            </button>
          )}

          <button onClick={generateReport} className="btn btn-sm btn-secondary">
            <FileText size={14} />
            <span>24H REPORT</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        
        {/* Crew Selector Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {astronauts.map((astro) => {
            const isSelected = astro.id === selectedId;
            const currentScenario = scenarios[astro.id] || "NOMINAL";
            return (
              <div
                key={astro.id}
                onClick={() => setSelectedId(astro.id)}
                style={{
                  background: isSelected ? '#131d2e' : '#0b101a',
                  border: isSelected ? '1px solid #38bdf8' : '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8'
                  }}>
                    <User size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{astro.display_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      {astro.id} • {astro.role}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className={`status-badge ${
                    currentScenario === 'NOMINAL' ? 'status-nominal' :
                    currentScenario === 'EVA_EXERCISE' ? 'status-advisory' : 'status-critical'
                  }`}>
                    {currentScenario}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Biometric Telemetry HUD Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {/* Heart Rate */}
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Heart size={16} color="#ef4444" /> Heart Rate
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>Limits: 50-100</span>
            </div>
            <div className="metric-value">
              {latest.heart_rate?.value ?? "--"}
              <span className="metric-unit">bpm</span>
            </div>
            <div style={{ fontSize: '11px', color: '#10b981' }}>Nominal Sinus Rhythm</div>
          </div>

          {/* Blood Oxygen SpO2 */}
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Droplet size={16} color="#06b6d4" /> Oxygen (SpO2)
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>Limit: ≥ 94%</span>
            </div>
            <div className="metric-value">
              {latest.spo2?.value ?? "--"}
              <span className="metric-unit">%</span>
            </div>
            <div style={{ fontSize: '11px', color: latest.spo2?.value < 90 ? '#ef4444' : '#10b981' }}>
              {latest.spo2?.value < 90 ? 'HYPOXIA WARNING' : 'Oxygenation Normal'}
            </div>
          </div>

          {/* Core Body Temperature */}
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Thermometer size={16} color="#f59e0b" /> Core Temp
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>Limits: 36.0-37.8</span>
            </div>
            <div className="metric-value">
              {latest.body_temp?.value ?? "--"}
              <span className="metric-unit">°C</span>
            </div>
            <div style={{ fontSize: '11px', color: '#10b981' }}>Thermal Homeostasis</div>
          </div>

          {/* Respiration Rate */}
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wind size={16} color="#a855f7" /> Respiration
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>Limits: 10-22</span>
            </div>
            <div className="metric-value">
              {latest.resp_rate?.value ?? "--"}
              <span className="metric-unit">brpm</span>
            </div>
            <div style={{ fontSize: '11px', color: '#10b981' }}>Eupneic Ventilation</div>
          </div>

          {/* Blood Pressure */}
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={16} color="#3b82f6" /> Systolic BP
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>Limits: 90-135</span>
            </div>
            <div className="metric-value">
              {latest.systolic_bp?.value ?? "--"}
              <span className="metric-unit">mmHg</span>
            </div>
            <div style={{ fontSize: '11px', color: '#10b981' }}>Normotensive</div>
          </div>
        </div>

        {/* Middle Section: Live Telemetry Graph & Alerts Feed */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '18px' }}>
          
          {/* Real-time Telemetry Multi-Stream Chart */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <Activity size={16} color="#38bdf8" />
                <span>Live Microgravity Telemetry Stream</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                ROLLING 60-SEC WINDOW
              </span>
            </div>

            <div style={{ height: '320px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetryHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip
                    contentStyle={{ background: '#0d121d', borderColor: '#334155', borderRadius: '6px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="heart_rate" name="Heart Rate (bpm)" stroke="#ef4444" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="spo2" name="SpO2 (%)" stroke="#06b6d4" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="resp_rate" name="Resp Rate (brpm)" stroke="#a855f7" dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="body_temp" name="Core Temp (°C)" stroke="#f59e0b" dot={false} strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Active Rules Engine Alerts Feed */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">
              <div className="panel-title">
                <ShieldAlert size={16} color="#ef4444" />
                <span>Safety Limits & Alerts ({alerts.filter(a => a.status === 'ACTIVE').length})</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)', fontSize: '13px' }}>
                  <CheckCircle size={24} color="#10b981" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  All biometric thresholds nominal.
                </div>
              ) : (
                alerts.map(alert => (
                  <div
                    key={alert.id}
                    style={{
                      background: alert.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.08)' : '#07090e',
                      border: alert.status === 'ACTIVE' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className={`status-badge ${alert.severity === 'CRITICAL' ? 'status-critical' : 'status-advisory'}`}>
                        {alert.severity}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontWeight: 500, color: '#f1f5f9', margin: '4px 0' }}>{alert.message}</div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        Status: <strong style={{ color: alert.status === 'ACTIVE' ? '#ef4444' : '#10b981' }}>{alert.status}</strong>
                      </span>
                      {alert.status === 'ACTIVE' && (
                        <button
                          onClick={() => setAckModalAlert(alert)}
                          className="btn btn-sm btn-secondary"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Lower Section: ML Anomaly Detector & Mission Flight Surgeon Console */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '18px' }}>
          
          {/* Scikit-Learn ML Anomaly Detector */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <Cpu size={16} color="#a855f7" />
                <span>Experimental ML Anomaly Detector</span>
              </div>
              <span style={{ fontSize: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                NON-DIAGNOSTIC
              </span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Multi-variate Isolation Forest baseline trained on microgravity physiological distributions.
            </p>

            <button
              onClick={runMlAnalysis}
              disabled={mlLoading}
              className="btn btn-secondary"
              style={{ width: '100%', marginBottom: '16px' }}
            >
              <Play size={14} />
              {mlLoading ? "Evaluating Telemetry Window..." : "Run Window Anomaly Analysis"}
            </button>

            {mlResult && (
              <div style={{ background: '#0b101a', borderRadius: '6px', padding: '12px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Anomaly Score:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '16px', color: mlResult.flag ? '#ef4444' : '#10b981' }}>
                    {(mlResult.score * 100).toFixed(1)}%
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Verdict Flag:</span>
                  <span className={`status-badge ${mlResult.flag ? 'status-critical' : 'status-nominal'}`}>
                    {mlResult.flag ? "ANOMALY FLAGGED" : "NOMINAL"}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '8px', lineHeight: 1.4 }}>
                  <strong>Explanation:</strong> {mlResult.explanation}
                </div>
              </div>
            )}
          </div>

          {/* Flight Surgeon Simulation Controller */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <Radio size={16} color="#10b981" />
                <span>Flight Surgeon Physiological Injector ({selectedId})</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                REAL-TIME INJECTION
              </span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Inject synthetic spaceflight physiological scenarios to validate safety thresholds and anomaly pipelines:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              <button
                onClick={() => setScenario("NOMINAL")}
                className="btn btn-secondary"
                style={{ borderColor: scenarios[selectedId] === 'NOMINAL' ? '#10b981' : undefined }}
              >
                Nominal Orbit
              </button>
              <button
                onClick={() => setScenario("HYPOXIA")}
                className="btn btn-danger"
                style={{ borderColor: scenarios[selectedId] === 'HYPOXIA' ? '#ef4444' : undefined }}
              >
                Hypoxia (O2 Drop)
              </button>
              <button
                onClick={() => setScenario("EVA_EXERCISE")}
                className="btn btn-secondary"
                style={{ borderColor: scenarios[selectedId] === 'EVA_EXERCISE' ? '#f59e0b' : undefined }}
              >
                EVA High Exertion
              </button>
              <button
                onClick={() => setScenario("ARRHYTHMIA")}
                className="btn btn-danger"
                style={{ borderColor: scenarios[selectedId] === 'ARRHYTHMIA' ? '#ef4444' : undefined }}
              >
                Arrhythmia Spike
              </button>
              <button
                onClick={() => setScenario("HYPOTHERMIA")}
                className="btn btn-secondary"
                style={{ borderColor: scenarios[selectedId] === 'HYPOTHERMIA' ? '#06b6d4' : undefined }}
              >
                Hypothermia
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Alert Acknowledgement Modal */}
      {ackModalAlert && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#f1f5f9' }}>
              Acknowledge Alert #{ackModalAlert.id}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              {ackModalAlert.message}
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
                Medical Officer Clinical Note:
              </label>
              <input
                type="text"
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
                style={{
                  width: '100%',
                  background: '#07090e',
                  border: '1px solid #334155',
                  color: 'white',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '13px'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setAckModalAlert(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={acknowledgeAlert} className="btn btn-primary">
                Confirm & Record Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 24-Hour Mission Health Summary Modal */}
      {showSummaryModal && healthSummary && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', color: '#f1f5f9' }}>
                Mission Period Health Summary: {healthSummary.display_name} ({healthSummary.astronaut_id})
              </h3>
              <span className={`status-badge status-${healthSummary.overall_status.toLowerCase()}`}>
                {healthSummary.overall_status}
              </span>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '14px' }}>
              Mission Code: {healthSummary.mission_code} | Period: Last 24 Hours
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e293b', color: 'var(--text-dim)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0' }}>Metric</th>
                  <th style={{ textAlign: 'right', padding: '6px 0' }}>Current</th>
                  <th style={{ textAlign: 'right', padding: '6px 0' }}>Min</th>
                  <th style={{ textAlign: 'right', padding: '6px 0' }}>Avg</th>
                  <th style={{ textAlign: 'right', padding: '6px 0' }}>Max</th>
                </tr>
              </thead>
              <tbody>
                {healthSummary.metrics_summary.map((m) => (
                  <tr key={m.metric} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '6px 0', textTransform: 'capitalize' }}>{m.metric.replace('_', ' ')}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m.current ?? '--'} {m.unit}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m.min ?? '--'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m.avg ?? '--'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m.max ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ background: '#0b101a', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '16px' }}>
              <div>Total Limit Violations: <strong>{healthSummary.total_alerts}</strong></div>
              <div>Active Unresolved: <strong>{healthSummary.active_alerts}</strong></div>
              <div>ML Anomalies Flagged: <strong>{healthSummary.anomalies_detected}</strong></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => window.print()} className="btn btn-secondary">
                Print / Export
              </button>
              <button onClick={() => setShowSummaryModal(false)} className="btn btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
