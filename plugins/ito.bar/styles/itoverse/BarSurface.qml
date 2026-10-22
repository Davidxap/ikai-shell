pragma ComponentBehavior: Bound

import QtQuick
import Quickshell.Io
import "../shibumi" as Fork
import "../../../../bar/modules" as Modules

// The Ito-verse surface.
//
// The fork's surface is not just a background: it hosts the whole widget layout, the drag handling
// and the shell forms, and the panel only ever hands it `layoutSession` and `screenName`. So it is
// kept intact and made see-through by the tokens, and the texture reaches it through the `runPlate`
// token (see RunPlate.qml), which is what lets a split island carry the same plate as a joined bar.
//
// First frame. At start the engine builds the bar before the sidecar, the theme palette and the widgets
// are in: the plate starts at the default size/gap, the fork chrome fades from its dark default to the
// style's see-through colour, and the plate grows widget by widget. The surface therefore stays at opacity 0
// until the style, the host, the sidecar and the palette are in and the plates stopped changing width
// (RunPlate calls itoSettleTouch), then fades in once. Nothing is lost: the layout runs while it is hidden.
Item {
  id: root

  required property var bar
  property var layoutSession: null
  property string screenName: ""

  // True once the first complete bar is ready to be seen; it never goes back.
  property bool revealed: false
  readonly property bool inputsReady: !!bar && bar.styleReady === true && bar.hostReady === true
    && Object.keys(gate.values).length > 0 && Object.keys(gate.themeColors).length > 0
    && width > 0
  property bool capArmed: false

  Modules.ItoConfig {
    id: gate
    path: Qt.resolvedUrl("../../../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  // A plate changed width: layout is still moving, wait again.
  function itoSettleTouch() {
    if (revealed) return
    capArmed = true
    if (inputsReady) settle.restart()
  }
  onInputsReadyChanged: if (inputsReady && !revealed) settle.restart()

  // Both clocks stop by themselves: they only run until the first reveal.
  Timer {
    id: settle
    interval: 280
    onTriggered: root.reveal("settled")
  }
  Timer {
    id: cap
    interval: 2500
    running: root.capArmed && !root.revealed
    onTriggered: root.reveal("cap")
  }
  function reveal(why) {
    if (revealed) return
    revealed = true
  }

  // ITO-START: one journal line at this surface's first rendered frame, with the ms elapsed since the shell process started
  // (/proc/self/stat starttime vs /proc/uptime, 100 ticks/s). No flag; a one-shot Connections (disabled after the first frame).
  property bool startLogged: false
  FileView { id: procStat; blockLoading: true; printErrors: false }
  FileView { id: procUptime; blockLoading: true; printErrors: false }
  function logStart() {
    if (startLogged) return
    startLogged = true
    var ms = -1
    procStat.path = "/proc/self/stat"
    procUptime.path = "/proc/uptime"
    var st = procStat.text()
    var up = procUptime.text()
    var f = st.slice(st.lastIndexOf(")") + 2).split(" ")
    if (f.length > 19 && up) ms = Math.round(parseFloat(up.split(" ")[0]) * 1000 - Number(f[19]) * 10)
    console.log("ITO-START first-frame elapsed_ms=" + ms + " screen=" + screenName)
  }
  Connections {
    target: root.Window.window
    enabled: !root.startLogged
    function onFrameSwapped() { root.logStart() }
  }

  opacity: revealed ? 1 : 0
  Behavior on opacity { NumberAnimation { duration: 120; easing.type: Easing.OutCubic } }

  Fork.BarSurface {
    anchors.fill: parent
    bar: root.bar
    layoutSession: root.layoutSession
    screenName: root.screenName
  }
}
