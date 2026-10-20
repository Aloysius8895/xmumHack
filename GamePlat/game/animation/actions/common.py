"""
Body poses reused by several actions, sized from the rig so they fit any proportions
"""
import math

from pose import X, Y, Z

SIDES = (('.R', 1), ('.L', - 1))


def arms_relaxed(p, lift=0, bend=0):
    """lift > 0 brings the arms closer to the body, bend folds the elbows forward"""
    p.side('upperArm', Y, lift)
    p.side('forearm', X, - bend)


def legs_crouch(p, amount):
    """Fold both legs keeping the feet flat and under the body (amount 0..1)"""
    angle = 55 * amount
    thigh, shin = p.rig.length['thigh.R'], p.rig.length['shin.R']
    drop = (thigh + shin) * (1 - math.cos(math.radians(angle)))
    back = (thigh - shin) * math.sin(math.radians(angle))
    p.move('hips', (0, back, - drop))
    p.side('thigh', X, - angle)
    p.side('shin', X, angle * 2)
    p.side('foot', X, - angle)


def sit(p):
    """Sitting on the butt, legs forward, leaning back on both hands"""
    hips_height = p.rig.head['hips'].z
    p.move('hips', (0, 0.03, - hips_height * 0.55))
    p.side('thigh', X, - 80)
    p.side('thigh', Z, 12)
    p.side('shin', X, 10)
    p.side('foot', X, - 15)
    p.rotate('spine', X, - 14)
    p.rotate('head', X, 6)

    hips = p.head('hips')
    for side, sign in SIDES:
        target = (hips.x + sign * 0.25, hips.y + 0.17, 0.05)
        p.reach('upperArm' + side, 'forearm' + side, target, (sign, 0.6, 0))
        p.aim('hand' + side, (sign * 0.3, 0.5, - 0.6))


def crouch_hands_on_knees(p):
    legs_crouch(p, 1)
    p.rotate('spine', X, 26)
    p.rotate('head', X, - 16)
    for side, sign in SIDES:
        knee = p.head('shin' + side)
        p.reach('upperArm' + side, 'forearm' + side, (knee.x + sign * 0.01, knee.y - 0.03, knee.z + 0.05), (sign, 0.4, 0))
