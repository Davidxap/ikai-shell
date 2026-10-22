import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Hyprland
import qs.Commons
import qs.Ui as Ui
import "../../bar/modules" as Ito
import "../../bar/modules/ItoMotion.js" as Motion

// Ito workspaces — theme artwork driven by live Hyprland state.
//
// Plugin form of the old bar/modules/ito-workspaces.qml. The ito.bar host loads
// registered plugins by id and has no support for `type: qml` entries.
//
// UNBREAKABLE ART RULES (see docs/ART_RULES.md):
//   1. A workspace's art is chosen by its STATE, never by its number. The only
//      exception is the numerals style, whose whole point is showing the digit.
//   2. Each style declares exactly four arts: empty, occupied, active, urgent.
//      A style never borrows art from another style, so a workspace id the
//      style does not cover can never fall through to a foreign look.
//   3. The art carries the blood. No ColorOverlay tints a workspace on focus:
//      tinting a red asset red again is what produced the "super red" bug.
//   4. No letters. The numerals style draws pre-rendered seals, not text.
Ui.BarWidget {
  id: root
  readonly property string host: Qt.resolvedUrl("../../bar/modules/bin/ito-host").toString().replace("file://", "")
  moduleName: "ito.workspaces"

  // Settings come from the sidecar first, because the engine rewrites
  // shell.json under us. Layout entries stay as a fallback for compatibility.
  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  readonly property string rawStyle: { var s0 = String(cfg.get("style", setting("style", "orbs"))); return s0 === "tomie-head" ? "tomie" : s0 === "gothic" ? "symbols" : s0 === "pyramid-classic" ? "pyramid" : s0 }   // the head-crop family was removed: a stored value reads as tomie; `symbols` (visible name Symbols) reads the ws-gothic files
  // The Beetle family (S2c) exists only as the user's own pictures (workspaces/bar/<px>/ws-beetle-<n>-<state>.png of the assets folder, bin/ito-assets
  // recipe ws-beetle): sized by `wsArtScale` like the original Uzumaki, the nearest tier wins. Without the set the rings are shown.
  readonly property int famWant: Math.max(1, Math.round(Math.min(root.barSize - 4, root.barSize * root.wsArtScale) * root.dpr))
  // S15b: the Tomie family (the user's Tommie drawing, recipe ws-tomie) works the same way; the Beetle files come in two definitions (key wsBeetleDef v9|v10, default v9)
  // S15c: `uzumaki-eye` (your bleeding eye) is one more user family. Its alternative files (`.alt`) are picked by eyeWsIris plain.
  // S18c/S24: `symbols` (the old id `gothic` reads the same) = your shell asset sheet's symbols (recipe ws-symbols, files ws-symbols-*; the old ws-gothic-* files still read); plain definition only
  // `pyramid` = your sprite sheet's pyramid (recipe sprites); plain definition only
  // `cult` (shown as Cult Symbols) = the official Silent Hill symbols, drawn per tier (recipe ws-cult); plain definition only
  // `pyramid` = the ringed side view of the workspace sheet (recipe pyramid-head; the earlier `pyramid-classic` was removed and reads as pyramid), `heather` = Heather in the ring (recipe ws-heather)
  readonly property var famNames: ["beetle", "tomie", "uzumaki-eye", "symbols", "pyramid", "heather", "cult"]
  readonly property bool famStyle: root.famNames.indexOf(root.rawStyle) >= 0
  // S17: eyeWsCrop tight (default) = the `.v12` tight-crop files, wide = today's;
  // beetleDef v12 | v10 | v9 (when set) picks the beetle's definition, else wsBeetleDef as before
  readonly property string beetleDef: root.rawStyle === "uzumaki-eye" ? (String(cfg.get("eyeWsCrop", "tight")) !== "wide" ? "v12" : String(cfg.get("eyeWsIris", "spiral")) === "plain" ? "alt" : "v9")
    : root.rawStyle === "symbols" || root.rawStyle === "pyramid" || root.rawStyle === "heather" || root.rawStyle === "cult" ? "v9"
    : ["v12", "v10", "v9"].indexOf(String(cfg.get("beetleDef", ""))) >= 0 ? String(cfg.get("beetleDef", ""))
    : String(cfg.get("wsBeetleDef", "v9")) === "v10" ? "v10" : "v9"
  readonly property var famPick: root.famStyle ? cfg.userBar("workspaces/ws-" + root.rawStyle + "-1-empty.png", root.famWant, root.beetleDef) : null
  readonly property string wsStyle: root.famStyle && !root.famPick ? "orbs" : root.rawStyle
  readonly property bool userFamily: root.famNames.indexOf(root.wsStyle) >= 0
  readonly property int famPx: root.userFamily && root.famPick ? root.famPick.px : 0
  // Standard glyph size shared by every bar icon (the centre seal is the only exception).
  readonly property int artSize: cfg.get("size", setting("size", Math.round(root.barSize * cfg.get("iconScale", 0.62))))
  readonly property string art: "../../bar/modules/ito-art/"
  // Bar-size art (decisions-barsize.md): pre-rendered small PNGs per family, picked by the pixels the mark really covers.
  // `wsBarArt` is the master flag. Styles `uzumaki` and `uzumaki-original` (the ORIGINAL art redrawn per device px,
  // master-plan-v4 S1c) are shown at an exact pre-rendered size, 1:1: its size comes from `wsArtScale` (default 0.85 of the bar:
  // 44 px on a 52 px bar; 0.54 restores the old 28 px) and the nearest of the 14 buckets (24-128) always wins. With the flag off
  // `uzumaki` uses the 256 px art exactly as before.
  readonly property bool barArt: cfg.get("wsBarArt", false) === true
  readonly property bool origStyle: root.wsStyle === "uzumaki" || root.wsStyle === "uzumaki-original"
  // S2d HD: EVERY shipped family has exact-pixel tiers (workspaces/bar/<px>/, scripts/gen-hd-tiers.py + gen-ws-barsize.py); the user families have theirs in the assets folder
  readonly property var barArtFamilies: ["uzumaki", "uzumaki-original", "uzumaki-vortex", "uzumaki-numbered", "numerals", "orbs", "eyes", "dots", "remina", "halo", "flauros"]
  readonly property var barArtSizes: [24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 60, 64, 72, 80, 88, 96, 112, 120, 128]
  readonly property real dpr: Math.max(1, Screen.devicePixelRatio)
  // Workspace size (Workspaces page): wsArtScale = the share of the bar one workspace mark takes. Set explicitly it sizes EVERY family; unset, the Uzumaki
  // and user families keep their 0.85 default and the others their icon size (iconScale), as before. Never taller than the bar less 4 px.
  readonly property bool wsScaleSet: Number(cfg.get("wsArtScale", -1)) > 0
  readonly property real wsArtScale: Math.max(0.2, Math.min(1.2, root.wsScaleSet ? Number(cfg.get("wsArtScale", 0.85)) : 0.85))
  readonly property int wsLogical: root.wsScaleSet || root.origStyle || root.userFamily
    ? Math.max(1, Math.min(root.barSize - 4, Math.round(root.barSize * root.wsArtScale))) : root.artSize
  readonly property int barArtWant: Math.max(1, Math.round(root.wsLogical * root.dpr))
  // the tier: the nearest one, always (no window, no resample of a small bucket); only a mark bigger than the biggest tier keeps the 256 px art
  // The LEGACY families (Seals, Rings, Eyes and lips, Marks, Remina, Halo, Flauros) keep their ORIGINAL art, exactly as before S2d (the 256 px pictures, filtered when they are
  // scaled); their regenerated exact tiers only show with the opt-in `wsHdTiers` (Workspaces page: HD redraw of old sets). The Uzumaki and user families always use tiers.
  readonly property var legacyFams: ["numerals", "orbs", "eyes", "dots", "remina", "halo", "flauros"]
  readonly property bool hdTiers: cfg.get("wsHdTiers", false) === true
  readonly property bool legacyOrig: root.legacyFams.indexOf(root.wsStyle) >= 0 && !root.hdTiers
  readonly property int barArtPx: {
    if (!root.barArt || root.barArtFamilies.indexOf(root.wsStyle) < 0 || root.legacyOrig) return 0
    var best = 0
    for (var i = 0; i < root.barArtSizes.length; i++) {
      var s = root.barArtSizes[i]
      if (best === 0 || Math.abs(s - root.barArtWant) < Math.abs(best - root.barArtWant)) best = s
    }
    return root.barArtWant > 128 && root.wsStyle !== "uzumaki-original" && root.wsStyle !== "uzumaki-vortex" && root.wsStyle !== "uzumaki-numbered" ? 0 : best
  }
  readonly property bool origFit: root.barArtPx > 0
  // The size one workspace mark is drawn at. An exact tier is drawn 1:1 (size = the file), so the pixels are the file's own.
  // a legacy family drawn from its original art follows the Workspace size control (the 256 px picture scaled with filtering), else its icon size as before
  readonly property int markPx: root.userFamily && root.famPx > 0 ? Math.max(1, Math.round(root.famPx / root.dpr))
    : root.barArtPx > 0 ? Math.max(1, Math.round(root.barArtPx / root.dpr)) : root.legacyOrig && root.wsScaleSet ? root.wsLogical : root.artSize
  readonly property string home: Quickshell.env("HOME")

  // Rule 2: every style declares its four states up front.
  readonly property var styleArt: ({
    "orbs": {
      "empty":    "workspaces/workspace-1.png",
      "occupied": "workspaces/workspace-1.png",
      "active":   "workspaces/workspace-2.png",
      "urgent":   "workspaces/workspace-urgent.png"
    },
    // Tomie (the sheet's eyes and lips): even slots are eyes, odd slots are lips.
    "eyes": {
      "empty":    ["status-eyes/eye-normal.png", "status-eyes/eye-closed.png"],
      "occupied": ["status-eyes/eye-normal.png", "status-eyes/eye-closed.png"],
      "active":   "status-eyes/eye-red.png",
      "urgent":   "status-eyes/eye-bleeding.png"
    },
    // Uzumaki: a spiral with as many arms as the workspace number (1 to 5, and 6 to 10 wear an outer ring), so
    // every workspace has a face of its own without a digit. artFor() fills the number in.
    "uzumaki": { "empty": "empty", "occupied": "occupied", "active": "active", "urgent": "urgent" },
    // Uzumaki vortex: the redrawn one-spiral family (bar-size art only, no 256 px set).
    "uzumaki-vortex": { "empty": "empty", "occupied": "occupied", "active": "active", "urgent": "urgent" },
    // Uzumaki original: the original art redrawn per device px (bar-size art only, no 256 px set).
    "uzumaki-original": { "empty": "empty", "occupied": "occupied", "active": "active", "urgent": "urgent" },
    // Uzumaki numbered: the same vortex winding out of the workspace digit. Bar-size art only (no 256 px set).
    "uzumaki-numbered": { "empty": "empty", "occupied": "occupied", "active": "active", "urgent": "urgent" },
    // Remina: the planet with one eye; artFor() picks the file by number and state, like Uzumaki.
    "remina": { "empty": "empty", "occupied": "occupied", "active": "active", "urgent": "urgent" },
    // Dots: the sheet's target-dot is the ACTIVE marker, the plain red dot flags urgent.
    "dots": {
      "empty":    "workspace-indicators/indicator-empty.png",
      "occupied": "workspace-indicators/indicator-inactive.png",
      "active":   "workspace-indicators/indicator-urgent.png",
      "urgent":   "workspace-indicators/indicator-active.png"
    },
    // Halo: Silent Hill 3's own save-point seal. As many big spikes as the workspace number, the way
    // Uzumaki has one arm more per workspace -- artFor() fills the number in.
    "halo": { "empty": "empty", "occupied": "occupied", "active": "active", "urgent": "urgent" },
    // Flauros: the puzzle's own seal (a broken ring, a triangle, the thing coiled inside it), not
    // Metatron again -- that one already stands for the shell on the Logo page. The coil winds one turn
    // tighter per workspace number, like Remina's tendrils; artFor() picks the file by number and state.
    "flauros": { "empty": "empty", "occupied": "occupied", "active": "active", "urgent": "urgent" }
  })

  // Each bar shows the workspaces of its own screen. Listing every monitor's workspaces put a second screen's
  // workspace (a projector, a virtual output) on this bar as if it were here, and clicking it moved the view away.
  readonly property var screenObj: root.QsWindow.window ? root.QsWindow.window.screen : null
  readonly property var monitor: screenObj ? Hyprland.monitorFor(screenObj) : null
  readonly property string monitorName: monitor ? String(monitor.name || "") : ""

  function onThisScreen(ws) {
    if (!ws) return true
    // Which monitor this bar is on isn't known yet for a moment at startup or after a hot-plug. Showing
    // nothing for that moment is safe; showing every screen's workspaces as if they were this one (the old
    // behaviour here) is exactly the bug this function exists to prevent.
    if (root.monitorName === "") return false
    return !ws.monitor || String(ws.monitor.name || "") === root.monitorName
  }

  // The workspace this screen is showing, which is the one that is lit here even while another screen has focus.
  readonly property int shownId: monitor && monitor.activeWorkspace ? monitor.activeWorkspace.id
    : (Hyprland.focusedWorkspace ? Hyprland.focusedWorkspace.id : -1)

  function workspaceById(id) {
    var values = Hyprland.workspaces.values
    for (var i = 0; i < values.length; i++) {
      // a workspace that lives on another screen is not "occupied" here
      if (values[i].id === id && root.onThisScreen(values[i])) return values[i]
    }
    return null
  }

  // "used" shows only the workspaces that have something in them (and the one you are on); "count" always
  // draws the first N, so the row never changes width as you work.
  // Styles whose art for an empty workspace is the same drawing as an occupied one (rings, seals, eyes and lips)
  // dim the empty ones so they are told apart. Marks and Uzumaki draw an empty one differently already, so they
  // are not dimmed twice.
  readonly property bool emptyLooksOccupied: wsStyle === "numerals" || wsStyle === "orbs" || wsStyle === "eyes"
  readonly property string showMode: cfg.get("workspaceShow", "count")

  function inUse(id) {
    var ws = root.workspaceById(id)
    if (ws !== null && ws.toplevels.values.length > 0) return true
    if (ws !== null && ws.urgent === true) return true
    return root.shownId === id
  }

  function workspaceIds() {
    var ids = []
    if (root.showMode === "used") {
      var values = Hyprland.workspaces.values
      for (var v = 0; v < values.length; v++) {
        var wid = values[v].id
        if (wid > 0 && wid <= 10 && root.onThisScreen(values[v]) && root.inUse(wid) && ids.indexOf(wid) === -1) ids.push(wid)
      }
      if (root.shownId > 0 && root.shownId <= 10 && ids.indexOf(root.shownId) === -1) ids.push(root.shownId)
      ids.sort(function(left, right) { return left - right })
      return ids.length ? ids : [1]
    }
    for (var n = 1; n <= Math.max(1, Math.min(10, Math.round(Number(cfg.get("workspaceCount", 5))))); n++) ids.push(n)
    var values = Hyprland.workspaces.values
    for (var i = 0; i < values.length; i++) {
      var id = values[i].id
      if (id > 0 && id <= 10 && root.onThisScreen(values[i]) && ids.indexOf(id) === -1) ids.push(id)
    }
    ids.sort(function(left, right) { return left - right })
    return ids
  }

  function focusWorkspace(id) {
    if (!root.bar) return
    root.bar.run(host + " workspace " + id)
  }

  function stateOf(focused, occupied, urgent) {
    if (urgent) return "urgent"
    if (focused) return "active"
    return occupied ? "occupied" : "empty"
  }

  // Rule 1 + 2: state picks the art, and a style only ever uses its own set.
  function artFor(id, slot, focused, occupied, urgent) {
    var state = root.stateOf(focused, occupied, urgent)

    // The user's own pictures, one per state (Workspaces page -> Custom), adapted into the cache by ito-marks.
    // The stamp makes the bar reload a picture that was just replaced.
    if (root.wsStyle === "custom")
      return "@" + root.home + "/.cache/ito/marks/_ws-" + state + ".png?v=" + cfg.get("wsCustomVer", 0)

    if (root.userFamily) {
      // the user's own set: cfg.userBar gives the exact file of this number and state (a "@" path is used as it is)
      var bn = Math.max(1, Math.min(10, id))
      var bp = cfg.userBar("workspaces/ws-" + root.wsStyle + "-" + bn + "-" + state + ".png", root.famWant, root.beetleDef)
      return bp ? "@" + String(bp.url).replace("file://", "") : ""
    }

    if (root.barArtPx > 0) {
      // S2d: the exact tier of this family (every shipped family has all of them); one lookup rule. Rings and marks look the same for every number (all ten are written, one lookup rule); the eyes alternate by slot.
      var fam = root.wsStyle === "uzumaki" ? "uzumaki-classic" : root.wsStyle
      var tn = Math.max(1, Math.min(10, id))
      if (fam === "eyes") tn = (slot % 2) + 1
      return "workspaces/bar/" + root.barArtPx + "/ws-" + fam + "-" + tn + "-" + state + ".png"
    }

    if (root.wsStyle === "numerals") {
      // The digit IS the art here, pre-rendered so rule 4 still holds.
      if (id < 1 || id > 10) return ""
      var red = (state === "active" || state === "urgent")
      return "workspace-labels/ws-" + id + (red ? "-red" : "") + ".png"
    }

    if (root.wsStyle === "uzumaki-numbered") {
      // Only exists as bar-size art, so it ignores wsBarArt and falls back to the 32 px bucket off-size.
      var nn = Math.max(1, Math.min(10, id))
      return "workspaces/bar/" + (root.barArtPx > 0 ? root.barArtPx : 32) + "/ws-uzumaki-numbered-" + nn + "-" + state + ".png"
    }

    if (root.wsStyle === "uzumaki-vortex") {
      // Only exists as bar-size art, so it ignores wsBarArt and falls back to the 28 px bucket off-size.
      var vn = Math.max(1, Math.min(10, id))
      return "workspaces/bar/" + (root.barArtPx > 0 ? root.barArtPx : 28) + "/ws-uzumaki-vortex-" + vn + "-" + state + ".png"
    }

    if (root.wsStyle === "uzumaki" && root.barArtPx > 0) {
      // Uzumaki v1 (`uzumaki`): the classic original drawing, pre-rendered per bucket (family uzumaki-classic). With the flag off, the 256 px art below.
      var cn = Math.max(1, Math.min(10, id))
      return "workspaces/bar/" + root.barArtPx + "/ws-uzumaki-classic-" + cn + "-" + state + ".png"
    }

    if (root.wsStyle === "uzumaki-original") {
      // Uzumaki v3 (`uzumaki-original`): the original redrawn per device px. Only exists as bar-size art, so it ignores wsBarArt and falls back to the 28 px bucket.
      var on = Math.max(1, Math.min(10, id))
      return "workspaces/bar/" + (root.barArtPx > 0 ? root.barArtPx : 28) + "/ws-uzumaki-original-" + on + "-" + state + ".png"
    }

    if (root.wsStyle === "uzumaki" || root.wsStyle === "remina" || root.wsStyle === "halo" || root.wsStyle === "flauros") {
      var n = Math.max(1, Math.min(10, id))
      if (root.barArtPx > 0) return "workspaces/bar/" + root.barArtPx + "/ws-" + root.wsStyle + "-" + n + "-" + state + ".png"
      return "workspaces/ws-" + root.wsStyle + "-" + n + "-" + state + ".png"
    }

    var set = root.styleArt[root.wsStyle] || root.styleArt["orbs"]
    var pick = set[state]
    return Array.isArray(pick) ? pick[slot % pick.length] : pick
  }

  implicitWidth: row.implicitWidth
  implicitHeight: row.implicitHeight

  // One row on a horizontal bar, one column on a vertical one.
  // Centred on the widget's own slot, not hung from its top: the slot is shorter than the bar (35 of 46), so a row
  // that fills the bar sticks out below the slot and every mark sits low against the other widgets.
  GridLayout {
    id: row
    anchors.verticalCenter: root.vertical ? undefined : parent.verticalCenter
    anchors.horizontalCenter: root.vertical ? parent.horizontalCenter : undefined
    columns: root.vertical ? 1 : 99
    rowSpacing: 3
    columnSpacing: 3

    Repeater {
      model: root.workspaceIds()

      Ui.WidgetButton {
        id: wsButton
        required property int modelData
        required property int index

        readonly property var workspace: root.workspaceById(modelData)
        readonly property bool occupied: workspace !== null && workspace.toplevels.values.length > 0
        readonly property bool focused: root.shownId === modelData
        readonly property bool urgent: workspace !== null && workspace.urgent === true
        readonly property string art: root.artFor(modelData, index, focused, occupied, urgent)
        readonly property bool isDots: root.wsStyle === "dots"

        bar: root.bar
        tooltipText: "Workspace " + modelData
        text: ""
        labelVisible: false
        hasVisualContent: true
        horizontalMargin: 3
        verticalPadding: 4
        // A workspace with nothing in it recedes clearly, in every style, so an empty one made by pressing its number
        // never reads as one with something running in it. One with windows is at full strength. Rule 3.
        opacity: focused ? 1 : (occupied ? 0.96 : (root.emptyLooksOccupied ? 0.5 : 0.85))
        fixedWidth: root.vertical ? root.barSize : artItem.width + scaledHorizontalMargin * 2
        fixedHeight: root.vertical ? artItem.height + scaledVerticalPadding * 2 + 2 : root.barSize

        Behavior on opacity {
          NumberAnimation { duration: Math.round(Motion.normal * Math.min(cfg.motionAmp, 1)); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.soft }
        }

        onPressed: function() { root.focusWorkspace(modelData) }

        // Pyramid (and its classic look), Heather and Cult Symbols families only: a state edge plays ONE short animation and stops (BAR_STATIC: nothing loops, nothing runs while idle).
        // Arriving on a workspace, the helmet floods with blood and drains back to the burning window; a workspace turning urgent shakes
        // in whole device px (an exact tier must never be resampled). Motion off / reduced motion (motionAmp 0) = no animation at all.
        readonly property bool pyrFx: (root.wsStyle === "pyramid" || root.wsStyle === "heather" || root.wsStyle === "cult") && root.famPx > 0 && cfg.motionAmp > 0
        onFocusedChanged: if (focused && pyrFx) { flood.stop(); flood.start() }     // one-shot: started by the edge, ends by itself
        onUrgentChanged: if (urgent && pyrFx) { shake.stop(); shake.start() }       // one-shot: started by the edge, ends by itself

        // one-shot: the blood flood on arrival
        NumberAnimation {
          id: flood
          target: floodImg; property: "opacity"; from: 0.9; to: 0
          duration: Motion.fast * 4; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.decel
        }
        // one-shot: the urgent shake, whole-px steps
        SequentialAnimation {
          id: shake
          PropertyAction { target: shakeT; property: "x"; value: 2 }
          PauseAnimation { duration: Math.round(Motion.fast / 3) }
          PropertyAction { target: shakeT; property: "x"; value: -2 }
          PauseAnimation { duration: Math.round(Motion.fast / 3) }
          PropertyAction { target: shakeT; property: "x"; value: 1 }
          PauseAnimation { duration: Math.round(Motion.fast / 3) }
          PropertyAction { target: shakeT; property: "x"; value: -1 }
          PauseAnimation { duration: Math.round(Motion.fast / 3) }
          PropertyAction { target: shakeT; property: "x"; value: 1 }
          PauseAnimation { duration: Math.round(Motion.fast / 2) }
          PropertyAction { target: shakeT; property: "x"; value: 0 }
        }

        Item {
          id: artItem
          transform: Translate { id: shakeT; x: 0 }
          // an exact bucket sits on whole pixels (a half pixel would blur it); everything else stays centred as before
          anchors.centerIn: root.barArtPx > 0 || root.famPx > 0 ? undefined : parent
          x: Math.round((parent.width - width) / 2)
          y: Math.round((parent.height - height) / 2)
          width: root.markPx
          height: width

          Ito.ItoImage {
            id: seal
            palette: cfg
            tintable: root.wsStyle !== "custom"
            anchors.fill: parent
            source: wsButton.art === "" ? "" : (wsButton.art.charAt(0) === "@" ? "file://" + wsButton.art.substring(1) : Qt.resolvedUrl(root.art + wsButton.art))
            fillMode: Image.PreserveAspectFit
            smooth: root.barArtPx === 0 && root.famPx === 0          // an exact tier is drawn 1:1: no filtering at all
            mipmap: root.barArtPx === 0 && root.famPx === 0          // the original art is scaled with proper filtering, as before S2d
            // The art is 256 px and shows at about 28: sampled straight down that far the fine hatching of an
            // empty or occupied mark aliases into a checkerboard, which read as the mark being pixelated. Qt
            // scales it down properly at load, to twice the size it will be drawn.
            sourceSize: root.barArtPx > 0 || root.famPx > 0 ? Qt.size(root.barArtPx > 0 ? root.barArtPx : root.famPx, root.barArtPx > 0 ? root.barArtPx : root.famPx)   // device px of the tier: never rescaled
              : Qt.size(Math.max(1, Math.round(width * 2)), Math.max(1, Math.round(height * 2)))
            // A state change eases in; nothing animates while idle.
            // (bar-size art has no pop: a scale is a bilinear resample of the already rasterised mark, which blurs it)
            scale: wsButton.focused && !wsButton.isDots && root.barArtPx === 0 && root.famPx === 0 ? 1.08 : 1.0

            // arriving on a workspace, its mark pops out with a little overshoot and settles
            Behavior on scale {
              NumberAnimation { duration: Math.round(Motion.slow * Math.min(cfg.motionAmp, 1)); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.spring }
            }
          }

          // Pyramid / Pyramid classic / Heather / Cult Symbols: the urgent picture over the active one, faded out by `flood` (exists only for that family; idle at opacity 0)
          Ito.ItoImage {
            id: floodImg
            palette: cfg
            anchors.fill: parent
            opacity: 0
            visible: wsButton.pyrFx && opacity > 0
            readonly property string urgentArt: wsButton.pyrFx ? root.artFor(wsButton.modelData, wsButton.index, false, true, true) : ""
            source: urgentArt.charAt(0) === "@" ? "file://" + urgentArt.substring(1) : ""
            fillMode: Image.PreserveAspectFit
            smooth: false
            mipmap: false
            sourceSize: Qt.size(Math.max(1, root.famPx), Math.max(1, root.famPx))
          }
        }
      }
    }
  }
}
