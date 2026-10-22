#!/usr/bin/env bash
# Zero cost while a panel is closed, checked in the source: in the diagram components every clock and every spring
# must be tied to `live` (the panel-open flag).
#   - every FrameAnimation, Timer and `X on prop` animation block has a `running:` that mentions `live`
#   - every Behavior block has an `enabled:` that mentions `live`
# The components are listed below; one that does not exist yet is skipped (they arrive slice by slice).
# Exit 1 with the offending block when a gate is missing.
set -u
cd "$(dirname "$0")/../.."
exec python3 - <<'PY'
import re, sys, os

CLOCKS = ["bar/modules/ItoIchor.qml", "bar/modules/ItoDrip.qml", "bar/modules/ItoCoreSeal.qml",
          "bar/modules/ItoVesselSeal.qml", "bar/modules/ItoPlatterSeal.qml",
          "bar/modules/ItoSwapSeal.qml", "bar/modules/ItoVesselBlock.qml", "bar/modules/ItoIchorFx.qml", "bar/modules/ItoEyeMotor.qml",
          "bar/modules/ItoCalendarPanel.qml", "plugins/ito.clock/BarWidget.qml", "bar/modules/ItoFrameChains.qml",
          "bar/modules/ItoFogBank.qml", "bar/modules/ItoLoreSfx.qml", "bar/modules/ItoStatic.qml", "bar/modules/ItoGyoWalker.qml",
          "bar/modules/ItoFrameProbe.qml"]

# The lore marks restart an animation only while the panel is open: every `.restart()` line in them mentions `live`.
RESTARTS = ["bar/modules/ItoLoreSfx.qml", "bar/modules/ItoStatic.qml", "bar/modules/ItoGyoWalker.qml"]
BEHAVIORS = CLOCKS + ["bar/modules/ItoSysRow.qml", "bar/modules/ItoRiteCell.qml", "bar/modules/ItoProcList.qml",
             "bar/modules/ItoSpring.qml", "bar/modules/ItoCalendarCard.qml", "bar/modules/ItoClockFace.qml", "bar/modules/ItoGroove.qml"]

# Components that must have NO clock at all: no Timer, FrameAnimation, `Animation on` or Behavior (the eye glyph draws what it
# is given; the clock lives in its host).
NO_CLOCKS = ["bar/modules/ItoEyeGlyph.qml", "bar/modules/ItoEyeRealBake.qml", "bar/modules/ItoEyeSigil.qml", "bar/modules/ItoEyeLive.qml", "bar/modules/ItoEyePlate.qml", "bar/modules/ItoIconBake.qml", "bar/modules/ItoIconSigil.qml", "bar/modules/ItoIconHighlight.qml", "bar/modules/ItoPresenceLids.qml", "bar/modules/ItoPresenceMask.qml", "bar/modules/ItoFrameMangaArt.qml", "bar/modules/ItoChain.qml", "bar/modules/ItoFrameMinimal.qml",
            "bar/modules/ItoBarbedWire.qml", "bar/modules/ItoGrating.qml", "bar/modules/ItoFrameOtherworld.qml",
            "bar/modules/ItoRust.qml", "bar/modules/ItoChainChord.qml"]

# Components that may run ONE animation per edge and nothing else: no Timer, FrameAnimation or Behavior, and no animation that
# loops or runs by itself (no `loops:`, no `running:` at all: it is started by a script on an edge and stops at its end).
EDGE_ONLY = ["bar/modules/ItoIconLive.qml", "bar/modules/ItoStateLayer.qml", "bar/modules/ItoBleedShape.qml", "bar/modules/ItoPresence.qml", "bar/modules/ItoSpeedLines.qml"]

# BAR_STATIC: the bar is always visible, so these files have no idle clock at all: no Timer, FrameAnimation, Behavior, `Animation on`,
# `loops:` or `running:`. An animation is allowed only as a one-shot, started by a script on an edge, and the file says so with a
# `// one-shot:` comment.
BAR_STATIC = []

# Opt-in clocks: the one documented BAR_STATIC exemption (STYLE_CONTRACT section 7). Every Timer must run only behind its flag.
FLAGGED = {"bar/modules/ItoPlate.qml": "fogDrift"}

def block_at(text, start):
    """The text of the {...} block whose opening brace is the first one at or after `start`."""
    i = text.index("{", start)
    depth, j = 0, i
    while j < len(text):
        if text[j] == "{": depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0: return text[i:j + 1]
        j += 1
    return text[i:]

def own_lines(body):
    """The block's own top-level text: nested { } blocks are cut out (on one line or several)."""
    out, depth = [], 0
    for ch in body:
        if ch == "{":
            depth += 1
            if depth > 1: out.append(" ")
            continue
        if ch == "}":
            depth -= 1
            continue
        if depth == 1: out.append(ch)
    return "".join(out)

def own_property(block, name):
    """The value of `name:` among the block's own lines, up to the next property, `;` or end of line."""
    m = re.search(r"(^|[\s;{])" + name + r"\s*:\s*([^\n;]*)", own_lines(block))
    return m.group(2) if m else None

bad = 0
def fail(path, what, block):
    global bad
    bad = 1
    print(f"{path}: {what}\n    " + block.strip().split("\n")[0][:110])

for path in sorted(set(CLOCKS + BEHAVIORS)):
    if not os.path.exists(path): continue
    text = open(path).read()
    if path in CLOCKS:
        for m in re.finditer(r"\b(FrameAnimation|Timer)\s*\{", text):
            blk = block_at(text, m.start())
            run = own_property(blk, "running")
            if not run or "live" not in run: fail(path, m.group(1) + " has no `running:` tied to live", text[m.start():m.start() + 60])
        for m in re.finditer(r"\b(\w+Animation)\s+on\s+\w+\s*\{", text):
            blk = block_at(text, m.start())
            run = own_property(blk, "running")
            if not run or "live" not in run: fail(path, m.group(1) + " on a property has no `running:` tied to live", text[m.start():m.start() + 60])
    for m in re.finditer(r"\bBehavior\s+on\s+\w+\s*\{", text):
        blk = block_at(text, m.start())
        en = own_property(blk, "enabled")
        if not en or "live" not in en: fail(path, "Behavior has no `enabled:` tied to live", text[m.start():m.start() + 60])

for path in RESTARTS:
    if not os.path.exists(path): continue
    for n, line in enumerate(open(path).read().split("\n"), 1):
        if ".restart()" in line and not line.lstrip().startswith("//") and "live" not in line:
            fail(path, "`.restart()` without `live` on line " + str(n), line)

for path, flag in FLAGGED.items():
    if not os.path.exists(path): continue
    text = open(path).read()
    for m in re.finditer(r"\b(FrameAnimation|Timer)\s*\{", text):
        run = own_property(block_at(text, m.start()), "running")
        if not run or flag not in run: fail(path, m.group(1) + " is not gated by `" + flag + "`", text[m.start():m.start() + 60])

for path in NO_CLOCKS:
    if not os.path.exists(path): continue
    text = "\n".join(l for l in open(path).read().split("\n") if not l.lstrip().startswith("//"))
    for m in re.finditer(r"\b(\w*Animation|Timer|Behavior)\b[^{\n]*\{", text):
        fail(path, "has a clock (" + m.group(1) + "): the component must have none", text[m.start():m.start() + 60])

for path in EDGE_ONLY:
    if not os.path.exists(path): continue
    text = "\n".join(l for l in open(path).read().split("\n") if not l.lstrip().startswith("//"))
    for m in re.finditer(r"\b(Timer|FrameAnimation|Behavior)\b[^{\n]*\{", text):
        fail(path, "has a clock (" + m.group(1) + "): only edge-started animations are allowed", text[m.start():m.start() + 60])
    for m in re.finditer(r"\b(\w*Animation)\b[^{\n]*\{", text):
        blk = block_at(text, m.start())
        own = own_lines(blk)
        if re.search(r"(^|[\s;{])(loops|running)\s*:", own) or " on " in text[m.start():m.start() + 60].split("{")[0]:
            fail(path, m.group(1) + " loops or runs by itself: it must only be started by an edge", text[m.start():m.start() + 60])

for path in BAR_STATIC:
    if not os.path.exists(path): continue
    raw = open(path).read()
    text = "\n".join(l for l in raw.split("\n") if not l.lstrip().startswith("//"))
    for m in re.finditer(r"\b(Timer|FrameAnimation|Behavior)\b[^{\n]*\{", text):
        fail(path, "BAR_STATIC: has a clock (" + m.group(1) + ")", text[m.start():m.start() + 60])
    for m in re.finditer(r"\b\w*Animation\s+on\s+\w+\s*\{", text):
        fail(path, "BAR_STATIC: `Animation on` runs by itself", text[m.start():m.start() + 60])
    for m in re.finditer(r"(^|[\s;{])(loops|running)\s*:", text):
        fail(path, "BAR_STATIC: `" + m.group(2) + ":` on an animation", text[m.start():m.start() + 60])
    if re.search(r"\b\w*Animation\s*\{", text) and "// one-shot:" not in raw:
        fail(path, "BAR_STATIC: an animation without a `// one-shot:` comment", "")

print("live gates: every clock and Behavior is tied to `live`" if not bad else "live gates: FAILED")
sys.exit(bad)
PY
