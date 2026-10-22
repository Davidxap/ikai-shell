import QtQuick
import QtQuick.Layouts
import "../../../../bar/modules" as Ito

// What editing the bar is, said while you do it.
//
// Rearranging is one gesture: pick an icon up and drop it on another to trade places. So the card
// says that, in a sentence, and gives the two things you might want next: Done, and put everything
// back. It replaces the grid of empty slots and the + and × buttons the original editor drew.
Item {
  id: root

  property var bar: null
  property var layoutSession: null

  width: 520
  height: 92

  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  readonly property color blood: cfg.blood
  readonly property color bone: cfg.bone

  Ito.ItoPlate {
    palette: cfg
    anchors.fill: parent
    radius: 16
    artBase: Qt.resolvedUrl("../../../../bar/modules/ito-art/")
    veins: 0
    calm: 0
    grain: 0.10
    tone: 0
    border: false
  }

  Rectangle {
    anchors.fill: parent
    radius: 16
    color: "transparent"
    border.width: 1
    border.color: Qt.rgba(root.blood.r, root.blood.g, root.blood.b, 0.5)
  }

  RowLayout {
    anchors.fill: parent
    anchors.margins: 18
    spacing: 16

    ColumnLayout {
      Layout.fillWidth: true
      spacing: 3

      Text {
        text: "EDITING THE BAR"
        color: root.bone
        font.family: "Noto Serif"
        font.pixelSize: 11
        font.weight: Font.DemiBold
        font.letterSpacing: 3
      }

      Text {
        Layout.fillWidth: true
        text: "Drag any icon onto another to trade places. That is all."
        color: root.bone
        opacity: 0.85
        font.family: "Noto Serif"
        font.pixelSize: 13
        wrapMode: Text.WordWrap
      }
    }

    Repeater {
      model: [
        { "label": "Reset", "act": "reset" },
        { "label": "Done",  "act": "done" }
      ]

      Rectangle {
        required property var modelData
        readonly property bool primary: modelData.act === "done"

        Layout.preferredWidth: 78
        Layout.preferredHeight: 34
        radius: 17
        color: hover.containsMouse
          ? Qt.rgba(root.blood.r, root.blood.g, root.blood.b, primary ? 0.55 : 0.25)
          : (primary ? Qt.rgba(root.blood.r, root.blood.g, root.blood.b, 0.35) : "transparent")
        border.width: 1
        border.color: primary ? root.blood : Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.4)
        Behavior on color { ColorAnimation { duration: 120 } }

        Text {
          anchors.centerIn: parent
          text: modelData.label
          color: root.bone
          font.family: "Noto Serif"
          font.pixelSize: 13
        }

        MouseArea {
          id: hover
          anchors.fill: parent
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onClicked: {
            if (modelData.act === "done") {
              if (root.layoutSession) root.layoutSession.setEditing(false)
            } else if (root.bar && root.bar.layoutController
                       && typeof root.bar.layoutController.resetLayout === "function") {
              root.bar.layoutController.resetLayout()
            }
          }
        }
      }
    }
  }
}
