import QtQuick
import QtQuick.Layouts
import Quickshell
import ".." as Cc

// LOCK 錠: status, preview and actions, the designs as koma cards, the lock picture, and who locks on each path.
ColumnLayout {
  id: pane
  property var host: null
  readonly property var pal: host.pal
  readonly property var st: host.lockStatus
  readonly property var chain: host.lockChain
  Layout.fillWidth: true
  spacing: 32

  readonly property var kanji: ({ "fog": "霧", "lantern": "灯", "amigara": "穴", "watcher": "眼", "tomie": "富", "pyramid": "罰", "road": "道", "moth": "蛾" })

  readonly property bool lockNeedsYou: {
    var l = st && st.issues ? st.issues : []
    for (var i = 0; i < l.length; i++) if (l[i].code === "chain_mixed" || l[i].code === "not_in_charge") return true
    return false
  }
  SurfaceHead {
    id: head
    host: pane.host
    status: pane.st
    run: host.lockRunRef
    kanji: "錠"
    preview: host.lockPreview
    previewCaption: host.lockPreviewCaption
    primaryJumps: true
    needsCommand: lockNeedsYou ? pane.host.repairTool + " apply paths" : ""
    needsText: "Some lock paths (the keybind, idle and sleep) still start hyprlock. Run this in a terminal: it shows each change, asks, and backs up first. I do not run it for you."
    tryLabel: "Try for 15 s"
    tryHint: "Locks this screen for 15 seconds with the design, to see it; it unlocks by itself. Nothing is saved."
    backHint: "Put back the lock file you had before the first apply."
    visible: pane.host.cc.match("lock screen hyprlock password apply update repair")
    onPrimary: host.applyLock(true)
    onBack: host.applyLock(false)
    onTryIt: host.tryLock()
    onJump: whoLocks.userOpen = true
  }

  Cc.CcSection {
    host: pane.host.cc; pal: pane.pal; startOpen: true
    label: "DESIGN"
    note: "Each design is one composition; all follow your colours, and the password field stays a password field. Tomie, Pyramid, Welcome Road and Moth bring their own picture (made by ito-assets recipe sheets); without it they are greyed out."
    visible: pane.host.cc.match("lock screen design fog lantern amigara watcher tomie pyramid welcome road moth")
    Flow {
      Layout.fillWidth: true
      spacing: 16
      Repeater {
        model: pane.host.lockDesignList
        Cc.CcKoma {
          required property var modelData
          host: pane.host.cc; pal: pane.pal
          kanji: modelData.kanji || pane.kanji[modelData.key] || "錠"
          name: modelData.name
          note: modelData.note
          source: modelData.thumb || ""
          unavailable: modelData.available === false
          current: pane.host.lockDesign === modelData.key
          onActivated: if (modelData.available !== false) pane.host.pickLockDesign(modelData.key)
        }
      }
    }
  }

  Cc.CcSection {
    host: pane.host.cc; pal: pane.pal; startOpen: true
    label: "PICTURE"
    note: "The picture behind the lock. It stays on this machine and is not part of the shell."
    visible: pane.host.cc.match("lock screen background picture gallery")
    SlotPicker {
      host: pane.host
      slot: "_lockbg"
      title: "Lock screen"
      note: "The lock keeps a blurred screenshot."
      afterPick: function() { pane.host.surfaceApply("_lockbg") }
    }
    Cc.CcHelp {
      pal: pane.pal
      title: "How to prepare this picture"
      body: "<b>Size.</b> Any picture at least <b>1000 px</b> on its short side; it is cropped to fill the screen and only shows as fog, in your two colours.<br>"
          + "<b>Format.</b> PNG, JPG or WebP; up to 25 MB and 8000 px on a side.<br>"
          + "<b>Yours only.</b> The picture is copied to ~/.config/ito/marks/ untouched. It is not licensed for redistribution."
    }
  }

  Cc.CcSection {
    id: whoLocks
    host: pane.host.cc; pal: pane.pal
    startOpen: pane.st && pane.st.state === "blocked"
    label: "WHO LOCKS"
    note: "Four ways the screen gets locked, and which lock answers each one. Read from your files; nothing here locks."
    visible: pane.host.cc.match("lock who locks idle menu keybind suspend hypridle engine")
    Repeater {
      model: pane.chain && pane.chain.paths ? pane.chain.paths : []
      RowLayout {
        required property var modelData
        Layout.fillWidth: true
        spacing: 16
        Text { Layout.preferredWidth: 120; text: modelData.path + (modelData.scheduler ? " · " + modelData.scheduler.split(" ")[0] : ""); color: pane.pal.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
        Text { Layout.preferredWidth: 140; text: modelData.engine + (modelData.runs === false ? " (never runs)" : ""); color: pane.pal.bone; opacity: 0.9; font.family: "JetBrains Mono"; font.pixelSize: 12 }
        Text {
          Layout.fillWidth: true
          elide: Text.ElideMiddle
          text: modelData.trigger ? modelData.trigger + " → " + modelData.command
              : (modelData.timeout !== undefined ? "after " + modelData.timeout + " s" : (modelData.command || ""))
          color: pane.pal.bone; opacity: 0.72; font.family: "Noto Serif"; font.pixelSize: 12
        }
      }
    }
    Repeater {
      model: pane.chain && pane.chain.conflicts ? pane.chain.conflicts : []
      Text { required property var modelData; text: "⚠ " + modelData; color: pane.pal.warn; font.family: "Noto Serif"; font.pixelSize: 12 }
    }

    // the owner: one choice, three cards, each saying what it changes. Changing it is always a terminal step.
    Text {
      Layout.fillWidth: true
      wrapMode: Text.WordWrap
      text: "Who locks: " + (pane.st && pane.st.engine ? pane.st.engine : "hyprlock") + ". Changing it opens a terminal that prints the exact change, asks, and backs everything up first; `ito-lock own --undo` puts it back."
      color: pane.pal.bone; opacity: 0.72
      font.family: "Noto Serif"; font.pixelSize: 12
    }
    Flow {
      Layout.fillWidth: true
      spacing: 16
      Repeater {
        model: [
          { "key": "omarchy-lock", "title": "A · Omarchy's lock, themed",
            "text": "Only the colours of Omarchy's own lock follow this theme. No designs, no pictures. The safest, it survives updates best." },
          { "key": "ito-qs", "title": "B · Ito's own lock  (recommended)",
            "text": "A clone of Omarchy's lock that draws the Ito designs. The menu, idle, the lid and the keybind all show it, and Stay Awake is respected." },
          { "key": "hyprlock", "title": "C · hyprlock everywhere",
            "text": "The designs as baked layers, one frame a second. Needs the menu and hypridle fixed by hand, and ignores Stay Awake." }
        ]
        Cc.CcCard {
          required property var modelData
          width: 282; height: 150
          radius: 10
          host: pane.host.cc; pal: pane.pal; showCaption: false
          current: pane.st && pane.st.engine === modelData.key
          hint: "Opens a terminal: it shows what changes and asks before touching anything."
          onActivated: Quickshell.execDetached(["xdg-terminal-exec", "bash", "-c",
            pane.host.lockTool + " own " + modelData.key + "; echo; read -n 1 -s -r -p 'press a key to close'"])
          Column {
            anchors.fill: parent; anchors.margins: 12; spacing: 6
            Text { width: parent.width; text: modelData.title; color: pane.pal.bone; font.family: "Noto Serif"; font.pixelSize: 13; font.weight: Font.DemiBold; wrapMode: Text.WordWrap }
            Text { width: parent.width; text: modelData.text; color: pane.pal.bone; opacity: 0.72; font.family: "Noto Serif"; font.pixelSize: 11; wrapMode: Text.WordWrap }
          }
        }
      }
    }
  }
}
