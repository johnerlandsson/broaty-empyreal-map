// The kind of ground, track and region of a generated land place, read from
// the name the game gives it (surface-words.ts `placeTitle`). Pure.

/** The groups, in the order the spec's table lists them. */
export const GROUPS = ["open", "road", "waymark", "high", "slope", "low", "rock", "dust", "workings", "water", "salt", "ice"];

const BY_GROUP = {
  open: ["Open Ground", "On the Downs"],
  road: ["Road End"],
  waymark: ["Cairn", "Marker Stone"],
  high: ["Hilltop", "Summit", "Knoll", "Ice Dome", "Saddle", "Low Pass", "Saddle in the Ice"],
  slope: ["Rising Ground", "Hillside", "Steep Hillside", "Stony Slope"],
  low: ["Hollow", "Head of a Gully", "Head of an Ice Gully"],
  rock: ["Rock Outcrop", "Bare Rock", "Stony Ground", "Crater Rim"],
  dust: ["Drifted Dust", "Dust Plain"],
  workings: ["Old Workings", "Old Shaft", "Fallen Adit"],
  water: ["Pond", "River Bank", "Spring", "Beach"],
  salt: ["The Salt Pans"],
  ice: ["Ice Field", "Ice Slope", "Frozen Shore"],
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

export function trackOf(name) {
  const w = whereOf(name);
  return w && isTrack(w) ? w : null;
}

export function regionOf(name) {
  const w = whereOf(name);
  return w && !isTrack(w) ? w : null;
}
