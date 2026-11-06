// A city of levels (Dolcoath): an underground city cut down through the rock, its levels joined
// by a car (the cage) and by ways up and down (the man engine, the Great Stair, a plain way down).
// The build puts each room on its level (`at.level`, 0 the top); here each level's rooms are
// placed by their compass exits, as a town's are (placeRooms), and each level is a plan of its
// own, laid out as a town's is (townLayout), with the ways that leave it drawn where they leave.
// Everything here is the plans' layout and words; levels-deck.js draws them. Pure; no DOM.

import { STEP, exitTo, placeRooms, townInfo, townLayout } from "./town.js";

/** What each timed way is called, as the game's way-words.ts has it; any other way up or down is plain. */
export const WAY_NAMES = { "man-engine": "the man engine", stair: "the Great Stair", steps: "the Steps" };
const VERTICAL = new Set(["up", "down"]);
/** The sides a way off a level may leave its room by, in the order they're tried. */
const SIDES = ["south", "north", "west", "east"];
/** Each side as a step on screen (y down). */
const OUT = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] };
const GAP = 8; // between a room's box and what leaves it
export const WELL = { w: 40, h: 36 }; // the cage's shaft
export const SLOT = { w: 18, h: 36 }; // the man engine's, its long side along the way out
export const FLIGHT = { w: 16, len: 46 }; // the Great Stair's treads
export const HATCH = 22; // a plain way up or down: a small well

const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * The city's rooms by id, each with its level and its `cell` on that level, as indexTown gives a
 * town's; the levels top down, each with its name, depth, the car stop on it and its rooms; the
 * area, its districts and its cars, each car's stops bottom to top with the names the car gives
 * them (`named`).
 * @param {{area: object, rooms: object[], cars: object[]}} data  as look.js levelsData gives it
 * @param {ReturnType<typeof import("./look.js").levelsSpec>} spec
 */
export function indexLevels(data, spec) {
  const rooms = (data?.rooms ?? []).filter((r) => Number.isInteger(r.at?.level));
  const cars = data?.cars ?? [];
  const stopName = new Map(cars.flatMap((c) => Object.entries(c.named ?? {})));
  const districts = data?.area?.districts ?? [];
  const named = new Map(districts.map((d) => [d.id, d.name]));
  const numbers = [...new Set(rooms.map((r) => r.at.level))].sort((a, b) => a - b);
  const byId = new Map();
  const levels = [];
  for (const n of numbers) {
    const mine = rooms.filter((r) => r.at.level === n);
    const ids = new Set(mine.map((r) => r.id));
    // a level's rooms by the compass exits between them; its car stop, else its first room, at 0, 0
    const compass = mine.map((r) => ({
      id: r.id,
      exits: Object.fromEntries(Object.entries(r.exits ?? {}).filter(([dir, e]) => !VERTICAL.has(dir) && ids.has(exitTo(e)))),
    }));
    const stop = mine.find((r) => stopName.has(r.id))?.id ?? null;
    const placed = placeRooms(compass, stop ?? mine[0].id);
    // rooms the walk from its root doesn't reach go in a row below it, so every room still draws
    let spare = 0;
    const bottom = Math.min(0, ...[...placed.values()].map((p) => p.y));
    for (const r of mine) {
      if (!placed.has(r.id)) placed.set(r.id, { x: spare++, y: bottom - 2, rise: 0 });
    }
    for (const r of mine) {
      const p = placed.get(r.id);
      const flags = r.flags ?? [];
      const outdoors = flags.includes("outdoors");
      byId.set(r.id, {
        ...r,
        exits: r.exits ?? {},
        gravity: r.gravity ?? data.area?.gravity ?? null,
        district: r.district ?? null,
        districtName: named.get(r.district) ?? null,
        outdoors,
        kind: spec.ground?.[r.id] ?? (!outdoors ? "building" : flags.includes("berth") ? "field" : "street"),
        cell: { x: p.x, y: p.y },
        rise: 0,
        level: n,
      });
    }
    const depths = mine.map((r) => spec.depths?.[r.id]).filter(Number.isFinite);
    const name = mine.map((r) => spec.names?.[r.id]).find(Boolean) ?? (stop ? stopName.get(stop) : null) ?? mine[0].name;
    levels.push({ level: n, name, depth: depths.length ? Math.max(...depths) : null, stop, rooms: mine.map((r) => r.id) });
  }
  return { byId, levels, area: data?.area ?? null, districts, cars };
}

/** A level's short name, for the ways that go to it: its depth (`40 FM`), else its name (`PIT`). */
export function levelTag(lv) {
  if (!lv) return "";
  return lv.depth ? `${lv.depth} FM` : String(lv.name).replace(/^the /i, "").toUpperCase();
}

/** A level's title, by N ▲: `THE TOWN · 80 FM`, or its name alone at the surface or with no depth. */
export function levelTitle(lv) {
  if (!lv) return "";
  return lv.depth ? `${String(lv.name).toUpperCase()} · ${lv.depth} FM` : String(lv.name).toUpperCase();
}

/** Where you are: your room, on its level, or off the plan. Never throws. */
export function locateLevels(index, msg) {
  try {
    const room = typeof msg?.roomId === "string" ? index.byId.get(msg.roomId) : undefined;
    if (room) return { kind: "room", id: room.id, level: room.level, x: room.cell.x, y: room.cell.y };
    return { kind: "off", name: typeof msg?.name === "string" ? msg.name : "" };
  } catch {
    return { kind: "off", name: "" };
  }
}

/** `BAL CROSS · the Town · Dolcoath · 1.5 g`, as a town's line is. */
export const levelsInfo = townInfo;

/**
 * The ways that leave a level from its rooms: the car's shaft at its stop (`cage`, the stops above
 * and below), and each room's ways up and down grouped by what they go by (`man-engine`, `stair`, or
 * `plain` for a way with no `via`), each way with the room and level it reaches and its seconds.
 * Each is given the side of its room it leaves by: the first of south, north, west and east (the
 * man engine trying its level's cage's side first, so the two shafts match) that no exit leaves
 * by, that has no room in the cell beyond, and that no other way off the room has taken.
 * @returns {{room: string, kind: string, side: string, name: string, up: object|null, down: object|null}[]}
 */
export function waysOff(index, level) {
  const lv = index.levels.find((l) => l.level === level);
  if (!lv) return [];
  const levelOf = (n) => index.levels.find((l) => l.level === n) ?? null;
  const cells = new Set(lv.rooms.map((id) => index.byId.get(id).cell).map((c) => `${c.x}:${c.y}`));
  const out = [];
  for (const id of lv.rooms) {
    const room = index.byId.get(id);
    for (const car of index.cars) {
      const i = car.stops.indexOf(id);
      if (i < 0) continue;
      // stops go bottom to top, so the one after is above
      const stopAt = (j) => {
        const to = car.stops[j];
        if (!to) return null;
        return { to, name: car.named?.[to] ?? index.byId.get(to)?.name ?? to, level: index.byId.get(to)?.level ?? null };
      };
      out.push({ room: id, kind: car.kind === "cage" ? "cage" : car.kind, car: car.id, name: car.name, up: stopAt(i + 1), down: stopAt(i - 1) });
    }
    const groups = new Map();
    for (const [dir, e] of Object.entries(room.exits)) {
      if (!VERTICAL.has(dir)) continue;
      const to = exitTo(e);
      const far = index.byId.get(to);
      if (!far || far.level === level) continue;
      const via = typeof e === "object" && e?.via ? e.via : "plain";
      if (!groups.has(via)) groups.set(via, { room: id, kind: via, name: WAY_NAMES[via] ?? null, up: null, down: null });
      const there = levelOf(far.level);
      groups.get(via)[dir] = { to, name: far.name, level: far.level, levelName: there?.name ?? null, seconds: Number.isFinite(e?.seconds) ? e.seconds : null };
    }
    out.push(...groups.values());
  }
  // the sides, the cage's first so the man engine can follow it
  const cageSide = new Map(); // level -> the side its cage's shaft left by
  const used = new Map(); // room -> sides taken
  const order = (w) => (w.kind === "cage" ? 0 : w.kind === "man-engine" ? 1 : 2);
  for (const w of [...out].sort((a, b) => order(a) - order(b))) {
    const room = index.byId.get(w.room);
    const blocked = new Set(used.get(w.room) ?? []);
    for (const [dir, e] of Object.entries(room.exits)) {
      const step = STEP[dir];
      if (!step || index.byId.get(exitTo(e))?.level !== level) continue;
      if (step[0]) blocked.add(step[0] > 0 ? "east" : "west");
      if (step[1]) blocked.add(step[1] > 0 ? "north" : "south");
    }
    const prefer = w.kind === "man-engine" && cageSide.has(level) ? [cageSide.get(level), ...SIDES] : SIDES;
    const beyond = (side) => {
      const [dx, dy] = OUT[side];
      return `${room.cell.x + dx}:${room.cell.y - dy}`; // cells count y north, the screen south
    };
    w.side = prefer.find((s) => !blocked.has(s) && !cells.has(beyond(s))) ?? prefer.find((s) => !blocked.has(s)) ?? "south";
    w.cell = beyond(w.side);
    used.set(w.room, [...(used.get(w.room) ?? []), w.side]);
    if (w.kind === "cage") cageSide.set(level, w.side);
  }
  return out;
}

/** "Forty Fathom, about 16 s": where a way goes, and its seconds if it has them. */
function where(way, levelName) {
  const to = levelName ?? way.name;
  return way.seconds !== null && way.seconds !== undefined ? `${to}, about ${way.seconds} s` : to;
}

/**
 * The tooltip of a way off a level: its name and a row each way it goes, the level it reaches by
 * name (a plain way the room), with its seconds where it has them.
 */
export function wayTip(w) {
  const rows = [];
  for (const dir of ["up", "down"]) {
    const way = w[dir];
    if (!way) continue;
    const to = w.kind === "plain" ? way.name : w.kind === "cage" ? way.name : (way.levelName ?? way.name);
    rows.push({ label: capital(dir), value: w.kind === "cage" || w.kind === "plain" ? to : where(way, to) });
  }
  const title = w.kind === "cage" ? `${w.name ?? "The cage"}` : w.kind === "plain" ? (w.down ? "A way down" : "A way up") : capital(w.name ?? w.kind);
  return { title, rows };
}

/**
 * A level's plan: townLayout's, for the level's rooms alone, with its ways off placed beside their
 * rooms (each `x`, `y`, the point on its room's edge it leaves from, `ux`, `uy`, the way out, and
 * `cx`, `cy`, its middle) and the frame grown to take them in.
 * @param {ReturnType<typeof indexLevels>} index
 * @param {ReturnType<typeof import("./look.js").levelsSpec>} spec
 */
export function levelLayout(index, spec, level) {
  const lv = index.levels.find((l) => l.level === level);
  const ways = waysOff(index, level);
  const sub = {
    byId: new Map((lv?.rooms ?? []).map((id) => [id, index.byId.get(id)])),
    area: index.area,
    districts: index.districts,
    cars: [],
  };
  const layout = townLayout(sub, { ...spec, river: null, gate: null, scarp: null, wells: [], taken: ways.map((w) => w.cell) });
  const tagOf = (n) => levelTag(index.levels.find((l) => l.level === n));
  for (const w of ways) {
    const b = layout.byId.get(w.room);
    const [ux, uy] = OUT[w.side];
    const edge = ux ? b.w / 2 : b.h / 2;
    const depth = { cage: WELL.h, "man-engine": SLOT.h, stair: FLIGHT.len, plain: HATCH }[w.kind] ?? HATCH;
    // a shaft's well stands off the room; the stair's treads start at its edge
    const off = w.kind === "stair" ? 0 : GAP;
    Object.assign(w, {
      ux,
      uy,
      x: b.cx + ux * edge,
      y: b.cy + uy * edge,
      cx: b.cx + ux * (edge + off + depth / 2),
      cy: b.cy + uy * (edge + off + depth / 2),
      len: depth,
      tags: { up: w.up ? (w.kind === "man-engine" ? secondsTag(w.up) : w.kind === "cage" ? tagOf(w.up.level) : w.kind === "plain" ? w.up.name : "") : "", down: w.down ? (w.kind === "man-engine" ? secondsTag(w.down) : w.kind === "cage" ? tagOf(w.down.level) : w.kind === "plain" ? w.down.name : "") : "" },
    });
  }
  // the frame: the rooms' and the ways', with room for their words
  const b = { ...layout.bounds };
  for (const w of ways) {
    const reach = w.len / 2 + 14;
    const words = 80; // about how far a way's words run: beside it going north or south, under it going east or west
    b.x0 = Math.min(b.x0, w.cx - reach - (w.ux ? words / 2 : 0));
    b.x1 = Math.max(b.x1, w.cx + reach + (w.ux ? words / 2 : words));
    b.y0 = Math.min(b.y0, w.cy - reach);
    b.y1 = Math.max(b.y1, w.cy + reach + (w.ux ? 30 : 0));
  }
  return {
    ...layout,
    level: lv ?? null,
    ways,
    bounds: b,
    home: [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2],
    extent: { w: b.x1 - b.x0, h: b.y1 - b.y0 },
  };
}

/** ⌂'s frame on a level, in plan units: never smaller than this, so a level of one room isn't
 *  blown up, and never wider than its names stay readable in the panel at. */
export const FRAME = { min: { w: 560, h: 380 }, max: { w: 640, h: 460 } };

/**
 * What ⌂ frames on a level: the whole level where it fits FRAME's largest, else that much of it
 * round your room, kept inside the level. `{ home, extent }`, as a plan carries them.
 */
export function levelFrame(layout, where) {
  const { bounds: b } = layout;
  const w = Math.max(FRAME.min.w, Math.min(FRAME.max.w, b.x1 - b.x0));
  const h = Math.max(FRAME.min.h, Math.min(FRAME.max.h, b.y1 - b.y0));
  const room = where?.kind === "room" ? layout.byId.get(where.id) : null;
  const along = (c, lo, hi, size) => (hi - lo <= size ? (lo + hi) / 2 : Math.max(lo + size / 2, Math.min(hi - size / 2, c)));
  const [cx, cy] = room ? [room.cx, room.cy] : layout.home;
  return { home: [along(cx, b.x0, b.x1, w), along(cy, b.y0, b.y1, h)], extent: { w, h } };
}

const secondsTag = (way) => (way.seconds !== null && way.seconds !== undefined ? `${way.seconds} s` : "");
