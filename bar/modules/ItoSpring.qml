import QtQuick
import "ItoIchor.js" as Ichor

// A value that follows its target like something thick: a SpringAnimation Behavior on `shown`, with the spring numbers
// taken from one table (ItoIchor.js SPRINGS) by `kind`: "vessel", "ray", "arc", "row" or "groove".
//
// It moves only while `live` (the panel is open) and `amp` (the motion amplitude, 0 off, 1 calm, 1.7 lively) is above 0;
// otherwise `shown` jumps to `target` at once. A change smaller than the dead band (0.004) is applied without waking
// anything. Nothing here runs between changes: the animation stops itself at the spring's epsilon.
QtObject {
  id: root

  property real target: 0
  property real shown: 0
  property string kind: "row"
  property bool live: true
  property real amp: 1

  readonly property var sp: Ichor.springFor(kind, amp)
  readonly property bool moving: Math.abs(shown - target) > 0.0005
  property bool snap: false

  // emitted whenever `shown` changes, so a component that draws from it by hand can redraw
  signal moved()

  Behavior on shown {
    enabled: root.live && root.amp > 0 && !root.snap
    SpringAnimation {
      spring: root.sp.spring; damping: root.sp.damping; mass: root.sp.mass
      velocity: root.sp.velocity; epsilon: root.sp.epsilon
    }
  }

  onTargetChanged: {
    snap = Math.abs(target - shown) < Ichor.DEAD_BAND || !(live && amp > 0)
    shown = target
    snap = false
  }
  onShownChanged: moved()
  // a panel that closes cancels the pour: the value goes to its target
  onLiveChanged: if (!live) { snap = true; shown = target; snap = false }
  Component.onCompleted: { snap = true; shown = target; snap = false }
}
