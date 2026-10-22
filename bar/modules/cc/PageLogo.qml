import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import ".." as Ito
import "../ItoMarks.js" as Marks

// Logo: the two marks that stand for the shell, the seal in the middle of the bar and the button that opens
// the menu. Both come from the works this is made from, and each says what it is.
ColumnLayout {
  id: page

  property var cc: null
  readonly property var pal: cc.pal
  readonly property var act: cc.actions
  readonly property color bone: pal.bone
  readonly property url art: Qt.resolvedUrl("../ito-art/")

  spacing: 10

  Text {
    visible: page.pickError !== ""
    Layout.fillWidth: true
    wrapMode: Text.WordWrap
    text: page.pickError
    color: page.pal.blood
    font.family: "Noto Serif"
    font.pixelSize: 12
  }

  readonly property string sealLitKey: String(pal.get("sealLit", "auto"))
  // the letter seals and the shipped art seal, then the user-backed art seals whose mark file exists
  readonly property var seals: Marks.seals.filter(function (m) { return !m.user || pal.userMarkNames.indexOf(m.user) >= 0 })
  // the built-in marks, then the user's own (marks/<name>.png of the assets folder, bin/ito-assets), shown as `user:<name>`
  readonly property var marks: Marks.menuMarks.filter(function (m) { return !m.user || pal.userMarkNames.indexOf(m.user) >= 0 }).concat(pal.userMarks)
  readonly property string home: Quickshell.env("HOME")
  readonly property string markKey: Marks.resolve(String(pal.get("menuMark", "spiral")), pal.userMarkNames)

  // Logo size (S15, S2d): seven steps = seven tiers (every mark has exact pixels at each) of the exact-pixel marks, in px for the current bar. The key is markScale (fraction of the bar):
  // a step writes round(px / barSize, 3); the chosen step is the tier nearest to round(barSize * markScale). Reset = unset (default 0.65).
  readonly property int logoBar: Math.max(38, Math.min(58, Math.round(Number(pal.get("barSize", 46)) || 46)))
  readonly property var logoSteps: [{ label: "Small", px: 24 }, { label: "Default", px: 26 }, { label: "Medium", px: 28 }, { label: "Large", px: 32 }, { label: "XL", px: 36 }, { label: "XXL", px: 40 }, { label: "Max", px: 44 }]
  readonly property int logoPx: Math.round(page.logoBar * Math.max(0.2, Math.min(1.2, Number(pal.get("markScale", 0.65)) || 0.65)))
  readonly property int logoStep: {
    var best = 0
    for (var i = 1; i < page.logoSteps.length; i++)
      if (Math.abs(page.logoSteps[i].px - page.logoPx) < Math.abs(page.logoSteps[best].px - page.logoPx)) best = i
    return best
  }

  // Pictures the user added (bin/ito-marks). Listing adapts any new one, so dropping a file in the folder
  // and pressing Refresh is all it takes.
  property var custom: []
  // A picker prints {"error": "..."} when it refuses a file (too heavy, not a picture); an empty answer means the dialog
  // was cancelled. Returns true only when a picture really was taken.
  property string pickError: ""
  function pickOk(reply) {
    var t = String(reply).trim()
    if (t === "") return false
    try {
      var r = JSON.parse(t)
      if (r.error) { page.pickError = r.error; return false }
    } catch (e) {}
    page.pickError = ""
    return true
  }
  readonly property string marksTool: Qt.resolvedUrl("../bin/ito-marks").toString().replace("file://", "")

  Process {
    id: lister
    command: [page.marksTool, "list"]
    stdout: StdioCollector {
      onStreamFinished: {
        try { page.custom = JSON.parse(text) } catch (e) { page.custom = [] }
      }
    }
  }
  // Choosing a picture opens a file dialog; when it is done the list is read again, so the new mark appears.
  Process {
    id: picker
    command: [page.marksTool, "pick"]
    stdout: StdioCollector {
      onStreamFinished: {
        if (!page.pickOk(text)) return
        lister.running = true
        try { var r = JSON.parse(text); if (r.key) page.act.set("menuMark", r.key) } catch (e) {}
      }
    }
  }

  // Your own picture for the seal's letters, or for what stands beside the seal: a file dialog, and if one was chosen
  // it is used at once.
  Process {
    id: sealPicker
    command: [page.marksTool, "pick", "--as", "_seal"]
    stdout: StdioCollector { onStreamFinished: if (page.pickOk(text)) page.act.set("seal", "custom") }
  }
  Process {
    id: decoPicker
    command: [page.marksTool, "pick", "--as", "_deco"]
    stdout: StdioCollector { onStreamFinished: if (page.pickOk(text)) page.act.set("sealDeco", "custom") }
  }

  // A small pill button: choosing a picture from the files.
  component PickButton: CcCard {
    id: pickRoot
    property string label: ""
    Layout.preferredWidth: 190
    Layout.preferredHeight: 30
    radius: 15
    host: page.cc
    pal: page.pal
    showCaption: false

    Text {
      anchors.centerIn: parent
      // A direct id, not `parent.label`: the scene-graph parent isn't guaranteed attached the moment this
      // binding first evaluates, which was logging "Unable to assign [undefined]" once per load.
      text: pickRoot.label
      color: page.bone
      font.family: "Noto Serif"
      font.pixelSize: 11
    }
  }

  Component.onCompleted: lister.running = true

  // ---------------------------------------------------------------- seal
  CcSection {
    host: page.cc
    startOpen: true
    pal: page.pal
    label: "SEAL"
    note: {
      for (var i = 0; i < page.seals.length; i++)
        if (page.seals[i].key === String(page.pal.get("seal", "tomie"))) return page.seals[i].note
      return ""
    }


    // A responsive grid (same rules as the menu mark picker below): fixed-aspect cards sized from the real width, 4 to 6 columns,
    // rows wrap, names wrap to two lines and are never cut. 19 cards do not fit one row.
    Item {
      id: sealGrid
      Layout.fillWidth: true
      Layout.preferredHeight: implicitHeight
      readonly property int gap: 8
      readonly property var shown: page.seals.filter(function (m) { return page.cc.match(m.name + " " + m.note + " seal logo") })
      readonly property int cols: width > 0 ? Math.max(4, Math.min(6, Math.floor((width + gap) / (88 + gap)))) : 4
      readonly property int cardW: Math.floor((width - gap * (cols - 1)) / cols)
      readonly property int cardH: 8 + 74 + 6 + 34 + 6
      readonly property int rows: Math.ceil(shown.length / cols)
      implicitHeight: rows > 0 ? rows * cardH + (rows - 1) * gap : 0

      Repeater {
        model: sealGrid.shown

        CcCard {
          id: sealCard
          required property var modelData
          required property int index
          x: (index % sealGrid.cols) * (sealGrid.cardW + sealGrid.gap)
          y: Math.floor(index / sealGrid.cols) * (sealGrid.cardH + sealGrid.gap)
          width: sealGrid.cardW
          height: sealGrid.cardH
          host: page.cc
          pal: page.pal
          caption: modelData.name
          captionElide: Text.ElideNone
          hint: modelData.note + (modelData.text !== "" ? " Letter seals read from a " + Marks.sealLegibleFrom + " px bar." : "")
          current: String(page.pal.get("seal", "tomie")) === modelData.key
          onActivated: page.act.set("seal", modelData.key)

          // The letters stand in a fixed 74 px tile and are centred in it, so two- and three-letter seals share one grid.
          Item {
            y: 8
            width: sealCard.width
            height: 74

            Ito.ItoImage {
              visible: !!(sealCard.modelData.art || sealCard.modelData.user)
              palette: page.pal
              tintable: true
              anchors.centerIn: parent
              readonly property int want: Math.round(60 * Math.max(1, Screen.devicePixelRatio))
              readonly property var pick: sealCard.modelData.user ? page.pal.userMark(String(sealCard.modelData.user), want) : null
              readonly property int px: sealCard.modelData.art ? Marks.nearestSealSide(want) : (pick && pick.px > 0 ? pick.px : 0)
              width: 60
              height: 60
              source: sealCard.modelData.art ? page.art + "tomie/seals/" + sealCard.modelData.art + "/" + px + ".png" : (pick ? String(pick.url) : "")
              sourceSize: px > 0 ? Qt.size(px, px) : Qt.size(120, 120)
              fillMode: Image.PreserveAspectFit
              smooth: px <= 0
              mipmap: px <= 0
              opacity: sealCard.current ? 1 : 0.8
            }

            Text {
              visible: sealCard.modelData.text !== ""
              anchors.centerIn: parent
              text: sealCard.modelData.text
              color: sealCard.current ? page.pal.lit : page.bone
              opacity: sealCard.current ? 1 : 0.7
              font.family: "Noto Serif CJK JP"
              font.weight: Font.Bold
              font.features: { "vert": 1 }
              font.pixelSize: Math.round(28 * sealCard.modelData.scale)
              lineHeight: 0.8
              lineHeightMode: Text.ProportionalHeight
              horizontalAlignment: Text.AlignHCenter
            }
          }
        }
      }
    }

    Text {
      Layout.fillWidth: true
      text: "The letter seals read from a 32 px bar; on a thinner bar the strokes blur."
      wrapMode: Text.WordWrap
      color: page.bone
      opacity: 0.6
      font.family: "Noto Serif"
      font.pixelSize: 11
    }


    PickButton {
      label: "Choose picture for the seal"
      hint: "Put your own picture where the seal's letters are. It is adapted to the shell's colours."
      onActivated: if (!sealPicker.running) sealPicker.running = true
    }


    Text {
      Layout.topMargin: 4
      text: "SEAL COLOUR"
      color: page.bone
      opacity: 0.7
      font.family: "Noto Serif"
      font.pixelSize: 10
      font.letterSpacing: 3
    }

    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: [
          { "key": "auto", "label": "Auto", "tip": "Blood while the pointer is over the seal or its panel is open; bone the rest of the time. The default." },
          { "key": "on",   "label": "On",   "tip": "Always the blood colour, whether or not the panel is open." },
          { "key": "off",  "label": "Off",  "tip": "Always the bone colour, even while the panel is open." }
        ]

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredHeight: 38
          radius: 19
          host: page.cc
          pal: page.pal
          showCaption: false
          hint: modelData.tip
          current: page.sealLitKey === modelData.key
          onActivated: page.act.set("sealLit", modelData.key)

          Text {
            anchors.centerIn: parent
            text: modelData.label
            color: parent.current ? page.pal.lit : page.bone
            font.family: "Noto Serif"
            font.pixelSize: 12
          }
        }
      }
    }


    CcHelp {
      pal: page.pal
      title: "How to prepare the seal's picture"
      body: "<b>Size.</b> Square, <b>256 × 256 px</b> (anything from 128 up to 1024 works). It takes the place of the seal's letters, about 34 px tall on the bar. The file can be up to 25 MB, though a few hundred KB is plenty.<br>"
          + "<b>Drawing.</b> One bold subject, centred: a glyph, an eye, a small symbol. Fine detail is lost at that size.<br>"
          + "<b>Format and colours.</b> PNG (transparent is best), JPG, WebP or SVG. Light or dark lines both work; red becomes your accent."
    }
  }

  // ---------------------------------------------------------------- menu mark
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "MENU MARK"
    note: {
      for (var i = 0; i < page.marks.length; i++)
        if (page.marks[i].key === page.markKey) return page.marks[i].note
      return Marks.customArt(page.markKey) !== "" ? "Your own picture, adapted to the shell's colours." : ""
    }


    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      label: "HD redraw of old marks (experimental)"
      hint: "Halo, Flauros, Amigara, Metatron, Remina Ink and the Sheet spiral keep their original drawings. Turn this on to show the pixel-exact redraws instead."
      on: page.pal.get("markHdTiers", false) === true
      onActivated: page.act.set("markHdTiers", on ? "false" : "true")
    }

    Text {
      Layout.fillWidth: true
      text: "Logo size now: " + Math.min(page.logoBar - 4, page.logoPx) + " px on a " + page.logoBar + " px bar"
      color: page.bone
      opacity: 0.8
      font.family: "Noto Serif"
      font.pixelSize: 12
    }

    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: page.logoSteps

        CcCard {
          required property var modelData
          required property int index
          readonly property bool fits: modelData.px <= page.logoBar - 4
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.preferredHeight: 46
          host: page.cc
          pal: page.pal
          showCaption: false
          current: page.logoStep === index
          opacity: fits ? 1 : 0.4
          hint: fits ? "Logo size: " + modelData.label + ", " + modelData.px + " px on the bar." : "Bar too thin for this size"
          onActivated: if (fits) page.act.set("markScale", (modelData.px / page.logoBar).toFixed(3))

          Column {
            anchors.centerIn: parent
            spacing: 1
            Text {
              anchors.horizontalCenter: parent.horizontalCenter
              text: modelData.label
              color: current ? page.pal.lit : page.bone
              font.family: "Noto Serif"
              font.pixelSize: 11
            }
            Text {
              anchors.horizontalCenter: parent.horizontalCenter
              text: modelData.px + " px"
              color: page.bone
              opacity: 0.6
              font.family: "Noto Serif"
              font.pixelSize: 10
            }
          }
        }
      }

      CcCard {
        Layout.preferredWidth: 110
        Layout.preferredHeight: 46
        radius: 15
        host: page.cc
        pal: page.pal
        showCaption: false
        hint: "Back to the default logo size."
        onActivated: page.act.unset(["markScale"])

        Text {
          anchors.centerIn: parent
          text: "Reset to default"
          color: page.bone
          font.family: "Noto Serif"
          font.pixelSize: 11
        }
      }
    }

    CcHelp {
      pal: page.pal
      title: "About the logo size"
      body: "How big the menu mark is on the bar: " + page.logoPx + " px now (every mark has exact pixels at each step). Default is a little larger than before; Reset goes back to it."
    }


    // A responsive grid (same rules as the Workspaces page): fixed-aspect cards sized from the real width, 3 to 6 columns, rows wrap,
    // the preview is a square that snaps to a bar tier, names wrap to two lines and are never cut.
    Item {
      id: markGrid
      Layout.fillWidth: true
      Layout.preferredHeight: implicitHeight
      readonly property int gap: 10
      readonly property var shown: page.marks.filter(function (m) { return page.cc.match(m.name + " " + m.note + " menu mark logo") })
      readonly property int cols: width > 0 ? Math.max(3, Math.min(6, Math.floor((width + gap) / (96 + gap)))) : 3
      readonly property int cardW: Math.floor((width - gap * (cols - 1)) / cols)
      readonly property int pv: { var t = [80, 72, 64, 56, 48]; for (var i = 0; i < t.length; i++) if (t[i] <= cardW - 16) return t[i]; return 48 }
      readonly property int cardH: 10 + pv + 8 + 34 + 6
      readonly property int rows: Math.ceil(shown.length / cols)
      implicitHeight: rows > 0 ? rows * cardH + (rows - 1) * gap : 0
      readonly property real dpr: Math.max(1, Screen.devicePixelRatio)

      Repeater {
        model: markGrid.shown

        CcCard {
          required property var modelData
          required property int index
          x: (index % markGrid.cols) * (markGrid.cardW + markGrid.gap)
          y: Math.floor(index / markGrid.cols) * (markGrid.cardH + markGrid.gap)
          width: markGrid.cardW
          height: markGrid.cardH
          host: page.cc
          pal: page.pal
          caption: modelData.name
          captionElide: Text.ElideNone
          hint: modelData.note
          current: page.markKey === modelData.key
          onActivated: page.act.set("menuMark", modelData.key)

          Ito.ItoImage {
            palette: page.pal
            tintable: !Marks.isCustom(modelData.key, page.pal.markOverrides)
            // S25: a mark's own `scale` (Tomie Classic 0.87) draws it that much smaller inside its card, as on the bar
            readonly property int side: Math.round(markGrid.pv * Marks.markScale(modelData.key, page.pal.markOverrides))
            x: Math.round((parent.width - side) / 2)
            y: 10 + Math.round((markGrid.pv - side) / 2)
            width: side
            height: side
            readonly property int want: Math.round(side * markGrid.dpr)
            // every shipped mark has a file for every tier (S2d): the card shows the smallest tier that is not smaller than its own size, 1:1 when it is a tier
            readonly property int tier: {
              var t = [24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 60, 64, 72, 80, 88, 96, 112, 120, 128]
              for (var i = 0; i < t.length; i++) if (t[i] >= want) return t[i]
              return 128
            }
            readonly property bool sheet: modelData.key === "spiral" || modelData.key === "spiral-clean"
            // a user mark shows the bar-size file the bar would pick (the card's size), or its 512 picture
            readonly property var userPick: Marks.userName(modelData.key) !== "" ? page.pal.userMark(Marks.userName(modelData.key), want)
              : sheet && !legacyOrig ? page.pal.userBar("system/" + modelData.art, want, "v9") : null
            readonly property string userSrc: userPick ? String(userPick.url) : ""
            readonly property var tierArts: ["menu-uzumaki.png", "menu-uzumaki-v1.png", "menu-uzumaki-v2.png", "menu-remina.png", "menu-amigara.png", "menu-metatron-full.png",
              "menu-metatron.png", "menu-halo.png", "menu-flauros.png", "system-normal.png", "system-normal-clean.png"]
            // the legacy marks show their original art unless the opt-in markHdTiers is on (they were redrawn by S2d)
            readonly property var legacyArts: ["menu-remina.png", "menu-amigara.png", "menu-halo.png", "menu-flauros.png", "system-normal.png", "system-normal-clean.png"]
            readonly property bool legacyOrig: legacyArts.indexOf(modelData.art) >= 0 && page.pal.get("markHdTiers", false) !== true
            readonly property string shipArt: !legacyOrig && !modelData.user && modelData.art && tierArts.indexOf(modelData.art) >= 0 && !(sheet && userPick && userPick.px > 0) && want <= 128 ? modelData.art : ""
            readonly property bool exact: shipArt !== "" || (userPick !== null && userPick.px > 0)
            source: shipArt !== "" ? page.art + "system/bar/" + tier + "/" + shipArt
              : sheet && userPick && userPick.px > 0 ? userSrc
              : Marks.source(page.art.toString(), modelData.key, page.home, page.pal.markOverrides, userSrc)
            sourceSize: shipArt !== "" ? Qt.size(tier, tier) : userPick && userPick.px > 0 ? Qt.size(userPick.px, userPick.px) : Qt.size(markGrid.pv * 2, markGrid.pv * 2)
            onStatusChanged: if (status === Image.Error && userPick) page.pal.userFail(userSrc)
            fillMode: Image.PreserveAspectFit
            smooth: !exact
            mipmap: !exact
            opacity: parent.current ? 1 : 0.8
          }
        }
      }
    }


    PickButton {
      label: "Choose picture for the menu mark"
      hint: "Use your own picture as the menu button. It is added to the list of marks below and used at once."
      onActivated: if (!picker.running) picker.running = true
    }


    CcHelp {
      pal: page.pal
      title: "How to prepare the menu mark's picture"
      body: "<b>Size.</b> Square, <b>512 × 512 px</b> (from 128 up to 2048 works; never more than 8000). It is drawn about 29 px on the bar, so keep one bold subject, centred, with little empty margin. Up to 25 MB.<br>"
          + "<b>Format.</b> PNG (transparent background is best), JPG, WebP or SVG.<br>"
          + "<b>After choosing.</b> It appears under YOUR OWN below; click it to use it. To take it away, delete it from the marks folder."
    }
  }

  // ---------------------------------------------------------------- seal decoration
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "SEAL DECORATION"
    note: {
      var d = Marks.decoration(page.pal)
      return d.note + " It stands on both sides of the seal; Effects makes it pulse, breathe or flicker."
    }


    GridLayout {
      Layout.fillWidth: true
      columns: 5
      rowSpacing: 8
      columnSpacing: 8

      Repeater {
        model: Marks.decorations

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.preferredHeight: 108
          host: page.cc
          pal: page.pal
          caption: modelData.name
          hint: modelData.note
          current: Marks.decoration(page.pal).key === modelData.key
          visible: page.cc.match(modelData.name + " " + modelData.note + " decoration seal veins")
          onActivated: page.act.set("sealDeco", modelData.key)

          Row {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 10
            spacing: 10
            visible: modelData.art !== ""

            Ito.ItoImage {
              palette: page.pal
              width: 26 * modelData.wide
              height: 58
              source: modelData.art === "" ? "" : page.art + modelData.art
              fillMode: Image.PreserveAspectFit
              smooth: true
              mipmap: true
              opacity: parent.parent.current ? 1 : 0.8
            }
            Ito.ItoImage {
              palette: page.pal
              width: 26 * modelData.wide
              height: 58
              mirror: true
              source: modelData.art === "" ? "" : page.art + modelData.art
              fillMode: Image.PreserveAspectFit
              smooth: true
              mipmap: true
              opacity: parent.parent.current ? 1 : 0.8
            }
          }

          Text {
            visible: modelData.art === ""
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 26
            text: "—"
            color: page.bone
            opacity: 0.5
            font.pixelSize: 22
          }
        }
      }
    }


    PickButton {
      label: "Choose picture for the decoration"
      hint: "Put your own picture where the veins are; the other side is its mirror."
      onActivated: if (!decoPicker.running) decoPicker.running = true
    }


    CcHelp {
      pal: page.pal
      title: "How to prepare the decoration's picture"
      body: "<b>Size.</b> Wide and short, <b>600 × 200 px (3 : 1)</b>; anything up to 1800 × 600 is fine. It is shown near 34 px tall beside the seal, and its mirror is drawn on the other side. Up to 25 MB.<br>"
          + "<b>Drawing.</b> Fine lines that reach out from the left edge towards the seal; keep the seal side of the picture on the right.<br>"
          + "<b>Format and colours.</b> PNG with a transparent background is best. Light lines on nothing, with red only where it bleeds."
    }
  }

  // ---------------------------------------------------------------- the user's own
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "YOUR OWN"
    note: "Any picture becomes a menu mark. Put it in the marks folder and press Refresh."


    // What to prepare, said plainly -- folded until asked for.
    CcHelp {
      pal: page.pal
      title: "How to prepare your picture (size, format, colours)"
      body: "<b>Size.</b> Square, <b>512 × 512 px</b> (1024 is plenty; the file up to 25 MB). The mark is drawn 29 px on the bar and 60 px here, "
          + "so it is scaled down: keep the subject big and centred, with little empty margin.<br>"
          + "<b>Format.</b> PNG, JPG, WebP or SVG. A PNG with a transparent background is best; a photo or a scan works too.<br>"
          + "<b>Drawing.</b> Bold, high-contrast pictures read best at 29 px. Fine hatching turns to grey; a face or an eye reads better than a whole scene.<br>"
          + "<b>Colours.</b> Dark lines on light paper, light lines on dark, or red strokes: it works out which. Red becomes your accent, everything else follows the theme.<br>"
          + "<b>Name.</b> The file name is the mark's name. Call it <i>tomie</i>, <i>remina</i>, <i>uzumaki</i>, <i>amigara</i>, <i>halo</i>, <i>flauros</i> or <i>metatron</i> to replace that mark.<br>"
          + "<b>Easiest.</b> Press <i>Choose picture</i>, pick the file, and it appears in the list. Click it to use it.<br>"
          + "<b>Framing a portrait.</b> From a terminal: <i>ito-marks import FILE NAME --crop X,Y,SIDE --tone --disc</i>. "
          + "<i>--crop</i> takes a square (left, top, side in pixels), <i>--tone</i> keeps the shading, <i>--disc</i> sets it in a round badge, "
          + "<i>--gamma 0.7</i> brightens a dark picture."
    }


    GridLayout {
      Layout.fillWidth: true
      columns: 5
      rowSpacing: 8
      columnSpacing: 8

      Repeater {
        model: page.custom

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.preferredHeight: 108
          host: page.cc
          pal: page.pal
          caption: modelData.name
          hint: "Your picture, adapted. Remove it by deleting the file from the marks folder."
          current: page.markKey === modelData.key
          onActivated: page.act.set("menuMark", modelData.key)

          Ito.ItoImage {
            palette: page.pal
            tintable: false
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 10
            width: 60
            height: 60
            source: "file://" + modelData.file
            fillMode: Image.PreserveAspectFit
            smooth: true
            mipmap: true
            opacity: parent.current ? 1 : 0.8
          }
        }
      }

      Repeater {
        model: [
          { "label": "Choose picture", "tip": "Pick a picture from your files. It becomes a mark, adapted to the shell's colours.", "act": "pick" },
          { "label": "Open folder", "tip": "Open the marks folder to drop pictures into.", "act": "open" },
          { "label": "Refresh", "tip": "Look for new pictures in the folder.", "act": "refresh" }
        ]

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.preferredHeight: 108
          host: page.cc
          pal: page.pal
          showCaption: false
          hint: modelData.tip
          onActivated: {
            if (modelData.act === "open") Quickshell.execDetached(["xdg-open", page.home + "/.config/ito/marks"])
            else if (modelData.act === "pick") { if (!picker.running) picker.running = true }
            else lister.running = true
          }

          Text {
            anchors.centerIn: parent
            text: modelData.label
            color: page.bone
            font.family: "Noto Serif"
            font.pixelSize: 12
          }
        }
      }
    }
  }

}
