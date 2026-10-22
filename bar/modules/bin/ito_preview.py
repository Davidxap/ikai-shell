"""ito_preview: a mock lock screen drawn from the SAME conf text that `ito-lock apply` would write (boot-lock-v2 §2.9).

Nothing here reads the live session, takes a screenshot or runs a locker. Fixture data only: the time is "23:47", the date
"tuesday · 29 september", the status "up 3h 2m · bat 80% · locked 0:42", the name is $USER (it is what the lock shows).
render_lock(conf_text, w, h) -> PIL RGB image. A background that is `screenshot` is drawn as a flat ink canvas marked
"your screen, blurred": the real screen is never captured.
"""
from __future__ import annotations

import os
import re
import subprocess
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

TIME, TIME12 = "23:47", "11:47 pm"
DATE = "tuesday · 29 september"
STATUS = "up 3h 2m · bat 80% · locked 0:42"
PX_PER_PT = 96.0 / 72.0


def blocks(text):
    return [(m.group(1), m.group(2)) for m in re.finditer(r"^([\w-]+)\s*\{\n(.*?)^\}", text, re.M | re.S)]


def val(body, key, default=None):
    m = re.search(rf"^[ \t]*{re.escape(key)}[ \t]*=[ \t]*(.*?)[ \t]*$", body, re.M)
    return m.group(1) if m else default


def variables(text):
    out = {}
    for m in re.finditer(r"^\$(\w+)\s*=\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)", text, re.M):
        out[m.group(1)] = (int(m.group(2)), int(m.group(3)), int(m.group(4)), float(m.group(5)))
    return out


def colour(spec, vars_):
    spec = (spec or "").strip()
    if spec.startswith("$"):
        return vars_.get(spec[1:], (255, 255, 255, 1.0))
    m = re.match(r"rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)", spec)
    return (int(m.group(1)), int(m.group(2)), int(m.group(3)), float(m.group(4))) if m else (255, 255, 255, 1.0)


@lru_cache(maxsize=64)
def font_file(family, italic=False):
    pattern = (family or "Noto Serif") + (":italic" if italic else "")
    try:
        out = subprocess.run(["fc-match", "-f", "%{file}", pattern], capture_output=True, text=True, timeout=5).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        out = ""
    return out


@lru_cache(maxsize=128)
def load_font(family, px, italic=False):
    f = font_file(family, italic)
    try:
        return ImageFont.truetype(f, max(1, int(round(px)))) if f else ImageFont.load_default()
    except OSError:
        return ImageFont.load_default()


def resolve_text(raw, tick_args=None):
    """Label text -> (plain text, italic, tracking px unit 1/1024 pt, smaller)."""
    t = raw
    m = re.match(r"cmd\[update:\d+\]\s+\S*ito-lock-tick\s+(\w+)\s*(.*)", t)
    if m:
        mode, rest = m.group(1), m.group(2).split()
        if mode == "date":
            t = f'<span letter_spacing="{rest[0]}">{DATE}</span>' if rest and rest[0].isdigit() else DATE
        elif mode == "status":
            t = f'<span letter_spacing="{rest[0]}">{STATUS}</span>' if rest and rest[0].isdigit() else STATUS
        elif mode == "line":
            import ito_lock_model                  # the quotes' single source (ItoLore.js QUOTES), as ito-lock-tick shows them
            q = ito_lock_model.quotes()
            t = f"<i>{q[0]}</i>" if q else ""
        else:
            t = DATE
    t = t.replace("$TIME12", TIME12).replace("$TIME", TIME).replace("$USER", os.environ.get("USER", "user"))
    italic = "<i>" in t
    ls = re.search(r'letter_spacing="(\d+)"', t)
    smaller = 'size="smaller"' in t
    plain = re.sub(r"<[^>]*>", "", t)
    return plain, italic, (int(ls.group(1)) if ls else 0), smaller


def anchor(pos_x, pos_y, ha, va, tw, th, w, h):
    def num(v, total):
        v = v.strip()
        return float(v[:-1]) / 100.0 * total if v.endswith("%") else float(v or 0)
    x, y = num(pos_x, w), num(pos_y, h)
    if ha == "center":
        left = w / 2 + x - tw / 2
    elif ha == "left":
        left = x
    else:
        left = w + x - tw
    if va == "center":
        top = h / 2 - y - th / 2
    elif va == "bottom":
        top = h - y - th
    else:
        top = y
    return left, top


def draw_text(img, text, fam, px, col, left_top_fn, italic=False, tracking=0, shadow=None):
    f = load_font(fam, px, italic)
    track = tracking / 1024.0 * PX_PER_PT
    d0 = ImageDraw.Draw(img)
    if track:
        widths = [d0.textlength(ch, font=f) + track for ch in text]
        tw = sum(widths) - track
    else:
        tw = d0.textlength(text, font=f)
    asc, desc = f.getmetrics() if hasattr(f, "getmetrics") else (px, 0)
    th = asc + desc
    left, top = left_top_fn(tw, th)
    tile = Image.new("RGBA", (int(tw) + 8, int(th) + 8), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile)
    rgba = (col[0], col[1], col[2], int(255 * col[3]))
    if track:
        x = 4.0
        for ch, wd in zip(text, widths):
            td.text((x, 4), ch, font=f, fill=rgba)
            x += wd
    else:
        td.text((4, 4), text, font=f, fill=rgba)
    if shadow:
        sh = Image.new("RGBA", tile.size, (0, 0, 0, 0))
        sa = tile.split()[-1].filter(ImageFilter.GaussianBlur(shadow[1]))
        solid = Image.new("RGBA", tile.size, (shadow[0][0], shadow[0][1], shadow[0][2], 0))
        solid.putalpha(sa.point(lambda v: int(v * shadow[0][3])))
        img.alpha_composite(solid, (int(left) - 4, int(top) - 4))
    img.alpha_composite(tile, (int(left) - 4, int(top) - 4))
    return (left, top, left + tw, top + th)


def cover(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((max(w, round(im.width * s)), max(h, round(im.height * s))), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def render_lock(text, w, h, with_boxes=False):
    """Draw the conf. Returns the image (and the {id: bbox} of every widget when with_boxes)."""
    vars_ = variables(text)
    ink = vars_.get("ink", (16, 16, 16, 1.0))
    img = Image.new("RGBA", (w, h), ink[:3] + (255,))
    items = []
    for i, (kind, body) in enumerate(blocks(text)):
        if kind in ("general", "animations"):
            continue
        items.append((int(val(body, "zindex", "0") or 0), i, kind, body))
    items.sort(key=lambda t: (t[0], t[1]))
    boxes = []
    for z, i, kind, body in items:
        if kind == "background":
            path = val(body, "path", "")
            if path == "screenshot" or not path:
                if path == "screenshot":
                    d = ImageDraw.Draw(img)
                    d.text((w // 2, h // 2), "your screen, blurred", font=load_font("Noto Serif", 14 * h / 720, True),
                           fill=vars_.get("bone", (200, 200, 200, 1.0))[:3] + (60,), anchor="mm")
                continue
            try:
                src = Image.open(path).convert("RGBA")
            except OSError:
                continue
            src = cover(src, w, h)
            blur = int(val(body, "blur_passes", "0") or 0)
            bright = float(val(body, "brightness", "1.0") or 1.0)
            if blur:
                src = src.filter(ImageFilter.GaussianBlur(9 * blur * 0.35 * w / 2560.0))
            if bright != 1.0:
                rgb_ = ImageOps.autocontrast(src.convert("RGB"), cutoff=0) if False else src.convert("RGB").point(lambda v: int(v * bright))
                src = Image.merge("RGBA", (*rgb_.split(), src.split()[-1]))
            img.alpha_composite(src)
        elif kind == "image":
            path = val(body, "path", "")
            try:
                src = Image.open(path).convert("RGBA")
            except OSError:
                continue
            size = int(val(body, "size", "100"))
            s = size / min(src.size)
            src = src.resize((max(1, round(src.width * s)), max(1, round(src.height * s))), Image.LANCZOS)
            if (val(body, "rounding", "0") == "-1") and not re.search(r"/ring-", path):
                m = Image.new("L", src.size, 0)
                ImageDraw.Draw(m).ellipse([0, 0, src.width - 1, src.height - 1], fill=255)
                a = ImageChops_multiply(src.split()[-1], m)
                src.putalpha(a)
            l, t = anchor(*_pos(body), src.width, src.height, w, h)
            img.alpha_composite(src, (int(round(l)), int(round(t))))
            boxes.append(("image", (l, t, l + src.width, t + src.height)))
        elif kind == "shape":
            sw, sh = [int(v) for v in val(body, "size", "0, 0").replace(" ", "").split(",")]
            l, t = anchor(*_pos(body), sw, sh, w, h)
            col = colour(val(body, "color"), vars_)
            tile = Image.new("RGBA", (sw, sh), (col[0], col[1], col[2], int(255 * col[3])))
            img.alpha_composite(tile, (int(round(l)), int(round(t))))
            boxes.append(("shape", (l, t, l + sw, t + sh)))
        elif kind == "input-field":
            sw, sh = [int(v) for v in val(body, "size", "300, 50").replace(" ", "").split(",")]
            l, t = anchor(*_pos(body), sw, sh, w, h)
            outer, inner = colour(val(body, "outer_color"), vars_), colour(val(body, "inner_color"), vars_)
            rr = int(val(body, "rounding", "0") or 0)
            rr = sh // 2 if rr < 0 else min(rr, sh // 2)
            th_ = max(1, int(val(body, "outline_thickness", "2")))
            tile = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
            td = ImageDraw.Draw(tile)
            td.rounded_rectangle([0, 0, sw - 1, sh - 1], radius=rr, fill=inner[:3] + (int(255 * inner[3]),),
                                 outline=outer[:3] + (int(255 * outer[3]),), width=th_)
            img.alpha_composite(tile, (int(round(l)), int(round(t))))
            ph = re.sub(r"<[^>]*>", "", val(body, "placeholder_text", ""))
            bone = vars_.get("bone", (200, 200, 200, 1.0))
            draw_text(img, ph, "Noto Serif", 0.35 * sh * 1.0, (bone[0], bone[1], bone[2], 0.5),
                      lambda tw, th, l=l, t=t, sw=sw, sh=sh: (l + (sw - tw) / 2, t + (sh - th) / 2), italic=True)
            boxes.append(("input", (l, t, l + sw, t + sh)))
        elif kind == "label":
            plain, italic, ls, smaller = resolve_text(val(body, "text", ""))
            px = int(val(body, "font_size", "16")) * PX_PER_PT
            col = colour(val(body, "color"), vars_)
            ha, va = val(body, "halign", "center"), val(body, "valign", "center")
            sx, sy = _pos(body)[:2]
            shadow = None
            if val(body, "shadow_passes"):
                shadow = (colour(val(body, "shadow_color"), vars_), float(val(body, "shadow_size", "8")) / 2)
            bb = draw_text(img, plain, val(body, "font_family"), px, col,
                           lambda tw, th, sx=sx, sy=sy, ha=ha, va=va: anchor(sx, sy, ha, va, tw, th, w, h), italic, ls, shadow)
            boxes.append(("label", bb))
    out = img.convert("RGB")
    return (out, boxes) if with_boxes else out


def _pos(body):
    p = val(body, "position", "0, 0").replace(" ", "").split(",")
    return p[0], p[1], val(body, "halign", "center"), val(body, "valign", "center")


def ImageChops_multiply(a, b):
    from PIL import ImageChops
    return ImageChops.multiply(a, b)
