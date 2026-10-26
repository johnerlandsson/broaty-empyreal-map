// The editor's edits, each a pure function over one place's own tweak (data/tweaks/<place>.json
// as it is on disk, its `like` not merged in): it returns a new tweak and never changes the one it
// was given. Rooms are named by local id, decks by number as a string. Nothing here checks the
// result; the server's candidate build does. No DOM, no Node; the editor page loads it.
import {
  AXIS_KEYS,
  CAMERA_KEYS,
  DRUM_ROOM_KEYS,
  FIXTURE_KEYS,
  FOOTPRINT_KEYS,
  MERGED_KEYS,
  originOf,
  SECTION_KEYS,
  SPAN_KEYS,
  TOP_KEYS,
  VIEW_KEYS,
} from "../../scripts/source/schema.mjs";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** A copy of the tweak, changed by `change`. */
function edit(t, change) {
  const out = structuredClone(t ?? {});
  change(out);
  return out;
}

/** The object at `key` in `obj`, made where there's none. */
function at(obj, key) {
  if (!isObject(obj[key])) obj[key] = {};
  return obj[key];
}

/** `obj` with `patch` over it, a key the patch gives as undefined removed. */
function patched(obj, patch) {
  const out = { ...obj, ...structuredClone(patch) };
  for (const [key, value] of Object.entries(patch)) if (value === undefined) delete out[key];
  return out;
}

/** The deck's own hull path in an edited copy; a deck whose path is only inherited has none to edit. */
function ownPath(out, deck) {
  const points = out.hull?.[deck];
  if (!Array.isArray(points)) throw new Error(`hull.${deck}: no path of its own to edit`);
  return points;
}

/** Paints a room a palette name. */
export function setPaint(t, local, name) {
  return edit(t, (out) => {
    at(out, "paint")[local] = name;
  });
}

/** Sets a room's footprint; a null one removes it, back to the plain cell. */
export function setFootprint(t, local, fp) {
  if (!fp) return reset(t, ["footprints", local]);
  return edit(t, (out) => {
    at(out, "footprints")[local] = structuredClone(fp);
  });
}

/** Sets a deck's hull path: [x, y] or [x, y, r] points. */
export function setHull(t, deck, points) {
  return edit(t, (out) => {
    at(out, "hull")[deck] = structuredClone(points);
  });
}

/** Moves a deck's hull point i, keeping its rounding. */
export function moveHullPoint(t, deck, i, [x, y]) {
  return edit(t, (out) => {
    const points = ownPath(out, deck);
    points[i] = points[i].length === 3 ? [x, y, points[i][2]] : [x, y];
  });
}

/** Adds a sharp point to a deck's hull path after its point `afterIndex`. */
export function addHullPoint(t, deck, afterIndex, [x, y]) {
  return edit(t, (out) => {
    ownPath(out, deck).splice(afterIndex + 1, 0, [x, y]);
  });
}

/** Removes a deck's hull point i. */
export function removeHullPoint(t, deck, i) {
  return edit(t, (out) => {
    ownPath(out, deck).splice(i, 1);
  });
}

/** Rounds a deck's hull corner i to radius r; r 0 makes it sharp. */
export function setHullCorner(t, deck, i, r) {
  return edit(t, (out) => {
    const points = ownPath(out, deck);
    const [x, y] = points[i];
    points[i] = r > 0 ? [x, y, r] : [x, y];
  });
}

/**
 * Puts a deck back to its box: removes its own path, or, where a path it would inherit through
 * `like` must be cancelled, sets it null.
 */
export function boxHull(t, deck, inherited) {
  if (!inherited) return reset(t, ["hull", deck]);
  return edit(t, (out) => {
    at(out, "hull")[deck] = null;
  });
}

/** Changes the tweak's own fixture i: `patch` over it, a key given as undefined removed. */
export function moveFixture(t, i, patch) {
  return edit(t, (out) => {
    if (!isObject(out.fixtures?.[i])) throw new Error(`fixtures[${i}]: no such fixture of its own`);
    out.fixtures[i] = patched(out.fixtures[i], patch);
  });
}

/** Sets view keys: `patch` over the view, a key given as undefined removed. */
export function setView(t, patch) {
  const out = edit(t, (o) => {
    o.view = patched(o.view ?? {}, patch);
  });
  return Object.keys(out.view).length ? out : reset(out, ["view"]);
}

/**
 * Removes the tweak's own value at a key path, so an inherited one (or the default) shows again,
 * and then each object above it that is left empty. A list left empty stays: an empty `fixtures`
 * says none, over any inherited.
 * @param {object} t
 * @param {string[]} keyPath
 */
export function reset(t, keyPath) {
  return edit(t, (out) => {
    const chain = [out];
    for (const key of keyPath.slice(0, -1)) {
      const next = chain[chain.length - 1][key];
      if (next === null || typeof next !== "object") return;
      chain.push(next);
    }
    const remove = (obj, key) => (Array.isArray(obj) ? obj.splice(Number(key), 1) : delete obj[key]);
    remove(chain[chain.length - 1], keyPath[keyPath.length - 1]);
    for (let k = chain.length - 1; k > 0; k--) {
      if (!isObject(chain[k]) || Object.keys(chain[k]).length) break;
      remove(chain[k - 1], keyPath[k - 1]);
    }
  });
}

/**
 * Where a place's resolved value at a key path comes from: the place whose own file gives it,
 * through `like` (each key of a merged section from its nearest file, any other key whole), and
 * whether that's the place itself. `from` is null for a default.
 * @param {{places: Record<string, object>}} tweaks
 * @param {string} placeId
 * @param {string[]} keyPath
 * @returns {{from: string | null, own: boolean}}
 */
export function origin(tweaks, placeId, [key, sub]) {
  const from = originOf(placeId, tweaks, key, MERGED_KEYS.includes(key) ? sub : undefined);
  return { from, own: from === placeId };
}

// How each part of a tweak is ordered: `keys` (a list, or one from the value) first, in that
// order, and the rest after as they were; `of` each key's own; `each` every entry's of a list or a
// map keyed by room or deck.
const SHAPE = {
  keys: TOP_KEYS,
  of: {
    footprints: { each: { keys: FOOTPRINT_KEYS, of: { span: { keys: SPAN_KEYS } } } },
    fixtures: { each: { keys: (f) => FIXTURE_KEYS[f.type] ?? [] } },
    view: { keys: VIEW_KEYS, of: { camera: { keys: CAMERA_KEYS } } },
    drum: { keys: SECTION_KEYS.drum, of: { rooms: { each: { keys: DRUM_ROOM_KEYS } }, axis: { keys: AXIS_KEYS } } },
    town: { keys: SECTION_KEYS.town },
  },
};

function arranged(value, shape) {
  if (!shape) return value;
  if (Array.isArray(value)) return shape.each ? value.map((v) => arranged(v, shape.each)) : value;
  if (!isObject(value)) return value;
  if (shape.each) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, arranged(v, shape.each)]));
  const first = typeof shape.keys === "function" ? shape.keys(value) : shape.keys;
  const keys = [...first.filter((k) => Object.hasOwn(value, k)), ...Object.keys(value).filter((k) => !first.includes(k))];
  return Object.fromEntries(keys.map((k) => [k, arranged(value[k], shape.of?.[k])]));
}

/** A copy of the tweak with its keys in the schema's order, as a file is written; room ids and decks keep theirs. */
export function ordered(t) {
  return arranged(structuredClone(t), SHAPE);
}
