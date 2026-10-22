import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import ".." as Cc

// The picture of one surface, inside that surface's tab: what the slot holds, Choose/Remove, and the ready-made
// pictures offered for it (bin/ito-marks gallery SLOT). Today's SlotRow + SlotGallery, moved here unchanged in
// behaviour; cards are 168 x 120 with a 152 x 86 thumbnail (16:9), or 86 x 86 for the terminal (1:1).
ColumnLayout {
  id: sp

  property var host: null            // the Boot & Lock page (slots, picker, clearer, report, slotsVersion)
  property string slot: ""
  property string title: ""
  property string note: ""
  property bool square: false
  property var afterPick: null
  property var pics: []
  readonly property var pal: host.pal
  readonly property string file: String(host.slots[slot] || "")
  readonly property bool own: file !== "" && pics.every(function(g) { return !g.selected })

  Layout.fillWidth: true
  spacing: 10

  Process {
    id: galReader
    command: [sp.host.marksTool, "gallery", sp.slot]
    stdout: StdioCollector { onStreamFinished: { try { sp.pics = JSON.parse(text) } catch (e) {} } }
  }
  Process {
    id: galPicker
    property string key: ""
    command: [sp.host.marksTool, "gallery", sp.slot, "pick", key]
    stdout: StdioCollector { id: galPickOut }
    stderr: StdioCollector { id: galPickErr }
    onExited: function(code) {
      sp.host.report(galPickOut.text, galPickErr.text)
      sp.host.rereadSlots()
      if (code === 0 && sp.afterPick) sp.afterPick()
    }
  }
  Connections {
    target: sp.host
    function onSlotsVersionChanged() { galReader.running = true }
  }
  Component.onCompleted: galReader.running = true

  RowLayout {
    Layout.fillWidth: true
    spacing: 12

    ColumnLayout {
      Layout.fillWidth: true
      spacing: 2
      Text {
        text: sp.title
        color: sp.pal.bone
        font.family: "Noto Serif"
        font.pixelSize: 13
        font.weight: Font.DemiBold
      }
      Text {
        Layout.fillWidth: true
        text: sp.file === "" ? "Empty. " + sp.note : sp.host.fileName(sp.file)
        color: sp.pal.bone
        opacity: 0.72
        elide: Text.ElideRight
        font.family: "Noto Serif"
        font.pixelSize: 12
      }
    }
    Cc.CcCard {
      Layout.preferredWidth: 146; Layout.preferredHeight: 36
      radius: 18; host: sp.host.cc; pal: sp.pal; showCaption: false
      hint: "Pick your own picture for this. It is kept as it is, on this machine only; it never goes into the shell's files."
      onActivated: sp.host.pickInto(sp.slot)
      Text { anchors.centerIn: parent; text: sp.file === "" ? "Choose picture" : "Change"; color: sp.pal.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
    }
    Cc.CcCard {
      Layout.preferredWidth: 110; Layout.preferredHeight: 36
      radius: 18; host: sp.host.cc; pal: sp.pal; showCaption: false
      opacity: sp.file === "" ? 0.35 : 1
      hint: "Empty this slot. What uses it goes back to its plain default."
      onActivated: if (sp.file !== "") sp.host.clearSlot(sp.slot)
      Text { anchors.centerIn: parent; text: "Remove"; color: sp.pal.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
    }
  }

  Flow {
    Layout.fillWidth: true
    spacing: 8

    Repeater {
      model: sp.pics
      Cc.CcCard {
        required property var modelData
        width: 168; height: 120
        radius: 10
        host: sp.host.cc; pal: sp.pal
        caption: modelData.name
        captionSize: 11
        hint: "Use this picture."
        current: modelData.selected === true
        onActivated: if (!galPicker.running) { galPicker.key = modelData.key; galPicker.running = true }
        Rectangle {
          anchors.top: parent.top; anchors.topMargin: 8
          anchors.horizontalCenter: parent.horizontalCenter
          width: sp.square ? 86 : 152; height: 86
          radius: 6; clip: true
          color: sp.pal.ink
          Image {
            anchors.fill: parent
            source: "file://" + modelData.file
            fillMode: Image.PreserveAspectCrop
            sourceSize.width: 304; sourceSize.height: 172
            asynchronous: true; smooth: true; mipmap: true
          }
        }
      }
    }
    Cc.CcCard {
      width: 168; height: 120
      radius: 10
      host: sp.host.cc; pal: sp.pal
      caption: sp.own ? sp.host.fileName(sp.file) : "Your own"
      captionSize: 11
      hint: "Pick a picture of your own."
      current: sp.own
      onActivated: sp.host.pickInto(sp.slot)
      Text {
        anchors.top: parent.top; anchors.topMargin: 8
        anchors.horizontalCenter: parent.horizontalCenter
        width: 86; height: 86
        text: "+"
        color: sp.pal.bone; opacity: 0.55
        font.pixelSize: 30
        horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter
      }
    }
  }
}
