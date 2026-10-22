import QtQuick 6.11

// Debug-only frame-time probe (sidecar flag `debugFrames`, default off; ItoPanelFrame creates this only while the flag is on).
// An edge (a popup opening or closing) starts a FrameAnimation that runs for `span` ms and logs one `ITO-FRAMES` line: frames, mean /
// p95 / max frame delta in ms, how many frames were over 20 ms and over 33 ms, `first` (open request -> first frame after the window
// exists) and `lat` (open request -> the next turn of the event loop: the synchronous work done in the edge's own turn).
// Nothing runs while `live` is false, i.e. always, unless the flag is on and a popup is moving.
Item {
  id: probe

  property string label: ""
  property int span: 900
  property bool live: false
  property string dir: "in"
  property real t0: 0
  property real latMs: -1
  property real firstMs: -1
  property var deltas: []
  property var longs: []            // [ms since the edge, frame delta] of the frames over 20 ms, so a stall can be matched to what ran then
  property int gen: 0

  function edge(isOpen) {
    if (live) report()
    dir = isOpen ? "in" : "out"
    deltas = []
    longs = []
    firstMs = -1
    latMs = -1
    t0 = Date.now()
    var g = ++gen
    live = true
    stopper.restart()
    Qt.callLater(function() { if (g === probe.gen) probe.latMs = Date.now() - probe.t0 })
  }

  function report() {
    live = false
    var d = deltas.slice().sort(function(a, b) { return a - b })
    var n = d.length
    if (n === 0) { console.log("ITO-FRAMES id=" + label + " dir=" + dir + " frames=0 first=" + firstMs + " lat=" + latMs); return }
    var sum = 0, g20 = 0, g33 = 0
    for (var i = 0; i < n; i++) { sum += d[i]; if (d[i] > 20) g20++; if (d[i] > 33) g33++ }
    var p95 = d[Math.min(n - 1, Math.floor(0.95 * n))]
    console.log("ITO-FRAMES id=" + label + " dir=" + dir + " frames=" + n + " mean=" + (sum / n).toFixed(2) + " p95=" + p95.toFixed(2)
      + " max=" + d[n - 1].toFixed(2) + " gt20=" + g20 + " gt33=" + g33 + " first=" + firstMs + " lat=" + latMs + " long=" + longs.join(","))
  }

  FrameAnimation {
    running: probe.live
    onTriggered: {
      if (probe.firstMs < 0) { probe.firstMs = Date.now() - probe.t0; return }
      var d = frameTime * 1000
      probe.deltas.push(d)
      if (d > 20 && probe.longs.length < 8) probe.longs.push(Math.round(Date.now() - probe.t0) + ":" + Math.round(d))
    }
  }

  Timer {
    id: stopper
    interval: probe.span
    running: probe.live
    onTriggered: probe.report()
  }
}
