"""
NPC boy in a hoodie with a backpack (frontend developer gym leader on Career Plaza)
Slimmer than Shin-chan: arms close to the body, slightly longer legs, the head is still half of the height
"""
# Paths from GamePlat/game
SOURCE = '../../character/npcBoy1.glb'
OUTPUT = 'static/characters/npcBoy1/npcBoy1.glb'

# Joints as fractions of the height (feet at 0, top of the head at 1), Blender axes: X = right side, -Y = front, Z = up
# Measured from the mesh slices: shoes 0-0.10, shorts 0.12-0.24, hands end at 0.22, shoulders 0.44, neck 0.50
# name: (head, tail, radius)
BONES = {
    'hips':       ((0.00, 0.02, 0.24), (0.00, 0.02, 0.32), 0.18),
    'spine':      ((0.00, 0.02, 0.32), (0.00, 0.02, 0.42), 0.18),
    'chest':      ((0.00, 0.02, 0.42), (0.00, 0.02, 0.50), 0.18),
    'head':       ((0.00, 0.02, 0.50), (0.00, 0.02, 0.95), 0.30),
    'thigh.R':    ((0.085, 0.00, 0.23), (0.09, 0.00, 0.12), 0.07),
    'shin.R':     ((0.09, 0.00, 0.12), (0.09, -0.01, 0.05), 0.06),
    'foot.R':     ((0.09, -0.01, 0.05), (0.09, -0.13, 0.02), 0.06),
    'upperArm.R': ((0.15, 0.02, 0.43), (0.22, 0.01, 0.35), 0.05),
    'forearm.R':  ((0.22, 0.01, 0.35), (0.26, 0.00, 0.27), 0.045),
    'hand.R':     ((0.26, 0.00, 0.27), (0.275, 0.00, 0.22), 0.045),
}

# Rigid head above the neck
RIGID_HEAD = (0.50, 0.03)

# The hoodie is ~0.16 wide on each side, further out is arm only
ARM_ONLY_X = 0.19
