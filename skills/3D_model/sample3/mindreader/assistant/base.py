"""What the assistant shows, kept apart from how it is drawn."""
from dataclasses import dataclass
from typing import Protocol


@dataclass
class AssistantState:
    tools: list               # tool keys in display order
    names: dict               # tool key → name shown to the player
    probs: dict               # the AI's current belief per tool, sums to 1
    offered: str | None       # tool the assistant is holding out right now
    phase: str                # "idle" | "watching" | "handover" | "result"
    verdict: object = None    # timeline.Verdict once the trial has been judged


class AssistantView(Protocol):
    def render(self, canvas, hud, state: AssistantState) -> None:
        """Draw the assistant onto the BGR frame; queue text on the Hud."""
