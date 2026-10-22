.pragma library

// The marks that stand for the shell: the seal in the middle of the bar, and the mark on the menu button.
// Each says what it is, in English, so a kanji is never just decoration. The control centre lists them and
// the widgets draw them from the same table.

var seals = [
  { key: "tomie",   text: "富\n江",     scale: 1.0,  name: "Tomie",
    note: "富江 — Tomie: the girl who will not stay dead, and keeps coming back." },
  { key: "uzumaki", text: "渦\n巻",     scale: 1.0,  name: "Uzumaki",
    note: "渦巻 — \"spiral\": the shape that curses a whole town." },
  { key: "ito",     text: "伊\n藤",     scale: 1.0,  name: "Junji Ito",
    note: "伊藤 — Ito: the family name of the artist himself." },
  { key: "silent",  text: "静\n丘",     scale: 1.0,  name: "Quiet hill",
    note: "静丘 — \"quiet hill\": the fog-eaten town this palette borrows its cold from." },
  { key: "remina",  text: "レ\nミ\nナ", scale: 0.72, name: "Remina",
    note: "レミナ — Remina: the planet that devours every world it passes." },
  { key: "ikai",     text: "異\n界",     scale: 1.0,  name: "Ikai",
    note: "異界 — \"the other world\": the world beyond, and the name of this shell." },
  { key: "urasekai", text: "裏\n世\n界", scale: 0.72, name: "Ura-sekai",
    note: "裏世界 — \"the reverse world\": what Japanese players call Silent Hill's Otherworld." },
  { key: "sankaku",  text: "三\n角\n頭", scale: 0.72, name: "Sankaku-atama",
    note: "三角頭 — \"triangle head\": Pyramid Head, as he is called in Japan." },
  { key: "akasabi",  text: "赤\n錆",     scale: 1.0,  name: "Red rust",
    note: "赤錆 — red rust: the walls of the Otherworld, flaking." },
  { key: "nakigara", text: "亡\n骸",     scale: 1.0,  name: "Remains",
    note: "亡骸 — the remains of the dead." },
  { key: "kekkon",   text: "血\n痕",     scale: 1.0,  name: "Bloodstain",
    note: "血痕 — a bloodstain, dried where it fell." },
  { key: "kaii",     text: "怪\n異",     scale: 1.0,  name: "Kaii",
    note: "怪異 — the uncanny: something that should not be, and is." },
  { key: "igyo",     text: "異\n形",     scale: 1.0,  name: "Igy\u014D",
    note: "異形 — a grotesque form: a body twisted out of its shape." },
  { key: "jagan",    text: "邪\n眼",     scale: 1.0,  name: "Evil eye",
    note: "邪眼 — the evil eye: the one that watches back." },
  { key: "juso",     text: "呪\n詛",     scale: 1.0,  name: "Curse",
    note: "呪詛 — a curse, spoken against someone." },
  { key: "nomu",     text: "濃\n霧",     scale: 1.0,  name: "Dense fog", dense: true,
    note: "濃霧 — dense fog: the town is somewhere inside it." },
  { key: "kurayami", text: "暗\n闇",     scale: 1.0,  name: "Darkness", dense: true,
    note: "暗闇 — pitch darkness." },
  { key: "akumu",    text: "悪\n夢",     scale: 1.0,  name: "Nightmare", dense: true,
    note: "悪夢 — a nightmare." },
  { key: "heather",  text: "ヘ\nザ\nー", scale: 0.72, name: "Heather",
    note: "ヘザー — Heather, written as in the Japanese Silent Hill 3." }
]

// The letters are stroke-heavy: on a bar thinner than this many px the seal is a smudge. The picker says so for every text seal.
var sealLegibleFrom = 32

// `fx` is the effect a mark has by default (Effects page, "Auto"): a round mark turns, a face keeps a
// heartbeat, a figure breathes. Turning a mark that has an up and a down would only wreck it.
var menuMarks = [
  { key: "uzumaki-v1", art: "menu-uzumaki-v1.png", name: "Uzumaki v1", fx: "spin",
    note: "The classic original: two thin arms of the spiral wound together, bone and blood, three turns." },
  { key: "uzumaki-v2", art: "menu-uzumaki-v2.png", name: "Uzumaki v2", fx: "spin",
    note: "The vortex: one tapering spiral, many turns, and the eye looking out of its centre." },
  { key: "uzumaki",  art: "menu-uzumaki.png",       name: "Uzumaki v3", fx: "spin",
    note: "The adapted Uzumaki: two arms wound together, bone and blood, redrawn for every bar size. The curse is already in the menu." },
  { key: "uzumaki-eye", user: "uzumaki-eye",         name: "Uzumaki Eye", fx: "pulse",
    note: "From your engraving: an eye whose iris is the spiral." },
  { key: "remina",   user: "remina",                 name: "Remina", fx: "pulse",
    note: "The planet that eats worlds, from your own picture: one eye, moved to its centre." },
  { key: "remina-ink", art: "menu-remina.png",       name: "Remina Ink", fx: "pulse",
    note: "The planet drawn in ink: one bloodshot eye, a small world on its way in." },
  { key: "tomie-classic", user: "tomie-classic",   name: "Tomie Classic", fx: "heartbeat", minPx: 36, scale: 0.87,
    note: "Tomie, the classic sticker of your own drawing: her head cut out along her hair in bone paper and ink, a thin outline so the hair reads on a dark bar, the mole in blood. Drawn at least 36 px: her two faces need it." },
  { key: "beetle",   user: "beetle",                 name: "Beetle", fx: "breathe",
    note: "From your own beetle: wings open, an eye on its back." },
  { key: "heather",  user: "heather",                name: "Heather", fx: "heartbeat",
    note: "Heather herself, cut from your Heather sheet: her face and fringe, no ring, one red accent on her lips." },
  { key: "heather-sigil", user: "heather-sigil",     name: "Heather sigil", fx: "heartbeat",
    note: "The Heather roundel: her portrait inside the red broken ring, with its ticks and the glyph below." },
  { key: "pyramid-roundel", user: "pyramid-roundel", name: "Pyramid roundel", fx: "heartbeat",
    note: "From your sprite sheet: Pyramid Head inside the red ring, the disc centred on the tile, the ring redrawn clean for every size, the helmet's point breaking out above." },
  { key: "pyramid-head", user: "pyramid-head", name: "Pyramid Head", fx: "heartbeat", minPx: 32,
    note: "Your Pyramid Head side view, helmet and shoulder, its own lighting in your theme's colours: the iron's deep shadows in the theme's darkest ink, its light in the foreground, its blood in the accent, cut clean along the helmet with a faint edge so it reads on any bar. Drawn at least 32 px." },
  { key: "moth", user: "moth", name: "Moth", fx: "breathe",
    note: "From your sprite sheet: the moth on its red ring, the eyes on its wings in blood." },
  { key: "eye-roundel", user: "eye-roundel", name: "Eye", fx: "pulse",
    note: "From your sprite sheet: the eye in its stitched ring, the iris in blood." },
  { key: "key", user: "key", name: "Key", fx: "breathe",
    note: "From your sprite sheet: the rusted key upright, bow up. Under 40 px its three holes read as one eye and the rust is left out." },
  { key: "amigara",  art: "menu-amigara.png",       name: "Amigara", fx: "breathe",
    note: "The mountain full of holes cut to the shape of people, and the one that is yours." },
  { key: "metatron", art: "menu-metatron-full.png", name: "Metatron", fx: "spin",
    note: "The Seal of Metatron of Silent Hill, as the game draws it: runes, three circles and an eye." },
  { key: "metatron-mini", art: "menu-metatron.png", name: "Metatron, plain", fx: "spin",
    note: "The same seal cut down to what survives at bar size: the ring, the eye, the three circles." },
  { key: "halo",     art: "menu-halo.png",          name: "Halo", fx: "spin",
    note: "The Halo of the Sun: a disc with flares that alternate long and short." },
  { key: "flauros",  art: "menu-flauros.png",       name: "Flauros", fx: "spin",
    note: "A ring cut by a cross, a small circle in every quarter, and blood where the arms meet." },
  { key: "spiral",   art: "system-normal.png",      name: "Sheet spiral", fx: "breathe",
    note: "The spiral from the design sheet, drawn by hand." },
  { key: "spiral-clean", art: "system-normal-clean.png", name: "Sheet spiral clean", fx: "breathe",
    note: "The same spiral rebuilt as one clean ribbon from its own centreline." }
]

// An entry with `user: "<name>"` is drawn from the user's own file (marks/<name>.png, bin/ito-assets): with no such file it is hidden in the
// picker and a selected key shows the Uzumaki mark instead (resolve()). The pictures never ship in the repo.
function userEntry(key) {
  for (var i = 0; i < menuMarks.length; i++)
    if (menuMarks[i].key === key && menuMarks[i].user) return menuMarks[i]
  return null
}

var TOMIE_ALIAS = ["tomie", "tomie-head", "user:tomie-head", "user:tomie", "user:tomie-classic"]

// The key to draw: `key` itself, or "uzumaki" when it is a user-backed entry whose file is not in `names` (the marks the index lists).
function resolve(key, names) {
  if (TOMIE_ALIAS.indexOf(String(key)) >= 0) key = "tomie-classic"   // the HD `tomie` and head-crop entries were removed (S9, HD pass): a stored value reads as Tomie Classic
  var e = userEntry(String(key))
  if (!e) return String(key)
  var list = names || []
  for (var i = 0; i < list.length; i++)
    if (list[i] === e.user) return String(key)
  return "uzumaki"
}

// marksVer 2 (one shot): the picker names changed. `remina` was the drawn planet (now `remina-ink`) and the user's picture `user:remina-real` is now `remina`.
// Returns the new key; the caller writes it once and sets marksVer = 2, so the new `remina` is never mapped again.
function migrateMark(key) {
  var m = { "remina": "remina-ink", "user:remina-real": "remina", "user:tomie": "tomie-classic", "tomie-head": "tomie-classic", "user:tomie-head": "tomie-classic", "user:beetle": "beetle", "user:uzumaki-eye": "uzumaki-eye" }
  return m.hasOwnProperty(String(key)) ? m[String(key)] : String(key)
}

// A mark the user added (see bin/ito-marks): its adapted picture lives in the cache folder.
function customArt(key) {
  return key.indexOf("custom:") === 0 ? key.substring(7) : ""
}

// A mark from the user's assets folder (marks/<name>.png, bin/ito-assets): `user:<name>`. Unlike `custom:` it is drawn art (neutral ink + alpha),
// so it goes through the theme shader like the built-in ones.
function userName(key) {
  var m = /^user:([a-z0-9-]{1,24})$/.exec(String(key))
  if (m) return m[1]
  var e = userEntry(String(key))
  return e ? e.user : ""
}

// Whether a mark is the user's own picture -- either one they added, or one that replaces a built-in name
// (a mark folder file called "tomie.jpg" and so on). Drawn art can safely go through the theme shader; a
// picture cannot, so callers use this to turn the shader off for it (ItoImage's `tintable`).
function isCustom(key, overrides) {
  return !!(overrides && overrides[key]) || customArt(key) !== ""
}

// `scale` of a menu mark (S25: Tomie Classic is drawn 0.87 of its box), 1 for every other mark and for a user picture that replaces it.
function markScale(key, overrides) {
  if (overrides && overrides[key]) return 1
  var e = userEntry(String(key))
  return e && e.scale > 0 ? e.scale : 1
}

// Where a mark's picture is: the art folder for the built-in ones, the cache folder for the user's.
// `home` is the user's home directory, needed only for a custom one; `overrides` maps a built-in key to a picture
// of the user's own that replaces it (ItoConfig.markOverrides). `userSrc` is the URL of a `user:<name>` mark's file (ItoConfig.userMark);
// without it (the file is gone) the default mark shows.
function source(artBase, key, home, overrides, userSrc) {
  if (userName(key) !== "") {
    if (userSrc) return String(userSrc)
    return artBase + "system/" + find(menuMarks, userEntry(String(key)) ? "uzumaki" : "spiral").art
  }
  if (overrides && overrides[key]) return "file://" + overrides[key]
  var custom = customArt(key)
  if (custom !== "") return "file://" + home + "/.cache/ito/marks/" + custom + ".png"
  return artBase + "system/" + find(menuMarks, key).art
}

// The effect a mark has when the user has left the choice on Auto.
function autoEffect(key) {
  if (userEntry(String(key))) return userEntry(String(key)).fx
  return customArt(key) !== "" || userName(key) !== "" ? "pulse" : find(menuMarks, key).fx
}

function find(list, key) {
  for (var i = 0; i < list.length; i++)
    if (list[i].key === key) return list[i]
  return list[0]
}

// Not in `seals` on purpose: it would show as a sixth, directly-clickable card in the seal picker before
// any picture has actually been chosen, and picking it that way leaves the seal blank. The picker sets
// seal="custom" itself, only once sealPicker has actually adapted a picture -- see PageLogo.qml.
var customSeal = { key: "custom", text: "", scale: 1.0, name: "Your picture", custom: true,
  note: "Your own picture, adapted to the shell, in place of the letters." }

function findSeal(key) {
  return String(key) === "custom" ? customSeal : find(seals, key)
}

// The seal key to draw: `key`, or "tomie" when it is a user-backed art seal whose mark file is not in `names` (ItoConfig.userMarkNames).
function sealResolve(key, names) {
  var e = find(seals, String(key))
  if (!e || e.key !== String(key) || !e.user) return String(key)
  var list = names || []
  for (var i = 0; i < list.length; i++)
    if (list[i] === e.user) return String(key)
  return "tomie"
}

// The seal's side in device px for a bar (the custom-seal rule: 0.9 of the seal box height), and the sides the shipped art seals exist at.
function sealSide(barSize) { return Math.round(0.9 * Math.round(44 * barSize / 52)) }
var sealSides = [18, 20, 21, 23, 24, 27, 31, 33, 37, 60, 120]
function nearestSealSide(want) {
  var best = sealSides[0]
  for (var i = 1; i < sealSides.length; i++)
    if (Math.abs(sealSides[i] - want) < Math.abs(best - want)) best = sealSides[i]
  return best
}


// What stands on both sides of the seal. `veins` is the design's own bloodline; the rest are drawn in the same
// ink (scripts/gen-decor.py). `none` leaves the seal alone. The right-hand one is the left mirrored.
var decorations = [
  { key: "veins", wide: 1.5,    art: "decor/veins.png", name: "Veins",    note: "The bloodlines of the original design, reaching out of the seal." },
  { key: "thorns", wide: 1.25,   art: "decor/thorns.png",     name: "Thorns",   note: "A barbed stem, blood at every tip." },
  { key: "curls", wide: 1.25,    art: "decor/curls.png",      name: "Curls",    note: "Two Uzumaki spirals on one stem." },
  { key: "hair", wide: 1.3,     art: "decor/hair.png",       name: "Hair",     note: "Long strands of black hair, one caught in a curl." },
  { key: "drips", wide: 1.05,    art: "decor/drips.png",      name: "Drips",    note: "Blood running down in three trails that end in drops." },
  { key: "eyes", wide: 1.4,     art: "decor/eyes.png",       name: "Eyes",     note: "One Uzumaki eyeball, veined and ringed by rippling vortex bands." },
  { key: "cracks", wide: 1.3,   art: "decor/cracks.png",     name: "Cracks",   note: "A crack through the plate, branching, with blood in it." },
  { key: "stitches", wide: 1.15, art: "decor/stitches.png",   name: "Stitches", note: "A seam sewn shut, one drop coming through." },
  { key: "holes", wide: 1.2,    art: "decor/holes.png",      name: "Holes",    note: "The Amigara Fault's holes, bored straight through, a rim of blood on some." },
  { key: "teeth", wide: 1.15,   art: "decor/teeth.png",      name: "Teeth",    note: "Fangs breaking through a slim spine, red only at the root." },
  { key: "chain", wide: 1.1,    art: "decor/chain.png",      name: "Chain",    note: "A rusted chain, corroded where the links wear thin." },
  { key: "static", wide: 1.2,   art: "decor/static.png",     name: "Static",   note: "A dying picture: scanlines, snow and a torn band with a blood hairline." },
  { key: "fog", wide: 0.65,      art: "decor/fog.png",        name: "Fog",      note: "A long, narrow bank of Silent Hill fog, thinning away at both ends." },
  { key: "none", wide: 1.0,     art: "",                     name: "None",     note: "Nothing beside the seal." }
]

function decoration(cfg) {
  var wanted = String(cfg.get("sealDeco", "veins"))
  for (var i = 0; i < decorations.length; i++)
    if (decorations[i].key === wanted) return decorations[i]
  return decorations[0]
}


// The picture for a decoration or for the seal: the art folder for the built-in ones, or the user's own (adapted by
// bin/ito-marks into the cache) for "@custom".
function decoSource(artBase, deco, home) {
  if (!deco || deco.art === "") return ""
  if (deco.art === "@custom") return "file://" + home + "/.cache/ito/marks/_deco.png"
  return artBase + deco.art
}

function sealPicture(home) {
  return "file://" + home + "/.cache/ito/marks/_seal.png"
}

if (typeof module !== "undefined") module.exports = { userName: userName, isCustom: isCustom, markScale: markScale, source: source, autoEffect: autoEffect, find: find, menuMarks: menuMarks, resolve: resolve, migrateMark: migrateMark, userEntry: userEntry }
