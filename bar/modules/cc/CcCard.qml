import QtQuick
import ".." as Ito
import "../ItoMotion.js" as Motion

// A selectable card of the control centre: whatever you put inside on top, its name underneath, a blood
// underline when it is the chosen one, and its explanation handed to the footer while the pointer is on it.
Rectangle {
  id: root

  property var host: null           // the ControlCenter, for the footer hint
  property var pal: null            // the shell's colours (an ItoConfig)
  property string caption: ""
  property string hint: ""
  property bool current: false
  property real captionSize: 12
  property int captionElide: Text.ElideRight   // a grid of cards sets ElideNone: a name wraps to two lines, it is never cut
  property bool showCaption: true
  // D4: a non-empty reason means the choice does not apply in the current bar form: dimmed, cannot be pressed, the footer
  // shows the reason instead of the hint. A row of small cards shows the reason once, in italics, next to its label.
  property string naReason: ""
  readonly property bool na: naReason !== ""
  readonly property bool hovered: hover.hovered
  default property alias content: inner.data

  signal activated()

  radius: 12
  enabled: !na
  opacity: na ? 0.4 : 1
  color: hover.hovered ? Qt.rgba(pal.bone.r, pal.bone.g, pal.bone.b, 0.09)
    : (current ? Qt.rgba(pal.blood.r, pal.blood.g, pal.blood.b, 0.12) : Qt.rgba(pal.bone.r, pal.bone.g, pal.bone.b, 0.035))
  border.width: 1
  border.color: current ? Qt.rgba(pal.blood.r, pal.blood.g, pal.blood.b, 0.7)
    : Qt.rgba(pal.bone.r, pal.bone.g, pal.bone.b, 0.12)
  // The card leans towards the pointer and gives under a press. Springs settle; nothing snaps.
  scale: press.pressed ? 0.975 : (hover.hovered ? 1.018 : 1)
  // ccMotion (sidecar key, default on): a quicker hover and a press that springs
  readonly property bool ccm: pal !== null && typeof pal.get === "function" && pal.get("ccMotion", true) !== false
  Behavior on scale {
    NumberAnimation { duration: root.ccm ? 120 : Motion.fast; easing.type: Easing.BezierSpline; easing.bezierCurve: root.ccm ? Motion.spring : Motion.standard }
  }
  Behavior on color { ColorAnimation { duration: root.ccm ? Motion.fast : Motion.normal; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.soft } }
  Behavior on border.color { ColorAnimation { duration: Motion.normal; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.soft } }

  // cast ink under the card (flag `elevation`, default flat = nothing): level 1, 2 under the pointer
  Ito.ItoElevation { cfg: root.pal; level: root.hovered ? 2 : 1 }

  Item {
    id: inner
    anchors.fill: parent
  }

  Text {
    visible: root.showCaption
    anchors.bottom: parent.bottom
    anchors.bottomMargin: 8
    anchors.horizontalCenter: parent.horizontalCenter
    width: Math.min(implicitWidth, root.width - 4)
    horizontalAlignment: Text.AlignHCenter
    wrapMode: Text.WordWrap
    maximumLineCount: 2
    elide: root.captionElide
    text: root.caption
    color: root.current ? root.pal.lit : root.pal.bone
    opacity: root.current ? 1 : 0.72
    font.family: "Noto Serif"
    font.pixelSize: root.captionSize
    Behavior on color { ColorAnimation { duration: Motion.normal; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.soft } }
  }

  Rectangle {
    visible: root.showCaption
    anchors.bottom: parent.bottom
    anchors.bottomMargin: 3
    anchors.horizontalCenter: parent.horizontalCenter
    width: 22
    height: 2
    radius: 1
    color: root.pal.blood
    opacity: root.current ? 1 : 0
    Behavior on opacity { NumberAnimation { duration: Motion.normal; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.decel } }
  }

  // the ink bleed under a press (flag pressBleed, default off: invisible)
  Ito.ItoStateLayer { anchors.fill: parent; z: 5; cfg: root.pal; radius: root.radius }

  HoverHandler {
    id: hover
    cursorShape: Qt.PointingHandCursor
    onHoveredChanged: if (root.host) root.host.hint = hovered ? (root.na ? root.naReason : root.hint) : ""
  }

  TapHandler {
    id: press
    onTapped: root.activated()
  }
}
