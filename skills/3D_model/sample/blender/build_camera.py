"""
Camera Module 3 NoIR (collection CAMERA, parent empty CAMERA = the page's camera head frame).

The page builds the camera inside a head group at (0, 0.152, -0.0295) m, tilted 12 degrees
down toward the bed, with the lens along the head's +Z. Here the empty CAMERA carries that
pose and the parts are modelled in its local frame:
    H(x, y, z) head-local mm (x right, y up, z out of the lens) -> Blender local (x, -z, y)
Run inside Blender:  import build_camera; build_camera.build()
"""
import math
import importlib
from mathutils import Vector, Matrix

import nc_lib
import atlas_layout
for _m in (nc_lib, atlas_layout):
    importlib.reload(_m)
from nc_lib import Part, rrect, collection, clear_collection, empty, check_closed   # noqa: E402
from atlas_layout import cell_point, CAM_FRONT_SMD, CAM_BACK_SMD, CAM_BACK_SOT, CAM_XTAL, CAM_FPC_PINS_Y   # noqa: E402

HEAD_POS = (0.0, 29.5, 152.0)       # Blender mm: device (0, 0.152, -0.0295) m
TILT = math.radians(12)
PCB_Z = (-2.5, -1.5)                # board back and front, head-local z
HOLES = [(sx * 10.5, sy * 6.25) for sx in (-1, 1) for sy in (-1, 1)]


def H(x, y, z):
    return Vector((x, -z, y))


def frame(x, y, z):
    return Matrix((x, y, z)).transposed().to_4x4()


F_FWD = frame((1, 0, 0), (0, 0, 1), (0, -1, 0))     # local x, y, z -> head x, y, z (forward)
F_BACK = frame((-1, 0, 0), (0, 0, 1), (0, 1, 0))    # extrusion toward the back of the board


def hbox(part, x, y, z0, w, h, d, mat, **kw):
    """box in head coords: centred on (x, y), from z0 forward by d (negative d goes back)"""
    part.box(H(x, y, z0 + d / 2), (w, abs(d), h), mat, **kw)


def board_uv(n, co):
    x, y = co.x, co.z
    if n.y < -0.5:                        # front (lens side)
        return cell_point("cam_front", (x + 12.5) / 25.0, (y + 12.0) / 24.0)
    if n.y > 0.5:                         # back, seen from behind
        return cell_point("cam_back", (12.5 - x) / 25.0, (y + 12.0) / 24.0)
    return cell_point("plain_green", 0.5, 0.5)


def smd_face(part, x, y, L, W, Hh, back, rot=False, body="cap"):
    """a chip capacitor lying on the front or back of the camera board"""
    z0 = PCB_Z[0] if back else PCB_Z[1]
    d = -Hh if back else Hh
    w, h = (W, L) if rot else (L, W)
    hbox(part, x, y, z0, w - (0 if rot else 0.02), h - (0.02 if rot else 0), d, body, r=0.04, segs=1)
    t = 0.22
    for s in (-1, 1):
        if rot:
            hbox(part, x, y + s * (L / 2 - t / 2), z0, W + 0.03, t, d * 1.06, "tin")
        else:
            hbox(part, x + s * (L / 2 - t / 2), y, z0, t, W + 0.03, d * 1.06, "tin")


def build():
    import bpy
    coll = collection("CAMERA")
    clear_collection(coll)
    root = empty("CAMERA", coll, loc=HEAD_POS, rot=(TILT, 0, 0), size=10)
    made = []

    # the board, both sides printed from the atlas
    pcb = Part("CAM_pcb")
    pcb.prism(H(0, 0, PCB_Z[0]), rrect(0, 0, 25.0, 24.0, 1.0, 4), PCB_Z[1] - PCB_Z[0], "campcb_tex", rot=F_FWD)
    cut = Part("cut", mats=pcb.mats)
    for (x, y) in HOLES:
        cut.cyl(H(x, y, -2.0), 1.1, 2.0, "campcb_tex", axis="Y", segs=24)
    pcb.cut(cut)
    made.append(pcb.finish(coll, root, uv_func=board_uv, local=True))

    # lens module: holder plate, autofocus motor can, stepped barrel, aperture ring, front glass
    lm = Part("CAM_lens_module")
    lm.prism(H(0, 0, PCB_Z[1]), rrect(0, 0, 9.8, 9.8, 0.4, 3), 0.5, "black", rot=F_FWD)
    lm.prism(H(0, 0, PCB_Z[1] + 0.5), rrect(0, 0, 8.5, 8.5, 0.6, 4), 3.2, "black", rot=F_FWD, bevel=0.25, bsegs=2)
    barrel = [(0, 2.1), (3.75, 2.1), (3.75, 4.6), (3.62, 4.75), (3.62, 5.2), (3.75, 5.35), (3.75, 6.1),
              (3.45, 6.3), (3.45, 7.55), (3.25, 7.9), (2.55, 7.98), (2.45, 7.8), (0, 7.8)]
    lm.lathe(H(0, 0, 0), barrel, "black", segs=64, axis="-Y")
    made.append(lm.finish(coll, root, local=True))
    glass = Part("CAM_lens_glass")
    glass.lathe(H(0, 0, 0), [(0, 7.7), (2.46, 7.7), (2.42, 7.95), (2.1, 8.3), (1.2, 8.55), (0, 8.62)], "lens", segs=48, axis="-Y")
    made.append(glass.finish(coll, root, local=True))

    # parts on the front around the lens
    front = Part("CAM_front_parts")
    for (x, y, rot) in CAM_FRONT_SMD:
        smd_face(front, x, y, 1.0, 0.5, 0.5, back=False, rot=rot)
    made.append(front.finish(coll, root, local=True))

    # back: 15-pin connector at the bottom edge (clear of the head's screw bosses), regulators, crystal, decoupling
    con = Part("CAM_fpc_body")
    hbox(con, 0, -10.2, PCB_Z[0], 18.0, 3.2, -1.6, "beige", r=0.12, segs=1)
    cut = Part("cut", mats=con.mats)
    hbox(cut, 0, -9.5, PCB_Z[0] - 0.6, 16.4, 0.55, -2.0, "beige")
    con.cut(cut)
    made.append(con.finish(coll, root, local=True))
    lock = Part("CAM_fpc_lock")
    hbox(lock, 0, -10.2, PCB_Z[0] - 1.6, 18.6, 3.2, -0.5, "brown", r=0.1, segs=1)
    cut = Part("cut", mats=lock.mats)
    hbox(cut, 0, -9.5, PCB_Z[0] - 1.4, 16.5, 0.6, -1.0, "brown")
    lock.cut(cut)
    made.append(lock.finish(coll, root, local=True))
    back = Part("CAM_back_parts")
    for i in range(15):
        hbox(back, -7.0 + i, CAM_FPC_PINS_Y, PCB_Z[0], 0.3, 0.6, -0.12, "tin")
    for s in (-1, 1):
        hbox(back, s * 9.4, -10.4, PCB_Z[0], 0.6, 1.4, -1.0, "tin")
    for (x, y) in CAM_BACK_SOT:                          # SOT-23-5 regulators
        hbox(back, x, y, PCB_Z[0], 2.9, 1.6, -1.0, "chip", r=0.08, segs=1)
        for i in range(3):
            hbox(back, x + (i - 1) * 0.95, y - 1.05, PCB_Z[0], 0.4, 0.6, -0.15, "tin")
        for i in (-1, 1):
            hbox(back, x + i * 0.95, y + 1.05, PCB_Z[0], 0.4, 0.6, -0.15, "tin")
    hbox(back, *CAM_XTAL, PCB_Z[0], 2.0, 1.6, -0.35, "cap", r=0.05, segs=1)          # crystal base
    hbox(back, *CAM_XTAL, PCB_Z[0] - 0.35, 1.8, 1.4, -0.3, "lid", r=0.06, segs=1)    # crystal lid
    for (x, y, rot) in CAM_BACK_SMD:
        smd_face(back, x, y, 1.0, 0.5, 0.5, back=True, rot=rot)
    made.append(back.finish(coll, root, local=True))

    # four pan-head screws from the front into the head's bosses
    sc = Part("CAM_screws")
    head = [(0, 0), (1.65, 0), (1.7, 0.25), (1.5, 0.7), (1.05, 1.0), (0, 1.05)]
    for (x, y) in HOLES:
        sc.lathe(H(x, y, PCB_Z[1]), head, "screw", segs=28, axis="-Y")
    cut = Part("cut", mats=sc.mats)
    plus = [(-0.22, -0.85), (0.22, -0.85), (0.22, -0.22), (0.85, -0.22), (0.85, 0.22), (0.22, 0.22), (0.22, 0.85),
            (-0.22, 0.85), (-0.22, 0.22), (-0.85, 0.22), (-0.85, -0.22), (-0.22, -0.22)]
    for (x, y) in HOLES:
        cut.prism(H(x, y, PCB_Z[1] + 0.5), plus, 1.0, "screw", rot=F_FWD @ Matrix.Rotation(math.radians(45), 4, "Z"))
    sc.cut(cut)
    made.append(sc.finish(coll, root, local=True))

    bad = check_closed(made)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in made)
    return {"objects": len(made), "tris": tris, "open": bad}
