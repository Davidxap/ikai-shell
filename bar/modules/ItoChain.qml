import QtQuick 6.11

// A chain (ito-panel-presence/frame-styles.md section 5, bar-decor.md section 4, icons-v5.md section 2.5 lighting), built once from Rectangles:
// links alternate between a FACE link (a stadium ring, 5.5 x 9 k) and an EDGE link (a bar, 1.8 x 9 k). The lit edge is the upper-left: a
// face link's `ironHi` ring sits 0.35 k up and left of its `iron` ring, so only a crescent of it shows, never on the lower-right; an
// edge link has an `ironHi` hairline on its left. Colours are the frame's `ink` tokens only.
//
//   mode "vertical"  hangs from its pivot (0, 0) straight down: `count` links `pitch` apart, ending in a `hook`, a `ring` or nothing. The
//                    whole chain turns about the pivot by `angle` degrees and each link adds i * 0.08 * angle about its own centre.
//                    `fall` (0..1) drops the last `fallLinks` links 7 k and turns them 30 degrees, in `hot` strokes while `hot`.
//   mode "draped"    runs from (x0, y0) to (x1, y1) along a quadratic with sag `sag`, one link every `pitch`, each turned to the tangent
//                    (the bar's gap chain: `size` 0.85 of the popup's).
// No clock, no animation: whoever owns the chain sets `angle` and `fall`; a number that is not finite is replaced, never used.
Item {
  id: root

  property var ink: null
  property real k: 1
  property string mode: "vertical"
  property int count: 8
  property real pitch: 7
  property real size: 1
  property string end: "none"               // vertical: "hook" | "ring" | "none"
  property real angle: 0                    // degrees, the whole chain about the pivot
  property real fall: 0
  property int fallLinks: 0
  property bool hot: false
  property real x0: 0
  property real y0: 0
  property real x1: 0
  property real y1: 0
  property real sag: 0

  function fin(v, d) { v = Number(v); return isFinite(v) ? v : d }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
  readonly property real u: Math.max(0.3, fin(k, 1)) * size
  readonly property color cIron: ink ? ink.iron : "transparent"
  readonly property color cHi: ink ? ink.ironHi : "transparent"
  readonly property color cHot: ink ? ink.hot : "transparent"
  readonly property int n: Math.max(0, Math.min(40, Math.round(fin(count, 0))))
  readonly property real step: Math.max(2, fin(pitch, 7)) * Math.max(0.3, fin(k, 1)) * (mode === "draped" ? 1 : 1)
  // the length of a vertical chain (links + end piece): the frame turns a tip travel into an angle with it
  readonly property real length: n * step + (end === "none" ? 0 : 8 * u)

  // the draped links: n = ceil(dist / pitch) + 1 along the quadratic
  readonly property real dist: Math.sqrt(Math.pow(fin(x1, 0) - fin(x0, 0), 2) + Math.pow(fin(y1, 0) - fin(y0, 0), 2))
  readonly property int drapeCount: mode === "draped" ? Math.max(2, Math.min(40, Math.ceil(dist / step) + 1)) : 0
  function drapeAt(i) {                       // [x, y, tangent degrees] of link i
    var m = Math.max(1, drapeCount - 1), t = clamp(i / m, 0, 1)
    var cx = (fin(x0, 0) + fin(x1, 0)) / 2, cy = (fin(y0, 0) + fin(y1, 0)) / 2 + 2 * fin(sag, 0)   // control point: the midpoint sags by `sag`
    var a = 1 - t
    var px = a * a * fin(x0, 0) + 2 * a * t * cx + t * t * fin(x1, 0)
    var py = a * a * fin(y0, 0) + 2 * a * t * cy + t * t * fin(y1, 0)
    var dx = 2 * a * (cx - fin(x0, 0)) + 2 * t * (fin(x1, 0) - cx)
    var dy = 2 * a * (cy - fin(y0, 0)) + 2 * t * (fin(y1, 0) - cy)
    return [px, py, Math.atan2(dy, dx) * 180 / Math.PI]
  }

  // ---- one link: face or edge, lit from the upper-left
  component Link: Item {
    id: lk
    property bool face: true
    property bool hotLink: false
    property real u: 1
    width: face ? 5.5 * u : 1.8 * u
    height: 9 * u
    // face: the lit crescent, then the ring over it
    Rectangle {
      visible: lk.face
      x: -0.35 * lk.u; y: -0.35 * lk.u
      width: parent.width; height: parent.height; radius: width / 2
      color: "transparent"; border.width: 1.4 * lk.u; border.color: lk.hotLink ? root.cHot : root.cHi
    }
    Rectangle {
      visible: lk.face
      width: parent.width; height: parent.height; radius: width / 2
      color: "transparent"; border.width: 1.4 * lk.u; border.color: lk.hotLink ? root.cHot : root.cIron
    }
    // edge: the bar, with a lit hairline on its left
    Rectangle {
      visible: !lk.face
      x: -0.3 * lk.u; width: parent.width; height: parent.height; radius: width / 2
      color: lk.hotLink ? root.cHot : root.cHi
    }
    Rectangle {
      visible: !lk.face
      width: parent.width; height: parent.height; radius: width / 2
      color: lk.hotLink ? root.cHot : root.cIron
    }
  }

  // ---- the vertical chain
  Item {
    id: hang
    visible: root.mode === "vertical"
    rotation: root.clamp(root.fin(root.angle, 0), -30, 30)
    transformOrigin: Item.TopLeft
    Repeater {
      model: root.mode === "vertical" ? root.n : 0
      delegate: Link {
        id: v
        required property int index
        readonly property bool dropped: root.fallLinks > 0 && index >= root.n - root.fallLinks
        readonly property real f: dropped ? root.clamp(root.fin(root.fall, 0), 0, 1) : 0
        face: index % 2 === 0
        hotLink: root.hot && dropped
        u: root.u
        x: -width / 2 + v.f * 2 * root.u
        y: (index + 0.5) * root.step - height / 2 + v.f * 7 * root.u
        rotation: root.fin(root.angle, 0) * 0.08 * index + v.f * 30
      }
    }
    // the end piece: a hook (a J, 6 x 8 k) or a ring (r 3 k), below the last link
    Item {
      visible: root.end !== "none"
      y: root.n * root.step
      Rectangle {
        visible: root.end === "ring"
        x: -3 * root.u; y: 0; width: 6 * root.u; height: 6 * root.u; radius: 3 * root.u
        color: "transparent"; border.width: 1.4 * root.u; border.color: root.cIron
      }
      Rectangle {                                                   // the hook's shank
        visible: root.end === "hook"
        x: -0.8 * root.u; y: 0; width: 1.6 * root.u; height: 5 * root.u; radius: 0.8 * root.u; color: root.cIron
      }
      Item {                                                        // and its turn: the lower half of a ring, a J with the shank
        visible: root.end === "hook"
        x: -0.8 * root.u; y: 5 * root.u; width: 6 * root.u; height: 3 * root.u; clip: true
        Rectangle {
          y: -3 * root.u; width: 6 * root.u; height: 6 * root.u; radius: 3 * root.u
          color: "transparent"; border.width: 1.6 * root.u; border.color: root.cIron
        }
      }
    }
  }

  // ---- the draped chain
  Repeater {
    model: root.mode === "draped" ? root.drapeCount : 0
    delegate: Link {
      id: d
      required property int index
      readonly property var pt: root.drapeAt(index)
      face: index % 2 === 0
      u: root.u
      x: pt[0] - width / 2
      y: pt[1] - height / 2
      rotation: pt[2] - 90
    }
  }
}
