import QtQuick
import "ItoPresence.js" as P

// The panel's eyelids (icons-v5.md section 4.3, A3): two sheets of the panel's own paper that part over the card as it opens and
// blink shut as it closes. Each lid is ONE Canvas, painted once at the card's final size and palette (never on a clock, never per
// frame), and moved by `y` only, inside a clip Item that is the sheet's rectangle, so no lid pixel is ever outside the sheet.
// ItoPanelFrame loads this only while an open or close is running (Loader `active`): at rest no lid exists.
//
// The lids meet at 62 % of the height (an upper-lid-dominant blink). The marks use the bone token over the paper (ink) token:
// a G-pen lash line that thins to both ends, a contour hatch, one broken crease, a few lashes on the outer third, and on the lower
// lid a waterline of bare paper with a thin rim; with `alert` one blood thread runs along the waterline.
Item {
  id: root

  // the running ItoPresence (its ph, rc and card size) and the frame's palette
  property var pres: null
  property color paper: "black"
  property color line: "white"
  property color blood: "red"
  property bool alert: false

  readonly property real cw: pres ? pres.cardRect.w : 0
  readonly property real ch: pres ? pres.cardRect.h : 0
  readonly property real k: Math.max(0.8, Math.min(1.15, cw / 380))
  readonly property var geo: P.lidGeometry(cw, ch)
  readonly property real padB: 16 * k      // lashes hang below the upper lid's edge
  readonly property real padT: 8 * k       // and stand above the lower lid's edge
  readonly property real lu: pres && pres.ph.lu !== null ? pres.ph.lu : 1
  readonly property real ll: pres && pres.ph.ll !== null ? pres.ph.ll : 1

  width: cw; height: ch
  opacity: pres ? pres.ph.fill : 0
  enabled: false

  // the sheet's rectangle: nothing of a lid is drawn outside it
  Item {
    x: root.pres ? root.pres.rc.x : 0
    y: root.pres ? root.pres.rc.y : 0
    width: root.pres ? root.pres.rc.w : 0
    height: root.pres ? root.pres.rc.h : 0
    clip: true

    Item {
      x: root.pres ? -root.pres.rc.x : 0
      y: root.pres ? -root.pres.rc.y : 0
      width: root.cw; height: root.ch

      Canvas {
        id: upper
        x: 0
        y: root.geo.upperClosedY + (root.geo.upperOpenY - root.geo.upperClosedY) * root.lu
        width: root.cw
        height: root.geo.upperH + root.padB
        onPaint: root.paintUpper(this)
        onWidthChanged: requestPaint()
        onHeightChanged: requestPaint()
        Component.onCompleted: requestPaint()
        Connections { target: root; function onPaperChanged() { upper.requestPaint() } function onLineChanged() { upper.requestPaint() } }
      }
      Canvas {
        id: lower
        x: 0
        y: root.geo.lowerClosedY - root.padT + (root.geo.lowerOpenY - root.geo.lowerClosedY) * root.ll
        width: root.cw
        height: root.geo.lowerH + root.padT
        onPaint: root.paintLower(this)
        onWidthChanged: requestPaint()
        onHeightChanged: requestPaint()
        Component.onCompleted: requestPaint()
        Connections {
          target: root
          function onPaperChanged() { lower.requestPaint() }
          function onLineChanged() { lower.requestPaint() }
          function onBloodChanged() { lower.requestPaint() }
          function onAlertChanged() { lower.requestPaint() }
        }
      }
    }
  }

  // ---- drawing -------------------------------------------------------------------------------------------------------
  function arch(x) { var u = 2 * x / root.cw - 1; return 1 - u * u }
  function rng(seed) { var a = seed >>> 0; return function() { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
  function rgba(c, a) { return Qt.rgba(c.r, c.g, c.b, a) }

  function paintUpper(cv) {
    var W = root.cw, a = root.geo.a, Hu = root.geo.upperH, k = root.k
    if (W <= 0) return
    var c = cv.getContext("2d")
    c.reset()
    var edge = function(x) { return Hu - a * arch(x) }
    // the lid: everything above the arched edge
    c.fillStyle = rgba(root.paper, 1)
    c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0)
    for (var x = W; x >= 0; x -= 3) c.lineTo(x, edge(x))
    c.lineTo(0, edge(0)); c.closePath(); c.fill()
    // contour hatch: lines parallel to the edge, 1.6 px apart near it and 3.2 px apart far from it
    c.lineWidth = 0.7; c.strokeStyle = rgba(root.line, 0.5)
    var o = 4 * k, sp = 1.6
    while (o < 18 * k) {
      c.beginPath()
      for (var hx = 0.04 * W; hx <= 0.96 * W; hx += 4) { var hy = edge(hx) - o; if (hx === 0.04 * W) c.moveTo(hx, hy); else c.lineTo(hx, hy) }
      c.stroke()
      sp = Math.min(3.2, sp + 0.28); o += sp
    }
    // the crease: one broken line 18k above the edge (two gaps)
    c.lineWidth = 0.8; c.strokeStyle = rgba(root.line, 0.6)
    var runs = [[0.06, 0.31], [0.34, 0.66], [0.70, 0.94]]
    for (var r = 0; r < runs.length; r++) {
      c.beginPath()
      for (var cx = runs[r][0] * W; cx <= runs[r][1] * W; cx += 4) { var cy = edge(cx) - 20 * k; if (cx === runs[r][0] * W) c.moveTo(cx, cy); else c.lineTo(cx, cy) }
      c.stroke()
    }
    // the lash line: a G-pen band, 3.2k at the centre thinning to 0.6 at both ends, a brush start at the inner corner, a flick at the outer
    var thick = function(x) { var t = 0.6 + (3.2 * k - 0.6) * Math.pow(arch(x), 0.8); if (x < 0.07 * W) t += 0.9 * (1 - x / (0.07 * W)); return t }
    c.fillStyle = rgba(root.line, 0.95)
    c.beginPath()
    for (x = 0; x <= W; x += 3) { if (x === 0) c.moveTo(x, edge(x) - thick(x)); else c.lineTo(x, edge(x) - thick(x)) }
    c.lineTo(W, edge(W) - 3 * k)             // the flick: the band ends in a short upturn at the outer corner
    c.lineTo(W, edge(W))
    for (x = W; x >= 0; x -= 3) c.lineTo(x, edge(x))
    c.closePath(); c.fill()
    // lashes on the outer 28 %: three clumps of two or three hairs, curling outwards
    var rnd = rng(7)
    c.lineCap = "round"; c.lineWidth = 0.9 * Math.max(1, k * 0.9); c.strokeStyle = rgba(root.line, 0.9)
    var clumps = [0.76, 0.855, 0.935]
    for (var q = 0; q < clumps.length; q++) {
      var hairs = 2 + Math.floor(rnd() * 2)
      for (var hh = 0; hh < hairs; hh++) {
        var px = clumps[q] * W + (hh - 1) * 3 * k, py = edge(px)
        var len = (7 + rnd() * 5) * k, curl = (18 + rnd() * 16) * Math.PI / 180
        c.beginPath(); c.moveTo(px, py)
        c.quadraticCurveTo(px + Math.sin(curl * 0.35) * len * 0.55, py + len * 0.6, px + Math.sin(curl) * len, py + Math.cos(curl) * len)
        c.stroke()
      }
    }
  }

  function paintLower(cv) {
    var W = root.cw, a = root.geo.a, Hl = root.geo.lowerH, k = root.k, oy = root.padT
    if (W <= 0) return
    var c = cv.getContext("2d")
    c.reset()
    var edge = function(x) { return oy + a * arch(x) }
    // the lid: everything below the sagging edge
    c.fillStyle = rgba(root.paper, 1)
    c.beginPath(); c.moveTo(0, edge(0))
    for (var x = 0; x <= W; x += 3) c.lineTo(x, edge(x))
    c.lineTo(W, edge(W)); c.lineTo(W, oy + Hl); c.lineTo(0, oy + Hl); c.closePath(); c.fill()
    // contour hatch below the edge
    c.lineWidth = 0.7; c.strokeStyle = rgba(root.line, 0.5)
    var o = 6 * k, sp = 1.6
    while (o < 20 * k) {
      c.beginPath()
      for (var hx = 0.04 * W; hx <= 0.96 * W; hx += 4) { var hy = edge(hx) + o; if (hx === 0.04 * W) c.moveTo(hx, hy); else c.lineTo(hx, hy) }
      c.stroke()
      sp = Math.min(3.2, sp + 0.28); o += sp
    }
    // the waterline stays bare paper (2 px); the rim line lies just inside it, with two gaps
    c.lineWidth = 0.6; c.strokeStyle = rgba(root.line, 0.55)
    var runs = [[0.04, 0.30], [0.34, 0.68], [0.72, 0.96]]
    for (var r = 0; r < runs.length; r++) {
      c.beginPath()
      for (var rx = runs[r][0] * W; rx <= runs[r][1] * W; rx += 4) { var ry = edge(rx) + 2; if (rx === runs[r][0] * W) c.moveTo(rx, ry); else c.lineTo(rx, ry) }
      c.stroke()
    }
    // a few short lower lashes standing up from the edge, one missing
    var rnd = rng(11)
    c.lineCap = "round"; c.lineWidth = 0.8; c.strokeStyle = rgba(root.line, 0.85)
    var slots = [0.70, 0.77, 0.84, 0.91, 0.96]
    for (var s = 0; s < slots.length; s++) {
      if (s === 2) continue
      var px = slots[s] * W, py = edge(px), len = (2 + rnd() * 2) * k
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + len * 0.3, py - len); c.stroke()
    }
    // with `alert`: one blood thread along the waterline from the inner corner
    if (root.alert) {
      c.lineWidth = 0.6; c.strokeStyle = rgba(root.blood, 0.9)
      c.beginPath()
      for (var bx = 0.04 * W; bx <= 0.30 * W; bx += 4) { var by = edge(bx) + 1; if (bx === 0.04 * W) c.moveTo(bx, by); else c.lineTo(bx, by) }
      c.stroke()
    }
  }
}
