"""YOLO weights, kept in the project's models/ folder instead of the working directory."""
from .config import MODEL_DIR


def yolo(name):
    from ultralytics import YOLO
    from ultralytics.utils.downloads import attempt_download_asset

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    path = MODEL_DIR / name
    if not path.exists():
        attempt_download_asset(path)
    return YOLO(str(path))
