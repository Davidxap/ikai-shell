import QtQuick

// Lettered sound effects (manga onomatopoeia): ゴゴゴ (a menacing rumble) when the run queue is longer than the threads,
// ざわざわ (a crowd murmuring) when memory is over its line, ぞわぞわ (skin crawling) when a swap is nearly full, ドドド
// (pounding) when the disk is busy. Noto Serif CJK JP Bold, 10 px, the alarm colour, never above 0.8 opacity.
//
// It appears on the RISING edge of its condition while the panel is open: 0 -> 1 in 120 ms, holds 2 s, 1 -> 0 in 600 ms (one
// SequentialAnimation, started by the edge). It re-arms only after the condition has been false for 2 refreshes. It is never the
// only carrier of its meaning: the same condition is also a Flauros or a colour elsewhere in the panel.
//
// The host sets `active` and every other input FIRST and increments `tick` LAST, once per refresh: the edge is decided there.
// `holdMs` delays the appearance (600 when a static burst starts in the same refresh). `allowed` is the budget's verdict. Shown
// only at `full`, with `live` and `amp > 0`; closed it is hidden and its animation stopped. `vertical`: one glyph per line
// (line height 10), else a single line. `pose` is for the lab: -1 in use, else a frozen phase 0..1 (1 = fully shown).
// Colours come only from `ink` (an ItoSealInk). Imports nothing from the shell.
Item {
  id: root

  property var ink: null
  property string text: ""
  property bool vertical: true
  property bool rightAlign: false
  property bool active: false
  property bool allowed: true
  property int tick: 0
  property int holdMs: 0
  property string lvl: "off"
  property bool live: false
  property real amp: 1
  property real pose: -1
  readonly property int holdMs2: 2000      // how long the lettering stays

  readonly property real ampDur: Math.min(amp, 1)
  property real shownPhase: 0
  property bool armed: true
  property int falseRun: 0
  property bool pending: false

  width: vertical ? 10 : 40
  height: vertical ? 30 : 10
  visible: lvl === "full" && text !== "" && (pose >= 0 || shownPhase > 0.001)
  opacity: sane(pose >= 0 ? pose : shownPhase) * 0.8
  function sane(v) { return (v >= 0 && v <= 1) ? v : 0 }

  Text {
    anchors.fill: parent
    text: root.vertical ? root.text.split("").join("\n") : root.text
    color: root.ink ? root.ink.hot : "transparent"
    font.family: "Noto Serif CJK JP"; font.pixelSize: 10; font.weight: Font.Bold
    lineHeight: 10; lineHeightMode: Text.FixedHeight
    horizontalAlignment: root.vertical ? Text.AlignHCenter : (root.rightAlign ? Text.AlignRight : Text.AlignLeft)
    renderType: Text.NativeRendering
  }

  // the edge: decided once per refresh, after the host has set its inputs
  onTickChanged: {
    if (active && allowed) {
      falseRun = 0
      if (armed) {
        armed = false
        if (holdMs > 0) pending = true
        else show()
      }
    } else if (!active) {
      falseRun = falseRun + 1
      if (falseRun >= 2) armed = true
    }
  }
  function show() {
    if (live && amp > 0 && lvl === "full") letters.restart()
  }
  onLiveChanged: if (!live) { letters.stop(); shownPhase = 0; armed = true; falseRun = 0; pending = false }

  Timer {
    interval: root.holdMs
    running: root.pending && root.live
    repeat: false
    onTriggered: { root.pending = false; root.show() }
  }

  SequentialAnimation {
    id: letters
    NumberAnimation { target: root; property: "shownPhase"; to: 1; duration: Math.round(120 * root.ampDur) }
    PauseAnimation { duration: root.holdMs2 }
    NumberAnimation { target: root; property: "shownPhase"; to: 0; duration: Math.round(600 * root.ampDur) }
  }
}
