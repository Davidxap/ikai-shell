import QtQuick

// A popup that opened on a click should not stay open for ever. This closes it a few seconds after it was opened,
// or after the pointer left it, unless the pointer is on it (or the popup says it is busy: a password being typed).
// The seconds are the user's (Bars page -> Popups); 0 means it stays until it is clicked again.
//
//   Ito.ItoAutoClose { opened: root.popupOpen; hovered: cardHover.hovered; seconds: cfg.get("popupSeconds", 3)
//                      onExpired: root.popupOpen = false }
Item {
  id: root

  property bool opened: false
  property bool hovered: false
  property bool hold: false
  property real seconds: 3

  signal expired()

  visible: false
  width: 0
  height: 0

  readonly property bool armed: opened && !hovered && !hold && seconds > 0

  // Becoming armed starts the count afresh, so leaving the popup always gives the full time again.
  Timer {
    interval: Math.max(500, Math.round(root.seconds * 1000))
    running: root.armed
    repeat: false
    onTriggered: root.expired()
  }
}
