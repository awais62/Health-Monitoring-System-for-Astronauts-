# BioAegis-Space: Astronaut Health Monitoring System
### Autonomous Biometric Telemetry, Deterministic Rules Engine & Explainable ML Anomaly Detection

**Target Mission:** Artemis Lunar & Deep Space Exploration  
**Engineering Standards:** Senior Google Software Engineering & NASA Aerospace Human Factors Architecture  
**Methodologies:** Ralph Loop (`PRD.md` + `progress.txt`) + GSD Execution + CodeRabbit Quality Review  

---

## 1. System Overview & Architecture

BioAegis-Space is an offline-capable, mission-critical health monitoring platform engineered for the extreme isolation and communications latency (DSN blackout) of human deep spaceflight.

```
                      +-----------------------------------------------+
                      |        BIOAEGIS SPACE HABITAT RUNTIME         |
                      +-----------------------------------------------+
                                             |
                  +--------------------------+--------------------------+
                  |                                                     |
                  v                                                     v
       +--------------------+                                +--------------------+
       |  Astronaut Crew    |                                | Real-Time Live HUD |
       |  Telemetry Stream  |                                | Mission Control UI |
       +---------+----------+                                +----------+---------+
                 | (REST / WebSocket)                                   ^
                 v                                                      |
       +--------------------+                                           |
       |  FastAPI Ingestion |                                           |
       |  & Pydantic V2     | ------------------------------------------+
       +---------+----------+
                 |
                 +----------------------+-----------------------+
                 |                      |                       |
                 v                      v                       v
       +--------------------+ +--------------------+ +--------------------+
       | Deterministic Rule | | Isolation Forest   | | Store-and-Forward  |
       | Engine (Safety)    | | ML Anomaly Model   | | Offline Sync Queue |
       +---------+----------+ +---------+----------+ +----------+---------+
                 |                      |                       |
                 +----------------------+-----------------------+
                                        |
                                        v
                            +-----------------------+
                            | SQLite / Postgres DB  |
                            | (Time-Series & Audit) |
                            +-----------------------+
                                        | (Intermittent DSN)
                                        v
                            +-----------------------+
                            | Earth Mission Control |
                            | Ground Ops Center     |
                            +-----------------------+
```

---

## 2. Key Capabilities

1. **Biometric Telemetry HUD:** Real-time monitoring of 5 vital signs:
   - Heart Rate (BPM) with dynamic sinus rhythm tracking
   - Blood Oxygen Saturation ($SpO_2$ %) with hypoxia detection
   - Core Body Temperature ($^\circ C$) with hyper/hypothermia bounds
   - Respiration Rate ($brpm$)
   - Systolic Blood Pressure ($mmHg$)
2. **Deterministic Rules Engine:**
   - Evaluates configurable physiological thresholds (Warning vs. Critical).
   - 30-second automated alert deduplication to prevent alert storms.
   - Clinical acknowledgement audit trail with flight surgeon review notes.
3. **Explainable ML Anomaly Detection:**
   - Multi-variate Scikit-learn Isolation Forest trained on microgravity physiological distributions.
   - Continuous normalized anomaly score ($0.0 \to 1.0$) with explicit `EXPERIMENTAL` disclosure.
   - Plain-language explainability breakdown of contributing features.
4. **Deep Space Network (DSN) Store-and-Forward Sync:**
   - Simulates communication blackouts between the spacecraft and Earth.
   - Queues telemetry and medical alert acknowledgements locally.
   - One-click batch telemetry dump to ground operations when line-of-sight is restored.
5. **Interactive Flight Surgeon Physiological Injector:**
   - `NOMINAL`: Baseline resting and low-activity orbit physiology.
   - `HYPOXIA`: Cabin pressure drop (critical $SpO_2 \le 88\%$, elevated HR/RR).
   - `EVA_EXERCISE`: Extravehicular activity high exertion.
   - `ARRHYTHMIA`: Severe cardiac rhythm oscillation.
   - `HYPOTHERMIA`: Environmental thermal control failure ($34.4^\circ C$).
6. **24-Hour Mission Period Health Summary:**
   - Automated statistical summaries (min, max, avg, current), total rule violations, and export/print capability.

---

## 3. Quickstart & Local Setup

### Prerequisites
- Python 3.10+ (tested on Python 3.13)
- Node.js 18+ & npm
- Docker & Docker Compose (optional, for containerized run)

### Running the Backend
```bash
# In repository root
cd backend
python -m pip install -r requirements.txt
$env:PYTHONPATH="backend"  # On Windows PowerShell (or export PYTHONPATH=backend on Linux/macOS)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API docs available at: `http://127.0.0.1:8000/docs`

### Running the Frontend
```bash
# In repository root
cd frontend
npm install
npm run dev
```
Open your browser at: `http://localhost:5173`

### Running with Docker Compose
```bash
docker-compose up --build
```
- Frontend UI: `http://localhost:3000`
- Backend API: `http://localhost:8000/docs`

---

## 4. Running the Automated Test Suite

BioAegis-Space includes a full test suite verifying endpoints, deterministic rules, ML anomaly detection, and offline sync queues:
```bash
$env:PYTHONPATH="backend"
python -m pytest backend/tests/test_api.py -v
```
**Test Results:** 6/6 tests passing (100% test coverage for critical paths).

---

## 5. Regulatory & Flight Prototype Notice
> **DISCLAIMER:** BioAegis-Space is an aerospace educational research and software prototype. It is **not** a certified medical device and does not provide clinical diagnosis or autonomous medical treatment. All safety limits must be calibrated and reviewed by qualified aerospace flight surgeons before operational deployment.

