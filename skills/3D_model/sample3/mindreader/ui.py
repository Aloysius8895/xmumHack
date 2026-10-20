"""Drawing helpers for the debug window. OpenCV cannot draw Chinese, so text goes
through Pillow in one pass per frame. Text colours are RGB; OpenCV colours are BGR."""
import sys
import threading
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Text colours (RGB, for Hud.text)
WHITE, GREY, YELLOW = (255, 255, 255), (170, 170, 170), (255, 214, 64)
GREEN, RED, CYAN = (90, 220, 120), (255, 96, 96), (90, 200, 255)

# Shape colours (BGR, for cv2)
B_WHITE, B_GREY, B_YELLOW = (255, 255, 255), (110, 110, 110), (64, 214, 255)
B_GREEN, B_RED, B_CYAN = (120, 220, 90), (96, 96, 255), (255, 200, 90)

_FONT_FILES = ["C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/simhei.ttf", "C:/Windows/Fonts/simsun.ttc"]
HAND_BONES = [(0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8), (5, 9), (9, 10), (10, 11),
              (11, 12), (9, 13), (13, 14), (14, 15), (15, 16), (13, 17), (0, 17), (17, 18), (18, 19), (19, 20)]


class Hud:
    """Collects text during a frame and draws it all at once with Pillow."""

    def __init__(self):
        self._file = next((f for f in _FONT_FILES if Path(f).exists()), None)
        self._fonts = {}
        self._items = []

    def _font(self, size):
        if size not in self._fonts:
            self._fonts[size] = (ImageFont.truetype(self._file, size) if self._file
                                 else ImageFont.load_default(size))
        return self._fonts[size]

    def text(self, xy, s, size=24, color=WHITE, anchor="la"):
        self._items.append((tuple(int(v) for v in xy), str(s), size, color, anchor))

    def lines(self, xy, lines, size=24, color=WHITE, gap=1.5, anchor="la"):
        x, y = xy
        for line in lines:
            self.text((x, y), line, size, color, anchor)
            y += int(size * gap)

    def flush(self, canvas):
        if not self._items:
            return
        img = Image.fromarray(cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(img)
        for xy, s, size, color, anchor in self._items:
            draw.text(xy, s, font=self._font(size), fill=color, anchor=anchor,
                      stroke_width=max(1, size // 12), stroke_fill=(0, 0, 0))
        canvas[:] = cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2BGR)
        self._items.clear()


def shade(canvas, x0, y0, x1, y1, alpha=0.55):
    """Darken a rectangle so text on top stays readable."""
    h, w = canvas.shape[:2]
    x0, y0, x1, y1 = max(0, int(x0)), max(0, int(y0)), min(w, int(x1)), min(h, int(y1))
    if x1 > x0 and y1 > y0:
        canvas[y0:y1, x0:x1] = (canvas[y0:y1, x0:x1] * (1 - alpha)).astype(np.uint8)


def bar(canvas, x, y, w, h, frac, color):
    cv2.rectangle(canvas, (int(x), int(y)), (int(x + w), int(y + h)), B_GREY, 1)
    fill = int(w * float(np.clip(frac, 0, 1)))
    if fill > 0:
        cv2.rectangle(canvas, (int(x), int(y)), (int(x + fill), int(y + h)), color, -1)


def draw_hand(canvas, hand, color=B_CYAN):
    pts = hand.px.astype(int)
    for a, b in HAND_BONES:
        cv2.line(canvas, tuple(pts[a]), tuple(pts[b]), color, 2, cv2.LINE_AA)
    for p in pts:
        cv2.circle(canvas, tuple(p), 3, B_WHITE, -1, cv2.LINE_AA)


def draw_face(canvas, face):
    from .features import L_IRIS, LIP_LO, LIP_UP, R_IRIS
    for i in (R_IRIS, L_IRIS):
        cv2.circle(canvas, tuple(face.px[i].astype(int)), 4, B_GREEN, -1, cv2.LINE_AA)
    cv2.line(canvas, tuple(face.px[LIP_UP].astype(int)), tuple(face.px[LIP_LO].astype(int)), B_RED, 2)


def beep(freq=880, ms=90):
    """Non-blocking beep on Windows; silent elsewhere."""
    if sys.platform == "win32":
        import winsound
        threading.Thread(target=winsound.Beep, args=(freq, ms), daemon=True).start()
