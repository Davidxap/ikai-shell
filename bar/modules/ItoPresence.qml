import QtQuick
import QtQuick.Shapes
import "ItoPresence.js" as P
import "ItoPresenceBus.js" as Bus

// How a popup opens and closes (ito-panel-presence/motion-spec.md, icons-v5.md section 4): a sheet of paper that grows out of the
// bar icon into the card, and folds back into it. ItoPanelFrame creates one (flag `presence`) and draws the frame's paper and outer
// rule with it; the rest of the frame's ink comes in on `reveal`.
//
// One clock, one pure timeline. `clock` (ms) is a single edge-started NumberAnimation; every visible value is
// `ItoPresence.js phases(clock, opts)`. Nothing runs while the popup is closed or at rest, and nothing here animates a layout
// property: the sheet is a Rectangle drawn in the card's coordinates (outside the card too: the card does not clip), the content
// children get an opacity and a Translate, and the shell's own card is only held at full opacity while the sheet folds back.
//
// Inputs from ItoPanelFrame: `cfg` (an ItoConfig or ItoPanelPalette), `opened`, `card`, `host` (the KeyboardPanel, or null for a
// popup whose window is the card plus a margin: then the sheet grows from a 56 x 6 strip), `content` (the Item whose visible
// children are staggered), `barSide`.
Item {
  id: root

  property var cfg: null
  property bool opened: false
  property Item card: null
  property var host: null
  property Item content: null
  property string barSide: host && host.barPos ? String(host.barPos) : "top"
  // contained hosts: where the icon is along the bar, in card coordinates (-1: the card's centre)
  property real alongPx: -1
  property color ink: "black"
  property color bone: "white"
  property color blood: "red"
  property bool alert: false
  property real styleRadius: 3
  property real ruleAlpha: 0.6              // the outer rule's opacity (the frame style's)
  property bool ruled: true                 // false for a plain card (panelFrame off): the sheet is paper only

  readonly property real amp: cfg && cfg.motionAmp !== undefined ? cfg.motionAmp : 1
  // the user's opening speed (sidecar `openDuration`, via the config's `openScale`): every window of the timeline stretches by it
  readonly property real openK: cfg && cfg.openScale !== undefined ? P.openK(cfg.openScale * P.OPEN.ref) : 1
  readonly property bool contained: host === null
  // how the card opens (sidecar `presenceReveal`: none | spiral | blot | static | lid; the lid is no longer the default)
  readonly property string revealKind: cfg ? String(cfg.get("presenceReveal", "none")) : "none"
  readonly property bool lidFlag: revealKind === "lid"
  readonly property string maskKind: revealKind === "spiral" || revealKind === "blot" || revealKind === "static" ? revealKind : ""
  readonly property bool switchFlag: cfg ? String(cfg.get("presenceSwitch", "morph")) === "morph" : false
  readonly property bool shoulderFlag: cfg ? cfg.get("presenceShoulders", false) === true : false

  // the state the frame draws from
  property var ph: P.restState(opened, false)
  property bool engaged: false          // between an edge and the end of its run: bindings on, hold on while leaving
  property string dir: "in"
  property bool runLid: false
  property string runMask: ""            // "spiral" | "blot" while a masked run is engaged (ItoPanelFrame loads the mask only then)
  property bool runSw: false
  property real runK: 1                  // the opening-speed scale of the current run (a flag flipped mid-run waits for the next one)
  property var iconR: ({ x: 0, y: 0, w: 56, h: 6 })
  property var opts: ({})
  property real clock: 0
  property bool gestured: false
  // the content stagger (presence-crash.md): one persistent driver per content child, made the first time the child is seen
  // and kept for its life; `bound` holds the drivers' Bindings on from an edge until an enter lands (so a finished exit leaves
  // the content at 0 under the folded sheet instead of popping it back during the shell's card fade)
  property var kids: []
  property bool bound: false
  property int gen: 0

  readonly property bool hold: engaged && dir === "out"
  readonly property bool running: anim.running
  // the card's final rect, live (the card can resize while it is open)
  readonly property var cardRect: ({ x: 0, y: 0, w: card ? card.width : width, h: card ? card.height : height })
  readonly property var rc: P.rect(ph, iconR, cardRect, barSide, styleRadius)
  // true once the sheet has been moved by an edge: until then (a flag flipped while the popup is open) it rests on the card
  readonly property bool settled: !engaged

  // the header object's gesture (icons-v5 section 4.1 item 6): once at 300 ms of an enter, 340 on a switch; no listener until D1
  signal gesture()

  NumberAnimation {
    id: anim
    target: root
    property: "clock"
    from: 0
    easing.type: Easing.Linear
    onFinished: root.finish()
  }

  onPhChanged: if (bound) applyKids()

  onClockChanged: {
    if (!engaged || !anim.running) return
    ph = P.phases(clock, opts)
    if (dir === "in" && !gestured && clock >= (runSw ? 340 : 300) * P.S(amp) * runK) { gestured = true; gesture() }
  }

  // ------------------------------------------------------------------------------------------------------------- edges
  onOpenedChanged: {
    if (opened) begin("in")
    else begin("out")
  }

  Component.onCompleted: ph = P.restState(opened, false)

  // ---------------------------------------------------------------------------------------------------- content stagger
  function fin(v, dflt) { return typeof v === "number" && isFinite(v) ? v : dflt }
  function unit(v) { return v < 0 ? 0 : v > 1 ? 1 : v }

  Component {
    id: driverComp
    QtObject {
      id: drv
      property Item item: null
      property real base: 1
      property real o: 1
      property Translate tr: null
      property bool ours: false
      property Binding fade: Binding { target: drv.item; property: "opacity"; value: drv.o; when: root.bound && drv.item !== null }
    }
  }
  Component { id: trComp; Translate {} }

  // Every child of `content` (visible or not: the content is parked with no window, so effectively invisible, when an open
  // edge arrives), as drivers. A driver is made once per child and reused; the child's resting opacity is read only while no
  // Binding of ours holds it. Never touches a Binding's lifetime during a run.
  function captureKids() {
    var out = [], keep = []
    var old = kids
    for (var j = 0; j < old.length; j++) {
      if (old[j] && old[j].item) keep.push(old[j])
      else if (old[j]) { if (old[j].tr) old[j].tr.destroy(); old[j].destroy() }  // its child is gone
    }
    if (!content) return keep
    var ch = content.children
    for (var i = 0; i < ch.length; i++) {
      var it = ch[i]
      if (!it) continue
      var d = null
      for (var k = 0; k < keep.length; k++) if (keep[k].item === it) { d = keep[k]; break }
      if (!d) {
        d = driverComp.createObject(root, { item: it })
        if (it.transform.length === 0) { d.tr = trComp.createObject(root); it.transform = [d.tr]; d.ours = true }
      }
      if (!bound) d.base = unit(fin(it.opacity, 1))
      out.push(d)
    }
    return out
  }

  function applyKids() {
    var vertical = barSide === "top" || barSide === "bottom"
    var sign = barSide === "top" || barSide === "left" ? 1 : -1
    var slot = 0
    for (var i = 0; i < kids.length; i++) {
      var d = kids[i]
      if (!d || !d.item) continue
      var c = ph.c[Math.min(slot, 7)]
      if (d.item.visible) slot++
      d.o = unit(fin(d.base * fin(c.o, 1), d.base))
      if (d.tr) { var dd = fin(c.d, 0); d.tr.x = vertical ? 0 : sign * dd; d.tr.y = vertical ? sign * dd : 0 }
    }
  }

  // let go of the content: the Bindings restore each child's own opacity (or binding); our travel back to 0
  function releaseKids() {
    bound = false
    for (var i = 0; i < kids.length; i++) if (kids[i] && kids[i].tr) { kids[i].tr.x = 0; kids[i].tr.y = 0 }
  }

  Component.onDestruction: {
    bound = false
    for (var i = 0; i < kids.length; i++) { var d = kids[i]; if (d && d.ours && d.item) d.item.transform = [] }
  }

  function begin(d) {
    anim.stop()
    var g = ++gen
    var leavingSwitch = d === "out" && !contained && switchFlag && host && host.owner && host.owner.popoutSwitchClosing === true
    var skipExit = d === "out" && host && host.owner && host.owner.popoutSwitchClosing === true
    if (skipExit) {
      // the shell snaps this card to 0 at once: no exit, no hold; the arriving popup may start from this card's rect
      if (leavingSwitch && card) Bus.put({ x: host.cardOrigin.x, y: host.cardOrigin.y, w: card.width, h: card.height }, Date.now())
      dir = "out"; engaged = false; ph = P.restState(false, false)
      return
    }
    if (!(amp > 0)) {
      // amp 0: no hold, no stagger, no lids; the sheet sits at its end state
      dir = d; engaged = false; releaseKids(); ph = P.restState(d === "in", false)
      return
    }
    dir = d
    kids = captureKids()
    engaged = true
    bound = true
    gestured = d === "out"
    if (d === "in") {
      // wait one turn: the popup that this one replaces (a switch) closes in the same turn, and may leave its rect for us;
      // the generation drops a callback that a later edge has overtaken
      Qt.callLater(function() { if (g === root.gen) root.startIn() })
    } else {
      if (!contained) iconR = P.iconRect(hostNumbers())
      launch(lidFlag, false, null, maskKind)
    }
  }

  function hostNumbers() {
    var h = host
    return { ax: h.anchorScreenPos.x, ay: h.anchorScreenPos.y, aw: h.anchorW, ah: h.anchorH, ox: h.cardOrigin.x, oy: h.cardOrigin.y,
             barPos: h.barPos, screenW: h.screenW, screenH: h.screenH, barH: h.barH, barW: h.barW }
  }

  function startIn() {
    if (!opened || !engaged || dir !== "in") return
    kids = captureKids()          // the window exists by now: children made since the edge join in
    var sw = false
    var from = ph
    if (!contained && switchFlag) {
      var r = Bus.take(Date.now(), 220)
      if (r) {
        sw = true
        iconR = P.toCard(r, host.cardOrigin)
        from = P.snapshot(ph); from.fill = 1
      }
    }
    if (!sw) iconR = contained ? P.stripRect(barSide, cardRect, alongPx >= 0 ? alongPx : null) : P.iconRect(hostNumbers())
    launch(lidFlag && !sw, sw, from, sw ? "" : maskKind)
  }

  function launch(lid, sw, from, mask) {
    var mk = mask === "spiral" || mask === "blot" || mask === "static" ? mask : ""
    runLid = lid && mk === ""; runSw = sw; runMask = mk
    runK = openK
    var o = { dir: dir, amp: amp, k: runK, lid: runLid, sw: sw, mask: mk === "" ? null : mk, from: P.snapshot(from || ph) }
    var tot = P.total(dir, amp, { lid: runLid, sw: sw, mask: o.mask, k: runK })
    opts = o
    if (tot <= 0) { finish(); return }
    clock = 0
    ph = P.phases(0, o)
    anim.to = tot
    anim.duration = tot
    anim.start()
  }

  // For the lab only (scripts/lab/lab-presence.qml): hold the sheet at clock `t` of an enter or an exit, with no animation running.
  function freezeAt(d, t, lid, sw, fromRect, mask) {
    anim.stop()
    var mk = mask === "spiral" || mask === "blot" || mask === "static" ? mask : ""
    dir = d; runLid = lid && mk === ""; runSw = sw; runMask = mk
    kids = captureKids()
    engaged = true
    bound = true
    iconR = fromRect ? fromRect : (contained ? P.stripRect(barSide, cardRect, alongPx >= 0 ? alongPx : null) : P.iconRect(hostNumbers()))
    var from = d === "out" ? P.restState(true, runLid) : P.restState(false, false)
    if (sw) from.fill = 1
    runK = openK
    opts = { dir: d, amp: amp, k: runK, lid: runLid, sw: sw, mask: mk === "" ? null : mk, from: from }
    ph = P.phases(t, opts)
  }

  function finish() {
    anim.stop()
    engaged = false
    if (dir === "in") releaseKids()
    ph = P.restState(dir === "in", false)
    runLid = false; runSw = false; runMask = ""
  }

  // ------------------------------------------------------------------------------------ the shell's card, held while leaving
  Binding { target: root.card; property: "opacity"; value: 1; when: root.hold && !root.contained }

  // ------------------------------------------------------------------------------------------------- the sheet and its ink
  Rectangle {
    id: sheet
    x: root.rc.x; y: root.rc.y; width: root.rc.w; height: root.rc.h
    radius: root.rc.r
    color: Qt.rgba(root.ink.r, root.ink.g, root.ink.b, root.ph.fill)
    border.width: root.ruled ? 1 : 0
    border.color: root.alert
      ? Qt.rgba(root.blood.r, root.blood.g, root.blood.b, 0.75 * root.ph.fill)
      : Qt.rgba(root.bone.r, root.bone.g, root.bone.b, root.ruleAlpha * root.ph.fill)
    // the cast ink under the sheet follows the ink (elevation 2, only with `elevation: ink`)
    ItoElevation { cfg: root.cfg; level: 2 * root.ph.fill; target: sheet }
  }

  // ------------------------------------------------------------------------------------------------- A6 shoulders (flagged)
  readonly property var barTokens: host && host.bar && host.bar.visualTokens ? host.bar.visualTokens : null
  readonly property string barForm: barTokens && barTokens.shellStyle !== undefined ? String(barTokens.shellStyle) : ""
  readonly property real shoulderR: {
    if (!barTokens) return 0
    var r = barForm === "fit" ? barTokens.shellFitRadius : barForm === "notch" ? barTokens.notchBodyRadius : barForm === "full" ? barTokens.islandRadius : 0
    return Math.max(0, Math.min(Number(r) || 0, 24))
  }
  Loader {
    active: root.shoulderFlag && !root.contained && root.shoulderR > 1
    sourceComponent: Item {
      // two concave r x r pieces of paper at the sheet's bar-facing corners; built once at r, carried by the corners, scaled by `sh`
      readonly property real r: root.shoulderR
      Repeater {
        model: 2
        delegate: Item {
          id: sh
          required property int index
          readonly property bool isLeft: index === 0
          readonly property string side: root.barSide
          // the corner this piece sits on (card coordinates)
          readonly property real cx: side === "top" || side === "bottom" ? (isLeft ? root.rc.x : root.rc.x + root.rc.w) : (side === "left" ? root.rc.x : root.rc.x + root.rc.w)
          readonly property real cy: side === "top" ? root.rc.y : side === "bottom" ? root.rc.y + root.rc.h : (isLeft ? root.rc.y : root.rc.y + root.rc.h)
          x: cx; y: cy
          opacity: root.ph.fill
          transform: [
            // the piece is drawn for a top bar's left corner: flip it for the right corner, the bottom bar and the side bars
            Scale { xScale: sh.side === "top" || sh.side === "bottom" ? (sh.isLeft ? 1 : -1) : (sh.side === "left" ? -1 : 1)
                    yScale: sh.side === "top" ? 1 : sh.side === "bottom" ? -1 : (sh.isLeft ? 1 : -1)
                    origin.x: 0; origin.y: 0 },
            Scale { xScale: root.ph.sh; yScale: root.ph.sh; origin.x: 0; origin.y: 0 }
          ]
          Shape {
            // the square [-r, 0] x [0, r]; the paper is what lies outside the quarter disc centred on its far bottom-left corner
            x: -r; y: 0
            width: r; height: r
            preferredRendererType: Shape.CurveRenderer
            ShapePath {
              strokeWidth: -1
              fillColor: Qt.rgba(root.ink.r, root.ink.g, root.ink.b, 1)
              startX: 0; startY: 0
              PathLine { x: r; y: 0 }
              PathLine { x: r; y: r }
              PathArc { x: 0; y: 0; radiusX: r; radiusY: r; direction: PathArc.Clockwise }
            }
          }
        }
      }
    }
  }
}
