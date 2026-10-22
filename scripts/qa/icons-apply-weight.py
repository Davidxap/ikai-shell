#!/usr/bin/env python3
"""Calibrates kinds with icons-calibrate.mjs and writes the result into the WEIGHT table of a kind file.
   usage: icons-apply-weight.py <dark|light|both> <bar/modules/ItoIconRealN.js> <spec> ...
   spec: kind | ai:<form> | indicator:<version>[:on] | sky:<sky> | media:<face>     env: ICON_TONE=theme, LINE_MAX, BIAS_LIGHT, BIAS_DARK
   "dark" / "light" rewrites only that side of gain / line / mass; "both" also the scale (an ":on" spec keeps its off state's scale)."""
import sys, json, re, subprocess, os
mode, f, kinds = sys.argv[1], sys.argv[2], sys.argv[3:]
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
s = open(f).read()
out = {}
for kd in kinds:
    env = dict(os.environ)
    if kd.endswith(":on"):
        bm = re.search(r'^\s*"%s": \{[^\n]*?scale: ([0-9.]+)' % re.escape(kd[:-3]), s, re.M)
        if bm: env["SCALE"] = bm.group(1)
    r = subprocess.check_output(["node", "scripts/qa/icons-calibrate.mjs", kd], env=env).decode().strip().split("\n")[-1]
    out.update(json.loads(r))
def setv(body, name, idx, val):
    mm = re.search(name + r': \[([^\]]*)\]', body)
    if not mm: return body + ", %s: [%s, 1]" % (name, val) if idx == 0 else body + ", %s: [1, %s]" % (name, val)
    a = [x.strip() for x in mm.group(1).split(',')]; a[idx] = str(val)
    return body[:mm.start()] + "%s: [%s]" % (name, ", ".join(a)) + body[mm.end():]
for k, d in out.items():
    if k == "ai:brain": k = "ai"
    m = re.search(r'^(\s*)("?%s"?): \{([^\n]*?)\}(,?)$' % re.escape(k), s, re.M)
    if not m: print("missing", k); continue
    body = m.group(3)
    for idx, side in ((0, "dark"), (1, "light")):
        if mode in (side, "both"):
            body = setv(body, "gain", idx, d["gain"][idx]); body = setv(body, "line", idx, d["line"][idx])
            if "mass" in d: body = setv(body, "mass", idx, d["mass"][idx])
    if mode == "both":
        body = re.sub(r'scale: [0-9.]+', 'scale: %s' % d["scale"], body)
    s = s[:m.start()] + m.group(1) + m.group(2) + ": { " + body.strip() + " }" + m.group(4) + s[m.end():]
open(f, 'w').write(s)
print("wrote", len(out), "entries")
