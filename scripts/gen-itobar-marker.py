#!/usr/bin/env python3
"""Write the .ito-managed.json markers the ito.bar fork refuses to run without.

The original Shibumi suite ships a `.shibumi-managed.json` in each plugin, written
by its installer. The fork was made by a pure rename and never got an installer,
so the markers do not exist - and the runtime treats that as fatal:

  Runtime.captureMarker() requires suiteId "ito.verse" and a 64-hex
  suitePayloadDigest. If either is missing or the digests disagree it calls
  retire(), which is permanent for the process, so Runtime.ready stays false and
  the bar never becomes ready.

Each plugin reads the marker in its OWN directory, and all of them must carry the
same suitePayloadDigest. The digests are computed over the actual files, the way
an installer would, so editing a plugin invalidates its marker: run this again
after changing anything under ito.bar/ or ito.state/.

    gen-itobar-marker.py            write the markers
    gen-itobar-marker.py --check    exit 1 if they are missing or stale
"""

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

PLUGINS = Path.home() / ".config" / "omarchy" / "plugins"
SUITE_ID = "ito.verse"
MARKER = ".ito-managed.json"
MEMBERS = ["ito.bar", "ito.state"]  # order is part of the suite digest


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def payload_digest(plugin_dir: Path) -> str:
    """sha256 over sorted 'relpath<TAB>filehash' lines, marker excluded."""
    lines = []
    for path in sorted(p for p in plugin_dir.rglob("*") if p.is_file()):
        rel = path.relative_to(plugin_dir).as_posix()
        if rel == MARKER:
            continue
        lines.append(f"{rel}\t{sha256_file(path)}\n")
    return hashlib.sha256("".join(lines).encode()).hexdigest()


def manifest_version(plugin_dir: Path) -> str:
    return json.loads((plugin_dir / "manifest.json").read_text())["version"]


def source_revision() -> str:
    repo = Path(__file__).resolve().parent.parent
    try:
        return subprocess.check_output(
            ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True,
            stderr=subprocess.DEVNULL).strip()
    except Exception:
        return "local"


def compute() -> dict:
    digests = {name: payload_digest(PLUGINS / name) for name in MEMBERS}
    suite = hashlib.sha256(
        "".join(f"{n}:{digests[n]}\n" for n in MEMBERS).encode()).hexdigest()
    return {"digests": digests, "suite": suite}


def marker_for(name: str, calc: dict) -> dict:
    return {
        "schemaVersion": 1,
        "pluginId": name,
        "suiteId": SUITE_ID,
        "suiteVersion": manifest_version(PLUGINS / name),
        "payloadDigest": calc["digests"][name],
        "suitePayloadDigest": calc["suite"],
        "sourceRevision": source_revision(),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    for name in MEMBERS:
        if not (PLUGINS / name / "manifest.json").is_file():
            print(f"error: {PLUGINS / name} is not a plugin", file=sys.stderr)
            return 1

    calc = compute()
    stale = []
    for name in MEMBERS:
        path = PLUGINS / name / MARKER
        try:
            current = json.loads(path.read_text())
        except Exception:
            stale.append(f"{name}: no marker")
            continue
        if current.get("suitePayloadDigest") != calc["suite"] \
                or current.get("payloadDigest") != calc["digests"][name] \
                or current.get("suiteId") != SUITE_ID:
            stale.append(f"{name}: marker is stale")

    if args.check:
        if stale:
            print("STALE - run gen-itobar-marker.py:", "; ".join(stale))
            return 1
        print(f"OK suite {calc['suite'][:12]}…")
        return 0

    for name in MEMBERS:
        path = PLUGINS / name / MARKER
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(marker_for(name, calc), indent=2, sort_keys=True) + "\n")
        tmp.chmod(0o600)
        tmp.replace(path)
        print(f"wrote {path}")
    print(f"suite {calc['suite']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
