#!/usr/bin/env python3
"""The Flauros, engraved: the second Silent Hill workspace style, built from the actual puzzle symbol (a
cracked stone ring, a triangle, the trapped thing coiled inside it, two bars at its base) rather than
invented. Metatron already stands for the shell in the Logo page's own marks; this is a different seal for
a different place, not a copy of it drawn worse.

This drawing does not change with the workspace number -- an earlier attempt at growing the coil per
number was too subtle to read, and a second attempt that widened the whole ring stopped looking like the
Flauros at all. A small tally of solid dots above the triangle carries the count instead, the way a tally
mark does, without touching the ring, the triangle or the coil.

    empty     a single broken ring, barely there, no triangle
    occupied  the full seal in bone: ring, triangle, the coil inside, the base bars
    active    the same, lit blood: the workspace you are on
    urgent    the same, with a second broken ring pulsing outward

    gen-flauros-workspace.py     writes bar/modules/ito-art/workspaces/ws-flauros-<n>-<state>.png
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from engrave import BLOOD, BONE, DIM, canvas, ellipse, finish, gp, pen

OUT = Path(__file__).resolve().parent.parent / "bar" / "modules" / "ito-art" / "workspaces"
CX, CY = 320, 320
STATES = ("empty", "occupied", "active", "urgent")


def broken_ring(img, cx, cy, r, color, seed, w=(9, 14)):
    """A ring built from separate stone segments with gaps and jagged edges, not a smooth circle."""
    rng = random.Random(seed)
    n = 16
    for i in range(n):
        if rng.random() < 0.12:
            continue
        a0 = i / n * 2 * math.pi + rng.uniform(-0.02, 0.02)
        a1 = a0 + (1 / n) * 0.86 * 2 * math.pi
        rr = r + rng.uniform(-7, 7)
        pts = gp.arc(cx, cy, rr, rr, a0, a1, 8)
        gp.ink(img, pts, w[0], w[1], color, wobble=1.9, pressure=True)


def tally(img, n, dim):
    """1 to 5 solid bone dots above the triangle, a thin ring around the group for 6 to 10."""
    group = (n - 1) % 5 + 1
    r = 13
    gap = 34
    total_w = (group - 1) * gap
    y = CY - 128
    fill = DIM if dim else BONE
    for k in range(group):
        x = CX - total_w / 2 + k * gap
        gp.ImageDraw.Draw(img).ellipse((x - r, y - r, x + r, y + r), fill=fill + (255,))
    if n > 5:
        rr = total_w / 2 + r + 14
        pen(img, ellipse(CX, y, rr, rr * 0.62), 5, fill, closed=True, echo=False)


def flauros(state: str, n: int):
    img = canvas()
    lit = state in ("active", "urgent")
    dim = state == "empty"
    col = BLOOD if lit else (DIM if dim else BONE)

    if dim:
        broken_ring(img, CX, CY, 150, DIM, seed=5, w=(6, 9))
        tally(img, n, dim)
        return img

    broken_ring(img, CX, CY, 150, BONE, seed=5)

    tri = [(CX, CY - 112), (CX + 96, CY + 70), (CX - 96, CY + 70)]
    gp.ink(img, tri + tri[:1], 8, 12, col, wobble=1.0, pressure=True)

    gp.ink(img, gp.spiral(CX, CY - 18, 34, 1.7, n=90, start=0.1), 5, 9, col, wobble=0.8, pressure=True)

    gp.ink(img, [(CX - 46, CY + 70), (CX + 46, CY + 70)], 6, 10, col, wobble=0.5, pressure=False)
    gp.ink(img, [(CX - 28, CY + 90), (CX + 28, CY + 90)], 4, 7, col, wobble=0.5, pressure=False)

    if state == "urgent":
        broken_ring(img, CX, CY, 186, BLOOD, seed=11, w=(4, 7))

    tally(img, n, dim)

    return img


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("ws-flauros-*"):
        old.unlink()
    count = 0
    for n in range(1, 11):
        for i, state in enumerate(STATES):
            finish(flauros(state, n), seed=240 + n * 4 + i).save(OUT / f"ws-flauros-{n}-{state}.png")
            count += 1
    print(f"wrote {count} flauros workspace marks -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
