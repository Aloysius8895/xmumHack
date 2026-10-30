"""Sneaky crouched walk"""
from pose import X, Z, wave, cwave, bump
from actions.common import arms_relaxed, legs_crouch

NAME = 'crouchWalk'
SECONDS = 0.8
LOOP = True


def pose(p, t):
    legs_crouch(p, 0.9)
    p.move('hips', (0.01 * wave(t), 0, - 0.008 * cwave(2 * t - 0.16)))
    p.rotate('hips', Z, - 6 * cwave(t))
    p.rotate('spine', X, 18)
    p.rotate('spine', Z, 8 * cwave(t))
    p.rotate('head', X, - 14 + 2.5 * cwave(2 * t - 0.3))
    p.rotate('head', Z, - 4 * cwave(t - 0.08))

    for side, phase in (('.R', 0.0), ('.L', 0.5)):
        p.rotate('thigh' + side, X, - 18 * cwave(t + phase))
        p.rotate('shin' + side, X, 25 * bump(t + phase, 0.68, 0.14))

    arms_relaxed(p, lift=10, bend=35)
    p.side('upperArm', X, - 25)
    p.rotate('upperArm.R', X, 14 * cwave(t - 0.06))
    p.rotate('upperArm.L', X, - 14 * cwave(t - 0.06))
