import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io

// Plugins: everything the shell could load, wherever it came from. A plugin is a folder with a manifest and
// its QML; IKAI's own widgets, Omarchy's and any other are listed the same way, so the shell is not
// tied to one distribution's widgets.
ColumnLayout {
  id: page

  property var cc: null
  readonly property var pal: cc.pal
  readonly property var act: cc.actions
  readonly property color bone: pal.bone

  property var plugins: []
  property string filter: "ito"               // ito | third | widgets | all

  spacing: 10

  readonly property string home: Quickshell.env("HOME")

  Process {
    id: scan
    command: [Qt.resolvedUrl("../bin/ito-plugins").toString().replace("file://", "")]
    running: true
    stdout: StdioCollector {
      onStreamFinished: {
        try { page.plugins = JSON.parse(this.text) } catch (e) { page.plugins = [] }
      }
    }
  }

  readonly property var shown: {
    var out = []
    for (var i = 0; i < plugins.length; i++) {
      var p = plugins[i]
      if (filter === "ito" && p.source !== "IKAI") continue
      if (filter === "third" && (p.source === "IKAI" || p.source === "Shibumi" || p.source === "Omarchy")) continue
      if (filter === "widgets" && !p.widget) continue
      if (!cc.match(p.name + " " + p.id + " " + p.description + " " + p.source)) continue
      out.push(p)
    }
    return out
  }

  CcSection {
    host: page.cc
    startOpen: true
    pal: page.pal
    label: "INSTALLED"
    note: "How it works: every plugin the shell can find is listed here, ours, Omarchy's, Shibumi's and any you install. Press Add to put a widget on the bar (it lands on the right; move it from the Icons page). Press Remove to take it off. To install a new one, drop its folder into ~/.config/omarchy/plugins and press Rescan. " + page.plugins.filter(function(p) { return p.source === "IKAI" }).length + " of IKAI, "
      + page.plugins.filter(function(p) { return p.source !== "IKAI" && p.source !== "Shibumi" && p.source !== "Omarchy" }).length + " from others."


    RowLayout {
      Layout.fillWidth: true
      spacing: 6

      Repeater {
        model: [{ "key": "ito", "label": "IKAI" }, { "key": "third", "label": "Others" },
                { "key": "widgets", "label": "All widgets" }, { "key": "all", "label": "Everything" }]

        CcCard {
          required property var modelData
          Layout.preferredWidth: 118
          Layout.preferredHeight: 32
          radius: 16
          host: page.cc
          pal: page.pal
          showCaption: false
          current: page.filter === modelData.key
          onActivated: page.filter = modelData.key

          Text {
            anchors.centerIn: parent
            text: modelData.label
            color: parent.current ? page.pal.lit : page.bone
            font.family: "Noto Serif"
            font.pixelSize: 12
          }
        }
      }

      Item { Layout.fillWidth: true }

      CcCard {
        Layout.preferredWidth: 90
        Layout.preferredHeight: 32
        radius: 16
        host: page.cc
        pal: page.pal
        showCaption: false
        hint: "Look for plugins again."
        onActivated: scan.running = true

        Text {
          anchors.centerIn: parent
          text: "Rescan"
          color: page.bone
          font.family: "Noto Serif"
          font.pixelSize: 12
        }
      }
    }


    Repeater {
      model: page.shown

      Rectangle {
        required property var modelData
        Layout.fillWidth: true
        Layout.preferredHeight: 56
        radius: 12
        color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.035)
        border.width: 1
        border.color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.12)

        HoverHandler { onHoveredChanged: page.cc.hint = hovered ? String(modelData.dir).replace(page.home, "~") : "" }

        RowLayout {
          anchors.fill: parent
          anchors.leftMargin: 14
          anchors.rightMargin: 14
          spacing: 12

          Rectangle {
            Layout.alignment: Qt.AlignVCenter
            width: 9
            height: 9
            rotation: 45
            radius: 2
            color: modelData.onBar ? page.pal.blood : "transparent"
            border.width: 1.2
            border.color: modelData.onBar ? page.pal.blood : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.45)
          }

          ColumnLayout {
            Layout.fillWidth: true
            spacing: 1

            Text {
              text: modelData.name
              color: page.bone
              font.family: "Noto Serif"
              font.pixelSize: 13
            }

            Text {
              Layout.fillWidth: true
              text: modelData.id + (modelData.description !== "" ? "  ·  " + modelData.description : "")
              color: page.bone
              opacity: 0.5
              elide: Text.ElideRight
              font.family: "Noto Serif"
              font.pixelSize: 10
            }
          }

          Repeater {
            model: modelData.kinds

            Rectangle {
              required property string modelData
              Layout.alignment: Qt.AlignVCenter
              implicitWidth: kindText.implicitWidth + 14
              implicitHeight: 20
              radius: 10
              color: "transparent"
              border.width: 1
              border.color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.25)

              Text {
                id: kindText
                anchors.centerIn: parent
                text: modelData
                color: page.bone
                opacity: 0.7
                font.family: "Noto Serif"
                font.pixelSize: 9
              }
            }
          }

          Text {
            Layout.alignment: Qt.AlignVCenter
            Layout.preferredWidth: 62
            horizontalAlignment: Text.AlignRight
            text: modelData.source
            color: modelData.source === "IKAI" ? page.pal.blood : page.bone
            opacity: 0.85
            font.family: "Noto Serif"
            font.pixelSize: 11
          }

          // on the bar, or not: a plugin from anywhere can be put on it
          Rectangle {
            Layout.alignment: Qt.AlignVCenter
            visible: modelData.widget
            Layout.preferredWidth: 86
            Layout.preferredHeight: 30
            radius: 15
            color: put.hovered ? Qt.rgba(page.pal.blood.r, page.pal.blood.g, page.pal.blood.b, 0.3) : "transparent"
            border.width: 1
            border.color: modelData.onBar ? Qt.rgba(page.pal.blood.r, page.pal.blood.g, page.pal.blood.b, 0.55)
              : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.25)
            Behavior on color { ColorAnimation { duration: 120 } }

            Text {
              anchors.centerIn: parent
              text: modelData.onBar ? "Remove" : "Add"
              color: page.bone
              font.family: "Noto Serif"
              font.pixelSize: 11
            }

            HoverHandler {
              id: put
              cursorShape: Qt.PointingHandCursor
              onHoveredChanged: page.cc.hint = hovered
                ? (modelData.onBar ? "Take " + modelData.name + " off the bar."
                   : "Put " + modelData.name + " on the right of the bar. The bar restarts for a moment.") : ""
            }

            TapHandler {
              onTapped: {
                if (modelData.onBar) page.act.removePlugin(modelData.id)
                else page.act.addPlugin(modelData.id, "right")
                page.cc.close()
              }
            }
          }
        }
      }
    }
  }

}
