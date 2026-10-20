"""Level 3: the assistant hands over the right tool before the player finishes miming the action.

The player brings a hand into view and mimes one of four actions. Early cues: the
hand shape forming (fist, two fingers, pinch), where the hand heads (up high, to
the mouth, low), the mouth opening before drinking, and the eyes dropping before writing."""
from collections import deque

import numpy as np

from ..assistant import AssistantState, View2D
from ..features import EXTENDED, Velocity, face_width, mouth, pinch, softmax, spread, straightness, swings
from ..ui import GREY
from .base import Level

ROW = 17   # present, 5 straightness, pinch, spread, hand−mouth x/y/dist, velocity x/y, 4 face values
# Row columns: 0 present · 1-5 straightness thumb..pinky · 6 pinch · 7 spread · 8-9 hand relative to
# mouth (face widths) · 10 distance to mouth · 11-12 velocity (face widths/s) · 13 jawOpen ·
# 14 mouthPucker · 15 mouthFunnel · 16 eyes looking down


class Handover(Level):
    key = "handover"
    title = "第三关 · 助手递工具"
    classes = ["cut", "write", "hammer", "drink"]
    names = {"cut": "剪刀", "write": "笔", "hammer": "锤子", "drink": "杯子"}
    intro = [
        "四种动作任选一种比划，右边的助手要在你做完之前把对应的工具递给你：",
        "    剪东西 → 剪刀：食指、中指伸出来，开合两下",
        "    写字 → 笔：拇指和食指捏住，在胸口以下写",
        "    敲钉子 → 锤子：握拳，上下敲两下",
        "    喝水 → 杯子：手像拿着杯子，送到嘴边",
        "每局开始前把手放下离开画面，听到提示音后再抬手做动作。",
    ]
    timeout_ms = 6000
    ready_ms = 600

    def __init__(self, practice=False, view=None):
        super().__init__(practice)
        self.view = view or View2D()
        self.vel = Velocity(0.5)
        self.hist = deque()          # (ts, hand y in face widths, spread, is fist)
        self._near = []
        self._pinch_since = None
        self._ref = None             # (mouth position, face width) from the last frame with a face

    def wait_hint(self):
        return "把手放下离开画面，想好要比划哪个动作"

    def ready(self, obs):
        return obs.hand is None

    def start_trial(self, ts):
        self.vel.reset()
        self.hist.clear()
        self._near, self._pinch_since = [], None

    def _reference(self, obs):
        if obs.face is not None:
            self._ref = (mouth(obs.face), face_width(obs.face))
        if self._ref is None:
            h, w = obs.frame.shape[:2]
            return np.array([w / 2, h * 0.45]), 0.2 * w
        return self._ref

    def features(self, obs):
        m, fw = self._reference(obs)
        b = obs.face.blend if obs.face else {}
        face = [b.get("jawOpen", 0.0), b.get("mouthPucker", 0.0), b.get("mouthFunnel", 0.0),
                (b.get("eyeLookDownLeft", 0.0) + b.get("eyeLookDownRight", 0.0)) / 2]
        hand = obs.hand
        if hand is None:
            self.vel.reset()
            return np.array([0.0] * (ROW - len(face)) + face)
        v = self.vel.update(hand.center, obs.ts) / fw
        s = straightness(hand.world)
        rel = (hand.center - m) / fw
        sp = spread(hand.world)
        self.hist.append((obs.ts, hand.center[1] / fw, sp, bool(np.all(s[1:] < EXTENDED))))
        while self.hist and obs.ts - self.hist[0][0] > 1200:
            self.hist.popleft()
        return np.array([1.0, *s, pinch(hand.world), sp, rel[0], rel[1], np.linalg.norm(rel), v[0], v[1], *face])

    def heuristic(self, obs):
        r = self.rows[-1]
        if r[0] == 0:
            return self.uniform
        s = r[1:6]
        fist = float(np.clip((EXTENDED - s[1:].mean()) / 0.3, 0, 1))
        two = float(np.clip(((s[1] + s[2]) - (s[3] + s[4])) / 2 / 0.3, 0, 1))
        pinchy = float(np.clip((0.6 - r[6]) / 0.4, 0, 1))
        rel, dist, vel = r[8:10], r[10], r[11:13]
        near = float(np.clip(1 - dist / 2.5, 0, 1))
        toward = float(np.clip(-np.dot(vel, rel) / (np.linalg.norm(rel) + 1e-6) / 3, 0, 1))
        up = float(np.clip(-vel[1] / 4, 0, 1))
        high = float(np.clip(-rel[1], 0, 1))           # above the mouth
        low = float(np.clip(rel[1] / 2, 0, 1))         # well below the mouth
        p = softmax({
            "drink": 2.5 * near + 2.0 * toward * near + 2.0 * r[13],
            "hammer": 2.5 * fist + 1.5 * up + 1.5 * high,
            "cut": 3.0 * two + min(r[7], 1.0),
            "write": 3.0 * pinchy + 1.5 * r[16] + 0.5 * low,
        })
        return {c: 0.8 * p[c] + 0.05 for c in self.classes}

    def detect(self, obs):
        if obs.hand is None:
            self._near, self._pinch_since = [], None
            return None
        r, ts = self.rows[-1], obs.ts
        s = r[1:6]
        recent = list(self.hist)

        # Drink: the hand reaches the mouth.
        self._near = self._near + [ts] if r[10] < 1.0 else []
        if len(self._near) >= 3:
            return "drink", self._near[0]
        # Hammer: a fist going up and down.
        if len(recent) >= 5 and all(e[3] for e in recent[-5:]) and swings([e[1] for e in recent], 0.35) >= 2:
            return "hammer", ts
        # Cut: index and middle out, ring and pinky in, the two fingers opening and closing.
        if (s[1] > EXTENDED and s[2] > EXTENDED and s[3] < EXTENDED and s[4] < EXTENDED
                and swings([e[2] for e in recent], 0.12) >= 2):
            return "cut", ts
        # Write: holding a pinch away from the mouth.
        if r[6] < 0.35 and r[10] > 1.5:
            self._pinch_since = self._pinch_since or ts
            if ts - self._pinch_since >= 400:
                return "write", ts
        else:
            self._pinch_since = None
        return None

    def draw_level(self, canvas, hud, obs):
        offered, phase = None, "idle"
        if self.state == "trial":
            best = max(self.probs, key=self.probs.get)
            if self.probs[best] >= self.rule.min_conf:
                offered, phase = best, "handover"
            else:
                phase = "watching"
        elif self.state == "feedback" and self.verdict:
            offered, phase = self.verdict.guess, "result"
        self.view.render(canvas, hud, AssistantState(
            tools=self.classes, names=self.names, probs=self.probs,
            offered=offered, phase=phase, verdict=self.verdict))
        if self.debug and self.rows and self.state == "trial":
            r = self.rows[-1]
            hud.text((20, canvas.shape[0] - 40),
                     f"捏合 {r[6]:.2f} · 张开 {r[7]:.2f} · 离嘴 {r[10]:.1f} 脸宽 · 张嘴 {r[13]:.2f} · 低头看 {r[16]:.2f}",
                     18, GREY)

    def _draw_guess(self, canvas, hud):
        pass    # the assistant panel already shows the AI's belief
