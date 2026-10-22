import QtQuick
import "ItoTimeModel.js" as Model
import "ItoMotion.js" as Motion

// The content of the calendar popup: the head with the large time, the zone row, the month grid (or the year plate),
// and the footer. visual-spec.md sections 3-5 and 7 are the binding layout.
//
// Pure: it imports nothing from the shell (no `qs.*`, no Quickshell.Io) and has no Timer or clock. The host passes the
// moment as `now`, the colours as `tint` (an ItoPanelPalette over the widget's config; never named `cfg` here), the
// zone offsets and the holidays it read, and calls the key functions below. Everything it draws is a token of `tint` or
// of the ItoSealInk derived from it, so it follows the theme in every mode.
//
// Motion: every duration is a Motion value times `tint.motionAmp`, every distance times min(amp, 1.4); with amp 0, or
// while closed, a change lands instantly and no animation runs. A motion is ONE linear clock property (`turnClock`,
// `plateClock`, `ensoClock`, in ms) whose frames are derived by Motion's curves, so the lab can freeze it at any
// instant (freezeAt). Nothing animates while `opened` is false.
//
// The card is `W` wide and `implicitHeight` tall; the host puts it inside the frame and adds the head and foot room.
Item {
  id: root

  property var tint: null
  property bool opened: false
  property date now: new Date(2026, 9, 2, 23, 7, 41)
  property string zones: ""                   // the user's calendarZones text; parsed here by the model
  property var zoneOffsets: []                // minutes east of UTC per parsed zone, null while unknown (the host's Process)
  property var holidays: ({})                 // ItoTimeModel.parseHolidays
  property int weekStart: 1                   // 0 Sunday, 1 Monday, 6 Saturday (resolveWeekStart)
  property bool weekNumbers: true
  property bool hour12: false
  property string numerals: "western"
  property bool moon: false                   // the phase name in the third line of the head

  readonly property int w: 392
  readonly property bool live: opened
  readonly property real amp: tint ? Math.min(tint.motionAmp, 1) : 1          // time: never past 1.0 (motion speed rule)
  readonly property real dist: tint ? Math.min(tint.motionAmp, 1.4) : 1       // travel keeps the lively amplitude
  readonly property bool moving: live && amp > 0

  ItoSealInk { id: ink; source: root.tint }

  // ------------------------------------------------------------------------------------------------ state
  readonly property int todayKey: Model.key({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() })
  property int shownY: 2026
  property int shownM: 10
  property int cursorKey: todayKey
  property int pickedKey: todayKey
  property bool cursorShown: false
  property bool plateOn: false
  property int plateY: 2026
  property int plateM: 10
  property int hoverIdx: -1
  property int hoverPlate: -1

  readonly property var zoneList: Model.parseZones(zones)
  readonly property bool hasZones: zoneList.length > 0
  readonly property bool kanji: numerals === "kanji"
  readonly property real gutter: weekNumbers ? 28 : 0
  readonly property real cellW: (w - gutter) / 7
  readonly property var phase: Model.moonPhase(now.getTime())

  // vertical rhythm
  readonly property real zonesY: 76
  readonly property real ruleY: zonesY + (hasZones ? 52 : 0)
  readonly property real headerY: ruleY + 13
  readonly property real wdY: headerY + 34 + 8
  readonly property real gridY0: wdY + 24
  readonly property real footY: gridY0 + 240 + 10
  implicitWidth: w
  implicitHeight: footY + 26
  width: w
  height: implicitHeight

  // ------------------------------------------------------------------------------------------------ motion clocks
  readonly property real outMs: Motion.fast * amp
  readonly property real inMs: Motion.normal * amp

  // month / year turn
  property real turnClock: 0
  property real turnTotal: 0
  property int turnDir: 1
  property string turnAxis: "x"
  property int fromY: 2026
  property int fromM: 10
  readonly property bool turning: turnClock < turnTotal
  readonly property bool turnOut: turning && turnClock < outMs
  readonly property int gridY: turnOut ? fromY : shownY
  readonly property int gridM: turnOut ? fromM : shownM
  readonly property real turnAlpha: !turning ? 1 : (turnOut ? 1 - ease(Motion.accel, turnClock / outMs) : ease(Motion.decel, (turnClock - outMs) / inMs))
  readonly property real turnOffset: !turning ? 0 : (turnOut ? -turnDir * ease(Motion.accel, turnClock / outMs) : turnDir * (1 - ease(Motion.decel, (turnClock - outMs) / inMs)))
  readonly property real turnMix: !turning ? 1 : ease(Motion.soft, turnClock / Math.max(1, turnTotal))   // watermark crossfade 0 -> 1

  // year plate
  property real plateClock: 0
  property real plateTotal: 0
  readonly property bool plateTurning: plateClock < plateTotal
  readonly property bool plateOut: plateTurning && plateClock < outMs
  readonly property real plateOutP: plateOut ? ease(Motion.accel, plateClock / outMs) : 0
  readonly property real plateInP: plateTurning && !plateOut ? ease(Motion.decel, (plateClock - outMs) / inMs) : 0
  // the grid is the side that leaves first when the plate opens, and arrives second when it closes
  readonly property real gridLayerAlpha: !plateTurning ? (plateOn ? 0 : 1) : (plateOn ? (plateOut ? 1 - plateOutP : 0) : (plateOut ? 0 : plateInP))
  readonly property real gridLayerScale: !plateTurning ? 1 : (plateOn ? (plateOut ? 1 - 0.06 * dist * plateOutP : 1 - 0.06 * dist)
                                                                       : (plateOut ? 1 - 0.06 * dist : 1 - 0.06 * dist * (1 - plateInP)))
  readonly property real plateLayerAlpha: !plateTurning ? (plateOn ? 1 : 0) : (plateOn ? (plateOut ? 0 : plateInP) : (plateOut ? 1 - plateOutP : 0))
  readonly property real plateLayerScale: !plateTurning ? 1 : (plateOn ? (plateOut ? 1 + 0.06 * dist : 1 + 0.06 * dist * (1 - plateInP))
                                                                       : (plateOut ? 1 + 0.06 * dist * plateOutP : 1 + 0.06 * dist))

  // today's ensō draws itself once per open
  property real ensoClock: 1e6
  readonly property real ensoDrawn: !moving ? 1 : ease(Motion.decel, (ensoClock - 40 * amp) / (Motion.slow * amp))

  NumberAnimation { id: turnAnim; target: root; property: "turnClock"; from: 0; running: false }
  NumberAnimation { id: plateAnim; target: root; property: "plateClock"; from: 0; running: false }
  NumberAnimation { id: ensoAnim; target: root; property: "ensoClock"; from: 0; to: (40 + Motion.slow) * root.amp; duration: (40 + Motion.slow) * root.amp; running: false }

  // cubic-bezier easing through the control points of ItoMotion ([x1, y1, x2, y2, 1, 1])
  function ease(c, x) {
    if (x <= 0) return 0
    if (x >= 1) return 1
    var lo = 0, hi = 1, t = x
    for (var i = 0; i < 24; i++) {
      t = (lo + hi) / 2
      var bx = 3 * (1 - t) * (1 - t) * t * c[0] + 3 * (1 - t) * t * t * c[2] + t * t * t
      if (bx < x) lo = t; else hi = t
    }
    return 3 * (1 - t) * (1 - t) * t * c[1] + 3 * (1 - t) * t * t * c[3] + t * t * t
  }

  // Lab: stop every motion and hold the clocks at `ms` after each started, so a frame can be taken at an exact instant.
  function freezeAt(ms) {
    turnAnim.stop(); plateAnim.stop(); ensoAnim.stop()
    if (turnTotal > 0) turnClock = Math.min(ms, turnTotal)
    if (plateTotal > 0) plateClock = Math.min(ms, plateTotal)
    ensoClock = ms
  }

  function startTurn(y, m, dir, axis) {
    if (turning) { turnAnim.stop(); turnClock = turnTotal }          // an in-flight turn snaps to its end
    if (y === shownY && m === shownM) return
    if (!moving) { shownY = y; shownM = m; return }
    fromY = shownY; fromM = shownM
    shownY = y; shownM = m
    turnDir = dir; turnAxis = axis
    turnTotal = outMs + inMs
    turnClock = 0
    turnAnim.to = turnTotal; turnAnim.duration = turnTotal
    turnAnim.restart()
  }

  function startPlate(on) {
    if (plateTurning) { plateAnim.stop(); plateClock = plateTotal }
    if (on === plateOn) return
    plateOn = on
    if (!moving) { plateTotal = 0; plateClock = 0; return }
    plateTotal = outMs + inMs
    plateClock = 0
    plateAnim.to = plateTotal; plateAnim.duration = plateTotal
    plateAnim.restart()
  }

  // a fresh open: today's month, nothing picked by hand, the ensō draws in
  onOpenedChanged: if (opened) reset()
  Component.onCompleted: reset()
  function reset() {
    turnAnim.stop(); plateAnim.stop()
    turnTotal = 0; turnClock = 0; plateTotal = 0; plateClock = 0; plateOn = false
    var t = Model.fromKey(todayKey)
    shownY = t.y; shownM = t.m; plateY = t.y; plateM = t.m
    cursorKey = todayKey; pickedKey = todayKey; cursorShown = false
    if (moving) { ensoClock = 0; ensoAnim.restart() } else ensoClock = 1e6
  }

  // ------------------------------------------------------------------------------------------------ keys (visual-spec 7)
  function showMonth(y, m) {
    var from = shownY * 12 + shownM, to = y * 12 + m
    if (to !== from) startTurn(y, m, to > from ? 1 : -1, "x")
  }
  function move(dx, dy) {
    cursorShown = true
    if (plateOn) {
      var p = Model.addMonths(plateY, plateM, dx + 4 * dy)
      plateY = p.y; plateM = p.m
      return
    }
    var c = Model.moveDays(Model.fromKey(cursorKey), dx + 7 * dy)
    cursorKey = Model.key(c)
    showMonth(c.y, c.m)
  }
  function page(step) {
    if (plateOn) { plateY += step; return }
    var s = Model.addMonths(shownY, shownM, step)
    var c = Model.fromKey(cursorKey)
    var nc = { y: s.y, m: s.m, d: Math.min(c.d, Model.daysInMonth(s.y, s.m)) }
    cursorKey = Model.key(nc)
    startTurn(s.y, s.m, step > 0 ? 1 : -1, "x")
  }
  function pageYear(step) {
    if (plateOn) { plateY += step; return }
    var c = Model.fromKey(cursorKey)
    var nc = { y: shownY + step, m: shownM, d: Math.min(c.d, Model.daysInMonth(shownY + step, shownM)) }
    cursorKey = Model.key(nc)
    startTurn(nc.y, nc.m, step > 0 ? 1 : -1, "y")
  }
  function goToday() {
    var t = Model.fromKey(todayKey)
    cursorKey = todayKey; pickedKey = todayKey
    if (plateOn) { shownY = t.y; shownM = t.m; startPlate(false) }
    else showMonth(t.y, t.m)
  }
  function toggleYearPlate() {
    if (!plateOn) { plateY = shownY; plateM = shownM }
    startPlate(!plateOn)
  }
  function pick() {
    if (plateOn) { openMonth(plateY, plateM); return }
    pickedKey = cursorKey
  }
  function openMonth(y, m) {
    var c = Model.fromKey(cursorKey)
    cursorKey = Model.key({ y: y, m: m, d: Math.min(c.d, Model.daysInMonth(y, m)) })
    shownY = y; shownM = m
    startPlate(false)
  }
  // false when there is nothing to back out of, so the host closes the panel
  function back() {
    if (plateOn) { startPlate(false); return true }
    return false
  }
  function clickDay(cell) {
    pickedKey = cell.key; cursorKey = cell.key
    if (!cell.inMonth) showMonth(cell.y, cell.m)
  }

  // ------------------------------------------------------------------------------------------------ data
  readonly property var grid: Model.monthGrid(gridY, gridM, weekStart)
  readonly property var markGrid: Model.monthGrid(shownY, shownM, weekStart)   // the month the title names
  readonly property var picked: Model.fromKey(pickedKey)
  readonly property var todayCivil: Model.fromKey(todayKey)
  readonly property int cursorIdx: Model.diffDays(grid.cells[0], Model.fromKey(cursorKey))

  function fmtOffset(min) {
    var a = Math.abs(min), h = Math.floor(a / 60), m = a % 60
    return (min < 0 ? "−" : "+") + h + (m ? ":" + Model.pad2(m) : "")
  }

  component Txt: Text {
    renderType: Text.NativeRendering
    textFormat: Text.PlainText
    font.family: "Noto Serif"
    font.features: { "tnum": 1, "lnum": 1 }
  }

  // ------------------------------------------------------------------------------------------------ 1 head
  Item {
    id: head
    x: 0; y: 0; width: root.w; height: 64
    readonly property var t: Model.formatClock(root.now.getHours(), root.now.getMinutes(), root.now.getSeconds(),
      { hour12: root.hour12, seconds: true, numerals: root.numerals })

    Row {
      id: timeRow
      anchors.verticalCenter: parent.verticalCenter
      spacing: 0
      readonly property string family: root.kanji ? "Noto Serif CJK JP" : "Noto Serif"
      readonly property int px: root.kanji ? 44 : 52
      Txt { id: hhText; text: head.t.hh; color: root.tint.bone; font.family: timeRow.family; font.weight: Font.Light; font.pixelSize: timeRow.px }
      Txt { text: ":"; color: ink.fill; font.family: timeRow.family; font.weight: Font.Light; font.pixelSize: timeRow.px }
      Txt { id: mmText; text: head.t.mm; color: root.tint.bone; font.family: timeRow.family; font.weight: Font.Light; font.pixelSize: timeRow.px }
      Item { width: 6; height: 1 }
      // seconds on the time's baseline; in 12 h the meridiem sits under them, the pair ending at the baseline
      Item {
        width: Math.max(ssText.implicitWidth, pmText.visible ? pmText.implicitWidth : 0)
        height: hhText.height
        Txt {
          id: ssText
          y: hhText.baselineOffset - ssText.baselineOffset - (pmText.visible ? pmText.implicitHeight - 4 : 0)
          text: head.t.ss; color: Qt.rgba(ink.fill.r, ink.fill.g, ink.fill.b, 0.8); font.pixelSize: 16; font.weight: Font.Normal
        }
        Txt {
          id: pmText
          visible: root.hour12
          x: 0; y: hhText.baselineOffset - pmText.baselineOffset
          text: head.t.meridiem; color: ink.label; font.pixelSize: 12
        }
      }
    }

    // the right-hand block: weekday, date, week and day, then the moon
    ItoMoon {
      id: headMoon
      anchors { right: parent.right; verticalCenter: parent.verticalCenter }
      size: 24
      illum: root.phase.illum; waxing: root.phase.waxing
      lit: Qt.rgba(root.tint.bone.r, root.tint.bone.g, root.tint.bone.b, 0.85)
      dark: Qt.rgba(root.tint.bone.r, root.tint.bone.g, root.tint.bone.b, 0.14)
      ring: root.tint.blood
    }
    Column {
      anchors { right: headMoon.left; rightMargin: 14; verticalCenter: parent.verticalCenter }
      width: Math.max(60, headMoon.x - 14 - timeRow.width - 14)
      spacing: 1
      Txt {
        width: parent.width; horizontalAlignment: Text.AlignRight; elide: Text.ElideRight
        text: Model.DAY_NAMES[root.now.getDay()]; color: root.tint.bone; font.pixelSize: 15
      }
      Txt {
        width: parent.width; horizontalAlignment: Text.AlignRight; elide: Text.ElideRight
        text: root.now.getDate() + " " + Model.MONTH_NAMES[root.now.getMonth()] + " " + root.now.getFullYear()
        color: ink.label; font.pixelSize: 12
      }
      Txt {
        width: parent.width; horizontalAlignment: Text.AlignRight; elide: Text.ElideRight
        text: "week " + Model.isoWeek(root.todayCivil).week + " · day " + Model.dayOfYear(root.todayCivil)
          + (root.moon ? " · " + root.phase.name.toLowerCase() : "")
        color: ink.tick; font.pixelSize: 11
      }
    }
  }

  // ------------------------------------------------------------------------------------------------ 2 zones
  Row {
    id: zoneRow
    visible: root.hasZones
    x: 0; y: root.zonesY; width: root.w; height: 40
    readonly property int n: root.zoneList.length
    Repeater {
      model: root.zoneList.length
      Item {
        id: zc
        required property int index
        readonly property var zn: root.zoneList[index]
        readonly property var off: root.zoneOffsets && index < root.zoneOffsets.length ? root.zoneOffsets[index] : null
        readonly property var clk: zn.ok && off !== null && off !== undefined ? Model.zoneClock(root.now.getTime(), off, root.todayKey) : null
        width: root.w / zoneRow.n; height: 40

        Rectangle {
          visible: zc.index > 0
          x: 0; anchors.verticalCenter: parent.verticalCenter
          width: 1; height: 28; color: ink.track
        }
        Column {
          anchors.centerIn: parent
          spacing: 2
          Item {
            width: zoneLabel.width; height: zoneLabel.height
            anchors.horizontalCenter: parent.horizontalCenter
            Txt {
              id: zoneLabel
              text: zc.zn.label.toUpperCase(); font.pixelSize: 10; font.letterSpacing: 1.5
              color: zc.zn.ok ? ink.label : ink.tick
            }
            Rectangle { visible: !zc.zn.ok; anchors.centerIn: parent; width: parent.width; height: 1; color: ink.tick }
          }
          Row {
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: 4
            Txt { id: zoneTime; text: zc.clk ? zc.clk.hh + ":" + zc.clk.mm : "—"; color: root.tint.bone; font.pixelSize: 15 }
            Txt {
              visible: zc.clk !== null
              anchors.baseline: zoneTime.baseline
              text: zc.clk ? root.fmtOffset(zc.off) : ""; color: Qt.rgba(ink.fill.r, ink.fill.g, ink.fill.b, 0.75); font.pixelSize: 10
            }
            Txt {
              visible: zc.clk !== null && zc.clk.dayShift !== 0
              anchors.baseline: zoneTime.baseline
              text: zc.clk && zc.clk.dayShift > 0 ? "+" + zc.clk.dayShift : (zc.clk ? "−" + (-zc.clk.dayShift) : "")
              color: ink.tick; font.pixelSize: 10
            }
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------------------------------------ 3 rule
  Rectangle { x: 0; y: root.ruleY; width: root.w; height: 1; color: ink.ruleSoft }

  // ------------------------------------------------------------------------------------------------ 4 month header
  Item {
    id: monthHead
    x: 0; y: root.headerY; width: root.w; height: 34

    component NavButton: Item {
      id: nb
      property string glyph: "‹"
      signal clicked()
      width: 32; height: 28
      Rectangle {
        anchors.fill: parent; radius: 14
        color: Qt.rgba(root.tint.blood.r, root.tint.blood.g, root.tint.blood.b, nbMouse.containsMouse ? 0.22 : 0)
        Behavior on color { enabled: root.live && root.amp > 0; ColorAnimation { duration: 120 * root.amp } }
      }
      Txt { anchors.centerIn: parent; text: nb.glyph; color: root.tint.bone; font.pixelSize: 18 }
      MouseArea { id: nbMouse; anchors.fill: parent; hoverEnabled: true; onClicked: nb.clicked() }
    }

    NavButton { x: 0; anchors.verticalCenter: parent.verticalCenter; glyph: "‹"; onClicked: root.page(-1) }
    NavButton { x: root.w - 32; anchors.verticalCenter: parent.verticalCenter; glyph: "›"; onClicked: root.page(1) }

    Item {
      anchors.centerIn: parent
      width: titleRow.width; height: 28
      Row {
        id: titleRow
        anchors.centerIn: parent
        spacing: 0
        Txt {
          visible: !root.plateOn
          text: Model.MONTH_NAMES[root.gridM - 1] + "  "
          color: root.tint.bone; font.pixelSize: 17; font.letterSpacing: 2
        }
        Txt { text: String(root.plateOn ? root.plateY : root.gridY); color: root.plateOn ? root.tint.bone : ink.label; font.pixelSize: 17; font.letterSpacing: root.plateOn ? 2 : 0 }
      }
      MouseArea { anchors.fill: parent; onClicked: root.toggleYearPlate() }
    }
  }

  // ------------------------------------------------------------------------------------------------ 5-6 weekdays and grid
  Item {
    id: monthLayer
    x: 0; y: root.wdY; width: root.w; height: 264
    visible: opacity > 0.001
    opacity: root.gridLayerAlpha
    scale: root.gridLayerScale
    transformOrigin: Item.Center

    // weekday row
    Item {
      width: root.w; height: 24
      Txt { visible: root.weekNumbers; x: 0; width: root.gutter; height: 24; verticalAlignment: Text.AlignVCenter; horizontalAlignment: Text.AlignHCenter
        text: "wk"; color: ink.tick; font.pixelSize: 10 }
      Repeater {
        model: 7
        Txt {
          required property int index
          readonly property int wd: (root.weekStart + index) % 7
          x: root.gutter + index * root.cellW; width: root.cellW; height: 24
          horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter
          text: Model.DAY_SHORT[wd]; font.pixelSize: 11; font.letterSpacing: 1.5
          color: wd === 0 ? Qt.rgba(ink.fill.r, ink.fill.g, ink.fill.b, 0.85) : ink.label
        }
      }
    }

    Item {
      id: gridBox
      y: 24; width: root.w; height: 240
      clip: false

      // the kanji month, behind the cells; it crossfades during a turn and drifts a little with it
      Item {
        x: 0; y: 0; width: root.w; height: 240
        Txt {
          readonly property real fadeOut: root.turning ? 1 - root.turnMix : 1
          anchors { right: parent.right; bottom: parent.bottom; bottomMargin: 4 }
          x: root.turnAxis === "x" ? -root.turnDir * 12 * root.dist * root.turnMix : 0
          text: Model.kanjiMonth(root.turning ? root.fromM : root.shownM)
          font.family: "Noto Serif CJK JP"; font.weight: Font.Light; font.pixelSize: 132
          color: root.tint.bone; opacity: 0.06 * fadeOut
        }
        Txt {
          visible: root.turning
          anchors { right: parent.right; bottom: parent.bottom; bottomMargin: 4 }
          text: Model.kanjiMonth(root.shownM)
          font.family: "Noto Serif CJK JP"; font.weight: Font.Light; font.pixelSize: 132
          color: root.tint.bone; opacity: 0.06 * root.turnMix
          transform: Translate { x: root.turnAxis === "x" ? root.turnDir * 12 * root.dist * (1 - root.turnMix) : 0 }
        }
      }

      // the turning part: week numbers and cells
      Item {
        id: cells
        width: root.w; height: 240
        opacity: root.turnAlpha
        transform: Translate {
          x: root.turnAxis === "x" ? root.turnOffset * 26 * root.dist : 0
          y: root.turnAxis === "y" ? root.turnOffset * 18 * root.dist : 0
        }

        Repeater {
          model: root.weekNumbers ? 6 : 0
          Txt {
            required property int index
            x: 0; y: index * 40; width: root.gutter; height: 40
            horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter
            text: String(root.grid.weeks[index]); color: ink.tick; font.pixelSize: 10
          }
        }

        Repeater {
          model: 42
          Item {
            id: cell
            required property int index
            readonly property var c: root.grid.cells[index]
            readonly property bool today: c.key === root.todayKey
            readonly property bool picked: c.key === root.pickedKey && !today
            readonly property bool hovered: root.hoverIdx === index
            readonly property string holiday: c.inMonth ? Model.holidayFor(c, root.holidays) : ""
            readonly property bool accent: c.inMonth && (c.weekday === 0 || holiday !== "")
            x: root.gutter + c.col * root.cellW; y: c.row * 40
            width: root.cellW; height: 40

            Rectangle {
              anchors.centerIn: parent; anchors.verticalCenterOffset: 0
              width: 30; height: 30; radius: 15
              color: cell.picked ? Qt.rgba(root.tint.blood.r, root.tint.blood.g, root.tint.blood.b, 0.22)
                : Qt.rgba(root.tint.bone.r, root.tint.bone.g, root.tint.bone.b, cell.hovered ? 0.10 : 0)
              Behavior on color { enabled: root.live && root.amp > 0; ColorAnimation { duration: 120 * root.amp } }
            }
            ItoEnso {
              visible: cell.today
              anchors.centerIn: parent
              size: 32; strokeWidth: 1.8; color: ink.fill
              drawn: root.ensoDrawn
            }
            Txt {
              anchors.centerIn: parent
              text: String(cell.c.d); font.pixelSize: 14
              font.weight: cell.today ? Font.DemiBold : Font.Normal
              color: cell.today ? root.tint.bone
                : !cell.c.inMonth ? ink.tick
                : cell.accent ? ink.fill
                : Qt.rgba(root.tint.bone.r, root.tint.bone.g, root.tint.bone.b, 0.88)
            }
            Rectangle {
              visible: cell.holiday !== ""
              x: (parent.width - 4) / 2; y: parent.height / 2 + 13 - 2
              width: 4; height: 4; radius: 2; color: ink.fill
            }
            MouseArea {
              anchors.fill: parent; hoverEnabled: true
              onEntered: root.hoverIdx = cell.index
              onExited: if (root.hoverIdx === cell.index) root.hoverIdx = -1
              onClicked: root.clickDay(cell.c)
            }
          }
        }

        // the keyboard cursor: four corner brackets of a manga panel, never a box
        Item {
          id: cursor
          visible: root.cursorShown && !root.plateOn && root.cursorIdx >= 0 && root.cursorIdx < 42
          readonly property int ci: Math.max(0, Math.min(41, root.cursorIdx))
          x: root.gutter + (ci % 7) * root.cellW + (root.cellW - 40) / 2
          y: Math.floor(ci / 7) * 40 + 2
          width: 40; height: 36
          Behavior on x { enabled: root.live && root.amp > 0; NumberAnimation { duration: Motion.fast * root.amp; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.standard } }
          Behavior on y { enabled: root.live && root.amp > 0; NumberAnimation { duration: Motion.fast * root.amp; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.standard } }
          Repeater {
            model: 8
            Rectangle {
              required property int index
              readonly property int corner: Math.floor(index / 2)       // 0 tl, 1 tr, 2 bl, 3 br
              readonly property bool horiz: index % 2 === 0
              readonly property bool atRight: corner === 1 || corner === 3
              readonly property bool atBottom: corner >= 2
              width: horiz ? 6 : 1; height: horiz ? 1 : 6
              x: atRight ? cursor.width - width : 0
              y: atBottom ? cursor.height - height : 0
              color: ink.rule
            }
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------------------------------------ 7 year plate
  Item {
    id: plate
    x: 0; y: root.wdY; width: root.w; height: 264
    visible: opacity > 0.001
    opacity: root.plateLayerAlpha
    scale: root.plateLayerScale
    transformOrigin: Item.Center

    readonly property real pw: (root.w - 3 * 6) / 4
    readonly property real ph: (264 - 2 * 6) / 3
    Repeater {
      model: 12
      Item {
        id: pm
        required property int index
        readonly property int m: index + 1
        readonly property bool shownMonth: root.plateY === root.shownY && m === root.shownM
        readonly property bool currentMonth: root.plateY === root.todayCivil.y && m === root.todayCivil.m
        readonly property bool hot: root.hoverPlate === index || (root.cursorShown && root.plateOn && m === root.plateM)
        x: (index % 4) * (plate.pw + 6); y: Math.floor(index / 4) * (plate.ph + 6)
        width: plate.pw; height: plate.ph

        Rectangle {
          anchors.fill: parent
          color: "transparent"
          border.width: pm.shownMonth || pm.hot ? 1.5 : 1
          border.color: pm.hot ? ink.fill : (pm.shownMonth ? ink.rule : ink.ruleSoft)
          Behavior on border.color { enabled: root.live && root.amp > 0; ColorAnimation { duration: 120 * root.amp } }
        }
        Column {
          anchors.centerIn: parent
          spacing: 3
          Txt {
            anchors.horizontalCenter: parent.horizontalCenter
            text: Model.kanjiMonth(pm.m); font.family: "Noto Serif CJK JP"; font.pixelSize: 20
            color: Qt.rgba(root.tint.bone.r, root.tint.bone.g, root.tint.bone.b, 0.8)
          }
          Txt { anchors.horizontalCenter: parent.horizontalCenter; text: Model.MONTH_SHORT[pm.m - 1]; color: ink.label; font.pixelSize: 10 }
        }
        ItoEnso {
          visible: pm.currentMonth
          x: parent.width - 10 - 6; y: 6
          size: 10; strokeWidth: 1.2; color: ink.fill
          drawn: root.ensoDrawn
        }
        MouseArea {
          anchors.fill: parent; hoverEnabled: true
          onEntered: root.hoverPlate = pm.index
          onExited: if (root.hoverPlate === pm.index) root.hoverPlate = -1
          onClicked: root.openMonth(root.plateY, pm.m)
        }
      }
    }
  }

  // ------------------------------------------------------------------------------------------------ 8 footer
  Item {
    id: foot
    x: 0; y: root.footY; width: root.w; height: 26
    readonly property string holiday: Model.holidayFor(root.picked, root.holidays)
    readonly property int rel: Model.diffDays(root.todayCivil, root.picked)

    Row {
      anchors.verticalCenter: parent.verticalCenter
      spacing: 10
      Txt {
        id: fullDate
        text: Model.DAY_NAMES[Model.weekday(root.picked)] + " " + root.picked.d + " " + Model.MONTH_NAMES[root.picked.m - 1] + " " + root.picked.y
        color: ink.label; font.pixelSize: 11
      }
      Txt {
        visible: foot.holiday !== ""
        width: Math.min(implicitWidth, 160); elide: Text.ElideRight
        text: foot.holiday; color: ink.fill; font.pixelSize: 11
      }
      Txt { visible: foot.rel !== 0; text: Model.relativeDays(foot.rel); color: ink.tick; font.pixelSize: 11 }
    }
    Item {
      id: todayLink
      anchors { right: parent.right; verticalCenter: parent.verticalCenter }
      width: todayText.width + 12; height: parent.height
      Txt {
        id: todayText
        anchors.centerIn: parent
        text: "today"; font.pixelSize: 11; font.letterSpacing: 1
        color: todayMouse.containsMouse ? ink.fill : ink.label
        Behavior on color { enabled: root.live && root.amp > 0; ColorAnimation { duration: 120 * root.amp } }
      }
      MouseArea { id: todayMouse; anchors.fill: parent; hoverEnabled: true; onClicked: root.goToday() }
    }
  }
}
