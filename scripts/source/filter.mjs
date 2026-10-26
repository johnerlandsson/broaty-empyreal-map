// Pure filters over the raw Empyreal YAML: keep only what the map may show.

export const ROOM_FIELDS = ["id", "name", "address", "exits", "closed", "gravity", "flags", "district", "canopy", "car"];
export const FLAGS = ["berth", "airlock", "outdoors", "listed"];

/**
 * @param {object} area  the YAML's `area:` (or `plan:`) block
 * @returns {{id: string, name: string, gravity: number, layout: object, districts?: object[]}}
 */
export function keepArea(area) {
  const kept = { id: area.id, name: area.name, gravity: area.gravity, layout: area.layout };
  if (area.districts) kept.districts = area.districts;
  return kept;
}

/**
 * @param {object} raw  one room as the source writes it
 * @returns {{room: object, dropped: {fields: string[], flags: string[]}}}
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
    } else {
      room[key] = value;
    }
  }
  return { room, dropped };
}
