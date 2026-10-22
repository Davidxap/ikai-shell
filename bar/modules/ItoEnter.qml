import QtQuick
import "ItoMotion.js" as Motion

// A small entrance for a popup's content: it grows from just under full size, from the edge next to the bar.
//
// Drop one inside a panel's content (it draws nothing). The panel's own fade stays as it is; this only adds the
// growth. It runs once each time `opened` turns on, on the render thread, and costs nothing while the popup is
// closed. `amp` comes from the Motion setting: 0 makes it instant. `spring` swaps the plain ease-out for the shell's
// spring curve (ItoMotion.spring): it lands a hair past full size and settles back, a little longer.
Item {
  id: root

  property bool opened: false
  property real amp: 1
  // Where the growth starts from, as an Item.TransformOrigin.
  property int origin: Item.Top
  property bool spring: false

  visible: false
  width: 0
  height: 0

  property real enter: 1

  onOpenedChanged: {
    anim.stop()
    if (!opened || amp <= 0) { enter = 1; return }
    enter = 0
    anim.start()
  }

  NumberAnimation {
    id: anim
    target: root
    property: "enter"
    to: 1
    duration: Math.round((root.spring ? 240 : 190) * Math.min(root.amp, 1))
    easing.type: root.spring ? Easing.BezierSpline : Easing.OutCubic
    easing.bezierCurve: Motion.spring
  }

  Component.onCompleted: if (parent) parent.transformOrigin = root.origin
  Binding {
    target: root.parent
    property: "scale"
    value: 1 - 0.035 * root.amp * (1 - root.enter)
    when: root.parent !== null
  }
}
