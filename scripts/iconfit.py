"""Put every generated icon on the same footing: crop it to its ink, scale the longest side to the same share of
the canvas, and centre it. Without it a ring, a bell and a wave form each land at a different size in the same
bar, because each was drawn to fill a different part of its own canvas."""

from PIL import Image

# The ink of an icon takes this share of its box. The workspace marks take 0.70 to 0.72 (the sheet's icons 0.74 to
# 0.85 on their long side), so every icon is fitted to the same 0.74 and nothing looks larger than a workspace.
SHARE = 0.74


def bbox_of(img: Image.Image):
    return img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()


def fit(img: Image.Image, box=None, share: float = SHARE) -> Image.Image:
    """`box` lets a picture and its mask (a filled silhouette) share one transform."""
    box = box or bbox_of(img)
    if not box:
        return img
    crop = img.crop(box)
    size = img.width
    scale = size * share / max(crop.width, crop.height)
    crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.LANCZOS)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(crop, ((size - crop.width) // 2, (size - crop.height) // 2))
    return out
