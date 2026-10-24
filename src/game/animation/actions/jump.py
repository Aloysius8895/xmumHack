"""One shot: quick push then tucked in the air, the last frame is held while airborne"""
from pose import X, smooth
from actions.common import arms_relaxed, legs_crouch

NAME = 'jump'
SECONDS = 0.5
LOOP = False


def pose(p, t):
    push = 1 - smooth(0, 0.15, t)
    tuck = smooth(0.15, 0.5, t)
    legs_crouch(p, 0.35 * push)

    p.side('thigh', X, - 45 * tuck)
    p.side('shin', X, 75 * tuck)
    p.side('foot', X, - 15 * tuck)
    p.rotate('spine', X, 8 * push - 6 * tuck)
    p.rotate('head', X, - 6 * tuck)

    arms_relaxed(p, lift=10 - 85 * tuck, bend=25 * tuck)
    p.side('upperArm', X, - 15 * tuck)
