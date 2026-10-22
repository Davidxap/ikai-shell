.pragma library

// The indicator icons and the versions each one comes in (see scripts/gen-indicator-icons.py). The user picks
// a version per indicator on the Icons page; the widget and the page read the same table.
//
// Pictures are ito-art/indicators/<id>-<version>-<off|on>.png. The first version of each is the default.

var indicators = [
  { id: "awake", name: "Stay awake", note: "Keeps the screen from locking or sleeping.",
    versions: [
      { key: "coffee",     name: "Coffee",     note: "A cup that fills with blood while you stay up." },
      { key: "radio",      name: "Radio",      note: "Silent Hill's pocket radio: it hisses when something is near." },
      { key: "flashlight", name: "Flashlight", note: "Silent Hill's flashlight: its beam held on." },
      { key: "cup",        name: "Weathered cup", user: "cup", note: "Your cassette's worn, blood-spattered skin on a mug: it fills with blood, drips and steams while you stay up." }
    ] },
  { id: "night", name: "Night light", note: "Warms the screen's colours.",
    versions: [
      { key: "moon", name: "Moon", note: "A moon, full of blood when it is on." },
      { key: "fog",  name: "Fog",  note: "Silent Hill's fog, with the red sun behind it." }
    ] },
  { id: "record", name: "Recording", note: "Whether the screen is being recorded.",
    versions: [
      { key: "eye",  name: "Eye",  note: "Closed until it is recording; then it opens, ringed." },
      { key: "tape", name: "Tape", note: "Silent Hill 2's videotape, the red light on." },
      { key: "cassette", name: "Cassette", user: "cassette", note: "Your weathered cassette: its reels fill with blood and the red light burns while the screen records." }
    ] }
]

function find(id) {
  for (var i = 0; i < indicators.length; i++)
    if (indicators[i].id === id) return indicators[i]
  return indicators[0]
}

// A version with `user` is drawn from the user's own files (bin/ito-assets recipe sprites: hollow/bar/<px>/<user>-on|off.png; the old sh/ files still read of the assets folder):
// it is offered and used only while those files are listed; otherwise the default version stands in.
function userPick(cfg, v, on, want) {
  if (!v || !v.user || !cfg || typeof cfg.userBar !== "function") return null
  return cfg.userBar("hollow/" + v.user + "-" + (on ? "on" : "off") + ".png", Math.max(24, Math.round(want || 28)), "v9")
}

function available(cfg, v) { return !v.user || userPick(cfg, v, true, 28) !== null }

function entry(id, key) {
  var list = find(id).versions
  for (var i = 0; i < list.length; i++)
    if (list[i].key === key) return list[i]
  return list[0]
}

// The version chosen for one indicator (or its default).
function version(cfg, id) {
  var wanted = String(cfg.get("icon:" + id, ""))
  var list = find(id).versions
  for (var i = 0; i < list.length; i++)
    if (list[i].key === wanted && available(cfg, list[i])) return wanted
  return list[0].key
}

// `want` (device px, optional) picks the tier of a user version; a shipped version ignores it.
function art(artBase, cfg, id, on, want) {
  var v = entry(id, version(cfg, id))
  var p = userPick(cfg, v, on, want)
  if (p) return String(p.url)
  return artBase + "indicators/" + id + "-" + (v.user ? find(id).versions[0].key : v.key) + "-" + (on ? "on" : "off") + ".png"
}
