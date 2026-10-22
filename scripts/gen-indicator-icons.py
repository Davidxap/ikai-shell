#!/usr/bin/env python3
"""The indicator icons, each in several versions the user can choose between, some of them cameos.

Omarchy's toggles (stay awake, night light, screen recording) are drawn twice each, off and on, in every
version. On is where the blood is.

    stay awake     coffee (a cup that fills with blood) · radio (Silent Hill's pocket radio, hissing) ·
                   flashlight (its light held on)
    night light    moon · fog (Silent Hill's fog, with the red sun behind it)
    recording      eye (opens, ringed) · tape (Silent Hill 2's videotape, the red light on)

    gen-indicator-icons.py    writes bar/modules/ito-art/indicators/<id>-<version>-<off|on>.png
"""

from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from iconfit import fit

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "bar" / "modules" / "ito-art" / "indicators"

BONE = "#c7ccd1"
DIM = "#8e959c"
BLOOD = "#c4162a"
INK = "#08090a"
W = 32
S = 512


def svg(body: str, defs: str = "") -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}"><defs>{defs}</defs>{body}</svg>'


def line(d, color=BONE, w=W, extra=""):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'


# ------------------------------------------------------------------------------------------------- awake
CUP = "M112 196 L 112 338 C 112 404 164 446 236 446 L 288 446 C 360 446 400 404 400 338 L 400 196 Z"


def coffee(on: bool) -> str:
    body = ""
    if on:
        body += f'<defs><clipPath id="c"><path d="{CUP}"/></clipPath></defs>'
        body += f'<g clip-path="url(#c)"><rect x="100" y="246" width="320" height="220" fill="{BLOOD}"/></g>'
        body += line("M176 150 C 150 118 200 96 174 62", BLOOD, 22) + line("M256 150 C 230 118 280 96 254 62", BLOOD, 22)
        body += f'<path d="M336 200 L 336 236 C 336 262 372 262 372 236 L 372 200 Z" fill="{BLOOD}"/>'   # a drip over the rim
    body += line(CUP, BONE if on else DIM)
    body += line("M400 236 C 478 236 478 350 400 350", BONE if on else DIM)
    body += line("M72 478 L 440 478", BONE if on else DIM, 26)
    return svg(body)


def radio(on: bool) -> str:
    c = BONE if on else DIM
    body = f'<rect x="96" y="196" width="320" height="252" rx="34" fill="none" stroke="{c}" stroke-width="{W}"/>'
    body += line("M352 196 L 424 56", c, 26)
    body += f'<circle cx="196" cy="322" r="66" fill="none" stroke="{c}" stroke-width="22"/>'
    for y in (296, 322, 348):
        body += line(f"M164 {y} L 228 {y}", c, 12)
    body += f'<circle cx="352" cy="262" r="20" fill="{BLOOD if on else c}"/>' + line("M312 340 L 392 340", c, 16) + line("M312 386 L 392 386", c, 16)
    if on:                                                       # the static: it hisses when they are near
        for r in (56, 100):
            a0, a1 = math.radians(200), math.radians(290)
            cx, cy = 424, 56
            body += line(f"M{cx + math.cos(a0) * r:.1f} {cy - math.sin(a0) * r * -1:.1f} A {r} {r} 0 0 1 {cx + math.cos(a1) * r:.1f} {cy - math.sin(a1) * r * -1:.1f}", BLOOD, 18)
    return svg(body)


def flashlight(on: bool) -> str:
    c = BONE if on else DIM
    body = f'<rect x="250" y="216" width="196" height="80" rx="20" fill="none" stroke="{c}" stroke-width="{W}"/>'
    body += f'<polygon points="250,190 250,322 132,368 132,144" fill="none" stroke="{c}" stroke-width="{W}" stroke-linejoin="round"/>'
    body += line("M340 216 L 340 296", c, 16)
    if on:
        body += f'<polygon points="132,144 132,368 118,256" fill="{BLOOD}"/>'
        for dy, ln in ((-120, 90), (-60, 110), (0, 120), (60, 110), (120, 90)):
            body += line(f"M104 {256 + dy * 0.55:.1f} L {104 - ln * 0.6:.1f} {256 + dy:.1f}", BLOOD, 18)
    return svg(body)


# ------------------------------------------------------------------------------------------------- night
def moon(on: bool) -> str:
    d = "M316 52 A 210 210 0 1 0 462 322 A 170 170 0 0 1 316 52 Z"
    if on:
        body = f'<path d="{d}" fill="{BLOOD}" stroke="{BLOOD}" stroke-width="{W}" stroke-linejoin="round"/>'
        body += f'<circle cx="378" cy="120" r="12" fill="{BONE}"/><circle cx="430" cy="196" r="9" fill="{BONE}"/>'
    else:
        body = f'<path d="{d}" fill="none" stroke="{DIM}" stroke-width="{W}" stroke-linejoin="round"/>'
    return svg(body)


def fog(on: bool) -> str:
    c = BONE if on else DIM
    body = ""
    if on:
        body += f'<circle cx="352" cy="170" r="86" fill="{BLOOD}"/>'      # the red sun the fog hides
    rows = ((196, 60, 380), (272, 90, 452), (348, 50, 400), (424, 110, 470))
    for y, x0, x1 in rows:
        body += line(f"M{x0} {y} q {(x1 - x0) / 6:.0f} -26 {(x1 - x0) / 3:.0f} 0 t {(x1 - x0) / 3:.0f} 0 t {(x1 - x0) / 3:.0f} 0", c, 26)
    return svg(body)


# ---------------------------------------------------------------------------------------------- record
def eye_rec(on: bool) -> str:
    almond = "M50 256 C 128 130 384 130 462 256 C 384 382 128 382 50 256 Z"
    if on:
        body = f'<path d="{almond}" fill="none" stroke="{BLOOD}" stroke-width="{W}" stroke-linejoin="round"/>'
        body += f'<circle cx="256" cy="256" r="72" fill="none" stroke="{BLOOD}" stroke-width="24"/><circle cx="256" cy="256" r="30" fill="{BLOOD}"/>'
        body += f'<circle cx="256" cy="256" r="232" fill="none" stroke="{BLOOD}" stroke-width="12" stroke-dasharray="4 26"/>'
    else:
        body = line("M50 256 C 128 340 384 340 462 256", DIM, W)
        for k in (-2, -1, 0, 1, 2):
            a = math.radians(90 + k * 26)
            body += line(f"M{256 + math.cos(a) * 170:.1f} {300 + math.sin(a) * 40:.1f} L {256 + math.cos(a) * 214:.1f} {300 + math.sin(a) * 62:.1f}", DIM, 18)
    return svg(body)


def tape(on: bool) -> str:
    c = BONE if on else DIM
    body = f'<rect x="56" y="130" width="400" height="252" rx="26" fill="none" stroke="{c}" stroke-width="{W}"/>'
    body += f'<rect x="150" y="300" width="212" height="56" rx="14" fill="none" stroke="{c}" stroke-width="20"/>'
    for cx in (166, 346):
        body += f'<circle cx="{cx}" cy="226" r="42" fill="none" stroke="{BLOOD if on else c}" stroke-width="22"/>'
    if on:
        body += f'<circle cx="420" cy="102" r="30" fill="{BLOOD}"/>'
    return svg(body)


ICONS = {
    ("awake", "coffee"): coffee, ("awake", "radio"): radio, ("awake", "flashlight"): flashlight,
    ("night", "moon"): moon, ("night", "fog"): fog,
    ("record", "eye"): eye_rec, ("record", "tape"): tape,
}


# fit() centres every icon by the geometric middle of its ink, which is right for a shape whose ink is spread
# evenly (a ring, a chip). The coffee cup is not: two thin wisps of steam sit far above a solid cup and saucer, so
# the *geometric* box is centred but the *drawing* still reads low, sitting under the radio and the flashlight
# that share its row. This nudges it back up by the same pixels its own ink is heavier below the middle than
# above -- worked out from the drawing, not guessed.
NUDGE_Y = {("awake", "coffee"): -20}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for (ident, version), fn in ICONS.items():
        nudge = NUDGE_Y.get((ident, version), 0)
        for state, on in (("off", False), ("on", True)):
            tmp = OUT / "t.svg"
            dst = OUT / f"{ident}-{version}-{state}.png"
            tmp.write_text(fn(on))
            subprocess.run(["rsvg-convert", "-w", "256", "-h", "256", str(tmp), "-o", str(dst)], check=True)
            tmp.unlink()
            fitted = fit(Image.open(dst).convert("RGBA"))
            if nudge:
                shifted = Image.new("RGBA", fitted.size, (0, 0, 0, 0))
                shifted.alpha_composite(fitted, (0, nudge))
                fitted = shifted
            fitted.save(dst)
    print(f"wrote {len(ICONS) * 2} indicator icons -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
