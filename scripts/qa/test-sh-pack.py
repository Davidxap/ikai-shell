#!/usr/bin/env python3
"""S17 gate: the Silent Hill pack + the character / eye / beetle / symbol corrections (bar/modules/bin/ito_sh.py).
  * no hex colour in ito_sh.py or scripts/gen-sh-pack.py (tokens / grey tones only)
  * the n -> symbol map of the `shsymbols` family (10 symbols, Heather and Pyramid Head are the only user-art ones) and its alternates
  * the procedural pack has no black ground (blocking), every piece is RGBA and exactly square at the pack tiers
  * with the lab (~/.cache/ito/lab/v12) and the user's pictures present: the layers equal the lab's for every tier (np.array_equal)
  python3 scripts/qa/test-sh-pack.py
"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "bar", "modules", "bin"))
import numpy as np
import ito_sh as M

fails = []
def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok: fails.append(msg)

for f in ("bar/modules/bin/ito_sh.py", "scripts/gen-sh-pack.py"):
    src = open(os.path.join(HERE, "..", "..", f)).read()
    check(not re.search(r"#[0-9a-fA-F]{6}\b|0x[0-9a-fA-F]{6}\b", src), f"no hex colour in {f}")
check(M.SYMBOLS10 == ["pyramid", "heather", "radio", "flashlight", "sign", "halo", "redsquare", "siren", "lily", "crtv"], "n -> symbol map (10 real symbols)")
check(set(M.ART) == {"pyramid", "heather"} and set(M.SH_ALTS) == {"flauros", "nurse", "torii", "fox", "lamp"}, "user art only for the two characters; five alternates")
for n in range(1, 11):
    L = M.symbol_ws(n, "active", 48, False, False)
    check(L["ink"].shape == (48, 48) and float(L["ink"].max() + L["blood"].max()) > 0, f"symbol {n} ({M.SYMBOLS10[n - 1]}) draws (drawn glyph) at 48 px")
for rel, im in M.pack_procedural():
    a = np.asarray(im, np.float32) / 255
    blk = float(((a[..., 3] > 0.85) & (a[..., :3].mean(-1) < 0.15)).sum()) / max(1, int((a[..., 3] > 0.15).sum()))
    if im.mode != "RGBA" or blk > 0.05: check(False, f"{rel} RGBA/no black ground ({blk:.2f})")
    m = re.match(r"sh/bar/(\d+)/", rel)
    if m and im.size != (int(m.group(1)),) * 2: check(False, f"{rel} is exactly square")
check(not [f for f in fails if "RGBA" in f or "square" in f], "procedural pack: RGBA, square at every tier, no black ground")

LAB, IDEAS = os.path.expanduser("~/.cache/ito/lab/v12"), os.path.expanduser("~/Downloads/Ideas/")
if os.path.isdir(LAB) and os.path.isfile(IDEAS + "Heather pyramid.png"):
    from PIL import Image
    sys.path.insert(0, LAB)
    M.set_sources(sheet=Image.open(IDEAS + "silenthillworspaces"), hp=Image.open(IDEAS + "Heather pyramid.png"), eye=Image.open(IDEAS + "bleeding-eye.png"),
                  beetle=Image.open(IDEAS + "02340703e9516e086202b56d4e626d32.jpg"))
    import chars as C
    eq = lambda a, b: set(a) == set(b) and all(np.array_equal(a[k], b[k]) for k in a)
    bad = []
    for px in M.TIERS:
        for nm in ("heather", "pyramid"):
            for lt in (False, True):
                if not eq(M.character(nm, px, lt), C.character(nm, px, lt)): bad.append(f"{nm}@{px}{'L' if lt else ''}")
        for st in M.STATES:
            if not eq(M.uz_eye(3, st, px), C.uz_eye(3, st, px)): bad.append(f"eye@{px}")
            for lt in (False, True):
                if not eq(M.beetle_ws(3, st, px, lt), C.beetle_ws(3, st, px, lt)): bad.append(f"beetle@{px}")
            for n in (1, 2, 6, 10):
                if not eq(M.symbol_ws(n, st, px, True, False), C.symbol_ws(n, st, px, True, False)): bad.append(f"sym{n}@{px}")
    check(not bad, "products == lab (array_equal) for every tier" + (f": {bad[:6]}" if bad else ""))
else:
    print("SKIP lab / user pictures not present: lab equality not checked")
print("FAIL" if fails else "OK")
sys.exit(1 if fails else 0)
