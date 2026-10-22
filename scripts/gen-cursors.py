#!/usr/bin/env python3
"""Build the Ito-verse mouse cursor theme from the design sheet's cursor art.

Writes an Xcursor theme (works in Hyprland, GTK, Qt, XWayland, browsers) to
~/.local/share/icons/Ito-verse by default. Installing it changes nothing on its own:
the cursor only changes when something selects the theme.

  - Art: assets/native/cursor/*, recoloured to the palette like the rest of the bar art.
  - Legibility: the sheet draws pale outlines with an empty inside, made for a dark
    background. On a white page they vanish, so every cursor gets a dark backing (the
    silhouette, filled, plus a one-pixel halo) under the art.
  - Resizing: the sheet has one diagonal resize cursor; the horizontal and vertical ones
    are that art rotated to level, and the other diagonal is its mirror.
  - Busy: the Uzumaki spiral, turning. `wait` is the spiral alone; `progress` is the arrow
    with a small spiral beside it.
  - Anything not drawn here (help, crosshair, zoom...) falls back to Adwaita.

The xcursorgen tool is not needed: the format is small, so it is written directly.

    gen-cursors.py                 build and install
    gen-cursors.py --out DIR       build somewhere else
    gen-cursors.py --preview P.png also render a legibility sheet (dark and light)
"""

import argparse
import importlib.util
import math
import struct
import sys
import tomllib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

REPO = Path(__file__).resolve().parent.parent
NATIVE = REPO / "assets" / "native"
SIZES = [24, 32, 48]
INK = (10, 12, 14)
SPIN_FRAMES = 12
SPIN_DELAY = 70  # ms


def _load_gen_assets():
    spec = importlib.util.spec_from_file_location("gen_assets", REPO / "scripts" / "gen-assets.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


GA = _load_gen_assets()


def palette_tint(img: Image.Image) -> Image.Image:
    with (REPO / "themes" / "ito-verse" / "palette.toml").open("rb") as fh:
        pal = tomllib.load(fh)
    hue = GA.hue_of(pal["blood"]["base"])
    tinted, _ = GA.retint(img, hue, pal["assets"]["red_saturation"], pal["assets"])
    return tinted


def art(name: str) -> Image.Image:
    return palette_tint(Image.open(NATIVE / name).convert("RGBA"))


# ---------------------------------------------------------------- geometry

def content_box(img: Image.Image, thresh: int = 90):
    a = np.asarray(img)[..., 3]
    ys, xs = np.where(a > thresh)
    return xs.min(), ys.min(), xs.max(), ys.max()


def tip(img: Image.Image, thresh: int = 90):
    """Top-most opaque pixel, left-most among the top rows: an arrow's point."""
    a = np.asarray(img)[..., 3]
    ys, xs = np.where(a > thresh)
    top = ys.min()
    return int(xs[ys <= top + 1].min()), int(top)


def major_axis_degrees(img: Image.Image) -> float:
    """Visual angle (counter-clockwise from horizontal) of the shape's long axis."""
    a = np.asarray(img)[..., 3] > 90
    ys, xs = np.where(a)
    x, y = xs - xs.mean(), -(ys - ys.mean())          # y up
    cov = np.cov(np.vstack([x, y]))
    theta = 0.5 * math.atan2(2 * cov[0, 1], cov[0, 0] - cov[1, 1])
    return math.degrees(theta)


def scaled(img: Image.Image, factor: float) -> Image.Image:
    w, h = max(1, round(img.width * factor)), max(1, round(img.height * factor))
    return img.resize((w, h), Image.LANCZOS)


def backed(img: Image.Image) -> Image.Image:
    """Dark silhouette + halo under the art so it reads on any background."""
    a = np.asarray(img)[..., 3] > 40
    pad = 4
    mask = Image.fromarray((np.pad(a, pad) * 255).astype(np.uint8))
    fill = mask.copy()
    ImageDraw.floodfill(fill, (0, 0), 128)             # background reachable from the border
    inside = np.asarray(fill) != 128                   # ink or enclosed => solid
    solid = Image.fromarray((inside * 255).astype(np.uint8))
    halo = solid.filter(ImageFilter.MaxFilter(3))
    layer = Image.new("RGBA", solid.size, INK + (0,))
    layer.putalpha(halo.point(lambda v: 235 if v else 0))
    padded_art = Image.new("RGBA", solid.size, (0, 0, 0, 0))
    padded_art.paste(img, (pad, pad))
    layer.alpha_composite(padded_art)
    return layer, pad


def place(canvas_size: int, img: Image.Image, anchor):
    """Backed art on a transparent square canvas. anchor=(x, y) is where the hotspot
    lands; returns (canvas, hotspot_x, hotspot_y)."""
    layer, pad = backed(img)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    hx, hy = anchor
    return canvas, layer, pad, hx, hy


def cursor_frame(name: str, nominal: int, hotspot: str, rotate: float = 0.0,
                 mirror: bool = False, extra=None):
    """Compose one cursor at one nominal size. hotspot is 'tip' or 'center'."""
    src = art(name)
    if mirror:
        src = src.transpose(Image.FLIP_LEFT_RIGHT)
    if rotate:
        src = src.rotate(rotate, resample=Image.BICUBIC, expand=True)
    x0, y0, x1, y1 = content_box(src)
    src = src.crop((x0 - 1, y0 - 1, x1 + 2, y1 + 2))
    factor = min(1.0, 0.9 * nominal / src.height)
    src = scaled(src, factor)

    layer, pad = backed(src)
    size = nominal + 8
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if hotspot == "tip":
        tx, ty = tip(src)
        ox, oy = 2, 2
        canvas.alpha_composite(layer, (ox - pad + 0, oy - pad + 0))
        hx, hy = ox + tx, oy + ty
    else:
        ox = (size - layer.width) // 2
        oy = (size - layer.height) // 2
        canvas.alpha_composite(layer, (ox, oy))
        hx, hy = size // 2, size // 2
    if extra:
        canvas = extra(canvas, nominal)
    return canvas, int(hx), int(hy)


def spiral_frames(nominal: int, with_arrow: bool):
    base = art("system/system-active.png")
    x0, y0, x1, y1 = content_box(base)
    base = base.crop((x0, y0, x1 + 1, y1 + 1))
    frames = []
    for i in range(SPIN_FRAMES):
        turn = base.rotate(-360 * i / SPIN_FRAMES, resample=Image.BICUBIC)
        if with_arrow:
            spiral = scaled(turn, min(1.0, 0.5 * nominal / turn.height))
            arrow, hx, hy = cursor_frame("cursor/cursor-normal.png", nominal, "tip")
            layer, pad = backed(spiral)
            canvas = arrow.copy()
            canvas.alpha_composite(layer, (canvas.width - layer.width - 1, canvas.height - layer.height - 1))
            frames.append((canvas, hx, hy))
        else:
            spiral = scaled(turn, min(1.0, 0.85 * nominal / turn.height))
            layer, pad = backed(spiral)
            size = nominal + 8
            canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            canvas.alpha_composite(layer, ((size - layer.width) // 2, (size - layer.height) // 2))
            frames.append((canvas, size // 2, size // 2))
    return frames


# ---------------------------------------------------------------- Xcursor

def premultiplied_argb(img: Image.Image) -> bytes:
    px = np.asarray(img.convert("RGBA")).astype(np.uint32)
    a = px[..., 3]
    r, g, b = (px[..., i] * a // 255 for i in range(3))
    argb = (a << 24) | (r << 16) | (g << 8) | b
    return argb.astype("<u4").tobytes()


def xcursor(frames_by_size: list[tuple[int, list[tuple[Image.Image, int, int, int]]]]) -> bytes:
    """frames_by_size: [(nominal, [(image, xhot, yhot, delay_ms), ...]), ...]"""
    chunks = []
    for nominal, frames in frames_by_size:
        for img, xhot, yhot, delay in frames:
            w, h = img.size
            head = struct.pack("<IIIIIIIII", 36, 0xFFFD0002, nominal, 1, w, h, xhot, yhot, delay)
            chunks.append((nominal, head + premultiplied_argb(img)))
    ntoc = len(chunks)
    offset = 16 + 12 * ntoc
    toc, body = b"", b""
    for nominal, blob in chunks:
        toc += struct.pack("<III", 0xFFFD0002, nominal, offset + len(body))
        body += blob
    return b"Xcur" + struct.pack("<III", 16, 0x10000, ntoc) + toc + body


# ---------------------------------------------------------------- theme

ALIASES = {
    "left_ptr": ["default", "arrow", "top_left_arrow", "left_ptr_help_no"],
    "pointer": ["hand2", "hand1", "hand", "pointing_hand", "openhand", "grab"],
    "text": ["xterm", "ibeam", "vertical-text"],
    "move": ["fleur", "all-scroll", "size_all", "grabbing", "closedhand"],
    "nesw-resize": ["size_bdiag", "top_right_corner", "bottom_left_corner", "fd_double_arrow"],
    "nwse-resize": ["size_fdiag", "top_left_corner", "bottom_right_corner", "bd_double_arrow"],
    "ew-resize": ["sb_h_double_arrow", "size_hor", "h_double_arrow", "left_side", "right_side",
                  "col-resize", "split_h"],
    "ns-resize": ["sb_v_double_arrow", "size_ver", "v_double_arrow", "top_side", "bottom_side",
                  "row-resize", "split_v"],
    "not-allowed": ["crossed_circle", "forbidden", "no-drop", "circle", "dnd-none"],
    "wait": ["watch"],
    "progress": ["half-busy", "left_ptr_watch"],
}


def build(out: Path, preview: Path | None):
    single = {
        "left_ptr": ("cursor/cursor-normal.png", "tip", {}),
        "pointer": ("cursor/cursor-hover.png", "tip", {}),
        "text": ("cursor/cursor-text.png", "center", {}),
        "move": ("cursor/cursor-move.png", "center", {}),
        "not-allowed": ("cursor/cursor-not-allowed.png", "center", {}),
    }
    axis = major_axis_degrees(art("cursor/cursor-resize.png"))
    print(f"resize art long axis: {axis:.1f} deg (counter-clockwise from horizontal)")
    # level it to horizontal, then quarter-turn for vertical; the diagonals are the art and its mirror
    resize = {
        "ew-resize": dict(rotate=-axis),          # PIL turns counter-clockwise: undo the lean
        "ns-resize": dict(rotate=-axis + 90),
        "nesw-resize": dict(rotate=0),
        "nwse-resize": dict(rotate=0, mirror=True),
    }
    if abs(axis - 45) > abs(axis + 45):        # art leans the other way: swap the diagonals
        resize["nesw-resize"], resize["nwse-resize"] = resize["nwse-resize"], resize["nesw-resize"]

    files = {}
    rendered = {}
    for name, (src, hot, kw) in single.items():
        per = []
        for n in SIZES:
            img, hx, hy = cursor_frame(src, n, hot, **kw)
            per.append((n, [(img, hx, hy, 0)]))
            rendered.setdefault(name, {})[n] = img
        files[name] = xcursor(per)
    for name, kw in resize.items():
        per = []
        for n in SIZES:
            img, hx, hy = cursor_frame("cursor/cursor-resize.png", n, "center", **kw)
            per.append((n, [(img, hx, hy, 0)]))
            rendered.setdefault(name, {})[n] = img
        files[name] = xcursor(per)
    for name, with_arrow in (("wait", False), ("progress", True)):
        per = []
        for n in SIZES:
            frames = [(img, hx, hy, SPIN_DELAY) for img, hx, hy in spiral_frames(n, with_arrow)]
            per.append((n, frames))
            rendered.setdefault(name, {})[n] = frames[0][0]
        files[name] = xcursor(per)

    cur = out / "cursors"
    cur.mkdir(parents=True, exist_ok=True)
    for stale in cur.iterdir():
        stale.unlink()
    for name, blob in files.items():
        (cur / name).write_bytes(blob)
    for name, names in ALIASES.items():
        for alias in names:
            (cur / alias).symlink_to(name)
    (out / "index.theme").write_text(
        "[Icon Theme]\nName=IKAI cursor\nComment=Mouse cursors from the IKAI design sheet\n"
        "Inherits=Adwaita\n")
    print(f"wrote {len(files)} cursors and {sum(len(v) for v in ALIASES.values())} aliases to {out}")

    if preview:
        render_preview(rendered, preview)
    return rendered


def render_preview(rendered, path: Path):
    order = ["left_ptr", "pointer", "text", "move", "ew-resize", "ns-resize", "nesw-resize",
             "nwse-resize", "not-allowed", "wait", "progress"]
    cell = 76
    sheet = Image.new("RGBA", (cell * len(order), cell * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(sheet)
    for row, (bg, size) in enumerate([((20, 24, 27), 32), ((238, 236, 230), 32),
                                      ((20, 24, 27), 48), ((238, 236, 230), 48)]):
        d.rectangle([0, row * cell, sheet.width, (row + 1) * cell], fill=bg + (255,))
        for i, name in enumerate(order):
            img = rendered[name][size]
            sheet.alpha_composite(img, (i * cell + (cell - img.width) // 2, row * cell + (cell - img.height) // 2))
    sheet = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
    sheet.convert("RGB").save(path)
    print(f"preview: {path}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path.home() / ".local" / "share" / "icons" / "Ito-verse")
    ap.add_argument("--preview", type=Path)
    args = ap.parse_args()
    build(args.out, args.preview)
    return 0


if __name__ == "__main__":
    sys.exit(main())
