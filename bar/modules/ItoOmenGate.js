.pragma library
.import "ItoEyeMotion.js" as Mot

// The shell-wide gate of the eye omens (eyes-animation.md section 1.4; EM6). One instance for the whole engine (a `.pragma library` is shared by every
// importer, so every popup's eyes see the same `lastAt` and the same open counter: this is the "singleton"; a QML singleton would need a qmldir in a
// directory that has none). It holds only two numbers; the decision itself is `ItoEyeMotion.omenPlan`, pure.
//   lastAt   the wall-clock second (Date.now() / 1000) of the last omen that was dealt, or null: the 120 s cooldown counts from it
//   opens    how many popup opens have asked: the open index of the seeded draw (chance 1 / 14 at calm, 1 / 9 at lively)
// An omen is dealt only at level 2 (`eyeMotion full`, never subtle, off or reduced motion: `level` already carries them), never while the reading is hot or
// critical (a stare holds still: stillness is the effect) and never to a spiral eye as the extra pupil. `draw` returns the plan or null; asking is what
// counts as an open, so a host calls it exactly once per popup open.

var lastAt = null
var opens = 0

function draw(seed, level, amp, surface, quiet, arch, nowSec) {
  var idx = opens++
  if (quiet) return null
  var now = nowSec === undefined ? Date.now() / 1000 : nowSec
  var plan = Mot.omenPlan(seed, idx, level, amp, lastAt, now, surface)
  if (!plan) return null
  if (plan.kind === "extrapupil" && arch === "spiral") return null
  lastAt = now
  return plan
}
// a test hook and the lab's: forget everything
function reset() { lastAt = null; opens = 0 }
function state() { return { lastAt: lastAt, opens: opens } }

if (typeof module !== "undefined" && module.exports) module.exports = { draw: draw, reset: reset, state: state }
