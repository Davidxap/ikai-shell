import QtQuick
import QtQuick.Layouts
import Quickshell
import ".." as Cc

// TERMINAL 端: Omarchy's own fastfetch, with your picture as the logo; the layouts as koma cards, then the picture.
ColumnLayout {
  id: pane
  property var host: null
  readonly property var pal: host.pal
  Layout.fillWidth: true
  spacing: 32

  SurfaceHead {
    host: pane.host
    status: host.fetchStatusObj
    run: host.fetchRunRef
    kanji: "端"
    // never the raw picture: the hero is the fetch as the terminal draws it, picture and machine lines side by side
    preview: host.fetchPreview
    loadingText: "drawing the preview…"
    heroFit: true
    previewCaption: "preview · the real fastfetch, run offscreen · your colours"
    tryLabel: "Try in a terminal"
    tryHint: "Opens a terminal and runs the chosen layout once. Nothing changes."
    backHint: "Remove the generated layouts and give your own fastfetch config back."
    visible: pane.host.cc.match("terminal fetch fastfetch neofetch apply update")
    onPrimary: host.applyFetch(true, host.fetchLayout)
    onBack: host.applyFetch(false, host.fetchLayout)
    onTryIt: Quickshell.execDetached(["xdg-terminal-exec", "bash", "-c", host.fetchTool + " run " + host.fetchLayout + "; read -n 1 -s -r -p ''"])
  }

  Cc.CcSection {
    host: pane.host.cc; pal: pane.pal; startOpen: true
    label: "DESIGN"
    note: "Every layout keeps Omarchy's modules, boxes and terminal colours."
    visible: pane.host.cc.match("terminal fetch fastfetch layout image compact text")
    Flow {
      Layout.fillWidth: true
      spacing: 16
      Repeater {
        model: [
          { "key": "image",   "kanji": "絵", "name": "Image",   "note": "Your picture beside the machine's lines." },
          { "key": "compact", "kanji": "小", "name": "Compact", "note": "A small picture and fewer lines." },
          { "key": "text",    "kanji": "字", "name": "Text",    "note": "Omarchy's logo; works in any terminal." }
        ]
        Cc.CcKoma {
          required property var modelData
          host: pane.host.cc; pal: pane.pal
          kanji: modelData.kanji; name: modelData.name; note: modelData.note
          source: pane.host.fetchThumbs[modelData.key] || ""
          thumbFit: true
          current: pane.host.fetchLayout === modelData.key
          onActivated: {
            pane.host.act.set("fastfetchLayout", modelData.key)
            if (pane.host.fetchOn) pane.host.applyFetch(true, modelData.key)
          }
        }
      }
    }
    Text {
      Layout.fillWidth: true
      wrapMode: Text.WordWrap
      text: "Try a layout without changing anything: fastfetch -c ~/.config/fastfetch/config-ito-compact.jsonc"
      color: pane.pal.bone; opacity: 0.72
      font.family: "Noto Serif"; font.pixelSize: 12
    }
  }

  Cc.CcSection {
    host: pane.host.cc; pal: pane.pal; startOpen: true
    label: "LOGO"
    note: "What sits beside the machine's lines. Omarchy's own lines and colours are never changed."
    visible: pane.host.cc.match("terminal fetch fastfetch logo eye omarchy picture ornaments frame")
    Flow {
      Layout.fillWidth: true
      spacing: 16
      Repeater {
        model: [
          { "key": "omarchy", "kanji": "標", "name": "Omarchy", "note": "Omarchy's own mark, untouched." },
          { "key": "eye",     "kanji": "眼", "name": "Eye",     "note": "A pen-drawn eye in braille, 54 by 26 cells." },
          { "key": "picture", "kanji": "絵", "name": "Picture", "note": "The picture from the slot below." }
        ]
        Cc.CcKoma {
          required property var modelData
          host: pane.host.cc; pal: pane.pal
          kanji: modelData.kanji; name: modelData.name; note: modelData.note
          current: pane.host.fetchLogo === modelData.key
          onActivated: {
            pane.host.act.set("fetchLogo", modelData.key)
            if (modelData.key === "eye") Quickshell.execDetached([pane.host.fetchTool, "eye"])
            if (pane.host.fetchOn) pane.host.applyFetch(true, pane.host.fetchLayout)
          }
        }
      }
    }
  }

  Cc.CcSection {
    host: pane.host.cc; pal: pane.pal; startOpen: true
    label: "FETCH STYLE"
    note: "How the three machine boxes are drawn. The picture never gets a frame; Omarchy's lines and colours are never changed."
    visible: pane.host.cc.match("terminal fetch fastfetch style boxes ornaments frame rust otherworld chains ink eyes silent hill reset")
    Flow {
      Layout.fillWidth: true
      spacing: 16
      Repeater {
        model: [
          { "key": "ito",        "kanji": "骸", "name": "Ito",          "note": "Kanji on the boxes, a sound effect on each bottom rule." },
          { "key": "rust",       "kanji": "錆", "name": "Rust",         "note": "Rusted plates, rivets, seepage stains." },
          { "key": "otherworld", "kanji": "裏", "name": "Otherworld",   "note": "Heavy plates, a rusted mesh, blood in the seams." },
          { "key": "chains",     "kanji": "鎖", "name": "Chains",       "note": "The boxes hang from chains with a red shackle." },
          { "key": "ink",        "kanji": "渦", "name": "Ito ink",      "note": "Screentone rules and bold manga titles." },
          { "key": "eyes",       "kanji": "目", "name": "Eyes",         "note": "Eyes open along the top of every box, closed along the bottom." }
        ]
        Cc.CcKoma {
          required property var modelData
          host: pane.host.cc; pal: pane.pal
          kanji: modelData.kanji; name: modelData.name; note: modelData.note
          source: pane.host.fetchStyleThumbs[modelData.key] || ""
          thumbFit: true
          current: pane.host.fetchStyle === modelData.key
          onActivated: {
            pane.host.act.set("fetchStyle", modelData.key)
            if (pane.host.fetchOn) pane.host.applyFetch(true, pane.host.fetchLayout)
          }
        }
      }
    }
    Cc.CcToggle {
      host: pane.host.cc; pal: pane.pal
      label: "Plain Omarchy boxes"
      sub: "No kanji, sound effects or stitched separator; the style above is ignored."
      on: !pane.host.fetchOrnaments
      onActivated: {
        pane.host.act.set("fetchOrnaments", pane.host.fetchOrnaments ? "off" : "ito")
        if (pane.host.fetchOn) pane.host.applyFetch(true, pane.host.fetchLayout)
      }
    }
    Cc.CcCard {
      id: resetStyle
      readonly property bool atDefault: pane.host.fetchStyle === "ito" && pane.host.fetchPicture === "photo"
      host: pane.host.cc; pal: pane.pal; showCaption: false
      Layout.preferredWidth: 230; Layout.preferredHeight: 28; radius: 14
      hint: atDefault ? "Style and picture are already the default." : "Put the fetch style and the picture look back to how they shipped."
      opacity: atDefault ? 0.45 : 1
      onActivated: {
        if (atDefault) return
        pane.host.act.unset(["fetchStyle", "fetchPicture", "fetchPicturePolarity"])
        if (pane.host.fetchOn) pane.host.applyFetch(true, pane.host.fetchLayout)
      }
      Text {
        anchors.centerIn: parent
        text: resetStyle.atDefault ? "Already the default" : "Back to the default"
        color: pane.pal.bone; font.family: "Noto Serif"; font.pixelSize: 11
      }
    }
  }

  Cc.CcSection {
    host: pane.host.cc; pal: pane.pal; startOpen: true
    label: "PICTURE"
    note: "The fetch's logo. It stays on this machine and is not part of the shell."
    visible: pane.host.cc.match("terminal fetch fastfetch picture gallery tomie remina eye")
    SlotPicker {
      host: pane.host
      slot: "_fastfetch"
      square: true
      title: "Terminal fetch"
      note: "The fetch shows text only."
      afterPick: function() { pane.host.surfaceApply("_fastfetch") }
    }
    Cc.CcToggle {
      host: pane.host.cc; pal: pane.pal
      label: "Transparent engraving"
      sub: "The picture's light becomes the terminal colour and its dark disappears; it sits level with the machine boxes."
      on: pane.host.fetchPicture === "engraving"
      onActivated: {
        pane.host.act.set("fetchPicture", pane.host.fetchPicture === "engraving" ? "photo" : "engraving")
        if (pane.host.fetchOn) pane.host.applyFetch(true, pane.host.fetchLayout)
      }
    }
    Cc.CcHelp {
      pal: pane.pal
      title: "Which picture works best"
      body: "<b>Best first.</b> 1 Drowning Girl, 2 Uzumaki eye, 3 Tomie, 4 Beetle. White line art on black stays crisp as an engraving; "
          + "black-on-white drawings are inverted on dark themes. Tonal, textured art (Remina) turns into a heavy slab: not recommended.<br>"
          + "<b>Transparent engraving</b> needs no frame around the picture; the boxes carry the style."
    }
    Cc.CcHelp {
      pal: pane.pal
      title: "How to prepare this picture"
      body: "<b>Size.</b> Roughly square works best; <b>800 × 800 px</b> is plenty (fastfetch always scales it down).<br>"
          + "<b>Where it shows.</b> Every time you run <code>fastfetch</code> in a terminal that draws images (Ghostty, kitty); the Text layout does not use it.<br>"
          + "<b>Yours only.</b> The picture is copied to ~/.config/ito/marks/ untouched. It is not licensed for redistribution."
    }
  }
}
