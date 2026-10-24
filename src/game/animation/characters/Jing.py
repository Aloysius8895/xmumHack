"""
Jing, playable character (character select), replaces the npcBoy1 slot
Big curly hair, the head is half of the height (neck at 0.50), arms close to the body
The source also has a cat sitting next to Jing, it is removed (KEEP_MAIN_BODY), the career pet follows the player instead
The build output is ~23 MB, compress it afterwards (from src/game, 1.9 MB):
    npx gltf-transform resize static/characters/Jing/Jing.glb tmp.glb --width 1024 --height 1024
    npx gltf-transform webp tmp.glb tmp.glb --quality 85
    npx gltf-transform draco tmp.glb static/characters/Jing/Jing.glb
"""
# Paths from src/game (the source file is spelled JIng.glb)
SOURCE = '../character/JIng.glb'
OUTPUT = 'static/characters/Jing/Jing.glb'

# Keep the character only, delete the props modelled next to it (the cat)
KEEP_MAIN_BODY = True

# Joints as fractions of the height (feet at 0, top of the head at 1), Blender axes: X = right side, -Y = front, Z = up
# Measured from the mesh slices (cat removed): shoes 0-0.06, trousers to 0.20, sleeves and hands end at 0.22 (x 0.22),
# shoulders 0.46, neck 0.50
# name: (head, tail, radius)
BONES = {
    'hips':       ((0.00, 0.01, 0.20), (0.00, 0.01, 0.30), 0.18),
    'spine':      ((0.00, 0.01, 0.30), (0.00, 0.01, 0.40), 0.18),
    'chest':      ((0.00, 0.01, 0.40), (0.00, 0.01, 0.50), 0.18),
    'head':       ((0.00, 0.01, 0.50), (0.00, 0.01, 0.95), 0.30),
    'thigh.R':    ((0.07, 0.00, 0.21), (0.07, 0.00, 0.11), 0.07),
    'shin.R':     ((0.07, 0.00, 0.11), (0.07, -0.01, 0.05), 0.06),
    'foot.R':     ((0.07, -0.01, 0.05), (0.07, -0.15, 0.02), 0.06),
    'upperArm.R': ((0.14, 0.01, 0.45), (0.20, 0.00, 0.37), 0.05),
    'forearm.R':  ((0.20, 0.00, 0.37), (0.22, 0.00, 0.30), 0.045),
    'hand.R':     ((0.22, 0.00, 0.30), (0.225, 0.00, 0.23), 0.045),
}

# Rigid head above the neck
RIGID_HEAD = (0.50, 0.03)

# The jacket is ~0.17 wide on each side, further out is arm only
ARM_ONLY_X = 0.17
