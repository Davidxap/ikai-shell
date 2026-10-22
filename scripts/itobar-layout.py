#!/usr/bin/env python3
"""Build a shell.json that runs the ito.bar engine, from the user's own config.

    itobar-layout.py <backup-dir> <shell.json> [layout.json]

Starts from the exact layout captured in the backup (so every plugin, idle and lock setting the
user has is kept), points the bar at ito.bar, adds ito.state, and replaces the widget layout
with the one in layout.json: {"style", "anchor", "left": [...], "center": [...], "right": [...]}.
Written atomically: temp file, read back, os.replace. The engine owns shell.json and rewrites it.
"""
import json
import os
import pathlib
import sys

DEFAULT = {"anchor": "ito.clock", "left": ["omarchy.workspaces"], "center": ["ito.clock"],
           "right": ["omarchy.tray", "ito.audio"]}


# The fork's own base groups (Shibumi's G1..G18). They have to stay in the order for it to validate,
# and stay invisible while their modules are disabled; our widgets are added after them.
V1_BASE = {"left": ["G1", "G2", "G3", "G4", "G5", "G6", "G7"], "center": ["G8"],
           "right": ["G9", "G10", "G11", "G14", "G12", "G13", "G15"]}
V2_BASE = {"left": ["G1", "G2", "G3", "", "G5", "G6", "G4", "G7", "", ""], "center": ["G8"],
           "right": ["G9", "G10", "G11", "G14", "G12", "G13", "G16", "G18", "G17", "G15", "", "", ""]}


def seed_movable(ito: dict, wanted: dict) -> None:
    """Hold every widget of the layout as a movable group, in the order the layout gives.

    The fork lets a widget be dragged only if it is a group in the state's order. It would add ours
    by itself at startup, but alphabetically, which scrambles the bar (the tomie seal ends up right of
    the date). So the order is written here, once, exactly as wanted, for both the island form (V1)
    and the screen-edge forms (V2).
    """
    dynamic = {side: ["G:" + i for i in wanted[side]] for side in ("left", "center", "right")}
    order = {side: V1_BASE[side] + dynamic[side] for side in dynamic}
    ito["order"] = order
    ito["v1SlotRoles"] = {side: ["base"] * len(V1_BASE[side]) + ["extra"] * len(dynamic[side]) for side in order}
    ito["splits"] = {"left": [False] * max(0, len(order["left"]) - 1), "boundaries": [False, False],
                     "right": [False] * max(0, len(order["right"]) - 1)}
    v2 = {side: [g for g in V2_BASE[side] if g != ""] + dynamic[side] for side in dynamic}
    # V2 needs at least this many slots per side; pad with empty ones (drop targets)
    for side, floor in (("left", 10), ("center", 1), ("right", 7)):
        while len(v2[side]) < floor:
            v2[side].append("")
    ito["v2Layout"] = v2


def main() -> int:
    backup, target = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    wanted = json.loads(pathlib.Path(sys.argv[3]).read_text()) if len(sys.argv) > 3 and sys.argv[3] else DEFAULT

    cfg = json.loads((backup / "shell.json.LIVE-AT-BACKUP").read_text())
    bar = cfg["bar"]
    bar["id"] = "ito.bar"
    bar["centerAnchor"] = wanted.get("anchor", "ito.clock")
    if wanted.get("style"):
        bar["style"] = wanted["style"]
    # `shibumiModule` is what makes the fork treat an entry as a movable group: without it a widget is
    # only painted where the layout puts it, and the drag editor cannot pick it up.
    bar["layout"] = {side: [{"id": i, "shibumiModule": True} for i in wanted[side]]
                     for side in ("left", "center", "right")}
    plugins = cfg.setdefault("plugins", [])
    # The state service only becomes ready once its entry carries a schema marker and a versioned
    # config block. A bare {"id": "ito.state"} leaves it not-ready forever, and everything that
    # writes through it (bar shape, island cuts, dragging widgets) is silently refused.
    entry = next((p for p in plugins if p.get("id") == "ito.state"), None)
    if entry is None:
        entry = {"id": "ito.state"}
        plugins.append(entry)
    entry.setdefault("itoStateSchemaVersion", 1)
    if not isinstance(entry.get("ito"), dict):
        entry["ito"] = {"version": 1}
    seed_movable(entry["ito"], wanted)

    tmp = target.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(cfg, indent=1))
    assert json.loads(tmp.read_text()) == cfg, "readback mismatch"
    os.replace(tmp, target)
    count = sum(len(v) for v in bar["layout"].values())
    print(f"layout written: bar.id = ito.bar, style = {bar.get('style', 'default')}, {count} widgets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
