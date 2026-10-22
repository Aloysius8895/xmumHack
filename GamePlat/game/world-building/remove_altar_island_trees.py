"""Remove the AI generated trees from the altar island model, so the game can plant its own trees.

Reads GamePlat/model/island.glb (the untouched source), writes:
  GamePlat/model/island-notrees.glb     island without trees, holes capped, uncompressed (input of the other scripts)
  static/altarIsland/altarIsland.glb    the same, small for low bandwidth / integrated GPUs:
                                        colour map only, 1024 px WebP, Draco geometry (gltf-transform)
  sources/Game/World/altarIslandTrees.json  removed trees (model units: base x / y / z, height, kind)

The tree axes were picked once from renders of the model (two passes, the second one for trees on
ledges next to cliffs), then each tree is cut as: triangles within 1.7 m of the axis and 0.3 m above
its ground, keeping only the connected pieces centred on the axis (so nearby cliffs stay).
Distances are in metres at the reference size of 60 m (200 m per model unit).

Usage: python world-building/remove_altar_island_trees.py
"""
import json
import struct
import subprocess
from pathlib import Path

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT.parent / 'model/island.glb'
RAW = ROOT.parent / 'model/island-notrees.glb'
OUTPUT = ROOT / 'static/altarIsland/altarIsland.glb'
TEXTURE_SIZE = 1024
TREES = ROOT / 'sources/Game/World/altarIslandTrees.json'

METRES = 200  # Metres per model unit at the reference size
WATERLINE = -0.019  # Model y of the waterline

# Tree axes (x, z) and ground height (metres above the waterline), pass 1 then pass 2
PASSES = [
    [(-24.27, -8.29, 4.10), (-21.28, -11.33, 3.94), (-14.16, -14.29, 4.39), (-8.62, -13.20, 4.09), (-16.65, -22.15, 5.98),
     (-7.30, -22.85, 6.13), (-1.64, -15.62, 7.46), (8.46, -22.97, 10.30), (13.22, -21.92, 7.36), (16.22, -19.19, 7.26),
     (19.48, -18.07, 6.88), (13.55, -11.37, 4.81), (17.82, -7.18, 4.76), (18.24, -7.77, 6.61), (23.38, -9.86, 6.51),
     (25.01, -8.28, 4.52), (25.86, 0.75, 4.61), (25.89, 4.80, 4.54), (-24.47, 8.68, 4.61), (-23.67, 1.88, 4.45),
     (-20.71, 11.83, 3.85), (-14.12, -8.27, 2.82), (-14.79, -7.09, 1.97), (19.16, -18.08, 7.06), (15.08, -20.11, 7.32),
     (-7.96, -12.17, 4.10), (-13.54, -13.74, 3.99), (-22.42, 10.58, 4.77), (-22.33, 2.86, 4.51)],
    [(-2.71, -21.01, 8.31), (-1.91, -13.62, 5.29), (15.72, -9.74, 4.78), (21.03, -6.62, 4.48), (-4.71, -16.54, 6.06),
     (2.03, -29.06, 3.41), (23.75, -10.00, 4.99), (-4.22, -22.56, 6.10)],
]


def read_glb(path):
    data = path.read_bytes()
    json_length = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + json_length])
    binary = data[20 + json_length + 8:]

    def view_bytes(index):
        view = gltf['bufferViews'][index]
        start = view.get('byteOffset', 0)
        return binary[start:start + view['byteLength']]

    def accessor(index):
        a = gltf['accessors'][index]
        dtype = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
        raw = view_bytes(a['bufferView'])
        return np.frombuffer(raw, dtype, a['count'] * width, a.get('byteOffset', 0)).reshape(-1, width).copy()

    return gltf, view_bytes, accessor


def write_glb(path, gltf, chunks):
    """chunks: list of (bytes, target or None), one buffer view each, in order"""
    binary = b''
    views = []
    for raw, target in chunks:
        view = {'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(raw)}
        if target:
            view['target'] = target
        views.append(view)
        binary += raw + b'\0' * (-len(raw) % 4)
    gltf['bufferViews'] = views
    gltf['buffers'] = [{'byteLength': len(binary)}]
    text = json.dumps(gltf, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    total = 12 + 8 + len(text) + 8 + len(binary)
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<I', len(text)) + b'JSON' + text
                     + struct.pack('<I', len(binary)) + b'BIN\0' + binary)


def main():
    gltf, view_bytes, accessor = read_glb(SOURCE)
    primitive = gltf['meshes'][0]['primitives'][0]
    positions = accessor(primitive['attributes']['POSITION'])
    normals = accessor(primitive['attributes']['NORMAL'])
    uvs = accessor(primitive['attributes']['TEXCOORD_0'])
    indices = accessor(primitive['indices']).reshape(-1, 3).astype(np.int64)

    metres = positions.astype(np.float64) * METRES
    metres[:, 1] = (positions[:, 1] - WATERLINE) * METRES
    centers = metres[indices].mean(axis=1)

    # Welded vertices (the mesh is split along UV seams)
    _, welded = np.unique(np.round(positions / 1e-6).astype(np.int64), axis=0, return_inverse=True)
    welded = welded.ravel()
    triangle_welded = welded[indices]

    # Texture colour per triangle, to tell cherry trees from the others
    image = gltf['images'][gltf['textures'][gltf['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
    from io import BytesIO
    from PIL import Image
    texture = np.asarray(Image.open(BytesIO(view_bytes(image['bufferView']))).convert('RGB'), dtype=np.float64) / 255
    th, tw = texture.shape[:2]
    center_uv = uvs[indices].mean(axis=1)
    colors = texture[np.clip((center_uv[:, 1] * th).astype(int), 0, th - 1), np.clip((center_uv[:, 0] * tw).astype(int), 0, tw - 1)]
    pink = (colors[:, 0] > colors[:, 1] * 1.35) & (colors[:, 2] > colors[:, 1] * 0.95)

    removed = np.zeros(len(indices), bool)
    trees = []
    for axes in PASSES:
        for x, z, ground in axes:
            distance = np.hypot(centers[:, 0] - x, centers[:, 2] - z)
            above = (centers[:, 1] > ground + 0.3) & ~removed
            near = (distance < 1.8) & above
            if near.sum() < 10:
                continue
            cx, cz = centers[near][:, [0, 2]].mean(axis=0)
            selection = np.where((np.hypot(centers[:, 0] - cx, centers[:, 2] - cz) < 1.7) & above)[0]

            # Keep the connected pieces centred on the axis
            first = {}
            rows, cols = [], []
            for k, triangle in enumerate(selection):
                for vertex in triangle_welded[triangle]:
                    if vertex in first:
                        rows.append(first[vertex])
                        cols.append(k)
                    else:
                        first[vertex] = k
            count, labels = connected_components(coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(len(selection),) * 2), directed=False)
            kept = []
            for label in range(count):
                piece = selection[labels == label]
                px, pz = centers[piece][:, [0, 2]].mean(axis=0)
                offset = np.hypot(px - cx, pz - cz)
                if offset < 1.0 or (centers[piece, 1].max() > ground + 1.5 and offset < 1.3):
                    kept.append(piece)
            if not kept:
                continue
            piece = np.concatenate(kept)
            removed[piece] = True

            if any(np.hypot(cx - t['x'], cz - t['z']) < 1.2 for t in trees):
                continue  # Second pass on a tree already listed
            trees.append({
                'x': cx, 'z': cz, 'ground': ground, 'height': centers[piece, 1].max() - ground,
                'kind': 'cherry' if pink[piece].mean() > 0.25 else 'oak',
            })

    # Cap the holes left in the island (new boundary loops), both windings since the material is front side only
    def boundary_edges(mask):
        edges = {}
        for a, b, c in triangle_welded[mask]:
            for u, v in ((a, b), (b, c), (c, a)):
                key = (min(u, v), max(u, v))
                edges[key] = edges.get(key, 0) + 1
        return {key for key, value in edges.items() if value == 1}

    new_edges = boundary_edges(~removed) - boundary_edges(np.ones(len(indices), bool))
    neighbours = {}
    for u, v in new_edges:
        neighbours.setdefault(u, []).append(v)
        neighbours.setdefault(v, []).append(u)
    any_index = {}
    for k, vertex in enumerate(welded):
        any_index.setdefault(vertex, k)

    extra_positions, extra_normals, extra_uvs, caps = [], [], [], []
    visited = set()
    for start in list(neighbours):
        if start in visited:
            continue
        loop = [start]
        visited.add(start)
        previous, current = None, start
        while True:
            options = [v for v in neighbours[current] if v != previous and (v not in visited or (v == start and len(loop) > 2))]
            if not options:
                break
            following = options[0]
            if following == start:
                break
            loop.append(following)
            visited.add(following)
            previous, current = current, following
        if len(loop) < 3:
            continue
        corners = [any_index[v] for v in loop]
        points = positions[corners].astype(np.float64)
        normal = np.zeros(3)
        for i in range(len(points)):  # Newell normal
            p, q = points[i], points[(i + 1) % len(points)]
            normal += np.array([(p[1] - q[1]) * (p[2] + q[2]), (p[2] - q[2]) * (p[0] + q[0]), (p[0] - q[0]) * (p[1] + q[1])])
        normal /= np.linalg.norm(normal) + 1e-12
        center = len(positions) + len(extra_positions)
        extra_positions.append(points.mean(axis=0))
        extra_normals.append(normal)
        extra_uvs.append(uvs[corners[0]])
        for i in range(len(corners)):
            a, b = corners[i], corners[(i + 1) % len(corners)]
            caps.append((center, a, b))
            caps.append((center, b, a))

    new_positions = np.vstack([positions, np.array(extra_positions, np.float32).reshape(-1, 3)]).astype(np.float32)
    new_normals = np.vstack([normals, np.array(extra_normals, np.float32).reshape(-1, 3)]).astype(np.float32)
    new_uvs = np.vstack([uvs, np.array(extra_uvs, np.float32).reshape(-1, 2)]).astype(np.float32)
    new_indices = np.vstack([indices[~removed], np.array(caps, np.int64).reshape(-1, 3)]).astype(np.uint32)

    # Rewrite the GLB: indices, positions, uvs, normals, then the two images unchanged
    accessors = gltf['accessors']
    attributes = primitive['attributes']
    order = [(primitive['indices'], new_indices, 34963), (attributes['POSITION'], new_positions, 34962),
             (attributes['TEXCOORD_0'], new_uvs, 34962), (attributes['NORMAL'], new_normals, 34962)]
    chunks = []
    for view, (accessor_index, values, target) in enumerate(order):
        accessors[accessor_index].update({'bufferView': view, 'count': int(values.size if target == 34963 else len(values))})
        accessors[accessor_index].pop('byteOffset', None)
        if accessor_index == attributes['POSITION']:
            accessors[accessor_index]['min'] = new_positions.min(axis=0).tolist()
            accessors[accessor_index]['max'] = new_positions.max(axis=0).tolist()
        chunks.append((values.tobytes(), target))
    # Only the colour map is used by the game (metalness / roughness dropped)
    material = gltf['materials'][0]
    material['pbrMetallicRoughness'].pop('metallicRoughnessTexture', None)
    base = gltf['textures'][material['pbrMetallicRoughness']['baseColorTexture']['index']]
    picture = gltf['images'][base['source']]
    chunks.append((view_bytes(picture['bufferView']), None))
    picture['bufferView'] = len(order)
    gltf['images'] = [picture]
    gltf['textures'] = [{**base, 'source': 0}]
    material['pbrMetallicRoughness']['baseColorTexture']['index'] = 0
    write_glb(RAW, gltf, chunks)

    # Compress for the game
    npx = 'npx.cmd' if subprocess.os.name == 'nt' else 'npx'
    temporary = OUTPUT.with_suffix('.tmp.glb')
    for command in (
        ['resize', str(RAW), str(temporary), '--width', str(TEXTURE_SIZE), '--height', str(TEXTURE_SIZE)],
        ['webp', str(temporary), str(temporary), '--quality', '85'],
        ['draco', str(temporary), str(OUTPUT)],
    ):
        subprocess.run([npx, 'gltf-transform', *command], cwd=ROOT, check=True, capture_output=True)
    temporary.unlink()

    for tree in trees:  # Model units, so the game applies the island transform
        tree.update({
            'x': round(tree['x'] / METRES, 6), 'y': round(tree['ground'] / METRES + WATERLINE, 6),
            'z': round(tree['z'] / METRES, 6), 'height': round(tree['height'] / METRES, 6),
        })
        del tree['ground']
    TREES.write_text(json.dumps(trees, indent=1))
    print(f'{OUTPUT} ({OUTPUT.stat().st_size // 1024} KB) removed {int(removed.sum())} triangles, {len(caps) // 2} cap triangles, {len(trees)} trees '
          f'({sum(t["kind"] == "cherry" for t in trees)} cherry)')


if __name__ == '__main__':
    main()
