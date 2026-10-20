"""Level 1: read the player's rock-paper-scissors throw before it lands.

Two sources of evidence: fingers starting to open in the last downswing (scissors
or paper), and the player's habits across rounds. A closed fist carries no early
signal, so rock can only be called ahead of time from habits."""
import random

import numpy as np

from ..features import Velocity, normalize, pinch, rps_shape, sigmoid, spread, straightness
from ..ui import CYAN, GREY, WHITE, YELLOW, beep, shade
from .base import Level

BEATEN_BY = {"rock": "paper", "paper": "scissors", "scissors": "rock"}   # value beats key
AUX_FACE = ["browDownLeft", "browDownRight", "mouthPressLeft", "mouthPressRight", "jawOpen"]
ROW = 10 + len(AUX_FACE)   # present, 5 straightness, spread, pinch, vertical speed, speed, face


class RockPaperScissors(Level):
    key = "rps"
    title = "第一关 · 读心猜拳"
    classes = ["rock", "scissors", "paper"]
    names = {"rock": "石头", "scissors": "剪刀", "paper": "布"}
    intro = [
        "跟着节拍摆动拳头：石头 → 剪刀 → 布！，在「布！」那一拍亮出你的手势。",
        "AI 要在你亮出手势之前猜中你出什么，然后出能赢你的那一招。",
        "你可以故意使坏，AI 也会边玩边学你的出拳习惯。",
        "准备姿势：握拳举到镜头前，手掌侧面对着镜头。",
    ]
    BEAT_MS = 600
    BEATS = ["石头", "剪刀", "布！"]
    timeout_ms = 3400
    ready_ms = 500

    def __init__(self, practice=False):
        super().__init__(practice)
        self.live_guess = practice      # in a challenge the guess stays hidden until the throw
        self.history = []               # (player move, AI move, outcome for the player)
        self.vel = Velocity(0.5)
        self.vy = 0.0
        self._run = []
        self._beat = -1
        self.ai_move = None

    def wait_hint(self):
        return "握拳举到镜头前，准备好就会开始"

    def ready(self, obs):
        hand = obs.hand
        return hand is not None and rps_shape(hand.world) == "rock"

    def start_trial(self, ts):
        self._beat, self._run, self.ai_move = 0, [], None
        self.vel.reset()

    def features(self, obs):
        beat = (obs.ts - self.t0) // self.BEAT_MS
        if beat != self._beat and beat < len(self.BEATS):
            self._beat = beat
            beep(990 if beat == len(self.BEATS) - 1 else 660, 80)

        hand = obs.hand
        if hand is None:
            self.vel.reset()
            self.vy = 0.0
            return np.zeros(ROW)
        v = self.vel.update(hand.center, obs.ts)
        self.vy = v[1] / hand.size      # hand sizes per second, + is downward
        face = [obs.face.blend.get(k, 0.0) for k in AUX_FACE] if obs.face else [0.0] * len(AUX_FACE)
        return np.array([1.0, *straightness(hand.world), spread(hand.world), pinch(hand.world),
                         self.vy / 10, np.linalg.norm(v) / hand.size / 10, *face])

    def heuristic(self, obs):
        rows = self.rows[-4:]
        now, then = rows[-1], rows[0]
        if now[0] == 0:
            return self.uniform
        rate = now - then if then[0] else np.zeros_like(now)
        # Columns 2-3 are index and middle, 4-5 ring and pinky. Opening counts double while it is happening.
        x_im = now[2:4].mean() + 1.5 * max(rate[2:4].mean(), 0)
        x_rp = now[4:6].mean() + 1.5 * max(rate[4:6].mean(), 0)
        p_im, p_rp = sigmoid((x_im - 0.72) / 0.05), sigmoid((x_rp - 0.72) / 0.05)
        return normalize({"rock": 1.0, "scissors": 1 + 6 * p_im * (1 - p_rp), "paper": 1 + 6 * p_rp})

    def prior(self):
        n = len(self.history)
        if n == 0:
            return self.uniform
        counts = {c: 1.0 for c in self.classes}
        for move, _, _ in self.history:
            counts[move] += 0.5                           # overall habit
        last, last_ai, last_outcome = self.history[-1]
        if last_outcome == "win":                         # a common tendency: keep a winning move …
            counts[last] += 1.5
        elif last_outcome == "lose":                      # … and after a loss, switch to what beats the winner
            counts[BEATEN_BY[last_ai]] += 1.5
        for a, b in zip(self.history, self.history[1:]):  # what this player did after the same situation
            if a[0] == last and a[2] == last_outcome:
                counts[b[0]] += 1.0
        trust = min(1.0, n / 5)
        p = normalize(counts)
        return {c: (1 - trust) / 3 + trust * p[c] for c in self.classes}

    def detect(self, obs):
        elapsed = obs.ts - self.t0
        hand = obs.hand
        if hand is None or elapsed < 2 * self.BEAT_MS - 300:
            self._run = []
            return None
        shape = rps_shape(hand.world)
        # A fist is also the pumping shape, and gentle pumping is slow enough to look still,
        # so rock only counts from the "布！" beat on, after the fist holds still for ~0.25 s.
        settled = abs(self.vy) < 2.5 and elapsed >= 2 * self.BEAT_MS
        ok = shape is not None and (shape != "rock" or settled)
        if not ok or (self._run and self._run[-1][1] != shape):
            self._run = []
        if ok:
            self._run.append((obs.ts, shape))
        if len(self._run) >= (8 if shape == "rock" else 3):
            return shape, self._run[0][0]
        return None

    def on_verdict(self, v):
        guess = v.guess or random.choice(self.classes)
        self.ai_move = BEATEN_BY[guess]
        player = v.truth
        if player == self.ai_move:
            outcome = "tie"
        else:
            outcome = "win" if player == BEATEN_BY[self.ai_move] else "lose"
        self.history.append((player, self.ai_move, outcome))

    def verdict_lines(self, v):
        lines = super().verdict_lines(v)
        outcome = self.history[-1][2] if self.history else "tie"
        result = {"win": "你赢", "lose": "AI 赢", "tie": "平局"}[outcome]
        lines.append((f"你出 {self.name(v.truth)} · AI 出 {self.name(self.ai_move)} → {result}", WHITE))
        return lines

    def draw_level(self, canvas, hud, obs):
        if self.state != "trial":
            return
        h, w = canvas.shape[:2]
        beat = min(len(self.BEATS) - 1, (obs.ts - self.t0) // self.BEAT_MS)
        shade(canvas, w / 2 - 200, 80, w / 2 + 200, 190, 0.5)
        hud.text((w / 2, 92), self.BEATS[beat], 72, YELLOW if beat == len(self.BEATS) - 1 else WHITE, anchor="ma")
        if self.debug:
            hud.text((w / 2, 200), f"手速 {self.vy:+.1f} 手掌/秒 · 形状 {self.name(rps_shape(obs.hand.world)) if obs.hand else '无'}",
                     18, GREY, anchor="ma")
        if self.history:
            habit = " ".join(self.name(m) for m, _, _ in self.history[-6:])
            hud.text((20, canvas.shape[0] - 40), f"AI 记住的你最近出的：{habit}", 18, CYAN)
