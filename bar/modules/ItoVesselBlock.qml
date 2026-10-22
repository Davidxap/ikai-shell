import QtQuick
import "ItoChart.js" as Chart
import "ItoLore.js" as Lore

// The memory block of the RAM panel: the vessel seal on the left, and beside it the legend of what memory is made of
// (each part with its absolute size, GiB with one decimal, and its share) and the swap seals, one per kind. Under
// them the pages still to be written, as a reskinned row. Every figure is text; the liquid only shows it.
//
//   width W                     the content column's width (nominal 346). Under 300 the block stacks: the seal
//                               centred above, the legend and swaps below it, full width.
//   seal                        S = clamp(W - 190, 132, 164) (156 at 346), plus 20 px under it for the drop and pool
//   legend  (x = S + 14)        5 rows of 18 px: swatch 8, label 70, size right-aligned, share 38. The swatch
//                               is the stratum's own fill (used goes hot with the reading); free has an empty one
//   swaps                       a 30 px lesser seal, the kind's name and "used / size" (34 px a row)
//
// Give it the panel palette as `cfg` (the widget's `tint`, under a name the block has no property of) or a shared
// `ink` (an ItoSealInk). `legend` and `swaps` are what plugins/ito.mem/Model.js returns (`legend` rows
// { key, label, fraction, size, percent, swatch }; `swaps` rows { kind, label, fraction, value }); `dirtyKiB` the raw
// Dirty + Writeback (drives the drop), `dirtyText` the words of the "Unwritten" row ("" for no row). `live` is the
// panel-open flag: closed, nothing animates. Motion follows `cfg.motionAmp`. The lore pass (`lvl` off | subtle | full, lore-pass.md): a
// chain on the 85 % line, Tomie's mole on the largest consumer's eye, the caption 換 SWAP and, at full, the lettering ざわざわ under the
// vessel (memory over its line) or ぞわぞわ at the swap caption (a swap past 80 %). `loreState` is the panel's settled state
// (idle | busy | hot | critical), `tick` a counter the panel increments once per refresh after setting everything else.
// Imports nothing from the shell.
Item {
  id: root

  property var cfg: null
  property var ink: null
  property var legend: []
  property var swaps: []
  property real dirtyKiB: 0
  property string dirtyText: ""
  property bool hot: false
  property bool unreadable: false
  property bool live: true
  property string lvl: "off"
  property string loreState: "idle"
  property int tick: 0
  property real sfxPose: -1        // for the lab: a frozen phase 0..1 of the lettering that is due (-1 in use)

  readonly property var seal: ink ? ink : ownInk
  readonly property real amp: cfg && cfg.motionAmp !== undefined ? cfg.motionAmp : 1
  readonly property bool stacked: width < 300
  readonly property real sealSize: stacked ? Math.min(width, 164) : Chart.clamp(width - 190, 132, 164)
  readonly property real sideX: stacked ? 0 : sealSize + 14

  ItoSealInk { id: ownInk; source: root.ink ? null : root.cfg }

  // the strata, bottom to top, as shares of the whole: used (dense, hot when the reading is), cache, shared
  function share(key) {
    for (var i = 0; i < legend.length; i++) if (legend[i].key === key) return legend[i].fraction
    return 0
  }
  readonly property var strata: legend.length === 0 ? [] : [
    { fraction: share("used"), gradient: true, hot: hot },
    { fraction: share("cache"), alpha: 0.34 },
    { fraction: share("shared"), alpha: 0.62 }
  ]

  // the lettering: ざわざわ when the memory is over its line, else ぞわぞわ while a swap is past 80 % (Lore.sfxFor), within the budget
  readonly property bool swapHot: {
    for (var i = 0; i < swaps.length; i++) if (swaps[i].fraction > 0.8) return true
    return false
  }
  readonly property bool swapUsed: {
    for (var i = 0; i < swaps.length; i++) if (swaps[i].fraction > 0) return true
    return false
  }
  readonly property var sfx: Lore.sfxFor("ram", loreState, { swapHot: swapHot })
  readonly property var signs: Lore.budget("ram", sfx ? [sfx.key] : [], lvl)

  readonly property real blockHeight: stacked ? vessel.height + 10 + side.implicitHeight : Math.max(vessel.height, side.implicitHeight)
  implicitHeight: blockHeight + (dirtyText !== "" ? 6 + unwritten.implicitHeight : 0)
  height: implicitHeight

  ItoVesselSeal {
    id: vessel
    x: root.stacked ? (root.width - width) / 2 : 0
    y: 0
    ink: root.seal
    size: root.sealSize
    strata: root.strata
    live: root.live
    amp: root.amp
    dirtyKiB: root.dirtyKiB
    unreadable: root.unreadable
    fill: root.cfg && root.cfg.vesselFill !== undefined ? root.cfg.vesselFill : "blood"
    used: root.share("used")
    tight: root.hot || root.swapUsed
    lore: root.lvl
    hot: root.hot
  }

  // ざわざわ, in the strip under the vessel, at its left edge
  ItoLoreSfx {
    x: vessel.x; y: vessel.y + root.sealSize + 3
    ink: root.seal
    text: "\u3056\u308f\u3056\u308f"
    vertical: false
    active: root.sfx !== null && root.sfx.key === "zawazawa"
    allowed: root.signs.indexOf("zawazawa") >= 0
    pose: active && allowed ? root.sfxPose : -1
    tick: root.tick
    lvl: root.lvl; live: root.live; amp: root.amp
  }

  Column {
    id: side
    x: root.sideX
    y: root.stacked ? vessel.height + 10 : 0
    width: root.width - root.sideX
    spacing: 8

    // the legend: what memory is made of
    Column {
      width: parent.width
      Repeater {
        model: root.legend
        Item {
          id: line
          required property var modelData
          width: parent.width; height: 18
          // the swatch is the stratum's own fill; free is the empty vessel, so its swatch is an outline
          Rectangle {
            visible: line.modelData.swatch
            anchors.verticalCenter: parent.verticalCenter
            width: 8; height: 8
            radius: 4
            antialiasing: true
            color: line.modelData.key === "used" ? (root.hot ? root.seal.hot : root.seal.fill)
                 : line.modelData.key === "cache" ? root.seal.settle(root.seal.fill, 0.34)
                 : line.modelData.key === "shared" ? root.seal.settle(root.seal.fill, 0.62)
                 : Qt.rgba(0, 0, 0, 0)
            border.width: line.modelData.key === "free" ? 1 : 0
            border.color: root.seal.tick
          }
          Text {
            x: 16
            anchors.verticalCenter: parent.verticalCenter
            width: 70
            text: line.modelData.label.toUpperCase()
            elide: Text.ElideRight
            color: root.seal.label
            font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.4
            renderType: Text.NativeRendering
          }
          Text {
            anchors { right: parent.right; rightMargin: 40; verticalCenter: parent.verticalCenter }
            horizontalAlignment: Text.AlignRight
            text: line.modelData.size
            color: root.seal.bone
            font.family: "Noto Serif"; font.pixelSize: 11
            renderType: Text.NativeRendering
          }
          Text {
            anchors { right: parent.right; verticalCenter: parent.verticalCenter }
            width: 38
            horizontalAlignment: Text.AlignRight
            text: line.modelData.percent
            color: root.seal.label
            font.family: "Noto Serif"; font.pixelSize: 11
            renderType: Text.NativeRendering
          }
        }
      }
    }

    // swap, one lesser seal per kind
    Column {
      width: parent.width
      spacing: 2
      visible: root.swaps.length > 0
      Item {
        width: parent.width; height: 12
        Row {
          spacing: 6
          Text {
            visible: root.lvl !== "off"
            anchors.verticalCenter: parent.verticalCenter
            text: "\u63db"
            color: root.seal.label
            font.family: "Noto Serif CJK JP"; font.pixelSize: 10
            renderType: Text.NativeRendering
          }
          Text {
            anchors.verticalCenter: parent.verticalCenter
            text: "SWAP"
            color: root.seal.label
            font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.6
            renderType: Text.NativeRendering
          }
        }
        // ぞわぞわ, right-aligned at the end of the caption line
        ItoLoreSfx {
          x: parent.width - width; y: 1
          rightAlign: true
          ink: root.seal
          text: "\u305e\u308f\u305e\u308f"
          vertical: false
          active: root.sfx !== null && root.sfx.key === "zowazowa"
          allowed: root.signs.indexOf("zowazowa") >= 0
          pose: active && allowed ? root.sfxPose : -1
          tick: root.tick
          lvl: root.lvl; live: root.live; amp: root.amp
        }
      }
      Repeater {
        model: root.swaps
        Item {
          id: swapRow
          required property var modelData
          readonly property bool hotSwap: modelData.fraction > 0.8
          width: parent.width; height: 34
          ItoSwapSeal {
            anchors.verticalCenter: parent.verticalCenter
            ink: root.seal
            kind: swapRow.modelData.kind
            value: swapRow.modelData.fraction
            hot: swapRow.hotSwap
            live: root.live
            amp: root.amp
          }
          Column {
            x: 38
            anchors.verticalCenter: parent.verticalCenter
            width: parent.width - 38
            spacing: 1
            Text {
              width: parent.width
              text: swapRow.modelData.label.toUpperCase()
              elide: Text.ElideRight
              color: root.seal.label
              font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.4
              renderType: Text.NativeRendering
            }
            Row {
              spacing: 5
              Text {
                id: swapValue
                text: swapRow.modelData.value
                color: root.seal.bone
                font.family: "Noto Serif"; font.pixelSize: 11
                renderType: Text.NativeRendering
              }
              ItoFlauros { visible: swapRow.hotSwap; ink: root.seal; anchors.verticalCenter: parent.verticalCenter }
            }
          }
        }
      }
    }
  }

  // the pages still to be written (only when there are many): a row of the panel, with no bar
  ItoSysRow {
    id: unwritten
    visible: root.dirtyText !== ""
    y: root.blockHeight + 6
    width: root.width
    cfg: root.cfg
    ink: root.seal
    live: root.live
    label: "Unwritten"
    value: root.dirtyText
  }
}
