"""Measurement screen: finds the objects in view and labels each with its height, width and distance.

Objects come from YOLOE's prompt-free vocabulary (4,585 names) with tracking, so each
object keeps an ID and its numbers are the median of the last second. Sizes come from
the Depth Anything depth map. When the printed ArUco marker is in view, it fixes one
correction factor for both the depth model's scale and the assumed field of view; the
factor then applies to every object, near or far, and is saved for next time."""
import json
from collections import Counter, deque

import cv2
import numpy as np
import supervision as sv

from ..config import MODEL_DIR
from ..ui import B_WHITE, B_YELLOW, CYAN, GREEN, GREY, WHITE, YELLOW, shade
from ..weights import yolo
from .depth import DepthWorker, backproject, focal_px
from .names import is_person, is_scenery, zh_name
from .ruler import MarkerRuler

MODEL = "yoloe-26m-seg-pf.pt"
CALIBRATION = MODEL_DIR / "measure_calibration.json"
SMOOTH_MS = 1000      # shown numbers are the median over this window
SHOW_MS = 600         # a track not seen for this long leaves the screen
FORGET_MS = 5000      # and is dropped after this long
DEPTH_SCALE = 0.25    # masks are read off a quarter-resolution depth map
MAX_AREA = 0.45       # object masks covering more of the frame than this are scenery (not people:
                      # at a laptop the player often fills half the frame)
MIN_AREA = 0.0008     # masks smaller than this are too small to measure
LABEL_W = 236


def dedupe(boxes, conf, candidates, max_iou=0.7):
    """Drop boxes that overlap a more confident one: YOLOE can name one object twice ("cup", "mug")."""
    kept = []
    for i in sorted(candidates, key=lambda i: -conf[i]):
        b = boxes[i]
        for j in kept:
            k = boxes[j]
            inter = max(0.0, min(b[2], k[2]) - max(b[0], k[0])) * max(0.0, min(b[3], k[3]) - max(b[1], k[1]))
            union = (b[2] - b[0]) * (b[3] - b[1]) + (k[2] - k[0]) * (k[3] - k[1]) - inter
            if inter / (union + 1e-9) > max_iou:
                break
        else:
            kept.append(i)
    return sorted(kept)


def fmt(cm):
    return f"{cm:.1f}" if cm < 100 else f"{cm:.0f}"


class Track:
    """One tracked object: its recent measurements and the names YOLOE gave it."""

    def __init__(self):
        self.samples = deque()   # (ts, height cm, width cm, distance m)
        self.names = Counter()
        self.seen = 0
        self.box = None

    def add(self, ts, name, box, size):
        self.seen, self.box = ts, box
        self.names[name] += 1
        if size is not None:
            self.samples.append((ts, *size))
        while self.samples and ts - self.samples[0][0] > SMOOTH_MS:
            self.samples.popleft()

    @property
    def name(self):
        """The most frequent name, so the label does not flicker between synonyms."""
        return self.names.most_common(1)[0][0]

    def size(self):
        if not self.samples:
            return None
        return tuple(float(np.median([s[i] for s in self.samples])) for i in (1, 2, 3))


class MeasureMode:
    uses_perception = False

    def __init__(self, marker_mm=50.0, hfov_deg=70.0, mirrored=True):
        self.marker = MarkerRuler(marker_mm, mirrored)
        self.model = yolo(MODEL)
        self.hfov = hfov_deg
        self.scale, self.scale_note = self._load_scale()
        self._scale_samples = deque(maxlen=15)
        self._marker_seen = None     # (corners, ts) from the latest calibration
        self.show_people = True
        self.tracks = {}
        self.dets = sv.Detections.empty()
        self.frame = None
        self.ts = 0
        self._small = None
        self.done = False
        self._masks = sv.MaskAnnotator(opacity=0.35, color_lookup=sv.ColorLookup.TRACK)
        self.depth = DepthWorker(on_result=self._calibrate)   # last: its callback uses the fields above

    # ----- calibration ------------------------------------------------------------------
    @staticmethod
    def _load_scale():
        try:
            return float(json.loads(CALIBRATION.read_text(encoding="utf-8"))["scale"]), "上次保存的"
        except (OSError, ValueError, KeyError):
            return 1.0, None

    def _calibrate(self, depth, frame):
        """Runs in the depth thread for each new depth map: if the marker is in that frame,
        compare its true size with the size the depth map implies."""
        ruler = self.marker.find(frame)
        if ruler is None:
            return
        f = focal_px(frame.shape[1], self.hfov)
        pts = [backproject(depth, c, f) for c in ruler.corners]
        est_mm = 1000 * float(np.mean([np.linalg.norm(pts[i] - pts[(i + 1) % 4]) for i in range(4)]))
        if est_mm <= 1:
            return
        self._scale_samples.append(self.marker.size_mm / est_mm)
        self.scale = float(np.median(self._scale_samples))
        self.scale_note = "标记"
        self._marker_seen = (ruler.corners, self.ts)
        try:
            CALIBRATION.write_text(json.dumps({"scale": self.scale, "marker_mm": self.marker.size_mm,
                                               "hfov_deg": self.hfov}), encoding="utf-8")
        except OSError:
            pass

    def reset_calibration(self):
        self.scale, self.scale_note = 1.0, None
        self._scale_samples.clear()
        CALIBRATION.unlink(missing_ok=True)

    # ----- per frame --------------------------------------------------------------------
    def update(self, obs):
        self.frame, self.ts = obs.frame, obs.ts
        self.depth.submit(obs.frame)
        self._detect(obs.ts)
        for tid in [t for t, tr in self.tracks.items() if obs.ts - tr.seen > FORGET_MS]:
            del self.tracks[tid]

    def _detect(self, ts):
        r = self.model.track(self.frame, persist=True, conf=0.3, verbose=False)[0]
        dets = sv.Detections.from_ultralytics(r)
        if len(dets) == 0 or dets.tracker_id is None or r.masks is None:
            self.dets = sv.Detections.empty()
            return
        h, w = self.frame.shape[:2]
        names = [r.names[int(c)] for c in dets.class_id]
        polys = r.masks.xy
        candidates = []
        for i, (name, poly) in enumerate(zip(names, polys)):
            person = is_person(name)
            if is_scenery(name) or (person and not self.show_people) or len(poly) < 3:
                continue
            area = cv2.contourArea(poly.astype(np.float32)) / (w * h)
            if area < MIN_AREA or (area > MAX_AREA and not person):
                continue
            candidates.append(i)
        keep = dedupe(dets.xyxy, dets.confidence, candidates)
        depth = self._depth_small()
        for i in keep:
            track = self.tracks.setdefault(int(dets.tracker_id[i]), Track())
            track.add(ts, names[i], dets.xyxy[i], self._size(polys[i], depth))
        self.dets = dets[keep] if keep else sv.Detections.empty()

    def _depth_small(self):
        latest = self.depth.latest
        if latest is None:
            return None
        if self._small is None or self._small[0] is not latest[0]:
            small = cv2.resize(latest[0], None, fx=DEPTH_SCALE, fy=DEPTH_SCALE, interpolation=cv2.INTER_AREA)
            self._small = (latest[0], small)
        return self._small[1]

    def _size(self, poly, depth):
        """(height cm, width cm, distance m) of one outline, or None until depth is ready.

        Uses the median depth inside the outline (edge pixels dropped, since they often
        see the background), so height and width are taken square to the camera."""
        if depth is None:
            return None
        mask = np.zeros(depth.shape, np.uint8)
        cv2.fillPoly(mask, [(poly * DEPTH_SCALE).astype(np.int32)], 1)
        inner = cv2.erode(mask, np.ones((3, 3), np.uint8))
        z = depth[(inner if inner.any() else mask) > 0]
        if z.size == 0:
            return None
        z = float(np.median(z))
        per_px = z / focal_px(self.frame.shape[1], self.hfov) * self.scale * 100   # cm per pixel
        return np.ptp(poly[:, 1]) * per_px, np.ptp(poly[:, 0]) * per_px, z * self.scale

    # ----- input ------------------------------------------------------------------------
    def on_mouse(self, event, x, y):
        pass

    def on_key(self, key, ts):
        if key == ord("p"):
            self.show_people = not self.show_people
        elif key == ord("k"):
            self.reset_calibration()

    # ----- drawing ----------------------------------------------------------------------
    def draw(self, canvas, hud, obs):
        h, w = canvas.shape[:2]
        if len(self.dets):
            canvas[:] = self._masks.annotate(scene=canvas.copy(), detections=self.dets)

        placed = []
        shown = 0
        for tid in (self.dets.tracker_id if len(self.dets) else []):
            track = self.tracks.get(int(tid))
            if track is None or self.ts - track.seen > SHOW_MS:
                continue
            shown += 1
            size = track.size()
            lines = [zh_name(track.name)]
            if size:
                lines += [f"高 {fmt(size[0])} × 宽 {fmt(size[1])} cm", f"离镜头 {size[2]:.2f} m"]
            else:
                lines.append("测量中…")
            self._label(canvas, hud, track.box, lines, placed, calibrated=self.scale_note is not None)

        if self._marker_seen is not None and self.ts - self._marker_seen[1] < 600:
            cv2.polylines(canvas, [self._marker_seen[0].astype(np.int32)], True, B_YELLOW, 3)

        shade(canvas, 0, 0, w, 56)
        hud.text((20, 12), "测量模式", 28, YELLOW)
        depth_state = {"loading": "深度模型加载中…", "ready": "深度模型就绪"}.get(self.depth.status, self.depth.status)
        calib = (f"已校准（{self.scale_note}，系数 ×{self.scale:.2f}）" if self.scale_note
                 else "未校准")
        hud.text((w - 20, 16), f"识别到 {shown} 个物体 · {depth_state} · {calib}", 20, WHITE, anchor="ra")
        if self.scale_note is None:
            hud.text((w / 2, 66), "把打印的标记放进画面一两秒，可以校准所有物体的尺寸（误差从约 15% 降到几个百分点）",
                     18, CYAN, anchor="ma")
        shade(canvas, 0, h - 36, w, h)
        hud.text((w / 2, h - 30), "P 隐藏/显示人 · K 清除校准 · ESC 退出", 18, GREY, anchor="ma")

    def _label(self, canvas, hud, box, lines, placed, calibrated):
        """Put the label beside the object (right, left, above, below), avoiding earlier labels."""
        h, w = canvas.shape[:2]
        x0, y0, x1, y1 = (int(v) for v in box)
        lh = 26 * len(lines) + 8
        rect = None
        for cx, cy in [(x1 + 8, y0), (x0 - LABEL_W - 8, y0), (x0, y0 - lh - 6), (x0, y1 + 6), (x0 + 6, y0 + 6)]:
            cx, cy = int(np.clip(cx, 0, w - LABEL_W)), int(np.clip(cy, 90, h - lh - 40))
            rect = (cx, cy, cx + LABEL_W, cy + lh)
            if not any(rect[0] < p[2] and p[0] < rect[2] and rect[1] < p[3] and p[1] < rect[3] for p in placed):
                break
        placed.append(rect)
        # Leader line from the label to the nearest point of the object's box.
        mid = ((rect[0] + rect[2]) // 2, (rect[1] + rect[3]) // 2)
        near = (int(np.clip(mid[0], x0, x1)), int(np.clip(mid[1], y0, y1)))
        cv2.line(canvas, near, (int(np.clip(near[0], rect[0], rect[2])), int(np.clip(near[1], rect[1], rect[3]))),
                 B_WHITE, 1, cv2.LINE_AA)
        shade(canvas, *rect, 0.62)
        for i, line in enumerate(lines):
            color = YELLOW if i == 0 else (GREEN if calibrated else WHITE)
            hud.text((rect[0] + 8, rect[1] + 4 + 26 * i), line, 20 if i == 0 else 18, color)
