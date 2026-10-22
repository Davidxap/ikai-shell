.pragma library

// The emblem at the head of a popup is the widget's CURRENT icon (the same picture, in the same style, that the bar draws), not an older
// drawing of its own. `art(kind, aiStyle)` is the sheet picture an emblem stands for, relative to ito-art/, or "" for an emblem that has no
// bar icon (the clock): ItoImage then draws it in the family's style (current / manga / gothic, iconStyle + iconStyleOverrides).
var ART = {
  eye: "instruments/display-3.png",
  waves: "instruments/vol-3.png",
  rune: "instruments/bt-linked.png",
  signal: "instruments/net-3.png",
  flame: "instruments/bat-4.png",
  phone: "notifications/notification.png",
  spiral: "media/media-play.png",
  needle: "system/cpu.png",
  web: "system/mem.png",
  amigara: "system/disk.png",
  sun: "instruments/sky-sun.png", moon: "instruments/sky-moon.png", cloud: "instruments/sky-cloud.png", rain: "instruments/sky-rain.png",
  storm: "instruments/sky-storm.png", snow: "instruments/sky-snow.png", fog: "instruments/sky-fog.png"
}
// the emblems that are a level icon (cpu, mem, disk, ai) show a mid level
var LEVEL = { needle: true, web: true, amigara: true, mind: true }
function art(kind, aiStyle) {
  if (kind === "mind") { var a = String(aiStyle || "brain"); return a === "brain" ? "system/brain.png" : "system/ai-" + a + ".png" }
  return ART[kind] || ""
}
function isLevel(kind) { return LEVEL[kind] === true }
function kinds() { return Object.keys(ART).concat(["mind"]) }
