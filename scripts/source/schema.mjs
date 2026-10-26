// The tweak files' schema: the keys each part may have, in the order they're written, and where a
// value comes from down a `like` chain. No Node imports, so the browser's editor can load it too.

/** A tweak file's top keys, in the order a file is written. */
export const TOP_KEYS = ["like", "paint", "paintDistricts", "footprints", "hull", "fixtures", "view", "place", "drum", "town", "wheel"];
/** The builder sections: allowed keys of each (stage 1). `wheel` is empty. */
export const SECTION_KEYS = {
  drum: ["rooms", "axis", "way"],
  town: ["root", "uphill", "ground", "gate", "wells", "river", "scarp"],
  wheel: [],
};
export const DRUM_ROOM_KEYS = ["x", "y", "z", "hour", "band", "terrain"];
export const AXIS_KEYS = ["room", "r", "len"];
export const FIXTURE_KEYS = {
  blister: ["type", "room"],
  cradle: ["type", "side", "deck", "hw", "hh", "len"],
  mast: ["type", "side", "frame", "height"],
  "drum-cradle": ["type", "hour", "z", "hw", "h", "hl"],
};
export const FOOTPRINT_KEYS = ["span", "corners", "r", "outline"];
export const SPAN_KEYS = ["fore", "aft", "port", "starboard"];
export const VIEW_KEYS = ["cutaway", "camera"];
export const CAMERA_KEYS = ["yaw", "pitch", "zoom"];
/** A palette name: lower case, starting with a letter, then letters, digits and hyphens. */
export const PALETTE_NAME = /^[a-z][a-z0-9-]*$/;
/** The top keys `like` merges key by key (nearest file wins each); the rest it takes whole. */
export const MERGED_KEYS = ["paint", "paintDistricts", "footprints", "hull", "view", ...Object.keys(SECTION_KEYS), "place"];

/**
 * The place whose own file gives a place's resolved `key` (and, with `sub`, its `key.sub`): the
 * place itself, else the nearest down its `like` chain; null where none does.
 * @param {string} placeId
 * @param {{places: Record<string, object>}} tweaks
 * @param {string} key
 * @param {string} [sub]
 * @returns {string | null}
 */
export function originOf(placeId, tweaks, key, sub) {
  for (let id = placeId, seen = new Set(); id && !seen.has(id); id = tweaks.places[id]?.like) {
    seen.add(id);
    const own = tweaks.places[id]?.[key];
    if (own !== undefined && (sub === undefined || Object.hasOwn(own ?? {}, sub))) return id;
  }
  return null;
}
