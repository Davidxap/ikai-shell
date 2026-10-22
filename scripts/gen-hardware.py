#!/usr/bin/env python3
"""The hardware readings: CPU (a chip), memory (a RAM module) and disk (a platter), one set.

Each is a drawing plus a solid silhouette of its body. The shell fills the silhouette with blood up to the level in
use (ItoFillArt) and lays the drawing over it, so the icon says what it is by its shape and how full it is by its
blood. The creatures live inside them: a spiral in the chip, three eyes in the memory, a hub in the disk.

    gen-hardware.py     writes bar/modules/ito-art/system/{cpu,mem,disk}.png and {cpu,mem,disk}-fill.png
"""
import math
import subprocess
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from iconfit import bbox_of, fit  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "bar" / "modules" / "ito-art" / "system"
BONE, BLOOD, INK = "#c7ccd1", "#c4162a", "#08090a"
S = 512


def svg(b):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}">{b}</svg>'


def st(d, c=BONE, w=24):
    return f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'


def spiral(cx, cy, r, turns, w, c):
    pts = [(cx + math.cos(t * turns * math.tau) * r * t, cy + math.sin(t * turns * math.tau) * r * t)
           for t in [i / 140 for i in range(141)]]
    return st("M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts), c, w)


def eye(cx, cy, w, h, c=BONE, iris=BLOOD):
    return (f'<path d="M{cx - w} {cy} Q {cx} {cy - h * 1.6} {cx + w} {cy} Q {cx} {cy + h * 1.6} {cx - w} {cy} Z" '
            f'fill="none" stroke="{c}" stroke-width="14" stroke-linejoin="round"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{h * 0.66}" fill="{iris}"/><circle cx="{cx}" cy="{cy}" r="{h * 0.26}" fill="{INK}"/>')


def cpu():
    body = '<rect x="118" y="118" width="276" height="276" rx="36"/>'
    art = f'<rect x="118" y="118" width="276" height="276" rx="36" fill="none" stroke="{BONE}" stroke-width="24"/>' \
          + spiral(256, 256, 86, 2.4, 15, BLOOD)
    for k in range(4):
        p = 168 + k * 58
        art += st(f"M{p} 118 V62", BONE, 18) + st(f"M{p} 394 V450", BONE, 18) + st(f"M118 {p} H62", BONE, 18) + st(f"M394 {p} H450", BONE, 18)
    return svg(art), svg(body.replace("/>", f' fill="#fff"/>'))


def mem():
    body = '<rect x="64" y="112" width="384" height="250" rx="26"/>'
    art = f'<rect x="64" y="112" width="384" height="250" rx="26" fill="none" stroke="{BONE}" stroke-width="24"/>'
    for k in range(3):
        art += eye(256, 168 + k * 74, 96, 22, BONE, BLOOD if k == 1 else BONE) if False else ""
    # three chips on the module, each with its eye, side by side
    for k in range(3):
        cx = 130 + k * 126
        art += f'<rect x="{cx - 46}" y="160" width="92" height="118" rx="12" fill="none" stroke="{BONE}" stroke-width="12"/>'
        art += eye(cx, 219, 34, 17, BONE, BLOOD if k == 1 else BONE)
    art += st("M110 362 v58 M170 362 v58 M230 362 v58 M290 362 v58 M350 362 v58 M410 362 v58", BONE, 16)
    return svg(art), svg(body.replace("/>", ' fill="#fff"/>'))


def disk():
    body = '<circle cx="256" cy="256" r="196"/>'
    art = f'<circle cx="256" cy="256" r="196" fill="none" stroke="{BONE}" stroke-width="24"/>' \
          f'<circle cx="256" cy="256" r="62" fill="{INK}" stroke="{BONE}" stroke-width="18"/><circle cx="256" cy="256" r="18" fill="{BLOOD}"/>' \
          + st("M256 256 L392 158", BONE, 16)
    return svg(art), svg(body.replace("/>", ' fill="#fff"/>'))


def raster(markup, size=512):
    tmp = OUT / "hw.svg.tmp"
    tmp.write_text(markup)
    dst = OUT / "hw.tmp.png"
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), str(tmp), "-o", str(dst)], check=True)
    tmp.unlink()
    im = Image.open(dst).convert("RGBA")
    dst.unlink()
    return im


def main():
    for name, fn in (("cpu", cpu), ("mem", mem), ("disk", disk)):
        art, fill = fn()
        a, f = raster(art), raster(fill)
        # the drawing and its silhouette share one transform, fitted by the drawing's ink
        box = bbox_of(a)
        fit(a, box).resize((256, 256), Image.LANCZOS).save(OUT / f"{name}.png")
        fit(f, box).resize((256, 256), Image.LANCZOS).save(OUT / f"{name}-fill.png")
        print("wrote", name)


if __name__ == "__main__":
    main()
