import QtQuick
import ".." as Ito
import "../ItoMotion.js" as Motion

// One switch: a filled or empty blood mark before its name. The whole row is the target.
Rectangle {
  id: root

  property var host: null
  property var pal: null
  property string label: ""
  property string hint: ""
  property bool on: false
  property string sub: ""
  // D4: a non-empty reason means the option does not apply in the current bar form: the row is dimmed, cannot be pressed, and the
  // reason shows in italics under the label (never hidden, never a silent no-op). See ItoApplies.js.
  property string naReason: ""
  readonly property bool na: naReason !== ""
  // S13f: the sidecar keys the "↺" puts back (empty = no mark); it shows only while one of them is not the default
  property var resetKeys: []

  signal activated()

  enabled: !na
  opacity: na ? 0.4 : 1
  implicitWidth: 190
  implicitHeight: sub === "" && !na ? 34 : 44
  radius: 10
  color: hover.hovered ? Qt.rgba(pal.bone.r, pal.bone.g, pal.bone.b, 0.08) : "transparent"
  border.width: 1
  border.color: on ? Qt.rgba(pal.blood.r, pal.blood.g, pal.blood.b, 0.5) : Qt.rgba(pal.bone.r, pal.bone.g, pal.bone.b, 0.12)
  Behavior on color { ColorAnimation { duration: Motion.fast; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.soft } }
  Behavior on border.color { ColorAnimation { duration: Motion.normal; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.soft } }

  Row {
    anchors.verticalCenter: parent.verticalCenter
    anchors.left: parent.left
    anchors.leftMargin: 12
    spacing: 9

    // the mark: hollow when off, a filled blood lozenge when on
    Rectangle {
      anchors.verticalCenter: parent.verticalCenter
      width: 10
      height: 10
      rotation: 45
      radius: 2
      color: root.on ? root.pal.blood : "transparent"
      border.width: 1.2
      border.color: root.on ? root.pal.blood : Qt.rgba(root.pal.bone.r, root.pal.bone.g, root.pal.bone.b, 0.5)
      // A plain, quick fade between small and full: a switch is flipped many times while a page is open, so
      // nothing about it should catch the eye or overshoot. The spring curve read as a distracting bounce here.
      scale: root.on ? 1 : 0.88
      Behavior on scale {
        NumberAnimation { duration: Motion.fast; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.standard }
      }
      Behavior on color { ColorAnimation { duration: Motion.normal; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.soft } }
    }

    Column {
      anchors.verticalCenter: parent.verticalCenter
      spacing: 1

      Text {
        text: root.label
        color: root.on ? root.pal.bone : root.pal.bone
        opacity: root.on ? 1 : 0.6
        font.family: "Noto Serif"
        font.pixelSize: 12
      }

      Text {
        visible: root.sub !== "" || root.na
        text: root.na ? root.naReason : root.sub
        color: root.pal.bone
        opacity: 0.45
        font.family: "Noto Serif"
        font.italic: root.na
        font.pixelSize: 10
      }
    }
  }

  CcReset {
    anchors.right: parent.right
    anchors.rightMargin: 8
    anchors.verticalCenter: parent.verticalCenter
    z: 6
    host: root.host; pal: root.pal; keys: root.resetKeys
  }

  // the ink bleed under a press (flag pressBleed, default off: invisible)
  Ito.ItoStateLayer { anchors.fill: parent; z: 5; cfg: root.pal; radius: root.radius }

  HoverHandler {
    id: hover
    cursorShape: Qt.PointingHandCursor
    onHoveredChanged: if (root.host) root.host.hint = hovered ? (root.na ? root.naReason : root.hint) : ""
  }

  TapHandler {
    onTapped: root.activated()
  }
}
