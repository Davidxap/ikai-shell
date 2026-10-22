import QtQuick
import Quickshell
import Quickshell.Io
import qs.Ui as Ui
import qs.Commons as Commons
import "../../bar/modules" as Ito
import "../../bar/modules/ItoLayout.js" as PopupSize

// Ito notifications: the sheet's bell. Still when nothing is waiting, in blood when something is, and the eye
// that watches instead when they are silenced. Click toggles Do Not Disturb; right-click opens the last ones it
// heard (or `omarchy-shell ito.notifycenter toggle`).
//
// Written against the notification service Omarchy provides when the shell hands it over (that also gives the
// count of what is waiting). When it does not, Do Not Disturb is still read and flipped through ito-host, so the
// bell and its click keep working; only the waiting count needs the service.
Ui.BarWidget {
  id: root
  moduleName: "ito.notifications"

  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  readonly property url art: Qt.resolvedUrl("../../bar/modules/ito-art/notifications/")
  readonly property int glyph: Math.round(root.barSize * cfg.get("iconScale", 0.62))
  readonly property var service: root.bar && root.bar.shell && typeof root.bar.shell.firstPartyServiceFor === "function"
    ? root.bar.shell.firstPartyServiceFor("omarchy.notifications") : null
  readonly property string host: Qt.resolvedUrl("../../bar/modules/bin/ito-host").toString().replace("file://", "")
  property bool dndPolled: false
  readonly property bool silenced: service ? service.doNotDisturb === true : dndPolled
  readonly property int waiting: service && service.popupModel ? service.popupModel.count : 0
  readonly property string face: silenced ? "notification-dnd" : (waiting > 0 ? "notification-active" : "notification")

  // Something new arrives: a drop of blood falls from the bell.
  property int seen: 0
  onWaitingChanged: {
    if (waiting > seen) drop.restart()
    seen = waiting
    if (popup.opened) reloadHistory()
  }

  function toggleDnd() {
    if (root.service && typeof root.service.setDoNotDisturb === "function") {
      root.service.setDoNotDisturb(!root.silenced)
    } else if (!dndToggle.running) {
      root.dndPolled = !root.dndPolled                          // answers at once; the probe confirms it
      dndToggle.command = [root.host, "dnd", "toggle"]
      dndToggle.running = true
    }
  }

  Process {
    id: dndProbe
    command: [root.host, "dnd", "status"]
    stdout: StdioCollector { onStreamFinished: root.dndPolled = text.trim() === "on" }
  }
  Process {
    id: dndToggle
    onExited: dndSoon.restart()
  }
  Timer { id: dndSoon; interval: 600; onTriggered: if (!dndProbe.running) dndProbe.running = true }
  // only needed while there is no service to ask
  Timer { interval: 4000; running: !root.service; repeat: true; triggeredOnStart: true; onTriggered: if (!dndProbe.running) dndProbe.running = true }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  Ui.WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: (root.silenced ? "Notifications silenced" : (root.waiting > 0 ? root.waiting + " waiting" : "No notifications")) + "\nRight-click: history"
    labelVisible: false
    hasVisualContent: true
    horizontalMargin: 6
    fixedWidth: vertical ? barSize : root.glyph + scaledHorizontalMargin * 2
    fixedHeight: vertical ? root.glyph + scaledVerticalPadding * 2 : barSize
    onPressed: function(mouseButton) {
      if (mouseButton === Qt.RightButton) { popup.toggle(); return }
      if (mouseButton !== Qt.LeftButton) return
      root.toggleDnd()
    }

    Rectangle {
      id: dropMark
      z: 5
      width: 6
      height: 8
      radius: 3
      color: cfg.blood
      x: (parent.width - width) / 2
      y: parent.height * 0.55
      opacity: 0
    }

    ParallelAnimation {
      id: drop
      NumberAnimation { target: dropMark; property: "y"; from: button.height * 0.5; to: button.height * 1.0; duration: 900
                        easing.type: Easing.InQuad }
      SequentialAnimation {
        NumberAnimation { target: dropMark; property: "opacity"; from: 0; to: 0.95; duration: 120 }
        PauseAnimation { duration: 500 }
        NumberAnimation { target: dropMark; property: "opacity"; to: 0; duration: 280 }
      }
    }

    Ito.ItoHover { target: bell; hovered: button.tooltipHovered; kind: "ring"; amp: cfg.motionAmp; glow: cfg.blood; palette: cfg; light: cfg.light }
    Ito.ItoImage {
      id: bell
      palette: cfg
      anchors.centerIn: parent
      width: root.glyph
      height: root.glyph
      source: root.art + root.face + ".png"
      fillMode: Image.PreserveAspectFit
      smooth: true
      mipmap: true
      // the bell rings a little when something new arrives
      transformOrigin: Item.Top
      rotation: 0
    }
  }

  // ------------------------------------------------------------------------------------- what it heard
  // The last notifications Omarchy kept (its history folder, ten at most), with the switch for Do Not Disturb and
  // a way to clear them. Read with jq when the panel opens or something arrives; nothing runs while it is shut.
  readonly property string historyDir: Quickshell.env("HOME") + "/.local/state/omarchy/notifications/history"
  property var entries: []

  Process {
    id: readHistory
    running: false
    command: ["sh", "-c", "jq -cs 'sort_by(.timestamp | tonumber) | reverse | .[0:10]' \"$1\"/*.json 2>/dev/null || echo '[]'", "sh", root.historyDir]
    stdout: StdioCollector {
      onStreamFinished: {
        try { root.entries = JSON.parse(this.text.trim() || "[]") } catch (e) { root.entries = [] }
      }
    }
  }
  function reloadHistory() { if (!readHistory.running) readHistory.running = true }
  function ago(ms) {
    var s = Math.max(0, (Date.now() - Number(ms)) / 1000)
    if (s < 60) return "just now"
    if (s < 3600) return Math.floor(s / 60) + " min ago"
    if (s < 86400) return Math.floor(s / 3600) + " h ago"
    return Math.floor(s / 86400) + " d ago"
  }

  Process {
    id: clearAll
    running: false
    command: ["sh", "-c", "rm -f \"$1\"/*.json", "sh", root.historyDir]
    onExited: { root.entries = []; root.reloadHistory() }
  }

  Ui.Panel {
    id: popup
    bar: root.bar
    moduleName: "ito.notifications.center"
    ipcTarget: "ito.notifycenter"
    onOpenedChanged: if (opened) root.reloadHistory()

    Ui.KeyboardPanel {
      id: panel
      anchorItem: button
      owner: popup
      bar: root.bar
      open: popup.opened
      focusTarget: keys
      gap: PopupSize.gapFor(panel)
      contentWidth: PopupSize.popupWidth(panel, Commons.Style.space(360))
      contentHeight: PopupSize.popupHeight(panel, column.implicitHeight + cfg.panelHeadroom + cfg.panelFootroom)

      Item {
        anchors.fill: parent
        z: 1000
        HoverHandler { id: cardHover }
      }
      Ito.ItoPanelFrame { id: pf; host: panel; content: column; cfg: cfg; emblem: "phone"; opened: popup.opened; alert: root.silenced; memos: [] }
      Ito.ItoEnter { opened: popup.opened; amp: pf.presenceOn ? 0 : cfg.motionAmp }
      Ito.ItoAutoClose {
        opened: popup.opened
        hovered: cardHover.hovered
        seconds: Number(cfg.get("popupSeconds", 3))
        onExpired: popup.close()
      }

      Ui.PanelKeyCatcher {
        id: keys
        anchors.fill: parent
        onCloseRequested: popup.close()
        onTabRequested: function(direction) { popup.switchPanel(direction) }

        Column {
          id: column
          anchors { left: parent.left; right: parent.right; top: parent.top }
          spacing: Commons.Style.space(12)

          // title and the silence switch
          Item {
            width: parent.width
            height: 34

            Column {
              anchors.verticalCenter: parent.verticalCenter
              spacing: 1
              Text {
                text: "Notifications"
                color: cfg.bone
                font.family: "Noto Serif"; font.pixelSize: 15; font.weight: Font.DemiBold
                renderType: Text.NativeRendering
              }
              Text {
                text: root.silenced ? "DO NOT DISTURB" : (root.waiting > 0 ? root.waiting + " WAITING" : "LISTENING")
                color: root.silenced ? cfg.blood : Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.55)
                font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.6
                renderType: Text.NativeRendering
              }
            }
            Ui.ToggleSwitch {
              anchors { right: parent.right; verticalCenter: parent.verticalCenter }
              checked: root.silenced
              onToggled: root.toggleDnd()
            }
          }

          Rectangle { width: parent.width; height: 1; color: cfg.bone; opacity: 0.16 }

          // the last ones, newest first
          Repeater {
            model: root.entries

            Column {
              required property var modelData
              width: column.width
              spacing: 2
              Row {
                width: parent.width
                Text {
                  width: parent.width - stamp.implicitWidth - 8
                  text: String(modelData.summary || modelData.app || "Notification")
                  color: cfg.bone
                  font.family: "Noto Serif"; font.pixelSize: 13; font.weight: Font.DemiBold
                  elide: Text.ElideRight
                  renderType: Text.NativeRendering
                }
                Text {
                  id: stamp
                  text: root.ago(modelData.timestamp)
                  color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.45)
                  font.family: "Noto Serif"; font.pixelSize: 10
                  renderType: Text.NativeRendering
                }
              }
              Text {
                width: parent.width
                visible: text !== ""
                text: String(modelData.body || "").replace(/<[^>]*>/g, "")
                color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.72)
                font.family: "Noto Serif"; font.pixelSize: 12
                wrapMode: Text.Wrap
                maximumLineCount: 2
                elide: Text.ElideRight
                renderType: Text.NativeRendering
              }
            }
          }

          Text {
            visible: root.entries.length === 0
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            topPadding: 10
            bottomPadding: 6
            text: "Nothing yet."
            color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.5)
            font.family: "Noto Serif"; font.pixelSize: 12; font.italic: true
            renderType: Text.NativeRendering
          }

          Text {
            visible: root.entries.length > 0
            anchors.horizontalCenter: parent.horizontalCenter
            text: "CLEAR"
            color: clearArea.containsMouse ? cfg.blood : Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.55)
            font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.6
            renderType: Text.NativeRendering
            MouseArea {
              id: clearArea
              anchors { fill: parent; margins: -8 }
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onClicked: {
                if (root.service && typeof root.service.clearPopups === "function") root.service.clearPopups()
                if (!clearAll.running) clearAll.running = true
              }
            }
          }
        }
      }
    }
  }
}
