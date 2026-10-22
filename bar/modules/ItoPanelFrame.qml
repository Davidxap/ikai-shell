import QtQuick 6.11
import "ItoFrameStyles.js" as Styles

// A popup drawn as a manga panel: ink, a ruled frame with a second thin rule inside it, torn corners, a
// spatter of blood in one corner and a screentone patch in another, and a faint mist along the bottom.
//
// Drop one inside a Panel's content (it draws over the card the shell paints and under the content (a negative z would sink it below the card's own fill, so the content holder is lifted one step instead), and it
// takes that card's place: the card is made see-through and square so the frame is the only edge). Colours
// come from the shell's palette, so it follows the theme. It is all static: nothing here repaints or runs
// while the popup is open or shut, and `look` = false hands the plain card back.
Item {
  id: root

  property var cfg: null
  // Set by the panel: `opened` (for the flash on opening), `alert` (something is wrong: the frame cracks), and
  // `memo` (one small line at the foot, in the voice of a note found in a drawer).
  property bool opened: false
  property bool alert: false
  // the lore `critical` state (the real eye turns into the spiral); no panel sets it yet
  property bool critical: false
  property string memo: ""
  // Several notes: one is chosen each time the popup opens, so it does not always say the same thing.
  property var memos: []
  property string shownMemo: memo
  // The sign at the head (see ItoCrest for every kind): eye, spiral, waves, signal, rune, flame, clock, phone, mind,
  // needle (processor), web (memory), amigara (storage), or a kind of sky.
  property string emblem: "eye"
  // Popup presence (ito-panel-presence): `host` is the KeyboardPanel this frame sits in (null for a popup whose window is the card plus
  // a margin), `content` the Item whose visible children come in one after another, `barSide` where the bar is. With the sidecar
  // flag `presence` off (the default) none of this is created and the popup opens exactly as before.
  property var host: null
  property Item content: null
  property string barSide: host && host.barPos ? String(host.barPos) : "top"
  readonly property bool presenceOn: on && cfg !== null && cfg.get("presence", true) === true
  // true while the sheet folds back: a host whose window would unmap at once keeps itself visible for this long
  readonly property bool hold: presLoader.item ? presLoader.item.hold : false
  readonly property var presence: presLoader.item
  readonly property real amp: cfg && cfg.motionAmp !== undefined ? cfg.motionAmp : 1
  property url artBase: Qt.resolvedUrl("ito-art/")
  // A short popup (the player) has no free corner for the blood and the spiral.
  readonly property bool roomy: height >= 260
  readonly property bool on: cfg ? cfg.get("panelFrame", true) !== false : true
  // the manga art (sidecar `frameArt`: png = today's pictures, drawn = manga v2) and where the icon meets the bar edge, for the speed lines
  readonly property string styleKey: Styles.resolve(cfg ? cfg.get("frameStyle", "manga") : "manga")
  readonly property string frameArt: Styles.artMode(cfg ? cfg.get("frameArt", "png") : "png")
  readonly property real anchorAlong: host && host.anchorScreenPos && host.cardOrigin
    ? ((barSide === "left" || barSide === "right") ? host.anchorScreenPos.y + host.anchorH / 2 - host.cardOrigin.y : host.anchorScreenPos.x + host.anchorW / 2 - host.cardOrigin.x)
    : -1

  // The card the shell draws around a popup's content is two levels up: content holder -> card.
  // Found once, at start: binding `parent` to a value that itself reads `parent` is a loop.
  property var card: null
  // Set `target` to frame any plain Item (the calendar, the forecast); left empty, the frame finds the card the
  // shell paints around a popup's content.
  property Item target: null
  // Only the shell's card has these to take over (a see-through fill, square corners, headroom for the eye).
  // Decided once at start: reading `topPadding` here while a Binding writes it would be a loop.
  property bool hostCard: false
  anchors.fill: card
  Component.onCompleted: {
    if (target) { parent = target; card = target; return }
    const holder = parent
    if (holder && holder.parent) {
      const c = holder.parent
      parent = c; card = c; holder.z = 1
      hostCard = ("topPadding" in c)
    }
  }
  Binding { target: root.card; property: "bottomPadding"; value: root.card ? root.card.padding + (root.cfg ? root.cfg.panelFootroom : 0) : 0; when: root.on && root.hostCard }
  z: 0
  visible: on

  readonly property color bone: cfg ? cfg.bone : palette.windowText
  readonly property color ink: cfg ? cfg.ink : palette.window

  Binding { target: root.card; property: "color"; value: "transparent"; when: root.on && root.hostCard }
  Binding { target: root.card; property: "radius"; value: 3; when: root.on && root.hostCard }
  // the content starts a little lower, so the eye at the top edge has room; the panel adds the same to its height
  Binding { target: root.card; property: "topPadding"; value: root.card ? root.card.padding + (root.cfg ? root.cfg.panelHeadroom : 0) : 0; when: root.on && root.hostCard }

  // the sheet that grows out of the bar icon (flag `presence`): it draws the paper and the outer rule while it exists
  Loader {
    id: presLoader
    anchors.fill: parent
    active: root.presenceOn
    sourceComponent: ItoPresence {
      cfg: root.cfg
      opened: root.opened
      card: root.card
      host: root.host
      content: root.content
      barSide: root.barSide
      ink: root.ink; bone: root.bone
      blood: root.cfg ? root.cfg.blood : root.palette.highlight
      alert: root.alert
      styleRadius: Styles.radius(root.styleKey)
      ruleAlpha: Styles.ruleAlpha(root.styleKey)
    }
  }
  // the eyelids (flag `presenceReveal: lid`): over the card and its content, only while an open or a close runs
  Loader {
    parent: root.card
    z: 500
    x: 0; y: 0
    width: root.card ? root.card.width : 0
    height: root.card ? root.card.height : 0
    active: presLoader.item !== null && presLoader.item.engaged && presLoader.item.runLid
    sourceComponent: ItoPresenceLids {
      pres: presLoader.item
      paper: root.ink; line: root.bone
      blood: root.cfg ? root.cfg.blood : root.palette.highlight
      alert: root.alert
    }
  }

  // the spiral / blot opening (flag `presenceReveal: spiral | blot`): the card's own layer is masked by a baked time map, only while a
  // masked open or close runs (inert at rest; kept alive while the flag is on, see ItoPresenceMask).
  Loader {
    parent: root.card
    z: 500
    x: 0; y: 0
    width: root.card ? root.card.width : 0
    height: root.card ? root.card.height : 0
    active: presLoader.item !== null && (presLoader.item.maskKind !== "" || presLoader.item.runMask !== "")
    sourceComponent: ItoPresenceMask {
      pres: presLoader.item
      card: root.card
      run: presLoader.item !== null && presLoader.item.engaged && presLoader.item.runMask !== ""
      kind: presLoader.item && presLoader.item.runMask !== "" ? presLoader.item.runMask : (presLoader.item ? presLoader.item.maskKind : "spiral")
      side: root.barSide
      edgeColor: root.bone
    }
  }

  // the paper
  Rectangle {
    anchors.fill: parent
    radius: Styles.radius(root.styleKey)
    visible: !root.presenceOn
    color: Qt.rgba(root.ink.r, root.ink.g, root.ink.b, 1)
  }

  SequentialAnimation {
    id: flash
    NumberAnimation { target: staticFlash; property: "opacity"; from: 0.5; to: 0.05; duration: 70 }
    NumberAnimation { target: staticFlash; property: "opacity"; to: 0.28; duration: 40 }
    NumberAnimation { target: staticFlash; property: "opacity"; to: 0; duration: 110 }
  }
  // live check (scripts/qa/popup-anchor-live.sh): with the sidecar flag `debugAnchor` on, a popup that opens logs where its card
  // and its icon sit, in screen px; off (the default) nothing runs
  function logAnchor() {
    if (!host || !host.cardOrigin || !cfg || cfg.get("debugAnchor", false) !== true) return
    console.log("ito-anchor " + emblem + " cardX=" + host.cardOrigin.x + " cardY=" + host.cardOrigin.y
      + " cardW=" + host.contentWidth + " cardH=" + host.contentHeight
      + " iconX=" + host.anchorScreenPos.x + " iconW=" + host.anchorW + " barH=" + host.barH + " screenW=" + host.screenW)
  }
  // debug-only frame probe (sidecar flag `debugFrames`, default off): the loader is empty and nothing exists or runs unless it is on
  Loader {
    id: probeLoader
    active: root.cfg !== null && root.cfg.get("debugFrames", false) === true
    source: "ItoFrameProbe.qml"
    onLoaded: item.label = root.emblem
  }
  onOpenedChanged: {
    if (probeLoader.item) probeLoader.item.edge(opened)
    if (opened) Qt.callLater(logAnchor)
    if (opened && memos.length > 0) shownMemo = String(memos[Math.floor(Math.random() * memos.length)])
    // the opening finisher belongs to the manga style (today's static burst, or the speed lines of the drawn art) and to otherworld (the same
    // burst); chains sway, minimal has none
    if (opened && amp > 0 && on && styleKey === "manga") {
      if (frameArt === "drawn" && styleLoader.item && styleLoader.item.finish) styleLoader.item.finish()
      else flash.restart()
    } else if (opened && amp > 0 && on && styleKey === "otherworld") flash.restart()
  }
  // the Otherworld alert is announced with the same burst, once, when it is raised while the popup is open
  onAlertChanged: if (alert && opened && amp > 0 && on && styleKey === "otherworld") flash.restart()
  onMemoChanged: if (memos.length === 0) shownMemo = memo

  readonly property bool realEye: !!cfg && (cfg.eyeFamily !== undefined ? cfg.eyeFamily : cfg.eyeStyle) === "shaded"
  // where the pointer is, in the emblem's coordinates (null when it is not over the head of the popup or the card): the real eye follows it. Only a moving
  // real eye asks (eyes-animation.md): for every other emblem and style this is null and nothing is mapped.
  readonly property var crestPointer: {
    if (!realEye || !cfg || !(cfg.eyeLevel > 0) || !on) return null
    var h = headHover.hovered ? headHover.point.position : (cardHover.hovered ? cardHover.point.position : null)
    return h ? eye.mapFromItem(root, h.x, h.y) : null
  }
  // everything else the frame draws: with the presence sheet it comes in on `reveal`, after the sheet has its ink
  Item {
    id: art
    anchors.fill: parent
    opacity: root.presenceOn && presLoader.item ? presLoader.item.ph.reveal : 1

  // the frame style (sidecar `frameStyle`, default manga; ItoFrameStyles.js): one Loader of ItoFrame<Name>.qml fills the card with the
  // style's ornaments and rules. The emblem, the memo and the opening flash below are the same for every style.
  Loader {
    id: styleLoader
    anchors.fill: parent
    active: root.on
    source: Styles.file(root.styleKey)
  }
  Binding { target: styleLoader.item; property: "cfg"; value: root.cfg; when: styleLoader.item !== null }
  Binding { target: styleLoader.item; property: "ink"; value: inkLoader.item; when: styleLoader.item !== null }
  Binding { target: styleLoader.item; property: "alert"; value: root.alert; when: styleLoader.item !== null }
  Binding { target: styleLoader.item; property: "live"; value: root.opened; when: styleLoader.item !== null }
  Binding { target: styleLoader.item; property: "amp"; value: root.amp; when: styleLoader.item !== null }
  Binding { target: styleLoader.item; property: "k"; value: Math.max(0.8, Math.min(1.15, root.width / 380)); when: styleLoader.item !== null && root.width > 0 }
  Binding { target: styleLoader.item; property: "barSide"; value: root.barSide; when: styleLoader.item !== null }
  Binding { target: styleLoader.item; property: "art"; value: root.frameArt; when: styleLoader.item !== null }
  Binding { target: styleLoader.item; property: "roomy"; value: root.roomy; when: styleLoader.item !== null }
  Binding { target: styleLoader.item; property: "sheet"; value: root.presenceOn; when: styleLoader.item !== null }
  Binding { target: styleLoader.item; property: "reveal"; value: root.presenceOn && presLoader.item ? presLoader.item.ph.reveal : 1; when: styleLoader.item !== null }
  Binding { target: styleLoader.item; property: "anchorAlong"; value: root.anchorAlong; when: styleLoader.item !== null }
  // the inks of the styles that need them (the drawn manga art, chains, otherworld): built only then, over a forced-tinted palette
  ItoPanelPalette { id: framePalette; source: root.cfg }
  Loader {
    id: inkLoader
    active: root.on && (root.styleKey !== "manga" || root.frameArt === "drawn")
    sourceComponent: ItoFrameInk { source: framePalette }
  }

  // a note left at the foot
  Text {
    visible: root.shownMemo !== ""
    text: root.shownMemo
    anchors { bottom: parent.bottom; horizontalCenter: parent.horizontalCenter; bottomMargin: 5 }
    color: Qt.rgba(root.bone.r, root.bone.g, root.bone.b, 0.38)
    font.family: "Noto Serif"
    font.pixelSize: 9
    font.italic: true
    font.letterSpacing: 0.6
    renderType: Text.NativeRendering
  }

  // Opening flickers like a television changing channel: a burst of static that thins out in a fifth of a second.
  ItoImage {
    id: staticFlash
    palette: root.cfg
    anchors { fill: parent; margins: 1 }
    source: root.artBase + "decor/static.png"
    fillMode: Image.Tile
    opacity: 0
    visible: opacity > 0.01
    smooth: false
  }
  // The emblem at the top edge, dim; the pointer near the head of the popup brings it up.
  Item {
    id: eye
    // small enough to sit inside the frame without touching the rule
    // The room the popup leaves under it is ItoConfig.panelHeadroom: keep the two in step.
    width: 92; height: 28
    anchors { horizontalCenter: parent.horizontalCenter; top: parent.top; topMargin: 6 }
    readonly property bool awake: headHover.hovered && root.amp > 0
    opacity: awake ? 1 : (styleLoader.item && styleLoader.item.emblemOpacity !== undefined ? styleLoader.item.emblemOpacity : 0.85)
    Behavior on opacity { NumberAnimation { duration: 160 * Math.min(root.amp, 1) } }
    // the eye's lid: squashed from the middle while it sleeps, full height once it is looked at
    transform: Scale {
      origin.x: eye.width / 2
      origin.y: eye.height / 2
      yScale: (eye.awake || root.emblem !== "eye" || root.realEye) ? 1 : 0.86
      Behavior on yScale { NumberAnimation { duration: 200 * Math.min(root.amp, 1); easing.type: Easing.OutCubic } }
    }
    // Drawn as vector curves, so it stays sharp and takes the theme's colours.
    ItoCrest {
      anchors.fill: parent
      kind: root.emblem
      live: root.opened
      amp: root.amp
      bone: root.bone
      blood: root.cfg ? root.cfg.blood : root.palette.highlight
      ink: root.ink
      tints: root.cfg
      eyeStyle: root.cfg && root.cfg.eyeStyle !== undefined ? root.cfg.eyeStyle : "shaded"
      hot: root.alert
      critical: root.critical
      crestEye: root.cfg && root.cfg.crestEye !== undefined ? root.cfg.crestEye : "auto"
      eyeLevel: root.cfg && root.cfg.eyeLevel !== undefined ? root.cfg.eyeLevel : 0
      pointer: root.crestPointer
    }
  }

  }

  // the whole card: the eye follows the pointer over it where the content does not take the hover for itself
  HoverHandler { id: cardHover; enabled: root.on && root.realEye && root.cfg && root.cfg.eyeLevel > 0 }

  // the head of the popup: the top 64 px
  Item {
    id: head
    anchors { top: parent.top; left: parent.left; right: parent.right }
    height: 64
    HoverHandler { id: headHover; enabled: root.on }
  }
}

