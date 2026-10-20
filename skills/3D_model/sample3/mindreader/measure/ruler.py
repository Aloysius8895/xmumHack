"""ArUco marker: a printed square of known size, used to calibrate the depth-based sizes."""
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

DICTIONARY = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)


class Ruler:
    def __init__(self, H, corners):
        self.H = H                # image pixels → millimetres on the marker plane
        self.corners = corners    # (4, 2) marker corners in image pixels

    def to_mm(self, pts):
        pts = np.asarray(pts, dtype=np.float32).reshape(-1, 1, 2)
        return cv2.perspectiveTransform(pts, self.H).reshape(-1, 2)


class MarkerRuler:
    def __init__(self, size_mm, mirrored=True):
        self.size_mm = size_mm
        self.mirrored = mirrored  # mirrored frames show a mirrored code, which ArUco cannot read
        params = cv2.aruco.DetectorParameters()
        params.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_SUBPIX   # whole-pixel corners cost ~1 %
        self.detector = cv2.aruco.ArucoDetector(DICTIONARY, params)

    def find(self, frame):
        """Ruler for the biggest marker in view, or None."""
        img = cv2.flip(frame, 1) if self.mirrored else frame
        corners, ids, _ = self.detector.detectMarkers(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
        if ids is None or len(corners) == 0:
            return None
        c = max(corners, key=lambda q: cv2.contourArea(q.reshape(-1, 2))).reshape(4, 2).astype(np.float32)
        if self.mirrored:
            c[:, 0] = frame.shape[1] - 1 - c[:, 0]
        s = self.size_mm
        square = np.array([[0, 0], [s, 0], [s, s], [0, s]], dtype=np.float32)
        return Ruler(cv2.getPerspectiveTransform(c, square), c)


def write_marker(path, size_mm=50.0, dpi=300):
    """A printable marker PNG; printed at 100 % scale its black square is size_mm wide."""
    side = round(size_mm / 25.4 * dpi)
    margin = round(10 / 25.4 * dpi)
    marker = cv2.aruco.generateImageMarker(DICTIONARY, 0, side)
    page = Image.new("L", (side + 2 * margin, side + 4 * margin), 255)
    page.paste(Image.fromarray(marker), (margin, margin))
    font_px = round(3.0 / 25.4 * dpi)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", font_px)
    except OSError:
        font = ImageFont.load_default()
    draw = ImageDraw.Draw(page)
    for i, line in enumerate([f"ArUco 4x4_50 · id 0 · 黑色方块边长 {size_mm:g} mm", "用「实际大小 / 100%」打印"]):
        draw.text((margin, side + margin + margin // 3 + i * round(font_px * 1.5)), line, fill=0, font=font)
    page.save(path, dpi=(dpi, dpi))
    return path
