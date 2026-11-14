# 🚀 BioAegis-Space: Autonomous Astronaut Health Monitoring System
### Real-Time Biometric Telemetry, Deterministic Rules Engine & Explainable ML Anomaly Detection for Deep Space Missions

[![Python 3.13](https://img.shields.io/badge/Python-3.13-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19.3-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tests Passing](https://img.shields.io/badge/Pytest-6%2F6%20Passed-brightgreen.svg?logo=pytest&logoColor=white)](https://docs.pytest.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Executive Summary

During long-duration crewed spaceflight (e.g. Artemis lunar exploration or Mars transit missions), astronauts face extreme isolation, microgravity-induced cardiovascular deconditioning, spaceflight-associated neuro-ocular syndrome (SANS), radiation hazards, and severe communication latency (up to 22 minutes round-trip with Earth).

**BioAegis-Space** is a mission-grade, offline-capable medical telemetry and clinical decision-support platform designed to protect astronaut health aboard exploration-class spacecraft. It continuously monitors vital signs, provides deterministic safety alerts, flags early physiological anomalies via machine learning, operates reliably through Deep Space Network (DSN) blackouts, and delivers an intuitive, human-factored Mission Control dashboard.

---

## 🏗️ System Architecture

```
                      +-----------------------------------------------+
                      |        BIOAEGIS SPACE HABITAT RUNTIME         |
                      +-----------------------------------------------+
                                             │
                  +--------------------------+--------------------------+
                  │                                                     │
                  ▼                                                     ▼
       +--------------------+                                +--------------------+
       │  Astronaut Crew    │                                │ Real-Time Live HUD │
       │  Telemetry Stream  │                                │ Mission Control UI │
       +---------+----------+                                +----------+---------+
                 │ (REST / WebSocket)                                   ▲
                 ▼                                                      │
       +--------------------+                                           │
       │  FastAPI Ingestion │                                           │
       │  & Pydantic V2     │ ──────────────────────────────────────────+
       +---------+----------+
                 │
                 +----------------------+-----------------------+
                 │                      │                       │
                 ▼                      ▼                       ▼
       +--------------------+ +--------------------+ +--------------------+
       │ Deterministic Rule │ │ Isolation Forest   │ │ Store-and-Forward  │
       │ Engine (Safety)    │ │ ML Anomaly Model   │ │ Offline Sync Queue │
       +---------+----------+ +---------+----------+ +----------+---------+
                 │                      │                       │
                 +----------------------+-----------------------+
                                        │
                                        ▼
                            +-----------------------+
                            │ SQLite / Postgres DB  │
                            │ (Time-Series & Audit) │
                            +-----------------------+
                                        │ (Intermittent DSN Link)
                                        ▼
                            +-----------------------+
                            │ Earth Mission Control │
                            │ Ground Ops Center     │
                            +-----------------------+
```

---

## ⚡ Core Capabilities & Features

### 1. 🩺 Real-Time Biometric Telemetry HUD
- High-density monitoring of 5 core physiological parameters:
  - **Heart Rate ($\text{BPM}$):** Dynamic sinus rhythm tracking with tachycardia/bradycardia thresholds.
  - **Blood Oxygen Saturation ($\text{SpO}_2\ \text{\%}$):** Continuous pulse oximetry with acute hypoxia detection.
  - **Core Body Temperature ($^\circ\text{C}$):** Homeostasis monitoring with hyperthermia/hypothermia bounds.
  - **Respiration Frequency ($\text{brpm}$):** Ventilation rate and respiratory distress alerts.
  - **Systolic Blood Pressure ($\text{mmHg}$):** Normotensive vs. hypertension tracking.

### 2. 🚨 Deterministic Safety Rules Engine
- Evaluates configurable limits with dual severity tiers: `WARNING` and `CRITICAL`.
- **30-second automated alert deduplication** prevents alert storms during sustained threshold violations.
- **Clinical Audit Trail:** One-click alert acknowledgement with Medical Officer review notes and timestamps.

### 3. 🧠 Explainable ML Anomaly Detection (Isolation Forest)
- Unsupervised multi-variate anomaly detector trained on microgravity physiological distributions.
- Produces continuous normalized outlier scores ($0.0 \to 1.0$) with transparent explainability (e.g., *"Elevated heart rate coupled with SpO2 desaturation"*).
- Complies with medical AI standards: explicitly labeled with `EXPERIMENTAL: NON-DIAGNOSTIC`.

### 4. 🛰️ Deep Space Network (DSN) Store-and-Forward Sync
- Simulates communication blackouts between the spacecraft and Earth.
- Automatically buffers telemetry and clinical audit events into a persistent SQLite queue during loss-of-signal.
- One-click batch telemetry dump flushes pending packets when line-of-sight is restored.

### 5. 🔌 Real-World Data Ingest & Hardware Integration
- **CSV Dataset Uploader:** Drag-and-drop authentic clinical records (e.g. PhysioNet, Kaggle, Apple Health, Garmin) directly through the UI.
- **IoT Hardware Endpoint:** Ingest raw multi-sensor payloads from wearable smart garments (Hexoskin, Polar, BioHarness) via `POST /api/v1/readings/hardware-packet`.
- **Autonomous Auto-Stream Controls:** Toggle between live autonomous simulation and pure manual/CSV ingestion via the top navbar switch.

---

## 🛠️ Technology Stack

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend Framework** | Python 3.13, FastAPI | Async high-performance REST API & WebSockets |
| **Data Validation** | Pydantic v2, Pydantic-Settings | Strict type-safety, units validation, and config |
| **Database & ORM** | SQLAlchemy 2.0, SQLite / PostgreSQL | Time-series telemetry storage, audit logs, and sync queue |
| **Machine Learning** | Scikit-learn, NumPy, Pandas | Multi-variate Isolation Forest outlier detection |
| **Frontend Framework** | React 19, Vite 8 | Fast, modern client-side rendering |
| **Visuals & Charts** | Recharts, Lucide React | Real-time multi-stream telemetry time-series charts |
| **Design System** | Tailored Slate Aerospace Theme | Refined Apple Health / Linear / SpaceX mission control UI |
| **Testing & CI** | Pytest, HTTPX | 100% passing automated unit & integration test suite |
| **Containerization** | Docker, Docker Compose | Single-command multi-container deployment |

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+** (Tested on Python 3.13)
- **Node.js 18+** & **npm**
- **Docker & Docker Compose** (Optional, for containerized deployment)

---

### Local Installation & Startup

#### 1. Clone the Repository
```bash
git clone https://github.com/awais62/Health-Monitoring-System-for-Astronauts-.git
cd Health-Monitoring-System-for-Astronauts-
```

#### 2. Run the Backend API (FastAPI)
```powershell
# In project root
cd backend
python -m pip install -r requirements.txt
$env:PYTHONPATH="backend"   # Windows PowerShell (or 'export PYTHONPATH=backend' on macOS/Linux)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
* **Landing Gateway:** [`http://127.0.0.1:8000/`](http://127.0.0.1:8000/)
* **Interactive Swagger API Docs:** [`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs)
* **System Health Check:** [`http://127.0.0.1:8000/healthz`](http://127.0.0.1:8000/healthz)

#### 3. Run the Frontend Dashboard (React + Vite)
```powershell
# Open a new terminal in project root
cd frontend
npm install
npm run dev
```
* **Mission Control UI:** [`http://localhost:5173`](http://localhost:5173)

---

### Running with Docker Compose
To launch both frontend and backend in isolated production containers:
```bash
docker-compose up --build
```
- **Web Dashboard:** `http://localhost:3000`
- **Backend API:** `http://localhost:8000/docs`

---

## 🧪 Automated Testing

BioAegis-Space includes a full test suite verifying endpoints, deterministic safety rules, ML anomaly detection, and store-and-forward sync queues:

```powershell
$env:PYTHONPATH="backend"
python -m pytest backend/tests/test_api.py -v
```

### Test Suite Execution Output
```
============================= test session starts =============================
platform win32 -- Python 3.13.9, pytest-8.4.2
collected 6 items

backend/tests/test_api.py::test_health_check PASSED                      [ 16%]
backend/tests/test_api.py::test_create_and_list_astronauts PASSED        [ 33%]
backend/tests/test_api.py::test_vital_reading_ingestion_and_rules_alert PASSED [ 50%]
backend/tests/test_api.py::test_alert_acknowledgement PASSED             [ 66%]
backend/tests/test_api.py::test_ml_anomaly_detection_endpoint PASSED     [ 83%]
backend/tests/test_api.py::test_offline_sync_queue PASSED                [100%]

======================== 6 passed, 1 warning in 5.70s =========================
```

---

## 📡 API Reference Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | System Landing Gateway & service status |
| `GET` | `/healthz` | Microservice liveness & readiness probe |
| `GET` | `/api/v1/astronauts` | List active astronaut crew profiles |
| `GET` | `/api/v1/astronauts/{id}/status` | Latest telemetry readings & active alert status |
| `POST` | `/api/v1/readings` | Submit validated single biometric reading |
| `POST` | `/api/v1/readings/hardware-packet` | Ingest real-world multi-sensor IoT wearable packet |
| `POST` | `/api/v1/readings/upload-csv` | Ingest real-world CSV physiological dataset |
| `GET` | `/api/v1/alerts` | Filter active and historical safety alerts |
| `POST` | `/api/v1/alerts/{id}/acknowledge` | Clinical alert acknowledgement with audit note |
| `POST` | `/api/v1/ml/analyze` | Run Isolation Forest anomaly detection on time window |
| `GET` | `/api/v1/sync/status` | Deep Space Network (DSN) link & queued packets status |
| `POST` | `/api/v1/sync/flush` | Synchronize pending offline telemetry to Earth MCC |
| `POST` | `/api/v1/simulator/toggle` | Play/Pause autonomous background telemetry streaming |
| `WS` | `/ws/telemetry` | Live real-time WebSocket telemetry broadcast stream |

---

## 🔒 Regulatory & Flight Prototype Notice

> **DISCLAIMER:** BioAegis-Space is developed as an aerospace educational prototype and engineering demonstration for spaceflight medical decision-support. It is **not** a certified medical device and does not provide autonomous clinical diagnosis or treatment. All thresholds and decision criteria must be calibrated and approved by certified aerospace flight surgeons prior to operational deployment.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
