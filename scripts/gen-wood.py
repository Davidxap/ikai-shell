#!/usr/bin/env python3
"""Draw the Uzumaki plank: the wood-grain tile the bar can be cut from.

The manga's title board is a plank whose grain winds into a spiral around every knot, which is the
joke of the whole story - the curse is already in the wood. So the texture is not a photograph: the
grain is drawn, the knots are spirals, and it tiles horizontally so a bar of any width is one board.

Output: bar/modules/ito-art/surface/wood.png (bone-coloured lines on transparency, so the plate
tints it by simply drawing it over whatever base the user picked).
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "bar" / "modules" / "ito-art" / "surface" / "wood.png"

W, H = 1200, 64
BONE = (199, 204, 209)

# Knots, as (x, y, radius, turns). Kept clear of the edges so the horizontal tile stays seamless.
KNOTS = [(120, 30, 22, 6.0), (1090, 30, 24, 6.5)]


def wave(x: float, seed: int) -> float:
    """A periodic vertical offset: integer frequencies only, so the left and right edges meet."""
    return (
        2.6 * math.sin(2 * math.pi * 1 * x / W + seed * 0.7)
        + 1.5 * math.sin(2 * math.pi * 2 * x / W + seed * 1.9)
        + 0.8 * math.sin(2 * math.pi * 3 * x / W + seed * 3.1)
    )


def knot_push(x: float, y: float) -> float:
    """How far a grain line is pushed aside by the knots it has to flow around."""
    shift = 0.0
    for kx, ky, kr, _ in KNOTS:
        dx, dy = x - kx, y - ky
        dist = math.hypot(dx * 0.55, dy)
        if dist < kr * 2.4:
            pull = (1 - dist / (kr * 2.4)) ** 2
            shift += math.copysign(kr * 1.15 * pull, dy if dy != 0 else 1)
    return shift


def main() -> None:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # the grain itself: long lines down the board, bending around every knot
    for i in range(34):
        base_y = -6 + i * (H + 12) / 34
        alpha = 38 + (i * 53) % 46
        width = 1 if i % 3 else 2
        points = []
        for x in range(0, W + 4, 4):
            y = base_y + wave(x, i) + knot_push(x, base_y)
            points.append((x, y))
        draw.line(points, fill=BONE + (alpha,), width=width, joint="curve")

    # the knots: the grain closing into a spiral, the way Uzumaki draws every piece of wood
    for kx, ky, kr, turns in KNOTS:
        points = []
        steps = int(turns * 90)
        for s in range(steps + 1):
            t = s / steps
            angle = t * turns * 2 * math.pi
            radius = kr * t
            points.append((kx + math.cos(angle) * radius * 1.7, ky + math.sin(angle) * radius))
        draw.line(points, fill=BONE + (110,), width=2, joint="curve")

    # a couple of splits along the board, and the seam where two planks meet
    for x0, alpha in ((int(W * 0.46), 58), (int(W * 0.83), 44)):
        draw.line([(x0, 0), (x0 + 2, H)], fill=BONE + (alpha,), width=1)

    img = img.filter(ImageFilter.SMOOTH)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT)
    print(f"wrote {OUT} ({W}x{H})")


if __name__ == "__main__":
    main()
