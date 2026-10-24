"""Blown in the air (explosion): arms windmilling, legs kicking, looking up in panic. Loops until landing"""
from pose import X, Y, wave

NAME = 'fall'
SECONDS = 0.7
LOOP = True


def pose(p, t):
    p.rotate('spine', X, - 12 + 4 * wave(2 * t))
    p.rotate('head', X, - 15 + 6 * wave(2 * t, 0.1))

    p.side('upperArm', Y, - 100)
    p.rotate('upperArm.R', X, 40 * wave(t))
    p.rotate('upperArm.L', X, 40 * wave(t, 0.5))
    p.rotate('forearm.R', X, - (30 + 20 * wave(t, 0.1)))
    p.rotate('forearm.L', X, - (30 + 20 * wave(t, 0.6)))

    for side, phase in (('.R', 0.0), ('.L', 0.5)):
        p.rotate('thigh' + side, X, - 35 + 30 * wave(t, phase))
        p.rotate('shin' + side, X, 50 + 35 * wave(t, phase + 0.25))
