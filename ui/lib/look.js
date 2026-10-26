// A generated place file (ui/data/<id>.js, written by `npm run build:data`) as the builders take
// it: its `look` (paint, fixtures and the drum or town section, from the tweak files) turned back
// into the specs decks.js, drum.js and town.js draw from. The tweak files name rooms by their local
// id ("berth") and colours by palette name ("docks"); the specs want full ids ("orrin.berth") and
// colours. Pure; no DOM.

/** "berth" -> "orrin.berth" */
const fullId = (data) => (local) => `${data.id}.${local}`;

/** The palette's colour for a paint name, or null. */
const colour = (data, name) => data.look?.palette?.[name] ?? null;

/** Each painted room's colour, by its full id. */
function tints(data) {
  const full = fullId(data);
  return Object.fromEntries(Object.entries(data.look?.paint ?? {}).map(([local, name]) => [full(local), colour(data, name)]));
}

const fixtures = (data, type) => (data.look?.fixtures ?? []).filter((f) => f.type === type);

/**
 * A station on decks: `tints` a colour per room; `blisters` the rooms that are glass blisters
 * outside the hull, not cells of it; `cradles` the blocks fore of the nose, each [side, deck,
 * half-width, half-height, length] in cells; and, if it has any, `masts` stood up off the roof with
 * a lamp at the top, each [side, frame, height] in cells (the height in decks).
 * @returns {{prefix: string, tints: Record<string, string>, blisters: string[], cradles: number[][], masts?: number[][]}}
 */
export function decksSpec(data) {
  const full = fullId(data);
  const spec = {
    prefix: data.id,
    tints: tints(data),
    blisters: fixtures(data, "blister").map((f) => full(f.room)),
    cradles: fixtures(data, "cradle").map((f) => [f.side, f.deck, f.hw, f.hh, f.len]),
  };
  const masts = fixtures(data, "mast").map((f) => [f.side, f.frame, f.height]);
  if (masts.length) spec.masts = masts;
  return spec;
}

/**
 * A drum station: the axis room and its window collar, the way up to it, and the cradles outside
 * the Berths, each [hour offset, z, half-width, height, half-length].
 * @returns {{prefix: string, axis: {id: string, r: number, len: number}, way: string, tints: Record<string, string>, cradles: number[][]}}
 */
export function drumSpec(data) {
  const { axis, way } = data.look.drum;
  return {
    prefix: data.id,
    axis: { id: fullId(data)(axis.room), r: axis.r, len: axis.len },
    way,
    tints: tints(data),
    cradles: fixtures(data, "drum-cradle").map((f) => [f.hour, f.z, f.hw, f.h, f.hl]),
  };
}

/** The drum's rooms, each with its place round the drum (x, y, z, hour, band, terrain), in the
 *  order the drum section lists them; a room it doesn't place is left out. */
export function drumRooms(data) {
  const byId = new Map(data.rooms.map((r) => [r.id, r]));
  const full = fullId(data);
  return Object.entries(data.look.drum.rooms).flatMap(([local, at]) => {
    const room = byId.get(full(local));
    return room ? [{ ...room, ...at }] : [];
  });
}

/**
 * A town on the ground, what its exits and flags don't say. `root` is the room placed first, at
 * the plan's middle; `uphill` the compass way `up` goes on the plan (`down` the other); `tints` a
 * colour per district, in the area's order; `ground` the kind of open ground a room is, where it
 * isn't street (a berth is a landing field without saying); `gate` the room with the old wall's
 * arch; `wells` rooms with a wellhead; `river` the river along the plan's downhill side and the
 * room on its bridge; `scarp` the district on the flat above the scarp the Steps climb.
 * @returns {{prefix: string, root: string, uphill: string, tints: Record<string, string>, ground: Record<string, string>,
 *   gate: string, wells: string[], river: {name: string, bridge: string}, scarp: string}}
 */
export function townSpec(data) {
  const full = fullId(data);
  const town = data.look.town;
  // the plan tints a district, not a room: the colour its rooms are painted (paintDistricts)
  const painted = tints(data);
  const tint = {};
  for (const d of data.districts ?? []) {
    const room = data.rooms.find((r) => r.district === d.id && painted[r.id]);
    if (room) tint[d.id] = painted[room.id];
  }
  return {
    prefix: data.id,
    root: full(town.root),
    uphill: town.uphill,
    tints: tint,
    ground: Object.fromEntries(Object.entries(town.ground ?? {}).map(([local, kind]) => [full(local), kind])),
    gate: town.gate && full(town.gate),
    wells: (town.wells ?? []).map(full),
    river: town.river && { name: town.river.name, bridge: full(town.river.bridge) },
    scarp: town.scarp,
  };
}

/** The town as indexTown takes it: the area with its name, gravity and districts, the rooms on foot,
 *  and the cars (the tram), each car's stops bottom to top. */
export function townData(data) {
  return {
    area: { id: data.id, name: data.name, gravity: data.gravity, districts: data.districts ?? [] },
    rooms: data.rooms.filter((r) => !r.car),
    cars: data.rooms.filter((r) => r.car).map((r) => ({ id: r.id, name: r.name, kind: r.car.kind, stops: r.car.stops.map((s) => s.room) })),
  };
}
