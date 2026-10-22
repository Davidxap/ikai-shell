import QtQuick
import QtQuick.Layouts

// A folded panel of instructions: one line until it is opened, so a page stays short and the how-to is one click away.
Rectangle {
  id: help

  property var pal: null
  property string title: "How to prepare your picture"
  property string body: ""
  property bool open: false

  readonly property color bone: pal ? pal.bone : "#c7ccd1"

  Layout.fillWidth: true
  implicitHeight: (open ? head.height + text.implicitHeight + 24 : head.height)
  radius: 12
  color: Qt.rgba(bone.r, bone.g, bone.b, 0.04)
  border.width: 1
  border.color: Qt.rgba(bone.r, bone.g, bone.b, open || headArea.containsMouse ? 0.24 : 0.14)
  clip: true

  Item {
    id: head
    width: parent.width
    height: 34

    Text {
      x: 14
      anchors.verticalCenter: parent.verticalCenter
      text: help.title
      color: help.bone
      font.family: "Noto Serif"
      font.pixelSize: 12
    }
    Text {
      anchors.right: parent.right
      anchors.rightMargin: 14
      anchors.verticalCenter: parent.verticalCenter
      text: "▸"
      rotation: help.open ? 90 : 0
      color: help.bone
      opacity: 0.7
      font.pixelSize: 12
      Behavior on rotation { NumberAnimation { duration: 140 } }
    }
    MouseArea {
      id: headArea
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: help.open = !help.open
    }
  }

  Text {
    id: text
    x: 14
    y: head.height + 2
    width: parent.width - 28
    visible: help.open
    wrapMode: Text.WordWrap
    textFormat: Text.StyledText
    lineHeight: 1.25
    color: help.bone
    opacity: 0.82
    font.family: "Noto Serif"
    font.pixelSize: 12
    text: help.body
  }
}
