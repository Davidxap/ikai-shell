import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import ".." as Cc

// SCREENSAVER 夢: the drifting text you get from idling, not the lock itself. Omarchy's idle timer decides when it starts
// (boot-lock-v2 §5.1); here you choose the text (art, never the project's name), the effect and its ground.
ColumnLayout {
  id: pane
  property var host: null
  readonly property var pal: host.pal
  readonly property var st: host.screensaverStatusObj
  Layout.fillWidth: true
  spacing: 32

  SurfaceHead {
    host: pane.host
    status: pane.st
    run: host.screensaverRunRef
    kanji: "夢"
    preview: host.saverPreview
    loadingText: "drawing the preview…"
    previewCaption: "still · the effect plays live in Preview now"
    primaryOff: "Turn on"
    tryLabel: "Preview now"
    tryHint: "Starts the screensaver now; any key or the mouse ends it. It is not a lock."
    backHint: "Give the stock text back and take the Ito listener out of hypridle.conf (nothing else in that file changes)."
    visible: host.cc.match("screensaver idle screen saver ttfx apply")
    onPrimary: host.applyScreensaver(true)
    onBack: host.applyScreensaver(false)
    onTryIt: Quickshell.execDetached([host.screensaverTool, "launch", "force"])
  }

  Cc.CcSection {
    host: pane.host.cc; pal: pane.pal; startOpen: true
    label: "TIMING"
    note: "Who starts it, and when."
    visible: pane.host.cc.match("screensaver idle timing omarchy hypridle")
    Text {
      Layout.fillWidth: true
      wrapMode: Text.WordWrap
      text: pane.st && pane.st.starts_after
            ? "Starts after " + pane.st.starts_after + " s idle · " + (pane.st.timer_owner === "omarchy" ? "Omarchy's timer" : "the Ito listener in hypridle")
            : "Nothing starts it on idle."
      color: pane.pal.bone
      font.family: "Noto Serif"; font.pixelSize: 12
    }
    Text {
      visible: pane.st && pane.st.timer_owner === "omarchy"
      Layout.fillWidth: true
      wrapMode: Text.WordWrap
      text: "Change the delay in Omarchy's settings (idle · screensaver); Ito never writes Omarchy's idle keys."
      color: pane.pal.bone; opacity: 0.72
      font.family: "Noto Serif"; font.pixelSize: 12
    }
    Cc.CcCard {
      visible: pane.st && pane.st.state === "partial"
      Layout.preferredWidth: 260; Layout.preferredHeight: 36
      radius: 18; host: pane.host.cc; pal: pane.pal; showCaption: false
      hint: "Takes only the Ito listener out of hypridle.conf; Omarchy's own timer stays."
      onActivated: pane.host.screensaverRunRef.run([pane.host.screensaverTool, "use-omarchy-timer"], "", "", "omarchy's timer")
      Text { anchors.centerIn: parent; text: "Use Omarchy's timer (two screensavers now)"; color: pane.pal.warn; font.family: "Noto Serif"; font.pixelSize: 12 }
    }
    Text {
      visible: pane.st && pane.st.screensaver_off === true
      Layout.fillWidth: true
      wrapMode: Text.WordWrap
      text: "Omarchy's own screensaver switch is off, so this stays inert until it is turned back on."
      color: pane.pal.bone     // your choice, not a fault
      font.family: "Noto Serif"; font.pixelSize: 12
    }
  }

  Cc.CcSection {
    host: pane.host.cc; pal: pane.pal; startOpen: true
    label: "TEXT"
    note: "The art that drifts across the screen. None of it carries a name."
    visible: pane.host.cc.match("screensaver text art spiral eye fog custom stock")
    Flow {
      Layout.fillWidth: true
      spacing: 16
      Repeater {
        model: [
          { "key": "spiral", "kanji": "渦", "name": "Spiral", "note": "A braille Uzumaki, the lock's own spiral." },
          { "key": "eye",    "kanji": "眼", "name": "Eye",    "note": "The pen-drawn eye of the terminal fetch." },
          { "key": "fog",    "kanji": "霧", "name": "Fog",    "note": "Fog, town, voice: the kanji of the town dissolving." },
          { "key": "custom", "kanji": "字", "name": "Yours",  "note": "Your own text file." },
          { "key": "stock",  "kanji": "標", "name": "Omarchy", "note": "Omarchy's own logo, untouched." }
        ]
        Cc.CcKoma {
          required property var modelData
          host: pane.host.cc; pal: pane.pal
          kanji: modelData.kanji; name: modelData.name; note: modelData.note
          source: pane.host.saverThumbs[modelData.key] || ""
          current: pane.host.screensaverText === modelData.key
          onActivated: {
            pane.host.act.set("screensaverText", modelData.key)
            if (modelData.key === "custom") customProc.running = true
            if (pane.host.screensaverOn) pane.host.applyScreensaver(true)
          }
        }
      }
    }
  }
  Process {
    id: customProc
    command: [pane.host.screensaverTool, "custom"]
    stdout: StdioCollector {
      onStreamFinished: { var s = pane.host.parsed(text); if (s && s.path) Quickshell.execDetached(["omarchy-launch-editor", s.path]) }
    }
  }

  Cc.CcSection {
    host: pane.host.cc; pal: pane.pal; startOpen: true
    label: "EFFECT"
    note: "Eight effects chosen for the book. Random picks one each time; Omarchy's random plays all of them."
    visible: pane.host.cc.match("screensaver effect smoke rings blackhole crumble vhstape burn spotlights swarm random")
    Flow {
      Layout.fillWidth: true
      spacing: 16
      Repeater {
        model: pane.host.effectsInfo.ito
        Cc.CcKoma {
          required property var modelData
          host: pane.host.cc; pal: pane.pal
          kanji: modelData.kanji; name: modelData.name; note: modelData.why
          current: pane.host.screensaverEffect === modelData.key
          onActivated: pane.host.act.set("screensaverEffect", modelData.key)
        }
      }
      Cc.CcKoma {
        host: pane.host.cc; pal: pane.pal
        kanji: "偶"; name: "Random · Ito"; note: "One of the eight each time."
        current: pane.host.screensaverEffect === "random-ito"
        onActivated: pane.host.act.set("screensaverEffect", "random-ito")
      }
      Cc.CcKoma {
        host: pane.host.cc; pal: pane.pal
        kanji: "全"; name: "Random · all"; note: "Omarchy's own random, every effect."
        current: pane.host.screensaverEffect === "random-all"
        onActivated: pane.host.act.set("screensaverEffect", "random-all")
      }
    }
    Text {
      Layout.fillWidth: true
      wrapMode: Text.WordWrap
      text: "A still of the text is shown above; the effect itself plays live in Preview now."
      color: pane.pal.bone; opacity: 0.72
      font.family: "Noto Serif"; font.pixelSize: 12
    }
  }

  Cc.CcSection {
    host: pane.host.cc; pal: pane.pal
    label: "ALL EFFECTS"
    note: "Every other effect ttfx offers."
    visible: pane.host.cc.match("screensaver all effects ttfx")
    Flow {
      Layout.fillWidth: true
      spacing: 8
      Repeater {
        model: pane.host.effectsInfo.all
        Cc.CcCard {
          required property var modelData
          width: 120; height: 34; radius: 17
          host: pane.host.cc; pal: pane.pal; showCaption: false
          current: pane.host.screensaverEffect === modelData
          hint: "Play only this effect."
          onActivated: pane.host.act.set("screensaverEffect", modelData)
          Text { anchors.centerIn: parent; text: modelData; color: pane.pal.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
        }
      }
    }
  }
}
