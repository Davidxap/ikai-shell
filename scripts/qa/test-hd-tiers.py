#!/usr/bin/env python3
"""HD tier gate (master-plan-v4 S2d-3). Blocking: a deploy must not ship a family that lacks a tier or fails fill / black.

For every SHIPPED mark (system/bar/<px>/<art>) and workspace family (workspaces/bar/<px>/ws-<fam>-<n>-<state>.png):
  * every tier of TIERS exists, is RGBA and is exactly <px> x <px> (the size controls 24 26 28 30 32 36 40 44 + 48, and the picker tiers 56 60 112 120 ...);
  * line art: crisp >= 0.45, fill <= 0.55, black <= 0.05;  tonal art (photo routes, Tomie eyes): fill <= 0.80, black <= 0.05, crisp is REPORT-ONLY;
  * worst case over n in {1, 3, 5, 6, 10} x the 4 states.
The user's own families (marks/ and workspaces/ of ~/.config/ito/assets, never in the repo) are checked when that folder exists: every tier present
(blocking), fill / black (blocking, tonal class), crisp report-only. A family that is not shipped in this install is skipped.
Caveat: crisp can be raised by snapping alone; snapped sheet art turned into dashes in the lab trials, so the micro tiers of the sheet-cut families are
geometry or soft and the G-U look decides, not the number.  Prints one row per family; exit 1 on any FAIL.

  python3 scripts/qa/test-hd-tiers.py [--no-user]
"""
import json, os, re, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "..", "..", "bar", "modules", "ito-art") + os.sep
USER = os.path.expanduser("~/.config/ito/assets") + os.sep
TIERS = (24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 60, 64, 72, 80, 88, 96, 112, 120, 128)
STATES = ("empty", "occupied", "active", "urgent")
NS = (1, 3, 5, 6, 10)
LINE = dict(crisp=0.45, fill=0.55, black=0.05)
TONAL = dict(crisp=0.0, fill=0.80, black=0.05)
TILE = dict(crisp=0.0, fill=1.30, black=0.70)           # the Tomie (Classic) mark: an opaque bone paper tile with the drawn ink as real ink (S19b), by design
TONAL_USER = dict(crisp=0.0, fill=0.85, black=0.05)
# Documented exception (S22/S23, 2026-10-22): the Pyramid Head menu mark and the `pyramid` workspace family keep the sprite's true deep
# shadows ("el negro del personaje se ve gris"): the file holds them as black and the theme shader maps them to the theme's darkest colour
# (they still follow the theme). Only these two keys may carry opaque black; every other family keeps the no-opaque-black gate.
DEEP = dict(crisp=0.0, fill=1.30, black=1.0)
DEEP_KEYS = ("mark:pyramid-head", "ws:pyramid")    # the user's photo routes: Tomie's active / urgent workspace is a whole medallion (urgent = a solid blood disc), by design

# (key, label, class, files(px) -> [path])
MARK_ARTS = [("uzumaki", "Uzumaki v3", "line", "menu-uzumaki.png"), ("uzumaki-v1", "Uzumaki v1", "line", "menu-uzumaki-v1.png"),
             ("uzumaki-v2", "Uzumaki v2", "line", "menu-uzumaki-v2.png"), ("remina-ink", "Remina Ink", "line", "menu-remina.png"),
             ("amigara", "Amigara", "line", "menu-amigara.png"), ("metatron", "Metatron", "line", "menu-metatron-full.png"),
             ("metatron-mini", "Metatron plain", "line", "menu-metatron.png"), ("halo", "Halo", "line", "menu-halo.png"),
             ("flauros", "Flauros", "line", "menu-flauros.png"), ("spiral", "Sheet spiral", "line", "system-normal.png"),
             ("spiral-clean", "Sheet spiral clean", "line", "system-normal-clean.png")]
WS_FAMS = [("numerals", "Seals", "line"), ("orbs", "Rings", "line"), ("eyes", "Tomie eyes", "tonal"), ("dots", "Marks", "line"), ("remina", "Remina", "line"),
           ("halo", "Halo", "line"), ("flauros", "Flauros", "line"), ("uzumaki-classic", "Uzumaki v1", "line"), ("uzumaki-vortex", "Uzumaki v2", "line"),
           ("uzumaki-original", "Uzumaki v3", "line"), ("uzumaki-numbered", "Uzumaki numbered", "line")]
# Uzumaki v1 (classic) has too many arms for a thin stroke at some sizes: its crisp is information there (as in test-barsize-legibility.py)
CRISP_INFO = {"uzumaki-classic": (24, 26, 28, 30, 32, 36, 48)}
USER_MARKS = ["remina", "tomie-classic", "beetle", "uzumaki-eye", "heather", "heather-sigil", "pyramid-roundel", "pyramid-head", "moth", "eye-roundel", "key"]
USER_WS = ["tomie", "beetle", "uzumaki-eye", "symbols", "pyramid", "heather", "cult"]     # symbols: S24 file name (ws-symbols-*; was ws-gothic-*)
GOTHIC_TIERS = (24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 64)      # S18 bar icons: the bar tiers + the Widgets card tier
GOTHIC_WS_TIERS = GOTHIC_TIERS + (72, 80)                        # the workspace family also ships the card tiers the Workspaces page snaps to
# S17: the legacy designs keep their ORIGINAL art on the bar (the S2d redraws changed their look): their tiers are report-only unless the opt-in is on
LEGACY_MARKS = {"remina-ink", "amigara", "halo", "flauros", "spiral", "spiral-clean"}
LEGACY_WS = {"numerals", "orbs", "eyes", "dots", "remina", "halo", "flauros"}


def optin(key):
    p = os.path.expanduser(os.environ.get("ITO_STYLE_PATH") or "~/.config/omarchy/bar/modules/ito-style.json")
    try:
        return json.load(open(p)).get(key) is True
    except (OSError, ValueError):
        return False

# families whose art another designer is changing right now: coverage is blocking, the metrics are report-only (the new art decides them)
IN_DESIGN = {"beetle", "uzumaki-eye", "heather"}


def metrics(im, px):
    a = np.asarray(im.convert("RGBA"), dtype=float) / 255
    al = a[..., 3]; m = max(al.max(), 1e-3)
    on = (al >= .15 * m).sum()
    crisp = (al >= .6 * m).sum() / max(on, 1)
    fill = (al >= .5).sum() / (px * px * np.pi / 4)
    luma = 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
    black = ((al > .85) & (luma < .15)).sum() / max(on, 1)
    return crisp, fill, black


def check(paths_by_px, cls, key, info_crisp=(), report_only=False, user=False, tiers=None):
    """paths_by_px: {px: [path]}. Returns (row text, failed)."""
    missing, bad, worst = [], set(), {}
    lim = LINE if cls == "line" else TILE if key == "mark:tomie-classic" else DEEP if key in DEEP_KEYS else TONAL_USER if user else TONAL
    tiers = tiers or TIERS
    for px in tiers:
        paths = paths_by_px.get(px, [])
        if not paths:
            missing.append(px); continue
        w = dict(crisp=9.0, fill=0.0, black=0.0)
        for p in paths:
            if not os.path.isfile(p):
                missing.append(px); break
            im = Image.open(p)
            if im.size != (px, px) or im.mode != "RGBA":
                bad.add(f"size@{px}"); continue
            c, f, b = metrics(im, px)
            w["crisp"] = min(w["crisp"], c); w["fill"] = max(w["fill"], f); w["black"] = max(w["black"], b)
        worst[px] = w
        if w["fill"] > lim["fill"]: bad.add(f"fill@{px}")
        if w["black"] > lim["black"]: bad.add(f"black@{px}")
        if cls == "line" and w["crisp"] < lim["crisp"] and px not in info_crisp: bad.add(f"crisp@{px}")
    fail = bool(missing or bad)
    if missing: bad.add("missing:" + ",".join(str(m) for m in sorted(set(missing))))
    pick = [24, 26, 32, 48, 60]
    cells = " ".join(f"{px}:{worst[px]['crisp']:.2f}/{worst[px]['fill']:.2f}/{worst[px]['black']:.2f}" for px in pick if px in worst)
    status = "PASS" if not fail else ("WARN" if report_only else "FAIL")
    return f"{status} {key:18s} {cls:5s} {len(tiers) - len(set(missing))}/{len(tiers)} tiers  {cells}" + (f"  [{', '.join(sorted(bad))}]" if bad else ""), fail and not report_only


def main():
    no_user = "--no-user" in sys.argv
    failed = False
    print("== shipped marks  (crisp/fill/black at 24 26 32 48 60; line: crisp>=0.45 fill<=0.55 black<=0.05)")
    for key, label, cls, art in MARK_ARTS:
        row, f = check({px: [f"{ART}system/bar/{px}/{art}"] for px in TIERS}, cls, key, report_only=key in LEGACY_MARKS and not optin("markHdTiers"))
        print(row); failed |= f
    print("== shipped workspace families  (worst over n 1 3 5 6 10 x 4 states)")
    for fam, label, cls in WS_FAMS:
        by = {px: [f"{ART}workspaces/bar/{px}/ws-{fam}-{n}-{st}.png" for n in NS for st in STATES] for px in TIERS}
        row, f = check(by, cls, fam, CRISP_INFO.get(fam, ()), report_only=fam in LEGACY_WS and not optin("wsHdTiers"))
        print(row); failed |= f
    if not no_user and os.path.isdir(USER):
        print("== your own families (assets folder; coverage blocking, tonal fill/black blocking, crisp report-only; in-design families: metrics warn only)")
        for k in USER_MARKS:
            if not os.path.isfile(f"{USER}marks/{k}.png"):
                continue
            row, f = check({px: [f"{USER}marks/bar/{px}/{k}.png"] for px in TIERS}, "tonal", "mark:" + k, report_only=False, user=True)
            print(row); failed |= f
        for k in USER_WS:
            if not os.path.isfile(f"{USER}workspaces/bar/24/ws-{k}-1-empty.png"):
                continue
            tk = GOTHIC_WS_TIERS if k == "symbols" else None
            by = {px: [f"{USER}workspaces/bar/{px}/ws-{k}-{n}-{st}.png" for n in NS for st in STATES] for px in (tk or TIERS)}
            row, f = check(by, "tonal", "ws:" + k, user=True, tiers=tk)
            print(row); failed |= f
    # S24: the recipes write relic/sys/ and hollow/ now; an install that has not re-run them still has gothic/sys/ and sh/ (checked the same way)
    relic = "relic/sys" if os.path.isdir(USER + "relic/sys") else "gothic/sys"
    hollow = "hollow" if os.path.isdir(USER + "hollow") else "sh"
    if not no_user and os.path.isdir(USER + relic):
        # S18 Relic bar icons: every state at every tier from the icon's floor (gpu 32, ai 30), dark + light; fill / black blocking, crisp report-only
        floor = {"gpu": 32, "ai": 30}
        names = sorted({re.sub(r"(\.light)?\.png$", "", f) for f in os.listdir(USER + relic + "/bar/48")})
        for nm in names:
            ic = nm.split("-")[0]
            tk = tuple(t for t in GOTHIC_TIERS if t >= floor.get(ic, 0))
            by = {px: [f"{USER}{relic}/bar/{px}/{nm}{suf}.png" for suf in ("", ".light")] for px in tk}
            row, f = check(by, "tonal", "relic:" + nm, user=True, tiers=tk)
            if f or nm in ("network-3", "cpu", "gpu", "battery-4", "audio-2", "bluetooth-on", "night-on", "display-2", "tray", "ai"):
                print(row)
            failed |= f
        print("PASS relic icons     " + str(len(names)) + " states x tiers from their floor (rows shown for the full states and any failure)")
    if not no_user and os.path.isdir(USER + hollow):
        print("== your Hollow pack (" + hollow + "/bar/<px>/<name>.png; black ground blocking)")
        names = sorted({re.sub(r"\.png$", "", f) for d in os.listdir(USER + hollow + "/bar") if d.isdigit() for f in os.listdir(f"{USER}{hollow}/bar/{d}")}) if os.path.isdir(USER + hollow + "/bar") else []
        bad = []
        for nm in names:
            for d in sorted(os.listdir(USER + hollow + "/bar"), key=lambda x: int(x) if x.isdigit() else 0):
                f = f"{USER}{hollow}/bar/{d}/{nm}.png"
                if os.path.isfile(f):
                    im = Image.open(f)
                    if im.size != (int(d), int(d)) or im.mode != "RGBA": bad.append(f"size:{nm}@{d}")
                    elif metrics(im, int(d))[2] > 0.05: bad.append(f"black:{nm}@{d}")
        print(("FAIL" if bad else "PASS") + f" sh pack          {len(names)} assets" + (f"  [{', '.join(bad[:8])}]" if bad else "")); failed |= bool(bad)
    print("FAIL: at least one family lacks a tier or fails fill / black" if failed else "OK: every family has every tier")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
