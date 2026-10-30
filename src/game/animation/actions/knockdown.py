"""One shot: slams on the butt (bounce, torso whip, head lagging behind), then sits dazed with the head going round"""
import math

from pose import X, Y, Z, arc, smooth
from actions.common import sit

NAME = 'knockdown'
SECONDS = 1.6
LOOP = False


def pose(p, t):
    seconds = t * SECONDS
    p.mix(smooth(0, 0.14, t), None, sit)

    # Impact: small bounce of the hips, torso thrown back, legs kicked up, head following later
    p.move('hips', (0, 0, 0.03 * arc(0.12, 0.3, t)))
    p.rotate('spine', X, - 14 * arc(0.08, 0.35, t))
    p.rotate('head', X, 22 * arc(0.14, 0.42, t))
    p.side('thigh', X, - 12 * arc(0.1, 0.3, t))

    # Dazed
    daze = 9 * smooth(0.3, 0.5, t)
    angle = 2 * math.pi * 1.1 * seconds
    p.rotate('head', Z, daze * math.sin(angle))
    p.rotate('head', Y, daze * 0.7 * math.cos(angle))
