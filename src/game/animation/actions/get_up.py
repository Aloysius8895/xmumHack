"""
One shot after knockdown: from sitting, hands on the knees, stands up, rubs the sore butt with the right hand
while looking back at it, then settles back to the idle pose
"""
import math

from pose import X, Y, Z, bump, smooth
from actions.common import arms_relaxed, crouch_hands_on_knees, sit

NAME = 'getUp'
SECONDS = 3.4
LOOP = False


def rub(p, seconds):
    p.rotate('spine', X, 12)
    p.rotate('spine', Z, 10)
    p.rotate('head', Z, 32)
    p.rotate('head', X, 12)
    p.move('hips', (- 0.012, 0, 0))
    p.side('thigh', X, - 4)
    p.side('shin', X, 8)

    # Ouch hop when the hand touches
    p.move('hips', (0, 0, 0.025 * bump(seconds / SECONDS, 1.3 / SECONDS, 0.05)))

    # Right hand circles on the butt
    angle = 2 * math.pi * 2.6 * seconds
    hips = p.head('hips')
    target = (hips.x + 0.09 + 0.025 * math.cos(angle), hips.y + 0.17, hips.z - 0.07 + 0.025 * math.sin(angle))
    p.reach('upperArm.R', 'forearm.R', target, (1, 0.7, 0))
    p.aim('hand.R', (0.1, - 0.2, - 1))

    # Left arm relaxed
    p.rotate('upperArm.L', Y, - 10)
    p.rotate('forearm.L', X, - 20)


def pose(p, t):
    seconds = t * SECONDS

    if seconds < 0.7:
        p.mix(smooth(0, 0.7, seconds), sit, crouch_hands_on_knees)
    elif seconds < 1.25:
        p.mix(smooth(0.7, 1.25, seconds), crouch_hands_on_knees, lambda q: rub(q, seconds))
    elif seconds < 3.0:
        rub(p, seconds)
    else:
        p.mix(smooth(3.0, 3.4, seconds), lambda q: rub(q, seconds), lambda q: arms_relaxed(q, lift=8, bend=8))
