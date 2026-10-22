#!/usr/bin/env python3
"""Draw the press dirt: a large seamless speckle the bar plate can wear.

The sheet's own grain crop is 77px wide, so tiling it across a 2560px bar repeats a recognisable
blob every hundred pixels and reads as wallpaper, not as dirt. This one is generated wide, and made
seamless by blurring a 3x3 layout of itself and cutting the middle out, so the seam has neighbours
on every side while it is smoothed.

Output: bar/modules/ito-art/surface/dirt.png (bone speckles on transparency).
"""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "bar" / "modules" / "ito-art" / "surface" / "dirt.png"

W, H = 720, 180
BONE = (199, 204, 209)
SEED = 20260920


def main() -> None:
    rng = random.Random(SEED)
    mask = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(mask)

    # fine peppering, then a few larger smudges, the way ink dries unevenly on cheap paper
    for _ in range(W * H // 26):
        x, y = rng.randrange(W), rng.randrange(H)
        draw.point((x, y), fill=rng.randint(40, 255))
    for _ in range(W * H // 900):
        x, y = rng.randrange(W), rng.randrange(H)
        r = rng.uniform(0.8, 2.6)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=rng.randint(30, 120))

    # seamless: surround the tile with copies of itself, blur, then cut the middle back out
    wide = Image.new("L", (W * 3, H * 3))
    for column in range(3):
        for row in range(3):
            wide.paste(mask, (column * W, row * H))
    wide = wide.filter(ImageFilter.GaussianBlur(0.7))
    mask = wide.crop((W, H, W * 2, H * 2))

    out = Image.new("RGBA", (W, H), BONE + (0,))
    out.putalpha(mask)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT)
    print(f"wrote {OUT} ({W}x{H})")


if __name__ == "__main__":
    main()
