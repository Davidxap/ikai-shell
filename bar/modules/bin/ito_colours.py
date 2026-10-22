"""ito_colours: the one colour truth of the Boot & Lock surfaces. `resolve()` gives blood, lit, bone, ink and warn exactly as
ItoConfig.qml resolves them (theme colors.toml, accentSource, vibrance...). The only literal hex values here are the
last-resort fallbacks ItoConfig.qml itself carries, used only when the file that should hold the colour is unreadable.
Test overrides: ITO_LOCK_COLORS=<colors.toml>, ITO_LOCK_STYLE=<ito-style.json>."""
from __future__ import annotations

import colorsys
import json
import os
import re
from pathlib import Path

HOME = Path(os.environ.get("HOME", "~")).expanduser()
OMARCHY = HOME / ".config" / "omarchy"
STYLE = Path(os.environ.get("ITO_LOCK_STYLE") or OMARCHY / "bar" / "modules" / "ito-style.json")
THEME_COLORS = Path(os.environ.get("ITO_LOCK_COLORS") or HOME / ".local" / "state" / "omarchy" / "current" / "theme" / "colors.toml")
FALLBACK_BLOOD, SHELL_BONE, SHELL_INK = "#c4162a", "#c7ccd1", "#0b0d0e"
THEME_BONE, THEME_INK = "#c7ccd1", "#0b0d0e"


def read(path):
    try:
        return path.read_text()
    except OSError:
        return None



def style():
    try:
        data = json.loads(STYLE.read_text())
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def theme_colors():
    """colors.toml as a dict (key -> '#rrggbb'), parsed with ItoConfig's own pattern; {} when unreadable."""
    text, colours = read(THEME_COLORS), {}
    for line in (text or "").splitlines():
        m = re.match(r'^\s*([A-Za-z0-9_]+)\s*=\s*"(#[0-9A-Fa-f]{6,8})"', line)
        if m:
            h = m.group(2)
            colours[m.group(1)] = "#" + h[-6:].lower()   # Qt reads 8 digits as #AARRGGBB
    return colours


def get(cfg, key, fallback):
    v = cfg.get(key)
    return fallback if v is None or v == "" else v


def clean(hex_colour, fallback):
    return hex_colour.lower() if isinstance(hex_colour, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", hex_colour) else fallback


def hsv(hex_colour):
    h = hex_colour.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return colorsys.rgb_to_hsv(r, g, b)


def from_hsv(h, s, v):
    r, g, b = colorsys.hsv_to_rgb(h, max(0, min(1, s)), max(0, min(1, v)))
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def vivid(hex_colour, vibrance):
    """ItoConfig.vivid: push towards more or less saturated; identity at vibrance 1."""
    if abs(vibrance - 1) < 0.01:
        return hex_colour
    h, s, v = hsv(hex_colour)
    return from_hsv(h, min(1, s * vibrance), min(1, v * (0.7 + 0.3 * vibrance)))


def lighter(hex_colour, factor=1.18):
    """Qt.lighter: value scaled by the factor; past full value the excess is taken out of the saturation."""
    h, s, v = hsv(hex_colour)
    v255, s255 = v * 255 * factor, s * 255
    if v255 > 255:
        s255 = max(0, s255 - (v255 - 255))
        v255 = 255
    return from_hsv(h, s255 / 255, v255 / 255)


def error_red(hex_colour):
    h = hex_colour.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hue, light, sat = colorsys.rgb_to_hls(r, g, b)
    deg = hue * 360
    if min(deg, 360 - deg) <= 35:
        return hex_colour.lower()
    r, g, b = colorsys.hls_to_rgb(355 / 360, light, sat)
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def resolve():
    """(colours, info): blood, lit, bone, ink and warn, resolved as the shell resolves them."""
    cfg, theme = style(), theme_colors()
    follow = str(get(cfg, "colorMode", "theme")) == "theme"
    try:
        vibrance = max(0.3, min(2.0, float(get(cfg, "vibrance", 1))))
    except (TypeError, ValueError):
        vibrance = 1.0
    src = str(get(cfg, "accentSource", "accent"))
    if src == "custom":
        picked = clean(get(cfg, "accentCustom", FALLBACK_BLOOD), FALLBACK_BLOOD)
    elif src == "ito":
        picked = FALLBACK_BLOOD
    elif src != "accent" and theme.get(src):
        picked = theme[src]
    else:
        picked = theme.get("accent") or FALLBACK_BLOOD
    if follow:
        blood = vivid(picked, vibrance)
        bone = theme.get("foreground") or THEME_BONE
        ink = theme.get("background") or THEME_INK
    else:
        blood = vivid(clean(get(cfg, "bloodLive", FALLBACK_BLOOD), FALLBACK_BLOOD), vibrance)
        bone, ink = SHELL_BONE, SHELL_INK
    # A wrong password is shown in the theme's red when it has one, else in the accent, but it must always read as
    # an error: a hue further than 35 degrees from red is moved to 355 degrees, keeping saturation and lightness.
    warn = error_red((theme.get("red") if follow else None) or blood)
    colours = {"blood": blood, "lit": lighter(blood), "bone": bone, "ink": ink, "warn": warn}
    info = {"follow_theme": follow, "accent_source": src, "colors_toml": str(THEME_COLORS), "colors_toml_readable": bool(theme)}
    return colours, info


def rgba(hex_colour, alpha):
    h = hex_colour.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return f"rgba({r}, {g}, {b}, {alpha})"


