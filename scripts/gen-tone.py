#!/usr/bin/env python3
"""The manga screentone as a seamless tile: a staggered grid of halftone dots at 45 degrees. The sheet's own
screentone has a fade and an empty margin on every edge, so repeated across a plate it drew a visible seam every
tile. This one is uniform and wraps exactly.

    gen-tone.py      writes bar/modules/ito-art/surface/tone.png
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "bar" / "modules" / "ito-art" / "surface" / "tone.png"
SIZE = 128          # the tile, in pixels
SS = 4              # supersampling
PITCH = 16          # dot spacing, in tile pixels
R = 2.6             # dot radius


def main() -> int:
    n = SIZE * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    p = PITCH * SS
    r = R * SS
    row = 0
    y = 0
    while y < n + p:
        off = (p // 2) if row % 2 else 0
        x = -p
        while x < n + p:
            cx, cy = x + off, y
            # a dot near an edge is drawn again on the opposite side, so the tile wraps
            for ox in (-n, 0, n):
                for oy in (-n, 0, n):
                    d.ellipse((cx + ox - r, cy + oy - r, cx + ox + r, cy + oy + r), fill=(199, 204, 209, 255))
            x += p
        y += p // 2
        row += 1
    img.resize((SIZE, SIZE), Image.LANCZOS).save(OUT)
    print("wrote", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
