.pragma library
.import "ItoIconReal.js" as Real
.import "ItoIconReal2.js" as Real2
.import "ItoIconReal3.js" as Real3

// The whole manga icon set (icons-v3.md): the pilot kinds of ItoIconReal.js and the batch files, behind one entry point for the
// bake, the labs and the tests. Each kind file keeps its own drawers; this only dispatches and lists.

var FILES = [Real, Real2, Real3]
var KINDS = [], STATES = {}, NOMINAL = {}, CURRENT = {}
for (var f = 0; f < FILES.length; f++) {
  var M = FILES[f]
  for (var i = 0; i < M.KINDS.length; i++) {
    var k = M.KINDS[i]
    KINDS.push(k); STATES[k] = M.STATES[k]; NOMINAL[k] = M.NOMINAL[k]; CURRENT[k] = M.CURRENT[k]
  }
}
function fileOf(kind) {
  for (var f = 0; f < FILES.length; f++) if (FILES[f].KINDS.indexOf(kind) >= 0) return FILES[f]
  return null
}
function has(kind) { return fileOf(kind) !== null }
function iconParts(kind, state, sizePx, seed, opts) {
  var M = fileOf(kind)
  return M ? M.iconParts(kind, state, sizePx, seed, opts) : null
}
var SUPER = Real.SUPER

if (typeof module !== "undefined") module.exports = { KINDS: KINDS, STATES: STATES, NOMINAL: NOMINAL, CURRENT: CURRENT, SUPER: SUPER,
  iconParts: iconParts, has: has }
