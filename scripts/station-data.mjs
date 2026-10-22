// Pure helpers for reading GMCP room frames out of Mallard session logs.
// No I/O here: callers pass in lines and receive plain data.

const ROOM_ID_PREFIX = "tiss.";

// Direction names used by the old Room.Info package, mapped to the short
// codes used by mudstd.room.info.
const LONG_DIRS = {
  north: "N",
  south: "S",
  east: "E",
  west: "W",
  northeast: "NE",
  northwest: "NW",
  southeast: "SE",
  southwest: "SW",
  up: "U",
  down: "D",
  in: "IN",
  out: "OUT",
};

/**
 * Keep only gmcp protocol lines; malformed JSON is skipped silently.
 * @param {string[]} lines
 * @returns {{pkg: string, data: object, t: number}[]}
 */
export function parseGmcpLines(lines) {
  const frames = [];
  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const ev = entry?.event;
    if (entry?.kind !== "protocol" || ev?.kind !== "gmcp") continue;
    if (typeof ev.package !== "string") continue;
    frames.push({ pkg: ev.package, data: ev.data, t: entry.t });
  }
  return frames;
}

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function readCoords(coords) {
  let x, y, z;
  if (Array.isArray(coords)) [x, y, z] = coords;
  else if (isObject(coords)) ({ x, y, z } = coords);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
}

// mudstd exits are {DIR: {id, inverse}}; flatten to {DIR: id}.
function flattenExits(exits) {
  const out = {};
  if (!isObject(exits)) return out;
  for (const [dir, target] of Object.entries(exits)) {
    const id = isObject(target) ? target.id : target;
    if (typeof id === "string") out[dir] = id;
  }
  return out;
}

function flattenOldExits(exits) {
  const out = {};
  for (const [dir, id] of Object.entries(flattenExits(exits))) {
    out[LONG_DIRS[dir.toLowerCase()] ?? dir.toUpperCase()] = id;
  }
  return out;
}

const isSet = (v) => v !== undefined && v !== null;

// Copy defined fields onto the target. With `fill`, only absent fields are set.
function assign(target, fields, fill = false) {
  for (const [key, value] of Object.entries(fields)) {
    if (!isSet(value)) continue;
    if (fill && isSet(target[key])) continue;
    target[key] = value;
  }
}

/**
 * Merge room frames into one record per tiss.* room id. Later frames overwrite
 * earlier ones field by field; the old Room.Info package only fills gaps.
 * Rooms that never received coordinates are dropped.
 * @param {{pkg: string, data: object, t: number}[]} frames
 * @returns {Map<string, object>}
 */
export function collectRooms(frames) {
  const partial = new Map();
  const entry = (id) => {
    let p = partial.get(id);
    if (!p) partial.set(id, (p = {}));
    return p;
  };

  for (const { pkg, data } of frames) {
    if (!isObject(data)) continue;

    if (pkg === "mudstd.room.info") {
      if (typeof data.id !== "string" || !data.id.startsWith(ROOM_ID_PREFIX)) continue;
      const c = readCoords(data.coords);
      if (!c) continue;
      assign(entry(data.id), {
        name: data.name,
        ...c,
        region: data.region,
        regionName: data.regionName,
        terrain: data.terrain,
        tags: data.tags,
        exits: isObject(data.exits) ? flattenExits(data.exits) : undefined,
      });
    } else if (pkg === "Empyreal.Room") {
      if (typeof data.id !== "string" || !data.id.startsWith(ROOM_ID_PREFIX)) continue;
      if (data.part === "lift") continue;
      assign(entry(data.id), {
        address: data.address,
        gravity: data.gravity,
        district: data.district,
        part: data.part,
      });
    } else if (pkg === "Room.Info") {
      if (typeof data.num !== "string" || !data.num.startsWith(ROOM_ID_PREFIX)) continue;
      const c = readCoords(data.coords);
      if (!c) continue;
      assign(
        entry(data.num),
        {
          name: data.name,
          ...c,
          address: data.address,
          gravity: data.gravity,
          district: data.district,
          part: data.part,
          exits: isObject(data.exits) ? flattenOldExits(data.exits) : undefined,
        },
        true,
      );
    }
  }

  const rooms = new Map();
  for (const [id, p] of partial) {
    if (!isSet(p.x)) continue;
    rooms.set(id, {
      id,
      name: p.name ?? id,
      x: p.x,
      y: p.y,
      z: p.z,
      region: p.region ?? null,
      regionName: p.regionName ?? null,
      terrain: p.terrain ?? null,
      tags: p.tags ?? [],
      address: p.address ?? null,
      gravity: p.gravity ?? null,
      exits: p.exits ?? {},
      walked: true,
    });
  }
  return rooms;
}

const RING_NAMES = ["Rim", "Mid", "Inner"];
const RING_SLUGS = ["rim", "mid", "inner"];
const GRAVITY_BY_RING = [0.9, 0.6, 0.3, 0];

function inferTerrain(r) {
  if (r.id.includes("ladderway")) return "ladderway";
  if (r.id === "tiss.hub" || r.id === "tiss.bearing") return "hub";
  if (r.y === 0 && r.z < 3) return r.x % 6 === 0 ? "lobby" : "corridor";
  return "room";
}

function inferRegion(r) {
  if (r.id.includes("ladderway")) return "ladderways";
  if (r.z === 2) return "industrial";
  if (r.z === 1) return r.x >= 21 || r.x <= 3 ? "offices" : "midring";
  if (r.z === 3) return r.y <= 1 ? "hub" : "docks";
  if (r.z === 0) {
    const hour = Math.floor(r.x / 2) % 12; // 0 is 12 o'clock
    if (hour === 11 || hour === 0 || hour === 1) return "concourse";
    if (hour >= 2 && hour <= 4) return "residential";
    if (hour >= 5 && hour <= 7) return "hydroponics";
    return "commons";
  }
  return null;
}

/**
 * Turn the walked rooms into the full station: merge hand-written overrides
 * (field by field, exits direction by direction),
 * add the twelve ladderways, infer missing region/terrain/gravity, apply
 * closed defaults, and drop anything without coordinates (warning on stderr).
 * Rooms created here rather than read from logs have walked:false.
 * @param {Map<string, object>} rooms output of collectRooms
 * @param {{rooms?: Record<string, object>}} overrides
 * @returns {object[]} StationRoom[], sorted by id
 */
export function completeStation(rooms, overrides) {
  const all = new Map();
  for (const [id, room] of rooms) all.set(id, { ...room });

  for (const [id, patch] of Object.entries(overrides?.rooms ?? {})) {
    const base = all.get(id) ?? { id, walked: false };
    const merged = { ...base, ...patch, id };
    // Exits merge per direction so an override can add one without losing the logged ones.
    if (isObject(patch.exits)) merged.exits = { ...base.exits, ...patch.exits };
    all.set(id, merged);
  }

  for (const h of [12, 3, 6, 9]) {
    RING_SLUGS.forEach((slug, z) => {
      const id = `tiss.ladderway-${h}-${slug}`;
      if (all.has(id)) return;
      all.set(id, {
        id,
        name: `Ladderway ${h}, ${RING_NAMES[z]}`,
        x: (h % 12) * 2 + 1,
        y: 0,
        z,
        address: `${RING_NAMES[z]} ${h}:00, ladderway`,
        terrain: "ladderway",
        walked: false,
      });
    });
  }

  const out = [];
  const dropped = [];
  for (const [id, r] of all) {
    if (![r.x, r.y, r.z].every(Number.isFinite)) {
      dropped.push(id);
      continue;
    }
    out.push({
      id,
      name: r.name ?? id,
      x: r.x,
      y: r.y,
      z: r.z,
      region: r.region ?? inferRegion(r),
      terrain: r.terrain ?? inferTerrain(r),
      address: r.address ?? null,
      gravity: r.gravity ?? GRAVITY_BY_RING[r.z] ?? null,
      exits: r.exits ?? {},
      closed: r.closed ?? false,
      closedReason: r.closedReason ?? null,
      walked: r.walked ?? false,
    });
  }
  if (dropped.length > 0) {
    console.error(`completeStation: dropped rooms without coordinates: ${dropped.join(", ")}`);
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
