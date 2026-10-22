#!/usr/bin/env python3
"""The muted-volume icon: the quiet waveform (vol-0) with a slash of blood across it, on a transparent background.

The other volume levels are engraved waveforms with nothing behind them; the old muted icon was a filled speaker with a
dark body, which read as a box on the bar. This one is made from vol-0, so it always matches the family.

    gen-vol-mute.py     rewrite bar/modules/ito-art/instruments/vol-mute.png
"""
from pathlib import Path
from PIL import Image, ImageDraw

ART = Path(__file__).resolve().parent.parent / "bar" / "modules" / "ito-art" / "instruments"
BLOOD = (196, 22, 42)
SS = 4


def main() -> int:
    base = Image.open(ART / "vol-0.png").convert("RGBA")
    W = base.width * SS
    big = base.resize((W, W), Image.LANCZOS)
    # the bars fade a little, so the slash is the loudest thing on the icon
    r, g, b, a = big.split()
    big = Image.merge("RGBA", (r, g, b, a.point(lambda v: int(v * 0.75))))
    d = ImageDraw.Draw(big)
    p0, p1 = (W * 0.16, W * 0.16), (W * 0.84, W * 0.84)
    # a dark edge under the red so the slash stays legible where it crosses the bars, then the red itself
    d.line([p0, p1], fill=(11, 13, 14, 255), width=int(W * 0.085))
    d.line([p0, p1], fill=BLOOD + (255,), width=int(W * 0.055))
    for p in (p0, p1):
        rr = W * 0.0275
        d.ellipse((p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr), fill=BLOOD + (255,))
    big.resize((base.width, base.height), Image.LANCZOS).save(ART / "vol-mute.png")
    print("wrote", ART / "vol-mute.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
