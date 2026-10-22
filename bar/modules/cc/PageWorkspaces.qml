import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import ".." as Ito

// Workspaces: how the workspaces are drawn and how many are always shown.
ColumnLayout {
  id: page

  property var cc: null
  readonly property var pal: cc.pal
  readonly property var act: cc.actions
  readonly property color bone: pal.bone
  readonly property url art: Qt.resolvedUrl("../ito-art/")

  spacing: 10

  readonly property string marksTool: Qt.resolvedUrl("../bin/ito-marks").toString().replace("file://", "")
  readonly property string home: Quickshell.env("HOME")

  // One file dialog for whichever state was asked for; once a picture is in, the style switches to Custom and
  // the bar is told to reload it (the stamp is part of the picture's address).
  // Does the Custom style have a picture yet? Choosing it with none would leave the bar empty, so it asks for one instead.
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

  // Which of the four pictures exist. Asking the disk (not loading a file that may not be there) keeps the log clean.
  property var wsHas: ({})
  Process {
    id: wsProbe
    command: ["sh", "-c", "for s in empty occupied active urgent; do [ -f \"$HOME/.cache/ito/marks/_ws-$s.png\" ] && echo $s; done; true"]
    running: true
    stdout: StdioCollector {
      onStreamFinished: {
        var has = {}
        var names = String(text).split("\n")
        for (var k = 0; k < names.length; k++) if (names[k] !== "") has[names[k]] = true
        page.wsHas = has
      }
    }
  }
  readonly property int wsVersion: Number(pal.get("wsCustomVer", 0))
  onWsVersionChanged: probeSoon.restart()
  Timer { id: probeSoon; interval: 900; onTriggered: if (!wsProbe.running) wsProbe.running = true }

  Process {
    id: wsReset
    command: [page.marksTool, "reset-ws"]
    onExited: { page.act.set("wsCustomVer", Math.floor(Date.now() / 1000)); page.act.set("style", "orbs") }
  }

  Process {
    id: wsPicker
    property string state: "active"
    command: [page.marksTool, "pick", "--as", "_ws-" + state]
    stdout: StdioCollector {
      onStreamFinished: if (page.pickOk(text)) {
        page.act.set("wsCustomVer", Math.floor(Date.now() / 1000))
        page.act.set("style", "custom")
      }
    }
  }

  // the definition a family's card shows: Beetle answers to wsBeetleDef; the S15c family to eyeWsIris (`alt` = plain iris)
  function defFor(key) {
    if (key === "uzumaki-eye") return String(page.pal.get("eyeWsCrop", "tight")) !== "wide" ? "v12" : String(page.pal.get("eyeWsIris", "spiral")) === "plain" ? "alt" : "v9"
    if (key === "symbols" || key === "gothic" || key === "pyramid" || key === "heather" || key === "cult") return "v9"
    var bd = String(page.pal.get("beetleDef", ""))
    return ["v12", "v10", "v9"].indexOf(bd) >= 0 ? bd : page.pal.get("wsBeetleDef", "v9")
  }

  // the stored style as a card key: the old id `gothic` is the Symbols card; the removed `pyramid-classic` is the Pyramid card
  function styleKey() { var s = String(page.pal.get("style", "orbs")); return s === "gothic" ? "symbols" : s === "pyramid-classic" ? "pyramid" : s }

  readonly property var styles: [
    { "key": "numerals", "art": "workspace-labels/ws-1-red.png",             "name": "Seals",
      "note": "Numbered rings: every workspace shows its digit, and the one you are on bleeds." },
    { "key": "orbs",     "art": "workspaces/workspace-2.png",                "name": "Rings",
      "note": "Concentric rings, no numbers. The red ring is where you are." },
    { "key": "eyes",     "art": "status-eyes/eye-red.png",                   "name": "Eyes and lips (sheet)",
      "note": "The sheet's soft eyes and lips alternate along the bar; the bloodshot eye is the active one." },
    { "key": "remina",   "art": "workspaces/ws-remina-3-active.png",            "name": "Remina",
      "note": "The planet with one eye: shut when empty, open when there is something, bloodshot on the one you are on. One tendril more for each workspace." },
    { "key": "uzumaki",  "art": "workspaces/bar/128/ws-uzumaki-classic-3-active.png", "name": "Uzumaki v1",
      "note": "The classic Uzumaki drawing: a spiral with one arm more for every workspace, a dotted ring from the sixth. Blood on the one you are on." },
    { "key": "uzumaki-vortex", "art": "workspaces/bar/128/ws-uzumaki-vortex-3-active.png", "name": "Uzumaki v2",
      "note": "The redrawn Uzumaki: one tapering spiral for every workspace, the eye opens on the one you are on." },
    { "key": "uzumaki-original", "art": "workspaces/bar/128/ws-uzumaki-original-3-active.png", "name": "Uzumaki v3",
      "note": "The original Uzumaki drawing, redrawn for every bar size: one arm more for every workspace, crisp at small sizes. Blood on the one you are on." },
    { "key": "dots",     "art": "workspace-indicators/indicator-urgent.png", "name": "Marks",
      "note": "Blood marks: hollow when empty, inked when occupied, a bleeding target when active." },
    { "key": "halo",     "art": "workspaces/ws-halo-3-active.png",     "name": "Halo",
      "note": "Silent Hill 3's own save-point seal: as many spikes as the workspace number, lit blood on the one you are on." },
    { "key": "flauros",  "art": "workspaces/ws-flauros-3-active.png", "name": "Flauros",
      "note": "The puzzle's own seal: the coil winds one turn tighter per workspace, lit blood on the one you are on." },
    { "key": "tomie",    "art": "workspaces/ws-tomie-3-active.png", "name": "Tomie", "user": true,
      "note": "Your own Tommie drawing: her human face (eye, mole, fringe) on the workspaces that are empty or occupied, her transformed face on the one you are on, and in blood when one is urgent. The number sits over her cheek." },
    { "key": "beetle",   "art": "workspaces/ws-beetle-3-active.png", "name": "Beetle", "user": true,
      "note": "Your own beetle over a Mayan numeral: a dot is 1, a bar is 5. The eye on its back and the numeral bleed on the one you are on." },
    { "key": "uzumaki-eye", "art": "workspaces/ws-uzumaki-eye-3-active.png", "name": "Uzumaki Eye", "user": true,
      "note": "Your bleeding eye over the number, its iris the Uzumaki spiral. It bleeds on the one you are on. Small sizes show an eye that bleeds; the iris detail reads from about 48 px. The eye now fills the tile (key eyeWsCrop wide = the earlier, smaller crop)." },
    { "key": "symbols", "art": "workspaces/ws-symbols-3-active.png", "name": "Symbols", "user": true,
      "note": "Engraved symbols from your shell asset sheet, no faces: a spiral, a moth, an hourglass running out in blood, a red cross, an inverted pentagram, the pyramid, a bleeding eye, an eye-target, a bleeding key, and the vinyl for 10. The pyramid is faint below 32 px." },
    { "key": "pyramid", "art": "workspaces/ws-pyramid-3-active.png", "name": "Pyramid", "user": true,
      "note": "Pyramid Head from your HD side view in the picture's own colours (rusty iron, true black, red blood), standing in the targeting ring, his helmet's tip piercing it: dimmed in a faint ring when empty, scratched when occupied, a blood ring with runs when active, a hot ring and a red glow when urgent." },
    { "key": "heather", "art": "workspaces/ws-heather-3-active.png", "name": "Heather", "user": true,
      "note": "Heather from your Heather / Pyramid roundel, in the targeting ring of your workspace sheet (closer on her face on a small bar): a grey ghost when empty, her portrait with old red scratch bars when occupied, the ring turns to blood and bleeds on the one you are on, and she is washed in blood when one is urgent (a flood on arrival and a shake on urgent, unless motion is off)." },
    { "key": "cult", "art": "workspaces/ws-cult-3-active.png", "name": "Cult Symbols", "user": true,
      "note": "Silent Hill's symbols, drawn faithfully from their pictures and engraved in iron, one per workspace: the Halo of the Sun, the Seal of Metatron, Flauros, the Mark of Samael, Valtiel, the Halo Sigil, the Otherworld Gate, Faith & Torment, the Eternal Flame and Sun's Vitality. A cold outline when empty, rusted iron when occupied, its heart burns and bleeds on the one you are on, and it all runs with blood when one is urgent (a flood on arrival and a shake on urgent, unless motion is off)." },
    { "key": "custom",   "art": "",                                       "name": "Custom",
      "note": "Your own pictures, one for each state. Choose them under YOUR OWN below." }
  ]

  // the card art is the tier of the card's own size (56 px at 1x, 112 at 2x), never a smaller one scaled up; a user family (Beetle) is listed only when the assets index has its set
  readonly property int cardWant: Math.max(1, Math.round(64 * Math.max(1, Screen.devicePixelRatio)))
  // Workspace size (S2d): seven steps = seven tiers, in px for the current bar; wsArtScale = px / barSize. Unset = the style's own default size (Reset).
  readonly property int wsBar: Math.max(38, Math.min(58, Math.round(Number(pal.get("barSize", 46)) || 46)))
  readonly property var wsSteps: [{ label: "Small", px: 24 }, { label: "Default", px: 26 }, { label: "Medium", px: 28 }, { label: "Large", px: 32 }, { label: "XL", px: 36 }, { label: "XXL", px: 40 }, { label: "Max", px: 44 }]
  readonly property bool wsSizeSet: Number(pal.get("wsArtScale", -1)) > 0
  readonly property int wsPx: Math.min(page.wsBar - 4, Math.round(page.wsBar * Math.max(0.2, Math.min(1.2, Number(pal.get("wsArtScale", 0.85)) || 0.85))))
  readonly property int wsStep: {
    if (!page.wsSizeSet) return -1
    var best = 0
    for (var i = 1; i < page.wsSteps.length; i++)
      if (Math.abs(page.wsSteps[i].px - page.wsPx) < Math.abs(page.wsSteps[best].px - page.wsPx)) best = i
    return best
  }
  // every shipped family has exact tiers (workspaces/bar/<px>/ws-<token>-<n>-active.png)
  readonly property var tierFam: ({ "numerals": ["numerals", 3], "orbs": ["orbs", 1], "eyes": ["eyes", 1], "dots": ["dots", 1], "remina": ["remina", 3], "halo": ["halo", 3], "flauros": ["flauros", 3],
    "uzumaki": ["uzumaki-classic", 3], "uzumaki-vortex": ["uzumaki-vortex", 3], "uzumaki-original": ["uzumaki-original", 3] })
  readonly property var stylesShown: styles.filter(function (m) { return !m.user || page.pal.userBar(m.art, page.cardWant, page.defFor(m.key)) !== null })

  CcSection {
    host: page.cc
    startOpen: true
    pal: page.pal
    label: "STYLE"
    note: {
      for (var i = 0; i < page.styles.length; i++)
        if (page.styles[i].key === page.styleKey()) return page.styles[i].note
      return ""
    }


    // A responsive grid: cards of one fixed aspect, sized from the width the page really has (3 to 6 columns, wrapping to rows). The
    // preview is a square that snaps to a bar tier (48/56/64/72/80), so a user family shows its exact file; names wrap, never elide.
    Item {
      id: grid
      Layout.fillWidth: true
      Layout.preferredHeight: implicitHeight
      readonly property int gap: 10
      readonly property var shown: page.stylesShown.filter(function (m) { return page.cc.match(m.name + " " + m.note + " workspace style") })
      readonly property int cols: width > 0 ? Math.max(3, Math.min(6, Math.floor((width + gap) / (96 + gap)))) : 3
      readonly property int cardW: Math.floor((width - gap * (cols - 1)) / cols)
      readonly property int pv: { var t = [80, 72, 64, 56, 48]; for (var i = 0; i < t.length; i++) if (t[i] <= cardW - 16) return t[i]; return 48 }
      readonly property int cardH: 10 + pv + 8 + 34 + 6
      readonly property int rows: Math.ceil(shown.length / cols)
      implicitHeight: rows > 0 ? rows * cardH + (rows - 1) * gap : 0

      Repeater {
        model: grid.shown

        CcCard {
          required property var modelData
          required property int index
          x: (index % grid.cols) * (grid.cardW + grid.gap)
          y: Math.floor(index / grid.cols) * (grid.cardH + grid.gap)
          width: grid.cardW
          height: grid.cardH
          host: page.cc
          pal: page.pal
          caption: modelData.name
          captionSize: 11
          captionElide: Text.ElideNone
          hint: modelData.note
          current: page.styleKey() === modelData.key
          onActivated: {
            if (modelData.key === "custom" && !page.wsHas.active) {
              if (!wsPicker.running) { wsPicker.state = "active"; wsPicker.running = true }
            } else page.act.set("style", modelData.key)
          }

          Ito.ItoImage {
            palette: page.pal
            x: Math.round((parent.width - grid.pv) / 2)
            y: 10
            width: grid.pv
            height: grid.pv
            readonly property int want: Math.round(grid.pv * Math.max(1, Screen.devicePixelRatio))
            // a user family's card shows its numeral-free preview (ws-<family>-preview-active, written by its recipe); without one, its workspace 3
            readonly property var userPick: modelData.user ? (page.pal.userBar(String(modelData.art).replace(/-\d+-active\.png$/, "-preview-active.png"), want, page.defFor(modelData.key))
              || page.pal.userBar(modelData.art, want, page.defFor(modelData.key))) : null
            // a shipped family shows the smallest tier not smaller than the card (1:1 when it is a tier), never a stretched small one
            readonly property int tier: {
              var t = [24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 60, 64, 72, 80, 88, 96, 112, 120, 128]
              for (var i = 0; i < t.length; i++) if (t[i] >= want) return t[i]
              return 128
            }
            readonly property var tf: page.tierFam[modelData.key] || null
            // the legacy families show their original art unless the opt-in wsHdTiers is on (S2d redrew them)
            readonly property bool legacyOrig: ["numerals", "orbs", "eyes", "dots", "remina", "halo", "flauros"].indexOf(modelData.key) >= 0 && page.pal.get("wsHdTiers", false) !== true
            readonly property bool tiered: !userPick && tf !== null && want <= 128 && !legacyOrig
            sourceSize: userPick ? Qt.size(userPick.px, userPick.px) : tiered ? Qt.size(tier, tier) : Qt.size(grid.pv * 2, grid.pv * 2)   // a smaller file is never stretched
            source: userPick ? String(userPick.url) : tiered ? page.art + "workspaces/bar/" + tier + "/ws-" + tf[0] + "-" + tf[1] + "-active.png"
              : modelData.art === "" ? "" : page.art + modelData.art
            mipmap: !userPick && !tiered
            smooth: !userPick && !tiered
            onStatusChanged: if (status === Image.Error && userPick) page.pal.userFail(String(userPick.url))
            opacity: parent.current ? 1 : 0.65
          }
          Text {
            visible: modelData.art === ""
            x: Math.round((parent.width - implicitWidth) / 2)
            y: 10 + Math.round((grid.pv - implicitHeight) / 2)
            text: "+"
            color: page.bone
            opacity: parent.current ? 1 : 0.65
            font.pixelSize: 30
          }
        }
      }
    }
  }


  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "YOUR OWN PICTURES"
    note: "Draw the workspaces your way. It takes three steps."


    Column {
      Layout.fillWidth: true
      spacing: 4
      Repeater {
        model: [
          "1.  Click a box below and choose a picture from your files (PNG, JPG, WebP or SVG; square, 256 × 256 px is the right size).",
          "2.  It is used on the bar straight away: the row under the boxes shows how it looks.",
          "3.  Change your mind? Click the box again to swap it, or press Remove my pictures."
        ]
        Text {
          required property string modelData
          width: parent.width
          wrapMode: Text.WordWrap
          text: modelData
          color: page.bone
          opacity: 0.8
          font.family: "Noto Serif"
          font.pixelSize: 12
        }
      }
    }


    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: [
          { "state": "empty",    "name": "Empty",  "what": "no windows" },
          { "state": "occupied", "name": "In use", "what": "has windows" },
          { "state": "active",   "name": "Active", "what": "the one you are on" },
          { "state": "urgent",   "name": "Urgent", "what": "asks for attention" }
        ]

        CcCard {
          id: slot
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.preferredHeight: 128
          host: page.cc
          pal: page.pal
          showCaption: false
          hint: "Choose the picture for a workspace that is: " + modelData.what + ". Opens a file dialog."
          onActivated: if (!wsPicker.running) { wsPicker.state = modelData.state; wsPicker.running = true }

          // the picture, or a dashed frame with a plus while none is chosen
          Item {
            id: frame
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 10
            width: 48
            height: 48

            Rectangle {
              anchors.fill: parent
              radius: 10
              color: "transparent"
              visible: !page.wsHas[slot.modelData.state]
              border.width: 1
              border.color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.35)
              Text {
                anchors.centerIn: parent
                text: "+"
                color: page.bone
                opacity: 0.6
                font.pixelSize: 24
              }
            }
            Ito.ItoImage {
              id: pic
              palette: page.pal
              tintable: false
              anchors.fill: parent
              source: page.wsHas[slot.modelData.state] ? "file://" + page.home + "/.cache/ito/marks/_ws-" + slot.modelData.state + ".png?v=" + page.wsVersion : ""
              fillMode: Image.PreserveAspectFit
              smooth: true
              mipmap: true
            }
          }
          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: frame.bottom
            anchors.topMargin: 8
            text: slot.modelData.name
            color: page.bone
            font.family: "Noto Serif"
            font.pixelSize: 12
          }
          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: frame.bottom
            anchors.topMargin: 25
            text: slot.modelData.what
            color: page.bone
            opacity: 0.55
            font.family: "Noto Serif"
            font.pixelSize: 10
          }
          Text {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.bottom: parent.bottom
            anchors.bottomMargin: 8
            text: page.wsHas[slot.modelData.state] ? "click to change" : "click to choose"
            color: page.pal.lit
            opacity: 0.8
            font.family: "Noto Serif"
            font.pixelSize: 10
          }
        }
      }
    }


    Text {
      visible: page.pickError !== ""
      Layout.fillWidth: true
      wrapMode: Text.WordWrap
      text: page.pickError
      color: page.pal.blood
      font.family: "Noto Serif"
      font.pixelSize: 12
    }

    // how the chosen pictures look along the bar: the one you are on, two with windows, two empty
    Rectangle {
      Layout.fillWidth: true
      Layout.preferredHeight: 56
      radius: 12
      color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.04)
      border.width: 1
      border.color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.14)

      Row {
        anchors.centerIn: parent
        spacing: 14
        Text { anchors.verticalCenter: parent.verticalCenter; text: "ON THE BAR"; color: page.bone; opacity: 0.55
               font.family: "Noto Serif"; font.pixelSize: 10; font.letterSpacing: 2 }
        Repeater {
          model: ["active", "occupied", "occupied", "empty", "empty"]
          Ito.ItoImage {
            required property string modelData
            required property int index
            palette: page.pal
            tintable: false
            width: 30
            height: 30
            source: page.wsHas[modelData] ? "file://" + page.home + "/.cache/ito/marks/_ws-" + modelData + ".png?v=" + page.wsVersion : ""
            fillMode: Image.PreserveAspectFit
            smooth: true
            mipmap: true
            opacity: modelData === "empty" ? 0.6 : 1
          }
        }
      }
    }


    CcCard {
      Layout.preferredWidth: 220
      Layout.preferredHeight: 30
      radius: 15
      host: page.cc
      pal: page.pal
      showCaption: false
      hint: "Forget the four pictures and go back to the Rings style."
      onActivated: if (!wsReset.running) wsReset.running = true
      Text { anchors.centerIn: parent; text: "Remove my pictures"; color: page.bone; font.family: "Noto Serif"; font.pixelSize: 11 }
    }


    CcHelp {
      pal: page.pal
      title: "How to prepare your pictures (size, format, colours)"
      body: "<b>Size.</b> Every picture square, <b>256 × 256 px</b> (128 up to 1024 works; the file up to 25 MB). Give the four the same size so they line up. Each one is drawn about 29 px on the bar, so keep the subject big and centred with little empty margin.<br>"
          + "<b>Format.</b> PNG, JPG, WebP or SVG. A PNG with a transparent background is best.<br>"
          + "<b>Four states.</b> Empty, In use, Active and Urgent. Pick one and the rest borrow from the nearest; pick all four to tell them apart. "
          + "Make Active stand out (a red stroke, a brighter mark): that is what shows where you are.<br>"
          + "<b>Colours.</b> Dark lines on light paper, light lines on dark, or red strokes: it works out which. Red becomes your accent, everything else follows the theme.<br>"
          + "<b>Numbers.</b> Every workspace wears the same picture for its state, so the position in the row tells them apart. "
          + "Want a number on each? Bake it into a picture and use it as a mark instead.<br>"
          + "<b>Change it later.</b> Press the same button again and choose another picture. Pictures live in ~/.config/ito/marks/ as <i>_ws-empty</i>, <i>_ws-occupied</i>, <i>_ws-active</i>, <i>_ws-urgent</i>."
    }
  }


  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "WORKSPACE SIZE"
    note: "How big each workspace mark is on the bar. The Uzumaki and your own families have exact pixels at every step; the older sets scale their original art."

    CcToggle {
      Layout.fillWidth: true
      host: page.cc
      pal: page.pal
      label: "HD redraw of old sets (experimental)"
      hint: "Seals, Rings, Eyes and lips, Marks, Remina, Halo and Flauros keep their original drawings. Turn this on to show the pixel-exact redraws instead (they changed the look of some, for example the scratched double ring)."
      on: page.pal.get("wsHdTiers", false) === true
      onActivated: page.act.set("wsHdTiers", on ? "false" : "true")
    }

    Text {
      Layout.fillWidth: true
      text: page.wsSizeSet ? "Workspace size now: " + page.wsPx + " px on a " + page.wsBar + " px bar" : "Workspace size now: the style's own default"
      color: page.bone
      opacity: 0.8
      font.family: "Noto Serif"
      font.pixelSize: 12
    }

    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: page.wsSteps

        CcCard {
          required property var modelData
          required property int index
          readonly property bool fits: modelData.px <= page.wsBar - 4
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.preferredHeight: 46
          host: page.cc
          pal: page.pal
          showCaption: false
          current: page.wsStep === index
          opacity: fits ? 1 : 0.4
          hint: fits ? "Workspace size: " + modelData.label + ", " + modelData.px + " px on the bar." : "Bar too thin for this size"
          onActivated: if (fits) page.act.set("wsArtScale", (modelData.px / page.wsBar).toFixed(3))

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
        hint: "Back to the default workspace size."
        onActivated: page.act.unset(["wsArtScale"])

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
      title: "About the workspace size"
      body: "How big the workspace marks are on the bar, in pixels. Reset goes back to each style's own size."
    }
  }


  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "WHICH ONES"
    note: "Every workspace up to the count, or only the ones with something in them."


    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: [
          { "key": "count", "name": "Always N", "note": "Always draw the first N workspaces, so the row never changes width." },
          { "key": "used",  "name": "Only in use", "note": "Draw only the workspaces with a window in them, and the one you are on." }
        ]

        CcCard {
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredHeight: 62
          host: page.cc
          pal: page.pal
          caption: modelData.name
          hint: modelData.note
          current: String(page.pal.get("workspaceShow", "count")) === modelData.key
          onActivated: page.act.set("workspaceShow", modelData.key)

          // a row of marks: five for Always N, three for Only in use
          Row {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 14
            spacing: 6

            Repeater {
              model: modelData.key === "count" ? 5 : 3

              Rectangle {
                required property int index
                width: 9
                height: 9
                radius: 4.5
                color: index === 1 ? page.pal.blood : "transparent"
                border.width: 1
                border.color: index === 1 ? page.pal.blood
                  : Qt.rgba(page.bone.r, page.bone.g, page.bone.b, modelData.key === "count" && index > 2 ? 0.3 : 0.6)
              }
            }
          }
        }
      }
    }
  }


  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "COUNT"
    note: "Workspaces that are always shown, even empty. More appear by themselves as you open them."


    CcMeter { host: page.cc; pal: page.pal; actions: page.act; percent: false
      enabled: String(page.pal.get("workspaceShow", "count")) === "count"
      opacity: enabled ? 1 : 0.4
      label: "Always shown"; key: "workspaceCount"; fallback: 5; lo: 1; hi: 10
      hint: "The lowest number of workspaces the bar always draws." }
  }

}
