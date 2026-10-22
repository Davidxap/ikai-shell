import QtQuick

// A sheet image that follows the shell's colour mode.
//
// The pre-drawn art is bone and crimson. With the shell following the installed theme, a shader moves both
// onto the theme (bone to its foreground, crimson to its accent) while keeping every pixel's brightness, so
// the engraving survives. With the shell on its own palette it costs nothing: the effect only exists
// while there is a theme to follow.
//
// That rule only holds for art drawn that way. A picture the user chose themselves (a manga panel, a photo) is
// full of colour and shade the shader has no rule for; pushed through it, every tone gets flattened onto the
// two or three colours of the theme and the picture is ruined. `tintable: false` leaves a picture exactly as
// the user chose it, whatever the theme.
import "ItoIconMap.js" as IconMap
import "ItoIconInk.js" as IconInk

Image {
  id: root

  // The ItoConfig the colours come from (any widget's own instance will do).
  property var palette: null
  property bool tintable: true
  // `iconStyle: manga` (icons-v3.md): a picture the map knows (the six pilot icons, by file name) is drawn by ItoIconBake
  // instead, from the same palette's tokens. Anything else, a user picture or `current`, is this Image exactly as before.
  property string iconStyle: palette && palette.iconStyle ? String(palette.iconStyle) : "current"
  property real level: -1           // the 0..1 level of a level icon (disk, cpu, mem), set by ItoFillArt
  // the per-icon overrides (sidecar key `iconStyleOverrides`, "ai=current, media=manga"): a family can keep the old drawing or opt in
  // whatever the global style says; "*" (the Control Centre's previews) ignores them
  property string iconOverrides: palette && palette.iconStyleOverrides ? String(palette.iconStyleOverrides) : ""
  // YOUR OWN ART (ItoUserArt.js): when the user drew this picture, `userUrl` is their file and it is shown instead of the shipped one
  // (same recolour); it also beats the manga drawing for that icon kind, unless `iconStyleOverrides` names the kind as manga explicitly.
  readonly property url userUrl: palette && typeof palette.userArt === "function" && tintable ? palette.userArt(String(source)) : ""
  readonly property bool userKind: {
    if (!palette || !palette.userKinds || !tintable) return false
    var m = IconMap.lookup(source, tintable)
    return !!m && palette.userKinds[m.kind] === true && IconMap.parseOverrides(iconOverrides)[m.kind] !== "manga"
  }
  // S17e `shPack` (ItoIconMap.shBase): the Silent Hill skin of this picture from the user's sprite sheet, or none (pack off, a picture the pack
  // does not skin, no file at this size): then everything below is as before. It beats the manga and gothic drawings; the user's own file beats it.
  // `skins: false` (the Icons chooser's previews of the other drawings) never shows a Silent Hill skin, whatever the user picked
  property bool skins: true
  readonly property string shBase: skins && palette && tintable && palette.shChoices !== undefined && userUrl.toString() === "" ? IconMap.shBase(palette.shChoices, String(source), tintable) : ""
  readonly property var shPick: shBase !== "" && typeof palette.userBar === "function" ? palette.userBar(shBase, gothicWant, "v9") : null
  readonly property bool sh: !!shPick
  readonly property var manga: userKind || sh ? null : IconMap.drawn(iconStyle, iconOverrides, String(source), tintable)
  readonly property var mangaRoles: manga && palette && palette.bone !== undefined
    ? IconInk.roles({ blood: palette.blood, lit: palette.lit || palette.blood, bone: palette.bone, ink: palette.ink, warn: palette.warn || palette.blood }, palette.ink,
      { tone: palette.iconTone === "ink" ? "ink" : "theme", surface: palette.iconGround || palette.ink }) : null
  readonly property bool drawn: !!manga && !!mangaRoles
  // `iconStyle gothic` (S18, ItoIconMap.gothic*): the user's sheet-cut tier file of this icon, or none (a family the sheet does not draw, a tier below
  // the icon's floor, no file yet, a file that failed): the current picture then shows as before. The device size is the item's size x the screen's scale.
  readonly property string gothicBase: palette && tintable && userUrl.toString() === "" ? IconMap.gothicBase(iconStyle, iconOverrides, String(source), tintable) : ""
  readonly property int gothicWant: Math.round(Math.min(width, height) * Math.max(1, Screen.devicePixelRatio))
  readonly property var gothicPick: gothicBase !== "" && !drawn && !sh && typeof palette.userBar === "function" && IconMap.gothicFor(gothicBase, gothicWant) !== null
    ? palette.userBar(gothicBase, gothicWant, "v9") : null
  readonly property bool gothic: !!gothicPick
  // a drawn icon moves itself (ItoIconLive, icons-v3.md section 5), so ItoHover keeps only its halo for it
  readonly property bool ownsMotion: drawn
  function hoverEdge(on) { if (mangaLoader.item) mangaLoader.item.hoverEdge(on) }

  fillMode: Image.PreserveAspectFit
  smooth: true
  mipmap: true

  layer.enabled: !!palette && palette.tinted && tintable && !drawn
  // The tinted copy is rendered once and then scaled by whatever animates the icon (the workspace mark pops out
  // when it becomes active); left unsmoothed that scaling is nearest-neighbour and pixelates the drawing.
  layer.smooth: true
  layer.mipmap: true
  layer.effect: ItoThemeEffect { palette: root.palette }

  // drawn: the Image shows one transparent corner pixel of its art (every sheet PNG has a clear margin), the bake shows the icon
  // the same trick shows the user's file: this Image keeps the shipped source (the map and the roles read it) and paints its one clear corner
  sourceClipRect: drawn || gothic || sh || userUrl.toString() !== "" ? Qt.rect(0, 0, 1, 1) : Qt.rect(0, 0, 0, 0)
  Image {
    id: userImg
    anchors.fill: parent
    visible: root.userUrl.toString() !== ""
    source: root.userUrl
    fillMode: root.fillMode
    smooth: true
    mipmap: true
    onStatusChanged: if (status === Image.Error && root.palette && typeof root.palette.userFail === "function") root.palette.userFail(String(root.userUrl))
  }
  Image {
    id: gothicImg
    anchors.fill: parent
    visible: root.gothic
    source: root.gothic ? String(root.gothicPick.url) : ""
    sourceSize: root.gothic ? Qt.size(root.gothicPick.px, root.gothicPick.px) : Qt.size(0, 0)   // the exact tier file, never resampled up
    fillMode: root.fillMode
    smooth: true
    mipmap: false
    onStatusChanged: if (status === Image.Error && root.palette && typeof root.palette.userFail === "function") root.palette.userFail(String(source))
  }
  Image {
    id: shImg
    anchors.fill: parent
    visible: root.sh
    source: root.sh ? String(root.shPick.url) : ""
    sourceSize: root.sh ? Qt.size(root.shPick.px, root.shPick.px) : Qt.size(0, 0)   // the exact tier file, never resampled up
    fillMode: root.fillMode
    smooth: true
    mipmap: false
    onStatusChanged: if (status === Image.Error && root.palette && typeof root.palette.userFail === "function") root.palette.userFail(String(source))
  }
  Loader {
    id: mangaLoader
    active: root.drawn && root.visible
    anchors.centerIn: parent
    sourceComponent: ItoIconLive {
      kind: root.manga.kind
      amp: root.palette && root.palette.motionAmp !== undefined ? Number(root.palette.motionAmp) : 0
      omens: !root.palette || root.palette.iconOmens !== false
      motionSeed: {
        var s = String(root.source), h = 17
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973
        return h + 1
      }
      iconState: {
        var s = JSON.parse(JSON.stringify(root.manga.state))
        if (root.manga.level && root.level >= 0) s.value = root.level
        return s
      }
      size: Math.max(8, Math.round(Math.min(root.width, root.height)))
      roles: root.mangaRoles
    }
  }
}
