// A wheel's addresses and placement, mirroring the server's
// ~/dev/empyreal/packages/game/src/content/layout.ts (cited by line below).

export const RINGS = ["rim", "mid", "inner"]; // schema.ts:126

// layout.ts:21-24, the address grammar.
const RING_ADDRESS = /^(rim|mid|inner) (\d{1,2}):(\d{2})(?: (fore|aft|ladderway))?$/i;
const SPINE_ADDRESS = /^spine (\d+)(?: (port|starboard|fore))?$/i;
const HUB_ADDRESS = /^hub(?: ([a-z]+))?$/i;
const LIFT_ADDRESS = /^lift (\d{1,2})$/i;

// layout.ts:161, the sides a room opens off another by.
const SIDE_WAY = ["fore", "aft", "port", "starboard"];

/**
 * A wheel address read, as layout.ts:31-58 reads it, or null. Takes the source's "Spine 4 fore"
 * and GMCP's "Spine 4, fore" (layout.ts:97 sets the side off with a comma) alike.
 * @param {string} text
 * @returns {{part: string, hour?: number, spine?: number, side?: string} | null}
 */
export function parseWheelAddress(text) {
  if (typeof text !== "string") return null;
  const t = text.trim().replace(/,/g, " ").replace(/\s+/g, " ");
  const ring = RING_ADDRESS.exec(t);
  if (ring) {
    const h = Number(ring[2]);
    const m = Number(ring[3]);
    // layout.ts:38-40: on the half hour, 12:00 as hour 0.
    if (h < 1 || h > 12 || (m !== 0 && m !== 30)) return null;
    const a = { part: ring[1].toLowerCase(), hour: (h % 12) + m / 60 };
    if (ring[4]) a.side = ring[4].toLowerCase();
    return a;
  }
  const spine = SPINE_ADDRESS.exec(t);
  if (spine) {
    const a = { part: "spine", spine: Number(spine[1]) };
    if (a.spine < 1) return null; // layout.ts:46
    if (spine[2]) a.side = spine[2].toLowerCase();
    return a;
  }
  const hub = HUB_ADDRESS.exec(t);
  if (hub) return hub[1] ? { part: "hub", side: hub[1].toLowerCase() } : { part: "hub" }; // layout.ts:51
  const lift = LIFT_ADDRESS.exec(t);
  if (lift) {
    const h = Number(lift[1]);
    return h < 1 || h > 12 ? null : { part: "lift", hour: h % 12 }; // layout.ts:56
  }
  return null;
}

/** An address's key, as addressText (layout.ts:73) makes one, to find rooms by place. */
function key(a) {
  return [a.part, a.hour ?? "", a.spine ?? "", a.side ?? ""].join("|");
}

/**
 * The gravity of an address's part of a wheel (layout.ts:143-149), a lift car's the rim's.
 * @param {object} layout  the area's `layout:`, kind wheel
 */
export function partGravity(layout, a) {
  if (a.part === "spine") return layout.spine?.gravity;
  if (a.part === "hub") return layout.hub?.gravity;
  if (a.part === "lift") return layout.rings?.rim?.gravity;
  return layout.rings?.[a.part]?.gravity;
}

/**
 * A wheel's rooms placed: for each room with an address, its coordinates (or none: a lift car,
 * or a hub room other than the hub and the bearing) and its terrain.
 * @param {object} layout  the area's `layout:`, kind wheel
 * @param {object[]} rooms  the area's raw rooms
 * @returns {Map<string, {address: object, at?: {x: number, y: number, z: number}, terrain: string}>}
 */
export function placeWheel(layout, rooms) {
  const all = new Map(rooms.map((r) => [r.id, r]));
  const addr = new Map();
  for (const r of rooms) {
    const a = parseWheelAddress(r.address);
    if (a) addr.set(r.id, a);
  }

  // layout.ts:282-285: corridor rooms by address, rooms off another left out.
  const byAddress = new Map();
  for (const r of rooms) if (addr.has(r.id) && !r.off && !byAddress.has(key(addr.get(r.id)))) byAddress.set(key(addr.get(r.id)), r);
  const at = (a) => byAddress.get(key(a));

  // layout.ts:320-323: how many rooms out from the corridor a side room is.
  const depth = (r) => {
    let n = 1;
    for (let p = r; p.off && n <= rooms.length; n++) p = all.get(p.off) ?? p;
    return n;
  };

  // layout.ts:433-445: each spoke's lift car makes its ring lobbies floors of its shaft.
  const shaft = new Set();
  const spokes = (layout.spokes ?? []).map((s) => s % 12).sort((x, y) => x - y);
  for (const s of spokes) {
    if (!at({ part: "lift", hour: s })) continue;
    for (const ring of RINGS) {
      const f = at({ part: ring, hour: s });
      if (f) shaft.add(f.id);
    }
  }

  // layout.ts:653-659, WHEEL_ROOMS.terrain.
  const terrain = (r, a) => {
    if (a.side === "ladderway") return "ladderway";
    if (a.side) return "room";
    if (a.part === "hub") return "hub";
    return shaft.has(r.id) ? "lobby" : "corridor";
  };

  // layout.ts:465-492, the coordinates.
  const coords = (r, a) => {
    if (a.part === "lift") return undefined; // layout.ts:476: a car, not a placed room
    const n = a.side && SIDE_WAY.includes(a.side) ? depth(r) : 0; // layout.ts:477
    if (a.part === "hub") {
      if (!a.side) return [0, 0, 3]; // layout.ts:479
      if (a.side === "bearing") return [0, 1, 3]; // layout.ts:480
      return undefined;
    }
    if (a.part === "spine") {
      const y = a.spine + 1; // layout.ts:482
      if (a.side === "port") return [-n, y, 3]; // layout.ts:483
      if (a.side === "starboard") return [n, y, 3]; // layout.ts:484
      return [0, y + n, 3]; // layout.ts:485
    }
    const x = Math.round(a.hour * 2); // layout.ts:487
    const z = RINGS.indexOf(a.part); // layout.ts:488
    if (a.side === "ladderway") return [x + 1, 0, z]; // layout.ts:490
    return [x, a.side === "aft" ? -n : n, z]; // layout.ts:491
  };

  const out = new Map();
  for (const r of rooms) {
    const a = addr.get(r.id);
    if (!a) continue;
    const c = coords(r, a);
    const placed = { address: a, terrain: terrain(r, a) };
    if (c) placed.at = { x: c[0] || 0, y: c[1] || 0, z: c[2] };
    out.set(r.id, placed);
  }
  return out;
}
