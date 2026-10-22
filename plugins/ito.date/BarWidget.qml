import QtQuick
import Quickshell
import qs.Ui as Ui
import "../../bar/modules" as Ito

// Ito date: day and month as dim numerals, the quiet counterweight to the clock on the other
// side of the seal. The full date is in the tooltip.
Ui.BarWidget {
  id: root
  moduleName: "ito.date"

  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  readonly property color blood: cfg.blood
  readonly property real k: root.barSize / 52

  SystemClock {
    id: clock
    precision: SystemClock.Minutes
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  Ui.WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: Qt.formatDate(clock.date, "dddd, d MMMM yyyy")
    labelVisible: false
    hasVisualContent: true
    horizontalMargin: 5
    fixedWidth: vertical ? barSize : face.implicitWidth + scaledHorizontalMargin * 2
    fixedHeight: vertical ? stacked.height + scaledVerticalPadding * 2 : barSize
    onPressed: function(mouseButton) {
      if (mouseButton === Qt.LeftButton) calendar.toggle()
    }

    // On a vertical bar the weekday sits over the day of the month.
    Column {
      id: stacked
      visible: root.vertical
      anchors.centerIn: parent
      spacing: 0

      Text {
        anchors.horizontalCenter: parent.horizontalCenter
        text: Qt.formatDate(clock.date, "ddd").toLowerCase()
        color: cfg.bone
        opacity: 0.85
        font.family: "Noto Serif CJK JP"
        font.pixelSize: Math.round(13 * root.k)
      }

      Text {
        anchors.horizontalCenter: parent.horizontalCenter
        text: Qt.formatDate(clock.date, "d")
        color: cfg.bone
        font.family: "Noto Serif CJK JP"
        font.pixelSize: Math.round(17 * root.k)
      }
    }

    Text {
      id: face
      visible: !root.vertical
      anchors.centerIn: parent
      text: Qt.formatDate(clock.date, "ddd d").toLowerCase()
      color: cfg.bone
      opacity: button.tooltipHovered ? 1 : 0.85
      font.family: "Noto Serif CJK JP"
      font.pixelSize: Math.round(16 * root.k)
      font.letterSpacing: 1

      Behavior on opacity { NumberAnimation { duration: 140 } }
    }
  }

  // The date opens the same calendar as the clock, under its own button. No IPC target here: `ito.calendar` belongs to
  // the clock's copy, so it has one owner.
  Ito.ItoCalendarPanel {
    id: calendar
    bar: root.bar
    anchorItem: button
    config: cfg
    moduleName: "ito.calendar.date"
    ipcTarget: ""
  }
}
