import QtQuick
import Quickshell
import Quickshell.Io
import "../ItoSurfaces.js" as Surfaces
import "../ItoLayouts.js" as Layouts
import "../ItoWidgets.js" as Widgets

// Everything the control centre does to the shell, in one place, so the pages only say what they want.
//
// Look and content settings go to the sidecar through the ito-config helper. Anything that belongs to the
// bar engine (its shape, its layout, which widgets are enabled) goes through the bar's own state service,
// which the fork exposes on its visual tokens. Nothing here reaches for a compositor or a distribution, so
// the same panel drives the shell wherever it runs.
Item {
  id: root

  visible: false
  width: 0
  height: 0

  property var bar: null
  property var pal: null

  // ---------------------------------------------------------------- the sidecar
  readonly property string helper: Qt.resolvedUrl("../bin/ito-config").toString().replace("file://", "")

  function set(key, value) { Quickshell.execDetached([helper, "set", String(key), String(value)]); touched([key]) }
  function toggle(flag) { Quickshell.execDetached([helper, "toggle", String(flag)]) }
  function reset() { Quickshell.execDetached([helper, "reset"]); touched(colourKeys) }
  // S13f: every reset below backs the sidecar up first (ito-config writes ~/.config/ito/backups/sidecar-<ts>.json); `lastReset` starts the
  // 12 s "Undo reset" the control centre offers, which is `ito-config restore` (the newest backup)
  property double lastReset: 0
  function resetKeys(keys) { if (!keys || keys.length === 0) return; Quickshell.execDetached([helper, "reset", "--key"].concat(keys)); touched(keys); lastReset = Date.now() }
  function resetPage(page, keys) { Quickshell.execDetached([helper, "reset", "--page", String(page)]); touched(keys || colourKeys); lastReset = Date.now() }
  function resetEverything() { Quickshell.execDetached([helper, "reset", "--all"]); touched(colourKeys); lastReset = Date.now() }
  function undoReset() { Quickshell.execDetached([helper, "restore"]); touched(colourKeys); lastReset = 0 }
  function unset(keys) { Quickshell.execDetached([helper, "unset"].concat(keys)); touched(keys) }

  function setMany(dict) {
    var args = [helper, "setmany"]
    var keys = []
    for (var k in dict) { args.push(k + "=" + dict[k]); keys.push(k) }
    Quickshell.execDetached(args)
    touched(keys)
  }

  // ---------------------------------------------------------------- system surfaces that follow the colours
  // The generated lock screen is painted in the shell's colours and marks, so when one of those settings changes
  // while the lock theme is on, it is regenerated. The fetch follows the terminal's own ANSI colours, so it needs
  // nothing. Changes are debounced into one run, and one run at a time: a change that lands while `ito-lock apply`
  // is going queues exactly one more run for when it ends.
  readonly property var colourKeys: ["accentSource", "accentCustom", "colorMode", "vibrance", "menuMark", "seal"]
  readonly property string lockHelper: Qt.resolvedUrl("../bin/ito-lock").toString().replace("file://", "")
  property bool refreshQueued: false

  function touched(keys) {
    for (var i = 0; i < keys.length; i++)
      if (colourKeys.indexOf(String(keys[i])) >= 0) { refreshSystemSurfaces(); return }
  }

  function refreshSystemSurfaces() { refreshDebounce.restart() }

  Timer {
    id: refreshDebounce
    interval: 700   // after the detached writes have landed, and after a slider or a swatch run has settled
    onTriggered: {
      if (root.pal.get("lockTheme", false) !== true) return
      if (lockRefresh.running) root.refreshQueued = true
      else lockRefresh.running = true
    }
  }

  Process {
    id: lockRefresh
    command: [root.lockHelper, "apply"]
    onExited: function(code) {
      if (root.refreshQueued) { root.refreshQueued = false; running = true }
    }
  }

  function layerOn(flag) { return Surfaces.on(pal, flag) }

  // ---------------------------------------------------------------- the bar engine
  readonly property var tokens: bar && bar.visualTokens ? bar.visualTokens : null
  readonly property var state: tokens ? tokens.stateService : null
  readonly property var layout: bar ? bar.layoutController : null
  readonly property string currentForm: tokens ? String(tokens.shellStyle) : "shibumi"
  readonly property bool stateReady: !!state && state.ready === true

  readonly property string position: bar ? String(bar.position || "top") : "top"
  function setPosition(value) {
    if (bar && typeof bar.setBarPosition === "function") bar.setBarPosition(value, null, "")
  }

  function formName(key) {
    var names = { "shibumi": "ISLANDS", "full": "FULL", "fit": "FIT", "dock": "DOCK", "notch": "NOTCH" }
    return names[key] || String(key).toUpperCase()
  }

  function applyForm(key) {
    if (state && typeof state.setPresentationSetting === "function")
      state.setPresentationSetting("shellStyle", key)
  }

  function cutOn(index) { return !!layout && layout.splitEnabled("boundaries", index) }
  function toggleCut(index) {
    if (layout && typeof layout.toggleSplit === "function") layout.toggleSplit("boundaries", index, true)
  }

  // Drag-and-drop editing is the fork's; this just starts it.
  function editLayout() {
    if (bar && typeof bar.setLayoutEditing === "function") bar.setLayoutEditing(true, "")
  }

  // ---------------------------------------------------------------- widgets
  // A widget is switched off, never removed: the state keeps an enabled flag per group, so it comes back
  // where it was.
  function widgetOn(id) {
    var cfgState = state && state.config ? state.config : null
    var entry = cfgState && cfgState.widgets ? cfgState.widgets["G:" + id] : null
    var key = currentForm === "shibumi" ? "enabledV1" : "enabledV2"
    return !entry || entry[key] !== false
  }

  function setWidget(id, on) {
    if (state && typeof state.setGroupsEnabledForAllVariants === "function")
      state.setGroupsEnabledForAllVariants(["G:" + id], on)
  }

  // Where the widgets sit. The layout holds three regions of slots (some of them empty); a widget of ours is the
  // slot "G:<id>". These read and change that, so a page can list the bar as it is and move things in it.
  function slotsNow() { return !layout ? null : (layout.v2Mode ? layout.v2Slots : layout.v1Slots) }

  function widgetsIn(region) {
    var s = slotsNow(), out = []
    if (!s || !s[region]) return out
    for (var i = 0; i < s[region].length; i++) {
      var g = String(s[region][i])
      if (g.indexOf("G:") === 0) out.push(g.substring(2))
    }
    return out
  }

  function regionOf(id) {
    var names = ["left", "center", "right"]
    for (var r = 0; r < names.length; r++) if (widgetsIn(names[r]).indexOf(id) >= 0) return names[r]
    return ""
  }

  // One step along its own side: trades places with the next widget of ours beside it. dir is -1 (earlier) or +1 (later).
  // The slots between hold blanks and the engine's own hidden widgets (G1, G2...), which are never drawn: trading with one
  // of those changed nothing on the bar, so the arrows seemed to do nothing. Only a widget you can see counts.
  function nudgeWidget(id, dir) {
    var s = slotsNow(), region = regionOf(id)
    if (!s || region === "" || !layout) return false
    var slots = s[region], at = slots.indexOf("G:" + id)
    for (var i = at + dir; i >= 0 && i < slots.length; i += dir) {
      if (String(slots[i]).indexOf("G:") === 0) return layout.swapGroups("G:" + id, String(slots[i]))
    }
    return false
  }

  // Put a widget in any column at any place: `index` counts the widgets of ours that are there (not counting this one),
  // so 0 is the first on that side and a number past the last puts it at the end. This is what dragging uses.
  function moveWidgetTo(id, region, index) {
    var s = slotsNow()
    if (!s || !layout || !s[region]) return false
    var slots = s[region], seen = []
    for (var i = 0; i < slots.length; i++) {
      var g = String(slots[i])
      if (g.indexOf("G:") === 0 && g !== "G:" + id) seen.push(i)
    }
    var at
    if (index <= 0) at = seen.length ? seen[0] : slots.length
    else if (index >= seen.length) at = seen.length ? seen[seen.length - 1] + 1 : slots.length
    else at = seen[index]
    return layout.insertGroupAt("G:" + id, region, at)
  }

  // To the next side: from the left it enters the centre at its start, from the right it enters at its end.
  function sendWidget(id, toRegion) {
    var s = slotsNow(), from = regionOf(id)
    if (!s || from === "" || !layout || from === toRegion) return false
    var goingRight = ["left", "center", "right"].indexOf(toRegion) > ["left", "center", "right"].indexOf(from)
    return layout.insertGroupAt("G:" + id, toRegion, goingRight ? 0 : s[toRegion].length)
  }

  // What a widget shows: "both" (icon and reading), "icon" or "text".
  function contentOf(id) { return String(pal.get("content:" + id, Widgets.defaultContent(id))) }
  function cycleContent(id) {
    var order = ["both", "icon", "text"]
    var next = order[(order.indexOf(contentOf(id)) + 1) % order.length]
    set("content:" + id, next)
  }

  // ---------------------------------------------------------------- whole designs
  readonly property string designHelper: Qt.resolvedUrl("../bin/ito-design").toString().replace("file://", "")

  // A design is applied by the helper, which stops the shell, writes the arrangement everywhere it has to
  // agree and starts the shell again: the only way that cannot leave the bar half-changed. The bar is back
  // in a few seconds, exactly as described.
  function applyDesign(design) {
    // A design is an arrangement; its shape is a suggestion. By default it is worn on the shape the bar already has,
    // so any shape can be mixed with any design. "designShape" = "design" makes it bring its own.
    var form = String(pal.get("designShape", "keep")) === "design" ? design.form : currentForm
    Quickshell.execDetached(["setsid", "-f", designHelper, "--form", form,
                             "--left", design.left.join(","), "--center", design.center.join(","),
                             "--right", design.right.join(",")])
    return true
  }

  // Any registered plugin can go on the bar, whoever wrote it: the engine hosts it the same way it hosts
  // ours. The bar restarts for a moment, because the arrangement has to be written everywhere at once.
  function addPlugin(id, side) {
    Quickshell.execDetached(["setsid", "-f", designHelper, "--add", id, "--side", side || "right"])
  }

  function removePlugin(id) {
    Quickshell.execDetached(["setsid", "-f", designHelper, "--remove", id])
  }

  // The default arrangement, in whichever shape the bar has now.
  function resetLayout() {
    Quickshell.execDetached(["setsid", "-f", designHelper, "--form", currentForm, "--classic"])
  }
}
