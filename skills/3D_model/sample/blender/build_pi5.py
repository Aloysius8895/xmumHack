"""
Raspberry Pi 5 board, built in the open Blender scene (collection PI5, parent empty PI5).

Board coordinates (u, v, h) from pi5_layout.py map to Blender mm as
    P(u, v, h) = (53.5 - u, 38 - v, 13.1 + h)
which is the page's X(u), Z(v), YT in metres turned into Blender's Z-up frame.
Run inside Blender:  import build_pi5; build_pi5.build()
"""
import math
import importlib
from mathutils import Vector, Matrix, Euler

import nc_lib
import pi5_layout
import atlas_layout
for _m in (nc_lib, pi5_layout, atlas_layout):
    importlib.reload(_m)
from nc_lib import Part, rrect, circle, collection, clear_collection, empty, check_closed   # noqa: E402
from pi5_layout import PARTS, UNDER, HOLES, PIN_HOLES, SIZES, passives                     # noqa: E402
from atlas_layout import cell_uv, pcb_uv                                                   # noqa: E402

TOP = 13.1          # top of the PCB, Blender z
T = 1.6             # board thickness


def P(u, v, h=0.0):
    return Vector((53.5 - u, 38.0 - v, TOP + h))


def frame(x, y, z):
    """4x4 rotation whose columns are where local x, y, z go"""
    return Matrix((x, y, z)).transposed().to_4x4()


# local x -> +u, y -> up, z -> -v : outlines drawn across the HDMI edge, extruded out of it
F_VOUT = frame((-1, 0, 0), (0, 0, 1), (0, 1, 0))
# local x -> +v, y -> up, z -> +u : outlines drawn across the USB edge, extruded out of it
F_UOUT = frame((0, -1, 0), (0, 0, 1), (-1, 0, 0))


def bx(part, u, v, h0, du, dv, dh, mat, **kw):
    """board-aligned box: footprint centred on (u, v), from h0 up dh"""
    part.box(P(u, v, h0 + dh / 2), (du, dv, dh), mat, **kw)


def comp(name):
    return next(p for p in PARTS + UNDER if p[0] == name)


# ------------------------------------------------------------------ small parts
def smd(part, kind, u, v, rot, body="cap"):
    L, W, H = SIZES[kind]
    term = {"c0402": 0.22, "r0402": 0.22, "c0603": 0.3, "c0805": 0.4}[kind]
    du, dv = (W, L) if rot else (L, W)
    if kind.startswith("r"):
        bx(part, u, v, 0.0, du - 0.02 if not rot else du, dv - 0.02 if rot else dv, H, "white", top="chip")
    else:
        bx(part, u, v, 0.0, du - 0.02 if not rot else du, dv - 0.02 if rot else dv, H, body, r=0.05, segs=1)
    for s in (-1, 1):
        if rot:
            bx(part, u, v + s * (L / 2 - term / 2), -0.0, W + 0.03, term, H + 0.03, "tin")
        else:
            bx(part, u + s * (L / 2 - term / 2), v, -0.0, term, W + 0.03, H + 0.03, "tin")


GULL = [(0.0, 0.62), (0.28, 0.62), (0.46, 0.0), (0.82, 0.0), (0.82, 0.18), (0.6, 0.18), (0.42, 0.8), (0.0, 0.8)]


def gull(part, u, v, out, width, h_scale=1.0, mat="tin"):
    """one gull-wing lead leaving a package side at (u, v); out is 'u+', 'u-', 'v+' or 'v-'"""
    pts = [(x, y * h_scale) for (x, y) in GULL]
    if out == "v+":
        F = frame((0, -1, 0), (0, 0, 1), (-1, 0, 0))
        c = P(u - width / 2, v, 0)
    elif out == "v-":
        F = frame((0, 1, 0), (0, 0, 1), (1, 0, 0))
        c = P(u + width / 2, v, 0)
    elif out == "u+":
        F = frame((-1, 0, 0), (0, 0, 1), (0, 1, 0))
        c = P(u, v + width / 2, 0)
    else:
        F = frame((1, 0, 0), (0, 0, 1), (0, -1, 0))
        c = P(u, v - width / 2, 0)
    part.prism(c, pts, width, mat, rot=F)


def qfn(coll, parent, name, cell):
    _n, _k, u, v, du, dv, h = comp(name)
    p = Part("PI5_" + name.lower())
    bx(p, u, v, 0.0, du, dv, h, "chip", r=0.12, segs=2, top="mark_chip", top_uv=cell_uv(cell, flip=True))
    n = max(3, int(du / 0.5) - 2)
    for i in range(n):
        o = (i - (n - 1) / 2) * 0.5
        bx(p, u - du / 2 + 0.03, v + o, 0.0, 0.12, 0.24, 0.2, "tin")
        bx(p, u + du / 2 - 0.03, v + o, 0.0, 0.12, 0.24, 0.2, "tin")
        bx(p, u + o, v - dv / 2 + 0.03, 0.0, 0.24, 0.12, 0.2, "tin")
        bx(p, u + o, v + dv / 2 - 0.03, 0.0, 0.24, 0.12, 0.2, "tin")
    return p.finish(coll, parent)


# ------------------------------------------------------------------ connectors
def usb_a(coll, parent, name, insert_mat, superspeed):
    _n, _k, u, v, du, dv, h = comp(name)
    u0, u1 = u - du / 2, u + du / 2            # 70.5 .. 88
    holes = (4.4, 11.4)
    shell = Part("PI5_%s_shell" % name.lower())
    bx(shell, u, v, 0.0, du, dv, h, "port", r=0.18, segs=2)
    cut = Part("cut", mats=shell.mats)
    for hc in holes:
        cut.prism(P(u0 + 4.5, v, 0), rrect(0, hc, 12.5, 5.12, 0.35), du, "port", rot=F_UOUT)
    shell.cut(cut)
    obs = [shell.finish(coll, parent)]
    # spring tabs pressed in from the top and bottom of each opening
    tabs = Part("PI5_%s_tabs" % name.lower())
    for hc in holes:
        for s in (-1, 1):
            for dv_ in (-3.4, 3.4):
                tabs.box(P(u1 - 1.9, v + dv_, hc + s * 2.38), (2.8, 1.5, 0.22), "port",
                         rot=Euler((0, s * math.radians(-9), 0)))
    obs.append(tabs.finish(coll, parent))
    ins = Part("PI5_%s_insert" % name.lower())
    for hc in holes:
        bx(ins, u0 + 4.5 + 0.35, v, hc - 2.5, 0.7, 12.4, 5.0, insert_mat)              # back wall
        bx(ins, (u0 + 5.2 + u1 - 0.9) / 2, v, hc + 2.56 - 0.55 - 1.9, (u1 - 0.9) - (u0 + 5.2), 10.6, 1.9, insert_mat, r=0.12)
    obs.append(ins.finish(coll, parent))
    con = Part("PI5_%s_contacts" % name.lower())
    for hc in holes:
        tb = hc + 2.56 - 0.55 - 1.9          # tongue bottom
        for o in (-3.75, -1.25, 1.25, 3.75):
            bx(con, 81.0, v + o, tb - 0.06, 6.5, 1.0, 0.1, "gold")
        if superspeed:
            for o in (-4.0, -2.0, 0.0, 2.0, 4.0):
                bx(con, 86.0, v + o, tb - 0.06, 1.6, 0.7, 0.1, "gold")
    obs.append(con.finish(coll, parent))
    return obs


def rj45(coll, parent):
    _n, _k, u, v, du, dv, h = comp("ETH")
    u0, u1 = u - du / 2, u + du / 2            # 67 .. 88
    W = 0.25
    hc = 7.4
    opening = [(-5.85, hc - 3.45), (5.85, hc - 3.45), (5.85, hc + 3.45), (-5.85, hc + 3.45)]
    notch = [(-3.0, 1.75), (3.0, 1.75), (3.0, hc - 3.45 + 0.01), (-3.0, hc - 3.45 + 0.01)]
    key = [(-5.85, hc - 3.45), (-3.0, hc - 3.45), (-3.0, 1.75), (3.0, 1.75), (3.0, hc - 3.45), (5.85, hc - 3.45),
           (5.85, hc + 3.45), (-5.85, hc + 3.45)]
    # metal can: a cup open at the bottom with the jack mouth and two LED windows in front
    can = Part("PI5_eth_can")
    bx(can, u, v, 0.0, du, dv, h, "port", r=0.15, segs=1)
    cut = Part("cut", mats=can.mats)
    bx(cut, u, v, -1.0, du - 2 * W, dv - 2 * W, h - W + 1.0, "port")
    big = [(x * 1.03, y + (0.1 if y > hc else -0.1)) for (x, y) in key]
    cut.prism(P(u1 - 1.0, v, 0), big, 2.0, "port", rot=F_UOUT)
    for s in (-1, 1):
        bx(cut, u1 - 0.5, v + s * 4.6, 11.3, 1.2, 2.2, 1.4, "port")
    can.cut(cut)
    obs = [can.finish(coll, parent)]
    body = Part("PI5_eth_body")
    bx(body, u - 0.01, v, 0.01, du - 2 * W - 0.02, dv - 2 * W - 0.02, h - W - 0.02, "black")
    cut = Part("cut", mats=body.mats)
    cut.prism(P(u0 + 5.0, v, 0), key, du, "black", rot=F_UOUT)
    for s in (-1, 1):
        bx(cut, u1 - 1.0, v + s * 4.6, 11.4, 2.0, 2.0, 1.2, "black")
    body.cut(cut)
    obs.append(body.finish(coll, parent))
    led = Part("PI5_eth_leds")
    for s, m in ((-1, "led_g"), (1, "led_y")):
        bx(led, u1 - 0.95, v + s * 4.6, 11.45, 1.4, 1.9, 1.1, m, r=0.1, segs=1)
    obs.append(led.finish(coll, parent))
    con = Part("PI5_eth_contacts")
    for i in range(8):
        o = (i - 3.5) * 1.02
        con.tube([P(u1 - 3.2, v + o, hc + 3.45 - 0.05), P(u1 - 4.6, v + o, hc + 2.7), P(u0 + 9.0, v + o, hc + 0.6)], 0.2, "gold", segs=6, steps=6)
    obs.append(con.finish(coll, parent))
    fin = Part("PI5_eth_fingers")
    for s in (-1, 1):
        for hh in (3.8, 9.6):
            fin.box(P(u1 - 2.4, v + s * (dv / 2 + 0.12), hh), (2.6, 0.2, 1.6), "port", rot=Euler((0, 0, s * math.radians(-12))))
    obs.append(fin.finish(coll, parent))
    return obs


def usb_c(coll, parent):
    _n, _k, u, v, du, dv, h = comp("USBC")
    vb = v + dv / 2                         # back face (5.85)
    hc = h / 2
    shell = Part("PI5_usbc_shell")
    shell.prism(P(u, vb, 0), rrect(0, hc, du, h, h / 2 - 0.01, 8), dv, "port", rot=F_VOUT)
    cut = Part("cut", mats=shell.mats)
    cut.prism(P(u, vb - 0.8, 0), rrect(0, hc, 8.34, 2.56, 1.27, 8), dv, "port", rot=F_VOUT)
    shell.cut(cut)
    obs = [shell.finish(coll, parent)]
    tg = Part("PI5_usbc_tongue")
    bx(tg, u, vb - 0.8 - 2.4, hc - 0.35, 6.69, 4.8, 0.7, "black", r=0.12, segs=1)
    for i in range(12):
        o = (i - 5.5) * 0.5
        for s in (-1, 1):
            bx(tg, u + o, vb - 0.8 - 3.0, hc + s * 0.36 - 0.03, 0.25, 3.4, 0.06, "gold")
    for s in (-1, 1):                         # board-lock legs
        bx(tg, u + s * (du / 2 + 0.25), vb - 1.6, -0.0, 0.5, 1.2, 1.3, "port")
        bx(tg, u + s * (du / 2 + 0.25), vb - 5.6, -0.0, 0.5, 1.0, 1.3, "port")
    obs.append(tg.finish(coll, parent))
    return obs


def micro_hdmi(coll, parent, name):
    _n, _k, u, v, du, dv, h = comp(name)
    vb = v + dv / 2
    ch = 0.7
    outer = [(-du / 2 + ch, 0.0), (du / 2 - ch, 0.0), (du / 2, ch), (du / 2, h), (-du / 2, h), (-du / 2, ch)]
    ow, oh, och, oy = 6.6, 2.5, 0.55, (h - 2.5) / 2
    inner = [(-ow / 2 + och, oy), (ow / 2 - och, oy), (ow / 2, oy + och), (ow / 2, oy + oh), (-ow / 2, oy + oh), (-ow / 2, oy + och)]
    shell = Part("PI5_%s_shell" % name.lower())
    shell.prism(P(u, vb, 0), outer, dv, "port", rot=F_VOUT, bevel=0.1, bsegs=1)
    cut = Part("cut", mats=shell.mats)
    cut.prism(P(u, vb - 0.9, 0), inner, dv, "port", rot=F_VOUT)
    shell.cut(cut)
    obs = [shell.finish(coll, parent)]
    tg = Part("PI5_%s_tongue" % name.lower())
    hc = oy + oh / 2
    bx(tg, u, vb - 0.9 - 2.5, hc - 0.28, 5.3, 5.0, 0.56, "black", r=0.1, segs=1)
    for i in range(10):
        bx(tg, u + (i - 4.5) * 0.4, vb - 3.6, hc + 0.27, 0.2, 3.2, 0.05, "gold")
    for i in range(9):
        bx(tg, u + (i - 4.0) * 0.4, vb - 3.6, hc - 0.32, 0.2, 3.2, 0.05, "gold")
    for s in (-1, 1):
        bx(tg, u + s * (du / 2 + 0.25), vb - 1.4, 0.0, 0.5, 1.4, 1.5, "port")
    obs.append(tg.finish(coll, parent))
    return obs


def mipi(coll, parent, name):
    """22-pin 0.5 mm FPC connector, vertical entry; the slide lock sits on top"""
    _n, _k, u, v, du, dv, h = comp(name)
    body = Part("PI5_%s_body" % name.lower())
    bx(body, u, v, 0.0, du - 0.6, dv - 0.8, h - 0.6, "black", r=0.12, segs=1)
    cut = Part("cut", mats=body.mats)
    bx(cut, u, v, h - 2.2, 0.55, 11.8, 2.0, "black")
    body.cut(cut)
    lock = Part("PI5_%s_lock" % name.lower())
    bx(lock, u, v, h - 0.6, du, dv, 0.6, "brown", r=0.1, segs=1)
    cut = Part("cut", mats=lock.mats)
    bx(cut, u, v, h - 1.0, 0.6, 11.9, 1.4, "brown")
    lock.cut(cut)
    pins = Part("PI5_%s_pins" % name.lower())
    for i in range(11):
        bx(pins, u - du / 2 + 0.05, v + (i - 5) * 1.0, 0.0, 0.7, 0.2, 0.15, "tin")
        bx(pins, u + du / 2 - 0.05, v + (i - 4.5) * 1.0, 0.0, 0.7, 0.2, 0.15, "tin")
    for s in (-1, 1):
        bx(pins, u, v + s * (dv / 2 - 0.1), 0.0, 1.2, 0.5, 1.2, "tin")
    return [body.finish(coll, parent), lock.finish(coll, parent), pins.finish(coll, parent)]


def ffc16(coll, parent):
    """PCIe 16-pin 0.5 mm FPC connector at the short edge, cable entering from the edge"""
    _n, _k, u, v, du, dv, h = comp("PCIE")
    body = Part("PI5_pcie_body")
    bx(body, u - 0.2, v, 0.0, du - 0.9, dv - 1.6, h - 0.35, "black", r=0.1, segs=1)
    cut = Part("cut", mats=body.mats)
    bx(cut, u - 1.4, v, 0.45, 2.4, 13.4, 0.35, "black")
    body.cut(cut)
    lock = Part("PI5_pcie_lock")
    bx(lock, u + du / 2 - 0.55, v, h - 0.6, 1.1, dv - 0.6, 0.6, "brown", r=0.08, segs=1)
    pins = Part("PI5_pcie_pins")
    for i in range(16):
        bx(pins, u + du / 2 - 0.1, v + (i - 7.5) * 0.5, 0.0, 0.8, 0.2, 0.12, "tin")
    for s in (-1, 1):
        bx(pins, u, v + s * (dv / 2 - 0.4), 0.0, 1.6, 0.6, 1.0, "tin")
    return [body.finish(coll, parent), lock.finish(coll, parent), pins.finish(coll, parent)]


def jst_h(coll, parent, name, n):
    """JST-SH horizontal header, mouth toward the board edge (-v)"""
    _n, _k, u, v, du, dv, h = comp(name)
    b = Part("PI5_%s" % name.lower())
    bx(b, u, v, 0.0, du, dv, h, "beige", r=0.08, segs=1)
    cut = Part("cut", mats=b.mats)
    bx(cut, u, v - 0.6, 0.6, n * 1.0 + 0.2, dv, 1.75, "beige")
    b.cut(cut)
    pins = Part("PI5_%s_pins" % name.lower())
    for i in range(n):
        bx(pins, u + (i - (n - 1) / 2), v - 0.3, 1.2, 0.3, 3.0, 0.3, "gold")
        bx(pins, u + (i - (n - 1) / 2), v + dv / 2 + 0.3, 0.0, 0.3, 0.9, 0.15, "tin")
    for s in (-1, 1):
        bx(pins, u + s * (du / 2 + 0.3), v - 1.0, 0.0, 0.6, 1.6, 1.6, "tin")
    return [b.finish(coll, parent), pins.finish(coll, parent)]


def jst_v4(coll, parent):
    """JST-SH 4-pin vertical: the fan header; the cooler's plug sits in its pocket"""
    _n, _k, u, v, du, dv, h = comp("FAN")
    b = Part("PI5_fan_header")
    bx(b, u, v, 0.0, du, dv, h, "beige", r=0.1, segs=1)
    cut = Part("cut", mats=b.mats)
    bx(cut, u, v, 0.6, 5.0, 3.1, h, "beige")
    b.cut(cut)
    pins = Part("PI5_fan_header_pins")
    for i in range(4):
        bx(pins, u + (i - 1.5), v + 0.4, 0.5, 0.3, 0.3, 2.0, "gold")
    for s in (-1, 1):
        bx(pins, u + s * (du / 2 + 0.3), v, 0.0, 0.6, 1.8, 1.4, "tin")
    return [b.finish(coll, parent), pins.finish(coll, parent)]


def gpio(coll, parent):
    _n, _k, u, v, du, dv, h = comp("GPIO")
    base = Part("PI5_gpio_base")
    bx(base, u, v, 0.0, du, dv, h, "black", r=0.15, segs=1)
    cut = Part("cut", mats=base.mats)
    for c in range(1, 20):
        uc = u - du / 2 + c * 2.54
        cut.box(P(uc, v, h), (0.45, dv + 0.4, 0.45), "black", rot=Euler((0, math.radians(45), 0)))
    base.cut(cut)
    pins = Part("PI5_gpio_pins")
    r = 0.64 / math.sqrt(2)
    prof = [(0, -3.1), (0.18, -2.95), (r, -2.6), (r, 7.95), (0.16, 8.42), (0, 8.5)]
    for c in range(20):
        for dv_ in (-1.27, 1.27):
            uc = u - 24.13 + c * 2.54
            pins.lathe(P(uc, v + dv_, 0), prof, "gold", segs=4, a0=math.pi / 4)
            pins.lathe(P(uc, v + dv_, -T), [(0, 0.02), (0.85, 0.02), (0.8, -0.12), (0.36, -0.75), (0, -0.75)], "tin", segs=12)
    return [base.finish(coll, parent), pins.finish(coll, parent)]


# ------------------------------------------------------------------ the board
def build():
    import bpy
    coll = collection("PI5")
    clear_collection(coll)
    root = empty("PI5", coll, size=20)
    made = []

    # PCB with mounting holes and the two push-pin holes; artwork from tex/pcb_pi5.png
    pcb = Part("PI5_pcb")
    pcb.prism(Vector((0, 0, TOP - T)), rrect(53.5 - 42.5, 38 - 28, 85, 56, 3.0, 6), T, "pcb_tex")
    cut = Part("cut", mats=pcb.mats)
    for (hu, hv) in HOLES:
        cut.cyl(P(hu, hv, -T / 2), 1.35, T + 1, "pcb_tex", segs=28)
    for (hu, hv) in PIN_HOLES:
        cut.cyl(P(hu, hv, -T / 2), 1.2, T + 1, "pcb_tex", segs=24)
    pcb.cut(cut)
    made.append(pcb.finish(coll, root, uv_func=lambda n, co: pcb_uv(n, 53.5 - co.x, 38.0 - co.y, co.z - TOP)))

    # SoC: green substrate, steel heat spreader with its laser marking, tiny caps round the lid
    _n, _k, u, v, du, dv, h = comp("SoC")
    soc = Part("PI5_soc")
    bx(soc, u, v, 0.0, du, dv, 0.4, "substrate", r=0.08, segs=1)
    bx(soc, u, v, 0.4, 17.0, 17.0, h - 0.4, "lid", r=0.45, segs=3, top="mark_metal", top_uv=cell_uv("soc", flip=True))
    for k in range(6):
        o = (k - 2.5) * 2.4
        for (cu, cv, rot) in ((u + o, v - 8.88, False), (u + o, v + 8.88, False), (u - 8.88, v + o, True), (u + 8.88, v + o, True)):
            ddu, ddv = (0.3, 0.6) if rot else (0.6, 0.3)
            bx(soc, cu, cv, 0.4, ddu, ddv, 0.3, "cap")
    made.append(soc.finish(coll, root))

    _n, _k, u, v, du, dv, h = comp("RAM")
    ram = Part("PI5_ram")
    bx(ram, u, v, 0.0, du, dv, h, "chip", r=0.15, segs=2, top="mark_chip", top_uv=cell_uv("ram", flip=True))
    made.append(ram.finish(coll, root))

    for (name, cell) in (("RP1", "rp1"), ("PMIC", "pmic"), ("PHY", "phy"), ("REG1", "reg"), ("REG2", "reg")):
        made.append(qfn(coll, root, name, cell))

    # SOIC-8 boot flash with gull-wing leads
    _n, _k, u, v, du, dv, h = comp("FLASH")
    fl = Part("PI5_flash")
    bx(fl, u, v, 0.1, 4.9, 3.9, 1.4, "chip", r=0.1, segs=1, top="mark_chip", top_uv=cell_uv("flash", flip=True))
    for i in range(4):
        uu = u - 1.905 + i * 1.27
        gull(fl, uu, v + 1.95, "v+", 0.42)
        gull(fl, uu, v - 1.95, "v-", 0.42)
    made.append(fl.finish(coll, root))

    # small transistors
    for name in ("Q1", "Q2", "Q3"):
        _n, _k, u, v, du, dv, h = comp(name)
        q = Part("PI5_" + name.lower())
        bx(q, u, v, 0.15, 2.9, 1.3, 0.9, "chip", r=0.08, segs=1)
        gull(q, u - 0.95, v - 0.65, "v-", 0.4, 0.75)
        gull(q, u + 0.95, v - 0.65, "v-", 0.4, 0.75)
        gull(q, u, v + 0.65, "v+", 0.4, 0.75)
        made.append(q.finish(coll, root))

    # 54 MHz crystal: ceramic base, seam-welded lid
    _n, _k, u, v, du, dv, h = comp("XTAL")
    x = Part("PI5_xtal")
    bx(x, u, v, 0.0, du, dv, 0.35, "cap", r=0.06, segs=1)
    bx(x, u, v, 0.35, du - 0.3, dv - 0.3, h - 0.35, "lid", r=0.08, segs=1, top="mark_metal", top_uv=cell_uv("xtal", flip=True))
    made.append(x.finish(coll, root))

    # wireless shield can with the stamped logo
    _n, _k, u, v, du, dv, h = comp("WIFI")
    can = Part("PI5_wifi_can")
    bx(can, u, v, 0.0, du, dv, h, "port", r=0.25, segs=2, top="mark_metal", top_uv=cell_uv("can", flip=True))
    made.append(can.finish(coll, root))

    # power inductors round the PMIC
    ind = Part("PI5_inductors")
    for name in ("L1", "L2", "L3", "L4"):
        _n, _k, u, v, du, dv, h = comp(name)
        bx(ind, u, v, 0.0, du - 0.6, dv, h, "ferrite", r=0.08, segs=1)
        for s in (-1, 1):
            bx(ind, u + s * (du / 2 - 0.25), v, 0.0, 0.5, dv + 0.04, h * 0.8, "tin")
    made.append(ind.finish(coll, root))

    # status LEDs and the power button at the short edge
    led = Part("PI5_leds")
    for name, m in (("LED_ACT", "led_g"), ("LED_PWR", "led_r")):
        _n, _k, u, v, du, dv, h = comp(name)
        bx(led, u, v, 0.0, du, dv - 0.5, 0.25, "white")
        bx(led, u, v, 0.25, du - 0.1, dv - 0.6, 0.3, m, r=0.1, segs=2)
        for s in (-1, 1):
            bx(led, u, v + s * (dv / 2 - 0.2), 0.0, du + 0.02, 0.4, 0.3, "tin")
    made.append(led.finish(coll, root))
    _n, _k, u, v, du, dv, h = comp("BTN")
    btn = Part("PI5_button")
    bx(btn, u + 0.3, v, 0.0, du - 0.6, dv, h - 0.2, "steel", r=0.1, segs=1)
    bx(btn, u - du / 2 + 0.2, v, 0.35, 1.2, 1.8, 0.9, "black", r=0.2, segs=2)
    made.append(btn.finish(coll, root))

    # connectors
    made += usb_a(coll, root, "USB3", "blue", True)
    made += usb_a(coll, root, "USB2", "black", False)
    made += rj45(coll, root)
    made += usb_c(coll, root)
    made += micro_hdmi(coll, root, "HDMI0")
    made += micro_hdmi(coll, root, "HDMI1")
    made += mipi(coll, root, "CAM0")
    made += mipi(coll, root, "CAM1")
    made += ffc16(coll, root)
    made += jst_h(coll, root, "UART", 3)
    made += jst_h(coll, root, "BAT", 2)
    made += jst_v4(coll, root)
    made += gpio(coll, root)

    # passives
    pas = Part("PI5_passives")
    for (kind, u, v, rot) in passives():
        smd(pas, kind, u, v, rot)
    made.append(pas.finish(coll, root))

    # brass hex standoffs below, pan-head Phillips screws on top
    so = Part("PI5_standoffs")
    for (hu, hv) in HOLES:
        so.prism(P(hu, hv, -T - 6.0), circle(0, 0, 2.887, 6, math.pi / 6), 6.0, "brass", bevel=0.18, bsegs=1)
    made.append(so.finish(coll, root))
    sc = Part("PI5_screws")
    head = [(0, 0), (2.15, 0), (2.2, 0.3), (2.0, 0.8), (1.5, 1.12), (0, 1.2)]
    for (hu, hv) in HOLES:
        sc.lathe(P(hu, hv, 0), head, "screw", segs=32)
    cut = Part("cut", mats=sc.mats)
    plus = [(-0.28, -1.1), (0.28, -1.1), (0.28, -0.28), (1.1, -0.28), (1.1, 0.28), (0.28, 0.28), (0.28, 1.1), (-0.28, 1.1),
            (-0.28, 0.28), (-1.1, 0.28), (-1.1, -0.28), (-0.28, -0.28)]
    for (hu, hv) in HOLES:
        cut.prism(P(hu, hv, 0.55), plus, 1.0, "screw", rot=Matrix.Rotation(math.radians(45), 4, "Z"))
    sc.cut(cut)
    made.append(sc.finish(coll, root))

    # microSD socket under the board, with a card in it
    _n, _k, u, v, du, dv, h = comp("SD")
    sd = Part("PI5_sd_socket")
    bx(sd, u + 0.4, v, -T - h, du - 0.8, dv, h - 0.02, "port", r=0.1, segs=1)
    cut = Part("cut", mats=sd.mats)
    bx(cut, u - 1.0, v, -T - h + 0.25, du, 11.2, 0.85, "port")
    sd.cut(cut)
    made.append(sd.finish(coll, root))
    card = Part("PI5_sd_card")
    card.box(P(5.0, v, -T - h + 0.32 + 0.35), (11.0, 15.0, 0.7), "sd", r=0.12, segs=1, rot=Euler((0, 0, math.pi / 2)),
             bottom="mark_chip", bottom_uv=cell_uv("sd", flip=False))
    made.append(card.finish(coll, root))

    bad = check_closed(made)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in made)
    return {"objects": len(made), "tris": tris, "open": bad}
