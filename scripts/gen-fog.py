#!/usr/bin/env python3
"""The tileable fog texture the media-effect fog scrolls in layers: soft bone-white streaks of varying density on
a transparent ground, wrapping left to right.

    gen-fog.py     writes bar/modules/ito-art/misc/fog.png
"""

from pathlib import Path
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fogfield import fbm, smooth, tile_x  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "bar" / "modules" / "ito-art" / "misc" / "fog.png"
W, H = 768, 160

n = tile_x(fbm(W, H, seed=21, sx=3.0, base=70))
dens = smooth(n, 0.30, 0.92)
# thin at the top and bottom edge so a scrolled strip never shows a hard band
y = np.linspace(0, 1, H)
edge = np.sin(np.pi * y) ** 0.8
alpha = (dens * edge[:, None] * 235).astype(np.uint8)
rgba = np.zeros((H, W, 4), np.uint8)
rgba[..., 0], rgba[..., 1], rgba[..., 2] = 208, 212, 216
rgba[..., 3] = alpha
OUT.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(rgba, "RGBA").save(OUT)
print("wrote", OUT)
