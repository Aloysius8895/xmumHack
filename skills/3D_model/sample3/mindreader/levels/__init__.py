from .handover import Handover
from .reach import Reach
from .rps import RockPaperScissors

LEVELS = {"rps": RockPaperScissors, "reach": Reach, "handover": Handover}
ORDER = ["rps", "reach", "handover"]
