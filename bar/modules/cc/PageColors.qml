import QtQuick
import QtQuick.Layouts
import ".." as Ito

// Colors: the shell has its own palette (bone on ink, blood the one live colour), and it can instead follow
// the installed theme. When it follows, its accent is any colour of that theme, or one typed in, and all of
// the art is recoloured to match.
ColumnLayout {
  id: page

  property var cc: null
  readonly property var pal: cc.pal
  readonly property var act: cc.actions
  readonly property color bone: pal.bone
  readonly property url art: Qt.resolvedUrl("../ito-art/")
  readonly property bool follow: pal.followTheme

  spacing: 10

  CcSection {
    host: page.cc
    startOpen: true
    pal: page.pal
    label: "PALETTE"
    note: page.follow
      ? "The shell wears the installed theme: its accent is the blood, its foreground the bone."
      : "The shell keeps its own palette, whatever theme is installed: bone on ink, blood the one live colour."


    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: [
          { "key": "theme", "name": "Follow theme", "note": "Take the colours of the installed theme, and change with it. This is the default." },
          { "key": "ito",   "name": "IKAI", "note": "The shell's own palette: bone on ink, blood the one live colour. It does not change with the theme." }
        ]

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredHeight: 92
          host: page.cc
          pal: page.pal
          caption: modelData.name
          hint: modelData.note
          current: String(page.pal.get("colorMode", "theme")) === modelData.key
          onActivated: page.act.set("colorMode", modelData.key)

          // three chips: the bone, the ink and the blood this choice would paint with
          Row {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 14
            spacing: 8

            Repeater {
              model: modelData.key === "ito"
                ? ["#c7ccd1", "#0b0d0e", "#c4162a"]
                : [page.pal.themeColors["foreground"] || "#c7ccd1",
                   page.pal.themeColors["background"] || "#0b0d0e",
                   page.pal.themeColors["accent"] || "#c4162a"]

              Rectangle {
                required property string modelData
                width: 30
                height: 30
                radius: 15
                color: modelData
                border.width: 1
                border.color: Qt.rgba(1, 1, 1, 0.25)
              }
            }
          }
        }
      }
    }
  }


  // ---------------------------------------------------------------- accent
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    visible: page.follow
    pal: page.pal
    label: "ACCENT"
    note: "Which colour of the installed theme is the blood: everything red on the bar becomes it."


    GridLayout {
      visible: page.follow
      Layout.fillWidth: true
      columns: 9
      rowSpacing: 8
      columnSpacing: 8

      Repeater {
        // Whatever the installed theme names: its accent, its named colours, and its numbered palette.
        model: {
          var out = [{ "key": "accent", "name": "Theme accent" }, { "key": "ito", "name": "Ito blood" }]
          var named = ["red", "orange", "yellow", "green", "cyan", "blue", "magenta", "brown", "cursor",
                       "bright_red", "bright_yellow", "bright_green", "bright_cyan", "bright_blue", "bright_magenta"]
          for (var n = 0; n < named.length; n++)
            out.push({ "key": named[n], "name": named[n].replace("_", " ") })
          for (var i = 1; i <= 15; i++) out.push({ "key": "color" + i, "name": "Colour " + i })
          return out
        }

        Rectangle {
          id: swatch
          required property var modelData
          readonly property color tone: modelData.key === "ito" ? "#c4162a" : (page.pal.themeColors[modelData.key] || "transparent")
          readonly property bool chosen: String(page.pal.get("accentSource", "accent")) === modelData.key

          Layout.preferredWidth: 52
          Layout.preferredHeight: 44
          radius: 12
          color: tone
          border.width: chosen ? 2 : 1
          border.color: chosen ? page.bone : Qt.rgba(1, 1, 1, 0.18)
          // a swatch only exists when the installed theme names that colour (the Ito blood is always there)
          visible: modelData.key === "ito" || (page.pal.themeColors[modelData.key] !== undefined && tone.a > 0)
          scale: swatchHover.hovered ? 1.06 : 1
          Behavior on scale { NumberAnimation { duration: 100 } }

          HoverHandler {
            id: swatchHover
            cursorShape: Qt.PointingHandCursor
            onHoveredChanged: page.cc.hint = hovered ? swatch.modelData.name + "  " + swatch.tone : ""
          }
          TapHandler { onTapped: page.act.set("accentSource", swatch.modelData.key) }
        }
      }
    }


    RowLayout {
      visible: page.follow
      Layout.fillWidth: true
      spacing: 10

      Text {
        text: "Custom"
        color: page.bone
        opacity: 0.75
        font.family: "Noto Serif"
        font.pixelSize: 12
      }

      Rectangle {
        Layout.preferredWidth: 130
        Layout.preferredHeight: 34
        radius: 10
        color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.05)
        border.width: 1
        border.color: String(page.pal.get("accentSource", "accent")) === "custom" ? page.pal.blood : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.2)

        TextInput {
          id: hex
          anchors.fill: parent
          anchors.margins: 9
          verticalAlignment: TextInput.AlignVCenter
          color: page.bone
          selectionColor: page.pal.blood
          font.family: "Noto Serif"
          font.pixelSize: 13
          text: String(page.pal.get("accentCustom", "#c4162a"))
          maximumLength: 7
          validator: RegularExpressionValidator { regularExpression: /^#?[0-9a-fA-F]{0,6}$/ }
          onAccepted: page.applyCustom()
          onActiveFocusChanged: if (activeFocus) page.cc.grabKeys = true
        }
      }

      CcCard {
        Layout.preferredWidth: 90
        Layout.preferredHeight: 34
        radius: 17
        host: page.cc
        pal: page.pal
        showCaption: false
        hint: "Use this colour as the accent."
        onActivated: page.applyCustom()

        Text {
          anchors.centerIn: parent
          text: "Apply"
          color: page.bone
          font.family: "Noto Serif"
          font.pixelSize: 12
        }
      }
    }
  }


  // ---------------------------------------------------------------- preview
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "PREVIEW"
    note: "The same art in the colours the bar is using now."


    Rectangle {
      Layout.fillWidth: true
      Layout.preferredHeight: 84
      radius: 14
      color: page.pal.ink
      border.width: 1
      border.color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.15)

      Row {
        anchors.centerIn: parent
        spacing: 22

        Repeater {
          model: ["workspaces/workspace-2.png", "status-eyes/eye-red.png", "status-eyes/eye-normal.png",
                  "system/menu-metatron.png", "system/brain.png", "system/menu-uzumaki.png"]

          Ito.ItoImage {
            required property string modelData
            palette: page.pal
            width: 46
            height: 46
            source: page.art + modelData
          }
        }
      }
    }
  }


  function applyCustom() {
    var v = hex.text.charAt(0) === "#" ? hex.text : "#" + hex.text
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      act.setMany({ "accentCustom": v, "accentSource": "custom" })
    }
  }
}
