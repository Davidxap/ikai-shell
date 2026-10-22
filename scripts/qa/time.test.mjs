// Tests for bar/modules/ItoTimeModel.js (the pure civil-date model of the clock and the calendar).
//   for tz in UTC America/Sao_Paulo Pacific/Apia Australia/Lord_Howe; do TZ=$tz node --test scripts/qa/time.test.mjs; done
// Every input is made up. The model never reads the machine's clock or time zone, so each run must give the same result.
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function load(rel) {
  const src = fs.readFileSync(path.join(root, rel), "utf8")
    .split("\n").filter((l) => !/^\s*\.(pragma|import)\b/.test(l)).join("\n")
  const sandbox = { module: { exports: {} } }
  vm.runInNewContext(src, sandbox, { filename: rel })
  return sandbox.module.exports
}
const same = (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected)

const M = load("bar/modules/ItoTimeModel.js")
const c = (y, m, d) => ({ y, m, d })
const WEEK_STARTS = [0, 1, 6]

// ---------------------------------------------------------------------------------------------- leap years
test("isLeap: 2000 yes, 1900 no, 2024 yes, 2100 no", () => {
  assert.equal(M.isLeap(2000), true)
  assert.equal(M.isLeap(1900), false)
  assert.equal(M.isLeap(2024), true)
  assert.equal(M.isLeap(2100), false)
})

test("daysInMonth: February lengths and the 30/31 pattern", () => {
  assert.equal(M.daysInMonth(2024, 2), 29)
  assert.equal(M.daysInMonth(2026, 2), 28)
  assert.equal(M.daysInMonth(1900, 2), 28)
  assert.equal(M.daysInMonth(2000, 2), 29)
  const lens = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  for (let m = 1; m <= 12; m++) assert.equal(M.daysInMonth(2026, m), lens[m - 1])
})

// ---------------------------------------------------------------------------------------------- day numbers
test("dayNumber / fromDayNumber round-trip and weekday", () => {
  assert.equal(M.dayNumber(c(1970, 1, 1)), 0)
  assert.equal(M.weekday(c(1970, 1, 1)), 4)          // Thursday
  assert.equal(M.weekday(c(2026, 10, 2)), 5)         // Friday
  assert.equal(M.weekday(c(2000, 2, 29)), 2)         // Tuesday
  for (const n of [-1000, -1, 0, 1, 11000, 20000, 25000]) assert.equal(M.dayNumber(M.fromDayNumber(n)), n)
  same(M.fromDayNumber(M.dayNumber(c(2024, 2, 29))), { y: 2024, m: 2, d: 29 })
})

test("dayOfYear", () => {
  assert.equal(M.dayOfYear(c(2026, 10, 2)), 275)
  assert.equal(M.dayOfYear(c(2024, 12, 31)), 366)
  assert.equal(M.dayOfYear(c(2026, 1, 1)), 1)
})

test("moveDays and diffDays are exact across DST dates and the skipped day in Samoa", () => {
  assert.equal(M.diffDays(c(2026, 3, 28), c(2026, 3, 30)), 2)       // EU DST
  assert.equal(M.diffDays(c(2026, 10, 31), c(2026, 11, 2)), 2)
  assert.equal(M.diffDays(c(2026, 11, 1), c(2026, 11, 2)), 1)       // US DST
  assert.equal(M.diffDays(c(2026, 11, 1), c(2026, 3, 29)), -217)
  assert.equal(M.diffDays(c(2018, 11, 3), c(2018, 11, 4)), 1)       // Sao Paulo midnight DST
  same(M.moveDays(c(2026, 3, 28), 1), { y: 2026, m: 3, d: 29 })
  same(M.moveDays(c(2011, 12, 29), 1), { y: 2011, m: 12, d: 30 })   // Apia skipped it locally; the civil calendar does not
  same(M.moveDays(c(2026, 1, 1), -1), { y: 2025, m: 12, d: 31 })
  same(M.moveDays(c(2024, 2, 28), 2), { y: 2024, m: 3, d: 1 })
})

test("addMonths: wraps years in both directions", () => {
  same(M.addMonths(2026, 1, -1), { y: 2025, m: 12 })
  same(M.addMonths(2026, 12, 1), { y: 2027, m: 1 })
  same(M.addMonths(2026, 5, 12), { y: 2027, m: 5 })
  same(M.addMonths(2026, 5, -12), { y: 2025, m: 5 })
  same(M.addMonths(2026, 3, -27), { y: 2023, m: 12 })
})

// ---------------------------------------------------------------------------------------------- week start
test("resolveWeekStart: settings and the locale's number (Qt: 7 is Sunday, 1 is Monday)", () => {
  assert.equal(M.resolveWeekStart("monday", 7), 1)
  assert.equal(M.resolveWeekStart("sunday", 1), 0)
  assert.equal(M.resolveWeekStart("saturday", 1), 6)
  assert.equal(M.resolveWeekStart("locale", 7), 0)
  assert.equal(M.resolveWeekStart("locale", 1), 1)
  assert.equal(M.resolveWeekStart("locale", 6), 6)
  assert.equal(M.resolveWeekStart("locale", undefined), 1)
  assert.equal(M.resolveWeekStart("nonsense", 7), 0)
})

// ---------------------------------------------------------------------------------------------- the grid
test("monthGrid: 42 unique consecutive day numbers, every month 1990-2040, every week start", () => {
  for (const ws of WEEK_STARTS)
    for (let y = 1990; y <= 2040; y++)
      for (let m = 1; m <= 12; m++) {
        const g = M.monthGrid(y, m, ws)
        assert.equal(g.cells.length, 42)
        assert.equal(g.weeks.length, 6)
        const ns = g.cells.map((x) => M.dayNumber(x))
        for (let i = 1; i < 42; i++) assert.equal(ns[i], ns[i - 1] + 1, `${y}-${m} ws ${ws} cell ${i}`)
        assert.equal(new Set(ns).size, 42)
        assert.equal(g.cells[0].weekday, ws)
        assert.equal(M.weekday(g.cells[0]), ws)
        assert.equal(g.cells.filter((x) => x.inMonth).length, M.daysInMonth(y, m))
        const first = g.cells.find((x) => x.inMonth)
        assert.equal(first.d, 1)
        assert.equal(first.m, m)
      }
})

test("monthGrid: February 2026, Monday start, begins on 2026-01-26", () => {
  const g = M.monthGrid(2026, 2, 1)
  const f = g.cells[0]
  same([f.y, f.m, f.d, f.inMonth, f.col, f.row, f.key], [2026, 1, 26, false, 0, 0, 20260126])
  assert.equal(g.cells[41].key, 20260308)
})

test("monthGrid: cell fields col, row, weekday, key", () => {
  const g = M.monthGrid(2026, 10, 0)
  const cell = g.cells.find((x) => x.key === 20261002)
  same([cell.col, cell.row, cell.weekday, cell.inMonth], [5, 0, 5, true])
})

test("monthGrid: a six-row month (August 2026, Monday start) ends in September", () => {
  const g = M.monthGrid(2026, 8, 1)
  assert.equal(g.cells[0].key, 20260727)
  assert.equal(g.cells[41].key, 20260906)
  assert.equal(g.cells.filter((x) => x.row === 5 && x.inMonth).length, 1)
})

test("monthGrid: Samoa 2011-12 contains the 30th exactly once", () => {
  for (const ws of WEEK_STARTS) {
    const g = M.monthGrid(2011, 12, ws)
    assert.equal(g.cells.filter((x) => x.key === 20111230).length, 1)
    assert.equal(g.cells.filter((x) => x.key === 20111229).length, 1)
  }
})

test("monthGrid: weeks hold the ISO week of each row's Monday cell, for every week start", () => {
  // Oct 2026: Monday start, row 0 is 2026-09-28 .. W40
  same(M.monthGrid(2026, 10, 1).weeks, [40, 41, 42, 43, 44, 45])
  // Sunday start: row 0 is Sun 2026-09-27, its Monday is 09-28 => W40 as well
  same(M.monthGrid(2026, 10, 0).weeks, [40, 41, 42, 43, 44, 45])
  // Saturday start: row 0 is Sat 2026-09-26, its Monday is 09-28
  same(M.monthGrid(2026, 10, 6).weeks, [40, 41, 42, 43, 44, 45])
  // January 2021 Monday start: row 0 is 2020-12-28 (W53)
  same(M.monthGrid(2021, 1, 1).weeks, [53, 1, 2, 3, 4, 5])
})

// ---------------------------------------------------------------------------------------------- ISO weeks
test("isoWeek: the edge days of the year", () => {
  const cases = [
    [c(2020, 12, 31), 2020, 53], [c(2021, 1, 1), 2020, 53], [c(2021, 1, 4), 2021, 1],
    [c(2008, 12, 29), 2009, 1], [c(2026, 12, 31), 2026, 53], [c(2027, 1, 1), 2026, 53],
    [c(2010, 1, 3), 2009, 53], [c(2026, 10, 2), 2026, 40], [c(2024, 12, 30), 2025, 1],
  ]
  for (const [d, year, week] of cases) same(M.isoWeek(d), { year, week })
})

// ---------------------------------------------------------------------------------------------- the moon
test("moonPhase: the reference new moon and a known full moon", () => {
  const nm = M.moonPhase(Date.UTC(2000, 0, 6, 18, 14))
  assert.equal(nm.index, 0)
  assert.ok(nm.illum < 0.01)
  const fm = M.moonPhase(Date.UTC(2024, 0, 25, 17, 54))
  assert.ok(fm.illum > 0.98, "illum " + fm.illum)
  assert.equal(fm.index, 4)
  assert.equal(fm.name, "Full moon")
})

test("moonPhase: waxing flag, name and index cover 0..7", () => {
  const seen = new Set()
  const t0 = Date.UTC(2000, 0, 6, 18, 14)
  for (let i = 0; i < 60; i++) {
    const p = M.moonPhase(t0 + i * 0.5 * 86400000)
    seen.add(p.index)
    assert.ok(p.age >= 0 && p.age < 29.6)
    assert.ok(p.illum >= 0 && p.illum <= 1)
    assert.equal(p.waxing, p.age < 29.530588853 / 2)
  }
  assert.equal(seen.size, 8)
  assert.equal(M.moonPhase(t0 + 3 * 86400000).name, "Waxing crescent")
  assert.equal(M.moonPhase(t0 - 3 * 86400000).name, "Waning crescent")
  assert.equal(M.moonPhase(t0 + 10 * 86400000).name, "Waxing gibbous")
})

// ---------------------------------------------------------------------------------------------- formatting
test("formatClock: 24 h, 12 h, seconds, meridiem", () => {
  same(M.formatClock(0, 5, 9, { hour12: true, seconds: false, numerals: "western" }), { hh: "12", mm: "05", ss: "", meridiem: "am" })
  same(M.formatClock(12, 0, 0, { hour12: true }), { hh: "12", mm: "00", ss: "", meridiem: "pm" })
  same(M.formatClock(9, 59, 3, { hour12: true, seconds: true }), { hh: "9", mm: "59", ss: "03", meridiem: "am" })
  same(M.formatClock(23, 7, 41, { hour12: false, seconds: true }), { hh: "23", mm: "07", ss: "41", meridiem: "" })
  same(M.formatClock(9, 7, 0, {}), { hh: "09", mm: "07", ss: "", meridiem: "" })
  same(M.formatClock(13, 0, 0, { hour12: true }), { hh: "1", mm: "00", ss: "", meridiem: "pm" })
})

test("formatClock: kanji numerals pass through kanjiDigits", () => {
  same(M.formatClock(23, 7, 41, { numerals: "kanji", seconds: true }), { hh: "二三", mm: "〇七", ss: "四一", meridiem: "" })
})

test("kanjiDigits and kanjiMonth", () => {
  assert.equal(M.kanjiDigits("23:07"), "二三:〇七")
  assert.equal(M.kanjiDigits("0123456789"), "〇一二三四五六七八九")
  assert.equal(M.kanjiDigits("ab"), "ab")
  assert.equal(M.kanjiMonth(11), "十一月")
  assert.equal(M.kanjiMonth(10), "十月")
  assert.equal(M.kanjiMonth(1), "一月")
  assert.equal(M.kanjiMonth(12), "十二月")
  assert.equal(M.kanjiMonth(9), "九月")
})

test("relativeDays", () => {
  assert.equal(M.relativeDays(0), "")
  assert.equal(M.relativeDays(1), "tomorrow")
  assert.equal(M.relativeDays(-1), "yesterday")
  assert.equal(M.relativeDays(12), "in 12 days")
  assert.equal(M.relativeDays(-3), "3 days ago")
})

// ---------------------------------------------------------------------------------------------- zones (untrusted text)
test("parseZones: labels, zones, the 3-entry cap", () => {
  same(M.parseZones("Tokyo=Asia/Tokyo, NYC=America/New_York"), [
    { label: "Tokyo", zone: "Asia/Tokyo", ok: true }, { label: "NYC", zone: "America/New_York", ok: true }])
  same(M.parseZones("UTC"), [{ label: "UTC", zone: "UTC", ok: true }])
  same(M.parseZones("Asia/Ho_Chi_Minh")[0], { label: "Ho Chi Minh", zone: "Asia/Ho_Chi_Minh", ok: true })
  assert.equal(M.parseZones("America/Argentina/Buenos_Aires")[0].ok, true)
  assert.equal(M.parseZones("Etc/GMT+5")[0].ok, true)
  assert.equal(M.parseZones("").length, 0)
  assert.equal(M.parseZones("  ,  , ").length, 0)
})

test("parseZones RED: shell metacharacters, traversal, spaces, absolute paths are rejected", () => {
  for (const bad of ["$(id)", "x=$(id)", "Asia/Tokyo;rm -rf ~", "`id`", "../etc/passwd", "Asia/..", "Asia/../../x", "America/New York",
                     "/etc/passwd", "x=/etc/passwd", "Asia/Tokyo|id", "Asia/Tokyo&id", "a\nb", "-rf", "Asia//Tokyo", "A/B/C/D"]) {
    const out = M.parseZones(bad)
    for (const z of out) assert.equal(z.ok, false, "accepted: " + JSON.stringify(bad) + " -> " + JSON.stringify(z))
  }
})

test("parseZones RED: more than 3 entries keeps 3", () => {
  const out = M.parseZones("A=UTC, B=UTC, C=UTC, D=UTC")
  assert.equal(out.length, 3)
  same(out.map((z) => z.label), ["A", "B", "C"])
})

test("parseZones: a rejected entry still returns a short plain label", () => {
  const z = M.parseZones("A very long label that goes on and on=$(id)")[0]
  assert.equal(z.ok, false)
  assert.ok(z.label.length <= 12)
})

test("parseOffsets: +0530 is 330, -0930 is -570, Lord Howe +1030, ? is null", () => {
  same(M.parseOffsets("+0530\n-0930\n+1030\n?\n"), [330, -570, 630, null])
  same(M.parseOffsets("+0000"), [0])
  same(M.parseOffsets("junk\n\n+9999x\n-1400"), [null, null, null, -840])
  same(M.parseOffsets(""), [])
})

test("zoneClock: time, day shift at midnight", () => {
  // 2026-10-02 23:07:41 UTC+0 is 2026-10-03 08:07 in Tokyo (+540): next day
  const now = Date.UTC(2026, 9, 2, 23, 7, 41)
  same(M.zoneClock(now, 540, 20261002), { hh: "08", mm: "07", dayShift: 1 })
  same(M.zoneClock(now, -240, 20261002), { hh: "19", mm: "07", dayShift: 0 })
  same(M.zoneClock(now, 630, 20261002), { hh: "09", mm: "37", dayShift: 1 })
  same(M.zoneClock(Date.UTC(2026, 9, 2, 1, 0), -180, 20261002), { hh: "22", mm: "00", dayShift: -1 })
  assert.equal(M.zoneClock(now, null, 20261002), null)
})

// ---------------------------------------------------------------------------------------------- holidays (untrusted text)
test("parseHolidays: both formats, comments, blank lines", () => {
  const t = "# comment\n2026-12-08 Founders' day\n\n12-25 Christmas\n  01-01   New Year  # not a comment inside\n"
  const h = M.parseHolidays(t)
  assert.equal(h["2026-12-08"], "Founders' day")
  assert.equal(h["12-25"], "Christmas")
  assert.equal(h["01-01"], "New Year  # not a comment inside")
})

test("parseHolidays RED: bad dates are dropped", () => {
  const h = M.parseHolidays("2026-13-01 x\n2026-00-10 x\n2026-02-30 x\n02-30 x\n2025-02-29 x\n99-99 x\nabc x\n2026-1-1 x\n12-25\n")
  same(h, {})
  assert.equal(M.parseHolidays("02-29 Leap day")["02-29"], "Leap day")
  assert.equal(M.parseHolidays("2024-02-29 Leap day")["2024-02-29"], "Leap day")
})

test("parseHolidays RED: markup stays literal text, names are cut to 40 chars", () => {
  const h = M.parseHolidays("12-25 <b>bold</b>\n12-26 " + "x".repeat(100))
  assert.equal(h["12-25"], "<b>bold</b>")
  assert.equal(h["12-26"].length, 40)
})

test("parseHolidays RED: 10k lines are read up to 500", () => {
  let t = ""
  for (let i = 0; i < 10000; i++) t += "2026-01-" + String(1 + (i % 28)).padStart(2, "0") + " n" + i + "\n"
  const lines = []
  for (let i = 0; i < 600; i++) lines.push("20" + String(10 + Math.floor(i / 12)).padStart(2, "0") + "-" + String(1 + (i % 12)).padStart(2, "0") + "-05 h" + i)
  assert.equal(Object.keys(M.parseHolidays(lines.join("\n"))).length, 500)
  assert.ok(Object.keys(M.parseHolidays(t)).length <= 28)
})

test("holidayFor: exact date wins over the yearly one", () => {
  const h = M.parseHolidays("12-25 Christmas\n2026-12-25 Special")
  assert.equal(M.holidayFor(c(2026, 12, 25), h), "Special")
  assert.equal(M.holidayFor(c(2027, 12, 25), h), "Christmas")
  assert.equal(M.holidayFor(c(2027, 12, 26), h), "")
  assert.equal(M.holidayFor(c(2027, 12, 26), null), "")
})

test("the model does not depend on the machine's time zone", () => {
  // The same answers under every TZ of the matrix: spot values only a local-time implementation could break.
  assert.equal(M.dayNumber(c(2026, 3, 29)), 20541)
  assert.equal(M.dayNumber(c(2011, 12, 30)), 15338)
  assert.equal(M.dayNumber(c(2018, 11, 4)), 17839)
})
