.pragma library

// How large a popup may be, whichever edge the bar is on.
//
// Omarchy's own panel measures the room left beside the bar from the bar's window. This engine's bar window covers
// the whole screen (the bar itself is drawn and masked inside it), so that measure comes back as 120 px on a side
// bar and the popup is squeezed to a sliver. These take the bar's real thickness from `bar.barSize` instead.

function thickness(panel) {
  return panel.bar && panel.bar.barSize ? Number(panel.bar.barSize) : 46
}

// The bar window's size across the bar (its height on a top or bottom bar, its width on a side bar): the shell's KeyboardPanel
// reads it as "how far the bar reaches", and this engine's window covers the whole screen, so it is the screen's size.
function extent(panel) {
  var pos = panel.barPos
  var e = (pos === "left" || pos === "right") ? Number(panel.barW) : Number(panel.barH)
  return e > 0 ? e : thickness(panel)
}

// The gap the shell's KeyboardPanel should be given so the popup sits right under (or beside) the bar and not at the far
// edge of the screen. The panel puts the card at `extent + gap` from the edge the bar is on (a bottom or right bar mirrors
// it); with a full-screen bar window `extent` is the whole screen, so the card landed at the opposite edge. This takes the
// extent back out: extent + gapFor = the bar's real thickness + the usual gap (`panel.margin`, the shell's gapsOut).
function gapFor(panel) {
  return Math.round(thickness(panel) + (Number(panel.margin) || 0) - extent(panel))
}

function popupWidth(panel, desired) {
  var pos = panel.barPos
  var side = (pos === "left" || pos === "right") ? extent(panel) + panel.gap + panel.margin : panel.margin * 2
  var avail = panel.screenW > 0 ? panel.screenW - side : desired
  return Math.round(Math.max(Math.min(desired, 240), Math.min(desired, avail)))
}

function popupHeight(panel, implicitHeight, cap) {
  var pos = panel.barPos
  var desired = Math.max(panel.verticalContentInset, (Number(implicitHeight) || 0) + panel.verticalContentInset)
  var edge = (pos === "top" || pos === "bottom") ? extent(panel) + panel.gap + panel.margin : panel.margin * 2
  var avail = panel.screenH > 0 ? panel.screenH - edge : desired
  var most = cap !== undefined && Number(cap) > 0 ? Math.min(avail, Number(cap)) : avail
  // Never below 124 px: the bar engine "repairs" any popup of 120 px or less (Omarchy's own safety minimum) by
  // rewriting its height from the content it measures, and the popup's frame counts as content, so a short popup
  // (an empty notification list, Bluetooth with no adapter) grew every time it was measured.
  return Math.round(Math.max(124, Math.min(desired, most)))
}

// Where a popup that has its own window (the forecast, the AI usage) starts along the bar, so it sits under its icon.
//
// `iconStart`/`iconSize` are the icon's place on the screen along the bar (x on a top or bottom bar, y on a side bar),
// `cardSize` the popup window's size along the same axis, `screenSize` the screen's, `margin` the room kept at both ends.
// The popup is centred on the icon, then clamped so it never leaves the screen; if the screen is too small for it, it
// starts at the margin.
function alongStart(iconStart, iconSize, cardSize, screenSize, margin) {
  var ideal = Number(iconStart) + Number(iconSize) / 2 - Number(cardSize) / 2
  var lo = Number(margin) || 0
  var hi = Math.max(lo, Number(screenSize) - Number(cardSize) - lo)
  return Math.round(Math.max(lo, Math.min(ideal, hi)))
}

if (typeof module !== "undefined" && module.exports) module.exports = { alongStart: alongStart, gapFor: gapFor, extent: extent, popupWidth: popupWidth, popupHeight: popupHeight, thickness: thickness }
