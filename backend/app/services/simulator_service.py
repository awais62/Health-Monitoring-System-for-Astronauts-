import random
from datetime import datetime, timezone
from typing import Dict, List, Any
from sqlalchemy.orm import Session
from app.models import Astronaut, VitalReading
from app.services.rules_engine import evaluate_reading

DEFAULT_ASTRONAUTS = [
    {
        "id": "AST-01",
        "display_name": "Cmdr. Alexander Vance",
        "mission_code": "ARTEMIS-III",
        "role": "Mission Commander",
        "profile_notes": "Experienced naval aviator; 120 days cumulative microgravity."
    },
    {
        "id": "AST-02",
        "display_name": "Dr. Elena Rostova",
        "mission_code": "ARTEMIS-III",
        "role": "Payload Specialist & Chief Medical Officer",
        "profile_notes": "Flight surgeon; specialized in spaceflight physiology."
    },
    {
        "id": "AST-03",
        "display_name": "Marcus Chen",
        "mission_code": "ARTEMIS-III",
        "role": "Flight Engineer",
        "profile_notes": "Avionics and life support systems lead."
    },
    {
        "id": "AST-04",
        "display_name": "Sarah Connor",
        "mission_code": "ARTEMIS-III",
        "role": "Geological Science Specialist",
        "profile_notes": "Lunar surface EVAs and regolith core analysis."
    }
]

class TelemetrySimulator:
    def __init__(self):
        # Scenario state per astronaut: NOMINAL, HYPOXIA, EVA_EXERCISE, ARRHYTHMIA, HYPOTHERMIA
        self.scenarios: Dict[str, str] = {
            "AST-01": "NOMINAL",
            "AST-02": "NOMINAL",
            "AST-03": "NOMINAL",
            "AST-04": "NOMINAL"
        }
        # Controls automatic periodic background generation
        self.is_auto_generating: bool = True

    def toggle_auto_generation(self, active: bool):
        self.is_auto_generating = active

    def set_scenario(self, astronaut_id: str, scenario: str):
        if scenario in ["NOMINAL", "HYPOXIA", "EVA_EXERCISE", "ARRHYTHMIA", "HYPOTHERMIA"]:
            self.scenarios[astronaut_id] = scenario

    def seed_astronauts(self, db: Session):
        for astro in DEFAULT_ASTRONAUTS:
            existing = db.query(Astronaut).filter(Astronaut.id == astro["id"]).first()
            if not existing:
                astronaut = Astronaut(
                    id=astro["id"],
                    display_name=astro["display_name"],
                    mission_code=astro["mission_code"],
                    role=astro["role"],
                    profile_notes=astro["profile_notes"],
                    active=True
                )
                db.add(astronaut)
        db.commit()

    def generate_tick(self, db: Session, astronaut_id: str) -> List[Dict[str, Any]]:
        scenario = self.scenarios.get(astronaut_id, "NOMINAL")
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        if scenario == "NOMINAL":
            hr = random.gauss(72, 3)
            spo2 = min(100.0, random.gauss(98.5, 0.5))
            temp = random.gauss(36.8, 0.1)
            rr = random.gauss(14.0, 1.0)
            sbp = random.gauss(118.0, 4.0)

        elif scenario == "HYPOXIA":
            # Decreased SpO2, elevated HR and respiration
            hr = random.gauss(118, 5)
            spo2 = random.gauss(88.2, 1.2)  # Critical hypoxia trigger
            temp = random.gauss(36.9, 0.1)
            rr = random.gauss(24.0, 2.0)
            sbp = random.gauss(132.0, 5.0)

        elif scenario == "EVA_EXERCISE":
            # Extravehicular activity high exertion
            hr = random.gauss(148, 6)       # High heart rate
            spo2 = random.gauss(96.5, 0.8)
            temp = random.gauss(37.9, 0.2)  # Mild hyperthermia from metabolic output
            rr = random.gauss(28.0, 2.0)
            sbp = random.gauss(145.0, 6.0)

        elif scenario == "ARRHYTHMIA":
            # Severe heart rate fluctuations (bradycardia / tachycardia)
            hr = random.choice([random.gauss(38, 2), random.gauss(142, 5)])
            spo2 = random.gauss(94.5, 1.0)
            temp = random.gauss(36.7, 0.1)
            rr = random.gauss(16.0, 1.5)
            sbp = random.gauss(102.0, 8.0)

        elif scenario == "HYPOTHERMIA":
            # Environmental thermal failure
            hr = random.gauss(46, 3)
            spo2 = random.gauss(93.0, 1.5)
            temp = random.gauss(34.4, 0.3)  # Critical low temp
            rr = random.gauss(9.0, 1.0)
            sbp = random.gauss(92.0, 5.0)

        metrics = [
            ("heart_rate", round(float(hr), 1), "bpm"),
            ("spo2", round(float(spo2), 1), "%"),
            ("body_temp", round(float(temp), 1), "°C"),
            ("resp_rate", round(float(rr), 1), "brpm"),
            ("systolic_bp", round(float(sbp), 1), "mmHg")
        ]

        emitted = []
        for metric_name, val, unit in metrics:
            reading = VitalReading(
                astronaut_id=astronaut_id,
                metric=metric_name,
                value=val,
                unit=unit,
                measured_at=now,
                source=f"SIMULATOR_{scenario}",
                received_at=now
            )
            db.add(reading)
            db.commit()
            db.refresh(reading)

            # Evaluate rules engine in real-time
            alert = evaluate_reading(db, reading)

            emitted.append({
                "id": reading.id,
                "astronaut_id": reading.astronaut_id,
                "metric": reading.metric,
                "value": reading.value,
                "unit": reading.unit,
                "measured_at": reading.measured_at.isoformat(),
                "source": reading.source,
                "alert": {
                    "id": alert.id,
                    "severity": alert.severity,
                    "message": alert.message
                } if alert else None
            })

        return emitted

simulator_service = TelemetrySimulator()

