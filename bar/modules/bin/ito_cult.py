#!/usr/bin/env python3
"""ito_cult -- workspace family `cult` (visible name Cult Symbols): Silent Hill's symbols, engraved in iron.

Pure functions on numpy / Pillow: nothing is read or written here (bin/ito-assets `recipe ws-cult` does that, into the user's assets folder only).
No source picture is read at build time: every symbol is redrawn as geometry on the tier's own device-px grid (supersampled, then
area-reduced), so a micro tier is geometry, never a shrunken picture.

v3 (2026-10-20, S10): the authority for which symbols exist and how each looks is the page the user named,
https://skillunex.com/silent-hill-symbols/ (its three pictures: "The Halo of the Sun", "The Silent Hill Movie and its Symbols", "Silent Hill
Symbols in Modern Entries", 18 symbols). Each slot is traced from its picture there (same geometry, line structure and proportions), then
given the engraved / rust / blood treatment below. The ten, the page's main symbol first, then the seals it names, then the rest by how
much the page makes of them:
   1 Halo of the Sun     ("SUN"): heavy ring, toothed rune band, twelve-point star with dots, petals, the dark sun disc
   2 Seal of Metatron    ("Metatron's Seal"): nine-point star of three triangles, the M in its circle, runes in the points
   3 Flauros             ("Flauros"): the pyramid from above, outer triangle and its three edges to the apex
   4 Mark of Samael      ("Samael's Mark"): the ram, head to us between curled horns, brow sigil, runes on its flanks
   5 Valtiel             ("Valtiel"): the capped cross with barbed knots and the two swept wings
   6 Halo Sigil          ("Halo Sigil"): the serpent ring and its double helix, runes in the loops and round the band
   7 Otherworld Gate     ("Otherworld Gate"): eight-point star of bowed thorned bands, the web at its heart
   8 Faith & Torment     ("Faith & Torment"): double-barred cross of boxed beams in barbed wire, the ring of thorns
   9 Eternal Flame       ("Eternal Flame"): the thorn-wreathed ring and its seven-point star
  10 Sun's Vitality      ("Sun's Vitality"): the hexagram, ringed eyes at its side points, the hourglass, the rune staves
Not used (the page shows them too): Life Source, Celestial Flow, Ancestral Blood, Solar Energy, Valtiel's Mark (the eagle), Metatron (the
twelve-point star), Otherworld (the thorned eye), Seed (the hand). Runes are drawn from 72 px (Elder Futhark shapes as the pictures letter
them); 40..64 px get notched cells; below 40 px each symbol keeps only its identifying geometry.

States (the pyramid / ringws language): empty = a cold ghost outline; occupied = engraved iron with old rust; active = the symbol's heart
burns in blood and runs; urgent = the whole symbol is flooded, its own engraving kept as the blood's strength. Blood is ito_ringws' routine
(thin runs that follow the surface, spray, dark dried edges and a wet core): reused, never redrawn here.

Colour (as ito_ringws): grey = the token's place on the bg..fg line, red = the accent; the theme shader moves both onto the theme. No opaque black.

Products: workspaces/bar/<px>/ws-cult-<n>-<state>[.light].png at every tier of ito_sh.TIERS (24..128), and the numeral-free picker card
workspaces/bar/<px>/ws-cult-preview-active[.light].png (ito_sh.previews).
"""
import math
import numpy as np
from PIL import Image, ImageDraw

import ito_sh as S
import ito_ringws as R

TIERS = S.TIERS
STATES = S.STATES
SS = 8
NAMES = {1: "Halo of the Sun", 2: "Seal of Metatron", 3: "Flauros", 4: "Mark of Samael", 5: "Valtiel", 6: "Halo Sigil",
         7: "Otherworld Gate", 8: "Faith & Torment", 9: "Eternal Flame", 10: "Sun's Vitality"}


class Ctx:
    """one tile's drawing pads. Unit coordinates (0..1) of the symbol box map onto the tile; widths are clamped to whole device px below 40."""

    def __init__(self, px):
        self.px = px
        self.s = px * 0.84                                         # the symbol box: right of and below the numeral's corner, room for the blood below
        self.x0 = px - self.s - px * 0.035
        self.y0 = px * 0.04
        self.micro = px < 40
        self.im, self.dr = {}, {}

    def D(self, k):
        if k not in self.im:
            self.im[k] = Image.new("L", (self.px * SS, self.px * SS), 0)
            self.dr[k] = ImageDraw.Draw(self.im[k])
        return self.dr[k]

    def T(self, x, y):
        """unit -> tile px."""
        return self.x0 + x * self.s, self.y0 + y * self.s

    def P(self, x, y):
        return ((self.x0 + x * self.s) * SS, (self.y0 + y * self.s) * SS)

    def W(self, w, lo=1.0):
        """a unit width in supersampled px: never thinner than `lo` device px; whole px below 40 (a half px is a grey smear)."""
        d = max(lo, w * self.s * (1.0 if self.px < 48 else 1.25 if self.px < 72 else 1.35))
        if self.micro:
            d = max(lo, round(d))
        return d * SS

    def ring(self, k, c, r, w, lo=1.0, val=255):
        cx, cy = self.P(*c); Rr = r * self.s * SS; ww = self.W(w, lo)
        self.D(k).ellipse((cx - Rr - ww / 2, cy - Rr - ww / 2, cx + Rr + ww / 2, cy + Rr + ww / 2), outline=val, width=max(1, int(round(ww))))

    def disc(self, k, c, r, val=255):
        cx, cy = self.P(*c); Rr = r * self.s * SS
        self.D(k).ellipse((cx - Rr, cy - Rr, cx + Rr, cy + Rr), fill=val)

    def ell(self, k, c, rx, ry, val=255):
        cx, cy = self.P(*c)
        self.D(k).ellipse((cx - rx * self.s * SS, cy - ry * self.s * SS, cx + rx * self.s * SS, cy + ry * self.s * SS), fill=val)

    def line(self, k, pts, w, lo=1.0, closed=False, caps=True, val=255):
        P = [self.P(*p) for p in pts]
        if closed:
            P = P + [P[0]]
        ww = int(round(self.W(w, lo)))
        self.D(k).line(P, fill=val, width=max(1, ww), joint="curve")
        if caps:
            r = ww / 2
            for x, y in (P if not closed else P[:-1]):             # round caps and joints
                self.D(k).ellipse((x - r, y - r, x + r, y + r), fill=val)

    def poly(self, k, pts, val=255):
        self.D(k).polygon([self.P(*p) for p in pts], fill=val)

    def out(self):
        return {k: np.asarray(v.resize((self.px, self.px), Image.BOX), np.float32) / 255 for k, v in self.im.items()}


def _arc(c, r, a0, a1, n=48):
    return [(c[0] + r * math.cos(t), c[1] + r * math.sin(t)) for t in np.linspace(math.radians(a0), math.radians(a1), n)]


def _tri(c, r, rot=-90):
    return [(c[0] + r * math.cos(math.radians(rot + 120 * i)), c[1] + r * math.sin(math.radians(rot + 120 * i))) for i in range(3)]


def _runes(C, c, r0, r1, skip=(), n=40, k="fine"):
    """a rune band between r0 and r1: notched cells of uneven height and lean (illegible by design), none inside the `skip` angle ranges."""
    for i in range(n):
        a = -90 + 360 / n * i
        if any(abs(((a - s0) + 180) % 360 - 180) < s1 for s0, s1 in skip):
            continue
        hi = r1 if i % 3 else r0 + 0.6 * (r1 - r0)
        lean = 4 if i % 2 else -3
        p0 = (c[0] + r0 * math.cos(math.radians(a)), c[1] + r0 * math.sin(math.radians(a)))
        p1 = (c[0] + hi * math.cos(math.radians(a + lean)), c[1] + hi * math.sin(math.radians(a + lean)))
        C.line(k, [p0, p1], 0.011)
        if i % 4 == 1:                                                 # a crossbar on every fourth cell
            m = (r0 + hi) / 2
            q0 = (c[0] + m * math.cos(math.radians(a - 2.5)), c[1] + m * math.sin(math.radians(a - 2.5)))
            q1 = (c[0] + m * math.cos(math.radians(a + 5)), c[1] + m * math.sin(math.radians(a + 5)))
            C.line(k, [q0, q1], 0.009)


# ---- drawing helpers for the v3 set (traced from the reference page's pictures, see the module docstring)
# Rune strokes in a cell 0.6 wide and 1 tall (Elder Futhark shapes, as the reference pictures letter their bands); drawn only from 72 px,
# where a rune is at least 4 device px tall. Below that a band is notched cells (_runes) or a plain ring.
RUNES = {
    "F": [[(0, 0), (0, 1)], [(0, 0.15), (0.5, 0)], [(0, 0.45), (0.5, 0.3)]],
    "U": [[(0, 1), (0, 0), (0.5, 0.3), (0.5, 1)]],
    "TH": [[(0, 0), (0, 1)], [(0, 0.25), (0.45, 0.5), (0, 0.75)]],
    "A": [[(0, 0), (0, 1)], [(0, 0), (0.5, 0.25)], [(0, 0.3), (0.5, 0.55)]],
    "R": [[(0, 1), (0, 0), (0.45, 0.25), (0, 0.5), (0.5, 1)]],
    "K": [[(0, 0), (0, 1)], [(0.5, 0), (0, 0.5), (0.5, 1)]],
    "X": [[(0, 0), (0.6, 1)], [(0.6, 0), (0, 1)]],
    "W": [[(0, 1), (0, 0), (0.45, 0.2), (0, 0.4)]],
    "H": [[(0, 0), (0, 1)], [(0.5, 0), (0.5, 1)], [(0, 0.35), (0.5, 0.65)]],
    "N": [[(0.3, 0), (0.3, 1)], [(0, 0.35), (0.6, 0.6)]],
    "I": [[(0.3, 0), (0.3, 1)]],
    "P": [[(0, 0), (0, 1)], [(0, 0), (0.45, 0.25), (0.45, 0)], [(0, 1), (0.45, 0.75), (0.45, 1)]],
    "Z": [[(0.3, 0), (0.3, 1)], [(0.3, 0.4), (0, 0)], [(0.3, 0.4), (0.6, 0)]],
    "S": [[(0.45, 0), (0.05, 0.4), (0.5, 0.6), (0.05, 1)]],
    "T": [[(0.3, 0), (0.3, 1)], [(0, 0.3), (0.3, 0), (0.6, 0.3)]],
    "B": [[(0, 0), (0, 1)], [(0, 0), (0.45, 0.25), (0, 0.5), (0.45, 0.75), (0, 1)]],
    "E": [[(0, 1), (0, 0), (0.3, 0.35), (0.6, 0), (0.6, 1)]],
    "M": [[(0, 0), (0, 1)], [(0.6, 0), (0.6, 1)], [(0, 0), (0.6, 0.5)], [(0.6, 0), (0, 0.5)]],
    "L": [[(0, 1), (0, 0), (0.45, 0.3)]],
    "D": [[(0, 0), (0, 1)], [(0.6, 0), (0.6, 1)], [(0, 0), (0.6, 1)], [(0.6, 0), (0, 1)]],
    "O": [[(0, 1), (0.6, 0.4), (0.3, 0.1), (0, 0.4), (0.6, 1)]],
}
RUNE_ROW = ["F", "U", "TH", "A", "R", "K", "X", "W", "H", "N", "I", "P", "Z", "S", "T", "B", "E", "M", "L", "D", "O"]


def _rune(C, k, ch, c, h, rot, w=0.010):
    """rune `ch` centred on c, h units tall, its up turned to `rot` degrees (-90 = upright)."""
    t = math.radians(rot + 90)
    ct, st = math.cos(t), math.sin(t)
    for s in RUNES[ch]:
        pts = []
        for x, y in s:
            u, v = (x - 0.3) * h, (y - 0.5) * h
            pts.append((c[0] + u * ct - v * st, c[1] + u * st + v * ct))
        C.line(k, pts, w)


def _rune_ring(C, k, c, r, h, n, a0=-90, skip=(), seed=0, w=0.010):
    """n runes round a circle of radius r, each standing on the circle (its foot toward the centre), the reference's rune bands."""
    for i in range(n):
        a = a0 + 360 / n * i
        if any(abs(((a - s0) + 180) % 360 - 180) < s1 for s0, s1 in skip):
            continue
        p = (c[0] + r * math.cos(math.radians(a)), c[1] + r * math.sin(math.radians(a)))
        _rune(C, k, RUNE_ROW[(i * 7 + seed) % len(RUNE_ROW)], p, h, a, w)


def _pol(c, r, a):
    return (c[0] + r * math.cos(math.radians(a)), c[1] + r * math.sin(math.radians(a)))


def _star(c, r, n, step, rot=-90):
    """the star polygon {n/step} as its closed strokes (a list of point lists: one per stroke cycle)."""
    P = [_pol(c, r, rot + 360 / n * i) for i in range(n)]
    seen, out = set(), []
    for s in range(n):
        if s in seen:
            continue
        cyc, i = [], s
        while i not in seen:
            seen.add(i); cyc.append(P[i]); i = (i + step) % n
        out.append(cyc)
    return out


def _zig(c, r0, r1, n, rot=-90):
    """a toothed ring: n points at r1, the valleys between them at r0 (the Halo's stars)."""
    pts = []
    for i in range(n):
        a = rot + 360 / n * i
        pts += [_pol(c, r1, a), _pol(c, r0, a + 180 / n)]
    return pts


def _bez(p0, p1, p2, n=24):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
            for t in np.linspace(0, 1, n)]


def _taper(C, k, pts, w0, w1):
    """a stroke along pts tapering from w0 to w1 (units): a filled polygon (feathers, horns, thorns)."""
    L, R_ = [], []
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]; d = math.hypot(dx, dy) or 1
        w = (w0 + (w1 - w0) * i / max(1, n - 1)) / 2
        w = max(w, 0.5 / (C.s))                                          # never under half a device px
        L.append((x - dy / d * w, y + dx / d * w)); R_.append((x + dy / d * w, y - dx / d * w))
    C.poly(k, L + R_[::-1])


def _thorn(C, k, base, ang, ln, w, bend=25):
    """a curved thorn from base, pointing `ang` degrees, bent `bend` degrees along its length (the reference's barbs and hooks)."""
    pts = [base]
    for t in np.linspace(0.2, 1, 6):
        a = ang + bend * t * t
        pts.append((pts[-1][0] + ln / 6 * math.cos(math.radians(a)), pts[-1][1] + ln / 6 * math.sin(math.radians(a))))
    _taper(C, k, pts, w, 0.0)


def _barb(C, k, c, s, w=0.012):
    """a barbed-wire knot: a small X (the reference's Valtiel cross and the Faith & Torment bars)."""
    C.line(k, [(c[0] - s, c[1] - s), (c[0] + s, c[1] + s)], w)
    C.line(k, [(c[0] - s, c[1] + s), (c[0] + s, c[1] - s)], w)


# ---- the symbols. Layers: `line` = the engraved structure, `solid` = filled metal (hatched from 40 px), `key` = the heart that burns when active,
#      `fine` = detail drawn only where it can be resolved, `cut` = grooves, `hole` = cut through, `gap` = cleared round an over-crossing.
#      Each returns the unit points the blood runs from (active: the first three; urgent: all), the lower edges of the heart first.
#      Every one is traced from its picture on skillunex.com/silent-hill-symbols (the page the user named as the authority, 2026-10-20).
def halo(C):
    """Halo of the Sun (the page's main symbol; its "SUN" picture): the heavy outer ring, a band of teeth with runes between them, the
    middle ring, a twelve-point star with a dot in each bay, the inner ring, the ring of twelve petals, and the dark sun disc in its ring."""
    c = (0.5, 0.5)
    C.ring("line", c, 0.468, 0.050, lo=1.0)
    C.ring("line", c, 0.340, 0.032, lo=1.0)
    if C.px >= 36:
        C.line("line", _zig(c, 0.345, 0.425, 12, rot=-75), 0.020, closed=True)        # the teeth of the outer band
    if C.px >= 96:
        _rune_ring(C, "fine", c, 0.405, 0.040, 12, a0=-90, seed=3)                    # a rune in each gap between two teeth
    C.line("line", _zig(c, 0.212, 0.335, 12), 0.022 if C.px >= 36 else 0.03, lo=1.0, closed=True)
    if C.px >= 44:
        for i in range(12):                                                          # the dots in the star's bays
            C.disc("line", _pol(c, 0.300, -90 + 15 + 30 * i), 0.017)
    if C.px >= 32:
        C.ring("line", c, 0.205, 0.020)
    if C.px >= 44:                                                                   # the petals: twelve small ovals round the sun
        for i in range(12):
            a = -90 + 30 * i + 15
            p0, p1 = _pol(c, 0.125, a), _pol(c, 0.192, a)
            m = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
            pts = [(m[0] + 0.036 * math.cos(math.radians(a)) * math.cos(t) - 0.017 * math.sin(math.radians(a)) * math.sin(t),
                    m[1] + 0.034 * math.sin(math.radians(a)) * math.cos(t) + 0.017 * math.cos(math.radians(a)) * math.sin(t))
                   for t in np.linspace(0, 2 * math.pi, 20, endpoint=False)]
            C.line("key", pts, 0.016, closed=True)
    C.ring("key", c, 0.112, 0.022 if C.px >= 36 else 0.03)
    C.disc("key", c, 0.080 if C.px >= 36 else 0.07)
    return [(0.5, 0.5 + 0.08), (0.45, 0.5 + 0.11), (0.55, 0.5 + 0.11), (0.5, 0.968), (0.28, 0.905), (0.72, 0.905)]


def metatron(C):
    """Seal of Metatron (the page's "Metatron's Seal"): the nine-point star of three interlaced triangles, the circle at its heart holding
    the M, and the runes standing in the star's points."""
    c = (0.5, 0.51)
    for cyc in _star(c, 0.490, 9, 3):
        C.line("line", cyc, 0.024 if C.px >= 36 else 0.03, lo=1.0, closed=True)
    if C.px >= 72:
        for i in range(9):                                                          # one rune in each point, one in each bay of the nonagon
            a = -90 + 40 * i
            _rune(C, "fine", RUNE_ROW[(3 * i + 1) % len(RUNE_ROW)], _pol(c, 0.355, a), 0.050, a)
            _rune(C, "fine", RUNE_ROW[(3 * i + 8) % len(RUNE_ROW)], _pol(c, 0.235, a + 20), 0.040, a + 20)
    if C.px >= 36:
        C.ring("key", c, 0.165, 0.022)
        h, w = 0.150, 0.128                                                         # the M: two heavy legs, the V between, serifs at the feet
        xl, xr, yt, yb = c[0] - w / 2, c[0] + w / 2, c[1] - h / 2, c[1] + h / 2
        C.line("key", [(xl, yb), (xl + 0.010, yt), (c[0], yb - 0.035), (xr - 0.010, yt), (xr, yb)], 0.022)
        if C.px >= 56:
            C.line("key", [(xl - 0.022, yb), (xl + 0.022, yb)], 0.012); C.line("key", [(xr - 0.022, yb), (xr + 0.022, yb)], 0.012)
    else:
        C.disc("key", c, 0.13)
    return [(0.5, c[1] + 0.165), (0.44, c[1] + 0.155), (0.56, c[1] + 0.155), (0.5, 0.99), (0.20, 0.88), (0.80, 0.88)]


def flauros(C):
    """Flauros (the page's picture): the triangular pyramid seen from above, the outer triangle apex up and its three edges running to the
    apex in the middle (drawn low, as the picture does); scratched twice where the hand went over it. The inner edges burn when it wakes."""
    A, L, Rr, I = (0.50, 0.03), (0.04, 0.93), (0.96, 0.93), (0.505, 0.635)
    C.line("line", [A, L, Rr], 0.034, lo=1.0, closed=True)
    for p in (A, L, Rr):
        C.line("key", [I, p], 0.026 if C.px >= 36 else 0.03, lo=1.0)
    C.disc("key", I, 0.030 if C.px >= 36 else 0.035)
    if C.px >= 56:                                                                   # the doubled scratches along the edges, as in the picture
        C.line("fine", [(0.47, 0.08), (0.10, 0.80)], 0.008)
        C.line("fine", [(0.54, 0.09), (0.90, 0.82)], 0.008)
        C.line("fine", [(0.12, 0.905), (0.86, 0.91)], 0.008)
        C.line("fine", [(0.485, 0.10), (0.495, 0.58)], 0.007)
    return [I, (0.30, 0.93), (0.70, 0.93), (0.5, 0.94), (0.10, 0.93), (0.90, 0.93)]


def samael(C):
    """Mark of Samael (the page's "Samael's Mark"): the black ram, head to us between its great curled horns, body walking left on four
    legs, the sigil on its brow, runes on the horns and flanks, the small sigil under its belly. The brow sigil and the eyes burn."""
    # the horns: from the crown up and out over the ears, down and curling in
    for sx in (-1, 1):
        pts = [(0.5 + 0.06, 0.20)]
        for t in np.linspace(0, 1, 44):                                          # a spiral: up, out, down past the ear and curling in
            ang = math.radians(-105 + 255 * t)
            r = 0.19 * (1 - 0.70 * t)
            pts.append((0.74 + r * math.cos(ang), 0.25 + r * math.sin(ang)))
        if sx < 0:
            pts = [(1 - x, y) for x, y in pts]
        _taper(C, "solid", pts, 0.085 if C.px >= 36 else 0.10, 0.028)
        if C.px >= 72:
            for i in range(5, 38, 5):                                                # the ridges of the horn
                x, y = pts[i]; x2, y2 = pts[i + 1]
                d = math.hypot(x2 - x, y2 - y) or 1
                nx, ny = -(y2 - y) / d, (x2 - x) / d
                C.line("cut", [(x - nx * 0.025, y - ny * 0.025), (x + nx * 0.025, y + ny * 0.025)], 0.007)
    # the head: long, narrowing to the muzzle; the ears out to the sides
    C.poly("solid", [(0.42, 0.17), (0.58, 0.17), (0.60, 0.27), (0.555, 0.43), (0.53, 0.48), (0.47, 0.48), (0.445, 0.43), (0.40, 0.27)])
    for sx in (-1, 1):
        C.poly("solid", [(0.5 + sx * 0.08, 0.26), (0.5 + sx * 0.18, 0.27), (0.5 + sx * 0.10, 0.31)])
    # the body (walking left), chest under the head, the legs and the tail
    C.ell("solid", (0.52, 0.62), 0.30, 0.13)
    C.ell("solid", (0.44, 0.55), 0.13, 0.10)
    for p in ([(0.30, 0.66), (0.22, 0.79), (0.26, 0.97)], [(0.38, 0.70), (0.39, 0.97)], [(0.68, 0.70), (0.74, 0.83), (0.71, 0.97)],
              [(0.78, 0.66), (0.86, 0.80), (0.84, 0.96)]):
        C.line("solid", p, 0.050, lo=1.0)
    C.line("solid", [(0.80, 0.54), (0.88, 0.57), (0.90, 0.62)], 0.022)
    if C.px >= 36:                                                                   # eyes and nostrils cut through; the brow sigil burns
        for sx in (-1, 1):
            C.poly("hole", [(0.5 + sx * 0.030, 0.315), (0.5 + sx * 0.075, 0.300), (0.5 + sx * 0.060, 0.325)])
            C.disc("hole", (0.5 + sx * 0.018, 0.455), 0.009)
        C.poly("key", [(0.5 + 0.030, 0.315), (0.5 + 0.075, 0.300), (0.5 + 0.060, 0.325)])
        C.poly("key", [(0.5 - 0.030, 0.315), (0.5 - 0.075, 0.300), (0.5 - 0.060, 0.325)])
    if C.px >= 48:                                                                   # the brow sigil: the knot of crossed strokes
        b = (0.5, 0.225)
        _barb(C, "hole", b, 0.030, 0.012)
        C.line("hole", [(b[0], b[1] - 0.04), (b[0], b[1] + 0.04)], 0.012)
        _barb(C, "key", b, 0.030, 0.012)
        C.line("key", [(b[0], b[1] - 0.04), (b[0], b[1] + 0.04)], 0.012)
    else:
        C.disc("key", (0.5, 0.23), 0.04)
    if C.px >= 72:                                                                   # runes on the flanks, the sigil under the belly
        for i, x in enumerate((0.27, 0.34, 0.66, 0.74)):
            _rune(C, "hole", RUNE_ROW[(5 * i + 2) % len(RUNE_ROW)], (x, 0.60), 0.065, -90, 0.009)
    if C.px >= 56:
        s = (0.52, 0.86)
        C.line("fine", [(s[0] - 0.06, s[1]), (s[0] + 0.06, s[1])], 0.010)
        C.line("fine", [(s[0], s[1] - 0.05), (s[0], s[1] + 0.01)], 0.010)
        _barb(C, "fine", (s[0], s[1] + 0.035), 0.035, 0.010)
    return [(0.5, 0.33), (0.53, 0.48), (0.47, 0.48), (0.26, 0.97), (0.71, 0.97), (0.84, 0.96)]


def valtiel(C):
    """Valtiel (the page's "Valtiel" picture): the tall cross with its capped head and foot, the long arm with end bars, barbed knots along
    the arm and down the lower shaft, and the two swept wings rising from behind the cross. The barbed cross burns."""
    C.line("key", [(0.5, 0.04), (0.5, 0.97)], 0.042, lo=1.0, caps=False)
    C.line("key", [(0.10, 0.50), (0.90, 0.50)], 0.036, lo=1.0, caps=False)
    if C.px >= 32:
        C.line("key", [(0.42, 0.045), (0.58, 0.045)], 0.034, caps=False)
        C.line("key", [(0.43, 0.965), (0.57, 0.965)], 0.034, caps=False)
        C.line("key", [(0.105, 0.44), (0.105, 0.56)], 0.034, caps=False)
        C.line("key", [(0.895, 0.44), (0.895, 0.56)], 0.034, caps=False)
    if C.px >= 40:
        for x in (0.20, 0.285, 0.37, 0.63, 0.715, 0.80):
            _barb(C, "key", (x, 0.50), 0.030, 0.014)
        for y in (0.60, 0.675, 0.75, 0.825):
            _barb(C, "key", (0.5, y), 0.032, 0.014)
    # the wings: five tapered feathers each, the longest highest, all sweeping out and up from a curled root beside the shaft
    tips = [(0.03, 0.04), (0.06, 0.12), (0.10, 0.19), (0.16, 0.25), (0.24, 0.30)]
    n = 5 if C.px >= 40 else 3
    for sx in (-1, 1):
        for i, (tx, ty) in enumerate(tips[:n] if n == 5 else (tips[0], tips[2], tips[4])):
            root = (0.40 - 0.010 * i, 0.395 - 0.008 * i)
            ctrl = (0.30 - 0.03 * i, 0.10 + 0.06 * i)
            pts = _bez(root, ctrl, (tx, ty), 20)
            pts = [(0.5 + sx * (0.5 - x), y) for x, y in pts]
            _taper(C, "solid", pts, 0.050 - 0.004 * i, 0.004)
        hook = _bez((0.43, 0.42), (0.33, 0.37), (0.36, 0.28), 14)                    # the curl at the wing's root
        _taper(C, "solid", [(0.5 + sx * (0.5 - x), y) for x, y in hook], 0.040, 0.012)
    return [(0.5, 0.97), (0.10, 0.56), (0.90, 0.56), (0.5, 0.84), (0.285, 0.53), (0.715, 0.53)]


def halo_sigil(C):
    """Halo Sigil (the page's film picture): the serpent ring, the serpent's body twisting down the middle in a double helix from its head at
    the top, runes in the helix's loops and at its sides, and the outer band of runes round it all. The serpent burns."""
    c = (0.5, 0.5)
    C.ring("key", c, 0.360, 0.050, lo=1.0)
    if C.px >= 56:
        C.ring("cut", c, 0.360, 0.008)                                               # the scales' seam along the serpent
    tw = 0.046 if C.px >= 36 else 0.05
    for ph in (0.0, math.pi):
        pts = [(0.5 + 0.105 * math.sin(4 * math.pi * t + ph), 0.14 + 0.72 * t) for t in np.linspace(0, 1, 80)]
        _taper(C, "key", pts, tw, tw * 0.75)
        if C.px >= 56:
            C.line("cut", pts[4:-4], 0.007)
    C.ell("key", (0.47, 0.135), 0.045, 0.030)                                        # the head over the ring at the top
    if C.px >= 48:
        C.disc("hole", (0.455, 0.128), 0.008)
    if C.px >= 72:
        _rune_ring(C, "fine", c, 0.450, 0.048, 30, a0=-84, skip=((90, 7),), seed=5)
        for ch, p in (("T", (0.5, 0.235)), ("O", (0.5, 0.50)), ("S", (0.5, 0.765)), ("N", (0.24, 0.50)), ("A", (0.76, 0.50))):
            _rune(C, "line", ch, p, 0.075, -90, 0.012)
        for sx in (-1, 1):                                                          # the X rays between the side runes and the helix
            C.line("fine", [(0.5 + sx * 0.16, 0.34), (0.5 + sx * 0.29, 0.40)], 0.010)
            C.line("fine", [(0.5 + sx * 0.16, 0.66), (0.5 + sx * 0.29, 0.60)], 0.010)
    elif C.px >= 40:
        _runes(C, c, 0.415, 0.475, n=30)
    return [(0.5, 0.86), (0.395, 0.82), (0.605, 0.82), (0.5, 0.86), (0.25, 0.77), (0.75, 0.77)]


def otherworld_gate(C):
    """Otherworld Gate (the page's film picture): the eight-point star of outward-bowed, interlaced bands with thorns along them, and the web of
    crossing strokes at its heart. The web burns."""
    c = (0.5, 0.5)
    P = [_pol(c, 0.49, -90 + 45 * i) for i in range(8)]
    w = 0.030 if C.px >= 36 else 0.034
    for i in range(8):                                                               # {8/3}: each band from a point to the third one on
        a, b = P[i], P[(i + 3) % 8]
        m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        ctrl = (m[0] - (c[0] - m[0]) * 0.40, m[1] - (c[1] - m[1]) * 0.40)    # bowed out: the wide heart of the picture, the points kept sharp
        pts = _bez(a, ctrl, b, 28)
        C.line("line", pts, w, lo=1.0)
        if C.px >= 48:                                                               # thorns along the band, turned away from the heart
            for t in (0.10, 0.22, 0.78, 0.90):
                j = int(t * 27); x, y = pts[j]; x2, y2 = pts[j + 1]
                nx, ny = -(y2 - y), x2 - x
                if nx * (x - c[0]) + ny * (y - c[1]) < 0:
                    nx, ny = -nx, -ny
                _thorn(C, "line", (x, y), math.degrees(math.atan2(ny, nx)) - 30, 0.060, 0.022, bend=20)
    for cyc in _star(c, 0.165 if C.px >= 36 else 0.14, 9, 4, rot=-80):
        C.line("key", cyc, 0.012 if C.px >= 48 else 0.02, lo=1.0, closed=True)
    if C.px >= 56:
        for i in range(5):
            a = -70 + 72 * i
            C.line("key", [_pol(c, 0.03, a + 180), _pol(c, 0.19, a)], 0.010)
    return [(0.5, 0.66), (0.42, 0.64), (0.58, 0.64), (0.5, 0.99), (0.21, 0.79), (0.79, 0.79)]


def faith_torment(C):
    """Faith & Torment (the page's film picture): the double-barred cross of boxed beams wrapped in barbed wire, runes down the beams, and
    the ring of thorns round the lower crossing. The ring of thorns and its sigil burn."""
    boxes = [(0.435, 0.02, 0.565, 0.98), (0.17, 0.20, 0.83, 0.31), (0.03, 0.53, 0.97, 0.64)]
    for x0, y0, x1, y1 in boxes:
        C.poly("solid", [(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
    if C.px >= 40:
        for x0, y0, x1, y1 in boxes:
            C.line("line", [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], 0.016, closed=True)
            C.line("cut", [(x0 + 0.022, y0 + 0.022), (x1 - 0.022, y0 + 0.022), (x1 - 0.022, y1 - 0.022), (x0 + 0.022, y1 - 0.022)], 0.008,
                   closed=True)
    if C.px >= 56:                                                                   # the barbed wire along the beams
        for x in np.arange(0.06, 0.95, 0.075):
            if abs(x - 0.5) > 0.12:
                _barb(C, "fine", (x, 0.53), 0.014, 0.008); _barb(C, "fine", (x, 0.64), 0.014, 0.008)
        for x in np.arange(0.20, 0.82, 0.075):
            if abs(x - 0.5) > 0.09:
                _barb(C, "fine", (x, 0.20), 0.014, 0.008); _barb(C, "fine", (x, 0.31), 0.014, 0.008)
        for y in np.arange(0.05, 0.96, 0.075):
            if not (0.17 < y < 0.34 or 0.43 < y < 0.72):
                _barb(C, "fine", (0.435, y), 0.014, 0.008); _barb(C, "fine", (0.565, y), 0.014, 0.008)
    if C.px >= 72:                                                                   # the runes cut in the beams ("FRITH" left, "TORMNT" right)
        for i, ch in enumerate(("F", "R", "I", "TH")):
            _rune(C, "cut", ch, (0.10 + 0.075 * i, 0.585), 0.07, -90, 0.009)
        for i, ch in enumerate(("T", "O", "R", "M", "N", "T")):
            _rune(C, "cut", ch, (0.655 + 0.052 * i, 0.585), 0.07, -90, 0.009)
        for i, ch in enumerate(("F", "L", "X", "O", "L")):
            _rune(C, "cut", ch, (0.5, 0.07 + 0.085 * i), 0.06, -90, 0.009)
        for i, ch in enumerate(("R", "K", "E")):
            _rune(C, "cut", ch, (0.5, 0.76 + 0.075 * i), 0.06, -90, 0.009)
    rc = (0.5, 0.585)
    C.disc("gap", rc, 0.135)
    C.ring("key", rc, 0.095, 0.034 if C.px >= 36 else 0.05, lo=1.0)
    if C.px >= 40:
        for i in range(14):                                                          # the thorns round the ring
            a = -90 + 360 / 14 * i
            _thorn(C, "key", _pol(rc, 0.110, a), a, 0.055 if i % 2 else 0.040, 0.020, bend=20)
        _rune(C, "key", "S", rc, 0.07, -90, 0.014)                                    # the sigil in the ring
    return [(0.5, 0.68), (0.44, 0.66), (0.56, 0.66), (0.5, 0.98), (0.10, 0.64), (0.90, 0.64)]


def eternal_flame(C):
    """Eternal Flame (the page's Halo of the Sun picture): the ring wreathed in curved thorns, the long hooks at its crown, and the
    seven-point star inscribed in it. The star burns."""
    c = (0.5, 0.53)
    C.ring("line", c, 0.395, 0.040, lo=1.0)
    n = 16 if C.px >= 48 else 10 if C.px >= 32 else 8
    for i in range(n):
        a = -90 + 360 / n * i + 6
        ln = (0.13 if i % 2 == 0 else 0.09) * (1.35 if abs(((a + 90) + 180) % 360 - 180) < 30 else 1.0)
        _thorn(C, "line", _pol(c, 0.400, a), a + 35, ln, 0.034 if C.px >= 36 else 0.04, bend=-75)
    for cyc in _star(c, 0.380, 7, 3):
        C.line("key", cyc, 0.022 if C.px >= 36 else 0.03, lo=1.0, closed=True)
    return [(0.5, c[1] + 0.13), (0.40, c[1] + 0.20), (0.60, c[1] + 0.20), (0.5, 0.98), (0.20, 0.82), (0.80, 0.82)]


def suns_vitality(C):
    """Sun's Vitality (the page's Halo of the Sun picture): the hexagram, a ringed eye at each of its four side points, the rune staves
    above and below, the hourglass at its heart, the runes in its cells and the barred marks on its flanks. The hourglass burns."""
    up = [(0.5, 0.06), (0.92, 0.79), (0.08, 0.79)]
    dn = [(0.08, 0.21), (0.92, 0.21), (0.5, 0.94)]
    C.line("line", up, 0.024 if C.px >= 36 else 0.03, lo=1.0, closed=True)
    C.line("line", dn, 0.024 if C.px >= 36 else 0.03, lo=1.0, closed=True)
    for p in (dn[0], dn[1], up[2], up[1]):
        if C.px >= 36:
            C.ring("line", p, 0.042, 0.016)
            C.disc("line", p, 0.016)
        else:
            C.disc("line", p, 0.045)
    if C.px >= 40:                                                                   # the staves above and below
        for sy, y0 in ((-1, 0.06), (1, 0.94)):
            C.line("line", [(0.5, y0), (0.5, y0 + sy * 0.06)], 0.016)
            C.line("line", [(0.45, y0 + sy * 0.04), (0.55, y0 + sy * 0.04)], 0.014)
            C.line("line", [(0.46, y0 + sy * 0.062), (0.5, y0 + sy * 0.045), (0.54, y0 + sy * 0.062)], 0.012)
    hg = [(0.43, 0.37), (0.57, 0.37), (0.43, 0.63), (0.57, 0.63)]                  # the hourglass
    if C.px >= 36:
        C.line("key", hg, 0.020, closed=True)
        C.line("key", [(0.42, 0.37), (0.58, 0.37)], 0.020); C.line("key", [(0.42, 0.63), (0.58, 0.63)], 0.020)
        C.poly("key", [(0.47, 0.55), (0.53, 0.55), (0.57, 0.62), (0.43, 0.62)])     # the sand run down
    else:
        C.poly("key", [hg[0], hg[1], hg[2], hg[3]])
    if C.px >= 56:                                                                   # the barred marks on the flanks: | X | and | D | E
        for sx in (-1, 1):
            x = 0.5 + sx * 0.36
            C.line("fine", [(x - 0.04, 0.44), (x - 0.04, 0.56)], 0.010); C.line("fine", [(x + 0.04, 0.44), (x + 0.04, 0.56)], 0.010)
        _rune(C, "fine", "X", (0.14, 0.50), 0.07, -90)
        _rune(C, "fine", "D", (0.86, 0.50), 0.07, -90)
    if C.px >= 72:                                                                   # the runes in the cells and over the points
        for ch, p in (("P", (0.37, 0.33)), ("D", (0.5, 0.26)), ("K", (0.63, 0.33)), ("S", (0.37, 0.67)), ("I", (0.5, 0.74)), ("F", (0.63, 0.67)),
                      ("K", (0.30, 0.10)), ("U", (0.70, 0.10)), ("L", (0.30, 0.90)), ("T", (0.70, 0.90)), ("N", (0.58, 0.50))):
            _rune(C, "fine", ch, p, 0.065, -90)
    return [(0.5, 0.63), (0.45, 0.63), (0.55, 0.63), (0.5, 0.99), (0.08, 0.84), (0.92, 0.84)]


SYMBOLS = {1: halo, 2: metatron, 3: flauros, 4: samael, 5: valtiel, 6: halo_sigil, 7: otherworld_gate, 8: faith_torment, 9: eternal_flame,
           10: suns_vitality}
PAINTED = ()                                                            # v3: every symbol is engraved iron (the v2 painted Halo is gone)


def _hatch(px, ang=62.0, period=None, seed=0):
    """engraved hatching on the tier's grid (from 40 px): fine lines with breaks, 0..1."""
    period = period or max(2.0, px / 26.0)
    yy, xx = np.mgrid[0:px, 0:px] + 0.5
    t = math.radians(ang)
    u = (xx * math.cos(t) + yy * math.sin(t)) / period
    lines = np.clip(1.4 - 2.8 * np.abs(u - np.round(u)), 0, 1)
    rng = np.random.default_rng(seed)
    br = S.curve(S.gblur(rng.random((px, px)).astype(np.float32), max(0.8, px / 40)), 0.35, 0.65)
    return lines * (0.55 + 0.45 * br)


def _wear(px, seed):
    """the iron's wear: a soft mottling 0.72..1 (from 40 px; flat below, a micro tier keeps full strength)."""
    if px < 40:
        return np.ones((px, px), np.float32)
    g = S.grain(px, px, seed=seed)
    g = (g - g.min()) / max(1e-3, g.max() - g.min())
    return 0.72 + 0.28 * g


_CACHE = {}


def _maps(n, px):
    """tile-res maps of symbol n: A alpha, T tone (0..1, bright = the engraving's cuts and rims), K the heart, rust, and the run origins (px)."""
    key = (n, px)
    if key in _CACHE:
        return _CACHE[key]
    C = Ctx(px)
    pts = SYMBOLS[n](C)
    L = C.out()
    z = np.zeros((px, px), np.float32)
    g = lambda k: L.get(k, z)
    faces = [g("face0"), g("face1")]
    hole, gap = g("hole"), g("gap")
    line, keyl, fine, cut = g("line") * (1 - gap), g("key"), g("fine"), g("cut")      # Shepherd: the anchor is cut round the swords over it
    solid = np.clip(g("solid") * (1 - gap) + g("sword") + sum(faces), 0, 1)
    A = np.clip(np.maximum.reduce([solid, line, keyl, fine]), 0, 1) * (1 - hole)
    K = keyl * (1 - hole)
    micro = px < 40
    wear = _wear(px, 7 * n + px)
    if micro:
        T = np.ones_like(A) * (1 - 0.6 * S.curve(cut, 0.3, 0.6))
        if any(f.any() for f in faces):                                  # Flauros: the lit face and the shadowed one
            T = np.clip(T - faces[1] * 0.45 * (1 - S.curve(K, 0.3, 0.6)), 0, 1)
    else:
        fill = np.maximum(solid, K)
        Fh = S.curve(fill, 0.3, 0.7)
        rim = S.rim_of(Fh)
        if px >= 72:
            rim = np.clip(np.maximum(rim, S.rim_of(np.clip(Fh - rim, 0, 1)) * 0.7), 0, 1)
        if any(f.any() for f in faces):                                  # Flauros: each face its own engraving angle and tone
            inner = sum(f * np.maximum(_hatch(px, ang, seed=n + i) * 0.85, tn) for i, (f, ang, tn) in enumerate(zip(faces, (62, -24), (0.42, 0.18))))
        else:
            inner = np.clip(_hatch(px, 62 if n % 2 else -28, seed=n) * 0.85 + 0.12, 0, 1)
        stroke = S.curve(np.maximum(line, fine), 0.2, 0.7)
        T = np.maximum(stroke, np.maximum(rim, inner * (1 - rim)) * Fh)
        T = np.where(A > 0.02, np.maximum(T, 0.0), 0) * wear
        T = T * (1 - 0.85 * S.curve(cut, 0.2, 0.6))
        T = S.distress(T, seed=n, k=0.35 if px >= 56 else 0.22)          # a worn engraving, not a vector edge
        T = np.clip(T / np.maximum(A, 1e-3) * (A > 0.02), 0, 1)
        if n in PAINTED:                                                  # paint, not iron: brush streaks along the stroke instead of hatching
            br = S.grain(px, px, seed=90 + n)
            br = (br - br.min()) / max(1e-3, br.max() - br.min())
            T = 0.55 + 0.45 * br
            A = S.distress(A, seed=31, k=0.30 if px >= 56 else 0.18)
    # rust: short streaks of dried blood running down the iron (from 40 px)
    if not micro:
        rng = np.random.default_rng(100 + n)
        seed_ = (rng.random((px, px)) > 0.990).astype(np.float32) * S.curve(A, 0.5, 0.8)
        Ln = max(3, int(round(px / 10)))
        st_ = np.zeros((px, px), np.float32)
        for k in range(Ln):
            st_ = np.maximum(st_, np.roll(seed_, k, axis=0) * (1 - k / Ln) ** 0.7)
        rust = S.curve(S.gblur(st_, 0.45), 0.10, 0.45) * S.curve(A, 0.3, 0.7)
    else:
        rust = np.zeros((px, px), np.float32)
    origins = [C.T(*p) for p in pts]
    _CACHE[key] = (A, T, K, rust, origins)
    return _CACHE[key]


def _runs(px, origins, count, urgent, seed):
    """blood (coverage 0..1) off the symbol with ito_ringws' routine: a run from each of the first `count` origins, falling a share of the
    room left under it, a spray where the first one (urgent: every one) leaves the iron."""
    m, d = R._pad(px)
    rng = np.random.default_rng(5100 + 31 * seed + (7 if urgent else 0))
    w = 1.0 if px < 40 else max(1.3, 0.024 * px)
    for j, (x, y) in enumerate(origins[:count]):
        lo, hi = (0.75, 1.0) if urgent else (0.40, 0.92)
        y1 = min(px - 0.6, max(y + (px - 0.6 - y) * rng.uniform(lo, hi), y + 2.5))
        R.run(d, rng, x, y, y1, w * rng.uniform(0.75, 1.25), px)
        if px >= 40 and (urgent or j == 0):
            R.spray(d, rng, x, y + 0.02 * px, 0.08 * px, 11 if urgent else 6, max(0.6, 0.015 * px), 90, px)
    return R._out(m, px)


def ws_cult(n, st, px, light=False):
    """one tile: the cult symbol of workspace n in state st at px (the numeral top-left, as the pyramid family). Returns RGBA."""
    A, T, K, rust, origins = _maps(n, px)
    micro = px < 40
    painted = n in PAINTED
    N, moat = S.numeral(n, px, max(7, int(round(0.28 * px))))
    keep = 1 - moat
    z = 0 * A
    Kh = S.curve(K, 0.25, 0.6)
    if not light:
        tone = 0.34 + 0.62 * T
    else:
        tone = 0.42 + 0.58 * T
    if st == "empty":                                                    # a cold ghost: the symbol's outline only, dim, nothing filled
        Ah = S.curve(A, 0.3, 0.6)
        ghost = np.maximum(S.rim_of(Ah), S.curve(A, 0.3, 0.7) * (1 - S._er((Ah > 0.5).astype(np.float32), 1)))     # rims + the thin strokes whole
        layers = [(A * (0.10 if not light else 0.08), _col_g(0.5 + z)),
                  (ghost * (0.62 if not light else 0.70), _col_g((0.58 if not light else 0.62) + z))]
    elif st == "occupied":
        if painted:                                                      # old blood paint, dried dark on the wall
            w = 0.85 + z
            rv = (0.36 + 0.22 * T) if not light else (0.70 + 0.25 * T)
        else:
            w = np.clip(rust * (0.80 if not light else 0.70), 0, 1)
            rv = (0.42 + 0.18 * T) if not light else (0.80 + 0.15 * T)
        layers = [(A, R._col(tone, w, rv))]
    elif st == "active":
        if painted:
            w = np.maximum(0.80 + z, Kh)
            rv = np.where(Kh > 0.05, (0.80 + 0.20 * T) if not light else 1.0, (0.40 + 0.20 * T) if not light else (0.72 + 0.2 * T))
        else:
            w = np.maximum(np.clip(rust * 0.85, 0, 1), Kh)
            rv = np.where(Kh > 0.05, (0.74 + 0.26 * T) if not light else (0.90 + 0.10 * T), (0.50 + 0.2 * T) if not light else (0.85 + 0.1 * T))
        D = _runs(px, origins, 1 if px < 32 else 3, False, n) * keep * (1 - S.curve(A, 0.5, 0.9) * (1 - Kh) * 0.6)
        layers = [(A, R._col(tone, w, rv))] + R._blood_layers(D, px, light)
    else:
        if not light:                                                    # a wash over the iron, its own engraving kept as the blood's strength
            wash = 0.30 + 0.70 * T ** 0.85
            wf = 1 - 0.25 * S.curve(T, 0.80, 1.0)
        else:
            wash = 0.45 + 0.55 * T ** 0.8
            wf = 1 - 0.45 * S.curve(T, 0.80, 1.0)
        if micro:
            wash, wf = 0.95 + z, 1.0 + z
        D = _runs(px, origins, 3 if px < 32 else 6, True, n) * keep
        layers = [(A, R._col(tone, wf, wash))] + R._blood_layers(D, px, light)
    layers = [(a * keep, c) for a, c in layers]
    layers.append((N * moat * (0.7 if st == "empty" else 1.0), _col_g(1 + z)))
    out = R._over(layers)
    return Image.fromarray((R._no_black(np.clip(out, 0, 1)) * 255 + 0.5).astype(np.uint8), "RGBA")


def _col_g(g):
    """plain grey (no blood) through ito_ringws' colour."""
    return R._col(g, 0 * g, 0 * g)


def products(tiers=TIERS):
    out = []
    for px in tiers:
        for n in range(1, 11):
            for st in STATES:
                out += [(f"workspaces/bar/{px}/ws-cult-{n}-{st}.png", ws_cult(n, st, px, False)),
                        (f"workspaces/bar/{px}/ws-cult-{n}-{st}.light.png", ws_cult(n, st, px, True))]
    return out + S.previews("cult", ws_cult, tiers)
