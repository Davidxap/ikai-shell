import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Wayland
import Quickshell.Io
import ".." as Ito
import "../ItoMotion.js" as Motion
import "StylesIndex.js" as StylesIdx
import "../ItoDefaults.js" as Defaults

// The IKAI control centre: one panel for everything about the shell.
//
// A sidebar of pages (Bars, Icons, Logo, Workspaces, Colors, Plugins, Health), a search that filters the
// page in front of you, and a footer that says what the thing under the pointer does. It is built from the
// same parts as the bar (the plate, the ink, the blood) and holds no state of its own: every control writes
// to the sidecar or to the bar engine through CcActions, and reads them back, so the panel and the bar can
// never disagree.
PanelWindow {
  id: root

  property bool open: false
  property var bar: null
  property var pal: null                       // an ItoConfig: the shell's colours and settings

  property string page: "bars"
  property string query: ""
  property string hint: ""
  property bool grabKeys: false

  signal closeRequested()

  readonly property alias actions: acts

  CcActions {
    id: acts
    bar: root.bar
    pal: root.pal
  }

  function close() { closeRequested() }

  // S13f: one reset for the page in front of you (every registry key of the page that is not at its default), armed by a first click,
  // and an "Undo reset" for 12 s after ANY reset (a control, a section, this page, or Setup > Reset everything)
  property bool pageResetArmed: false
  Timer { id: pageResetDisarm; interval: 4000; onTriggered: root.pageResetArmed = false }
  Timer { id: undoResetTimer; interval: 12000; onTriggered: acts.lastReset = 0 }
  Connections { target: acts; function onLastResetChanged() { if (acts.lastReset > 0) undoResetTimer.restart(); else undoResetTimer.stop() } }
  readonly property var pageDiffers: { var _ = pal ? pal.values : null; return pal ? Defaults.changed(root.page, undefined, pal.get, pal.values) : [] }
  function match(text) { return query === "" || String(text).toLowerCase().indexOf(query.toLowerCase()) >= 0 }

  readonly property var pages: [
    { "key": "styles",     "file": "PageStyles.qml",     "kanji": "装", "title": "Styles",     "sub": "Frames, openings, eyes",    "section": "APPEARANCE", "wide": true },
    { "key": "bars",       "file": "PageBars.qml",       "kanji": "枠", "title": "Bars",       "sub": "Shape, design, look",       "section": "APPEARANCE" },
    { "key": "widgets",    "file": "PageWidgets.qml",    "kanji": "器", "title": "Icons",      "sub": "Widgets and readings",      "section": "APPEARANCE" },
    { "key": "logo",       "file": "PageLogo.qml",       "kanji": "印", "title": "Logo",       "sub": "Seal and menu mark",        "section": "APPEARANCE" },
    { "key": "effects",    "file": "PageEffects.qml",    "kanji": "光", "title": "Effects",    "sub": "Motion and light",          "section": "APPEARANCE" },
    { "key": "workspaces", "file": "PageWorkspaces.qml", "kanji": "間", "title": "Workspaces", "sub": "Style and count",           "section": "APPEARANCE" },
    { "key": "colors",     "file": "PageColors.qml",     "kanji": "色", "title": "Colors",     "sub": "Own or the theme's",        "section": "APPEARANCE" },
    { "key": "plugins",    "file": "PagePlugins.qml",    "kanji": "拡", "title": "Plugins",    "sub": "Installed and available",   "section": "SYSTEM" },
    { "key": "shells",     "file": "PageShells.qml",     "kanji": "殻", "title": "Setup",      "sub": "Profiles, and switching shells",    "section": "SYSTEM" },
    { "key": "sysart",     "file": "PageSystemArt.qml",  "kanji": "闇", "title": "Boot & Lock", "sub": "Splash, fetch, lock", "section": "SYSTEM", "wide": true },
    { "key": "health",     "file": "PageHealth.qml",     "kanji": "脈", "title": "Health",     "sub": "Runtime and errors",        "section": "SYSTEM" }
  ]

  function pageInfo(key) {
    for (var i = 0; i < pages.length; i++) if (pages[i].key === key) return pages[i]
    return pages[0]
  }

  // Where a new section starts, keyed by page index -- read by the sidebar to drop in a label without
  // disturbing the tab Repeater or the sliding highlight's index * 55 math.
  function sectionAt(index) {
    if (index === 0 || pages[index].section === pages[index - 1].section) return ""
    return pages[index].section
  }

  readonly property var formNames: ({ "shibumi": "Islands", "full": "Full", "fit": "Fit", "dock": "Dock" })

  // The Motion setting: 0 is instant, 1 the default, more is slower and wider.
  readonly property real amp: pal && pal.motionAmp !== undefined ? Math.min(pal.motionAmp, 1) : 1

  // Fluid motion (sidecar key `ccMotion`, default ON; off = the old motion). On: the card never changes size while it moves (a width change
  // repaints the plate's Canvas every frame; it snaps once, under the page's fade instead), it moves with a transform so the input
  // mask stays still, the page is built asynchronously, and the times are shorter. `motion: off` still cuts everything (amp 0).
  readonly property bool ccm: pal && typeof pal.get === "function" && pal.get("ccMotion", true) !== false

  // 0 closed .. 1 open. The window stays alive until the close animation has finished.
  property real reveal: open ? 1 : 0
  // In, it arrives with a little spring; out, it leaves quickly and does not linger.
  Behavior on reveal {
    NumberAnimation {
      duration: root.ccm ? Math.round((root.open ? 240 : 150) * root.amp)
                         : Math.round((root.open ? Motion.slow : Motion.normal) * root.amp)
      easing.type: Easing.BezierSpline
      easing.bezierCurve: root.ccm ? (root.open ? Motion.decel : Motion.accel) : (root.open ? Motion.spring : Motion.accel)
    }
  }

  // Debug-only frame probe (sidecar flag `debugFrames`, default off): nothing exists unless it is on.
  Loader {
    id: probeLoader
    active: root.pal !== null && typeof root.pal.get === "function" && root.pal.get("debugFrames", false) === true
    source: Qt.resolvedUrl("../ItoFrameProbe.qml")
    onLoaded: item.label = "cc"
  }

  visible: open || reveal > 0.01
  anchors.top: true
  margins.top: (root.bar ? root.bar.barSize : 46) + 8
  exclusiveZone: 0
  // One page (Boot & Lock) is wide. The window keeps the wide size on every page, so the layer surface never
  // reconfigures while the card animates; the mask keeps the margins beside a narrow card click-through.
  readonly property int wideWidth: Math.min(1180, (screen ? screen.width : 1920) - 48)
  implicitWidth: wideWidth + 24
  mask: Region { item: card }
  // A per-session scratch map for pages (never saved): the Boot & Lock page keeps its tab here.
  property var memo: ({})
  implicitHeight: card.height + 24
  color: "transparent"

  WlrLayershell.namespace: "ito-control-centre"
  WlrLayershell.layer: WlrLayer.Overlay
  WlrLayershell.keyboardFocus: open ? WlrKeyboardFocus.OnDemand : WlrKeyboardFocus.None

  onOpenChanged: {
    if (probeLoader.item) probeLoader.item.edge(open)
    if (open) { query = ""; hint = ""; loadPage(true) }
  }
  onPageChanged: { pageResetArmed = false; if (probeLoader.item && open) probeLoader.item.edge(true); loadPage(false) }

  function pageIndexOf(key) {
    for (var i = 0; i < pages.length; i++) if (pages[i].key === key) return i
    return 0
  }
  readonly property int pageIndex: pageIndexOf(page)
  property int previousIndex: 0

  // The page the card is showing (ccMotion): the card's width and the page's layout width follow this, not `page`, so they change
  // together with the page, under its fade.
  property bool shownWide: false

  function loadPage(fresh) {
    if (root.ccm && fresh !== true && root.amp > 0 && pageLoader.item) {
      // fade the old page out quickly, then swap (width snap, build) and fade the new one in
      pageIn.stop()
      pageOut.restart()
      return
    }
    swapPage()
  }

  function swapPage() {
    pageOut.stop()
    // the new page comes in from the side the tab it belongs to lies in: down the list, it rises from below
    var travel = pageIndex >= previousIndex ? 1 : -1
    previousIndex = pageIndex
    shownWide = pageInfo(page).wide === true
    pageLoader.opacity = 0
    pageLoader.y = travel * (root.ccm ? 12 : 22) * root.amp
    // a wide page builds over several frames (asynchronous) and fades in once it is there; a light one is built at once
    // (ccMotion: every page builds asynchronously, so a build never stalls the frames of the card's own motion)
    pageLoader.asynchronous = root.ccm || pageInfo(page).wide === true
    pageLoader.setSource(Qt.resolvedUrl(pageInfo(page).file), { "cc": root })
    if (pageLoader.status !== Loader.Loading) pageIn.restart()
    flick.contentY = 0
  }

  // The width the card is heading for: the page is laid out once at this width, so the card's width animation
  // (a plate and a clip) never makes the page lay out again on every frame.
  readonly property real cardTarget: (root.ccm ? shownWide : pageInfo(page).wide === true) ? wideWidth : 916

  NumberAnimation {
    id: pageOut
    target: pageLoader; property: "opacity"; to: 0; duration: Math.round(90 * root.amp)
    easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.accel
    onFinished: root.swapPage()
  }

  ParallelAnimation {
    id: pageIn
    NumberAnimation { target: pageLoader; property: "opacity"; to: 1; duration: Math.round((root.ccm ? 160 : Motion.normal) * root.amp)
                      easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.decel }
    NumberAnimation { target: pageLoader; property: "y"; to: 0; duration: Math.round((root.ccm ? 200 : Motion.slow) * root.amp)
                      easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.decel }
  }

  // ------------------------------------------------------------------ the card
  Item {
    id: card
    width: (root.ccm ? root.shownWide : root.pageInfo(root.page).wide === true) ? root.wideWidth : 916
    Behavior on width {
      enabled: !root.ccm
      NumberAnimation { duration: Math.round(Motion.normal * root.amp); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.decel }
    }
    // one more tab is one more 55 px row in the sidebar; the card grows by exactly that, so the footer never overlaps it
    height: 668 + Math.max(0, root.pages.length - 9) * 55
    anchors.horizontalCenter: parent.horizontalCenter
    y: root.ccm ? 12 : 12 - (1 - root.reveal) * 26
    // ccMotion: the lift is a transform, so the card's geometry (and the input mask that follows it) stays still
    transform: Translate { y: root.ccm ? -(1 - root.reveal) * 26 : 0 }
    opacity: Math.min(1, root.reveal * 1.6)
    // it grows out of the top edge it hangs from
    transformOrigin: Item.Top
    scale: 0.94 + 0.06 * root.reveal

    Ito.ItoPlate {
      palette: root.pal
      anchors.fill: parent
      renderStrategy: root.ccm ? Canvas.Threaded : Canvas.Immediate
      radius: 18
      artBase: Qt.resolvedUrl("../ito-art/")
      veins: 0
      calm: 0
      grain: 0.10
      tone: 0
      border: false
    }

    Rectangle {
      anchors.fill: parent
      radius: 18
      color: "transparent"
      border.width: 1
      border.color: Qt.rgba(root.pal.blood.r, root.pal.blood.g, root.pal.blood.b, 0.5)
    }

    FocusScope {
      anchors.fill: parent
      focus: root.open

      Keys.onEscapePressed: root.close()
      Keys.onPressed: function(event) {
        if ((event.modifiers & Qt.ControlModifier) && event.key === Qt.Key_K) {
          search.forceActiveFocus()
          event.accepted = true
        }
      }

      // -------------------------------------------------------------- header
      Item {
        id: header
        x: 26
        y: 0
        width: parent.width - 52
        height: 56

        Row {
          anchors.verticalCenter: parent.verticalCenter
          spacing: 12

          Repeater {
            model: ["IKAI", "/", "CONTROL CENTER", "/", root.pageInfo(root.page).title.toUpperCase()]

            Text {
              required property string modelData
              required property int index
              text: modelData
              color: index === 4 ? root.pal.lit : root.pal.bone
              opacity: modelData === "/" ? 0.35 : (index === 4 ? 1 : 0.85)
              font.family: "Noto Serif"
              font.pixelSize: 12
              font.weight: Font.DemiBold
              font.letterSpacing: 3
            }
          }
        }

        Row {
          anchors.verticalCenter: parent.verticalCenter
          anchors.right: parent.right
          spacing: 14

          Rectangle {
            visible: acts.lastReset > 0
            anchors.verticalCenter: parent.verticalCenter
            width: undoText.implicitWidth + 24
            height: 26
            radius: 13
            color: "transparent"
            border.width: 1
            border.color: Qt.rgba(root.pal.lit.r, root.pal.lit.g, root.pal.lit.b, 0.8)
            Text { id: undoText; anchors.centerIn: parent; text: "Undo reset"; color: root.pal.lit; font.family: "Noto Serif"; font.pixelSize: 10; font.letterSpacing: 1 }
            HoverHandler { cursorShape: Qt.PointingHandCursor; onHoveredChanged: root.hint = hovered ? "Put back what the last reset removed (it was backed up; also: ito-config restore)." : "" }
            TapHandler { onTapped: acts.undoReset() }
          }

          Rectangle {
            visible: root.pageDiffers.length > 0
            anchors.verticalCenter: parent.verticalCenter
            width: pageResetText.implicitWidth + 24
            height: 26
            radius: 13
            color: "transparent"
            border.width: 1
            border.color: Qt.rgba(root.pal.blood.r, root.pal.blood.g, root.pal.blood.b, root.pageResetArmed ? 1 : 0.55)
            Text {
              id: pageResetText
              anchors.centerIn: parent
              text: root.pageResetArmed ? "Sure? Click again" : "↺ Reset page (" + root.pageDiffers.length + ")"
              color: root.pageResetArmed ? root.pal.blood : root.pal.bone
              font.family: "Noto Serif"; font.pixelSize: 10; font.letterSpacing: 1
            }
            HoverHandler { cursorShape: Qt.PointingHandCursor; onHoveredChanged: root.hint = hovered ? "Put every setting of this page back to the default. Your colours, art and layout elsewhere are not touched; a backup is kept." : "" }
            TapHandler {
              onTapped: {
                if (!root.pageResetArmed) { root.pageResetArmed = true; pageResetDisarm.restart(); return }
                root.pageResetArmed = false
                acts.resetPage(root.page, root.pageDiffers)
              }
            }
          }

          Rectangle {
            anchors.verticalCenter: parent.verticalCenter
            width: status.implicitWidth + 30
            height: 26
            radius: 13
            color: "transparent"
            border.width: 1
            border.color: Qt.rgba(root.pal.blood.r, root.pal.blood.g, root.pal.blood.b, 0.55)

            Row {
              anchors.centerIn: parent
              spacing: 8

              Rectangle {
                anchors.verticalCenter: parent.verticalCenter
                width: 7
                height: 7
                radius: 3.5
                color: root.actions.stateReady ? root.pal.blood : "transparent"
                border.width: 1
                border.color: root.pal.blood
              }

              Text {
                id: status
                anchors.verticalCenter: parent.verticalCenter
                text: (root.formNames[root.actions.currentForm] || "Islands").toUpperCase()
                  + (root.actions.stateReady ? " ACTIVE" : " NOT READY")
                color: root.pal.bone
                font.family: "Noto Serif"
                font.pixelSize: 10
                font.letterSpacing: 2
              }
            }
          }

          Rectangle {
            anchors.verticalCenter: parent.verticalCenter
            width: 30
            height: 30
            radius: 15
            color: closeHover.hovered ? Qt.rgba(root.pal.blood.r, root.pal.blood.g, root.pal.blood.b, 0.3) : "transparent"
            Behavior on color { ColorAnimation { duration: 120 } }

            Text {
              anchors.centerIn: parent
              text: "✕"
              color: root.pal.bone
              font.pixelSize: 13
            }

            HoverHandler { id: closeHover; cursorShape: Qt.PointingHandCursor }
            TapHandler { onTapped: root.close() }
          }
        }
      }

      // -------------------------------------------------------------- search
      Rectangle {
        id: searchBox
        x: 26
        y: 56
        width: parent.width - 52
        height: 40
        radius: 12
        color: Qt.rgba(root.pal.bone.r, root.pal.bone.g, root.pal.bone.b, 0.05)
        border.width: 1
        border.color: search.activeFocus ? root.pal.blood : Qt.rgba(root.pal.bone.r, root.pal.bone.g, root.pal.bone.b, 0.16)
        Behavior on border.color { ColorAnimation { duration: 120 } }

        // a magnifier, drawn: a ring and a handle
        Item {
          x: 14
          anchors.verticalCenter: parent.verticalCenter
          width: 16
          height: 16

          Rectangle {
            width: 11
            height: 11
            radius: 5.5
            color: "transparent"
            border.width: 1.6
            border.color: root.pal.bone
            opacity: 0.6
          }

          Rectangle {
            x: 9
            y: 12
            width: 7
            height: 1.6
            rotation: 45
            color: root.pal.bone
            opacity: 0.6
          }
        }

        TextInput {
          id: search
          anchors.fill: parent
          anchors.leftMargin: 42
          anchors.rightMargin: 90
          verticalAlignment: TextInput.AlignVCenter
          color: root.pal.bone
          selectionColor: root.pal.blood
          font.family: "Noto Serif"
          font.pixelSize: 13
          clip: true
          onTextChanged: root.query = text

          Text {
            visible: search.text === "" && !search.activeFocus
            anchors.verticalCenter: parent.verticalCenter
            text: "Search settings, widgets, plugins…"
            color: root.pal.bone
            opacity: 0.4
            font.family: "Noto Serif"
            font.pixelSize: 13
          }

          Keys.onEscapePressed: {
            if (text !== "") text = ""
            else root.close()
          }
        }

        Text {
          anchors.right: parent.right
          anchors.rightMargin: 16
          anchors.verticalCenter: parent.verticalCenter
          text: "CTRL K"
          color: root.pal.bone
          opacity: 0.35
          font.family: "Noto Serif"
          font.pixelSize: 10
          font.letterSpacing: 2
        }
      }

      // -------------------------------------------------------------- sidebar
      // The lit tab is a single plate that slides from one tab to the next and settles with a little spring.
      Rectangle {
        x: sidebar.x
        y: sidebar.y + root.pageIndex * 55
        width: sidebar.width
        height: 50
        radius: 12
        color: Qt.rgba(root.pal.blood.r, root.pal.blood.g, root.pal.blood.b, 0.13)
        border.width: 1
        border.color: Qt.rgba(root.pal.blood.r, root.pal.blood.g, root.pal.blood.b, 0.7)
        Behavior on y {
          NumberAnimation { duration: Math.round((root.ccm ? 240 : Motion.slow) * root.amp); easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.spring }
        }
      }

      // Section dividers: a thin line in the gap already between two rows, at a page where the section
      // changes. Positioned by the same index * 55 the highlight uses, but purely additive -- it neither
      // reads nor changes that math, so the sliding highlight is never at risk of drifting out of sync.
      Repeater {
        model: root.pages
        Rectangle {
          required property int index
          readonly property string label: root.sectionAt(index)
          visible: label !== ""
          x: sidebar.x
          y: sidebar.y + index * 55 - 4
          width: sidebar.width
          height: 1
          color: Qt.rgba(root.pal.bone.r, root.pal.bone.g, root.pal.bone.b, 0.14)
        }
      }

      Column {
        id: sidebar
        x: 26
        y: 112
        width: 216
        spacing: 5

        Repeater {
          model: root.pages

          Rectangle {
            id: tab
            required property var modelData
            readonly property bool current: root.page === modelData.key

            width: sidebar.width
            height: 50
            radius: 12
            color: tabHover.hovered && !current ? Qt.rgba(root.pal.bone.r, root.pal.bone.g, root.pal.bone.b, 0.07) : "transparent"
            border.width: 1
            border.color: current ? "transparent" : Qt.rgba(root.pal.bone.r, root.pal.bone.g, root.pal.bone.b, 0.12)
            Behavior on color { ColorAnimation { duration: Motion.fast; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.soft } }

            // the mark on the left edge, lit when this is the page
            Rectangle {
              x: -1
              anchors.verticalCenter: parent.verticalCenter
              width: 3
              height: tab.current ? 26 : 0
              radius: 1.5
              color: root.pal.blood
              Behavior on height { NumberAnimation { duration: Motion.normal; easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.spring } }
            }

            Row {
              anchors.verticalCenter: parent.verticalCenter
              anchors.left: parent.left
              anchors.leftMargin: 14
              spacing: 12

              Rectangle {
                anchors.verticalCenter: parent.verticalCenter
                width: 32
                height: 32
                radius: 9
                color: "transparent"
                border.width: 1
                border.color: tab.current ? root.pal.blood : Qt.rgba(root.pal.bone.r, root.pal.bone.g, root.pal.bone.b, 0.3)

                Text {
                  anchors.centerIn: parent
                  text: tab.modelData.kanji
                  color: tab.current ? root.pal.lit : root.pal.bone
                  opacity: tab.current ? 1 : 0.75
                  font.family: "Noto Serif CJK JP"
                  font.weight: Font.Bold
                  font.pixelSize: 16
                }
              }

              Column {
                anchors.verticalCenter: parent.verticalCenter
                spacing: 2

                Text {
                  text: tab.modelData.title
                  color: tab.current ? root.pal.lit : root.pal.bone
                  font.family: "Noto Serif"
                  font.pixelSize: 14
                  font.weight: Font.DemiBold
                }

                Text {
                  text: tab.modelData.sub
                  color: root.pal.bone
                  opacity: 0.45
                  font.family: "Noto Serif"
                  font.pixelSize: 10
                  width: 130
                  elide: Text.ElideRight
                }
              }
            }

            HoverHandler { id: tabHover; cursorShape: Qt.PointingHandCursor }
            TapHandler { onTapped: root.page = tab.modelData.key }
          }
        }
      }

      // -------------------------------------------------------------- content
      Item {
        id: content
        x: 262
        y: 112
        width: parent.width - 262 - 26
        height: parent.height - 112 - 52
        clip: true

        Flickable {
          id: flick
          anchors.fill: parent
          anchors.rightMargin: 12
          contentWidth: width
          contentHeight: pageLoader.item ? pageLoader.item.implicitHeight + 16 : 0
          boundsBehavior: Flickable.StopAtBounds
          flickableDirection: Flickable.VerticalFlick

          // ccMotion: a mouse wheel glides to its target instead of jumping a notch at a time
          NumberAnimation {
            id: wheelAnim
            target: flick; property: "contentY"
            duration: Math.round(200 * root.amp)
            easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.decel
          }
          WheelHandler {
            enabled: root.ccm && root.amp > 0
            acceptedDevices: PointerDevice.Mouse
            onWheel: function(event) {
              var max = Math.max(0, flick.contentHeight - flick.height)
              var base = wheelAnim.running ? wheelAnim.to : flick.contentY
              wheelAnim.stop()
              wheelAnim.from = flick.contentY
              wheelAnim.to = Math.max(0, Math.min(max, base - event.angleDelta.y * 0.7))
              wheelAnim.start()
            }
          }

          Loader {
            id: pageLoader
            width: root.cardTarget - 262 - 26 - 12
            onLoaded: pageIn.restart()
          }
        }

        // a search that matches something that moved to the Styles page says so, on every other page
        Rectangle {
          readonly property var hit: root.query !== "" ? (function (e) { return e && (e.page || "styles") !== root.page ? e : null })(StylesIdx.found(root.query)) : null
          visible: hit !== null
          z: 10
          anchors.top: parent.top
          anchors.right: parent.right
          anchors.rightMargin: 14
          width: foundText.implicitWidth + 28
          height: 28
          radius: 14
          color: Qt.rgba(root.pal.blood.r, root.pal.blood.g, root.pal.blood.b, 0.22)
          border.width: 1
          border.color: Qt.rgba(root.pal.blood.r, root.pal.blood.g, root.pal.blood.b, 0.7)
          Text {
            id: foundText
            anchors.centerIn: parent
            text: parent.hit ? "Found on " + root.pageInfo(parent.hit.page || "styles").title + ": " + parent.hit.name + "  →" : ""
            color: root.pal.lit
            font.family: "Noto Serif"
            font.pixelSize: 12
          }
          TapHandler { onTapped: { var to = parent.hit ? (parent.hit.page || "styles") : "styles"; root.query = ""; root.page = to } }
          HoverHandler { cursorShape: Qt.PointingHandCursor }
        }

        // a thin scroll mark, only when there is something to scroll to
        Rectangle {
          visible: flick.contentHeight > flick.height + 2
          anchors.right: parent.right
          y: flick.height * (flick.contentY / flick.contentHeight)
          width: 3
          height: Math.max(30, flick.height * (flick.height / flick.contentHeight))
          radius: 1.5
          color: root.pal.blood
          opacity: 0.7
        }
      }

      // -------------------------------------------------------------- footer
      Rectangle {
        x: 26
        y: parent.height - 46
        width: parent.width - 52
        height: 1
        color: root.pal.blood
        opacity: 0.3
      }

      Text {
        x: 26
        y: parent.height - 36
        width: parent.width - 52 - 330
        text: root.hint !== "" ? root.hint : "Hover anything to see what it does."
        color: root.pal.bone
        opacity: root.hint !== "" ? 0.85 : 0.4
        elide: Text.ElideRight
        font.family: "Noto Serif"
        font.pixelSize: 11
      }

      // who made it, quietly, in every panel
      FileView {
        id: versionFile
        path: Qt.resolvedUrl("../VERSION").toString().replace("file://", "")
        printErrors: false
      }
      Text {
        id: credit
        anchors.right: parent.right
        anchors.rightMargin: 26 + 110
        y: parent.height - 36
        text: "IKAI " + String(versionFile.loaded ? versionFile.text() : "").trim() + "  ·  by davidxap  ·  github.com/Davidxap"
        color: root.pal.bone
        opacity: creditArea.containsMouse ? 0.85 : 0.4
        font.family: "Noto Serif"
        font.pixelSize: 10
        font.letterSpacing: 1
        font.underline: creditArea.containsMouse
        Behavior on opacity { NumberAnimation { duration: Math.round(Motion.fast * root.amp) } }
        MouseArea {
          id: creditArea
          anchors { fill: parent; margins: -4 }
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onClicked: Quickshell.execDetached(["xdg-open", "https://github.com/Davidxap/ikai-shell"])
        }
      }

      Text {
        anchors.right: parent.right
        anchors.rightMargin: 26
        y: parent.height - 36
        text: "ESC to close"
        color: root.pal.bone
        opacity: 0.35
        font.family: "Noto Serif"
        font.pixelSize: 10
        font.letterSpacing: 2
      }
    }
  }
}
