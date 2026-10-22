#!/usr/bin/env python3
"""Draw the shell's status icons as vector art: notifications, network, sound and media controls.

Same language as the marks (gen-marks.py): heavy bone linework, blood where something is wrong or live, so
they read at bar size and follow the theme through the shader. Rasterised at 256 with rsvg-convert.

    gen-tomie-icons.py    writes bar/modules/ito-art/{notifications,media,instruments}/
"""

from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from iconfit import bbox_of, fit

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "bar" / "modules" / "ito-art"

BONE = "#c7ccd1"
DIM = "#8e959c"
BLOOD = "#c4162a"
INK = "#08090a"
S = 512
C = S / 2
W = 30                                    # the line weight, heavy enough for a 30px slot


def svg(body: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}">{body}</svg>')


def stroke(d, color=BONE, w=W, extra=""):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'


def pts(points):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in points)


def ribbon(cx, cy, r0, r1, turns, w0, w1, n=300):
    left, right = [], []
    for i in range(n + 1):
        t = i / n
        a = t * turns * math.tau
        r = r0 + (r1 - r0) * t
        w = (w0 + (w1 - w0) * t) / 2
        nx, ny = math.cos(a), math.sin(a)
        x, y = cx + nx * r, cy + ny * r
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    return left + right[::-1]


# ------------------------------------------------------------------------------------------ notifications
BELL = "M256 40 C 158 40 112 118 112 222 L 112 298 C 112 342 80 372 52 404 L 460 404 C 432 372 400 342 400 298 L 400 222 C 400 118 354 40 256 40 Z"
CLAPPER = "M200 440 Q 256 500 312 440"


def brain(color=BONE, w=17):
    """A small brain inside the bell, kept simple enough to read at bar size: two lobes and the line between."""
    d = ("M256 122 L 256 272 "
         "M256 138 C 214 116 176 154 200 194 C 168 214 190 264 236 258 "
         "M256 138 C 298 116 336 154 312 194 C 344 214 322 264 276 258")
    return stroke(d, color, w)


def bell(unread=False, cracked=False):
    body = stroke(BELL, BONE, W + 6) + stroke(CLAPPER, BONE, W + 6) + f'<circle cx="256" cy="30" r="20" fill="{BONE}"/>'
    body += brain(BLOOD if unread else BONE)
    if cracked:
        body += stroke("M186 62 L 232 138 L 204 190 L 254 250", BLOOD, 22)
    if unread:
        body += f'<circle cx="408" cy="106" r="54" fill="{BLOOD}"/>'
    return body


def eye(color=BONE, iris=True, ring=False):
    almond = "M56 256 C 128 168 384 168 456 256 C 384 344 128 344 56 256 Z"
    body = stroke(almond, color)
    if iris:
        body += f'<circle cx="256" cy="256" r="62" fill="none" stroke="{color}" stroke-width="20"/>'
        body += f'<circle cx="256" cy="256" r="24" fill="{color}"/>'
        body += f'<circle cx="236" cy="238" r="8" fill="{INK}"/>'
    if ring:
        body += f'<circle cx="256" cy="256" r="228" fill="none" stroke="{color}" stroke-width="14" stroke-dasharray="4 30"/>'
        for k in range(8):
            a = k / 8 * math.tau
            body += stroke(f"M{256 + math.cos(a) * 228:.1f} {256 + math.sin(a) * 228:.1f} L {256 + math.cos(a) * 250:.1f} {256 + math.sin(a) * 250:.1f}", color, 14)
    return body


def ring_icon():
    return (f'<circle cx="256" cy="256" r="170" fill="none" stroke="{BONE}" stroke-width="{W}"/>'
            f'<circle cx="256" cy="256" r="98" fill="none" stroke="{BONE}" stroke-width="18"/>'
            f'<circle cx="256" cy="256" r="26" fill="{BONE}"/>')


NOTIFICATIONS = {
    "notification": bell(),                       # nothing waiting
    "notification-active": bell(unread=True),     # something waiting: the brain and a mark in blood
    "notification-error": bell(cracked=True) ,    # a cracked bell
    "notification-muted": eye(DIM, iris=False) + stroke("M90 90 L 430 430", BLOOD, 26),
    "notification-dnd": eye(BONE),                 # silenced: the eye watches instead
    "notification-critical": eye(BLOOD, ring=True),
    "notification-ring": ring_icon(),
}


# ---------------------------------------------------------------------------------------------- network
def wifi(arcs: int, dot=BONE):
    body = ""
    cx, cy = 256, 392
    for i, r in enumerate((92, 170, 248), start=1):
        colour = BONE if i <= arcs else DIM
        op = 1 if i <= arcs else 0.28
        a0, a1 = math.radians(-135), math.radians(-45)
        x0, y0 = cx + math.cos(a0) * r, cy + math.sin(a0) * r
        x1, y1 = cx + math.cos(a1) * r, cy + math.sin(a1) * r
        body += stroke(f"M{x0:.1f} {y0:.1f} A {r} {r} 0 0 1 {x1:.1f} {y1:.1f}", colour, W + 4, f'opacity="{op}"')
    body += f'<polygon points="{cx},{cy - 26} {cx + 24},{cy} {cx},{cy + 26} {cx - 24},{cy}" fill="{dot}"/>'
    return body


def wifi_lost():
    """Offline or searching: the red spiral where the signal should be."""
    return f'<polygon points="{pts(ribbon(C, C, 10, 216, 2.3, 16, 34))}" fill="{BLOOD}"/>'


def lan_port():
    """A wired link: the port itself, with its four contacts, and a live light in blood."""
    body = stroke("M76 130 L 436 130 L 436 322 L 356 322 L 356 392 L 156 392 L 156 322 L 76 322 Z", BONE, W + 4)
    for x in (146, 206, 266, 326):
        body += f'<rect x="{x}" y="172" width="26" height="90" rx="8" fill="{BONE}"/>'
    body += f'<circle cx="396" cy="170" r="16" fill="{BLOOD}"/>'
    return body


NETWORK = {"net-0": wifi(0, DIM), "net-1": wifi(1), "net-2": wifi(2), "net-3": wifi(3), "net-off": wifi_lost(),
           "net-wired": lan_port()}


# ----------------------------------------------------------------------------------------------- display
def display(level: int):
    """A screen with a sun in it: dim, then brighter, the rays growing with the light."""
    body = (f'<rect x="52" y="84" width="408" height="268" rx="30" fill="none" stroke="{BONE}" stroke-width="{W + 4}"/>'
            + stroke("M256 352 L 256 420", BONE, W + 4) + stroke("M170 432 L 342 432", BONE, W + 4))
    cx, cy = 256, 218
    r = (22, 36, 46, 54)[level]
    colour = DIM if level == 0 else BONE
    body += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{colour}"/>'
    if level >= 2:
        n = 8
        inner, outer = r + 20, r + (34 if level == 2 else 52)
        for k in range(n):
            a = k / n * math.tau
            body += stroke(f"M{cx + math.cos(a) * inner:.1f} {cy + math.sin(a) * inner:.1f} L {cx + math.cos(a) * outer:.1f} {cy + math.sin(a) * outer:.1f}",
                           BLOOD if level == 3 else BONE, 14)
    return body


DISPLAY = {f"display-{i}": display(i) for i in range(4)}


# ------------------------------------------------------------------------------------------------- tray
TRAY = ("M62 318 L 156 318 C 170 372 208 394 256 394 C 304 394 342 372 356 318 L 450 318 "
        "L 450 424 C 450 446 436 458 414 458 L 98 458 C 76 458 62 446 62 424 Z")


def tray():
    """The tray: an open dish that what is running sits in, three small cells above it."""
    art = stroke(TRAY, BONE, W + 4)
    for x in (140, 256, 372):
        art += f'<circle cx="{x}" cy="196" r="44" fill="none" stroke="{BONE}" stroke-width="{W}"/>'
    fill = f'<path d="{TRAY}" fill="#fff"/>' + "".join(f'<circle cx="{x}" cy="196" r="52" fill="#fff"/>' for x in (140, 256, 372))
    return art, fill


# ------------------------------------------------------------------------------------------------ sound
def waveform(heights, color=BONE, width=26, gap=52):
    n = len(heights)
    x0 = C - (n - 1) * gap / 2
    out = ""
    for i, h in enumerate(heights):
        x = x0 + i * gap
        out += f'<rect x="{x - width / 2:.1f}" y="{C - h / 2:.1f}" width="{width}" height="{h}" rx="{width / 2}" fill="{color}"/>'
    return out


def speaker_slash():
    cone = "M120 210 L 190 210 L 290 130 L 290 382 L 190 302 L 120 302 Z"
    return (f'<path d="{cone}" fill="{DIM}" stroke="{DIM}" stroke-width="16" stroke-linejoin="round"/>'
            + stroke("M100 90 L 430 430", BLOOD, 30))


SOUND = {
    "vol-0": waveform([40, 70, 40], DIM, 24, 60),
    "vol-1": waveform([70, 130, 200, 130, 70]),
    "vol-2": waveform([80, 160, 260, 340, 260, 160, 80]),
    "vol-3": waveform([90, 190, 300, 400, 300, 190, 90], BLOOD),
    "vol-mute": speaker_slash(),
}


# ------------------------------------------------------------------------------------------------ media
def disc(color, glyph, fill=None):
    ring = f'<circle cx="256" cy="256" r="226" fill="none" stroke="{color}" stroke-width="20"/>'
    return ring + glyph


def tri(x, y, s, direction, color):
    if direction > 0:
        p = [(x - s * 0.8, y - s), (x + s * 0.9, y), (x - s * 0.8, y + s)]
    else:
        p = [(x + s * 0.8, y - s), (x - s * 0.9, y), (x + s * 0.8, y + s)]
    return f'<polygon points="{pts(p)}" fill="{color}" stroke="{color}" stroke-width="10" stroke-linejoin="round"/>'


MEDIA = {
    "media-prev": disc(BONE, tri(226, 256, 62, -1, BONE) + tri(312, 256, 62, -1, BONE)),
    "media-play": disc(BLOOD, tri(266, 256, 92, 1, BLOOD)),
    "media-next": disc(BONE, tri(200, 256, 62, 1, BONE) + tri(286, 256, 62, 1, BONE)),
    "media-pause": disc(BONE, f'<rect x="184" y="182" width="52" height="148" rx="8" fill="{BONE}"/>'
                              f'<rect x="276" y="182" width="52" height="148" rx="8" fill="{BONE}"/>'),
    "media-stop": disc(BONE, f'<rect x="184" y="184" width="144" height="144" rx="14" fill="{BONE}"/>'),
}


def raster(dst: Path, body: str, size=256, keep_size=False):
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(".svg.tmp")
    tmp.write_text(svg(body))
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), str(tmp), "-o", str(dst)], check=True)
    tmp.unlink()
    if not keep_size:
        fit(Image.open(dst).convert("RGBA")).save(dst)


def main() -> int:
    art, fill = tray()
    raster(ART / "system" / "tray.png", art, keep_size=True)
    raster(ART / "system" / "tray-fill.png", fill, keep_size=True)
    tray_art = Image.open(ART / "system" / "tray.png").convert("RGBA")
    box = bbox_of(tray_art)
    fit(tray_art, box).save(ART / "system" / "tray.png")
    fit(Image.open(ART / "system" / "tray-fill.png").convert("RGBA"), box).save(ART / "system" / "tray-fill.png")
    for group, table, folder in (("notifications", NOTIFICATIONS, "notifications"), ("media", MEDIA, "media"),
                                 ("network", NETWORK, "instruments"), ("sound", SOUND, "instruments"),
                                 ("display", DISPLAY, "instruments")):
        for name, body in table.items():
            raster(ART / folder / f"{name}.png", body)
        print(f"wrote {len(table)} {group} icons -> {ART / folder}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
