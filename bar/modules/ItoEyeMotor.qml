import QtQuick
import "ItoEyeReal.js" as EyeR
import "ItoEyeMotion.js" as Mot
import "ItoOmenGate.js" as Gate

// The motor of one real eye (eyes-animation.md sections 3.2 and 4): it drives an ItoEyeLive, and is the ONLY clock of that eye. It is event-driven: every
// schedule of the eye (blinks, sag, fixations, tears, omens) is closed-form, so after each tick the model says how long nothing can change
// (`ItoEyeMotion.stepEye(...).next`) and the Timer sleeps that long. While a transition runs (a blink, a glance, the pupil, the reveal) it ticks every
// 33 ms; while only slow things run (the spiral, a sag's hold) every 66 ms; a calm eye with no pointer wakes about once in two seconds. A pointer
// move or a change of face wakes it at once.
//
// It lives inside the crest's Loader, so while a popup is closed nothing exists and there is no clock. It runs while the popup is `live` (open), and for the
// 160 ms of the lids' shut after it leaves. `level` 0 (motion off, or eyeMotion off) runs nothing at all: the host draws the still eye instead.
//
//   eye       the ItoEyeLive it drives (it also reads `size`, `mirror`, `rtier`, `pupil0`, `paintedMask` from it)
//   live      the popup is open: the reveal runs on the edge to true, the shut when it turns false
//   level     0 off, 1 subtle, 2 full (ItoConfig.eyeLevel); amp: ItoConfig.motionAmp
//   arch      the face the state asks for (heavy, stare, spiral ...): a change is worn only under a shut lid
//   rlTable   { archetype: overrides } (the crest's EyeR.CREST), given to the eye with each face
//   seed      the eye's seed (its rhythm); hot / critical: the state; hover: the pointer is over the head / the popup
//   pointer   null, or { x, y } in `space`'s coordinates (the item the host measured it in); the eye follows it
Item {
  id: root

  property Item eye: null
  property Item space: null
  property bool live: false
  property int level: 0
  property real amp: 1
  property string arch: "heavy"
  property var rlTable: null
  property int seed: 13
  property bool hot: false
  property bool critical: false
  property bool hover: false
  property var pointer: null

  // the exit: the lids shut in 160 ms (scaled with the presence), then the clock stops
  property bool exiting: false
  readonly property bool active: level > 0 && eye !== null
  readonly property real sS: Math.min(Math.max(amp, 0.001), 1.4)

  // ---- state: plain JS, changed by the tick (never a binding) -------------------------------------------------------------------------
  property var st: null
  property real clk: 0
  property real _last: 0
  property real revealT0: -1          // clk at the open edge; the reveal and the wake run for 1.12 s (x S) from it
  property real exitT0: -1
  property var plan: null             // the omen dealt for this open (ItoOmenGate: full only, once in a while), counted from the open edge (clk 0)
  property bool dealt: false
  property var queue: []              // lid frames still to bake, in order: one per tick

  function frameBits() { return (1 << eye.shutIdx) | 1 }

  // ---- the open edge ---------------------------------------------------------------------------------------------------------------------------
  function openEdge() {
    if (!active) return
    clk = 0
    _last = Date.now()
    revealT0 = 0
    if (!dealt) { plan = Gate.draw(seed, level, amp, "crest", hot || critical, arch); dealt = true }   // once per open, however many edges report it
    exitT0 = -1
    exiting = false
    eye.lazy = false
    st = Mot.newEye(seed, arch, { tier: eye.rtier, pupil0: eye.pupil0, S: eye.size })
    // always assigned (never left to the host's binding): from here on the face changes only under a shut lid, by this motor
    eye.archetype = arch; eye.rl = rlTable ? rlTable[arch] : null
    // the eye is baked shut and its open frame queued: the lids are drawn shut from the first frame, so there is no flash of an open eye
    queueFrames()
    eye.bakeMask = frameBits()
    eye.lid = eye.shutIdx
    eye.gazeX = 0; eye.gazeY = 0; eye.pupilK = 1; eye.irisRot = 0; eye.veinK = 1; eye.omenPupil = 0; eye.tearU = 0; eye.tearK = 0
    clock.interval = Mot.TICK.fast
  }
  function closeEdge() {
    if (!active || st === null) return
    exitT0 = clk
    exiting = true
    clock.interval = Mot.TICK.fast
  }
  onLiveChanged: { if (!live) dealt = false; if (live) openEdge(); else closeEdge() }
  Component.onCompleted: { if (live) openEdge() }
  onActiveChanged: { if (active && live) openEdge() }

  // the lid frames, shut first (the reveal starts from it), then the ones between, from the shut side to the open one
  function queueFrames() {
    var q = [], i
    for (i = eye.shutIdx - 1; i >= 1; i--) q.push(i)
    queue = q
  }
  function bakeOne() {
    if (queue.length === 0) return
    var q = queue.slice(), f = q.shift()
    queue = q
    eye.bakeMask = eye.bakeMask | (1 << f)
  }

  // the pointer as a vector from the eye's centre, in the eye's px (null: no pointer)
  function lookNow() {
    if (!pointer || !space || !eye) return null
    var p = eye.mapFromItem(space, pointer.x, pointer.y)
    return { dx: p.x - eye.width / 2, dy: p.y - eye.height / 2 }
  }

  function wake() { if (clock.running && clock.interval > Mot.TICK.fast) { clock.interval = Mot.TICK.fast } }
  onPointerChanged: wake()
  onHoverChanged: wake()
  onArchChanged: wake()
  onHotChanged: wake()
  onCriticalChanged: wake()

  // ---- one tick ----------------------------------------------------------------------------------------------------------------------------------
  function tick() {
    if (!active || st === null) return
    var now = Date.now(), dt = Math.min(0.25, Math.max(0.001, (now - _last) / 1000))
    _last = now
    clk += dt
    var rm = null, em = null
    if (revealT0 >= 0) {
      rm = (clk - revealT0) * 1000
      if (rm >= Mot.REVEAL.wakeEnd * 1000 * sS) { revealT0 = -1; rm = null }
    }
    if (exiting) {
      em = (clk - exitT0) * 1000
      rm = null; revealT0 = -1
    }
    var shown = st.out.arch
    var ready = eye.archetype === shown && (eye.paintedMask & frameBits()) === frameBits()
    // the veins beat (EM5): on a bloodshot eye at full, while the reading is hot at subtle; the plate exists only then (a plate that pulses)
    var bs = eye.plate0 && eye.plate0.params ? (eye.plate0.params.bloodshot || 0) : 0
    var pulse = level >= 2 ? "always" : "hot"
    eye.veinPlate = pulse === "always" ? (bs >= 0.6 || hot || critical) : (hot || critical)
    var inp = { level: level, amp: amp, arch: arch, ready: ready, hover: hover, look: lookNow(), S: eye.size, rot: 0, mirror: eye.mirror,
                hot: hot, critical: critical, revealMs: rm, exitMs: em, tier: eye.rtier, pupil0: eye.pupil0,
                pulse: pulse, bloodshot: bs, bpm: Mot.bpmFor(critical ? "critical" : (hot ? "hot" : "calm"), 0),
                plan: hot || critical ? null : plan, planT0: 0 }
    st = Mot.stepEye(st, clk, dt, inp)
    var o = st.out
    // a new face: the lids are shut, the new face is baked now (the shut and the open frame first, the rest one per tick)
    if (eye.archetype !== o.arch) {
      eye.archetype = o.arch
      eye.rl = rlTable ? rlTable[o.arch] : null
      eye.bakeMask = frameBits()
      queueFrames()
    }
    eye.lid = o.frame
    eye.gazeX = o.gazeX; eye.gazeY = o.gazeY; eye.pupilK = o.pupilK; eye.irisRot = o.irisRot
    eye.veinK = o.veinK; eye.omenPupil = o.omenPupil; eye.tearU = o.tearU; eye.tearK = o.tearK
    // at most one more frame per tick, and none while a blink is closing (the reveal, a swap and the exit may)
    var closing = o.b > 0.02 && o.b < 0.98 && rm === null && em === null
    if (!closing) bakeOne()
    if (exiting && em >= (Mot.REVEAL.exit * 1000 * sS) + 40) { exiting = false; return }
    clock.interval = Math.max(16, st.next === Infinity ? Mot.TICK.max : st.next)
  }

  Timer {
    id: clock
    interval: 33
    repeat: true
    running: (root.live || root.exiting) && root.active
    onRunningChanged: if (running) root._last = Date.now()
    onTriggered: root.tick()
  }
}
