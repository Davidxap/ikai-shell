#!/usr/bin/env python3
"""Legibility gate for bar-size art (dev/openspec/changes/ito-shell-inspiration/decisions-barsize.md, section 3).

Blocking : the shipped bar-size set (workspaces/bar/<px>/), measured as it is. Exit 1 on any FAIL.
Report   : the old 256 px sets (Qt path: sourceSize 2x, then bilinear) at 24/28/32. Never changes the exit code.

  python3 scripts/qa/test-barsize-legibility.py [--no-old] [--sheet DIR]
"""
import argparse, itertools, os, sys
import numpy as np
from PIL import Image

ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "bar", "modules", "ito-art", "workspaces")
ST = ["empty", "occupied", "active", "urgent"]
LIM = dict(crisp=0.45, fill=0.55, black=0.05, dNum=3.0, dState=2.0)
# number: "positional" = the family tells workspaces apart by position in the bar (one shared drawing, flick
# direction and winding alternate), not by a mark of its own, so dNum is exempt BY DESIGN. Numbered sets keep dNum.
NUMBER = {"uzumaki-classic": "arms", "uzumaki-vortex": "positional", "uzumaki-original": "arms", "uzumaki-numbered": "glyph", "uzumaki-hook": "arms",
          # S2d HD tiers: the sheet-cut and engraved families do not tell workspaces apart by a drawing of their own (rings, marks and eyes are one drawing for
          # every number, halo / flauros only a small tally), so dNum is exempt by design; crisp of the tonal Tomie eyes is report-only (judged by eye)
          "orbs": "positional", "dots": "positional", "eyes": "positional", "halo": "positional", "flauros": "positional"}
# Checks a family is NOT blocked on, reported only. uzumaki-original is the user's approved ORIGINAL drawing, redrawn per device px
# (master-plan-v4 S1c): arm count and state differences are the drawing's own, so dNum/dState are information there; what the redraw is
# responsible for (crisp, fill, black) still blocks at EVERY shipped size.
# uzumaki-classic (card Uzumaki v1) is the same user-approved original drawing, pre-rendered per bucket (S1b fit): dNum/dState are information.
REPORT_ONLY = {"eyes": ("crisp", "dState"), "dots": ("dState",), "numerals": ("dNum", "dState"), "remina": ("dNum", "dState"), "uzumaki-original": ("dNum", "dState"), "uzumaki-classic": ("dNum", "dState")}
# (S2d: numerals / remina / dots are the sheet and vector families of test-hd-tiers.py, whose contract is crisp / fill / black; how much one number differs from the next is information here)
# the classic drawing's arms are too many for a thin stroke below 40 px (and at 48): crisp is information at the buckets the S1b fit never shipped
CLASSIC_CRISP_INFO = (24, 26, 28, 30, 32, 36, 48)
MARK = dict(crisp=0.60, fill=0.55, black=0.05)    # system/bar/<px>/menu-uzumaki.png (S1c): blocking at every shipped size
SYS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "bar", "modules", "ito-art", "system", "bar")
GROUNDS = {"dark": (38, 32, 30, 255), "light": (222, 214, 200, 255)}


def qt(im, px):  # Qt path: sourceSize 2x at load, GPU bilinear to px
    return im.resize((2 * px, 2 * px), Image.LANCZOS).resize((px, px), Image.BILINEAR)


def mip(im, px):
    while im.width // 2 >= px:
        im = im.resize((im.width // 2,) * 2, Image.BOX)
    return im.resize((px, px), Image.BILINEAR)


def arr(im):
    return np.asarray(im.convert("RGBA"), dtype=float) / 255


def feat(a):  # premultiplied luma + alpha
    luma = (0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]) * a[..., 3]
    return np.stack([luma, a[..., 3]], -1)


def metrics(im, px, ref=None):
    a = arr(im)
    al = a[..., 3]
    m = max(al.max(), 1e-3)
    on = (al >= .15 * m).sum()
    crisp = (al >= .6 * m).sum() / max(on, 1)
    fill = (al >= .5).sum() / (px * px * np.pi / 4)
    luma = 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
    black = ((al > .85) & (luma < .15)).sum() / max(on, 1)
    alias = np.abs(feat(a) - feat(arr(ref))).mean() * 10 if ref is not None else 0.0
    return crisp, fill, black, alias, feat(a)


def family(load, px):
    F = {}
    worst = dict(crisp=1, fill=0, black=0, alias=0)
    for s in ST:
        for n in range(1, 11):
            im, ref = load(n, s, px)
            c, f, b, al, ft = metrics(im, px, ref)
            F[s, n] = ft
            worst["crisp"] = min(worst["crisp"], c)
            worst["fill"] = max(worst["fill"], f)
            worst["black"] = max(worst["black"], b)
            worst["alias"] = max(worst["alias"], al)
    dn = min(np.abs(F[s, i] - F[s, j]).mean() * 100 for s in ST for i, j in itertools.combinations(range(1, 11), 2))
    ds = min(np.abs(F[a, n][..., 1] - F[b, n][..., 1]).mean() * 100
             for n in range(1, 11) for a, b in [("active", "urgent"), ("occupied", "urgent")])
    return worst, dn, ds


def verdict(w, dn, ds, number="glyph"):
    bad = []
    if w["crisp"] < LIM["crisp"]: bad.append("crisp")
    if w["fill"] > LIM["fill"]: bad.append("fill")
    if w["black"] > LIM["black"]: bad.append("black")
    if number != "positional" and dn < LIM["dNum"]: bad.append("dNum")
    if ds < LIM["dState"]: bad.append("dState")
    return bad


def line(tag, px, w, dn, ds, bad, alias=False, number="glyph"):
    if number == "positional": dn_txt = "dNum=positional"
    else: dn_txt = f"dNum>={dn:.2f}"
    extra = f" alias<={w['alias']:.2f}" if alias else ""
    return (f"{'PASS' if not bad else 'FAIL'} {tag:9s} {px:3d}px crisp>={w['crisp']:.2f} fill<={w['fill']:.2f} "
            f"black<={w['black']:.2f} {dn_txt} dState>={ds:.2f}{extra}" + (f"  [{','.join(bad)}]" if bad else ""))


def bar_loader(fam):
    def ld(n, s, px):
        im = Image.open(os.path.join(ART, "bar", str(px), f"ws-{fam}-{n}-{s}.png")).convert("RGBA")
        return im, None
    return ld


def old_loader(fam):
    def ld(n, s, px):
        im = Image.open(os.path.join(ART, f"ws-{fam}-{n}-{s}.png")).convert("RGBA")
        return qt(im, px), mip(im, px)
    return ld


def sheet(fam, px, ground, dest, loader):
    z = 3
    cell = (px + 4) * z
    O = Image.new("RGBA", (10 * cell, len(ST) * cell), GROUNDS[ground])
    for r, s in enumerate(ST):
        for n in range(1, 11):
            m = loader(n, s, px)[0]
            b = Image.new("RGBA", m.size, GROUNDS[ground])
            b.alpha_composite(m)
            O.paste(b.resize((px * z, px * z), Image.NEAREST), ((n - 1) * cell + 2 * z, r * cell + 2 * z))
    os.makedirs(dest, exist_ok=True)
    O.save(os.path.join(dest, f"{fam}-{px}-{ground}.png"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-old", action="store_true")
    ap.add_argument("--sheet", help="also write contact sheets (dark and light ground) into this dir")
    a = ap.parse_args()
    failed = False
    bar_root = os.path.join(ART, "bar")
    sizes = sorted(int(d) for d in os.listdir(bar_root)) if os.path.isdir(bar_root) else []
    fams = sorted({f[3:].rsplit("-", 2)[0] for px in sizes for f in os.listdir(os.path.join(bar_root, str(px))) if f.startswith("ws-")})
    print("== bar-size set (blocking)")
    for fam in fams:
        for px in sizes:
            if not os.path.exists(os.path.join(bar_root, str(px), f"ws-{fam}-1-empty.png")):
                continue                                  # a family ships its own size set (uzumaki-original ships 14 sizes, 24-128)
            w, dn, ds = family(bar_loader(fam), px)
            num = NUMBER.get(fam, "glyph")
            bad = verdict(w, dn, ds, num)
            info = [b for b in bad if b in REPORT_ONLY.get(fam, ()) or (b == "crisp" and fam == "uzumaki-classic" and px in CLASSIC_CRISP_INFO)]
            bad = [b for b in bad if b not in info]
            failed |= bool(bad)
            print(line(fam, px, w, dn, ds, bad, number=num) + (f"  (report only: {','.join(info)})" if info else ""))
            if a.sheet:
                for g in GROUNDS:
                    sheet(fam, px, g, a.sheet, bar_loader(fam))
    if not sizes:
        print("FAIL no bar-size set found")
        failed = True
    print("== menu-uzumaki.png bar marks (blocking)")
    msizes = sorted(int(d) for d in os.listdir(SYS) if os.path.exists(os.path.join(SYS, d, "menu-uzumaki.png"))) if os.path.isdir(SYS) else []
    if not msizes:
        print("FAIL no menu-uzumaki.png bar marks found")
        failed = True
    for px in msizes:
        im = Image.open(os.path.join(SYS, str(px), "menu-uzumaki.png")).convert("RGBA")
        c, f, b, _, _ = metrics(im, px)
        bad = [k for k, ok in (("crisp", c >= MARK["crisp"]), ("fill", f <= MARK["fill"]), ("black", b <= MARK["black"])) if not ok]
        failed |= bool(bad)
        print(f"{'PASS' if not bad else 'FAIL'} mark      {px:3d}px crisp={c:.2f} fill={f:.2f} black={b:.2f}" + (f"  [{','.join(bad)}]" if bad else ""))
    if not a.no_old:
        print("== old 256 px sets (report only)")
        for fam in ("uzumaki", "remina", "halo", "flauros"):
            for px in (24, 28, 32):
                w, dn, ds = family(old_loader(fam), px)
                print(line(fam, px, w, dn, ds, verdict(w, dn, ds), alias=True).replace("FAIL", "info-FAIL", 1))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
