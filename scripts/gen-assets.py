#!/usr/bin/env python3
"""Normalise the bar artwork from the source icon set.

Two defects live in the source PNGs and both show up in the bar:

1. Inconsistent padding. Every icon is a 64x64 canvas, but how much of it the
   drawing actually occupies swings from 100% (workspace orbs) to 47% (the
   Tomie mark). Rendered into one uniform box, that puts a 30px orb next to a
   9px seal. Each icon is trimmed to its content and re-padded so they all
   carry the same visual weight.

2. Reds hotter than the theme. The baked reds sit near 97% saturation while the
   palette lives at 63%. Red pixels are re-tinted onto the ramp hue at the
   saturation palette.toml asks for, keeping each pixel's own lightness so the
   ink shading and the paper grain survive.

Usage:
    gen-assets.py --check        report what would change, write nothing
    gen-assets.py                write the normalised set into the live modules
    gen-assets.py --out DIR      write somewhere else
"""

import argparse
import colorsys
import sys
import tomllib
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent
PALETTE = REPO / "themes" / "ito-verse" / "palette.toml"
SOURCE = REPO / "assets" / "icons-precision" / "64"
DEFAULT_OUT = Path.home() / ".config" / "omarchy" / "bar" / "modules" / "ito-assets"

# Source categories that feed the bar. Everything else in the sheet is unused.
CATEGORIES = [
    "workspaces", "workspace-indicators", "workspace-labels", "system",
    "status-eyes", "tomie", "battery", "audio", "bluetooth", "brightness",
    "media", "notifications", "quickshell", "calendar", "misc",
    "devices", "places", "apps",
]


def load_palette() -> dict:
    with PALETTE.open("rb") as fh:
        return tomllib.load(fh)


def hue_of(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return colorsys.rgb_to_hls(r, g, b)[0]


def is_red(r: int, g: int, b: int, floor: int, dominance: float) -> bool:
    return r >= floor and r > g * dominance and r > b * dominance


def strip_caption(img: Image.Image, cfg: dict) -> tuple[Image.Image, bool]:
    """Erase the filename caption the sheet extraction baked into the art.

    Every icon was cropped out of the design sheet together with the little
    label printed under it, so the bar was literally rendering the word
    "blood-splatter" beneath the splatter. A caption is a detached blob at the
    bottom of the canvas that is far wider than it is tall. The aspect test is
    what keeps the second character of the Tomie seal, which is also detached,
    from being mistaken for one.
    """
    img = img.convert("RGBA")
    alpha = img.getchannel("A")
    width, height = img.size
    rows = [
        sum(1 for v in alpha.crop((0, y, width, y + 1)).getdata() if v > 12)
        for y in range(height)
    ]

    last = max((y for y, c in enumerate(rows) if c > 0), default=-1)
    if last < 0:
        return img, False

    y = last
    while y >= 0 and rows[y] > 0:
        y -= 1
    blob_top = y + 1
    while y >= 0 and rows[y] == 0:
        y -= 1
    gap = blob_top - y - 1
    blob_height = last - blob_top + 1

    if y < 0 or gap < 2 or blob_height > height * 0.25:
        return img, False

    blob = img.crop((0, blob_top, width, last + 1)).getbbox()
    if blob is None:
        return img, False
    blob_width = blob[2] - blob[0]
    if blob_width < blob_height * cfg["caption_aspect"]:
        return img, False  # too square to be a line of text

    out = img.copy()
    out.paste((0, 0, 0, 0), (0, blob_top, width, last + 1))
    return out, True


def retint(img: Image.Image, hue: float, sat: float, cfg: dict) -> tuple[Image.Image, int]:
    """Move red pixels onto the palette hue, keeping their own lightness."""
    img = img.convert("RGBA")
    pixels = img.load()
    floor = cfg["red_min_channel"]
    dominance = cfg["red_dominance"]
    touched = 0

    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = pixels[x, y]
            if a == 0 or not is_red(r, g, b, floor, dominance):
                continue
            # Lightness is the pixel's own; only hue and saturation are replaced.
            _, lightness, _ = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            lightness = min(lightness, cfg.get("red_max_lightness", 1.0))
            nr, ng, nb = colorsys.hls_to_rgb(hue, lightness, sat)
            pixels[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
            touched += 1
    return img, touched


def category_scale(images: list[Image.Image], canvas: int, fraction: float) -> float:
    """One scale factor per category.

    Scaling each icon to fill its own canvas would flatten differences that are
    meant to be there - the empty workspace dot is smaller than the active one
    on purpose. Taking the largest drawing in a category as the reference keeps
    those relationships intact while still making categories match each other.
    """
    widest = highest = 1
    for img in images:
        box = img.getbbox()
        if box is None:
            continue
        widest = max(widest, box[2] - box[0])
        highest = max(highest, box[3] - box[1])
    target = canvas * fraction
    return min(target / widest, target / highest)


def normalise(img: Image.Image, canvas: int, scale: float) -> Image.Image:
    """Trim to content, apply the category scale, centre on a fresh canvas."""
    img = img.convert("RGBA")
    box = img.getbbox()
    if box is None:
        return Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))

    content = img.crop(box)
    size = (max(1, round(content.width * scale)), max(1, round(content.height * scale)))
    if size[0] > canvas or size[1] > canvas:
        shrink = min(canvas / size[0], canvas / size[1])
        size = (max(1, round(size[0] * shrink)), max(1, round(size[1] * shrink)))
    content = content.resize(size, Image.LANCZOS)

    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(content, ((canvas - size[0]) // 2, (canvas - size[1]) // 2))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="report only, write nothing")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    palette = load_palette()
    cfg = palette["assets"]
    hue = hue_of(palette["blood"]["base"])
    sat = cfg["red_saturation"]
    canvas = cfg["canvas"]
    fraction = cfg["content_fraction"]

    if not SOURCE.is_dir():
        print(f"error: source icon set not found at {SOURCE}", file=sys.stderr)
        return 1

    groups = []
    for category in CATEGORIES:
        directory = SOURCE / category
        if directory.is_dir():
            paths = sorted(directory.glob("*.png"))
            if paths:
                groups.append((category, paths))

    if not groups:
        print("error: no source icons found", file=sys.stderr)
        return 1

    print(f"hue {hue * 360:.1f} deg   saturation {sat:.0%}   "
          f"canvas {canvas}px at {fraction:.0%}\n")
    print(f"{'icon':<26}{'content in':>12}{'content out':>13}{'red px':>9}")
    print("-" * 60)

    if not args.check:
        args.out.mkdir(parents=True, exist_ok=True)

    changed = 0
    for category, paths in groups:
        tinted = []
        reds = []
        for path in paths:
            clean, had_caption = strip_caption(Image.open(path), cfg)
            img, touched = retint(clean, hue, sat, cfg)
            tinted.append(img)
            reds.append((touched, had_caption))

        scale = category_scale(tinted, canvas, fraction)
        print(f"[{category}]  scale x{scale:.2f}")

        for path, img, (touched, had_caption) in zip(paths, tinted, reds):
            before = img.getbbox()
            before_size = f"{before[2] - before[0]}x{before[3] - before[1]}" if before else "empty"
            out = normalise(img, canvas, scale)
            after = out.getbbox()
            after_size = f"{after[2] - after[0]}x{after[3] - after[1]}" if after else "empty"

            flag = "  caption stripped" if had_caption else ""
            print(f"  {path.name:<24}{before_size:>12}{after_size:>13}{touched:>9}{flag}")
            if not args.check:
                out.save(args.out / path.name)
            changed += 1

    print(f"\n{changed} icons {'checked' if args.check else 'written to ' + str(args.out)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
