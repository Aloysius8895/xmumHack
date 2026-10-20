"""Trial recordings and the early-prediction model trained on them.

Every finished trial is saved with its per-frame features and the action that
actually happened, so the labels come for free. Training uses windows that end
before the action, which teaches the model to call it early."""
import time
from collections import Counter

import joblib
import numpy as np

from .config import DATA_DIR, MODEL_DIR, RULES

WINDOW = 5   # frames per window, about 170 ms at 30 fps


def window_vector(rows):
    """The last WINDOW feature rows flattened, plus how much they changed across the window."""
    rows = np.asarray(rows, dtype=np.float32)
    if len(rows) < WINDOW:
        rows = np.vstack([np.repeat(rows[:1], WINDOW - len(rows), axis=0), rows])
    w = rows[-WINDOW:]
    return np.concatenate([w.ravel(), w[-1] - w[0]])


def save_trial(level, rows, ts, label, t_action):
    folder = DATA_DIR / level
    folder.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S") + f"-{int(time.time() * 1000) % 1000:03d}"
    np.savez_compressed(folder / f"{stamp}.npz", rows=np.asarray(rows, np.float32),
                        ts=np.asarray(ts, np.int64), label=label, t_action=t_action)


def load_trials(level):
    trials = []
    for path in sorted((DATA_DIR / level).glob("*.npz")):
        with np.load(path) as d:
            trials.append({"rows": d["rows"], "ts": d["ts"], "label": str(d["label"]),
                           "t_action": int(d["t_action"])})
    if not trials:
        return trials
    # Keep only trials recorded with the current feature layout (the newest one's width).
    width = trials[-1]["rows"].shape[1]
    return [t for t in trials if t["rows"].ndim == 2 and t["rows"].shape[1] == width]


def build_samples(trials, horizon_ms):
    X, y, groups, offsets = [], [], [], []
    for g, tr in enumerate(trials):
        rows, ts = tr["rows"], tr["ts"]
        for k in range(len(ts)):
            offset = tr["t_action"] - ts[k]
            if 0 < offset <= horizon_ms:
                X.append(window_vector(rows[max(0, k - WINDOW + 1):k + 1]))
                y.append(tr["label"])
                groups.append(g)
                offsets.append(offset)
    return np.array(X), np.array(y), np.array(groups), np.array(offsets)


def train(level):
    """Fit the level's early predictor on every recorded trial and report how early it works."""
    from sklearn.base import clone
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import GroupKFold
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    trials = load_trials(level)
    counts = Counter(t["label"] for t in trials)
    if len(trials) < 6 or len(counts) < 2:
        return f"[{level}] 数据不够：{len(trials)} 局，{dict(counts)}。至少要 6 局、两种以上动作。"

    rule = RULES[level]
    X, y, groups, offsets = build_samples(trials, rule.horizon_ms)
    model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, C=0.5))

    # Cross-validate by trial, so frames from one trial never sit on both sides of the split.
    pred = np.full(len(y), None, dtype=object)
    for train_idx, test_idx in GroupKFold(n_splits=min(5, len(trials))).split(X, y, groups):
        if len(set(y[train_idx])) >= 2:
            pred[test_idx] = clone(model).fit(X[train_idx], y[train_idx]).predict(X[test_idx])

    lines = [f"[{level}] {len(trials)} 局，{len(y)} 个训练窗口，动作分布 {dict(counts)}",
             f"  随机猜的准确率约 {1 / len(counts):.0%}；交叉验证（按局切分）："]
    for lo, hi in [(0, 150), (150, 300), (300, 600), (600, 1000), (1000, 1500)]:
        m = (offsets > lo) & (offsets <= hi) & (pred != None)  # noqa: E711
        if m.any():
            lines.append(f"  动作前 {lo:>4}–{hi:<4} ms：准确率 {np.mean(pred[m] == y[m]):.0%}（{m.sum()} 个窗口）")

    model.fit(X, y)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "classes": list(model.classes_)}, MODEL_DIR / f"{level}.joblib")
    lines.append(f"  已保存 models/{level}.joblib，下次进入这一关会自动使用。")
    return "\n".join(lines)


class EarlyModel:
    def __init__(self, bundle):
        self.model = bundle["model"]
        self.classes = bundle["classes"]

    @classmethod
    def load(cls, level):
        path = MODEL_DIR / f"{level}.joblib"
        return cls(joblib.load(path)) if path.exists() else None

    def predict(self, rows):
        if not rows:
            return {}
        try:
            p = self.model.predict_proba([window_vector(rows)])[0]
        except ValueError:      # feature layout changed since training; ignore the stale model
            return {}
        return dict(zip(self.classes, p))
