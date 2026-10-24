"""
Action library, build.py bakes every action on every character

One module per action:
    NAME        clip name in the GLB (the game picks clips by name, see sources/Game/World/VisualCharacter.js)
    SECONDS     duration
    LOOP        loops seamlessly (the last frame equals the first)
    pose(p, t)  builds the pose at progress t (0..1) on p, a pose.Pose

Add a module and list it below to give the action to every character.
"""
from actions import idle, walk, run, jump, crouch, crouch_walk, fall, knockdown, get_up

ACTIONS = [idle, walk, run, jump, crouch, crouch_walk, fall, knockdown, get_up]
