// Reads the human tweak files (data/tweaks/<place>.json and palette.json) and resolves one
// place's look from them. The build only ever reads these files.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { boundsOf, outlineOf, pathOf, reachesOf } from "../../ui/lib/footprint.js";
import { crosses } from "./footprints.mjs";

const TOP_KEYS = ["like", "paint", "paintDistricts", "fixtures", "footprints", "hull", "view", "place", "drum", "town", "wheel"];
/** The builder sections: allowed keys of each (stage 1). `wheel` is empty. */
const SECTION_KEYS = {
  drum: ["rooms", "axis", "way"],
  town: ["root", "uphill", "ground", "gate", "wells", "river", "scarp"],
  wheel: [],
};
const DRUM_ROOM_KEYS = ["x", "y", "z", "hour", "band", "terrain"];
const AXIS_KEYS = ["room", "r", "len"];
const FIXTURE_KEYS = {
  blister: ["type", "room"],
  cradle: ["type", "side", "deck", "hw", "hh", "len"],
  mast: ["type", "side", "frame", "height"],
  "drum-cradle": ["type", "hour", "z", "hw", "h", "hl"],
};

const FOOTPRINT_KEYS = ["span", "corners", "r", "outline"];
const SPAN_KEYS = ["fore", "aft", "port", "starboard"];
const CORNERS = ["square", "rounded", "cut"];
/** How far an outline point may lie from its cell's centre, in cells. */
const OUTLINE_REACH = 1.5;
const VIEW_KEYS = ["cutaway", "camera"];
const CUTAWAYS = ["off", "hide-above", "ghost-above"];
const CAMERA_KEYS = ["yaw", "pitch", "zoom"];

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const local = (id) => id.slice(id.indexOf(".") + 1);

/** A path for messages: relative to the repo (the working directory) where it lies under it. */
function shown(file) {
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
}

const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

function expectOneOf(file, path, value, allowed) {
  if (!allowed.includes(value)) throw new Error(`${file}: ${path}: ${JSON.stringify(value)} is not one of ${allowed.join(", ")}`);
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
    const { x0, x1, y0, y1 } = boundsOf(outlineOf({ span: fp.span }));
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

function checkTweak(file, tweak, palette) {
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

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`${shown(file)}: ${err.message}`);
  }
}

/**
 * Loads palette.json and every other *.json in `dir` as a place, keyed by file name without
 * `.json`. Throws, naming the file and key path, on bad JSON, an unknown key or an unknown
 * palette name.
 * @param {string} dir
 * @returns {{palette: Record<string, string>, places: Record<string, object>}}
 */
export function loadTweaks(dir) {
  const palettePath = join(dir, "palette.json");
  const palette = readJson(palettePath);
  expectObject(shown(palettePath), "(top level)", palette);
  for (const [name, colour] of Object.entries(palette)) {
    if (typeof colour !== "string") throw new Error(`${shown(palettePath)}: ${name} must be a colour string`);
  }

  const places = {};
  for (const entry of readdirSync(dir).sort()) {
    if (!entry.endsWith(".json") || entry === "palette.json") continue;
    const file = join(dir, entry);
    const tweak = readJson(file);
    checkTweak(shown(file), tweak, palette);
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
  for (const key of ["paint", "paintDistricts", "footprints", "hull", "view", ...Object.keys(SECTION_KEYS), "place"]) {
    if (base[key] || own[key]) out[key] = { ...base[key], ...own[key] };
  }
  return out;
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
 * keeps its box); every place has its view, the tweak's over its kind's.
 * @param {string} placeId
 * @param {object[]} rooms  the place's placed rooms (full ids, `name`, `address`, `flags`, `district`)
 * @param {string} layoutKind  the area's layout kind
 * @param {{palette: Record<string, string>, places: Record<string, object>}} tweaks
 * @returns {{look: object, orphans: string[]}}  orphans: paths of this place's own tweaks that name a room or deck it lacks
 */
export function resolveLook(placeId, rooms, layoutKind, tweaks) {
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

  const look = { paint, fixtures: tweak.fixtures ?? [] };
  if (layoutKind === "decks") {
    look.footprints = tweak.footprints ?? {};
    look.hull = Object.fromEntries(Object.entries(tweak.hull ?? {}).filter(([, points]) => points !== null));
  }
  look.view = { cutaway: layoutKind === "decks" ? "hide-above" : "off", ...tweak.view };
  for (const name of Object.keys(SECTION_KEYS)) if (tweak[name]) look[name] = tweak[name];

  const own = tweaks.places[placeId] ?? {};
  const orphans = namedRooms(own).filter(([, id]) => !have.has(id)).map(([path]) => path);
  const decks = new Set(rooms.filter((r) => r.at).map((r) => String(r.at.deck)));
  for (const deck of Object.keys(own.hull ?? {})) if (!decks.has(deck)) orphans.push(`hull.${deck}`);
  return { look, orphans };
}
