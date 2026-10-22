import QtQuick
import Qt5Compat.GraphicalEffects
import Quickshell.Io
import qs.Ui as Ui
import qs.Commons as Commons
import "../../bar/modules" as Ito
import "../../bar/modules/ItoLayout.js" as PopupSize
import "../../bar/modules/ItoMotion.js" as Motion
import "../../bar/modules/ItoLore.js" as Lore
import "Model.js" as Model

// Ito disk — theme drive artwork with live root filesystem use from df (polled).
// Left click opens the storage panel (a platter with a ring for each mount, the read and write traffic, and a row for
// every mount), right click opens the home folder; the tooltip shows use vs free space.
// `omarchy-shell ito.storage toggle` does the same as a left click. The panel reads df and /proc/diskstats only while it
// is open.
// Plugin form of bar/modules/ito-disk.qml. The ito.bar host loads registered
// plugins by id and has no support for `type: qml` entries.
Ui.BarWidget {
  id: root
  moduleName: "ito.disk"

  // Same blood setting as workspaces/spiral. The default is the palette
  // paint stop; all stops are defined in themes/ito-verse/palette.toml.
    // Settings live in the sidecar, not in shell.json, because the engine
  // rewrites that file under us. See ItoConfig.qml.
  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  readonly property color blood: cfg.get("blood", setting("blood", "#651817"))
  readonly property int artSize: cfg.get("size", setting("size", 30))

  readonly property url art: Qt.resolvedUrl("../../bar/modules/ito-art/")
  readonly property color live: cfg.blood
  readonly property int glyph: Math.round(root.barSize * cfg.get("iconScale", 0.62))
  readonly property bool showValues: cfg.get("showValues", true)
    && cfg.get("valueStyle", "percent") !== "off"
    && cfg.get("content:ito.disk", "both") !== "icon"
  // "text" mode drops the icon and leaves the reading
  readonly property bool showIcon: cfg.get("content:ito.disk", "both") !== "text"

  property real pct: 0
  property double availBytes: 0
  property double usedBytes: 0

  function gib(b) {
    return (b / 1024 / 1024 / 1024).toFixed(1)
  }

  function refresh() {
    if (!poll.running) poll.running = true
  }

  function parse(text) {
    var m = String(text || "").match(/(\d+)%\s+(\d+)\s+(\d+)/)
    if (!m) return
    root.pct = Math.max(0, Math.min(1, parseInt(m[1], 10) / 100))
    root.usedBytes = parseFloat(m[2]) || 0
    root.availBytes = parseFloat(m[3]) || 0
  }

  Process {
    id: poll
    running: true
    command: ["sh", "-c", "df -B1 --output=pcent,used,avail / | tail -1"]
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
    tooltipText: "Disk / " + Math.round(root.pct * 100) + "% · "
      + root.gib(root.availBytes) + " GiB free"
    horizontalMargin: 4
    labelVisible: false
    hasVisualContent: true
    fixedWidth: vertical ? barSize : content.width + scaledHorizontalMargin * 2
    fixedHeight: vertical ? content.height + scaledVerticalPadding * 2 : barSize
    onPressed: function(mouseButton) {
      if (mouseButton === Qt.LeftButton) popup.toggle()
      else if (mouseButton === Qt.RightButton && root.bar) root.bar.run("xdg-open ~")
    }

    // Side by side on a horizontal bar, stacked (icon over reading) on a vertical one.
    Grid {
      id: content
      anchors.centerIn: parent
      columns: root.vertical ? 1 : 9
      spacing: 3
      horizontalItemAlignment: Grid.AlignHCenter
      verticalItemAlignment: Grid.AlignVCenter

      // A platter that fills with blood as the disk fills.
      Ito.ItoHover { parent: button; target: icon; hovered: button.tooltipHovered; kind: "spin"; amp: cfg.motionAmp; glow: cfg.blood; palette: cfg; light: cfg.light }
      Ito.ItoFillArt {
        id: icon
        visible: root.showIcon
        palette: cfg
        size: root.glyph
        value: root.pct
        art: root.art + "system/disk.png"
        inside: root.art + "system/disk-fill.png"
        paper: false
      }

      Ito.ItoValue {
        visible: root.showValues
        barSize: root.barSize
        label: "DISK"
        vertical: root.vertical
        detail: Math.round(root.usedBytes / 1073741824) + "/" + Math.round((root.usedBytes + root.availBytes) / 1073741824) + "G"
        hot: root.pct > 0.9
        value: Math.round(root.pct * 100)
      }
    }
  }

  // ------------------------------------------------------------------------------------------ the panel
  // Nothing here runs while the panel is shut: the sampling process and its timers are tied to `opened`, and the
  // previous samples are dropped on close. One `sh -c` per refresh (df under a 2 s timeout, so a hung mount cannot stall
  // it); Model.js turns its text into what is drawn. The header reads the bar's own `pct`, so the panel and the bar
  // always agree.
  Ui.Panel {
    id: popup
    bar: root.bar
    moduleName: "ito.storage"
    ipcTarget: "ito.storage"

    property var sample: null        // previous reading (Model.update): the disk counters and the last good mounts
    property var view: null
    property var mountRows: []
    property var readingRows: []
    // the lore pass (lore-pass.md): the settled state and flags (once per refresh), the memo's rotation, the mount with the most room
    // (the save square), the mounts past the cap, and a refresh counter for the marks
    property var loreState: null
    property int loreStreak: 0
    property var loreFlags: ({})
    property int memoSeed: 0
    property int saveIndex: -1
    property int moreMounts: 0
    property int refreshTick: 0
    readonly property string loreLevel: tint.loreLevel
    // the art in the panel goes through the theme shader whatever the shell's mode, so no red in it is ever baked
    Ito.ItoPanelPalette { id: tint; source: cfg }

    // the height of the content once it had data, kept across closings: the window opens at this height instead of growing when the first
    // sample lands in the middle of the opening (a resize of the layer surface while the sheet moves; fluidity.md)
    property real heightMemo: 0
    readonly property bool filled: popup.mountRows.length > 0 || popup.view !== null

    function refresh() {
      if (!sampler.running) sampler.running = true
    }

    function apply(text) {
      var v = Model.update(popup.sample, text, Date.now())
      popup.sample = v.sample
      popup.view = v
      popup.mountRows = v.mounts
      popup.readingRows = Model.readings(v)
      popup.updateLore(v)
    }

    // the state and flags of the lore pass; `refreshTick` goes last, so the marks decide their edges on a complete picture
    function updateLore(v) {
      var anyHot = false
      for (var i = 0; i < v.mounts.length; i++) if (v.mounts[i].hot) anyHot = true
      var busy = v.io && v.io.busy !== null && v.io.busy !== undefined ? v.io.busy : 0
      var m = {
        rootFraction: v.mounts.length > 0 ? v.mounts[0].fraction : 0, anyHot: anyHot, temp: v.temp,
        busy: busy, rw: v.io ? v.io.read + v.io.write : 0, more: v.more
      }
      var st = Lore.settle(popup.loreState, Lore.stateFor("disk", m), popup.loreStreak)
      popup.loreState = st.state
      popup.loreStreak = st.streak
      popup.loreFlags = Lore.flagsFor("disk", m)
      popup.saveIndex = Lore.saveTarget(v.mounts)
      popup.moreMounts = v.more
      popup.refreshTick = popup.refreshTick + 1
    }

    onOpenedChanged: {
      if (opened) memoSeed = memoSeed + 1
      else {
        sample = null; view = null; mountRows = []; readingRows = []
        loreState = null; loreStreak = 0; loreFlags = ({}); saveIndex = -1; moreMounts = 0
      }
    }

    Process {
      id: sampler
      command: ["sh", "-c", "timeout 2 df -l -B1 --output=source,target,fstype,size,used,avail -x tmpfs -x devtmpfs -x efivarfs -x overlay -x squashfs 2>/dev/null; echo @@stats; cat /proc/diskstats 2>/dev/null; echo @@temp; for h in /sys/class/hwmon/hwmon*; do case $(cat $h/name) in nvme) cat $h/temp1_input; break;; esac; done 2>/dev/null"]
      stdout: StdioCollector {
        onStreamFinished: popup.apply(this.text)
      }
    }

    // the first reading has nothing to compare with, so a second one follows quickly
    Timer {
      interval: 3000
      running: popup.opened
      repeat: true
      triggeredOnStart: true
      onTriggered: popup.refresh()
    }
    Timer {
      interval: 700
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
        emblem: "amigara"
        opened: popup.opened
        alert: root.pct > 0.9
        memos: []
        memo: Lore.memoFor("disk", popup.loreState || "idle", popup.loreFlags, popup.memoSeed, popup.loreLevel,
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
              art: root.art + "system/disk.png"
              inside: root.art + "system/disk-fill.png"
              paper: false
            }
            Column {
              anchors.verticalCenter: parent.verticalCenter
              spacing: 2
              Text {
                text: "STORAGE"
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
                text: root.gib(root.usedBytes) + " of " + root.gib(root.usedBytes + root.availBytes) + " GiB"
                color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.55)
                font.family: "Noto Serif"; font.pixelSize: 10; font.italic: true
                renderType: Text.NativeRendering
              }
            }
          }

          // the platter: a ring for each mount, the traffic turning the rune bands, the readings beside it
          Ito.ItoPlatterBlock {
            width: parent.width
            visible: popup.mountRows.length > 0 || popup.view !== null
            cfg: tint
            live: popup.opened
            view: popup.view
            readings: popup.readingRows
            alert: root.pct > 0.9
            lvl: popup.loreLevel
            tick: popup.refreshTick
          }

          // one row per mount, led by the glyph of its ring; the used share, the figures as text
          Column {
            width: parent.width
            visible: popup.mountRows.length > 0
            // by position, not by list: a row keeps its groove between refreshes and glides to the new reading
            Repeater {
              model: popup.mountRows.length
              Ito.ItoMountRow {
                required property int index
                readonly property var r: popup.mountRows[index]
                width: parent.width
                cfg: tint
                live: popup.opened
                ringIndex: index
                ringCount: popup.mountRows.length
                label: r ? r.label : ""
                value: r ? r.value : ""
                fraction: r ? r.fraction : 0
                hot: r ? r.hot : false
                threshold: r ? r.threshold : 0.9
                lvl: popup.loreLevel
                extra: r ? r.extra : 0
                saveTarget: index === popup.saveIndex
              }
            }
          }

          // the mounts past the cap (lore only; with the lore off nothing is said about them, as before)
          Text {
            visible: popup.loreLevel !== "off" && popup.moreMounts > 0
            width: parent.width
            horizontalAlignment: Text.AlignRight
            text: popup.moreMounts + " more in the fog \u00b7 \u9727"
            color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.6)
            font.family: "Noto Serif CJK JP"; font.pixelSize: 9; font.letterSpacing: 0.6
            renderType: Text.NativeRendering
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
                text: "OPEN HOME"
                color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.7)
                font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.4
                renderType: Text.NativeRendering
              }
              Ui.PanelActionButton {
                iconText: "\uf07b"
                tooltipText: "Open the home folder"
                foreground: cfg.bone
                hoverColor: cfg.bone
                fontFamily: root.bar ? root.bar.fontFamily : "monospace"
                onClicked: {
                  popup.close()
                  if (root.bar) root.bar.run("xdg-open ~")
                }
              }
            }
          }
        }
      }
    }
  }
}
