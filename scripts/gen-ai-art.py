#!/usr/bin/env python3
"""The AI usage icon, in several forms. Each is a drawing plus a solid silhouette of its inside: the shell
fills the silhouette with blood to the level of the quota spent, and lays the drawing over it (ItoFillArt).

    hemispheres   the brain seen from above, two halves with their folds
    neurons       a small net of cells joined by fibres
    eye           her eye; the white of it floods
    spiral        the spiral, filling like a glass

The side-view brain (brain.png) is the original and stays as it is. All are 512px, the drawing kept inside
the middle 76% of the height because the fill is measured over that box.

    gen-ai-art.py    writes bar/modules/ito-art/system/ai-<name>.png and ai-<name>-fill.png
"""

from __future__ import annotations

import math
import random
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "bar" / "modules" / "ito-art" / "system"

BONE = "#c7ccd1"
DIM = "#8e959c"
BLOOD = "#c4162a"
S = 512
C = S / 2
TOP, BOT = 61, 451


def svg(body: str, defs: str = "") -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}"><defs>{defs}</defs>{body}</svg>'


def stroke(d, color=BONE, w=10, extra=""):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'


def pts(points):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in points)


# ----------------------------------------------------------------------------------------------- hemispheres
LEFT = "M248 63 C 168 56 104 130 108 256 C 112 382 170 454 248 449 Z"
RIGHT = "M264 63 C 344 56 408 130 404 256 C 400 382 342 454 264 449 Z"


def folds(side: int, seed: int) -> str:
    """Wavy folds across one half: the gyri, drawn as meandering lines that follow the curve of the half."""
    rng = random.Random(seed)
    out = ""
    y = 96
    while y < 430:
        pts_ = []
        x0, x1 = (118, 244) if side < 0 else (268, 394)
        phase = rng.uniform(0, math.tau)
        amp = rng.uniform(9, 17)
        freq = rng.uniform(0.07, 0.11)
        for i in range(0, 41):
            x = x0 + (x1 - x0) * i / 40
            pts_.append((x, y + math.sin(x * freq + phase) * amp + math.sin(x * 0.21 + phase * 2) * 5))
        out += f'<polyline points="{pts(pts_)}" fill="none" stroke="{BONE}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'
        y += rng.uniform(30, 40)
    return out


def hemispheres():
    clip = f'<clipPath id="l"><path d="{LEFT}"/></clipPath><clipPath id="r"><path d="{RIGHT}"/></clipPath>'
    body = (f'<g clip-path="url(#l)">{folds(-1, 7)}</g><g clip-path="url(#r)">{folds(1, 19)}</g>'
            f'<path d="{LEFT}" fill="none" stroke="{BONE}" stroke-width="16" stroke-linejoin="round"/>'
            f'<path d="{RIGHT}" fill="none" stroke="{BONE}" stroke-width="16" stroke-linejoin="round"/>')
    fill = f'<path d="{LEFT}" fill="#fff"/><path d="{RIGHT}" fill="#fff"/>'
    return svg(body, clip), svg(fill)


# ---------------------------------------------------------------------------------------------- neurons
def neurons():
    rng = random.Random(3)
    nodes = []
    ring = [(C + math.cos(a) * 150, 256 + math.sin(a) * 178) for a in [k / 9 * math.tau for k in range(9)]]
    nodes += ring
    nodes += [(C - 60, 210), (C + 66, 236), (C - 20, 316), (C + 30, 150), (C, 256)]
    links = []
    for i, (x, y) in enumerate(nodes):
        near = sorted(range(len(nodes)), key=lambda j: (nodes[j][0] - x) ** 2 + (nodes[j][1] - y) ** 2)[1:3]
        for j in near:
            if (j, i) not in links:
                links.append((i, j))
    art = "".join(stroke(f"M{nodes[i][0]:.1f} {nodes[i][1]:.1f} L {nodes[j][0]:.1f} {nodes[j][1]:.1f}", BONE, 8) for i, j in links)
    art += "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="22" fill="none" stroke="{BONE}" stroke-width="12"/>' for x, y in nodes)
    fill = "".join(f'<path d="M{nodes[i][0]:.1f} {nodes[i][1]:.1f} L {nodes[j][0]:.1f} {nodes[j][1]:.1f}" stroke="#fff" stroke-width="16" stroke-linecap="round"/>' for i, j in links)
    fill += "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="27" fill="#fff"/>' for x, y in nodes)
    return svg(art), svg(fill)


# --------------------------------------------------------------------------------------------------- eye
ALMOND = "M52 256 C 130 130 382 130 460 256 C 382 382 130 382 52 256 Z"


def eye():
    art = (f'<path d="{ALMOND}" fill="none" stroke="{BONE}" stroke-width="22" stroke-linejoin="round"/>'
           f'<circle cx="256" cy="256" r="82" fill="none" stroke="{BONE}" stroke-width="18"/>'
           f'<circle cx="256" cy="256" r="34" fill="{BONE}"/><circle cx="236" cy="236" r="10" fill="#08090a"/>')
    for k in range(-3, 4):                                       # the lashes
        a = math.radians(-90 + k * 22)
        x0, y0 = 256 + math.cos(a) * 128, 256 + math.sin(a) * 90 - 26
        art += stroke(f"M{x0:.1f} {y0:.1f} L {256 + math.cos(a) * 178:.1f} {256 + math.sin(a) * 118 - 50:.1f}", BONE, 9)
    fill = f'<path d="{ALMOND}" fill="#fff"/>'
    return svg(art), svg(fill)


# ------------------------------------------------------------------------------------------------ spiral
def spiral():
    left, right = [], []
    n = 320
    for i in range(n + 1):
        t = i / n
        a = t * 3.0 * math.tau
        r = 14 + (196 - 14) * t
        w = (12 + 14 * t) / 2
        nx, ny = math.cos(a), math.sin(a)
        x, y = C + nx * r, 256 + ny * r
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    art = f'<polygon points="{pts(left + right[::-1])}" fill="{BONE}"/><circle cx="{C}" cy="256" r="214" fill="none" stroke="{BONE}" stroke-width="14"/>'
    fill = f'<circle cx="{C}" cy="256" r="214" fill="#fff"/>'
    return svg(art), svg(fill)


VARIANTS = {"hemispheres": hemispheres, "neurons": neurons, "eye": eye, "spiral": spiral}


def raster(name: str, markup: str, size: int = 512):
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = OUT / f"{name}.svg.tmp"
    dst = OUT / f"{name}.png"
    tmp.write_text(markup)
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), str(tmp), "-o", str(dst)], check=True)
    tmp.unlink()


def main() -> int:
    for key, fn in VARIANTS.items():
        art, fill = fn()
        raster(f"ai-{key}", art)
        raster(f"ai-{key}-fill", fill)
        print("wrote ai-" + key)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
