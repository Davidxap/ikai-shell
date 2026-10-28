import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import "../ItoLayouts.js" as Layouts

// Profiles: one place for every whole-bar look. The ready-made arrangements (Classic, Cluster, Compact...) sit
// beside the ones you have saved yourself under a name -- applying either changes the same things (where every
// widget sits, and for a saved one, its colours too), so there is no longer a "Designs" section on the Bars page
// and a separate "Setups" section here that both do a version of the same thing.
//
// Below that: every desktop shell installed on this machine, with the one that is running. IKAI is one shell
// among whatever else the person has (Omarchy's own, Shibumi, Caelestia, Waybar…). bin/ito-shells finds them from
// three kinds of evidence — the user's own switcher, the Omarchy variant files, and known shells on PATH — and
// switching goes back through their switcher when they have one, so keybindings and GTK authority move with it.
ColumnLayout {
  id: page

  property var cc: null
  readonly property var pal: cc.pal
  readonly property var act: cc.actions
  readonly property color bone: pal.bone

  property var shells: []
  property bool hasSwitcher: false
  property string pending: ""

  spacing: 10

  readonly property string profileTool: Qt.resolvedUrl("../bin/ito-profile").toString().replace("file://", "")
  property var setups: []
  property string setupMessage: ""
  // Delete asks once, in place: the row that is armed (a second tap on it deletes for real), and when it was
  // armed, so it disarms itself if left alone -- a click days later should not still mean "yes, delete this."
  property string deleteArmedFor: ""
  Timer { id: deleteDisarm; interval: 4000; onTriggered: page.deleteArmedFor = "" }
  // Saving over a name that already exists: the same two-tap arming, on the Save button itself.
  property bool saveArmed: false
  Timer { id: saveDisarm; interval: 4000; onTriggered: page.saveArmed = false }

  Process {
    id: setupList
    command: [page.profileTool, "list"]
    running: true
    stdout: StdioCollector {
      onStreamFinished: { try { page.setups = JSON.parse(this.text) } catch (e) { page.setups = [] } }
    }
  }
  Process {
    id: setupSave
    property string name: ""
    command: [page.profileTool, "save", name]
    onExited: function(code) {
      page.setupMessage = code === 0 ? "Saved “" + name + "”." : "It could not be saved."
      setupList.running = true
    }
  }
  Process {
    id: setupLoad
    property string name: ""
    property string only: ""                       // "", "look" or "layout": a setup has both, and either can come back alone
    command: only === "" ? [page.profileTool, "load", name] : [page.profileTool, "load", name, "--only", only]
  }
  Process {
    id: setupDelete
    property string name: ""
    command: [page.profileTool, "delete", name]
    onExited: setupList.running = true
  }

  Process {
    id: scan
    command: [Qt.resolvedUrl("../bin/ito-shells").toString().replace("file://", "")]
    running: true
    stdout: StdioCollector {
      onStreamFinished: {
        try {
          var parsed = JSON.parse(this.text)
          page.shells = parsed.shells || []
          page.hasSwitcher = parsed.switcher === true
        } catch (e) {
          page.shells = []
        }
      }
    }
  }

  Process { id: switcher }

  function switchTo(id) {
    page.pending = id
    switcher.command = [Qt.resolvedUrl("../bin/ito-shells").toString().replace("file://", ""), "--switch", id]
    switcher.running = true
    page.cc.close()
  }

  CcSection {
    host: page.cc
    startOpen: true
    pal: page.pal
    label: "PROFILES"
    note: "One whole look for the bar, applied in a click: where every widget sits, and its own colours for one you saved yourself. The ready-made ones below never change; your own are copies of the bar exactly as you left it."

    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      label: "A ready-made profile also sets its own shape"
      hint: "Off: applying one keeps the shape you already have (Bars → Shape). On: it switches to the shape it was made for, shown on its card."
      on: String(page.pal.get("designShape", "keep")) === "design"
      onActivated: page.act.set("designShape", on ? "keep" : "design")
    }

    Text {
      Layout.fillWidth: true
      text: "READY-MADE"
      color: page.bone
      opacity: 0.55
      font.family: "Noto Serif"
      font.pixelSize: 10
      font.letterSpacing: 3
      Layout.topMargin: 4
    }

    GridLayout {
      Layout.fillWidth: true
      columns: 3
      rowSpacing: 8
      columnSpacing: 8

      Repeater {
        model: Layouts.designs

        CcCard {
          id: design
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredHeight: 84
          host: page.cc
          pal: page.pal
          caption: modelData.name
          hint: modelData.note + " Click to apply it now; the bar restarts for a moment."
          visible: page.cc.match(modelData.name + " " + modelData.note + " design profile ready-made")
          onActivated: page.act.applyDesign(modelData)

          // the shape it was made for
          Text {
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.margins: 8
            text: page.act.formName(design.modelData.form)
            color: page.bone
            opacity: 0.4
            font.family: "Noto Serif"
            font.pixelSize: 9
            font.letterSpacing: 1
          }

          // where the widgets go: left, centre and right as three little runs of beads
          Row {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 16
            spacing: 10

            Repeater {
              model: ["left", "center", "right"]

              Row {
                required property string modelData
                readonly property int n: design.modelData[modelData].length
                spacing: 2
                visible: n > 0

                Repeater {
                  model: parent.n
                  Rectangle {
                    width: 5
                    height: 5
                    radius: 2.5
                    color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.6)
                  }
                }
              }
            }
          }
        }
      }
    }

    Text {
      Layout.fillWidth: true
      Layout.topMargin: 10
      text: "YOUR OWN"
      color: page.bone
      opacity: 0.55
      font.family: "Noto Serif"
      font.pixelSize: 10
      font.letterSpacing: 3
    }

    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Rectangle {
        Layout.fillWidth: true
        Layout.preferredHeight: 34
        radius: 17
        color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.05)
        border.width: 1
        border.color: nameInput.activeFocus ? page.pal.blood : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.2)

        TextInput {
          id: nameInput
          anchors.fill: parent
          anchors.leftMargin: 16
          anchors.rightMargin: 16
          verticalAlignment: TextInput.AlignVCenter
          color: page.bone
          font.family: "Noto Serif"
          font.pixelSize: 12
          maximumLength: 40
          clip: true
          selectByMouse: true
          onTextChanged: page.saveArmed = false
          Text {
            visible: nameInput.text === "" && !nameInput.activeFocus
            anchors.verticalCenter: parent.verticalCenter
            text: "Name this profile, for example “Evening”"
            color: page.bone
            opacity: 0.4
            font.family: "Noto Serif"
            font.pixelSize: 12
          }
          onAccepted: saveButton.activated()
        }
      }

      CcCard {
        id: saveButton
        readonly property bool clash: page.setups.some(function(s) { return s.name === nameInput.text.trim() })
        Layout.preferredWidth: 140
        Layout.preferredHeight: 34
        radius: 17
        host: page.cc
        pal: page.pal
        showCaption: false
        current: true
        hint: page.saveArmed ? "A profile called “" + nameInput.text.trim() + "” is already there. Click again to replace it."
          : "Save the bar as it is now under this name."
        onActivated: {
          var n = nameInput.text.trim()
          if (n === "") { page.setupMessage = "Type a name first."; return }
          if (clash && !page.saveArmed) { page.saveArmed = true; saveDisarm.restart(); return }
          if (!setupSave.running) { setupSave.name = n; setupSave.running = true; nameInput.text = ""; page.saveArmed = false }
        }
        Text {
          anchors.centerIn: parent
          text: saveButton.clash ? (page.saveArmed ? "Replace it?" : "Save (replaces one)") : "Save profile"
          color: page.saveArmed ? page.pal.blood : page.pal.lit
          font.family: "Noto Serif"
          font.pixelSize: 12
        }
      }
    }

    Text {
      visible: page.setupMessage !== ""
      text: page.setupMessage
      color: page.bone
      opacity: 0.7
      font.family: "Noto Serif"
      font.pixelSize: 11
    }

    Text {
      visible: page.setups.length === 0
      text: "Nothing saved yet."
      color: page.bone
      opacity: 0.45
      font.family: "Noto Serif"
      font.pixelSize: 11
    }

    Text {
      visible: page.setups.length > 0
      Layout.fillWidth: true
      wrapMode: Text.WordWrap
      text: "Load brings back everything a profile holds (colours and layout); Look, only its colours, effects, marks and pictures; Layout, only its shape and widgets. Load and Layout restart the bar for a few seconds; Look does not."
      color: page.bone
      opacity: 0.45
      font.family: "Noto Serif"
      font.pixelSize: 10
    }

    Repeater {
      model: page.setups

      Rectangle {
        id: row
        required property var modelData
        readonly property bool armed: page.deleteArmedFor === modelData.name
        Layout.fillWidth: true
        Layout.preferredHeight: 48
        radius: 12
        visible: page.cc.match(modelData.name + " profile setup")
        color: armed ? Qt.rgba(page.pal.blood.r, page.pal.blood.g, page.pal.blood.b, 0.1)
          : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.035)
        border.width: 1
        border.color: armed ? Qt.rgba(page.pal.blood.r, page.pal.blood.g, page.pal.blood.b, 0.5)
          : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.12)
        Behavior on color { ColorAnimation { duration: 120 } }

        RowLayout {
          anchors.fill: parent
          anchors.leftMargin: 14
          anchors.rightMargin: 10
          spacing: 10

          Column {
            Layout.fillWidth: true
            spacing: 1
            Text { text: row.modelData.name; color: page.bone; font.family: "Noto Serif"; font.pixelSize: 13 }
            Text { text: "Saved " + row.modelData.saved; color: page.bone; opacity: 0.45; font.family: "Noto Serif"; font.pixelSize: 10 }
          }

          Repeater {
            model: [
              { "label": "Load", "only": "", "w": 52 },
              { "label": "Look", "only": "look", "w": 50 },
              { "label": "Layout", "only": "layout", "w": 58 }
            ]
            CcCard {
              required property var modelData
              Layout.preferredWidth: modelData.w
              Layout.preferredHeight: 30
              radius: 15
              host: page.cc
              pal: page.pal
              showCaption: false
              hint: "Bring this profile's " + (modelData.only === "" ? "everything" : modelData.only === "look" ? "colours only" : "shape and widgets only") + " back."
              onActivated: if (!setupLoad.running) { setupLoad.name = ""; setupLoad.only = modelData.only; setupLoad.name = row.modelData.name; setupLoad.running = true; if (modelData.only !== "look") page.cc.close() }
              Text { anchors.centerIn: parent; text: modelData.label; color: page.pal.lit; font.family: "Noto Serif"; font.pixelSize: 11 }
            }
          }
          CcCard {
            Layout.preferredWidth: row.armed ? 76 : 62
            Layout.preferredHeight: 30
            radius: 15
            host: page.cc
            pal: page.pal
            showCaption: false
            hint: row.armed ? "Click again to delete it for good." : "Delete this saved profile. The bar itself does not change."
            onActivated: {
              if (!row.armed) { page.deleteArmedFor = row.modelData.name; deleteDisarm.restart(); return }
              if (!setupDelete.running) { setupDelete.name = row.modelData.name; setupDelete.running = true; page.deleteArmedFor = "" }
            }
            Text {
              anchors.centerIn: parent
              text: row.armed ? "Really delete?" : "Delete"
              color: row.armed ? page.pal.blood : page.bone
              font.family: "Noto Serif"
              font.pixelSize: 11
            }
          }
        }
      }
    }
  }

  CcSection {
    host: page.cc
    startOpen: true
    pal: page.pal
    label: "SHELLS"
    note: page.hasSwitcher
      ? "Switching goes through your own shell-switch, so keybindings and GTK follow along."
      : "Switching starts the other shell and stops this one."


    Repeater {
      model: page.shells

      Rectangle {
        id: shellRow
        required property var modelData
        readonly property bool active: modelData.active

        Layout.fillWidth: true
        Layout.preferredHeight: 62
        radius: 12
        color: hover.hovered ? Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.08)
          : (active ? Qt.rgba(page.pal.blood.r, page.pal.blood.g, page.pal.blood.b, 0.12)
                    : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.03))
        border.width: 1
        border.color: active ? Qt.rgba(page.pal.blood.r, page.pal.blood.g, page.pal.blood.b, 0.7)
          : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.12)
        visible: page.cc.match(modelData.name + " " + modelData.id + " shell")
        Behavior on color { ColorAnimation { duration: 130 } }

        // Fixed places, so every row lines up: the mark at the left, the names after it, and the button (or RUNNING)
        // in a column of its own at the right edge. Left to a RowLayout, the button drifted with the width of the text.
        Item {
          anchors.fill: parent

          Rectangle {
            id: mark
            x: 18
            anchors.verticalCenter: parent.verticalCenter
            width: 10
            height: 10
            rotation: 45
            radius: 2
            color: shellRow.active ? page.pal.blood : "transparent"
            border.width: 1.2
            border.color: shellRow.active ? page.pal.blood : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.45)
          }

          Column {
            anchors.left: mark.right
            anchors.leftMargin: 18
            anchors.right: action.left
            anchors.rightMargin: 10
            anchors.verticalCenter: parent.verticalCenter
            spacing: 2

            Row {
              spacing: 8
              Text {
                text: shellRow.modelData.name
                color: shellRow.modelData.ours ? page.pal.lit : page.bone
                font.family: "Noto Serif"
                font.pixelSize: 14
              }
              Text {
                visible: shellRow.modelData.ours
                topPadding: 4
                text: "this one"
                color: page.pal.blood
                opacity: 0.8
                font.family: "Noto Serif"
                font.pixelSize: 10
                font.letterSpacing: 1
              }
            }

            Text {
              width: parent.width
              elide: Text.ElideRight
              text: shellRow.modelData.barId !== "" ? shellRow.modelData.barId
                : (shellRow.modelData.variant ? "Omarchy variant" : "installed")
              color: page.bone
              opacity: 0.45
              font.family: "Noto Serif"
              font.pixelSize: 10
            }
          }

          Item {
            id: action
            anchors.right: parent.right
            anchors.rightMargin: 16
            anchors.verticalCenter: parent.verticalCenter
            width: 104
            height: 32

            Text {
              visible: shellRow.active
              anchors.centerIn: parent
              text: "RUNNING"
              color: page.pal.blood
              font.family: "Noto Serif"
              font.pixelSize: 10
              font.letterSpacing: 2
            }

            Rectangle {
              visible: !shellRow.active
              anchors.fill: parent
              radius: 16
              color: go.hovered ? Qt.rgba(page.pal.blood.r, page.pal.blood.g, page.pal.blood.b, 0.32) : "transparent"
              border.width: 1
              border.color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.25)
              Behavior on color { ColorAnimation { duration: 120 } }

              Text {
                anchors.centerIn: parent
                text: page.pending === shellRow.modelData.id ? "starting…" : "Switch"
                color: page.bone
                font.family: "Noto Serif"
                font.pixelSize: 12
              }

              HoverHandler {
                id: go
                cursorShape: Qt.PointingHandCursor
                onHoveredChanged: page.cc.hint = hovered
                  ? "Stop this shell and start " + shellRow.modelData.name + "." : ""
              }
              TapHandler { onTapped: page.switchTo(shellRow.modelData.id) }
            }
          }
        }

        HoverHandler {
          id: hover
          onHoveredChanged: page.cc.hint = hovered && shellRow.active
            ? shellRow.modelData.name + " is the shell you are looking at." : page.cc.hint
        }
      }
    }


    CcCard {
      Layout.preferredWidth: 130
      Layout.preferredHeight: 34
      Layout.topMargin: 4
      radius: 17
      host: page.cc
      pal: page.pal
      showCaption: false
      hint: "Look for installed shells again."
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


  // S13f: the one global reset. Armed by a first click; the second puts every look setting of every page back to its default. It keeps your
  // colours, your own art and icons, and the lock / fetch / screensaver switches that mirror real files. A backup is written first and
  // "Undo reset" (header, 12 s) or `ito-config restore` brings it back.
  property bool resetArmed: false
  Timer { id: resetEverythingDisarm; interval: 4000; onTriggered: page.resetArmed = false }

  CcSection {
    host: page.cc
    pal: page.pal
    label: "RESET"
    note: "Every look setting of every page back to how it shipped. Your colours, your own art and icons, and the lock, fetch and screensaver switches stay. A backup is kept and Undo shows for a few seconds."

    CcCard {
      Layout.preferredWidth: 200
      Layout.preferredHeight: 34
      radius: 17
      host: page.cc
      pal: page.pal
      showCaption: false
      hint: page.resetArmed ? "Click again to really reset everything." : "Put every look setting of every page back to its default (a backup is written first)."
      onActivated: {
        if (!page.resetArmed) { page.resetArmed = true; resetEverythingDisarm.restart(); return }
        page.resetArmed = false
        page.act.resetEverything()
      }
      Text {
        anchors.centerIn: parent
        text: page.resetArmed ? "Really?" : "Reset everything"
        color: page.resetArmed ? page.pal.blood : page.bone
        font.family: "Noto Serif"
        font.pixelSize: 12
      }
    }
  }

  CcSection {
    host: page.cc
    pal: page.pal
    label: "ABOUT"
    note: "IKAI 異界, made by davidxap. Formerly Ito-verse. Inspired by Junji Ito and Silent Hill; not affiliated with Junji Ito or Konami. The bar engine is a fork of Shibumi-Shell by HANCORE (MIT); five widgets are Omarchy's own, re-skinned. Code under the MIT licence, art under its own terms: see LICENSE, ART_LICENSE.md and NOTICE in the repository."

    Text {
      text: "github.com/Davidxap/ikai-shell"
      color: page.pal.lit
      font.family: "Noto Serif"
      font.pixelSize: 12
      MouseArea {
        anchors.fill: parent
        cursorShape: Qt.PointingHandCursor
        onClicked: Quickshell.execDetached(["xdg-open", "https://github.com/Davidxap/ikai-shell"])
      }
    }
  }
}
