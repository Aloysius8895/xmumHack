"""
Crayon Shin-chan, chibi proportions (the head is half of the height, very short legs, arms modelled hanging at ~45deg)
"""
# Paths from src/game
SOURCE = '../character/xinchan.glb'
OUTPUT = 'static/player/xinchan.glb'

# Joints as fractions of the height (feet at 0, top of the head at 1), Blender axes: X = right side, -Y = front, Z = up
# Center and right side only, the left side is mirrored. Measured from the mesh slices (verts per height band).
# name: (head, tail, radius), the radius is how far the bone reaches when skinning
BONES = {
    'hips':       ((0.00, 0.02, 0.28), (0.00, 0.02, 0.36), 0.20),
    'spine':      ((0.00, 0.03, 0.36), (0.00, 0.03, 0.46), 0.20),
    'chest':      ((0.00, 0.03, 0.46), (0.00, 0.03, 0.52), 0.20),
    'head':       ((0.00, 0.03, 0.52), (0.00, 0.03, 0.95), 0.30),
    'thigh.R':    ((0.10, 0.02, 0.27), (0.14, 0.02, 0.13), 0.09),
    'shin.R':     ((0.14, 0.02, 0.13), (0.15, 0.00, 0.05), 0.07),
    'foot.R':     ((0.15, 0.00, 0.05), (0.16, -0.10, 0.02), 0.07),
    'upperArm.R': ((0.17, 0.03, 0.46), (0.26, 0.02, 0.37), 0.06),
    'forearm.R':  ((0.26, 0.02, 0.37), (0.33, 0.00, 0.29), 0.05),
    'hand.R':     ((0.33, 0.00, 0.29), (0.37, 0.00, 0.23), 0.05),
}

# Everything above 0.51 follows the head only (vinyl toy head), blended over 0.03
RIGID_HEAD = (0.51, 0.03)

# The torso is ~0.2 wide on each side, further out is arm only
ARM_ONLY_X = 0.22
