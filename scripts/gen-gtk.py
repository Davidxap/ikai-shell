#!/usr/bin/env python3
"""Write themes/ito-verse/gtk.css from colors.toml.

Omarchy themes ship a hand-written gtk.css (there is no template for it), and the stock ones are all
the same skeleton with a different palette block. So this takes the skeleton from a reference theme
and swaps every hard-coded colour for the matching Ito-verse one, which keeps Nautilus, the file
choosers, dialogs and headerbars on the same ink, bone and blood as everything else, and makes it
impossible for the GTK palette to drift from colors.toml.

    gen-gtk.py [skeleton.css]     default skeleton: scripts/gtk-skeleton.css (a stock Omarchy gtk.css)
"""

from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
THEME = ROOT / "themes" / "ito-verse"

# reference palette (Scanner Darkly) -> the Ito-verse colour that plays the same role
ROLE = {
    "#05060F": lambda c: "#030304",            # deepest shade, under popovers
    "#0B0E20": lambda c: c["bg"],              # window
    "#171B38": lambda c: c["lighter_bg"],      # surface
    "#1E2348": lambda c: "#232329",            # raised surface
    "#272B5E": lambda c: c["selection"],
    "#6E70A8": lambda c: c["muted"],           # bright black: borders, insensitive text
    "#6E72C6": lambda c: c["blue"],
    "#7FA3DC": lambda c: c["cyan"],
    "#8A8EDE": lambda c: c["bright_blue"],
    "#8B67C0": lambda c: c["magenta"],
    "#8CAE3E": lambda c: c["green"],
    "#A5C4F0": lambda c: c["bright_cyan"],
    "#A8BE4A": lambda c: c["accent"],          # the one live colour: blood
    "#AC8AE0": lambda c: c["bright_magenta"],
    "#BFD45C": lambda c: c["bright_green"],
    "#C85234": lambda c: c["red"],
    "#DCD4BC": lambda c: c["fg"],
    "#E4703F": lambda c: c["bright_red"],
    "#E6B14A": lambda c: c["yellow"],
    "#F6D26C": lambda c: c["bright_yellow"],
    "#FBFBF4": lambda c: c["bright_fg"],
}

HEADER = """/**
 * Ito-verse — GTK
 *
 * GTK3/GTK4 Adwaita overrides for Nautilus and every other GTK app. Ink for the windows, bone for the
 * type, and blood only where something is selected or alive: focus, selection and the headerbar hairline.
 * Generated from colors.toml by scripts/gen-gtk.py, so the palette can never drift from the theme.
 */"""


def main() -> int:
    ref = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "scripts" / "gtk-skeleton.css"
    colors = tomllib.loads((THEME / "colors.toml").read_text())
    css = ref.read_text()
    for old, role in ROLE.items():
        css = css.replace(old, role(colors)).replace(old.lower(), role(colors))
    # document views sit on the darkest ink, so type reads as bone on black
    css = css.replace(f"@define-color black {colors['bg']};", f"@define-color black {colors['dark_bg']};")
    css = re.sub(r"/\*\*.*?\*/", HEADER, css, count=1, flags=re.S)
    (THEME / "gtk.css").write_text(css)
    (THEME / "icons.theme").write_text("Ito-verse-icons")
    print(f"wrote {THEME / 'gtk.css'} ({len(css.splitlines())} lines) and icons.theme")
    return 0


if __name__ == "__main__":
    sys.exit(main())
