import React, { useState, useEffect } from 'react';
import {
  Activity,
  Heart,
  Droplet,
  Thermometer,
  Wind,
  ShieldAlert,
  Radio,
  Wifi,
  WifiOff,
  Cpu,
  FileText,
  User,
  CheckCircle2,
  Clock,
  Send,
  UploadCloud,
  ChevronRight,
  Filter,
  Check,
  AlertOctagon,
  Sparkles,
  Layers,
  Database,
  Play,
  Pause
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
  const [activeTab, setActiveTab] = useState("telemetry"); // telemetry, alerts, ml, hardware, report
  const [astronauts, setAstronauts] = useState([]);
  const [selectedId, setSelectedId] = useState("AST-01");
  const [astronautStatus, setAstronautStatus] = useState(null);
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [syncStatus, setSyncStatus] = useState({ is_connected_to_earth: true, pending_count: 0 });
  const [isAutoGenerating, setIsAutoGenerating] = useState(true);
  const [scenarios, setScenarios] = useState({});
  const [mlResult, setMlResult] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [healthSummary, setHealthSummary] = useState(null);
  const [selectedChartMetric, setSelectedChartMetric] = useState("all");
  
  // Real-world CSV upload state
  const [csvFile, setCsvFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  // Alert acknowledgement modal
  const [ackModalAlert, setAckModalAlert] = useState(null);
  const [ackNote, setAckNote] = useState("Reviewed and verified by Flight Medical Officer");
  const [missionClock, setMissionClock] = useState("MET 04:18:22:09");

  // Mission Clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const sec = String(now.getSeconds()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const hrs = String(now.getHours()).padStart(2, '0');
      setMissionClock(`MET 04:18:${min}:${sec}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initial Fetch
  useEffect(() => {
    fetchAstronauts();
    fetchSyncStatus();
    fetchScenarios();
  }, []);

  // Live Polling
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
      if (res.ok) setAstronauts(await res.json());
    } catch (e) {
      console.warn("Backend not ready:", e);
    }
  };

  const fetchAstronautData = async (id) => {
    try {
      const statusRes = await fetch(`${API_BASE}/astronauts/${id}/status`);
      if (statusRes.ok) setAstronautStatus(await statusRes.json());

      const readRes = await fetch(`${API_BASE}/readings/${id}?limit=40`);
      if (readRes.ok) {
        const raw = await readRes.json();
        const grouped = {};
        raw.reverse().forEach(r => {
          const timeLabel = new Date(r.measured_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
          if (!grouped[timeLabel]) grouped[timeLabel] = { time: timeLabel };
          grouped[timeLabel][r.metric] = r.value;
        });
        setTelemetryHistory(Object.values(grouped));
      }

      const alertsRes = await fetch(`${API_BASE}/alerts?astronaut_id=${id}&limit=30`);
      if (alertsRes.ok) setAlerts(await alertsRes.json());
    } catch (e) {
      console.error(e);
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
      const res = await fetch(`${API_BASE}/simulator/status`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.scenarios || {});
        setIsAutoGenerating(data.is_auto_generating);
      }
    } catch (e) {}
  };

  const toggleAutoGeneration = async () => {
    try {
      const nextState = !isAutoGenerating;
      const res = await fetch(`${API_BASE}/simulator/toggle?active=${nextState}`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setIsAutoGenerating(data.is_auto_generating);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const setScenario = async (scenario) => {
    try {
      await fetch(`${API_BASE}/simulator/scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ astronaut_id: selectedId, scenario })
      });
      fetchScenarios();
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
      if (res.ok) setMlResult(await res.json());
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

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) return;
    const formData = new FormData();
    formData.append("file", csvFile);

    try {
      setUploadStatus("Uploading & parsing dataset...");
      const res = await fetch(`${API_BASE}/readings/upload-csv?astronaut_id=${selectedId}`, {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setUploadStatus(`Success: ${data.total_data_points_ingested} real-world data points ingested for ${selectedId}!`);
        fetchAstronautData(selectedId);
      } else {
        setUploadStatus("Failed to ingest CSV. Verify format.");
      }
    } catch (err) {
      setUploadStatus("Error uploading file.");
    }
  };

  const fetchHealthReport = async () => {
    try {
      const res = await fetch(`${API_BASE}/reports/astronauts/${selectedId}?hours=24`);
      if (res.ok) setHealthSummary(await res.json());
    } catch (e) {}
  };

  useEffect(() => {
    if (activeTab === "report") fetchHealthReport();
  }, [activeTab, selectedId]);

  const latest = astronautStatus?.latest_metrics || {};

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Refined Navigation Bar */}
      <header className="navbar">
        <div className="brand-section">
          <div className="brand-icon">
            <Activity size={20} color="#ffffff" />
          </div>
          <div>
            <div className="brand-title">BioAegis-Space</div>
            <div className="brand-tag">NASA Artemis Crew Medical Telemetry</div>
          </div>
        </div>

        {/* Central Segmented Controls */}
        <nav className="nav-tabs">
          <button
            onClick={() => setActiveTab("telemetry")}
            className={`tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
          >
            <Activity size={15} />
            <span>Telemetry</span>
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            className={`tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
          >
            <ShieldAlert size={15} />
            <span>Alerts ({alerts.filter(a => a.status === 'ACTIVE').length})</span>
          </button>
          <button
            onClick={() => setActiveTab("ml")}
            className={`tab-btn ${activeTab === 'ml' ? 'active' : ''}`}
          >
            <Sparkles size={15} />
            <span>AI Anomaly</span>
          </button>
          <button
            onClick={() => setActiveTab("hardware")}
            className={`tab-btn ${activeTab === 'hardware' ? 'active' : ''}`}
          >
            <Database size={15} />
            <span>Real-World Ingest</span>
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
          >
            <FileText size={15} />
            <span>24h Report</span>
          </button>
        </nav>

        {/* Right Info & DSN Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Auto Simulator Toggle Button */}
          <button
            onClick={toggleAutoGeneration}
            className="btn-action btn-surface"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderColor: isAutoGenerating ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.4)'
            }}
            title={isAutoGenerating ? "Click to Pause automatic background data generator" : "Click to Resume automatic background data generator"}
          >
            {isAutoGenerating ? (
              <>
                <Pause size={13} color="#10b981" />
                <span style={{ color: '#34d399' }}>Auto-Stream: ON</span>
              </>
            ) : (
              <>
                <Play size={13} color="#f59e0b" />
                <span style={{ color: '#fbbf24' }}>Auto-Stream: PAUSED</span>
              </>
            )}
          </button>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <Clock size={13} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-top' }} />
            {missionClock}
          </div>

          <button
            onClick={toggleConnection}
            className={`btn-action btn-surface`}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderColor: syncStatus.is_connected_to_earth ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.4)'
            }}
            title="Click to toggle DSN connection blackout"
          >
            {syncStatus.is_connected_to_earth ? (
              <>
                <Wifi size={14} color="#10b981" />
                <span style={{ color: '#34d399' }}>DSN Online</span>
              </>
            ) : (
              <>
                <WifiOff size={14} color="#f43f5e" />
                <span style={{ color: '#fb7185' }}>DSN Blackout</span>
              </>
            )}
          </button>

          {syncStatus.pending_count > 0 && (
            <button onClick={flushSyncQueue} className="btn-action btn-brand" style={{ padding: '6px 12px', fontSize: '12px' }}>
              <Send size={13} />
              <span>Dump ({syncStatus.pending_count})</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }}>
        
        {/* Crew Roster Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {astronauts.map((astro) => {
            const isSelected = astro.id === selectedId;
            const currentScenario = scenarios[astro.id] || "NOMINAL";
            return (
              <div
                key={astro.id}
                onClick={() => setSelectedId(astro.id)}
                className={`crew-pill ${isSelected ? 'active' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isSelected ? '#38bdf8' : '#94a3b8',
                    fontWeight: 700,
                    fontSize: '12px'
                  }}>
                    {astro.id}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff' }}>{astro.display_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{astro.role}</div>
                  </div>
                </div>

                <div>
                  <span className={`badge ${
                    currentScenario === 'NOMINAL' ? 'badge-nominal' :
                    currentScenario === 'EVA_EXERCISE' ? 'badge-advisory' : 'badge-critical'
                  }`}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: currentScenario === 'NOMINAL' ? '#34d399' : currentScenario === 'EVA_EXERCISE' ? '#fbbf24' : '#fb7185'
                    }} />
                    {currentScenario}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* TAB 1: LIVE TELEMETRY & VITALS */}
        {activeTab === "telemetry" && (
          <>
            {/* 5 Vital Signs Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {/* Heart Rate */}
              <div className="vital-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="vital-icon-badge" style={{ background: 'rgba(244, 63, 94, 0.12)', color: '#fb7185' }}>
                    <Heart size={18} />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Limit: 50-100</span>
                </div>
                <div className="vital-reading">
                  {latest.heart_rate?.value ?? "--"}
                  <span className="vital-unit">bpm</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Heart Rate • Sinus Rhythm</div>
              </div>

              {/* SpO2 */}
              <div className="vital-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="vital-icon-badge" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                    <Droplet size={18} />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Limit: ≥ 94%</span>
                </div>
                <div className="vital-reading">
                  {latest.spo2?.value ?? "--"}
                  <span className="vital-unit">%</span>
                </div>
                <div style={{ fontSize: '12px', color: latest.spo2?.value < 90 ? '#fb7185' : 'var(--text-secondary)' }}>
                  {latest.spo2?.value < 90 ? 'Hypoxia Warning' : 'Oxygenation Saturation'}
                </div>
              </div>

              {/* Core Body Temp */}
              <div className="vital-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="vital-icon-badge" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}>
                    <Thermometer size={18} />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Limit: 36.0-37.8</span>
                </div>
                <div className="vital-reading">
                  {latest.body_temp?.value ?? "--"}
                  <span className="vital-unit">°C</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Core Body Temperature</div>
              </div>

              {/* Respiration */}
              <div className="vital-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="vital-icon-badge" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' }}>
                    <Wind size={18} />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Limit: 10-22</span>
                </div>
                <div className="vital-reading">
                  {latest.resp_rate?.value ?? "--"}
                  <span className="vital-unit">brpm</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Respiration Frequency</div>
              </div>

              {/* Blood Pressure */}
              <div className="vital-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="vital-icon-badge" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8' }}>
                    <Activity size={18} />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Limit: 90-135</span>
                </div>
                <div className="vital-reading">
                  {latest.systolic_bp?.value ?? "--"}
                  <span className="vital-unit">mmHg</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Systolic Blood Pressure</div>
              </div>
            </div>

            {/* Time-Series Graph */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Activity size={16} color="#38bdf8" />
                  <span>Real-Time Physiological Telemetry Window (Rolling 60s)</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {["all", "heart_rate", "spo2", "resp_rate", "body_temp"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedChartMetric(m)}
                      className={`btn-action btn-surface`}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        borderColor: selectedChartMetric === m ? '#38bdf8' : undefined,
                        color: selectedChartMetric === m ? '#38bdf8' : undefined
                      }}
                    >
                      {m.toUpperCase().replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ height: '360px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={telemetryHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                    <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip
                      contentStyle={{ background: '#0f141c', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    {(selectedChartMetric === "all" || selectedChartMetric === "heart_rate") && (
                      <Line type="monotone" dataKey="heart_rate" name="Heart Rate (bpm)" stroke="#f43f5e" dot={false} strokeWidth={2} />
                    )}
                    {(selectedChartMetric === "all" || selectedChartMetric === "spo2") && (
                      <Line type="monotone" dataKey="spo2" name="SpO2 (%)" stroke="#38bdf8" dot={false} strokeWidth={2} />
                    )}
                    {(selectedChartMetric === "all" || selectedChartMetric === "resp_rate") && (
                      <Line type="monotone" dataKey="resp_rate" name="Resp Rate (brpm)" stroke="#c084fc" dot={false} strokeWidth={1.5} />
                    )}
                    {(selectedChartMetric === "all" || selectedChartMetric === "body_temp") && (
                      <Line type="monotone" dataKey="body_temp" name="Core Temp (°C)" stroke="#fbbf24" dot={false} strokeWidth={1.5} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: CLINICAL ALERTS & TRIAGE */}
        {activeTab === "alerts" && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <ShieldAlert size={16} color="#f43f5e" />
                <span>Deterministic Clinical Alerts Triage</span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Active: {alerts.filter(a => a.status === 'ACTIVE').length} / Total: {alerts.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
                  <div style={{ fontWeight: 600 }}>All Physiological Limits Nominal</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No active rule violations triggered for {selectedId}</div>
                </div>
              ) : (
                alerts.map(a => (
                  <div
                    key={a.id}
                    style={{
                      background: a.status === 'ACTIVE' ? 'rgba(244, 63, 94, 0.05)' : 'var(--bg-surface-elevated)',
                      border: a.status === 'ACTIVE' ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid var(--border-dim)',
                      borderRadius: '10px',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span className={`badge ${a.severity === 'CRITICAL' ? 'badge-critical' : 'badge-advisory'}`}>
                          {a.severity}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                          {a.message}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        Triggered at: {new Date(a.created_at).toLocaleString()} • Metric: {a.metric} • Status: {a.status}
                      </div>
                    </div>

                    {a.status === 'ACTIVE' && (
                      <button
                        onClick={() => setAckModalAlert(a)}
                        className="btn-action btn-surface"
                        style={{ fontSize: '12px' }}
                      >
                        Acknowledge & Record
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: AI ANOMALY DETECTION */}
        {activeTab === "ml" && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px' }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Sparkles size={16} color="#38bdf8" />
                  <span>Isolation Forest Evaluation</span>
                </div>
                <span className="badge badge-advisory">EXPERIMENTAL</span>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.6 }}>
                Multi-variate model evaluating joint deviations across Heart Rate, SpO2, Temperature, Respiration, and Blood Pressure.
              </p>

              <button
                onClick={runMlAnalysis}
                disabled={mlLoading}
                className="btn-action btn-brand"
                style={{ width: '100%', marginBottom: '16px' }}
              >
                {mlLoading ? "Computing Trajectory..." : "Run Anomaly Window Analysis"}
              </button>

              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                Notice: Machine learning inferences are classified as exploratory decision-support and do not replace certified aerospace medical protocols.
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Analysis Verdict</div>
              </div>

              {mlResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-surface-elevated)', borderRadius: '10px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Normalized Outlier Score</div>
                      <div style={{ fontSize: '32px', fontWeight: 800, color: mlResult.flag ? '#fb7185' : '#34d399' }}>
                        {(mlResult.score * 100).toFixed(1)}%
                      </div>
                    </div>
                    <span className={`badge ${mlResult.flag ? 'badge-critical' : 'badge-nominal'}`}>
                      {mlResult.flag ? "ANOMALY FLAGGED" : "NOMINAL TRAJECTORY"}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <strong>Clinical Rationale:</strong> {mlResult.explanation}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    Evaluated Window: {new Date(mlResult.window_start).toLocaleTimeString()} &rarr; {new Date(mlResult.window_end).toLocaleTimeString()}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Click "Run Anomaly Window Analysis" to inspect multi-variate trajectory.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: REAL-WORLD INGESTION & HARDWARE INTEGRATION */}
        {activeTab === "hardware" && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* Real-World Dataset Upload */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <UploadCloud size={16} color="#38bdf8" />
                  <span>Real-World CSV Dataset Ingestion</span>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                Upload recorded telemetry from smart garments (Hexoskin, Polar, Apple Health CSV, or PhysioNet NASA datasets) to test the platform on authentic patient data:
              </p>

              <form onSubmit={handleCsvUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="dropzone">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files[0])}
                    style={{ display: 'block', margin: '0 auto', fontSize: '13px' }}
                  />
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    Supported columns: heart_rate, spo2, body_temp, resp_rate, systolic_bp
                  </div>
                </div>

                <button type="submit" className="btn-action btn-brand" disabled={!csvFile}>
                  Ingest Dataset for {selectedId}
                </button>

                {uploadStatus && (
                  <div style={{ fontSize: '12px', color: uploadStatus.includes('Success') ? '#34d399' : '#fb7185' }}>
                    {uploadStatus}
                  </div>
                )}
              </form>
            </div>

            {/* Wearable Hardware & Scenario Adapter */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Radio size={16} color="#10b981" />
                  <span>Hardware IoT & Physiological Scenarios</span>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                <strong>How real hardware connects:</strong> Real-world biometric sensors post structured packets to the REST endpoint <code>/api/v1/readings/hardware-packet</code> or the WebSocket stream <code>/ws/telemetry</code>.
              </p>

              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                Quickly test edge-case physiological conditions:
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <button onClick={() => setScenario("NOMINAL")} className="btn-action btn-surface">
                  Nominal Rest
                </button>
                <button onClick={() => setScenario("HYPOXIA")} className="btn-action btn-danger">
                  Hypoxia (O2 Drop)
                </button>
                <button onClick={() => setScenario("EVA_EXERCISE")} className="btn-action btn-surface">
                  EVA High Exertion
                </button>
                <button onClick={() => setScenario("ARRHYTHMIA")} className="btn-action btn-danger">
                  Cardiac Arrhythmia
                </button>
                <button onClick={() => setScenario("HYPOTHERMIA")} className="btn-action btn-surface">
                  Hypothermia
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: 24-HOUR CLINICAL REPORT */}
        {activeTab === "report" && healthSummary && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <FileText size={16} color="#38bdf8" />
                <span>24-Hour Medical Period Summary ({healthSummary.display_name} - {healthSummary.astronaut_id})</span>
              </div>
              <span className={`badge badge-${healthSummary.overall_status.toLowerCase()}`}>
                Overall Status: {healthSummary.overall_status}
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-dim)', color: 'var(--text-tertiary)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 0' }}>Physiological Parameter</th>
                  <th style={{ textAlign: 'right', padding: '10px 0' }}>Latest Reading</th>
                  <th style={{ textAlign: 'right', padding: '10px 0' }}>Min (24h)</th>
                  <th style={{ textAlign: 'right', padding: '10px 0' }}>Mean (24h)</th>
                  <th style={{ textAlign: 'right', padding: '10px 0' }}>Max (24h)</th>
                </tr>
              </thead>
              <tbody>
                {healthSummary.metrics_summary.map((m) => (
                  <tr key={m.metric} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <td style={{ padding: '12px 0', textTransform: 'capitalize', fontWeight: 600 }}>{m.metric.replace('_', ' ')}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m.current ?? '--'} {m.unit}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m.min ?? '--'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m.avg ?? '--'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m.max ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: '14px', marginBottom: '20px' }}>
              <div style={{ flex: 1, background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Threshold Violations</div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{healthSummary.total_alerts}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Active Alarms</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: healthSummary.active_alerts > 0 ? '#fb7185' : '#34d399' }}>
                  {healthSummary.active_alerts}
                </div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>ML Anomalies Flagged</div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{healthSummary.anomalies_detected}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => window.print()} className="btn-action btn-surface">
                Print Clinical PDF
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Alert Acknowledgement Modal */}
      {ackModalAlert && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-dim)',
            borderRadius: '14px',
            width: '90%',
            maxWidth: '500px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              Acknowledge Alert #{ackModalAlert.id}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {ackModalAlert.message}
            </p>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>
                Medical Officer Review Note:
              </label>
              <input
                type="text"
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-dim)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '13px'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setAckModalAlert(null)} className="btn-action btn-surface">
                Cancel
              </button>
              <button onClick={acknowledgeAlert} className="btn-action btn-brand">
                Confirm & Record Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
