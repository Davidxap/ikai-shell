#!/usr/bin/env python3
"""The indicator, notification, media and system icons, engraved in the hand of the brain and the jar.

An earlier pass drew these as flat vector and they read as cartoons beside the sheet's engravings. These are done
with the same pen (variable ink, an echo stroke, hatching where a form turns away, worn edges) and put on one
footing, so a cup, a radio and a bell stand the same size.

    gen-engraved.py [names...]     write the icons (all, or only those named: coffee radio flashlight ...)
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from engrave import (BLOOD, BONE, DIM, INK, S, blood, canvas, ellipse, fade, finish, gp, hatch_poly, pen, save,
                     solid)

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "bar" / "modules" / "ito-art"
OUT = ART / "indicators"


# ------------------------------------------------------------------------------------------------ coffee
def coffee(on: bool):
    img = canvas()
    cx = 300
    # saucer, seen from a little above
    saucer = ellipse(cx, 512, 214, 44)
    solid(img, saucer, INK)
    pen(img, saucer, 15, BONE if on else DIM, closed=True)
    pen(img, ellipse(cx, 506, 132, 24), 8, DIM, closed=True, echo=False)
    # the cup: a rim ellipse, sides narrowing to a foot
    rim = ellipse(cx, 236, 160, 46)
    body = [(cx - 160, 236)] + [(cx - 160 + 60 * math.sin(t) * 0 + (cx - 100 - (cx - 160)) * t / 1.0, 236 + 230 * t) for t in [i / 24 for i in range(1, 25)]]
    left = [(cx - 160 + 58 * (t ** 1.6), 236 + 232 * t) for t in [i / 24 for i in range(0, 25)]]
    right = [(cx + 160 - 58 * (t ** 1.6), 236 + 232 * t) for t in [i / 24 for i in range(0, 25)]]
    foot = ellipse(cx, 468, 102, 28, 0, math.pi)
    shape = left + foot[::-1] if False else left + [(x, y) for x, y in foot] + right[::-1] + ellipse(cx, 236, 160, 46, 0, -math.pi)[:0]
    shape = left + foot + right[::-1]
    solid(img, shape + rim, INK)
    hatch_poly(img, shape, 72, 12, 3, 0.85, region=fade(cx - 170, 340, 300, 255, 0))       # shade down the left
    # what is in it
    inner = ellipse(cx, 240, 146, 36)
    # the coffee is a spiral, stirred in towards the middle: the surface seen from a little above, turning like Uzumaki
    swirl = [(cx + math.cos(t * 2.6 * math.tau) * 132 * t, 240 + math.sin(t * 2.6 * math.tau) * 30 * t)
             for t in (0.04 + 0.96 * i / 150 for i in range(151))]
    if on:
        blood(img, inner, None)
        pen(img, ellipse(cx, 240, 146, 36, math.pi * 1.05, math.pi * 1.95, 40), 5, (255, 120, 130), echo=False)
        gp.ink(img, swirl, 5, 7, BONE, wobble=0.5, pressure=False)
        # a run of blood over the front of the rim, down the cup
        drip = [(cx + 74, 274), (cx + 78, 330), (cx + 72, 372), (cx + 84, 396)]
        gp.ink(img, drip, 14, 20, BLOOD, wobble=1.2, pressure=True)
        gp.ImageDraw.Draw(img).ellipse((cx + 72, 388, cx + 96, 420), fill=BLOOD)
    else:
        solid(img, inner, (18, 20, 23))
        gp.ink(img, swirl, 5, 7, DIM, wobble=0.5, pressure=False)
    pen(img, rim, 17, BONE if on else DIM, closed=True)
    pen(img, left, 17, BONE if on else DIM, echo=True)
    pen(img, right, 17, BONE if on else DIM, echo=True)
    pen(img, foot, 15, BONE if on else DIM, echo=False)
    # the handle
    handle = ellipse(cx + 150, 322, 92, 78, -math.pi / 2 + 0.3, math.pi / 2 + 0.05, 40)
    pen(img, handle, 17, BONE if on else DIM)
    pen(img, ellipse(cx + 150, 322, 62, 46, -math.pi / 2 + 0.35, math.pi / 2, 30), 10, DIM, echo=False)
    # steam
    steam_c = BLOOD if on else DIM
    for k, x in enumerate((cx - 60, cx + 4, cx + 64)):
        pts = gp.wave(x, 176, x + (10 if k % 2 else -10), 60 + k * 14, 14, 1.4, phase=k)
        gp.ink(img, pts, 4, 12, steam_c if on else DIM, wobble=1.0)
    return finish(img, seed=3)


# ------------------------------------------------------------------------------------------------ radio
def rrect(x0, y0, x1, y1, r, n=10):
    pts = []
    for cx, cy, a0 in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def radio(on: bool):
    img = canvas()
    col = BONE if on else DIM
    body = rrect(110, 230, 530, 530, 44)
    solid(img, body, INK)
    hatch_poly(img, body, 62, 13, 3, 0.8, region=fade(150, 260, 460, 255, 0))
    pen(img, body, 17, col, closed=True)
    # the antenna, in two pulled sections
    gp.ink(img, [(470, 230), (546, 70)], 10, 12, col, wobble=1.0, pressure=False)
    gp.ink(img, [(470, 230), (520, 122)], 16, 16, col, wobble=1.0, pressure=False)
    gp.ImageDraw.Draw(img).ellipse((536, 58, 558, 80), fill=col + (255,))
    # speaker grille
    ring = ellipse(240, 400, 88, 88)
    pen(img, ring, 13, col, closed=True, echo=False)
    for y in range(340, 470, 22):
        half = math.sqrt(max(0, 84 ** 2 - (y - 400) ** 2))
        gp.ink(img, [(240 - half + 10, y), (240 + half - 10, y)], 6, 9, DIM, wobble=0.8, pressure=False)
    # the dial window and its needle, the tuning knob
    win = rrect(340, 276, 490, 326, 12)
    solid(img, win, (22, 26, 30))
    pen(img, win, 11, col, closed=True, echo=False)
    for x in range(356, 484, 16):
        gp.ink(img, [(x, 296), (x, 314)], 3, 4, DIM, wobble=0.5, pressure=False)
    gp.ink(img, [(432, 282), (432, 322)], 7, 9, BLOOD if on else DIM, wobble=0.6, pressure=False)
    knob = ellipse(412, 440, 46, 46)
    pen(img, knob, 13, col, closed=True, echo=False)
    for a in range(0, 360, 45):
        r = math.radians(a)
        gp.ink(img, [(412 + math.cos(r) * 30, 440 + math.sin(r) * 30), (412 + math.cos(r) * 44, 440 + math.sin(r) * 44)], 4, 5, DIM, wobble=0.4, pressure=False)
    if on:                                                       # the hiss: it speaks when they are near
        for r in (58, 104):
            pts = ellipse(548, 68, r, r, math.radians(112), math.radians(190), 24)
            gp.ink(img, pts, 9, 13, BLOOD, wobble=1.0)
        blood(img, ellipse(240, 400, 60, 60), 360, hatchy=False)
    return finish(img, seed=8)


# ------------------------------------------------------------------------------------------------ flashlight
def flashlight(on: bool):
    img = canvas()
    col = BONE if on else DIM
    handle = rrect(280, 250, 566, 372, 34)
    head = [(150, 190), (300, 244), (300, 378), (150, 432)]
    solid(img, handle, INK)
    solid(img, head, INK)
    hatch_poly(img, handle, 12, 14, 3, 0.75, region=fade(400, 250, 200, 0, 255))
    hatch_poly(img, head, 70, 12, 3, 0.8, region=fade(240, 260, 240, 255, 0))
    # grip ribs
    for x in range(400, 552, 26):
        gp.ink(img, [(x, 262), (x + 2, 360)], 5, 8, DIM, wobble=0.6)
    pen(img, handle, 17, col, closed=True)
    pen(img, head, 17, col, closed=True)
    pen(img, [(300, 244), (300, 378)], 12, col, echo=False)
    # the lens, an ellipse on the open end, and the switch
    lens = ellipse(150, 311, 34, 122)
    pen(img, lens, 15, col, closed=True)
    pen(img, ellipse(150, 311, 18, 74), 8, DIM, closed=True, echo=False)
    sw = rrect(430, 232, 500, 258, 10)
    solid(img, sw, (22, 26, 30))
    pen(img, sw, 10, BLOOD if on else col, closed=True, echo=False)
    if on:
        beam = [(120, 250), (10, 150), (10, 480), (120, 372)]
        blood(img, beam, None, hatchy=False)
        for dy in (-150, -75, 0, 75, 150):
            gp.ink(img, [(112, 311 + dy * 0.28), (16, 311 + dy)], 5, 9, BLOOD, wobble=1.0)
    return finish(img, seed=13)


# ------------------------------------------------------------------------------------------------ moon
def moon(on: bool):
    img = canvas()
    cx, cy = 320, 330
    outer = ellipse(cx, cy, 236, 236)
    cut = ellipse(cx + 118, cy - 74, 196, 196)
    # crescent = outer circle minus the bite: rasterise both and subtract
    m = gp.Image.new("L", (S, S), 0)
    gp.ImageDraw.Draw(m).polygon(outer, fill=255)
    gp.ImageDraw.Draw(m).polygon(cut, fill=0)
    if on:
        # Lit: a pale bone body, not a solid red disc — filling the whole crescent with blood is what
        # read as fruit rather than moon. Red stays where it is everywhere else on this sheet: a rim
        # and a texture on an ink/bone form (the eye's iris, the coffee's steam), never the form itself.
        base = gp.Image.new("RGBA", (S, S), BONE + (255,))
        base.putalpha(m)
        img.alpha_composite(base)
        img.alpha_composite(gp.hatch(m, (150, 46, 54), math.radians(-40), 12, 3, 0.5, region=fade(cx - 150, cy + 100, 380, 255, 0)))
    else:
        img.alpha_composite(gp.hatch(m, DIM, math.radians(50), 14, 3, 0.7, region=fade(cx - 200, cy, 380, 255, 0)))
    edge = gp.Image.fromarray(__import__("numpy").asarray(m.filter(gp.ImageFilter.MaxFilter(3))) - __import__("numpy").asarray(m.filter(gp.ImageFilter.MinFilter(3))))
    ol = gp.Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ol.paste((BLOOD if on else DIM) + (255,), mask=edge.point(lambda v: 255 if v > 30 else 0).filter(gp.ImageFilter.MaxFilter(9)))
    img.alpha_composite(ol)
    for x, y, r in ((200, 250, 22), (268, 400, 30), (170, 350, 14)):
        pen(img, ellipse(x, y, r, r), 6, BLOOD if on else DIM, closed=True, echo=False)
    return finish(img, seed=17)


# ------------------------------------------------------------------------------------------------ fog
def fog(on: bool):
    img = canvas()
    col = BONE if on else DIM
    if on:
        sun = ellipse(410, 210, 104, 104)
        blood(img, sun, None)
        pen(img, sun, 14, BLOOD, closed=True, echo=False)
    for i, (y, x0, x1) in enumerate(((230, 70, 500), (326, 130, 580), (422, 60, 520), (518, 150, 590))):
        pts = gp.wave(x0, y, x1, y + (10 if i % 2 else -8), 26, 3.0 + 0.3 * i, phase=i * 1.3)
        # a dark band under each, so the bands hide what lies behind them
        band = pts + [(x, y2 + 60) for x, y2 in pts[::-1]]
        solid(img, band, INK)
        hatch_poly(img, band, 8, 12, 3, 0.55, color=DIM, region=fade(320, y, 200, 255, 60))
        gp.ink(img, pts, 15, 22, col, wobble=2.0, pressure=True)
        gp.ink(img, [(x, y2 + 10) for x, y2 in pts[6:-6]], 4, 7, DIM, wobble=2.0, pressure=True)
    return finish(img, seed=21)


# ------------------------------------------------------------------------------------------------ eye
def eyeball(on: bool):
    img = canvas()
    cx, cy = 320, 320
    w, h = 270, 130
    top = gp.arc(cx, cy + 70, w, 220, math.radians(212), math.radians(328), 60)
    bot = gp.arc(cx, cy - 70, w, 220, math.radians(32), math.radians(148), 60)
    if not on:                                                   # shut: a soft lid, its crease, a few lashes curling out
        lid = bez((64, 300), (190, 392), (450, 392), (576, 300), 60)
        crease = bez((110, 262), (220, 214), (420, 214), (530, 262), 50)
        solid(img, lid + [(576, 300), (64, 300)], (24, 27, 31))
        pen(img, lid, 21, DIM)
        gp.ink(img, crease, 5, 11, DIM, wobble=1.0)
        for k, t in enumerate((0.1, 0.28, 0.46, 0.64, 0.82)):
            x, y = lid[int(t * 60)]
            d = (t - 0.5) * 2
            gp.ink(img, [(x, y + 4), (x + d * 34, y + 46), (x + d * 78, y + 70)], 4, 10, DIM, wobble=0.5)
        return finish(img, seed=25)
    almond = top + bot[::-1] if False else top + bot
    solid(img, top + bot, (16, 18, 21))
    hatch_poly(img, top + bot, 20, 14, 3, 0.55, region=fade(cx, cy - 60, 260, 255, 0))
    pen(img, top, 21, BLOOD)
    pen(img, bot, 19, BLOOD)
    iris = ellipse(cx, cy, 104, 104)
    blood(img, iris, None, hatchy=False)
    for a in range(0, 360, 15):                                  # the iris, in spokes
        r = math.radians(a)
        gp.ink(img, [(cx + math.cos(r) * 40, cy + math.sin(r) * 40), (cx + math.cos(r) * 100, cy + math.sin(r) * 100)], 3, 5, (120, 10, 24), wobble=0.5, pressure=False)
    pen(img, iris, 13, BONE, closed=True, echo=False)
    gp.ImageDraw.Draw(img).ellipse((cx - 40, cy - 40, cx + 40, cy + 40), fill=INK + (255,))
    gp.ImageDraw.Draw(img).ellipse((cx - 26, cy - 34, cx - 8, cy - 16), fill=BONE + (255,))
    ringr = ellipse(cx, cy, 300, 300)
    gp.ink(img, ringr, 4, 4, BLOOD, wobble=0.3, pressure=False)
    return finish(img, seed=25)


# ------------------------------------------------------------------------------------------------ tape
def tape(on: bool):
    img = canvas()
    col = BONE if on else DIM
    body = rrect(70, 170, 570, 490, 30)
    solid(img, body, INK)
    hatch_poly(img, body, 66, 14, 3, 0.7, region=fade(90, 200, 520, 255, 0))
    pen(img, body, 17, col, closed=True)
    # the label
    lab = rrect(120, 200, 520, 268, 10)
    solid(img, lab, (28, 32, 36))
    pen(img, lab, 10, col, closed=True, echo=False)
    for y in (222, 246):
        gp.ink(img, [(140, y), (400 if y == 222 else 330, y)], 5, 7, DIM, wobble=0.6, pressure=False)
    # the two reels and the window under them
    win = rrect(150, 296, 490, 430, 26)
    solid(img, win, (18, 20, 23))
    pen(img, win, 11, col, closed=True, echo=False)
    for cx in (238, 402):
        reel = ellipse(cx, 360, 50, 50)
        pen(img, reel, 13, BLOOD if on else col, closed=True, echo=False)
        for a in (90, 210, 330):
            r = math.radians(a)
            gp.ink(img, [(cx + math.cos(r) * 10, 360 + math.sin(r) * 10), (cx + math.cos(r) * 40, 360 + math.sin(r) * 40)], 8, 9, BLOOD if on else col, wobble=0.5, pressure=False)
    if on:
        gp.ImageDraw.Draw(img).ellipse((520, 128, 568, 176), fill=BLOOD + (255,))
        pen(img, ellipse(544, 152, 34, 34), 5, (255, 130, 140), closed=True, echo=False)
    return finish(img, seed=29)


# ------------------------------------------------------------------------------------------------ helpers
def bez(p0, p1, p2, p3, n=24):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
    return out


def dot(img, x, y, r, color):
    gp.ImageDraw.Draw(img).ellipse((x - r, y - r, x + r, y + r), fill=color + (255,))


# ------------------------------------------------------------------------------------------------ bell
def bell(state: str):
    img = canvas()
    col = DIM if state == "muted" else BONE
    left = bez((320, 84), (210, 84), (176, 176), (176, 292)) + bez((176, 292), (176, 372), (138, 420), (96, 470))[1:]
    right = bez((320, 84), (430, 84), (464, 176), (464, 292)) + bez((464, 292), (464, 372), (502, 420), (544, 470))[1:]
    rim = ellipse(320, 470, 224, 34, math.pi, 0, 40)
    shape = left + rim[::-1][::-1] + right[::-1]
    shape = left + [(x, y) for x, y in ellipse(320, 470, 224, 34, math.pi, math.tau, 40)] + right[::-1]
    solid(img, shape, INK)
    hatch_poly(img, shape, 68, 12, 3, 0.85, region=fade(230, 240, 320, 255, 0))
    # an Uzumaki spiral turns on the body of the bell, in the same thin pen as the shading; blood when there is news
    spiral = []
    turns = 3.4
    for i in range(0, 241):
        f = i / 240
        a = f * turns * math.tau - math.pi / 2
        r = 12 + f * 118
        spiral.append((320 + math.cos(a) * r * 0.92, 300 + math.sin(a) * r * 1.02))
    gp.ink(img, spiral, 5, 8, BLOOD if state == "unread" else DIM, wobble=1.2, pressure=True)
    pen(img, left, 18, col)
    pen(img, right, 18, col)
    pen(img, ellipse(320, 470, 224, 34, 0, math.pi, 40), 15, col, echo=False)          # the front lip of the rim
    pen(img, ellipse(320, 470, 224, 34, math.pi, math.tau, 40), 12, DIM, echo=False)
    dot(img, 320, 66, 22, col)
    # the clapper is an eye: it hangs from the bell and watches whoever looks at it
    lid_top = bez((262, 556), (290, 520), (350, 520), (378, 556))
    lid_bot = bez((378, 556), (350, 592), (290, 592), (262, 556))
    solid(img, lid_top + lid_bot, INK)
    pen(img, lid_top, 13, col, echo=False)
    pen(img, lid_bot, 11, DIM if state != "unread" else col, echo=False)
    iris = ellipse(320, 556, 19, 19)
    solid(img, iris, INK)
    pen(img, iris, 8, BLOOD if state == "unread" else col, closed=True, echo=False)
    dot(img, 320, 556, 7, BLOOD if state == "unread" else col)
    if state == "unread":
        # it is ringing: arcs of blood either side, and a drop from the eye
        for side in (-1, 1):
            for k, rr in enumerate((70, 112)):
                pts = [(320 + side * (232 + math.cos(math.radians(a)) * rr * 0.6), 300 + math.sin(math.radians(a)) * rr * 1.3)
                       for a in range(-50, 51, 5)]
                gp.ink(img, pts, 9 - k * 2, 12 - k * 2, BLOOD, wobble=1.3, pressure=False)
        solid(img, [(320, 606), (334, 634), (320, 646), (306, 634)], BLOOD)
        dot(img, 480, 112, 44, BLOOD)
        pen(img, ellipse(480, 112, 44, 44), 6, (255, 130, 140), closed=True, echo=False)
    if state == "crack":
        gp.ink(img, [(262, 96), (300, 170), (272, 228), (318, 300), (290, 352)], 12, 20, BLOOD, wobble=1.4, pressure=True)
    if state == "muted":
        gp.ink(img, [(110, 90), (540, 560)], 20, 26, BLOOD, wobble=1.4, pressure=False)
    return finish(img, seed=31)


# ------------------------------------------------------------------------------------------------ media rings
def ring_icon(kind: str):
    img = canvas()
    red = kind == "play"
    col = BLOOD if red else BONE
    ring = ellipse(320, 320, 262, 262)
    solid(img, ring, INK)
    hatch_poly(img, ring, 56, 14, 3, 0.55, region=fade(240, 240, 330, 255, 0))
    pen(img, ring, 19, col, closed=True)
    pen(img, ellipse(320, 320, 236, 236), 6, DIM if not red else (150, 12, 28), closed=True, echo=False)

    def tri(cx, cy, s, d):
        pts = [(cx - d * s * 0.8, cy - s), (cx + d * s * 0.9, cy), (cx - d * s * 0.8, cy + s)]
        solid(img, pts, INK)
        hatch_poly(img, pts, 50, 10, 3, 0.7)
        pen(img, pts, 15, col, closed=True, echo=False)

    if kind == "prev":
        tri(268, 320, 78, -1); tri(378, 320, 78, -1)
    elif kind == "next":
        tri(262, 320, 78, 1); tri(372, 320, 78, 1)
    elif kind == "play":
        tri(340, 320, 116, 1)
        pts = [(230, 204), (450, 320), (230, 436)]
        blood(img, pts, None)
    elif kind == "pause":
        for x0 in (228, 356):
            bar = rrect(x0, 226, x0 + 62, 414, 10)
            solid(img, bar, INK)
            hatch_poly(img, bar, 80, 9, 3, 0.7)
            pen(img, bar, 15, col, closed=True, echo=False)
    else:                                                        # stop
        sq = rrect(236, 236, 404, 404, 16)
        solid(img, sq, INK)
        hatch_poly(img, sq, 40, 10, 3, 0.7)
        pen(img, sq, 16, col, closed=True, echo=False)
    return finish(img, seed=37)


# ------------------------------------------------------------------------------------------------ tray, port, display
def tray_art():
    img = canvas()
    dish = [(70, 340), (190, 340)] + bez((190, 340), (210, 430), (270, 462), (320, 462), 20) + bez((320, 462), (370, 462), (430, 430), (450, 340), 20)[1:] + [(570, 340), (570, 500)] + [(70, 500)]
    dish = rrect(70, 340, 570, 520, 26)
    scoop = [(70, 340), (200, 340)] + bez((200, 340), (220, 420), (270, 440), (320, 440), 16)[1:] + bez((320, 440), (370, 440), (420, 420), (440, 340), 16)[1:] + [(570, 340)]
    body = scoop + [(570, 500), (570, 512)] + [(556, 524), (84, 524), (70, 512), (70, 500)]
    fillmask_body = body
    solid(img, body, INK)
    hatch_poly(img, body, 64, 12, 3, 0.85, region=fade(120, 380, 420, 255, 0))
    pen(img, body, 18, BONE, closed=True)
    cells = []
    for x in (170, 320, 470):
        c = ellipse(x, 200, 70, 70)
        cells.append(c)
        solid(img, c, INK)
        hatch_poly(img, c, 60, 11, 3, 0.75, region=fade(x - 40, 160, 120, 255, 0))
        pen(img, c, 16, BONE, closed=True, echo=False)
    return img, [fillmask_body] + cells


def lan_port(on=True):
    img = canvas()
    shell = [(80, 150), (560, 150), (560, 420), (444, 420), (444, 500), (196, 500), (196, 420), (80, 420)]
    solid(img, shell, INK)
    hatch_poly(img, shell, 66, 13, 3, 0.8, region=fade(120, 180, 520, 255, 0))
    pen(img, shell, 19, BONE, closed=True)
    for x in range(150, 500, 60):
        c = rrect(x, 208, x + 36, 340, 10)
        solid(img, c, (26, 30, 34))
        pen(img, c, 10, BONE, closed=True, echo=False)
        gp.ink(img, [(x + 18, 222), (x + 18, 326)], 6, 8, DIM, wobble=0.5, pressure=False)
    dot(img, 510, 190, 20, BLOOD)
    pen(img, ellipse(510, 190, 20, 20), 4, (255, 130, 140), closed=True, echo=False)
    return finish(img, seed=41)


def display(level: int):
    img = canvas()
    scr = rrect(70, 120, 570, 424, 34)
    solid(img, scr, INK)
    hatch_poly(img, scr, 60, 14, 3, 0.55, region=fade(110, 150, 520, 255, 0))
    pen(img, scr, 19, BONE, closed=True)
    pen(img, rrect(96, 146, 544, 398, 22), 6, DIM, closed=True, echo=False)
    gp.ink(img, [(320, 424), (320, 500)], 20, 22, BONE, wobble=1.0, pressure=False)
    pen(img, [(196, 512), (444, 512)], 20, BONE, echo=False)
    cx, cy = 320, 272
    r = (30, 44, 56, 66)[level]
    if level == 0:
        dot(img, cx, cy, r, DIM)
    else:
        s = ellipse(cx, cy, r, r)
        if level >= 3:
            blood(img, s, None, hatchy=False)
        else:
            solid(img, s, BONE)
        pen(img, s, 8, BONE, closed=True, echo=False)
    if level >= 2:
        for k in range(8):
            a = k / 8 * math.tau
            i0, i1 = r + 22, r + (44 if level == 2 else 70)
            gp.ink(img, [(cx + math.cos(a) * i0, cy + math.sin(a) * i0), (cx + math.cos(a) * i1, cy + math.sin(a) * i1)], 8, 13,
                   BLOOD if level == 3 else BONE, wobble=0.6, pressure=False)
    return finish(img, seed=43)


def waveform(heights, color=BONE):
    img = canvas()
    n = len(heights)
    gap = 62
    x0 = 320 - (n - 1) * gap / 2
    for i, h in enumerate(heights):
        x = x0 + i * gap
        gp.ink(img, [(x, 320 - h / 2), (x + (i % 2) * 2 - 1, 320 + h / 2)], 15, 27, color, wobble=1.3, pressure=True)
    return finish(img, seed=47)


def speaker_mute():
    img = canvas()
    cone = [(110, 250), (220, 250), (360, 150), (360, 490), (220, 390), (110, 390)]
    solid(img, cone, INK)
    hatch_poly(img, cone, 70, 12, 3, 0.8, region=fade(150, 260, 340, 255, 0))
    pen(img, cone, 18, DIM, closed=True)
    gp.ink(img, [(130, 110), (530, 540)], 20, 27, BLOOD, wobble=1.3, pressure=False)
    return finish(img, seed=49)


def wifi_lost():
    img = canvas()
    pts = gp.spiral(320, 320, 250, 3.0, n=260, start=0.04)
    gp.ink(img, pts, 12, 26, BLOOD, wobble=1.6, pressure=False)
    gp.ink(img, gp.spiral(320, 320, 170, 2.0, n=200, start=0.2), 5, 10, (120, 10, 24), wobble=1.4, pressure=False)
    return finish(img, seed=53)


def chevron():
    """Omarchy's tray expander: a single "<" pointing at the drawer, drawn heavy and simple in our ink. The widget
    turns it over when the drawer is open."""
    img = canvas()
    pts = [(420, 140), (240, 320), (420, 500)]
    # the stroke swells at the point and thins at both ends, like a brush; a thin echo runs beside it
    gp.ink(img, [pts[0]] + [(pts[0][0] + (pts[1][0] - pts[0][0]) * t / 10, pts[0][1] + (pts[1][1] - pts[0][1]) * t / 10) for t in range(1, 10)] + [pts[1]]
           + [(pts[1][0] + (pts[2][0] - pts[1][0]) * t / 10, pts[1][1] + (pts[2][1] - pts[1][1]) * t / 10) for t in range(1, 10)] + [pts[2]],
           46, 66, BONE, wobble=1.4, pressure=True)
    gp.ink(img, [(x + 46, y) for x, y in pts], 5, 10, DIM, wobble=1.6, pressure=True)
    return finish(img, seed=59, wear=0.3)


def wifi(level: int):
    """Signal arcs in ink: the ones that are lit are bone and heavy, the rest are faint; a diamond at the foot."""
    img = canvas()
    cx, cy = 320, 500
    for i, r in enumerate((150, 280, 410), start=1):
        lit = i <= level
        pts = [(cx + math.cos(a) * r, cy + math.sin(a) * r)
               for a in [math.radians(-135 + 90 * k / 40) for k in range(41)]]
        gp.ink(img, pts, 24 if lit else 14, 38 if lit else 20, BONE if lit else DIM, wobble=1.3, pressure=True)
        if lit:
            gp.ink(img, [(x + 5, y + 6) for x, y in pts[4:-4]], 3, 6, DIM, wobble=1.6, pressure=True)
    dia = [(cx, cy - 44), (cx + 40, cy), (cx, cy + 44), (cx - 40, cy)]
    solid(img, dia, BONE if level else DIM)
    return finish(img, seed=61)


def main2(wanted) -> None:
    from PIL import Image
    if not wanted or "notifications" in wanted:
        for name, st in (("notification", "idle"), ("notification-active", "unread"), ("notification-error", "crack"), ("notification-muted", "muted")):
            save(bell(st), ART / "notifications" / f"{name}.png")
        save(eyeball(False), ART / "notifications" / "notification-dnd.png")
        save(eyeball(True), ART / "notifications" / "notification-critical.png")
        print("wrote notifications")
    if not wanted or "media" in wanted:
        for k in ("prev", "play", "next", "pause", "stop"):
            save(ring_icon(k), ART / "media" / f"media-{k}.png")
        print("wrote media")
    if not wanted or "system" in wanted:
        art, masks = tray_art()
        base = finish(art, seed=39)
        # the fill's silhouette gets the same transform as the drawing: fit both by the drawing's box
        from iconfit import bbox_of, fit
        import engrave
        worn = engrave.gp.wear(art, 0.42, seed=39).resize((256, 256), Image.LANCZOS)
        box = bbox_of(worn)
        save(fit(worn.filter(gp.ImageFilter.UnsharpMask(radius=1.2, percent=70, threshold=2)), box), ART / "system" / "tray.png")
        m = Image.new("L", (S, S), 0)
        for poly in masks:
            gp.ImageDraw.Draw(m).polygon(poly, fill=255)
        maskimg = Image.new("RGBA", (S, S), (255, 255, 255, 0))
        maskimg.putalpha(m.filter(gp.ImageFilter.MaxFilter(5)))
        save(fit(maskimg.resize((256, 256), Image.LANCZOS), box), ART / "system" / "tray-fill.png")
        save(chevron(), ART / "system" / "tray-chevron.png")
        for lv in range(4):
            save(wifi(lv), ART / "instruments" / f"net-{lv}.png")
        save(lan_port(), ART / "instruments" / "net-wired.png")
        save(wifi_lost(), ART / "instruments" / "net-off.png")
        for i in range(4):
            save(display(i), ART / "instruments" / f"display-{i}.png")
        for name, h, c in (("vol-0", [40, 74, 40], DIM), ("vol-1", [70, 140, 220, 140, 70], BONE),
                           ("vol-2", [80, 170, 290, 400, 290, 170, 80], BONE), ("vol-3", [90, 200, 330, 460, 330, 200, 90], BLOOD)):
            save(waveform(h, c), ART / "instruments" / f"{name}.png")
        save(speaker_mute(), ART / "instruments" / "vol-mute.png")
        print("wrote system icons")


ICONS = {
    ("awake", "coffee"): coffee, ("awake", "radio"): radio, ("awake", "flashlight"): flashlight,
    ("night", "moon"): moon, ("night", "fog"): fog,
    ("record", "eye"): eyeball, ("record", "tape"): tape,
}


def main() -> int:
    wanted = set(sys.argv[1:])
    main2(wanted)
    n = 0
    for (ident, version), fn in ICONS.items():
        if wanted and version not in wanted:
            continue
        for state, on in (("off", False), ("on", True)):
            save(fn(on), OUT / f"{ident}-{version}-{state}.png")
            n += 1
    print(f"wrote {n} engraved indicator icons -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
