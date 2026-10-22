#!/usr/bin/env node
// The presentation contract between the fork's bar engine and the Ito-verse style (docs/STYLE_CONTRACT.md), checked in source.
// No QML runtime. Usage: style-contract.mjs [--table] [--baseline]
//   (none)      run SC-1..SC-8, exit 1 on a failure
//   --table     print the visual-token table for the doc (name, type, consumer count)
//   --baseline  rewrite style-contract.debt.json from the current tree (debt only ever goes down)
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const rd = p => fs.readFileSync(path.join(ROOT, p), "utf8")
const DEBT_FILE = path.join(ROOT, "scripts/qa/style-contract.debt.json")
const STYLE = "plugins/ito.bar/styles/itoverse"

function walk(dir, ext, out = []) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== "__pycache__" && e.name !== "backups") walk(rel, ext, out) }
    else if (ext.some(x => e.name.endsWith(x))) out.push(rel)
  }
  return out
}
// Comments never count: strip // lines and trailing comments (string literals with // are not used in these checks).
const code = t => t.split("\n").map(l => l.replace(/(^|\s)\/\/.*$/, "$1")).join("\n")

const ENGINE = [/^plugins\/ito\.bar\/(core|services|styles\/shibumi)\//, /^plugins\/ito\.bar\/(Bar|StyleRegistry)\.qml$/, /^plugins\/ito\.state\//]
const isEngine = f => ENGINE.some(r => r.test(f))
const ours = [...walk("bar/modules", [".qml"]), ...walk("plugins", [".qml"]).filter(f => /^plugins\/ito\./.test(f))].filter(f => !isEngine(f))

// ---- names -------------------------------------------------------------------------------------------------
function defined(file) {
  const t = code(rd(file)), names = new Map()
  for (const m of t.matchAll(/^\s*(?:readonly\s+|required\s+|default\s+)*property\s+([\w.<>]+)\s+(\w+)/gm)) names.set(m[2], m[1])
  for (const m of t.matchAll(/^\s*function\s+(\w+)\s*\(/gm)) names.set(m[1], "function")
  for (const m of t.matchAll(/^\s*(?:readonly\s+)?property\s+alias\s+(\w+)/gm)) names.set(m[1], "alias")
  return names
}
const engineFiles = ["plugins/ito.bar/Bar.qml", ...walk("plugins/ito.bar/core", [".qml"]), ...walk("plugins/ito.bar/styles/shibumi", [".qml"])]
function reads(re) {
  const out = new Map()
  for (const f of engineFiles) for (const m of code(rd(f)).matchAll(re)) {
    if (!out.has(m[1])) out.set(m[1], new Set())
    out.get(m[1]).add(f)
  }
  return out
}
const tokDef = defined(`${STYLE}/VisualTokens.qml`)
const styDef = defined(`${STYLE}/Style.qml`)
const tokReads = reads(/\bvisualTokens\.(\w+)/g)
const styReads = reads(/\bactiveStyle\.(\w+)/g)

if (process.argv.includes("--table")) {
  console.log("| Token | Type | Engine files reading it |\n|---|---|---|")
  for (const [n, ty] of [...tokDef].sort((a, b) => a[0].localeCompare(b[0])))
    console.log(`| \`${n}\` | ${ty} | ${tokReads.has(n) ? tokReads.get(n).size : "Ito only"} |`)
  process.exit(0)
}

const debt = fs.existsSync(DEBT_FILE) ? JSON.parse(fs.readFileSync(DEBT_FILE, "utf8")) : { hex: {}, durations: 0, clocks: [] }

// ---- measurements (shared by the checks and --baseline) --------------------------------------------------
const hexScope = [...walk(STYLE, [".qml"]), ...walk("bar/modules", [".qml"]).filter(f => path.dirname(f) === "bar/modules")]
const HEX = /"#[0-9a-fA-F]{6,8}"|\bQt\.rgba\(\s*[0-9.]+\s*,\s*[0-9.]+\s*,\s*[0-9.]+/g
function hexCounts() {
  const out = {}
  for (const f of hexScope) { const n = (code(rd(f)).match(HEX) || []).length; if (n) out[f] = n }
  return out
}
const durationCount = () => ours.reduce((s, f) => s + (code(rd(f)).match(/\bduration\s*:\s*\d+/g) || []).length, 0)
const CLOCK = /\b(Timer|FrameAnimation)\s*\{|\bloops\s*:\s*Animation\.Infinite|\b\w*Animation\s+on\s+\w+\s*\{/
function clockFiles() {
  const gates = rd("scripts/qa/check-live-gates.sh")
  return ours.filter(f => /^bar\/modules\/Ito[^/]*\.qml$/.test(f) && CLOCK.test(code(rd(f)))).map(f => ({ f, listed: gates.includes(`"${f}"`) }))
}

if (process.argv.includes("--baseline")) {
  const next = { hex: hexCounts(), durations: durationCount(), clocks: clockFiles().filter(c => !c.listed).map(c => c.f).sort(), onNames: debt.onNames || [] }
  fs.writeFileSync(DEBT_FILE, JSON.stringify(next, null, 1) + "\n")
  console.log(`baseline: ${Object.keys(next.hex).length} files with colour literals, ${next.durations} literal durations, ${next.clocks.length} unlisted clock files`)
  process.exit(0)
}

// ---- checks ------------------------------------------------------------------------------------------------
let bad = 0
const fail = (id, msg) => { bad = 1; console.log(`${id} FAIL ${msg}`) }
const ok = (id, msg) => console.log(`${id} ok   ${msg}`)

// SC-1: everything the engine reads, itoverse defines (this catches a fork update).
{
  const miss = []
  for (const [n, fs_] of tokReads) if (!tokDef.has(n) && n !== "") miss.push(`visualTokens.${n} (${[...fs_][0]})`)
  for (const [n, fs_] of styReads) if (!styDef.has(n)) miss.push(`activeStyle.${n} (${[...fs_][0]})`)
  miss.length ? fail("SC-1", "engine reads what itoverse does not define: " + miss.join(", ")) : ok("SC-1", `${tokReads.size} tokens + ${styReads.size} style names defined`)
}
// SC-2: the doc table and VisualTokens.qml agree.
{
  const docPath = "docs/STYLE_CONTRACT.md"
  if (!fs.existsSync(path.join(ROOT, docPath))) fail("SC-2", "docs/STYLE_CONTRACT.md is missing")
  else {
    const doc = rd(docPath)
    const sec = doc.split(/^## Visual tokens\s*$/m)[1]?.split(/^## /m)[0] || ""
    const rows = new Set([...sec.matchAll(/^\|\s*`(\w+)`\s*\|/gm)].map(m => m[1]))
    const missingInDoc = [...tokDef.keys()].filter(n => !rows.has(n)), missingInCode = [...rows].filter(n => !tokDef.has(n))
    ;(!rows.size || missingInDoc.length || missingInCode.length)
      ? fail("SC-2", `doc rows ${rows.size}; not in doc: ${missingInDoc.join(",") || "-"}; not in VisualTokens.qml: ${missingInCode.join(",") || "-"}`)
      : ok("SC-2", `${rows.size} token rows match VisualTokens.qml`)
  }
}
// SC-3: no new colour literal (ratchet per file; the debt file lists today's).
{
  const now = hexCounts(), over = []
  for (const [f, n] of Object.entries(now)) if (n > (debt.hex[f] || 0)) over.push(`${f} ${n} > ${debt.hex[f] || 0}`)
  over.length ? fail("SC-3", "colour literals above the debt: " + over.join("; ")) : ok("SC-3", `${Object.values(now).reduce((a, b) => a + b, 0)} literals, none above the debt`)
}
// SC-4: literal durations only go down.
{
  const n = durationCount()
  n > debt.durations ? fail("SC-4", `${n} literal duration: values > ratchet ${debt.durations} (use ItoAnim roles)`) : ok("SC-4", `${n} literal durations (ratchet ${debt.durations})`)
}
// SC-5: a Timer interval is functional: it never goes through dur().
{
  const hits = []
  for (const f of ours) for (const m of code(rd(f)).matchAll(/\binterval\s*:\s*([^\n;]*)/g)) if (/\bdur\s*\(/.test(m[1]) || /Motion\.dur\b/.test(m[1])) hits.push(f)
  hits.length ? fail("SC-5", "Timer.interval scaled by dur(): " + hits.join(", ")) : ok("SC-5", "no Timer interval is scaled")
}
// SC-6: a property named on[A-Z]... is parsed as a signal handler (the Material on* trap).
{
  const hits = []
  for (const f of [...ours, ...walk("scripts/lab", [".qml"])]) for (const m of code(rd(f)).matchAll(/^\s*(?:readonly\s+|required\s+|default\s+)*property\s+[\w.<>]+\s+(on[A-Z]\w*)/gm)) hits.push(`${f}:${m[1]}`)
  const fresh = hits.filter(h => !(debt.onNames || []).includes(h)); hits.length = 0; hits.push(...fresh)
  hits.length ? fail("SC-6", "property named on[A-Z]: " + hits.join(", ")) : ok("SC-6", "no on[A-Z] property names")
}
// SC-7: a clock in a bar/modules Ito*.qml must be on a check-live-gates.sh list (or already in the debt).
{
  const bad7 = clockFiles().filter(c => !c.listed && !debt.clocks.includes(c.f)).map(c => c.f)
  bad7.length ? fail("SC-7", "clock not on a live-gate list: " + bad7.join(", ")) : ok("SC-7", "every new clock is gated")
}
// SC-8: the colours plugin panels from other authors read (bar.foreground, bar.background) must follow the theme. They resolve to
// Style.foreground -> tokens.ink -> Commons.Color.foreground. Nothing may pin them to a fixed or Ito-derived value, so a dark theme
// never gets a dark foreground (and a light theme never a light one) whatever our own palette guard is doing.
{
  const style = code(rd(`${STYLE}/Style.qml`)), tok = code(rd(`${STYLE}/VisualTokens.qml`))
  const prop = (t, n) => (t.match(new RegExp(`property\\s+color\\s+${n}\\s*:\\s*([^\\n]+)`)) || [])[1]?.trim()
  const want = [
    [style, "foreground", "tokens.ink"], [style, "barForeground", "tokens.ink"],
    [tok, "ink", "Commons.Color.foreground"], [tok, "paper", "Commons.Color.background"]
  ]
  const wrong = want.filter(([t, n, v]) => prop(t, n) !== v).map(([, n, v]) => `${n} must be ${v}, is ${prop(n === "foreground" || n === "barForeground" ? style : tok, n)}`)
  wrong.length ? fail("SC-8", wrong.join("; ")) : ok("SC-8", "Style.foreground/tokens.ink/paper bind straight to Commons.Color")
}
process.exit(bad)
