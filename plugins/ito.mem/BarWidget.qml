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

// Ito memory — theme chip artwork with live RAM use from /proc/meminfo (polled).
// Left click opens the memory panel (a vessel of liquid that shows what the used memory is made of, with every figure
// in GiB and MiB beside it, the swap by kind, the pages waiting to be written as drops, and the biggest processes in
// resident memory), right click opens btop; the tooltip shows used vs total.
// `omarchy-shell ito.memory toggle` does the same as a left click. The panel reads /proc only while it is open.
// Plugin form of bar/modules/ito-mem.qml. The ito.bar host loads registered
// plugins by id and has no support for `type: qml` entries.
Ui.BarWidget {
  id: root
  moduleName: "ito.mem"

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
  readonly property int glyph: Math.round(root.barSize * cfg.get("iconScale", 0.62))
  readonly property bool showValues: cfg.get("showValues", true)
    && cfg.get("valueStyle", "percent") !== "off"
    && cfg.get("content:ito.mem", "both") !== "icon"
  // "text" mode drops the icon and leaves the reading
  readonly property bool showIcon: cfg.get("content:ito.mem", "both") !== "text"

  property real pct: 0
  property double usedKiB: 0
  property double totalKiB: 1

  function gib(kib) {
    return (kib / 1024 / 1024).toFixed(1)
  }

  function refresh() {
    if (!poll.running) poll.running = true
  }

  function parse(text) {
    var total = 0, avail = 0
    var lines = String(text || "").split("\n")
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^(\w+):\s+(\d+)/)
      if (!m) continue
      if (m[1] === "MemTotal") total = parseFloat(m[2])
      else if (m[1] === "MemAvailable") avail = parseFloat(m[2])
    }
    if (!(total > 0)) return
    root.totalKiB = total
    root.usedKiB = Math.max(0, total - avail)
    root.pct = Math.max(0, Math.min(1, root.usedKiB / total))
  }

  Process {
    id: poll
    running: true
    command: ["sh", "-c", "head -3 /proc/meminfo"]
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
    tooltipText: "Memory " + Math.round(root.pct * 100) + "% · "
      + root.gib(root.usedKiB) + " / " + root.gib(root.totalKiB) + " GiB"
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

      // A memory module with an eye on each chip, filling with blood as memory is used.
      Ito.ItoHover { parent: button; target: icon; hovered: button.tooltipHovered; kind: "lift"; amp: cfg.motionAmp; glow: cfg.blood; palette: cfg; light: cfg.light }
      Ito.ItoFillArt {
        id: icon
        visible: root.showIcon
        palette: cfg
        size: root.glyph
        value: root.pct
        art: root.art + "system/mem.png"
        inside: root.art + "system/mem-fill.png"
        paper: false
      }

      Ito.ItoValue {
        visible: root.showValues
        barSize: root.barSize
        label: "RAM"
        vertical: root.vertical
        detail: Math.round(root.usedKiB / 1024 / 1024) + "/" + Math.round(root.totalKiB / 1024 / 1024) + "G"
        hot: root.pct > 0.85
        value: Math.round(root.pct * 100)
      }
    }
  }

  // ------------------------------------------------------------------------------------------ the panel
  // Nothing here runs while the panel is shut: the sampling process and its timer are tied to `opened`, and what was
  // read is dropped on close. One `sh -c` per refresh; Model.js and ItoProcs.js turn its text into what is drawn.
  // The header reads the bar's own `pct`, `usedKiB` and `totalKiB`, so the panel and the bar always agree.
  Ui.Panel {
    id: popup
    bar: root.bar
    moduleName: "ito.memory"
    ipcTarget: "ito.memory"

    property var view: null
    property var legendRows: []
    property var swapRows: []
    property var topProcs: []
    property int groupCount: 0       // process groups holding memory right now (the lore's "crowd" flag, 7 = the table is full)
    property double dirty: -1        // KiB of Dirty + Writeback when above the threshold, else -1
    property double dirtyAll: 0      // KiB of Dirty + Writeback whatever its size: sets how often a drop forms
    property int pageSize: 4096      // read once each time the panel opens
    // the lore pass (lore-pass.md): the settled state and flags (once per refresh), the memo's rotation, a refresh counter for the marks
    property var loreState: null
    property int loreStreak: 0
    property var loreFlags: ({})
    property int memoSeed: 0
    property int refreshTick: 0
    readonly property string loreLevel: tint.loreLevel
    // the art in the panel goes through the theme shader whatever the shell's mode, so no red in it is ever baked
    Ito.ItoPanelPalette { id: tint; source: cfg }
    readonly property bool hot: root.pct > 0.85

    // the height of the content once it had data, kept across closings: the window opens at this height instead of growing when the first
    // sample lands in the middle of the opening (a resize of the layer surface while the sheet moves; fluidity.md)
    property real heightMemo: 0
    readonly property bool filled: popup.legendRows.length > 0

    function refresh() {
      if (!sampler.running) sampler.running = true
    }

    function apply(text) {
      var v = Model.update(text)
      popup.view = v
      popup.legendRows = v.legend
      popup.swapRows = v.swaps
      popup.dirty = v.dirty === null ? -1 : v.dirty
      popup.dirtyAll = v.dirtyAll
      var groups = Procs.groupTop(Procs.parsePidStats(v.procsText), "rss", 7, popup.pageSize)
      popup.topProcs = groups.slice(0, 5)
      popup.groupCount = groups.length
      popup.updateLore()
    }

    // the state and flags of the lore pass; `refreshTick` goes last, so the marks decide their edges on a complete picture
    function updateLore() {
      var swapMax = 0, cache = 0
      for (var i = 0; i < popup.swapRows.length; i++) swapMax = Math.max(swapMax, Number(popup.swapRows[i].fraction) || 0)
      for (var j = 0; j < popup.legendRows.length; j++) if (popup.legendRows[j].key === "cache") cache = Number(popup.legendRows[j].fraction) || 0
      var m = { pct: root.pct, swapMax: swapMax, groups: popup.groupCount, cache: cache }
      var st = Lore.settle(popup.loreState, Lore.stateFor("ram", m), popup.loreStreak)
      popup.loreState = st.state
      popup.loreStreak = st.streak
      popup.loreFlags = Lore.flagsFor("ram", m)
      popup.refreshTick = popup.refreshTick + 1
    }

    onOpenedChanged: {
      if (opened) memoSeed = memoSeed + 1
      else {
        view = null; legendRows = []; swapRows = []; topProcs = []; groupCount = 0; dirty = -1; dirtyAll = 0
        loreState = null; loreStreak = 0; loreFlags = ({})
      }
    }

    // the page size turns resident pages into bytes; it is read once per opening
    Process {
      id: pager
      running: popup.opened
      command: ["getconf", "PAGESIZE"]
      stdout: StdioCollector {
        onStreamFinished: { var n = parseInt(this.text, 10); if (n > 0) popup.pageSize = n }
      }
    }

    Process {
      id: sampler
      command: ["sh", "-c", "cat /proc/meminfo; echo @@swaps; cat /proc/swaps; echo @@procs; cat /proc/[0-9]*/stat 2>/dev/null"]
      stdout: StdioCollector {
        onStreamFinished: popup.apply(this.text)
      }
    }

    Timer {
      interval: 2000
      running: popup.opened
      repeat: true
      triggeredOnStart: true
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
        emblem: "web"
        opened: popup.opened
        alert: root.pct > 0.9
        memos: []
        memo: Lore.memoFor("ram", popup.loreState || "idle", popup.loreFlags, popup.memoSeed, popup.loreLevel,
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

          // header: the icon that fills with use, the name, the reading, used of total
          Row {
            spacing: 14
            Ito.ItoFillArt {
              palette: tint
              size: 64
              value: column.shownPct
              art: root.art + "system/mem.png"
              inside: root.art + "system/mem-fill.png"
              paper: false
            }
            Column {
              anchors.verticalCenter: parent.verticalCenter
              spacing: 2
              Text {
                text: "MEMORY"
                color: cfg.blood
                font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.6
                renderType: Text.NativeRendering
              }
              Text {
                text: Math.round(column.shownPct * 100) + "%"
                color: popup.hot ? tint.warn : cfg.bone
                Behavior on color { ColorAnimation { duration: Math.round(Motion.normal * column.amp) } }
                font.family: "Noto Serif"; font.pixelSize: 28; font.weight: Font.DemiBold
                renderType: Text.NativeRendering
              }
              Text {
                text: root.gib(root.usedKiB) + " of " + root.gib(root.totalKiB) + " GiB"
                color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.55)
                font.family: "Noto Serif"; font.pixelSize: 10; font.italic: true
                renderType: Text.NativeRendering
              }
            }
          }

          // what the memory is made of: the vessel, with each part's figure beside it, then the swap seals
          Column {
            width: parent.width
            spacing: 6
            visible: popup.legendRows.length > 0
            Row {
              spacing: 6
              Text {
                anchors.verticalCenter: parent.verticalCenter
                text: "\u5c64"
                color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.5)
                font.family: "Noto Serif CJK JP"; font.pixelSize: 10
                renderType: Text.NativeRendering
              }
              Text {
                anchors.verticalCenter: parent.verticalCenter
                text: "BREAKDOWN"
                color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.5)
                font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.6
                renderType: Text.NativeRendering
              }
            }
            Ito.ItoVesselBlock {
              width: parent.width
              cfg: tint
              live: popup.opened
              legend: popup.legendRows
              swaps: popup.swapRows
              hot: popup.hot
              dirtyKiB: popup.dirtyAll
              dirtyText: popup.dirty >= 0 ? Model.fmtSize(popup.dirty) + " dirty + writeback" : ""
              lvl: popup.loreLevel
              loreState: popup.loreState || "idle"
              tick: popup.refreshTick
            }
          }

          // the biggest, by what they hold in memory right now
          Column {
            width: parent.width
            spacing: 4
            Row {
              spacing: 6
              // 棲 (to dwell): with the lore level off the caption stays English only
              Text {
                visible: popup.loreLevel !== "off"
                anchors.verticalCenter: parent.verticalCenter
                text: "\u68f2"
                color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.5)
                font.family: "Noto Serif CJK JP"; font.pixelSize: 10
                renderType: Text.NativeRendering
              }
              Text {
                anchors.verticalCenter: parent.verticalCenter
                text: "LARGEST · RESIDENT"
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
