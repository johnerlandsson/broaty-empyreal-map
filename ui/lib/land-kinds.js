// The kind of ground, track and region of a generated land place. The ground is the terrain the
// game sends (gmcp.md §9.5.1) where it sends one; else, for a place saved before it did or sent as
// `room`, it's read from the name the game gives it (surface-words.ts `placeTitle`). Pure.

/** The eleven land terrains the game sends, as gmcp.md §9.5.1 lists them. land-patterns.js has a
 *  ground for each (its tests check). */
export const TERRAINS = Object.freeze(["water", "ice", "woods", "reeds", "scrub", "cushions", "salt", "rock", "stones", "dust", "earth"]);
const TERRAIN_SET = new Set(TERRAINS);

/** v if it's one of the eleven land terrains, else undefined (`room`, junk, or one we can't draw). */
export const landTerrain = (v) => (TERRAIN_SET.has(v) ? v : undefined);

/** Title groups the terrain can't say, so they win over it: a road end, and the lava's edge (sent as `rock`). */
const OVER_TERRAIN = new Set(["road", "molten"]);

/** The groups, in the order the spec's table lists them. */
export const GROUPS = ["open", "road", "waymark", "high", "slope", "low", "rock", "dust", "workings", "water", "salt", "ice", "molten"];

const BY_GROUP = {
  open: ["Open Ground", "On the Downs", "Rolling Ground", "Top of a Slope"],
  road: ["Road End"],
  waymark: ["Cairn", "Marker Stone"],
  high: ["Hilltop", "Summit", "Knoll", "Ice Dome", "Saddle", "Low Pass", "Saddle in the Ice"],
  slope: ["Rising Ground", "Hillside", "Steep Hillside", "Stony Slope"],
  low: ["Hollow", "Head of a Hollow", "Hollow in the Ice", "Head of a Gully", "Head of an Ice Gully", "Channel", "Shallow Channel", "Meeting of Channels"],
  rock: ["Rock Outcrop", "Bare Rock", "Stony Ground", "Crater Rim"],
  dust: ["Drifted Dust", "Dust Plain"],
  workings: ["Old Workings", "Old Shaft", "Fallen Adit"],
  water: ["Pond", "River Bank", "Spring", "Beach"],
  salt: ["The Salt Pans"],
  ice: ["Ice Field", "Ice Slope", "Frozen Shore", "Ice Shore"],
  molten: ["Edge of the Lava"],
};

/** Every exact title the game gives, with its group. */
export const TITLES = new Map(GROUPS.flatMap((g) => BY_GROUP[g].map((t) => [t, g])));

// "On the Downs" / "On the Terrace Track": the whole name is the place.
const onWhole = (name) => (name.startsWith("On ") ? name.slice(3) : null);

// "Hollow on the Downs": the last " on " / " by " splits title from suffix.
function split(name) {
  const i = Math.max(name.lastIndexOf(" on "), name.lastIndexOf(" by "));
  return i < 0 ? null : { base: name.slice(0, i), where: name.slice(i + 4) };
}

const isTrack = (x) => / Track$/.test(x);
const whereOf = (name) => onWhole(name) ?? split(name)?.where ?? null;

export function groupOf(id, name) {
  if (id.includes(".join.")) return "road";
  if (name.startsWith("On ")) return "open";
  const base = split(name)?.base ?? name;
  return TITLES.get(base) ?? "open";
}

/** Title groups that say the place's shape or a thing on it, not its ground: under a terrain's colour
 *  their texture still shows (reference/land-terrain-options.png, B). */
const SHAPES = new Set(["high", "slope", "low", "waymark", "workings"]);

/**
 * How an octagon is drawn, from one reading of its title: `ground` its colour, `texture` what's
 * over it. A road end and the lava's edge are their group whole. Else the ground is the place's
 * terrain if it's one of TERRAINS, or its title's group; the texture is the title's shape or thing
 * (SHAPES) if it has one, else the ground's.
 * @param {{id: string, name: string, terrain?: string}} place
 * @returns {{ground: string, texture: string}} keys for groundStyle()
 */
export function styleOf(place) {
  const group = groupOf(place.id, place.name);
  if (OVER_TERRAIN.has(group)) return { ground: group, texture: group };
  const ground = landTerrain(place.terrain) ?? group;
  return { ground, texture: SHAPES.has(group) ? group : ground };
}

export function trackOf(name) {
  const w = whereOf(name);
  return w && isTrack(w) ? w : null;
}

export function regionOf(name) {
  const w = whereOf(name);
  return w && !isTrack(w) ? w : null;
}
