import QtQuick
import QtQuick.Layouts
import ".." as Ito
import "../ItoSurfaces.js" as Surfaces
import "../ItoFrameStyles.js" as Styles
import "../ItoApplies.js" as Applies

// Bars: the bar as an object (S13e): where it sits, its shape and details, and what its plate and world are made of. Popups, frames, openings and eyes are on Styles.
ColumnLayout {
  id: page

  property var cc: null
  readonly property var pal: cc.pal
  readonly property var act: cc.actions
  readonly property color bone: pal.bone
  // D4: why an option does nothing in this shape, "" when it applies (ItoApplies.js); the controls dim and say it
  function na(key) { return Applies.why(key, page.pal, page.act.currentForm) }

  // Reset layout changes a great deal at once and cannot be undone from here, so the first click only arms the button
  // (a plain click elsewhere, or a few seconds, disarms it); the second one, on the same button, actually does it.
  // Every other reset on this page is the "↺" of a control, of a section, or the page one in the header (S13f).
  property string armedReset: ""
  Timer { id: resetDisarm; interval: 4000; onTriggered: page.armedReset = "" }

  spacing: 10

  // the frames, openings, eyes and lore live on one page, with a preview for every choice
  CcCard {
    Layout.fillWidth: true
    Layout.preferredHeight: 44
    radius: 12
    host: page.cc
    pal: page.pal
    showCaption: false
    hint: "Popup frames, how popups open, the eyes, the lore and the whole-look presets: all on the Styles page, each with a preview."
    onActivated: page.cc.page = "styles"
    Text {
      anchors.verticalCenter: parent.verticalCenter
      anchors.left: parent.left
      anchors.leftMargin: 16
      text: "Frames, openings, eyes and presets are on Styles  →"
      color: page.pal.lit
      font.family: "Noto Serif"
      font.pixelSize: 13
    }
  }

  // ---------------------------------------------------------------- position
  CcSection {
    host: page.cc
    startOpen: true
    pal: page.pal
    label: "POSITION"
    note: "Which edge of the screen the bar takes. On the sides the widgets stack and show icons."


    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: Surfaces.positions

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.preferredHeight: 84
          host: page.cc
          pal: page.pal
          caption: modelData.name
          hint: modelData.note
          current: page.act.position === modelData.key
          visible: page.cc.match(modelData.name + " " + modelData.note + " position edge side")
          onActivated: page.act.setPosition(modelData.key)

          // the screen, and the bar along one of its edges
          Item {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 10
            width: 60
            height: 38

            Rectangle {
              anchors.fill: parent
              radius: 3
              color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.06)
            }

            Rectangle {
              x: parent.width * modelData.x
              y: parent.height * modelData.y
              width: Math.max(6, parent.width * modelData.w)
              height: Math.max(6, parent.height * modelData.h)
              radius: 2
              color: parent.parent.current ? page.pal.blood : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.5)
              Behavior on color { ColorAnimation { duration: 140 } }
            }
          }
        }
      }
    }


    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      label: "Float off the edge"
      hint: "Off (default): the bar touches the screen edge it is on, with no gap. On: it floats clear of the edge as a pill."
      on: page.pal.get("barFloat", false) === true
      resetKeys: ["barFloat"]
      naReason: page.na("barFloat")
      onActivated: page.act.set("barFloat", on ? "false" : "true")
    }

    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      label: "Dock floats"
      hint: "On (default): the Dock hangs clear of the screen edge as a pill, like the Islands. Off: it sits against the edge."
      on: String(page.pal.get("dockFloat", true)) !== "false"
      resetKeys: ["dockFloat"]
      naReason: page.na("dockFloat")
      onActivated: page.act.set("dockFloat", on ? "false" : "true")
    }
  }


  // ---------------------------------------------------------------- shape
  CcSection {
    startOpen: true
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "SHAPE"
    note: {
      var forms = Surfaces.forms
      for (var i = 0; i < forms.length; i++)
        if (forms[i].key === page.act.currentForm) return forms[i].note + " Islands and the other shapes keep separate arrangements."
      return ""
    }


    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: Surfaces.forms

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredHeight: 88
          host: page.cc
          pal: page.pal
          caption: modelData.name
          hint: modelData.note
          current: page.act.currentForm === modelData.key
          visible: page.cc.match(modelData.name + " " + modelData.note + " shape")
          onActivated: page.act.applyForm(modelData.key)

          // a diagram of the form: the top of a screen, and the bar in it
          Item {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 12
            width: 104
            height: 34

            Rectangle {
              anchors.fill: parent
              radius: 3
              color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.06)
            }

            Rectangle {
              x: (parent.width - width) / 2
              y: modelData.gap
              width: parent.width * modelData.w
              height: 12
              radius: modelData.r * 6
              // a flush bar keeps its top square
              Rectangle {
                visible: modelData.flat && modelData.r > 0
                anchors.top: parent.top
                anchors.left: parent.left
                anchors.right: parent.right
                height: parent.radius
                color: parent.color
              }
              color: parent.parent.current ? page.pal.blood : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.5)
              Behavior on color { ColorAnimation { duration: 140 } }

              // the notch's shoulders: a lighter flare on each side, melting into the edge
              Repeater {
                model: modelData.notch ? [0, 1] : []

                Rectangle {
                  required property int modelData
                  x: modelData === 0 ? -6 : parent.width
                  y: 0
                  width: 6
                  height: 5
                  radius: 0
                  color: Qt.rgba(parent.color.r, parent.color.g, parent.color.b, 0.55)
                }
              }
            }
          }
        }
      }
    }


    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      label: "Same look in every shape"
      sub: "Form parity"
      hint: "On: Dock, Fit, Full and Notch get what the Islands get: the Dock really floats, widget pills and the shadow switch work, and a bottom bar keeps its edge flat (default). Off: the earlier behaviour."
      resetKeys: ["formParity"]
      on: Surfaces.on(page.pal, "formParity")
      onActivated: page.act.set("formParity", on ? "false" : "true")
      visible: page.cc.match("form parity same look every shape dock pills shadow")
    }

    RowLayout {
      Layout.fillWidth: true
      spacing: 8
      visible: page.cc.match("cut islands split")

      Repeater {
        model: [
          { "index": 0, "label": "Cut  left | centre" },
          { "index": 1, "label": "Cut  centre | right" }
        ]

        CcToggle {
          required property var modelData
          Layout.fillWidth: true
          host: page.cc
          pal: page.pal
          label: modelData.label
          hint: "Split the bar into separate islands at this point. Only the Islands shape can be cut."
          on: page.act.cutOn(modelData.index)
          naReason: page.na(modelData.index === 0 ? "cutLeft" : "cutRight")
          onActivated: page.act.toggleCut(modelData.index)
        }
      }
    }
  }


  // ---------------------------------------------------------------- details of the shape
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "DETAILS"
    note: "How the bar is built: its corners, how tall it is, how far apart its widgets stand, and whether it casts a shadow."


    Repeater {
      model: [
        { "label": "Corners", "key": "barRadius", "fallback": "round", "tip": "How round the plate's corners are. Full runs edge to edge, so it has none.",
          "opts": [ { "v": "square", "n": "Square" }, { "v": "soft", "n": "Soft" }, { "v": "round", "n": "Round" } ] },
        { "label": "Height", "key": "barSize", "fallback": "46", "tip": "How tall the bar is. Icons and numbers grow with it.",
          "opts": [ { "v": "40", "n": "Slim" }, { "v": "46", "n": "Regular" }, { "v": "52", "n": "Tall" } ] },
        { "label": "Spacing", "key": "barGap", "fallback": "normal", "tip": "How far apart the groups of widgets stand.",
          "opts": [ { "v": "tight", "n": "Tight" }, { "v": "normal", "n": "Normal" }, { "v": "airy", "n": "Airy" } ] }
      ]

      RowLayout {
        id: detail
        required property var modelData
        Layout.fillWidth: true
        spacing: 8
        visible: page.cc.match(modelData.label + " " + modelData.tip + " corners height spacing gap thread details")
        // Full runs edge to edge, so it has no corners to round: the row says so (D4) instead of leaving the choice doing nothing.
        readonly property string naWhy: page.na(modelData.key)

        Column {
          Layout.preferredWidth: 80
          Layout.alignment: Qt.AlignVCenter
          spacing: 1
          opacity: detail.naWhy !== "" ? 0.4 : 1
          Row {
            spacing: 4
            Text {
              text: detail.modelData.label
              color: page.bone
              opacity: 0.75
              font.family: "Noto Serif"
              font.pixelSize: 12
            }
            CcReset { host: page.cc; pal: page.pal; keys: [detail.modelData.key] }
          }
          Text {
            visible: detail.naWhy !== ""
            width: parent.width
            text: detail.naWhy
            color: page.bone
            opacity: 0.6
            wrapMode: Text.WordWrap
            font.family: "Noto Serif"
            font.italic: true
            font.pixelSize: 9
          }
        }

        Repeater {
          model: detail.modelData.opts

          CcCard {
            required property var modelData
            Layout.fillWidth: true
            Layout.preferredWidth: 1
            Layout.preferredHeight: 34
            radius: 17
            host: page.cc
            pal: page.pal
            showCaption: false
            hint: detail.modelData.tip
            naReason: detail.naWhy
            current: String(page.pal.get(detail.modelData.key, detail.modelData.fallback)) === modelData.v
            onActivated: page.act.set(detail.modelData.key, modelData.v)

            Text {
              anchors.centerIn: parent
              text: modelData.n
              color: parent.current ? page.pal.lit : page.bone
              font.family: "Noto Serif"
              font.pixelSize: 12
            }
          }
        }
      }
    }


    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      label: "Shadow under the bar"
      hint: "A soft shadow that lifts the bar off what is behind it."
      on: page.pal.get("barShadow", false) === true
      resetKeys: ["barShadow"]
      naReason: page.na("barShadow")
      onActivated: page.act.set("barShadow", on ? "false" : "true")
    }

    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      label: "Tint labels with the accent"
      hint: "The small labels that appear over the bar (workspace, seal...) take the accent colour. Off, they follow the theme."
      resetKeys: ["tooltipBlood"]
      on: page.pal.get("tooltipBlood", false) === true
      onActivated: page.act.set("tooltipBlood", on ? "false" : "true")
    }
  }


  // Ready-made arrangements (Classic, Cluster, Compact...) moved to Setup -> Profiles, beside your own saved ones,
  // so there is one place to pick a whole look for the bar instead of two.
  Text {
    Layout.topMargin: 8
    text: "Ready-made arrangements (Classic, Cluster, Compact...) are under Setup → Profiles now, next to your own."
    color: page.bone
    opacity: 0.5
    font.family: "Noto Serif"
    font.italic: true
    font.pixelSize: 11
    wrapMode: Text.WordWrap
    Layout.fillWidth: true
  }


  // ---------------------------------------------------------------- look
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "LOOK"
    note: "The plate is black. Every layer is its own switch, and they all combine; the world lays marks on top."


    // the plate as it really is, with every layer applied, over a stand-in wallpaper
    Rectangle {
      Layout.fillWidth: true
      Layout.preferredHeight: 44
      radius: 22
      gradient: Gradient {
        orientation: Gradient.Horizontal
        GradientStop { position: 0; color: "#3a2a57" }
        GradientStop { position: 1; color: "#1d5a6b" }
      }

      Ito.ItoPlate {
        readonly property var look: Surfaces.resolve(page.pal)
        palette: page.pal
        anchors.fill: parent
        radius: 22
        artBase: Qt.resolvedUrl("../ito-art/")
        plate: look.plate
        veins: look.veins
        wood: look.wood
        calm: look.calm
        grain: look.grain
        tone: look.tone
        lift: look.lift
        border: look.border
        torn: look.torn
        fog: look.fog
        world: look.world
        rot: look.rot
      }
    }


    Text { text: "Plate recipes"; color: page.bone; opacity: 0.75; font.family: "Noto Serif"; font.pixelSize: 12 }
    RowLayout {
      Layout.fillWidth: true
      spacing: 6

      Repeater {
        // the whole looks (Uzumaki, Otherworld) are the presets on Styles; here only recipes for the plate itself
        model: Surfaces.presets.filter(function (p) { return p.key !== "uzumaki" && p.key !== "otherworld" })

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredHeight: 34
          radius: 17
          host: page.cc
          pal: page.pal
          showCaption: false
          hint: modelData.note
          visible: page.cc.match(modelData.name + " " + modelData.note + " plate recipe look preset")
          onActivated: {
            var d = {}
            for (var f in modelData.set) d[f] = modelData.set[f]
            page.act.setMany(d)
          }

          Text {
            anchors.centerIn: parent
            text: modelData.name
            color: page.bone
            opacity: 0.85
            font.family: "Noto Serif"
            font.pixelSize: 11
          }
        }
      }
    }


    GridLayout {
      Layout.fillWidth: true
      columns: 3
      rowSpacing: 4
      columnSpacing: 6

      Repeater {
        model: Surfaces.layers

        CcToggle {
          required property var modelData
          Layout.fillWidth: true
          host: page.cc
          pal: page.pal
          label: modelData.name
          hint: modelData.note
          on: page.act.layerOn(modelData.flag)
          resetKeys: [modelData.flag]
          naReason: page.na(modelData.flag)
          visible: page.cc.match(modelData.name + " " + modelData.note + " layer look")
          onActivated: page.act.toggle(modelData.flag)
        }
      }
    }


    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      label: "Blood seep"
      sub: "Rot drips from the top edge"
      hint: "The Blood layer also lets rot seep down from the top edge of the plate (what the Flesh world used to be). Needs Blood on."
      resetKeys: ["bloodSeep"]
      on: Surfaces.on(page.pal, "bloodSeep")
      naReason: page.na("bloodSeep")
      visible: page.cc.match("blood seep rot drips flesh top edge")
      onActivated: page.act.set("bloodSeep", on ? "false" : "true")
    }

    Text { Layout.topMargin: 4; text: "World"; color: page.bone; opacity: 0.75; font.family: "Noto Serif"; font.pixelSize: 12; visible: page.cc.match("world otherworld rim rust fog cage") }
    RowLayout {
      Layout.fillWidth: true
      spacing: 6
      visible: page.cc.match("world otherworld rim rust fog cage")

      Repeater {
        model: {
          var out = [{ "key": "off", "name": "Off", "note": "The plain plate, with no world on it." }]
          for (var k in Surfaces.WORLDS) out.push({ "key": k, "name": Surfaces.WORLDS[k].name, "note": Surfaces.WORLDS[k].note })
          return out
        }

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.preferredHeight: 34
          radius: 17
          host: page.cc
          pal: page.pal
          showCaption: false
          hint: modelData.note
          current: String(page.pal.get("surfaceWorld", "off")) === modelData.key
          onActivated: page.act.set("surfaceWorld", modelData.key)

          Text {
            anchors.centerIn: parent
            text: modelData.name
            color: parent.current ? page.pal.lit : page.bone
            font.family: "Noto Serif"
            font.pixelSize: 12
          }
        }
      }
      CcReset { host: page.cc; pal: page.pal; keys: ["surfaceWorld"] }
    }

    CcMeter { Layout.topMargin: 4; host: page.cc; pal: page.pal; actions: page.act
      label: "Opacity"; key: "surfaceOpacity"; fallback: 1; lo: 0.1; hi: 1
      hint: "How solid the plate is. Lower it to let the wallpaper through." }

    CcMeter { host: page.cc; pal: page.pal; actions: page.act
      label: "Blood strength"; key: "surfaceVeins"; fallback: 0.6; lo: 0; hi: 1; naReason: page.na("surfaceVeins")
      hint: "How strongly the veins show, when the Blood layer is on." }

    CcMeter { host: page.cc; pal: page.pal; actions: page.act
      label: "Grain strength"; key: "surfaceGrain"; fallback: 0.14; lo: 0; hi: 0.4; naReason: page.na("surfaceGrain")
      hint: "How much press dirt is on the plate." }

    CcMeter { host: page.cc; pal: page.pal; actions: page.act
      label: "Pill opacity"; key: "surfacePill"; fallback: 0.78; lo: 0.2; hi: 1; naReason: page.na("surfacePill")
      hint: "How dark the pill behind each widget is, when Widget pills is on." }
  }


  // ---------------------------------------------------------------- actions
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "LAYOUT"
    note: "Drag any widget onto another to trade places. Reset layout asks again before doing anything, since it cannot be undone from here."


    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: [
          { "label": "Move widgets", "tip": "Enter edit mode: drag the widgets wherever you want them.", "act": "edit" },
          { "label": "Reset layout", "tip": "Put every widget back to Classic, on the shape you have now. Your colours and effects are not touched.", "act": "layout" }
        ]

        CcCard {
          id: resetCard
          required property var modelData
          readonly property bool risky: modelData.act === "layout"
          readonly property bool armed: risky && page.armedReset === modelData.act
          Layout.fillWidth: true
          Layout.preferredHeight: 38
          radius: 19
          host: page.cc
          pal: page.pal
          showCaption: false
          hint: armed ? "Click again to really " + modelData.label.toLowerCase() + "." : modelData.tip
          current: modelData.act === "edit"
          onActivated: {
            if (modelData.act === "edit") { page.cc.close(); page.act.editLayout(); return }
            if (!armed) { page.armedReset = modelData.act; resetDisarm.restart(); return }
            page.armedReset = ""
            page.act.resetLayout()
          }

          Text {
            anchors.centerIn: parent
            text: resetCard.armed ? "Really?" : modelData.label
            color: resetCard.armed ? page.pal.blood : (modelData.act === "edit" ? page.pal.lit : page.bone)
            font.family: "Noto Serif"
            font.pixelSize: 12
          }
        }
      }
    }
  }

}
