"""
Lee Khim, playable character (character select)
Thin legs under a wide dress (from 0.24), no narrow neck: the head starts where the face does (0.60)
"""
# Paths from src/game
SOURCE = '../character/LeeKhim.glb'
OUTPUT = 'static/characters/LeeKhim/LeeKhim.glb'

# Joints as fractions of the height (feet at 0, top of the head at 1), Blender axes: X = right side, -Y = front, Z = up
# Measured from the mesh slices: shoes 0-0.08, dress 0.24-0.34, shoulders 0.54, face from 0.60, hands end at 0.34 (x 0.28)
# name: (head, tail, radius)
BONES = {
    'hips':       ((0.00, 0.03, 0.24), (0.00, 0.03, 0.34), 0.18),
    'spine':      ((0.00, 0.03, 0.34), (0.00, 0.03, 0.44), 0.18),
    'chest':      ((0.00, 0.03, 0.44), (0.00, 0.03, 0.59), 0.18),
    'head':       ((0.00, 0.03, 0.59), (0.00, 0.03, 0.95), 0.30),
    'thigh.R':    ((0.065, 0.00, 0.25), (0.07, 0.00, 0.14), 0.07),
    'shin.R':     ((0.07, 0.00, 0.14), (0.07, -0.01, 0.07), 0.055),
    'foot.R':     ((0.07, -0.01, 0.07), (0.07, -0.14, 0.02), 0.055),
    'upperArm.R': ((0.17, 0.02, 0.54), (0.22, 0.02, 0.45), 0.05),
    'forearm.R':  ((0.22, 0.02, 0.45), (0.26, 0.01, 0.39), 0.045),
    'hand.R':     ((0.26, 0.01, 0.39), (0.28, 0.00, 0.34), 0.045),
}

# Rigid head from the face down
RIGID_HEAD = (0.60, 0.03)

# The dress flares to ~0.20 on each side, further out is arm only (hands start at 0.21)
ARM_ONLY_X = 0.205
