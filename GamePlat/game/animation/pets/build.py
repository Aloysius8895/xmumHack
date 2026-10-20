"""
Career pets, modelled from primitives in Blender (round chibi bodies, one trait per career)

From GamePlat/game:
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background --python animation/pets/build.py

Writes static/pets/<species>.glb (about 1 unit tall, feet at 0, facing +Z in glTF). The game scales them, makes them hop
and squash in code (skills/game/higgsfield-game-generation procedural-animation.md: slime-like props need no rig).
Colors are plain material base colors, the game swaps them for its own lit material (sources/Game/World/Characters.js).
"""
import math
import os

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.normpath(os.path.join(HERE, '..', '..', 'static', 'pets'))

# Blender axes: -Y front, Z up
WHITE = '#fff8ef'
BLACK = '#1d1721'
ORANGE = '#ff9a2e'


def hex_color(value):
    value = value.lstrip('#')
    srgb = [ int(value[i:i + 2], 16) / 255 for i in (0, 2, 4) ]
    linear = [ c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb ]
    return (*linear, 1.0)


materials = {}


def material(color):
    if color not in materials:
        mat = bpy.data.materials.new(color)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = hex_color(color)
        bsdf.inputs['Roughness'].default_value = 0.6
        mat.diffuse_color = hex_color(color)
        materials[color] = mat
    return materials[color]


def finish(obj, color, name):
    obj.name = name
    obj.data.materials.append(material(color))
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def sphere(name, color, location, scale, rotation=(0, 0, 0), segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=segments // 2, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.scale = scale
    return finish(obj, color, name)


def cone(name, color, location, radius, depth, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=radius, radius2=0, depth=depth, location=location, rotation=rotation)
    return finish(bpy.context.active_object, color, name)


def torus(name, color, location, major, minor, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=24, minor_segments=8, location=location, rotation=rotation)
    return finish(bpy.context.active_object, color, name)


def base(body, belly, head_height=0.48, eye_gap=0.13, eye_height=0.56):
    """Round body + belly + eyes + feet shared by every pet"""
    sphere('body', body, (0, 0, head_height), (0.5, 0.45, 0.48))
    sphere('belly', belly, (0, - 0.2, head_height - 0.1), (0.32, 0.28, 0.3))
    for side in (- 1, 1):
        sphere('eye', BLACK, (side * eye_gap, - 0.4, eye_height), (0.075, 0.05, 0.095))
        sphere('eyeShine', WHITE, (side * eye_gap + 0.022, - 0.44, eye_height + 0.035), (0.025, 0.015, 0.025), segments=12)
        sphere('foot', belly, (side * 0.18, - 0.08, 0.05), (0.13, 0.16, 0.07))
        sphere('cheek', '#ff9aa8', (side * (eye_gap + 0.11), - 0.36, eye_height - 0.1), (0.06, 0.02, 0.035), segments=12)


def owl():
    color = '#2bb3a3'
    base(color, '#c9f2ea')
    cone('beak', ORANGE, (0, - 0.47, 0.47), 0.05, 0.1, rotation=(math.radians(90), 0, 0))
    for side in (- 1, 1):
        cone('tuft', color, (side * 0.26, 0.0, 0.92), 0.09, 0.22, rotation=(0, math.radians(side * 25), 0))
        sphere('wing', '#1f8a7e', (side * 0.45, 0.04, 0.42), (0.07, 0.16, 0.2))
        # Data analyst glasses
        torus('glasses', BLACK, (side * 0.13, - 0.45, 0.56), 0.1, 0.014, rotation=(math.radians(90), 0, 0))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.012, depth=0.07, location=(0, - 0.46, 0.57), rotation=(0, math.radians(90), 0))
    finish(bpy.context.active_object, BLACK, 'bridge')


def fox():
    color = '#ff8a3d'
    base(color, WHITE)
    sphere('snout', WHITE, (0, - 0.43, 0.43), (0.13, 0.12, 0.09))
    sphere('nose', BLACK, (0, - 0.55, 0.45), (0.035, 0.03, 0.03), segments=12)
    for side in (- 1, 1):
        cone('ear', color, (side * 0.24, - 0.02, 0.9), 0.12, 0.28, rotation=(0, math.radians(side * 18), 0))
        cone('earInner', WHITE, (side * 0.24, - 0.07, 0.88), 0.06, 0.18, rotation=(0, math.radians(side * 18), 0))
    sphere('tail', color, (0.12, 0.5, 0.42), (0.17, 0.32, 0.17), rotation=(math.radians(-35), 0, math.radians(20)))
    sphere('tailTip', WHITE, (0.2, 0.72, 0.58), (0.1, 0.12, 0.1))


def turtle():
    color = '#9bd17a'
    sphere('body', color, (0, 0, 0.42), (0.45, 0.42, 0.42))
    sphere('belly', '#f2e6b5', (0, - 0.2, 0.36), (0.3, 0.26, 0.28))
    for side in (- 1, 1):
        sphere('eye', BLACK, (side * 0.13, - 0.38, 0.52), (0.075, 0.05, 0.095))
        sphere('eyeShine', WHITE, (side * 0.13 + 0.022, - 0.42, 0.555), (0.025, 0.015, 0.025), segments=12)
        sphere('cheek', '#ff9aa8', (side * 0.24, - 0.34, 0.42), (0.06, 0.02, 0.035), segments=12)
        for front in (- 1, 1):
            sphere('leg', color, (side * 0.26, front * 0.2, 0.07), (0.1, 0.11, 0.08))
    # Server shell with a status light strip
    sphere('shell', '#4f6b45', (0, 0.18, 0.55), (0.48, 0.42, 0.38))
    torus('shellRim', '#3a5034', (0, 0.18, 0.48), 0.43, 0.035)
    for index in range(3):
        sphere('led', '#7dffb0', (- 0.12 + index * 0.12, 0.3, 0.9), (0.035, 0.035, 0.02), segments=12)


def bunny():
    color = '#ff6fa8'
    base(color, '#ffe0ec')
    for side in (- 1, 1):
        sphere('ear', color, (side * 0.16, 0.02, 1.02), (0.08, 0.06, 0.28), rotation=(0, math.radians(side * 10), 0))
        sphere('earInner', '#ffe0ec', (side * 0.16, - 0.035, 1.0), (0.045, 0.03, 0.2), rotation=(0, math.radians(side * 10), 0))
    sphere('tail', WHITE, (0, 0.46, 0.3), (0.11, 0.11, 0.11))
    sphere('nose', '#d63b7a', (0, - 0.45, 0.48), (0.03, 0.02, 0.025), segments=12)
    # Designer beret
    sphere('beret', '#3d2b5c', (0.06, 0.02, 0.93), (0.24, 0.24, 0.07), rotation=(0, math.radians(-12), 0))


def axolotl():
    color = '#b49cff'
    base(color, '#e6ddff')
    for side in (- 1, 1):
        for index, angle in enumerate((20, 0, - 20)):
            sphere('gill', '#ff7ab8', (side * (0.47 + index * 0.02), 0.02, 0.66 + angle * 0.006), (0.16, 0.035, 0.04), rotation=(0, math.radians(side * angle), 0))
    sphere('tail', color, (0, 0.5, 0.25), (0.06, 0.3, 0.14), rotation=(math.radians(-15), 0, 0))
    # Little neural antenna
    bpy.ops.mesh.primitive_cylinder_add(radius=0.015, depth=0.2, location=(0, 0, 1.0))
    finish(bpy.context.active_object, BLACK, 'antenna')
    sphere('antennaTip', '#7dffb0', (0, 0, 1.11), (0.05, 0.05, 0.05), segments=12)


def penguin():
    color = '#2f5fd0'
    base(color, WHITE)
    cone('beak', ORANGE, (0, - 0.47, 0.48), 0.05, 0.1, rotation=(math.radians(90), 0, 0))
    for side in (- 1, 1):
        sphere('flipper', '#244aa3', (side * 0.48, 0.0, 0.42), (0.06, 0.14, 0.24), rotation=(0, math.radians(side * -20), 0))
    # Product manager compass badge
    torus('compass', '#ffd23f', (0.2, - 0.38, 0.34), 0.05, 0.014, rotation=(math.radians(90), 0, 0))
    cone('needle', '#ff5a5a', (0.2, - 0.4, 0.36), 0.015, 0.06)


SPECIES = { 'owl': owl, 'fox': fox, 'turtle': turtle, 'bunny': bunny, 'axolotl': axolotl, 'penguin': penguin }


def build(name, function):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials.clear()
    function()

    # Normalize: 1 unit tall, feet at 0
    objects = [ o for o in bpy.data.objects if o.type == 'MESH' ]
    bpy.context.view_layer.update()
    points = [ o.matrix_world @ Vector(corner) for o in objects for corner in o.bound_box ]
    low = min(p.z for p in points)
    high = max(p.z for p in points)
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for obj in objects:
        obj.parent = root
    root.scale = [ 1 / (high - low) ] * 3
    root.location.z = - low / (high - low)

    os.makedirs(OUTPUT, exist_ok=True)
    path = os.path.join(OUTPUT, f'{name}.glb')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_apply=True)
    print(f'pet: {path}')


for species, builder in SPECIES.items():
    build(species, builder)
