"""
Where each picture sits in the two textures. Shared by make_textures.py (draws them) and the
Blender builders (map faces onto them). Pixel rectangles are (x0, y0, x1, y1), y down.
"""

# ------------------------------------------------------------------ tex/pcb_pi5.png
# top side at full scale, bottom side at half scale below it, and a strip for the board edge
PCB_SIZE = 2560
PCB_S = PCB_SIZE / 85.0                # px per mm, top side
PCB_TOP_Y = 0
PCB_BOT_Y = 1700
PCB_BOT_S = PCB_S / 2
PCB_EDGE = (1350, 1750, 1550, 1850)    # rows: solder mask, FR-4 core, solder mask


def pcb_uv(face_normal, u, v, h, t=1.6):
    """UV on the Pi PCB for a point at board coords (u, v, h) on a face with this normal"""
    S = PCB_SIZE
    if face_normal.z > 0.5:
        x, y = u * PCB_S, PCB_TOP_Y + (56.0 - v) * PCB_S
    elif face_normal.z < -0.5:
        x, y = u * PCB_BOT_S, PCB_BOT_Y + (56.0 - v) * PCB_BOT_S
    else:
        x0, y0, x1, y1 = PCB_EDGE
        x = x0 + 10 + ((u + v) % 18.0) * 10
        y = y0 + (min(max(-h / t, 0.0), 1.0)) * (y1 - y0)
    return (x / S, 1.0 - y / S)


# ------------------------------------------------------------------ tex/atlas.png
ATLAS_SIZE = 2048
CELLS = {
    # the camera board, 25 x 24 mm, seen from the front (lens side) and from the back
    "cam_front": (0, 0, 1024, 983),
    "cam_back": (1024, 0, 2048, 983),
    # chip tops, each cell drawn at the part's own aspect ratio
    "soc": (0, 1024, 512, 1536),            # 17 x 17 lid
    "ram": (520, 1024, 958, 1536),          # 12 x 14
    "can": (970, 1024, 1482, 1527),         # 11 x 10.8 shield can
    "fan": (1500, 1024, 2012, 1536),        # hub sticker (round, 8.8 mm)
    "rp1": (0, 1544, 256, 1800),            # 7 x 7
    "pmic": (264, 1544, 520, 1800),         # 6 x 6
    "phy": (528, 1544, 784, 1800),          # 6 x 6
    "reg": (792, 1544, 1048, 1800),         # 3 x 3
    "flash": (1056, 1544, 1265, 1710),      # 4.9 x 3.9
    "xtal": (1276, 1544, 1532, 1744),       # 3.2 x 2.5
    "sd": (0, 1810, 186, 2048),             # microSD label side, 11 x 14 (visible part)
    # flat colours for faces that only need the material's base colour
    "plain_black": (1600, 1600, 1680, 1680),
    "plain_metal": (1700, 1600, 1780, 1680),
    "plain_fr4": (1600, 1700, 1680, 1780),
    "plain_green": (1700, 1700, 1780, 1780),
}


def cell_uv(name, flip=False):
    """(u0, v0, u1, v1) for Part.box(top_uv=...): local +x -> u0..u1, local +y -> v0..v1.
    flip turns the picture 180 degrees (parts on the Pi sit rotated 180 in Blender)."""
    x0, y0, x1, y1 = CELLS[name]
    S = ATLAS_SIZE
    u0, v0, u1, v1 = x0 / S, 1 - y1 / S, x1 / S, 1 - y0 / S
    return (u1, v1, u0, v0) if flip else (u0, v0, u1, v1)


def cell_point(name, fx, fy):
    """UV of a point given as fractions (fx right, fy up) of a cell"""
    x0, y0, x1, y1 = CELLS[name]
    S = ATLAS_SIZE
    return ((x0 + fx * (x1 - x0)) / S, 1 - (y1 - fy * (y1 - y0)) / S)


# ------------------------------------------------------------------ camera board parts (head-local mm, centre of the board)
# chip capacitors (x, y, long side along y?) on the front and the back, the two SOT-23-5 regulators, the crystal
CAM_FRONT_SMD = [(-7.6, -8.6, False), (-5.6, -8.6, False), (7.6, -8.6, False), (5.8, 8.9, True), (-6.4, 9.0, True), (8.2, 2.0, True)]
CAM_BACK_SMD = [(-8.2, 1.0, True), (-8.2, 3.6, True), (8.2, 1.0, True), (8.2, 3.6, True), (-3.2, 2.2, False),
                (3.2, 2.2, False), (-2.6, -5.4, False), (2.6, -5.4, False), (-9.0, -4.6, True), (9.0, -4.6, True),
                (-6.2, 8.8, False), (6.2, 8.8, False), (0.0, 9.6, False), (-3.6, 9.6, False)]
CAM_BACK_SOT = [(-5.5, -3.0), (5.5, -3.0)]
CAM_XTAL = (0.0, -3.4)
CAM_FPC_PINS_Y = -8.35


def cam_img(x, y, back):
    """camera-board point -> millimetres in its atlas cell (x right, y down), as the UVs map it"""
    return ((12.5 - x) if back else (12.5 + x), 12.0 - y)
