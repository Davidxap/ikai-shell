#!/usr/bin/env bash
# Watcher gate: a theme change regenerates the eye in the NEW tokens (the theme-set hook runs `ito-lock apply`, which stages the
# same layers), the hyprlock conf carries ONE still image (no timer, no frame helper), and dark vs light follows luminance.
# Two palettes are fed through the test override ITO_LOCK_COLORS; nothing live is read or written, nothing is locked,
# `omarchy-theme-set` is never called.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCK="$REPO/bar/modules/bin/ito-lock"
D=$(mktemp -d); trap 'rm -rf "$D"' EXIT
export ITO_LOCK_MONITORS=":1280x720"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
EYE="${ITO_LOCK_EYE_DIR:-$HOME/.config/ito/assets/eye}"
[[ -f $EYE/spiral-eye-ink-for-dark-themes.png ]] || { echo "skip: the user's eye art is not on this machine (the drawn eye is covered by test-ito-ink.py)"; }
printf 'accent = "#A8BE4A"\nbackground = "#0B0E20"\nforeground = "#DCD4BC"\ncolor1 = "#C85234"\n' > "$D/night.toml"
printf 'accent = "#D20F39"\nbackground = "#EFF1F5"\nforeground = "#4C4F69"\ncolor1 = "#D20F39"\n' > "$D/latte.toml"
for t in night latte; do
  mkdir -p "$D/$t"
  ITO_LOCK_COLORS="$D/$t.toml" "$LOCK" candidate --design watcher --out "$D/$t" >/dev/null || bad "$t: candidate did not validate"
done
python3 -I - "$D" "$HOME/.config/ito/assets/eye" <<'PY' || fail=1
import json, re, sys
from PIL import Image
import numpy as np
D, eye = sys.argv[1], sys.argv[2]
res, bad = {}, 0
def check(n, c, d=""):
    global bad
    print(("ok   " if c else "FAIL ") + n + (" " + str(d) if d else "")); bad += 0 if c else 1
hexrgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)
lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
for t, (ink, bone) in {"night": ("#0B0E20", "#DCD4BC"), "latte": ("#EFF1F5", "#4C4F69")}.items():
    conf = open(f"{D}/{t}/watcher.conf").read()
    img = re.findall(r"^image \{\n(.*?)^\}", conf, re.M | re.S)
    check(f"{t}: one eye image", len(img) == 1)
    check(f"{t}: the eye is a still (no reload_time, no reload_cmd, no frame helper)", "reload_time" not in img[0] and "reload_cmd" not in img[0] and "ito-lock-tick frame" not in conf)
    p = re.search(r"path = (\S+/eye\.png)", img[0]).group(1)
    res[t] = p
    a = np.asarray(Image.open(p).convert("RGBA"), float); px = np.median(a[a[..., 3] > 250][:, :3], axis=0)   # median: with lockTone sync the iris and the lid rim carry the accent, the solid strokes stay neutral
    want = hexrgb(bone if lum(hexrgb(bone)) >= lum(hexrgb(ink)) else ink)
    check(f"{t}: the eye's lines are the lighter of the theme's ink/bone", np.abs(px - want).max() < 1.5, px.round().tolist())
    m = json.load(open(f"{D}/{t}/watcher.model.json"))
    ey = [w for w in m["screens"][0]["widgets"] if w.get("role") == "eye"][0]
    check(f"{t}: the model carries the iris disc and motion", m.get("motion") in (0, 1) and (ey.get("spin") or {}).get("period") == 48, ey.get("spin"))
    check(f"{t}: the model's colours are the theme's tokens", m["colours"]["ink"]["hex"].lower() == ink.lower() and m["colours"]["bone"]["hex"].lower() == bone.lower())
check("theme change: the two eyes are different files", res["night"] != res["latte"])
a = np.asarray(Image.open(res["night"]).convert("RGB"), float); b = np.asarray(Image.open(res["latte"]).convert("RGB"), float)
check("theme change: the two eyes differ in colour", np.abs(a.mean((0, 1)) - b.mean((0, 1))).max() > 5)
sys.exit(1 if bad else 0)
PY
grep -rq 'ito-lock-theme-set\|60-ito-lock' "$REPO/bar/modules/bin/ito-lock" && grep -q '"\$tool" apply' "$(grep -rl 'regenerates the themed lock screen' "$REPO" --include=*.sh 2>/dev/null | head -1)" \
  && ok "theme-set hook runs 'ito-lock apply' (no design flag): it regenerates the watcher still and the Quickshell model" || bad "theme-set hook does not run ito-lock apply"
exit $fail
