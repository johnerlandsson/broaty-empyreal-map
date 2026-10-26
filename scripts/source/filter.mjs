// Pure filters over the raw Empyreal YAML: keep only what the map may show.

export const ROOM_FIELDS = ["id", "name", "address", "exits", "closed", "gravity", "flags", "district", "canopy", "car"];
export const FLAGS = ["berth", "airlock", "outdoors", "listed"];

/**
 * An object's keys among `keys`, in its own order; each other key goes in `dropped` by its dotted
 * name, `${path}.${key}` ("car.perStop").
 */
function only(obj, keys, path, dropped) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (keys.includes(key)) out[key] = value;
    else dropped.push(`${path}.${key}`);
  }
  return out;
}

/** A layout's kind, its rings (each {every, gravity}), spokes, spine {length, gravity} and hub {gravity}. */
function keepLayout(layout, dropped) {
  const out = only(layout, ["kind", "rings", "spokes", "spine", "hub"], "layout", dropped);
  if (out.rings) {
    out.rings = Object.fromEntries(Object.entries(out.rings).map(([ring, r]) => [ring, only(r, ["every", "gravity"], "layout.rings.*", dropped)]));
  }
  if (out.spine) out.spine = only(out.spine, ["length", "gravity"], "layout.spine", dropped);
  if (out.hub) out.hub = only(out.hub, ["gravity"], "layout.hub", dropped);
  return out;
}

/**
 * @param {object} area  the YAML's `area:` (or `plan:`) block
 * @returns {{area: {id: string, name: string, gravity: number, layout: object, districts?: object[]}, dropped: {fields: string[]}}}
 *   dropped: the layout's and districts' keys the map doesn't read, by dotted name
 */
export function keepArea(area) {
  const dropped = { fields: [] };
  const kept = { id: area.id, name: area.name, gravity: area.gravity, layout: area.layout && keepLayout(area.layout, dropped.fields) };
  if (area.districts) kept.districts = area.districts.map((d) => only(d, ["id", "name", "entrance"], "districts.*", dropped.fields));
  dropped.fields = [...new Set(dropped.fields)];
  return { area: kept, dropped };
}

/**
 * @param {object} raw  one room as the source writes it
 * @returns {{room: object, dropped: {fields: string[], flags: string[]}}}  an exit keeps where it
 *   goes, the way through and its seconds; a car its kind and its stops' rooms; any other key of
 *   theirs is dropped by dotted name ("exits.*.hidden", "car.perStop")
 */
export function keepRoom(raw) {
  const room = {};
  const dropped = { fields: [], flags: [] };
  for (const [key, value] of Object.entries(raw)) {
    if (!ROOM_FIELDS.includes(key)) {
      dropped.fields.push(key);
    } else if (key === "flags") {
      const flags = value.filter((f) => FLAGS.includes(f));
      dropped.flags.push(...value.filter((f) => !FLAGS.includes(f)));
      if (flags.length) room.flags = flags;
    } else if (key === "exits") {
      room.exits = Object.fromEntries(
        Object.entries(value).map(([dir, exit]) => [dir, typeof exit === "string" ? exit : only(exit, ["to", "via", "seconds"], "exits.*", dropped.fields)]),
      );
    } else if (key === "car") {
      const car = only(value, ["kind", "stops"], "car", dropped.fields);
      if (car.stops) car.stops = car.stops.map((stop) => only(stop, ["room"], "car.stops.*", dropped.fields));
      room.car = car;
    } else {
      room[key] = value;
    }
  }
  dropped.fields = [...new Set(dropped.fields)];
  return { room, dropped };
}
