// S18 (master-plan-v4): iconStyle gothic lookup + floors, workspace family `gothic`. The files under ~/.config/ito/assets are the user's, never in
// the repo: the on-disk checks are skipped on a machine without them.
//   node --test scripts/qa/gothic.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import { loadQmlJs } from "./icon-raster.mjs"

const M = loadQmlJs("bar/modules/ItoIconMap.js")
const U = loadQmlJs("bar/modules/ItoUserArt.js")
const A = "/x/bar/modules/ito-art/"
const ASSETS = os.homedir() + "/.config/ito/assets/"
const have = fs.existsSync(ASSETS + "relic/sys")     // S24: the recipe writes relic/sys/ and ws-symbols-* now

test("G-T1 lookup per icon / state: the file name of each state", () => {
  const f = (src, px) => M.gothic(A + src, px)
  assert.equal(f("instruments/net-2.png", 28), "relic/sys/bar/28/network-2.png")
  assert.equal(f("instruments/net-off.png", 28), "relic/sys/bar/28/network-off.png")
  assert.equal(f("network/wifi-weak.png", 28), "relic/sys/bar/28/network-1.png")
  assert.equal(f("instruments/bat-3.png", 32), "relic/sys/bar/32/battery-3.png")
  assert.equal(f("battery/battery-critical.png", 32), "relic/sys/bar/32/battery-0.png")
  assert.equal(f("instruments/vol-1.png", 24), "relic/sys/bar/24/audio-1.png")
  assert.equal(f("instruments/vol-mute.png", 24), "relic/sys/bar/24/audio-mute.png")
  assert.equal(f("instruments/display-2.png", 40), "relic/sys/bar/40/display-2.png")
  assert.equal(f("instruments/bt-linked.png", 44), "relic/sys/bar/44/bluetooth-linked.png")
  assert.equal(f("system/cpu.png", 48), "relic/sys/bar/48/cpu.png")
  assert.equal(f("system/tray.png", 36), "relic/sys/bar/36/tray.png")
  assert.equal(f("indicators/night-fog-off.png", 28), "relic/sys/bar/28/night-off.png")
})

test("G-T2 what the sheet does not draw falls back to current (null): wired, charging, awake/record, disk, media, user pictures", () => {
  const f = (src, px, t) => M.gothic(A + src, px, t)
  assert.equal(f("instruments/net-wired.png", 28), null)
  assert.equal(f("instruments/bat-charge-2.png", 28), null)
  assert.equal(f("indicators/awake-coffee-on.png", 28), null)
  assert.equal(f("system/disk.png", 28), null)
  assert.equal(f("media/media-play.png", 28), null)
  assert.equal(f("instruments/net-2.png", 28, false), null, "a user's own picture never maps")
  assert.equal(M.gothic("/home/u/.cache/ito/marks/a.png", 28), null)
})

test("G-T3 per-icon floors: ai < 30 and gpu < 32 are null, the tier from the floor up is not; outside 24..64 is null", () => {
  assert.equal(M.gothic(A + "system/brain.png", 28), null)
  assert.equal(M.gothic(A + "system/brain.png", 30), "relic/sys/bar/30/ai.png")
  assert.equal(M.gothicFor("gothic/sys/gpu.png", 30), null)
  assert.equal(M.gothicFor("gothic/sys/gpu.png", 32), "relic/sys/bar/32/gpu.png")
  assert.equal(M.gothic(A + "instruments/net-3.png", 14), null)
  assert.equal(M.gothic(A + "instruments/net-3.png", 90), null)
  assert.equal(M.gothic(A + "instruments/net-3.png", 21), "relic/sys/bar/24/network-3.png", "within 15 % of the smallest tier")
})

test("G-T4 style resolution: global gothic turns on its families (ai stays current), overrides win, unknown values fall back to today", () => {
  const b = (g, o, src) => M.gothicBase(g, o, A + src)
  assert.equal(b("gothic", "", "instruments/net-1.png"), "relic/sys/network-1.png")
  assert.equal(b("gothic", "", "system/brain.png"), "", "ai stays current")
  assert.equal(b("gothic", "ai=gothic", "system/brain.png"), "relic/sys/ai.png")
  assert.equal(b("gothic", "network=manga", "instruments/net-1.png"), "")
  assert.equal(b("gothic", "network=current", "instruments/net-1.png"), "")
  assert.equal(b("current", "battery=gothic", "instruments/bat-2.png"), "relic/sys/battery-2.png")
  assert.equal(b("manga", "", "instruments/bat-2.png"), "")
  assert.equal(b("current", "", "instruments/bat-2.png"), "", "the default path is unchanged")
  assert.equal(b("gothic", "", "indicators/night-moon-on.png"), "relic/sys/night-on.png")
  assert.equal(M.styleFor("manga", "", "disk"), "manga")
  assert.equal(M.styleFor("gibberish", "", "network"), "current")
  assert.deepEqual({ ...M.parseOverrides("ai=gothic,network=weird") }, { ai: "gothic" })
  assert.equal(M.drawn("gothic", "", A + "instruments/net-1.png", true), null, "the manga bake never draws a gothic icon")
})

test("G-T5 the user-art lookup resolves a gothic base to the tier file, light twin first", () => {
  const files = { "gothic/sys/bar/28/network-2.png": { mtime: 1 }, "gothic/sys/bar/28/network-2.light.png": { mtime: 2 } }
  const idx = { root: "/h/assets", files: {}, slots: files }
  assert.equal(U.bar(idx, {}, "gothic/sys/network-2.png", 28, false, "v9").url, "file:///h/assets/gothic/sys/bar/28/network-2.png?v=1")
  assert.equal(U.bar(idx, {}, "gothic/sys/network-2.png", 28, true, "v9").url, "file:///h/assets/gothic/sys/bar/28/network-2.light.png?v=2")
  assert.equal(U.bar(idx, {}, "gothic/sys/network-2.png", 36, false, "v9"), null, "no file at that tier: the caller keeps current")
  assert.equal(U.bar(idx, {}, "relic/sys/network-2.png", 28, true, "v9").url, "file:///h/assets/gothic/sys/bar/28/network-2.light.png?v=2", "S24: the new relic/sys base still finds an old gothic/sys file")
  const both = { root: "/h/assets", files: {}, slots: { ...files, "relic/sys/bar/28/network-2.png": { mtime: 3 } } }
  assert.equal(U.bar(both, {}, "relic/sys/network-2.png", 28, false, "v9").url, "file:///h/assets/relic/sys/bar/28/network-2.png?v=3", "a new file wins over the old one")
})

test("G-T6 workspace family gothic: n / state -> file, the card is hidden without files", () => {
  const files = {}
  for (const px of [24, 64]) for (let n = 1; n <= 10; n++) for (const st of ["empty", "occupied", "active", "urgent"]) files[`workspaces/bar/${px}/ws-gothic-${n}-${st}.png`] = { mtime: 1 }
  const idx = { root: "/h/assets", files: {}, slots: files }
  assert.equal(U.bar(idx, {}, "workspaces/ws-gothic-10-urgent.png", 24, false, "v9").url, "file:///h/assets/workspaces/bar/24/ws-gothic-10-urgent.png?v=1")
  assert.equal(U.bar(idx, {}, "workspaces/ws-gothic-3-active.png", 64, false, "v9").px, 64)
  assert.equal(U.bar({ root: "/h", files: {}, slots: {} }, {}, "workspaces/ws-gothic-3-active.png", 64, false, "v9"), null, "no files: hidden")
  assert.equal(U.bar(idx, {}, "workspaces/ws-symbols-3-active.png", 64, false, "v9").url, "file:///h/assets/workspaces/bar/64/ws-gothic-3-active.png?v=1", "S24: ws-symbols-* asks find the old ws-gothic-* files")
})

test("G-T7 on disk: every icon state at every tier from its floor, every ws n x state x tier (dark + light)", { skip: !have }, () => {
  const ST = { network: ["0", "1", "2", "3", "off"], cpu: [""], gpu: [""], ai: [""], tray: [""], battery: ["0", "1", "2", "3", "4"], audio: ["0", "1", "2", "3", "mute"], bluetooth: ["on", "off", "linked"], night: ["on", "off"], display: ["0", "1", "2", "3"] }
  const miss = []
  const ex = (r) => { if (!fs.existsSync(ASSETS + r)) miss.push(r) }
  for (const px of [24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 64, 72, 80]) {
    for (const [ic, sts] of Object.entries(ST)) {
      if (px < (M.GOTHIC_FLOOR[ic] || 0) || px > 64) continue
      for (const s of sts) for (const suf of ["", ".light"]) ex(`relic/sys/bar/${px}/${ic}${s ? "-" + s : ""}${suf}.png`)
    }
    for (let n = 1; n <= 10; n++) for (const st of ["empty", "occupied", "active", "urgent"]) for (const suf of ["", ".light"]) ex(`workspaces/bar/${px}/ws-symbols-${n}-${st}${suf}.png`)
  }
  assert.deepEqual(miss.slice(0, 5), [])
  for (const [ic, px] of [["gpu", 30], ["gpu", 24], ["ai", 28], ["ai", 24]]) assert.equal(fs.existsSync(ASSETS + `relic/sys/bar/${px}/${ic}.png`), false, `${ic} below its floor is not written`)
})
