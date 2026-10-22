.pragma library

// The registry of popup frame styles and bar ornaments (ito-panel-presence/frame-styles.md section 10). Pure: the frame loads the
// style file this names, the selectors read the names and notes. A style whose file does not exist yet has `ready: false` and resolves
// to `manga`, so a key written ahead of its slice (or by hand) never leaves a popup without a frame.

var styles = [
  { key: "manga", name: "Panel", note: "An inked manga panel: ruled frame, torn corners, screentone.", file: "ItoFrameManga.qml", ready: true, radius: 3, ruleAlpha: 0.6 },
  { key: "chains", name: "Chains", note: "Iron plates and hanging chains.", file: "ItoFrameChains.qml", ready: true, radius: 2, ruleAlpha: 0.4 },
  { key: "otherworld", name: "Otherworld", note: "Rust, barbed wire, grating and fog.", file: "ItoFrameOtherworld.qml", ready: true, radius: 1, ruleAlpha: 0.6 },
  { key: "minimal", name: "Minimal", note: "A single quiet rule.", file: "ItoFrameMinimal.qml", ready: true, radius: 6, ruleAlpha: 0.3 }
]

function find(list, key) {
  for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i]
  return null
}

// the style a sidecar value means: an unknown or not-yet-built one is `manga`
function resolve(key) {
  var s = find(styles, String(key))
  return s && s.ready ? s.key : "manga"
}
function radius(key) { return find(styles, resolve(key)).radius }
function ruleAlpha(key) { return find(styles, resolve(key)).ruleAlpha }
function file(key) { return find(styles, resolve(key)).file }

// the art of the manga style (sidecar `frameArt`): `png` is today's, `drawn` the procedural v2
function artMode(v) { return String(v) === "drawn" ? "drawn" : "png" }

// ---- chains sway (decisions-b9 1.2): defined by the tip travel s in px, the angle follows -----------------------------------------
// The chains hang ON the card's side rule (centre line 2 k inside the edge, 7 k on a side that faces a side bar), so at rest a chain
// bleeds 0.75 k and the sway may add what is left under 10 px outside and 14 px inside (0.4 px margin each).
function chainOpen(k, barFacing) {
  k = Math.max(0.8, Math.min(1.15, Number(k) || 1))
  return barFacing ? Math.min(3.5, 13.4 - 9.75 * k) : Math.min(8, 9 - 0.75 * k, 13.4 - 4.75 * k)
}
function chainRest(k, barFacing) { return barFacing ? 1.6 : 0.44 * chainOpen(k, false) }
// the tip travel for a settle value (1 at the open edge, 0 after 1200 ms) and an amplitude: `amp` scales it up to the open cap only
function chainTip(k, amp, settle, barFacing) {
  var st = Math.max(0, Math.min(1, Number(settle) || 0)), a = Math.max(0, Math.min(1.7, Number(amp) || 0))
  var open = chainOpen(k, barFacing), rest = chainRest(k, barFacing)
  return Math.min(open, (rest + (open - rest) * st) * a)
}
// the swing angle (degrees) for a tip travel s on a chain of length L px
function chainAngle(s, L) {
  s = Number(s); L = Number(L)
  if (!(L > 1) || !(s > 0)) return 0
  return Math.asin(Math.min(1, s / L)) * 180 / Math.PI
}

if (typeof module !== "undefined") module.exports = { chainOpen: chainOpen, chainRest: chainRest, chainTip: chainTip, chainAngle: chainAngle, radius: radius, ruleAlpha: ruleAlpha, styles: styles, resolve: resolve, file: file, artMode: artMode }
