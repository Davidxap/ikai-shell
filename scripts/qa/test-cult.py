#!/usr/bin/env python3
"""Gate for the Cult Symbols workspace family (bar/modules/bin/ito_cult.py, style `cult`; v3 2026-10-20, S10):
  * the ten slots are the symbols of skillunex.com/silent-hill-symbols (the page the user named as the authority), in the module's order;
    the v2 set (Brethren, Fitch, Holloway, Bartlett, Shepherd, 21 Sacraments, the painted Halo) is gone from code, card and recipe
  * no hex colour in ito_cult.py (tokens / grey tones only)
  * every symbol renders every state as an RGBA square at 24, 40 and 128 px; empty carries no red, active is redder than occupied,
    urgent the reddest
  * the picker preview (ws-cult-preview-active) has no numeral: its numeral corner is empty while workspace 3's is not
  * the card in cc/PageWorkspaces.qml and the recipe help in ito-assets name all ten
  python3 scripts/qa/test-cult.py
"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
sys.path.insert(0, os.path.join(ROOT, "bar", "modules", "bin"))
import numpy as np
import ito_cult as C
import ito_sh as S

fails = []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


PAGE = ["Halo of the Sun", "Seal of Metatron", "Flauros", "Mark of Samael", "Valtiel", "Halo Sigil", "Otherworld Gate", "Faith & Torment",
        "Eternal Flame", "Sun's Vitality"]
OLD = ["Brethren", "Fitch", "Holloway", "Bartlett", "Shepherd emblem", "Sacraments", "painted"]

check([C.NAMES[n] for n in range(1, 11)] == PAGE, "the ten slots are the page's symbols in order")
check(sorted(C.SYMBOLS) == list(range(1, 11)), "one drawing per slot")
src = open(os.path.join(ROOT, "bar", "modules", "bin", "ito_cult.py")).read()
check(not re.search(r"#[0-9a-fA-F]{6}\b", src), "no hex colour in ito_cult.py")
check("skillunex.com/silent-hill-symbols" in src, "the module names its reference page")


def red(im):
    a = np.asarray(im, np.float32) / 255
    return float(((a[..., 0] - a[..., 1]).clip(0) * a[..., 3]).sum())


for n in range(1, 11):
    for px in (24, 40, 128):
        ims = {st: C.ws_cult(n, st, px) for st in S.STATES}
        ok = all(im.mode == "RGBA" and im.size == (px, px) for im in ims.values())
        r = {st: red(im) for st, im in ims.items()}
        check(ok, f"{n} {C.NAMES[n]} @{px}: four RGBA squares")
        check(r["empty"] < 1e-3 * px * px, f"{n} @{px}: empty has no red")
        check(r["active"] > r["occupied"] and r["urgent"] > r["occupied"], f"{n} @{px}: active and urgent redder than occupied")
        lt = C.ws_cult(n, "active", px, True)
        check(lt.mode == "RGBA" and lt.size == (px, px), f"{n} @{px}: light twin")

prev = dict(C.S.previews("cult", C.ws_cult, (48,)))
p = np.asarray(prev["workspaces/bar/48/ws-cult-preview-active.png"], np.float32)
w3 = np.asarray(C.ws_cult(3, "active", 48), np.float32)
corner = (slice(0, 14), slice(0, 10))
check(p[corner][..., 3].max() < 40 and w3[corner][..., 3].max() > 150, "preview: numeral corner empty, workspace 3 has its numeral")

card = open(os.path.join(ROOT, "bar", "modules", "cc", "PageWorkspaces.qml")).read()
m = re.search(r'"key": "cult".*?"note": "(.*?)" \}', card, re.S)
note = m.group(1) if m else ""
check(all(name.replace("'", "\\'") in note or name in note for name in PAGE), "the card names all ten")
check(not any(o in note for o in OLD), "the card names none of the v2 set")
rec = open(os.path.join(ROOT, "bar", "modules", "bin", "ito-assets")).read()
line = next((l for l in rec.splitlines() if l.strip().startswith('"ws-cult":')), "")
check(all(name in line for name in PAGE) and not any(o in line for o in OLD), "the recipe help names the ten, not the v2 set")
check(not any(o in src for o in ("def brethren", "def fitch", "def holloway", "def bartlett", "def shepherd", "def sacraments", "def halo_painted")),
      "the v2 drawings are gone from the module")

print(f"\n{'FAIL' if fails else 'OK'}: {len(fails)} failing")
sys.exit(1 if fails else 0)
