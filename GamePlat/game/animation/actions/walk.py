"""
Walk cycle, right heel strike at t = 0, left at t = 0.5

Not stiff thanks to: hips dipping after each contact and shifting over the stance foot, pelvis turning and dropping
on the swing side with the spine countering it, knee lift in early swing, heel strike / toe off, arms and forearms
lagging behind the legs (overlap), head bobbing a little after the body (secondary motion)
"""
from pose import X, Y, Z, wave, cwave, bump

NAME = 'walk'
SECONDS = 0.62  # Short legs, quick steps
LOOP = True


def leg(p, side, t):
    p.rotate('thigh' + side, X, - 26 * cwave(t) - 4)
    p.rotate('shin' + side, X, 6 + 12 * bump(t, 0.08, 0.07) + 48 * bump(t, 0.68, 0.13))
    p.rotate('foot' + side, X, - 14 * bump(t, 0.0, 0.07) + 22 * bump(t, 0.5, 0.07) - 6 * bump(t, 0.82, 0.1))


def arm(p, side, sign, t):
    p.rotate('upperArm' + side, Y, 14 * sign)
    p.rotate('upperArm' + side, X, 28 * cwave(t - 0.06))
    p.rotate('forearm' + side, X, - (14 + 22 * max(0, - cwave(t - 0.14))))
    p.rotate('hand' + side, X, 8 * cwave(t - 0.2))


def pose(p, t):
    # Hips: dip after contacts, shift over the stance foot, turn and drop on the swing side
    p.move('hips', (0.012 * wave(t), 0, - 0.012 * cwave(2 * t - 0.16) + 0.004))
    p.rotate('hips', Z, - 6 * cwave(t))
    p.rotate('hips', Y, - 3 * wave(t))

    # Spine and chest counter the pelvis, the head stays steady but bobbles after the steps
    p.rotate('spine', Z, 9 * cwave(t))
    p.rotate('spine', Y, 3 * wave(t))
    p.rotate('spine', X, 4 + 1.5 * cwave(2 * t - 0.25))
    p.rotate('chest', Z, 3 * cwave(t - 0.05))
    p.rotate('head', Z, - 6 * cwave(t - 0.08))
    p.rotate('head', X, - 3 + 3.5 * cwave(2 * t - 0.3))
    p.rotate('head', Y, 2 * wave(t, 0.1))

    leg(p, '.R', t)
    leg(p, '.L', t + 0.5)
    arm(p, '.R', 1, t)
    arm(p, '.L', - 1, t + 0.5)
