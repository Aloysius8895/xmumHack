"""
Edixon, playable character (character select)
Short legs (crotch at 0.20), head from the neck at 0.54, arms close to the body
"""
# Paths from GamePlat/game
SOURCE = '../../character/Edixon.glb'
OUTPUT = 'static/characters/Edixon/Edixon.glb'

# Joints as fractions of the height (feet at 0, top of the head at 1), Blender axes: X = right side, -Y = front, Z = up
# Measured from the mesh slices: shoes 0-0.06, shorts from 0.18, shoulders 0.46, neck 0.54, hands end at 0.26 (x 0.27)
# name: (head, tail, radius)
BONES = {
    'hips':       ((0.00, 0.01, 0.21), (0.00, 0.01, 0.30), 0.18),
    'spine':      ((0.00, 0.01, 0.30), (0.00, 0.01, 0.40), 0.18),
    'chest':      ((0.00, 0.01, 0.40), (0.00, 0.01, 0.53), 0.18),
    'head':       ((0.00, 0.01, 0.53), (0.00, 0.01, 0.95), 0.30),
    'thigh.R':    ((0.07, 0.00, 0.21), (0.075, 0.00, 0.12), 0.07),
    'shin.R':     ((0.075, 0.00, 0.12), (0.08, -0.01, 0.05), 0.06),
    'foot.R':     ((0.08, -0.01, 0.05), (0.08, -0.17, 0.02), 0.06),
    'upperArm.R': ((0.15, 0.01, 0.46), (0.21, 0.01, 0.38), 0.05),
    'forearm.R':  ((0.21, 0.01, 0.38), (0.25, 0.00, 0.31), 0.045),
    'hand.R':     ((0.25, 0.00, 0.31), (0.27, 0.00, 0.26), 0.045),
}

# Rigid head above the neck
RIGID_HEAD = (0.54, 0.03)

# The torso is ~0.14 wide on each side, further out is arm only
ARM_ONLY_X = 0.155
