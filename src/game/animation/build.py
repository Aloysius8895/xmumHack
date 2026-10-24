"""
Rig a static character GLB and bake every action of actions/ on it

From src/game:
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background --python animation/build.py -- xinchan
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background --python animation/build.py -- all

Folders:
    characters/<name>.py   one per model: source/output paths and where its joints are (see characters/xinchan.py)
    actions/<action>.py    one per animation, written for the standard skeleton, shared by all characters
    rig.py                 standard skeleton, skinning, export
    pose.py                pose helpers used by the actions (world axes, blending, forward/inverse kinematics)

New character: copy characters/xinchan.py, adjust BONES to the new mesh (fractions of its height), run this script.
New action: add a module in actions/ and list it in actions/__init__.py, rerun with "all".
"""
import importlib
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import rig  # noqa: E402
from pose import Pose, Rig  # noqa: E402
from actions import ACTIONS  # noqa: E402

FPS = 30


def bake(armature, action_module):
    frames = max(2, round(action_module.SECONDS * FPS))
    action = bpy.data.actions.new(action_module.NAME)
    action.use_fake_user = True
    armature.animation_data.action = action

    pose = Pose(Rig(armature))
    for frame in range(frames + 1):
        t = frame / frames
        pose.reset()
        # Loops end exactly on their first frame
        action_module.pose(pose, 0.0 if action_module.LOOP and frame == frames else t)
        pose.key(frame + 1)

    armature.animation_data.action = None
    print(f"baked '{action_module.NAME}': {frames} frames")
    return action


def build(name):
    character = importlib.import_module(f'characters.{name}')
    source = os.path.normpath(os.path.join(GAME, character.SOURCE))
    output = os.path.normpath(os.path.join(GAME, character.OUTPUT))
    print(f'--- {name}: {source} > {output}')

    mesh = rig.import_mesh(source)
    if getattr(character, 'KEEP_MAIN_BODY', False):
        rig.keep_main_body(mesh)
    rig.normalize_mesh(mesh)
    bones = rig.bone_list(character)
    armature = rig.build_armature(bones)
    rig.skin(mesh, armature, bones, character)

    bpy.context.scene.render.fps = FPS
    armature.animation_data_create()
    for action_module in ACTIONS:
        action = bake(armature, action_module)
        track = armature.animation_data.nla_tracks.new()
        track.name = action.name
        track.strips.new(action.name, 1, action)

    os.makedirs(os.path.dirname(output), exist_ok=True)
    rig.export(output)
    print(f'done: {output}')


def main():
    names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    available = sorted(f[:-3] for f in os.listdir(os.path.join(HERE, 'characters')) if f.endswith('.py') and not f.startswith('_'))
    if not names:
        raise SystemExit(f'usage: blender -b -P animation/build.py -- <character|all>, characters: {available}')
    if names == [ 'all' ]:
        names = available
    for name in names:
        build(name)


main()
