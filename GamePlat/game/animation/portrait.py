"""
Head portraits for the maps (minimap and M map markers), framed from the head bone of each character config

From GamePlat/game:
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background --python animation/portrait.py -- npcBoy1
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background --python animation/portrait.py -- all

Writes static/ui/avatars/<name>.png (256 px, transparent background)
"""
import importlib
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import rig  # noqa: E402

SIZE = 256


def portrait(name):
    character = importlib.import_module(f'characters.{name}')
    source = os.path.normpath(os.path.join(GAME, character.SOURCE))
    output = os.path.normpath(os.path.join(GAME, 'static', 'ui', 'avatars', f'{name}.png'))

    mesh = rig.import_mesh(source)
    if getattr(character, 'KEEP_MAIN_BODY', False):
        rig.keep_main_body(mesh)
    rig.normalize_mesh(mesh)

    # Frame the head bone: from the neck to the top of the head, a bit wider for the ears and hair
    head, tail, _ = character.BONES['head']
    bottom = head[2]
    center = Vector((0, 0, (bottom + 1.0) * 0.5 - 0.01))
    scale = (1.0 - bottom) * 1.45

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'TEXTURE'
    scene.display.shading.show_specular_highlight = True
    scene.render.film_transparent = True
    scene.render.resolution_x = SIZE
    scene.render.resolution_y = SIZE
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'

    camera_data = bpy.data.cameras.new('Portrait')
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = scale
    camera = bpy.data.objects.new('Portrait', camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    # Slight three-quarter from the front (front is -Y)
    angle = math.radians(18)
    camera.location = center + Vector((math.sin(angle), - math.cos(angle), 0.08)) * 3
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()

    os.makedirs(os.path.dirname(output), exist_ok=True)
    scene.render.filepath = output
    bpy.ops.render.render(write_still=True)
    print(f'portrait: {output}')


def main():
    names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    available = sorted(f[:-3] for f in os.listdir(os.path.join(HERE, 'characters')) if f.endswith('.py') and not f.startswith('_'))
    if names == [ 'all' ]:
        names = available
    if not names:
        raise SystemExit(f'usage: blender -b -P animation/portrait.py -- <character|all>, characters: {available}')
    for name in names:
        portrait(name)


main()
