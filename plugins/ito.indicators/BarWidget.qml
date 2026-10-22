import QtQuick
import Quickshell.Io
import qs.Ui as Ui
import "../../bar/modules" as Ito
import "../../bar/modules/ItoIcons.js" as Icons

// Ito indicators: Omarchy's toggles (stay awake, night light, screen recording) as icons. Dim when off, lit
// when on; click flips them. Which drawing each wears is the user's choice (Icons page), and some versions are
// cameos: a pocket radio, a flashlight, the fog, a videotape.
//
// Written against the services Omarchy provides, and quiet without them.
Ui.BarWidget {
  id: root
  moduleName: "ito.indicators"

  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  // Which indicators this copy shows: "" for all three (the original combined widget), or one id ("awake", "night",
  // "record"). ito.awake, ito.nightlight and ito.recording are this same widget showing one each, so every one can be
  // moved on its own.
  property string only: ""
  readonly property var shown: {
    var out = []
    for (var i = 0; i < Icons.indicators.length; i++)
      if (only === "" || Icons.indicators[i].id === only) out.push(Icons.indicators[i])
    return out
  }

  readonly property string host: Qt.resolvedUrl("../../bar/modules/bin/ito-host").toString().replace("file://", "")
  readonly property url art: Qt.resolvedUrl("../../bar/modules/ito-art/")
  readonly property int glyph: Math.round(root.barSize * cfg.get("iconScale", 0.62))

  // Night light and stay-awake are both read from the machine itself (hyprsunset; the idle flag), not from a
  // first-party service the shell may or may not hand to a plugin -- asking the service is what left the
  // night-light icon dead, and stay-awake was one missing service away from the same thing.
  property bool nightOn: false
  property bool awakeOn: false
  property bool recording: false

  function isOn(id) {
    if (id === "awake") return awakeOn
    if (id === "night") return nightOn
    return recording
  }

  function flip(id) {
    if (id === "awake" && !toggleAwake.running) {
      awakeOn = !awakeOn                                         // answers at once; the probe confirms it
      toggleAwake.command = [host, "awake", "toggle"]
      toggleAwake.running = true
    }
    else if (id === "night" && !toggleNight.running) {
      nightOn = !nightOn
      toggleNight.command = [host, "nightlight", "toggle"]
      toggleNight.running = true
    }
    else if (id === "record" && root.bar) root.bar.run(host + " record")
  }

  Process {
    id: nightProbe
    command: [root.host, "nightlight", "status"]
    stdout: StdioCollector { onStreamFinished: root.nightOn = text.trim() === "on" }
  }
  Process {
    id: toggleNight
    onExited: nightSoon.restart()
  }
  Timer { id: nightSoon; interval: 700; onTriggered: if (!nightProbe.running) nightProbe.running = true }
  Timer { interval: 4000; running: root.only === "" || root.only === "night"; repeat: true; triggeredOnStart: true; onTriggered: if (!nightProbe.running) nightProbe.running = true }

  Process {
    id: awakeProbe
    command: [root.host, "awake", "status"]
    stdout: StdioCollector { onStreamFinished: root.awakeOn = text.trim() === "on" }
  }
  Process {
    id: toggleAwake
    onExited: awakeSoon.restart()
  }
  Timer { id: awakeSoon; interval: 700; onTriggered: if (!awakeProbe.running) awakeProbe.running = true }
  Timer { interval: 4000; running: root.only === "" || root.only === "awake"; repeat: true; triggeredOnStart: true; onTriggered: if (!awakeProbe.running) awakeProbe.running = true }

  // Recording is a process, not a service: look for it now and then.
  Process {
    id: probe
    command: ["pgrep", "--quiet", "-f", "^(gpu-screen-recorder|wf-recorder)"]
    onExited: function(code) { root.recording = code === 0 }
  }
  Timer { interval: 4000; running: root.only === "" || root.only === "record"; repeat: true; triggeredOnStart: true; onTriggered: if (!probe.running) probe.running = true }

  implicitWidth: row.implicitWidth
  implicitHeight: row.implicitHeight

  // Side by side on a horizontal bar, stacked on a vertical one.
  Grid {
    id: row
    columns: root.vertical ? 1 : Math.max(1, root.shown.length)
    horizontalItemAlignment: Grid.AlignHCenter
    verticalItemAlignment: Grid.AlignVCenter

    Repeater {
      model: root.shown

      Ui.WidgetButton {
        id: item
        required property var modelData
        readonly property bool on: root.isOn(modelData.id)

        bar: root.bar
        tooltipText: modelData.name + (on ? " — on" : " — off")
        labelVisible: false
        hasVisualContent: true
        horizontalMargin: 3
        fixedWidth: root.vertical ? root.barSize : root.glyph + scaledHorizontalMargin * 2
        fixedHeight: root.vertical ? root.glyph + 8 : root.barSize
        onPressed: function(mouseButton) { if (mouseButton === Qt.LeftButton) root.flip(modelData.id) }

        Ito.ItoHover {
          target: glyphImg; hovered: item.tooltipHovered; amp: cfg.motionAmp; glow: cfg.blood; palette: cfg; light: cfg.light
          kind: modelData.id === "awake" ? "flicker" : (modelData.id === "night" ? "breathe" : "wiggle")
        }
        Ito.ItoImage {
          id: glyphImg
          palette: cfg
          anchors.centerIn: parent
          width: root.glyph
          height: width
          source: Icons.art(root.art, cfg, modelData.id, item.on, root.glyph * Math.max(1, Screen.devicePixelRatio))
          fillMode: Image.PreserveAspectFit
          smooth: true
          mipmap: true
          opacity: item.on ? 1 : (item.tooltipHovered ? 0.9 : 0.68)
          Behavior on opacity { NumberAnimation { duration: 200 } }
        }
      }
    }
  }
}
