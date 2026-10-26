// Towns on a planet's surface, Zennor so far: rooms with no addresses or coords (`layout: none`),
// placed one cell a step by their compass exits, which on a planet are the compass. Indoor rooms
// are buildings; outdoor rooms are open ground: street, a square, a path, a landing field,
// terraces, a lookout. Everything here is the plan's layout and highlight; the drawing is
// town-deck.js. Pure; no DOM.

// --- placing rooms by their exits ------------------------------------------------------------

/** A step each compass way: x east, y north. */
export const STEP = {
  north: [0, 1],
  south: [0, -1],
  east: [1, 0],
  west: [-1, 0],
  northeast: [1, 1],
  northwest: [-1, 1],
  southeast: [1, -1],
  southwest: [-1, -1],
};
const BACK = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
  northeast: "southwest",
  southwest: "northeast",
  northwest: "southeast",
  southeast: "northwest",
  up: "down",
  down: "up",
};

/** Where an exit goes: its room, whether it's a plain id or `{ to, via, seconds }`. */
export const exitTo = (e) => (typeof e === "string" ? e : (e?.to ?? null));

/** The step an exit takes on the plan: its compass way's, `up` uphill and `down` downhill (height
 *  is never drawn as north, style guide principle 5, but on a hillside up is a way), and any other
 *  (`in`, `out`) uphill too. */
function stepOf(dir, uphill) {
  if (STEP[dir]) return STEP[dir];
  return dir === "down" ? STEP[BACK[uphill]] : STEP[uphill];
}

/**
 * Each room's cell, from its exits, walked from `root` (else the first room). A city's compass
 * doesn't sit on a grid, so rather than one cell a step, each exit only says which side of the
 * room its far end is: an east exit's room is in the same row, somewhere east; a northeast one's
 * is somewhere north and somewhere east. Every exit would rather be one cell long, and the rooms
 * settle where the most are; where two rooms would share a cell, a way would run through another
 * room, or two ways cross, the pair is pulled apart whichever way stretches the ways least. `up`
 * goes `uphill` (east by default) and `down` the other way, and both count the room's `rise`.
 * Rooms the walk doesn't reach aren't placed.
 * @param {{id: string, exits?: Record<string, string|{to: string}>}[]} rooms
 * @returns {Map<string, {x: number, y: number, rise: number}>}
 */
export function placeRooms(rooms, root, uphill = "east") {
  const byId = new Map((rooms ?? []).map((r) => [r.id, r]));
  const start = byId.has(root) ? root : rooms?.[0]?.id;
  const placed = new Map();
  if (!start) return placed;

  // the rooms the walk reaches, their rise, and each way between two of them once
  const rise = new Map([[start, 0]]);
  const ways = [];
  const seen = new Set();
  const queue = [start];
  while (queue.length) {
    const id = queue.shift();
    for (const [dir, e] of Object.entries(byId.get(id).exits ?? {})) {
      const to = exitTo(e);
      if (!byId.has(to) || to === id) continue;
      if (!rise.has(to)) {
        rise.set(to, rise.get(id) + (dir === "up" ? 1 : dir === "down" ? -1 : 0));
        queue.push(to);
      }
      const pair = [id, to].sort().join("|");
      if (seen.has(pair)) continue;
      seen.add(pair);
      ways.push({ a: id, b: to, step: stepOf(dir, uphill) });
    }
  }
  const ids = [...rise.keys()];

  // rooms an east-west way joins share a row; rooms a north-south way joins share a column
  const group = () => {
    const up = new Map(ids.map((i) => [i, i]));
    const find = (i) => (up.get(i) === i ? i : (up.set(i, find(up.get(i))), up.get(i)));
    return { find, join: (a, b) => up.set(find(a), find(b)) };
  };
  const col = group();
  const row = group();
  for (const { a, b, step } of ways) {
    if (step[0] === 0) col.join(a, b);
    if (step[1] === 0) row.join(a, b);
  }
  // each way, as "this group is below that one" along x or y
  const springs = { x: [], y: [] };
  for (const { a, b, step } of ways) {
    if (step[0]) springs.x.push(step[0] > 0 ? [a, b] : [b, a]);
    if (step[1]) springs.y.push(step[1] > 0 ? [a, b] : [b, a]);
  }

  // place the groups: each as low as its ways allow, then each where most of its ways are one long
  const solve = (apart) => {
    const at = {};
    for (const axis of ["x", "y"]) {
      const g = axis === "x" ? col : row;
      const pull = springs[axis].map(([lo, hi]) => [g.find(lo), g.find(hi)]);
      const keep = [...pull, ...apart.filter((c) => c[0] === axis).map(([, lo, hi]) => [g.find(lo), g.find(hi)])];
      if (keep.some(([lo, hi]) => lo === hi)) return null;
      const groups = [...new Set(ids.map((i) => g.find(i)))];
      const v = new Map(groups.map((n) => [n, 0]));
      for (let pass = 0, moved = true; moved; pass++) {
        if (pass > groups.length) return null; // a loop of ways that can't close
        moved = false;
        for (const [lo, hi] of keep) {
          if (v.get(hi) < v.get(lo) + 1) {
            v.set(hi, v.get(lo) + 1);
            moved = true;
          }
        }
      }
      for (let pass = 0, moved = true; moved && pass < 100; pass++) {
        moved = false;
        for (const n of groups) {
          let min = -Infinity;
          let max = Infinity;
          for (const [lo, hi] of keep) {
            if (hi === n) min = Math.max(min, v.get(lo) + 1);
            if (lo === n) max = Math.min(max, v.get(hi) - 1);
          }
          const want = [];
          for (const [lo, hi] of pull) {
            if (hi === n) want.push(v.get(lo) + 1);
            if (lo === n) want.push(v.get(hi) - 1);
          }
          if (!want.length) continue;
          want.sort((p, q) => p - q);
          const m = Math.max(min, Math.min(max, want[(want.length - 1) >> 1]));
          if (m !== v.get(n)) {
            v.set(n, m);
            moved = true;
          }
        }
      }
      at[axis] = (id) => v.get(g.find(id));
    }
    return new Map(ids.map((id) => [id, [at.x(id), at.y(id)]]));
  };

  // how much longer than a cell the ways are, and what's in the wrong place
  const stretch = (pos) => {
    let n = 0;
    for (const { a, b } of ways) {
      const [p, q] = [pos.get(a), pos.get(b)];
      n += Math.max(0, Math.abs(p[0] - q[0]) - 1) + Math.max(0, Math.abs(p[1] - q[1]) - 1);
    }
    return n;
  };
  const clashes = (pos) => {
    const out = [];
    const cells = new Map();
    for (const id of ids) {
      const key = pos.get(id).join(":");
      if (cells.has(key)) out.push([cells.get(key), id]);
      else cells.set(key, id);
    }
    for (const { a, b } of ways) {
      const [p, q] = [pos.get(a), pos.get(b)];
      const n = Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]));
      for (let k = 1; k < n; k++) {
        const other = cells.get(`${p[0] + ((q[0] - p[0]) * k) / n}:${p[1] + ((q[1] - p[1]) * k) / n}`);
        if (other) out.push([other, a]);
      }
    }
    for (let i = 0; i < ways.length; i++) {
      for (let j = i + 1; j < ways.length; j++) {
        const [u, w] = [ways[i], ways[j]];
        if (u.a === w.a || u.a === w.b || u.b === w.a || u.b === w.b) continue;
        if (crosses(pos.get(u.a), pos.get(u.b), pos.get(w.a), pos.get(w.b))) out.push([u.a, w.a]);
      }
    }
    return out;
  };

  const apart = [];
  let pos = solve(apart);
  for (let k = 0; pos && k < ids.length * 2; k++) {
    const clash = clashes(pos);
    if (!clash.length) break;
    const [p, q] = clash[0];
    let best = null;
    for (const c of [["x", p, q], ["x", q, p], ["y", p, q], ["y", q, p]]) {
      const t = solve([...apart, c]);
      if (!t) continue;
      const score = stretch(t) + 10 * clashes(t).length;
      if (!best || score < best.score) best = { score, c, t };
    }
    if (!best) break; // can't be pulled apart: drawn on top of each other, as the YAML says
    apart.push(best.c);
    pos = best.t;
  }
  if (!pos) pos = new Map(ids.map((id, i) => [id, [i, 0]])); // ways that contradict: a row, so it still draws

  const [x0, y0] = pos.get(start);
  for (const id of ids) {
    const [x, y] = pos.get(id);
    placed.set(id, { x: x - x0, y: y - y0, rise: rise.get(id) });
  }
  return placed;
}

/** Whether segment p1-p2 crosses p3-p4 between their ends. */
function crosses(p1, p2, p3, p4) {
  const side = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  return side(p1, p2, p3) * side(p1, p2, p4) < 0 && side(p3, p4, p1) * side(p3, p4, p2) < 0;
}

// --- the index, locating you, the info line ---------------------------------------------------

/**
 * The town's placed rooms by id, each with its `cell`, `rise`, `kind` (building, street, square,
 * garden, path, field, terraces, old-terraces, overlook), its district's name and the area's
 * gravity; the area, its districts and its cars (the tram).
 * @param {typeof import("../data/zennor.js").default} data
 * @param {ReturnType<typeof import("./look.js").townSpec>} spec
 */
export function indexTown(data, spec) {
  const placed = placeRooms(data?.rooms ?? [], spec.root, spec.uphill);
  const districts = data?.area?.districts ?? [];
  const named = new Map(districts.map((d) => [d.id, d.name]));
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
      district: r.district ?? null,
      districtName: named.get(r.district) ?? null,
      outdoors,
      kind,
      cell: { x: p.x, y: p.y },
      rise: p.rise,
      level: 0,
    });
  }
  return { byId, area: data?.area ?? null, districts, cars: data?.cars ?? [] };
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

/** `CONDUIT SQUARE · the Market Quarter · Zennor · 1 g`: the room, its district, the town (its
 *  rooms have no address), the gravity. */
export function townInfo(where, msg, index) {
  try {
    const s = (v) => (typeof v === "string" && v !== "" ? v : null);
    if (!where || where.kind !== "room") return (s(where?.name) ?? s(msg?.name) ?? "").toUpperCase();
    const room = index?.byId?.get(where.id);
    const parts = [(s(msg?.name) ?? s(room?.name) ?? "").toUpperCase()];
    if (s(room?.districtName)) parts.push(room.districtName);
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
export const RIVER = { w: 36, gap: 22 }; // the river's width, and its clearance from the rooms
export const MAX_W = 2400; // zoomed right out: the whole city, wider than a station's plans
export const SIZES = {
  building: { w: 104, h: 54 },
  field: { w: 128, h: 76 },
  square: { w: 86, h: 66 },
  garden: { w: 86, h: 66 },
  terraces: { w: 128, h: 62 },
  "old-terraces": { w: 128, h: 62 },
  overlook: { w: 72, h: 72 },
  street: { w: STREET, h: STREET },
  path: { w: PATH, h: PATH },
};
const LINE = new Set(["street", "path"]); // drawn as a band through its cell, named beside it
const OPEN = new Set(["street", "path", "square", "garden"]); // ground you walk across, one surface

/** How far a room's shape reaches from its centre along one axis (0 for a street's point). */
function reach(b, axis) {
  return LINE.has(b.kind) ? 0 : (axis === "x" ? b.w : b.h) / 2;
}

/** How far from its centre a ray (ux, uy) leaves a room's box (its circle, for the overlook). */
function edge(b, ux, uy) {
  if (LINE.has(b.kind)) return 0;
  if (b.kind === "overlook") return b.w / 2;
  return Math.min(ux ? b.w / 2 / Math.abs(ux) : Infinity, uy ? b.h / 2 / Math.abs(uy) : Infinity);
}

/**
 * The plan: a box for each room, the links between them, the districts' washes and names, the
 * river, the scarp, the gate's arch, the tram's line, the labels beside the streets, and the
 * frame.
 * @param {ReturnType<typeof indexTown>} index
 * @param {ReturnType<typeof import("./look.js").townSpec>} spec
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

  // each exit once
  const links = [];
  const seen = new Set();
  for (const a of boxes) {
    for (const [dir, e] of Object.entries(a.room.exits)) {
      const to = exitTo(e);
      const b = byId.get(to);
      const pair = [a.room.id, to].sort().join("|");
      if (!b || seen.has(pair)) continue;
      seen.add(pair);
      const back = Object.entries(b.room.exits).find(([, f]) => exitTo(f) === a.room.id);
      links.push(link(a, b, dir, e, back, spec));
    }
  }

  const river = riverOf(boxes, links, spec);
  const tram = tramOf(index, byId, boxes);
  const districts = districtsOf(index, boxes, links, spec, river, tram);
  const scarp = scarpOf(boxes, links, spec);
  const gate = gateOf(byId, links, spec);
  const labels = boxes.filter((b) => LINE.has(b.kind)).map((b) => streetLabel(b, links, river, tram));

  // the frame: everything, with room for the info line and N ▲
  const xs = boxes.flatMap((b) => [b.cx - b.w / 2, b.cx + b.w / 2]);
  const ys = boxes.flatMap((b) => [b.cy - b.h / 2, b.cy + b.h / 2]);
  if (river) xs.push(...river.points.map((p) => p[0] - RIVER.w / 2 - 20));
  const pad = 28;
  const bounds = boxes.length
    ? { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad }
    : { x0: -200, y0: -150, x1: 200, y1: 150 };
  if (river) river.points = [[river.points[0][0], bounds.y0 - 200], ...river.points, [river.points.at(-1)[0], bounds.y1 + 200]];
  if (river) river.d = smooth(river.points);
  return {
    boxes,
    byId,
    links,
    districts,
    river,
    scarp,
    gate,
    tram,
    labels,
    bounds,
    home: [(bounds.x0 + bounds.x1) / 2, (bounds.y0 + bounds.y1) / 2],
    extent: { w: bounds.x1 - bounds.x0, h: bounds.y1 - bounds.y0 },
  };
}

/**
 * A link between two rooms. Along a compass exit it's a band from edge to edge: `street` (or
 * `path`) between open ground, `door` into a building, `track` out onto the terraces; a straight
 * one has its rect, a diagonal one its two ends and width. `up` and `down` are a `climb`, a line
 * from edge to edge that the drawing dashes and marks "up", or `steps` for a way `via: steps`,
 * with its seconds each way by its words (`{ down: 12, up: 40 }`).
 */
function link(a, b, dir, exit, back, spec) {
  const step = STEP[dir];
  if (!step) {
    // the way from a to b on the plan: uphill or downhill
    const [ddx, ddy] = [b.cx - a.cx, a.cy - b.cy];
    const way = Math.abs(ddx) >= Math.abs(ddy) ? (ddx >= 0 ? "east" : "west") : ddy >= 0 ? "north" : "south";
    const [dx, dy] = STEP[way];
    const axis = dx ? "x" : "y";
    const ra = reach(a, axis) || a.w / 2;
    const rb = reach(b, axis) || b.w / 2;
    const steps = exit?.via === "steps";
    const l = {
      a: a.room.id,
      b: b.room.id,
      dir,
      way,
      kind: steps ? "steps" : "climb",
      lower: a.room.rise > b.room.rise ? b.room.id : a.room.id,
      x1: a.cx + dx * ra,
      y1: a.cy - dy * ra,
      x2: b.cx - dx * rb,
      y2: b.cy + dy * rb,
    };
    if (steps) {
      l.seconds = {};
      if (Number.isFinite(exit.seconds)) l.seconds[dir] = exit.seconds;
      if (back && Number.isFinite(back[1]?.seconds)) l.seconds[back[0]] = back[1].seconds;
    }
    return l;
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
  const bridge = !!spec.river?.bridge && [a.room.id, b.room.id].includes(spec.river.bridge);
  const [dx, dy] = step;
  if (dx && dy) {
    const len = Math.hypot(CELL.w * (b.room.cell.x - a.room.cell.x), CELL.h * (b.room.cell.y - a.room.cell.y));
    const ux = (b.cx - a.cx) / len;
    const uy = (b.cy - a.cy) / len;
    const ra = edge(a, ux, uy);
    const rb = edge(b, -ux, -uy);
    return { a: a.room.id, b: b.room.id, dir, kind, width, x1: a.cx + ux * ra, y1: a.cy + uy * ra, x2: b.cx - ux * rb, y2: b.cy - uy * rb };
  }
  let rect;
  if (dx) {
    const [l, r] = b.cx > a.cx ? [a, b] : [b, a];
    const x0 = l.cx + reach(l, "x");
    const x1 = r.cx - reach(r, "x");
    rect = { x: x0, y: a.cy - width / 2, width: x1 - x0, height: width };
  } else {
    const [t, u] = b.cy < a.cy ? [b, a] : [a, b]; // t is the northern one, drawn higher (smaller y)
    const y0 = t.cy + reach(t, "y");
    const y1 = u.cy - reach(u, "y");
    rect = { x: a.cx - width / 2, y: y0, width, height: y1 - y0 };
  }
  return { a: a.room.id, b: b.room.id, dir, kind, ...rect, ...(bridge ? { bridge: true } : {}) };
}

/** The compass ways a link leaves room id by on the plan (a diagonal's two), or none. */
function waysOut(l, id) {
  const way = l.way ?? l.dir;
  const out = l.a === id ? way : l.b === id ? BACK[way] : null;
  if (!out) return [];
  return STEP[out]?.[0] && STEP[out]?.[1] ? [out.startsWith("north") ? "north" : "south", out.endsWith("east") ? "east" : "west"] : [out];
}

/**
 * Each district: its cells, for its wash, and where its name goes. The name sits in an empty cell
 * beside the district, the nearest to its middle, rather north than south, where nothing else is
 * (no room, no way, the tram's line or the river) and neither of the cells either side is a room;
 * zoomed right out, it goes over the district's middle instead.
 */
function districtsOf(index, boxes, links, spec, river, tram) {
  const rooms = new Set(boxes.map((b) => `${b.room.cell.x}:${b.room.cell.y}`));
  const taken = new Set(rooms);
  // the cells a long way runs through
  for (const l of links) {
    const [p, q] = [index.byId.get(l.a).cell, index.byId.get(l.b).cell];
    const n = Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
    for (let k = 1; k < n; k++) taken.add(`${p.x + ((q.x - p.x) * k) / n}:${p.y + ((q.y - p.y) * k) / n}`);
  }
  // the cells the tram's line passes near the middle of
  const cellOf = ([x, y]) => [Math.round(x / CELL.w), Math.round(-y / CELL.h) || 0];
  for (let i = 0; tram && i < tram.points.length - 1; i++) {
    const [p, q] = [tram.points[i], tram.points[i + 1]];
    for (let t = 0; t <= 1; t += 0.05) {
      const pt = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      const [cx, cy] = cellOf(pt);
      if (Math.abs(pt[1] + cy * CELL.h) < CELL.h * 0.3) taken.add(`${cx}:${cy}`);
    }
  }
  // the river, and everything past it
  const wet = (x, y) => {
    if (!river) return false;
    const row = river.points.reduce((m, p) => (Math.abs(p[1] + y * CELL.h) < Math.abs(m[1] + y * CELL.h) ? p : m));
    const sign = (spec.uphill ?? "east") === "east" ? -1 : 1;
    return (x * CELL.w - row[0]) * sign > -CELL.w * 0.6;
  };
  const district = new Map(boxes.map((b) => [`${b.room.cell.x}:${b.room.cell.y}`, b.room.district]));
  const named = new Set();
  const out = [];
  for (const d of index.districts) {
    const mine = boxes.filter((b) => b.room.district === d.id);
    if (!mine.length) continue;
    const mx = mine.reduce((s, b) => s + b.room.cell.x, 0) / mine.length;
    const my = mine.reduce((s, b) => s + b.room.cell.y, 0) / mine.length;
    let best = null;
    for (const b of mine) {
      for (const [dx, dy] of Object.values(STEP)) {
        const [x, y] = [b.room.cell.x + dx, b.room.cell.y + dy];
        const key = `${x}:${y}`;
        if (taken.has(key) || named.has(key) || wet(x, y)) continue;
        const sides = [x - 1, x + 1].filter((sx) => rooms.has(`${sx}:${y}`)).length;
        const others = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oy]) => (district.get(`${x + ox}:${y + oy}`) ?? d.id) !== d.id).length;
        const score = Math.hypot(x - mx, y - my) + (y < my ? 1 : 0) + 0.8 * sides + 1.5 * others;
        if (!best || score < best.score) best = { score, x, y, key };
      }
    }
    if (best) named.add(best.key);
    const at = best ? { x: best.x * CELL.w, y: -best.y * CELL.h || 0 } : { x: mx * CELL.w, y: -my * CELL.h - CELL.h / 2 };
    out.push({
      id: d.id,
      name: d.name,
      tint: spec.tints?.[d.id] ?? null,
      cells: mine.map((b) => ({ x: b.cx - CELL.w / 2, y: b.cy - CELL.h / 2, width: CELL.w, height: CELL.h })),
      label: at,
      middle: { x: mx * CELL.w, y: -my * CELL.h || 0 },
      box: {
        x0: Math.min(...mine.map((b) => b.cx - b.w / 2)),
        y0: Math.min(...mine.map((b) => b.cy - b.h / 2)),
        x1: Math.max(...mine.map((b) => b.cx + b.w / 2)),
        y1: Math.max(...mine.map((b) => b.cy + b.h / 2)),
      },
    });
  }
  return out;
}

/**
 * The river along the plan's downhill side: a point a row, just clear of the rooms in that row
 * and the rows either side, except the room on its bridge, which is over the water, so the river
 * runs between it and the way onto it. Only for a town whose uphill is east or west.
 */
function riverOf(boxes, links, spec) {
  if (!spec.river || !["east", "west"].includes(spec.uphill ?? "east")) return null;
  const sign = (spec.uphill ?? "east") === "east" ? -1 : 1; // which way is downhill on the plan
  const ashore = boxes.filter((b) => b.room.id !== spec.river.bridge);
  if (!ashore.length) return null;
  const rows = [...new Set(boxes.map((b) => b.cy))].sort((p, q) => p - q);
  const points = rows.map((y) => {
    const near = ashore.filter((b) => Math.abs(b.cy - y) <= CELL.h);
    const pool = near.length ? near : ashore;
    const side = sign < 0 ? Math.min(...pool.map((b) => b.cx - b.w / 2)) : Math.max(...pool.map((b) => b.cx + b.w / 2));
    return [side + sign * (RIVER.gap + RIVER.w / 2), y];
  });
  // its name, on the longest straight reach, beside it on the far side
  let run = { from: 0, to: 0 };
  for (let i = 0, from = 0; i < points.length; i++) {
    if (i > 0 && Math.abs(points[i][0] - points[i - 1][0]) > 4) from = i;
    if (i - from > run.to - run.from) run = { from, to: i };
  }
  const [lx, ly] = [points[run.from][0], (points[run.from][1] + points[run.to][1]) / 2];
  const bridge = links.find((l) => l.bridge);
  return { name: spec.river.name, points, label: { x: lx + sign * (RIVER.w / 2 + 22), y: ly }, bridge: bridge ?? null };
}

/** A smooth path through points, top to bottom (Catmull-Rom as cubic Béziers). */
function smooth(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1.map((n) => +n.toFixed(1)).join(",")} ${c2.map((n) => +n.toFixed(1)).join(",")} ${p2.join(",")}`;
  }
  return d;
}

/** The scarp: the edge of the spec's upland district, a line midway along the Steps, from the
 *  district's top row to its bottom, its hatching on the downhill side. */
function scarpOf(boxes, links, spec) {
  const steps = links.find((l) => l.kind === "steps");
  const up = boxes.filter((b) => b.room.district === spec.scarp);
  if (!spec.scarp || !steps || !up.length) return null;
  const x = (steps.x1 + steps.x2) / 2;
  const downhill = (spec.uphill ?? "east") === "west" ? 1 : -1;
  return { x, y0: Math.min(...up.map((b) => b.cy)) - CELL.h / 2, y1: Math.max(...up.map((b) => b.cy)) + CELL.h / 2, downhill };
}

/** The old wall's arch: where the gate's way out (its climb, else its first link) leaves its
 *  street, across that way, with a stub of the wall either side. */
function gateOf(byId, links, spec) {
  const b = byId.get(spec.gate);
  if (!b) return null;
  const mine = links.filter((l) => l.a === b.room.id || l.b === b.room.id);
  const out = mine.find((l) => l.kind === "steps" || l.kind === "climb") ?? mine[0];
  if (!out) return null;
  const way = waysOut(out, b.room.id)[0];
  const [dx, dy] = STEP[way];
  const off = b.w / 2 + 8;
  return { x: b.cx + dx * off, y: b.cy - dy * off, rot: { north: 0, east: 90, south: 180, west: -90 }[way] ?? 0, half: STREET / 2 + 4 };
}

/**
 * The tram's line through its stops, bottom to top: straight from stop to stop where that clears
 * every other room, else out of the stop half a cell south (or north), along, and back up into
 * the next. Null without a tram, or with a stop not on the plan.
 */
function tramOf(index, byId, boxes) {
  const car = index.cars.find((c) => c.kind === "tram");
  const stops = car?.stops.map((id) => byId.get(id));
  if (!stops?.length || stops.some((s) => !s)) return null;
  const clear = (pts, ends) => {
    for (let i = 0; i < pts.length - 1; i++) {
      for (const b of boxes) {
        if (ends.includes(b)) continue;
        const r = LINE.has(b.kind) ? { x0: b.cx - b.w / 2, y0: b.cy - b.h / 2, x1: b.cx + b.w / 2, y1: b.cy + b.h / 2 } : { x0: b.cx - b.w / 2 - 4, y0: b.cy - b.h / 2 - 4, x1: b.cx + b.w / 2 + 4, y1: b.cy + b.h / 2 + 4 };
        if (LINE.has(b.kind)) continue; // a level crossing
        if (hitsBox(pts[i], pts[i + 1], r)) return false;
      }
    }
    return true;
  };
  const points = [[stops[0].cx, stops[0].cy]];
  for (let i = 1; i < stops.length; i++) {
    const [p, s] = [stops[i - 1], stops[i]];
    const straight = [[p.cx, p.cy], [s.cx, s.cy]];
    let route = straight;
    if (!clear(straight, [p, s])) {
      for (const sg of [1, -1]) {
        const y = (p.cy + s.cy) / 2 + (sg * CELL.h) / 2;
        const dir = Math.sign(s.cx - p.cx) || 1;
        const r = [[p.cx, p.cy], [p.cx + dir * (p.w / 2 - 6), y], [s.cx - dir * (s.w / 2 - 6), y], [s.cx, s.cy]];
        if (clear(r, [p, s])) {
          route = r;
          break;
        }
      }
    }
    points.push(...route.slice(1));
  }
  return { name: car.name, stops: stops.map((s) => s.room.id), points, d: `M${points.map((p) => p.join(",")).join("L")}` };
}

/** Whether segment p-q passes through box r (Liang-Barsky). */
function hitsBox(p, q, r) {
  let t0 = 0;
  let t1 = 1;
  const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
  for (const [pp, qq] of [[-dx, p[0] - r.x0], [dx, r.x1 - p[0]], [-dy, p[1] - r.y0], [dy, r.y1 - p[1]]]) {
    if (pp === 0) {
      if (qq < 0) return false;
      continue;
    }
    const t = qq / pp;
    if (pp < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * Where a street's name goes: east of it if nothing leaves that way, else west, else under it,
 * else over it, else just over the way out east. A climb counts as leaving the way it goes on the
 * plan, and a diagonal both its ways. A name that would lie on the river or across the tram's
 * line goes on to the next.
 */
function streetLabel(b, links, river, tram) {
  const ways = new Set(links.flatMap((l) => waysOut(l, b.room.id)));
  const name = b.room.name ?? "";
  const words = name.split(" ");
  const half = Math.ceil(words.length / 2);
  const lines = name.length > 14 && words.length > 1 ? [words.slice(0, half).join(" "), words.slice(half).join(" ")] : [name];
  const gap = b.w / 2 + 6;
  const long = Math.max(...lines.map((t) => t.length)) * 6.2; // about how wide, at 11
  const up = b.h / 2 + 12 + (lines.length - 1) * 6.5;
  const dry = (x0, x1, y) => {
    if (river && wetAt(river, x0, x1, y)) return false;
    const box = { x0, x1, y0: y - 7, y1: y + 7 };
    return !tram?.points.some((p, i) => i > 0 && hitsBox(tram.points[i - 1], p, box));
  };
  const tries = [
    !ways.has("east") && dry(b.cx + gap, b.cx + gap + long, b.cy) && { x: b.cx + gap, y: b.cy, anchor: "start" },
    !ways.has("west") && dry(b.cx - gap - long, b.cx - gap, b.cy) && { x: b.cx - gap, y: b.cy, anchor: "end" },
    !ways.has("south") && dry(b.cx - long / 2, b.cx + long / 2, b.cy + up) && { x: b.cx, y: b.cy + up, anchor: "middle" },
    !ways.has("north") && dry(b.cx - long / 2, b.cx + long / 2, b.cy - up) && { x: b.cx, y: b.cy - up, anchor: "middle" },
  ];
  const at = tries.find(Boolean) ?? { x: b.cx + gap, y: b.cy - STREET / 2 - 4 - (lines.length - 1) * 6.5, anchor: "start" };
  return { room: b.room, ...at, lines };
}

/** Whether a stretch x0..x1 at height y lies on the river, with a little clearance. */
function wetAt(river, x0, x1, y) {
  const p = river.points;
  let i = p.findIndex((q) => q[1] >= y);
  if (i <= 0) i = i === 0 ? 1 : p.length - 1;
  const [a, b] = [p[i - 1], p[i]];
  const x = a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1] || 1);
  const half = RIVER.w / 2 + 6;
  return x1 > x - half && x0 < x + half;
}

/**
 * What ⌂ frames: your district, else the landing field's (where a landed ship is), else the
 * whole town. `{ home, extent }`, as a plan carries them.
 */
export function townFrame(layout, index, where) {
  const room = where?.kind === "room" ? index.byId.get(where.id) : null;
  const field = [...index.byId.values()].find((r) => r.kind === "field");
  const d = layout.districts.find((x) => x.id === (room ?? field)?.district);
  if (!d) return { home: layout.home, extent: layout.extent };
  const pad = 40;
  const x0 = Math.min(d.box.x0, d.label.x - 60);
  const x1 = Math.max(d.box.x1, d.label.x + 60);
  const y0 = Math.min(d.box.y0, d.label.y - 10);
  const y1 = Math.max(d.box.y1, d.label.y + 10);
  return { home: [(x0 + x1) / 2, (y0 + y1) / 2], extent: { w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad } };
}

/**
 * The lit shape for your place: a building's or the field's box, a square or the garden, a
 * terrace, the lookout's circle, or for a street or path its stretch of band: a cross out from its
 * middle halfway along each straight way it joins other open ground. Null off the plan.
 */
export function townShape(layout, where) {
  if (!layout || where?.kind !== "room") return null;
  const b = layout.byId.get(where.id);
  if (!b) return null;
  if (b.kind === "overlook") return { kind: "circle", cx: b.cx, cy: b.cy, r: b.w / 2 };
  if (!LINE.has(b.kind)) {
    return { kind: "rect", x: b.cx - b.w / 2, y: b.cy - b.h / 2, width: b.w, height: b.h, rx: b.kind === "square" || b.kind === "garden" ? 10 : 5 };
  }
  const hw = b.w / 2;
  const arm = { north: hw, south: hw, east: hw, west: hw };
  for (const l of layout.links) {
    if (l.kind !== "street" && l.kind !== "path") continue;
    const ways = waysOut(l, b.room.id);
    if (ways.length !== 1) continue;
    const way = ways[0];
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

export { OPEN };
