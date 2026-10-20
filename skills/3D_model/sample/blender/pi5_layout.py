"""
Raspberry Pi 5 layout shared by the Blender model (build_pi5.py) and the PCB artwork
(make_textures.py), so the silkscreen, pads and parts line up.

Board coordinates (mm): u from the short edge next to the USB-C port (0 .. 85), v from the
long edge with the HDMI ports (0 .. 56), h up from the top of the board. The positions match
the web page (machine/night-canvas-device.html), which took them from the Raspberry Pi 5
mechanical drawing; the small parts and their arrangement are illustrative.
"""

BOARD = {"w": 85.0, "d": 56.0, "t": 1.6, "r": 3.0}
HOLES = [(3.5, 3.5), (61.5, 3.5), (3.5, 52.5), (61.5, 52.5)]       # M2.5, 2.7 mm
PIN_HOLES = [(6.5, 19.0), (6.5, 46.0)]                              # Active Cooler push pins

# name, kind, u, v (centre), du, dv (footprint), h (height above the board)
PARTS = [
    ("SoC", "soc", 30.0, 31.0, 18.5, 18.5, 1.3),
    ("RAM", "ram", 13.5, 31.0, 12.0, 14.0, 1.0),
    ("RP1", "qfn", 62.0, 27.0, 7.0, 7.0, 0.9),
    ("PMIC", "qfn", 12.0, 10.0, 6.0, 6.0, 0.9),
    ("PHY", "qfn", 61.5, 13.5, 6.0, 6.0, 0.85),
    ("REG1", "qfn", 56.0, 36.0, 3.0, 3.0, 0.8),
    ("REG2", "qfn", 66.0, 40.0, 3.0, 3.0, 0.8),
    ("FLASH", "soic8", 46.0, 22.0, 4.9, 6.0, 1.5),
    ("XTAL", "xtal", 44.0, 33.0, 3.2, 2.5, 0.8),
    ("WIFI", "can", 13.0, 44.5, 11.0, 10.8, 1.5),
    ("USBC", "usbc", 11.2, 2.175, 8.94, 7.35, 3.26),
    ("HDMI0", "hdmi", 26.0, 2.8, 7.5, 7.6, 3.5),
    ("HDMI1", "hdmi", 39.5, 2.8, 7.5, 7.6, 3.5),
    ("CAM1", "mipi", 47.5, 8.5, 3.6, 13.0, 2.8),
    ("CAM0", "mipi", 53.5, 8.5, 3.6, 13.0, 2.8),
    ("PCIE", "ffc16", 1.8, 28.0, 3.4, 17.0, 1.5),
    ("FAN", "jst4v", 67.0, 51.5, 6.0, 4.0, 3.0),
    ("UART", "jst3h", 32.75, 2.6, 5.0, 4.25, 2.95),
    ("BAT", "jst2h", 18.95, 2.6, 4.0, 4.25, 2.95),
    ("BTN", "button", 1.4, 41.0, 2.6, 4.0, 1.8),
    ("ETH", "rj45", 77.5, 10.25, 21.0, 16.0, 13.5),
    ("USB3", "usba", 79.25, 29.0, 17.5, 13.1, 15.6),
    ("USB2", "usba", 79.25, 47.0, 17.5, 13.1, 15.6),
    ("GPIO", "gpio", 32.5, 52.5, 50.8, 5.08, 2.5),
    ("LED_ACT", "led", 1.6, 45.2, 0.8, 1.6, 0.55),
    ("LED_PWR", "led", 1.6, 47.0, 0.8, 1.6, 0.55),
    ("L1", "inductor", 4.6, 11.0, 2.5, 2.0, 1.0),
    ("L2", "inductor", 4.6, 14.5, 2.5, 2.0, 1.0),
    ("L3", "inductor", 18.0, 9.2, 2.5, 2.0, 1.0),
    ("L4", "inductor", 18.0, 12.8, 2.5, 2.0, 1.0),
    ("Q1", "sot23", 50.5, 27.0, 2.9, 2.4, 1.0),
    ("Q2", "sot23", 69.0, 22.0, 2.9, 2.4, 1.0),
    ("Q3", "sot23", 8.5, 21.0, 2.9, 2.4, 1.0),
]
# the microSD socket hangs under the board at the short edge; the card sticks out 2.5 mm
UNDER = [("SD", "sdslot", 7.5, 28.0, 14.5, 11.5, 1.3)]

# silkscreen labels: text, u, v, size (mm), rotation (deg)
LABELS = [
    ("Raspberry Pi 5", 50.6, 41.2, 1.6, 0),
    ("© 2023 Raspberry Pi Ltd", 50.6, 38.9, 0.75, 0),
    ("HDMI0", 26.0, 7.6, 0.8, 0),
    ("HDMI1", 39.5, 7.6, 0.8, 0),
    ("UART", 32.75, 5.6, 0.7, 0),
    ("BAT", 18.95, 5.6, 0.7, 0),
    ("CAM/DISP 1", 47.5, 16.6, 0.7, 0),
    ("CAM/DISP 0", 53.5, 16.0, 0.7, 90),
    ("PCIe", 5.0, 36.0, 0.8, 90),
    ("FAN", 67.0, 48.2, 0.7, 0),
    ("ACT", 3.2, 45.2, 0.55, 0),
    ("PWR", 3.2, 47.0, 0.55, 0),
    ("J7", 3.7, 41.0, 0.6, 0),
    ("BCM2712", 30.0, 19.7, 0.7, 0),
    ("RP1", 62.0, 22.4, 0.7, 0),
    ("U5", 7.4, 10.0, 0.6, 90),
    ("U7", 61.5, 9.8, 0.6, 0),
]

KEEPOUT_MARGIN = 0.45


def lcg(seed):
    s = seed

    def r():
        nonlocal s
        s = (s * 16807) % 2147483647
        return s / 2147483647
    return r


def footprints():
    """(u, v, du, dv) rectangles that passives must stay clear of"""
    rects = [(u, v, du, dv) for (_n, _k, u, v, du, dv, _h) in PARTS]
    rects += [(u, v, 6.4, 6.4) for (u, v) in HOLES]
    rects += [(u, v, 5.4, 5.4) for (u, v) in PIN_HOLES]
    rects += [(77.0, 28.0, 22.0, 56.0)]            # under the USB / Ethernet stack
    rects += [(32.5, 52.5, 52.0, 7.0)]             # GPIO row and its pins
    rects += [(lab[1], lab[2], len(lab[0]) * lab[3] * 0.62 + 0.6, lab[3] + 0.6) for lab in LABELS if lab[4] == 0]
    rects += [(lab[1], lab[2], lab[3] + 0.6, len(lab[0]) * lab[3] * 0.62 + 0.6) for lab in LABELS if lab[4] == 90]
    return rects


def passives():
    """
    Deterministic small parts: (kind, u, v, rot) with kind in
    c0402, r0402, c0603, c0805. rot True means the long side runs along v.
    """
    SIZES = {"c0402": (1.0, 0.5), "r0402": (1.0, 0.5), "c0603": (1.6, 0.8), "c0805": (2.0, 1.25)}
    taken = list(footprints())
    out = []

    def free(u, v, du, dv, m=KEEPOUT_MARGIN):
        if u - du / 2 < 1.0 or u + du / 2 > 84.0 or v - dv / 2 < 1.0 or v + dv / 2 > 55.0:
            return False
        return not any(abs(u - a) < (w + du) / 2 + m and abs(v - b) < (d + dv) / 2 + m for (a, b, w, d) in taken)

    # decoupling around the SoC on three sides (the RAM sits on the fourth)
    for k in range(-4, 5):
        for (u, v, rot) in ((30 + k * 1.9, 31 - 10.15, False), (30 + k * 1.9, 31 + 10.15, False), (30 + 10.15, 31 + k * 1.9, True)):
            out.append(("c0402", u, v, rot))
            du, dv = (0.5, 1.0) if rot else (1.0, 0.5)
            taken.append((u, v, du, dv))
    # bulk caps next to the PMIC and the inductors
    for (u, v) in ((8.0, 17.6), (10.2, 17.6), (12.4, 17.6), (14.6, 17.6), (16.4, 6.6)):
        out.append(("c0805", u, v, False))
        taken.append((u, v, 2.0, 1.25))
    R = lcg(11)
    kinds = ["c0402"] * 11 + ["r0402"] * 5 + ["c0603"] * 3 + ["c0805"]
    n = 0
    for _ in range(6000):
        if n >= 150:
            break
        u, v = 1.5 + R() * 82, 1.5 + R() * 53
        kind = kinds[int(R() * len(kinds))]
        rot = R() < 0.5
        L, W = SIZES[kind]
        du, dv = (W, L) if rot else (L, W)
        if not free(u, v, du, dv):
            continue
        out.append((kind, u, v, rot))
        taken.append((u, v, du, dv))
        n += 1
    return out


SIZES = {"c0402": (1.0, 0.5, 0.5), "r0402": (1.0, 0.5, 0.35), "c0603": (1.6, 0.8, 0.8), "c0805": (2.0, 1.25, 1.0)}
