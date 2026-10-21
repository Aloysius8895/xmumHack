"""
Aloysius, playable character (character select)
Long legs (crotch at 0.30), big head from the neck at 0.58, arms hanging away from the body
"""
# Paths from GamePlat/game
SOURCE = '../../character/Aloysius.glb'
OUTPUT = 'static/characters/Aloysius/Aloysius.glb'

# Joints as fractions of the height (feet at 0, top of the head at 1), Blender axes: X = right side, -Y = front, Z = up
# Measured from the mesh slices: shoes 0-0.12, legs to 0.30, shoulders 0.50, neck 0.58, hands end at 0.32 (x 0.30)
# name: (head, tail, radius)
BONES = {
    'hips':       ((0.00, 0.01, 0.29), (0.00, 0.01, 0.37), 0.18),
    'spine':      ((0.00, 0.01, 0.37), (0.00, 0.01, 0.46), 0.18),
    'chest':      ((0.00, 0.01, 0.46), (0.00, 0.01, 0.57), 0.18),
    'head':       ((0.00, 0.01, 0.57), (0.00, 0.01, 0.95), 0.30),
    'thigh.R':    ((0.075, 0.00, 0.29), (0.08, 0.00, 0.16), 0.07),
    'shin.R':     ((0.08, 0.00, 0.16), (0.085, -0.01, 0.07), 0.06),
    'foot.R':     ((0.085, -0.01, 0.07), (0.085, -0.18, 0.02), 0.06),
    'upperArm.R': ((0.16, 0.01, 0.50), (0.23, 0.01, 0.42), 0.05),
    'forearm.R':  ((0.23, 0.01, 0.42), (0.28, 0.00, 0.36), 0.045),
    'hand.R':     ((0.28, 0.00, 0.36), (0.30, 0.00, 0.32), 0.045),
}

# Rigid head above the neck
RIGID_HEAD = (0.58, 0.03)

# The torso is ~0.14 wide on each side, further out is arm only
ARM_ONLY_X = 0.16
