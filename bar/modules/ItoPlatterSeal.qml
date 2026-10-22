import QtQuick
import QtQuick.Shapes
import "ItoChart.js" as Chart
import "ItoIchor.js" as Ichor
import "ItoLore.js" as Lore

// The Amigara platter: the disk as a mountain full of holes (the Enigma of Amigara Fault: each hole is cut to one
// person's shape). Each mount is its own ring, the hole made for it; concentric rings are also a platter's tracks. At the
// centre is the human-shaped hole. The read and write bands are the seal's rune rings, turning with the traffic.
//
//   outer rule (1.2 px, r 91) and inner rule (0.8 px, r 87)   the seal's frame; open a 6 degree gap where the crack enters
//   write runes   r 83..86, 24 runes, turning clockwise with the write rate; lit (the accent) while writing, idle otherwise
//   read runes    r 79.5..82.5, 24 runes, turning counter-clockwise with the read rate; lit while reading
//   mount rings   between r 26 and 76, ring 0 (the first mount, usually "/") outermost: a track, an arc from 12 o'clock
//                 clockwise for the used share, a bead at its end; the accent, or hot above 90 %
//   threshold     a dashed spoke across the rings at 90 % (324 degrees): where an arc crosses it, the mount is hot
//   the hole      r < 22: a head and shoulders cut out of the panel, outlined
//   the crack     when `alert`: the seal's crack enters at 200 degrees and runs in, with two branches
//   the drop      while data is being written: a drop forms at the inner edge of the write band at 6 o'clock and falls
//                 10 px inward, towards the hole; rarer the lighter the writes (Ichor.writeDripInterval)
//
// The lore pass (`lvl` off | subtle | full, lore-pass.md; off draws none of it): the figure fills its hole as the root mount fills
// (area-true, the alarm colour past 90 %), the rust grating on the frame (ItoRust: the NVMe temperature), the Gyo walker in the
// bottom right corner (ItoGyoWalker: its legs are how busy the device is) and ドドド in the top right while it is pounding.
//
// Every length is given for a seal of radius 92 and scales with `size`. The rune bands only rotate (one clock, a single
// FrameAnimation); the arcs redraw only while their spring is moving. The numbers (percent, GiB, MB/s) stay as text
// beside it. Everything is gated by `live` (the panel is open) and `amp` (motion amplitude: 0 instant, nothing turns,
// no drop). Closed, it is a still picture and costs nothing. Colours come only from `ink` (an ItoSealInk). Imports
// nothing from the shell, so the offscreen lab can render it.
//
// `mounts` [{ fraction (0..1), hot }] in ring order (the Model's, at most 6; an empty list draws one empty track);
// `readBps` / `writeBps` bytes per second (0 when there is none to show); `hasStats` false without /proc/diskstats (both
// bands then stay still and idle). `pose` is for the lab: null in use, { lag, readSpin, writeSpin, drip } freezes a
// moment (bead lag, the two band angles in degrees, drop phase 0..1).
Item {
  id: root

  property var ink: null
  property var mounts: []
  property real readBps: 0
  property real writeBps: 0
  property bool hasStats: true
  property bool alert: false
  property real size: 184
  property bool live: false
  property real amp: 1
  property real threshold: 0.9
  property var pose: null
  property string lvl: "off"          // ItoConfig.loreLevel: off | subtle | full
  property real temp: -1              // degrees C of the NVMe (-1: no sensor)
  property real busy: -1              // the share of time the device spends on I/O, 0..1 (-1: no reading)
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

  // ---- the rules (open where the crack enters) -----------------------------------------------------------
  readonly property real gapDeg: alert ? Chart.CRACK_GAP : 0
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

  // ---- the rune bands ----------------------------------------------------------------------------------
  readonly property real writeSpeed: hasStats ? Chart.ioSpeed(writeBps) : 0
  readonly property real readSpeed: hasStats ? Chart.ioSpeed(readBps) : 0
  property real writeSpin: 0
  property real readSpin: 0
  readonly property real writeShown: pose && pose.writeSpin !== undefined ? pose.writeSpin : writeSpin
  readonly property real readShown: pose && pose.readSpin !== undefined ? pose.readSpin : readSpin
  // one clock for both bands; it runs only while something is turning, and only while the panel is open
  FrameAnimation {
    running: root.live && root.amp > 0 && !root.pose && (root.writeSpeed > 0 || root.readSpeed > 0)
    onTriggered: {
      root.writeSpin = (root.writeSpin + root.writeSpeed * root.amp * frameTime) % 360
      root.readSpin = (root.readSpin - root.readSpeed * root.amp * frameTime) % 360
    }
  }

  // a band: its runes as polylines, built once
  function band(rMid) {
    var raw = Chart.runePolylines(24, rMid * k, 3 * k), out = []
    for (var i = 0; i < raw.length; i++) {
      var line = []
      for (var j = 0; j < raw[i].length; j++) line.push(Qt.point(half + raw[i][j].x, half + raw[i][j].y))
      out.push(line)
    }
    return out
  }
  readonly property var writePaths: band(84.5)
  readonly property var readPaths: band(81)
  readonly property bool writing: writeSpeed > 0 || (pose && pose.writeSpin !== undefined)
  readonly property bool reading: readSpeed > 0 || (pose && pose.readSpin !== undefined)
  property color writeTone: writing ? (ink ? ink.alpha(ink.fill, 0.75) : grey) : (ink ? ink.tick : none)
  property color readTone: reading ? (ink ? ink.rule : grey) : (ink ? ink.tick : none)
  Behavior on writeTone {
    enabled: root.live && root.amp > 0
    ColorAnimation { duration: Math.round(220 * root.ampDur) }
  }
  Behavior on readTone {
    enabled: root.live && root.amp > 0
    ColorAnimation { duration: Math.round(220 * root.ampDur) }
  }

  Item {
    anchors.fill: parent
    rotation: root.writeShown
    Shape {
      anchors.fill: parent
      antialiasing: true
      ShapePath {
        strokeWidth: 1
        strokeColor: root.writeTone
        fillColor: root.none
        capStyle: ShapePath.RoundCap
        joinStyle: ShapePath.RoundJoin
        PathMultiline { paths: root.writePaths }
      }
    }
  }
  Item {
    anchors.fill: parent
    rotation: root.readShown
    Shape {
      anchors.fill: parent
      antialiasing: true
      ShapePath {
        strokeWidth: 1
        strokeColor: root.readTone
        fillColor: root.none
        capStyle: ShapePath.RoundCap
        joinStyle: ShapePath.RoundJoin
        PathMultiline { paths: root.readPaths }
      }
    }
  }

  // ---- the mount rings -------------------------------------------------------------------------------
  readonly property int slots: Math.max(1, Math.min(mounts.length, 6))
  readonly property var layout: Chart.ringLayout(slots)

  Repeater {
    model: root.slots
    Item {
      id: ring
      required property int index
      readonly property var m: index < root.mounts.length ? root.mounts[index] : null
      readonly property real target: Chart.clamp(m ? Number(m.fraction) || 0 : 0, 0, 1)
      readonly property bool hotRing: m ? !!m.hot : false
      // when the mounts shrink (the panel closes and clears them) a delegate outlives the layout for a moment: clamp the index
      readonly property var slot: root.layout.rings[Math.min(index, root.layout.rings.length - 1)]
      readonly property real radius: slot.radius * root.k
      readonly property real stroke: slot.stroke * root.k
      readonly property real angle: Chart.arcSweep(spring.shown)
      readonly property real lag: root.pose && root.pose.lag !== undefined ? root.pose.lag : Chart.clamp((target - spring.shown) * 6, -0.3, 0.6)
      readonly property bool shownAny: target > 0 || spring.shown > 0.002
      anchors.fill: parent

      ItoSpring { id: spring; target: ring.target; kind: "arc"; live: root.live; amp: root.amp }

      property color tone: hotRing ? root.cHot : root.cFill
      Behavior on tone {
        enabled: root.live && root.amp > 0
        ColorAnimation { duration: Math.round(220 * root.ampDur) }
      }

      Shape {
        anchors.fill: parent
        antialiasing: true
        ShapePath {
          strokeWidth: ring.stroke
          strokeColor: root.ink ? root.ink.track : root.none
          fillColor: root.none
          startX: root.half + ring.radius; startY: root.half
          PathAngleArc { centerX: root.half; centerY: root.half; radiusX: ring.radius; radiusY: ring.radius; startAngle: 0; sweepAngle: 360 }
        }
        ShapePath {
          strokeWidth: ring.stroke
          strokeColor: ring.shownAny && ring.angle > 0.2 ? ring.tone : root.none
          fillColor: root.none
          capStyle: ShapePath.FlatCap
          startX: root.half; startY: root.half - ring.radius
          PathAngleArc { centerX: root.half; centerY: root.half; radiusX: ring.radius; radiusY: ring.radius; startAngle: -90; sweepAngle: ring.angle }
        }
      }

      // the bead at the arc's end: turned so its x runs along the arc, stretched there by the lag
      Item {
        id: beadPos
        visible: ring.shownAny
        readonly property real bd: 1.2 * ring.stroke
        x: root.half + Chart.polar(ring.angle, ring.radius).x
        y: root.half + Chart.polar(ring.angle, ring.radius).y
        rotation: ring.angle
        Rectangle {
          id: bead
          x: -beadPos.bd / 2; y: -beadPos.bd / 2
          width: beadPos.bd; height: beadPos.bd; radius: width / 2
          color: ring.tone
          antialiasing: true
          transform: Scale { origin.x: bead.width / 2; origin.y: bead.height / 2; xScale: 1 + ring.lag }
        }
      }
    }
  }

  // ---- the threshold spoke: 90 % ----------------------------------------------------------------------
  readonly property var spoke: {
    var a = Chart.polar(360 * threshold, 26 * k), b = Chart.polar(360 * threshold, 76 * k)
    return [Qt.point(half + a.x, half + a.y), Qt.point(half + b.x, half + b.y)]
  }
  Shape {
    anchors.fill: parent
    antialiasing: true
    ShapePath {
      strokeWidth: 0.8
      strokeColor: root.ink ? root.ink.threshold : root.none
      fillColor: root.none
      dashPattern: [2.5, 3.75]
      PathPolyline { path: root.spoke }
    }
  }

  // ---- the hole: a head and shoulders cut out of the panel ------------------------------------------------
  Item {
    x: root.half; y: root.half
    scale: root.k
    transformOrigin: Item.TopLeft
    Shape {
      antialiasing: true
      ShapePath {
        strokeWidth: 1
        strokeColor: root.ink ? root.ink.rule : root.none
        fillColor: root.ink ? root.ink.panel : root.none
        joinStyle: ShapePath.RoundJoin
        // the head: a circle of radius 5 at (0, -9)
        PathSvg { path: "M 5 -9 A 5 5 0 1 1 -5 -9 A 5 5 0 1 1 5 -9 Z" }
      }
      ShapePath {
        strokeWidth: 1
        strokeColor: root.ink ? root.ink.rule : root.none
        fillColor: root.ink ? root.ink.panel : root.none
        joinStyle: ShapePath.RoundJoin
        // the body: a rounded trapezoid, shoulders 16 wide at y -3 narrowing to 10 at y 13
        PathSvg { path: "M -6.4 -3 L 6.4 -3 Q 8.2 -3 7.7 -1.3 L 5.5 11.7 Q 5.2 13 3.8 13 L -3.8 13 Q -5.2 13 -5.5 11.7 L -7.7 -1.3 Q -8.2 -3 -6.4 -3 Z" }
      }
    }
  }

  // ---- the figure enters its hole (lore) ------------------------------------------------------------------------------
  // the root mount's share fills the figure from the feet up, area-true (Lore.figureFill); the outline stays over it
  readonly property real rootFraction: mounts.length > 0 ? Chart.clamp(Number(mounts[0].fraction) || 0, 0, 1) : 0
  readonly property real rootQuant: Math.round(rootFraction * 200) / 200
  readonly property var figure: lvl === "off" || rootQuant <= 0 ? ({ body: [], head: [] }) : Lore.figureFill(rootQuant)
  readonly property bool figureHot: rootFraction > 0.9
  function pts(list) {
    var out = []
    for (var i = 0; i < list.length; i++) out.push(Qt.point(list[i].x, list[i].y))
    return out
  }
  Item {
    visible: root.lvl !== "off"
    x: root.half; y: root.half
    scale: root.k
    transformOrigin: Item.TopLeft
    Shape {
      antialiasing: true
      ShapePath {
        strokeWidth: -1
        fillColor: root.ink && root.figure.head.length > 0 ? root.ink.alpha(root.figureHot ? root.ink.hot : root.ink.fill, 0.85) : root.none
        PathPolyline { path: root.pts(root.figure.head) }
      }
      ShapePath {
        strokeWidth: -1
        fillColor: root.ink && root.figure.body.length > 0 ? root.ink.alpha(root.figureHot ? root.ink.hot : root.ink.fill, 0.85) : root.none
        PathPolyline { path: root.pts(root.figure.body) }
      }
      // the outline again, over the fill, in the alarm colour past 90 %
      ShapePath {
        strokeWidth: 1
        strokeColor: root.ink ? (root.figureHot ? root.ink.hot : root.ink.rule) : root.none
        fillColor: root.none
        joinStyle: ShapePath.RoundJoin
        PathSvg { path: "M 5 -9 A 5 5 0 1 1 -5 -9 A 5 5 0 1 1 5 -9 Z" }
      }
      ShapePath {
        strokeWidth: 1
        strokeColor: root.ink ? (root.figureHot ? root.ink.hot : root.ink.rule) : root.none
        fillColor: root.none
        joinStyle: ShapePath.RoundJoin
        PathSvg { path: "M -6.4 -3 L 6.4 -3 Q 8.2 -3 7.7 -1.3 L 5.5 11.7 Q 5.2 13 3.8 13 L -3.8 13 Q -5.2 13 -5.5 11.7 L -7.7 -1.3 Q -8.2 -3 -6.4 -3 Z" }
      }
    }
  }

  // ---- the rust grating (lore): the NVMe temperature on the frame ------------------------------------------------
  ItoRust {
    z: 1
    ink: root.ink; size: root.size; lvl: root.lvl
    temp: root.temp; hot: 80; crackOpen: root.alert
  }

  // ---- the walker and the pounding (lore) ---------------------------------------------------------------------------
  readonly property var walkBox: Lore.cornerBox(size, "br", 22, 12, 2)
  readonly property var soundBox: Lore.cornerBox(size, "tr", 10, 30, 1)
  readonly property bool walking: hasStats && busy >= 0.2 && walkBox.clear
  readonly property bool pounding: hasStats && busy >= 0.8 && soundBox.clear
  readonly property var signs: Lore.budget("disk", (walking ? ["walker"] : []).concat(pounding ? ["dododo"] : []), lvl)
  ItoGyoWalker {
    x: root.walkBox.x; y: root.walkBox.y
    z: 3
    ink: root.ink; k: root.k; small: root.size < 160
    busy: root.signs.indexOf("walker") >= 0 ? root.busy : 0
    lvl: root.lvl; live: root.live; amp: root.amp
    pose: root.pose && root.pose.walker !== undefined ? root.pose.walker : -1
  }
  ItoLoreSfx {
    x: root.soundBox.x; y: root.soundBox.y
    z: 3
    ink: root.ink
    text: "\u30c9\u30c9\u30c9"
    vertical: true
    active: root.pounding
    allowed: root.signs.indexOf("dododo") >= 0
    tick: root.tick
    lvl: root.lvl; live: root.live; amp: root.amp
    pose: root.pose && root.pose.sfx !== undefined && root.pounding && root.signs.indexOf("dododo") >= 0 ? root.pose.sfx : -1
  }

  // ---- the crack ----------------------------------------------------------------------------------------
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

  // ---- the write drop ---------------------------------------------------------------------------------------
  // it forms at the inner edge of the write band at 6 o'clock and falls inward (the drop falls along +y: turned over)
  readonly property real dripSeconds: {
    var v = Ichor.writeDripInterval(hasStats ? writeBps : 0)
    return v === null ? 0 : v
  }
  ItoDrip {
    x: root.half; y: root.half + 83 * root.k
    rotation: 180
    z: 4
    ink: root.ink
    live: root.live
    amp: root.amp
    unit: 0.45 * Math.max(0.6, root.k)
    fall: 10 * root.k
    interval: root.pose ? 0 : root.dripSeconds
    posePhase: root.pose && root.pose.drip !== undefined ? root.pose.drip : -1
  }
}
