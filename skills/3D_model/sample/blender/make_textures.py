"""
Draws the two textures the Blender parts use:
  tex/pcb_pi5.png  Raspberry Pi 5 board: copper under the solder mask, vias, pads, silkscreen
  tex/atlas.png    chip markings, the camera board, the fan sticker, flat colour patches

Run with any Python that has Pillow:  python make_textures.py
The artwork is illustrative (procedural traces, plausible markings); positions come from
pi5_layout.py so pads and outlines sit under the modelled parts.
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pi5_layout as L          # noqa: E402
import atlas_layout as A        # noqa: E402

OUT = os.path.join(HERE, "tex")
FONT = r"C:\Windows\Fonts\arial.ttf"
FONTB = r"C:\Windows\Fonts\arialbd.ttf"
MONO = r"C:\Windows\Fonts\consola.ttf"
SS = 2                          # supersampling

# sRGB colours
MASK = (34, 98, 60)             # solder mask over bare laminate
POUR = (46, 120, 72)            # solder mask over copper
TRACE = (58, 136, 82)           # a trace stands a little proud and catches more light
GAP = (26, 84, 50)
PAD = (206, 170, 96)            # ENIG
TIN = (196, 196, 190)
SILK = (236, 236, 228)
FR4 = (196, 186, 132)


def lcg(seed):
    s = [seed]

    def r():
        s[0] = (s[0] * 16807) % 2147483647
        return s[0] / 2147483647
    return r


class Side:
    """maps board (u, v) mm to supersampled pixels for one side of the board"""

    def __init__(self, img, oy, s, mirror_text=False):
        self.img = img
        self.d = ImageDraw.Draw(img)
        self.oy = oy * SS
        self.s = s * SS
        self.mirror_text = mirror_text

    def P(self, u, v):
        return (u * self.s, self.oy + (56.0 - v) * self.s)

    def mm(self, x):
        return x * self.s

    def rect(self, u, v, du, dv, fill=None, outline=None, width=0.0):
        x0, y0 = self.P(u - du / 2, v + dv / 2)
        x1, y1 = self.P(u + du / 2, v - dv / 2)
        self.d.rectangle((x0, y0, x1, y1), fill=fill, outline=outline, width=max(1, round(self.mm(width))) if outline else 0)

    def rrect(self, u, v, du, dv, r, fill=None, outline=None, width=0.0):
        x0, y0 = self.P(u - du / 2, v + dv / 2)
        x1, y1 = self.P(u + du / 2, v - dv / 2)
        self.d.rounded_rectangle((x0, y0, x1, y1), radius=self.mm(r), fill=fill, outline=outline,
                                 width=max(1, round(self.mm(width))) if outline else 0)

    def disc(self, u, v, r, fill):
        x, y = self.P(u, v)
        rr = self.mm(r)
        self.d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=fill)

    def ring(self, u, v, r, w, fill):
        x, y = self.P(u, v)
        rr = self.mm(r)
        self.d.ellipse((x - rr, y - rr, x + rr, y + rr), outline=fill, width=max(1, round(self.mm(w))))

    def line(self, pts, w, fill):
        xy = [self.P(u, v) for (u, v) in pts]
        W = max(1, round(self.mm(w)))
        self.d.line(xy, fill=fill, width=W, joint="curve")
        for (x, y) in (xy[0], xy[-1]):
            self.d.ellipse((x - W / 2, y - W / 2, x + W / 2, y + W / 2), fill=fill)

    def poly(self, pts, fill):
        self.d.polygon([self.P(u, v) for (u, v) in pts], fill=fill)

    def text(self, s, u, v, size, rot=0, fill=SILK, font=FONT, anchor="mm"):
        """size = cap height in mm"""
        px = max(6, round(self.mm(size) / 0.72))
        f = ImageFont.truetype(font, px)
        x0, y0, x1, y1 = f.getbbox(s)
        pad = px // 3
        im = Image.new("L", (x1 - x0 + 2 * pad, y1 - y0 + 2 * pad), 0)
        ImageDraw.Draw(im).text((pad - x0, pad - y0), s, font=f, fill=255)
        if self.mirror_text:
            im = ImageOps.mirror(im)
            rot = -rot
        if rot:
            im = im.rotate(rot, expand=True, resample=Image.BICUBIC)
        x, y = self.P(u, v)
        if anchor == "lm":
            pos = (round(x), round(y - im.height / 2))
        else:
            pos = (round(x - im.width / 2), round(y - im.height / 2))
        self.img.paste(Image.new("RGB", im.size, fill), pos, im)


def offset_polyline(pts, d):
    """polyline shifted sideways by d (left of travel), mitred at the corners"""
    out = []
    n = len(pts)
    for i in range(n):
        p = pts[i]
        dirs = []
        if i > 0:
            dirs.append((p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]))
        if i < n - 1:
            dirs.append((pts[i + 1][0] - p[0], pts[i + 1][1] - p[1]))
        norms = []
        for (dx, dy) in dirs:
            L_ = math.hypot(dx, dy) or 1
            norms.append((-dy / L_, dx / L_))
        nx = sum(a for a, _ in norms)
        ny = sum(b for _, b in norms)
        Ln = math.hypot(nx, ny) or 1
        nx, ny = nx / Ln, ny / Ln
        cosh = nx * norms[0][0] + ny * norms[0][1]
        k = d / max(cosh, 0.35)
        out.append((p[0] + nx * k, p[1] + ny * k))
    return out


def bundle(side, path, n, pitch, w=0.13, gap=0.1, pairs=False, vias_end=False, vias_start=False):
    """n parallel traces along path; pairs groups them two by two with a wider space between"""
    offs = []
    k = 0.0
    for i in range(n):
        offs.append(k)
        k += pitch * (1.0 if (not pairs or i % 2 == 0) else 1.8)
    mid = (offs[0] + offs[-1]) / 2
    lines = [offset_polyline(path, o - mid) for o in offs]
    for ln in lines:
        side.line(ln, w + 2 * gap, GAP)
    for ln in lines:
        side.line(ln, w, TRACE)
    for ln in lines:
        if vias_end:
            via(side, *ln[-1])
        if vias_start:
            via(side, *ln[0])
    return lines


def via(side, u, v, r=0.25):
    side.disc(u, v, r + 0.14, GAP)
    side.disc(u, v, r, TRACE)
    side.disc(u, v, r * 0.45, (30, 70, 44))


def trace(side, pts, w=0.15, gap=0.1):
    side.line(pts, w + 2 * gap, GAP)
    side.line(pts, w, TRACE)


# ------------------------------------------------------------------ the Pi 5 board
def raspberry(side, u, v, size, fill=SILK, outline_only=False):
    """a small stylised raspberry: drupelets and two leaves (size = overall height, mm)"""
    r = size * 0.13
    rows = [(2, 0.30), (3, 0.13), (4, -0.05), (3, -0.23), (2, -0.40)]
    for (n, dy) in rows:
        for i in range(n):
            dx = (i - (n - 1) / 2) * r * 1.95
            if outline_only:
                side.ring(u + dx, v + dy * size, r, size * 0.035, fill)
            else:
                side.disc(u + dx, v + dy * size, r, fill)
    for sgn in (-1, 1):
        lu, lv = u + sgn * size * 0.2, v + size * 0.5
        pts = [(lu + sgn * size * (0.22 * math.cos(a) * math.cos(0.5) - 0.1 * math.sin(a) * math.sin(0.5) * sgn),
                lv + size * (0.22 * math.cos(a) * math.sin(0.5) * sgn + 0.1 * math.sin(a) * math.cos(0.5)))
               for a in [TAU * k / 16 for k in range(16)]]
        side.poly(pts, fill)


TAU = math.tau


def draw_pcb():
    S = A.PCB_SIZE * SS
    img = Image.new("RGB", (S, S), MASK)
    top = Side(img, A.PCB_TOP_Y, A.PCB_S)
    bot = Side(img, A.PCB_BOT_Y, A.PCB_BOT_S, mirror_text=True)
    R = lcg(7)

    for side in (top, bot):
        # copper pour under the mask, inset from the edge
        side.rrect(42.5, 28, 85 - 1.0, 56 - 1.0, 2.6, fill=POUR)
        # islands without pour: around the high-speed bundles and the antenna corner
        for (u, v, du, dv) in ((26.5, 13.5, 4.5, 14.0), (36.5, 13.0, 5.0, 13.0), (49.0, 26.0, 18.0, 6.5)):
            side.rect(u, v, du, dv, fill=MASK)

    # ---------------- top: power islands, bundles, fan-outs, vias
    top.rrect(10.5, 12.0, 17.0, 11.0, 0.8, fill=GAP)
    top.rrect(10.5, 12.0, 16.6, 10.6, 0.7, fill=POUR)
    # HDMI 0 and 1: four differential pairs each, from under the SoC down to the ports
    bundle(top, [(26.5, 21.6), (26.5, 15.5), (26.0, 13.0), (26.0, 6.8)], 8, 0.27, pairs=True)
    bundle(top, [(34.5, 21.6), (34.5, 15.5), (38.5, 11.5), (39.5, 10.5), (39.5, 6.8)], 8, 0.27, pairs=True)
    # SoC -> RP1 PCIe link
    bundle(top, [(40.6, 30.0), (56.0, 30.0), (58.4, 28.4)], 8, 0.27, pairs=True)
    # MIPI from both camera connectors to RP1
    bundle(top, [(53.5, 15.2), (53.5, 18.0), (57.0, 21.5), (58.0, 23.4)], 10, 0.26, pairs=True)
    bundle(top, [(47.5, 15.2), (47.5, 16.6), (50.6, 19.7), (52.0, 19.7)], 10, 0.26, pairs=True, vias_end=True)
    # RP1 -> PHY, PHY -> jack, RP1 -> USB 3 and USB 2
    bundle(top, [(62.0, 23.4), (62.0, 16.6)], 8, 0.27, pairs=True)
    bundle(top, [(64.6, 13.5), (67.2, 13.5)], 8, 0.3, pairs=True)
    bundle(top, [(65.6, 27.6), (70.6, 27.6)], 6, 0.3, pairs=True)
    bundle(top, [(62.5, 30.6), (62.5, 33.5), (69.0, 40.0), (70.6, 41.6)], 6, 0.3, pairs=True)
    # SoC <-> RAM, short and dense
    bundle(top, [(19.6, 31.0), (20.8, 31.0)], 30, 0.33, w=0.11, gap=0.08)
    # GPIO: pins drop to vias, half of them run to RP1 as a bus
    for c in range(20):
        u = 32.5 - 24.13 + c * 2.54
        if 5 <= c <= 17:
            k = c - 5
            end_u = 57.4 + k * 0.32
            trace(top, [(u, 51.2), (u, 48.4 - k * 0.32), (u + 1.0, 47.4 - k * 0.32), (end_u, 47.4 - k * 0.32), (end_u, 31.2)], w=0.12, gap=0.09)
        else:
            trace(top, [(u, 51.2), (u, 48.9)], w=0.14)
            via(top, u, 48.9)
    # power: USB-C into the PMIC, PMIC out to the inductors
    for du in (-1.2, 0.0, 1.2):
        trace(top, [(11.2 + du, 5.9), (11.2 + du, 7.2)], w=0.6, gap=0.12)
    for (a, b) in (((9.0, 9.0), (5.8, 11.0)), ((9.0, 11.0), (5.8, 14.5)), ((15.0, 9.5), (16.8, 9.2)), ((15.0, 11.0), (16.8, 12.8))):
        trace(top, [a, b], w=0.55, gap=0.12)
    # SoC fan-out vias ring and stitching vias over the pours
    for k in range(64):
        a = TAU * k / 64
        uu, vv = 30 + 11.6 * math.cos(a), 31 + 11.6 * math.sin(a)
        if uu > 21:
            via(top, uu, vv, 0.2)
    taken = L.footprints()

    def free(u, v, m=0.6):
        return not any(abs(u - a) < w / 2 + m and abs(v - b) < d / 2 + m for (a, b, w, d) in taken)
    for i in range(220):
        u, v = 1.5 + R() * 82, 1.5 + R() * 53
        if free(u, v):
            via(top, u, v, 0.2)
    # short stubs from passives to vias
    passives = L.passives()
    for (kind, u, v, rot) in passives:
        Lp, Wp, _ = L.SIZES[kind]
        if R() < 0.55:
            sgn = 1 if R() < 0.5 else -1
            end = (u, v + sgn * (Lp / 2 + 0.9)) if rot else (u + sgn * (Lp / 2 + 0.9), v)
            start = (u, v + sgn * Lp * 0.35) if rot else (u + sgn * Lp * 0.35, v)
            trace(top, [start, end], w=0.18)
            via(top, *end, 0.2)

    # ---------------- top pads (exposed metal), under and around the parts
    for (kind, u, v, rot) in passives:
        Lp, Wp, _ = L.SIZES[kind]
        for sgn in (-1, 1):
            if rot:
                top.rect(u, v + sgn * Lp * 0.36, Wp * 1.15, Lp * 0.36, fill=PAD)
            else:
                top.rect(u + sgn * Lp * 0.36, v, Lp * 0.36, Wp * 1.15, fill=PAD)
    for (name, kind, u, v, du, dv, h) in L.PARTS:
        if kind == "qfn":
            n = max(3, int(du / 0.5) - 2)
            for i in range(n):
                o = (i - (n - 1) / 2) * 0.5
                for (pu, pv, a, b) in ((u - du / 2 - 0.15, v + o, 0.55, 0.24), (u + du / 2 + 0.15, v + o, 0.55, 0.24),
                                       (u + o, v - dv / 2 - 0.15, 0.24, 0.55), (u + o, v + dv / 2 + 0.15, 0.24, 0.55)):
                    top.rect(pu, pv, a, b, fill=PAD)
        elif kind == "soic8":
            for i in range(4):
                for sgn in (-1, 1):
                    top.rect(u - 1.905 + i * 1.27, v + sgn * 2.7, 0.6, 1.5, fill=PAD)
        elif kind == "sot23":
            for (pu, pv) in ((u - 0.95, v - 1.1), (u + 0.95, v - 1.1), (u, v + 1.1)):
                top.rect(pu, pv, 0.7, 0.9, fill=PAD)
        elif kind == "inductor":
            for sgn in (-1, 1):
                top.rect(u + sgn * 1.0, v, 0.9, 2.2, fill=PAD)
        elif kind in ("jst3h", "jst2h"):
            n = 3 if kind == "jst3h" else 2
            for i in range(n):
                top.rect(u + (i - (n - 1) / 2), v + 2.4, 0.6, 1.4, fill=PAD)
            for sgn in (-1, 1):
                top.rect(u + sgn * (du / 2 + 0.3), v - 1.0, 1.0, 1.8, fill=PAD)
        elif kind == "mipi":
            for i in range(11):
                top.rect(u - du / 2 - 0.5, v + (i - 5) * 1.0, 0.8, 0.3, fill=PAD)
                top.rect(u + du / 2 + 0.5, v + (i - 4.5) * 1.0, 0.8, 0.3, fill=PAD)
            for sgn in (-1, 1):
                top.rect(u, v + sgn * (dv / 2 + 0.5), 1.4, 0.9, fill=PAD)
        elif kind == "xtal":
            for (su, sv) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                top.rect(u + su * 1.1, v + sv * 0.8, 1.1, 0.9, fill=PAD)
        elif kind == "led":
            for sgn in (-1, 1):
                top.rect(u, v + sgn * 0.75, 0.9, 0.6, fill=PAD)
    # mounting holes: plated rings with a ring of vias
    for side in (top, bot):
        for (u, v) in L.HOLES:
            side.disc(u, v, 3.0, PAD)
            side.disc(u, v, 1.6, (150, 120, 70))
            for k in range(8):
                a = TAU * k / 8
                side.disc(u + 2.3 * math.cos(a), v + 2.3 * math.sin(a), 0.22, (120, 96, 56))
        for (u, v) in L.PIN_HOLES:
            side.disc(u, v, 1.8, MASK)
            side.ring(u, v, 1.8, 0.12, SILK)
    # test points on top
    for i in range(18):
        u, v = 2 + R() * 80, 2 + R() * 52
        if free(u, v, 0.9):
            top.disc(u, v, 0.5, PAD)
            top.text("TP%d" % (10 + i), u, v - 1.0, 0.45)
            taken.append((u, v, 2.0, 2.4))

    # ---------------- top silkscreen
    for (name, kind, u, v, du, dv, h) in L.PARTS:
        if kind in ("soc", "usba", "rj45", "usbc", "hdmi", "gpio", "can"):
            continue
        o = 0.35
        top.rect(u, v, du + 2 * o, dv + 2 * o, outline=SILK, width=0.12)
        if kind in ("qfn", "soic8", "ram"):
            top.disc(u - du / 2 - o - 0.35, v + dv / 2 + o + 0.35, 0.18, SILK)
    # SoC: corner marks only (the substrate covers the middle)
    for (su, sv) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        cu, cv = 30 + su * 9.8, 31 + sv * 9.8
        top.line([(cu, cv - sv * 1.4), (cu, cv), (cu - su * 1.4, cv)], 0.13, SILK)
    # GPIO pin 1 square and J8
    top.rect(32.5 - 24.13, 52.5 - 1.27, 1.9, 1.9, outline=SILK, width=0.12)
    top.text("J8", 6.0, 51.2, 0.7)
    top.text("1", 8.4, 49.4, 0.6)
    top.text("40", 56.6, 55.4, 0.5)
    for (s, u, v, size, rot) in L.LABELS:
        top.text(s, u, v, size, rot, font=FONTB if size > 1.5 else FONT)
    raspberry(top, 42.0, 40.9, 2.8)
    # reference designators for a quarter of the passives
    for idx, (kind, u, v, rot) in enumerate(passives):
        if idx % 4 == 1:
            Lp, Wp, _ = L.SIZES[kind]
            name = ("R%d" if kind.startswith("r") else "C%d") % (1000 + idx * 7 % 900)
            du = (Wp if rot else Lp) / 2 + 0.9
            if free(u + du, v, 0.1):
                top.text(name, u + du + 0.4, v, 0.42, anchor="lm")

    # ---------------- bottom: through-hole pads, test points, labels
    for c in range(20):
        for dv in (-1.27, 1.27):
            u = 32.5 - 24.13 + c * 2.54
            bot.disc(u, 52.5 + dv, 0.85, PAD)
            bot.disc(u, 52.5 + dv, 0.42, TIN)
    for (u, v) in ((70.8, 22.0), (70.8, 36.0), (70.8, 40.0), (70.8, 54.0), (68.0, 3.6), (68.0, 16.9), (86.0, 4.0), (86.0, 16.5)):
        bot.disc(u, v, 0.9, PAD)
        bot.disc(u, v, 0.55, TIN)
    for i in range(70):
        u, v = 3 + R() * 78, 3 + R() * 50
        if not (u < 16 and 21 < v < 35):
            bot.disc(u, v, 0.45, PAD)
            if i % 3 == 0:
                bot.text("TP%d" % (40 + i), u + 0.9, v, 0.45)
    for i in range(160):
        u, v = 2 + R() * 81, 2 + R() * 52
        via(bot, u, v, 0.2)
    for k in range(40):
        u0, v0 = 4 + R() * 72, 4 + R() * 46
        L1 = 2 + R() * 9
        if R() < 0.5:
            trace(bot, [(u0, v0), (u0 + L1, v0), (u0 + L1 + 1.5, v0 + 1.5)], w=0.16)
        else:
            trace(bot, [(u0, v0), (u0, v0 + L1), (u0 + 1.5, v0 + L1 + 1.5)], w=0.16)
    bot.text("Raspberry Pi 5", 44.0, 30.0, 2.0, font=FONTB)
    bot.text("Designed and distributed by Raspberry Pi Ltd", 44.0, 26.6, 0.85)
    bot.text("Cambridge, UK", 44.0, 25.0, 0.85)
    bot.text("Model B   Rev 1.0", 44.0, 23.4, 0.85)
    # serial label with a data-matrix style block
    bot.rect(44.0, 16.5, 9.0, 5.2, fill=(238, 238, 234))
    for i in range(14):
        for j in range(14):
            if (i == 0 or j == 13) or (R() < 0.45 and i < 13 and j > 0) or (i == 13 and j % 2 == 0) or (j == 0 and i % 2 == 1):
                bot.rect(40.6 + i * 0.3, 18.6 - j * 0.3, 0.3, 0.3, fill=(20, 20, 20))
    bot.text("2343 0716", 46.6, 17.4, 0.6, fill=(20, 20, 20))
    bot.text("5B 4GB", 46.6, 15.8, 0.6, fill=(20, 20, 20))

    # ---------------- board edge strip
    x0, y0, x1, y1 = [c * SS for c in A.PCB_EDGE]
    d = ImageDraw.Draw(img)
    d.rectangle((x0, y0, x1, y1), fill=FR4)
    band = (y1 - y0) * 0.09
    d.rectangle((x0, y0, x1, y0 + band), fill=MASK)
    d.rectangle((x0, y1 - band, x1, y1), fill=MASK)
    for k in (0.33, 0.66):
        yy = y0 + (y1 - y0) * k
        d.rectangle((x0, yy - 1, x1, yy + 1), fill=(176, 150, 96))

    img = img.resize((A.PCB_SIZE, A.PCB_SIZE), Image.LANCZOS)
    img.save(os.path.join(OUT, "pcb_pi5.png"), optimize=True)


# ------------------------------------------------------------------ atlas
class Cell:
    """draws into one atlas cell in millimetres of the part it belongs to (origin top-left)"""

    def __init__(self, img, name, w_mm, h_mm):
        x0, y0, x1, y1 = A.CELLS[name]
        self.img = img
        self.d = ImageDraw.Draw(img)
        self.x0, self.y0 = x0 * SS, y0 * SS
        self.sx = (x1 - x0) * SS / w_mm
        self.sy = (y1 - y0) * SS / h_mm
        self.w, self.h = w_mm, h_mm

    def P(self, x, y):
        return (self.x0 + x * self.sx, self.y0 + y * self.sy)

    def fill(self, col):
        self.d.rectangle((*self.P(0, 0), *self.P(self.w, self.h)), fill=col)

    def text(self, s, x, y, size, fill, font=FONT, anchor="mm", rot=0):
        px = max(6, round(size * self.sy / 0.72))
        f = ImageFont.truetype(font, px)
        x0, y0, x1, y1 = f.getbbox(s)
        pad = px // 3
        im = Image.new("L", (x1 - x0 + 2 * pad, y1 - y0 + 2 * pad), 0)
        ImageDraw.Draw(im).text((pad - x0, pad - y0), s, font=f, fill=255)
        if rot:
            im = im.rotate(rot, expand=True, resample=Image.BICUBIC)
        X, Y = self.P(x, y)
        pos = (round(X - im.width / 2), round(Y - im.height / 2)) if anchor == "mm" else (round(X), round(Y - im.height / 2))
        self.img.paste(Image.new("RGB", im.size, fill), pos, im)

    def disc(self, x, y, r, fill):
        X, Y = self.P(x, y)
        self.d.ellipse((X - r * self.sx, Y - r * self.sy, X + r * self.sx, Y + r * self.sy), fill=fill)

    def ring(self, x, y, r, w, fill):
        X, Y = self.P(x, y)
        self.d.ellipse((X - r * self.sx, Y - r * self.sy, X + r * self.sx, Y + r * self.sy), outline=fill, width=max(1, round(w * self.sx)))

    def rect(self, x, y, w, h, fill=None, outline=None, width=0.1):
        self.d.rectangle((*self.P(x - w / 2, y - h / 2), *self.P(x + w / 2, y + h / 2)), fill=fill, outline=outline,
                         width=max(1, round(width * self.sx)) if outline else 0)

    def line(self, pts, w, fill):
        self.d.line([self.P(x, y) for (x, y) in pts], fill=fill, width=max(1, round(w * self.sx)), joint="curve")


BLACK_TOP = (30, 30, 32)
LASER = (118, 118, 116)
METAL = (214, 212, 207)
ETCH = (132, 130, 126)


def raspberry_cell(c, x, y, size, fill):
    r = size * 0.13
    rows = [(2, -0.30), (3, -0.13), (4, 0.05), (3, 0.23), (2, 0.40)]
    for (n, dy) in rows:
        for i in range(n):
            c.disc(x + (i - (n - 1) / 2) * r * 1.95, y + dy * size, r, fill)
    for sgn in (-1, 1):
        lx, ly = x + sgn * size * 0.2, y - size * 0.5
        pts = [c.P(lx + sgn * size * (0.22 * math.cos(a) * math.cos(0.5) - 0.1 * math.sin(a) * math.sin(0.5) * sgn),
                   ly - size * (0.22 * math.cos(a) * math.sin(0.5) * sgn + 0.1 * math.sin(a) * math.cos(0.5)))
               for a in [TAU * k / 16 for k in range(16)]]
        c.d.polygon(pts, fill=fill)


def camera_board(img, name, back):
    c = Cell(img, name, 25.0, 24.0)
    c.fill(MASK)
    c.d.rounded_rectangle((*c.P(0.5, 0.5), *c.P(24.5, 23.5)), radius=0.8 * c.sx, fill=POUR)
    R = lcg(31 if back else 17)
    # traces and vias
    for k in range(30):
        x, y = 4.5 + R() * 15, 3 + R() * 17
        L_ = 1.5 + R() * 4
        pts = [(x, y), (x + L_, y), (x + L_ + 1, y + 1)] if R() < 0.5 else [(x, y), (x, y + L_), (x + 1, y + L_ + 1)]
        c.line(pts, 0.38, GAP)
        c.line(pts, 0.18, TRACE)
        c.disc(*pts[-1], 0.32, GAP)
        c.disc(*pts[-1], 0.2, TRACE)
    # mounting holes (centre y measured down from the top: 12 -/+ 6.25)
    for (hx, hy) in ((2.0, 5.75), (23.0, 5.75), (2.0, 18.25), (23.0, 18.25)):
        c.disc(hx, hy, 1.75, MASK)
        c.disc(hx, hy, 1.55, PAD)
        c.disc(hx, hy, 1.1, (150, 120, 70))
    # pads under the modelled chip capacitors
    for (x, y, rot) in (A.CAM_BACK_SMD if back else A.CAM_FRONT_SMD):
        X, Y = A.cam_img(x, y, back)
        for s in (-1, 1):
            if rot:
                c.rect(X, Y + s * 0.36, 0.62, 0.42, fill=PAD)
            else:
                c.rect(X + s * 0.36, Y, 0.42, 0.62, fill=PAD)
    if back:
        # pads under the 15-pin connector along the bottom edge, the regulators and the crystal; text
        for i in range(15):
            X, Y = A.cam_img(-7.0 + i, A.CAM_FPC_PINS_Y, back)
            c.rect(X, Y, 0.55, 1.2, fill=PAD)
        for (x, y) in A.CAM_BACK_SOT:
            X, Y = A.cam_img(x, y, back)
            for i in (-1, 0, 1):
                c.rect(X + i * 0.95, Y + 1.15, 0.6, 0.9, fill=PAD)
            for i in (-1, 1):
                c.rect(X + i * 0.95, Y - 1.15, 0.6, 0.9, fill=PAD)
        X, Y = A.cam_img(*A.CAM_XTAL, back)
        c.rect(X, Y, 2.4, 2.0, fill=PAD)
        c.text("Raspberry Pi", 12.5, 3.2, 1.0, SILK, FONTB)
        c.text("Camera Module 3 NoIR", 12.5, 4.9, 0.7, SILK)
        c.text("IMX708", 7.0, 17.7, 0.6, SILK)
        c.text("\u00a9 2022", 18.0, 17.7, 0.6, SILK)
        raspberry_cell(c, 12.5, 11.0, 3.0, SILK)
    else:
        c.text("NoIR", 20.2, 21.6, 0.9, SILK, FONTB)
        c.text("CM3", 4.8, 21.6, 0.8, SILK)
        c.rect(12.5, 12.0, 11.0, 11.0, outline=SILK, width=0.12)


def draw_atlas():
    S = A.ATLAS_SIZE * SS
    img = Image.new("RGB", (S, S), (40, 40, 42))
    camera_board(img, "cam_front", back=False)
    camera_board(img, "cam_back", back=True)

    c = Cell(img, "soc", 17, 17)
    c.fill(METAL)
    c.text("BROADCOM", 8.5, 4.6, 1.25, ETCH, FONTB)
    c.text("BCM2712C1KFSBG", 8.5, 7.6, 1.05, ETCH, MONO)
    c.text("D1  2343", 8.5, 9.8, 0.95, ETCH, MONO)
    c.text("TAIWAN  KD7J", 8.5, 12.0, 0.95, ETCH, MONO)
    c.disc(2.2, 14.8, 0.45, ETCH)

    c = Cell(img, "ram", 12, 14)
    c.fill(BLACK_TOP)
    c.text("4GB LPDDR4X", 6.0, 4.8, 0.95, LASER, FONTB)
    c.text("D8CJN", 6.0, 7.0, 0.95, LASER, MONO)
    c.text("MT53E1G32D2FW", 6.0, 9.0, 0.75, LASER, MONO)
    c.text("2338  TW", 6.0, 10.8, 0.75, LASER, MONO)
    c.disc(1.3, 1.3, 0.35, (70, 70, 70))

    c = Cell(img, "can", 11, 10.8)
    c.fill(METAL)
    raspberry_cell(c, 5.5, 5.0, 4.2, (176, 174, 170))
    c.text("CYW43455", 5.5, 9.0, 0.6, ETCH, MONO)
    for (x, y) in ((0.8, 0.8), (10.2, 0.8), (0.8, 10.0), (10.2, 10.0)):
        c.disc(x, y, 0.25, ETCH)

    c = Cell(img, "fan", 8.8, 8.8)
    c.fill((40, 40, 42))
    c.disc(4.4, 4.4, 4.38, (26, 26, 28))
    c.ring(4.4, 4.4, 4.0, 0.08, (150, 150, 150))
    c.text("Raspberry Pi", 4.4, 3.3, 0.62, (225, 225, 220), FONTB)
    c.text("DC 5V  0.10A", 4.4, 4.7, 0.5, (200, 200, 196), FONT)
    c.text("SC1148", 4.4, 5.9, 0.45, (170, 170, 166), MONO)

    for (name, w, h, lines, metal) in (
        ("rp1", 7, 7, [("RP1-C0", 1.0, FONTB), ("\u00a9 2023", 0.7, FONT), ("RPi 2347", 0.7, MONO)], False),
        ("pmic", 6, 6, [("DA9091", 0.9, FONTB), ("2341A", 0.7, MONO)], False),
        ("phy", 6, 6, [("BCM54213PE", 0.62, FONTB), ("A1KFBG", 0.6, MONO), ("2330", 0.6, MONO)], False),
        ("reg", 3, 3, [("A3Q", 0.6, MONO)], False),
        ("flash", 4.9, 3.9, [("25Q16", 0.7, FONTB), ("JVSIQ", 0.55, MONO)], False),
        ("xtal", 3.2, 2.5, [("54.000", 0.55, MONO), ("Y1", 0.45, MONO)], True),
    ):
        c = Cell(img, name, w, h)
        c.fill(METAL if metal else BLACK_TOP)
        col = ETCH if metal else LASER
        y = h / 2 - (len(lines) - 1) * 0.6
        for (s, size, font) in lines:
            c.text(s, w / 2, y, size, col, font)
            y += max(size * 1.45, 1.0)
        if not metal:
            c.disc(0.7, 0.7, min(w, h) * 0.06, (70, 70, 70))

    c = Cell(img, "sd", 11, 14)
    c.fill((24, 24, 28))
    c.rect(5.5, 4.0, 9.0, 3.2, fill=(160, 24, 30))
    c.text("microSD", 5.5, 4.0, 1.0, (240, 240, 240), FONTB)
    c.text("32GB", 3.8, 8.2, 1.3, (230, 230, 230), FONTB)
    c.text("A1", 8.8, 8.2, 1.0, (230, 230, 230), FONT)
    c.text("U1  10", 5.5, 10.8, 0.9, (200, 200, 200), FONT)

    d = ImageDraw.Draw(img)
    for (name, col) in (("plain_black", BLACK_TOP), ("plain_metal", METAL), ("plain_fr4", FR4), ("plain_green", MASK)):
        x0, y0, x1, y1 = A.CELLS[name]
        d.rectangle((x0 * SS, y0 * SS, x1 * SS, y1 * SS), fill=col)

    img = img.resize((A.ATLAS_SIZE, A.ATLAS_SIZE), Image.LANCZOS)
    img.save(os.path.join(OUT, "atlas.png"), optimize=True)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    draw_pcb()
    draw_atlas()
    for f in ("pcb_pi5.png", "atlas.png"):
        p = os.path.join(OUT, f)
        print(f, os.path.getsize(p) // 1024, "KB")
