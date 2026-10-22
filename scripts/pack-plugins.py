#!/usr/bin/env python3
"""One-shot migration: repackage the old `type: qml` bar modules as ito.bar plugins.

The stock bar loads `type: qml` entries straight from bar/modules/. The ito.bar
fork has no support for that (0 references to customModule/CustomCommandModule),
and resolves widgets only by the id of a registered plugin. So each module becomes
a plugin: plugins/ito.<name>/{manifest.json, BarWidget.qml}.

The code is not rewritten. Only what depends on where the file lives changes:

  moduleName: "ito-x"                       ->  "ito.x"
  import "." as Ito                         ->  import "../../bar/modules" as Ito
  Qt.resolvedUrl("ito-style.json")          ->  Qt.resolvedUrl("../../bar/modules/ito-style.json")
  Qt.resolvedUrl("ito-assets/...")          ->  Qt.resolvedUrl("../../bar/modules/ito-assets/...")
  Qt.resolvedUrl("bin/ito-config")          ->  Qt.resolvedUrl("../../bar/modules/bin/ito-config")
  Qt.resolvedUrl(modelData.art)             ->  Qt.resolvedUrl("../../bar/modules/" + modelData.art)

The sidecar reader (ItoConfig.qml), the art and ito-config stay where they are and
are imported from there, so there is one copy of each rather than one per plugin.
That also means the old modules stay the source until the stock-bar variant is
retired; after that the plugins are.

It never overwrites an existing plugin unless --force, because ito.workspaces was
adapted by hand and ito.tray was written from scratch.

    pack-plugins.py            write the missing plugins
    pack-plugins.py --force    regenerate all of them
"""

import argparse
import json
import re
import sys
from pathlib import Path

OMARCHY = Path.home() / ".config" / "omarchy"
MODULES = OMARCHY / "bar" / "modules"
PLUGINS = OMARCHY / "plugins"
SHARED = "../../bar/modules"

# name -> (display name, description, category)
CATALOG = {
    "splatter":   ("Ito Splatter", "Blood splatter bookend for the left edge.", "Decor"),
    "splatter-r": ("Ito Splatter (right)", "Mirrored blood splatter for the right edge.", "Decor"),
    "spiral":     ("Ito Spiral", "Application menu launcher; the spiral turns and bleeds on hover.", "Launcher"),
    "tomie":      ("Ito Tomie", "The Tomie seal; opens the workspace style selector.", "Style"),
    "cpu":        ("Ito CPU", "CPU load; the chip heats with use.", "System"),
    "mem":        ("Ito Memory", "Memory in use; the glyph heats with use.", "System"),
    "disk":       ("Ito Disk", "Disk usage; the glyph heats with use.", "System"),
    "eye":        ("Ito Eye", "Tomie watches over this machine; the eye reddens on hover.", "Decor"),
}


def transform(source: str, name: str) -> str:
    text = source
    rules = [
        (f'moduleName: "ito-{name}"', f'moduleName: "ito.{name}"'),
        ('import "." as Ito', f'import "{SHARED}" as Ito'),
        ('Qt.resolvedUrl("ito-style.json")', f'Qt.resolvedUrl("{SHARED}/ito-style.json")'),
        ('Qt.resolvedUrl("bin/ito-config")', f'Qt.resolvedUrl("{SHARED}/bin/ito-config")'),
        ('Qt.resolvedUrl(modelData.art)', f'Qt.resolvedUrl("{SHARED}/" + modelData.art)'),
    ]
    for old, new in rules:
        text = text.replace(old, new)
    text = text.replace('Qt.resolvedUrl("ito-assets/', f'Qt.resolvedUrl("{SHARED}/ito-assets/')

    # Anything still resolving relative to the old folder would silently 404.
    leftovers = re.findall(r'Qt\.resolvedUrl\("(?!\.\./)[^"]*"\)', text)
    if leftovers:
        raise SystemExit(f"ito-{name}: unrewritten relative paths: {leftovers}")

    note = (f"// Plugin form of bar/modules/ito-{name}.qml. The ito.bar host loads registered\n"
            "// plugins by id and has no support for `type: qml` entries.\n")
    lines = text.splitlines(keepends=True)
    at = next(i for i, ln in enumerate(lines) if ln.startswith("Ui.BarWidget"))
    # keep the module's own header comment, put the note right above the root item
    lines.insert(at, note)
    return "".join(lines)


def manifest(name: str) -> dict:
    display, description, category = CATALOG[name]
    return {
        "schemaVersion": 1,
        "id": f"ito.{name}",
        "name": display,
        "version": "0.1.0",
        "author": "IKAI",
        "description": description,
        "kinds": ["bar-widget"],
        "entryPoints": {"barWidget": "BarWidget.qml"},
        "barWidget": {
            "displayName": display,
            "description": description,
            "category": category,
            "allowMultiple": False,
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    for name in CATALOG:
        source = MODULES / f"ito-{name}.qml"
        target = PLUGINS / f"ito.{name}"
        if not source.is_file():
            print(f"skip  ito.{name:<11} (no {source.name})")
            continue
        if target.exists() and not args.force:
            print(f"keep  ito.{name:<11} (exists; --force to regenerate)")
            continue
        target.mkdir(parents=True, exist_ok=True)
        (target / "BarWidget.qml").write_text(transform(source.read_text(), name))
        (target / "manifest.json").write_text(json.dumps(manifest(name), indent=2) + "\n")
        print(f"write ito.{name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
