import QtQuick
import QtQuick.Layouts
import ".." as Ito
import "../ItoWidgets.js" as Widgets
import "../ItoIcons.js" as Icons
import "../ItoTimeModel.js" as TimeModel
import "../ItoIconMap.js" as IconMap

// Icons: the bar's widgets laid out the way the bar is (left, centre, right), each with a switch to turn it on or
// off and arrows to move it, plus what each one shows.
ColumnLayout {
  id: page

  property var cc: null
  readonly property var pal: cc.pal
  readonly property var act: cc.actions
  readonly property color bone: pal.bone

  spacing: 10

  // ---------------------------------------------------------------- dragging a widget between the columns
  // The three columns, so a drag can tell which one the pointer is over; and where a drop would land, for the guide line.
  property var columns: ({})
  property string dragId: ""
  property string dragRegion: ""             // the column the dragged row belongs to (raised above its neighbours)
  property string dropRegion: ""
  property string dropBeforeId: ""           // the widget it would go in front of, "" for the end of the column
  property int dropIndex: 0

  function locate(sceneX, sceneY, movingId) {
    var names = ["left", "center", "right"], best = "", bestGap = 1e9
    for (var n = 0; n < names.length; n++) {
      var col = columns[names[n]]
      if (!col) continue
      var p = col.mapFromItem(null, sceneX, sceneY)
      var gap = p.x < 0 ? -p.x : (p.x > col.width ? p.x - col.width : 0)
      if (gap < bestGap) { bestGap = gap; best = names[n] }
    }
    if (best === "") return null
    var c = columns[best], q = c.mapFromItem(null, sceneX, sceneY), idx = 0, before = ""
    for (var i = 0; i < c.children.length; i++) {
      var r = c.children[i]
      if (r.wid === undefined || r.wid === movingId || !r.visible) continue
      if (r.y + r.height / 2 < q.y) idx++
      else if (before === "") before = r.wid
    }
    return { "region": best, "index": idx, "before": before }
  }

  function dragMoved(id, sx, sy) {
    var at = locate(sx, sy, id)
    if (!at) return
    dropRegion = at.region; dropBeforeId = at.before; dropIndex = at.index
  }

  function dragDone(id, sx, sy) {
    var at = locate(sx, sy, id)
    dragId = ""; dragRegion = ""; dropRegion = ""; dropBeforeId = ""
    if (at) page.act.moveWidgetTo(id, at.region, at.index)
  }

  readonly property var modeNames: ({ "both": "Icon + text", "icon": "Icon only", "text": "Text only" })

  // ---------------------------------------------------------------- T15 (S21): ICONS, one row per bar icon
  // Every icon of the bar, each with the drawings it comes in, shown at the size the bar draws them and in the theme's colours:
  // Original (the old inked drawing, exactly as it was), Ink (id manga), Relic (id gothic; with your shell asset sheet), Hollow (id sh; your sprites), or an
  // indicator's versions. The model is ItoIconMap.ROWS / options / selected / pick; every choice goes through the existing keys
  // (`iconStyleOverrides` family=current|manga|gothic, `icon:<name>`), and nothing is written until you pick.
  readonly property int iconPx: Math.max(16, Math.min(48, Math.round(Number(pal.get("barSize", 46)) * Number(pal.get("iconScale", 0.62)))))
  readonly property int iconWant: iconPx * Math.max(1, Screen.devicePixelRatio)
  readonly property bool iconFiles: typeof pal.userBar === "function"
  readonly property var iconHas: ({ gothic: iconFiles && pal.userBar("relic/sys/network-3.png", 28, "v9") !== null, sh: iconFiles && pal.userBar("hollow/eye-idle.png", 28, "v9") !== null, px: iconWant })
  readonly property var iconCtx: ({ style: String(pal.get("iconStyle", "current")), overrides: String(pal.get("iconStyleOverrides", "")),
                                    sh: function (n) { return typeof pal.shChoice === "function" && pal.shChoice(n) }, version: function (id) { return Icons.version(pal, id) } })
  function iconVersions(id) { return Icons.find(id).versions.filter(function (v) { return Icons.available(page.pal, v) }) }
  // the 12 s Undo of the two "for all" buttons (the presets' pattern): a snapshot of every key the chooser writes
  property var iconUndo: null
  Timer { id: iconUndoTimer; interval: 12000; onTriggered: { page.iconUndo = null; if (page.cc) page.cc.memo.iconsUndo = null } }
  Component.onCompleted: {
    var u = cc && cc.memo ? cc.memo.iconsUndo : null
    if (u && Date.now() - u.at < 12000) { iconUndo = u.snap; iconUndoTimer.interval = 12000 - (Date.now() - u.at); iconUndoTimer.start() }
  }
  function iconsAll(mode) {
    var keys = IconMap.chooserKeys(), snap = {}
    for (var i = 0; i < keys.length; i++) { var v = pal.get(keys[i], null); snap[keys[i]] = v === undefined ? null : v }
    iconUndo = snap
    cc.memo.iconsUndo = { snap: snap, at: Date.now() }
    iconUndoTimer.interval = 12000; iconUndoTimer.restart()
    act.setMany(IconMap.pickAll(mode, iconCtx, iconHas, function (id) { return Icons.find(id).versions[0].key }))
  }
  function iconsUndoNow() {
    if (!iconUndo) return
    var set = {}, unset = [], any = false
    for (var k in iconUndo) { if (iconUndo[k] === null) unset.push(k); else { set[k] = iconUndo[k]; any = true } }
    iconUndo = null; iconUndoTimer.stop(); cc.memo.iconsUndo = null
    if (any) act.setMany(set)
    if (unset.length > 0) act.unset(unset)
  }
  // the source picture of a card (empty: the card shows no ItoImage)
  function iconArt(row, key) {
    // a version drawn from your sprites (`user`) has no shipped picture: its card shows only your file (never a path that does not exist)
    if (row.versions) { var ve = key.indexOf("v:") === 0 ? Icons.entry(row.versions, key.slice(2)) : null
      return ve && !ve.user ? "indicators/" + row.versions + "-" + key.slice(2) + "-on.png" : "" }
    if (row.art === "ai") { var a = String(pal.get("aiStyle", "brain")); return "system/" + (a === "brain" ? "brain.png" : "ai-" + a + ".png") }
    if (row.art === "indicator") return "indicators/night-" + Icons.version(pal, "night") + "-on.png"
    if (key === "gothic" && row.gothicArt) return row.gothicArt
    if (key === "sh" && row.id !== "power") return ""
    return row.art || ""
  }

  CcSection {
    host: page.cc
    startOpen: true
    pal: page.pal
    label: "ICONS"
    note: "Choose the drawing of every icon on the bar, one by one. Each card shows it at the size your bar draws it, in your theme's colours. Original is the old inked drawing exactly as it was."

    RowLayout {
      Layout.fillWidth: true
      spacing: 8
      visible: page.cc.match("icons original ink relic manga gothic all undo")
      CcCard {
        Layout.preferredWidth: 160; Layout.preferredHeight: 30; radius: 15
        host: page.cc; pal: page.pal; showCaption: false
        hint: "Every icon back to its old inked drawing (and each indicator to its first version). Undo shows for a few seconds."
        onActivated: page.iconsAll("original")
        Text { anchors.centerIn: parent; text: "Use Original for all"; color: page.pal.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
      }
      CcCard {
        id: allStyleCard
        readonly property string mode: IconMap.allStyle(String(page.pal.get("iconStyle", "current")))
        Layout.preferredWidth: 160; Layout.preferredHeight: 30; radius: 15
        host: page.cc; pal: page.pal; showCaption: false
        hint: "Every icon that has a " + IconMap.STYLE_NAMES[mode] + " drawing takes it; the others keep the Original. Undo shows for a few seconds."
        onActivated: page.iconsAll(mode)
        Text { anchors.centerIn: parent; text: "Use " + IconMap.STYLE_NAMES[allStyleCard.mode] + " for all"; color: page.pal.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
      }
      CcCard {
        visible: page.iconUndo !== null
        Layout.preferredWidth: 110; Layout.preferredHeight: 30; radius: 15
        host: page.cc; pal: page.pal; showCaption: false
        hint: "Put back the icons you had before that button."
        onActivated: page.iconsUndoNow()
        Text { anchors.centerIn: parent; text: "Undo"; color: page.pal.lit; font.family: "Noto Serif"; font.pixelSize: 12 }
      }
    }

    Repeater {
      model: IconMap.ROWS

      RowLayout {
        id: iconRow
        required property var modelData
        readonly property var opts: IconMap.options(modelData, page.iconHas, modelData.versions ? page.iconVersions(modelData.versions) : [])
        readonly property string on: IconMap.selected(modelData, page.iconCtx)
        Layout.fillWidth: true
        spacing: 6
        visible: (opts.length > 1 || modelData.id !== "power") && page.cc.match("icons icon original ink relic hollow manga gothic " + modelData.name + " " + modelData.id)

        Text {
          Layout.preferredWidth: 104
          text: iconRow.modelData.name
          color: page.bone
          opacity: 0.85
          elide: Text.ElideRight
          font.family: "Noto Serif"
          font.pixelSize: 12
        }
        Repeater {
          model: iconRow.opts
          CcCard {
            id: iconCard
            required property var modelData
            readonly property var row: iconRow.modelData
            readonly property string key: modelData.key
            readonly property string style: key === "original" ? "current" : (key === "manga" || key === "gothic") ? key
              : IconMap.styleFor(page.iconCtx.style, page.iconCtx.overrides, "indicator")
            readonly property string art: page.iconArt(row, key)
            // the picture drawn from your files: a Hollow skin, or an indicator version made from your sprites
            readonly property var pick: key === "sh" ? (!page.iconFiles ? null : page.pal.userBar("hollow/" + row.shArt + ".png", page.iconWant, "v9"))
              : (row.versions && key.indexOf("v:") === 0) ? (Icons.userPick(page.pal, Icons.entry(row.versions, key.slice(2)), true, page.iconWant)
                || Icons.userPick(page.pal, Icons.entry(row.versions, key.slice(2)), true, 28)) : null
            Layout.preferredWidth: 92
            Layout.preferredHeight: page.iconPx + 36
            host: page.cc
            pal: page.pal
            caption: modelData.name
            captionSize: 11
            hint: row.name + ": " + modelData.name + (key === "original" || modelData.name === "Original" ? " (the old inked drawing)" : "")
            current: iconRow.on === key
            onActivated: page.act.setMany(IconMap.pick(row, key, page.iconCtx))

            Row {
              anchors.horizontalCenter: parent.horizontalCenter
              anchors.top: parent.top
              anchors.topMargin: 6
              spacing: 3
              Ito.ItoImage {
                visible: iconCard.art !== "" && !(iconCard.pick && iconCard.key !== "sh")
                width: visible ? page.iconPx : 0
                height: page.iconPx
                palette: page.pal
                skins: false
                iconStyle: iconCard.style
                iconOverrides: (iconCard.row.family || "indicator") + "=" + iconCard.style
                source: visible ? Qt.resolvedUrl("../ito-art/" + iconCard.art) : ""     // a hidden card loads nothing
                fillMode: Image.PreserveAspectFit
              }
              Image {
                readonly property bool on: !!iconCard.pick
                visible: on
                width: visible ? (iconCard.row.id === "power" ? Math.round(page.iconPx * 0.8) : page.iconPx) : 0
                height: visible ? width : page.iconPx
                anchors.verticalCenter: parent.verticalCenter
                source: on ? String(iconCard.pick.url) : ""
                sourceSize: on ? Qt.size(iconCard.pick.px, iconCard.pick.px) : Qt.size(0, 0)
                fillMode: Image.PreserveAspectFit
                smooth: true
                mipmap: true
                layer.enabled: visible && page.pal.tinted
                layer.smooth: true
                layer.effect: Ito.ItoThemeEffect { palette: page.pal }
              }
              Text {
                visible: iconCard.row.id === "clock"
                anchors.verticalCenter: parent.verticalCenter
                height: page.iconPx
                verticalAlignment: Text.AlignVCenter
                text: "10"
                color: page.bone
                font.family: "Noto Serif"
                font.pixelSize: Math.round(page.iconPx * 0.7)
              }
            }
          }
        }
        Item { Layout.fillWidth: true }
      }
    }
  }

  // ---------------------------------------------------------------- readings
  CcSection {
    host: page.cc
    startOpen: true
    pal: page.pal
    label: "READINGS"
    note: "How a number beside an icon reads, everywhere at once."


    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: [
          { "key": "percent", "label": "42%",     "name": "Percent", "note": "How full or how loud, as a percentage: RAM 42%." },
          { "key": "amount",  "label": "17/32G",  "name": "Amount",  "note": "What is really in use out of the total: memory 17/32G, disk 210/930G. Loudness, load and the rest stay a percentage." },
          { "key": "number",  "label": "42",      "name": "Number",  "note": "The bare number, no unit." },
          { "key": "off",     "label": "—",       "name": "Off",     "note": "Icons only. No numbers on the bar." }
        ]

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredHeight: 62
          Layout.preferredWidth: 1
          host: page.cc
          pal: page.pal
          caption: modelData.name
          hint: modelData.note
          current: String(page.pal.get("valueStyle", "percent")) === modelData.key
          visible: page.cc.match(modelData.name + " " + modelData.note + " readings")
          onActivated: page.act.set("valueStyle", modelData.key)

          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 8
            text: modelData.label
            color: parent.current ? page.pal.lit : page.bone
            opacity: parent.current ? 1 : 0.75
            font.family: "Noto Serif"
            font.weight: Font.DemiBold
            font.pixelSize: 17
          }
        }
      }
    }


    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      label: "Name each reading (CPU 42%, RAM 17/32G)"
      hint: "Puts a small label before the number so you always know what it measures, the way Shibumi does. Horizontal bars only."
      on: page.pal.get("valueLabels", true) !== false
      onActivated: page.act.set("valueLabels", on ? "false" : "true")
    }


    CcMeter { host: page.cc; pal: page.pal; actions: page.act
      label: "Icon size"; key: "iconScale"; fallback: 0.62; lo: 0.5; hi: 0.8
      hint: "The one size every icon on the bar shares, as a share of the bar's height." }


    // ---------------------------------------------------------------- popups
    CcMeter { host: page.cc; pal: page.pal; actions: page.act; percent: false; unit: " s"; zeroLabel: "Never"
      label: "Close popups after"; key: "popupSeconds"; fallback: 3; lo: 0; hi: 15
      hint: "A widget's popup (calendar, volume, network...) closes by itself this many seconds after the pointer leaves it. Never keeps it open until you click again." }
  }


  // ---------------------------------------------------------------- clock and calendar
  // Every option is a sidecar key (bin/ito-config); the defaults are the plain HH:mm and a Monday-start calendar.
  CcSection {
    host: page.cc
    startOpen: false
    pal: page.pal
    label: "CLOCK & CALENDAR"
    note: "What the clock shows on the bar, and how the calendar it opens is laid out."

    // a row of equal cards, one per choice, for a key that takes one of a few words (or a true/false pair)
    component ChoiceRow: RowLayout {
      id: choice
      property string optKey: ""
      property var fallback: ""
      property var opts: []
      property string terms: ""
      Layout.fillWidth: true
      spacing: 8
      visible: page.cc.match(terms)

      Repeater {
        model: choice.opts

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredHeight: 62
          Layout.preferredWidth: 1
          host: page.cc
          pal: page.pal
          caption: modelData.name
          hint: modelData.note
          current: String(page.pal.get(choice.optKey, choice.fallback)) === modelData.value
          onActivated: page.act.set(choice.optKey, modelData.value)

          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 8
            text: modelData.label
            color: parent.current ? page.pal.lit : page.bone
            opacity: parent.current ? 1 : 0.75
            font.family: "Noto Serif CJK JP"
            font.weight: Font.DemiBold
            font.pixelSize: 15
          }
        }
      }
    }

    ChoiceRow {
      optKey: "clockHour12"; fallback: "false"
      terms: "clock hours 12 24 hour am pm clock calendar"
      opts: [
        { "value": "false", "label": "23:07", "name": "24 hour", "note": "The clock reads 00 to 23." },
        { "value": "true", "label": "11:07 pm", "name": "12 hour", "note": "The clock reads 1 to 12 with am or pm." }
      ]
    }

    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      visible: page.cc.match("seconds on the bar clock calendar")
      label: "Seconds on the bar"
      hint: "Adds the seconds beside the time. The bar repaints every second while this is on."
      on: page.pal.get("clockSeconds", false) === true
      onActivated: page.act.set("clockSeconds", on ? "false" : "true")
    }

    ChoiceRow {
      optKey: "clockDate"; fallback: "off"
      terms: "date beside the time day weekday clock calendar"
      opts: [
        { "value": "off", "label": "—", "name": "No date", "note": "The time alone." },
        { "value": "day", "label": "2", "name": "Day", "note": "The day of the month beside the time." },
        { "value": "weekday", "label": "fri 2", "name": "Weekday and day", "note": "The weekday and the day of the month beside the time." }
      ]
    }

    ChoiceRow {
      optKey: "clockNumerals"; fallback: "western"
      terms: "numerals digits kanji western clock calendar"
      opts: [
        { "value": "western", "label": "23:07", "name": "Western", "note": "Ordinary digits." },
        { "value": "kanji", "label": "二三:〇七", "name": "Kanji", "note": "The digits as kanji numerals, set full width." }
      ]
    }

    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      visible: page.cc.match("moon phase beside the time clock calendar")
      label: "Moon phase beside the time"
      hint: "A small moon, lit as the real one is tonight."
      on: page.pal.get("clockMoon", false) === true
      onActivated: page.act.set("clockMoon", on ? "false" : "true")
    }

    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      visible: page.cc.match("spiral tick clock calendar")
      label: "Spiral tick"
      hint: "A small spiral that steps once a second. It stays still when Motion is off."
      on: page.pal.get("clockTick", false) === true
      onActivated: page.act.set("clockTick", on ? "false" : "true")
    }

    ChoiceRow {
      optKey: "calendarWeekStart"; fallback: "locale"
      terms: "week starts on monday sunday saturday locale calendar"
      opts: [
        { "value": "locale", "label": "Auto", "name": "Locale", "note": "The week starts the way your locale says." },
        { "value": "monday", "label": "Mo", "name": "Monday", "note": "The week starts on Monday." },
        { "value": "sunday", "label": "Su", "name": "Sunday", "note": "The week starts on Sunday." },
        { "value": "saturday", "label": "Sa", "name": "Saturday", "note": "The week starts on Saturday." }
      ]
    }

    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      visible: page.cc.match("iso week numbers calendar")
      label: "ISO week numbers"
      hint: "A narrow column with the ISO week of each row."
      on: page.pal.get("calendarWeekNumbers", true) !== false
      onActivated: page.act.set("calendarWeekNumbers", on ? "false" : "true")
    }

    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      visible: page.cc.match("holidays from ito-holidays.txt calendar")
      label: "Holidays from ~/.config/omarchy/ito-holidays.txt"
      hint: "One per line, # for comments: 2026-12-08 Founders' day (one date) or 12-25 Christmas (every year). Read only while the calendar is open."
      on: page.pal.get("calendarHolidays", true) !== false
      onActivated: page.act.set("calendarHolidays", on ? "false" : "true")
    }

    // up to three extra clocks in the calendar: Label=Region/City, separated by commas
    ColumnLayout {
      id: zonesBox
      Layout.fillWidth: true
      spacing: 4
      visible: page.cc.match("time zones world clocks calendar zones")
      readonly property var parsed: TimeModel.parseZones(String(page.pal.get("calendarZones", "")))

      Text {
        text: "Extra time zones (up to 3)"
        color: page.bone
        opacity: 0.75
        font.family: "Noto Serif"
        font.pixelSize: 12
      }

      Rectangle {
        Layout.fillWidth: true
        Layout.preferredHeight: 34
        radius: 10
        color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.05)
        border.width: 1
        border.color: zonesInput.activeFocus ? page.pal.blood : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.2)

        TextInput {
          id: zonesInput
          anchors.fill: parent
          anchors.margins: 9
          verticalAlignment: TextInput.AlignVCenter
          clip: true
          color: page.bone
          selectionColor: page.pal.blood
          font.family: "Noto Serif"
          font.pixelSize: 13
          text: String(page.pal.get("calendarZones", ""))
          maximumLength: 120
          onAccepted: page.act.set("calendarZones", text.trim())
          onActiveFocusChanged: if (activeFocus) page.cc.grabKeys = true
        }
        Text {
          anchors.fill: zonesInput
          verticalAlignment: Text.AlignVCenter
          visible: zonesInput.text === "" && !zonesInput.activeFocus
          text: "Tokyo=Asia/Tokyo, NYC=America/New_York"
          color: page.bone
          opacity: 0.35
          font.family: "Noto Serif"
          font.pixelSize: 13
          elide: Text.ElideRight
        }
      }

      Text {
        Layout.fillWidth: true
        text: "Press Enter to apply. Names are Region/City from the system time zone database."
        color: page.bone
        opacity: 0.45
        font.family: "Noto Serif"
        font.pixelSize: 11
        wrapMode: Text.Wrap
      }

      // entries the model refuses are listed struck through, so a typo is visible and nothing is run for it
      Repeater {
        model: zonesBox.parsed.filter(function(z) { return !z.ok })
        Text {
          required property var modelData
          text: modelData.zone
          color: page.bone
          opacity: 0.5
          font.family: "Noto Serif"
          font.pixelSize: 11
          font.strikeout: true
        }
      }
    }
  }


  CcSection {
    startOpen: true
    host: page.cc
    Layout.topMargin: 6
    pal: page.pal
    label: "YOUR BAR"
    note: "Three columns, the way the bar is laid out: left, centre, right; top to bottom is the order along the bar. Drag a widget by its grip to any place in any column, or use the arrows. The switch turns a widget on or off (it keeps its place)."


    RowLayout {
      Layout.fillWidth: true
      spacing: 10

      Repeater {
        model: [
          { "region": "left",   "title": "LEFT" },
          { "region": "center", "title": "CENTRE" },
          { "region": "right",  "title": "RIGHT" }
        ]

        ColumnLayout {
          id: col
          required property var modelData
          readonly property var ids: page.act.widgetsIn(modelData.region)
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.alignment: Qt.AlignTop
          spacing: 6
          z: page.dragRegion === modelData.region ? 50 : 0
          Component.onCompleted: page.columns[modelData.region] = col

          Text {
            text: col.modelData.title
            color: page.bone
            opacity: 0.7
            font.family: "Noto Serif"
            font.pixelSize: 10
            font.letterSpacing: 3
          }

          Repeater {
            model: col.ids
            BarRow {
              required property string modelData
              required property int index
              wid: modelData
              region: col.modelData.region
              position: index
              count: col.ids.length
            }
          }

          Text {
            visible: col.ids.length === 0
            text: page.dragId !== "" && page.dropRegion === col.modelData.region ? "Drop it here." : "Nothing here. Drag a widget in, or use ◀ ▶ on one."
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
            color: page.bone
            opacity: 0.4
            font.family: "Noto Serif"
            font.pixelSize: 11
          }
        }
      }
    }


    // widgets that are in no column at all (removed from the layout): one click puts them on the right
    ColumnLayout {
      id: unplaced
      Layout.fillWidth: true
      spacing: 6
      readonly property var ids: {
        var out = []
        for (var i = 0; i < Widgets.widgets.length; i++)
          if (page.act.regionOf(Widgets.widgets[i].id) === "") out.push(Widgets.widgets[i].id)
        return out
      }
      visible: ids.length > 0

      CcSection {
        host: page.cc
        startOpen: true
        pal: page.pal
        label: "NOT ON THE BAR"
        note: "Click one to add it to the right side; move it from there."

          Flow {
          Layout.fillWidth: true
          spacing: 8
          Repeater {
            model: unplaced.ids
            CcCard {
              required property string modelData
              width: 150
              height: 34
              radius: 17
              host: page.cc
              pal: page.pal
              showCaption: false
              hint: "Add this widget to the right side of the bar."
              onActivated: page.act.addPlugin(modelData, "right")
              Text {
                anchors.centerIn: parent
                text: "+ " + (page.widgetInfo(modelData) ? page.widgetInfo(modelData).name : modelData)
                color: page.bone
                font.family: "Noto Serif"
                font.pixelSize: 12
              }
            }
          }
        }
      }
    }
  }


  // ---------------------------------------------------------------- the network drawing
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "NETWORK ICON"
    note: "What the bar draws for the connection. Auto shows what is real: the port on a cable, the signal arcs on Wi-Fi."


    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: [
          { "key": "auto",  "name": "Auto",        "note": "The port when you are on a cable, the signal arcs when you are on Wi-Fi." },
          { "key": "wifi",  "name": "Wi-Fi arcs",  "note": "Always the signal arcs, even on a cable (drawn at full strength)." },
          { "key": "cable", "name": "Cable port",  "note": "Always the port, even on Wi-Fi." }
        ]

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.preferredHeight: 84
          host: page.cc
          pal: page.pal
          caption: modelData.name
          hint: modelData.note
          current: String(page.pal.get("netIcon", "auto")) === modelData.key
          onActivated: page.act.set("netIcon", modelData.key)

          Ito.ItoImage {
            palette: page.pal
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 10
            width: 40
            height: 40
            source: Qt.resolvedUrl("../ito-art/instruments/" + (modelData.key === "cable" ? "net-wired.png" : "net-3.png"))
            fillMode: Image.PreserveAspectFit
            smooth: true
            mipmap: true
            opacity: parent.current ? 1 : 0.8
          }
        }
      }
    }
  }


  // ---------------------------------------------------------------- the drawing of the icons (icons-v3.md)
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "ICON DRAWING"
    note: "The style every icon follows until you choose it in ICONS at the top of this page. Current: the sheet's inked PNGs (Relic, when you made it: your shell asset sheet). Ink: the same objects drawn as realistic gekiga engravings in the theme's colours. Your own PNG overrides only show with Current."

    GridLayout {
      Layout.fillWidth: true
      columns: 2
      columnSpacing: 8
      visible: page.cc.match("icon drawing style ink relic manga current")

      Repeater {
        model: [
          { "key": "current", "name": "Current", "note": "The inked PNG sheet, as it always was." },
          { "key": "manga",   "name": "Ink",   "note": "A hard drive with a spiral groove and a bony finger, a chip with an engraved spiral, eyes in the memory, a cell of blood, iron wifi bands, a bronze bell with an eye. Rendered in the theme's colours." },
          { "key": "gothic",  "name": "Relic",  "user": true, "note": "Your shell asset sheet: wifi arcs, a chip with a red die, a battery of blood cells, a speaker, a rune, a moon, a screen, a tray. Crisp from 24 px; gpu and ai need 32 and 30 px and keep the current drawing below that." }
        ].filter(function (m) { return !m.user || page.pal.userBar("relic/sys/network-3.png", 28, "v9") !== null })

        CcCard {
          id: styleCard
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.preferredHeight: 96
          host: page.cc
          pal: page.pal
          caption: modelData.name
          hint: modelData.note
          current: String(page.pal.get("iconStyle", "current")) === modelData.key
          onActivated: modelData.key === "current" ? page.act.unset(["iconStyle"]) : page.act.set("iconStyle", modelData.key)

          Row {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 10
            spacing: 10
            Repeater {
              model: ["system/disk.png", "system/cpu.png", "instruments/bat-2.png", "notifications/notification.png"]
              Ito.ItoImage {
                required property string modelData
                palette: page.pal
                iconStyle: styleCard.modelData.key
                iconOverrides: "*"
                width: 44
                height: 44
                source: Qt.resolvedUrl("../ito-art/" + modelData)
                fillMode: Image.PreserveAspectFit
                smooth: true
                mipmap: true
              }
            }
          }
        }
      }
    }

    // how the manga icons are inked (sidecar key `iconTone`, icons-v6-tone.md): Theme (the default) draws them transparent and tinted by the theme,
    // nothing dark behind them; Ink is the earlier look (heavy, an opaque dark in every cut-out). It only has an effect on the manga icons.
    GridLayout {
      Layout.fillWidth: true
      Layout.topMargin: 6
      columns: 2
      columnSpacing: 8
      visible: page.cc.match("icon tone theme ink transparent heavy manga")

      Repeater {
        model: [
          { "key": "theme", "name": "Tone: Theme (transparent)", "note": "The Ink icons take the theme's colours and nothing dark is painted behind them: they sit on any bar style." },
          { "key": "ink",   "name": "Tone: Heavy",               "note": "The earlier Ink-style look: heavy, with an opaque dark in every cut-out." }
        ]
        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.preferredHeight: 44
          host: page.cc
          pal: page.pal
          caption: modelData.name
          captionSize: 11
          hint: modelData.note
          current: String(page.pal.get("iconTone", "theme")) === modelData.key
          onActivated: modelData.key === "theme" ? page.act.unset(["iconTone"]) : page.act.set("iconTone", modelData.key)
        }
      }
    }

    // S17e: the Hollow pack (key `shPack`, off by default), listed only when the sprite recipe made its files
    CcToggle {
      Layout.fillWidth: true
      Layout.topMargin: 6
      visible: page.pal.userBar("hollow/eye-idle.png", 28, "v9") !== null && page.cc.match("icon drawing hollow pack sprite eye moth spiral pyramid")
      host: page.cc
      pal: page.pal
      label: "Hollow pack (your sprite sheet)"
      hint: "Skins from your SHASSETS sprites: a red spiral beside the clock, the eye for notifications (it bleeds when something waits, shuts for do not disturb), the moth for the night light, and the pyramid beside the battery when it runs low. The values never move or hide. Off = today's icons. In ICONS at the top of this page you pick the Original or the Silent Hill picture for each icon on its own."
      on: page.pal.get("shPack", false) === true
      onActivated: on ? page.act.unset(["shPack"]) : page.act.set("shPack", "true")
    }
  }


  // ---------------------------------------------------------------- the AI usage drawing
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "AI USAGE ICON"
    note: "What the quota fills as it is spent. Shown here half full."


    GridLayout {
      Layout.fillWidth: true
      columns: 6
      rowSpacing: 8
      columnSpacing: 8

      Repeater {
        model: [
          { "key": "brain",       "name": "Brain",       "note": "The engraved brain seen from the side." },
          { "key": "classic",     "name": "Classic",     "note": "Today's brain, redrawn: the spiral, the cracks, the quota as blood." },
          { "key": "hemispheres", "name": "Hemispheres", "note": "The brain from above, both halves with their folds." },
          { "key": "neurons",     "name": "Neurons",     "note": "A small net of cells joined by fibres." },
          { "key": "eye",         "name": "Eye",         "note": "Her eye; the white of it floods with blood." },
          { "key": "spiral",      "name": "Spiral",      "note": "The spiral, filling like a glass." }
        ]

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.preferredHeight: 108
          host: page.cc
          pal: page.pal
          caption: modelData.name
          hint: modelData.note
          current: String(page.pal.get("aiStyle", "brain")) === modelData.key
          visible: page.cc.match(modelData.name + " " + modelData.note + " ai usage icon")
          onActivated: page.act.set("aiStyle", modelData.key)

          Ito.ItoFillArt {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 8
            size: 62
            value: 0.55
            palette: page.pal
            art: Qt.resolvedUrl("../ito-art/system/" + (modelData.key === "brain" ? "brain.png" : "ai-" + modelData.key + ".png"))
            inside: Qt.resolvedUrl("../ito-art/system/" + (modelData.key === "brain" ? "brain-fill.png" : "ai-" + modelData.key + "-fill.png"))
          }
        }
      }
    }
  }


  // ---------------------------------------------------------------- your bar
  function widgetInfo(id) {
    for (var i = 0; i < Widgets.widgets.length; i++) if (Widgets.widgets[i].id === id) return Widgets.widgets[i]
    return null
  }

  // A small square button: an arrow that moves a widget, or says why it cannot.
  component Nudge: Rectangle {
    id: nudge
    property string glyph: ""
    property string tip: ""
    property bool usable: true
    signal tapped()
    width: 22
    height: 24
    radius: 7
    color: nh.hovered && usable ? Qt.rgba(page.pal.blood.r, page.pal.blood.g, page.pal.blood.b, 0.3) : "transparent"
    opacity: usable ? 1 : 0.22
    Text { anchors.centerIn: parent; text: nudge.glyph; color: page.bone; font.pixelSize: 13 }
    HoverHandler {
      id: nh
      cursorShape: nudge.usable ? Qt.PointingHandCursor : Qt.ArrowCursor
      onHoveredChanged: page.cc.hint = hovered ? nudge.tip : ""
    }
    TapHandler { enabled: nudge.usable; onTapped: nudge.tapped() }
  }

  // One widget on the bar: its switch, its name and what it shows, and the arrows that move it.
  component BarRow: Rectangle {
    id: row
    required property string wid
    required property string region
    required property int position
    required property int count
    readonly property var info: page.widgetInfo(wid)
    readonly property bool on: page.act.widgetOn(wid)
    readonly property string mode: page.act.contentOf(wid)
    readonly property bool canMode: info && info.reading === true
    readonly property bool locked: info && info.locked === true

    // being dragged: it follows the pointer (it keeps its place in the list until it is dropped)
    property real dragX: 0
    property real dragY: 0
    readonly property bool dragging: page.dragId === wid
    z: dragging ? 100 : 0
    transform: Translate { x: row.dragX; y: row.dragY }
    // where a drop would land: a line above this row, or below it if it is the last of the column
    readonly property bool guideAbove: page.dragId !== "" && !dragging && page.dropRegion === region && page.dropBeforeId === wid
    readonly property bool guideBelow: page.dragId !== "" && !dragging && page.dropRegion === region && page.dropBeforeId === ""
                                       && position === count - 1

    Layout.fillWidth: true
    Layout.preferredHeight: 66
    radius: 12
    visible: !!info && page.cc.match(info.name + " " + info.note + " widget")
    color: dragging ? Qt.rgba(page.pal.ink.r * 0.85 + page.bone.r * 0.15, page.pal.ink.g * 0.85 + page.bone.g * 0.15, page.pal.ink.b * 0.85 + page.bone.b * 0.15, 0.98)
         : (rowHover.hovered ? Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.07) : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.03))
    opacity: 1
    border.width: 1
    border.color: dragging ? page.pal.lit : on ? Qt.rgba(page.pal.blood.r, page.pal.blood.g, page.pal.blood.b, 0.4) : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.1)

    HoverHandler {
      id: rowHover
      onHoveredChanged: page.cc.hint = hovered && row.info ? row.info.note : ""
    }

    // the guide line for a drop
    Rectangle {
      visible: row.guideAbove || row.guideBelow
      x: 6; width: parent.width - 12; height: 3; radius: 1.5
      y: row.guideAbove ? -5 : parent.height + 2
      color: page.pal.blood
    }

    // the grip: hold it and drag the widget to any place in any column
    Item {
      id: grip
      x: 2; width: 18; height: parent.height
      visible: !row.locked
      Text {
        anchors.centerIn: parent
        text: "⋮⋮"
        rotation: 0
        color: page.bone
        opacity: gripHover.hovered || row.dragging ? 0.9 : 0.35
        font.pixelSize: 15
      }
      HoverHandler {
        id: gripHover
        cursorShape: row.dragging ? Qt.ClosedHandCursor : Qt.OpenHandCursor
        onHoveredChanged: page.cc.hint = hovered ? "Hold and drag to move this widget anywhere on the bar." : ""
      }
      // follow the pointer while the drag lasts: how far it is from where it was pressed, and where a drop would land
      // (read on a short timer: the handler's own change signals arrived too rarely to move the row smoothly)
      Timer {
        running: dragger.active
        interval: 16
        repeat: true
        onTriggered: {
          var c = dragger.centroid
          row.dragX = c.scenePosition.x - c.scenePressPosition.x
          row.dragY = c.scenePosition.y - c.scenePressPosition.y
          page.dragMoved(row.wid, c.scenePosition.x, c.scenePosition.y)
        }
      }
      DragHandler {
        id: dragger
        target: null
        cursorShape: Qt.ClosedHandCursor
        onActiveChanged: {
          if (active) { page.dragId = row.wid; page.dragRegion = row.region }
          else { row.dragX = 0; row.dragY = 0; page.dragDone(row.wid, centroid.scenePosition.x, centroid.scenePosition.y) }
        }
      }
    }

    // the switch: a track with a knob, blood when the widget is on
    Rectangle {
      id: track
      x: 24
      y: 11
      width: 34
      height: 18
      radius: 9
      visible: !row.locked
      color: row.on ? page.pal.blood : "transparent"
      border.width: 1
      border.color: row.on ? page.pal.blood : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.45)
      Behavior on color { ColorAnimation { duration: 120 } }
      Rectangle {
        y: 3
        x: row.on ? parent.width - width - 3 : 3
        width: 12
        height: 12
        radius: 6
        color: row.on ? page.bone : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.6)
        Behavior on x { NumberAnimation { duration: 120; easing.type: Easing.OutCubic } }
      }
      HoverHandler {
        cursorShape: Qt.PointingHandCursor
        onHoveredChanged: page.cc.hint = hovered ? (row.on ? "Switch this widget off. It keeps its place." : "Switch this widget on.") : ""
      }
      TapHandler { onTapped: page.act.setWidget(row.wid, !row.on) }
    }
    Text {
      x: 24
      y: 9
      width: 34
      visible: row.locked
      horizontalAlignment: Text.AlignHCenter
      text: "•"
      color: page.pal.blood
      font.pixelSize: 16
    }

    // line one: the whole name, with all the room there is
    Text {
      x: 68
      y: 9
      width: parent.width - 76
      elide: Text.ElideRight
      text: row.info ? row.info.name : row.wid
      color: page.bone
      opacity: row.on ? 1 : 0.55
      font.family: "Noto Serif"
      font.pixelSize: 13
      font.weight: Font.DemiBold
    }
    // line two, on the left: what it shows (a plain link-like chip for the widgets that have a reading)
    Text {
      x: 24
      y: 40
      width: parent.width - arrows.width - 34
      elide: Text.ElideRight
      text: row.locked ? "Always on" : (row.canMode && row.on ? page.modeNames[row.mode] + "  ↻" : (row.on ? "On" : "Off"))
      color: row.canMode && row.on && !row.locked ? page.pal.lit : page.bone
      opacity: row.canMode && row.on && !row.locked ? 0.95 : 0.45
      font.family: "Noto Serif"
      font.pixelSize: 10
      MouseArea {
        anchors.fill: parent
        enabled: row.canMode && row.on && !row.locked
        cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
        hoverEnabled: true
        onEntered: page.cc.hint = "Click to change what it shows: icon and number, icon only, or number only."
        onExited: page.cc.hint = ""
        onClicked: page.act.cycleContent(row.wid)
      }
    }

    Row {
      id: arrows
      anchors.bottom: parent.bottom
      anchors.bottomMargin: 6
      anchors.right: parent.right
      anchors.rightMargin: 6
      spacing: 0
      Nudge { glyph: "◀"; usable: row.region !== "left" && !row.locked
              tip: row.region === "right" ? "Move to the centre of the bar." : "Move to the left side of the bar."
              onTapped: page.act.sendWidget(row.wid, row.region === "right" ? "center" : "left") }
      Nudge { glyph: "▲"; usable: row.position > 0 && !row.locked; tip: "Move it one place earlier."
              onTapped: page.act.nudgeWidget(row.wid, -1) }
      Nudge { glyph: "▼"; usable: row.position < row.count - 1 && !row.locked; tip: "Move it one place later."
              onTapped: page.act.nudgeWidget(row.wid, 1) }
      Nudge { glyph: "▶"; usable: row.region !== "right" && !row.locked
              tip: row.region === "left" ? "Move to the centre of the bar." : "Move to the right side of the bar."
              onTapped: page.act.sendWidget(row.wid, row.region === "left" ? "center" : "right") }
    }
  }
}
