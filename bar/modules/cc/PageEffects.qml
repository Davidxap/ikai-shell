import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import ".." as Ito
import "../ItoMarks.js" as Marks

// Effects: how the shell moves and how much light it gives off. Each effect is tried live on its card, so
// choosing is looking, not reading. The cards run the effect while the pointer is over them.
ColumnLayout {
  id: page

  property var cc: null
  readonly property var pal: cc.pal
  readonly property var act: cc.actions
  readonly property color bone: pal.bone
  readonly property url art: Qt.resolvedUrl("../ito-art/")

  spacing: 10

  readonly property string marksTool: Qt.resolvedUrl("../bin/ito-marks").toString().replace("file://", "")
  readonly property url fxFile: "file://" + home + "/.config/ito/effects/custom?v=" + pal.get("fxCustomVer", 0)

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

  // Your own media effect: a file dialog, then it is used at once.
  Process {
    id: fxPicker
    command: [page.marksTool, "pick-fx"]
    stdout: StdioCollector {
      onStreamFinished: if (page.pickOk(text)) {
        page.act.set("fxCustomVer", Math.floor(Date.now() / 1000))
        page.act.set("mediaFx", "custom")
      }
    }
  }
  Process {
    id: fxReset
    command: [page.marksTool, "reset-fx"]
    onExited: { page.act.set("fxCustomVer", Math.floor(Date.now() / 1000)); page.act.set("mediaFx", "blood") }
  }
  // is there a file yet?
  property bool fxExists: false
  Process {
    id: fxProbe
    command: ["test", "-f", page.home + "/.config/ito/effects/custom"]
    running: true
    onExited: function(code) { page.fxExists = code === 0 }
  }
  readonly property int fxVersion: Number(pal.get("fxCustomVer", 0))
  onFxVersionChanged: if (!fxProbe.running) fxProbe.running = true

  readonly property var kinds: [
    { "key": "auto",      "name": "Auto",      "note": "Each mark's own: a spiral turns, a face keeps a heartbeat, a figure breathes." },
    { "key": "none",      "name": "None",      "note": "Perfectly still." },
    { "key": "spin",      "name": "Unwind",    "note": "Winds a turn and a quarter as you reach it, then slackens back to rest, again and again while you stay." },
    { "key": "breathe",   "name": "Breathe",   "note": "Swells and fades slowly, a lamp in the fog." },
    { "key": "heartbeat", "name": "Heartbeat", "note": "Two beats and a rest. Tomie is still alive." },
    { "key": "flicker",   "name": "Flicker",   "note": "The light fails in bursts, as in the Otherworld." },
    { "key": "sway",      "name": "Sway",      "note": "Rocks from side to side like something hung." },
    { "key": "tear",      "name": "Tear",      "note": "A CRT tear every few seconds: the picture jerks sideways for an instant and settles." },
    { "key": "ripple",    "name": "Ripple",    "note": "A ring leaves it and fades, over and over." }
  ]

  function keysFor(names) {
    var out = []
    for (var i = 0; i < kinds.length; i++)
      if (names.indexOf(kinds[i].key) >= 0) out.push(kinds[i])
    return out
  }

  readonly property string motionKey: String(pal.get("motion", "calm"))
  readonly property string always: String(pal.get("fxWhen", "hover"))
  readonly property string markKey: Marks.resolve(String(pal.get("menuMark", "spiral")), pal.userMarkNames)
  readonly property string home: Quickshell.env("HOME")
  readonly property string sealKey: String(pal.get("seal", "tomie"))
  readonly property var sealDef: Marks.findSeal(sealKey)

  function noteOf(list, key) {
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i].note
    return ""
  }

  // One row of effect cards for one setting. `preview` is "mark", "seal" or "vein".
  component KindGrid: GridLayout {
    id: grid
    property string setting: ""
    property string fallback: "none"
    property var options: []
    property string preview: "mark"
    readonly property string chosen: String(page.pal.get(setting, fallback))

    Layout.fillWidth: true
    columns: 5
    rowSpacing: 8
    columnSpacing: 8

    Repeater {
      model: grid.options

      CcCard {
        id: card
        required property var modelData
        Layout.fillWidth: true
        Layout.preferredHeight: 92
        Layout.preferredWidth: 1
        host: page.cc
        pal: page.pal
        caption: modelData.name
        hint: modelData.note
        current: grid.chosen === modelData.key
        visible: page.cc.match(modelData.name + " " + modelData.note + " effect motion")
        onActivated: page.act.set(grid.setting, modelData.key)

        Ito.ItoFx {
          anchors.horizontalCenter: parent.horizontalCenter
          anchors.top: parent.top
          anchors.topMargin: 12
          width: 42
          height: 42
          kind: card.modelData.key === "auto" ? Marks.autoEffect(page.markKey) : card.modelData.key
          active: card.hovered || card.current
          speed: page.pal.fxSpeed
          strength: page.pal.fxStrength
          color: page.pal.blood

          Ito.ItoImage {
            visible: grid.preview === "mark"
            palette: page.pal
            tintable: !Marks.isCustom(page.markKey, page.pal.markOverrides)
            anchors.fill: parent
            source: Marks.source(page.art.toString(), page.markKey, page.home, page.pal.markOverrides, userSrc)
            readonly property var userPick: Marks.userName(page.markKey) !== "" ? page.pal.userMark(Marks.userName(page.markKey), 60) : null
            readonly property string userSrc: userPick ? String(userPick.url) : ""
            onStatusChanged: if (status === Image.Error && userPick) page.pal.userFail(userSrc)
            fillMode: Image.PreserveAspectFit
            smooth: true
            mipmap: true
          }

          Text {
            visible: grid.preview === "seal"
            anchors.centerIn: parent
            text: page.sealDef.text
            color: page.pal.lit
            font.family: "Noto Serif CJK JP"
            font.weight: Font.Bold
            font.pixelSize: Math.round(18 * page.sealDef.scale)
            lineHeight: 0.8
            lineHeightMode: Text.ProportionalHeight
            horizontalAlignment: Text.AlignHCenter
          }

          Ito.ItoImage {
            visible: grid.preview === "vein"
            palette: page.pal
            anchors.fill: parent
            source: page.art + "tomie/tomie-vein.png"
            fillMode: Image.PreserveAspectFit
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- menu mark
  CcSection {
    host: page.cc
    startOpen: true
    pal: page.pal
    label: "MENU MARK"
    note: page.noteOf(page.kinds, String(page.pal.get("fxMark", "auto")))

    KindGrid { setting: "fxMark"; fallback: "auto"; options: page.kinds; preview: "mark" }
  }


  // ---------------------------------------------------------------- seal
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "SEAL"
    note: page.noteOf(page.kinds, String(page.pal.get("fxSeal", "none")))

    KindGrid {
      setting: "fxSeal"; fallback: "none"; preview: "seal"
      options: page.keysFor(["none", "breathe", "heartbeat", "flicker", "sway", "tear", "ripple"])
    }
  }


  // ---------------------------------------------------------------- veins
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "SEAL DECORATION"
    note: "What stands on both sides of the seal (choose it on the Logo page). " + page.noteOf(page.kinds, String(page.pal.get("fxVeins", "none")))

    KindGrid {
      setting: "fxVeins"; fallback: "none"; preview: "vein"
      options: page.keysFor(["none", "breathe", "heartbeat", "flicker"])
    }
  }


  // ---------------------------------------------------------------- media
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "MEDIA"
    note: "What moves behind the play buttons while music plays. Each card runs its effect."


    GridLayout {
      Layout.fillWidth: true
      columns: 3
      rowSpacing: 8
      columnSpacing: 8

      Repeater {
        model: [
          { "key": "blood",  "name": "Blood",  "note": "A slosh of blood that rises and falls with a beat." },
          { "key": "spiral", "name": "Spiral", "note": "The Uzumaki spiral, turning." },
          { "key": "radio",  "name": "Radio",  "note": "The pocket radio: a tuning scale, a blood needle sweeping it, and static that thins as the music swells." },
          { "key": "fog",    "name": "Fog",    "note": "Silent Hill's fog drifting past, with its red sun." },
          { "key": "static", "name": "Static", "note": "A dying picture: scanlines, snow and a tear." },
          { "key": "custom", "name": "Your own", "note": "Your own picture or GIF, moving behind the buttons. Click to choose the file; click again to use it." }
        ]

        CcCard {
          id: mediaCard
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredWidth: 1
          Layout.preferredHeight: 84
          host: page.cc
          pal: page.pal
          caption: modelData.name
          hint: modelData.note
          current: String(page.pal.get("mediaFx", "blood")) === modelData.key
          onActivated: {
            if (modelData.key === "custom" && !page.fxExists) { if (!fxPicker.running) fxPicker.running = true }
            else page.act.set("mediaFx", modelData.key)
          }

          Rectangle {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: 10
            width: parent.width - 20
            height: 34
            radius: 17
            color: Qt.rgba(page.pal.ink.r, page.pal.ink.g, page.pal.ink.b, 0.55)
            border.width: 1
            border.color: Qt.rgba(page.bone.r, page.bone.g, page.bone.b, 0.2)

            Ito.ItoMediaFx {
              anchors.fill: parent
              radius: 17
              kind: mediaCard.modelData.key
              customSource: page.fxExists ? page.fxFile : ""
              active: true
              blood: page.pal.blood
              bone: page.pal.bone
              speed: page.pal.fxSpeed
            }

            Text {
              anchors.centerIn: parent
              visible: mediaCard.modelData.key === "custom" && !page.fxExists
              text: "+  choose a picture or GIF"
              color: page.bone
              opacity: 0.7
              font.family: "Noto Serif"
              font.pixelSize: 11
            }
          }
        }
      }
    }

    CcHelp {
      pal: page.pal
      title: "Your own effect: what to prepare (GIF, picture, size)"
      body: "<b>Which files.</b> A GIF (it animates), or a PNG, WebP, APNG or JPG (still, or animated if the format allows).<br>"
          + "<b>Size.</b> The strip behind the play buttons is wide and short (about 6 : 1), so the right size is <b>600 × 100 px</b>. Up to 1200 × 200 is fine; more than 2400 px on a side is refused. Anything that is not 6 : 1 is cropped to the middle.<br>"
          + "<b>Weight.</b> Keep a GIF under <b>3 MB</b> and under about 100 frames. The hard limit is 8 MB.<br>"
          + "<b>Look.</b> Dark or transparent backgrounds sit best on the bar. It is shown a little transparent so the buttons stay readable.<br>"
          + "<b>Cost.</b> It only plays while something is playing, so an idle bar costs nothing.<br>"
          + "<b>To change it</b> click the card again and choose another file, or press Remove."
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

    CcCard {
      Layout.preferredWidth: 200
      Layout.preferredHeight: 30
      radius: 15
      host: page.cc
      pal: page.pal
      showCaption: false
      hint: "Forget your own effect and go back to Blood."
      onActivated: if (!fxReset.running) fxReset.running = true
      Text { anchors.centerIn: parent; text: "Remove my effect"; color: page.bone; font.family: "Noto Serif"; font.pixelSize: 11 }
    }
  }


  // ---------------------------------------------------------------- when
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "WHEN"
    note: "Whether an effect runs only while the pointer is over the thing, or all the time."

    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: [
          { "key": "hover",  "label": "On hover", "tip": "Nothing moves until you reach for it. Costs nothing while idle." },
          { "key": "always", "label": "Always",   "tip": "Effects run all the time, as long as the shell is up." }
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
          current: page.always === modelData.key
          onActivated: page.act.set("fxWhen", modelData.key)

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
  }


  // ---------------------------------------------------------------- motion
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "MOTION"
    note: "How things appear on the bar: labels, and every entrance the shell adds later. Off makes them instant."

    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: [
          { "key": "off",    "label": "Off",    "tip": "No entrance animations at all." },
          { "key": "calm",   "label": "Calm",   "tip": "Short and quiet. The default." },
          { "key": "lively", "label": "Lively", "tip": "A little longer, with more travel." }
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
          current: page.motionKey === modelData.key
          onActivated: page.act.set("motion", modelData.key)

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

    RowLayout {
      Layout.fillWidth: true
      spacing: 8

      Repeater {
        model: [
          { "key": "ito", "label": "Shell only", "tip": "Motion applies to the shell's own animations. The default." },
          { "key": "all", "label": "Shell and bar engine", "tip": "The bar engine's colour fades and drag timings follow the motion setting too." }
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
          current: String(page.pal.get("motionScope", "ito")) === modelData.key
          onActivated: page.act.set("motionScope", modelData.key)

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
  }


  // ---------------------------------------------------------------- opening speed
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "OPENING SPEED"
    note: "How long popups, frames and the ink, spiral and lid openings take to appear. Slower reads better; faster gets out of the way. Motion off still makes them instant."

    CcMeter { id: openMeter; host: page.cc; pal: page.pal; actions: page.act
      label: "Opening speed"; key: "openDuration"; fallback: 900; lo: 150; hi: 2400; percent: false; unit: " ms"
      hint: "Length of the main opening in milliseconds. 340 is the old fast one, 900 the default, 2400 the slowest." }

    RowLayout {
      Layout.fillWidth: true
      spacing: 12

      Ito.ItoRevealPreview {
        id: openPreview
        Layout.preferredWidth: 120
        Layout.preferredHeight: 70
        cfg: openCfg
        kind: ["spiral", "blot", "static", "lid"].indexOf(String(page.pal.get("presenceReveal", "none"))) >= 0
          ? String(page.pal.get("presenceReveal", "none")) : "blot"
        // replays whenever the stored speed changes (a slider release, a preset, Reset)
        Connections { target: page.pal; function onOpenDurationChanged() { openPreview.play() } }
        Ito.ItoPreviewConfig { id: openCfg; source: page.pal }
      }

      ColumnLayout {
        Layout.fillWidth: true
        spacing: 6

        CcCard {
          Layout.fillWidth: true
          Layout.preferredHeight: 34
          radius: 17
          host: page.cc
          pal: page.pal
          showCaption: false
          hint: "Play the opening once at the chosen speed."
          onActivated: openPreview.play()
          Text { anchors.centerIn: parent; text: "Play preview"; color: page.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
        }

        CcCard {
          Layout.fillWidth: true
          Layout.preferredHeight: 34
          radius: 17
          host: page.cc
          pal: page.pal
          showCaption: false
          hint: "Back to the default opening speed (900 ms)."
          onActivated: page.act.unset(["openDuration"])
          Text { anchors.centerIn: parent; text: "Reset to default"; color: page.bone; font.family: "Noto Serif"; font.pixelSize: 12 }
        }
      }
    }
  }


  // ---------------------------------------------------------------- light
  CcSection {
    host: page.cc
    Layout.topMargin: 8
    pal: page.pal
    label: "LIGHT"
    note: "How much the shell glows and how vivid its colours are. The middle is how it ships."

    CcMeter { host: page.cc; pal: page.pal; actions: page.act
      label: "Glow"; key: "light"; fallback: 1; lo: 0; hi: 2
      hint: "The bloom behind marks, veins and active items. Zero turns every glow off." }

    CcMeter { host: page.cc; pal: page.pal; actions: page.act
      label: "Colour vibrance"; key: "vibrance"; fallback: 1; lo: 0.4; hi: 1.7
      hint: "Lower for a quieter, duller accent; higher for a saturated, brighter one." }

    CcMeter { host: page.cc; pal: page.pal; actions: page.act
      label: "Effect speed"; key: "fxSpeed"; fallback: 1; lo: 0.4; hi: 2.5
      hint: "How fast every effect runs." }

    CcMeter { host: page.cc; pal: page.pal; actions: page.act
      label: "Effect strength"; key: "fxStrength"; fallback: 1; lo: 0.4; hi: 2
      hint: "How far every effect goes: how big the pulse, how wide the sway." }


    CcCard {
      Layout.topMargin: 4
      Layout.fillWidth: true
      Layout.preferredHeight: 38
      radius: 19
      host: page.cc
      pal: page.pal
      showCaption: false
      hint: "Put every effect and every light setting back to how they shipped."
      onActivated: page.act.unset(["fxMark", "fxSeal", "fxVeins", "fxWhen", "mediaFx", "light", "vibrance", "fxSpeed", "fxStrength", "motion", "motionScope", "openDuration"])

      Text {
        anchors.centerIn: parent
        text: "Reset effects"
        color: page.bone
        font.family: "Noto Serif"
        font.pixelSize: 12
      }
    }
  }

}
