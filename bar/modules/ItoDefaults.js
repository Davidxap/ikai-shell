.pragma library

// GENERATED from ito-defaults.json by scripts/gen-defaults-js.py (do not edit the table by hand: scripts/qa/defaults.test.mjs compares them).
// The defaults registry as the control centre sees it: what each sidecar key means when unset, and which page/section shows it, so a control
// can say "this is not the default" and a section/page can offer one reset (ito-config reset --section/--page).

var DATA = {
 "accentCustom": {
  "default": "#c4162a",
  "keep": true,
  "kind": "string",
  "page": "colors",
  "section": "ACCENT"
 },
 "accentSource": {
  "default": "accent",
  "keep": true,
  "kind": "enum",
  "page": "colors",
  "section": "ACCENT"
 },
 "aiStyle": {
  "default": "brain",
  "kind": "enum",
  "page": "widgets",
  "section": "AI USAGE ICON"
 },
 "barFloat": {
  "default": false,
  "kind": "bool",
  "page": "bars",
  "section": "POSITION"
 },
 "barGap": {
  "default": "normal",
  "kind": "enum",
  "page": "bars",
  "section": "DETAILS"
 },
 "barRadius": {
  "default": "round",
  "kind": "enum",
  "page": "bars",
  "section": "DETAILS"
 },
 "barShadow": {
  "default": false,
  "kind": "bool",
  "page": "bars",
  "section": "DETAILS"
 },
 "barSize": {
  "default": "46",
  "kind": "enum",
  "page": "bars",
  "section": "DETAILS"
 },
 "beetleDef": {
  "default": "",
  "kind": "enum",
  "page": "hidden",
  "section": "-"
 },
 "blood": {
  "default": "#651817",
  "keep": true,
  "kind": "string",
  "page": "hidden",
  "section": "-"
 },
 "bloodLive": {
  "default": "#c4162a",
  "keep": true,
  "kind": "string",
  "page": "hidden",
  "section": "-"
 },
 "bloodSeep": {
  "default": false,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "bootCaption": {
  "default": "",
  "kind": "string",
  "page": "sysart",
  "section": "BOOT"
 },
 "bootComposition": {
  "default": "eye-shut",
  "kind": "enum",
  "page": "sysart",
  "section": "BOOT"
 },
 "bootFrame": {
  "default": "ring",
  "kind": "enum",
  "page": "sysart",
  "section": "BOOT"
 },
 "bootSize": {
  "default": 320,
  "kind": "int",
  "page": "sysart",
  "section": "BOOT"
 },
 "bootSource": {
  "default": "slot",
  "kind": "enum",
  "page": "sysart",
  "section": "BOOT"
 },
 "bootTone": {
  "default": "tint",
  "kind": "enum",
  "page": "sysart",
  "section": "BOOT"
 },
 "bootUi": {
  "default": "bone",
  "kind": "enum",
  "page": "sysart",
  "section": "BOOT"
 },
 "calendarHolidays": {
  "default": true,
  "kind": "bool",
  "page": "widgets",
  "section": "CLOCK & CALENDAR"
 },
 "calendarWeekNumbers": {
  "default": true,
  "kind": "bool",
  "page": "widgets",
  "section": "CLOCK & CALENDAR"
 },
 "calendarWeekStart": {
  "default": "locale",
  "kind": "enum",
  "page": "widgets",
  "section": "CLOCK & CALENDAR"
 },
 "calendarZones": {
  "default": "",
  "kind": "string",
  "page": "widgets",
  "section": "CLOCK & CALENDAR"
 },
 "ccMotion": {
  "default": true,
  "kind": "bool",
  "page": "hidden",
  "section": "-"
 },
 "clockDate": {
  "default": "off",
  "kind": "enum",
  "page": "widgets",
  "section": "CLOCK & CALENDAR"
 },
 "clockHour12": {
  "default": false,
  "kind": "bool",
  "page": "widgets",
  "section": "CLOCK & CALENDAR"
 },
 "clockMoon": {
  "default": false,
  "kind": "bool",
  "page": "widgets",
  "section": "CLOCK & CALENDAR"
 },
 "clockNumerals": {
  "default": "western",
  "kind": "enum",
  "page": "widgets",
  "section": "CLOCK & CALENDAR"
 },
 "clockSeconds": {
  "default": false,
  "kind": "bool",
  "page": "widgets",
  "section": "CLOCK & CALENDAR"
 },
 "clockTick": {
  "default": false,
  "kind": "bool",
  "page": "widgets",
  "section": "CLOCK & CALENDAR"
 },
 "colorMode": {
  "default": "theme",
  "keep": true,
  "kind": "enum",
  "page": "colors",
  "section": "PALETTE"
 },
 "content:*": {
  "default": null,
  "keep": true,
  "kind": "string",
  "page": "widgets",
  "section": "INDICATOR ICONS"
 },
 "crestEye": {
  "default": "auto",
  "kind": "enum",
  "page": "hidden",
  "section": "-"
 },
 "debugAnchor": {
  "default": false,
  "kind": "bool",
  "page": "hidden",
  "section": "-"
 },
 "debugFrames": {
  "default": false,
  "kind": "bool",
  "page": "hidden",
  "section": "-"
 },
 "designShape": {
  "default": "keep",
  "kind": "enum",
  "page": "shells",
  "section": "PROFILES"
 },
 "dockFloat": {
  "default": true,
  "kind": "bool",
  "page": "bars",
  "section": "POSITION"
 },
 "elevation": {
  "default": "flat",
  "kind": "enum",
  "page": "hidden",
  "section": "-"
 },
 "eyeArt": {
  "default": "asset",
  "kind": "enum",
  "page": "hidden",
  "section": "-"
 },
 "eyeMotion": {
  "default": "subtle",
  "kind": "enum",
  "page": "styles",
  "section": "EYES"
 },
 "eyeStyle": {
  "default": "shaded",
  "kind": "enum",
  "page": "styles",
  "section": "EYES"
 },
 "eyeWsCrop": {
  "default": "tight",
  "kind": "enum",
  "page": "workspaces",
  "section": "STYLE"
 },
 "eyeWsIris": {
  "default": "spiral",
  "kind": "enum",
  "page": "workspaces",
  "section": "STYLE"
 },
 "fastfetchLayout": {
  "default": "image",
  "keep": true,
  "kind": "enum",
  "page": "sysart",
  "section": "FETCH"
 },
 "fastfetchTheme": {
  "default": false,
  "keep": true,
  "kind": "bool",
  "mirror": true,
  "page": "sysart",
  "section": "SYSTEM"
 },
 "fetchFrame": {
  "default": "off",
  "kind": "enum",
  "page": "sysart",
  "section": "FETCH"
 },
 "fetchFrameTitle": {
  "default": null,
  "kind": "string",
  "page": "sysart",
  "section": "FETCH"
 },
 "fetchLogo": {
  "default": "",
  "kind": "enum",
  "page": "sysart",
  "section": "FETCH"
 },
 "fetchOrnaments": {
  "default": "ito",
  "kind": "enum",
  "page": "sysart",
  "section": "FETCH"
 },
 "fetchPicture": {
  "default": "photo",
  "kind": "enum",
  "page": "sysart",
  "section": "FETCH"
 },
 "fetchPicturePolarity": {
  "default": "auto",
  "kind": "enum",
  "page": "sysart",
  "section": "FETCH"
 },
 "fetchStyle": {
  "default": "ito",
  "kind": "enum",
  "page": "sysart",
  "section": "FETCH"
 },
 "formParity": {
  "default": true,
  "kind": "bool",
  "page": "bars",
  "section": "SHAPE"
 },
 "frameArt": {
  "default": "png",
  "kind": "enum",
  "page": "styles",
  "section": "FRAME"
 },
 "frameStyle": {
  "default": "manga",
  "kind": "enum",
  "page": "styles",
  "section": "FRAME"
 },
 "fxBlood": {
  "default": false,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "fxBorder": {
  "default": true,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "fxCalm": {
  "default": true,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "fxCustomVer": {
  "default": 0,
  "keep": true,
  "kind": "int",
  "page": "hidden",
  "section": "-"
 },
 "fxFog": {
  "default": false,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "fxFogDrift": {
  "default": false,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "fxGlass": {
  "default": false,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "fxGrain": {
  "default": true,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "fxMark": {
  "default": "auto",
  "kind": "enum",
  "page": "effects",
  "section": "MENU MARK"
 },
 "fxPaper": {
  "default": false,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "fxPills": {
  "default": false,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "fxPlate": {
  "default": true,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "fxSeal": {
  "default": "none",
  "kind": "enum",
  "page": "effects",
  "section": "SEAL"
 },
 "fxSpeed": {
  "default": 1,
  "kind": "float",
  "page": "effects",
  "section": "LIGHT"
 },
 "fxStrength": {
  "default": 1,
  "kind": "float",
  "page": "effects",
  "section": "LIGHT"
 },
 "fxTone": {
  "default": false,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "fxTorn": {
  "default": false,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "fxVeins": {
  "default": "none",
  "kind": "enum",
  "page": "effects",
  "section": "SEAL DECORATION"
 },
 "fxWhen": {
  "default": "hover",
  "kind": "enum",
  "page": "effects",
  "section": "WHEN"
 },
 "fxWood": {
  "default": false,
  "kind": "bool",
  "page": "bars",
  "section": "LOOK"
 },
 "icon:*": {
  "default": null,
  "keep": true,
  "kind": "string",
  "page": "widgets",
  "section": "ICONS"
 },
 "icon:clock": {
  "default": null,
  "keep": true,
  "kind": "string",
  "page": "widgets",
  "section": "ICONS"
 },
 "icon:nightlight": {
  "default": null,
  "keep": true,
  "kind": "string",
  "page": "widgets",
  "section": "ICONS"
 },
 "icon:notifications": {
  "default": null,
  "keep": true,
  "kind": "string",
  "page": "widgets",
  "section": "ICONS"
 },
 "icon:power": {
  "default": null,
  "keep": true,
  "kind": "string",
  "page": "widgets",
  "section": "ICONS"
 },
 "iconOmens": {
  "default": true,
  "kind": "bool",
  "page": "hidden",
  "section": "-"
 },
 "iconScale": {
  "default": 0.62,
  "kind": "float",
  "page": "widgets",
  "section": "READINGS"
 },
 "iconStyle": {
  "default": "current",
  "kind": "enum",
  "page": "widgets",
  "section": "ICON DRAWING"
 },
 "iconStyleOverrides": {
  "default": "",
  "kind": "string",
  "page": "widgets",
  "section": "ICONS"
 },
 "iconTone": {
  "default": "theme",
  "kind": "enum",
  "page": "widgets",
  "section": "ICON DRAWING"
 },
 "idleScreensaver": {
  "default": false,
  "keep": true,
  "kind": "bool",
  "mirror": true,
  "page": "sysart",
  "section": "SYSTEM"
 },
 "light": {
  "default": 1,
  "kind": "float",
  "page": "effects",
  "section": "LIGHT"
 },
 "lockBg": {
  "default": "engraved",
  "kind": "enum",
  "page": "sysart",
  "section": "LOCK"
 },
 "lockDesign": {
  "default": "fog",
  "keep": true,
  "kind": "enum",
  "page": "sysart",
  "section": "LOCK"
 },
 "lockEngine": {
  "default": "",
  "keep": true,
  "kind": "enum",
  "page": "sysart",
  "section": "LOCK"
 },
 "lockTheme": {
  "default": false,
  "keep": true,
  "kind": "bool",
  "mirror": true,
  "page": "sysart",
  "section": "SYSTEM"
 },
 "lockTone": {
  "default": "sync",
  "kind": "enum",
  "page": "sysart",
  "section": "LOCK"
 },
 "loreLevel": {
  "default": "off",
  "kind": "enum",
  "page": "styles",
  "section": "LORE"
 },
 "markDef": {
  "default": "v9",
  "kind": "enum",
  "page": "hidden",
  "section": "-"
 },
 "markHdTiers": {
  "default": false,
  "kind": "bool",
  "page": "logo",
  "section": "MENU MARK"
 },
 "markScale": {
  "default": 0.65,
  "kind": "float",
  "page": "logo",
  "section": "MENU MARK"
 },
 "marksVer": {
  "default": 0,
  "keep": true,
  "kind": "int",
  "page": "hidden",
  "section": "-"
 },
 "mediaFx": {
  "default": "blood",
  "kind": "enum",
  "page": "effects",
  "section": "MEDIA"
 },
 "menuMark": {
  "default": "spiral",
  "kind": "enum",
  "page": "logo",
  "section": "MENU MARK"
 },
 "motion": {
  "default": "calm",
  "kind": "enum",
  "page": "effects",
  "section": "MOTION"
 },
 "motionScope": {
  "default": "ito",
  "kind": "enum",
  "page": "effects",
  "section": "MOTION"
 },
 "netIcon": {
  "default": "auto",
  "kind": "enum",
  "page": "widgets",
  "section": "NETWORK ICON"
 },
 "oneBar": {
  "default": true,
  "kind": "bool",
  "page": "hidden",
  "section": "-"
 },
 "openDuration": {
  "default": 900,
  "kind": "int",
  "page": "effects",
  "section": "OPENING SPEED"
 },
 "paletteGuard": {
  "default": false,
  "kind": "bool",
  "page": "hidden",
  "section": "-"
 },
 "panelFrame": {
  "default": true,
  "kind": "bool",
  "page": "styles",
  "section": "FRAME"
 },
 "popupSeconds": {
  "default": 3,
  "kind": "float",
  "page": "widgets",
  "section": "READINGS"
 },
 "presence": {
  "default": true,
  "kind": "bool",
  "page": "styles",
  "section": "OPENING"
 },
 "presenceReveal": {
  "default": "none",
  "kind": "enum",
  "page": "styles",
  "section": "OPENING"
 },
 "presenceShoulders": {
  "default": false,
  "kind": "bool",
  "page": "styles",
  "section": "OPENING"
 },
 "presenceSwitch": {
  "default": "morph",
  "kind": "enum",
  "page": "styles",
  "section": "OPENING"
 },
 "pressBleed": {
  "default": false,
  "kind": "bool",
  "page": "hidden",
  "section": "-"
 },
 "screensaverEffect": {
  "default": "random-ito",
  "kind": "enum",
  "page": "sysart",
  "section": "SCREENSAVER"
 },
 "screensaverFps": {
  "default": 120,
  "kind": "int",
  "page": "sysart",
  "section": "SCREENSAVER"
 },
 "screensaverGround": {
  "default": "ink",
  "kind": "enum",
  "page": "sysart",
  "section": "SCREENSAVER"
 },
 "screensaverPalette": {
  "default": "classic",
  "kind": "enum",
  "page": "sysart",
  "section": "SCREENSAVER"
 },
 "screensaverText": {
  "default": "spiral",
  "kind": "enum",
  "page": "sysart",
  "section": "SCREENSAVER"
 },
 "seal": {
  "default": "tomie",
  "kind": "enum",
  "page": "logo",
  "section": "SEAL"
 },
 "sealDeco": {
  "default": "veins",
  "kind": "enum",
  "page": "logo",
  "section": "SEAL DECORATION"
 },
 "sealLit": {
  "default": "auto",
  "kind": "enum",
  "page": "logo",
  "section": "SEAL"
 },
 "shPack": {
  "default": false,
  "kind": "bool",
  "page": "widgets",
  "section": "ICON DRAWING"
 },
 "showValues": {
  "default": true,
  "kind": "bool",
  "page": "widgets",
  "section": "READINGS"
 },
 "size": {
  "default": null,
  "kind": "int",
  "page": "hidden",
  "section": "-"
 },
 "style": {
  "default": "orbs",
  "kind": "enum",
  "page": "workspaces",
  "section": "STYLE"
 },
 "surfaceCalm": {
  "default": 0.4,
  "kind": "float",
  "page": "bars",
  "section": "LOOK"
 },
 "surfaceFog": {
  "default": 0.05,
  "kind": "float",
  "page": "bars",
  "section": "LOOK"
 },
 "surfaceGrain": {
  "default": 0.14,
  "kind": "float",
  "page": "bars",
  "section": "LOOK"
 },
 "surfaceLayering": {
  "default": "theme",
  "kind": "enum",
  "page": "hidden",
  "section": "-"
 },
 "surfaceOpacity": {
  "default": 1,
  "kind": "float",
  "page": "bars",
  "section": "LOOK"
 },
 "surfacePill": {
  "default": 0.78,
  "kind": "float",
  "page": "bars",
  "section": "LOOK"
 },
 "surfaceTone": {
  "default": 0.15,
  "kind": "float",
  "page": "bars",
  "section": "LOOK"
 },
 "surfaceVeins": {
  "default": 0.6,
  "kind": "float",
  "page": "bars",
  "section": "LOOK"
 },
 "surfaceWood": {
  "default": 0.26,
  "kind": "float",
  "page": "bars",
  "section": "LOOK"
 },
 "surfaceWorld": {
  "default": "off",
  "kind": "enum",
  "page": "bars",
  "section": "LOOK"
 },
 "tooltipBlood": {
  "default": false,
  "kind": "bool",
  "page": "bars",
  "section": "DETAILS"
 },
 "userAssets": {
  "default": true,
  "kind": "bool",
  "page": "hidden",
  "section": "-"
 },
 "valueLabels": {
  "default": true,
  "kind": "bool",
  "page": "widgets",
  "section": "READINGS"
 },
 "valueStyle": {
  "default": "percent",
  "kind": "enum",
  "page": "widgets",
  "section": "READINGS"
 },
 "vesselFill": {
  "default": "blood",
  "kind": "enum",
  "page": "styles",
  "section": "MEMORY LIQUID"
 },
 "vibrance": {
  "default": 1,
  "kind": "float",
  "page": "effects",
  "section": "LIGHT"
 },
 "weatherMinutes": {
  "default": null,
  "kind": "int",
  "page": "hidden",
  "section": "-"
 },
 "workspaceCount": {
  "default": 5,
  "kind": "int",
  "page": "workspaces",
  "section": "COUNT"
 },
 "workspaceShow": {
  "default": "count",
  "kind": "enum",
  "page": "workspaces",
  "section": "WHICH ONES"
 },
 "wsArtScale": {
  "default": null,
  "kind": "float",
  "page": "workspaces",
  "section": "WORKSPACE SIZE"
 },
 "wsBarArt": {
  "default": false,
  "kind": "bool",
  "page": "workspaces",
  "section": "STYLE"
 },
 "wsBeetleDef": {
  "default": "v9",
  "kind": "enum",
  "page": "workspaces",
  "section": "STYLE"
 },
 "wsCustomVer": {
  "default": 0,
  "keep": true,
  "kind": "int",
  "page": "hidden",
  "section": "-"
 },
 "wsHdTiers": {
  "default": false,
  "kind": "bool",
  "page": "workspaces",
  "section": "STYLE"
 }
}

function entry(key) {
  if (DATA[key]) return DATA[key]
  var i = String(key).indexOf(":")
  return i > 0 && DATA[key.slice(0, i + 1) + "*"] ? DATA[key.slice(0, i + 1) + "*"] : null
}
function same(a, b) { return String(a) === String(b) }
// `get(key, fallback)` is the shell config's (an unset or empty key answers the fallback)
function differs(key, get) {
  var e = entry(key)
  if (!e) return false
  var v = get(key, undefined)
  if (v === undefined) return false
  return e["default"] === null ? true : !same(v, e["default"])
}
// the keys a reset of this scope would touch: registry keys that are set to something else (families `icon:*` are matched on the stored keys)
function keysOf(page, section) {
  var out = []
  for (var k in DATA) {
    var e = DATA[k]
    if (e.page !== page || e.mirror) continue
    if (section !== undefined && section !== "" && e.section !== section) continue
    out.push(k)
  }
  return out
}
function stored(keys, get, values) {
  var out = []
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i]
    if (k.charAt(k.length - 1) === "*") {
      for (var s in values) if (s.indexOf(k.slice(0, -1)) === 0 && differs(s, get)) out.push(s)
    } else if (differs(k, get)) out.push(k)
  }
  return out
}
// the stored keys of a page / section that differ from the default (what the "Reset" affordance shows and sends)
function changed(page, section, get, values) { return stored(keysOf(page, section), get, values || {}) }
function isDefault(key, get) { return !differs(key, get) }

if (typeof module !== "undefined" && module.exports) module.exports = { DATA: DATA, entry: entry, differs: differs, keysOf: keysOf, changed: changed, isDefault: isDefault }
