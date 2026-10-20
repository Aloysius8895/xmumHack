"""Shared flow for the three levels: intro → setup → (wait → trial → feedback) × N → summary.

Each level supplies the per-frame features, a hand-written guess, what history
says, and how to tell that the real action has happened. The base class runs
the trials, scores the AI with Timeline, and saves every trial for training."""
import numpy as np

from ..config import RULES
from ..features import normalize
from ..learn import EarlyModel, save_trial
from ..timeline import Timeline
from ..ui import (CYAN, GREEN, GREY, RED, WHITE, YELLOW, B_GREEN, B_YELLOW, bar, beep,
                  draw_face, draw_hand, shade)

SPACE = 32


class Level:
    key = ""
    title = ""
    classes = []
    names = {}
    intro = []
    timeout_ms = 6000     # a trial with no action by then is dropped
    ready_ms = 600        # the ready condition must hold this long before a trial starts
    feedback_ms = 1800
    banner_at_top = False   # True when the bottom of the frame shows something the player needs

    def __init__(self, practice=False):
        self.rule = RULES[self.key]
        self.practice = practice
        self.live_guess = True          # show the AI's belief during a trial
        self.model = EarlyModel.load(self.key)
        self.results = []
        self.state, self.since = "intro", 0
        self.message = ""
        self.done = False
        self.debug = practice           # draw landmarks; toggle with D
        self._ready_since = None
        self._new_trial()

    # ----- hooks for each level ---------------------------------------------------------
    def setup(self, obs):
        """Per-frame calibration before the first trial; return True when finished."""
        return True

    def setup_key(self, key):
        pass

    def restart_setup(self):
        """Called when the player presses C between trials to calibrate again."""

    def ready(self, obs):
        """May the next trial start? Must hold for ready_ms."""
        return True

    def wait_hint(self):
        return "准备好后会自动开始"

    def start_trial(self, ts):
        pass

    def features(self, obs):
        """One feature row for this frame. Called once per trial frame, before everything else."""
        raise NotImplementedError

    def heuristic(self, obs):
        """Hand-written guess from the current rows; used alone until a model is trained."""
        return self.uniform

    def prior(self):
        """What earlier trials say before looking at this one."""
        return self.uniform

    def detect(self, obs):
        """(what the player did, when it became unmistakable) once the action happens."""
        return None

    def on_verdict(self, verdict):
        pass

    def draw_level(self, canvas, hud, obs):
        pass

    def on_mouse(self, event, x, y):
        pass

    # ----- helpers ----------------------------------------------------------------------
    @property
    def uniform(self):
        return {c: 1 / len(self.classes) for c in self.classes}

    @property
    def hits(self):
        return sum(v.correct for v in self.results)

    @property
    def passed(self):
        return self.hits >= self.rule.need_correct

    def name(self, c):
        return self.names.get(c, c) if c else "—"

    def _new_trial(self):
        self.timeline = Timeline()
        self.rows, self.row_ts = [], []
        self.t0 = 0
        self.probs = self.uniform
        self.verdict = None

    def _go(self, state, ts):
        self.state, self.since = state, ts

    # ----- flow -------------------------------------------------------------------------
    def update(self, obs):
        ts = obs.ts
        if self.state == "setup":
            if self.setup(obs):
                self._ready_since = None
                self._go("wait", ts)
        elif self.state == "wait":
            if self.ready(obs):
                self._ready_since = self._ready_since or ts
                if ts - self._ready_since >= self.ready_ms:
                    self._new_trial()
                    self.t0, self.message = ts, ""
                    self.start_trial(ts)
                    beep(988, 120)
                    self._go("trial", ts)
            else:
                self._ready_since = None
        elif self.state == "trial":
            self._step(obs)
        elif self.state == "feedback" and ts - self.since >= self.feedback_ms:
            if not self.practice and len(self.results) >= self.rule.trials:
                self._go("summary", ts)
            else:
                self._ready_since = None
                self._go("wait", ts)

    def _step(self, obs):
        self.rows.append(np.asarray(self.features(obs), dtype=np.float32))
        self.row_ts.append(obs.ts)
        self.probs = self._combine(obs)
        self.timeline.add(obs.ts, self.probs)
        hit = self.detect(obs)
        if hit:
            truth, t_action = hit
            self.verdict = self.timeline.judge(truth, t_action, self.rule)
            self.results.append(self.verdict)
            save_trial(self.key, self.rows, self.row_ts, truth, t_action)
            self.on_verdict(self.verdict)
            beep(1320 if self.verdict.correct else 440, 150)
            self._go("feedback", obs.ts)
        elif obs.ts - self.t0 > self.timeout_ms:
            self.message = "超时，这一局不算，重新来"
            self._ready_since = None
            self._go("wait", obs.ts)

    def _combine(self, obs):
        kin = self.heuristic(obs)
        if self.model:
            learned = self.model.predict(self.rows)
            if learned:
                kin = {c: 0.7 * learned.get(c, 0.0) + 0.3 * kin[c] for c in self.classes}
        prior = self.prior()
        return normalize({c: max(kin[c], 1e-6) * prior[c] for c in self.classes})

    def on_key(self, key, ts):
        if key == ord("d"):
            self.debug = not self.debug
        elif self.state == "intro" and key == SPACE:
            self._go("setup", ts)
        elif self.state == "setup":
            self.setup_key(key)
        elif self.state == "wait" and key == ord("c"):
            self.restart_setup()
            self._go("setup", ts)
        elif self.state == "summary":
            if key == ord("n") or (key == SPACE and self.passed):
                self.done = True
            elif key in (ord("r"), SPACE):
                self.results, self._ready_since = [], None
                self._go("wait", ts)

    # ----- drawing ----------------------------------------------------------------------
    def verdict_lines(self, v):
        if v.correct:
            return [(f"√ AI 猜中：{self.name(v.truth)}，提前 {v.lead_ms} ms", GREEN)]
        if v.guess == v.truth and v.lead_ms > 0:
            return [(f"× 猜对了但太晚：只提前 {v.lead_ms} ms（要 {self.rule.min_lead_ms} ms）", RED)]
        if v.guess == v.truth:
            return [(f"× 猜对了但把握不够（要 {self.rule.min_conf:.0%} 以上）", RED)]
        return [(f"× AI 猜 {self.name(v.guess)}，实际是 {self.name(v.truth)}", RED)]

    def draw(self, canvas, hud, obs):
        h, w = canvas.shape[:2]
        if self.debug:
            for hand in obs.hands:
                draw_hand(canvas, hand)
            if obs.face is not None:
                draw_face(canvas, obs.face)
        self.draw_level(canvas, hud, obs)

        shade(canvas, 0, 0, w, 56)
        hud.text((20, 12), self.title, 28, YELLOW)
        if self.practice:
            status = f"练习模式 · 已记录 {len(self.results)} 局 · 猜中 {self.hits}"
        else:
            n = min(len(self.results) + 1, self.rule.trials)
            status = f"AI 闯关 · 第 {n}/{self.rule.trials} 局 · 猜中 {self.hits}（需要 {self.rule.need_correct}）"
        status += " · 规则+模型" if self.model else " · 规则（未训练）"
        hud.text((w - 20, 16), status, 22, WHITE, anchor="ra")

        if self.state == "intro":
            self._draw_intro(canvas, hud)
        elif self.state == "summary":
            self._draw_summary(canvas, hud)
        else:
            if self.state in ("trial", "feedback"):
                self._draw_guess(canvas, hud)
            if self.state == "wait":
                hint = [self.message] if self.message else []
                self._banner(canvas, hud, hint + [self.wait_hint()], WHITE)
            elif self.state == "feedback" and self.verdict:
                lines = self.verdict_lines(self.verdict)
                top = self._banner_top(h, len(lines), 44)
                shade(canvas, w / 2 - 460, top - 14, w / 2 + 460, top + 44 * len(lines) + 6, 0.65)
                for i, (text, color) in enumerate(lines):
                    hud.text((w / 2, top + i * 44), text, 32, color, anchor="ma")

    def _banner_top(self, h, n, step):
        """Messages sit at the bottom, or under the title bar when the scene needs the bottom."""
        return 74 if self.banner_at_top else h - 40 - step * n

    def _banner(self, canvas, hud, lines, color):
        h, w = canvas.shape[:2]
        lines = [line for line in lines if line]
        if not lines:
            return
        top = self._banner_top(h, len(lines), 40)
        shade(canvas, w / 2 - 460, top - 10, w / 2 + 460, top + 40 * len(lines) + 4, 0.6)
        for i, line in enumerate(lines):
            hud.text((w / 2, top + i * 40), line, 26, color, anchor="ma")

    def _draw_guess(self, canvas, hud):
        x, y = 20, 96
        shade(canvas, x - 10, y - 10, x + 300, y + 44 + 34 * len(self.classes), 0.6)
        if self.state == "trial" and not self.live_guess:
            hud.text((x, y), "AI 正在读你……", 22, CYAN)
            hud.text((x, y + 34), "（动作完成后揭晓）", 18, GREY)
            return
        hud.text((x, y), "AI 的判断", 22, CYAN)
        best = max(self.probs, key=self.probs.get)
        for i, c in enumerate(self.classes):
            yy = y + 40 + i * 34
            hud.text((x, yy), self.name(c), 20, YELLOW if c == best else WHITE)
            bar(canvas, x + 120, yy + 4, 150, 16, self.probs[c], B_YELLOW if c == best else B_GREEN)

    def _draw_intro(self, canvas, hud):
        h, w = canvas.shape[:2]
        shade(canvas, w / 2 - 520, 110, w / 2 + 520, h - 60, 0.75)
        hud.text((w / 2, 140), self.title, 40, YELLOW, anchor="ma")
        hud.lines((w / 2 - 470, 220), self.intro, 24, WHITE, gap=1.7)
        rule = (f"过关条件：{self.rule.trials} 局里 AI 猜中 ≥ {self.rule.need_correct} 局；"
                f"猜中要求提前 ≥ {self.rule.min_lead_ms} ms、把握 ≥ {self.rule.min_conf:.0%}")
        hud.text((w / 2, h - 170), "练习模式：不计分，只采集数据" if self.practice else rule, 22, CYAN, anchor="ma")
        hud.text((w / 2, h - 120), "空格 开始 · D 显示/隐藏关键点 · ESC 退出", 22, GREY, anchor="ma")

    def _draw_summary(self, canvas, hud):
        h, w = canvas.shape[:2]
        shade(canvas, w / 2 - 520, 90, w / 2 + 520, h - 40, 0.8)
        hud.text((w / 2, 110), "本关结果", 36, YELLOW, anchor="ma")
        for i, v in enumerate(self.results[:12]):
            mark, color = ("√", GREEN) if v.correct else ("×", RED)
            hud.text((w / 2 - 440, 170 + i * 34),
                     f"第 {i + 1:>2} 局  实际 {self.name(v.truth)}  AI {self.name(v.guess)}  提前 {v.lead_ms} ms  {mark}",
                     22, color)
        leads = [v.lead_ms for v in self.results if v.correct]
        avg = f"，猜中的平均提前 {sum(leads) // len(leads)} ms" if leads else ""
        if self.passed:
            verdict, color = f"AI 过关！猜中 {self.hits}/{len(self.results)}{avg}", GREEN
            keys = "空格 进入下一关 · R 再来一次 · ESC 退出"
        else:
            verdict, color = f"AI 没过关：猜中 {self.hits}/{len(self.results)}，需要 {self.rule.need_correct}{avg}", RED
            keys = "空格/R 再来一次 · N 跳过这一关 · ESC 退出"
        hud.text((w / 2, h - 140), verdict, 30, color, anchor="ma")
        hud.text((w / 2, h - 90), keys, 22, GREY, anchor="ma")
