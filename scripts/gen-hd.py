#!/usr/bin/env python3
"""Bring the sheet's small icons up to a resolution that holds on a scaled screen.

The sheet draws its icons at 40-96px, and the bar shows them at 29px, so on a 1x screen they are fine; on a
2x screen they are stretched and go soft. Each small picture is enlarged threefold with a Lanczos resample
done on premultiplied colour (no dark fringe), its edges are firmed up a little so a curve does not turn to
fog, and a light unsharp restores the ink. Only pictures at or under 128px are touched, so running it twice
does nothing the second time.

    gen-hd.py           process the sheet's icon folders in bar/modules/ito-art
    gen-hd.py --check   list what would be processed
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ART = Path(__file__).resolve().parent.parent / "bar" / "modules" / "ito-art"
FOLDERS = ["workspaces", "workspace-labels", "workspace-indicators", "status-eyes", "tomie", "system",
           "battery", "bluetooth", "brightness", "calendar", "apps", "places", "devices", "quickshell"]
LIMIT = 128
SCALE = 3


def enlarge(img: Image.Image) -> Image.Image:
    big = img.convert("RGBa").resize((img.width * SCALE, img.height * SCALE), Image.LANCZOS).convert("RGBA")
    px = np.asarray(big).astype(np.float32) / 255.0
    a = px[..., 3]
    firm = a * a * (3 - 2 * a)                       # smoothstep: steeper across an edge, same at 0 and 1
    px[..., 3] = np.clip(0.55 * firm + 0.45 * a, 0, 1)
    out = Image.fromarray((px * 255).astype(np.uint8), "RGBA")
    return out.filter(ImageFilter.UnsharpMask(1.4, 55, 2))


def main() -> int:
    check = "--check" in sys.argv
    n = 0
    for folder in FOLDERS:
        for f in sorted((ART / folder).glob("*.png")):
            img = Image.open(f)
            if max(img.size) > LIMIT:
                continue
            n += 1
            if not check:
                enlarge(img).save(f)
    print(f"{'would process' if check else 'processed'} {n} pictures")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
