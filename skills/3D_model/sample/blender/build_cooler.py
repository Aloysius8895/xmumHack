"""
Raspberry Pi 5 Active Cooler (collection COOLER, parent empty COOLER, impeller under IMPELLER).

Same board frame as build_pi5.py. The layout follows the web page: a 60 x 33 mm aluminium
plate 2 mm above the board, 13 fins on the left, the blower on the right with its intake
over (54, 32.5), two spring-loaded push pins through the board, a 4-wire lead to the fan
header. The impeller's origin is its axis, so the page can spin it.
Run inside Blender:  import build_cooler; build_cooler.build()
"""
import math
import importlib
from mathutils import Vector

import nc_lib
import atlas_layout
import build_pi5
for _m in (nc_lib, atlas_layout, build_pi5):
    importlib.reload(_m)
from nc_lib import Part, rrect, collection, clear_collection, empty, check_closed   # noqa: E402
from atlas_layout import CELLS, ATLAS_SIZE                                          # noqa: E402
from build_pi5 import P, bx, TOP, T                                                 # noqa: E402
from pi5_layout import PIN_HOLES                                                    # noqa: E402

PLY = (2.0, 4.0)            # heatsink plate, h above the board
FIN_H = 8.6
COVER = (11.6, 12.6)        # blower top cover
HUB = (54.0, 32.5)          # impeller axis (u, v)
IMP_H = 4.4                 # impeller base height


def uv_xy(u, v):
    """board (u, v) -> Blender (x, y)"""
    return (53.5 - u, 38.0 - v)


def volute():
    """blower wall outline in (u, v): outer box open toward the fins, a scroll inside"""
    outer = [(44.5, 16.0)] + [(63.0 + math.cos(a) * 1.0, 17.0 + math.sin(a) * 1.0) for a in [math.radians(-90 + 30 * k) for k in range(4)]]
    outer += [(63.0 + math.cos(a) * 1.0, 48.0 + math.sin(a) * 1.0) for a in [math.radians(30 * k) for k in range(4)]]
    outer += [(44.5, 49.0)]
    inner = [(44.5, 48.0)]
    for k in range(19):
        th = math.radians(80 - k * 10)
        R = 9.2 + (math.degrees(th) + 100) / 180 * 7
        u = min(HUB[0] + R * math.cos(th), 63.0)
        v = min(max(HUB[1] + R * math.sin(th), 17.0), 48.0)
        if (u, v) != inner[-1]:
            inner.append((u, v))
    inner += [(48.0, 19.0), (44.5, 17.0)]
    pts = outer + inner
    out = []
    for p in pts:
        if not out or (abs(p[0] - out[-1][0]) > 1e-3 or abs(p[1] - out[-1][1]) > 1e-3):
            out.append(p)
    return [uv_xy(u, v) for (u, v) in out]


def blade_outline(th0, r0=5.2, r1=8.2, sweep=24.0, t=0.36, n=7):
    """a forward-curved blade as a thin crescent in the impeller's local XY"""
    c, nrm = [], []
    for i in range(n + 1):
        f = i / n
        r = r0 + (r1 - r0) * f
        a = math.radians(th0 + sweep * f)
        c.append(Vector((r * math.cos(a), r * math.sin(a))))
    for i in range(len(c)):
        d = (c[min(i + 1, len(c) - 1)] - c[max(i - 1, 0)]).normalized()
        nrm.append(Vector((-d.y, d.x)))
    left = [tuple(p + q * t / 2) for p, q in zip(c, nrm)]
    right = [tuple(p - q * t / 2) for p, q in zip(c, nrm)]
    return left + right[::-1]


def build():
    import bpy
    coll = collection("COOLER")
    clear_collection(coll)
    root = empty("COOLER", coll, size=15)
    made = []

    # aluminium plate with the push-pin holes, and the fins
    hs = Part("COOLER_heatsink")
    hs.prism(Vector((0, 0, TOP + PLY[0])), rrect(*uv_xy(34.0, 32.5), 60.0, 33.0, 1.5, 4), PLY[1] - PLY[0], "heatsink", bevel=0.3, bsegs=1)
    cut = Part("cut", mats=hs.mats)
    for (u, v) in PIN_HOLES:
        cut.cyl(P(u, v, (PLY[0] + PLY[1]) / 2), 1.2, 3.0, "heatsink", segs=24)
    hs.cut(cut)
    made.append(hs.finish(coll, root))
    fins = Part("COOLER_fins")
    for k in range(13):
        bx(fins, 26.5, 17.5 + k * 2.5, PLY[1] - 0.05, 35.0, 0.8, FIN_H + 0.05, "heatsink", r=0.32, segs=2)
    made.append(fins.finish(coll, root))

    # thermal pads on the SoC lid, the RAM and RP1
    pads = Part("COOLER_thermal_pads")
    bx(pads, 30.0, 31.0, 1.3, 16.6, 16.6, PLY[0] - 1.3 - 0.02, "thermal", r=0.15, segs=1)
    bx(pads, 13.5, 31.0, 1.0, 11.6, 13.6, PLY[0] - 1.0 - 0.02, "thermal", r=0.15, segs=1)
    bx(pads, 61.0, 27.0, 0.9, 5.6, 6.6, PLY[0] - 0.9 - 0.02, "thermal", r=0.15, segs=1)
    made.append(pads.finish(coll, root))

    # blower: scroll wall, top cover with intake and a raised lip, three screws
    wall = Part("COOLER_blower_wall")
    wall.prism(Vector((0, 0, TOP + PLY[1])), volute(), COVER[0] - PLY[1], "black")
    made.append(wall.finish(coll, root))
    cover = Part("COOLER_blower_cover")
    cover.prism(Vector((0, 0, TOP + COVER[0])), rrect(*uv_xy(54.25, 32.5), 19.5, 33.0, 0.9, 4), COVER[1] - COVER[0], "black", bevel=0.15, bsegs=1)
    cut = Part("cut", mats=cover.mats)
    cut.cyl(P(HUB[0], HUB[1], (COVER[0] + COVER[1]) / 2), 6.6, 3.0, "black", segs=64)
    cover.cut(cut)
    made.append(cover.finish(coll, root))
    lip = Part("COOLER_intake_lip")
    lip.lathe(P(HUB[0], HUB[1], COVER[1] - 0.02), [(6.6, 0.0), (7.7, 0.0), (7.5, 0.32), (6.75, 0.32)], "black", segs=64, closed=True)
    for (u, v) in ((45.6, 17.4), (62.6, 17.4), (62.6, 47.6)):
        lip.lathe(P(u, v, COVER[1]), [(0, 0), (0.95, 0), (0.95, 0.25), (0.7, 0.5), (0, 0.55)], "screw", segs=20)
    made.append(lip.finish(coll, root))

    # impeller: base ring, hub cup, 27 forward-curved blades; origin on the axis
    bpy.context.view_layer.update()
    pivot = P(HUB[0], HUB[1], IMP_H)
    imp_root = empty("IMPELLER", coll, loc=pivot, parent=root, size=6)
    imp = Part("COOLER_impeller")
    imp.lathe(pivot, [(4.3, 0.0), (8.45, 0.0), (8.45, 0.45), (4.3, 0.45)], "grey", segs=72, closed=True)
    imp.lathe(pivot, [(0, 0.0), (4.4, 0.0), (4.4, 6.25), (4.15, 6.6), (0, 6.68)], "grey", segs=64)
    for i in range(27):
        imp.prism(pivot + Vector((0, 0, 0.3)), blade_outline(i * 360 / 27), 5.9, "grey")
    made.append(imp.finish(coll, imp_root, pivot=pivot))
    # the hub sticker turns with it
    x0, y0, x1, y1 = CELLS["fan"]
    S = ATLAS_SIZE

    def sticker_uv(n, co):
        fx = 0.5 + (co.x - pivot.x) / 8.8
        fy = 0.5 + (co.y - pivot.y) / 8.8
        return ((x0 + fx * (x1 - x0)) / S, 1 - (y1 - fy * (y1 - y0)) / S)
    st = Part("COOLER_hub_sticker")
    st.lathe(pivot, [(0, 6.62), (4.0, 6.62), (4.0, 6.74), (0, 6.74)], "mark_label", segs=48)
    made.append(st.finish(coll, imp_root, pivot=pivot, uv_func=sticker_uv))

    # push pins: domed cap, shaft, spring between cap and plate, split barb under the board
    pins = Part("COOLER_push_pins")
    springs = Part("COOLER_springs")
    barbs = Part("COOLER_pin_barbs")
    for (u, v) in PIN_HOLES:
        pins.lathe(P(u, v, 6.6), [(0, 0), (2.4, 0), (2.45, 0.3), (2.2, 1.1), (1.4, 1.5), (0, 1.58)], "black", segs=40)
        pins.cyl(P(u, v, (6.62 + (-1.9)) / 2), 1.0, 6.62 + 1.9, "black", segs=24)
        pts = []
        turns, z0, z1, R = 3.6, PLY[1] + 0.22, 6.6 - 0.22, 1.72
        n = int(turns * 28)
        for k in range(n + 1):
            a = math.tau * turns * k / n
            pts.append(P(u, v, z0 + (z1 - z0) * k / n) + Vector((R * math.cos(a), R * math.sin(a), 0)))
        springs.tube(pts, 0.2, "steel", segs=8, raw=True)
        barbs.lathe(P(u, v, 0), [(0, -3.5), (0.75, -3.5), (1.55, -2.05), (1.0, -1.75), (0, -1.75)], "black", segs=32)
    cut = Part("cut", mats=barbs.mats)
    for (u, v) in PIN_HOLES:
        bx(cut, u, v, -3.8, 0.5, 4.0, 2.4, "black")
    barbs.cut(cut)
    made += [pins.finish(coll, root), springs.finish(coll, root), barbs.finish(coll, root)]

    # fan lead: four wires from the blower's corner down into the plug on the fan header
    plug = Part("COOLER_fan_plug")
    bx(plug, 67.0, 51.5, 1.2, 4.6, 2.9, 3.0, "white", r=0.15, segs=1)
    made.append(plug.finish(coll, root))
    wires = Part("COOLER_fan_wires")
    for i, m in enumerate(("wire_black", "wire_red", "wire_yellow", "wire_blue")):
        o = (i - 1.5) * 0.62
        wires.tube([P(67.0 + o * 1.6, 51.5, 3.8), P(67.0 + o * 1.4, 51.4, 5.6), P(66.2 + o, 50.4, 7.6),
                    P(64.9 + o * 0.8, 48.9, 8.9), P(63.6 + o * 0.7, 47.6, 9.3)], 0.28, m, segs=8, steps=10)
    made.append(wires.finish(coll, root))

    bad = check_closed(made)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in made)
    return {"objects": len(made), "tris": tris, "open": bad}
