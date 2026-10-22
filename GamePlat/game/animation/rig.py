"""
Standard skeleton, skinning and export, shared by every character (see characters/)

Procedural branch of skills/game/higgsfield-game-generation (references/procedural-animation.md):
skeleton from height fractions > distance based skin weights (no bone heat, it fails headless) > NLA export > OPAQUE patch
"""
import json
import struct

import bmesh
import bpy
from mathutils import Matrix, Vector, kdtree

# Every character has these bones (left side mirrored from .R), so every action in actions/ fits every character
PARENTS = {
    'hips': None,
    'spine': 'hips',
    'chest': 'spine',
    'head': 'chest',
    'thigh.R': 'hips',
    'shin.R': 'thigh.R',
    'foot.R': 'shin.R',
    'upperArm.R': 'chest',
    'forearm.R': 'upperArm.R',
    'hand.R': 'forearm.R',
}

LEG_BONES = ('thigh', 'shin', 'foot')


def bone_list(character):
    """[(name, head, tail, parent, radius)] with the left side mirrored"""
    missing = set(PARENTS) - set(character.BONES)
    if missing:
        raise SystemExit(f'character BONES is missing {sorted(missing)}')

    bones = []
    for name, parent in PARENTS.items():
        head, tail, radius = character.BONES[name]
        bones.append((name, Vector(head), Vector(tail), parent, radius))
        if name.endswith('.R'):
            flip = lambda p: Vector((- p[0], p[1], p[2]))
            left_parent = parent[:-2] + '.L' if parent.endswith('.R') else parent
            bones.append((name[:-2] + '.L', flip(head), flip(tail), left_parent, radius))
    return bones


def import_mesh(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes:
        raise SystemExit(f'no mesh in {path}')

    # Several meshes are joined, the rig and the weights work on one mesh
    bpy.ops.object.select_all(action='DESELECT')
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    mesh = bpy.context.view_layer.objects.active
    mesh.name = 'Character'
    mesh.parent = None
    return mesh


def keep_main_body(mesh):
    """
    Delete the props modelled next to the character (a pet beside it...): the loose parts are found on welded
    positions, the biggest one is the body, each small part (eyes, buttons...) follows the big part it touches
    """
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bm.verts.ensure_lookup_table()

    # Union find over the vertices: shared edges and identical positions (the importer splits on UV seams)
    parent = list(range(len(bm.verts)))

    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(a, b):
        a, b = find(a), find(b)
        if a != b:
            parent[b] = a

    for edge in bm.edges:
        union(edge.verts[0].index, edge.verts[1].index)
    seen = {}
    for vertex in bm.verts:
        key = (round(vertex.co.x, 5), round(vertex.co.y, 5), round(vertex.co.z, 5))
        if key in seen:
            union(seen[key], vertex.index)
        else:
            seen[key] = vertex.index

    parts = {}
    for vertex in bm.verts:
        parts.setdefault(find(vertex.index), []).append(vertex)
    if len(parts) < 2:
        bm.free()
        return

    sizes = sorted(parts.items(), key=lambda item: - len(item[1]))
    body = sizes[0][0]
    big = [ root for root, vertices in sizes if len(vertices) > 0.05 * len(bm.verts) ]
    trees = {}
    for root in big:
        tree = kdtree.KDTree(len(parts[root]))
        for index, vertex in enumerate(parts[root]):
            tree.insert(vertex.co, index)
        tree.balance()
        trees[root] = tree

    removed = []
    for root, vertices in parts.items():
        if root == body:
            continue
        owner = root if root in big else min(big, key=lambda other: min(trees[other].find(vertex.co)[2] for vertex in vertices))
        if owner != body:
            removed.extend(vertices)

    bmesh.ops.delete(bm, geom=removed, context='VERTS')
    bm.to_mesh(mesh.data)
    bm.free()
    mesh.data.update()
    print(f'kept the main body: {len(removed)} vertices of props removed')


def normalize_mesh(mesh):
    """Apply transforms, scale to 1 m tall, feet centered on the origin"""
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    vertices = mesh.data.vertices
    low = Vector((min(v.co.x for v in vertices), min(v.co.y for v in vertices), min(v.co.z for v in vertices)))
    high = Vector((max(v.co.x for v in vertices), max(v.co.y for v in vertices), max(v.co.z for v in vertices)))
    height = high.z - low.z
    offset = Vector(((low.x + high.x) * 0.5, (low.y + high.y) * 0.5, low.z))

    mesh.data.transform(Matrix.Scale(1 / height, 4) @ Matrix.Translation(- offset))
    mesh.data.update()
    print(f'normalized: height {height:.4f} > 1')


def build_armature(bones):
    data = bpy.data.armatures.new('Rig')
    armature = bpy.data.objects.new('Rig', data)
    bpy.context.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='EDIT')

    edit_bones = {}
    for name, head, tail, parent, _ in bones:
        bone = data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.align_roll(Vector((0, - 1, 0)))
        if parent:
            bone.parent = edit_bones[parent]
            bone.use_connect = False
        edit_bones[name] = bone

    bpy.ops.object.mode_set(mode='OBJECT')
    print(f'skeleton: {len(bones)} bones')
    return armature


def segment_distance(p, a, b):
    ab = b - a
    length2 = ab.length_squared
    t = 0.0 if length2 < 1e-12 else max(0.0, min(1.0, (p - a).dot(ab) / length2))
    return (p - (a + ab * t)).length


def skin(mesh, armature, bones, character):
    """Inverse square distance to the 3 nearest bone segments, distances divided by each bone radius so the
    thin arm bones don't steal the sides of the torso. Optional rigid head (chibi characters)."""
    rigid_head = getattr(character, 'RIGID_HEAD', None)  # (start height, blend height)
    arm_only_x = getattr(character, 'ARM_ONLY_X', None)  # further out than this is arm only
    torso_only = getattr(character, 'TORSO_ONLY', None)  # function(point): long hair, bags... follow the torso, not the arms / legs

    segments = [(name, head, tail, radius) for name, head, tail, _, radius in bones]
    body_segments = [s for s in segments if not (rigid_head and s[0] == 'head')]
    groups = { name: mesh.vertex_groups.new(name=name) for name, *_ in segments }

    for vertex in mesh.data.vertices:
        p = vertex.co
        weights = {}

        head_ratio = 0.0
        if rigid_head:
            start, blend = rigid_head
            head_ratio = max(0.0, min(1.0, (p.z - start) / blend + 0.5))
            if head_ratio > 0:
                weights['head'] = head_ratio

        if head_ratio < 1:
            candidates = body_segments
            # Outside the torso (hands and forearms) only the arm of that side, otherwise the wide hips grab the thumbs
            if arm_only_x and abs(p.x) > arm_only_x and p.z > 0.2:
                side = '.R' if p.x > 0 else '.L'
                candidates = [s for s in body_segments if s[0].endswith(side) and not s[0].startswith(LEG_BONES)]
            if torso_only and torso_only(p):
                candidates = [s for s in body_segments if not s[0].endswith(('.R', '.L'))]
            nearest = sorted((segment_distance(p, a, b) / radius, name) for name, a, b, radius in candidates)[:3]
            inverse = [(1 / max(d, 1e-4) ** 2, name) for d, name in nearest]
            total = sum(w for w, _ in inverse)
            for w, name in inverse:
                weights[name] = weights.get(name, 0) + w / total * (1 - head_ratio)

        for name, w in weights.items():
            if w > 0.001:
                groups[name].add([vertex.index], w, 'REPLACE')

    weighted = sum(1 for v in mesh.data.vertices if len(v.groups))
    if weighted == 0:
        raise SystemExit('0 weighted vertices, aborting')
    print(f'weights: {weighted}/{len(mesh.data.vertices)} vertices')

    mesh.parent = armature
    modifier = mesh.modifiers.new('Armature', 'ARMATURE')
    modifier.object = armature


def export(path):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
        export_skins=True,
        export_yup=True,
        export_apply=False,
        export_force_sampling=True,
    )
    patch_opaque(path)


def patch_opaque(path):
    """Same stdlib patch as skills/game/higgsfield-game-generation/scripts/glb_patch.py"""
    MAGIC, CHUNK_JSON = 0x46546C67, 0x4E4F534A
    with open(path, 'rb') as f:
        data = f.read()
    chunks, offset = [], 12
    while offset < len(data):
        length, kind = struct.unpack_from('<II', data, offset)
        chunks.append((kind, data[offset + 8: offset + 8 + length]))
        offset += 8 + length
    body = b''
    for kind, payload in chunks:
        if kind == CHUNK_JSON:
            gltf = json.loads(payload.decode('utf-8'))
            for material in gltf.get('materials', []):
                material['alphaMode'] = 'OPAQUE'
                material.pop('alphaCutoff', None)
            payload = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
        payload += (b' ' if kind == CHUNK_JSON else b'\x00') * ((4 - len(payload) % 4) % 4)
        body += struct.pack('<II', len(payload), kind) + payload
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', MAGIC, 2, 12 + len(body)) + body)
