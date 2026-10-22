"""Top-down map picture of the altar island for the minimap and the M map.

Rasterizes the island without trees (model/island-notrees.glb) with the same transform as
sources/Game/World/AltarIsland.js (ALTAR_ISLAND) and writes
static/altarIsland/altarIslandMap.webp, covering center +/- MAP_HALF_SIZE metres
(x to the right, z downward, like ui/map/map-day.webp).

Usage: python world-building/build_altar_island_map.py
"""
import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT.parent / 'model/island-notrees.glb'  # Written by remove_altar_island_trees.py
OUTPUT = ROOT / 'static/altarIsland/altarIslandMap.webp'

# Keep in sync with ALTAR_ISLAND in sources/Game/World/AltarIsland.js
DIAMETER = 60
MIRROR_X = True
MAP_HALF_SIZE = 34
SEA_PLATE_LEVEL = -0.019  # Local y kept above the water, lower parts are hidden in game

PIXELS_PER_METRE = 10
STYLE = ROOT / 'static/altarIsland/altarIslandStyle.png'

# Same colours and mix as the island material (sources/Game/World/AltarIsland.js)
COLORS = {name: np.array([int(value[i:i + 2], 16) for i in (1, 3, 5)]) / 255 for name, value in {
    'dirt': '#ffa94e', 'grass': '#b8b62e', 'shallow': '#5bc2b9',
    'stoneLow': '#7c7691', 'stoneHigh': '#c8c2c1', 'cherryA': '#ff6d6d', 'cherryB': '#ff9990',
}.items()}


def smoothstep(edge0, edge1, value):
    t = min(1.0, max(0.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def game_color(weights, texel, normal_y, height):
    detail = smoothstep(0.15, 0.75, 0.2126 * texel[0] + 0.7152 * texel[1] + 0.0722 * texel[2])
    grass = weights[1] / max(weights[0] + weights[1], 1e-3)
    depth = min(0.35, max(0.0, (0.8 - height) / 2.5))
    ground = COLORS['dirt'] * (1 - grass) + COLORS['grass'] * grass
    ground = ground * (1 - depth / 0.35 * 0.6) + COLORS['shallow'] * depth / 0.35 * 0.6
    stone = COLORS['stoneLow'] * (1 - detail) + COLORS['stoneHigh'] * detail
    amount = max(min(1.0, weights[0] + weights[1]) * smoothstep(0.55, 0.8, abs(normal_y)), 1 - smoothstep(0.4, 1.2, height))
    color = stone * (1 - amount) + ground * amount
    cherry = COLORS['cherryA'] * (1 - detail) + COLORS['cherryB'] * detail
    return color * (1 - weights[2]) + cherry * weights[2]
SHALLOW_COLOR = (92, 196, 186)


def read_glb(path):
    data = path.read_bytes()
    json_length = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + json_length])
    binary = data[20 + json_length + 8:]

    def accessor(index):
        a = gltf['accessors'][index]
        view = gltf['bufferViews'][a['bufferView']]
        offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        dtype = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
        return np.frombuffer(binary, dtype, a['count'] * width, offset).reshape(-1, width)

    primitive = gltf['meshes'][0]['primitives'][0]
    positions = accessor(primitive['attributes']['POSITION']).astype(np.float64)
    uvs = accessor(primitive['attributes']['TEXCOORD_0']).astype(np.float64)
    indices = accessor(primitive['indices']).reshape(-1, 3).astype(np.int64)
    image = gltf['images'][gltf['textures'][gltf['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
    view = gltf['bufferViews'][image['bufferView']]
    start = view.get('byteOffset', 0)
    from io import BytesIO
    texture = Image.open(BytesIO(binary[start:start + view['byteLength']])).convert('RGB')
    return positions, uvs, indices, texture


def main():
    positions, uvs, indices, texture = read_glb(SOURCE)

    width = max(np.ptp(positions[:, 0]), np.ptp(positions[:, 2]))
    scale = DIAMETER / width
    # three.js scale.x = -scale when mirrored (centered on the island)
    x = positions[:, 0] * (-scale if MIRROR_X else scale)
    z = positions[:, 2] * scale
    y = (positions[:, 1] - SEA_PLATE_LEVEL) * scale

    size = MAP_HALF_SIZE * 2 * PIXELS_PER_METRE
    px = (x + MAP_HALF_SIZE) * PIXELS_PER_METRE
    pz = (z + MAP_HALF_SIZE) * PIXELS_PER_METRE

    tex = np.asarray(texture, dtype=np.float64) / 255
    th, tw = tex.shape[:2]
    style = np.asarray(Image.open(STYLE), dtype=np.float64) / 255
    sh, sw = style.shape[:2]

    depth = np.full((size, size), -np.inf)
    rgb = np.zeros((size, size, 3))
    light = np.array([-0.45, 0.8, -0.4])
    light /= np.linalg.norm(light)

    for a, b, d in indices:
        if max(y[a], y[b], y[d]) <= 0:
            continue
        e1 = np.array([x[b] - x[a], y[b] - y[a], z[b] - z[a]])
        e2 = np.array([x[d] - x[a], y[d] - y[a], z[d] - z[a]])
        normal = np.cross(e1, e2) if MIRROR_X else np.cross(e2, e1)
        length = np.linalg.norm(normal)
        if length == 0:
            continue
        shade = 0.75 + 0.25 * abs(float(np.dot(normal / length, light)))

        u, v = uvs[[a, b, d]].mean(axis=0)
        texel = tex[min(th - 1, max(0, int(v * th))), min(tw - 1, max(0, int(u * tw)))]
        weights = style[min(sh - 1, max(0, int(v * sh))), min(sw - 1, max(0, int(u * sw)))]
        color = game_color(weights, texel, normal[1] / length, (y[a] + y[b] + y[d]) / 3) * 255 * shade

        xs, zs = px[[a, b, d]], pz[[a, b, d]]
        x0, x1 = max(0, int(xs.min())), min(size - 1, int(math.ceil(xs.max())))
        z0, z1 = max(0, int(zs.min())), min(size - 1, int(math.ceil(zs.max())))
        if x1 < x0 or z1 < z0:
            continue
        gx, gz = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(z0, z1 + 1) + 0.5)
        den = (zs[1] - zs[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (zs[0] - zs[2])
        if abs(den) < 1e-9:
            gx, gz = np.array([[xs.mean()]]), np.array([[zs.mean()]])
            w0 = w1 = w2 = np.array([[1 / 3]])
            x0, z0 = int(xs.mean()), int(zs.mean())
            if not (0 <= x0 < size and 0 <= z0 < size):
                continue
        else:
            w0 = ((zs[1] - zs[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gz - zs[2])) / den
            w1 = ((zs[2] - zs[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gz - zs[2])) / den
            w2 = 1 - w0 - w1
        inside = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
        height = w0 * y[a] + w1 * y[b] + w2 * y[d]
        region = depth[z0:z0 + gx.shape[0], x0:x0 + gx.shape[1]]
        closer = inside & (height > region) & (height > 0)
        region[closer] = height[closer]
        rgb[z0:z0 + gx.shape[0], x0:x0 + gx.shape[1]][closer] = color

    land = np.isfinite(depth)
    land_mask = Image.fromarray((land * 255).astype(np.uint8))

    # Shallow water halo, like the coasts of ui/map/map-day.webp
    halo = land_mask.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(PIXELS_PER_METRE * 1.2))
    halo_alpha = np.minimum(1.0, np.asarray(halo, dtype=np.float64) / 255 * 1.6) * 0.85

    out = np.zeros((size, size, 4))
    out[..., :3] = SHALLOW_COLOR
    out[..., 3] = halo_alpha * 255
    out[land, :3] = rgb[land]
    out[land, 3] = 255

    picture = Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGBA')
    picture = picture.filter(ImageFilter.SMOOTH)
    picture.resize((512, 512), Image.LANCZOS).save(OUTPUT, quality=85, method=6)
    print(f'{OUTPUT} {size}x{size} land pixels {int(land.sum())}')


if __name__ == '__main__':
    main()
