"""Level 2: tell which of three cups the player will reach for, before the hand gets there.

Evidence: the eyes usually land on the target before the hand moves (calibrated per
player by looking at each cup), then the hand's direction of travel."""
import cv2
import numpy as np

from ..features import Velocity, gaze_vector, normalize
from ..ui import B_WHITE, B_YELLOW, GREY, WHITE, YELLOW, beep, shade
from ..weights import yolo
from .base import SPACE, Level

CUP_CLASSES = [39, 40, 41, 45]                 # COCO: bottle, wine glass, cup, bowl
TARGETS = ["screen", "left", "middle", "right"]  # gaze calibration order
TARGET_NAMES = {"screen": "屏幕中央", "left": "左边的杯子", "middle": "中间的杯子", "right": "右边的杯子"}
ROW = 12   # 4 gaze posteriors, hand present, 3 direction cosines, 3 distances, speed


class Reach(Level):
    key = "reach"
    title = "第二关 · 你要拿哪个杯子"
    classes = ["left", "middle", "right"]
    names = {"left": "左杯", "middle": "中杯", "right": "右杯"}
    intro = [
        "把 3 个杯子垫高，放进画面下半部分，左、中、右分开一点。",
        "第一次要校准：先自动找杯子，再跟着提示分别看屏幕和每个杯子。",
        "每一局看到「开始」后，随便选一个杯子伸手去碰。",
        "AI 要在你碰到之前猜中是哪一个。可以先看一个再拿另一个来考它。",
    ]
    timeout_ms = 6000
    ready_ms = 700
    banner_at_top = True    # the cups sit in the lower half of the frame
    SETTLE_MS, DWELL_MS = 900, 2400

    def __init__(self, practice=False):
        super().__init__(practice)
        self.boxes = []             # (x0, y0, x1, y1) per cup, left to right on screen
        self.phase = "find"         # setup steps: find → confirm (or click) → gaze
        self._phase_since = None
        self._yolo = None
        self.clicks = []
        self._frame_w = 1280
        self.gaze_samples = {t: [] for t in TARGETS}
        self.gaze_mu = self.gaze_sigma = None
        self.gaze_post = np.full(len(TARGETS), 1 / len(TARGETS))
        self._target_i = 0
        self.vel = Velocity(0.5)
        self.choices = []
        self._touch = []

    # ----- setup: find cups, then calibrate gaze -------------------------------------------
    def _set_phase(self, phase):
        self.phase, self._phase_since = phase, None
        if phase == "gaze":
            self._target_i = 0
            self.gaze_samples = {t: [] for t in TARGETS}

    def restart_setup(self):
        self._set_phase("find")

    def setup(self, obs):
        self._frame_w = obs.frame.shape[1]
        if self._phase_since is None:
            self._phase_since = obs.ts
        if self.phase == "find":
            if self._yolo is None:
                self._yolo = yolo("yolo26n.pt")
            r = self._yolo.predict(obs.frame, classes=CUP_CLASSES, conf=0.3, verbose=False)[0]
            if len(r.boxes) >= 3:
                order = np.argsort(-r.boxes.conf.cpu().numpy())[:3]
                top = r.boxes.xyxy.cpu().numpy()[order]
                self.boxes = sorted((tuple(b) for b in top), key=lambda b: b[0] + b[2])
                self._set_phase("confirm")
            elif obs.ts - self._phase_since > 4000:
                self._set_phase("click")
            return False
        if self.phase == "gaze":
            return self._calibrate_gaze(obs)
        return False      # confirm / click wait for the keyboard or mouse

    def setup_key(self, key):
        if self.phase == "confirm" and key == SPACE:
            self._set_phase("gaze")
        elif key == ord("c"):
            self.clicks = []
            self._set_phase("click")
        elif key == ord("a"):
            self._set_phase("find")

    def on_mouse(self, event, x, y):
        if self.state == "setup" and self.phase == "click" and event == cv2.EVENT_LBUTTONDOWN:
            self.clicks.append((x, y))
            if len(self.clicks) == 3:
                r = 0.05 * self._frame_w
                self.boxes = sorted(((cx - r, cy - r, cx + r, cy + r) for cx, cy in self.clicks),
                                    key=lambda b: b[0])
                self.clicks = []
                self._set_phase("confirm")

    def _calibrate_gaze(self, obs):
        target = TARGETS[self._target_i]
        if self._phase_since == obs.ts:
            beep(880, 80)
        t = obs.ts - self._phase_since
        if obs.face is not None and t >= self.SETTLE_MS:
            self.gaze_samples[target].append(gaze_vector(obs.face))
        if t < self.DWELL_MS:
            return False
        self._target_i += 1
        self._phase_since = None        # restarts the dwell clock (and the beep) on the next frame
        if self._target_i < len(TARGETS):
            return False
        if any(len(self.gaze_samples[t]) < 5 for t in TARGETS):
            self.message = "校准时没看清你的脸，重新校准一次"
            self._set_phase("gaze")
            return False
        mus = np.array([np.mean(self.gaze_samples[t], axis=0) for t in TARGETS])
        within = np.concatenate([np.array(self.gaze_samples[t]) - mus[i] for i, t in enumerate(TARGETS)])
        self.gaze_mu = mus
        self.gaze_sigma = np.maximum(np.maximum(within.std(axis=0), 0.25 * mus.std(axis=0)), 1e-3)
        self.message = ""
        return True

    # ----- trial ------------------------------------------------------------------------
    @property
    def centers(self):
        return [np.array([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]) for b in self.boxes]

    @staticmethod
    def _inside(p, box, grow):
        x0, y0, x1, y1 = box
        gx, gy = (x1 - x0) * grow, (y1 - y0) * grow
        return x0 - gx <= p[0] <= x1 + gx and y0 - gy <= p[1] <= y1 + gy

    def wait_hint(self):
        return "看着屏幕，手离开杯子，等「开始」的提示音（C 重新校准）"

    def ready(self, obs):
        hand = obs.hand
        return obs.face is not None and (hand is None or not any(self._inside(hand.center, b, 0.6) for b in self.boxes))

    def start_trial(self, ts):
        self.vel.reset()
        self._touch = []

    def _update_gaze(self, face):
        if face is None or self.gaze_mu is None:
            return
        d2 = (((gaze_vector(face) - self.gaze_mu) / self.gaze_sigma) ** 2).sum(axis=1)
        e = np.exp(-(d2 - d2.min()) / 4)       # temperature 2 keeps one noisy frame from deciding
        self.gaze_post = 0.6 * e / e.sum() + 0.4 * self.gaze_post

    def features(self, obs):
        self._update_gaze(obs.face)
        hand = obs.hand
        if hand is None:
            self.vel.reset()
            return np.array([*self.gaze_post, 0, 0, 0, 0, 1, 1, 1, 0])
        v = self.vel.update(hand.center, obs.ts)
        w = obs.frame.shape[1]
        cos, dist = [], []
        for c in self.centers:
            to = c - hand.center
            d = float(np.linalg.norm(to))
            cos.append(float(np.dot(v, to) / (np.linalg.norm(v) * d + 1e-6)))
            dist.append(d / w)
        return np.array([*self.gaze_post, 1.0, *cos, *dist, np.linalg.norm(v) / w])

    def heuristic(self, obs):
        row = self.rows[-1]
        screen, cups = row[0], row[1:4] + 1e-3
        logp = np.log((1 - screen) * cups / cups.sum() + screen / 3)
        if row[4]:
            cos, dist, speed = row[5:8], row[8:11], row[11]
            logp = logp + 3.0 * min(1.0, speed / 0.6) * cos - dist / 0.3
        e = np.exp(logp - logp.max())
        return dict(zip(self.classes, e / e.sum()))

    def prior(self):
        counts = {c: 2.0 for c in self.classes}
        for c in self.choices:
            counts[c] += 1
        p = normalize(counts)
        return {c: 0.7 / 3 + 0.3 * p[c] for c in self.classes}

    def detect(self, obs):
        hand = obs.hand
        inside = None
        if hand is not None:
            points = list(hand.px[[4, 8, 12]]) + [hand.center]
            for i, box in enumerate(self.boxes):
                if any(self._inside(p, box, 0.15) for p in points):
                    inside = i
                    break
        if inside is None or (self._touch and self._touch[-1][1] != inside):
            self._touch = []
        if inside is not None:
            self._touch.append((obs.ts, inside))
        if len(self._touch) >= 2:
            return self.classes[self._touch[0][1]], self._touch[0][0]
        return None

    def on_verdict(self, v):
        self.choices.append(v.truth)

    # ----- drawing ----------------------------------------------------------------------
    def _draw_guess(self, canvas, hud):
        pass    # the cup boxes already show the AI's belief

    def draw_level(self, canvas, hud, obs):
        h, w = canvas.shape[:2]
        best = max(self.probs, key=self.probs.get)
        for box, c in zip(self.boxes, self.classes):
            p0, p1 = (int(box[0]), int(box[1])), (int(box[2]), int(box[3]))
            lit = self.state in ("trial", "feedback") and self.live_guess
            color = B_YELLOW if lit and c == best else B_WHITE
            thick = 2 + int(6 * self.probs[c]) if lit else 2
            if self.state == "setup" and self.phase == "gaze" and TARGETS[self._target_i] == c:
                color, thick = B_YELLOW, 6
            cv2.rectangle(canvas, p0, p1, color, thick)
            label = self.name(c) + (f" {self.probs[c]:.0%}" if lit else "")
            hud.text((p0[0], p0[1] - 30), label, 22, YELLOW if color == B_YELLOW else WHITE)

        if self.debug and self.gaze_mu is not None:
            shade(canvas, 0, h - 34, 420, h)
            hud.text((10, h - 30), "视线 屏/左/中/右 " + " ".join(f"{p:.2f}" for p in self.gaze_post), 18, GREY)
        if self.state != "setup":
            return
        if self.phase == "find":
            self._banner(canvas, hud, ["正在找杯子……把 3 个杯子垫高放进画面下半部分",
                                       "4 秒内找不到会改成用鼠标点选"], WHITE)
        elif self.phase == "click":
            for x, y in self.clicks:
                cv2.circle(canvas, (int(x), int(y)), 10, B_YELLOW, -1)
            self._banner(canvas, hud, [f"用鼠标依次点 3 个杯子的中心（已点 {len(self.clicks)}/3）",
                                       "A 改回自动寻找"], WHITE)
        elif self.phase == "confirm":
            self._banner(canvas, hud, ["框对了吗？空格 确认 · C 用鼠标点选 · A 重新自动寻找"], WHITE)
        elif self.phase == "gaze":
            target = TARGETS[self._target_i]
            if target == "screen":
                cv2.circle(canvas, (w // 2, h // 2), 26, B_YELLOW, 4)
                cv2.circle(canvas, (w // 2, h // 2), 6, B_YELLOW, -1)
            left = 1 + (self.DWELL_MS - (obs.ts - (self._phase_since or obs.ts))) // 1000
            hint = [self.message] if self.message else []
            self._banner(canvas, hud, hint + [f"校准视线：盯着 {TARGET_NAMES[target]}（{left} 秒）",
                                              f"第 {self._target_i + 1}/{len(TARGETS)} 个目标，头和眼睛都自然地看过去"],
                         YELLOW)
