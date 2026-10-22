import QtQuick
import Quickshell
import Quickshell.Services.Mpris
import qs.Ui as Ui
import qs.Commons as Commons
import "../../bar/modules" as Ito
import "../../bar/modules/ItoLayout.js" as PopupSize

// Ito media: previous, play or pause, next, for whatever is playing (any MPRIS player: Spotify, a browser,
// mpv…). The play ring is blood while something plays. Nothing is drawn when there is no player, so it
// costs the bar no room.
Ui.BarWidget {
  id: root
  moduleName: "ito.media"

  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  readonly property url art: Qt.resolvedUrl("../../bar/modules/ito-art/media/")
  readonly property int glyph: Math.round(root.barSize * cfg.get("iconScale", 0.62))

  // The player that is playing, else the first one there is.
  readonly property var player: {
    var list = Mpris.players.values
    for (var i = 0; i < list.length; i++)
      if (list[i].isPlaying) return list[i]
    return list.length > 0 ? list[0] : null
  }
  readonly property bool playing: player ? player.isPlaying : false
  readonly property string track: player ? String(player.trackTitle || "") : ""

  visible: player !== null

  // Something moves in a pill behind the controls while a track plays, and stops when it stops. Which effect it is
  // (blood, the spiral, eyes, fog or radio static) is chosen on the Effects page; it leaps when the track changes.
  onTrackChanged: if (root.playing) blood.pulse()
  onPlayingChanged: blood.pulse()

  Ito.ItoMediaFx {
    id: blood
    anchors.centerIn: parent
    width: parent.width - 6
    height: Math.min(parent.height - 10, 30)
    radius: 15
    kind: String(cfg.get("mediaFx", "blood"))
    customSource: String(cfg.get("mediaFx", "blood")) !== "custom" ? "" : "file://" + Quickshell.env("HOME") + "/.config/ito/effects/custom?v=" + cfg.get("fxCustomVer", 0)
    active: root.playing
    blood: cfg.blood
    bone: cfg.bone
    speed: cfg.fxSpeed
    z: 0
  }
  implicitWidth: player ? controls.implicitWidth : 0
  implicitHeight: player ? controls.implicitHeight : 0

  // Side by side on a horizontal bar, stacked on a vertical one.
  Grid {
    id: controls
    columns: root.vertical ? 1 : 3
    horizontalItemAlignment: Grid.AlignHCenter
    verticalItemAlignment: Grid.AlignVCenter

    Repeater {
      model: [
        { "face": "media-prev", "tip": "Previous", "act": "prev" },
        { "face": "playpause", "tip": "Play or pause", "act": "toggle" },
        { "face": "media-next", "tip": "Next", "act": "next" }
      ]

      Ui.WidgetButton {
        id: control
        required property var modelData

        bar: root.bar
        tooltipText: (modelData.act === "toggle" && root.track !== "") ? root.track + "\nRight-click: player" : modelData.tip
        labelVisible: false
        hasVisualContent: true
        horizontalMargin: 2
        enabled: root.player !== null
        fixedWidth: root.vertical ? root.barSize : root.glyph + scaledHorizontalMargin * 2
        fixedHeight: root.vertical ? root.glyph + 8 : root.barSize
        onPressed: function(mouseButton) {
          if (mouseButton === Qt.RightButton && root.player) { popup.toggle(); return }
          if (mouseButton !== Qt.LeftButton || !root.player) return
          if (modelData.act === "prev" && root.player.canGoPrevious) root.player.previous()
          else if (modelData.act === "next" && root.player.canGoNext) root.player.next()
          else if (modelData.act === "toggle" && root.player.canTogglePlaying) root.player.togglePlaying()
        }

        Ito.ItoHover { target: ring; hovered: control.tooltipHovered; kind: modelData.face === "playpause" ? "pulse" : "lift"; amp: cfg.motionAmp; glow: cfg.blood; palette: cfg; light: cfg.light }
        Ito.ItoImage {
          id: ring
          palette: cfg
          anchors.centerIn: parent
          width: root.glyph
          height: width
          // playing shows the pause ring; paused shows the red play ring
          source: root.art + (modelData.face === "playpause"
            ? (root.playing ? "media-pause" : "media-play") : modelData.face) + ".png"
          fillMode: Image.PreserveAspectFit
          smooth: true
          mipmap: true
          opacity: control.tooltipHovered ? 1 : 0.9
        }
      }
    }
  }

  // ------------------------------------------------------------------------------------------ the player
  // Right-click any of the three rings (or `omarchy-shell ito.player toggle`) opens a larger player: the cover,
  // the title, a progress line you can seek on, and the controls. The position is polled once a second only
  // while it is open and something plays, so a closed player costs nothing.
  Ui.Panel {
    id: popup
    bar: root.bar
    moduleName: "ito.player"
    ipcTarget: "ito.player"

    readonly property var mp: root.player
    readonly property real length: mp && mp.lengthSupported ? Math.max(0, mp.length) : 0
    readonly property real position: mp && mp.positionSupported ? Math.max(0, mp.position) : 0
    readonly property real ratio: length > 0 ? Math.min(1, position / length) : 0

    function clock(seconds) {
      var t = Math.max(0, Math.floor(seconds))
      var m = Math.floor(t / 60), sec = t % 60
      return m + ":" + (sec < 10 ? "0" : "") + sec
    }

    Timer {
      running: popup.opened && root.playing && popup.mp !== null && popup.mp.positionSupported
      interval: 1000
      repeat: true
      triggeredOnStart: true
      onTriggered: popup.mp.positionChanged()
    }

    Ui.KeyboardPanel {
      id: panel
      anchorItem: controls
      owner: popup
      bar: root.bar
      open: popup.opened && root.player !== null
      focusTarget: keys
     
      gap: PopupSize.gapFor(panel)
     
      contentWidth: PopupSize.popupWidth(panel, Commons.Style.space(380))
      contentHeight: PopupSize.popupHeight(panel, 104 + column.spacing + (popup.length > 0 ? 30 + column.spacing : 0) + 46 + cfg.panelHeadroom + cfg.panelFootroom)

      // a see-through layer over the whole popup that only watches where the pointer is
      Item {
        anchors.fill: parent
        z: 1000
        HoverHandler { id: cardHover }
      }
      Ito.ItoPanelFrame { id: pf; host: panel; content: column; cfg: cfg; emblem: "spiral"; opened: popup.opened; memos: [] }
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
        onMoveRequested: function(dx, dy) {
          if (!root.player) return
          if (dx < 0 && root.player.canGoPrevious) root.player.previous()
          else if (dx > 0 && root.player.canGoNext) root.player.next()
        }
        onActivateRequested: if (root.player && root.player.canTogglePlaying) root.player.togglePlaying()
        onCloseRequested: popup.close()
        onTabRequested: function(direction) { popup.switchPanel(direction) }

        Column {
          id: column
          anchors { left: parent.left; right: parent.right; top: parent.top }
          spacing: Commons.Style.space(14)

          // cover and names
          Row {
            width: parent.width
            spacing: Commons.Style.space(14)

            Rectangle {
              id: cover
              width: 104; height: 104
              color: Qt.rgba(cfg.ink.r, cfg.ink.g, cfg.ink.b, 1)
              border.width: 1
              border.color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.5)
              clip: true
              Image {
                id: coverArt
                anchors { fill: parent; margins: 3 }
                source: popup.mp ? String(popup.mp.trackArtUrl || "") : ""
                fillMode: Image.PreserveAspectFit
                asynchronous: true
                cache: true
                visible: status === Image.Ready
                // an inked look: pulled towards grey so any cover sits in the same world as the bar
                opacity: 0.92
              }
              // no cover: the spiral
              Ito.ItoImage {
                palette: cfg
                visible: coverArt.status !== Image.Ready
                anchors.centerIn: parent
                width: 64; height: 64
                source: Qt.resolvedUrl("../../bar/modules/ito-art/system/menu-uzumaki.png")
                fillMode: Image.PreserveAspectFit
                smooth: true
                opacity: 0.8
              }
            }

            Column {
              width: parent.width - cover.width - parent.spacing
              spacing: 5
              anchors.verticalCenter: cover.verticalCenter

              Text {
                width: parent.width
                text: popup.mp ? String(popup.mp.trackTitle || "Nothing playing") : ""
                color: cfg.bone
                font.family: "Noto Serif"
                font.pixelSize: 17
                font.weight: Font.DemiBold
                wrapMode: Text.Wrap
                maximumLineCount: 2
                elide: Text.ElideRight
                renderType: Text.NativeRendering
              }
              Text {
                width: parent.width
                visible: text !== ""
                text: popup.mp ? String(popup.mp.trackArtist || "") : ""
                color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.78)
                font.family: "Noto Serif"
                font.pixelSize: 12
                elide: Text.ElideRight
                renderType: Text.NativeRendering
              }
              Text {
                width: parent.width
                visible: text !== ""
                text: popup.mp ? String(popup.mp.trackAlbum || "") : ""
                color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.5)
                font.family: "Noto Serif"
                font.pixelSize: 11
                font.italic: true
                elide: Text.ElideRight
                renderType: Text.NativeRendering
              }
              Text {
                text: popup.mp ? String(popup.mp.identity || "").toUpperCase() : ""
                color: cfg.blood
                font.family: "Noto Serif"
                font.pixelSize: 9
                font.letterSpacing: 1.6
                renderType: Text.NativeRendering
              }
            }
          }

          // progress: a thin rule, blood where it has been, a small diamond where it is; click to seek
          Item {
            width: parent.width
            height: 30
            visible: popup.length > 0

            Rectangle {
              id: rule
              anchors { left: parent.left; right: parent.right; top: parent.top; topMargin: 8 }
              height: 2
              color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.22)
              Rectangle {
                width: rule.width * popup.ratio
                height: parent.height
                color: cfg.blood
              }
              Rectangle {
                width: 8; height: 8
                rotation: 45
                color: cfg.blood
                x: rule.width * popup.ratio - width / 2
                y: (parent.height - height) / 2
              }
            }
            MouseArea {
              anchors { left: parent.left; right: parent.right; top: parent.top }
              height: 18
              enabled: popup.mp !== null && popup.mp.canSeek
              cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
              onClicked: function(mouse) {
                popup.mp.position = Math.max(0, Math.min(1, mouse.x / width)) * popup.length
                popup.mp.positionChanged()
              }
            }
            Text {
              anchors { left: parent.left; bottom: parent.bottom }
              text: popup.clock(popup.position)
              color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.6)
              font.family: "Noto Serif"; font.pixelSize: 10
              renderType: Text.NativeRendering
            }
            Text {
              anchors { right: parent.right; bottom: parent.bottom }
              text: popup.clock(popup.length)
              color: Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.6)
              font.family: "Noto Serif"; font.pixelSize: 10
              renderType: Text.NativeRendering
            }
          }

          // controls: shuffle, the three rings, repeat
          Row {
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: Commons.Style.space(16)

            Text {
              anchors.verticalCenter: parent.verticalCenter
              visible: popup.mp !== null && popup.mp.shuffleSupported
              text: "SHUFFLE"
              color: popup.mp && popup.mp.shuffle ? cfg.blood : Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.5)
              font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.4
              renderType: Text.NativeRendering
              MouseArea {
                anchors { fill: parent; margins: -6 }
                cursorShape: Qt.PointingHandCursor
                onClicked: popup.mp.shuffle = !popup.mp.shuffle
              }
            }

            Repeater {
              model: [
                { "face": "media-prev", "act": "prev" },
                { "face": "playpause", "act": "toggle" },
                { "face": "media-next", "act": "next" }
              ]
              Item {
                required property var modelData
                width: 46; height: 46
                Ito.ItoImage {
                  palette: cfg
                  anchors.fill: parent
                  source: root.art + (modelData.face === "playpause"
                    ? (root.playing ? "media-pause" : "media-play") : modelData.face) + ".png"
                  fillMode: Image.PreserveAspectFit
                  smooth: true
                  mipmap: true
                  scale: ma.containsMouse ? 1.1 : 1
                  opacity: ma.containsMouse ? 1 : 0.9
                  Behavior on scale { NumberAnimation { duration: Math.round(140 * Math.min(cfg.motionAmp, 1)); easing.type: Easing.OutCubic } }
                }
                MouseArea {
                  id: ma
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: {
                    var p = root.player
                    if (!p) return
                    if (modelData.act === "prev" && p.canGoPrevious) p.previous()
                    else if (modelData.act === "next" && p.canGoNext) p.next()
                    else if (modelData.act === "toggle" && p.canTogglePlaying) p.togglePlaying()
                  }
                }
              }
            }

            Text {
              anchors.verticalCenter: parent.verticalCenter
              visible: popup.mp !== null && popup.mp.loopSupported
              text: "REPEAT"
              color: popup.mp && popup.mp.loopState !== MprisLoopState.None ? cfg.blood : Qt.rgba(cfg.bone.r, cfg.bone.g, cfg.bone.b, 0.5)
              font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.4
              renderType: Text.NativeRendering
              MouseArea {
                anchors { fill: parent; margins: -6 }
                cursorShape: Qt.PointingHandCursor
                onClicked: popup.mp.loopState = popup.mp.loopState === MprisLoopState.None ? MprisLoopState.Playlist : MprisLoopState.None
              }
            }
          }
        }
      }
    }
  }
}
