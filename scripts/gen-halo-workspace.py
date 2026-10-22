#!/usr/bin/env python3
"""The Halo of the Sun, engraved: a workspace style built from the one Silent Hill symbol confirmed real
in every corner of this shell already (the menu mark) -- here it marks the workspace you are on instead.

A disc with flares alternating long and short, exactly the way Silent Hill 3 draws its own save-point
seal, in the shell's own bone and blood rather than traced from the game. This drawing does not change
with the workspace number -- an earlier attempt at making the ring itself carry the count (fewer, fatter
flares) stopped looking like a halo at all. A small tally of solid dots inside the ring carries the count
instead, the way a tally mark does, without touching the ring or its flares.

    empty     a dim, hollow ring -- barely there
    occupied  the ring in bone, its flares quiet
    active    the ring lit blood, flares bright: the moment it reads as a save point
    urgent    the same, with a second ring pulsing outward

    gen-halo-workspace.py     writes bar/modules/ito-art/workspaces/ws-halo-<n>-<state>.png
"""

from __future__ import annotations

import math
from pathlib import Path

from engrave import BLOOD, BONE, DIM, INK, blood, canvas, ellipse, finish, gp, pen

OUT = Path(__file__).resolve().parent.parent / "bar" / "modules" / "ito-art" / "workspaces"
CX, CY = 320, 320
RING_R = 148

STATES = ("empty", "occupied", "active", "urgent")


def tally(img, n, dim, on_blood):
    """1 to 5 solid dots in a row, a thin ring around the group for 6 to 10 -- a count, not a redraw of
    the halo itself. Bone always, so it holds against ink or against the blood disc alike; bold enough
    (radius 13) to survive being shrunk to icon size."""
    group = (n - 1) % 5 + 1
    r = 13
    gap = 34
    total_w = (group - 1) * gap
    y = CY + RING_R * 0.42
    fill = DIM if dim else BONE
    for k in range(group):
        x = CX - total_w / 2 + k * gap
        gp.ImageDraw.Draw(img).ellipse((x - r, y - r, x + r, y + r), fill=fill + (255,))
        if on_blood:
            gp.ImageDraw.Draw(img).ellipse((x - r, y - r, x + r, y + r), outline=INK + (255,), width=3)
    if n > 5:
        rr = total_w / 2 + r + 14
        pen(img, ellipse(CX, y, rr, rr * 0.62), 5, fill, closed=True, echo=False)


def halo(state: str, n: int):
    img = canvas()
    lit = state in ("active", "urgent")
    dim = state == "empty"
    col = BLOOD if lit else (DIM if dim else BONE)

    # the flares, alternating long and short, radiating out of the ring -- the same drawing at every n
    rays = 24
    for i in range(rays):
        a = i / rays * 2 * math.pi
        long_ray = i % 2 == 0
        r0 = RING_R + 8
        r1 = RING_R + (66 if long_ray else 36)
        x0, y0 = CX + math.cos(a) * r0, CY + math.sin(a) * r0
        x1, y1 = CX + math.cos(a) * r1, CY + math.sin(a) * r1
        w = (7.0, 11.0) if long_ray else (4.0, 7.0)
        gp.ink(img, [(x0, y0), (x1, y1)], w[0], w[1], col, wobble=0.7, pressure=True)

    # the ring itself, and the disc it holds when lit
    if lit:
        blood(img, ellipse(CX, CY, RING_R * 0.58, RING_R * 0.58), None, hatchy=False)
    pen(img, ellipse(CX, CY, RING_R, RING_R), 8 if dim else 15, col, closed=True, echo=not dim)

    if state == "urgent":
        pen(img, ellipse(CX, CY, RING_R + 86, RING_R + 86), 5, BLOOD, closed=True, echo=False)

    tally(img, n, dim, on_blood=lit)

    return img


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("ws-halo-*"):
        old.unlink()
    count = 0
    for n in range(1, 11):
        for i, state in enumerate(STATES):
            finish(halo(state, n), seed=210 + n * 4 + i).save(OUT / f"ws-halo-{n}-{state}.png")
            count += 1
    print(f"wrote {count} halo workspace marks -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
