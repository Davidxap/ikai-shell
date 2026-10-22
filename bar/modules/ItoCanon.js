.pragma library

// The canonical colours of the bar's plate (decisions-b9 section 2.1). The plate is painted in these three and ItoThemeEffect moves them
// onto the installed theme (black to the theme's background, bone to its foreground, crimson to its accent), so these are the only colour
// literals the plate and its shader need: nothing else in the plate names a colour.
var BONE = "#c7ccd1"
var INK = "#050607"
var BLOOD = "#c4162a"

// "#rrggbb" -> { r, g, b } in 0..1 (a value that is not a colour is mid grey, never NaN)
function rgb(hex) {
  var m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/.exec(String(hex))
  return m ? { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 } : { r: 0.5, g: 0.5, b: 0.5 }
}
function mix(a, b, t) { return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t } }

// Derived canonical tones (computed, never literal): metal, rust, and the neutral stain that stands for rust on a light theme
var iron = mix(rgb(INK), rgb(BONE), 0.34)
var rustC = mix(rgb(BLOOD), rgb(INK), 0.45)
var stain = mix(rgb(INK), rgb(BONE), 0.40)

if (typeof module !== "undefined" && module.exports) module.exports = { BONE: BONE, INK: INK, BLOOD: BLOOD, rgb: rgb, mix: mix, iron: iron, rustC: rustC, stain: stain }
