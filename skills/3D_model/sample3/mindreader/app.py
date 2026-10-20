"""Window loop shared by the levels and the measurement screen."""
import cv2

from .camera import Camera
from .perception import Observation, Perception
from .ui import Hud

WINDOW = "Mind Reader"


def run(screens, cam_cfg):
    """Show each screen in turn until it is done. ESC or closing the window quits.

    screens holds zero-argument factories, so each screen loads its models only
    when it starts. Returns the screens that were shown."""
    cam = Camera(cam_cfg).start()
    perception = None
    hud = Hud()
    cv2.namedWindow(WINDOW, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WINDOW, cam_cfg.width, cam_cfg.height)
    shown = []
    try:
        for make in screens:
            screen = make()
            shown.append(screen)
            cv2.setMouseCallback(WINDOW, lambda e, x, y, flags, param, s=screen: s.on_mouse(e, x, y))
            needs_landmarks = getattr(screen, "uses_perception", True)
            if needs_landmarks and perception is None:
                perception = Perception()
            last_seq, drawn, ts = -1, False, 0
            while not screen.done:
                frame, ts, seq = cam.read()
                if frame is not None and seq != last_seq:
                    last_seq = seq
                    obs = perception.process(frame, ts) if needs_landmarks else Observation(ts=ts, frame=frame)
                    screen.update(obs)
                    canvas = frame.copy()
                    screen.draw(canvas, hud, obs)
                    hud.flush(canvas)
                    cv2.imshow(WINDOW, canvas)
                    drawn = True
                key = cv2.waitKey(1) & 0xFF
                if key == 27 or (drawn and cv2.getWindowProperty(WINDOW, cv2.WND_PROP_VISIBLE) < 1):
                    return shown
                if key != 255:
                    screen.on_key(key, ts)
        return shown
    finally:
        cam.stop()
        if perception is not None:
            perception.close()
        cv2.destroyAllWindows()
