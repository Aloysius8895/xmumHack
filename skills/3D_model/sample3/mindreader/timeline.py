"""Records the AI's guess on every frame and scores it once the real action happens."""
from dataclasses import dataclass


@dataclass
class Verdict:
    truth: str            # what the player actually did
    guess: str | None     # the AI's answer on the last frame before the action
    lead_ms: int          # how long before the action the AI settled on the right answer
    correct: bool         # right answer, held at min_conf or above, for at least min_lead_ms


class Timeline:
    def __init__(self):
        self.ticks = []   # (ts, label, conf)

    def add(self, ts, probs):
        label = max(probs, key=probs.get)
        self.ticks.append((ts, label, probs[label]))
        return label, probs[label]

    def judge(self, truth, t_action, rule):
        """The lead is measured from the start of the AI's final unbroken run of the right
        answer, so changing its mind late costs it the time it had before."""
        before = [t for t in self.ticks if t[0] < t_action]
        if not before:
            return Verdict(truth, None, 0, False)
        start = len(before)
        while start > 0 and before[start - 1][1] == truth and before[start - 1][2] >= rule.min_conf:
            start -= 1
        lead = t_action - before[start][0] if start < len(before) else 0
        return Verdict(truth, before[-1][1], int(lead), lead >= rule.min_lead_ms)
