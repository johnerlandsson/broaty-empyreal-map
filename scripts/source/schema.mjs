// The tweak files' schema: the keys each part may have, in the order they're written, and where a
// value comes from down a `like` chain. No Node imports, so the browser's editor can load it too.

/** A tweak file's top keys, in the order a file is written. */
export const TOP_KEYS = ["like", "paint", "paintDistricts", "footprints", "hull", "profile", "surface", "greebles", "fixtures", "view", "place", "drum", "town", "wheel"];
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
  bell: ["type", "side", "deck", "r", "len"],
  boom: ["type", "side", "deck", "len"],
  chevrons: ["type", "room", "wall"],
  prop: ["type", "kind", "room", "at", "size", "grid", "gap", "ribs"],
};
/** The fixture types only a ship plan has. */
export const SHIP_FIXTURES = ["bell", "boom", "chevrons", "prop"];
export const PROP_KINDS = ["crate", "seat", "core", "bulkhead", "slot", "rails"];
export const WALLS = ["port", "starboard", "fore", "aft"];
/** A ship plan's looks (John's pick C): the hull's shape in height, its surface, and what's on its roof. */
export const PROFILE_KEYS = ["bevel", "noseDrop", "noseLength", "spine"];
export const SPINE_KEYS = ["from", "to", "width", "height"];
export const SURFACE_KEYS = ["seams", "windows", "stripe", "navLights"];
export const STRIPE_KEYS = ["paint", "at", "width"];
export const GREEBLE_KEYS = {
  vent: ["type", "side", "frame"],
  antenna: ["type", "side", "frame", "height"],
  dish: ["type", "side", "frame", "r"],
};
/** The ship looks' defaults, row C's; `windows` (null here) defaults to every room with a canopy. */
export const PROFILE_DEFAULTS = { bevel: 0.12, noseDrop: 0.35, noseLength: 0.8, spine: null };
export const SURFACE_DEFAULTS = { seams: true, windows: null, stripe: { paint: "residential", at: 0.3, width: 0.14 }, navLights: true };
export const FOOTPRINT_KEYS = ["span", "corners", "r", "outline"];
export const SPAN_KEYS = ["fore", "aft", "port", "starboard"];
export const VIEW_KEYS = ["cutaway", "camera"];
export const CAMERA_KEYS = ["yaw", "pitch", "zoom"];
/** A palette name: lower case, starting with a letter, then letters, digits and hyphens. */
export const PALETTE_NAME = /^[a-z][a-z0-9-]*$/;
/** The top keys `like` merges key by key (nearest file wins each); the rest it takes whole. */
export const MERGED_KEYS = ["paint", "paintDistricts", "footprints", "hull", "profile", "surface", "view", ...Object.keys(SECTION_KEYS), "place"];

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
