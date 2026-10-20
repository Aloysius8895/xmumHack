"""Shared settings: paths, camera, and the pass rule for each level."""
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"      # recorded trials, one .npz per trial
MODEL_DIR = ROOT / "models"   # MediaPipe .task files, YOLO weights, trained predictors


@dataclass
class CameraConfig:
    index: int = 0
    width: int = 1280
    height: int = 720
    mirror: bool = True       # show the player a mirror image
    hfov_deg: float = 70.0    # assumed horizontal field of view, used to turn depth into sizes


@dataclass(frozen=True)
class LevelRule:
    trials: int          # trials in one challenge run
    need_correct: int    # the AI passes with at least this many correct predictions
    min_lead_ms: int     # a prediction only counts if it was locked this long before the action
    min_conf: float      # and held at or above this confidence the whole time
    horizon_ms: int      # training windows end at most this long before the action


RULES = {
    "rps":      LevelRule(trials=10, need_correct=6, min_lead_ms=100, min_conf=0.45, horizon_ms=600),
    "reach":    LevelRule(trials=8,  need_correct=6, min_lead_ms=300, min_conf=0.50, horizon_ms=1500),
    "handover": LevelRule(trials=5,  need_correct=4, min_lead_ms=300, min_conf=0.40, horizon_ms=1200),
}
