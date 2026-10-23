// Towns on a planet's surface, Zennor so far: rooms with no addresses or coords (`layout: none`),
// placed one cell a step by their compass exits, which on a planet are the compass. Indoor rooms
// are buildings; outdoor rooms are open ground: street, a square, a path, a landing field,
// terraces, a lookout. Everything here is the plan's layout and highlight; the drawing is
// town-deck.js. Pure; no DOM.

import { DISTRICT_COLOURS } from "./geometry.js";

// --- the towns -------------------------------------------------------------------------------

/**
 * What the exits and flags don't say. `root` is the room placed first, at the plan's middle;
 * `tints` a district colour per building; `ground` the kind of open ground a room is, where it
 * isn't street (a berth is a landing field without saying); `walled` the rooms inside the town's
 * wall, `gate` the room whose way out through it is an arch; `wells` rooms with a wellhead.
 */
export const TOWNS = {
  // A port on Tamsin: low, thick-walled stone against the dust, inside an old windbreak wall, with
  // the landing field on the flat above the town and the terraces stepping down below it.
  zennor: {
    prefix: "zennor",
    root: "zennor.square",
    tints: {
      "zennor.field-office": DISTRICT_COLOURS.offices,
      "zennor.tower": DISTRICT_COLOURS.docks, // the port's own: sensors, comms, the charts
      "zennor.exchange": DISTRICT_COLOURS.concourse,
      "zennor.inn": DISTRICT_COLOURS.commons,
      "zennor.water-house": DISTRICT_COLOURS.residential, // the snowmelt
    },
    ground: {
      "zennor.square": "square",
      "zennor.ridge-path": "path",
      "zennor.overlook": "overlook",
      "zennor.terraces": "terraces",
      "zennor.lower-terraces": "old-terraces", // "wider and older than those above, their walls slumped"
    },
    walled: ["zennor.gate", "zennor.fore-top", "zennor.square", "zennor.exchange", "zennor.inn", "zennor.fore-foot", "zennor.water-house"],
    gate: "zennor.gate",
    wells: ["zennor.square"],
  },
};

// --- placing rooms by their exits ------------------------------------------------------------

/** A step each compass way: x east, y north. */
export const STEP = { north: [0, 1], south: [0, -1], east: [1, 0], west: [-1, 0] };

/**
 * Each room's cell, found by walking the exits from `root` (else the first room): a compass exit
 * is a step that way. Any other (`up`, `down`, `in`) carries on the way you came into the room,
 * east when you didn't, since height isn't north (style guide principle 5); `up` and `down` also
 * count its `rise`. A cell already taken pushes the room on further the same way. Rooms the walk
 * doesn't reach aren't placed.
 * @param {{id: string, exits?: Record<string, string>}[]} rooms
 * @returns {Map<string, {x: number, y: number, rise: number, heading: string|null}>}
 */
export function placeRooms(rooms, root) {
  const byId = new Map((rooms ?? []).map((r) => [r.id, r]));
  const start = byId.has(root) ? root : rooms?.[0]?.id;
  const placed = new Map();
  if (!start) return placed;
  const taken = new Set();
  const put = (id, x, y, rise, heading) => {
    placed.set(id, { x, y, rise, heading });
    taken.add(`${x}:${y}`);
  };
  put(start, 0, 0, 0, null);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift();
    const p = placed.get(id);
    for (const [dir, to] of Object.entries(byId.get(id).exits ?? {})) {
      if (placed.has(to) || !byId.has(to)) continue;
      const heading = STEP[dir] ? dir : (p.heading ?? "east");
      const [dx, dy] = STEP[heading];
      const rise = p.rise + (dir === "up" ? 1 : dir === "down" ? -1 : 0);
      let x = p.x + dx;
      let y = p.y + dy;
      while (taken.has(`${x}:${y}`)) {
        x += dx;
        y += dy;
      }
      put(to, x, y, rise, heading);
      queue.push(to);
    }
  }
  return placed;
}

// --- the index, locating you, the info line ---------------------------------------------------

/**
 * The town's placed rooms by id, each with its `cell`, `rise`, `kind` (building, street, square,
 * path, field, terraces, old-terraces, overlook) and the area's gravity; and the area's name.
 * @param {typeof import("../data/zennor.js").default} data
 * @param {typeof TOWNS.zennor} spec
 */
export function indexTown(data, spec) {
  const placed = placeRooms(data?.rooms ?? [], spec.root);
  const byId = new Map();
  for (const r of data?.rooms ?? []) {
    const p = placed.get(r.id);
    if (!p) continue;
    const flags = r.flags ?? [];
    const outdoors = flags.includes("outdoors");
    const kind = spec.ground?.[r.id] ?? (!outdoors ? "building" : flags.includes("berth") ? "field" : "street");
    byId.set(r.id, {
      ...r,
      exits: r.exits ?? {},
      gravity: r.gravity ?? data.area?.gravity ?? null,
      outdoors,
      kind,
      cell: { x: p.x, y: p.y },
      rise: p.rise,
      heading: p.heading,
      level: 0,
    });
  }
  return { byId, area: data?.area ?? null };
}

/** Where you are on the town's plan, or off it. Never throws. */
export function locateTown(index, msg) {
  try {
    const room = typeof msg?.roomId === "string" ? index.byId.get(msg.roomId) : undefined;
    if (room) return { kind: "room", id: room.id, level: 0, x: room.cell.x, y: room.cell.y };
    return { kind: "off", name: typeof msg?.name === "string" ? msg.name : "" };
  } catch {
    return { kind: "off", name: "" };
  }
}

/** `THE SQUARE · Zennor · 1 g`: the room, the town (its rooms have no address), the gravity. */
export function townInfo(where, msg, index) {
  try {
    const s = (v) => (typeof v === "string" && v !== "" ? v : null);
    if (!where || where.kind !== "room") return (s(where?.name) ?? s(msg?.name) ?? "").toUpperCase();
    const room = index?.byId?.get(where.id);
    const parts = [(s(msg?.name) ?? s(room?.name) ?? "").toUpperCase()];
    const town = s(index?.area?.name) ?? s(msg?.areaName);
    if (town) parts.push(town);
    const g = msg?.gravity ?? room?.gravity;
    if (g !== undefined && g !== null) parts.push(`${String(g)} g`);
    return parts.join(" · ");
  } catch {
    return "";
  }
}

// --- the plan --------------------------------------------------------------------------------

export const CELL = { w: 140, h: 96 };
export const STREET = 28; // a street's width
export const PATH = 20; // a path's
export const DOOR = 14; // the way from open ground into a building
export const TRACK = 12; // a track out onto the terraces
export const WALL_PAD = 14; // the wall's clearance round the boxes inside it
export const SIZES = {
  building: { w: 104, h: 54 },
  field: { w: 128, h: 76 },
  square: { w: 86, h: 66 },
  terraces: { w: 128, h: 62 },
  "old-terraces": { w: 128, h: 62 },
  overlook: { w: 72, h: 72 },
  street: { w: STREET, h: STREET },
  path: { w: PATH, h: PATH },
};
const OPEN = new Set(["street", "path", "square"]); // ground you walk across, drawn as one surface
const LINE = new Set(["street", "path"]); // drawn as a band through its cell, named beside it
const BACK = { north: "south", south: "north", east: "west", west: "east" };

/** How far a room's shape reaches from its centre along one axis (0 for a street's point). */
function reach(b, axis) {
  return LINE.has(b.kind) ? 0 : (axis === "x" ? b.w : b.h) / 2;
}

/**
 * The plan: a box for each room, the links between them, the wall, the labels beside the streets,
 * and the frame.
 * @param {ReturnType<typeof indexTown>} index
 * @param {typeof TOWNS.zennor} spec
 */
export function townLayout(index, spec) {
  const boxes = [];
  const byId = new Map();
  for (const room of index.byId.values()) {
    const size = SIZES[room.kind] ?? SIZES.building;
    const b = { room, kind: room.kind, cx: room.cell.x * CELL.w, cy: -room.cell.y * CELL.h || 0, ...size };
    boxes.push(b);
    byId.set(room.id, b);
  }

  // each exit once, as a link from where the walk met it
  const links = [];
  const seen = new Set();
  for (const a of boxes) {
    for (const [dir, to] of Object.entries(a.room.exits)) {
      const b = byId.get(to);
      const pair = [a.room.id, to].sort().join("|");
      if (!b || seen.has(pair)) continue;
      seen.add(pair);
      links.push(link(a, b, dir));
    }
  }

  const wall = wallOf(boxes, links, spec);
  const labels = boxes.filter((b) => LINE.has(b.kind)).map((b) => streetLabel(b, links));
  // a name beside a street on the wall's line (the gate's) goes just inside it, off the stone
  for (const t of labels) {
    if (!wall || t.anchor === "middle") continue;
    if (t.y === wall.y0) t.y += 13;
    else if (t.y === wall.y1) t.y -= 13;
  }

  // the frame: everything, with room for the info line and N ▲
  const xs = boxes.flatMap((b) => [b.cx - b.w / 2, b.cx + b.w / 2]);
  const ys = boxes.flatMap((b) => [b.cy - b.h / 2, b.cy + b.h / 2]);
  if (wall) xs.push(wall.x0, wall.x1), ys.push(wall.y0, wall.y1);
  const pad = 28;
  const bounds = boxes.length
    ? { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad }
    : { x0: -200, y0: -150, x1: 200, y1: 150 };
  return {
    boxes,
    byId,
    links,
    wall,
    labels,
    bounds,
    home: [(bounds.x0 + bounds.x1) / 2, (bounds.y0 + bounds.y1) / 2],
    extent: { w: bounds.x1 - bounds.x0, h: bounds.y1 - bounds.y0 },
  };
}

/**
 * A link between two rooms. Along a compass exit it's a strip from edge to edge: `street` (or
 * `path`) between open ground, `door` into a building, `track` out onto the terraces. Any other
 * exit is a `climb`, a line from edge to edge that the drawing dashes and marks "up".
 */
function link(a, b, dir) {
  const step = STEP[dir];
  if (!step) {
    // the way from a to b on the plan, which the walk took from the way into the lower room
    const [ddx, ddy] = [b.cx - a.cx, a.cy - b.cy];
    const way = Math.abs(ddx) >= Math.abs(ddy) ? (ddx >= 0 ? "east" : "west") : ddy >= 0 ? "north" : "south";
    const [dx, dy] = STEP[way];
    const axis = dx ? "x" : "y";
    const ra = reach(a, axis) || a.w / 2;
    const rb = reach(b, axis) || b.w / 2;
    return {
      a: a.room.id,
      b: b.room.id,
      dir,
      way,
      kind: "climb",
      lower: a.room.rise > b.room.rise ? b.room.id : a.room.id,
      x1: a.cx + dx * ra,
      y1: a.cy - dy * ra,
      x2: b.cx - dx * rb,
      y2: b.cy + dy * rb,
    };
  }
  const kinds = [a.kind, b.kind];
  const kind = kinds.includes("building")
    ? "door"
    : kinds.some((k) => k.endsWith("terraces"))
      ? "track"
      : kinds.includes("path")
        ? "path"
        : "street";
  const width = { door: DOOR, track: TRACK, path: PATH, street: STREET }[kind];
  const [dx, dy] = step;
  let rect;
  if (dx) {
    const [l, r] = dx > 0 ? [a, b] : [b, a];
    const x0 = l.cx + reach(l, "x");
    const x1 = r.cx - reach(r, "x");
    rect = { x: x0, y: a.cy - width / 2, width: x1 - x0, height: width };
  } else {
    const [t, u] = dy > 0 ? [b, a] : [a, b]; // t is the northern one, drawn higher (smaller y)
    const y0 = t.cy + reach(t, "y");
    const y1 = u.cy - reach(u, "y");
    rect = { x: a.cx - width / 2, y: y0, width, height: y1 - y0 };
  }
  return { a: a.room.id, b: b.room.id, dir, kind, ...rect };
}

/** The compass way a link leaves room id on the plan ("north", ...), or null. */
function wayOut(l, id) {
  const way = l.way ?? l.dir;
  if (l.a === id) return way;
  if (l.b === id) return BACK[way];
  return null;
}

/**
 * The town's wall: a rounded rectangle round the walled rooms (their boxes with clearance, a
 * street's centre line, so the gate's arch is on its street), with a gap wherever a link goes
 * out through it. The gap from the spec's `gate` is its arch.
 */
function wallOf(boxes, links, spec) {
  const inside = new Set(spec.walled ?? []);
  const walled = boxes.filter((b) => inside.has(b.room.id));
  if (!walled.length) return null;
  const ext = (b, axis, sg) => {
    const c = axis === "x" ? b.cx : b.cy;
    return LINE.has(b.kind) ? c : c + sg * ((axis === "x" ? b.w : b.h) / 2 + WALL_PAD);
  };
  const w = {
    x0: Math.min(...walled.map((b) => ext(b, "x", -1))),
    x1: Math.max(...walled.map((b) => ext(b, "x", 1))),
    y0: Math.min(...walled.map((b) => ext(b, "y", -1))),
    y1: Math.max(...walled.map((b) => ext(b, "y", 1))),
    r: 14,
    gaps: [],
  };
  for (const l of links) {
    if (l.kind === "climb" || inside.has(l.a) === inside.has(l.b)) continue;
    const id = inside.has(l.a) ? l.a : l.b;
    const side = wayOut(l, id);
    const along = side === "north" || side === "south" ? l.x + l.width / 2 : l.y + l.height / 2;
    const half = (side === "north" || side === "south" ? l.width : l.height) / 2 + 8;
    w.gaps.push({ side, at: along, half, gate: id === spec.gate });
  }
  return w;
}

/**
 * Where a street's name goes: east of it if nothing leaves that way, else west, else under it.
 * A climb counts as leaving the way it goes on the plan.
 */
function streetLabel(b, links) {
  const ways = new Set(links.map((l) => wayOut(l, b.room.id)));
  const name = b.room.name ?? "";
  const words = name.split(" ");
  const half = Math.ceil(words.length / 2);
  const lines = name.length > 14 && words.length > 1 ? [words.slice(0, half).join(" "), words.slice(half).join(" ")] : [name];
  const gap = b.w / 2 + 6;
  if (!ways.has("east")) return { room: b.room, x: b.cx + gap, y: b.cy, anchor: "start", lines };
  if (!ways.has("west")) return { room: b.room, x: b.cx - gap, y: b.cy, anchor: "end", lines };
  return { room: b.room, x: b.cx, y: b.cy + b.h / 2 + 12, anchor: "middle", lines };
}

/**
 * The lit shape for your place: a building's or the field's box, the square, a terrace, the
 * lookout's circle, or for a street or path its stretch of band: a cross out from its middle
 * halfway along each way it joins other open ground. Null off the plan.
 */
export function townShape(layout, where) {
  if (!layout || where?.kind !== "room") return null;
  const b = layout.byId.get(where.id);
  if (!b) return null;
  if (b.kind === "overlook") return { kind: "circle", cx: b.cx, cy: b.cy, r: b.w / 2 };
  if (!LINE.has(b.kind)) {
    return { kind: "rect", x: b.cx - b.w / 2, y: b.cy - b.h / 2, width: b.w, height: b.h, rx: b.kind === "square" ? 10 : 5 };
  }
  const hw = b.w / 2;
  const arm = { north: hw, south: hw, east: hw, west: hw };
  for (const l of layout.links) {
    if (l.kind !== "street" && l.kind !== "path") continue;
    const way = wayOut(l, b.room.id);
    if (!way) continue;
    const other = layout.byId.get(l.a === b.room.id ? l.b : l.a);
    const axis = way === "east" || way === "west" ? "x" : "y";
    const d = Math.abs(axis === "x" ? other.cx - b.cx : other.cy - b.cy);
    arm[way] = Math.max(hw, Math.min(d / 2, d - reach(other, axis)));
  }
  const { north: n, south: s, east: e, west: w } = arm;
  const pts = [
    [-hw, -n], [hw, -n], [hw, -hw], [e, -hw], [e, hw], [hw, hw],
    [hw, s], [-hw, s], [-hw, hw], [-w, hw], [-w, -hw], [-hw, -hw],
  ];
  return { kind: "path", d: `M${pts.map(([x, y]) => `${b.cx + x},${b.cy + y}`).join("L")}Z`, cx: b.cx, cy: b.cy };
}
