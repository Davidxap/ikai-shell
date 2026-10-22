// S17e (master-plan-v4): the `shPack` widget skins. Off = nothing changes; on = only the pictures whose state the skin can still say.
//   node --test scripts/qa/shpack.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import { loadQmlJs } from "./icon-raster.mjs"

const M = loadQmlJs("bar/modules/ItoIconMap.js")
const A = "/x/bar/modules/ito-art/"
const ASSETS = os.homedir() + "/.config/ito/assets/hollow/bar/"

test("SH-T1 off (or unset) maps nothing", () => {
  for (const n of M.pilotNames()) {
    assert.equal(M.shBase(false, A + n, true), "", n)
    assert.equal(M.shBase(undefined, A + n, true), "", n)
  }
})
test("SH-T2 on: notifications eye x4, night moth; everything else unchanged (the media cassette is gone, T15)", () => {
  const f = (s) => M.shBase(true, A + s, true)
  assert.equal(f("notifications/notification.png"), "hollow/eye-idle.png")
  assert.equal(f("notifications/notification-active.png"), "hollow/eye-open.png")
  assert.equal(f("notifications/notification-ring.png"), "hollow/eye-open.png")
  assert.equal(f("notifications/notification-critical.png"), "hollow/eye-alert.png")
  assert.equal(f("notifications/notification-error.png"), "hollow/eye-alert.png")
  assert.equal(f("notifications/notification-dnd.png"), "hollow/eye-shut.png")
  assert.equal(f("notifications/notification-muted.png"), "hollow/eye-shut.png")
  assert.equal(f("media/media-pause.png"), "")
  assert.equal(f("media/media-play.png"), "")
  assert.equal(f("media/media-stop.png"), "")
  assert.equal(f("media/media-prev.png"), "")
  assert.equal(f("media/media-next.png"), "")
  assert.equal(f("indicators/night-fog-on.png"), "hollow/moth-on.png")
  assert.equal(f("indicators/night-moon-off.png"), "hollow/moth-off.png")
  assert.equal(f("indicators/record-tape-on.png"), "")
  for (const s of ["instruments/bat-0.png", "instruments/net-2.png", "instruments/vol-1.png", "system/cpu.png", "instruments/sky-fog.png"]) assert.equal(f(s), "", s)
  // a user picture (tintable false) never maps
  assert.equal(M.shBase(true, A + "notifications/notification.png", false), "")
})
test("SH-T4 per-icon choice: an object maps only the icons set to Silent Hill; the original stays for the others", () => {
  const f = (on, s) => M.shBase(on, A + s, true)
  const none = { notifications: false, media: false, nightlight: false }
  for (const s of ["notifications/notification.png", "media/media-play.png", "indicators/night-fog-on.png"]) assert.equal(f(none, s), "", s)
  assert.equal(f({ ...none, notifications: true }, "notifications/notification.png"), "hollow/eye-idle.png")
  assert.equal(f({ ...none, notifications: true }, "media/media-play.png"), "")
  assert.equal(f({ ...none, media: true }, "media/media-pause.png"), "")
  assert.equal(f({ ...none, nightlight: true }, "indicators/night-moon-off.png"), "hollow/moth-off.png")
  assert.equal(f({ ...none, nightlight: true }, "notifications/notification.png"), "")
  assert.equal(f({}, "notifications/notification.png"), "")
  assert.equal(f(null, "notifications/notification.png"), "")
  assert.equal(f("sh", "notifications/notification.png"), "")
})
test("SH-T5 ItoConfig.shChoice: explicit Original beats shPack, unset follows it (source contract)", () => {
  const q = fs.readFileSync("bar/modules/ItoConfig.qml", "utf8")
  assert.match(q, /function shChoice\(name\)/)
  assert.match(q, /v === "sh" \|\| v === "hollow" \? true : v === "original" \? false : shPack/)
  for (const n of ["notifications", "nightlight"]) assert.match(q, new RegExp(n + ": shChoice\\(\"" + n + "\"\\)"))
  assert.doesNotMatch(q, /media: shChoice/)
  assert.match(fs.readFileSync("plugins/ito.clock/BarWidget.qml", "utf8"), /cfg\.shChoice\("clock"\)/)
  assert.match(fs.readFileSync("plugins/ito.power/Panel.qml", "utf8"), /itoCfg\.shChoice\("power"\)/)
  assert.doesNotMatch(fs.readFileSync("bar/modules/ItoImage.qml", "utf8"), /palette\.shPack/)
})
// ---- T15 (S21): the Icons chooser (ItoIconMap ROWS / options / selected / pick / pickAll)
const USER = { style: "manga", overrides: "mem=manga,battery=manga,network=manga,notifications=manga,audio=manga,display=manga,bluetooth=manga",
               sh: () => false, version: (id) => ({ awake: "cup", night: "fog", record: "cassette" })[id] }
const VERS = { awake: ["coffee", "radio", "flashlight", "cup"], night: ["moon", "fog"], record: ["eye", "tape", "cassette"] }
const vlist = (id) => VERS[id].map((key) => ({ key, name: key }))
const row = (id) => M.ROWS.find((r) => r.id === id)
test("SH-T6 every bar icon has a row, and every row offers the Original first", () => {
  const ids = M.ROWS.map((r) => r.id)
  for (const id of ["audio", "network", "bluetooth", "battery", "power", "display", "notifications", "cpu", "mem", "disk", "ai", "media", "tray", "weather", "clock", "indicators", "awake", "night", "record"]) assert.ok(ids.includes(id), id)
  for (const f of M.FAMILIES) assert.ok(M.ROWS.some((r) => r.family === f), "family " + f)
  for (const r of M.ROWS) {
    const o = M.options(r, { gothic: true, sh: true, px: 28 }, r.versions ? vlist(r.versions) : [])
    assert.equal(o[0].name, "Original", r.id)
    assert.ok(o.length >= 2 && o.length <= 4, r.id + " " + o.length)
  }
  // without the user's files: no Gothic and no Silent Hill card; the media row never has a Silent Hill card (T15)
  assert.deepEqual(M.options(row("notifications"), {}, []).map((o) => o.key), ["original", "manga"])
  assert.deepEqual(M.options(row("media"), { gothic: true, sh: true }, []).map((o) => o.key), ["original", "manga"])
  assert.deepEqual(M.options(row("display"), { gothic: true, sh: true }, []).map((o) => o.key), ["original", "manga", "gothic"])
  assert.deepEqual(M.options(row("night"), { sh: true }, vlist("night")).map((o) => o.key), ["v:moon", "v:fog", "sh"])
  assert.ok(!M.options(row("ai"), { gothic: true, px: 26 }, []).some((o) => o.key === "gothic"), "ai gothic below its 30 px floor")
})
test("SH-T7 selected: the user's current choice is what the chooser marks (nothing changes until a pick)", () => {
  const on = Object.fromEntries(M.ROWS.map((r) => [r.id, M.selected(r, USER)]))
  for (const id of ["audio", "network", "bluetooth", "battery", "display", "notifications", "mem", "cpu", "disk"]) assert.equal(on[id], "manga", id)
  for (const id of ["ai", "media", "tray", "weather", "indicators", "clock", "power"]) assert.equal(on[id], "original", id)
  assert.deepEqual([on.awake, on.night, on.record], ["v:cup", "v:fog", "v:cassette"])
  assert.equal(M.selected(row("notifications"), { ...USER, sh: (n) => n === "notifications" }), "sh")
})
test("SH-T8 pick and pickAll write only the existing keys, and Original is the old drawing", () => {
  assert.deepEqual(M.pick(row("display"), "original", USER), { iconStyleOverrides: "mem=manga,battery=manga,network=manga,notifications=manga,audio=manga,display=current,bluetooth=manga" })
  assert.equal(M.parseOverrides(M.pick(row("display"), "original", USER).iconStyleOverrides).display, "current")
  assert.deepEqual(M.pick(row("notifications"), "sh", USER), { "icon:notifications": "sh" })
  assert.equal(M.pick(row("notifications"), "manga", USER)["icon:notifications"], "original")
  assert.deepEqual(M.pick(row("awake"), "v:coffee", USER), { "icon:awake": "coffee" })
  assert.deepEqual(M.pick(row("clock"), "original", USER), { "icon:clock": "original" })
  assert.ok(!("icon:media" in M.pick(row("media"), "original", USER)))
  const all = M.pickAll("original", USER, {}, (id) => VERS[id][0])
  const keys = new Set(M.chooserKeys())
  for (const k of Object.keys(all)) assert.ok(keys.has(k), k)
  const o = M.parseOverrides(all.iconStyleOverrides)
  for (const f of M.FAMILIES) assert.equal(o[f], "current", f)
  for (const r of M.ROWS) assert.equal(M.selected(r, { style: "manga", overrides: all.iconStyleOverrides, sh: (n) => all["icon:" + n] === "sh", version: (id) => all["icon:" + id] }), r.versions ? "v:" + VERS[r.versions][0] : "original", r.id)
  const manga = M.pickAll("manga", USER, {}, null)
  for (const f of M.FAMILIES) assert.equal(M.parseOverrides(manga.iconStyleOverrides)[f], "manga", f)
  assert.ok(!("icon:awake" in manga), "Use Manga for all leaves the indicator versions")
  const goth = M.parseOverrides(M.pickAll("gothic", USER, { gothic: true }, null).iconStyleOverrides)
  assert.equal(goth.display, "gothic"); assert.equal(goth.disk, "current")
  assert.equal(M.allStyle("current"), "manga"); assert.equal(M.allStyle("gothic"), "gothic")
})
const have = fs.existsSync(ASSETS + "28/eye-idle.png")     // S24: hollow/bar/<px>/<skin>.png (was sh/bar/<px>/sp-<skin>.png)
test("SH-T3 on disk (skipped without the user's sprite products): every skin at every bar tier, dark + light", { skip: !have }, () => {
  const names = ["spiral", "eye-idle", "eye-open", "eye-alert", "eye-shut", "moth-on", "moth-off", "pyramid", "cassette-on", "cassette-off", "sign", "sign-bleeding"]
  for (const px of [24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 64, 96]) for (const n of names) for (const sfx of [".png", ".light.png"])
    assert.ok(fs.existsSync(`${ASSETS}${px}/${n}${sfx}`), `${px}/${n}${sfx}`)
})
