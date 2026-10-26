// The sync report: what a build changed, and what may need John. Pure; build-data.mjs writes it.

/** Room fields the map drops on purpose (spec: "Nothing else"); any other dropped field is unknown. */
export const DROPPED_FIELDS = ["desc", "features", "keywords", "devices", "machines", "berth", "barber", "off", "oneway"];

/** A report with every list empty, its keys in their fixed order. */
export function emptyReport(commit) {
  return {
    commit,
    newPlaces: [],
    removedPlaces: [],
    noBuilder: [],
    rooms: { added: [], removed: [], renamed: [] },
    exits: { added: [], removed: [] },
    unplaced: [],
    orphans: [],
    droppedFlags: [],
    unknownFields: [],
    knownDroppedFlags: [],
    knownUnknownFields: [],
  };
}

const target = (exit) => (typeof exit === "string" ? exit : exit?.to);

/**
 * One place's rooms and exits, before and after. A removed room whose address (else name) an
 * added one has is renamed. Exits are compared per room and direction, by where they lead, after
 * renames; the exits of added and removed rooms come and go with them and aren't listed.
 * @param {string} place
 * @param {object[]} before  rooms with `id`, `exits` and `address` or `name`
 * @param {object[]} after
 * @returns {{rooms: {added: object[], removed: object[], renamed: object[]}, exits: {added: object[], removed: object[]}}}
 */
export function diffRooms(place, before, after) {
  const was = new Map(before.map((r) => [r.id, r]));
  const now = new Map(after.map((r) => [r.id, r]));
  const removed = before.filter((r) => !now.has(r.id));
  const added = after.filter((r) => !was.has(r.id));

  const renames = new Map(); // old id -> new id
  for (const key of ["address", "name"]) {
    for (const old of removed) {
      if (renames.has(old.id) || old[key] === undefined) continue;
      const match = added.find((r) => r[key] === old[key] && ![...renames.values()].includes(r.id));
      if (match) renames.set(old.id, match.id);
    }
  }
  const renamed = new Set(renames.values());
  const as = (id) => renames.get(id) ?? id;

  const exits = { added: [], removed: [] };
  const exitsOf = (room, rename) => {
    const out = new Map();
    for (const [dir, exit] of Object.entries(room?.exits ?? {})) out.set(dir, rename(target(exit)));
    return out;
  };
  for (const old of before) {
    const id = as(old.id);
    const room = now.get(id);
    if (!room) continue;
    const a = exitsOf(old, as);
    const b = exitsOf(room, (to) => to);
    for (const [dir, to] of a) if (b.get(dir) !== to) exits.removed.push({ place, room: id, dir, to });
    for (const [dir, to] of b) if (a.get(dir) !== to) exits.added.push({ place, room: id, dir, to });
  }

  return {
    rooms: {
      added: added.filter((r) => !renamed.has(r.id)).map((r) => ({ place, id: r.id })),
      removed: removed.filter((r) => !renames.has(r.id)).map((r) => ({ place, id: r.id })),
      renamed: [...renames].map(([from, to]) => ({ place, from, to })),
    },
    exits,
  };
}

/**
 * What keepRoom dropped, by name: each flag and unknown field (DROPPED_FIELDS aside) with the
 * places it occurs in. A name is listed only the first time it appears, that is when the
 * previous report's known lists lack it (every name, with no previous report); the known lists
 * are every name dropped now.
 * @param {{place: string, dropped: {fields: string[], flags: string[]}}[]} rooms
 * @param {{knownDroppedFlags?: string[], knownUnknownFields?: string[]} | null} previous  the last report
 * @returns {{droppedFlags: object[], unknownFields: object[], knownDroppedFlags: string[], knownUnknownFields: string[]}}
 */
export function droppedOf(rooms, previous) {
  const flags = new Map();
  const fields = new Map();
  const add = (map, name, place) => map.set(name, (map.get(name) ?? new Set()).add(place));
  for (const { place, dropped } of rooms) {
    for (const flag of dropped.flags) add(flags, flag, place);
    for (const field of dropped.fields) if (!DROPPED_FIELDS.includes(field)) add(fields, field, place);
  }
  const fresh = (map, known = []) =>
    [...map].filter(([name]) => !known.includes(name)).map(([name, places]) => ({ name, places: [...places].sort() })).sort(byValues);
  return {
    droppedFlags: fresh(flags, previous?.knownDroppedFlags),
    unknownFields: fresh(fields, previous?.knownUnknownFields),
    knownDroppedFlags: [...flags.keys()].sort(),
    knownUnknownFields: [...fields.keys()].sort(),
  };
}

/** Entries in order: by each value in turn, place first. */
function byValues(a, b) {
  const x = JSON.stringify(Object.values(a));
  const y = JSON.stringify(Object.values(b));
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The report with every list sorted, in place. */
export function sortReport(report) {
  for (const list of lists(report)) list[1].sort(byValues);
  report.knownDroppedFlags.sort();
  report.knownUnknownFields.sort();
  return report;
}

/** [label, list] for every list of a report that may need John, in the report's order. */
function lists(report) {
  return [
    ["new places", report.newPlaces],
    ["places removed", report.removedPlaces],
    ["new places, no builder", report.noBuilder],
    ["rooms added", report.rooms.added],
    ["rooms removed", report.rooms.removed],
    ["rooms renamed", report.rooms.renamed],
    ["exits added", report.exits.added],
    ["exits removed", report.exits.removed],
    ["rooms that need a place", report.unplaced],
    ["orphaned tweaks", report.orphans],
    ["flags dropped", report.droppedFlags],
    ["unknown source fields", report.unknownFields],
  ];
}

function entryText(e) {
  if (e.builder) return `${e.place} (${e.builder})`;
  if (e.from) return `${e.from} -> ${e.to}`;
  if (e.dir) return `${e.room} ${e.dir} -> ${e.to}`;
  if (e.key) return `${e.place}: ${e.key}`;
  if (e.name) return `${e.name} (${e.places.join(", ")})`;
  return e.id ?? e.place;
}

/** The report as short text: one line per non-empty list, or "nothing needs you". */
export function formatReport(report) {
  const lines = lists(report)
    .filter(([, list]) => list.length)
    .map(([label, list]) => `${label} (${list.length}): ${list.map(entryText).join(", ")}`);
  return lines.length ? lines.join("\n") : "nothing needs you";
}
