.pragma library

// wttr.in's weather codes, mapped onto the glyphs ItoGlyph can draw.
//
// wttr returns a WWO code, not an open-meteo one. The buckets below are the ones the drawing hand
// actually distinguishes: a clear sky, a sky with something in it, water falling, ice falling, the
// sky breaking open, and fog. Anything unknown falls to cloud, never to a blank.

function kind(code, night) {
  var c = parseInt(String(code || "0"), 10)
  if (c === 113) return night ? "moon" : "sun"
  if (c === 116) return night ? "cloud" : "suncloud"
  if (c === 119 || c === 122) return "cloud"
  if (c === 143 || c === 248 || c === 260) return "fog"
  if (c === 200 || c === 386 || c === 389 || c === 392 || c === 395) return "storm"
  if ([227, 230, 179, 182, 185, 281, 284, 311, 314, 317, 320, 323, 326, 329, 332, 335, 338,
       350, 362, 365, 368, 371, 374, 377].indexOf(c) >= 0) return "snow"
  if ([176, 263, 266, 293, 296, 299, 302, 305, 308, 353, 356, 359].indexOf(c) >= 0) return "rain"
  return "cloud"
}

// wttr gives hourly times as "0", "300", "600" ... "2100".
function hourOf(value) {
  var n = parseInt(String(value || "0"), 10)
  return Math.floor(n / 100)
}

function isNight(hour) {
  return hour < 7 || hour >= 20
}

function pad(n) {
  return (n < 10 ? "0" : "") + n
}
