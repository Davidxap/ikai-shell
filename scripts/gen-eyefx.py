#!/usr/bin/env python3
"""The eyes the 'Eyes' media effect draws, and the ones the matching seal decoration stacks.

  eyes    a watching eye drawn from scratch by eyeart.watcher(), and a bloodshot twin. Original artwork: no reference
          image is used, so the pictures can be committed and a fresh clone has them.

    gen-eyefx.py   writes bar/modules/ito-art/eyefx/{eyes,eyes-red}.png
"""

from pathlib import Path
import sys

from PIL import Image

ART = Path(__file__).resolve().parent.parent / "bar" / "modules" / "ito-art"
OUT = ART / "eyefx"
BONE = (199, 204, 209)
BLOOD = (196, 22, 42)


def panel_eye(red: bool = False, width: int = 640) -> Image.Image:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import eyeart
    return eyeart.watcher(width, red=red)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    panel_eye().save(OUT / "eyes.png")
    panel_eye(red=True).save(OUT / "eyes-red.png")
    print("wrote", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
