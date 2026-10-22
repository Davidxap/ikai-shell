import QtQuick
import Quickshell
import qs.Ui as Ui
import "../../bar/modules" as Ito
import "../../bar/modules/ItoMotion.js" as Motion
import "../../bar/modules/ItoTimeModel.js" as Model

// Ito clock: the time as a serif numeral, no letters and no icon. The full date, with its
// words, lives in the tooltip. Written for IKAI, not ported from the stock clock.
// The face is bar/modules/ItoClockFace.qml (shared with the lab); the options are the CLOCK & CALENDAR section of the
// Control Centre and default to the plain HH:mm. A click opens the calendar under it (`omarchy-shell ito.calendar toggle`
// does too).
Ui.BarWidget {
  id: root
  moduleName: "ito.clock"

  Ito.ItoConfig {
    id: cfg
    path: Qt.resolvedUrl("../../bar/modules/ito-style.json").toString().replace("file://", "")
  }

  readonly property color blood: cfg.blood
  readonly property real k: root.barSize / 52

  readonly property bool seconds: cfg.get("clockSeconds", false) === true
  // The spiral steps once a second: its Timer runs only when it is shown, and never with Motion off.
  readonly property bool liveTick: cfg.get("clockTick", false) === true && cfg.motionAmp > 0 && !root.vertical
  property real tickAngle: 0

  SystemClock {
    id: clock
    precision: root.seconds ? SystemClock.Seconds : SystemClock.Minutes
  }

  Timer {
    interval: 1000
    running: root.liveTick
    repeat: true
    onTriggered: root.tickAngle += 12
  }
  Behavior on tickAngle {
    enabled: root.liveTick
    NumberAnimation { duration: Math.round(180 * cfg.motionAmp); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.spring }
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  // date, week, moon and (once the calendar has been opened and read them) the extra zones, one per line
  readonly property string tip: {
    var d = clock.date
    var c = { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
    var lines = [Qt.formatDate(d, "dddd, d MMMM yyyy"),
                 "Week " + Model.isoWeek(c).week + " · day " + Model.dayOfYear(c),
                 Model.moonPhase(d.getTime()).name]
    var zones = calendar.zoneList
    for (var i = 0; i < zones.length; i++) {
      var off = i < calendar.zoneOffsets.length ? calendar.zoneOffsets[i] : null
      if (!zones[i].ok || off === null || off === undefined) continue
      var z = Model.zoneClock(d.getTime(), off, Model.key(c))
      lines.push(zones[i].label + " " + z.hh + ":" + z.mm + (z.dayShift ? " (" + (z.dayShift > 0 ? "+" : "−") + Math.abs(z.dayShift) + ")" : ""))
    }
    return lines.join("\n")
  }

  Ui.WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: root.tip
    labelVisible: false
    hasVisualContent: true
    horizontalMargin: 5
    fixedWidth: vertical ? barSize : face.implicitWidth + scaledHorizontalMargin * 2
    fixedHeight: vertical ? face.implicitHeight + scaledVerticalPadding * 2 : barSize
    onPressed: function(mouseButton) {
      if (mouseButton === Qt.LeftButton) calendar.toggle()
    }

    // The colon is the one red thing in the clock, so the hour reads as two halves rather than as a
    // number. On a vertical bar the hour sits over the minutes, with the one red mark between them.
    Ito.ItoClockFace {
      id: face
      anchors.centerIn: parent
      date: clock.date
      bone: cfg.bone
      blood: root.blood
      k: root.k
      vertical: root.vertical
      hovered: button.tooltipHovered
      live: root.visible
      hour12: cfg.get("clockHour12", false) === true
      seconds: root.seconds
      numerals: String(cfg.get("clockNumerals", "western"))
      dateMode: String(cfg.get("clockDate", "off"))
      moon: cfg.get("clockMoon", false) === true
      tick: cfg.get("clockTick", false) === true
      motionAmp: cfg.motionAmp
      tickAngle: root.tickAngle
      shGlyphSize: cfg.shChoice("clock") ? Math.round(root.barSize * cfg.get("iconScale", 0.62)) : 0
      shGlyph: cfg.shChoice("clock") ? cfg.userBar("hollow/spiral.png", shGlyphSize * Math.max(1, Screen.devicePixelRatio), "v9") : null
      // the picture is tinted like every bar picture (bone -> foreground, crimson -> accent); the digits are never under the effect
      shTinted: cfg.tinted
      shEffect: Component { Ito.ItoThemeEffect { palette: cfg } }
    }
  }

  // The clock and the date open the same calendar, each under its own button; this is the clock's copy, and the owner of
  // the `ito.calendar` IPC target.
  Ito.ItoCalendarPanel {
    id: calendar
    bar: root.bar
    anchorItem: button
    config: cfg
    moduleName: "ito.calendar"
    ipcTarget: "ito.calendar"
  }
}
