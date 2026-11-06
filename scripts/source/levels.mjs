// A city of levels (Dolcoath): which level each room is on. The game gives an underground city no
// layout and its rooms no depth, so the levels come from the car that joins them and the ways
// between them. Pure.

/** Where an exit goes, whether it's a plain id or `{ to, via, seconds }`. */
const exitTo = (e) => (typeof e === "string" ? e : (e?.to ?? null));
const VERTICAL = new Set(["up", "down"]);
const local = (id) => id.slice(id.indexOf(".") + 1);

/**
 * Each room's level, 0 the top. A car's stops seed the levels, its top stop level 0 (a car gives
 * its stops bottom to top), and every room a stop reaches by compass exits, whatever way through,
 * is on that stop's level. A room left over that an `up` or `down` reaches from a room on a level
 * starts a level of its own, with every room compass exits join to it: just below (or above) the
 * level it's reached from, and below any already hung there. `depths`, by local id, give a level
 * the depth of a room on it, and the levels go top to bottom by depth; one without its own takes
 * the depth of the level it hangs from, so it stays next to it. A room nothing reaches is on no
 * level. Car rooms are never on one.
 * @param {{id: string, exits?: object, car?: {stops: {room: string}[]}}[]} rooms  the area's rooms, full ids
 * @param {Record<string, number>} [depths]  by local id
 * @returns {{levels: Map<string, number>, unplaced: string[]}}  unplaced: rooms on no level, cars aside
 */
export function levelRooms(rooms, depths = {}) {
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const cars = rooms.filter((r) => r.car);
  const stops = [...new Set(cars.flatMap((c) => (c.car.stops ?? []).map((s) => s.room)).reverse())].filter((id) => byId.has(id));
  const level = new Map(); // room -> the level it's on (an index into groups)
  const groups = []; // each level: {parent, below, seq}
  const flood = (start, g) => {
    const queue = [start];
    level.set(start, g);
    while (queue.length) {
      const id = queue.shift();
      for (const [dir, e] of Object.entries(byId.get(id).exits ?? {})) {
        const to = exitTo(e);
        if (VERTICAL.has(dir) || !byId.has(to) || byId.get(to).car || level.has(to)) continue;
        level.set(to, g);
        queue.push(to);
      }
    }
  };
  // every stop's level, flooded breadth first together, so a room between two stops goes to the nearer
  const seeds = [];
  for (const id of stops) {
    if (level.has(id)) continue;
    seeds.push(id);
    groups.push({ parent: null, below: true, seq: groups.length });
    level.set(id, groups.length - 1);
  }
  const queue = [...seeds];
  while (queue.length) {
    const id = queue.shift();
    for (const [dir, e] of Object.entries(byId.get(id).exits ?? {})) {
      const to = exitTo(e);
      if (VERTICAL.has(dir) || !byId.has(to) || byId.get(to).car || level.has(to)) continue;
      level.set(to, level.get(id));
      queue.push(to);
    }
  }
  // then the levels the ways up and down reach, in the source's order, till none's left
  for (let added = true; added; ) {
    added = false;
    for (const room of rooms) {
      if (!level.has(room.id)) continue;
      for (const [dir, e] of Object.entries(room.exits ?? {})) {
        const to = exitTo(e);
        if (!VERTICAL.has(dir) || !byId.has(to) || byId.get(to).car || level.has(to)) continue;
        groups.push({ parent: level.get(room.id), below: dir === "down", seq: groups.length });
        flood(to, groups.length - 1);
        added = true;
      }
    }
  }

  // each level's depth: its own (the deepest a room on it is given), else its parent's, nudged
  // just below (or above) it in the order it was found
  const own = groups.map(() => null);
  for (const [id, g] of level) {
    const d = depths[local(id)];
    if (Number.isFinite(d)) own[g] = Math.max(own[g] ?? -Infinity, d);
  }
  const depthOf = (g, seen = new Set()) => {
    if (own[g] !== null) return own[g];
    const { parent, below, seq } = groups[g];
    if (parent === null || seen.has(g)) return seq; // a stop's level with no depth: in the car's order
    seen.add(g);
    return depthOf(parent, seen) + (below ? 1 : -1) * (1 + seq) * 1e-6;
  };
  // stops' levels with no depth keep the car's order among themselves
  const keys = groups.map((grp, g) => [depthOf(g), grp.parent === null ? grp.seq : Infinity, g]);
  keys.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const rank = new Map(keys.map(([, , g], i) => [g, i]));

  const levels = new Map();
  const unplaced = [];
  for (const r of rooms) {
    if (r.car) continue;
    if (level.has(r.id)) levels.set(r.id, rank.get(level.get(r.id)));
    else unplaced.push(r.id);
  }
  return { levels, unplaced };
}
