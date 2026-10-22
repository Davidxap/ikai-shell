#!/usr/bin/env bash
# ito-config against a COPY of the sidecar (ITO_STYLE_PATH): concurrent writers lose nothing, reset keeps the
# colours and the system-surface keys. Never touches the live ito-style.json.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CFG="$REPO/bar/modules/bin/ito-config"
DIR="$(mktemp -d)"; trap 'rm -rf "$DIR"' EXIT
export ITO_STYLE_PATH="$DIR/ito-style.json"
export ITO_BACKUP_DIR="$DIR/backups"    # S13f: a reset backs up first; the tests never write the real backups
LIVE="$HOME/.config/omarchy/bar/modules/ito-style.json"
if [[ -f $LIVE ]]; then cp "$LIVE" "$ITO_STYLE_PATH"; else echo '{}' > "$ITO_STYLE_PATH"; fi

N=30
for i in $(seq 1 $N); do "$CFG" set "zz$i" "v$i" & done
wait
missing=0
for i in $(seq 1 $N); do
  [[ "$("$CFG" get "zz$i")" == "v$i" ]] || { echo "LOST zz$i"; missing=$((missing + 1)); }
done
python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$ITO_STYLE_PATH"
[[ $missing -eq 0 ]] || { echo "FAIL: $missing of $N concurrent sets lost"; exit 1; }
echo "ok: $N concurrent sets, none lost"

"$CFG" setmany blood='#112233' lockTheme=true idleScreensaver=true fastfetchTheme=true lockDesign=lantern fastfetchLayout=compact fxGlass=true weatherMinutes=15
"$CFG" reset
for k in blood lockTheme idleScreensaver fastfetchTheme lockDesign fastfetchLayout; do
  [[ -n "$("$CFG" get "$k")" ]] || { echo "FAIL: reset dropped $k"; exit 1; }
done
[[ -z "$("$CFG" get fxGlass)" && -z "$("$CFG" get zz1)" ]] || { echo "FAIL: reset kept a look key"; exit 1; }
"$CFG" set fastfetchLayout bogus 2>/dev/null && { echo "FAIL: bad enum accepted"; exit 1; }
"$CFG" set eyeStyle bogus 2>/dev/null && { echo "FAIL: bad eyeStyle accepted"; exit 1; }
for v in shaded uzumaki lashed veined; do "$CFG" set eyeStyle $v || { echo "FAIL: eyeStyle $v refused"; exit 1; }; [[ "$("$CFG" get eyeStyle)" == $v ]] || { echo "FAIL: eyeStyle $v not stored"; exit 1; }; done
# S14: the old names are refused with the new one, and `migrate` rewrites a stored one (idempotent); the liquid's eye keys are retired
for v in ink gekiga real; do "$CFG" set eyeStyle $v 2>/dev/null && { echo "FAIL: legacy eyeStyle $v accepted"; exit 1; }; done
"$CFG" set vesselEyes true 2>/dev/null && { echo "FAIL: vesselEyes accepted"; exit 1; }
"$CFG" set vesselLayout ring 2>/dev/null && { echo "FAIL: vesselLayout accepted"; exit 1; }
"$CFG" set vesselFill bogus 2>/dev/null && { echo "FAIL: bad vesselFill accepted"; exit 1; }
for v in blood whirlpool hair rust static tone; do "$CFG" set vesselFill $v || { echo "FAIL: vesselFill $v refused"; exit 1; }; done
"$CFG" unset vesselFill
"$CFG" set fxMark pulse 2>/dev/null && { echo "FAIL: pulse accepted"; exit 1; }
"$CFG" set fxMark glitch 2>/dev/null && { echo "FAIL: glitch accepted"; exit 1; }
printf '{"eyeStyle":"real","vesselEyes":false,"vesselLayout":"ring","fxMark":"pulse","fxSeal":"glitch","mediaFx":"eyes"}\n' > "$ITO_STYLE_PATH"
"$CFG" migrate >/dev/null; [[ "$("$CFG" get eyeStyle)" == shaded && "$("$CFG" get fxMark)" == breathe && "$("$CFG" get fxSeal)" == tear && "$("$CFG" get mediaFx)" == blood && -z "$("$CFG" get vesselEyes)" ]] || { echo "FAIL: migrate"; exit 1; }
[[ -z "$("$CFG" migrate)" ]] || { echo "FAIL: migrate not idempotent"; exit 1; }
"$CFG" set crestEye bogus 2>/dev/null && { echo "FAIL: bad crestEye accepted"; exit 1; }
for v in auto heavy stare lidless spiral weeping poly slit; do "$CFG" set crestEye $v || { echo "FAIL: crestEye $v refused"; exit 1; }; done
"$CFG" unset crestEye
"$CFG" set eyeMotion bogus 2>/dev/null && { echo "FAIL: bad eyeMotion accepted"; exit 1; }
for v in off subtle full; do "$CFG" set eyeMotion $v || { echo "FAIL: eyeMotion $v refused"; exit 1; }; [[ "$("$CFG" get eyeMotion)" == $v ]] || { echo "FAIL: eyeMotion $v not stored"; exit 1; }; done
"$CFG" unset eyeMotion; [[ -z "$("$CFG" get eyeMotion)" ]] || { echo "FAIL: eyeMotion unset"; exit 1; }
"$CFG" unset eyeStyle; [[ -z "$("$CFG" get eyeStyle)" ]] || { echo "FAIL: eyeStyle unset"; exit 1; }
"$CFG" set iconStyle bogus 2>/dev/null && { echo "FAIL: bad iconStyle accepted"; exit 1; }
for v in current manga; do "$CFG" set iconStyle $v || { echo "FAIL: iconStyle $v refused"; exit 1; }; [[ "$("$CFG" get iconStyle)" == $v ]] || { echo "FAIL: iconStyle $v not stored"; exit 1; }; done
"$CFG" unset iconStyle; [[ -z "$("$CFG" get iconStyle)" ]] || { echo "FAIL: iconStyle unset"; exit 1; }
"$CFG" set iconStyle manga; "$CFG" reset; [[ -z "$("$CFG" get iconStyle)" ]] || { echo "FAIL: reset keeps iconStyle"; exit 1; }
"$CFG" set iconTone bogus 2>/dev/null && { echo "FAIL: bad iconTone accepted"; exit 1; }
for v in theme ink; do "$CFG" set iconTone $v || { echo "FAIL: iconTone $v refused"; exit 1; }; [[ "$("$CFG" get iconTone)" == $v ]] || { echo "FAIL: iconTone $v not stored"; exit 1; }; done
"$CFG" unset iconTone; [[ -z "$("$CFG" get iconTone)" ]] || { echo "FAIL: iconTone unset"; exit 1; }
"$CFG" set iconTone ink; "$CFG" reset; [[ -z "$("$CFG" get iconTone)" ]] || { echo "FAIL: reset keeps iconTone"; exit 1; }
"$CFG" set iconStyleOverrides "ai=bogus" 2>/dev/null && { echo "FAIL: bad iconStyleOverrides accepted"; exit 1; }
"$CFG" set iconStyleOverrides "nonsense=manga" 2>/dev/null && { echo "FAIL: unknown family accepted"; exit 1; }
"$CFG" set iconStyleOverrides "media=manga, ai = Current" || { echo "FAIL: iconStyleOverrides refused"; exit 1; }
[[ "$("$CFG" get iconStyleOverrides)" == "ai=current,media=manga" ]] || { echo "FAIL: iconStyleOverrides not normalised"; exit 1; }
"$CFG" unset iconStyleOverrides; [[ -z "$("$CFG" get iconStyleOverrides)" ]] || { echo "FAIL: iconStyleOverrides unset"; exit 1; }
"$CFG" set iconStyleOverrides "ai=current"; "$CFG" reset; [[ -z "$("$CFG" get iconStyleOverrides)" ]] || { echo "FAIL: reset keeps iconStyleOverrides"; exit 1; }
"$CFG" set iconOmens false || { echo "FAIL: iconOmens false refused"; exit 1; }; [[ "$("$CFG" get iconOmens)" == False ]] || { echo "FAIL: iconOmens not stored"; exit 1; }
"$CFG" unset iconOmens; [[ -z "$("$CFG" get iconOmens)" ]] || { echo "FAIL: iconOmens unset"; exit 1; }
"$CFG" set weatherMinutes 20; python3 -c "import json,os; assert json.load(open(os.environ['ITO_STYLE_PATH']))['weatherMinutes']==20"
echo "ok: reset keeps colours + system keys; enums and ints coerce"

# clock and calendar keys (ito-clock-calendar): enums refuse strangers, bools coerce, defaults-on toggle from true, zones verbatim
"$CFG" set clockDate weekday; [[ "$("$CFG" get clockDate)" == weekday ]] || { echo "FAIL: clockDate not stored"; exit 1; }
"$CFG" set clockDate x 2>/dev/null && { echo "FAIL: bad clockDate accepted"; exit 1; }
"$CFG" set clockNumerals roman 2>/dev/null && { echo "FAIL: bad clockNumerals accepted"; exit 1; }
"$CFG" set calendarWeekStart friday 2>/dev/null && { echo "FAIL: bad calendarWeekStart accepted"; exit 1; }
"$CFG" set calendarWeekStart saturday
"$CFG" set clockSeconds yes
python3 -c "import json,os; d=json.load(open(os.environ['ITO_STYLE_PATH'])); assert d['clockSeconds'] is True and d['calendarWeekStart']=='saturday', d"
"$CFG" unset calendarWeekNumbers
[[ "$("$CFG" toggle calendarWeekNumbers)" == false ]] || { echo "FAIL: calendarWeekNumbers did not toggle from its default (on)"; exit 1; }
"$CFG" set calendarZones 'Tokyo=Asia/Tokyo, NYC=America/New_York'
[[ "$("$CFG" get calendarZones)" == 'Tokyo=Asia/Tokyo, NYC=America/New_York' ]] || { echo "FAIL: calendarZones changed"; exit 1; }
echo "ok: clock and calendar keys validate and store"

# B3 keys: motionScope is an enum; fxFogDrift a bool (default off)
"$CFG" set motionScope all; [[ "$("$CFG" get motionScope)" == all ]] || { echo "FAIL: motionScope not stored"; exit 1; }
"$CFG" set motionScope wide 2>/dev/null && { echo "FAIL: bad motionScope accepted"; exit 1; }
"$CFG" set fxFogDrift yes
python3 -c "import json,os; d=json.load(open(os.environ['ITO_STYLE_PATH'])); assert d['fxFogDrift'] is True, d"
[[ "$("$CFG" toggle fxFogDrift)" == false ]] || { echo "FAIL: fxFogDrift did not toggle off"; exit 1; }
echo "ok: B3 keys (motionScope, fxFogDrift)"
# S8: openDuration is a number of ms, clamped to 150..2400 and snapped to 50
"$CFG" set openDuration 900; [[ "$("$CFG" get openDuration)" == 900 ]] || { echo "FAIL: openDuration not stored"; exit 1; }
"$CFG" set openDuration 5000; [[ "$("$CFG" get openDuration)" == 2400 ]] || { echo "FAIL: openDuration not clamped high"; exit 1; }
"$CFG" set openDuration 20; [[ "$("$CFG" get openDuration)" == 150 ]] || { echo "FAIL: openDuration not clamped low"; exit 1; }
"$CFG" set openDuration 1234; [[ "$("$CFG" get openDuration)" == 1250 ]] || { echo "FAIL: openDuration not snapped"; exit 1; }
"$CFG" set openDuration fast 2>/dev/null && { echo "FAIL: bad openDuration accepted"; exit 1; }
"$CFG" unset openDuration
echo "ok: openDuration validates, clamps and snaps"
"$CFG" set pressBleed true
python3 -c "import json,os; d=json.load(open(os.environ['ITO_STYLE_PATH'])); assert d['pressBleed'] is True, d"
"$CFG" unset pressBleed
echo "ok: B4 key (pressBleed)"
"$CFG" set formParity true; "$CFG" set dockFloat false
python3 -c "import json,os; d=json.load(open(os.environ['ITO_STYLE_PATH'])); assert d['formParity'] is True and d['dockFloat'] is False, d"
"$CFG" set formParity false
python3 -c "import json,os; d=json.load(open(os.environ['ITO_STYLE_PATH'])); assert d['formParity'] is False, d"
"$CFG" unset formParity; "$CFG" unset dockFloat
echo "ok: S13b keys (formParity, dockFloat)"
"$CFG" set wsBarArt true
python3 -c "import json,os; d=json.load(open(os.environ['ITO_STYLE_PATH'])); assert d['wsBarArt'] is True, d"
"$CFG" unset wsBarArt
echo "ok: bar-size art key (wsBarArt)"
"$CFG" set wsArtScale 0.85; "$CFG" set markScale 0.54
python3 -c "import json,os; d=json.load(open(os.environ['ITO_STYLE_PATH'])); assert d['wsArtScale'] == 0.85 and d['markScale'] == 0.54, d"
"$CFG" set wsArtScale 0.5 >/dev/null; "$CFG" unset wsArtScale; "$CFG" unset markScale
echo "ok: fit size keys (wsArtScale, markScale)"
"$CFG" set markDef bogus 2>/dev/null && { echo "FAIL: bad markDef accepted"; exit 1; }
for v in v9 v10; do "$CFG" set markDef $v || { echo "FAIL: markDef $v refused"; exit 1; }; [[ "$("$CFG" get markDef)" == $v ]] || { echo "FAIL: markDef $v not stored"; exit 1; }; done
"$CFG" unset markDef; [[ -z "$("$CFG" get markDef)" ]] || { echo "FAIL: markDef unset"; exit 1; }
"$CFG" set markScale 0.9; "$CFG" unset markScale; [[ "$("$CFG" get markScale 0.65)" == 0.65 ]] || { echo "FAIL: unset markScale is not the 0.65 default"; exit 1; }
"$CFG" set markDef v10; "$CFG" reset; [[ -z "$("$CFG" get markDef)" ]] || { echo "FAIL: reset keeps markDef"; exit 1; }
echo "ok: S15 keys (markDef v9|v10, markScale default 0.65 after unset)"
"$CFG" set presence true
"$CFG" set presenceReveal lid
"$CFG" set presenceSwitch morph
"$CFG" set presenceShoulders true
python3 -c "import json,os; d=json.load(open(os.environ['ITO_STYLE_PATH'])); assert d['presence'] is True and d['presenceReveal']=='lid' and d['presenceSwitch']=='morph' and d['presenceShoulders'] is True, d"
if "$CFG" set presenceReveal bogus >/dev/null 2>&1; then echo "FAIL: bogus presenceReveal accepted"; exit 1; fi
for k in presence presenceReveal presenceSwitch presenceShoulders; do "$CFG" unset $k; done
for k in barDecor gapThread; do
  if "$CFG" set $k none >/dev/null 2>&1; then echo "FAIL: retired $k accepted"; exit 1; fi
  if "$CFG" setmany $k=none >/dev/null 2>&1; then echo "FAIL: retired $k accepted by setmany"; exit 1; fi
  "$CFG" get $k >/dev/null
done
echo "ok: barDecor/gapThread refused (retired)"
"$CFG" set frameArt drawn; "$CFG" set frameStyle manga
python3 -c "import json,os; d=json.load(open(os.environ['ITO_STYLE_PATH'])); assert d['frameArt']=='drawn' and d['frameStyle']=='manga', d"
if "$CFG" set frameArt bogus >/dev/null 2>&1; then echo "FAIL: bogus frameArt accepted"; exit 1; fi
for v in chains otherworld minimal manga; do "$CFG" set frameStyle $v; done
if "$CFG" set frameStyle bogus >/dev/null 2>&1; then echo "FAIL: bogus frameStyle accepted"; exit 1; fi
for v in fog rust cage off; do "$CFG" set surfaceWorld $v; done
if "$CFG" set surfaceWorld flesh >/dev/null 2>&1; then echo "FAIL: the retired flesh world accepted"; exit 1; fi
if "$CFG" set surfaceWorld bogus >/dev/null 2>&1; then echo "FAIL: bogus surfaceWorld accepted"; exit 1; fi
"$CFG" unset surfaceWorld
for k in frameArt frameStyle; do "$CFG" unset $k; done
echo "ok: B8 keys (frameStyle, frameArt), B10 key (surfaceWorld)"
echo "ok: B5/B6 keys (presence*)"

# S2c: marksVer is an int, the one-shot mark rename runs once and never re-maps the new `remina`, and a reset keeps marksVer
"$CFG" reset; "$CFG" set menuMark remina; "$CFG" unset marksVer
[[ "$("$CFG" migrate-marks)" == "remina-ink" ]] || { echo "FAIL: migrate-marks remina"; exit 1; }
python3 -c "import json,os; d=json.load(open(os.environ['ITO_STYLE_PATH'])); assert d['marksVer'] == 2 and isinstance(d['marksVer'], int) and d['menuMark'] == 'remina-ink', d"
"$CFG" set menuMark remina
[[ "$("$CFG" migrate-marks)" == "remina" ]] || { echo "FAIL: migrate-marks ran twice"; exit 1; }
"$CFG" reset; [[ "$("$CFG" get marksVer)" == "2" ]] || { echo "FAIL: reset dropped marksVer"; exit 1; }
"$CFG" unset marksVer; "$CFG" set menuMark user:remina-real; "$CFG" migrate-marks >/dev/null
[[ "$("$CFG" get menuMark)" == "remina" ]] || { echo "FAIL: user:remina-real not migrated"; exit 1; }
"$CFG" reset >/dev/null; "$CFG" unset marksVer
echo "ok: marksVer one-shot mark migration"

# S15c: the alternative-definition key of the Uzumaki Eye workspace family accepts its enum and refuses anything else
"$CFG" set eyeWsIris plain >/dev/null
[[ "$("$CFG" get eyeWsIris)" == "plain" ]] || { echo "FAIL: eyeWsIris not stored"; exit 1; }
if "$CFG" set eyeWsIris bogus >/dev/null 2>&1; then echo "FAIL: eyeWsIris accepted a bad value"; exit 1; fi
"$CFG" unset eyeWsIris >/dev/null
echo "ok: S15c key (eyeWsIris)"
# the Silent Hill workspace families were removed: their keys are retired (set refused)
for k in shMicro shSymbolsAlt; do if "$CFG" set "$k" art >/dev/null 2>&1; then echo "FAIL: retired key $k accepted"; exit 1; fi; done
echo "ok: shMicro / shSymbolsAlt are retired"
# S16: packUndo (the "Back to before the pack" snapshot) is retired: set/setmany refused, a stored one is dropped by migrate
if "$CFG" set packUndo '{}' >/dev/null 2>&1; then echo "FAIL: retired packUndo accepted"; exit 1; fi
if "$CFG" setmany packUndo='{}' >/dev/null 2>&1; then echo "FAIL: retired packUndo accepted by setmany"; exit 1; fi
echo '{"packUndo": "{}", "shPack": true}' > "$ITO_STYLE_PATH"
"$CFG" migrate >/dev/null
python3 -c "import json,os; d=json.load(open(os.environ['ITO_STYLE_PATH'])); assert 'packUndo' not in d and d['shPack'] is True, d"
"$CFG" reset >/dev/null
echo "ok: packUndo is retired and migrated away"

# S18: iconStyle gothic, per-icon gothic overrides ; a bad value is refused; wsBanners is retired
"$CFG" set iconStyle gothic >/dev/null; "$CFG" set iconStyleOverrides "ai=gothic,network=current" >/dev/null
[[ "$("$CFG" get iconStyle)" == "gothic" && "$("$CFG" get iconStyleOverrides)" == "network=current,ai=gothic" ]] || { echo "FAIL: S18 keys not stored"; exit 1; }
if "$CFG" set iconStyle bogus >/dev/null 2>&1 || "$CFG" set wsBanners gothic >/dev/null 2>&1 || "$CFG" set iconStyleOverrides "ai=bogus" >/dev/null 2>&1; then echo "FAIL: S18 keys accepted a bad value"; exit 1; fi
"$CFG" unset iconStyle >/dev/null; "$CFG" unset iconStyleOverrides >/dev/null
echo "ok: S18 keys (iconStyle gothic, gothic overrides, wsBanners retired)"
# Symbols: the workspace style `gothic` migrates to its new id `symbols` (idempotent); `symbols` is stored as is
"$CFG" set style gothic >/dev/null; [[ "$("$CFG" migrate)" == "style gothic -> symbols" && "$("$CFG" get style)" == symbols && -z "$("$CFG" migrate)" ]] || { echo "FAIL: style gothic -> symbols"; exit 1; }
"$CFG" unset style >/dev/null
echo "ok: style gothic -> symbols"
# S17: eyeWsCrop tight|wide, beetleDef v12|v10|v9
for kv in "eyeWsCrop wide" "eyeWsCrop tight" "beetleDef v12" "beetleDef v10" "beetleDef v9"; do
  set -- $kv; "$CFG" set "$1" "$2" >/dev/null || { echo "FAIL: $1 $2 refused"; exit 1; }; [[ "$("$CFG" get "$1")" == "$2" ]] || { echo "FAIL: $1 $2 not stored"; exit 1; }
done
for kv in "eyeWsCrop bogus" "beetleDef v11"; do
  set -- $kv; if "$CFG" set "$1" "$2" >/dev/null 2>&1; then echo "FAIL: $1 accepted $2"; exit 1; fi
done
for k in eyeWsCrop beetleDef; do "$CFG" unset "$k" >/dev/null; done
for k in wsHdTiers markHdTiers; do
  "$CFG" set "$k" true >/dev/null && [[ "$("$CFG" get "$k")" == "True" || "$("$CFG" get "$k")" == "true" ]] || { echo "FAIL: $k not stored"; exit 1; }
  "$CFG" set "$k" bogus >/dev/null 2>&1 && true; "$CFG" unset "$k" >/dev/null
done
echo "ok: S17 keys (eyeWsCrop, beetleDef)"
# S17e: shPack is a bool, off when unset, and a reset drops it
[[ -z "$("$CFG" get shPack)" ]] || { echo "FAIL: shPack set by default"; exit 1; }
"$CFG" set shPack on >/dev/null; [[ "$("$CFG" get shPack)" == "True" ]] || { echo "FAIL: shPack not stored"; exit 1; }
"$CFG" reset >/dev/null; [[ -z "$("$CFG" get shPack)" ]] || { echo "FAIL: reset keeps shPack"; exit 1; }
for n in notifications clock nightlight power; do
  "$CFG" set "icon:$n" sh >/dev/null; [[ "$("$CFG" get "icon:$n")" == "sh" ]] || { echo "FAIL: icon:$n not stored"; exit 1; }
  "$CFG" set "icon:$n" original >/dev/null; [[ "$("$CFG" get "icon:$n")" == "original" ]] || { echo "FAIL: icon:$n original"; exit 1; }
  if "$CFG" set "icon:$n" bogus >/dev/null 2>&1; then echo "FAIL: icon:$n accepted bogus"; exit 1; fi
  "$CFG" unset "icon:$n" >/dev/null; [[ -z "$("$CFG" get "icon:$n")" ]] || { echo "FAIL: icon:$n unset"; exit 1; }
done
echo "ok: S17e key (shPack) + per-icon choices"
# T15 (S21): the media cassette skin is retired (set refused, a stored one dropped by migrate); the indicator versions are enums
if "$CFG" set icon:media sh >/dev/null 2>&1; then echo "FAIL: retired icon:media accepted"; exit 1; fi
if "$CFG" setmany icon:media=original >/dev/null 2>&1; then echo "FAIL: retired icon:media accepted by setmany"; exit 1; fi
echo '{"icon:media": "sh", "icon:record": "cassette"}' > "$ITO_STYLE_PATH"
"$CFG" migrate >/dev/null
python3 -c "import json,os; d=json.load(open(os.environ['ITO_STYLE_PATH'])); assert 'icon:media' not in d and d['icon:record'] == 'cassette', d"
for kv in awake:coffee awake:radio awake:flashlight awake:cup night:moon night:fog record:eye record:tape record:cassette; do
  "$CFG" set "icon:${kv%%:*}" "${kv#*:}" >/dev/null || { echo "FAIL: icon:${kv%%:*} ${kv#*:} refused"; exit 1; }
done
if "$CFG" set icon:awake bogus >/dev/null 2>&1 || "$CFG" set icon:night cassette >/dev/null 2>&1; then echo "FAIL: an indicator version accepted a bad value"; exit 1; fi
"$CFG" setmany "iconStyleOverrides=audio=current,display=manga" icon:notifications=original icon:awake=coffee >/dev/null || { echo "FAIL: the chooser's setmany refused"; exit 1; }
[[ "$("$CFG" get iconStyleOverrides)" == "audio=current,display=manga" && "$("$CFG" get icon:awake)" == coffee ]] || { echo "FAIL: the chooser's setmany not stored"; exit 1; }
echo "ok: T15 icon:media retired, indicator versions validated, the chooser's setmany"


# S13e/D3: a stored `surfaceWorld flesh` migrates to Blood + Blood seep (veins never lowered), idempotent; live `off` is a no-op
printf '{"surfaceWorld":"flesh","surfaceVeins":0.2}\n' > "$ITO_STYLE_PATH"
"$CFG" migrate >/dev/null
[[ -z "$("$CFG" get surfaceWorld)" && "$("$CFG" get fxBlood)" == "True" && "$("$CFG" get bloodSeep)" == "True" && "$("$CFG" get surfaceVeins)" == "0.45" ]] || { echo "FAIL: flesh migration"; exit 1; }
[[ -z "$("$CFG" migrate)" ]] || { echo "FAIL: flesh migration not idempotent"; exit 1; }
printf '{"surfaceWorld":"off"}\n' > "$ITO_STYLE_PATH"; [[ -z "$("$CFG" migrate)" && "$("$CFG" get surfaceWorld)" == "off" ]] || { echo "FAIL: migrate touched an off world"; exit 1; }
"$CFG" toggle bloodSeep >/dev/null; [[ "$("$CFG" get bloodSeep)" == "True" ]] || { echo "FAIL: bloodSeep toggle"; exit 1; }
echo "ok: flesh -> Blood seep migration"

# S9: the HD `tomie` menu mark left the picker: a stored tomie / user:tomie-classic reads as tomie-classic; the workspace style `tomie` is untouched
printf '{"menuMark":"tomie","style":"tomie"}\n' > "$ITO_STYLE_PATH"; "$CFG" migrate >/dev/null
[[ "$("$CFG" get menuMark)" == "tomie-classic" && "$("$CFG" get style)" == "tomie" ]] || { echo "FAIL: menuMark tomie -> tomie-classic"; exit 1; }
printf '{"menuMark":"user:tomie-classic"}\n' > "$ITO_STYLE_PATH"; "$CFG" migrate >/dev/null
[[ "$("$CFG" get menuMark)" == "tomie-classic" ]] || { echo "FAIL: menuMark user:tomie-classic -> tomie-classic"; exit 1; }
printf '{"menuMark":"pyramid-head"}\n' > "$ITO_STYLE_PATH"; [[ -z "$("$CFG" migrate)" && "$("$CFG" get menuMark)" == "pyramid-head" ]] || { echo "FAIL: migrate touched pyramid-head"; exit 1; }
echo "ok: menuMark tomie -> tomie-classic"

# S13f: registry, scoped resets, backup + restore round trip
printf '{"fxGlass":true,"fxGrain":false,"surfaceWorld":"rust","eyeMotion":"full","accentCustom":"#123456","colorMode":"custom","icon:awake":"coffee","content:x":"y","lockTheme":true,"zz":1}\n' > "$ITO_STYLE_PATH"
[[ "$("$CFG" defaults | grep -c .)" -gt 100 ]] || { echo "FAIL: defaults registry empty"; exit 1; }
"$CFG" defaults --page bars --json | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['fxGrain']['default'] is True and d['fxGlass']['page']=='bars'"
"$CFG" reset --key fxGlass >/dev/null; [[ -z "$("$CFG" get fxGlass)" && -n "$("$CFG" get fxGrain)" ]] || { echo "FAIL: reset --key"; exit 1; }
"$CFG" reset --section bars/LOOK >/dev/null; [[ -z "$("$CFG" get fxGrain)" && -z "$("$CFG" get surfaceWorld)" && -n "$("$CFG" get eyeMotion)" ]] || { echo "FAIL: reset --section"; exit 1; }
"$CFG" set fxGlass true; "$CFG" reset --page styles >/dev/null; [[ -z "$("$CFG" get eyeMotion)" && "$("$CFG" get fxGlass)" == "True" ]] || { echo "FAIL: reset --page"; exit 1; }
# --all keeps colours, mirrors and the user's own content; unknown keys go; every reset left a backup that restores
"$CFG" set eyeMotion full; "$CFG" set lockTheme true
"$CFG" reset --all >/dev/null
[[ -z "$("$CFG" get fxGlass)" && -z "$("$CFG" get zz)" && -n "$("$CFG" get accentCustom)" && -n "$("$CFG" get colorMode)" && -n "$("$CFG" get icon:awake)" && -n "$("$CFG" get content:x)" && -n "$("$CFG" get lockTheme)" ]] || { echo "FAIL: reset --all keep set"; exit 1; }
[[ "$("$CFG" backups | wc -l)" -ge 4 ]] || { echo "FAIL: resets did not back up"; exit 1; }
"$CFG" restore >/dev/null; [[ "$("$CFG" get fxGlass)" == "True" && "$("$CFG" get zz)" == "1" ]] || { echo "FAIL: restore of the last backup"; exit 1; }
"$CFG" reset --page widgets >/dev/null; [[ -z "$("$CFG" get icon:awake)" && -z "$("$CFG" get content:x)" ]] || { echo "FAIL: reset --page widgets keeps icon:* / content:*"; exit 1; }
"$CFG" reset --key lockTheme >/dev/null; [[ -z "$("$CFG" get lockTheme)" ]] || { echo "FAIL: reset --key on a mirror"; exit 1; }
before=$("$CFG" backups | wc -l); "$CFG" reset --key fxGlass nonexistent >/dev/null; "$CFG" reset --key nonexistent >/dev/null
[[ "$("$CFG" backups | wc -l)" -le $((before + 1)) ]] || { echo "FAIL: a no-op reset wrote a backup"; exit 1; }
"$CFG" reset --bogus 2>/dev/null && { echo "FAIL: bad reset form accepted"; exit 1; }
echo "ok: S13f registry, reset --key/--section/--page/--all, backup + restore"
# S24: the visible names are accepted and stored as the existing ids (old settings keep working)
"$CFG" set iconStyle relic >/dev/null && [[ "$("$CFG" get iconStyle)" == gothic ]] || { echo "FAIL: iconStyle relic -> gothic"; exit 1; }
"$CFG" set iconStyle ink >/dev/null && [[ "$("$CFG" get iconStyle)" == manga ]] || { echo "FAIL: iconStyle ink -> manga"; exit 1; }
"$CFG" set icon:clock hollow >/dev/null && [[ "$("$CFG" get icon:clock)" == sh ]] || { echo "FAIL: icon:clock hollow -> sh"; exit 1; }
"$CFG" set iconStyleOverrides "ai=relic" >/dev/null && [[ "$("$CFG" get iconStyleOverrides)" == "ai=gothic" ]] || { echo "FAIL: overrides relic -> gothic"; exit 1; }
"$CFG" set iconStyle manga >/dev/null && [[ "$("$CFG" get iconStyle)" == manga ]] || { echo "FAIL: the old id manga"; exit 1; }
"$CFG" unset iconStyle >/dev/null; "$CFG" unset icon:clock >/dev/null; "$CFG" unset iconStyleOverrides >/dev/null
echo "ok: S24 Ink / Relic / Hollow aliases"
