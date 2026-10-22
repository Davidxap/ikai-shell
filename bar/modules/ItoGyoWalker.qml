import QtQuick
import QtQuick.Shapes

// The Gyo walker (Junji Ito): a fish carried on metal legs, as the disk's busy gauge. How many legs it has is how busy the device
// is (round(6 x busy); round(4 x busy) on a seal under 160 px). The body is a lens 16 x 6 px with a forked tail of 5 px; every leg
// has a hip on the belly, a knee 3 px out and a foot 3 px down. At `subtle` it stands still in pose A; at `full` it walks:
// pose A and pose B (the knees mirrored) swap every 320 / amp ms while the device is at least 5 % busy.
//
// The item is 22 x 12 px (Lore.cornerBox(S, "br", 22, 12, 2)); the host places it in the seal's bottom right corner when that
// corner is clear. Body and legs are `ink.rule`; the legs take the alarm colour at 80 % busy. Two static Shapes per pose,
// swapped by visibility; the one Timer runs only while `live`, `amp`, `full` and the busy gauge all say so. `busy` is 0..1.
// `pose` is for the lab: -1 in use, else 0 (pose A) or 1 (pose B), frozen, no clock. Colours come only from `ink` (an ItoSealInk).
// Imports nothing from the shell.
Item {
  id: root

  property var ink: null
  property real busy: 0
  property real k: 1
  property string lvl: "off"
  property bool live: false
  property real amp: 1
  property real pose: -1
  property bool small: false

  width: 22
  height: 12
  visible: lvl !== "off" && legs >= 0 && busy > 0
  transformOrigin: Item.BottomRight
  scale: Math.min(1, Math.max(0.6, k))

  readonly property color none: "transparent"
  readonly property real b: busy >= 0 && busy <= 1 ? busy : 0
  readonly property int legs: Math.round((small ? 4 : 6) * b)
  readonly property bool hotLegs: b >= 0.8
  readonly property color legTone: ink ? (hotLegs ? ink.hot : ink.rule) : none

  // the pose on screen: A, or B on the odd beats of the gait
  property bool beat: false
  readonly property bool poseB: pose >= 0 ? pose >= 0.5 : (lvl === "full" && beat)

  Timer {
    interval: root.amp > 0 ? Math.round(320 / root.amp) : 320
    running: root.live && root.amp > 0 && root.lvl === "full" && root.b >= 0.05 && root.pose < 0
    repeat: true
    onTriggered: root.beat = !root.beat
  }
  onLiveChanged: if (!live) beat = false

  // the belly of the lens at x (the lens runs from x 5 to 21, 6 px tall about y 4)
  function belly(x) {
    var t = (x - 13) / 8
    return t >= -1 && t <= 1 ? 4 + 3 * (1 - t * t) : 4
  }
  // one leg as a polyline: hip, knee, foot. Odd legs reach the other way; pose B mirrors every knee.
  function legPath(i, n, flip) {
    var hx = n > 1 ? 4 + 11 * i / (n - 1) : 9.5
    var hy = belly(hx)
    var dir = ((i % 2 === 0) ? 1 : -1) * (flip ? -1 : 1)
    var kx = hx + 3 * dir, ky = hy + 1
    return [Qt.point(hx, hy), Qt.point(kx, ky), Qt.point(kx, ky + 3)]
  }
  function legsFor(flip) {
    var out = []
    for (var i = 0; i < legs; i++) out.push(legPath(i, legs, flip))
    return out
  }
  readonly property var legsA: legsFor(false)
  readonly property var legsB: legsFor(true)

  // the body: the lens and the forked tail
  Shape {
    antialiasing: true
    ShapePath {
      strokeWidth: 0.9
      strokeColor: root.ink ? root.ink.rule : root.none
      fillColor: root.none
      joinStyle: ShapePath.RoundJoin
      capStyle: ShapePath.RoundCap
      PathSvg { path: "M 5 4 Q 13 -2 21 4 Q 13 10 5 4 Z M 5 4 L 0 1 M 5 4 L 0 7" }
    }
  }
  Shape {
    visible: !root.poseB
    antialiasing: true
    ShapePath {
      strokeWidth: 0.9
      strokeColor: root.legTone
      fillColor: root.none
      joinStyle: ShapePath.RoundJoin
      capStyle: ShapePath.RoundCap
      PathMultiline { paths: root.legsA }
    }
  }
  Shape {
    visible: root.poseB
    antialiasing: true
    ShapePath {
      strokeWidth: 0.9
      strokeColor: root.legTone
      fillColor: root.none
      joinStyle: ShapePath.RoundJoin
      capStyle: ShapePath.RoundCap
      PathMultiline { paths: root.legsB }
    }
  }
}
