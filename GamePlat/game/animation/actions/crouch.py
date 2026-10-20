"""Crouched idle"""
from pose import X, Z, wave
from actions.common import arms_relaxed, legs_crouch

NAME = 'crouch'
SECONDS = 2.4
LOOP = True


def pose(p, t):
    legs_crouch(p, 1)
    p.move('hips', (0, 0, 0.004 * wave(t * 2)))
    p.rotate('spine', X, 18 + 1.5 * wave(t))
    p.rotate('head', X, - 14)
    p.rotate('head', Z, 3 * wave(t, 0.2))
    arms_relaxed(p, lift=10, bend=35)
    p.side('upperArm', X, - 25)
