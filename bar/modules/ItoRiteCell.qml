import QtQuick

// A reading in the column beside a seal: a kanji with its English word, the value, and a groove under it.
//
//   line 1 (12 px)  kanji (Noto Serif CJK JP 10 px) + the word in capitals + the warning glyph when hot
//   line 2 (16 px)  the value, Noto Serif 13 px, the palette's foreground
//   line 3 (6 px)   the groove (ItoGroove) full width, with the threshold mark; left out when `fraction` is below 0
//
// 40 px tall, 30 px without a groove. A kanji is never alone: it always comes with its English word (渦 LOAD, 圧 PRESSURE,
// 周 FREQ, 熱 TEMP, 読 READ, 書 WRITE). Colours come only from `cfg` through an ItoSealInk; `live` is the panel-open flag
// and motion follows `cfg.motionAmp`, exactly as in ItoSysRow. Imports nothing from the shell.
Item {
  id: root

  property var cfg: null
  property var ink: null
  property string kanji: ""
  property string label: ""
  property string value: ""
  property real fraction: -1
  property bool hot: false
  property real threshold: -1
  property bool live: true

  readonly property var seal: ink ? ink : ownInk
  readonly property bool hasBar: fraction >= 0
  readonly property real amp: cfg && cfg.motionAmp !== undefined ? cfg.motionAmp : 1

  ItoSealInk { id: ownInk; source: root.ink ? null : root.cfg }

  implicitHeight: hasBar ? 40 : 30
  height: implicitHeight

  Row {
    id: head
    y: 0
    height: 12
    spacing: 6
    Text {
      anchors.verticalCenter: parent.verticalCenter
      text: root.kanji
      color: root.seal.label
      font.family: "Noto Serif CJK JP"; font.pixelSize: 10
      renderType: Text.NativeRendering
    }
    Text {
      anchors.verticalCenter: parent.verticalCenter
      text: root.label.toUpperCase()
      color: root.seal.label
      font.family: "Noto Serif"; font.pixelSize: 9; font.letterSpacing: 1.4
      renderType: Text.NativeRendering
    }
    ItoFlauros { visible: root.hot; ink: root.seal; anchors.verticalCenter: parent.verticalCenter }
  }

  Text {
    y: 12
    height: 16
    width: root.width
    verticalAlignment: Text.AlignVCenter
    text: root.value
    elide: Text.ElideRight
    color: root.seal.bone
    font.family: "Noto Serif"; font.pixelSize: 13
    renderType: Text.NativeRendering
  }

  ItoGroove {
    visible: root.hasBar
    y: 28 - 1.5
    width: root.width
    ink: root.seal
    fraction: Math.max(0, root.fraction)
    hot: root.hot
    threshold: root.threshold
    live: root.live
    amp: root.amp
  }
}
