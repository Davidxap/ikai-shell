"""Shared pieces for the engraved icons: the pen and the shading of gen-premium.py, wrapped so an icon is
described by its shapes. Each icon is drawn at 640, worn a little, brought down to 256 and put on the same footing
as every other (iconfit)."""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("gen_premium", HERE / "gen-premium.py")
gp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gp)

from iconfit import fit  # noqa: E402

S = gp.S
BONE, DIM, BLOOD = gp.BONE, gp.BONE_DIM, gp.BLOOD
INK = (10, 12, 14)


def canvas():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def ellipse(cx, cy, rx, ry, a0=0.0, a1=math.tau, n=90):
    return gp.arc(cx, cy, rx, ry, a0, a1, n)


def mask_of(poly):
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return m


def pen(layer, pts, w=17, color=BONE, closed=False, echo=True, wobble=1.8):
    """The heavy stroke, and a thin one gone over beside it, the way the brain and the jar are done."""
    line = pts + pts[:1] if closed else pts
    gp.ink(layer, line, w * 0.88, w * 1.2, color, wobble=wobble, pressure=False)
    if echo and w >= 12:
        gp.ink(layer, [(x + 4, y + 3) for x, y in line[1:-1]] if len(line) > 3 else line, 3.5, 5.5,
               DIM if color == BONE else color, wobble=2.4, pressure=False)


def hatch_poly(layer, poly, angle=38, gap=13, width=3, strength=0.8, color=DIM, region=None):
    layer.alpha_composite(gp.hatch(mask_of(poly), color, math.radians(angle), gap, width, strength, region=region))


def fade(cx, cy, r, inner=0, outer=255):
    """Shade that gathers away from (cx, cy): the light side stays clear."""
    return gp.gradient(S, cx, cy, r, inner=inner, outer=outer)


def solid(layer, poly, color, alpha=255):
    m = mask_of(poly)
    fillc = Image.new("RGBA", (S, S), color + (255,))
    fillc.putalpha(m.point(lambda v: v * alpha // 255))
    layer.alpha_composite(fillc)


def blood(layer, poly, top_y=None, hatchy=True):
    """Blood standing in a shape: solid, dark toward the bottom, with dark hatching so it is engraved and not painted."""
    m = mask_of(poly)
    if top_y is not None:
        cut = Image.new("L", (S, S), 0)
        ImageDraw.Draw(cut).rectangle((0, top_y, S, S), fill=255)
        m = ImageChops.multiply(m, cut)
    grad = gp.gradient(S, S / 2, S, S * 0.7, inner=255, outer=150, invert=False)
    body = Image.new("RGBA", (S, S), BLOOD + (255,))
    body.putalpha(ImageChops.multiply(m, grad))
    layer.alpha_composite(body)
    if hatchy:
        h = gp.hatch(m, (110, 8, 20), math.radians(-40), 12, 3, 0.55)
        layer.alpha_composite(h)


def finish(img: Image.Image, seed=5, wear=0.42, out=256) -> Image.Image:
    img = gp.wear(img, wear, seed=seed).resize((out, out), Image.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=70, threshold=2))
    return fit(img)


def save(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
