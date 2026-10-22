// The date and time logic of the clock and the calendar, kept pure so node can test it (scripts/qa/time.test.mjs).
//
// Dates are CIVIL: { y, m (1-12), d }. Every step goes through a day number (days since 1970-01-01 from Date.UTC), never
// through a local `Date` or `+ 86400000`, so the answer does not depend on the machine's time zone: a DST night, a
// midnight DST in Sao Paulo or the skipped day in Samoa (2011-12-30) cannot repeat or drop a cell. weekday 0 is Sunday.
//
// Nothing here reads the clock. The caller passes the moment (ms, hour, minute) it wants formatted.

var DAY_MS = 86400000
var SYNODIC = 29.530588853                 // days between two new moons
var NEW_MOON_REF = 947182440000            // 2000-01-06T18:14Z, a new moon

var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
var MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
var DAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
var MOON_NAMES = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"]
var KANJI = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"]

function pad2(n) { return (n < 10 ? "0" : "") + n }

// ---------------------------------------------------------------------------------------------- civil dates
function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 }

function daysInMonth(y, m) {
  if (m === 2) return isLeap(y) ? 29 : 28
  return (m === 4 || m === 6 || m === 9 || m === 11) ? 30 : 31
}

// setUTCFullYear keeps years 0-99 as written; Date.UTC would map them to 1900-1999
function dayNumber(c) {
  var t = new Date(0)
  t.setUTCFullYear(c.y, c.m - 1, c.d)
  return Math.round(t.getTime() / DAY_MS)
}

function fromDayNumber(n) {
  var t = new Date(n * DAY_MS)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

function weekday(c) { return (((dayNumber(c) + 4) % 7) + 7) % 7 }
function key(c) { return c.y * 10000 + c.m * 100 + c.d }
function fromKey(k) { return { y: Math.floor(k / 10000), m: Math.floor(k / 100) % 100, d: k % 100 } }
function dayOfYear(c) { return dayNumber(c) - dayNumber({ y: c.y, m: 1, d: 1 }) + 1 }
function moveDays(c, n) { return fromDayNumber(dayNumber(c) + n) }
function diffDays(a, b) { return dayNumber(b) - dayNumber(a) }

function addMonths(y, m, step) {
  var i = y * 12 + (m - 1) + step
  return { y: Math.floor(i / 12), m: ((i % 12) + 12) % 12 + 1 }
}

// ISO 8601: the week belongs to the year of its Thursday
function isoWeek(c) {
  var n = dayNumber(c)
  var thursday = fromDayNumber(n + 3 - ((weekday(c) + 6) % 7))
  return { year: thursday.y, week: Math.floor((dayNumber(thursday) - dayNumber({ y: thursday.y, m: 1, d: 1 })) / 7) + 1 }
}

// `localeFirstDay` is Qt's number (7 or 0 is Sunday, 1 Monday ... 6 Saturday); the result is 0 Sunday .. 6 Saturday
function resolveWeekStart(setting, localeFirstDay) {
  if (setting === "monday") return 1
  if (setting === "sunday") return 0
  if (setting === "saturday") return 6
  if (typeof localeFirstDay === "number" && isFinite(localeFirstDay)) return ((Math.round(localeFirstDay) % 7) + 7) % 7
  return 1
}

// 6 rows of 7 cells, the first the week-start day on or before the 1st. weeks[r] is the ISO week of row r's Monday cell.
function monthGrid(y, m, weekStart) {
  var first = { y: y, m: m, d: 1 }
  var start = dayNumber(first) - ((weekday(first) - weekStart + 7) % 7)
  var cells = [], weeks = []
  for (var i = 0; i < 42; i++) {
    var c = fromDayNumber(start + i)
    var col = i % 7, row = Math.floor(i / 7)
    cells.push({ y: c.y, m: c.m, d: c.d, key: key(c), inMonth: c.y === y && c.m === m, col: col, row: row, weekday: (weekStart + col) % 7 })
    if (((weekStart + col) % 7) === 1) weeks[row] = isoWeek(c).week
  }
  return { cells: cells, weeks: weeks }
}

// ---------------------------------------------------------------------------------------------- the moon
// The mean lunation from a known new moon: good to about a day, which is all a glyph needs.
// index: 0 new, 2 first quarter, 4 full, 6 last quarter.
function moonPhase(ms) {
  var age = (((ms - NEW_MOON_REF) / DAY_MS) % SYNODIC + SYNODIC) % SYNODIC
  var index = Math.floor(age / SYNODIC * 8 + 0.5) % 8
  return {
    age: age,
    illum: (1 - Math.cos(2 * Math.PI * age / SYNODIC)) / 2,
    waxing: age < SYNODIC / 2,
    index: index,
    name: MOON_NAMES[index]
  }
}

// ---------------------------------------------------------------------------------------------- formatting
function kanjiDigits(str) {
  return String(str).replace(/[0-9]/g, function (d) { return KANJI[+d] })
}

function kanjiMonth(m) {
  if (m < 10) return KANJI[m] + "月"
  return "十" + (m > 10 ? KANJI[m - 10] : "") + "月"
}

// 24 h pads the hour; 12 h does not (the face reserves the width). `numerals` is "western" or "kanji".
function formatClock(h, m, s, opts) {
  var o = opts || {}
  var hh = o.hour12 ? String((h % 12) || 12) : pad2(h)
  var out = { hh: hh, mm: pad2(m), ss: o.seconds ? pad2(s) : "", meridiem: o.hour12 ? (h < 12 ? "am" : "pm") : "" }
  if (o.numerals === "kanji") { out.hh = kanjiDigits(out.hh); out.mm = kanjiDigits(out.mm); out.ss = kanjiDigits(out.ss) }
  return out
}

function relativeDays(n) {
  if (n === 0) return ""
  if (n === 1) return "tomorrow"
  if (n === -1) return "yesterday"
  return n > 0 ? "in " + n + " days" : (-n) + " days ago"
}

// ---------------------------------------------------------------------------------------------- zones (text typed by the user)
// "Tokyo=Asia/Tokyo, NYC=America/New_York" -> at most 3 entries. A zone reaches a command line, so it must be a plain
// Area/Location name: letters first, then up to two /segments of letters, digits, _ + -. Nothing else ever passes.
var ZONE_RE = /^[A-Za-z]+(\/[A-Za-z0-9_+-]+){0,2}$/

function parseZones(str) {
  var out = []
  var parts = String(str || "").split(",")
  for (var i = 0; i < parts.length && out.length < 3; i++) {
    var p = parts[i].trim()
    if (p === "") continue
    var eq = p.indexOf("=")
    var zone = (eq < 0 ? p : p.slice(eq + 1)).trim()
    var label = eq < 0 ? zone.split("/").pop().replace(/_/g, " ") : p.slice(0, eq).trim()
    label = label.replace(/[^\x20-\x7e]/g, "").slice(0, 12)
    out.push({ label: label, zone: zone, ok: ZONE_RE.test(zone) })
  }
  return out
}

// stdout of one `date +%z` per zone, `?` for an unknown zone -> minutes east of UTC, or null
function parseOffsets(stdout) {
  var lines = String(stdout || "").split("\n"), out = []
  for (var i = 0; i < lines.length; i++) {
    var t = lines[i].trim()
    if (t === "" && i === lines.length - 1) continue
    var mm = /^([+-])(\d{2})(\d{2})$/.exec(t)
    if (!mm || +mm[2] > 14 || +mm[3] > 59) { out.push(null); continue }
    out.push((mm[1] === "-" ? -1 : 1) * (+mm[2] * 60 + +mm[3]))
  }
  while (out.length && lines.join("").trim() === "") out.pop()
  return out
}

// The time in a zone at `nowMs`, and how many days its date is from the local date `localKey` (YYYYMMDD)
function zoneClock(nowMs, offsetMin, localKey) {
  if (offsetMin === null || offsetMin === undefined) return null
  var t = new Date(nowMs + offsetMin * 60000)
  var zoneDate = { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
  return { hh: pad2(t.getUTCHours()), mm: pad2(t.getUTCMinutes()), dayShift: diffDays(fromKey(localKey), zoneDate) }
}

// ---------------------------------------------------------------------------------------------- holidays (text from a file)
// One per line: `2026-12-08 Name` (that day) or `12-25 Name` (every year). `#` starts a comment only at the line's start.
// At most 500 lines are read, names are cut to 40 characters and stay plain text (the card draws them as PlainText).
function validDate(y, m, d) {
  return m >= 1 && m <= 12 && d >= 1 && d <= (y === null ? (m === 2 ? 29 : daysInMonth(2001, m)) : daysInMonth(y, m))
}

function parseHolidays(text) {
  var lines = String(text || "").split("\n"), out = {}
  for (var i = 0; i < lines.length && i < 500; i++) {
    var line = lines[i].replace(/\r$/, "").trim()
    if (line === "" || line.charAt(0) === "#") continue
    var mm = /^(?:(\d{4})-)?(\d{2})-(\d{2})\s+(.+)$/.exec(line)
    if (!mm) continue
    var y = mm[1] ? +mm[1] : null
    if (!validDate(y, +mm[2], +mm[3])) continue
    var name = mm[4].replace(/[\x00-\x1f]/g, " ").trim().slice(0, 40)
    if (name === "") continue
    out[(y === null ? "" : mm[1] + "-") + mm[2] + "-" + mm[3]] = name
  }
  return out
}

function holidayFor(c, table) {
  if (!table) return ""
  var md = pad2(c.m) + "-" + pad2(c.d)
  return table[c.y + "-" + md] || table[md] || ""
}

if (typeof module !== "undefined") {
  module.exports = {
    MONTH_NAMES: MONTH_NAMES, MONTH_SHORT: MONTH_SHORT, DAY_NAMES: DAY_NAMES, DAY_SHORT: DAY_SHORT, MOON_NAMES: MOON_NAMES,
    pad2: pad2, isLeap: isLeap, daysInMonth: daysInMonth, dayNumber: dayNumber, fromDayNumber: fromDayNumber, weekday: weekday,
    key: key, fromKey: fromKey, dayOfYear: dayOfYear, moveDays: moveDays, diffDays: diffDays, addMonths: addMonths, isoWeek: isoWeek,
    resolveWeekStart: resolveWeekStart, monthGrid: monthGrid, moonPhase: moonPhase, kanjiDigits: kanjiDigits, kanjiMonth: kanjiMonth,
    formatClock: formatClock, relativeDays: relativeDays, parseZones: parseZones, parseOffsets: parseOffsets, zoneClock: zoneClock,
    parseHolidays: parseHolidays, holidayFor: holidayFor
  }
}
