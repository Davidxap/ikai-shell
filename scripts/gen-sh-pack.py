#!/usr/bin/env python3
"""The procedural half of the Hollow asset pack (master-plan-v4 S17a): bar/modules/ito-art/hollow/ (S24; was sh/) (rust plate, room plate, wristband, paper seal, chain,
barbed wire, grate, map; CRT, tag, IV bag, closing spiral, chain glyph, torii, fox mask, lily, street lamp at the pack tiers).

Contains no user pixels: the pieces are drawn by bar/modules/bin/ito_sh.py and distressed by a NEUTRAL seeded grain. `ito-assets recipe sh-pack` redraws the same
pieces with the grain of the user's own sheet into ~/.config/ito/assets/hollow/ (which replaces these by name). Colours are grey tones + the recipe red; no hex.

  python3 scripts/gen-sh-pack.py [--check]      --check prints what would be written and fails on a black ground
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "bar", "modules", "bin"))
import numpy as np
import ito_sh

ART = os.path.join(HERE, "..", "bar", "modules", "ito-art") + os.sep


def black(im):
    a = np.asarray(im, np.float32) / 255
    return float(((a[..., 3] > 0.85) & (a[..., :3].mean(-1) < 0.15)).sum()) / max(1, int((a[..., 3] > 0.15).sum()))


def main():
    check = "--check" in sys.argv
    prods = ito_sh.pack_procedural()
    bad = [rel for rel, im in prods if black(im) > 0.05]
    if check:
        print(f"{len(prods)} files would be written under {ART}hollow/; black ground: {bad or 'none'}")
        return 1 if bad else 0
    for rel, im in prods:
        dest = ART + rel; os.makedirs(os.path.dirname(dest), exist_ok=True); im.save(dest, optimize=True)
    print(f"wrote {len(prods)} files under {ART}hollow/ (neutral grain); black ground: {bad or 'none'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
