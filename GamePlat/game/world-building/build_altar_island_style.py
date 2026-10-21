"""Style weights of the altar island texture, so the island uses the game colours.

Reads the base colour texture of static/altarIsland/altarIsland.glb and writes
static/altarIsland/altarIslandStyle.png (same UV layout, data, no colour space):
  R = dirt (orange tops, terrain dirt colour)
  G = grass (olive tops, terrain grass colour)
  B = cherry foliage (pink)
  rock (lavender cliffs) = 1 - R - G - B
Used by sources/Game/World/AltarIsland.js.

Usage: python world-building/build_altar_island_style.py
"""
import numpy as np
from PIL import Image, ImageFilter

from build_altar_island_map import ROOT, SOURCE, read_glb

OUTPUT = ROOT / 'static/altarIsland/altarIslandStyle.png'
SIZE = 512


def main():
    _, _, _, texture = read_glb(SOURCE)
    rgb = np.asarray(texture.resize((SIZE, SIZE), Image.BILINEAR).convert('HSV'), dtype=np.float64) / 255
    hue, saturation = rgb[..., 0] * 360, rgb[..., 1]
    red_dominant = np.asarray(texture.resize((SIZE, SIZE), Image.BILINEAR), dtype=np.float64)
    red_dominant = red_dominant[..., 0] > red_dominant[..., 1] * 1.25

    warm = (hue < 70) | (hue >= 345)
    pink = (saturation > 0.25) & (((hue >= 300) & (hue < 345)) | (((hue < 20) | (hue >= 330)) & red_dominant))
    rock = (saturation <= 0.12) | ((hue >= 180) & (hue < 300))
    dirt = warm & (saturation > 0.45) & ~pink & ~rock
    grass = warm & (saturation <= 0.45) & ~pink & ~rock

    def soft(mask):
        return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), dtype=np.float64)

    weights = np.stack([soft(dirt), soft(grass), soft(pink)], axis=-1)
    total = weights.sum(axis=-1, keepdims=True)
    weights = np.where(total > 255, weights / np.maximum(total, 1) * 255, weights)

    Image.fromarray(weights.round().astype(np.uint8), 'RGB').save(OUTPUT, optimize=True)
    print(f'{OUTPUT} dirt {dirt.mean():.2f} grass {grass.mean():.2f} cherry {pink.mean():.2f} rock {rock.mean():.2f}')


if __name__ == '__main__':
    main()
