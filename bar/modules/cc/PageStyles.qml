import QtQuick
import QtQuick.Layouts
import ".." as Ito
import "../ItoFrameStyles.js" as Styles
import "StylesIndex.js" as Idx

// Styles: every look of the shell in one place, each with a preview you can see before you choose it (visual-v3.md section 4). Presets set a whole
// look at once and can be undone; below them the frame, the opening, the bar, the eyes and the lore, one section each. The previews are stills drawn by
// the real components over a stand-in config that never writes: only a click on a card changes the sidecar.
ColumnLayout {
  id: page

  property var cc: null
  readonly property var pal: cc.pal
  readonly property var act: cc.actions
  readonly property color bone: pal.bone

  spacing: 10

  // the grid of cards: 206 px wide cards, at least two to a row
  readonly property int cols: Math.max(2, Math.floor((width + 8) / 214))
  readonly property real cardW: (width - 8 * (cols - 1)) / cols

  // ------------------------------------------------------------------------------------------------------ presets, undo, reset
  readonly property string currentPreset: { var _ = pal.values; return Idx.current(function (k, d) { return pal.get(k, d) }) || "" }
  property var undoSnap: null
  Timer { id: undoTimer; interval: 12000; onTriggered: { page.undoSnap = null; if (page.cc) page.cc.memo.stylesUndo = null } }
  Component.onCompleted: {
    var u = cc && cc.memo ? cc.memo.stylesUndo : null
    if (u && Date.now() - u.at < 12000) { undoSnap = u.snap; undoTimer.interval = 12000 - (Date.now() - u.at); undoTimer.start() }
  }

  function applyPreset(p) {
    var snap = Idx.snapshot(p, function (k, d) { return pal.get(k, d) })
    undoSnap = snap
    cc.memo.stylesUndo = { snap: snap, at: Date.now() }
    undoTimer.interval = 12000; undoTimer.restart()
    act.setMany(p.values)
  }
  function undo() {
    if (!undoSnap) return
    var r = Idx.restore(undoSnap)
    undoSnap = null; undoTimer.stop(); cc.memo.stylesUndo = null
    for (var k in r.set) { act.setMany(r.set); break }
    if (r.unset.length > 0) act.unset(r.unset)
  }

  // ---------------------------------------------------------------------------------------------------------------- presets
  CcSection {
    id: presetSection
    host: page.cc
    startOpen: true
    pal: page.pal
    label: "PRESETS"
    note: (page.currentPreset === "" ? "A whole look in one click. Yours is a custom mix right now." : "A whole look in one click. The marked one is on.") + " The bar's world and plate are on Bars."

    RowLayout {
      Layout.fillWidth: true
      spacing: 8
      visible: page.undoSnap !== null
      CcCard {
        Layout.preferredWidth: 150; Layout.preferredHeight: 30; radius: 15
        host: page.cc; pal: page.pal; showCaption: false
        hint: "Put back what was set before the preset you just chose."
        onActivated: page.undo()
        Text { anchors.centerIn: parent; text: "Undo the preset"; color: page.pal.lit; font.family: "Noto Serif"; font.pixelSize: 12 }
      }
      Text { text: "for a few seconds"; color: page.bone; opacity: 0.5; font.family: "Noto Serif"; font.italic: true; font.pixelSize: 11 }
    }

    GridLayout {
      Layout.fillWidth: true
      columns: page.cols
      columnSpacing: 8
      rowSpacing: 8

      Repeater {
        model: Idx.PRESETS
        StyleCard {
          id: pc
          required property var modelData
          section: presetSection
          host: page.cc; pal: page.pal
          cardW: page.cardW
          name: modelData.name
          note: modelData.note
          words: "preset theme look combination"
          current: page.currentPreset === modelData.key
          onActivated: page.applyPreset(modelData)
          preview: Component {
            Item {
              Ito.ItoPreviewConfig { id: pcfg; source: page.pal; overrides: pc.modelData.values }
              Ito.ItoFramePreview { x: 0; y: 6; width: 94; height: 80; pal: pcfg; styleKey: pc.modelData.frameStyle; art: pc.modelData.frameArt }
              Ito.ItoBarPreview { x: 100; y: 0; width: 206; height: 64; cfg: pcfg; scale: 0.5; transformOrigin: Item.TopLeft }
              Ito.ItoRevealPreview { x: 100; y: 40; width: 70; height: 46; cfg: pcfg; kind: pc.modelData.values.presenceReveal === "none" ? "lid" : pc.modelData.values.presenceReveal; u: pc.modelData.values.presenceReveal === "none" ? 1 : 0.6 }
            }
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------------------------------------------- frame
  CcSection {
    id: frameSection
    host: page.cc
    startOpen: true
    pal: page.pal
    label: "FRAME"
    note: "How popups (audio, network, Bluetooth...) are framed. Plain keeps the shell's own card and its own way of opening."

    GridLayout {
      Layout.fillWidth: true
      columns: page.cols
      columnSpacing: 8
      rowSpacing: 8

      Repeater {
        model: [{ "key": "plain", "name": "Plain", "note": "The shell's own card, untouched, and its own open and close." }].concat(Styles.styles.map(function (s) { return { "key": s.key, "name": s.name, "note": s.note } }))
        StyleCard {
          id: fc
          required property var modelData
          section: frameSection
          host: page.cc; pal: page.pal
          cardW: page.cardW
          name: modelData.name
          note: modelData.note
          words: "frame border popup card chains panel manga otherworld minimal plain"
          current: modelData.key === "plain" ? page.pal.get("panelFrame", true) === false
                   : (page.pal.get("panelFrame", true) !== false && Styles.resolve(page.pal.get("frameStyle", "manga")) === modelData.key)
          onActivated: { if (modelData.key === "plain") page.act.set("panelFrame", "false"); else page.act.setMany({ "panelFrame": true, "frameStyle": modelData.key }) }
          preview: Component {
            Item {
              Ito.ItoPreviewConfig { id: fcfg; source: page.pal; overrides: ({ "frameStyle": fc.modelData.key, "panelFrame": true }) }
              Ito.ItoFramePreview { anchors.horizontalCenter: parent.horizontalCenter; width: 140; height: 90; pal: fcfg; styleKey: fc.modelData.key; art: String(page.pal.get("frameArt", "png")) }
            }
          }
        }
      }
    }

    Text { text: "Art of the Panel, Otherworld and chains frames"; color: page.bone; font.family: "Noto Serif"; font.pixelSize: 13; Layout.topMargin: 4 }
    GridLayout {
      Layout.fillWidth: true
      columns: page.cols
      columnSpacing: 8
      rowSpacing: 8
      Repeater {
        model: [
          { "key": "png", "name": "Pictures", "note": "The frame art as it always was: pictures made once." },
          { "key": "drawn", "name": "Drawn", "note": "Hand-drawn in code, sharp at any size and in the theme's colours." }
        ]
        StyleCard {
          id: ac
          required property var modelData
          section: frameSection
          host: page.cc; pal: page.pal
          cardW: page.cardW
          name: modelData.name
          note: modelData.note
          words: "art frame png drawn pictures"
          current: Styles.artMode(page.pal.get("frameArt", "png")) === modelData.key
          onActivated: page.act.set("frameArt", modelData.key)
          preview: Component {
            Item {
              Ito.ItoPreviewConfig { id: acfg; source: page.pal; overrides: ({ "frameArt": ac.modelData.key, "panelFrame": true }) }
              Ito.ItoFramePreview { anchors.horizontalCenter: parent.horizontalCenter; width: 140; height: 90; pal: acfg; styleKey: Styles.resolve(page.pal.get("frameStyle", "manga")); art: ac.modelData.key }
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------------------------------------------- opening
  CcSection {
    id: openSection
    host: page.cc
    Layout.topMargin: 4
    pal: page.pal
    label: "OPENING"
    note: page.pal.get("panelFrame", true) === false ? "Plain popups open the shell's own way." : "How a popup comes up out of its bar icon. Move the pointer over a card to watch it."

    GridLayout {
      Layout.fillWidth: true
      columns: page.cols
      columnSpacing: 8
      rowSpacing: 8
      opacity: page.pal.get("panelFrame", true) === false ? 0.4 : 1
      enabled: page.pal.get("panelFrame", true) !== false

      Repeater {
        model: [
          { "key": "none", "name": "None", "note": "The popup grows out of the icon with no cover over it." },
          { "key": "spiral", "name": "Spiral", "note": "A spiral arm unrolls from the icon and uncovers the popup in a quarter of a second." },
          { "key": "blot", "name": "Blot", "note": "A stain of ink spreads from the icon and uncovers the popup." },
          { "key": "static", "name": "Static", "note": "A band of radio static sweeps down the popup and uncovers it; scanlines fade out behind it." },
          { "key": "lid", "name": "Eyelid", "note": "Two eyelids part over the popup as it opens." }
        ]
        StyleCard {
          id: oc
          required property var modelData
          section: openSection
          host: page.cc; pal: page.pal
          cardW: page.cardW
          name: modelData.name
          note: modelData.note
          words: "opening reveal animation spiral lid eyelid blot static radio"
          current: String(page.pal.get("presenceReveal", "none")) === modelData.key
          onActivated: page.act.set("presenceReveal", modelData.key)
          preview: Component {
            Item {
              id: strip
              Ito.ItoPreviewConfig { id: ocfg; source: page.pal }
              Row {
                anchors.horizontalCenter: parent.horizontalCenter
                spacing: 6
                Repeater {
                  model: oc.modelData.key === "none" ? 1 : 3
                  Ito.ItoRevealPreview {
                    id: rp
                    required property int index
                    width: oc.modelData.key === "none" ? 90 : 56; height: 70
                    cfg: ocfg
                    kind: oc.modelData.key
                    u: [0.35, 0.7, 1][index]
                    // the last frame plays the opening once while the pointer is on the card
                    Connections { target: oc; enabled: rp.index === 2; function onHoveredChanged() { if (oc.hovered) rp.play() } }
                  }
                }
              }
            }
          }
        }
      }
    }

    CcToggle {
      Layout.fillWidth: true
      host: page.cc; pal: page.pal
      label: "Grow from the icon"
      hint: "The popup unfolds from its bar icon like a sheet, instead of fading in."
      on: page.pal.get("presence", true) === true
      visible: page.cc.match("grow icon opening presence sheet")
      onActivated: page.act.set("presence", on ? "false" : "true")
    }
    CcToggle {
      Layout.fillWidth: true
      host: page.cc; pal: page.pal
      label: "Shoulders"
      hint: "Flowing shoulders join the popup to the bar while it grows."
      on: page.pal.get("presenceShoulders", false) === true
      visible: page.cc.match("shoulders opening flowing")
      onActivated: page.act.set("presenceShoulders", on ? "false" : "true")
    }
    CcToggle {
      Layout.fillWidth: true
      host: page.cc; pal: page.pal
      label: "Morph between popups"
      hint: "Moving from one popup to another reshapes the card instead of closing and reopening."
      on: String(page.pal.get("presenceSwitch", "morph")) === "morph"
      visible: page.cc.match("morph between popups switch reopen opening")
      onActivated: page.act.set("presenceSwitch", on ? "reopen" : "morph")
    }
  }

  // ------------------------------------------------------------------------------------------------------------------ eyes
  CcSection {
    id: eyeSection
    host: page.cc
    Layout.topMargin: 4
    pal: page.pal
    label: "EYES"
    note: "The eye at the head of a popup, and how it moves. The eyes made from your own sheets need their pictures: run the command shown on a dimmed card."

    Text { text: "Eye at the head of a popup"; color: page.bone; font.family: "Noto Serif"; font.pixelSize: 13 }
    GridLayout {
      Layout.fillWidth: true
      columns: page.cols
      columnSpacing: 8
      rowSpacing: 8
      Repeater {
        model: [
          { "key": "shaded", "name": "Shaded eye", "note": "A shaded, heavy-lidded eye drawn in code. It stares when a reading runs hot." },
          { "key": "uzumaki", "name": "Uzumaki eye", "note": "Your Uzumaki eye: the iris is a spiral that turns slowly." },
          { "key": "lashed", "name": "Inked eye", "note": "Your eye sheet: the open eye with lashes, inked by hand." },
          { "key": "veined", "name": "Veined eyeball", "note": "Your eye cluster: the big veined eyeball with a pinpoint pupil." }
        ]
        StyleCard {
          id: ec
          required property var modelData
          section: eyeSection
          host: page.cc; pal: page.pal
          cardW: page.cardW
          previewH: 64
          name: modelData.name
          note: modelData.note
          words: "eye eyes shaded uzumaki inked lashed veined"
          reason: modelData.key !== "shaded" && page.pal.userEye(modelData.key, 34) === null
            ? (page.pal.userAssets ? "Needs your picture: run ito-assets recipe eye-" + modelData.key : "Needs your own art: switch Your own art on (userAssets)") : ""
          current: String(page.pal.eyeStyle) === modelData.key
          onActivated: if (!unavailable) page.act.set("eyeStyle", modelData.key)
          preview: Component {
            Item {
              Ito.ItoPreviewConfig { id: ecfg; source: page.pal; overrides: ({ "eyeStyle": ec.modelData.key }) }
              Ito.ItoCrest {
                anchors.centerIn: parent
                width: 92; height: 28
                kind: "eye"; live: false; amp: 0
                bone: ecfg.bone; blood: ecfg.blood; ink: ecfg.ink
                tints: ecfg
                eyeStyle: ec.modelData.key
                hot: false; critical: false; crestEye: "auto"; eyeLevel: 0; pointer: null
                scale: 1.6
              }
            }
          }
        }
      }
    }

    Text { text: "How the eyes move"; color: page.bone; font.family: "Noto Serif"; font.pixelSize: 13; Layout.topMargin: 4 }
    RowLayout {
      Layout.fillWidth: true
      spacing: 8
      Repeater {
        model: [
          { "key": "off", "label": "Still", "tip": "The eyes do not move: open and still, as they were drawn." },
          { "key": "subtle", "label": "Subtle", "tip": "The shaded eye blinks, glances about and follows the pointer; your own eyes turn their iris slowly. They open when a popup opens and shut as it leaves." },
          { "key": "full", "label": "Full", "tip": "As subtle, plus tremors and a heartbeat in the shaded eye, and now and then something you were not meant to see; your Uzumaki eye blinks and its spiral runs blood when a reading is hot." }
        ]
        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredHeight: 38
          radius: 19
          host: page.cc; pal: page.pal; showCaption: false
          hint: modelData.tip
          current: String(page.pal.get("eyeMotion", "subtle")) === modelData.key
          visible: page.cc.match(modelData.label + " " + modelData.tip + " eye motion")
          onActivated: page.act.set("eyeMotion", modelData.key)
          Text { anchors.centerIn: parent; text: modelData.label; color: parent.current ? page.pal.lit : page.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
        }
      }
    }
  }

  // ------------------------------------------------------------------------------------------------------------------ memory liquid
  CcSection {
    id: liquidSection
    host: page.cc
    Layout.topMargin: 4
    pal: page.pal
    label: "MEMORY LIQUID"
    note: "What lives inside the liquid of the memory panel. Hover a card to see it move for two seconds; the panel itself moves only while it is open."

    GridLayout {
      Layout.fillWidth: true
      columns: page.cols
      columnSpacing: 8
      rowSpacing: 8
      Repeater {
        model: [
          { "key": "blood", "name": "Blood", "note": "The liquid as it is: thick blood that settles in layers." },
          { "key": "whirlpool", "name": "Whirlpool", "note": "The memory winds into an Uzumaki spiral; it turns faster when memory is tight." },
          { "key": "hair", "name": "Hair", "note": "Black hair rises from the bottom of the vessel; more of it the fuller memory is." },
          { "key": "rust", "name": "Rust", "note": "Oxidised water with sediment; stains on the glass mark where memory stood." },
          { "key": "static", "name": "Static", "note": "The liquid is a dying TV picture: scanlines and snow." },
          { "key": "tone", "name": "Screentone", "note": "The liquid printed like a manga page: halftone dots darken toward the bottom." }
        ]
        StyleCard {
          id: lc
          required property var modelData
          section: liquidSection
          host: page.cc; pal: page.pal
          cardW: page.cardW
          previewH: 116
          name: modelData.name
          note: modelData.note
          words: "liquid memory ram vessel blood whirlpool hair rust static screentone tone"
          current: String(page.pal.vesselFill) === modelData.key
          onActivated: page.act.set("vesselFill", modelData.key)
          preview: Component {
            Item {
              id: lp
              property bool play: false
              Connections { target: lc; function onHoveredChanged() { if (lc.hovered) { lp.play = true; lpTimer.restart() } } }
              Timer { id: lpTimer; interval: 2000; onTriggered: lp.play = false }
              Ito.ItoSealInk { id: lpInk; source: page.pal }
              Ito.ItoVesselSeal {
                anchors.horizontalCenter: parent.horizontalCenter
                size: 96
                ink: lpInk
                fill: lc.modelData.key
                used: 0.58; tight: false
                live: lp.play; amp: lp.play ? 1 : 0
                strata: [{ fraction: 0.29, gradient: true, hot: false }, { fraction: 0.174, alpha: 0.34 }, { fraction: 0.116, alpha: 0.62 }]
                pose: lp.play ? null : ({ levels: [0.29, 0.464, 0.58], a1: 0, fx: 0, fxPeaks: [0.65, 0.71] })
              }
            }
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------------------------------------------------------ lore
  CcSection {
    host: page.cc
    Layout.topMargin: 4
    pal: page.pal
    label: "LORE"
    note: "How much the processor, memory and storage panels quote the horror they borrow from."

    RowLayout {
      Layout.fillWidth: true
      spacing: 8
      Repeater {
        model: [
          { "key": "off", "label": "Off", "tip": "The processor, memory and storage panels as they were: the same three notes, nothing added." },
          { "key": "subtle", "label": "Subtle", "tip": "Notes that follow the machine's state, and still marks that each show a reading: rust for heat, a chain at the memory line, the figure filling its hole." },
          { "key": "full", "label": "Full", "tip": "As subtle, plus bursts of static, the walker's gait and a few lettered sounds on a threshold." }
        ]
        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredHeight: 38
          radius: 19
          host: page.cc; pal: page.pal; showCaption: false
          hint: modelData.tip
          current: String(page.pal.get("loreLevel", "off")) === modelData.key
          visible: page.cc.match(modelData.label + " " + modelData.tip + " lore story notes memo")
          onActivated: page.act.set("loreLevel", modelData.key)
          Text { anchors.centerIn: parent; text: modelData.label; color: parent.current ? page.pal.lit : page.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
        }
      }
    }
  }
}
