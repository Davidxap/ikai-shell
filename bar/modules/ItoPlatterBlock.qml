import QtQuick
import "ItoChart.js" as Chart

// The storage block of the Disk panel: the caption (穴 MOUNTS), the platter seal on the left and beside it the readings
// as cells (読 READ, 書 WRITE, 働 BUSY and, when an NVMe sensor exists, 熱 TEMP) with their figures as text: "12.4 MB/s", "62 °C".
// The seal only shows the numbers (a ring per mount, runes turning with the traffic, drops while writing); every figure
// stays text, here and in the rows under the block.
//
//   width W      the content column's width (nominal 346). Under 300 the block stacks: the seal centred above, the cells below.
//   seal         S = clamp(W - 160, 160, 184) (184 at 346)
//   cells        x = S + 12, width W - S - 12, spacing 8, vertically centred on the seal; with no cell the seal is centred
//
// Give it the panel palette as `cfg` (the widget's `tint`, under a name the block has no property of) or a shared `ink`
// (an ItoSealInk). `view` is what plugins/ito.disk/Model.js `update` returns (mounts, io, hasStats), `readings` what
// `Model.readings` returns (rows { key, label, value, fraction, hot, threshold }). `alert` opens the seal's crack. `live`
// is the panel-open flag: closed, nothing animates. Motion follows `cfg.motionAmp`. Imports nothing from the shell, so the
// offscreen lab renders it.
Item {
  id: root

  property var cfg: null
  property var ink: null
  property var view: null
  property var readings: []
  property bool alert: false
  property bool live: true
  property string lvl: "off"          // the lore level (off | subtle | full), see ItoPlatterSeal
  property int tick: 0                // incremented by the panel once per refresh, after setting `view`

  readonly property var seal: ink ? ink : ownInk
  readonly property real amp: cfg && cfg.motionAmp !== undefined ? cfg.motionAmp : 1
  readonly property bool stacked: width < 300
  readonly property real sealSize: stacked ? Math.min(width, 184) : Chart.clamp(width - 160, 160, 184)
  readonly property bool hasCells: readings.length > 0
  readonly property real sideX: stacked || !hasCells ? 0 : sealSize + 12

  ItoSealInk { id: ownInk; source: root.ink ? null : root.cfg }

  readonly property var mounts: view && view.mounts ? view.mounts : []
  readonly property real readBps: view && view.io ? view.io.read : 0
  readonly property real writeBps: view && view.io ? view.io.write : 0
  readonly property bool hasStats: view ? !!view.hasStats : false

  // a kanji for each reading, always printed with its English word
  readonly property var kanji: ({ read: "読", write: "書", busy: "働", temp: "熱" })
  readonly property real busy: view && view.io && view.io.busy !== null && view.io.busy !== undefined ? view.io.busy : -1
  readonly property real temp: view && view.temp !== null && view.temp !== undefined ? view.temp : -1

  readonly property real captionHeight: 12
  readonly property real bodyHeight: stacked ? sealSize + (hasCells ? 10 + side.implicitHeight : 0) : Math.max(sealSize, side.implicitHeight)
  implicitHeight: captionHeight + 6 + bodyHeight
  height: implicitHeight

  Row {
    id: head
    height: root.captionHeight
    spacing: 6
    Text {
      anchors.verticalCenter: parent.verticalCenter
      text: "穴"
      color: root.seal.label
      font.family: "Noto Serif CJK JP"; font.pixelSize: 10
      renderType: Text.NativeRendering
    }
    Text {
      anchors.verticalCenter: parent.verticalCenter
      text: "MOUNTS"
      color: root.seal.label
      font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.6
      renderType: Text.NativeRendering
    }
  }

  ItoPlatterSeal {
    x: root.stacked || !root.hasCells ? (root.width - width) / 2 : 0
    y: root.captionHeight + 6
    ink: root.seal
    size: root.sealSize
    mounts: root.mounts
    readBps: root.readBps
    writeBps: root.writeBps
    hasStats: root.hasStats
    alert: root.alert
    live: root.live
    amp: root.amp
    lvl: root.lvl
    temp: root.temp
    busy: root.busy
    tick: root.tick
  }

  Column {
    id: side
    visible: root.hasCells
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
