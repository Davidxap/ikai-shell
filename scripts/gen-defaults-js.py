#!/usr/bin/env python3
# Regenerates bar/modules/ItoDefaults.js from bar/modules/ito-defaults.json (the defaults registry, S13f). The JSON is the source;
# scripts/qa/defaults.test.mjs fails when the two differ.  Usage: python3 scripts/gen-defaults-js.py
import json, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "bar", "modules")
data = json.load(open(os.path.join(root, "ito-defaults.json")))
head = '''.pragma library

// GENERATED from ito-defaults.json by scripts/gen-defaults-js.py (do not edit the table by hand: scripts/qa/defaults.test.mjs compares them).
// The defaults registry as the control centre sees it: what each sidecar key means when unset, and which page/section shows it, so a control
// can say "this is not the default" and a section/page can offer one reset (ito-config reset --section/--page).

var DATA = '''
tail = '''

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
'''
open(os.path.join(root, "ItoDefaults.js"), "w").write(head + json.dumps(data, indent=1, sort_keys=True) + tail)
