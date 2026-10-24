"""Standing, breathing, small head and arm sway"""
from pose import X, Y, Z, wave
from actions.common import arms_relaxed

NAME = 'idle'
SECONDS = 2.4
LOOP = True


def pose(p, t):
    p.move('hips', (0, 0, 0.004 * wave(t * 2)))
    p.rotate('spine', X, 1.5 * wave(t))
    p.rotate('chest', X, 1 * wave(t, - 0.1))
    p.rotate('head', Z, 3 * wave(t, 0.2))
    p.rotate('head', Y, 2 * wave(t, 0.45))
    p.rotate('head', X, - 1.5 * wave(t, - 0.2))
    arms_relaxed(p, lift=8 - 2 * wave(t, - 0.05), bend=8 + 2 * wave(t, - 0.15))
