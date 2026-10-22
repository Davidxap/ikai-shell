import QtQuick
import Quickshell
import Quickshell.Io
import qs.Ui as Ui
import "ItoLayout.js" as PopupSize
import "ItoTimeModel.js" as Model

// The calendar popup, shared by the clock and the date: each widget instantiates one, anchored to its own button.
// A normal KeyboardPanel host (the pattern of the media and memory panels) around ItoCalendarCard.
//
// Zero cost while closed: the card is behind a Loader that is active only while the panel is open or still fading,
// the zone Process and the holidays FileView exist only while open, and the one Timer here is tied to `live`.
// `ipcTarget` is handled by Ui.Panel (open / close / toggle); the date's copy leaves it empty so the target has one owner.
//
// Keys (visual-spec 7): the PanelKeyCatcher takes arrows, hjkl, Enter, Space, Esc and hands `t` and `y` to textKey; the
// `pager` Item around it takes PgUp / PgDn (the catcher does not accept them, so they bubble up to it).
Ui.Panel {
  id: popup

  property Item anchorItem: null
  property var config: null                   // the widget's ItoConfig (not `cfg`: `cfg: cfg` in the widget would bind to itself)
  readonly property bool live: opened

  // what the host reads for the card
  readonly property string zoneText: config ? String(config.get("calendarZones", "")) : ""
  readonly property var zoneList: Model.parseZones(zoneText)
  property var zoneOffsets: []
  property var holidayTable: ({})
  property int zoneHour: -1
  readonly property real cardHeight: loader.item ? loader.item.implicitHeight : 431 + (zoneList.length > 0 ? 52 : 0)

  // the card and the frame take their colours from this (the id is not `tint`: the card's own property has that name)
  ItoPanelPalette { id: panelTint; source: popup.config }

  onOpenedChanged: {
    if (opened) { spawnZones() }
    else { holidayTable = ({}); zoneHour = -1 }
  }
  // the offsets of the last opening stay (the widget's tooltip reads them: it must not spawn anything itself)
  onZoneTextChanged: { zoneOffsets = []; if (opened) { zoneHour = -1; spawnZones() } }

  // One `sh -c` for every zone, the names as argv (validated by the model; never interpolated into the script).
  // A name with no zoneinfo file prints `?`, which the model reads as unknown.
  function spawnZones() {
    if (zoneList.length === 0 || zoneProc.running) return
    zoneHour = new Date().getHours()
    zoneProc.running = true
  }

  Process {
    id: zoneProc
    command: ["sh", "-c", "for z; do if [ -f \"/usr/share/zoneinfo/$z\" ]; then TZ=\"$z\" date +%z; else echo '?'; fi; done", "sh"]
      .concat(popup.zoneList.map(function(z) { return z.ok ? z.zone : "-" }))
    stdout: StdioCollector {
      onStreamFinished: popup.zoneOffsets = Model.parseOffsets(this.text)
    }
  }

  // the offsets only change at an hour boundary (a DST step or a half-hour zone does not move within an hour)
  Timer {
    interval: 60000
    running: popup.live && popup.zoneList.length > 0
    repeat: true
    onTriggered: if (new Date().getHours() !== popup.zoneHour) popup.spawnZones()
  }

  // ~/.config/omarchy/ito-holidays.txt, read only while open and only when the option is on
  FileView {
    id: holidayFile
    path: popup.live && popup.config && popup.config.get("calendarHolidays", true) !== false
      ? Quickshell.env("HOME") + "/.config/omarchy/ito-holidays.txt" : ""
    printErrors: false
    onLoaded: popup.holidayTable = Model.parseHolidays(holidayFile.text())
    onLoadFailed: popup.holidayTable = ({})
  }

  Ui.KeyboardPanel {
    id: panel
    anchorItem: popup.anchorItem
    owner: popup
    bar: popup.bar
    open: popup.opened
    focusTarget: keys

    gap: PopupSize.gapFor(panel)

    contentWidth: PopupSize.popupWidth(panel, 436)
    contentHeight: PopupSize.popupHeight(panel, popup.cardHeight + popup.config.panelHeadroom + popup.config.panelFootroom + 12)

    // a see-through layer over the whole popup that only watches where the pointer is
    Item {
      anchors.fill: parent
      z: 1000
      HoverHandler { id: cardHover }
    }
    ItoPanelFrame {
      id: pf; host: panel; content: keys
      cfg: panelTint
      emblem: "clock"
      opened: popup.opened
      memos: []
    }
    ItoAutoClose {
      opened: popup.opened
      hovered: cardHover.hovered
      seconds: Number(popup.config.get("popupSeconds", 3))
      onExpired: popup.close()
    }

    Item {
      id: pager
      anchors.fill: parent
      Keys.onPressed: function(event) {
        var c = loader.item
        if (!c) return
        if (event.key === Qt.Key_PageUp || event.key === Qt.Key_PageDown) {
          var step = event.key === Qt.Key_PageUp ? -1 : 1
          if (event.modifiers & Qt.ShiftModifier) c.pageYear(step)
          else c.page(step)
          event.accepted = true
        }
      }

      Ui.PanelKeyCatcher {
        id: keys
        anchors.fill: parent
        onMoveRequested: function(dx, dy) { if (loader.item) loader.item.move(dx, dy) }
        onActivateRequested: if (loader.item) loader.item.pick()
        onCloseRequested: if (!loader.item || !loader.item.back()) popup.close()
        onTextKey: function(t) {
          if (!loader.item) return
          if (t === "t" || t === "T") loader.item.goToday()
          else if (t === "y" || t === "Y") loader.item.toggleYearPlate()
        }

        // Nothing is built while the panel is closed and has finished fading
        Loader {
          id: loader
          active: popup.opened || panel.visible
          x: 8
          y: 6 + popup.config.panelHeadroom
          sourceComponent: Component {
            ItoCalendarCard {
              tint: panelTint
              opened: popup.opened
              now: tick.date
              zones: popup.zoneText
              zoneOffsets: popup.zoneOffsets
              holidays: popup.holidayTable
              weekStart: Model.resolveWeekStart(String(popup.config.get("calendarWeekStart", "locale")), Qt.locale().firstDayOfWeek)
              weekNumbers: popup.config.get("calendarWeekNumbers", true) !== false
              hour12: popup.config.get("clockHour12", false) === true
              numerals: String(popup.config.get("clockNumerals", "western"))
              moon: popup.config.get("clockMoon", false) === true

              // the head's seconds; it exists only with the card
              SystemClock { id: tick; precision: SystemClock.Seconds }
            }
          }
        }
      }
    }
  }
}
