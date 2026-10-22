import QtQuick
import QtQuick.Layouts
import Quickshell
import ".." as Cc

// BOOT 起: the boot splash (Plymouth). The eye is shut here (boot-lock-v2 §5.2): the machine is not awake yet. Everything is baked
// into the logo; applying needs your password and always happens in a terminal you can see.
ColumnLayout {
  id: pane
  property var host: null
  readonly property var pal: host.pal
  readonly property var st: host.bootStatusObj
  Layout.fillWidth: true
  spacing: 32

  SurfaceHead {
    host: pane.host
    status: pane.st
    run: null
    kanji: "起"
    needsCommand: pane.st && pane.st.state === "stale" ? pane.host.plymouthTool + " apply" : ""
    needsText: "The boot picture on disk is out of date. Run this in a terminal: it asks for your password (sudo) and rebuilds the boot image. I do not run it for you."
    preview: host.bootPreview !== "" ? host.bootPreview : String(host.bootThumbs[host.bootComposition] || "")
    loadingText: host.bootPictureMissing && !host.bootArtComposition && host.bootSource === "slot"
                 ? "no picture yet: choose one below, or change Source" : "drawing the preview…"
    heroZoom: host.bootPreview !== "" ? 2 : 1
    heroFit: host.bootPreview === ""
    previewCaption: "preview · your colours · Omarchy's own login screen"
    primaryOff: "Apply… (asks for your password)"
    blockedLabel: "Apply… (asks for your password)"
    tryEnabled: false
    tryHint: "The boot splash only shows when the machine starts."
    backHint: "Opens a terminal and puts Omarchy's own boot screen and login logo back."
    visible: pane.host.cc.match("boot splash plymouth apply update")
    onPrimary: Quickshell.execDetached(["xdg-terminal-exec", "bash", "-c", pane.host.plymouthTool + " apply; echo; read -n 1 -s -r -p 'press a key to close'"])
    onBack: Quickshell.execDetached(["xdg-terminal-exec", "bash", "-c", pane.host.plymouthTool + " reset; echo; read -n 1 -s -r -p 'press a key to close'"])
  }

  Cc.CcSection {
    host: pane.host.cc; pal: pane.pal; startOpen: true
    label: "COMPOSITION"
    note: "What the logo is made of. Everything is baked into the one picture Plymouth shows."
    visible: pane.host.cc.match("boot splash plymouth composition eye shut picture seal caption card tomie pyramid road moth")
    Flow {
      Layout.fillWidth: true
      spacing: 16
      Repeater {
        model: [
          { "key": "uzumaki-eye", "kanji": "渦", "name": "Uzumaki eye", "note": "Your engraved spiral eye.", "art": true },
          { "key": "beetle", "kanji": "甲", "name": "Beetle", "note": "Your beetle.", "art": true },
          { "key": "remina", "kanji": "球", "name": "Remina", "note": "Your Remina photo.", "art": true },
          { "key": "tomie", "kanji": "富", "name": "Tomie", "note": "Your Tomie drawing.", "art": true },
          { "key": "eye-veined", "kanji": "眼", "name": "Veined eye", "note": "Your veined eye sheet.", "art": true },
          { "key": "eye-spiral", "kanji": "眼", "name": "Spiral eye", "note": "Your spiral eye sheet.", "art": true },
          { "key": "card-tomie", "kanji": "顔", "name": "Tomie card", "note": "Your Tomie scene, large, edges in the fog.", "art": true },
          { "key": "card-pyramid", "kanji": "角", "name": "Pyramid card", "note": "Your Pyramid Head scene, large.", "art": true },
          { "key": "card-road", "kanji": "道", "name": "Road card", "note": "The foggy road and the town's sign.", "art": true },
          { "key": "card-moth", "kanji": "蛾", "name": "Moth card", "note": "The moth pinned in the red sight.", "art": true },
          { "key": "picture",  "kanji": "絵", "name": "Picture",  "note": "Your picture from the slot below, in your colours." },
          { "key": "seal",     "kanji": "印", "name": "Seal",     "note": "The picture with your seal letters beside it." },
          { "key": "caption",  "kanji": "字", "name": "Caption",  "note": "The picture with one quiet line under it." }
        ]
        Cc.CcKoma {
          required property var modelData
          host: pane.host.cc; pal: pane.pal
          visible: !modelData.art || String(pane.host.bootThumbs[modelData.key] || "") !== ""   // art tiles exist only for art you own
          readonly property bool needsPicture: !modelData.art && pane.host.bootSource === "slot" && pane.host.bootPictureMissing
          kanji: modelData.kanji; name: modelData.name
          note: needsPicture ? "Needs a picture: pick one below." : modelData.note
          source: pane.host.bootThumbs[modelData.key] || ""
          thumbFit: true
          unavailable: needsPicture
          current: pane.host.bootComposition === modelData.key || (pane.host.bootComposition === "eye-shut" && modelData.key === "uzumaki-eye")
          onActivated: pane.host.act.set("bootComposition", modelData.key)
        }
      }
    }
  }

  // One row of a choice: the label and a pill per value, bound to a sidecar key (the helper reads it on its next run).
  component Choice: RowLayout {
    id: ch
    property string label: ""
    property string key: ""
    property string fallback: ""
    property var values: []           // [{ "key": ..., "name": ..., "hint": ... }]
    readonly property string value: String(pane.host.pal.get(key, fallback))
    Layout.fillWidth: true
    spacing: 12
    Text {
      Layout.preferredWidth: 130
      text: ch.label
      color: pane.pal.bone; opacity: 0.75
      font.family: "Noto Serif"; font.pixelSize: 12
    }
    Flow {
      Layout.fillWidth: true
      spacing: 8
      Repeater {
        model: ch.values
        Cc.CcCard {
          required property var modelData
          width: 128; height: 32; radius: 16
          host: pane.host.cc; pal: pane.pal; showCaption: false
          current: ch.value === modelData.key
          hint: modelData.hint
          onActivated: pane.host.act.set(ch.key, modelData.key)
          Text { anchors.centerIn: parent; text: modelData.name; color: pane.pal.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
        }
      }
    }
  }

  Cc.CcSection {
    host: pane.host.cc; pal: pane.pal; startOpen: true
    label: "OPTIONS"
    note: "How the logo is drawn. Applying stays a terminal step (it needs your password)."
    visible: pane.host.cc.match("boot splash plymouth options source frame tone size caption text colour")
    Choice {
      label: "Source"; key: "bootSource"; fallback: "slot"
      values: [ { "key": "slot", "name": "Your picture", "hint": "The picture in the slot below." },
                { "key": "mark", "name": "Menu mark", "hint": "The shell's menu mark, no picture needed." },
                { "key": "theme", "name": "Theme logo", "hint": "The current theme's own logo.png." } ]
    }
    Choice {
      label: "Frame"; key: "bootFrame"; fallback: "ring"
      values: [ { "key": "none", "name": "None", "hint": "The picture as it is." },
                { "key": "disc", "name": "Disc", "hint": "Cropped to a circle." },
                { "key": "ring", "name": "Ring", "hint": "Cropped to a circle with a thin accent ring." } ]
    }
    Choice {
      label: "Tone"; key: "bootTone"; fallback: "tint"
      values: [ { "key": "tint", "name": "Tint", "hint": "Reddish pixels in the accent, the rest in bone." },
                { "key": "duotone", "name": "Duotone", "hint": "Paper in bone, ink transparent." },
                { "key": "raw", "name": "Raw", "hint": "The picture untouched." } ]
    }
    Choice {
      label: "Text colour"; key: "bootUi"; fallback: "bone"
      values: [ { "key": "bone", "name": "Bone", "hint": "Progress bar, lock icon and password box in bone." },
                { "key": "accent", "name": "Accent", "hint": "The same three in the accent colour." } ]
    }
    Cc.CcMeter {
      host: pane.host.cc; pal: pane.pal; actions: pane.host.act
      label: "Size"; key: "bootSize"; fallback: 320; lo: 160; hi: 480; percent: false
      hint: "Edge of the logo in the boot image in pixels, 160 to 480."
    }
    RowLayout {
      Layout.fillWidth: true
      spacing: 12
      visible: pane.host.bootComposition === "caption"
      Text {
        Layout.preferredWidth: 130
        text: "Caption"
        color: pane.pal.bone; opacity: 0.75
        font.family: "Noto Serif"; font.pixelSize: 12
      }
      Rectangle {
        Layout.preferredWidth: 240; Layout.preferredHeight: 34
        radius: 10
        color: Qt.alpha(pane.pal.bone, 0.05)
        border.width: 1
        border.color: Qt.alpha(pane.pal.bone, 0.2)
        TextInput {
          id: cap
          anchors.fill: parent; anchors.margins: 9
          verticalAlignment: TextInput.AlignVCenter
          color: pane.pal.bone
          selectionColor: pane.pal.blood
          font.family: "Noto Serif"; font.pixelSize: 13
          text: String(pane.host.pal.get("bootCaption", ""))
          maximumLength: 32
          validator: RegularExpressionValidator { regularExpression: /^[A-Za-z0-9 .,'·:!?-]*$/ }
          onAccepted: pane.host.act.set("bootCaption", text)
          onEditingFinished: if (text !== String(pane.host.pal.get("bootCaption", ""))) pane.host.act.set("bootCaption", text)
          onActiveFocusChanged: if (activeFocus) pane.host.cc.grabKeys = true
        }
      }
      Text {
        text: "empty = this machine's name"
        color: pane.pal.bone; opacity: 0.6
        font.family: "Noto Serif"; font.pixelSize: 11
      }
    }
  }

  Cc.CcSection {
    host: pane.host.cc; pal: pane.pal; startOpen: true
    label: "PICTURE"
    note: "Used by Picture, Seal and Caption: the very first thing you see after you turn the machine on, before login."
    visible: pane.host.cc.match("boot splash plymouth picture gallery")
    SlotPicker {
      host: pane.host
      slot: "_plymouth"
      title: "Boot splash"
      note: "The boot screen keeps its default."
    }
    Cc.CcHelp {
      pal: pane.pal
      title: "What the boot screen cannot change"
      body: "<b>Can change:</b> the picture, one flat background colour (always your theme's ink) and one text colour shared by the progress bar, the lock icon and the password box.<br>"
          + "<b>Cannot change:</b> the progress bar's shape and timing, the password box, the disk prompt's words, fonts, gradients, any animation.<br>"
          + "<b>Applying</b> asks for your password, rebuilds the boot image and also changes the login screen's logo (SDDM). It is never automatic.<br>"
          + "<b>Size.</b> Square, 512 × 512 px for a picture of your own, one bold subject centred. It is copied to ~/.config/ito/marks/ untouched."
    }
  }
}
