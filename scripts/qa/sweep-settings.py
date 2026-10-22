#!/usr/bin/env python3
"""Beta QA: set every option of the look one value at a time on the LIVE shell, and after each option ask Health
whether a new error appeared. Restores ito-style.json at the end, byte for byte.

    python3 scripts/qa/sweep-settings.py

Safety (T15: a killed run left the swept sidecar behind and the rerun took it as its backup, so the user's settings were lost):
  - the backup goes to ~/.cache/ito/sweep/ito-style.backup.json with a marker file `running` beside it;
  - a run refuses to start while the marker exists (a previous run did not restore) and prints how to restore by hand;
  - the restore runs in a `finally`, at exit and on SIGTERM / SIGINT / SIGHUP, and is verified: ito-style.json must be
    byte-identical to the backup, else the run exits 1 and the marker stays (the backup is never overwritten).
ITO_SWEEP_DIR / ITO_SWEEP_STYLE point it elsewhere (scripts/qa/test-sweep-guard.py runs the guard on a scratch copy).
"""
import atexit, json, subprocess, time, shutil, re, os, signal, sys
M = os.path.expanduser("~/.config/omarchy/bar/modules/bin/")
STYLE = os.path.expanduser(os.environ.get("ITO_SWEEP_STYLE") or "~/.config/omarchy/bar/modules/ito-style.json")
DIR = os.path.expanduser(os.environ.get("ITO_SWEEP_DIR") or "~/.cache/ito/sweep")
BACKUP = os.path.join(DIR, "ito-style.backup.json")
MARKER = os.path.join(DIR, "running")


def how_to_restore():
    return f"cp {BACKUP} {STYLE} && rm {MARKER}"


def begin():
    """Back the sidecar up and leave the marker; refuse (exit 2) when a marker is already there."""
    os.makedirs(DIR, exist_ok=True)
    if os.path.exists(MARKER):
        print(f"refusing to start: a previous sweep did not restore ({MARKER} exists).\n"
              f"Restore your settings first:\n  {how_to_restore()}", file=sys.stderr)
        sys.exit(2)
    shutil.copyfile(STYLE, BACKUP)
    with open(MARKER, "w") as fh:
        json.dump({"pid": os.getpid(), "at": time.time(), "style": STYLE}, fh)


_restored = [False]
def restore():
    """Put the backup back and check it byte for byte; True when it matches (the marker is then removed)."""
    if _restored[0]:
        return True
    if not os.path.exists(MARKER) or not os.path.exists(BACKUP):
        return False
    shutil.copyfile(BACKUP, STYLE)
    with open(BACKUP, "rb") as a, open(STYLE, "rb") as b:
        same = a.read() == b.read()
    if same:
        os.remove(MARKER)
        _restored[0] = True
        print("restored", flush=True)
    else:
        print(f"RESTORE FAILED: {STYLE} differs from the backup. By hand:\n  {how_to_restore()}", file=sys.stderr, flush=True)
    return same


def _on_signal(sig, _frame):
    raise SystemExit(128 + sig)


def cfg(*a): subprocess.run([M + "ito-config"] + list(a), capture_output=True)
def errors():
    out = subprocess.run([M + "ito-health"], capture_output=True, text=True).stdout
    try: checks = json.loads(out)
    except ValueError: return {"health-json": 1}
    res = {}
    for c in checks:
        if c["status"] != "ok":
            if c.get("items"):
                for i in c["items"]: res[f"{c['id']}: {i['title']} {i['file']} :: {i['message'][:110]}"] = i["count"]
            else: res[f"{c['id']}: {c['detail'][:140]}"] = 1
    return res
marks = re.findall(r'key: "([\w-]+)"', open(os.path.expanduser("~/.config/omarchy/bar/modules/ItoMarks.js")).read())
SWEEP = [
 ("style", ["numerals","orbs","eyes","remina","uzumaki","uzumaki-vortex","uzumaki-original","dots","halo","flauros","tomie","beetle","uzumaki-eye","gothic","symbols","pyramid","heather","cult"]),
 ("iconStyle", ["current","manga","gothic","ink","relic"]),     # S24: ink / relic are the visible names (aliases of manga / gothic)
 ("shPack", ["true","false"]),
 ("mediaFx", ["blood","spiral","eyes","fog","static"]),
 ("valueStyle", ["percent","amount","number","off"]),
 ("valueLabels", ["false","true"]),
 ("workspaceCount", ["1","10","5"]),
 ("workspaceShow", ["used","count"]),
 ("barSize", ["52","40"]),
 ("barGap", ["airy","normal","tight"]),
 ("barRadius", ["square","soft","round"]),
 ("iconScale", ["0.8","0.5","0.62"]),
 ("vibrance", ["0.4","1.7","1"]),
 ("light", ["0","2","1"]),
 ("fxSpeed", ["0.4","2.5","1"]),
 ("fxStrength", ["0.4","2","1"]),
 ("popupSeconds", ["0","15","3"]),
 ("icon:awake", ["coffee","radio","flashlight"]),
 ("icon:notifications", ["original","sh","hollow"]), ("icon:clock", ["original","sh"]),
 ("icon:nightlight", ["original","sh"]), ("icon:power", ["original","sh"]),
 ("icon:night", ["moon","fog"]),
 ("icon:record", ["eye","tape"]),
 ("aiStyle", ["brain","classic","hemispheres","neurons","eye","spiral"]),
 ("netIcon", ["auto","wifi","cable"]),
 ("accentSource", ["accent","color1","color4","ito"]),
 ("colorMode", ["ito","theme"]),
 ("fxWhen", ["always","hover"]),
 ("fxMark", ["auto","breathe","sway","none"]),
 ("fxSeal", ["auto","breathe","sway","none"]),
 ("fxVeins", ["auto","breathe","sway","none"]),
 ("fxTorn", ["true","false"]), ("fxFog", ["true","false"]), ("fxPlate", ["false","true"]), ("fxBorder", ["true","false"]),
 ("fxGrain", ["true","false"]), ("fxPills", ["true","false"]), ("fxBlood", ["true","false"]), ("fxWood", ["true","false"]),
 ("fxPaper", ["true","false"]), ("fxGlass", ["true","false"]), ("fxTone", ["true","false"]), ("fxCalm", ["true","false"]),
 ("barShadow", ["true","false"]), ("barFloat", ["true","false"]), ("tooltipBlood", ["true","false"]), ("motion", ["off","calm","lively"]), ("panelFrame", ["true","false"]), ("loreLevel", ["off","subtle","full"]),
]
seals = ["tomie","uzumaki","ito","silent","remina","ikai","urasekai","sankaku","akasabi","nakigara","kekkon","kaii","igyo","jagan","juso","nomu","kurayami","akumu","heather"]
SWEEP += [("seal", seals)]
decos = re.findall(r'key: "([\w-]+)", wide', open(os.path.expanduser("~/.config/omarchy/bar/modules/ItoMarks.js")).read())
SWEEP += [("sealDeco", decos)]
SWEEP += [("menuMark", ["uzumaki-v1","uzumaki-v2","uzumaki","uzumaki-eye","remina","remina-ink","tomie-classic","beetle","heather","heather-sigil","pyramid-roundel","pyramid-head","moth","eye-roundel","key","amigara","metatron","metatron-mini","halo","flauros","spiral"])]
SWEEP += [("eyeWsCrop", ["tight","wide"]), ("beetleDef", ["v12","v10","v9"])]
def main():
    begin()
    atexit.register(restore)
    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(sig, _on_signal)
    try:
        base = errors()
        print("baseline:", base, flush=True)
        for key, vals in SWEEP:
            before = errors()
            for v in vals:
                cfg("set", key, v); time.sleep(1.4)
            after = errors()
            new = {k: c for k, c in after.items() if c > before.get(k, 0)}
            print(("FAIL " if new else "ok   ") + key + " " + ",".join(vals), flush=True)
            for k, c in new.items(): print("      ->", k, flush=True)
    finally:
        ok = restore()
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
