#!/usr/bin/env python3
"""Draw the shell's menu marks as vector art, then rasterise them.

Each mark is an SVG written here (bone linework, crimson where something bleeds, the two colours the theme
shader moves onto the installed theme), rasterised at 512 with rsvg-convert. Being vector, every mark is
perfectly centred and crisp at any size, which is what a mark that turns on hover needs.

    gen-marks.py     writes bar/modules/ito-art/system/menu-{uzumaki,remina,amigara,halo,flauros}.png
"""

from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "bar" / "modules" / "ito-art" / "system"
PREVIEW = Path(sys.argv[1]) if len(sys.argv) > 1 else None

BONE = "#c7ccd1"
BONE_DIM = "#8e959c"
BLOOD = "#c4162a"
INK = "#08090a"
S = 512
C = S / 2


def svg(body: str, defs: str = "") -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}">'
            f"<defs>{defs}</defs>{body}</svg>")


def pts(points) -> str:
    return " ".join(f"{x:.2f},{y:.2f}" for x, y in points)


def ribbon(cx, cy, r0, r1, turns, w0, w1, phase=0.0, n=420):
    """An Archimedean spiral as a filled ribbon whose width grows from w0 to w1."""
    left, right = [], []
    for i in range(n + 1):
        t = i / n
        a = phase + t * turns * math.tau
        r = r0 + (r1 - r0) * t
        w = (w0 + (w1 - w0) * t) / 2
        # the normal of a spiral is close to the radial direction
        nx, ny = math.cos(a), math.sin(a)
        x, y = cx + nx * r, cy + ny * r
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    return left + right[::-1]


# ----------------------------------------------------------------------------------------------- uzumaki
def uzumaki() -> str:
    """Two arms wound together: one bone, one blood. Turning it is a turn of the whole disc."""
    r0, r1, w0, w1 = 20, 226, 13, 24
    out = ""
    for phase, colour in ((0.0, BONE), (math.pi, BLOOD)):
        arm = ribbon(C, C, r0, r1, 3.0, w0, w1, phase)
        a = phase + 3.0 * math.tau
        cap = (C + math.cos(a) * r1, C + math.sin(a) * r1)
        out += (f'<polygon points="{pts(arm)}" fill="{colour}"/>'
                f'<circle cx="{cap[0]:.1f}" cy="{cap[1]:.1f}" r="{w1 / 2}" fill="{colour}"/>'
                f'<circle cx="{C + math.cos(phase) * r0:.1f}" cy="{C + math.sin(phase) * r0:.1f}" r="{w0 / 2}" fill="{colour}"/>')
    return svg(out)


# ----------------------------------------------------------------------------------------------- remina
def remina() -> str:
    """The planet that eats worlds: one bloodshot eye in it, veins to its edge, a small world on its way in."""
    veins = ""
    for k in range(12):
        a = k / 12 * math.tau + 0.2
        r0, r1 = 96, 196 + (k % 3) * 8
        mx = C + math.cos(a + 0.18) * (r0 + r1) / 2
        my = C + math.sin(a + 0.18) * (r0 + r1) / 2
        veins += (f'<path d="M{C + math.cos(a) * r0:.1f} {C + math.sin(a) * r0:.1f} '
                  f'Q {mx:.1f} {my:.1f} {C + math.cos(a + 0.05) * r1:.1f} {C + math.sin(a + 0.05) * r1:.1f}" '
                  f'fill="none" stroke="{BLOOD}" stroke-width="6" stroke-linecap="round"/>')
    craters = "".join(
        f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r * 0.55}" fill="none" stroke="{BONE_DIM}" stroke-width="4" opacity="0.8"/>'
        for x, y, r in ((120, 150, 22), (396, 336, 26), (150, 380, 16), (372, 130, 14)))
    hatch = "".join(f'<line x1="{x}" y1="60" x2="{x - 90}" y2="470" stroke="{BONE_DIM}" stroke-width="3" opacity="0.45"/>'
                    for x in range(280, 560, 16))
    body = f"""
      <clipPath id="planet"><circle cx="{C}" cy="{C}" r="200"/></clipPath>
      <circle cx="{C}" cy="{C}" r="200" fill="{INK}"/>
      <g clip-path="url(#planet)">{hatch}</g>
      {craters}
      {veins}
      <path d="M96 {C} C 150 168 362 168 416 {C} C 362 344 150 344 96 {C} Z" fill="{BONE}"/>
      <circle cx="{C}" cy="{C}" r="66" fill="{BLOOD}"/>
      <circle cx="{C}" cy="{C}" r="66" fill="none" stroke="{INK}" stroke-width="6"/>
      <ellipse cx="{C}" cy="{C}" rx="14" ry="50" fill="{INK}"/>
      <circle cx="{C - 22}" cy="{C - 24}" r="9" fill="{BONE}"/>
      <circle cx="{C}" cy="{C}" r="200" fill="none" stroke="{BONE}" stroke-width="12"/>
      <path d="M40 92 C 96 40 170 24 236 30" fill="none" stroke="{BONE}" stroke-width="7" stroke-linecap="round" opacity="0.7"/>
      <circle cx="444" cy="92" r="26" fill="{INK}" stroke="{BONE}" stroke-width="8"/>
      <ellipse cx="444" cy="92" rx="46" ry="11" fill="none" stroke="{BONE}" stroke-width="6" transform="rotate(-24 444 92)"/>"""
    return svg(body)


# ----------------------------------------------------------------------------------------------- amigara
def figure(cx, top, h, fill, stroke=None, sw=0):
    """A person seen from the front, as a hole: head, shoulders, arms slightly out, legs apart."""
    u = h / 100.0
    pts_ = [(0, 0), (8, 6), (8, 16), (13, 20), (34, 28), (34, 52), (17, 44), (17, 62), (20, 100), (7, 100),
            (0, 66), (-7, 100), (-20, 100), (-17, 62), (-17, 44), (-34, 52), (-34, 28), (-13, 20), (-8, 16), (-8, 6)]
    poly = pts([(cx + x * u * 0.62, top + y * u) for x, y in pts_])
    st = f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"' if stroke else ""
    return f'<polygon points="{poly}" fill="{fill}"{st}/>'


def amigara() -> str:
    """The mountain full of holes cut to the shape of people, and the one hole that is yours."""
    cliff_lines = "".join(
        f'<path d="M{x} 30 C {x + 14} 150 {x - 12} 330 {x + 6} 490" fill="none" stroke="{BONE_DIM}" stroke-width="3" opacity="0.55"/>'
        for x in range(46, 480, 42))
    small = ""
    for row, top in enumerate((70, 70, 70)):
        pass
    holes = ""
    for cx in (96, 416):
        for top in (74, 250):
            holes += figure(cx, top, 158, INK, BONE_DIM, 4)
    body = f"""
      <clipPath id="face"><circle cx="{C}" cy="{C}" r="232"/></clipPath>
      <circle cx="{C}" cy="{C}" r="232" fill="#111315"/>
      <g clip-path="url(#face)">{cliff_lines}{holes}</g>
      <path d="M{C - 80} 60 L {C + 80} 60 L {C + 80} 456 L {C - 80} 456 Z" fill="#111315" opacity="0.0"/>
      {figure(C, 40, 430, INK, BONE, 14)}
      <path d="M{C} 158 L {C} 300" stroke="{BLOOD}" stroke-width="10" stroke-linecap="round" opacity="0.0"/>
      <circle cx="{C}" cy="{C}" r="232" fill="none" stroke="{BONE}" stroke-width="12"/>
      {figure(C, 40, 430, "none", BLOOD, 5)}"""
    return svg(body)


def metatron_real():
    """The Seal of Metatron as the game draws it, traced from dev/reference/silent-hill-metatron.png."""
    from PIL import Image, ImageChops, ImageDraw, ImageFilter
    ref = ROOT / "dev" / "reference" / "silent-hill-metatron.png"
    if not ref.is_file():
        return None
    n = 512
    src = Image.open(ref).convert("RGB").resize((n, n), Image.LANCZOS)
    r, g, _ = src.split()
    alpha = ImageChops.subtract(r, g).point(lambda v: max(0, min(255, int(v * 1.5))))
    k = n / 920
    zone = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(zone)
    d.ellipse((340 * k, 88 * k, 590 * k, 182 * k), fill=255)                              # the eye
    for x, y in ((465, 300), (335, 540), (595, 540)):                                   # the three circles
        d.ellipse(((x - 100) * k, (y - 100) * k, (x + 100) * k, (y + 100) * k), fill=255)
    zone = zone.filter(ImageFilter.GaussianBlur(2))
    bone = Image.new("RGBA", (n, n), (199, 204, 209, 255))
    blood = Image.new("RGBA", (n, n), (196, 22, 42, 255))
    out = Image.composite(blood, bone, zone)
    out.putalpha(alpha)
    return out


# ----------------------------------------------------------------------------------------------- silent hill
def halo() -> str:
    """The Halo of the Sun: a disc ringed twice, with flares that alternate long and short."""
    rays = ""
    for k in range(16):
        a = k / 16 * math.tau
        long = k % 2 == 0
        r0, r1 = 176, 244 if long else 214
        w = 15 if long else 10
        ca, sa = math.cos(a), math.sin(a)
        px, py = -sa, ca
        rays += (f'<polygon points="{pts([(C + ca * r0 + px * w, C + sa * r0 + py * w), (C + ca * r1 + px * w * 0.25, C + sa * r1 + py * w * 0.25), (C + ca * r1 - px * w * 0.25, C + sa * r1 - py * w * 0.25), (C + ca * r0 - px * w, C + sa * r0 - py * w)])}" fill="{BONE}"/>')
    waves = "".join(
        f'<path d="M{C - 96} {C - 54 + i * 22} q 24 -12 48 0 t 48 0 t 48 0 t 48 0" fill="none" stroke="{BONE_DIM}" stroke-width="5" stroke-linecap="round" transform="translate(-24 0)"/>'
        for i in range(6))
    body = f"""
      <clipPath id="in"><circle cx="{C}" cy="{C}" r="114"/></clipPath>
      {rays}
      <circle cx="{C}" cy="{C}" r="160" fill="{INK}" stroke="{BONE}" stroke-width="16"/>
      <circle cx="{C}" cy="{C}" r="124" fill="none" stroke="{BONE_DIM}" stroke-width="7"/>
      <g clip-path="url(#in)">{waves}</g>
      <circle cx="{C}" cy="{C}" r="44" fill="none" stroke="{BLOOD}" stroke-width="16"/>
      <circle cx="{C}" cy="{C}" r="17" fill="{BLOOD}"/>"""
    return svg(body)


def flauros() -> str:
    """A ring cut by a cross, a small circle in each quarter, and a blood-red diamond where the arms meet."""
    quarters = ""
    for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        x, y = C + sx * 112, C + sy * 112
        quarters += (f'<circle cx="{x}" cy="{y}" r="62" fill="{INK}" stroke="{BONE_DIM}" stroke-width="11"/>'
                     f'<line x1="{x - 26}" y1="{y}" x2="{x + 26}" y2="{y}" stroke="{BONE_DIM}" stroke-width="9" stroke-linecap="round"/>')
    body = f"""
      <circle cx="{C}" cy="{C}" r="232" fill="{INK}" stroke="{BONE}" stroke-width="16"/>
      <circle cx="{C}" cy="{C}" r="206" fill="none" stroke="{BONE_DIM}" stroke-width="5"/>
      <line x1="{C}" y1="26" x2="{C}" y2="{S - 26}" stroke="{BONE}" stroke-width="14"/>
      <line x1="26" y1="{C}" x2="{S - 26}" y2="{C}" stroke="{BONE}" stroke-width="14"/>
      {quarters}
      <circle cx="{C}" cy="{C}" r="58" fill="{INK}" stroke="{BLOOD}" stroke-width="12"/>
      <polygon points="{C},{C - 40} {C + 34},{C} {C},{C + 40} {C - 34},{C}" fill="{BLOOD}"/>"""
    return svg(body)


MARKS = {"menu-uzumaki": uzumaki, "menu-remina": remina, "menu-amigara": amigara,
         "menu-halo": halo, "menu-flauros": flauros}


def raster(name: str, markup: str, size: int = 512) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    src = OUT / f"{name}.svg.tmp"
    dst = OUT / f"{name}.png"
    src.write_text(markup)
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), str(src), "-o", str(dst)], check=True)
    src.unlink()
    return dst


WS_OUT = ROOT / "bar" / "modules" / "ito-art" / "workspaces"


def uzumaki_state(n: int, state: str) -> str:
    """The spiral as workspace n: n arms (1 to 5), with an outer ring from 6 to 10. Faint when empty, bone when
    occupied, one arm in blood when it is where you are, all blood when it is urgent."""
    arms = (n - 1) % 5 + 1
    w1 = max(13.0, 30 / math.sqrt(arms))
    w0 = max(7.0, w1 * 0.55)
    turns = {1: 2.6, 2: 1.9, 3: 1.5, 4: 1.25, 5: 1.05}[arms]
    if state == "empty":
        w0, w1 = w0 * 0.7, w1 * 0.7
    r0, r1 = 20, 214
    parts = ""
    for k in range(arms):
        phase = k / arms * math.tau
        arm = ribbon(C, C, r0, r1, turns, w0, w1, phase)
        if state == "empty":
            colour, op = BONE_DIM, 0.7
        elif state == "occupied":
            colour, op = BONE, 1
        elif state == "active":
            colour, op = (BLOOD if k == 0 else BONE), 1
        else:
            colour, op = BLOOD, 1
        parts += f'<polygon points="{pts(arm)}" fill="{colour}" opacity="{op}"/>'
    ring_colour = {"empty": BONE_DIM, "occupied": BONE, "active": BLOOD, "urgent": BLOOD}[state]
    if state in ("active", "urgent"):
        parts += f'<circle cx="{C}" cy="{C}" r="243" fill="none" stroke="{BLOOD}" stroke-width="{16 if state == "urgent" else 10}"/>'
    if n > 5:                                                    # 6 to 10: a second ring outside the spiral
        parts += f'<circle cx="{C}" cy="{C}" r="226" fill="none" stroke="{ring_colour}" stroke-width="7" stroke-dasharray="22 12" opacity="0.9"/>'
    return svg(parts)


def workspace_uzumaki() -> None:
    WS_OUT.mkdir(parents=True, exist_ok=True)
    for old in WS_OUT.glob("ws-uzumaki-*"):
        old.unlink()
    for n in range(1, 11):
        for state in ("empty", "occupied", "active", "urgent"):
            src = WS_OUT / f"ws-uzumaki-{n}-{state}.svg.tmp"
            dst = WS_OUT / f"ws-uzumaki-{n}-{state}.png"
            src.write_text(uzumaki_state(n, state))
            subprocess.run(["rsvg-convert", "-w", "256", "-h", "256", str(src), "-o", str(dst)], check=True)
            src.unlink()
    print("wrote 40 uzumaki workspace pictures")


def remina_state(n: int, state: str) -> str:
    """The planet Remina as workspace n: a planet with one eye. n tendrils leave its edge (1 to 5; 6 to 10 wear a
    dashed ring), so the number is counted by them. Closed eye when empty, open when occupied, bloodshot when
    active, bleeding veins when urgent."""
    arms = (n - 1) % 5 + 1
    col = {"empty": BONE_DIM, "occupied": BONE, "active": BONE, "urgent": BLOOD}[state]
    op = {"empty": 0.65, "occupied": 1, "active": 1, "urgent": 1}[state]
    out = f'<g opacity="{op}">'
    for k in range(arms):
        a = -math.pi / 2 + k * math.tau / arms
        r0, r1 = 168, 238
        x0, y0 = C + math.cos(a) * r0, C + math.sin(a) * r0
        x1, y1 = C + math.cos(a + 0.28) * r1, C + math.sin(a + 0.28) * r1
        cx, cy = C + math.cos(a - 0.12) * (r0 + 52), C + math.sin(a - 0.12) * (r0 + 52)
        out += (f'<path d="M{x0:.1f} {y0:.1f} Q {cx:.1f} {cy:.1f} {x1:.1f} {y1:.1f}" fill="none" '
                f'stroke="{col}" stroke-width="15" stroke-linecap="round"/>')
    out += f'<circle cx="{C}" cy="{C}" r="164" fill="{INK}" stroke="{col}" stroke-width="16"/>'
    for x, y, r in ((150, 150, 18), (360, 340, 22), (170, 370, 12)):
        out += f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r * 0.55}" fill="none" stroke="{col}" stroke-width="6" opacity="0.7"/>'
    if state == "empty":
        out += f'<path d="M132 {C} Q {C} {C + 58} 380 {C}" fill="none" stroke="{col}" stroke-width="16" stroke-linecap="round"/>'
        for k in (-2, -1, 0, 1, 2):
            x = C + k * 44
            out += f'<path d="M{x} {C + 24} l{k * 6} 22" stroke="{col}" stroke-width="9" stroke-linecap="round"/>'
    else:
        out += (f'<path d="M120 {C} Q {C} 122 392 {C} Q {C} 390 120 {C} Z" fill="#e9ecef" stroke="{col}" '
                f'stroke-width="14" stroke-linejoin="round"/>')
        iris = BLOOD if state in ("active", "urgent") else INK
        out += f'<circle cx="{C}" cy="{C}" r="60" fill="{iris}" stroke="{INK}" stroke-width="7"/>'
        out += f'<circle cx="{C}" cy="{C}" r="26" fill="{INK}"/><circle cx="{C - 16}" cy="{C - 18}" r="9" fill="#e9ecef"/>'
        if state == "urgent":
            for x in (200, 312):
                out += f'<path d="M{x} 306 C {x - 6} 340 {x + 6} 372 {x} 410" fill="none" stroke="{BLOOD}" stroke-width="12" stroke-linecap="round"/>'
    out += '</g>'
    if state in ("active", "urgent"):
        out += f'<circle cx="{C}" cy="{C}" r="246" fill="none" stroke="{BLOOD}" stroke-width="{16 if state == "urgent" else 10}"/>'
    if n > 5:
        out += f'<circle cx="{C}" cy="{C}" r="226" fill="none" stroke="{col}" stroke-width="7" stroke-dasharray="22 12" opacity="0.9"/>'
    return svg(out)


def workspace_remina() -> None:
    WS_OUT.mkdir(parents=True, exist_ok=True)
    for old in WS_OUT.glob("ws-remina-*"):
        old.unlink()
    for n in range(1, 11):
        for state in ("empty", "occupied", "active", "urgent"):
            src = WS_OUT / f"ws-remina-{n}-{state}.svg.tmp"
            dst = WS_OUT / f"ws-remina-{n}-{state}.png"
            src.write_text(remina_state(n, state))
            subprocess.run(["rsvg-convert", "-w", "256", "-h", "256", str(src), "-o", str(dst)], check=True)
            src.unlink()
    print("wrote 40 remina workspace pictures")


def main() -> int:
    workspace_remina()
    workspace_uzumaki()
    for name, fn in MARKS.items():
        print("wrote", raster(name, fn()))
    real = metatron_real()
    if real is not None:
        real.save(OUT / "menu-metatron-full.png")
        print("wrote", OUT / "menu-metatron-full.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
