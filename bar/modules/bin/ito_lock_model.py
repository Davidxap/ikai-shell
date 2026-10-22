"""ito_lock_model: the lock designs of boot-lock-v2 §3 as ONE model with two back-ends.

`build(design, ctx)` returns a plain-data model (layers and widgets in the 2560 x 1440 reference grid, per monitor);
`emit_hyprlock(model, ctx)` writes the hyprlock.conf for engine C, and the same JSON feeds the Quickshell view of engine B
(plugins/ito.lock), so the two engines cannot drift. Every colour is a NAME (`$bone`, `$lit_dim`...) resolved by the caller
from the theme; this module holds no colour. Positions are hyprlock's own (percent of the monitor, y up for centre/bottom).

ctx keys: colours, monitors [{name,width,height}], fonts (set of families), picture (Path|None), mark (Path|None),
glyphs, seal_scale, tick (Path), cache (Path), lock_bg, beam, user_mark_ok.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path

import ito_ink as ink

GEN_VERSION = 10

# ---- the registry (boot-lock-v2 §3.0) ---------------------------------------------------------------------------

REGISTRY = [
    {"key": "fog", "name": "Fog", "kanji": "霧", "available": True,
     "note": "A quiet vigil: the town as a pen drawing lost in fog, your seal and the field."},
    {"key": "lantern", "name": "Lantern", "kanji": "灯", "available": True,
     "note": "Only what your flashlight reaches exists; the radio hisses in the dark corner."},
    {"key": "amigara", "name": "Amigara", "kanji": "穴", "available": True,
     "note": "A cliff of human-shaped holes, and one of them was made for you."},
    {"key": "watcher", "name": "Watcher", "kanji": "眼", "available": True,
     "note": "One huge engraved eye, still on hyprlock; its iris turns slowly on the Quickshell lock."},
    # the scenes of the user's Boot & Lock sheets (ito-assets recipe sheets): available only when their picture is in the assets folder
    {"key": "tomie", "name": "Tomie", "kanji": "富", "available": True, "scene": True,
     "note": "Her drawing in its brushed frame, one eye still her own and weeping blood."},
    {"key": "pyramid", "name": "Pyramid", "kanji": "罰", "available": True, "scene": True,
     "note": "He stands at the wall that weeps rust, turned toward the clock."},
    {"key": "road", "name": "Welcome Road", "kanji": "道", "available": True, "scene": True,
     "note": "The road into town, the poles fading out, the sign waiting in the fog."},
    {"key": "moth", "name": "Moth", "kanji": "蛾", "available": True, "scene": True,
     "note": "A moth pinned in a red sight on a cracked wall, bleeding down the plaster."},
]
SCENES = tuple(d["key"] for d in REGISTRY if d.get("scene"))
# old names of removed designs; `pyramid` and `moth` are designs again (the sheet scenes), so they are no longer aliases
ALIASES = {"panel": "fog", "signpost": "fog", "horizon": "fog", "spiral": "fog", "otherworld": "fog", "vortex": "fog", "weeper": "fog"}
DEFAULT = "fog"

PH = "<i>the fog waits for a name…</i>"
FAIL = "<i>the town refuses you ($ATTEMPTS)</i>"
FIELD_TEXT = {
    "fog": (PH, FAIL), "lantern": (PH, FAIL),
    "amigara": ("<i>this one was made for you…</i>", "<i>you do not fit ($ATTEMPTS)</i>"),
    "watcher": ("<i>it is still looking…</i>", "<i>it saw that ($ATTEMPTS)</i>"),
    "tomie": ("<i>she remembers every face…</i>", "<i>not the face she wanted ($ATTEMPTS)</i>"),
    "pyramid": ("<i>he is waiting for you…</i>", "<i>judged ($ATTEMPTS)</i>"),
    "road": (PH, FAIL),
    "moth": ("<i>it found the light…</i>", "<i>the wings close ($ATTEMPTS)</i>"),
}
# what each design is made of: background zindexes, mark/ring images, shapes, reload timers (validator v2)
SPEC = {
    "fog": {"bg": [-3, -2], "shapes": 0, "reload": 0},
    "lantern": {"bg": [-4, -3, -2], "shapes": 0, "reload": 0},
    "amigara": {"bg": [-3, -2], "shapes": 0, "reload": 0},
    "watcher": {"bg": [-3, -2], "shapes": 0, "reload": 0, "eye": True},
    **{k: {"bg": [-3, -2], "shapes": 0, "reload": 0, "scene": True} for k in SCENES},
}


def key_of(name):
    name = ALIASES.get(name, name)
    return name if name in [d["key"] for d in REGISTRY] else None


# ---- grid helpers (reference 2560 x 1440) ----------------------------------------------------------------------

def pc(v):
    return f"{v:.2f}%"


def cy(y):          # valign centre: percent from the middle, positive up
    return pc((720.0 - y) / 14.4)


def cx(x):          # halign centre
    return pc((x - 1280.0) / 25.6)


def lx(x):          # halign left
    return pc(x / 25.6)


def fmt_pos(ha, va, x, y):
    return {"ha": ha, "va": va, "x": x, "y": y}


def C(x=None, y=None):
    return fmt_pos("center", "center", "0" if x is None else cx(x), "0" if y is None else cy(y))


def L(x, y):
    return fmt_pos("left", "center", lx(x), cy(y))


def R_(x_off_px, y):  # halign right, x is the (negative) offset of the right edge from the screen edge, in reference px
    return fmt_pos("right", "center", pc(x_off_px / 25.6), cy(y))


def label(text, color, fs, font, pos, **kw):
    return {"type": "label", "text": text, "color": color, "fs": fs, "font": font, "pos": pos, **kw}


def kanji_labels(glyphs, scale, ha, x, y_of, color="$lit_dim"):
    """One label per glyph; y_of(i) is the glyph's centre in reference px."""
    out = []
    for i, ch in enumerate(glyphs):
        pos = fmt_pos(ha, "center", x, cy(y_of(i)))
        out.append(label(ch, color, 32 * scale, "cjk", pos, kanji=True))
    return out


def identity(common, mark_size, ring_pad, pos, with_mark, z_ring=1):
    """The mark image and its inked ring at one position."""
    if not with_mark:
        return []
    return [{"type": "image", "role": "mark", "size": mark_size, "pos": pos, "z": 0},
            {"type": "image", "role": "ring", "size": mark_size, "pad": ring_pad, "pos": pos, "z": z_ring}]


# ---- the designs -----------------------------------------------------------------------------------------------

def widgets_for(design, ctx):
    glyphs = ctx["glyphs"] if ctx.get("seal_on", True) and design != "watcher" else []
    sc = ctx["seal_scale"]
    mark = ctx["mark"] is not None
    n = len(glyphs)
    clock = lambda fs, pos: label('<span font_features="tnum">$TIME</span>', "$bone_soft", fs, "clock", pos, shadow=True, live="clock")
    date = lambda pos: label("", "$bone_dim", 12, "micro", pos, live="date", tracking=5120)
    line = lambda pos, st="": label("", "$bone_dim", 14, "serif", pos, live="line", italic=True, set=st)
    status = lambda pos: label("", "$bone_dim", 10, "micro", pos, live="status", tracking=3072)
    name = lambda pos: label("$USER", "$bone", 17, "serif", pos, live="user")
    field = lambda pos, w, h=50, rounding="pill": {"type": "input", "w": w, "h": h, "rounding": rounding, "pos": pos}
    W = []
    if design == "fog":
        W += [clock(96, fmt_pos("center", "center", "0", "22.00%")), date(fmt_pos("center", "center", "0", "14.00%"))]
        W += identity(ctx, 96, 8, fmt_pos("center", "center", "0", "3.00%"), mark)
        if glyphs:
            W += kanji_labels(glyphs, sc, "left" if mark else "center", "53.28%" if mark else "0",
                              lambda i: 677 + (i - (n - 1) / 2) * 46 * sc)
        W += [name(fmt_pos("center", "center", "0", "-5.50%")),
              field(fmt_pos("center", "center", "0", "-12.00%"), 340),
              line(fmt_pos("center", "bottom", "0", "8%")), status(fmt_pos("center", "bottom", "0", "4%"))]
    elif design == "lantern":
        W += [clock(96, fmt_pos("center", "center", "-10.00%", "15.28%")), date(fmt_pos("center", "center", "-10.00%", "9.72%"))]
        W += identity(ctx, 80, 8, fmt_pos("center", "center", "-10.00%", "3.33%"), mark)
        if glyphs:
            W += kanji_labels(glyphs, sc, "left" if mark else "center", "42.66%" if mark else "-10.00%",
                              lambda i: 672 + (i - (n - 1) / 2) * 46 * sc)
        W += [name(fmt_pos("center", "center", "-10.00%", "-4.17%")),
              field(fmt_pos("center", "center", "-10.00%", "-9.44%"), 340),
              line(fmt_pos("center", "center", "-10.00%", "-15.00%")),
              status(fmt_pos("right", "bottom", "-3.00%", "4%"))]
    elif design == "amigara":
        W += [label('<span font_features="tnum">$TIME</span>', "$bone_soft", 72, "clock", fmt_pos("left", "center", "6.00%", "36.10%"), shadow=True, live="clock"),
              date(fmt_pos("left", "center", "6.00%", "31.00%"))]
        if mark:
            W += [{"type": "image", "role": "mark", "size": 72, "pos": fmt_pos("center", "center", "0", "22.60%"), "z": 0}]
        if glyphs:
            W += kanji_labels(glyphs, sc, "left", "51.95%", lambda i: 395 + (i - (n - 1) / 2) * 46 * sc)
        W += [label("$USER", "$bone_dim", 17, "serif", fmt_pos("center", "center", "0", "5.56%"), live="user"),
              field(fmt_pos("center", "center", "0", "-2.78%"), 300, 46),
              line(fmt_pos("center", "bottom", "0", "6%"), "ito"), status(fmt_pos("center", "bottom", "0", "3%"))]
    elif design == "watcher":
        # the eye is the seal: no mark, no seal letters (boot-lock-v2 §3.7)
        if ctx.get("eye"):      # the user's engraving (decisions-b9 §4.3): content 900k wide, eye centre y = 560k
            W += [{"type": "image", "role": "eye", "asset": True, "pos": C(None, 560), "z": 0}]
        else:
            W += [{"type": "image", "role": "eye", "w_ref": 1100, "pos": fmt_pos("center", "center", "0", "20.10%"), "z": 0}]
        W += [label('<span font_features="tnum">$TIME</span>', "$bone_soft", 72, "clock", fmt_pos("left", "center", "6.00%", "-30.00%"), shadow=True, live="clock"),
              date(fmt_pos("left", "center", "6.00%", "-35.00%")),
              label("$USER", "$bone", 17, "serif", fmt_pos("center", "center", "0", "-18.00%"), live="user"),
              field(fmt_pos("center", "center", "0", "-23.50%"), 340),
              line(fmt_pos("center", "bottom", "0", "6%")), status(fmt_pos("center", "bottom", "0", "3%"))]
    elif design in SCENES:
        # the art fills the left; everything live sits in the calm column on the right (ito_sheets.SAFE, centre x = 1960 ref px)
        col = cx(1960)
        W += [clock(96, fmt_pos("center", "center", col, cy(470))), date(fmt_pos("center", "center", col, cy(560)))]
        W += identity(ctx, 72, 8, fmt_pos("center", "center", col, cy(670)), mark)
        if glyphs:
            W += kanji_labels(glyphs, sc, "left" if mark else "center", lx(1960 + 84) if mark else col,
                              lambda i: 670 + (i - (n - 1) / 2) * 46 * sc)
        W += [name(fmt_pos("center", "center", col, cy(790))),
              field(fmt_pos("center", "center", col, cy(870)), 340),
              line(fmt_pos("center", "center", col, cy(980))),
              status(fmt_pos("right", "bottom", "-3.00%", "4%"))]
    return W


def scene_file(ctx, design, w, h):
    """The scene file for a w x h screen: the smallest one at least that tall, else the largest; None when there is none.
    ctx["scenes"] = {design: [(w, h, path), ...]} (ito-lock reads <assets>/lock/<design>-<w>x<h>.png)."""
    files = sorted((ctx.get("scenes") or {}).get(design) or [], key=lambda f: f[1])
    if not files:
        return None
    return next((f[2] for f in files if f[1] >= h), files[-1][2])


def build(design, ctx):
    """The model of `design` for every monitor. Layers carry job descriptions (what to draw), not paths."""
    design = key_of(design) or DEFAULT
    mons = ctx["monitors"]
    sizes = {(m["width"], m["height"]) for m in mons}
    screens = []
    groups = [{"name": "", "width": max(mons, key=lambda m: m["width"] * m["height"])["width"],
               "height": max(mons, key=lambda m: m["width"] * m["height"])["height"]}] if len(sizes) == 1 \
        else [{"name": m["name"], "width": m["width"], "height": m["height"]} for m in mons]
    spec = SPEC[design]
    for g in groups:
        w, h = g["width"], g["height"]
        k = h / 1440.0
        layers = []
        bg_mode = ctx["lock_bg"] if ctx["picture"] is not None else "screenshot"
        engraved = bg_mode == "engraved"
        z0 = spec["bg"][0]
        layers.append({"id": "picture", "kind": "picture", "z": z0, "mode": bg_mode,
                       "job": {"op": "l1", "w": w, "h": h} if engraved else
                              ({"op": "duotone", "w": w, "h": h} if bg_mode == "duotone" else None)})
        zi = 1
        if design == "lantern":
            layers.append({"id": "beam", "kind": "overlay", "z": spec["bg"][1], "job": {"op": "l6", "w": w, "h": h, "beam": ctx["beam"]}})
            layers.append({"id": "vignette", "kind": "overlay", "z": spec["bg"][2], "job": {"op": "l2", "w": w, "h": h}})
        elif design == "amigara":
            layers.append({"id": "strata", "kind": "overlay", "z": spec["bg"][1], "job": {"op": "l5", "w": w, "h": h}})
        elif design in SCENES and scene_file(ctx, design, w, h):     # the scene covers the screen (opaque); the picture under it stays for the validator's stack
            layers.append({"id": "scene", "kind": "overlay", "z": spec["bg"][1],
                           "job": {"op": "sc", "w": w, "h": h, "src": str(scene_file(ctx, design, w, h))}})
        elif design == "watcher" and ctx.get("eye"):     # L2w: the vignette with the eye's ink pool baked in
            eg = ink.eye_geometry(w, h)
            layers.append({"id": "vignette", "kind": "overlay", "z": spec["bg"][1],
                           "job": {"op": "l2w", "w": w, "h": h, "ew": round(eg["ew"], 1), "eh": round(eg["eh"], 1),
                                   "cx": round(eg["cx"], 1), "cy": round(eg["cy"], 1)}})
        else:
            layers.append({"id": "vignette", "kind": "overlay", "z": spec["bg"][1], "job": {"op": "l2", "w": w, "h": h}})
        screens.append({"monitor": g["name"], "width": w, "height": h, "k": k, "layers": layers})
    return {"design": design, "gen": GEN_VERSION, "screens": screens, "widgets": widgets_for(design, ctx),
            "field_text": FIELD_TEXT[design], "ref": {"w": 2560, "h": 1440}}


# ---- drawing the layers (cached) -------------------------------------------------------------------------------

def _stat(p):
    try:
        return [str(p), Path(p).stat().st_mtime_ns]
    except (OSError, TypeError):
        return None


TONE_OPS = ("l1", "duotone", "l4", "l5", "eyea", "sc")      # the layers lockTone sync reaches (lock-theme-sync §1.2)


def job_path(job, ctx):
    """Where a layer's file lives. The key covers everything it is drawn from (cache by content, never by name)."""
    c = ctx["colours"]
    op = job["op"]
    per_op = {"l1": ("ink", "bone"), "duotone": ("ink", "bone"), "l2": ("ink",), "l4": ("ink", "bone"), "l5": ("ink", "bone"),
              "l6": ("ink",), "l7": ("ink", "blood", "bone"), "l9": ("ink", "blood", "bone"), "ring": ("bone",),
              "eye": ("ink", "bone", "blood"), "l2w": ("ink", "bone"), "eyea": ("ink", "bone"), "sc": ("ink", "bone", "blood")}[op]
    sync = ctx.get("tone") == "sync" and op in TONE_OPS      # lockTone sync: the hint direction (blood) and the eye accent (lit) join the key
    if sync:
        per_op = per_op + tuple(k for k in (("blood",) if op != "eyea" else ("blood", "lit")) if k not in per_op)
    parts = [op, job.get("w"), job.get("h"), {k: c[k] for k in per_op},
             {k: v for k, v in job.items() if k not in ("w", "h", "op")},
             _stat(ctx["picture"]) if op in ("l1", "duotone") else (_stat(job["src"]) if op == "sc" else None), GEN_VERSION]
    if sync:     # flat keeps today's keys byte for byte, so rolling back is a plain cache hit
        parts.append({"tone": {"mode": "sync", "v": ink.TONE_VERSION}})
    blob = json.dumps(parts, sort_keys=True, default=str)
    key = hashlib.sha1(blob.encode()).hexdigest()[:12]
    name = f"frames-{key}" if op in ("eye", "eyea") else f"{op}-{key}.png"
    return ctx["cache"] / name


def draw(job, out, ctx):
    """Render one job to `out` (a file, or a directory of eye frames)."""
    c, op, w, h = ctx["colours"], job["op"], job.get("w"), job.get("h")
    tone = ctx.get("tone", "flat")
    if op == "l1":
        ink.tone_image(ink.engraved_picture(ctx["picture"], w, h, c), c, tone).save(out, compress_level=1)
    elif op == "duotone":
        ink.tone_image(ink.duotone_picture(ctx["picture"], c), c, tone).save(out, compress_level=1)
    elif op == "sc":
        ink.tone_image(ink.scene(job["src"], w, h, c), c, tone).save(out, compress_level=1)
    elif op == "l2":
        ink.vignette(w, h, c).save(out, compress_level=1)
    elif op == "l2w":
        ink.vignette_pool(w, h, c, job["cx"], job["cy"], job["ew"], job["eh"]).save(out, compress_level=1)
    elif op == "l5":
        ink.tone_image(ink.strata(w, h, c), c, tone).save(out, compress_level=1)
    elif op == "l6":
        ink.beam(w, h, c, job.get("beam", 0.88)).save(out, compress_level=1)
    elif op == "l7":
        ink.rust(w, h, c)[0].save(out, compress_level=1)
    elif op == "ring":
        ink.ring(job["mark"], job["k"], c, job.get("pad", 8)).save(out, compress_level=1)
    elif op == "eyea":     # the user's engraving: eye.png (still) + static.png / iris.png / spin.json for the Quickshell lock
        geo = ink.eye_asset_frames(ctx["eye"]["folder"], job["ew"], c, out, tone)
        (Path(out) / "meta.json").write_text(json.dumps({**geo, "version": GEN_VERSION}))
    elif op == "eye":
        geo = ink.watcher_frames(job["width"], job["k"], c, out)
        (Path(out) / "meta.json").write_text(json.dumps({**geo, "version": GEN_VERSION}))
    else:
        raise ValueError(op)


def ensure(job, ctx):
    """Draw the job unless its cached file is already there; returns the path. Atomic: temp name, then rename."""
    out = job_path(job, ctx)
    if job["op"] in ("eye", "eyea"):
        # the watcher is a still (+ the iris disc for the Quickshell lock): complete when eye.png is there
        done = (out / "eye.png").is_file() and (job["op"] == "eye" or (out / "spin.json").is_file())
        if (out / "meta.json").is_file() and done:
            return out
        ctx["cache"].mkdir(parents=True, exist_ok=True)
        tmp = Path(tempfile.mkdtemp(dir=ctx["cache"], prefix=".frames-"))
        try:
            draw(job, tmp / "f", ctx)
            if out.exists():
                shutil.rmtree(out, ignore_errors=True)
            os.replace(tmp / "f", out)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        return out
    if out.is_file() and out.stat().st_size > 0:
        return out
    ctx["cache"].mkdir(parents=True, exist_ok=True)
    tmp = out.with_name(f".{out.name}.{os.getpid()}.png")
    draw(job, tmp, ctx)
    os.replace(tmp, out)
    return out


def eye_job(wd, screen, ctx=None):
    """The watcher's frames for one screen: the user's engraving (24 frames, content ew = min(900k, 1375) px; the key carries
    the asset files' signature) or the drawn eye (1100k px wide, 12 frames)."""
    if wd.get("asset"):
        g = ink.eye_geometry(screen["width"], screen["height"])
        return {"op": "eyea", "ew": round(g["ew"]), "src": (ctx or {}).get("eye", {}).get("sig") if ctx else None}
    return {"op": "eye", "width": round(wd["w_ref"] * screen["k"]), "k": round(screen["k"], 4)}


def jobs_of(model, ctx):
    """Every job a model needs, as (job, path) pairs, without drawing anything. Includes the rings."""
    out = []
    for s in model["screens"]:
        for ly in s["layers"]:
            if ly.get("job"):
                out.append((ly["job"], job_path(ly["job"], ctx)))
        for wd in model["widgets"]:
            if wd.get("type") == "image" and wd.get("role") == "ring":
                job = {"op": "ring", "mark": wd["size"], "k": round(s["k"], 4), "pad": wd["pad"]}
                out.append((job, job_path(job, ctx)))
            if wd.get("type") == "image" and wd.get("role") == "eye":
                job = eye_job(wd, s, ctx)
                out.append((job, job_path(job, ctx)))
    return out


# ---- the hyprlock back-end -------------------------------------------------------------------------------------

def emit_hyprlock(model, ctx, header):
    """The hyprlock.conf text for `model`. `header` is the leading comment block. Pure: writes nothing."""
    tick, fonts = str(ctx["tick"]), ctx["fonts"]
    names = ctx["font_names"]
    design = model["design"]

    def fam(role):
        return names.get(role)

    def font(role):
        f = fam(role)
        return f"\n    font_family = {f}" if f else ""

    blocks = ["general {\n    immediate_render = true\n    hide_cursor = true\n    ignore_empty_input = true\n"
              + ("    fail_timeout = 2400\n")
              + "}"]
    for s in model["screens"]:
        k, w, h = s["k"], s["width"], s["height"]
        mon = f" {s['monitor']}" if s["monitor"] else ""
        px = lambda v: max(1, round(v * k))
        fs = lambda v: max(1, round(v * k))
        for ly in s["layers"]:
            z = ly["z"]
            if ly["kind"] == "picture":
                mode = ly["mode"]
                if ly.get("job"):
                    path = job_path(ly["job"], ctx)
                    tone = "    blur_passes = 0\n    brightness = 1.0\n    contrast = 1.0\n    noise = 0\n" if mode == "engraved" else \
                           "    blur_passes = 3\n    blur_size = 9\n    brightness = 0.34\n    contrast = 1.05\n    noise = 0.03\n"
                elif mode == "raw":
                    path, tone = str(ctx["picture"]), "    blur_passes = 3\n    blur_size = 9\n    brightness = 0.34\n    contrast = 1.05\n    noise = 0.03\n"
                elif mode == "ink":
                    path, tone = "", "    blur_passes = 0\n"
                else:   # screenshot: never readable (blur >= 2)
                    path, tone = "screenshot", "    blur_passes = 3\n    blur_size = 9\n    brightness = 0.34\n    contrast = 1.05\n    noise = 0.03\n"
                blocks.append(f"background {{\n    monitor ={mon}\n    path = {path}\n{tone}    vibrancy = 0\n    color = $ink\n    zindex = {z}\n}}")
            elif ly["kind"] == "overlay":
                blocks.append(f"background {{\n    monitor ={mon}\n    path = {job_path(ly['job'], ctx)}\n    blur_passes = 0\n    zindex = {z}\n}}")
        for wd in model["widgets"]:
            blocks.append(_widget_block(wd, s, ctx, mon, px, fs, font, tick, model))
    blocks.append("animations {\n    enabled = true\n    bezier = linear, 0, 0, 1, 1\n"      # units of 100 ms: everything the user triggers is fast (<= 260 ms)
                  "    bezier = smooth, 0.25, 0.1, 0.25, 1\n    animation = fadeIn, 1, 2, linear\n"
                  "    animation = fadeOut, 1, 2, smooth\n    animation = inputFieldColors, 1, 2, smooth\n"
                  "    animation = inputFieldFade, 1, 2, smooth\n    animation = inputFieldWidth, 1, 2, smooth\n"
                  "    animation = inputFieldDots, 1, 1, smooth\n}")
    return header + "\n\n" + "\n\n".join(blocks) + "\n"


def _pos_lines(pos):
    return f"    position = {pos['x']}, {pos['y']}\n    halign = {pos['ha']}\n    valign = {pos['va']}\n"


def _widget_block(wd, s, ctx, mon, px, fs, font, tick, model):
    t = wd["type"]
    k = s["k"]
    pos = wd["pos"]
    if t == "label":
        text = wd["text"]
        live = wd.get("live")
        if live == "date":
            text = f"cmd[update:60000] {tick} date {wd['tracking']}"
        elif live == "line":
            text = f"cmd[update:1000] {tick} line i" + (f" {wd['set']}" if wd.get("set") else "")
        elif live == "status":
            text = f"cmd[update:1000] {tick} status {wd['tracking']}"
        shadow = (f"    shadow_passes = 2\n    shadow_size = {px(10)}\n    shadow_color = $ink_shadow\n") if wd.get("shadow") else ""
        return (f"label {{\n    monitor ={mon}\n    text = {text}\n    color = {wd['color']}\n    font_size = {fs(wd['fs'])}"
                f"{font(wd['font'])}\n    text_align = center\n{shadow}" + _pos_lines(pos) + "}")
    if t == "image" and wd["role"] == "eye":
        job = eye_job(wd, s, ctx)
        d = job_path(job, ctx)
        if wd.get("asset"):
            hpx = ink.eye_geometry(s["width"], s["height"])["fh"]
        else:
            hpx = ink.watcher_size(job["width"])[1]
        # a still: hyprlock reloads an image at most once a second, so a baked animation there is a stutter, not a motion
        return (f"image {{\n    monitor ={mon}\n    path = {d}/eye.png\n    size = {hpx}\n    rounding = 0\n    border_size = 0\n"
                + _pos_lines(pos) + f"    zindex = {wd.get('z', 0)}\n}}")
    if t == "image":
        if wd["role"] == "mark":
            path, size, border = ctx["mark"], px(wd["size"]), 0
        else:
            job = {"op": "ring", "mark": wd["size"], "k": round(k, 4), "pad": wd["pad"]}
            path, size, border = job_path(job, ctx), round(wd["size"] * k + 2 * wd["pad"] * k), 0
        return (f"image {{\n    monitor ={mon}\n    path = {path}\n    size = {size}\n    rounding = -1\n"
                f"    border_size = {border}\n" + _pos_lines(pos) + f"    zindex = {wd.get('z', 0)}\n}}")
    if t == "shape":
        return (f"shape {{\n    monitor ={mon}\n    size = {round(wd['w_frac'] * s['width'])}, {px(wd['h'])}\n    color = {wd['color']}\n"
                f"    rounding = {wd['rounding']}\n    border_size = {wd['border']}\n" + _pos_lines(pos) + f"    zindex = {wd.get('z', 0)}\n}}")
    if t == "input":
        rounding = {"pill": -1, "soft": px(6), "square": 0}[wd["rounding"]]
        ph, fail = model["field_text"]
        return ("input-field {\n    monitor =" + mon + f"\n    size = {px(wd['w'])}, {px(wd['h'])}\n    outline_thickness = {px(2)}\n"
                "    dots_size = 0.2\n    dots_spacing = 0.35\n    dots_center = true\n    dots_rounding = -1\n"
                "    outer_color = $bone_line\n    inner_color = $ink_field\n    font_color = $bone\n    check_color = $lit\n"
                "    fail_color = $warn\n    capslock_color = $lit\n"
                f"    placeholder_text = {ph}\n    fail_text = {fail}\n    fade_on_empty = false\n"
                f"    rounding = {rounding}\n" + _pos_lines(pos) + "}")
    raise ValueError(t)


# ---- the Quickshell back-end (engine B, plugins/ito.lock) -------------------------------------------------------

LORE_JS = Path(__file__).resolve().parent.parent / "ItoLore.js"


def quotes(path=None):
    """The lock's quote lines, read from their single source: the `text` of every entry of QUOTES in bar/modules/ItoLore.js (only
    genuine, attributable lines; the sources sit beside them there). [] when the file cannot be read."""
    try:
        js = Path(path or LORE_JS).read_text(encoding="utf-8")
    except OSError:
        return []
    import re
    m = re.search(r"^var QUOTES = \{(.*?)^\}", js, re.M | re.S)
    return re.findall(r'text:\s*"((?:[^"\\]|\\.)*)"', m.group(1)) if m else []


def qml_model(model, ctx, colour_vars, inputs, battery):
    """The resolved model the Quickshell view reads (~/.cache/ito/lock/model-<design>.json): per screen, the layers with
    their real file paths and the widgets with the images' paths filled in. The same widgets and positions as the hyprlock
    conf (they come from one build()), so the two engines cannot drift. Pure data; no colour literals other than the
    resolved theme colours the caller passes in `colour_vars` as {name: {hex, a}}."""
    screens = []
    for s in model["screens"]:
        layers = []
        for ly in s["layers"]:
            item = {"id": ly["id"], "kind": ly["kind"], "z": ly["z"]}
            if ly["kind"] == "picture":
                item["mode"] = ly["mode"]
                item["path"] = str(job_path(ly["job"], ctx)) if ly.get("job") else (str(ctx["picture"]) if ly["mode"] == "raw" else "")
            elif ly["kind"] == "overlay":
                item["path"] = str(job_path(ly["job"], ctx))
            layers.append(item)
        widgets = []
        for wd in model["widgets"]:
            w = dict(wd)
            if wd.get("type") == "image":
                if wd["role"] == "eye":
                    job = eye_job(wd, s, ctx)
                    w["dir"] = str(job_path(job, ctx))
                    if wd.get("asset"):     # the iris disc turns in the Quickshell lock: where it sits comes from spin.json
                        g = ink.eye_geometry(s["width"], s["height"])
                        w["size_px"], w["aspect"] = g["fh"], round(g["fw"] / g["fh"], 4)
                        w["spin"] = ink.eye_spin_geometry(ctx["eye"]["folder"], job["ew"])
                    else:
                        w["size_px"] = ink.watcher_size(job["width"])[1]
                elif wd["role"] == "mark":
                    w["path"] = str(ctx["mark"])
                else:
                    job = {"op": "ring", "mark": wd["size"], "k": round(s["k"], 4), "pad": wd["pad"]}
                    w["path"] = str(job_path(job, ctx))
                    w["size_px"] = round(wd["size"] * s["k"] + 2 * wd["pad"] * s["k"])
            widgets.append(w)
        screens.append({"monitor": s["monitor"], "width": s["width"], "height": s["height"], "k": s["k"],
                        "layers": layers, "widgets": widgets})
    return {"kind": "ito-verse lock model", "design": model["design"], "inputs": inputs, "gen": GEN_VERSION,
            "colours": colour_vars, "fonts": ctx["font_names"], "field_text": list(model["field_text"]),
            "lines": {"default": quotes(), "ito": quotes()}, "battery": battery, "screens": screens}
