"""MediaPipe hand and face landmarks for one frame, in the form the levels use."""
import urllib.request
from dataclasses import dataclass, field

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision

from .config import MODEL_DIR

_TASK_URL = "https://storage.googleapis.com/mediapipe-models/{0}_landmarker/{0}_landmarker/float16/latest/{0}_landmarker.task"


def task_path(name):
    """Local path of a MediaPipe landmarker model ("hand" or "face"), downloaded on first use."""
    path = MODEL_DIR / f"{name}_landmarker.task"
    if not path.exists():
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        print(f"下载 MediaPipe {name} 模型 …")
        part = path.with_suffix(".part")
        urllib.request.urlretrieve(_TASK_URL.format(name), part)
        part.replace(path)
    return str(path)


@dataclass
class Hand:
    px: np.ndarray      # (21, 2) pixel coordinates
    world: np.ndarray   # (21, 3) metres around the hand centre; use for shape, not position
    score: float

    @property
    def center(self):
        return self.px[[0, 5, 9, 13, 17]].mean(axis=0)

    @property
    def size(self):
        """Wrist to middle knuckle in pixels, the unit for hand speeds."""
        return float(np.linalg.norm(self.px[0] - self.px[9])) + 1e-6


@dataclass
class Face:
    px: np.ndarray      # (478, 2) pixel coordinates, irises included
    blend: dict         # 52 blendshape scores in 0..1, e.g. "jawOpen", "eyeLookDownLeft"


@dataclass
class Observation:
    ts: int
    frame: np.ndarray
    hands: list = field(default_factory=list)
    face: Face | None = None

    @property
    def hand(self):
        """The biggest hand in view, which is normally the one doing the action."""
        return max(self.hands, key=lambda h: h.size, default=None)


class Perception:
    def __init__(self, hands=True, face=True, num_hands=2):
        self._hands = self._face = None
        if hands:
            self._hands = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=task_path("hand")),
                running_mode=vision.RunningMode.VIDEO,
                num_hands=num_hands,
                min_hand_detection_confidence=0.5,
                min_tracking_confidence=0.5))
        if face:
            self._face = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=task_path("face")),
                running_mode=vision.RunningMode.VIDEO,
                num_faces=1,
                output_face_blendshapes=True))
        self._last_ts = -1

    def process(self, frame, ts):
        ts = max(ts, self._last_ts + 1)   # MediaPipe needs strictly increasing timestamps
        self._last_ts = ts
        h, w = frame.shape[:2]
        scale = np.array([w, h], dtype=np.float64)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        obs = Observation(ts=ts, frame=frame)

        if self._hands:
            r = self._hands.detect_for_video(image, ts)
            for lms, world, handed in zip(r.hand_landmarks, r.hand_world_landmarks, r.handedness):
                obs.hands.append(Hand(
                    px=np.array([[p.x, p.y] for p in lms]) * scale,
                    world=np.array([[p.x, p.y, p.z] for p in world]),
                    score=handed[0].score if handed else 0.0))

        if self._face:
            r = self._face.detect_for_video(image, ts)
            if r.face_landmarks:
                blend = {c.category_name: c.score for c in r.face_blendshapes[0]} if r.face_blendshapes else {}
                obs.face = Face(px=np.array([[p.x, p.y] for p in r.face_landmarks[0]]) * scale, blend=blend)
        return obs

    def close(self):
        for task in (self._hands, self._face):
            if task is not None:
                task.close()
