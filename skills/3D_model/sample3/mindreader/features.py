"""Hand-shape, gaze and face measurements shared by the levels."""
import numpy as np

# Hand landmark chains, thumb to pinky (base joint → tip).
FINGERS = [(1, 2, 3, 4), (5, 6, 7, 8), (9, 10, 11, 12), (13, 14, 15, 16), (17, 18, 19, 20)]
EXTENDED = 0.8   # straightness above this counts as an extended finger

# Face mesh indices (MediaPipe 478-point topology). Each eye is listed from the
# subject's right side to their left, so both eyes measure gaze in the same direction.
R_EYE = (33, 133, 159, 145)    # side a, side b, upper lid, lower lid
L_EYE = (362, 263, 386, 374)
R_IRIS, L_IRIS = 468, 473
NOSE, CHEEK_R, CHEEK_L = 1, 234, 454
LIP_UP, LIP_LO = 13, 14


def straightness(world):
    """Per finger, thumb to pinky: about 1.0 when straight, 0.4-0.6 when curled into a fist."""
    out = np.empty(5)
    for i, chain in enumerate(FINGERS):
        pts = world[list(chain)]
        path = np.linalg.norm(np.diff(pts, axis=0), axis=1).sum()
        out[i] = np.linalg.norm(pts[-1] - pts[0]) / (path + 1e-9)
    return out


def palm(world):
    return float(np.linalg.norm(world[0] - world[9])) + 1e-9


def pinch(world):
    """Thumb tip to index tip in palm lengths; small when holding a pen."""
    return float(np.linalg.norm(world[4] - world[8])) / palm(world)


def spread(world):
    """Index tip to middle tip in palm lengths; opens and closes when miming scissors."""
    return float(np.linalg.norm(world[8] - world[12])) / palm(world)


def rps_shape(world):
    """Final rock / paper / scissors shape, or None while the hand is in between."""
    ext = straightness(world)[1:] > EXTENDED   # index, middle, ring, pinky
    n = int(ext.sum())
    if n == 0:
        return "rock"
    if ext[0] and ext[1] and not ext[2] and not ext[3]:
        return "scissors"
    if n >= 3:
        return "paper"
    return None


def face_width(face):
    return float(np.linalg.norm(face.px[CHEEK_R] - face.px[CHEEK_L])) + 1e-6


def mouth(face):
    return (face.px[LIP_UP] + face.px[LIP_LO]) / 2


def _eye_ratio(px, iris, a, b, up, lo):
    axis = px[b] - px[a]
    h = float(np.dot(px[iris] - px[a], axis) / (np.dot(axis, axis) + 1e-9))
    v = float((px[iris][1] - px[up][1]) / (px[lo][1] - px[up][1] + 1e-9))
    return h, v


def gaze_vector(face):
    """Where the eyes and head point: iris position, head turn, and the eye-look blendshapes.

    The numbers have no fixed meaning in degrees; levels calibrate them per player
    by recording this vector while the player looks at known targets."""
    px, b = face.px, face.blend
    hr, vr = _eye_ratio(px, R_IRIS, *R_EYE)
    hl, vl = _eye_ratio(px, L_IRIS, *L_EYE)
    fw = face_width(face)
    yaw = float(px[NOSE][0] - (px[CHEEK_R][0] + px[CHEEK_L][0]) / 2) / fw
    pitch = float(px[NOSE][1] - (px[R_EYE[0]][1] + px[L_EYE[1]][1]) / 2) / fw
    look_h = (b.get("eyeLookOutLeft", 0) + b.get("eyeLookInRight", 0)
              - b.get("eyeLookInLeft", 0) - b.get("eyeLookOutRight", 0))
    look_v = ((b.get("eyeLookUpLeft", 0) + b.get("eyeLookUpRight", 0))
              - (b.get("eyeLookDownLeft", 0) + b.get("eyeLookDownRight", 0))) / 2
    return np.array([(hr + hl) / 2, (vr + vl) / 2, yaw, pitch, look_h, look_v])


def swings(values, min_step):
    """How many times a signal changes direction by at least min_step (hammering, snipping)."""
    if len(values) < 3:
        return 0
    count, direction = 0, 0
    lo = hi = values[0]
    for v in values[1:]:
        if direction >= 0:              # rising (or not started): watch for a drop from the peak
            hi = max(hi, v)
            if hi - v >= min_step:
                count += direction == 1
                direction, lo = -1, v
                continue
        if direction <= 0:              # falling (or not started): watch for a rise from the trough
            lo = min(lo, v)
            if v - lo >= min_step:
                count += direction == -1
                direction, hi = 1, v
    return count


class Velocity:
    """Smoothed velocity of a 2-D point, in units per second."""

    def __init__(self, alpha=0.5):
        self.alpha = alpha
        self.reset()

    def reset(self):
        self.prev = None
        self.v = np.zeros(2)

    def update(self, point, ts):
        if point is None:
            self.reset()
            return self.v
        point = np.asarray(point, dtype=np.float64)
        if self.prev is not None and ts > self.prev[1]:
            raw = (point - self.prev[0]) / ((ts - self.prev[1]) / 1000)
            self.v = self.alpha * raw + (1 - self.alpha) * self.v
        self.prev = (point, ts)
        return self.v


def normalize(scores):
    total = sum(scores.values()) or 1.0
    return {k: v / total for k, v in scores.items()}


def softmax(logits, temperature=1.0):
    keys = list(logits)
    x = np.array([logits[k] for k in keys]) / temperature
    e = np.exp(x - x.max())
    return dict(zip(keys, e / e.sum()))


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))
