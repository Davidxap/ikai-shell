import QtQuick
import "../ItoMotion.js" as Motion
import QtQuick.Layouts

// A labelled slider bound to one sidecar key. The knob follows the hand at once; the sidecar is written when the
// hand pauses (a trailing write 160 ms after the last move) and again on release, never on a fixed tick, so a long
// drag is not a storm of helper processes.
RowLayout {
  id: root

  property var host: null
  property var pal: null
  property var actions: null
  property string label: ""
  property string key: ""
  property real fallback: 1
  property real lo: 0
  property real hi: 1
  property string hint: ""
  property bool percent: true       // show 62%, or a bare number for a count
  property string unit: ""          // appended to a bare number: "s"
  property string zeroLabel: ""     // shown instead of 0: "Never"
  property real pending: -1
  // D4: a non-empty reason dims the slider, stops it, and shows the reason in italics under its label (see ItoApplies.js)
  property string naReason: ""
  readonly property bool na: naReason !== ""

  function write() {
    if (pending < 0) return
    root.actions.set(root.key, root.percent ? pending.toFixed(2) : Math.round(pending))
  }

  readonly property real stored: Number(pal.get(key, fallback))
  readonly property real shown: pending >= 0 ? pending : stored
  readonly property real fraction: Math.max(0, Math.min(1, (shown - lo) / (hi - lo)))

  Layout.fillWidth: true
  spacing: 12
  opacity: na ? 0.4 : 1

  Column {
    Layout.preferredWidth: 130
    Layout.alignment: Qt.AlignVCenter
    spacing: 1
    Text {
      width: parent.width
      text: root.label
      color: root.pal.bone
      opacity: 0.75
      font.family: "Noto Serif"
      font.pixelSize: 12
    }
    Text {
      visible: root.na
      width: parent.width
      text: root.naReason
      color: root.pal.bone
      opacity: 0.6
      wrapMode: Text.WordWrap
      font.family: "Noto Serif"
      font.italic: true
      font.pixelSize: 10
    }
  }

  Item {
    Layout.fillWidth: true
    Layout.preferredHeight: 26

    Rectangle {
      anchors.verticalCenter: parent.verticalCenter
      width: parent.width
      height: 3
      radius: 1.5
      color: Qt.rgba(root.pal.bone.r, root.pal.bone.g, root.pal.bone.b, 0.18)
    }

    Rectangle {
      anchors.verticalCenter: parent.verticalCenter
      width: parent.width * root.fraction
      height: 3
      radius: 1.5
      color: root.pal.blood
      // the bar eases to a value set from outside (a preset), and follows the hand while it drags
      Behavior on width {
        enabled: !drag.pressed
        NumberAnimation { duration: Motion.normal; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.decel }
      }
    }

    Rectangle {
      anchors.verticalCenter: parent.verticalCenter
      x: parent.width * root.fraction - width / 2
      width: drag.pressed ? 19 : 13
      height: width
      radius: width / 2
      color: drag.pressed ? root.pal.lit : root.pal.bone
      Behavior on width { NumberAnimation { duration: Motion.fast; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.spring } }
      Behavior on color { ColorAnimation { duration: Motion.fast } }
    }

    Timer {
      id: trailing
      interval: 160
      onTriggered: root.write()
    }

    MouseArea {
      id: drag
      anchors.fill: parent
      enabled: !root.na
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      function pick(x) {
        root.pending = root.lo + Math.max(0, Math.min(1, x / width)) * (root.hi - root.lo)
        trailing.restart()
      }
      onEntered: if (root.host) root.host.hint = root.hint
      onExited: if (root.host) root.host.hint = ""
      onPressed: function(mouse) { pick(mouse.x) }
      onPositionChanged: function(mouse) { if (pressed) pick(mouse.x) }
      onReleased: {
        trailing.stop()
        root.write()
        root.pending = -1
      }
    }
  }

  Text {
    Layout.preferredWidth: 42
    horizontalAlignment: Text.AlignRight
    text: root.percent ? Math.round(root.shown * 100) + "%"
      : (Math.round(root.shown) === 0 && root.zeroLabel !== "" ? root.zeroLabel : Math.round(root.shown) + root.unit)
    color: root.pal.bone
    font.family: "Noto Serif"
    font.pixelSize: 12
  }

  // S13f: the "↺" shows when the slider is not at the registry's default and puts the key back
  CcReset { host: root.host; pal: root.pal; keys: root.key !== "" ? [root.key] : [] }
}
