// Reads the human tweak files (data/tweaks/<place>.json and palette.json) and resolves one
// place's look from them. The build only ever reads these files.
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { boundsOf, outlineOf, pathOf, reachesOf } from "../../ui/lib/footprint.js";
import { greebleReach } from "../../ui/lib/ship-hull.js";
import { crosses } from "./footprints.mjs";
import {
  AXIS_KEYS,
  CAMERA_KEYS,
  DRUM_ROOM_KEYS,
  FIXTURE_KEYS,
  FOOTPRINT_KEYS,
  GREEBLE_KEYS,
  MERGED_KEYS,
  originOf,
  PALETTE_NAME,
  PROFILE_DEFAULTS,
  PROFILE_KEYS,
  PROP_KINDS,
  SECTION_KEYS,
  SHIP_FIXTURES,
  SPAN_KEYS,
  SPINE_KEYS,
  STRIPE_KEYS,
  SURFACE_DEFAULTS,
  SURFACE_KEYS,
  TOP_KEYS,
  VIEW_KEYS,
  WALLS,
} from "./schema.mjs";

export { originOf };

const CORNERS = ["square", "rounded", "cut"];
/** How far an outline point may lie from its cell's centre, in cells. */
const OUTLINE_REACH = 1.5;
const CUTAWAYS = ["off", "hide-above", "ghost-above"];

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const local = (id) => id.slice(id.indexOf(".") + 1);

/**
 * A path for messages: under `shownAs` when given, else relative to the repo (the working
 * directory) where it lies under it.
 */
function shown(file, shownAs) {
  if (shownAs) return `${shownAs}/${basename(file)}`;
  const rel = relative(process.cwd(), file);
  return rel.startsWith("..") ? file : rel;
}

function unknownKeys(file, path, obj, allowed) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) throw new Error(`${file}: ${path ? `${path}.` : ""}${key}`);
  }
}

function expectObject(file, path, value) {
  if (!isObject(value)) throw new Error(`${file}: ${path} must be an object`);
}

function checkFixture(file, path, fixture) {
  expectObject(file, path, fixture);
  const allowed = FIXTURE_KEYS[fixture.type];
  if (!allowed) throw new Error(`${file}: ${path}.type: unknown fixture type ${JSON.stringify(fixture.type)}`);
  unknownKeys(file, path, fixture, allowed);
  const f = fixture;
  if (f.type === "bell" || f.type === "boom") {
    expectNumber(file, `${path}.side`, f.side);
    if (!Number.isInteger(f.deck)) throw new Error(`${file}: ${path}.deck must be a deck number`);
    for (const key of f.type === "bell" ? ["r", "len"] : ["len"]) expectSize(file, `${path}.${key}`, f[key]);
  } else if (f.type === "chevrons") {
    expectRoom(file, `${path}.room`, f.room);
    expectOneOf(file, `${path}.wall`, f.wall, WALLS);
  } else if (f.type === "prop") {
    expectOneOf(file, `${path}.kind`, f.kind, PROP_KINDS);
    expectRoom(file, `${path}.room`, f.room);
    expectPair(file, `${path}.at`, f.at, isNumber, "an [x, y] offset from the room's cell, in cells");
    expectPair(file, `${path}.size`, f.size, (v) => isNumber(v) && v >= 0, "a [width, length] in cells, 0 or more");
    if (f.grid !== undefined) expectPair(file, `${path}.grid`, f.grid, (v) => Number.isInteger(v) && v > 0, "an [across, along] count, whole and more than 0");
    if (f.gap !== undefined && (!isNumber(f.gap) || f.gap < 0)) throw new Error(`${file}: ${path}.gap must be a number of cells, 0 or more`);
    if (f.ribs !== undefined) {
      if (f.kind !== "core") throw new Error(`${file}: ${path}.ribs only applies to a core`);
      if (!Number.isInteger(f.ribs) || f.ribs < 2) throw new Error(`${file}: ${path}.ribs must be a whole number, 2 or more`);
    }
  }
}

const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

function expectNumber(file, path, value) {
  if (!isNumber(value)) throw new Error(`${file}: ${path} must be a number`);
}

function expectSize(file, path, value) {
  if (!isNumber(value) || value <= 0) throw new Error(`${file}: ${path} must be more than 0`);
}

function expectRoom(file, path, value) {
  if (typeof value !== "string" || !value) throw new Error(`${file}: ${path} must be a room id`);
}

function expectPair(file, path, value, ok, what) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(ok)) throw new Error(`${file}: ${path} must be ${what}`);
}

function expectOneOf(file, path, value, allowed) {
  if (!allowed.includes(value)) throw new Error(`${file}: ${path}: ${JSON.stringify(value)} is not one of ${allowed.join(", ")}`);
}

/** A number from lo up to (not including, with `open`) hi. */
function expectRange(file, path, value, lo, hi, open = true) {
  if (!isNumber(value) || value < lo || (open ? value >= hi : value > hi)) {
    throw new Error(`${file}: ${path} must be a number from ${lo} to ${open ? "under " : ""}${hi}`);
  }
}

function checkProfile(file, profile) {
  expectObject(file, "profile", profile);
  unknownKeys(file, "profile", profile, PROFILE_KEYS);
  if (profile.bevel !== undefined) expectRange(file, "profile.bevel", profile.bevel, 0, 0.5);
  if (profile.noseDrop !== undefined) expectRange(file, "profile.noseDrop", profile.noseDrop, 0, 1);
  if (profile.noseLength !== undefined) expectSize(file, "profile.noseLength", profile.noseLength);
  const spine = profile.spine;
  if (spine === undefined || spine === null) return;
  expectObject(file, "profile.spine", spine);
  unknownKeys(file, "profile.spine", spine, SPINE_KEYS);
  for (const key of SPINE_KEYS) expectNumber(file, `profile.spine.${key}`, spine[key]);
  if (spine.to <= spine.from) throw new Error(`${file}: profile.spine.to must be more than from`);
  expectSize(file, "profile.spine.width", spine.width);
  expectRange(file, "profile.spine.height", spine.height, 0, 1, false);
}

function checkSurface(file, surface, palette) {
  expectObject(file, "surface", surface);
  unknownKeys(file, "surface", surface, SURFACE_KEYS);
  for (const key of ["seams", "navLights"]) {
    if (surface[key] !== undefined && typeof surface[key] !== "boolean") throw new Error(`${file}: surface.${key} must be true or false`);
  }
  if (surface.windows !== undefined && (!Array.isArray(surface.windows) || !surface.windows.every((id) => typeof id === "string" && id))) {
    throw new Error(`${file}: surface.windows must be a list of room ids`);
  }
  const stripe = surface.stripe;
  if (stripe === undefined || stripe === null) return;
  expectObject(file, "surface.stripe", stripe);
  unknownKeys(file, "surface.stripe", stripe, STRIPE_KEYS);
  if (!Object.hasOwn(palette, stripe.paint)) throw new Error(`${file}: surface.stripe.paint: unknown palette name ${JSON.stringify(stripe.paint)}`);
  expectRange(file, "surface.stripe.at", stripe.at, 0, 1);
  expectSize(file, "surface.stripe.width", stripe.width);
  if (stripe.at + stripe.width > 1) throw new Error(`${file}: surface.stripe runs off the wall: at + width must be 1 or less`);
}

function checkGreebles(file, greebles) {
  if (!Array.isArray(greebles)) throw new Error(`${file}: greebles must be a list`);
  greebles.forEach((g, i) => {
    const path = `greebles[${i}]`;
    expectObject(file, path, g);
    const allowed = GREEBLE_KEYS[g.type];
    if (!allowed) throw new Error(`${file}: ${path}.type: unknown greeble ${JSON.stringify(g.type)}, not one of ${Object.keys(GREEBLE_KEYS).join(", ")}`);
    unknownKeys(file, path, g, allowed);
    expectNumber(file, `${path}.side`, g.side);
    expectNumber(file, `${path}.frame`, g.frame);
    if (g.type === "antenna") expectSize(file, `${path}.height`, g.height);
    if (g.type === "dish") expectSize(file, `${path}.r`, g.r);
  });
}

function checkFootprint(file, path, fp) {
  expectObject(file, path, fp);
  unknownKeys(file, path, fp, FOOTPRINT_KEYS);
  if (fp.span !== undefined) {
    expectObject(file, `${path}.span`, fp.span);
    unknownKeys(file, `${path}.span`, fp.span, SPAN_KEYS);
    for (const [key, n] of Object.entries(fp.span)) {
      if (!isNumber(n) || n < 0) throw new Error(`${file}: ${path}.span.${key} must be a number of cells, 0 or more`);
    }
  }
  if (fp.corners !== undefined) expectOneOf(file, `${path}.corners`, fp.corners, CORNERS);
  if (fp.r !== undefined) {
    // against the outline where there's one: it replaces the span
    const { x0, x1, y0, y1 } = boundsOf(Array.isArray(fp.outline) ? fp.outline : outlineOf({ span: fp.span }));
    if (!isNumber(fp.r) || fp.r < 0 || fp.r >= Math.min(x1 - x0, y1 - y0) / 2) {
      throw new Error(`${file}: ${path}.r must be 0 or more and under half the footprint's narrower side`);
    }
  }
  if (fp.outline !== undefined) {
    if (!Array.isArray(fp.outline) || fp.outline.length < 3) throw new Error(`${file}: ${path}.outline must be a list of 3 or more [x, y] points`);
    fp.outline.forEach((p, i) => {
      if (!Array.isArray(p) || p.length !== 2 || !p.every(isNumber)) throw new Error(`${file}: ${path}.outline[${i}] must be an [x, y] point`);
      if (p.some((v) => Math.abs(v) > OUTLINE_REACH)) {
        throw new Error(`${file}: ${path}.outline[${i}] is outside -${OUTLINE_REACH} to ${OUTLINE_REACH} cells`);
      }
    });
    if (crosses(fp.outline)) throw new Error(`${file}: ${path}.outline crosses itself`);
  }
}

/** A hull key: a deck number. */
const DECK = /^(0|-?[1-9]\d*)$/;

function checkHull(file, hull) {
  expectObject(file, "hull", hull);
  for (const [deck, points] of Object.entries(hull)) {
    const path = `hull.${deck}`;
    if (!DECK.test(deck)) throw new Error(`${file}: ${path}: a hull is keyed by deck number`);
    if (points === null) continue; // the deck back to its box, over a path from `like`
    if (!Array.isArray(points) || points.length < 3) throw new Error(`${file}: ${path} must be a list of 3 or more [x, y] or [x, y, r] points`);
    points.forEach((p, i) => {
      if (!Array.isArray(p) || p.length < 2 || p.length > 3 || !p.every(isNumber)) throw new Error(`${file}: ${path}[${i}] must be an [x, y] or [x, y, r] point`);
      if (p.length === 3 && p[2] <= 0) throw new Error(`${file}: ${path}[${i}]: r must be more than 0`);
    });
    if (crosses(points)) throw new Error(`${file}: ${path} crosses itself`);
    const reach = reachesOf(points);
    points.forEach((p, i) => {
      const q = points[(i + 1) % points.length];
      if (reach[i] + reach[(i + 1) % points.length] > Math.hypot(q[0] - p[0], q[1] - p[1]) + 1e-9) {
        throw new Error(`${file}: ${path}[${i}]: its rounded corners don't fit on the edge to the next point`);
      }
    });
    if (crosses(pathOf(points))) throw new Error(`${file}: ${path} crosses itself once its corners are rounded`);
  }
}

function checkView(file, view) {
  expectObject(file, "view", view);
  unknownKeys(file, "view", view, VIEW_KEYS);
  if (view.cutaway !== undefined) expectOneOf(file, "view.cutaway", view.cutaway, CUTAWAYS);
  if (view.camera !== undefined) {
    expectObject(file, "view.camera", view.camera);
    unknownKeys(file, "view.camera", view.camera, CAMERA_KEYS);
    for (const key of CAMERA_KEYS) {
      if (!isNumber(view.camera[key])) throw new Error(`${file}: view.camera.${key} must be a number (the camera needs ${CAMERA_KEYS.join(", ")})`);
    }
    if (view.camera.zoom <= 0) throw new Error(`${file}: view.camera.zoom must be more than 0`);
  }
}

/**
 * Checks one tweak file's keys and values, throwing with the file and key path of the first that
 * is wrong. `like` isn't followed: a file is checked as it is.
 * @param {string} file  the name messages give it
 * @param {object} tweak
 * @param {Record<string, string>} palette
 */
export function checkTweak(file, tweak, palette) {
  expectObject(file, "(top level)", tweak);
  unknownKeys(file, "", tweak, TOP_KEYS);
  if (tweak.like !== undefined && typeof tweak.like !== "string") throw new Error(`${file}: like must be a place name`);

  for (const key of ["paint", "paintDistricts"]) {
    if (tweak[key] === undefined) continue;
    expectObject(file, key, tweak[key]);
    for (const [name, colour] of Object.entries(tweak[key])) {
      if (!Object.hasOwn(palette, colour)) {
        throw new Error(`${file}: ${key}.${name}: unknown palette name ${JSON.stringify(colour)}`);
      }
    }
  }

  if (tweak.fixtures !== undefined) {
    if (!Array.isArray(tweak.fixtures)) throw new Error(`${file}: fixtures must be a list`);
    tweak.fixtures.forEach((f, i) => checkFixture(file, `fixtures[${i}]`, f));
  }

  if (tweak.footprints !== undefined) {
    expectObject(file, "footprints", tweak.footprints);
    for (const [id, fp] of Object.entries(tweak.footprints)) checkFootprint(file, `footprints.${id}`, fp);
  }
  if (tweak.hull !== undefined) checkHull(file, tweak.hull);
  if (tweak.profile !== undefined) checkProfile(file, tweak.profile);
  if (tweak.surface !== undefined) checkSurface(file, tweak.surface, palette);
  if (tweak.greebles !== undefined) checkGreebles(file, tweak.greebles);
  if (tweak.view !== undefined) checkView(file, tweak.view);

  if (tweak.place !== undefined) {
    expectObject(file, "place", tweak.place);
    for (const [id, at] of Object.entries(tweak.place)) {
      expectObject(file, `place.${id}`, at);
      unknownKeys(file, `place.${id}`, at, ["x", "y", "z"]);
    }
  }

  for (const [name, allowed] of Object.entries(SECTION_KEYS)) {
    if (tweak[name] === undefined) continue;
    expectObject(file, name, tweak[name]);
    unknownKeys(file, name, tweak[name], allowed);
  }
  const drum = tweak.drum;
  if (drum?.rooms !== undefined) {
    expectObject(file, "drum.rooms", drum.rooms);
    for (const [id, r] of Object.entries(drum.rooms)) {
      expectObject(file, `drum.rooms.${id}`, r);
      unknownKeys(file, `drum.rooms.${id}`, r, DRUM_ROOM_KEYS);
    }
  }
  if (drum?.axis !== undefined) {
    expectObject(file, "drum.axis", drum.axis);
    unknownKeys(file, "drum.axis", drum.axis, AXIS_KEYS);
  }
}

function readJson(file, name) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`${name}: ${err.message}`);
  }
}

/**
 * Loads palette.json and every other *.json in `dir` as a place, keyed by file name without
 * `.json`. Throws, naming the file and key path, on bad JSON, an unknown key or an unknown
 * palette name.
 * @param {string} dir
 * @param {{shownAs?: string}} [opts] `shownAs` names the dir in messages ("data/tweaks"), for a
 *   copy read from elsewhere.
 * @returns {{palette: Record<string, string>, places: Record<string, object>}}
 */
export function loadTweaks(dir, { shownAs } = {}) {
  const palettePath = shown(join(dir, "palette.json"), shownAs);
  const palette = readJson(join(dir, "palette.json"), palettePath);
  expectObject(palettePath, "(top level)", palette);
  for (const [name, colour] of Object.entries(palette)) {
    if (!PALETTE_NAME.test(name)) {
      throw new Error(`${palettePath}: ${JSON.stringify(name)} is not a palette name (lower-case letters, digits and hyphens, starting with a letter)`);
    }
    if (typeof colour !== "string") throw new Error(`${palettePath}: ${name} must be a colour string`);
  }

  const places = {};
  for (const entry of readdirSync(dir).sort()) {
    if (!entry.endsWith(".json") || entry === "palette.json") continue;
    const file = join(dir, entry);
    const tweak = readJson(file, shown(file, shownAs));
    checkTweak(shown(file, shownAs), tweak, palette);
    places[entry.slice(0, -".json".length)] = tweak;
  }
  const loaded = { palette, places };
  for (const id of Object.keys(places)) merged(id, loaded); // a bad `like` fails here, rendered or not
  return loaded;
}

/**
 * A place's tweak with its `like` chain merged under it; nearest file wins. Throws on a like
 * cycle or a like naming no file. A place with no file is `{}`.
 * @param {string} placeId
 * @param {{palette: Record<string, string>, places: Record<string, object>}} tweaks
 * @returns {object}
 */
export function resolveTweak(placeId, tweaks) {
  return merged(placeId, tweaks);
}

function merged(placeId, tweaks, chain = []) {
  const own = tweaks.places[placeId];
  if (chain.includes(placeId)) {
    throw new Error(`data/tweaks/${chain[0]}.json: like cycle ${[...chain, placeId].join(" -> ")}`);
  }
  if (!own) return {};
  if (own.like === undefined) return own;
  if (!tweaks.places[own.like]) throw new Error(`data/tweaks/${placeId}.json: like names ${own.like}, which has no tweak file`);
  const base = merged(own.like, tweaks, [...chain, placeId]);
  const out = { ...base, ...own };
  for (const key of MERGED_KEYS) {
    if (base[key] || own[key]) out[key] = { ...base[key], ...own[key] };
  }
  return out;
}

/**
 * A ship plan's profile, surface and greebles: the tweak's over row C's defaults. Throws on a stripe
 * paint the palette lacks and on a bevel bigger than a rounded corner of a hull path, which would
 * turn the bevel's arc inside out, and on a greeble half on the spine and half off it.
 */
function shipLooks(file, rooms, hull, tweak, palette) {
  const canopies = rooms.filter((r) => r.canopy).map((r) => local(r.id));
  const profile = { ...PROFILE_DEFAULTS, ...tweak.profile };
  const surface = { ...SURFACE_DEFAULTS, windows: canopies, ...tweak.surface };
  const byDefault = (key, sub) => (tweak[key]?.[sub] === undefined ? " (the default)" : "");
  if (surface.stripe && !Object.hasOwn(palette, surface.stripe.paint)) {
    throw new Error(`${file}: surface.stripe.paint${byDefault("surface", "stripe")}: unknown palette name ${JSON.stringify(surface.stripe.paint)}`);
  }
  for (const [deck, points] of Object.entries(hull)) {
    points.forEach(([, , r], i) => {
      if (r !== undefined && profile.bevel > r + 1e-9) {
        throw new Error(`${file}: profile.bevel ${profile.bevel}${byDefault("profile", "bevel")} is more than hull.${deck}[${i}]'s corner radius ${r}; make the bevel smaller or the corner rounder`);
      }
    });
  }
  const greebles = tweak.greebles ?? [];
  // a greeble stands on the roof or on the spine, never half on each: it would stand into the spine's side
  const spine = profile.spine;
  if (spine) {
    greebles.forEach((g, i) => {
      const [rx, ry] = greebleReach(g);
      const [x0, x1, y0, y1] = [g.side - rx, g.side + rx, g.frame - ry, g.frame + ry];
      const [sx0, sx1] = [-spine.width / 2, spine.width / 2];
      const meets = x1 > sx0 && x0 < sx1 && y1 > spine.from && y0 < spine.to;
      const on = x0 >= sx0 && x1 <= sx1 && y0 >= spine.from && y1 <= spine.to;
      if (meets && !on) throw new Error(`${file}: greebles[${i}] (${g.type}) straddles the edge of profile.spine; put it on the spine or clear of it`);
    });
  }
  return { profile, surface, greebles };
}

/** " (from <base>.json via like)" for a value a place inherits, else "". */
export function via(placeId, origin) {
  return origin && origin !== placeId ? ` (from ${origin}.json via like)` : "";
}

/** The ids a tweak file itself (not through `like`) names, as [path, local id]. */
function namedRooms(tweak) {
  const named = [];
  for (const id of Object.keys(tweak.paint ?? {})) named.push([`paint.${id}`, id]);
  for (const id of Object.keys(tweak.footprints ?? {})) named.push([`footprints.${id}`, id]);
  for (const id of Object.keys(tweak.place ?? {})) named.push([`place.${id}`, id]);
  (tweak.fixtures ?? []).forEach((f, i) => {
    if (f.room !== undefined) named.push([`fixtures[${i}].room`, f.room]);
  });
  (tweak.surface?.windows ?? []).forEach((id, i) => named.push([`surface.windows[${i}]`, id]));
  for (const id of Object.keys(tweak.drum?.rooms ?? {})) named.push([`drum.rooms.${id}`, id]);
  if (tweak.drum?.axis?.room !== undefined) named.push(["drum.axis.room", tweak.drum.axis.room]);
  const town = tweak.town ?? {};
  for (const key of ["root", "gate"]) if (town[key] !== undefined) named.push([`town.${key}`, town[key]]);
  (town.wells ?? []).forEach((id, i) => named.push([`town.wells[${i}]`, id]));
  for (const id of Object.keys(town.ground ?? {})) named.push([`town.ground.${id}`, id]);
  if (town.river?.bridge !== undefined) named.push(["town.river.bridge", town.river.bridge]);
  return named;
}

/**
 * One place's full look. Paint gives every room a palette name: its own, else its district's in
 * `paintDistricts`, else its district if that is a palette name, else a default by kind (a decks
 * passage, whose name is its address: midring; a berth: docks; otherwise industrial). A decks
 * place has its footprints, by local id, and its hull paths, by deck (a deck whose tweak is null
 * keeps its box); a ship plan its `profile`, `surface` and `greebles`, the tweak's over row C's
 * defaults (windows in every room with a canopy); every place has its view, the tweak's over its
 * kind's. Throws on a key that would do nothing: a hull or footprints off decks, a footprint on a
 * passage or blister, a cutaway other than off off decks, a camera on a town, a ship look or ship
 * fixture off a plan; and on a bevel bigger than a rounded hull corner.
 * @param {string} placeId
 * @param {object[]} rooms  the place's placed rooms (full ids, `name`, `address`, `flags`, `district`)
 * @param {string} layoutKind  the area's layout kind
 * @param {{palette: Record<string, string>, places: Record<string, object>}} tweaks
 * @param {"area" | "plan"} [kind]  a place in the world, or a ship plan
 * @returns {{look: object, orphans: string[]}}  orphans: paths of this place's own tweaks that name a room or deck it lacks
 */
export function resolveLook(placeId, rooms, layoutKind, tweaks, kind = "area") {
  const tweak = resolveTweak(placeId, tweaks);
  const file = `data/tweaks/${placeId}.json`;
  const have = new Set(rooms.map((r) => local(r.id)));

  const paint = {};
  for (const room of rooms) {
    const id = local(room.id);
    const { district } = room;
    let name = tweak.paint?.[id] ?? (district !== undefined ? tweak.paintDistricts?.[district] : undefined);
    if (name === undefined && district !== undefined && Object.hasOwn(tweaks.palette, district)) name = district;
    if (name === undefined) {
      const passage = layoutKind === "decks" && String(room.name).toLowerCase() === String(room.address).toLowerCase();
      if (passage) name = "midring";
      else if (room.flags?.includes("berth")) name = "docks";
      else name = "industrial";
    }
    if (!Object.hasOwn(tweaks.palette, name)) throw new Error(`${file}: paint.${id}: unknown palette name ${JSON.stringify(name)}`);
    paint[id] = name;
  }

  if (layoutKind !== "decks") {
    for (const key of ["hull", "footprints"]) {
      if (Object.keys(tweak[key] ?? {}).length) throw new Error(`${file}: ${key} only applies to decks places`);
    }
  }

  // keys that would do nothing are errors (S16)
  if (layoutKind === "decks") {
    const blisters = new Set((tweak.fixtures ?? []).filter((f) => f.type === "blister").map((f) => f.room));
    for (const room of rooms) {
      const id = local(room.id);
      if (!tweak.footprints?.[id]) continue;
      const passage = String(room.name).toLowerCase() === String(room.address).toLowerCase();
      if (passage || blisters.has(id)) {
        throw new Error(`${file}: footprints.${id}${via(placeId, originOf(placeId, tweaks, "footprints", id))}: footprints apply to rooms, not passages or blisters`);
      }
    }
  } else if (tweak.view?.cutaway !== undefined && tweak.view.cutaway !== "off") {
    throw new Error(`${file}: view.cutaway ${JSON.stringify(tweak.view.cutaway)} only applies to decks places`);
  }
  if (layoutKind !== "decks" && layoutKind !== "wheel" && tweak.town && tweak.view?.camera) {
    throw new Error(`${file}: view.camera doesn't apply to towns`);
  }

  if (kind !== "plan") {
    for (const key of ["profile", "surface", "greebles"]) {
      if (tweak[key] !== undefined) throw new Error(`${file}: ${key} only applies to ship plans`);
    }
    (tweak.fixtures ?? []).forEach((f, i) => {
      if (SHIP_FIXTURES.includes(f.type)) throw new Error(`${file}: fixtures[${i}] (${f.type}) only applies to ship plans`);
    });
  }

  const look = { paint, fixtures: tweak.fixtures ?? [] };
  if (layoutKind === "decks") {
    look.footprints = tweak.footprints ?? {};
    look.hull = Object.fromEntries(Object.entries(tweak.hull ?? {}).filter(([, points]) => points !== null));
  }
  if (kind === "plan") Object.assign(look, shipLooks(file, rooms, look.hull ?? {}, tweak, tweaks.palette));
  look.view = { cutaway: layoutKind === "decks" ? "hide-above" : "off", ...tweak.view };
  for (const name of Object.keys(SECTION_KEYS)) if (tweak[name]) look[name] = tweak[name];

  const own = tweaks.places[placeId] ?? {};
  const orphans = namedRooms(own).filter(([, id]) => !have.has(id)).map(([path]) => path);
  const decks = new Set(rooms.filter((r) => r.at).map((r) => String(r.at.deck)));
  // a null deck is an opt-out, often a blanket one, so never an orphan (S17)
  for (const [deck, points] of Object.entries(own.hull ?? {})) if (points !== null && !decks.has(deck)) orphans.push(`hull.${deck}`);
  return { look, orphans };
}
