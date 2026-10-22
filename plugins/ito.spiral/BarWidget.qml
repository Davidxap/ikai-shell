import QtQuick
import Quickshell
import qs.Ui as Ui
import "../../bar/modules" as Ito
import "../../bar/modules/ItoMarks.js" as Marks

// Ito spiral launcher — signature Tomie artwork.
// Left click summons the Omarchy menu (same IPC as the stock menu widget).
// What it does on hover (turn, pulse, flicker…) is the Effects page's choice; it lights up from behind.
// Plugin form of bar/modules/ito-spiral.qml. The ito.bar host loads registered
// plugins by id and has no support for `type: qml` entries.
Ui.BarWidget {
  id: root
  moduleName: "ito.spiral"

  // Same blood setting as the workspaces. The default is the palette
  // paint stop; all stops are defined in themes/ito-verse/palette.toml.
    // Settings live in the sidecar, not in shell.json, because the engine
  // rewrites that file under us. See ItoConfig.qml.
  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  readonly property string host: Qt.resolvedUrl("../../bar/modules/bin/ito-host").toString().replace("file://", "")
  readonly property color blood: cfg.blood

  // The mark on the button: the sheet spiral by default (it is what the whole suite takes its name from), a
  // face, a sigil, or a picture of the user's own (Logo page).
  readonly property string mark: Marks.resolve(String(cfg.get("menuMark", "spiral")), cfg.userMarkNames)
  // The mark at BAR size: the 512 px picture shrunk through the mip chain loses its thin lines, so when the user has a bar-size file of this
  // mark (marks/bar/<px>/<name>.png, or system/bar/<px>/<art> for a built-in one) the nearest bucket within 15 % is shown at its own size
  // (decisions-userart section 4). No such file: today's picture, untouched.
  // Exact bar size (master-plan-v4 S1b, `wsBarArt` is the master flag): the Uzumaki and Remina marks ship exact pre-renders
  // (system/bar/<px>/<art>), and a user mark that has bucket files is drawn from them too. Such a mark is sized by `markScale`
  // (default 0.65 of the bar: 26 px on a 40 px bar; `ito-config set markScale 0.54` restores the old size, Logo page > Logo size has five steps) and drawn 1:1.
  readonly property bool barArt: cfg.get("wsBarArt", false) === true
  readonly property string shipArt: Marks.userName(root.mark) === "" && !Marks.isCustom(root.mark, cfg.markOverrides)
    ? Marks.find(Marks.menuMarks, root.mark).art : ""
  // S2d HD: every shipped mark has exact tiers at every step of Logo size (system/bar/<px>/<art>, scripts/gen-hd-tiers.py + gen-ws-barsize.py + the spiral recipe).
  // The nearest tier always wins (no 15 % window), drawn 1:1; only a want above the biggest tier keeps the 512 picture.
  readonly property bool uzu: root.shipArt === "menu-uzumaki.png" || root.shipArt === "menu-uzumaki-v1.png" || root.shipArt === "menu-uzumaki-v2.png"
  readonly property var tierArts: ["menu-uzumaki.png", "menu-uzumaki-v1.png", "menu-uzumaki-v2.png", "menu-remina.png", "menu-amigara.png", "menu-metatron-full.png",
    "menu-metatron.png", "menu-halo.png", "menu-flauros.png", "system-normal.png", "system-normal-clean.png"]
  readonly property var shipSizes: [24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 60, 64, 72, 80, 88, 96, 112, 120, 128]
  // The LEGACY marks (Halo, Flauros, Amigara, Metatron, Metatron plain, Remina Ink, Sheet spiral) keep the original 512 art exactly as before S2d; their regenerated tiers
  // only show with the opt-in `markHdTiers`. The Uzumaki v1/v2/v3 marks and the user's marks always use exact tiers.
  readonly property var legacyArts: ["menu-remina.png", "menu-amigara.png", "menu-halo.png", "menu-flauros.png", "system-normal.png", "system-normal-clean.png"]
  readonly property bool hdTiers: cfg.get("markHdTiers", false) === true
  readonly property bool legacyOrig: root.legacyArts.indexOf(root.shipArt) >= 0 && !root.hdTiers
  readonly property bool shipFit: root.barArt && root.tierArts.indexOf(root.shipArt) >= 0 && !root.legacyOrig
  readonly property real dpr: Math.max(1, Screen.devicePixelRatio)
  // a mark can ask for a floor (ItoMarks `minPx`: Tomie's two faces need 36 px): drawn at max(its normal size, minPx), never above barSize - 4; markScale is untouched
  readonly property int minPx: { var e = Marks.userEntry(root.mark); return e && e.minPx ? e.minPx : 0 }
  readonly property int plainSize: root.minPx > 0 ? Math.max(Math.round(root.barSize * cfg.get("iconScale", 0.62)), Math.min(root.minPx, root.barSize - 4))
                                                   : Math.round(root.barSize * cfg.get("iconScale", 0.62))
  // never taller than the bar less 4 px (S15): a big step on a thin bar stays inside it
  readonly property bool markScaleSet: Number(cfg.get("markScale", -1)) > 0
  readonly property int fitSize: Math.max(1, Math.min(root.barSize - 4, Math.max(root.minPx, Math.round(root.barSize * Math.max(0.2, Math.min(1.2, Number(cfg.get("markScale", 0.65)) || 0.65))))))
  // S25: a mark's own `scale` (ItoMarks: Tomie Classic 0.87) shrinks what it asks for, so the nearest tier is drawn 1:1, never rescaled
  readonly property real markK: Marks.markScale(root.mark, cfg.markOverrides)
  readonly property int markWant: Math.max(1, Math.round((root.shipFit || (root.barArt && (Marks.userName(root.mark) !== "" || ((root.mark === "spiral" || root.mark === "spiral-clean") && !root.legacyOrig))) || (root.legacyOrig && root.markScaleSet) ? root.fitSize : root.plainSize) * root.dpr * root.markK))
  readonly property int shipPx: {
    if (!root.shipFit) return 0
    var best = 0
    for (var i = 0; i < root.shipSizes.length; i++)
      if (best === 0 || Math.abs(root.shipSizes[i] - root.markWant) < Math.abs(best - root.markWant)) best = root.shipSizes[i]
    return root.markWant > 128 ? 0 : best
  }
  readonly property var userPick: {
    var n = Marks.userName(root.mark)
    if (n !== "") return cfg.userMark(n, root.markWant)
    if (Marks.isCustom(root.mark, cfg.markOverrides)) return null
    if (root.legacyOrig) return null
    var b = cfg.userBar("system/" + Marks.find(Marks.menuMarks, root.mark).art, root.markWant, "v9")   // the Sheet spiral marks ignore markDef: their files are per mark
    return b && b.px > 0 ? b : null
  }
  // the pixels the mark really covers: an exact bucket (shipped or the user's) when there is one, else today's size
  readonly property int exactPx: root.userPick && root.userPick.px > 0 ? root.userPick.px : root.shipPx
  readonly property bool exact: root.barArt && root.exactPx > 0
  readonly property int markPx: root.exact ? Math.round(root.exactPx / root.dpr) : root.legacyOrig && root.markScaleSet ? root.fitSize : root.plainSize
  readonly property url markSource: root.shipPx > 0 && !(root.userPick && root.userPick.px > 0)
      ? Qt.resolvedUrl("../../bar/modules/ito-art/system/bar/" + root.shipPx + "/" + root.shipArt)
    : root.userPick && Marks.userName(root.mark) === "" && root.userPick.px > 0 ? root.userPick.url
    : Marks.source(Qt.resolvedUrl("../../bar/modules/ito-art/").toString(), mark, Quickshell.env("HOME"), cfg.markOverrides,
                   root.userPick ? root.userPick.url : "")
  // "auto" is the mark's own effect: a round seal turns, a face keeps a heartbeat.
  readonly property string effect: {
    var chosen = String(cfg.get("fxMark", "auto"))
    return chosen === "auto" ? Marks.autoEffect(mark) : chosen
  }
  readonly property int artSize: cfg.get("size", setting("size", 30))

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  Ui.WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: "Menu"
    horizontalMargin: 4
    labelVisible: false
    hasVisualContent: true
    fixedWidth: vertical ? barSize : fx.width + scaledHorizontalMargin * 2
    fixedHeight: vertical ? fx.height + scaledVerticalPadding * 2 : barSize
    onPressed: function(mouseButton) {
      if (mouseButton === Qt.LeftButton && root.bar)
        if (root.bar) root.bar.run(host + " menu")
    }

    Ito.ItoGlow {
      anchors.centerIn: fx
      width: fx.width * 1.9
      height: fx.height * 1.9
      color: root.blood
      strength: (button.tooltipHovered ? 0.30 : 0) * cfg.light
      Behavior on strength { NumberAnimation { duration: 240 } }
    }

    Ito.ItoFx {
      id: fx
      anchors.centerIn: parent
      // The standard bar glyph, the same size as the workspaces and the instruments.
      width: root.markPx
      height: width
      kind: root.effect
      active: String(cfg.get("fxWhen", "hover")) === "always" || button.tooltipHovered
      speed: cfg.fxSpeed
      strength: cfg.fxStrength
      color: root.blood

      Ito.ItoImage {
        id: icon
        palette: cfg
        tintable: !Marks.isCustom(root.mark, cfg.markOverrides)
        anchors.fill: parent
        source: root.markSource
        fillMode: Image.PreserveAspectFit
        smooth: !root.exact          // an exact tier is drawn 1:1: no filtering
        mipmap: !root.exact          // the original 512 art is scaled with proper filtering, as before S2d
        // an exact bucket is drawn at its own size (no resample); otherwise as before
        sourceSize: root.exact ? Qt.size(root.exactPx, root.exactPx)   // device px of the tier: never rescaled
          : root.userPick && root.userPick.px > 0 ? Qt.size(root.markWant, root.markWant) : Qt.size(0, 0)
        // a file the index listed that does not load is remembered, and the default mark comes back
        onStatusChanged: if (status === Image.Error && root.userPick) cfg.userFail(String(root.userPick.url))
      }
    }

  }
}
