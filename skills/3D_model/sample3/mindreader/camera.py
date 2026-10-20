"""Threaded webcam reader, so slow processing never backs up the capture buffer."""
import threading
import time

import cv2


class Camera:
    def __init__(self, cfg):
        self.cfg = cfg
        self._cap = None
        self._thread = None
        self._lock = threading.Lock()
        self._frame = None
        self._ts = 0
        self._seq = 0
        self._running = False

    def start(self):
        # Media Foundation first: on this laptop's webcam DirectShow falls back to raw YUY2
        # and manages only 10 fps at 720p, while Media Foundation delivers 30.
        for api in (cv2.CAP_MSMF, cv2.CAP_DSHOW):
            cap = cv2.VideoCapture(self.cfg.index, api)
            if cap.isOpened():
                break
            cap.release()
        else:
            raise RuntimeError(f"打不开摄像头 {self.cfg.index}")
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.cfg.width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.cfg.height)
        cap.set(cv2.CAP_PROP_FPS, 30)
        self._cap = cap
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        return self

    def _loop(self):
        while self._running:
            ok, frame = self._cap.read()
            if not ok:
                time.sleep(0.01)
                continue
            if self.cfg.mirror:
                frame = cv2.flip(frame, 1)
            with self._lock:
                self._frame = frame
                self._ts = int(time.monotonic() * 1000)
                self._seq += 1

    def read(self):
        """Latest frame, its capture time in ms, and a sequence number for skipping repeats."""
        with self._lock:
            return self._frame, self._ts, self._seq

    def stop(self):
        self._running = False
        if self._thread is not None:
            self._thread.join(timeout=1.0)
        if self._cap is not None:
            self._cap.release()
