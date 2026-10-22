.pragma library

// D4, "not here": one table that says why an option does nothing in the bar's current shape (or with a layer it needs off).
// why(key, cfg, form) returns "" when the option applies, otherwise a one-line reason. The pages hand that string to `naReason`
// on CcToggle / CcCard / CcMeter / StyleCard, which dims the control, stops it and shows the line. Nothing is ever silently dead.
//
//   key   the sidecar key of the control (or "cutLeft" / "cutRight" for the two island cuts)
//   cfg   anything with get(key, fallback): the ItoConfig / panel palette
//   form  "shibumi" (Islands) | "full" | "fit" | "dock" | "notch"
//
// Pure: no QML, no imports, so a node test (scripts/qa/applies.test.mjs) walks every row in every form.

var FORMS = ["shibumi", "full", "fit", "dock", "notch"]

// What an unset flag means (mirrors ItoSurfaces.defaults for the keys used here).
var DEFAULT = { fxBorder: true, fxGrain: true, fxPills: false, fxBlood: false, bloodSeep: false, fxFog: false, formParity: true, dockFloat: true }

function flag(cfg, key) {
  var v = cfg.get(key, DEFAULT[key] === undefined ? false : DEFAULT[key])
  return v === true || v === "true" || v === 1
}

var PARITY = "Only in Islands (turn on form parity)."

function why(key, cfg, form) {
  if (FORMS.indexOf(form) < 0) form = "shibumi"
  var parity = flag(cfg, "formParity")
  switch (key) {
    case "cutLeft":
    case "cutRight":
      return form === "shibumi" ? "" : "Only the Islands shape can be cut."
    case "barRadius":
      return form === "full" ? "Full runs edge to edge: no corners." : ""
    case "barFloat":
      if (form === "full" || form === "fit" || form === "notch") return "This shape always touches the edge."
      if (form === "dock" && parity) return "The Dock has its own switch: Dock floats."
      return ""
    case "dockFloat":
      if (form !== "dock") return "Only the Dock floats on its own."
      return parity ? "" : "Needs form parity on."
    case "fxPills":
      return form === "shibumi" || parity ? "" : PARITY
    case "barShadow":
      if (form === "notch") return "The Notch draws no shadow."
      return form === "shibumi" || parity ? "" : PARITY
    case "fxTorn":
      return flag(cfg, "fxBorder") ? "" : "Needs Border on."
    case "fxFogDrift":
      return flag(cfg, "fxFog") ? "" : "Needs Fog on."
    case "bloodSeep":
      return flag(cfg, "fxBlood") ? "" : "Needs Blood on."
    case "surfaceVeins":
      return flag(cfg, "fxBlood") ? "" : "Needs Blood on."
    case "surfaceGrain":
      return flag(cfg, "fxGrain") ? "" : "Needs Grain on."
    case "surfacePill":
      if (!flag(cfg, "fxPills")) return "Needs Widget pills on."
      return why("fxPills", cfg, form)
  }
  return ""
}

// Every key the table knows, for the test.
var KEYS = ["cutLeft", "cutRight", "barRadius", "barFloat", "dockFloat", "fxPills", "barShadow", "fxTorn", "fxFogDrift", "bloodSeep", "surfaceVeins", "surfaceGrain", "surfacePill"]

if (typeof module !== "undefined") module.exports = { why: why, FORMS: FORMS, KEYS: KEYS, DEFAULT: DEFAULT }
