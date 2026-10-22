pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import Quickshell.Wayland

PanelWindow {
  id: root

  required property var bar
  required property var layoutSession
  property var targetScreen: null

  readonly property bool horizontal: !bar.vertical
  readonly property real outsideX: bar.position === "left" ? bar.barSize : 0
  readonly property real outsideY: bar.position === "top" ? bar.barSize : 0
  readonly property real outsideWidth: horizontal
    ? width : Math.max(0, width - bar.barSize)
  readonly property real outsideHeight: horizontal
    ? Math.max(0, height - bar.barSize) : height

  screen: targetScreen
  visible: horizontal && layoutSession.editing
  color: "transparent"
  exclusionMode: ExclusionMode.Ignore

  WlrLayershell.namespace: "ito-bar-edit-backdrop"
  WlrLayershell.layer: WlrLayer.Overlay
  WlrLayershell.keyboardFocus: WlrKeyboardFocus.None

  anchors {
    top: true
    bottom: true
    left: true
    right: true
  }

  mask: Region { item: dismissArea }

  Rectangle {
    x: root.outsideX
    y: root.outsideY
    width: root.outsideWidth
    height: root.outsideHeight
    color: "#000000"
    opacity: 0.34

    MouseArea {
      id: dismissArea

      anchors.fill: parent
      acceptedButtons: Qt.LeftButton
      onClicked: root.layoutSession.setEditing(false)
    }
  }

  // A style may explain editing right where it happens (the itoverse card: what to do, and Done).
  Loader {
    active: root.bar.visualTokens && root.bar.visualTokens.editHint !== undefined
    sourceComponent: root.bar.visualTokens ? root.bar.visualTokens.editHint : null
    x: Math.round((root.width - width) / 2)
    y: root.outsideY + 20
    z: 5
    onLoaded: {
      if (item && "bar" in item) item.bar = root.bar
      if (item && "layoutSession" in item) item.layoutSession = root.layoutSession
    }
  }
}
