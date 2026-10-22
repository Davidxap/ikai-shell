import QtQuick
import QtQuick.Shapes
import "ItoChart.js" as Chart
import "ItoEyeReal.js" as EyeR
import "ItoEyeMotion.js" as Mot
import "ItoLore.js" as Lore

// The Halo of the Sun: the processor as a seal. Each core is one ray of the halo; at its centre winds the Uzumaki
// spiral (渦, the curse of Kurouzu-cho: everything winds inward), because the run queue is work winding in.
//
//   outer rule (1.2 px, r 91) and inner rule (0.8 px, r 87)   the seal's frame; both open a 6 degree gap where the crack enters
//   tick band     one 3 px tick per ray (6 px every ceil(N/4)) between r 80 and 86, the rune band that makes the rays countable
//   the eye       an almond with a pupil at 12 o'clock: core 0, where the rays start and turn clockwise; a 12 x 7 px
//                 sigil instead (ItoEyeSigil: a heavy lid, a broken lower lid, a solid iris tucked under it, a paper pinpoint)
//   rays          one per core, r 30..76: a track, a fill that rises with the core's load, a bead at its tip; red above 0.8
//   guides        a dotted ring at 50 % and a dashed ring at the 0.8 threshold of every tier of rays
//   binding ring  r 25: the CPU pressure (PSI some avg10), an arc from 12 o'clock clockwise; hot above 20 %
//   the spiral    r 0..21: the load average over the threads sets how tightly it is wound (1.25 turns idle, 4 saturated),
//                 the clock speed sets how fast it turns (counter-clockwise: it winds inward); a ghost of the 15 minute
//                 load is drawn under it. The live spiral thickens and turns hot above 1 x the threads
//   the crack     when `alert`: a jagged crack enters at 200 degrees, continuing the frame's own, with two branches
//   the drop      when a core is saturated (>= 0.95) a drop forms at that ray's tip and falls outwards, one at a time
//
// The lore pass (`lvl` off | subtle | full, lore-pass.md; off draws none of it): the rust grating on the frame (ItoRust: the
// core temperature), the radio static around the busiest ray past 0.8 (ItoStatic), the Great Knife (a tangential blade at the
// busiest core's 60 s peak, once it crossed 0.8) and the lettering ゴゴゴ in the top right corner while the run queue is longer
// than the threads (ItoLoreSfx, full only). The event signs share the budget of Lore.budget.
//
// Every length is given for a seal of radius 92 and scales with `size`. Over 48 cores the rays make two tiers; over 128
// each ray is the worst of a run of cores (Chart.groupCores). The numbers (load, pressure, clock) stay as text beside it.
//
// Rays are Items rotated ONCE; afterwards only a fill's height and y and a bead's scale change, through a spring
// (ItoSpring, kind "ray"). The spiral only rotates. Nothing is redrawn between refreshes. Everything is gated by `live`
// (the panel is open) and `amp` (motion amplitude: 0 instant, no rotation, no drip). Closed, it is a still picture and
// costs nothing. Colours come only from `ink` (an ItoSealInk). Imports nothing from the shell, so the lab can render it.
//
// `loads` per-core loads 0..1 ([] before the second sample: tracks only); `threads` the number of logical CPUs;
// `load1` and `load15` the 1 and 15 minute load average divided by the threads (-1: unknown); `psi` percent (-1: unknown);
// `freqAvg` / `freqMax` MHz (0: unknown). `pose` is for the lab: null in use, { lag, spin, drip, dripRay } freezes a moment
// (bead lag, spiral angle in degrees, drop phase 0..1 and the ray it hangs from).
Item {
  id: root

  property var ink: null
  property var loads: []
  property int threads: loads.length
  property real load1: -1
  property real load15: -1
  property real psi: -1
  property real freqAvg: 0
  property real freqMax: 0
  property bool alert: false
  property real size: 184
  property bool live: false
  property real amp: 1
  property real threshold: 0.8
  property real psiThreshold: 20
  property var pose: null
  property string eyeStyle: "shaded"     // kept for the labs: every value draws the same sigil
  property int eyeLevel: 0            // ItoConfig.eyeLevel: 1 subtle (the sigil blinks), 2 full (and it watches the busiest core)
  property string lvl: "off"          // ItoConfig.loreLevel: off | subtle | full
  property real temp: -1              // degrees C of the processor (-1: no sensor)
  property int peakCore: -1           // the busiest core of the last 60 s (Lore.peakHold) and its load; -1: none yet
  property real peakV: 0
  property bool oversub: false        // the run queue is longer than the threads
  property int tick: 0                // the host increments it once per refresh, after setting everything else

  width: size
  height: size

  readonly property real half: size / 2
  readonly property real k: half / Chart.REFERENCE_R
  readonly property real ampDur: Math.min(amp, 1)

  readonly property color grey: Qt.rgba(0.5, 0.5, 0.5, 1)
  readonly property color none: Qt.rgba(0, 0, 0, 0)
  readonly property color cFill: ink ? ink.fill : grey
  readonly property color cHot: ink ? ink.hot : grey

  // ---- the layout of the rays ------------------------------------------------------------------------
  readonly property var layout: Chart.coreTiers(threads, half)
  readonly property var rayLoads: Chart.groupCores(loads, 128)
  readonly property var rays: {
    var out = []
    for (var t = 0; t < layout.tiers.length; t++) {
      var tr = layout.tiers[t]
      var ticks = Chart.tickLayout(tr.count)
      for (var i = 0; i < tr.count; i++)
        out.push({ angle: i * 360 / tr.count, rIn: tr.rIn, rOut: tr.rOut, w: tr.width, major: ticks[i].major, tier: t })
    }
    return out
  }
  readonly property real outerReach: layout.tiers.length > 0 ? layout.tiers[layout.tiers.length - 1].rOut : 76 * k

  // the ray a drop hangs from: the most loaded of the outermost tier, when it is saturated
  readonly property int saturatedRay: {
    var best = -1, bestLoad = 0.95 - 1e-9
    if (pose && pose.dripRay !== undefined) return pose.dripRay
    for (var i = 0; i < rays.length && i < rayLoads.length; i++) {
      if (rays[i].rOut < outerReach - 1e-6) continue
      if (rayLoads[i] > bestLoad) { best = i; bestLoad = rayLoads[i] }
    }
    return best
  }

  // ---- the spiral -----------------------------------------------------------------------------------
  readonly property bool haveLoad: load1 >= 0
  readonly property bool spiralHot: haveLoad && load1 > 1
  readonly property real freqRatio: freqMax > 0 ? Chart.clamp(freqAvg / freqMax, 0, 1) : -1
  // degrees per second: 6 + 30 f^2 at the clock ratio f, 8 without a clock reading; scaled by the amplitude
  readonly property real spinSpeed: (freqRatio >= 0 ? 6 + 30 * freqRatio * freqRatio : 8) * amp
  property real spin: 0
  readonly property real spinShown: pose && pose.spin !== undefined ? pose.spin : spin
  FrameAnimation {
    running: root.live && root.amp > 0 && !root.pose
    onTriggered: { root.spin = (root.spin + root.spinSpeed * frameTime) % 360; root.stepSigil(frameTime) }
  }

  // ---- the sigil's life (EM4): on the clock above, no clock of its own; the numbers are ItoEyeMotion's. A blink scales the sigil's height about its lid line,
  // a glance moves its iris item toward the busiest core (full). A property is written only when the value changes.
  property real sigilT: 0
  property real sigilBlink: 1
  property real sigilGx: 0
  property real sigilGy: 0
  readonly property bool sigilMoves: realEye && eyeLevel > 0
  readonly property int hottest: sigilMoves && eyeLevel >= 2 ? Mot.hottestCore(rayLoads) : -1
  readonly property var glanceTarget: Mot.sigilGlanceTarget(hottest >= 0 && hottest < rays.length ? rays[hottest].angle : NaN, eyeLevel)
  function stepSigil(dt) {
    if (!sigilMoves) { if (sigilBlink !== 1) sigilBlink = 1; return }
    sigilT += dt
    var b = Mot.sigilBlinkAt(7, sigilT, eyeLevel)
    if (b !== sigilBlink) sigilBlink = b
    var g = Mot.sigilGlanceNext({ x: sigilGx, y: sigilGy }, glanceTarget, dt)
    if (g.x !== sigilGx) sigilGx = g.x
    if (g.y !== sigilGy) sigilGy = g.y
  }

  // ---- the rules (open where the crack enters) ----------------------------------------------------------
  readonly property real gapDeg: alert ? Chart.CRACK_GAP : 0
  // compass 200 degrees is 110 degrees in the arc's own frame (3 o'clock, clockwise)
  readonly property real ruleStart: Chart.CRACK_ANGLE - 90 + gapDeg / 2
  function arcX(r) { return half + r * Math.cos(ruleStart * Math.PI / 180) }
  function arcY(r) { return half + r * Math.sin(ruleStart * Math.PI / 180) }

  Shape {
    anchors.fill: parent
    antialiasing: true
    ShapePath {
      strokeWidth: 1.2
      strokeColor: root.ink ? root.ink.rule : root.none
      fillColor: root.none
      startX: root.arcX(91 * root.k); startY: root.arcY(91 * root.k)
      PathAngleArc { centerX: root.half; centerY: root.half; radiusX: 91 * root.k; radiusY: 91 * root.k; startAngle: root.ruleStart; sweepAngle: 360 - root.gapDeg }
    }
    ShapePath {
      strokeWidth: 0.8
      strokeColor: root.ink ? root.ink.ruleSoft : root.none
      fillColor: root.none
      startX: root.arcX(87 * root.k); startY: root.arcY(87 * root.k)
      PathAngleArc { centerX: root.half; centerY: root.half; radiusX: 87 * root.k; radiusY: 87 * root.k; startAngle: root.ruleStart; sweepAngle: 360 - root.gapDeg }
    }
  }

  // ---- the tick band and the eye -------------------------------------------------------------------------
  // one tick per ray, none at 12 o'clock (the eye stands there)
  readonly property var tickPaths: {
    var minor = [], major = []
    for (var i = 0; i < rays.length; i++) {
      var g = rays[i]
      if (g.angle === 0) continue
      var a = Chart.polar(g.angle, 80 * k), b = Chart.polar(g.angle, (g.major ? 86 : 83) * k)
      var seg = [Qt.point(half + a.x, half + a.y), Qt.point(half + b.x, half + b.y)]
      if (g.major) major.push(seg)
      else minor.push(seg)
    }
    return { minor: minor, major: major }
  }
  Shape {
    anchors.fill: parent
    antialiasing: true
    ShapePath {
      strokeWidth: 1
      strokeColor: root.ink ? root.ink.tick : root.none
      fillColor: root.none
      PathMultiline { paths: root.tickPaths.minor }
    }
    ShapePath {
      strokeWidth: 1
      strokeColor: root.ink ? root.ink.rule : root.none
      fillColor: root.none
      PathMultiline { paths: root.tickPaths.major }
    }
  }

  // core 0, real: the T0 sigil, 12 x 7 px at r 83 on 12 o'clock, in the seal's rule ink over a soft lens (its ruleSoft), a static Shape
  readonly property bool realEye: true      // S14: the 12 x 7 px sigil is the shaded drawing for every eye (a user eye at 12 px is mud); the ink almond is gone
  readonly property var sigilPal: ink ? { paper: ink.panel, sclera: ink.ruleSoft, ink: ink.rule, tear: ink.rule } : null
  ItoEyeSigil {
    visible: root.realEye && root.rays.length > 0
    x: root.half - width / 2; y: root.half - 83 * root.k - height / 2
    params: root.realEye ? EyeR.realParams("heavy", 7, { aperture: 0.85, lidCover: 0.3, yaw: 0 }) : null
    pal: root.sigilPal
    size: 12 * root.k
    blinkK: root.pose && root.pose.sigil ? root.pose.sigil.blink : root.sigilBlink
    irisDx: (root.pose && root.pose.sigil ? root.pose.sigil.gx : root.sigilGx) * root.k
    irisDy: (root.pose && root.pose.sigil ? root.pose.sigil.gy : root.sigilGy) * root.k
  }

  // ---- the guides of every tier: 50 % (dotted) and the threshold (dashed) -------------------------------------------
  Repeater {
    model: root.layout.tiers
    Shape {
      id: guide
      required property var modelData
      anchors.fill: parent
      antialiasing: true
      readonly property real span: modelData.rOut - modelData.rIn
      ShapePath {
        strokeWidth: 0.6
        strokeColor: root.ink ? root.ink.alpha(root.ink.tick, 0.15) : root.none
        fillColor: root.none
        dashPattern: [1 / 0.6, 3 / 0.6]
        startX: root.half + guide.modelData.rIn + guide.span * 0.5; startY: root.half
        PathAngleArc {
          centerX: root.half; centerY: root.half
          radiusX: guide.modelData.rIn + guide.span * 0.5; radiusY: guide.modelData.rIn + guide.span * 0.5
          startAngle: 0; sweepAngle: 360
        }
      }
      ShapePath {
        strokeWidth: 0.8
        strokeColor: root.ink ? root.ink.threshold : root.none
        fillColor: root.none
        dashPattern: [2.5, 3.75]
        startX: root.half + guide.modelData.rIn + guide.span * root.threshold; startY: root.half
        PathAngleArc {
          centerX: root.half; centerY: root.half
          radiusX: guide.modelData.rIn + guide.span * root.threshold; radiusY: guide.modelData.rIn + guide.span * root.threshold
          startAngle: 0; sweepAngle: 360
        }
      }
    }
  }

  // ---- the rays -------------------------------------------------------------------------------------------
  Repeater {
    model: root.rays.length
    Item {
      id: ray
      required property int index
      readonly property var g: root.rays[index]
      readonly property real target: Chart.clamp(index < root.rayLoads.length ? Number(root.rayLoads[index]) || 0 : 0, 0, 1)
      readonly property real span: g.rOut - g.rIn
      readonly property real fillH: span * spring.shown
      readonly property real bead: 1.35 * g.w
      readonly property bool hotRay: target > root.threshold
      readonly property bool shownAny: target > 0 || spring.shown > 0.001
      readonly property real lag: root.pose && root.pose.lag !== undefined ? root.pose.lag : Chart.clamp((target - spring.shown) * 6, -0.3, 0.6)

      width: g.w
      height: g.rOut
      x: root.half - g.w / 2
      y: root.half - g.rOut
      transformOrigin: Item.Bottom
      rotation: g.angle

      ItoSpring { id: spring; target: ray.target; kind: "ray"; live: root.live; amp: root.amp }

      property color tone: hotRay ? root.cHot : root.cFill
      Behavior on tone {
        enabled: root.live && root.amp > 0
        ColorAnimation { duration: Math.round(220 * root.ampDur) }
      }

      Rectangle {
        y: 0; width: parent.width; height: ray.span
        radius: width / 2
        color: root.ink ? root.ink.track : root.none
        antialiasing: true
      }
      Rectangle {
        visible: ray.shownAny
        y: ray.span - ray.fillH; width: parent.width; height: ray.fillH
        radius: Math.min(width / 2, height / 2)
        color: ray.tone
        antialiasing: true
      }
      Rectangle {
        id: bead
        visible: ray.shownAny
        width: ray.bead; height: ray.bead; radius: width / 2
        x: (ray.width - width) / 2
        y: ray.span - ray.fillH - height / 2
        color: ray.tone
        antialiasing: true
        transform: Scale { origin.x: bead.width / 2; origin.y: bead.height / 2; yScale: 1 + ray.lag }
        // a 1 px glint on the bead, only where the ray is wide enough to hold one
        Rectangle {
          visible: ray.g.w >= 4
          x: bead.width * 0.2; y: bead.height * 0.18
          width: bead.width * 0.6; height: 1
          color: root.ink ? root.ink.sheen : root.none
          antialiasing: true
        }
      }
    }
  }

  // ---- the binding ring: CPU pressure -------------------------------------------------------------------------
  readonly property bool havePsi: psi >= 0
  readonly property real psiTarget: havePsi ? Chart.clamp(psi / 100, 0, 1) : 0
  ItoSpring { id: psiSpring; target: root.psiTarget; kind: "arc"; live: root.live; amp: root.amp }
  readonly property bool psiHot: havePsi && psi > psiThreshold
  property color psiTone: psiHot ? cHot : cFill
  Behavior on psiTone {
    enabled: root.live && root.amp > 0
    ColorAnimation { duration: Math.round(220 * root.ampDur) }
  }
  Shape {
    anchors.fill: parent
    visible: root.havePsi
    antialiasing: true
    ShapePath {
      strokeWidth: 2
      strokeColor: root.ink ? root.ink.track : root.none
      fillColor: root.none
      startX: root.half + 25 * root.k; startY: root.half
      PathAngleArc { centerX: root.half; centerY: root.half; radiusX: 25 * root.k; radiusY: 25 * root.k; startAngle: 0; sweepAngle: 360 }
    }
    ShapePath {
      strokeWidth: 2
      strokeColor: psiSpring.shown > 0.002 ? root.psiTone : root.none
      fillColor: root.none
      capStyle: ShapePath.RoundCap
      startX: root.half; startY: root.half - 25 * root.k
      PathAngleArc { centerX: root.half; centerY: root.half; radiusX: 25 * root.k; radiusY: 25 * root.k; startAngle: -90; sweepAngle: Chart.arcSweep(psiSpring.shown) }
    }
  }

  // ---- the spiral: turns from the load, rotation from the clock -------------------------------------------------
  function spiral(turns, r) {
    var raw = Chart.spiralPoints(turns, r, 34), out = []
    for (var i = 0; i < raw.length; i++) out.push(Qt.point(half + raw[i].x, half + raw[i].y))
    return out
  }
  readonly property var liveSpiral: spiral(haveLoad ? Chart.spiralTurns(load1) : 1.25, 21 * k)
  readonly property var ghostSpiral: load15 >= 0 && haveLoad ? spiral(Chart.spiralTurns(load15), 21 * k) : []
  Item {
    anchors.fill: parent
    rotation: -root.spinShown
    Shape {
      anchors.fill: parent
      antialiasing: true
      preferredRendererType: Shape.CurveRenderer
      ShapePath {
        strokeWidth: 1.0
        strokeColor: root.ink ? root.ink.spiralGhost : root.none
        fillColor: root.none
        capStyle: ShapePath.RoundCap
        joinStyle: ShapePath.RoundJoin
        PathPolyline { path: root.ghostSpiral.length > 0 ? root.ghostSpiral : [] }
      }
    }
    Shape {
      anchors.fill: parent
      antialiasing: true
      preferredRendererType: Shape.CurveRenderer
      ShapePath {
        strokeWidth: root.spiralHot ? 1.8 : 1.3
        strokeColor: !root.ink ? root.none : (!root.haveLoad ? root.ink.spiralGhost : (root.spiralHot ? root.ink.hot : root.ink.spiral))
        fillColor: root.none
        capStyle: ShapePath.RoundCap
        joinStyle: ShapePath.RoundJoin
        PathPolyline { path: root.liveSpiral }
      }
    }
  }

  // ---- the crack ------------------------------------------------------------------------------------------
  // jagged and fixed (Chart.crack): it enters on the outer rule at 200 degrees and runs in to 0.55 R
  readonly property var crackPaths: {
    var raw = Chart.crack(half), out = []
    for (var i = 0; i < raw.length; i++) {
      var line = []
      for (var j = 0; j < raw[i].length; j++) line.push(Qt.point(half + raw[i][j].x, half + raw[i][j].y))
      out.push(line)
    }
    return out
  }
  property real crack: alert ? 1 : 0
  Behavior on crack {
    enabled: root.live && root.amp > 0
    NumberAnimation { duration: Math.round(420 * root.ampDur) }
  }
  Shape {
    anchors.fill: parent
    visible: root.crack > 0.001
    opacity: root.crack
    antialiasing: true
    ShapePath {
      strokeWidth: 1.2
      strokeColor: root.ink ? root.ink.alpha(root.ink.hot, 0.85) : root.none
      fillColor: root.none
      capStyle: ShapePath.RoundCap
      joinStyle: ShapePath.RoundJoin
      PathMultiline { paths: root.crackPaths }
    }
  }

  // ---- the lore pass --------------------------------------------------------------------------------------------
  ItoRust {
    z: 1
    ink: root.ink; size: root.size; lvl: root.lvl
    temp: root.temp; hot: 80; crackOpen: root.alert
  }

  // the busiest ray and its load (grouped rays: the ray is the worst of its run of cores)
  readonly property int busyRay: {
    var best = -1, bestLoad = -1
    for (var i = 0; i < rays.length && i < rayLoads.length; i++) {
      var v = Number(rayLoads[i]) || 0
      if (v > bestLoad) { best = i; bestLoad = v }
    }
    return best
  }
  readonly property real busyLoad: busyRay >= 0 ? Chart.clamp(Number(rayLoads[busyRay]) || 0, 0, 1) : 0
  readonly property int staticN: lvl === "off" || busyRay < 0 ? 0 : Lore.staticCount(busyLoad, threshold)

  // the Great Knife: the peak of the last minute, shown once it crossed 0.8 and only while the ray has fallen away from it
  readonly property int knifeRay: peakCore >= 0 && layout.group > 0 ? Math.floor(peakCore / layout.group) : -1
  readonly property bool knifeOn: lvl !== "off" && knifeRay >= 0 && knifeRay < rays.length && knifeRay < rayLoads.length
    && peakV >= 0.8 && peakV - (Number(rayLoads[knifeRay]) || 0) >= 0.05
  readonly property var signs: Lore.budget("cpu", (staticN > 0 ? ["static"] : []).concat(knifeOn ? ["knife"] : []).concat(oversub ? ["gogogo"] : []), lvl)

  ItoStatic {
    z: 2
    ink: root.ink; size: root.size
    lvl: root.lvl; live: root.live; amp: root.amp
    angle: root.busyRay >= 0 ? root.rays[root.busyRay].angle : 0
    count: root.signs.indexOf("static") >= 0 ? root.staticN : 0
    seed: Math.max(0, root.busyRay)
    pose: root.pose && root.pose.burst !== undefined ? root.pose.burst : -1
  }

  Item {
    id: knife
    z: 2
    visible: root.signs.indexOf("knife") >= 0
    readonly property var g: root.knifeRay >= 0 && root.knifeRay < root.rays.length ? root.rays[root.knifeRay] : null
    readonly property real len: g ? Math.min(g.w + 5, 12) : 0
    readonly property real r: g ? g.rIn + (g.rOut - g.rIn) * Chart.clamp(root.peakV, 0, 1) : 0
    readonly property var at: g ? Chart.polar(g.angle, r) : { x: 0, y: 0 }
    x: root.half + at.x; y: root.half + at.y
    rotation: g ? g.angle : 0
    Shape {
      antialiasing: true
      ShapePath {
        strokeWidth: 0
        strokeColor: root.none
        // a blade 1.6 thick lying along the tangent, the clockwise end cut at 45 degrees
        fillColor: root.ink ? root.ink.alpha(root.ink.hot, 0.75) : root.none
        PathSvg { path: "M " + (-knife.len / 2) + " -0.8 L " + (knife.len / 2 - 1.6) + " -0.8 L " + (knife.len / 2) + " 0.8 L " + (-knife.len / 2) + " 0.8 Z" }
      }
    }
  }

  // ゴゴゴ: vertical in the top right corner, when it fits clear of the seal
  readonly property var sfxBox: Lore.cornerBox(size, "tr", 10, 30, 1)
  property int sfxTick: 0
  property int sfxHold: 0
  property int lastStatic: 0
  onTickChanged: {
    // a static burst that starts in this refresh delays the lettering by 600 ms (one motion at a time)
    sfxHold = lvl === "full" && staticN > lastStatic ? 600 : 0
    lastStatic = staticN
    sfxTick = tick
  }
  ItoLoreSfx {
    z: 3
    x: root.sfxBox.x; y: root.sfxBox.y
    ink: root.ink
    text: "\u30b4\u30b4\u30b4"
    vertical: true
    active: root.oversub && root.sfxBox.clear
    allowed: root.signs.indexOf("gogogo") >= 0
    tick: root.sfxTick; holdMs: root.sfxHold
    lvl: root.lvl; live: root.live; amp: root.amp
    pose: root.pose && root.pose.sfx !== undefined && root.oversub && root.sfxBox.clear && root.signs.indexOf("gogogo") >= 0 ? root.pose.sfx : -1
  }

  // ---- the drop of a saturated core ------------------------------------------------------------------------
  // it hangs from the ray's tip and falls outwards (the drop falls along its own +y: turned to point away from the centre)
  readonly property var tip: {
    if (saturatedRay < 0 || saturatedRay >= rays.length) return { x: half, y: half, angle: 0 }
    var g = rays[saturatedRay], p = Chart.polar(g.angle, g.rOut)
    return { x: half + p.x, y: half + p.y, angle: g.angle }
  }
  ItoDrip {
    x: root.tip.x; y: root.tip.y
    rotation: root.tip.angle + 180
    z: 4
    ink: root.ink
    live: root.live
    amp: root.amp
    hot: true
    unit: 0.45 * Math.max(0.6, root.k)
    fall: 7 * root.k
    interval: root.pose ? 0 : (root.saturatedRay >= 0 ? 9 : 0)
    posePhase: root.pose && root.pose.drip !== undefined ? root.pose.drip : -1
  }
}
