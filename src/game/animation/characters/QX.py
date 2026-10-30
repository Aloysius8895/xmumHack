"""
QX, playable character (character select), replaces the Shin-chan slot
Chibi girl: big head from the neck at 0.57, long hair down to the waist behind the arms, arms held out at ~45deg,
a shoulder bag hanging on the right hip
The build output is large, compress it afterwards like Jing (from src/game):
    npx gltf-transform resize static/characters/QX/QX.glb tmp.glb --width 1024 --height 1024
    npx gltf-transform webp tmp.glb tmp.glb --quality 85
    npx gltf-transform draco tmp.glb static/characters/QX/QX.glb
"""
from mathutils import Vector

# Paths from src/game
SOURCE = '../character/QX.glb'
OUTPUT = 'static/characters/QX/QX.glb'

# Joints as fractions of the height (feet at 0, top of the head at 1), Blender axes: X = right side, -Y = front, Z = up
# Measured from the mesh slices: shoes 0-0.13, shorts 0.23-0.33, shoulders 0.51, neck 0.57,
# hands 0.33-0.38 (x 0.26-0.31, y -0.15..-0.05), legs at x 0.07
# name: (head, tail, radius)
BONES = {
    'hips':       ((0.00, 0.00, 0.23), (0.00, 0.00, 0.33), 0.18),
    'spine':      ((0.00, 0.00, 0.33), (0.00, 0.00, 0.43), 0.18),
    'chest':      ((0.00, 0.00, 0.43), (0.00, 0.00, 0.56), 0.18),
    'head':       ((0.00, 0.00, 0.56), (0.00, 0.00, 0.95), 0.30),
    'thigh.R':    ((0.07, 0.00, 0.24), (0.07, 0.00, 0.13), 0.07),
    'shin.R':     ((0.07, 0.00, 0.13), (0.07, -0.01, 0.05), 0.06),
    'foot.R':     ((0.07, -0.01, 0.05), (0.07, -0.14, 0.02), 0.06),
    'upperArm.R': ((0.14, -0.02, 0.51), (0.22, -0.06, 0.43), 0.055),
    'forearm.R':  ((0.22, -0.06, 0.43), (0.27, -0.09, 0.37), 0.045),
    'hand.R':     ((0.27, -0.09, 0.37), (0.30, -0.10, 0.33), 0.045),
}

# Rigid head above the neck
RIGID_HEAD = (0.57, 0.03)

# The ruffled top is ~0.15 wide on each side, further out is arm only
ARM_ONLY_X = 0.16

# Arm lines (both sides) for TORSO_ONLY: a point further than this from them is not arm
ARM_TUBE = 0.05
_ARM = [ Vector(BONES['upperArm.R'][0]), Vector(BONES['forearm.R'][0]), Vector(BONES['hand.R'][0]), Vector(BONES['hand.R'][1]) ]


def _arm_distance(p):
    q = Vector((abs(p.x), p.y, p.z))  # right side, the left one is mirrored
    best = 1e9
    for a, b in zip(_ARM, _ARM[1:]):
        ab = b - a
        t = max(0.0, min(1.0, (q - a).dot(ab) / ab.length_squared))
        best = min(best, (q - (a + ab * t)).length)
    return best


def TORSO_ONLY(p):
    # The bag on the right hip swings with the hips, not the right leg / hand
    if p.x > 0.145 and 0.12 < p.z < 0.31:
        return True
    # Long hair behind the arms (down to the waist) follows the back, not the arm swing
    return p.z > 0.34 and p.y > -0.01 and _arm_distance(p) > ARM_TUBE
