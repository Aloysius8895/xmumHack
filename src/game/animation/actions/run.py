"""Run cycle, same structure as the walk with a flight phase, forward lean and pumping bent arms"""
from pose import X, Y, Z, wave, cwave, bump

NAME = 'run'
SECONDS = 0.42
LOOP = True


def leg(p, side, t):
    p.rotate('thigh' + side, X, - 42 * cwave(t) - 12)
    p.rotate('shin' + side, X, 18 + 10 * bump(t, 0.1, 0.06) + 85 * bump(t, 0.66, 0.14))
    p.rotate('foot' + side, X, - 10 * bump(t, 0.0, 0.06) + 28 * bump(t, 0.42, 0.08))


def arm(p, side, sign, t):
    p.rotate('upperArm' + side, Y, 18 * sign)
    p.rotate('upperArm' + side, X, 48 * cwave(t - 0.04))
    p.rotate('forearm' + side, X, - (70 + 15 * cwave(t - 0.12)))
    p.rotate('hand' + side, X, 10 * cwave(t - 0.2))


def pose(p, t):
    p.move('hips', (0.008 * wave(t), 0, - 0.018 * cwave(2 * t - 0.2) - 0.012))
    p.rotate('hips', Z, - 9 * cwave(t))
    p.rotate('hips', Y, - 3 * wave(t))

    p.rotate('spine', Z, 13 * cwave(t))
    p.rotate('spine', X, 14 + 2 * cwave(2 * t - 0.25))
    p.rotate('chest', Z, 3 * cwave(t - 0.05))
    p.rotate('head', Z, - 6 * cwave(t - 0.08))
    p.rotate('head', X, - 10 + 3 * cwave(2 * t - 0.3))

    leg(p, '.R', t)
    leg(p, '.L', t + 0.5)
    arm(p, '.R', 1, t)
    arm(p, '.L', - 1, t + 0.5)
