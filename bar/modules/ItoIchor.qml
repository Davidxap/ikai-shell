import QtQuick
import QtQuick.Shapes
import "ItoIchor.js" as Ichor
import "ItoChart.js" as Chart
import "ItoMotion.js" as Motion

// A vessel of viscous liquid: a disc of blood that sits exactly at its value and moves like something thick.
//
// It is the RAM vessel (strata) and the swap seals (one stratum). The liquid is how a value MOVES, never what it is:
// at rest the surface is flat (with its crown and meniscus) at the true level; waves, a film on the wall and a drop
// happen only in transit or as data (`dripInterval`: pending writes). Numbers stay as text next to the vessel.
//
// MATERIAL (design: ichor-materiality.md). One body, not layered water: every stratum shares ONE depth ramp (the same
// gradient range from the top surface to the floor: luminous just under the surface, the stratum's own colour in the
// middle, denser and darker toward the floor), strata are density bands inside it, told apart by a 1 px skin line. A
// glow band sits under the top surface, a highlight slides along its meniscus, a crescent of light runs down the left
// wall; the used stratum holds five specks of sediment; a falling level leaves a tapered film with rivulets that
// drains slowly. A shallow pool is translucent.
//
// LEVEL. Each stratum's boundary is a cumulative fraction of the disc's AREA, shown through a SpringAnimation
// Behavior (slow pour, a little overshoot). Heights are area-true (Chart.segmentHeightForArea). The spring numbers
// are one table, ItoIchor.js SPRINGS, picked by `kind`.
// SURFACE. Three damped standing modes (tilt about an off-centre pivot, bulge, ripple) driven by the level's
// acceleration (Ichor.sloshStep), a crown and a meniscus that climb the wall, all in ItoIchor.js tables. Only while
// something moves: every extra layer is derived from the one clock below, none has a clock of its own.
// COLOUR. Only from `ink` (an ItoSealInk). Each layer is an OPAQUE colour (the stratum's translucency laid over the
// panel ink beforehand), painted highest first, so layers do not blend twice.
//
// Zero cost when closed: every Behavior, Timer and clock is gated by `live` (the panel-open flag), and by `amp`
// (the motion amplitude, 0 off, 1 calm, 1.7 lively). At amp 0 the level jumps and the polygons are rebuilt once per
// change; body ramp, skin, highlight, crown, meniscus and platelets are still drawn (they are material, not motion),
// the film and the drop are not. No clip, no mask, no ShaderEffect (but the one Canvas of a fill other than blood, which clips to the liquid).
//
// `strata`: bottom to top, [{ fraction (of the disc's area), alpha (0..1, for a plain layer), gradient (bool: the
// denser ramp, default the bottom layer), hot (bool: eases to ink.hot) }]. Or the shorthand `value` (a single
// stratum) with `hot`. At most four strata.
//
// FILL (S14, `vesselFill`). `fill` picks what is drawn INSIDE the liquid, besides the strata: blood (nothing more, the liquid as it
// is), whirlpool, hair, rust, static or tone. Everything inside is ONE component, ItoIchorFx (z 4.7, clipped to the liquid by the same
// polygon this item builds), with its own clock that runs only while `live`. The liquid exposes what it needs: `topLevelPx` (the top
// surface's height, set by rebuild), `strataPx` (the strata's tops) and `slosh`.
//
// `pose` is for the lab: null in use; { levels: [cumulative fractions] | level, a1, a2, a3, vel, film, hotMix, drip, fx }
// freezes a moment (drip is a phase 0..1, hotMix 0..1, film the top of the wall film in px, fx the phase of the fill's motion in
// seconds) and nothing runs.
Item {
  id: root

  property var ink: null
  property var strata: []
  property real value: -1
  property bool hot: false
  property real radius: 64
  property bool live: false
  property real amp: 1
  property string kind: "vessel"
  property real dripInterval: 0      // seconds between drops; 0 none
  property real dripFall: Ichor.DRIP.fall
  property var pose: null
  property string fill: "blood"      // ItoConfig `vesselFill`: blood | whirlpool | hair | rust | static | tone
  property real memUsed: 0           // used memory 0..1 and swap pressure (the fills that react to them)
  property bool swapTight: false     // a swap is past 80 %: the whirlpool winds tighter

  width: radius * 2
  height: radius * 2

  readonly property real ampDur: Math.min(amp, 1)
  readonly property real sc: Ichor.scaleFor(radius)      // 1 from rv 64 up, 0.3 at the smallest: scales every px constant

  // ---- the layers: cumulative targets --------------------------------------------------------------
  readonly property var layers: {
    var src = strata && strata.length > 0 ? strata : (value >= 0 ? [{ fraction: value, hot: hot, gradient: true }] : [])
    var out = [], cum = 0
    for (var i = 0; i < Math.min(src.length, 4); i++) {
      cum = Math.min(1, cum + Math.max(0, Number(src[i].fraction) || 0))
      out.push({
        cum: cum,
        alpha: src[i].alpha === undefined ? 1 : src[i].alpha,
        gradient: src[i].gradient === undefined ? i === 0 : !!src[i].gradient,
        hot: !!src[i].hot
      })
    }
    return out
  }
  function cumAt(i) {
    if (layers.length === 0) return 0
    return layers[Math.min(i, layers.length - 1)].cum
  }
  readonly property bool anyHot: {
    for (var i = 0; i < layers.length; i++) if (layers[i].hot) return true
    return false
  }
  property real hotMix: anyHot ? 1 : 0
  readonly property real hotShown: pose && pose.hotMix !== undefined ? pose.hotMix : hotMix
  Behavior on hotMix {
    enabled: root.live && root.amp > 0
    NumberAnimation { duration: Math.round(Motion.normal * root.ampDur) }
  }

  // ---- a level: a shown value that follows its target through a spring (ItoSpring) ----------------
  ItoSpring { id: l0; kind: root.kind; live: root.live && !root.pose; amp: root.amp; target: root.cumAt(0); onMoved: root.levelMoved() }
  ItoSpring { id: l1; kind: root.kind; live: root.live && !root.pose; amp: root.amp; target: root.cumAt(1); onMoved: root.levelMoved() }
  ItoSpring { id: l2; kind: root.kind; live: root.live && !root.pose; amp: root.amp; target: root.cumAt(2); onMoved: root.levelMoved() }
  ItoSpring { id: l3; kind: root.kind; live: root.live && !root.pose; amp: root.amp; target: root.cumAt(3); onMoved: root.levelMoved() }
  readonly property var levelObjs: [l0, l1, l2, l3]

  // the wall film has not dried yet
  readonly property bool stained: filmTop - _prevPx > 0.5

  // Some level is still on its way. Kept by hand from `levelMoved` (every change of a shown level announces itself),
  // not as a binding: a binding on `shown` and `target` loops, because a spring resets `shown` when its target changes.
  property bool moving: false
  function settle() {
    var any = false
    for (var i = 0; i < 4; i++) if (Math.abs(levelObjs[i].shown - levelObjs[i].target) > 0.0005) any = true
    moving = any
  }

  // ---- the surface: modes, meniscus, film ----------------------------------------------------------
  property var slosh: Ichor.newSlosh()
  property bool quiet: true
  property real filmTop: 0
  property real levelVel: 0
  property real _prevPx: 0
  property real _prevVel: 0
  property bool _havePrev: false
  property real topLevelPx: 0        // the top surface's height in px (set by rebuild)
  property var strataPx: []          // each stratum's top in px, bottom to top (set by rebuild)
  property var liquidPoly: []        // the liquid's polygon and its top surface, as point lists (set by rebuild, only for a fill other than blood)
  property var surfPts: []

  function shownCum() {
    var out = []
    for (var i = 0; i < 4; i++) out.push(levelObjs[i].shown)
    return out
  }

  // what a caller (or the lab) needs to freeze this moment as a `pose`
  function snapshot() {
    return { levels: shownCum().slice(0, Math.max(1, layers.length)), a1: slosh.a1, a2: slosh.a2, a3: slosh.a3, vel: levelVel, film: filmTop, hotMix: hotMix }
  }

  // A level moved: redraw here only when the clock is not running (a snap, or motion off); while it runs, its tick does it.
  // `_ticking` mirrors `clock.running` from the clock's own handler: reading `clock.running` here would loop, since that
  // binding reads `moving`, which reads the level that is being announced.
  property bool _ticking: false
  function levelMoved() { settle(); if (!_ticking) rebuild() }

  // The surface is redrawn at most about 40 times a second: the modes are slow (0.6 to 2.6 Hz), and every redraw
  // re-tessellates the vessel's paths on the GUI thread, which is what the panel costs while the liquid moves.
  property real _acc: 0
  function tick(frame) {
    _acc += frame
    if (_acc < 0.024) return
    var dt = _acc
    _acc = 0
    var rv = root.radius
    var px = 2 * rv * Chart.segmentHeightForArea(l3.shown)
    var accel = 0
    if (_havePrev && dt > 0) {
      var v = (px - _prevPx) / dt
      accel = (v - _prevVel) / dt
      _prevVel = v
      levelVel += (v - levelVel) * Math.min(1, dt * 12)
    }
    _prevPx = px
    _havePrev = true
    slosh = Ichor.sloshStep(slosh, dt, accel, { rv: rv, gain: Math.min(amp, 1.6) })
    quiet = Ichor.isQuiet(slosh)
    filmTop = Ichor.filmStep(filmTop, px, dt, sc)
    rebuild()
  }

  // a drop letting go kicks the bulge and the ripple
  function recoil() { slosh = Ichor.kick(slosh, Ichor.DRIP.dv2, Ichor.DRIP.dv3); quiet = false }

  // ---- geometry ------------------------------------------------------------------------------------
  // The maths is Ichor.buildGeometry (pure, tested and benchmarked); this only turns its lists into QML points.
  property var geom: ({ polys: ["", "", "", ""], surf: ["", "", "", ""], top: [0, 0, 0, 0], topIdx: -1, surfTop: 0, depth: 0,
    skin: "", ax: { x1: 0, y1: 0, x2: 0, y2: 0 }, hi: "", hx: 0.36, wall: "", wallY: [0, 0],
    filmL: "", filmR: "", filmY: [0, 0], platelets: [] })

  // a vertex list as an SVG path string (PathSvg): far cheaper per frame than one QML point per vertex
  function pts(list) { return Ichor.toSvg(list, false) }
  function poly(list) { return Ichor.toSvg(list, true) }

  function rebuild() {
    var rv = radius
    var p = pose
    var cum = p ? (p.levels ? p.levels : [p.level === undefined ? 0 : p.level]) : shownCum()
    var a1 = p ? (p.a1 || 0) : slosh.a1, a2 = p ? (p.a2 || 0) : slosh.a2, a3 = p ? (p.a3 || 0) : slosh.a3
    var n = layers.length
    var levelsPx = [], live = [], prev = 0, i
    for (i = 0; i < 4; i++) {
      var c = i < n ? (i < cum.length ? cum[i] : cum[cum.length - 1]) : 0
      levelsPx.push(2 * rv * Chart.segmentHeightForArea(c))
      live.push(i < n && c - prev > 0.0005)
      prev = c
    }
    var g = Ichor.buildGeometry(rv, levelsPx, live, { a1: a1, a2: a2, a3: a3 }, p ? (p.vel || 0) : levelVel, p ? (p.film || 0) : filmTop)
    var polys = [], surf = []
    for (i = 0; i < 4; i++) { polys.push(poly(g.polys[i])); surf.push(pts(g.surf[i])) }
    topIdx = g.topIdx
    topLevelPx = n > 0 ? levelsPx[n - 1] : 0
    strataPx = levelsPx.slice(0, Math.max(1, n))
    if (fill !== "blood") { liquidPoly = g.topIdx >= 0 ? g.polys[g.topIdx] : []; surfPts = g.topIdx >= 0 ? g.surf[g.topIdx] : [] }
    geom = {
      polys: polys, surf: surf, top: g.top, topIdx: g.topIdx, surfTop: g.surfTop, depth: g.depth,
      skin: poly(g.skin), ax: g.skinAxis, hi: poly(g.hi), hx: g.hx,
      wall: poly(g.wall), wallY: g.wall.length > 12 ? [g.wall[0].y, g.wall[12].y] : [0, 0],
      filmL: poly(g.filmL), filmR: poly(g.filmR), filmY: g.filmY, platelets: g.platelets
    }
  }
  onLayersChanged: rebuild()
  onRadiusChanged: rebuild()
  onPoseChanged: rebuild()
  onFillChanged: rebuild()
  Component.onCompleted: rebuild()

  // the one clock: runs while a level is moving or the surface has not settled
  FrameAnimation {
    id: clock
    running: root.live && root.amp > 0 && !root.pose && (root.moving || !root.quiet || root.stained)
    onTriggered: root.tick(frameTime)
    onRunningChanged: {
      root._ticking = running
      if (!running) {
        root._havePrev = false; root._prevVel = 0; root.levelVel = 0; root._acc = 0
        root.filmTop = 0
        root.rebuild()
      }
    }
  }

  // ---- colour --------------------------------------------------------------------------------------
  // Colours are worked out once per change of ink, strata or hot mix, never per frame: only `thin` (the depth) moves the
  // top stop of the ramp while the surface is in motion.
  readonly property color noColor: Qt.rgba(0, 0, 0, 0)
  // which stratum is on top (set by rebuild, and only when it changes)
  property int topIdx: -1
  readonly property real thin: Ichor.thinness(geom.depth)

  function glowAt(t) { return ink ? ink.mix(ink.glow, ink.hotGlow, t) : noColor }
  function clotAt(t) { return ink ? ink.mix(ink.clot, ink.hotClot, t) : noColor }

  // per stratum: B (its own colour: the accent or its hot mix for the dense stratum, that colour laid over the panel
  // at the stratum's opacity for a plain one), the glow at its top and the clot at its floor of the shared depth ramp
  readonly property var ramp: {
    var out = []
    for (var i = 0; i < 4; i++) {
      if (!ink || i >= layers.length) { out.push({ base: noColor, glow: noColor, floor: noColor }); continue }
      var s = layers[i]
      var h = s.hot ? hotShown : 0
      var base = s.hot ? ink.mix(ink.fill, ink.hot, hotShown) : ink.fill
      if (!s.gradient) base = ink.settle(base, s.alpha)
      out.push({ base: base, glow: glowAt(h), floor: ink.mix(base, clotAt(h), s.gradient ? 0.70 : 0.35) })
    }
    return out
  }
  function bodyTop(i) { return ink && i < layers.length ? ink.mix(ramp[i].base, ramp[i].glow, 0.18 + 0.50 * thin) : noColor }

  // the skin, film and specks follow the top stratum's / the first stratum's hot mix
  readonly property real hotTop: topIdx >= 0 && topIdx < layers.length && layers[topIdx].hot ? hotShown : 0
  readonly property real hotFirst: layers.length > 0 && layers[0].hot ? hotShown : 0
  readonly property color skinGlow: ink ? ink.alpha(glowAt(hotTop), 0.90) : noColor
  readonly property color skinGlowOff: ink ? ink.alpha(glowAt(hotTop), 0) : noColor
  readonly property color filmRim: ink ? ink.alpha(clotAt(hotTop), 0.90) : noColor
  readonly property color filmWet: ink ? ink.stain : noColor
  readonly property color speckClot: ink ? ink.alpha(clotAt(hotFirst), 0.60) : noColor
  readonly property color speckGlow: ink ? ink.alpha(glowAt(hotFirst), 0.45) : noColor
  readonly property color hiOff: ink ? ink.alpha(ink.highlight, 0) : noColor
  readonly property color hiOn: ink ? ink.alpha(ink.highlight, ink.highlightA) : noColor
  readonly property color wallOn: ink ? ink.alpha(ink.highlight, 0.7 * ink.highlightA) : noColor

  // ---- drawing -------------------------------------------------------------------------------------
  // the body: four polygons (highest first), one depth ramp shared by all, a 1 px skin line on every top edge but the last
  Repeater {
    model: 4
    Shape {
      id: shape
      required property int index
      width: root.width; height: root.height
      z: 4 - index
      visible: index < root.layers.length
      antialiasing: true
      ShapePath {
        strokeWidth: -1
        fillGradient: LinearGradient {
          x1: 0; y1: root.geom.surfTop; x2: 0; y2: root.radius * 2
          GradientStop { position: 0; color: root.bodyTop(shape.index) }
          GradientStop { position: 0.45; color: root.ramp[shape.index].base }
          GradientStop { position: 1; color: root.ramp[shape.index].floor }
        }
        PathSvg { path: root.geom.polys[shape.index] }
      }
      ShapePath {
        strokeWidth: 1
        strokeColor: root.ink && shape.index !== root.topIdx && shape.index < root.layers.length ? root.ink.skinLine : root.noColor
        fillColor: root.noColor
        PathSvg { path: root.geom.surf[shape.index] }
      }
    }
  }

  // the specks of sediment in the used stratum: they move only with the surface
  Repeater {
    model: 5
    Rectangle {
      required property int index
      readonly property var speck: index < root.geom.platelets.length ? root.geom.platelets[index] : null
      visible: speck !== null
      z: 4.5
      x: speck ? speck.x - speck.r : 0
      y: speck ? speck.y - speck.r : 0
      width: speck ? 2 * speck.r : 0
      height: width
      radius: width / 2
      antialiasing: true
      color: speck ? (speck.tone === "glow" ? root.speckGlow : root.speckClot) : root.noColor
    }
  }

  // what is inside the liquid (S14, `vesselFill`): one component, drawn after the specks and before the skin glow
  ItoIchorFx {
    anchors.fill: parent
    z: 4.7
    ink: root.ink
    fill: root.fill
    radius: root.radius
    levelPx: root.topLevelPx
    liquid: root.liquidPoly
    surf: root.surfPts
    used: root.memUsed
    tight: root.swapTight || root.memUsed > 0.85
    live: root.live
    amp: root.amp
    pose: root.pose && root.pose.fx !== undefined ? root.pose.fx : -1
    posePeaks: root.pose && root.pose.fxPeaks !== undefined ? root.pose.fxPeaks : []
  }

  // the skin of the top surface: a glow band under it, the meniscus highlight along it, the light down the left wall
  Shape {
    width: root.width; height: root.height
    z: 5
    visible: root.topIdx >= 0
    antialiasing: true
    ShapePath {
      strokeWidth: -1
      fillGradient: LinearGradient {
        x1: root.geom.ax.x1; y1: root.geom.ax.y1; x2: root.geom.ax.x2; y2: root.geom.ax.y2
        GradientStop { position: 0; color: root.skinGlow }
        GradientStop { position: 1; color: root.skinGlowOff }
      }
      PathSvg { path: root.geom.skin }
    }
    ShapePath {
      strokeWidth: -1
      fillGradient: LinearGradient {
        x1: 0; y1: 0; x2: root.width; y2: 0
        GradientStop { position: 0; color: root.hiOff }
        GradientStop { position: root.geom.hx - 0.16; color: root.hiOff }
        GradientStop { position: root.geom.hx; color: root.hiOn }
        GradientStop { position: root.geom.hx + 0.16; color: root.hiOff }
        GradientStop { position: 1; color: root.hiOff }
      }
      PathSvg { path: root.geom.hi }
    }
    ShapePath {
      strokeWidth: -1
      fillGradient: LinearGradient {
        x1: 0; y1: root.geom.wallY[0]; x2: 0; y2: root.geom.wallY[1]
        GradientStop { position: 0; color: root.wallOn }
        GradientStop { position: 1; color: root.hiOff }
      }
      PathSvg { path: root.geom.wall }
    }
  }

  // the film on the wall: a tapered crescent, clotted at its dried top rim, wet at the surface
  Shape {
    width: root.width; height: root.height
    z: 5.5
    antialiasing: true
    ShapePath {
      strokeWidth: -1
      fillGradient: LinearGradient {
        x1: 0; y1: root.geom.filmY[0]; x2: 0; y2: root.geom.filmY[1]
        GradientStop { position: 0; color: root.filmRim }
        GradientStop { position: 1; color: root.filmWet }
      }
      PathSvg { path: root.geom.filmL }
    }
    ShapePath {
      strokeWidth: -1
      fillGradient: LinearGradient {
        x1: 0; y1: root.geom.filmY[0]; x2: 0; y2: root.geom.filmY[1]
        GradientStop { position: 0; color: root.filmRim }
        GradientStop { position: 1; color: root.filmWet }
      }
      PathSvg { path: root.geom.filmR }
    }
  }

  // the drop, from the bottom of the vessel
  ItoDrip {
    x: root.radius; y: root.radius * 2
    z: 6
    ink: root.ink
    live: root.live
    amp: root.amp
    hot: root.anyHot
    unit: root.sc
    interval: root.pose ? 0 : root.dripInterval
    fall: root.dripFall
    posePhase: root.pose && root.pose.drip !== undefined ? root.pose.drip : -1
    onDetached: root.recoil()
  }
}
