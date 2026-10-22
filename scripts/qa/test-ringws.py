#!/usr/bin/env python3
"""Gate for the ringed workspace families (bar/modules/bin/ito_ringws.py; families `pyramid`, `heather`):
  * no hex colour in ito_ringws.py (tokens / grey tones only)
  * the ring language on a stand-in figure (a disc): every state is an RGBA square at every tier, no black ground, fill within the user gate;
    empty is a faint ghost without red, occupied adds red scratch bars, active is redder still (the ring and its runs), urgent is the reddest
  * under 40 px the ring has no crosshair ticks (one whole device px ring only)
  * the blood (2026-10-20 redo, the round-headed drips read as mucus): several separate runs reach the tile's foot, the fresh blood
    has a range of strengths (coagulated edges, wet core) and the urgent wash keeps the figure's texture (not a flat fill)
  * the picker preview (ws-<family>-preview-active) has no numeral: its numeral corner is empty while workspace 3's is not
  * the families are registered everywhere the shell and the gates read them (ito-assets WS_FAMILIES, BarWidget famNames, PageWorkspaces
    cards, test-hd-tiers USER_WS, sweep-settings); the removed `pyramid-classic` is registered nowhere and a stored value reads as `pyramid`
  * the pyramid-head mark (S22/S23): the sprite's lighting in theme tokens (true deep shadows, a small blood share, a clean tip, light twin inverted); the pyramid tiles (S13-S15): blood only where it bleeds (the theme shader makes it the accent),
    no bright horn at the helmet's tip (dark twin: the dark edge; light twin: the ink edge), urgent never floods the whole head
  * with the user's pictures present (~/Downloads/Ideas): Heather and the ringed Pyramid render at 24 and 128 px, the recipes write their numeral-free
    previews and no `pyramid-classic` file, and a picture of the wrong size is refused with a message
  python3 scripts/qa/test-ringws.py
"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
sys.path.insert(0, os.path.join(ROOT, "bar", "modules", "bin"))
import numpy as np
from PIL import Image, ImageFilter
import ito_ringws as R

fails = []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def read(rel):
    return open(os.path.join(ROOT, rel)).read()


def stats(im):
    a = np.asarray(im, np.float32) / 255
    al = a[..., 3]
    px = a.shape[0]
    lu = 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
    black = float(((al > 0.85) & (lu < 0.15)).sum()) / max(1, int((al > 0.15).sum()))
    fill = float((al >= 0.5).sum()) / (px * px * np.pi / 4)
    red = float((np.clip(a[..., 0] - np.maximum(a[..., 1], a[..., 2]), 0, 1) * al).sum())
    return black, fill, red, float(al.mean())


check(not re.search(r"#[0-9a-fA-F]{6}\b|0x[0-9a-fA-F]{6}\b", read("bar/modules/bin/ito_ringws.py")), "no hex colour in ito_ringws.py")

for px in (24, 32, 40, 64, 128):
    yy, xx = np.mgrid[0:px, 0:px] + 0.5
    cx, cy, r = R.geom(px)
    disc = np.clip(r * 0.85 - np.hypot(xx - cx, yy - cy), 0, 1).astype(np.float32)
    F = dict(A=disc, T=np.clip(xx / px, 0, 1).astype(np.float32))
    for light in (False, True):
        s = {}
        for st in R.STATES:
            im = R.compose(F, 3, st, px, light)
            ok = im.mode == "RGBA" and im.size == (px, px)
            b, f, red, am = stats(im)
            s[st] = (red, am)
            check(ok and b <= 0.05 and f <= 0.85, f"{px} px {st}{' light' if light else ''}: RGBA square, black {b:.2f} <= 0.05, fill {f:.2f} <= 0.85")
        check(s["empty"][0] == 0 and s["empty"][1] < s["occupied"][1], f"{px} px{' light' if light else ''}: empty is a faint ghost without red")
        check(0 < s["occupied"][0] < s["active"][0] < s["urgent"][0], f"{px} px{' light' if light else ''}: red grows occupied < active < urgent")
    ring, ticks = R.ring(px)
    check((ticks.max() == 0) == (px < 40) and ring.max() > 0.5, f"{px} px: the ring is drawn, its ticks only from 40 px")
check(np.array_equal(R.scratches(64, 2), R.scratches(64, 2)) and not np.array_equal(R.scratches(64, 2), R.scratches(64, 3)),
      "scratch bars are fixed per workspace and differ between workspaces")

# ---- the blood: thin runs, a range of strengths, a textured wash ----------------------------------------------------------------------------
import ito_sh as S
for px in (48, 80, 128):
    D = R.ring_blood(px, True, 3, ((0.40 * px, 0.62 * px), (0.55 * px, 0.66 * px)))
    check(np.array_equal(D, R.ring_blood(px, True, 3, ((0.40 * px, 0.62 * px), (0.55 * px, 0.66 * px)))), f"{px} px: the blood is fixed per workspace")
    runs = [int(v) for v in (np.diff((D[int(0.85 * px)] > 0.5).astype(np.int8)) == 1).nonzero()[0]]
    check(len(runs) >= 3, f"{px} px: several separate runs reach the tile's foot ({len(runs)})")
    val, gl = R.blood_maps(D, px)
    sel = D > 0.5
    check(sel.any() and float(val[sel].max() - val[sel].min()) >= 0.20, f"{px} px: fresh blood has coagulated edges and a wet core (value range {float(val[sel].max() - val[sel].min()):.2f} >= 0.20)")
    yy, xx = np.mgrid[0:px, 0:px] + 0.5
    cx, cy, r = R.geom(px)
    disc = np.clip(r * 0.85 - np.hypot(xx - cx, yy - cy), 0, 1).astype(np.float32)
    T = (0.5 + 0.5 * np.sin(xx * 0.9) * np.sin(yy * 0.7)).astype(np.float32)
    for light in (False, True):
        a = np.asarray(R.compose(dict(A=disc, T=T), 3, "urgent", px, light), np.float32) / 255
        inner = np.hypot(xx - cx, yy - cy) < r * 0.6
        check(float(a[..., 0][inner].std()) >= 0.06, f"{px} px urgent{' light' if light else ''}: the wash keeps the figure's texture (red channel spread {float(a[..., 0][inner].std()):.3f} >= 0.06)")
    pv = S.previews("ringtest", lambda n, st, p, lt: R.compose(dict(A=disc, T=T), n, st, p, lt), (px,))
    check([rel for rel, _ in pv] == [f"workspaces/bar/{px}/ws-ringtest-preview-active.png", f"workspaces/bar/{px}/ws-ringtest-preview-active.light.png"],
          f"{px} px: the preview is ws-<family>-preview-active (+ light)")
    corner = lambda im: float((np.asarray(im, np.float32)[: int(0.30 * px), : int(0.22 * px), 3] / 255).sum())
    check(corner(pv[0][1]) < 0.5 and corner(R.compose(dict(A=disc, T=T), 3, "active", px)) > 3, f"{px} px: the preview has no numeral, the bar tile keeps its 3")

# ---- registration: every place that lists the user families knows the new ones --------------------------------------------------------
NEW = ("heather",)
m = re.search(r"^WS_FAMILIES = \(([^)]*)\)", read("bar/modules/bin/ito-assets"), re.M)
fams = re.findall(r'"([\w-]+)"', m.group(1)) if m else []
check(all(f in fams for f in NEW + ("pyramid",)) and "pyramid-classic" not in fams, "ito-assets WS_FAMILIES lists pyramid and heather, not pyramid-classic")
fre = re.compile(r"^workspaces/bar/(\d+)/ws-(" + "|".join(fams) + r")-(\d{1,2}|preview)-(empty|occupied|active|urgent)(?:\.light)?\.png$")
check("|preview)-(empty|occupied|active|urgent)" in read("bar/modules/bin/ito-assets"), "ito-assets FAMILY_RE accepts the preview files")
for rel, fam in (("workspaces/bar/128/ws-heather-10-urgent.light.png", "heather"), ("workspaces/bar/64/ws-pyramid-3-active.png", "pyramid"),
                 ("workspaces/bar/64/ws-pyramid-preview-active.png", "pyramid")):
    mm = fre.match(rel)
    check(bool(mm) and mm.group(2) == fam, f"the family pattern reads {rel} as `{fam}`")
bw = read("plugins/ito.workspaces/BarWidget.qml")
names = re.search(r"readonly property var famNames: \[([^\]]*)\]", bw)
fams = [f for f in fams if f != "gothic"]          # S24: `gothic` stays in WS_FAMILIES only so the old ws-gothic-* files still index; the family is `symbols`
check(names and all(f'"{f}"' in names.group(1) for f in fams), "BarWidget famNames = ito-assets WS_FAMILIES")
check(all(f'root.wsStyle === "{f}"' in bw for f in NEW), "the flood / shake motion covers the new families")
pw = read("bar/modules/cc/PageWorkspaces.qml")
check(all(f'{{ "key": "{f}", "art": "workspaces/ws-{f}-3-active.png"' in pw for f in NEW), "Workspaces page has a card for each new family")
check("-preview-active.png" in pw, "Workspaces page cards show the numeral-free preview when the recipe wrote it")
for rel in ("plugins/ito.workspaces/BarWidget.qml", "bar/modules/cc/PageWorkspaces.qml", "scripts/qa/test-hd-tiers.py", "scripts/qa/sweep-settings.py", "bar/modules/bin/ito_pyramid.py"):
    txt = read(rel)
    check('"pyramid-classic"' not in txt.replace('s0 === "pyramid-classic" ? "pyramid"', "").replace('s === "pyramid-classic" ? "pyramid"', "") and "ws-pyramid-classic" not in txt,
          f"{rel}: pyramid-classic is not registered")
check('"pyramid-classic": "pyramid"' in read("bar/modules/bin/ito-config") and 's0 === "pyramid-classic" ? "pyramid"' in bw,
      "a stored style pyramid-classic reads as pyramid (ito-config migrate, BarWidget)")
hd = re.search(r"^USER_WS = \[([^\]]*)\]", read("scripts/qa/test-hd-tiers.py"), re.M)
check(hd and all(f'"{f}"' in hd.group(1) for f in fams), "test-hd-tiers USER_WS covers every user family")
check(all(f'"{f}"' in read("scripts/qa/sweep-settings.py") for f in NEW), "sweep-settings sweeps the new styles")

# ---- the user's pictures (optional: the repo never holds them) ---------------------------------------------------------------------------
IDEAS = os.path.expanduser("~/Downloads/Ideas/")
if os.path.isfile(IDEAS + "Heather pyramid.png") and os.path.isfile(IDEAS + "pyramid-head-hd-side.png"):
    import ito_pyramid as P
    try:
        R.set_source(Image.new("RGB", (100, 100)))
        check(False, "a wrong-size Heather sheet is refused")
    except ValueError as e:
        check("1536x1024" in str(e), f"a wrong-size Heather sheet is refused: {e}")
    R.set_source(Image.open(IDEAS + "Heather pyramid.png"))
    P.set_source(Image.open(IDEAS + "pyramid-head-hd-side.png"))
    for px in (24, 128):
        for fn, nm in ((R.ws_heather, "heather"), (P.ws_pyramid_ring, "pyramid")):
            for st in R.STATES:
                b, f, red, am = stats(fn(5, st, px, False))
                bl = 1.0 if nm == "pyramid" else 0.05      # S22: the pyramid keeps the sprite's true deep shadows (the shader maps them to the theme's darkest colour)
                check(b <= bl and f <= 0.85 and am > 0.02, f"{nm} {px} px {st}: art present, black {b:.2f}, fill {f:.2f}")
    # S22/S23 (2026-10-22): the mark is the sprite's own lighting in theme tokens: its true deep shadows stay black in the file (the shader makes
    # them the theme's darkest colour), its light is the bone grey, its blood a small share; a clean tip, a faint 1-px edge, and the light twin
    # is the same cut with the luminance inverted.
    for px in (24, 32, 48, 96, 128, 512):
        tw = {}
        for light in (False, True):
            a = np.asarray(P.mark(px, light))
            on = a[..., 3] > 0
            body = a[..., 3] > 200
            lu = 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
            deep = float((lu[body] < 0.15 * 255).mean()) if body.any() else 0.0
            if not light:
                check(deep >= 0.20, f"mark {px} px: the deep shadows stay black ({deep:.2f} of the figure), never lifted to grey")
            rs = a[..., 0].astype(int) - np.maximum(a[..., 1], a[..., 2])
            share = float((body & (rs > 30)).sum()) / max(1, int(body.sum()))
            check(share <= 0.25, f"mark {px} px{' light' if light else ''}: blood is a small share of the figure ({share:.3f})")
            solid = a[..., 3] > 127                    # the 512 master keeps an antialiased edge: its tip is read where it is solid
            ys = np.nonzero(solid.any(1))[0]
            check((solid[ys[0]].sum() <= 3) and (solid[ys[0] + 1].sum() >= 1), f"mark {px} px{' light' if light else ''}: the tip ends on a point, no needle")
            tw[light] = (a[..., 3], lu, body)
        (a0, l0, b0), (a1, l1, b1) = tw[False], tw[True]
        check(np.array_equal(a0, a1), f"mark {px} px: the light twin has the same cut")
        both = b0 & b1
        check(float(np.corrcoef(l0[both], l1[both])[0, 1]) < -0.5, f"mark {px} px: the light twin inverts the luminance")
    for px in (32, 48, 128):
        for light in (False, True):
            a = np.asarray(P.ws_pyramid_ring(5, "urgent", px, light), np.float32) / 255
            F = P._ring_layers(px)[0]
            fig = (F["A"] > 0.5) & (np.asarray(P.ws_pyramid_ring(5, "empty", px, light))[..., 3] > 0)
            rs = (a[..., 0] - np.maximum(a[..., 1], a[..., 2]))[fig]
            share = float((rs > 0.12).mean()) if fig.any() else 1.0
            check(share <= 0.55, f"pyramid {px} px urgent{' light' if light else ''}: the head keeps its iron, blood on {share:.2f} of the figure (<= 0.55)")
    rels = [rel for rel, _ in P.products(tiers=(24,))]
    check(not any("pyramid-classic" in r for r in rels) and "workspaces/bar/24/ws-pyramid-10-urgent.light.png" in rels
          and "workspaces/bar/24/ws-pyramid-preview-active.light.png" in rels, "the pyramid-head recipe writes the ringed family and its preview, no pyramid-classic")
    check(len(R.products_heather(tiers=(24,))) == 82, "the heather recipe writes 10 workspaces x 4 states x dark + light per tier, and its preview")
else:
    print("SKIP the user's pictures are not in ~/Downloads/Ideas")

print(f"\n{'FAIL' if fails else 'OK'}: {len(fails)} failing")
sys.exit(1 if fails else 0)
