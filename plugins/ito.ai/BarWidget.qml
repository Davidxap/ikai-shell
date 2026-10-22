import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui as Ui
import "../../bar/modules" as Ito
import "../../bar/modules/ItoLayout.js" as PopupSize

// Ito AI — what the models have actually consumed, as a brain that fills with blood.
//
// The numbers come from bin/ito-ai, which reads every writer of this data on the machine and keeps the
// freshest per provider. That matters: Omarchy's own agents widget writes a state file only while it is
// loaded, and with our bar it never is, so reading that file showed a five-hour window pinned at 100%
// while the real one was empty. Only a real quota (Claude's OAuth window, Omarchy's reported limits)
// reaches the bar; a local message count like OpenCode's is shown as consumption, not as a limit.
Ui.BarWidget {
  id: root
  moduleName: "ito.ai"

  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  readonly property url art: Qt.resolvedUrl("../../bar/modules/ito-art/")
  // Which drawing the quota fills: the side-view brain, or one of the forms of gen-ai-art.py (Icons page).
  readonly property string aiStyle: String(cfg.get("aiStyle", "brain"))
  readonly property string aiArt: aiStyle === "brain" ? "system/brain.png" : "system/ai-" + aiStyle + ".png"
  readonly property string aiFill: aiStyle === "brain" ? "system/brain-fill.png" : "system/ai-" + aiStyle + "-fill.png"
  readonly property int glyph: Math.round(root.barSize * cfg.get("iconScale", 0.62))
  readonly property bool showValues: cfg.get("showValues", true)
    && cfg.get("valueStyle", "percent") !== "off"
    && cfg.get("content:ito.ai", "both") !== "icon"
  readonly property bool showIcon: cfg.get("content:ito.ai", "both") !== "text"

  property bool popupOpen: false
  property var report: ({ "providers": [], "pct": -1, "anyStale": false, "at": "" })

  readonly property real pct: Number(report.pct)
  readonly property var providers: report.providers || []
  readonly property bool stale: report.anyStale === true

  // The limit the bar is showing, so the tooltip can name it rather than just give a number.
  readonly property string tightest: {
    var best = null, who = ""
    for (var i = 0; i < providers.length; i++) {
      var p = providers[i]
      if (!p.quota || !p.fresh) continue
      for (var j = 0; j < p.limits.length; j++)
        if (!best || p.limits[j].pct > best.pct) { best = p.limits[j]; who = p.name }
    }
    return best ? who + " · " + best.label + " " + Math.round(best.pct * 100) + "%" : ""
  }

  function reload(refresh) {
    if (probe.running) return
    probe.command = refresh
      ? [root.helper, "--refresh"] : [root.helper]
    probe.running = true
  }

  readonly property string helper: Qt.resolvedUrl("../../bar/modules/bin/ito-ai").toString().replace("file://", "")

  Process {
    id: probe
    running: false
    stdout: StdioCollector {
      onStreamFinished: {
        try {
          var parsed = JSON.parse(this.text)
          if (parsed && parsed.providers) root.report = parsed
        } catch (e) {
          // keep the last good reading rather than blanking the bar
        }
      }
    }
  }

  Timer {
    interval: 90000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: root.reload(false)
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  Ui.WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: root.pct >= 0
      ? root.tightest + (root.stale ? "  (some readings are old)" : "")
      : "AI usage — no quota reported"
    horizontalMargin: 4
    labelVisible: false
    hasVisualContent: true
    fixedWidth: vertical ? barSize : content.width + scaledHorizontalMargin * 2
    fixedHeight: vertical ? content.height + scaledVerticalPadding * 2 : barSize
    onPressed: function(mouseButton) {
      if (mouseButton === Qt.LeftButton) {
        root.popupOpen = !root.popupOpen
        if (root.popupOpen) root.reload(true)
      }
    }

    // Side by side on a horizontal bar, stacked (icon over reading) on a vertical one.
    Grid {
      id: content
      anchors.centerIn: parent
      columns: root.vertical ? 1 : 9
      spacing: 3
      horizontalItemAlignment: Grid.AlignHCenter
      verticalItemAlignment: Grid.AlignVCenter

      Ito.ItoHover { parent: button; target: hoverIcon; hovered: button.tooltipHovered; kind: "pulse"; amp: cfg.motionAmp; glow: cfg.blood; palette: cfg; light: cfg.light }
      Ito.ItoFillArt {
        id: hoverIcon
        visible: root.showIcon
        art: root.art + root.aiArt
        inside: root.art + root.aiFill
        size: root.glyph
        value: Math.max(0, root.pct)
        palette: cfg
        opacity: root.stale ? 0.65 : 1
      }

      Ito.ItoValue {
        visible: root.showValues && root.pct >= 0
        barSize: root.barSize
        label: "AI"
        vertical: root.vertical
        hot: root.pct > 0.85
        value: Math.round(root.pct * 100)
      }
    }
  }

  // ------------------------------------------------------------------ the panel
  // `omarchy-shell ito.aiusage toggle` (also open, close) for a keybinding.
  IpcHandler {
    target: "ito.aiusage"
    function open(): void { root.popupOpen = true; root.reload(false) }
    function close(): void { root.popupOpen = false }
    function toggle(): void { root.popupOpen = !root.popupOpen; if (root.popupOpen) root.reload(false) }
  }

  // Under its own icon (clamped to the screen), on whichever edge the bar is.
  PanelWindow {
    id: panel

    readonly property string pos: root.bar && root.bar.position ? String(root.bar.position) : "top"
    // from the screen edge to the card, as the shell's own popups place it: the bar's thickness plus its usual gap (the window has 12 px of
    // margin around the card, taken off)
    readonly property int edge: (root.bar ? root.bar.barSize : 46) + Style.gapsOut - 12

    readonly property bool side: pos === "left" || pos === "right"
    // where the icon is on the screen along the bar, read when the popup opens (the bar window covers the screen)
    property real iconStart: 0
    property real iconSize: 0
    function readIcon() {
      const w = root.QsWindow.window
      if (!w) return
      const p = root.mapToItem(null, 0, 0)
      iconStart = side ? p.y : p.x
      iconSize = side ? root.height : root.width
    }
    readonly property real along: PopupSize.alongStart(iconStart, iconSize, side ? implicitHeight : implicitWidth,
      screen ? (side ? screen.height : screen.width) : 0, 0)

    screen: root.QsWindow.window ? root.QsWindow.window.screen : null
    visible: root.popupOpen
    // under (or beside) its own icon, clamped to the screen; the gap to the bar is as before
    anchors.top: side || pos !== "bottom"
    anchors.bottom: !side && pos === "bottom"
    anchors.left: !side || pos === "left"
    anchors.right: side && pos === "right"
    margins.top: side ? along : (pos === "top" ? edge : 0)
    margins.bottom: !side && pos === "bottom" ? edge : 0
    margins.left: side ? (pos === "left" ? edge : 0) : along
    margins.right: side && pos === "right" ? edge : 0
    onVisibleChanged: if (visible) { readIcon(); Qt.callLater(logAnchor) }
    Connections {
      target: root
      function onPopupOpenChanged() { if (root.popupOpen) panel.readIcon() }
    }
    function logAnchor() {
      if (cfg.get("debugAnchor", false) !== true) return
      const x = side ? (pos === "left" ? edge : screen.width - edge - implicitWidth) : along
      console.log("ito-anchor ai cardY=" + ((side ? along : edge) + 12) + " cardX=" + (x + 12) + " cardW=" + card.width + " iconX=" + (iconStart + iconSize / 2) + " iconW=0 iconCx=" + (iconStart + iconSize / 2) + " barH=0 screenW=" + (screen ? screen.width : 0))
    }
    onAlongChanged: if (visible) Qt.callLater(logAnchor)
    exclusionMode: ExclusionMode.Ignore
    implicitWidth: card.width + 24
    implicitHeight: card.height + 24
    color: "transparent"

    HoverHandler { id: panelHover }
    Ito.ItoAutoClose {
      opened: root.popupOpen
      hovered: panelHover.hovered
      seconds: Number(cfg.get("popupSeconds", 3))
      onExpired: root.popupOpen = false
    }

    Item {
      id: card
      x: 12
      y: 12
      // narrower where the screen is (a side bar leaves less room)
      width: Math.min(508, (panel.screen ? panel.screen.width : 1920) - panel.edge - 36)
      height: column.implicitHeight + cfg.panelHeadroom + cfg.panelFootroom + 44

      Ito.ItoPanelFrame { id: pf; content: column; barSide: panel.pos;
        cfg: cfg; target: card; emblem: "mind"; opened: root.popupOpen
        memos: []
      }
      Ito.ItoEnter {
        opened: root.popupOpen
        amp: pf.presenceOn ? 0 : cfg.motionAmp
        origin: panel.pos === "bottom" ? Item.Bottom : Item.Top
      }

      ColumnLayout {
        id: column
        x: 24
        y: 22 + cfg.panelHeadroom
        width: card.width - 48
        spacing: 12

        // ---------------------------------------------------------------- hero
        RowLayout {
          Layout.fillWidth: true
          spacing: 12

          Ito.ItoFillArt {
            art: root.art + root.aiArt
            inside: root.art + root.aiFill
            size: 64
            value: Math.max(0, root.pct)
            palette: cfg
          }

          ColumnLayout {
            Layout.fillWidth: true
            spacing: 1

            Text {
              text: "AI USAGE"
              color: cfg.bone
              font.family: "Noto Serif"
              font.pixelSize: 12
              font.weight: Font.DemiBold
              font.letterSpacing: 3
            }

            Text {
              Layout.fillWidth: true
              text: root.pct >= 0 ? root.tightest : "No provider is reporting a limit."
              color: cfg.bone
              opacity: 0.58
              font.family: "Noto Serif"
              font.pixelSize: 11
              elide: Text.ElideRight
            }
          }

          Text {
            text: root.pct >= 0 ? Math.round(root.pct * 100) + "%" : "—"
            color: root.pct > 0.85 ? cfg.lit : cfg.bone
            font.family: "Noto Serif"
            font.pixelSize: 30
            font.weight: Font.Light
          }
        }

        // ---------------------------------------------------------------- providers
        Repeater {
          model: root.providers

          ColumnLayout {
            required property var modelData
            Layout.fillWidth: true
            spacing: 5

            Rectangle { Layout.fillWidth: true; height: 1; color: cfg.blood; opacity: 0.3 }

            RowLayout {
              Layout.fillWidth: true
              spacing: 8

              Text {
                text: modelData.name
                color: cfg.bone
                font.family: "Noto Serif"
                font.pixelSize: 13
              }

              Text {
                visible: modelData.plan !== ""
                text: modelData.plan
                color: cfg.blood
                opacity: 0.85
                font.family: "Noto Serif"
                font.pixelSize: 11
              }

              Item { Layout.fillWidth: true }

              // how old the reading is: a number nobody can trust should say so
              Text {
                text: modelData.fresh ? (modelData.todayLabel !== "" ? modelData.todayLabel + " today" : "")
                  : "read " + modelData.ageMinutes + " min ago"
                color: modelData.fresh ? cfg.bone : cfg.blood
                opacity: modelData.fresh ? 0.55 : 0.9
                font.family: "Noto Serif"
                font.pixelSize: 11
              }
            }

            // the quotas, if this provider has any
            Repeater {
              model: modelData.quota ? modelData.limits : []

              RowLayout {
                required property var modelData
                Layout.fillWidth: true
                spacing: 8

                Text {
                  Layout.preferredWidth: 112
                  text: modelData.label
                  color: cfg.bone
                  opacity: 0.7
                  font.family: "Noto Serif"
                  font.pixelSize: 11
                  elide: Text.ElideRight
                }

                Rectangle {
                  Layout.fillWidth: true
                  height: 6
                  radius: 3
                  color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.14)

                  Rectangle {
                    anchors.left: parent.left
                    anchors.verticalCenter: parent.verticalCenter
                    width: Math.max(2, parent.width * modelData.pct)
                    height: parent.height
                    radius: parent.radius
                    color: modelData.pct > 0.85 ? cfg.lit : cfg.blood
                  }
                }

                Text {
                  Layout.preferredWidth: 38
                  horizontalAlignment: Text.AlignRight
                  text: Math.round(modelData.pct * 100) + "%"
                  color: cfg.bone
                  font.family: "Noto Serif"
                  font.pixelSize: 11
                }

                Text {
                  Layout.preferredWidth: 58
                  horizontalAlignment: Text.AlignRight
                  text: modelData.minutes === null || modelData.minutes === undefined ? ""
                    : modelData.minutes < 60 ? modelData.minutes + " min"
                    : modelData.minutes < 2880 ? Math.round(modelData.minutes / 60) + " h"
                    : Math.round(modelData.minutes / 1440) + " d"
                  color: cfg.bone
                  opacity: 0.45
                  font.family: "Noto Serif"
                  font.pixelSize: 11
                }
              }
            }

            // what each model has eaten: the part a limit never shows
            Repeater {
              model: modelData.models

              RowLayout {
                required property var modelData
                Layout.fillWidth: true
                spacing: 8

                Text {
                  Layout.preferredWidth: 170
                  text: modelData.name
                  color: cfg.bone
                  opacity: 0.75
                  font.family: "Noto Serif"
                  font.pixelSize: 11
                  elide: Text.ElideRight
                }

                Rectangle {
                  Layout.fillWidth: true
                  height: 4
                  radius: 2
                  color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.12)

                  Rectangle {
                    anchors.left: parent.left
                    anchors.verticalCenter: parent.verticalCenter
                    width: Math.max(2, parent.width * Math.max(0.02, modelData.pct))
                    height: parent.height
                    radius: parent.radius
                    color: cfg.blood
                    opacity: 0.75
                  }
                }

                Text {
                  Layout.preferredWidth: 60
                  horizontalAlignment: Text.AlignRight
                  text: modelData.label
                  color: cfg.bone
                  opacity: 0.8
                  font.family: "Noto Serif"
                  font.pixelSize: 11
                }

                Text {
                  Layout.preferredWidth: 58
                  horizontalAlignment: Text.AlignRight
                  text: modelData.today !== "" ? modelData.today + " today" : ""
                  color: cfg.bone
                  opacity: 0.45
                  font.family: "Noto Serif"
                  font.pixelSize: 10
                }
              }
            }
          }
        }

        // ---------------------------------------------------------------- footer
        RowLayout {
          Layout.fillWidth: true
          Layout.topMargin: 2

          Text {
            text: root.report.at !== "" ? "read at " + root.report.at : ""
            color: cfg.bone
            opacity: 0.4
            font.family: "Noto Serif"
            font.pixelSize: 10
          }

          Item { Layout.fillWidth: true }

          Rectangle {
            Layout.preferredWidth: 96
            Layout.preferredHeight: 28
            radius: 14
            color: refreshHover.hovered ? Qt.rgba(cfg.blood.r, cfg.blood.g, cfg.blood.b, 0.3) : "transparent"
            border.width: 1
            border.color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.25)
            Behavior on color { ColorAnimation { duration: 120 } }

            Text {
              anchors.centerIn: parent
              text: probe.running ? "reading…" : "Refresh"
              color: cfg.bone
              font.family: "Noto Serif"
              font.pixelSize: 11
            }

            HoverHandler { id: refreshHover; cursorShape: Qt.PointingHandCursor }
            TapHandler { onTapped: root.reload(true) }
          }
        }
      }
    }
  }
}
