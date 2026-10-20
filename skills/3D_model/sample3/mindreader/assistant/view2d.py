"""Flat placeholder assistant: a robot head on the right that slides the chosen tool toward the player."""
import cv2
import numpy as np

from ..ui import B_CYAN, B_GREEN, B_GREY, B_RED, B_WHITE, B_YELLOW, CYAN, GREEN, RED, WHITE, YELLOW, bar, shade

CAPTIONS = {"idle": "助手待命", "watching": "助手在观察你……"}


class View2D:
    width = 360

    def render(self, canvas, hud, st):
        h, w = canvas.shape[:2]
        x0, x1, y0 = w - self.width - 20, w - 20, 80
        shade(canvas, x0, y0, x1, h - 20, 0.6)

        cards = {tool: y0 + 190 + i * 78 for i, tool in enumerate(st.tools)}
        judged = st.phase == "result" and st.verdict is not None

        # Head, with pupils turned toward the tool on offer.
        cx, cy = (x0 + x1) // 2, y0 + 85
        cv2.line(canvas, (cx, cy - 55), (cx, cy - 75), B_CYAN, 3)
        cv2.circle(canvas, (cx, cy - 80), 7, B_YELLOW if st.offered else B_CYAN, -1)
        cv2.rectangle(canvas, (cx - 75, cy - 55), (cx + 75, cy + 50), B_CYAN, 3)
        look = 0.0 if st.offered is None else float(np.clip((cards[st.offered] - cy) / 250, -1, 1))
        for ex in (cx - 32, cx + 32):
            cv2.circle(canvas, (ex, cy - 12), 15, B_WHITE, -1)
            cv2.circle(canvas, (ex - 4, int(cy - 12 + 8 * look)), 6, (40, 40, 40), -1)
        if judged and st.verdict.correct:
            cv2.ellipse(canvas, (cx, cy + 20), (26, 12), 0, 0, 180, B_GREEN, 3)
        elif judged:
            cv2.line(canvas, (cx - 24, cy + 28), (cx + 24, cy + 22), B_RED, 3)
        else:
            cv2.circle(canvas, (cx, cy + 24), 8 if st.phase == "watching" else 4, B_WHITE, 2)

        # Tool cards; the one on offer slides out toward the player.
        for tool, y in cards.items():
            offered = tool == st.offered
            dx = -70 if offered else 0
            color = B_YELLOW if offered else B_GREY
            if judged and tool == st.verdict.truth:
                color = B_GREEN
            elif judged and offered:
                color = B_RED
            cv2.rectangle(canvas, (x0 + 20 + dx, y), (x1 - 20 + dx, y + 62), color, 3 if offered else 1)
            hud.text((x0 + 36 + dx, y + 16), st.names[tool], 26, YELLOW if offered else WHITE)
            bar(canvas, x0 + 150 + dx, y + 24, 150, 16, st.probs.get(tool, 0.0), color)
            if offered:   # arm runs down the panel's right edge and pushes the card out
                arm = np.array([(cx + 75, cy + 30), (x1 - 8, cy + 30), (x1 - 8, y + 31), (x1 - 20 + dx, y + 31)])
                cv2.polylines(canvas, [arm], False, color, 4)

        if judged:
            v = st.verdict
            caption, color = ((f"递对了：{st.names[v.truth]}", GREEN) if v.correct
                              else (f"应该递 {st.names[v.truth]}", RED))
        elif st.phase == "handover" and st.offered:
            caption, color = f"递给你：{st.names[st.offered]}", YELLOW
        else:
            caption, color = CAPTIONS.get(st.phase, ""), CYAN
        hud.text(((x0 + x1) // 2, y0 + 150), caption, 24, color, anchor="ma")
