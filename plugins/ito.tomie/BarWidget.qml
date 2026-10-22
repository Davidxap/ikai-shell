import QtQuick
import Quickshell
import Quickshell.Io
import qs.Ui as Ui
import "../../bar/modules" as Ito
import "../../bar/modules/cc" as Cc
import "../../bar/modules/ItoMarks.js" as Marks

// Ito centre seal — the mark at the middle of the bar, and the door to the control centre.
//
// A blood vein grows out of each side of a vertical kanji seal (which work it comes from is a setting).
// Clicking it opens the IKAI control centre: the shape and design of the bar, its look, which widgets
// are on it, the marks, the colours, the plugins and the health of the shell.
//
// The seal is the one glyph on the bar that is NOT the standard icon size, and the one widget that cannot
// be switched off: it is the way back in.
Ui.BarWidget {
  id: root
  moduleName: "ito.tomie"

  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  readonly property url art: Qt.resolvedUrl("../../bar/modules/ito-art/")
  readonly property real k: root.barSize / 52

  property bool popupOpen: false
  // Effects run while the pointer is over the seal or the panel is open, or all the time when asked.
  readonly property bool fxOn: String(cfg.get("fxWhen", "hover")) === "always" || popupOpen || button.tooltipHovered
  readonly property var seal: Marks.findSeal(Marks.sealResolve(String(cfg.get("seal", "tomie")), cfg.userMarkNames))
  // An ART seal (shipped drawing or the user's mark) is an exact-pixel square, drawn 1:1 at the seal's side.
  readonly property bool artSeal: !!root.seal.art || !!root.seal.user
  readonly property real dpr: Math.max(1, Screen.devicePixelRatio)
  readonly property int sealWant: Math.max(1, Math.round(Marks.sealSide(root.barSize) * root.dpr))
  readonly property var sealPick: root.seal.user ? cfg.userMark(String(root.seal.user), root.sealWant) : null
  readonly property int sealPx: root.seal.art ? Marks.nearestSealSide(root.sealWant) : (root.sealPick && root.sealPick.px > 0 ? root.sealPick.px : 0)
  readonly property string sealArtSource: root.seal.art
    ? Qt.resolvedUrl("../../bar/modules/ito-art/tomie/seals/" + root.seal.art + "/" + root.sealPx + ".png").toString()
    : (root.sealPick ? String(root.sealPick.url) : "")
  // What stands beside the seal (Logo page): the veins, thorns, curls, hair, drips, eyes, cracks, stitches, or nothing.
  readonly property var deco: Marks.decoration(cfg)

  // A slow, barely-there breathing in the veins so the seal feels alive. It runs while an effect is on (pointer
  // over the seal, panel open, or "Always"), and when Motion is not off. At rest it holds still: an animation
  // that never stops keeps the render thread awake all day, which was most of the shell's idle cost.
  property real idleGlow: 0.07
  SequentialAnimation on idleGlow {
    running: root.fxOn && cfg.motionAmp > 0
    loops: Animation.Infinite
    NumberAnimation { to: 0.11; duration: 2600; easing.type: Easing.InOutSine }
    NumberAnimation { to: 0.05; duration: 2600; easing.type: Easing.InOutSine }
  }

  // One bar on the screen, and it is this one. The seal is always on the bar, so it keeps watch: if another
  // bar turns up beside this one (a status bar left running from another shell, an autostart line re-run by
  // a compositor reload) it is stopped, and bin/ito-onebar says so in its log. Turn it off with oneBar=false.
  Process {
    id: guard
    command: [Qt.resolvedUrl("../../bar/modules/bin/ito-onebar").toString().replace("file://", "")]
    running: false
  }

  Timer {
    interval: 6000
    running: cfg.get("oneBar", true) !== false
    repeat: true
    triggeredOnStart: true
    onTriggered: if (!guard.running) guard.running = true
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  Ui.WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: "IKAI — " + root.seal.name
    horizontalMargin: 4
    labelVisible: false
    hasVisualContent: true
    fixedWidth: vertical ? barSize : icon.width + scaledHorizontalMargin * 2
    fixedHeight: vertical ? icon.height + scaledVerticalPadding * 2 : barSize
    onPressed: function(mouseButton) {
      if (mouseButton === Qt.LeftButton) root.popupOpen = !root.popupOpen
    }

    // The veins reach out of the seal's sides on a horizontal bar, and above and below it on a vertical one.
    Grid {
      id: icon
      anchors.centerIn: parent
      columns: root.vertical ? 1 : 3
      spacing: root.vertical ? 0 : 2
      horizontalItemAlignment: Grid.AlignHCenter
      verticalItemAlignment: Grid.AlignVCenter

      // The vein reaches out of the seal, with the faintest bloom behind it so the red reads as blood on
      // the plate rather than as a thin scratch.
      Ito.ItoFx {
        id: leftVein
        kind: String(cfg.get("fxVeins", "none"))
        active: root.fxOn
        speed: cfg.fxSpeed
        strength: cfg.fxStrength
        color: cfg.blood
        visible: root.deco.art !== ""
        // Beside the seal the ornament stands upright. On a vertical bar it goes above and below the seal instead, so it is
        // turned on its side and given the bar's width to lie along (upright in a 22 px box it shrank to a sliver).
        width: root.deco.art === "" ? 0
          : root.vertical ? Math.round(Math.min(root.barSize - 8, 44 * root.k)) : Math.round(20 * root.k * root.deco.wide)
        height: root.vertical ? Math.round(Math.min(26, 17 * root.k * root.deco.wide)) : Math.round(44 * root.k)

        Ito.ItoGlow {
          anchors.centerIn: parent
          width: parent.width * 2.4
          height: parent.height * 1.2
          color: cfg.blood
          strength: (sealBox.lit ? 0.22 : root.idleGlow) * cfg.light
          Behavior on strength { NumberAnimation { duration: 220 } }
        }

        Ito.ItoImage {
          palette: cfg
          tintable: root.deco.art !== "@custom"
          anchors.centerIn: parent
          width: root.vertical ? parent.height : parent.width
          height: root.vertical ? parent.width : parent.height
          rotation: root.vertical ? 90 : 0
          source: Marks.decoSource(root.art.toString(), root.deco, Quickshell.env("HOME"))
        }
      }

      // The seal is typography: crisp at any size, and it follows the palette. It reddens when the panel
      // is open or the pointer is over it -- or always, or never, if the Logo page's "Seal colour" is set
      // to On or Off instead of Auto.
      Item {
        id: sealBox
        width: Math.round(28 * root.k)
        height: Math.round(44 * root.k)
        readonly property string litMode: String(cfg.get("sealLit", "auto"))
        readonly property bool lit: litMode === "on"
          || (litMode !== "off" && (root.popupOpen || button.tooltipHovered))

        Ito.ItoGlow {
          anchors.centerIn: parent
          width: Math.round(78 * root.k)
          height: Math.round(78 * root.k)
          color: cfg.blood
          strength: (sealBox.lit ? 0.26 : 0) * cfg.light
          Behavior on strength { NumberAnimation { duration: 220 } }
        }

        Ito.ItoFx {
          anchors.centerIn: parent
          width: parent.width
          height: parent.height
          kind: String(cfg.get("fxSeal", "none"))
          active: root.fxOn
          speed: cfg.fxSpeed
          strength: cfg.fxStrength
          color: cfg.blood

          Text {
            visible: !root.seal.custom && !root.artSeal
            anchors.centerIn: parent
            text: root.seal.text
            color: sealBox.lit ? cfg.lit : cfg.bone
            font.family: "Noto Serif CJK JP"
            font.weight: Font.Bold
            font.features: { "vert": 1 }   // vertical forms: the long-vowel mark and brackets stand upright in the stack
            font.pixelSize: Math.round(16 * root.k * root.seal.scale)
            lineHeight: 0.78
            lineHeightMode: Text.ProportionalHeight
            horizontalAlignment: Text.AlignHCenter
            Behavior on color { ColorAnimation { duration: 200 } }
          }

          // An art seal: exact pixels, no filtering, recoloured by the theme shader like the marks.
          Ito.ItoImage {
            visible: root.artSeal
            palette: cfg
            tintable: true
            anchors.centerIn: parent
            width: Math.round(sealBox.height * 0.9)
            height: width
            source: root.artSeal ? root.sealArtSource : ""
            sourceSize: root.sealPx > 0 ? Qt.size(root.sealPx, root.sealPx) : Qt.size(0, 0)
            fillMode: Image.PreserveAspectFit
            smooth: root.sealPx <= 0
            mipmap: root.sealPx <= 0
            onStatusChanged: if (status === Image.Error && root.sealPick) cfg.userFail(String(root.sealPick.url))
          }

          // The user's own picture in place of the letters.
          Ito.ItoImage {
            visible: !!root.seal.custom
            palette: cfg
            tintable: false
            anchors.centerIn: parent
            width: Math.round(sealBox.height * 0.9)
            height: width
            // Only asked for once the user has actually chosen it: an unconditional source would try to load a file
            // that does not exist yet on every start, and log a warning for nothing.
            source: root.seal.custom ? Marks.sealPicture(Quickshell.env("HOME")) : ""
            fillMode: Image.PreserveAspectFit
            smooth: true
            mipmap: true
          }
        }
      }

      Ito.ItoFx {
        id: rightVein
        kind: String(cfg.get("fxVeins", "none"))
        active: root.fxOn
        speed: cfg.fxSpeed
        strength: cfg.fxStrength
        color: cfg.blood
        visible: root.deco.art !== ""
        width: leftVein.width
        height: leftVein.height

        Ito.ItoGlow {
          anchors.centerIn: parent
          width: parent.width * 2.4
          height: parent.height * 1.2
          color: cfg.blood
          strength: (sealBox.lit ? 0.22 : root.idleGlow) * cfg.light
          Behavior on strength { NumberAnimation { duration: 220 } }
        }

        Ito.ItoImage {
          palette: cfg
          tintable: root.deco.art !== "@custom"
          anchors.centerIn: parent
          width: root.vertical ? parent.height : parent.width
          height: root.vertical ? parent.width : parent.height
          rotation: root.vertical ? 90 : 0
          mirror: true
          source: Marks.decoSource(root.art.toString(), root.deco, Quickshell.env("HOME"))
        }
      }
    }
  }

  // The Control Centre from a keybinding or a script, without clicking the seal:
  //   omarchy-shell ito.controlcenter toggle | open | close | page <bars|widgets|logo|effects|workspaces|colors|plugins|shells|health>
  IpcHandler {
    target: "ito.controlcenter"

    function toggle(): void { root.popupOpen = !root.popupOpen }
    function open(): void { root.popupOpen = true }
    function close(): void { root.popupOpen = false }
    function page(name: string): void { control.page = name; root.popupOpen = true }
  }

  Cc.ControlCenter {
    id: control
    open: root.popupOpen
    bar: root.bar
    pal: cfg
    onCloseRequested: root.popupOpen = false
  }
}
