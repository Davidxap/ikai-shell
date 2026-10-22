"""Fog as it actually looks: layered smooth noise, stretched sideways so it streaks the way a bank of fog does,
not a few radial blobs (which read as grey blotches). Used for the seal's fog decoration and for the tileable
texture the media-effect fog scrolls."""

from __future__ import annotations

import numpy as np
from PIL import Image


def fbm(w: int, h: int, seed: int, sx: float = 2.6, base: float = 90.0, octaves: int = 5) -> np.ndarray:
    """Fractal value noise in 0..1, w x h. `sx` stretches it horizontally (fog is wider than it is tall)."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float64)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        sy = max(2.0, base / (2 ** o))
        gw, gh = int(np.ceil(w / (sy * sx))) + 3, int(np.ceil(h / sy)) + 3
        grid = (rng.random((gh, gw)) * 255).astype(np.uint8)
        layer = np.asarray(Image.fromarray(grid).resize((int(gw * sy * sx), int(gh * sy)), Image.BICUBIC),
                           np.float64)[:h, :w] / 255.0
        out += layer * amp
        total += amp
        amp *= 0.55
    out /= total
    lo, hi = np.percentile(out, 3), np.percentile(out, 97)
    return np.clip((out - lo) / max(1e-6, hi - lo), 0, 1)


def tile_x(a: np.ndarray) -> np.ndarray:
    """Make a field wrap left-to-right without a seam (cross-fade it with itself shifted by half a width)."""
    h, w = a.shape
    x = np.arange(w) / w
    wt = np.sin(np.pi * x) ** 2
    return a * wt[None, :] + np.roll(a, w // 2, axis=1) * (1 - wt)[None, :]


def smooth(a: np.ndarray, lo: float, hi: float) -> np.ndarray:
    t = np.clip((a - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)
