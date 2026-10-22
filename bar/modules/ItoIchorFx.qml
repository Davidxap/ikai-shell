import QtQuick
import "ItoIchorFx.js" as Fx

// What lives INSIDE the memory liquid (S14, ConfigKey `vesselFill`): whirlpool, hair, rust, static or tone, drawn by ItoIchorFx.js into one Canvas over the
// strata (ItoIchor z 4.7) and clipped to the liquid's own polygon. `blood` (the default) builds NOTHING: no Canvas, no clock.
//
//   fill      blood | whirlpool | hair | rust | static | tone
//   liquid    the liquid's polygon and `surf` its top surface (ItoIchor rebuilds them as the level moves); levelPx its height
//   used      used memory 0..1; tight: a swap is in use or memory is over its line (the whirlpool winds faster and tighter, the hair tangles)
//   live, amp the popup is open / the motion amplitude: ONE FrameAnimation, running only while live, amp > 0, no pose and the fill has a motion of its own
//   pose      -1 in use; a number of seconds freezes the fill at that moment (the lab and the Control Centre's cards: nothing runs); `posePeaks`
//             then gives rust's tide marks as fractions of the disc's area
// Closed panel or motion off: the posed still frame (t = 0), drawn once per change of the liquid. Colours: ItoSealInk tokens only.
Item {
  id: root

  property var ink: null
  property string fill: "blood"
  property real radius: 64
  property real levelPx: 0
  property var liquid: []
  property var surf: []
  property real used: 0
  property bool tight: false
  property bool live: false
  property real amp: 1
  property real pose: -1
  property var posePeaks: []

  readonly property bool active: fill !== "blood" && ink !== null && levelPx > 0.5
  readonly property bool moves: Fx.MOVES[fill] === true
  readonly property real dpr: Math.max(1, Screen.devicePixelRatio)
  visible: active

  // the fill's own time, in seconds; and the frame counter that deals the snow again
  property real t: 0
  property int frame: 0
  property real sync: -1                 // static: one sync bar rolls down once (420 ms) when the level moves by more than 5 %
  property real _syncRef: -1
  property real _syncAt: 0
  property var peakState: null
  property real _acc: 0

  readonly property real shownT: pose >= 0 ? pose : t
  readonly property real frac: Fx.areaOf(levelPx / Math.max(1, radius))

  onFracChanged: {
    if (fill === "blood" || pose >= 0) return
    peakState = Fx.notePeak(peakState, frac, Date.now())
    if (_syncRef < 0) _syncRef = frac
    else if (Math.abs(frac - _syncRef) > 0.05) { _syncRef = frac; if (live && amp > 0 && fill === "static") { _syncAt = t; sync = 0 } }
  }

  FrameAnimation {
    running: root.live && root.amp > 0 && root.pose < 0 && root.active && root.moves
    onTriggered: {
      root.t += frameTime
      root._acc += frameTime
      if (root.sync >= 0) { root.sync = (root.t - root._syncAt) / 0.42; if (root.sync > 1) root.sync = -1 }
      if (root._acc >= (Fx.STEP[root.fill] || 1 / 30) || root.sync >= 0) { root._acc = 0; root.frame += 1; cv.requestPaint() }
    }
    onRunningChanged: if (!running) { root.t = 0; root.sync = -1; cv.requestPaint() }
  }

  onLiquidChanged: cv.requestPaint()
  onFillChanged: cv.requestPaint()
  onInkChanged: cv.requestPaint()
  onPoseChanged: cv.requestPaint()
  onTightChanged: cv.requestPaint()

  function peaksNow() {
    if (pose >= 0) {
      var out = []
      for (var i = 0; i < posePeaks.length; i++) out.push({ frac: posePeaks[i], age: 700 })
      return out
    }
    var list = [], now = Date.now()
    if (peakState) for (var j = 0; j < peakState.peaks.length; j++) list.push({ frac: peakState.peaks[j].frac, age: (now - peakState.peaks[j].at) / 1000 })
    return list
  }

  Canvas {
    id: cv
    visible: root.active
    width: Math.ceil(root.width * root.dpr)
    height: Math.ceil(root.height * root.dpr)
    scale: 1 / root.dpr
    transformOrigin: Item.TopLeft
    renderTarget: Canvas.Image
    renderStrategy: Canvas.Immediate
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function num(c) { return { r: c.r, g: c.g, b: c.b } }

    onPaint: {
      var ctx = getContext("2d")
      ctx.reset()
      if (!root.active || root.liquid.length < 3) return
      var ink = root.ink
      ctx.scale(root.dpr, root.dpr)
      Fx.paint(ctx, {
        fill: root.fill, rv: root.radius, k: root.radius / 64, liquid: root.liquid, surf: root.surf, levelPx: root.levelPx,
        t: root.shownT, used: root.used, tight: root.tight, frame: root.frame, sync: root.sync, peaks: root.peaksNow(),
        c: { fill: num(ink.fill), deep: num(ink.deep), clot: num(ink.clot), bone: num(ink.bone), panel: num(ink.panel), rust: num(ink.rustOf(ink.blood)),
             light: ink.panel.hslLightness > 0.5 }
      })
    }
  }
}
