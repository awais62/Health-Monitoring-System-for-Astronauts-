import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models import VitalReading, ModelResult

class AnomalyDetectorService:
    def __init__(self):
        self.model_version = "isoforest_aerospace_v1.0"
        self.feature_columns = ["heart_rate", "spo2", "body_temp", "resp_rate", "systolic_bp"]
        self.model: Optional[IsolationForest] = None
        self._train_baseline_model()

    def _train_baseline_model(self):
        """
        Train an Isolation Forest model on synthetic baseline nominal physiological data.
        Features represent nominal resting and low-activity astronaut biometrics in microgravity.
        """
        np.random.seed(42)
        n_samples = 1500

        # Normal distributions representing baseline astronaut physiology
        hr = np.random.normal(loc=70.0, scale=8.0, size=n_samples)      # 54 - 86 bpm
        spo2 = np.random.normal(loc=98.0, scale=1.0, size=n_samples)    # 96 - 100 %
        temp = np.random.normal(loc=36.8, scale=0.3, size=n_samples)    # 36.2 - 37.4 C
        rr = np.random.normal(loc=14.0, scale=2.0, size=n_samples)      # 10 - 18 brpm
        sbp = np.random.normal(loc=115.0, scale=8.0, size=n_samples)    # 99 - 131 mmHg

        # Clip to realistic physical limits
        spo2 = np.clip(spo2, 95.0, 100.0)
        temp = np.clip(temp, 36.0, 37.5)

        X_train = np.column_stack([hr, spo2, temp, rr, sbp])

        # Isolation Forest with contamination parameter
        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.03,
            random_state=42
        )
        self.model.fit(X_train)

    def analyze_window(self, db: Session, astronaut_id: str, window_minutes: int = 15) -> Dict[str, Any]:
        """
        Analyze the recent telemetry time window for an astronaut.
        Produces multi-variate anomaly score, flag, and explainable feature deviations.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        start_time = now - timedelta(minutes=window_minutes)

        readings = db.query(VitalReading).filter(
            VitalReading.astronaut_id == astronaut_id,
            VitalReading.measured_at >= start_time
        ).order_by(VitalReading.measured_at.asc()).all()

        if not readings:
            return {
                "astronaut_id": astronaut_id,
                "window_start": start_time,
                "window_end": now,
                "model_version": self.model_version,
                "score": 0.0,
                "flag": False,
                "is_experimental": True,
                "explanation": "Insufficient telemetry data points in the requested time window.",
                "metrics_analyzed": self.feature_columns
            }

        # Organize readings into metric averages over the window
        metric_values: Dict[str, List[float]] = {k: [] for k in self.feature_columns}
        for r in readings:
            if r.metric in metric_values:
                metric_values[r.metric].append(r.value)

        # Impute missing metrics with nominal population medians if incomplete
        medians = {
            "heart_rate": 70.0,
            "spo2": 98.0,
            "body_temp": 36.8,
            "resp_rate": 14.0,
            "systolic_bp": 115.0
        }

        vector = []
        deviations = []
        for m in self.feature_columns:
            vals = metric_values[m]
            mean_val = float(np.mean(vals)) if vals else medians[m]
            vector.append(mean_val)
            
            # Record noteworthy deviations for explainability
            if m == "spo2" and mean_val < 94.0:
                deviations.append(f"SpO2 depressed ({mean_val:.1f}%)")
            elif m == "heart_rate" and (mean_val > 105.0 or mean_val < 50.0):
                deviations.append(f"Heart rate anomalous ({mean_val:.1f} bpm)")
            elif m == "body_temp" and (mean_val > 37.8 or mean_val < 35.8):
                deviations.append(f"Core temp deviation ({mean_val:.1f}°C)")
            elif m == "resp_rate" and (mean_val > 22.0 or mean_val < 10.0):
                deviations.append(f"Respiration anomalous ({mean_val:.1f} brpm)")

        X = np.array([vector])

        # IsolationForest decision_function: lower score = more anomalous
        raw_score = float(self.model.decision_function(X)[0])
        # Normalize into [0, 1] anomaly score where 1.0 is most anomalous
        # decision_function typically sits around [-0.3, +0.2]
        norm_score = float(np.clip(1.0 - (raw_score + 0.25) / 0.5, 0.0, 1.0))
        flag = bool(norm_score >= 0.65 or len(deviations) >= 2)

        if flag:
            reason = "Multi-variate pattern deviation detected: " + (", ".join(deviations) if deviations else "Joint biometric divergence from nominal baseline.")
        else:
            reason = "Biometric trajectory consistent with nominal microgravity baseline."

        # Persist result to database
        model_result = ModelResult(
            astronaut_id=astronaut_id,
            window_start=start_time,
            window_end=now,
            model_version=self.model_version,
            score=round(norm_score, 3),
            flag=flag,
            explanation=reason,
            created_at=now
        )
        db.add(model_result)
        db.commit()

        return {
            "astronaut_id": astronaut_id,
            "window_start": start_time,
            "window_end": now,
            "model_version": self.model_version,
            "score": round(norm_score, 3),
            "flag": flag,
            "is_experimental": True,
            "explanation": reason,
            "metrics_analyzed": self.feature_columns
        }

ml_service = AnomalyDetectorService()

