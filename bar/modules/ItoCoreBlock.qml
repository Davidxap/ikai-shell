import QtQuick
import "ItoChart.js" as Chart

// The processor block of the CPU panel: the caption (核 CORES, or how the rays are grouped above 128 threads), the core
// seal on the left and beside it the readings as cells (渦 LOAD, 圧 PRESSURE, 周 FREQ, 熱 TEMP), each with its figure as text
// and a groove that marks its threshold. The seal only shows the numbers; every figure is text.
//
//   width W      the content column's width (nominal 346). Under 300 the block stacks: the seal centred above, the cells below.
//   seal         S = clamp(W - 160, 160, 184) (184 at 346)
//   cells        x = S + 12, width W - S - 12, spacing 8, vertically centred on the seal; up to four, a missing source is no cell
//
// Give it the panel palette as `cfg` (the widget's `tint`, under a name the block has no property of) or a shared `ink`
// (an ItoSealInk). `view` is what plugins/ito.cpu/Model.js `update` returns (load, psi, freq, temp), `readings` what
// `Model.readings` returns (rows { key, label, value, fraction, hot, threshold }), `loads` the per-core loads ([] before
// the second sample), `threads` the number of logical CPUs. `alert` opens the seal's crack. `live` is the panel-open flag:
// closed, nothing animates. Motion follows `cfg.motionAmp`. Imports nothing from the shell, so the offscreen lab renders it.
Item {
  id: root

  property var cfg: null
  property var ink: null
  property var view: null
  property var readings: []
  property var loads: []
  property int threads: 0
  property bool alert: false
  property bool live: true
  property string lvl: "off"
  property int peakCore: -1
  property real peakV: 0
  property int tick: 0

  readonly property var seal: ink ? ink : ownInk
  readonly property real amp: cfg && cfg.motionAmp !== undefined ? cfg.motionAmp : 1
  readonly property bool stacked: width < 300
  readonly property real sealSize: stacked ? Math.min(width, 184) : Chart.clamp(width - 160, 160, 184)
  readonly property real sideX: stacked ? 0 : sealSize + 12

  ItoSealInk { id: ownInk; source: root.ink ? null : root.cfg }

  // what the seal is given, from the model's view
  readonly property real load1: view && view.load && threads > 0 ? view.load[0] / threads : -1
  readonly property real load15: view && view.load && threads > 0 ? view.load[2] / threads : -1
  readonly property real psi: view && view.psi !== null && view.psi !== undefined ? view.psi : -1
  readonly property real freqAvg: view && view.freq ? view.freq.avg : 0
  readonly property real freqMax: view && view.freq ? view.freq.max : 0

  // a kanji for each reading, always printed with its English word
  readonly property var kanji: ({ load: "渦", psi: "圧", freq: "周", temp: "熱" })
  readonly property int group: Chart.coreTiers(threads).group
  readonly property string caption: group > 1 ? threads + " threads · " + group + " per ray" : "CORES"

  readonly property real captionHeight: 12
  readonly property real bodyHeight: stacked ? sealSize + 10 + side.implicitHeight : Math.max(sealSize, side.implicitHeight)
  implicitHeight: captionHeight + 6 + bodyHeight
  height: implicitHeight

  Row {
    id: head
    height: root.captionHeight
    spacing: 6
    Text {
      anchors.verticalCenter: parent.verticalCenter
      text: "核"
      color: root.seal.label
      font.family: "Noto Serif CJK JP"; font.pixelSize: 10
      renderType: Text.NativeRendering
    }
    Text {
      anchors.verticalCenter: parent.verticalCenter
      text: root.caption
      color: root.seal.label
      font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.6
      renderType: Text.NativeRendering
    }
  }

  ItoCoreSeal {
    id: core
    x: root.stacked ? (root.width - width) / 2 : 0
    y: root.captionHeight + 6
    ink: root.seal
    size: root.sealSize
    loads: root.loads
    threads: root.threads
    load1: root.load1
    load15: root.load15
    psi: root.psi
    freqAvg: root.freqAvg
    freqMax: root.freqMax
    alert: root.alert
    live: root.live
    amp: root.amp
    eyeStyle: root.cfg && root.cfg.eyeStyle !== undefined ? root.cfg.eyeStyle : "shaded"
    eyeLevel: root.cfg && root.cfg.eyeLevel !== undefined ? root.cfg.eyeLevel : 0
    lvl: root.lvl
    temp: root.view && root.view.temp !== null && root.view.temp !== undefined ? root.view.temp : -1
    peakCore: root.peakCore
    peakV: root.peakV
    oversub: root.load1 > 1
    tick: root.tick
  }

  Column {
    id: side
    x: root.sideX
    y: root.captionHeight + 6 + (root.stacked ? root.sealSize + 10 : Math.max(0, (root.bodyHeight - implicitHeight) / 2))
    width: root.width - root.sideX
    spacing: 8
    Repeater {
      model: root.readings.length
      // by position, not by list: a cell keeps its groove between refreshes and glides to the new reading
      ItoRiteCell {
        required property int index
        readonly property var r: root.readings[index]
        width: parent.width
        cfg: root.cfg
        ink: root.seal
        live: root.live
        kanji: r ? (root.kanji[r.key] || "") : ""
        label: r ? r.label : ""
        value: r ? r.value : ""
        fraction: r ? r.fraction : -1
        hot: r ? r.hot : false
        threshold: r && r.threshold !== undefined ? r.threshold : -1
      }
    }
  }
}
