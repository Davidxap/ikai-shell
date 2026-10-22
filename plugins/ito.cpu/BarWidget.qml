import QtQuick
import Qt5Compat.GraphicalEffects
import Quickshell.Io
import qs.Ui as Ui
import qs.Commons as Commons
import "../../bar/modules" as Ito
import "../../bar/modules/ItoLayout.js" as PopupSize
import "../../bar/modules/ItoMotion.js" as Motion
import "../../bar/modules/ItoProcs.js" as Procs
import "../../bar/modules/ItoLore.js" as Lore
import "Model.js" as Model

// Ito cpu — theme gear artwork with live total CPU load from /proc/stat (polled).
// Left click opens the processor panel (a seal with a ray for each core and the load average winding at its centre,
// the pressure, clock and temperature beside it, and the busiest processes), right click opens btop; the tooltip shows
// the current load. `omarchy-shell ito.processor toggle` does the same as a left click. The panel reads /proc only
// while it is open.
// Plugin form of bar/modules/ito-cpu.qml. The ito.bar host loads registered
// plugins by id and has no support for `type: qml` entries.
Ui.BarWidget {
  id: root
  moduleName: "ito.cpu"

  // Same blood setting as workspaces/spiral. The default is the palette
  // paint stop; all stops are defined in themes/ito-verse/palette.toml.
    // Settings live in the sidecar, not in shell.json, because the engine
  // rewrites that file under us. See ItoConfig.qml.
  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  readonly property string host: Qt.resolvedUrl("../../bar/modules/bin/ito-host").toString().replace("file://", "")
  readonly property color blood: cfg.get("blood", setting("blood", "#651817"))
  readonly property int artSize: cfg.get("size", setting("size", 30))

  readonly property url art: Qt.resolvedUrl("../../bar/modules/ito-art/")
  // One standard glyph size for every bar icon; only the centre seal breaks it.
  readonly property int glyph: Math.round(root.barSize * cfg.get("iconScale", 0.62))
  readonly property bool showValues: cfg.get("showValues", true)
    && cfg.get("valueStyle", "percent") !== "off"
    && cfg.get("content:ito.cpu", "both") !== "icon"
  // "text" mode drops the icon and leaves the reading
  readonly property bool showIcon: cfg.get("content:ito.cpu", "both") !== "text"

  property real pct: 0
  property double prevIdle: -1
  property double prevTotal: -1

  function refresh() {
    if (!poll.running) poll.running = true
  }

  function parse(text) {
    var parts = String(text || "").trim().split(/\s+/)
    if (parts.length < 5 || parts[0] !== "cpu") return
    var nums = []
    // First 8 fields only: guest times are already counted inside user/nice.
    for (var i = 1; i < parts.length && i <= 8; i++) nums.push(parseFloat(parts[i]) || 0)
    var idle = nums[3] + (nums.length > 4 ? nums[4] : 0)
    var total = 0
    for (var j = 0; j < nums.length; j++) total += nums[j]
    if (root.prevTotal >= 0 && total > root.prevTotal) {
      var dTotal = total - root.prevTotal
      if (dTotal > 0)
        root.pct = Math.max(0, Math.min(1, 1 - (idle - root.prevIdle) / dTotal))
    }
    root.prevIdle = idle
    root.prevTotal = total
  }

  Process {
    id: poll
    running: true
    command: ["sh", "-c", "head -1 /proc/stat"]
    stdout: StdioCollector {
      onStreamFinished: root.parse(this.text)
    }
  }

  Timer {
    interval: 3000
    running: true
    repeat: true
    onTriggered: root.refresh()
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  Ui.WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: "CPU " + Math.round(root.pct * 100) + "%"
    horizontalMargin: 4
    labelVisible: false
    hasVisualContent: true
    fixedWidth: vertical ? barSize : content.width + scaledHorizontalMargin * 2
    fixedHeight: vertical ? content.height + scaledVerticalPadding * 2 : barSize
    onPressed: function(mouseButton) {
      if (mouseButton === Qt.LeftButton) popup.toggle()
      else if (mouseButton === Qt.RightButton && root.bar) root.bar.run(host + " tui btop")
    }

    // Side by side on a horizontal bar, stacked (icon over reading) on a vertical one.
    Grid {
      id: content
      anchors.centerIn: parent
      columns: root.vertical ? 1 : 9
      spacing: 3
      horizontalItemAlignment: Grid.AlignHCenter
      verticalItemAlignment: Grid.AlignVCenter

      // A chip with the spiral in it, filling with blood as the processor's load rises.
      Ito.ItoHover { parent: button; target: icon; hovered: button.tooltipHovered; kind: "pulse"; amp: cfg.motionAmp; glow: cfg.blood; palette: cfg; light: cfg.light }
      Ito.ItoFillArt {
        id: icon
        visible: root.showIcon
        palette: cfg
        size: root.glyph
        value: root.pct
        art: root.art + "system/cpu.png"
        inside: root.art + "system/cpu-fill.png"
        paper: false
      }

      Ito.ItoValue {
        visible: root.showValues
        barSize: root.barSize
        label: "CPU"
        vertical: root.vertical
        hot: root.pct > 0.8
        value: Math.round(root.pct * 100)
      }
    }
  }

  // ------------------------------------------------------------------------------------------ the panel
  // Nothing here runs while the panel is shut: the sampling process and its timers are tied to `opened`, and the
  // previous samples are dropped on close. One `sh -c` per refresh; Model.js and ItoProcs.js turn its text into
  // what is drawn. The header reads the bar's own `pct`, so the panel and the bar always agree.
  Ui.Panel {
    id: popup
    bar: root.bar
    moduleName: "ito.processor"
    ipcTarget: "ito.processor"

    property var sample: null        // previous /proc/stat reading (Model.update)
    property var procSnap: null      // previous per-process ticks (Procs.snapshot)
    property var view: null
    property var cores: []
    property var topProcs: []
    property int threadCount: 0
    property var readingRows: []
    // the lore pass (lore-pass.md): the panel's settled state and its flags (recomputed once per refresh), the line of the
    // memo, the busiest core of the last minute, and a counter the marks read to know that a refresh has landed
    property var loreState: null
    property int loreStreak: 0
    property var loreFlags: ({})
    property int memoSeed: 0
    property var peakHist: []
    property int peakCore: -1
    property real peakV: 0
    property int refreshTick: 0
    readonly property string loreLevel: tint.loreLevel
    // the art in the panel goes through the theme shader whatever the shell's mode, so no red in it is ever baked
    Ito.ItoPanelPalette { id: tint; source: cfg }
    // the panel's alert: the processor is saturated, or the sensor reads above 80 degrees C
    readonly property bool tempHot: view !== null && view.temp !== null && view.temp !== undefined && view.temp > 80

    // the height of the content once it had data, kept across closings: the window opens at this height instead of growing when the first
    // sample lands in the middle of the opening (a resize of the layer surface while the sheet moves; fluidity.md)
    property real heightMemo: 0
    readonly property bool filled: popup.threadCount > 0

    function refresh() {
      if (!sampler.running) sampler.running = true
    }

    function apply(text) {
      var v = Model.update(popup.sample, text)
      var procs = Procs.parsePidStats(v.procsText)
      popup.topProcs = Procs.groupTop(Procs.procRates(popup.procSnap, procs, v.dTotal), "cpu", 5)
      popup.procSnap = Procs.snapshot(procs)
      popup.sample = v.sample
      popup.cores = v.cores
      popup.threadCount = v.sample.cores.length
      popup.view = v
      popup.readingRows = Model.readings(v, popup.threadCount)
      popup.updateLore(v)
    }

    // the state and flags of the lore pass, and the busiest core of the last minute; `refreshTick` goes last
    function updateLore(v) {
      var n = popup.threadCount
      var maxCore = 0, maxIdx = -1
      for (var i = 0; i < popup.cores.length; i++) {
        var c = Number(popup.cores[i]) || 0
        if (c > maxCore || maxIdx < 0) { maxCore = c; maxIdx = i }
      }
      var m = {
        pct: root.pct, temp: v.temp, maxCore: maxCore,
        load1: v.load && n > 0 ? v.load[0] / n : -1,
        psi: v.psi !== null && v.psi !== undefined ? v.psi : -1,
        freqAvg: v.freq ? v.freq.avg : 0, freqMax: v.freq ? v.freq.max : 0
      }
      var st = Lore.settle(popup.loreState, Lore.stateFor("cpu", m), popup.loreStreak)
      popup.loreState = st.state
      popup.loreStreak = st.streak
      popup.loreFlags = Lore.flagsFor("cpu", m)
      if (maxIdx >= 0) {
        var pk = Lore.peakHold(popup.peakHist, { i: maxIdx, v: maxCore }, 30)
        popup.peakHist = pk.hist
        popup.peakCore = pk.i
        popup.peakV = pk.v
      }
      popup.refreshTick = popup.refreshTick + 1
    }

    onOpenedChanged: {
      if (opened) memoSeed = memoSeed + 1
      else {
        sample = null; procSnap = null; view = null; cores = []; topProcs = []; threadCount = 0; readingRows = []
        loreState = null; loreStreak = 0; loreFlags = ({}); peakHist = []; peakCore = -1; peakV = 0
      }
    }

    Process {
      id: sampler
      command: ["sh", "-c", "cat /proc/stat /proc/loadavg; echo @@psi; cat /proc/pressure/cpu 2>/dev/null; echo @@freq; cat /sys/devices/system/cpu/cpu[0-9]*/cpufreq/scaling_cur_freq 2>/dev/null; echo @@temp; for h in /sys/class/hwmon/hwmon*; do case $(cat $h/name) in k10temp|coretemp|zenpower|cpu_thermal) cat $h/temp1_input; break;; esac; done 2>/dev/null; echo @@procs; cat /proc/[0-9]*/stat 2>/dev/null"]
      stdout: StdioCollector {
        onStreamFinished: popup.apply(this.text)
      }
    }

    // the first reading has nothing to compare with, so a second one follows quickly
    Timer {
      interval: 2000
      running: popup.opened
      repeat: true
      triggeredOnStart: true
      onTriggered: popup.refresh()
    }
    Timer {
      interval: 600
      running: popup.opened
      repeat: false
      onTriggered: popup.refresh()
    }

    Ui.KeyboardPanel {
      id: panel
      anchorItem: button
      owner: popup
      bar: root.bar
      open: popup.opened
      focusTarget: keys

      gap: PopupSize.gapFor(panel)

      contentWidth: PopupSize.popupWidth(panel, Commons.Style.space(380))
      contentHeight: PopupSize.popupHeight(panel, Math.max(column.implicitHeight, popup.filled ? 0 : popup.heightMemo) + cfg.panelHeadroom + cfg.panelFootroom)

      // a see-through layer over the whole popup that only watches where the pointer is
      Item {
        anchors.fill: parent
        z: 1000
        HoverHandler { id: cardHover }
      }
      Ito.ItoPanelFrame {
        id: pf; host: panel; content: column;
        cfg: tint
        emblem: "needle"
        opened: popup.opened
        alert: root.pct > 0.9
        memos: []
        memo: Lore.memoFor("cpu", popup.loreState || "idle", popup.loreFlags, popup.memoSeed, popup.loreLevel,
          Lore.quoteLines())
      }
      Ito.ItoEnter { opened: popup.opened; amp: pf.presenceOn ? 0 : cfg.motionAmp; spring: true }
      Ito.ItoAutoClose {
        opened: popup.opened
        hovered: cardHover.hovered
        seconds: Number(cfg.get("popupSeconds", 3))
        onExpired: popup.close()
      }

      // Tab does nothing here: the panels do not cycle into one another (see the design notes of ito-system-panels).
      Ui.PanelKeyCatcher {
        id: keys
        anchors.fill: parent
        onCloseRequested: popup.close()

        Column {
          id: column
          // a little more room on the left than the card gives: the frame's crack crosses the first letters otherwise
          anchors { left: parent.left; right: parent.right; top: parent.top; leftMargin: 7; rightMargin: 3 }
          spacing: 12
          onImplicitHeightChanged: if (popup.filled) popup.heightMemo = implicitHeight

          // the reading glides to each new value instead of jumping; at rest it is exactly the bar's `pct`
          readonly property real amp: Math.min(cfg.motionAmp, 1)
          property real shownPct: root.pct
          Behavior on shownPct { NumberAnimation { duration: Math.round(260 * column.amp); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.soft } }

          // header: the icon that fills with load, the name, the reading
          Row {
            spacing: 14
            Ito.ItoFillArt {
              palette: tint
              size: 64
              value: column.shownPct
              art: root.art + "system/cpu.png"
              inside: root.art + "system/cpu-fill.png"
              paper: false
            }
            Column {
              anchors.verticalCenter: parent.verticalCenter
              spacing: 2
              Text {
                text: "PROCESSOR"
                color: cfg.blood
                font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.6
                renderType: Text.NativeRendering
              }
              Text {
                text: Math.round(column.shownPct * 100) + "%"
                color: root.pct > 0.9 ? tint.warn : cfg.bone
                Behavior on color { ColorAnimation { duration: Math.round(Motion.normal * column.amp) } }
                font.family: "Noto Serif"; font.pixelSize: 28; font.weight: Font.DemiBold
                renderType: Text.NativeRendering
              }
              Text {
                visible: popup.threadCount > 0
                text: popup.threadCount + " cores"
                color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.55)
                font.family: "Noto Serif"; font.pixelSize: 10; font.italic: true
                renderType: Text.NativeRendering
              }
            }
          }

          // the cores: a seal with a ray for each core and the run queue winding at its centre, and beside it the
          // readings (load, pressure, clock, temperature) as cells; every figure stays as text
          Ito.ItoCoreBlock {
            width: parent.width
            visible: popup.threadCount > 0
            cfg: tint
            live: popup.opened
            view: popup.view
            readings: popup.readingRows
            loads: popup.cores
            threads: popup.threadCount
            alert: root.pct > 0.9 || popup.tempHot
            lvl: popup.loreLevel
            peakCore: popup.peakCore
            peakV: popup.peakV
            tick: popup.refreshTick
          }

          // the busiest
          Column {
            width: parent.width
            spacing: 4
            Row {
              spacing: 6
              // 憑 (to possess): lore level off keeps the caption as it was, English only
              Text {
                visible: popup.loreLevel !== "off"
                anchors.verticalCenter: parent.verticalCenter
                text: "\u6191"
                color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.5)
                font.family: "Noto Serif CJK JP"; font.pixelSize: 10
                renderType: Text.NativeRendering
              }
              Text {
                anchors.verticalCenter: parent.verticalCenter
                text: "BUSIEST"
                color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.5)
                font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.6
                renderType: Text.NativeRendering
              }
            }
            Ito.ItoProcList { width: parent.width; cfg: tint; live: popup.opened; rows: popup.topProcs }
          }

          // footer: the one action, the same as a right click on the bar
          Item {
            width: parent.width
            height: 26
            Row {
              anchors { right: parent.right; verticalCenter: parent.verticalCenter }
              spacing: 8
              Text {
                anchors.verticalCenter: parent.verticalCenter
                text: "OPEN BTOP"
                color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.7)
                font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.4
                renderType: Text.NativeRendering
              }
              Ui.PanelActionButton {
                iconText: "\uf120"
                tooltipText: "Open btop"
                foreground: cfg.bone
                hoverColor: cfg.bone
                fontFamily: root.bar ? root.bar.fontFamily : "monospace"
                onClicked: {
                  popup.close()
                  if (root.bar) root.bar.run(root.host + " tui btop")
                }
              }
            }
          }
        }
      }
    }
  }
}
