"""Metric depth from a single image with Depth Anything V2 (indoor), run in a background thread.

Every object's size comes from this map. Uncalibrated, expect roughly 10-20 % error: the
model was trained on other cameras, and turning depth into size also relies on the
assumed field of view. The ArUco marker corrects both with one factor (see mode.py)."""
import threading
import time

import cv2
import numpy as np

MODEL_ID = "depth-anything/Depth-Anything-V2-Metric-Indoor-Small-hf"


class DepthWorker:
    def __init__(self, on_result=None, min_interval=0.15, short_side=392):
        self.status = "loading"      # loading → ready, or "error: …"
        self.latest = None           # (depth in metres (H, W), frame it came from)
        self.on_result = on_result   # called as on_result(depth, frame) in the worker thread
        self.min_interval = min_interval   # seconds between runs, leaving the GPU to the detector
        self.short_side = short_side       # model input size; a multiple of 14
        self._pending = None
        self._lock = threading.Lock()
        threading.Thread(target=self._run, daemon=True).start()

    def submit(self, frame):
        with self._lock:
            self._pending = frame

    def _run(self):
        try:
            import torch
            from transformers import AutoImageProcessor, AutoModelForDepthEstimation
            device = "cuda" if torch.cuda.is_available() else "cpu"
            dtype = torch.float16 if device == "cuda" else torch.float32
            processor = AutoImageProcessor.from_pretrained(
                MODEL_ID, size={"height": self.short_side, "width": self.short_side})
            model = AutoModelForDepthEstimation.from_pretrained(MODEL_ID, dtype=dtype).to(device).eval()
        except Exception as e:  # noqa: BLE001 - show any load failure in the window
            self.status = f"error: {e}"
            return
        self.status = "ready"
        last = 0.0
        while True:
            wait = self.min_interval - (time.monotonic() - last)
            if wait > 0:
                time.sleep(wait)
            with self._lock:
                frame, self._pending = self._pending, None
            if frame is None:
                time.sleep(0.01)
                continue
            last = time.monotonic()
            inputs = processor(images=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), return_tensors="pt")
            inputs = {k: v.to(device, dtype) for k, v in inputs.items()}
            with torch.inference_mode():
                depth = model(**inputs).predicted_depth
                depth = torch.nn.functional.interpolate(depth[:, None], size=frame.shape[:2],
                                                        mode="bilinear", align_corners=False)[0, 0]
            self.latest = (depth.float().cpu().numpy(), frame)
            if self.on_result is not None:
                self.on_result(*self.latest)


def focal_px(width, hfov_deg):
    return (width / 2) / np.tan(np.radians(hfov_deg) / 2)


def depth_at(depth, x, y, r=3):
    h, w = depth.shape
    x, y = int(np.clip(x, 0, w - 1)), int(np.clip(y, 0, h - 1))
    return float(np.median(depth[max(0, y - r):y + r + 1, max(0, x - r):x + r + 1]))


def backproject(depth, p, f):
    h, w = depth.shape
    z = depth_at(depth, *p)
    return np.array([(p[0] - w / 2) * z / f, (p[1] - h / 2) * z / f, z])
