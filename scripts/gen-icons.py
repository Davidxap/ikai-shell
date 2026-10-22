#!/usr/bin/env python3
"""Draw the Ito-verse icon theme: the icons a file manager needs, inked in the bar's own hand.

The design sheet only has eight place icons, thirty pixels tall and rough, and Nautilus asks for
dozens at sizes up to 256. So this draws them: scalable SVGs on a 64-unit grid, bone linework with
the slight tremor the bar's glyphs have, ink-filled bodies, and blood only where something is alive
(a vein on a folder, a door, the trash, a drive light). Anything not drawn here falls through to
Adwaita, so the theme is complete from the first day and improves icon by icon.

    gen-icons.py            write icons/Ito-verse-icons/ in the repo
    gen-icons.py --install  also copy it to ~/.local/share/icons and rebuild the cache
"""

from __future__ import annotations

import argparse
import math
import random
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons" / "Ito-verse-icons"

BONE = "#c7ccd1"
INK = "#14181b"
INK_LIFT = "#1c2124"
BLOOD = "#c4162a"
BLOOD_DEEP = "#651817"


# ------------------------------------------------------------------ the hand
class Hand:
    """Turns clean geometry into a line that has been drawn by someone."""

    def __init__(self, seed: int):
        self.rng = random.Random(seed)

    def wobble(self, pts, amp=0.35):
        out, drift = [], 0.0
        for i, (x, y) in enumerate(pts):
            a = pts[max(i - 1, 0)]
            b = pts[min(i + 1, len(pts) - 1)]
            dx, dy = b[0] - a[0], b[1] - a[1]
            n = math.hypot(dx, dy) or 1.0
            drift = drift * 0.7 + (self.rng.random() - 0.5) * amp
            out.append((x - dy / n * drift, y + dx / n * drift))
        return out

    def dense(self, pts, closed=False, step=6.0):
        """More points along straight runs, so the wobble has something to bend."""
        seq = list(pts) + ([pts[0]] if closed else [])
        out = [seq[0]]
        for (x0, y0), (x1, y1) in zip(seq, seq[1:]):
            n = max(1, int(math.hypot(x1 - x0, y1 - y0) / step))
            for k in range(1, n + 1):
                out.append((x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n))
        return out

    def d(self, pts, closed=False, amp=0.35):
        p = self.wobble(self.dense(pts, closed), amp)
        s = "M" + " L".join(f"{x:.2f},{y:.2f}" for x, y in p)
        return s + (" Z" if closed else "")


def arc_pts(cx, cy, r, a0, a1, n=28):
    return [(cx + math.cos(a0 + (a1 - a0) * i / n) * r, cy + math.sin(a0 + (a1 - a0) * i / n) * r)
            for i in range(n + 1)]


def spiral_pts(cx, cy, r, turns, n=90):
    return [(cx + math.cos(t * turns * 2 * math.pi) * r * t, cy + math.sin(t * turns * 2 * math.pi) * r * t)
            for t in (i / n for i in range(n + 1))]


# ------------------------------------------------------------------ svg parts
class Svg:
    def __init__(self, seed: int):
        self.h = Hand(seed)
        self.parts: list[str] = []

    def body(self, pts, fill=INK, stroke=BONE, width=2.4):
        d = self.h.d(pts, closed=True)
        self.parts.append(f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" '
                          f'stroke-linejoin="round" stroke-linecap="round"/>')
        # the line gone over a second time, thinner and fainter, beside the first
        d2 = self.h.d(pts, closed=True, amp=0.6)
        self.parts.append(f'<path d="{d2}" fill="none" stroke="{stroke}" stroke-width="{width * 0.4:.2f}" '
                          f'opacity="0.42" stroke-linejoin="round" transform="translate(0.5,0.4)"/>')

    def line(self, pts, stroke=BONE, width=2.0, closed=False, opacity=1.0, fill="none"):
        d = self.h.d(pts, closed=closed, amp=0.3)
        self.parts.append(f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" '
                          f'stroke-linecap="round" stroke-linejoin="round" opacity="{opacity}"/>')

    def dot(self, x, y, r, fill=BLOOD):
        self.parts.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}"/>')

    def render(self) -> str:
        return ('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">'
                + "".join(self.parts) + "</svg>\n")


# ------------------------------------------------------------------ shapes
def folder(s: Svg, vein=True):
    s.body([(6, 17), (24, 17), (29, 23), (58, 23), (58, 52), (6, 52)])
    if vein:  # a vein running down from the edge, the one drop of blood on the folder
        s.line([(51, 23), (48.5, 30), (51, 35.5), (48.5, 42)], stroke=BLOOD, width=1.8)
        s.line([(48.5, 30), (45, 32)], stroke=BLOOD, width=1.2)


def page(s: Svg):
    s.body([(14, 6), (38, 6), (51, 19), (51, 58), (14, 58)])
    s.line([(38, 6), (38, 19), (51, 19)], width=1.8)


def emblem_lines(s, cx, cy):
    for i, w in enumerate((14, 11, 14, 9)):
        s.line([(cx - 8, cy - 7 + i * 5), (cx - 8 + w, cy - 7 + i * 5)], width=1.5, opacity=0.85)


def emblem_down(s, cx, cy):
    s.line([(cx, cy - 9), (cx, cy + 5)], width=2.0)
    s.line([(cx - 6, cy - 1), (cx, cy + 5), (cx + 6, cy - 1)], width=2.0)
    s.line([(cx - 8, cy + 9), (cx + 8, cy + 9)], width=1.8)


def emblem_note(s, cx, cy):
    s.line(arc_pts(cx - 4, cy + 6, 3.6, 0, 2 * math.pi, 16), width=1.8, closed=True)
    s.line([(cx - 0.4, cy + 6), (cx - 0.4, cy - 8), (cx + 7, cy - 5)], width=1.8)


def emblem_mountain(s, cx, cy):
    s.line([(cx - 10, cy + 8), (cx - 3, cy - 3), (cx + 2, cy + 3), (cx + 5, cy - 1), (cx + 10, cy + 8)], width=1.8)
    s.line(arc_pts(cx + 5, cy - 7, 2.6, 0, 2 * math.pi, 14), width=1.5, closed=True)


def emblem_play(s, cx, cy):
    s.line([(cx - 5, cy - 8), (cx + 8, cy), (cx - 5, cy + 8)], width=1.9, closed=True)


def emblem_grid(s, cx, cy):
    for dx in (-6, 2):
        for dy in (-6, 2):
            s.line([(cx + dx, cy + dy), (cx + dx + 6, cy + dy), (cx + dx + 6, cy + dy + 6),
                    (cx + dx, cy + dy + 6)], width=1.4, closed=True)


def emblem_monitor(s, cx, cy):
    s.line([(cx - 9, cy - 6), (cx + 9, cy - 6), (cx + 9, cy + 4), (cx - 9, cy + 4)], width=1.6, closed=True)
    s.line([(cx - 4, cy + 9), (cx + 4, cy + 9)], width=1.6)
    s.line([(cx, cy + 4), (cx, cy + 9)], width=1.4)


def emblem_link(s, cx, cy):
    s.line(arc_pts(cx - 4, cy, 5, 0, 2 * math.pi, 18), width=1.6, closed=True)
    s.line(arc_pts(cx + 4, cy, 5, 0, 2 * math.pi, 18), width=1.6, closed=True)


def emblem_spiral(s, cx, cy):
    s.line(spiral_pts(cx, cy, 9, 2.2), width=1.5, opacity=0.9)


def emblem_chevrons(s, cx, cy):
    s.line([(cx - 8, cy - 5), (cx - 2, cy), (cx - 8, cy + 5)], width=2.0)
    s.line([(cx + 1, cy + 6), (cx + 9, cy + 6)], width=2.0, stroke=BLOOD) if False else s.line(
        [(cx + 1, cy + 6), (cx + 9, cy + 6)], width=2.0, stroke=BLOOD)


def emblem_box(s, cx, cy):
    s.line([(cx - 9, cy - 5), (cx, cy - 10), (cx + 9, cy - 5), (cx + 9, cy + 6), (cx, cy + 10),
            (cx - 9, cy + 6)], width=1.6, closed=True)
    s.line([(cx, cy - 10), (cx, cy + 10)], width=1.2, opacity=0.7)


# ------------------------------------------------------------------ the icons
def i_folder(s): folder(s)


def i_folder_with(emblem):
    def draw(s):
        folder(s, vein=False)
        emblem(s, 32, 38)
    return draw


def i_home(s):
    s.body([(8, 32), (32, 10), (56, 32), (50, 32), (50, 54), (14, 54), (14, 32)])
    s.body([(28, 54), (28, 41), (37, 41), (37, 54)], fill=BLOOD_DEEP, stroke=BLOOD, width=1.8)
    s.line([(44, 20), (44, 12), (49, 12), (49, 24)], width=1.8)


def i_trash(full=False):
    def draw(s):
        s.body([(17, 21), (20, 57), (44, 57), (47, 21)], fill=INK)
        s.line([(12, 17), (52, 17)], width=2.4)
        s.line([(25, 17), (25, 11), (39, 11), (39, 17)], width=2.0)
        for x in (26, 32, 38):
            s.line([(x, 26), (x + (x - 32) * 0.1, 51)], stroke=BLOOD, width=1.7)
        if full:
            s.line([(20, 17), (24, 8), (30, 13)], width=1.6)
            s.line([(36, 13), (42, 7), (46, 15)], width=1.6)
    return draw


def i_drive(s):
    s.body([(6, 26), (58, 26), (58, 48), (6, 48)])
    s.line([(12, 41), (34, 41)], width=1.6, opacity=0.8)
    s.dot(50, 37, 2.6)
    s.line([(12, 33), (24, 33)], width=1.4, opacity=0.6)


def i_usb(s):
    s.body([(20, 22), (44, 22), (44, 58), (20, 58)])
    s.body([(26, 8), (38, 8), (38, 22), (26, 22)], fill=INK_LIFT)
    s.dot(29.5, 14, 1.8, BONE)
    s.dot(34.5, 14, 1.8, BONE)
    s.line([(26, 46), (38, 46)], stroke=BLOOD, width=1.8)


def i_sd(s):
    s.body([(16, 6), (42, 6), (50, 14), (50, 58), (16, 58)])
    for x in (22, 28, 34):
        s.line([(x, 12), (x, 22)], width=1.6, opacity=0.85)
    s.line([(22, 42), (44, 42)], stroke=BLOOD, width=1.8)


def i_computer(s):
    s.body([(6, 10), (58, 10), (58, 42), (6, 42)])
    s.line([(28, 42), (26, 52), (38, 52), (36, 42)], width=2.0)
    s.line([(18, 54), (46, 54)], width=2.2)
    s.line([(12, 34), (24, 22)], width=1.2, opacity=0.4)


def i_text_file(s):
    page(s)
    emblem_lines(s, 32, 38)


def i_image_file(s):
    page(s)
    emblem_mountain(s, 32, 38)


def i_audio_file(s):
    page(s)
    emblem_note(s, 32, 38)


def i_video_file(s):
    page(s)
    emblem_play(s, 32, 38)


def i_script_file(s):
    page(s)
    emblem_chevrons(s, 32, 38)


def i_archive_file(s):
    page(s)
    emblem_box(s, 32, 38)


def i_pdf_file(s):
    page(s)
    emblem_spiral(s, 32, 38)
    s.line([(19, 52), (46, 52)], stroke=BLOOD, width=1.6)


def i_generic_file(s):
    page(s)


PLACES = {
    "folder": i_folder,
    "inode-directory": i_folder,
    "folder-open": i_folder,
    "folder-documents": i_folder_with(emblem_lines),
    "folder-download": i_folder_with(emblem_down),
    "folder-music": i_folder_with(emblem_note),
    "folder-pictures": i_folder_with(emblem_mountain),
    "folder-videos": i_folder_with(emblem_play),
    "folder-templates": i_folder_with(emblem_grid),
    "folder-publicshare": i_folder_with(emblem_link),
    "folder-remote": i_folder_with(emblem_link),
    "folder-desktop": i_folder_with(emblem_monitor),
    "user-desktop": i_folder_with(emblem_monitor),
    "user-home": i_home,
    "folder-home": i_home,
    "user-trash": i_trash(False),
    "user-trash-full": i_trash(True),
}
DEVICES = {
    "drive-harddisk": i_drive,
    "drive-removable-media": i_usb,
    "drive-removable-media-usb": i_usb,
    "media-flash": i_sd,
    "media-removable": i_usb,
    "computer": i_computer,
}
MIMES = {
    "text-x-generic": i_text_file,
    "text-plain": i_text_file,
    "image-x-generic": i_image_file,
    "audio-x-generic": i_audio_file,
    "video-x-generic": i_video_file,
    "text-x-script": i_script_file,
    "application-x-shellscript": i_script_file,
    "application-x-executable": i_script_file,
    "package-x-generic": i_archive_file,
    "application-zip": i_archive_file,
    "application-x-compressed-tar": i_archive_file,
    "application-pdf": i_pdf_file,
    "application-octet-stream": i_generic_file,
    "text-x-preview": i_text_file,
}
APPS = {}      # the 13 app icons (terminal, files, settings, browser, editor...) were removed: they painted an opaque black ground

CONTEXTS = {"places": PLACES, "devices": DEVICES, "mimetypes": MIMES, "apps": APPS}
DIRS = {"places": "Places", "devices": "Devices", "mimetypes": "MimeTypes", "apps": "Applications"}

INDEX = """[Icon Theme]
Name=IKAI icons
Comment=Bone linework on ink, with blood only where something is alive.
Inherits=Adwaita,hicolor
Example=folder
Directories={dirs}

{sections}"""


def write_theme(out: Path) -> int:
    if out.exists():
        shutil.rmtree(out)
    count, dirs, sections = 0, [], []
    for ctx, icons in CONTEXTS.items():
        d = out / "scalable" / ctx
        d.mkdir(parents=True, exist_ok=True)
        for name, draw in icons.items():
            svg = Svg(seed=hash(name) & 0xFFFF if False else sum(map(ord, name)) * 31)
            draw(svg)
            (d / f"{name}.svg").write_text(svg.render())
            count += 1
        rel = f"scalable/{ctx}"
        dirs.append(rel)
        sections.append(f"[{rel}]\nSize=64\nMinSize=8\nMaxSize=512\nType=Scalable\nContext={DIRS[ctx]}\n")
    (out / "index.theme").write_text(INDEX.format(dirs=",".join(dirs), sections="\n".join(sections)))
    return count


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--install", action="store_true", help="copy to ~/.local/share/icons and rebuild the cache")
    args = ap.parse_args()
    n = write_theme(OUT)
    print(f"drew {n} icons -> {OUT}")
    if args.install:
        dst = Path.home() / ".local" / "share" / "icons" / "Ito-verse-icons"
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(OUT, dst)
        subprocess.run(["gtk-update-icon-cache", "-f", "-t", str(dst)], check=False)
        print(f"installed -> {dst}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
