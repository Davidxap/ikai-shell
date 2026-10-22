#!/usr/bin/env python3
"""Make the IKAI shell known to `shell-switch` on a machine that has never run it.

`shell-switch ito` swaps in ~/.config/omarchy/shell.ito.json. Nothing creates that file on a fresh install, so
without it the switcher reports IKAI as not installed. This builds it from what is already there:

  your own shell.json  (kept as it is: your idle settings, your plugins, your disabled list)
  + the IKAI bar and its state entry, from seed/shell.ito.json (the default arrangement)

Nothing of anyone's is overwritten: if shell.ito.json exists it is left alone (use --force to rebuild it). The shell
the user is on now (Omarchy's default, Shibumi, another) is kept beside it as its own variant, so the Setup page can
switch back to it.

    seed-variant.py                     create shell.ito.json (and its itobar twin) if missing
    seed-variant.py --name NAME         write shell.NAME.json instead
    seed-variant.py --base FILE         start from this shell config instead of the live shell.json
    seed-variant.py --force             rebuild it even if it exists
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path

OMARCHY = Path.home() / ".config" / "omarchy"
SEED = Path(__file__).resolve().parent.parent / "seed" / "shell.ito.json"
STATE_ID = "ito.state"


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "other"


def keep_what_was_there(live_path: Path) -> None:
    """Before IKAI takes over, keep the shell the user is on now as a variant of its own, so switching back to it
    is one click on the Setup page (shell-switch only offers a shell whose shell.<name>.json exists). And make sure
    Omarchy's default is always there to go back to."""
    try:
        live = json.loads(live_path.read_text())
    except (OSError, ValueError):
        live = {}
    bar = str((live.get("bar") or {}).get("id") or "")
    if bar and bar != "ito.bar":
        if bar.startswith("hancore.shibumi"):
            name = "shibumi"
        elif bar.startswith("omarchy"):
            name = "omarchy"
        else:
            name = "custom-" + slug(bar)
        dst = OMARCHY / f"shell.{name}.json"
        if not dst.exists():
            shutil.copy(live_path, dst)
            print(f"seed-variant: kept your current shell as {dst.name}")
    elif not bar and live:
        dst = OMARCHY / "shell.omarchy.json"
        if not dst.exists():
            shutil.copy(live_path, dst)
            print(f"seed-variant: kept your current shell as {dst.name}")
    dst = OMARCHY / "shell.omarchy.json"
    if not dst.exists():
        for own in (Path("/usr/share/omarchy/config/omarchy/shell.json"), OMARCHY / "shell.stock.json"):
            if own.exists():
                shutil.copy(own, dst)
                print(f"seed-variant: {dst.name} made from Omarchy's own default ({own})")
                break


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="ito")
    ap.add_argument("--base")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    out = OMARCHY / f"shell.{a.name}.json"
    if out.exists() and not a.force:
        print(f"seed-variant: {out.name} already exists, left alone")
        return 0
    seed = json.loads(SEED.read_text())
    base_path = Path(a.base) if a.base else OMARCHY / "shell.json"
    if not a.base:
        keep_what_was_there(base_path)
    try:
        base = json.loads(base_path.read_text())
    except (OSError, ValueError):
        base = {"version": seed.get("version", 1)}
    cfg = dict(base)
    cfg["bar"] = seed["bar"]
    plugins = [p for p in base.get("plugins", []) if not (isinstance(p, dict) and p.get("id") == STATE_ID)]
    cfg["plugins"] = plugins + seed["plugins"]
    tmp = out.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(cfg, indent=1))
    os.replace(tmp, out)
    os.chmod(out, 0o600)
    print(f"seed-variant: wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
