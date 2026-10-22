import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import ".." as Ito
import "sysart" as Sysart

// Boot & Lock: the surfaces outside the bar (lock, terminal fetch, screensaver, boot splash), one tab each
// (boot-lock-v2 §2). Each tab shows the helper's live status (what is applied, and whether it is the truth), a
// preview, one primary action chosen by that status, its picture and its options. The pictures are yours and
// stay on this machine, under ~/.config/ito/marks/. Each surface has a helper in bin/ that does the work and can
// always be undone. This file is the host: it owns the helper runs and the slot pickers; the panes are in sysart/.
ColumnLayout {
  id: page

  property var cc: null
  readonly property var pal: cc.pal
  readonly property var act: cc.actions
  readonly property color bone: pal.bone

  spacing: 24

  readonly property string marksTool: Qt.resolvedUrl("../bin/ito-marks").toString().replace("file://", "")
  // ITO_SYSART_FAKE_BIN points the three surface helpers at a fixture folder (helpers that answer {"error": ...}),
  // so the page's failure path can be checked without touching a real lock, fetch or idle file.
  readonly property string fakeBin: Quickshell.env("ITO_SYSART_FAKE_BIN") || ""
  function tool(name) {
    return fakeBin !== "" ? fakeBin.replace(/\/$/, "") + "/" + name
                          : Qt.resolvedUrl("../bin/" + name).toString().replace("file://", "")
  }
  readonly property string fetchTool: tool("ito-fastfetch")
  readonly property string screensaverTool: tool("ito-screensaver")
  readonly property string lockTool: tool("ito-lock")
  readonly property string plymouthTool: tool("ito-plymouth")
  readonly property string repairTool: tool("ito-repair")
  // The repair edits files of yours, so it only ever runs in a terminal you can see, one question at a time.
  function openRepair() {
    Quickshell.execDetached(["xdg-terminal-exec", "bash", "-c", repairTool + " apply; echo; read -n 1 -s -r -p 'press a key to close'"])
  }
  readonly property string bootComposition: String(pal.get("bootComposition", "eye-shut"))
  readonly property bool fetchOn: pal.get("fastfetchTheme", false) === true
  readonly property string fetchLayout: String(pal.get("fastfetchLayout", "image"))
  readonly property string fetchLogo: String(pal.get("fetchLogo", ""))
  readonly property bool fetchOrnaments: String(pal.get("fetchOrnaments", "ito")) !== "off"
  readonly property string fetchStyle: String(pal.get("fetchStyle", "ito"))
  readonly property string fetchPicture: String(pal.get("fetchPicture", "photo"))
  readonly property bool screensaverOn: pal.get("idleScreensaver", false) === true
  readonly property string screensaverText: String(pal.get("screensaverText", "spiral"))
  readonly property string screensaverEffect: String(pal.get("screensaverEffect", "random-ito"))
  readonly property bool lockOn: pal.get("lockTheme", false) === true
  readonly property var lockDesigns: ["fog", "lantern", "amigara", "watcher", "tomie", "pyramid", "road", "moth"]
  readonly property string lockDesign: {
    var d = String(pal.get("lockDesign", "fog"))
        return lockDesigns.indexOf(d) >= 0 ? d : "fog"
  }

  // Every helper run of a surface goes through its own SurfaceRun: one at a time, a click while busy queues one
  // more, and the flag (lockTheme, fastfetchTheme, idleScreensaver) is written only after the helper exits 0.
  // On failure the flag stays where it was and the result line under the action says why.
  component SurfaceRun: Item {
    id: sr
    property string label: ""
    readonly property bool busy: proc.running
    property string result: ""
    property bool failed: false
    property string details: ""
    property var job: null
    property var queued: null
    property double started: 0
    signal finished(bool ok)

    // run(args, flagKey, flagValue, what): flagKey "" when the run sets no flag.
    function run(args, flagKey, flagValue, what) {
      var j = { "args": args, "flag": flagKey || "", "value": flagValue, "what": what || sr.label }
      if (proc.running) { queued = j; return }
      start(j)
    }
    function start(j) {
      job = j
      started = Date.now()
      proc.command = j.args
      proc.running = true
    }
    function lastJson(text) {
      var lines = String(text || "").trim().split("\n").filter(function(l) { return l.charAt(0) === "{" })
      if (!lines.length) return null
      try { return JSON.parse(lines[lines.length - 1]) } catch (e) { return null }
    }

    Process {
      id: proc
      stdout: StdioCollector { id: srOut }
      stderr: StdioCollector { id: srErr }
      onExited: function(code) {
        var secs = ((Date.now() - sr.started) / 1000).toFixed(1)
        var r = sr.lastJson(srOut.text) || sr.lastJson(srErr.text)
        var ok = code === 0 && r !== null && !r.error
        if (ok) {
          if (sr.job.flag !== "") page.act.set(sr.job.flag, sr.job.value)
          sr.failed = false
          sr.details = ""
          sr.result = "ok · " + sr.job.what + " · " + secs + " s · " + (r.changed === false ? "nothing to change" : "changed")
        } else {
          sr.failed = true
          sr.result = r && r.error ? String(r.error) : "failed (exit " + code + ")"
          sr.details = String(srErr.text || "").trim().split("\n").slice(-6).join("\n")
        }
        sr.finished(ok)
        if (sr.queued) { var q = sr.queued; sr.queued = null; sr.start(q) }
      }
    }
  }

  SurfaceRun { id: lockRun; label: "lock"; onFinished: page.refreshSnapshot(["lock"], page.visitedList(), true) }
  SurfaceRun { id: fetchRun; label: "fetch"; onFinished: page.refreshSnapshot(["terminal"], page.visitedList(), true) }
  SurfaceRun { id: screensaverRun; label: "screensaver"; onFinished: page.refreshSnapshot(["screensaver"], page.visitedList(), true) }
  // read by the offscreen lab (dev/lab/) to check what a run reported
  readonly property var lockRunRef: lockRun
  readonly property var fetchRunRef: fetchRun
  readonly property var screensaverRunRef: screensaverRun

  // On: hyprlock.conf is regenerated in the Ito colours (yours is saved first), using the lock picture if one is set.
  // Off: the hyprlock.conf you had comes back. The password field is never changed either way.
  function applyLock(on) {
    lockRun.run([lockTool, on ? "apply" : "revert"], "lockTheme", on ? "on" : "off", on ? lockDesign : "revert")
  }

  // A design is saved through `ito-lock apply --design` (the helper persists it itself, so there is one writer and no
  // race with a separate `set`); with the lock theme off it is only remembered, and applies when the theme is turned on.
  function pickLockDesign(key) {
    if (lockOn) lockRun.run([lockTool, "apply", "--design", key], "", "", key)
    else act.set("lockDesign", key)
  }

  // Turning the fetch on writes the layouts and makes the chosen one the default (the config you had is saved
  // first); turning it off gives your own config back. Both are plain helper calls with argument lists.
  function applyFetch(on, layout) {
    fetchRun.run(on ? [fetchTool, "apply", layout, "--set-default"] : [fetchTool, "revert"],
                 "fastfetchTheme", on ? "on" : "off", on ? layout : "revert")
  }

  // On: one helper call writes the text and then the idle listener, in that order (`ito-screensaver apply`).
  // Off: the text comes back from its backup and only the Ito block leaves hypridle.conf (strip-only).
  function applyScreensaver(on) {
    screensaverRun.run([screensaverTool, on ? "apply" : "revert"], "idleScreensaver", on ? "on" : "off",
                       on ? "text and idle" : "revert")
  }

  // A slot whose picture changed re-applies the surface that uses it, when that surface is on. The boot splash
  // only re-composes its preview; applying it stays a terminal step.
  function surfaceApply(slot) {
    if (slot === "_fastfetch" && fetchOn) applyFetch(true, fetchLayout)
    else if (slot === "_lockbg" && lockOn) applyLock(true)
  }

  // The raw slots: what each one holds right now ("" when empty), read from `ito-marks slots`.
  property var slots: ({ "_plymouth": "", "_fastfetch": "", "_lockbg": "" })
  property string message: ""
  // Bumped whenever a slot's picture changes (picked, cleared, or a gallery pick), so every SlotPicker knows to
  // reread its own gallery's "selected" flags.
  property int slotsVersion: 0

  function fileName(path) {
    var p = String(path || "")
    return p === "" ? "" : p.substring(p.lastIndexOf("/") + 1)
  }

  // A picker prints {"error": "..."} on stdout when it refuses a file, and on stderr when the import fails;
  // an empty answer means the dialog was cancelled.
  function report(out, err) {
    var t = String(out).trim()
    var e = String(err).trim()
    var pick = t !== "" ? t : e
    var line = pick.split("\n").filter(function(l) { return l.charAt(0) === "{" })[0] || ""
    try {
      var r = JSON.parse(line)
      if (r.error) { page.message = r.error; return }
    } catch (x) {}
    page.message = ""
  }

  function rereadSlots() { reader.running = true; page.slotsVersion++; statusDebounce.restart() }
  function pickInto(slot) { if (!picker.running) { picker.slot = slot; picker.running = true } }
  function clearSlot(slot) { if (!clearer.running) { clearer.slot = slot; clearer.running = true } }
  // Try: the hyprlock test locks this screen for 15 s with the design and unlocks itself (a signal, not a password).
  function tryLock() { lockRun.run([lockTool, "test", "--design", lockDesign], "", "", "try " + lockDesign) }

  Process {
    id: reader
    command: [page.marksTool, "slots"]
    stdout: StdioCollector {
      onStreamFinished: {
        try { page.slots = JSON.parse(text) } catch (e) {}
      }
    }
  }

  // Choosing a picture opens a file dialog; afterwards the slots are read again.
  Process {
    id: picker
    property string slot: "_fastfetch"
    command: [page.marksTool, "pick", "--as", slot]
    stdout: StdioCollector { id: pickOut }
    stderr: StdioCollector { id: pickErr }
    onExited: function(code) {
      page.report(pickOut.text, pickErr.text)
      page.rereadSlots()
      page.surfaceApply(slot)
    }
  }
  Process {
    id: clearer
    property string slot: "_fastfetch"
    command: [page.marksTool, "reset-art", slot]
    onExited: function(code) {
      page.message = ""
      page.rereadSlots()
      page.surfaceApply(slot)
    }
  }

  // ---------------------------------------------------------------- live status (§2.2)
  // Each helper's `status` is one JSON line; it is read when the page opens, after every run of that surface, and
  // when the colours change (a theme switch). The flags mirror real files, so the v1 keys still correct them.
  property var lockStatus: null
  property var lockChain: null
  property var fetchStatusObj: null
  property var screensaverStatusObj: null
  property var lockDesignList: []

  function syncFlag(key, real, current) {
    if (real !== current) act.set(key, real ? "on" : "off")
  }
  function parsed(text) {
    var lines = String(text || "").trim().split("\n")
    try { return JSON.parse(lines[lines.length - 1]) } catch (e) { return null }
  }
  // One cached snapshot (bin/ito-sysart-snapshot, ~/.cache/ito/sysart-snapshot.json) holds every helper's answer. Opening the
  // page reads that file with no process at all and shows it at once; only when it is older than 30 s (or lacks a tab's
  // previews) ONE background process refreshes it, running the helpers three at a time at low priority. A run or a
  // setting change forces a refresh of just the surface it touches.
  property var visited: ({})
  property var pending: null
  property bool memoFresh: false
  function visitedList() { return Object.keys(visited).filter(function(k) { return visited[k] === true || searching }) }
  function refreshSnapshot(surfaces, previews, force) {
    var args = [snapTool, "refresh", "--stamp", colourStamp, "--layout", fetchLayout, "--bin", snapBin,
                "--surfaces", surfaces.join(","), "--previews", previews.join(",")]
    if (force) args.push("--force")
    // one run at a time; whatever is asked meanwhile is merged (surfaces and previews united, force kept), so a quick tab
    // switch no longer drops the first tab's preview
    if (snapProc.running) {
      var p0 = pending || { "surfaces": [], "previews": [], "force": false }
      function union(a, b) { var o = a.slice(); b.forEach(function(x) { if (o.indexOf(x) < 0) o.push(x) }); return o }
      pending = { "surfaces": union(p0.surfaces, surfaces), "previews": union(p0.previews, previews), "force": p0.force || force }
      return
    }
    snapProc.command = args
    snapProc.running = true
  }
  function rereadStatus() { refreshSnapshot(["lock", "terminal", "screensaver", "boot"], visitedList(), true) }
  readonly property string snapTool: tool("ito-sysart-snapshot")
  readonly property string snapBin: fakeBin !== "" ? fakeBin.replace(/\/$/, "") : Qt.resolvedUrl("../bin").toString().replace("file://", "").replace(/\/$/, "")
  function applySnapshot(snap) {
    var sf = snap.surfaces || {}
    var l = sf.lock || {}, t = sf.terminal || {}, c = sf.screensaver || {}, b = sf.boot || {}
    if (l.lockStatus) { lockStatus = l.lockStatus; syncFlag("lockTheme", l.lockStatus.installed === true, lockOn) }
    if (l.lockChain) lockChain = l.lockChain
    if (l.lockDesignList) lockDesignList = l.lockDesignList
    if (t.fetchStatusObj) { fetchStatusObj = t.fetchStatusObj; syncFlag("fastfetchTheme", t.fetchStatusObj.default === "ito", fetchOn) }
    if (t.fetchPreview) fetchPreview = t.fetchPreview
    if (t.fetchThumbs) fetchThumbs = t.fetchThumbs
    if (t.fetchStyleThumbs) fetchStyleThumbs = t.fetchStyleThumbs
    if (c.screensaverStatusObj) {
      screensaverStatusObj = c.screensaverStatusObj
      // one definition: the toggle is on whenever the helper says the text is ours (on, partial, stale, blocked), whoever owns the timer
      syncFlag("idleScreensaver", c.screensaverStatusObj.state !== "off", screensaverOn)
    }
    if (c.effectsInfo && c.effectsInfo.ito) effectsInfo = c.effectsInfo
    if (c.saverPreview) saverPreview = c.saverPreview
    if (c.saverThumbs) saverThumbs = c.saverThumbs
    if (b.bootStatusObj) bootStatusObj = b.bootStatusObj
    if (b.bootPreview !== undefined) bootPreview = b.bootPreview
    if (b.bootThumbs) bootThumbs = b.bootThumbs
    if (snap.slots) slots = snap.slots
    saveMemo()
  }
  Process {
    id: snapProc
    stdout: StdioCollector {
      onStreamFinished: {
        var s = page.parsed(text)
        if (s && s.surfaces) page.applySnapshot(s)
      }
    }
    onExited: {
      if (page.pending) { var q = page.pending; page.pending = null; page.refreshSnapshot(q.surfaces, q.previews, q.force) }
    }
  }
  // the file is read once when the page is built (no process); a stale or incomplete one is refreshed in the background
  FileView {
    id: snapFile
    path: Quickshell.env("HOME") + "/.cache/ito/sysart-snapshot.json"
    printErrors: false
    onLoaded: {
      if (page.memoFresh) return
      var s = page.parsed(snapFile.text())
      if (!s || s.v !== 1 || !s.surfaces) { page.rereadStatus(); return }
      page.applySnapshot(s)
      var wantPrev = page.visitedList(), now = Date.now() / 1000, stale = s.stamp !== page.colourStamp || !s.slots
      for (var k in s.surfaces) if (now - (s.surfaces[k].at || 0) > 30) stale = true
      for (var i = 0; i < wantPrev.length; i++) if (!s.surfaces[wantPrev[i]] || !s.surfaces[wantPrev[i]].previewed) stale = true
      if (stale) page.refreshSnapshot(["lock", "terminal", "screensaver", "boot"], wantPrev, s.stamp !== page.colourStamp)
    }
    onLoadFailed: page.rereadStatus()
  }

  // What the helpers answered is kept for the session in the Control Centre's scratch map, so opening the page again
  // within 30 s shows it at once and starts no process at all.
  function saveMemo() {
    if (!cc.memo) return
    cc.memo.sysartCache = { "at": Date.now(), "stamp": colourStamp, "lockStatus": lockStatus, "lockChain": lockChain,
      "fetchStatusObj": fetchStatusObj, "screensaverStatusObj": screensaverStatusObj, "lockDesignList": lockDesignList,
      "fetchPreview": fetchPreview, "bootStatusObj": bootStatusObj, "bootPreview": bootPreview,
      "saverPreview": saverPreview, "effectsInfo": effectsInfo, "slots": slots,
      "fetchThumbs": fetchThumbs, "fetchStyleThumbs": fetchStyleThumbs, "saverThumbs": saverThumbs, "bootThumbs": bootThumbs }
  }
  function restoreMemo() {
    var c = cc.memo ? cc.memo.sysartCache : null
    if (!c || c.stamp !== colourStamp) return false
    lockStatus = c.lockStatus; lockChain = c.lockChain; fetchStatusObj = c.fetchStatusObj
    screensaverStatusObj = c.screensaverStatusObj; lockDesignList = c.lockDesignList; fetchPreview = c.fetchPreview
    bootStatusObj = c.bootStatusObj; bootPreview = c.bootPreview; saverPreview = c.saverPreview
    effectsInfo = c.effectsInfo; slots = c.slots
    fetchThumbs = c.fetchThumbs || ({}); fetchStyleThumbs = c.fetchStyleThumbs || ({}); saverThumbs = c.saverThumbs || ({}); bootThumbs = c.bootThumbs || ({})
    return Date.now() - c.at < 30000
  }
  Component.onDestruction: saveMemo()

  property string fetchPreview: ""
  property var bootStatusObj: null
  property string bootPreview: ""
  property string saverPreview: ""
  // one picture per option, made by the snapshot: fetch layout, screensaver text, boot composition
  property var fetchThumbs: ({})
  property var fetchStyleThumbs: ({})     // fetch style key -> the real `ito-fastfetch preview --styles` PNG
  property var saverThumbs: ({})
  property var bootThumbs: ({})
  readonly property bool bootPictureMissing: String(slots["_plymouth"] || "") === ""
  readonly property bool bootArtComposition: ["eye-shut", "uzumaki-eye", "beetle", "remina", "tomie", "eye-veined", "eye-spiral", "card-tomie", "card-pyramid", "card-road", "card-moth"].indexOf(bootComposition) >= 0
  readonly property string bootSource: String(pal.get("bootSource", "slot"))
  function thumbFor(key) {
    if (key === "lock") {
      for (var i = 0; i < lockDesignList.length; i++) if (lockDesignList[i].key === lockDesign && lockDesignList[i].thumb) return lockDesignList[i].thumb
      return ""
    }
    if (key === "terminal") return fetchThumbs[fetchLayout] || ""
    if (key === "screensaver") return saverThumbs[screensaverText] || saverPreview || ""
    return bootThumbs[bootComposition] || ""
  }
  property var effectsInfo: ({ "ito": [], "all": [], "current": "random-ito" })
  onFetchLayoutChanged: statusDebounce.restart()
  onFetchLogoChanged: statusDebounce.restart()
  onFetchOrnamentsChanged: statusDebounce.restart()
  onBootCompositionChanged: statusDebounce.restart()
  onScreensaverTextChanged: statusDebounce.restart()
  onScreensaverEffectChanged: statusDebounce.restart()

  // a theme switch changes the colours every generated file was made with
  readonly property string colourStamp: String(pal.blood) + String(pal.bone) + String(pal.ink)
  onColourStampChanged: statusDebounce.restart()
  Timer { id: statusDebounce; interval: 900; onTriggered: page.rereadStatus() }

  // the hero of the lock tab: the chosen design's mock, in your colours and with sample data
  readonly property string lockPreview: {
    for (var i = 0; i < lockDesignList.length; i++) if (lockDesignList[i].key === lockDesign && lockDesignList[i].hero) return lockDesignList[i].hero
    return String(slots["_lockbg"] || "")
  }
  readonly property string lockPreviewCaption: "preview · your colours · sample data"

  // nothing runs while the page is being built: the first helper starts on the next event-loop turn
  Component.onCompleted: {
    var tabs = {}
    tabs[page.tab] = true
    visited = tabs
    memoFresh = restoreMemo()
  }

  // ---------------------------------------------------------------- tabs (hidden while searching)
  readonly property bool searching: cc.query !== ""
  property string tab: cc.memo && cc.memo.sysartTab ? cc.memo.sysartTab : "lock"
  function pickTab(key) {
    tab = key
    if (cc.memo) cc.memo.sysartTab = key
    if (visited[key] !== true) {
      var v = {}
      for (var k in visited) v[k] = true
      v[key] = true
      visited = v
      refreshSnapshot([key], [key], false)
    }
  }

  function subFor(key) {
    if (key === "lock") {
      var st = lockStatus ? lockStatus.state : "off"
      return st === "off" ? "off" : lockDesign + " · in charge " + (lockStatus.in_charge || 0) + "/4"
    }
    if (key === "terminal") {
      var f = fetchStatusObj ? fetchStatusObj.state : "off"
      return f === "off" ? "off" : fetchLayout + " · " + (f === "stale" ? "out of date" : f)
    }
    if (key === "screensaver") {
      var s = screensaverStatusObj
      if (!s || !s.starts_after) return "off"
      return s.starts_after + " s · " + String(s.engine || "").split("+")[0] + (s.state === "partial" ? " · two timers" : "")
    }
    var b = bootStatusObj
    if (!b) return "never applied"
    return b.state === "on" ? "applied" : (b.state === "stale" ? "out of date" : "never applied")
  }
  function stateFor(key) {
    if (key === "lock") return lockStatus ? lockStatus.state : "off"
    if (key === "terminal") return fetchStatusObj ? fetchStatusObj.state : "off"
    if (key === "screensaver") return screensaverStatusObj ? screensaverStatusObj.state : "off"
    return bootStatusObj ? bootStatusObj.state : "off"
  }

  RowLayout {
    visible: !page.searching
    Layout.fillWidth: true
    spacing: 12
    Repeater {
      model: [
        { "key": "lock",        "kanji": "錠", "title": "Lock",        "hint": "The screen you unlock with your password." },
        { "key": "terminal",    "kanji": "端", "title": "Terminal",    "hint": "fastfetch in a terminal." },
        { "key": "screensaver", "kanji": "夢", "title": "Screensaver", "hint": "The drifting text while you are away." },
        { "key": "boot",        "kanji": "起", "title": "Boot",        "hint": "The splash when the machine starts." }
      ]
      CcSurfaceTab {
        required property var modelData
        host: page.cc; pal: page.pal
        kanji: modelData.kanji; title: modelData.title; hint: modelData.hint
        thumb: page.thumbFor(modelData.key)
        sub: page.subFor(modelData.key)
        state: page.stateFor(modelData.key)
        current: page.tab === modelData.key
        onActivated: page.pickTab(modelData.key)
        onRepair: { page.pickTab(modelData.key); page.openRepair() }
      }
    }
  }

  Text {
    visible: page.message !== ""
    Layout.fillWidth: true
    wrapMode: Text.WordWrap
    text: page.message
    color: page.pal.warn
    font.family: "Noto Serif"
    font.pixelSize: 12
  }

  // A pane is built the first time its tab is shown (the page used to build all four, about 1000 items, to show one),
  // over several frames; a search shows them all.
  component LazyPane: Loader {
    required property string key
    property Component pane: null
    Layout.fillWidth: true
    asynchronous: true
    active: page.searching || page.visited[key] === true
    visible: page.searching || page.tab === key
    sourceComponent: pane
  }
  LazyPane { key: "lock";        pane: Component { Sysart.LockPane { host: page } } }
  LazyPane { key: "terminal";    pane: Component { Sysart.TerminalPane { host: page } } }
  LazyPane { key: "screensaver"; pane: Component { Sysart.ScreensaverPane { host: page } } }
  LazyPane { key: "boot";        pane: Component { Sysart.BootPane { host: page } } }
}
