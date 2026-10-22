import QtQuick
import QtQuick.Shapes
import "ItoIchor.js" as Ichor
import "ItoChart.js" as Chart

// The separated vessel of the memory panel: blood left standing separates into strata (dense at the bottom), drawn as
// ItoIchor inside the seal's rules. Nothing here decides a number: the strata come in as fractions of the whole and
// the liquid sits exactly at them (area-true) when nothing moves; the figures are text beside it.
//
//   outer rule (1.2 px) and inner rule (0.8 px)   the seal's frame (dashed outer rule when the reading is unreadable)
//   thread band   8 spokes and sagging threads between the rules: the memory thread, the scale of the seal
//   area ticks    on the wall where the filled AREA is 10..90 % (4 px, 7 px at 50 %)
//   hot line      a dashed chord at 85 % of the area: where used memory turns hot (with `lore` subtle or full: a chain, ItoChainChord)
//   liquid        ItoIchor, radius 64 of a seal of 156 (everything scales with `size`)
//   drop, pool    pending writes (`dirtyKiB`): a drop forms under the vessel at the rate Ichor.dripInterval says, and a
//                 still pool (18 x 2.5 px, the accent at 0.35) shows under it while there is anything unwritten
//
// `strata` is ItoIchor's list [{ fraction, alpha, gradient, hot }] bottom to top, fractions of the whole disc. Give it
// `live` (the panel is open) and `amp` (motion amplitude); closed, nothing runs. Colours come only from `ink`
// (an ItoSealInk). Height is `size` plus 20 px for the drop and its pool. `fill` (ItoConfig.vesselFill: blood | whirlpool | hair |
// rust | static | tone) says what is drawn inside the liquid (ItoIchorFx); `used` and `tight` feed the fills that react to memory.
Item {
  id: root

  property var ink: null
  property var strata: []
  property real size: 156
  property bool live: false
  property real amp: 1
  property real dirtyKiB: 0          // Dirty + Writeback, KiB; 0 for none
  property bool unreadable: false
  property real hotLine: 0.85
  property string fill: "blood"      // ItoConfig.vesselFill: what is inside the liquid (ItoIchorFx)
  property real used: 0              // used memory 0..1 (the fills that react to it)
  property bool tight: false         // a swap is in use or memory is over its line: the whirlpool winds faster and tighter
  property string lore: "off"        // ItoConfig.loreLevel: off | subtle | full (the chain and the mole of the lore pass)
  property bool hot: false           // used memory is over its line: the chain takes the alarm colour
  property var pose: null            // the lab's frozen moment for the liquid (see ItoIchor)

  readonly property real half: size / 2
  readonly property real k: half / 78                // every design length is given for half = 78
  readonly property real rv: 64 * k
  readonly property real dripSeconds: {
    var v = Ichor.dripInterval(dirtyKiB)
    return v === null ? 0 : v
  }

  width: size
  height: size + 20

  // ---- the frame
  Shape {
    anchors.fill: parent
    antialiasing: true
    ShapePath {
      strokeWidth: 1.2
      strokeColor: root.ink ? root.ink.rule : Qt.rgba(0, 0, 0, 0)
      fillColor: Qt.rgba(0, 0, 0, 0)
      dashPattern: root.unreadable ? [3, 3] : []
      startX: root.half + 77 * root.k; startY: root.half
      PathAngleArc { centerX: root.half; centerY: root.half; radiusX: 77 * root.k; radiusY: 77 * root.k; startAngle: 0; sweepAngle: 360 }
    }
  }
  Rectangle {
    x: root.half - 73 * root.k; y: root.half - 73 * root.k
    width: 146 * root.k; height: width; radius: width / 2
    color: Qt.rgba(0, 0, 0, 0)
    border.width: 0.8
    border.color: root.ink ? root.ink.ruleSoft : Qt.rgba(0, 0, 0, 0)
    antialiasing: true
  }

  // ---- the thread band: 8 spokes between r 64 and 73, and threads sagging between their outer ends
  Shape {
    anchors.fill: parent
    antialiasing: true
    ShapePath {
      strokeWidth: 0.7
      strokeColor: root.ink ? root.ink.tick : Qt.rgba(0, 0, 0, 0)
      fillColor: Qt.rgba(0, 0, 0, 0)
      capStyle: ShapePath.RoundCap
      PathMultiline { paths: root.spokes }
    }
    ShapePath {
      strokeWidth: 0.7
      strokeColor: root.ink ? root.ink.tick : Qt.rgba(0, 0, 0, 0)
      fillColor: Qt.rgba(0, 0, 0, 0)
      capStyle: ShapePath.RoundCap
      joinStyle: ShapePath.RoundJoin
      PathPolyline { path: root.threads }
    }
  }
  readonly property var spokes: {
    var out = []
    for (var i = 0; i < 8; i++) {
      var a = (-90 + 45 * i) * Math.PI / 180
      out.push([Qt.point(root.half + Math.cos(a) * 64 * k, root.half + Math.sin(a) * 64 * k),
                Qt.point(root.half + Math.cos(a) * 73 * k, root.half + Math.sin(a) * 73 * k)])
    }
    return out
  }
  // between two spokes the thread runs at r 70 and sags in towards the vessel, to about its wall
  readonly property var threads: {
    var out = [], r = 70 * k
    for (var i = 0; i < 8; i++) {
      var a0 = (-90 + 45 * i) * Math.PI / 180, a1 = (-90 + 45 * (i + 1)) * Math.PI / 180, am = (a0 + a1) / 2
      var x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r, x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r
      var cx2 = Math.cos(am) * r * 0.9, cy2 = Math.sin(am) * r * 0.9
      for (var j = 0; j < 6; j++) {
        var f = j / 6, g = 1 - f
        out.push(Qt.point(root.half + g * g * x0 + 2 * g * f * cx2 + f * f * x1, root.half + g * g * y0 + 2 * g * f * cy2 + f * f * y1))
      }
    }
    out.push(out[0])
    return out
  }

  // ---- the pool under the vessel, where the drop lands
  Rectangle {
    visible: root.dripSeconds > 0
    x: root.half - 9 * root.k; y: root.half + root.rv + Ichor.DRIP.fall + 1.6 * Ichor.DRIP.radius1 * Math.min(1, root.k) - 0.5
    width: 18 * root.k; height: 2.5
    radius: height / 2
    color: root.ink ? root.ink.alpha(root.ink.fill, 0.35) : Qt.rgba(0, 0, 0, 0)
    antialiasing: true
  }

  // ---- the liquid
  ItoIchor {
    id: liquid
    x: root.half - root.rv; y: root.half - root.rv
    fill: root.fill
    memUsed: root.used
    swapTight: root.tight
    pose: root.pose
    radius: root.rv
    ink: root.ink
    strata: root.strata
    live: root.live
    amp: root.amp
    dripInterval: root.dripSeconds
  }

  // ---- the ticks of the scale and the hot line, over the liquid
  Shape {
    anchors.fill: parent
    z: 8
    antialiasing: true
    ShapePath {
      strokeWidth: 1
      strokeColor: root.ink ? root.ink.tick : Qt.rgba(0, 0, 0, 0)
      fillColor: Qt.rgba(0, 0, 0, 0)
      PathMultiline { paths: root.ticks }
    }
    ShapePath {
      strokeWidth: 0.8
      strokeColor: root.ink && !root.chained ? root.ink.threshold : Qt.rgba(0, 0, 0, 0)
      fillColor: Qt.rgba(0, 0, 0, 0)
      dashPattern: [2.5, 3.75]
      PathPolyline { path: root.chord }
    }
  }
  // the Otherworld chain on the same chord (lore-pass.md): it replaces the dashes
  readonly property bool chained: lore !== "off" && rv >= 24
  Loader {
    active: root.chained
    z: 8
    anchors.fill: parent
    sourceComponent: ItoChainChord {
      ink: root.ink; size: root.size; cx: root.half; cy: root.half
      y0: root.wallAt(root.hotLine).y; rInner: 73 * root.k; k: root.k; hot: root.hot
    }
  }
  // the height, on the wall, at which the disc's filled area is `f`
  function wallAt(f) {
    var y = root.half + root.rv - 2 * root.rv * Chart.segmentHeightForArea(f)
    var dy = y - root.half
    return { y: y, hw: Math.sqrt(Math.max(0, root.rv * root.rv - dy * dy)) }
  }
  readonly property var ticks: {
    var out = []
    for (var i = 1; i <= 9; i++) {
      var w = wallAt(i / 10), len = (i === 5 ? 7 : 4) * k
      out.push([Qt.point(half - w.hw, w.y), Qt.point(half - w.hw + len, w.y)])
      out.push([Qt.point(half + w.hw, w.y), Qt.point(half + w.hw - len, w.y)])
    }
    return out
  }
  readonly property var chord: {
    var w = wallAt(hotLine)
    return [Qt.point(half - w.hw, w.y), Qt.point(half + w.hw, w.y)]
  }
}
