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
