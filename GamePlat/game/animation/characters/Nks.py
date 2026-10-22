"""
Nks, playable character (character select)
Short legs (crotch at 0.19), head from the neck at 0.59, arms hanging away from the body
"""
# Paths from GamePlat/game
SOURCE = '../../character/Nks.glb'
OUTPUT = 'static/characters/Nks/Nks.glb'

# Joints as fractions of the height (feet at 0, top of the head at 1), Blender axes: X = right side, -Y = front, Z = up
# Measured from the mesh slices: shoes 0-0.08, shorts from 0.18, shoulders 0.50, neck 0.59, hands end at 0.30 (x 0.32)
# name: (head, tail, radius)
BONES = {
    'hips':       ((0.00, -0.01, 0.20), (0.00, -0.01, 0.30), 0.18),
    'spine':      ((0.00, -0.01, 0.30), (0.00, -0.01, 0.42), 0.18),
    'chest':      ((0.00, -0.01, 0.42), (0.00, -0.01, 0.58), 0.18),
    'head':       ((0.00, -0.01, 0.58), (0.00, -0.01, 0.95), 0.30),
    'thigh.R':    ((0.075, 0.00, 0.20), (0.075, 0.00, 0.12), 0.07),
    'shin.R':     ((0.075, 0.00, 0.12), (0.075, -0.01, 0.06), 0.06),
    'foot.R':     ((0.075, -0.01, 0.06), (0.075, -0.15, 0.02), 0.06),
    'upperArm.R': ((0.16, -0.01, 0.50), (0.24, -0.01, 0.42), 0.05),
    'forearm.R':  ((0.24, -0.01, 0.42), (0.29, -0.01, 0.36), 0.045),
    'hand.R':     ((0.29, -0.01, 0.36), (0.32, -0.01, 0.30), 0.045),
}

# Rigid head above the neck
RIGID_HEAD = (0.59, 0.03)

# The torso is ~0.15 wide on each side, further out is arm only
ARM_ONLY_X = 0.165
