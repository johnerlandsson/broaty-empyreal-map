// Stations laid out on decks (station.md §2.6 in the Empyreal source): a station that doesn't
// spin, every room a cell of one grid, addressed "Deck 3, frame 2, port 1". The address is the
// cell, as the game's coords are: x the side (starboard positive), y the frame (counting fore), z
// the deck (counting up, away from the planet). Everything here is placed from those cells, so a
// new station on decks needs its rooms and a spec, not a hand-made layout. The model uses the
// other stations' frame (X = 3 o'clock, starboard; Y = 12 o'clock, up; Z = fore), so the one
// camera and renderer draw it. Pure; no DOM.

import { DISTRICT_COLOURS } from "./geometry.js";

// --- the stations ----------------------------------------------------------------------------

/**
 * What the addresses don't say. `prefix` is the rooms' id prefix; `tints` a district colour per
 * room; `blisters` the rooms that are glass blisters outside the hull, not cells of it; `cradles`
 * the blocks fore of the nose, each [side, deck, half-width, half-height, length] in cells;
 * `thrusters` the cells whose aft wall has thruster bells behind it, each [side, deck].
 */
export const DECKS = {
  // A foundry port: orange paint inside, a docking well at the nose with big cradles for ore tugs
  // and drop cans and small ones for skiffs wedged in at the corners, the stationkeeping thrusters
  // aft of Deck 3's bulkhead, and the Gallery a glass blister under Deck 2 looking down at Orrin.
  orrin: {
    prefix: "orrin",
    tints: {
      "orrin.berth": DISTRICT_COLOURS.docks,
      "orrin.deck-3-frame-2": DISTRICT_COLOURS.industrial, // foundry orange
      "orrin.deck-3-frame-1": DISTRICT_COLOURS.industrial,
      "orrin.freight": DISTRICT_COLOURS.industrial,
      "orrin.charts": DISTRICT_COLOURS.docks,
      "orrin.concourse": DISTRICT_COLOURS.industrial,
      "orrin.deck-2-frame-2": DISTRICT_COLOURS.industrial,
      "orrin.market": DISTRICT_COLOURS.concourse,
      "orrin.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["orrin.gallery"],
    cradles: [
      [0, 3, 0.3, 0.3, 0.22], // the docking well's mouth
      [-1, 3, 0.34, 0.3, 0.7], // ore tugs and drop cans
      [1, 3, 0.34, 0.3, 0.7],
      [0, 2, 0.34, 0.3, 0.7],
      [-1, 2, 0.18, 0.16, 0.36], // skiffs, at the corners
      [1, 2, 0.18, 0.16, 0.36],
    ],
    thrusters: [[0, 3]],
  },
};

// --- addresses and the index -----------------------------------------------------------------

const ADDRESS = /^\s*deck\s+(\d+)\s*,?\s*frame\s+(\d+)(?:\s*,?\s*(port|starboard)(?:\s+(\d+))?)?\s*$/i;

/** "Deck 3, frame 2, port 1" -> {x: -1, y: 2, z: 3}; a side alone is 1 off the centreline. */
export function parseAddress(address) {
  const m = typeof address === "string" ? ADDRESS.exec(address) : null;
  if (!m) return null;
  const n = m[4] === undefined ? 1 : Number(m[4]);
  const x = !m[3] ? 0 : m[3].toLowerCase() === "port" ? -n : n;
  return { x, y: Number(m[2]), z: Number(m[1]) };
}

/**
 * The station's rooms by id, each with its `cell` from its address, whether it's a `passage` (an
 * unnamed cell, named by its address) or a `blister`, and its `level`: the plan it's on, the top
 * deck first. `hull` is the box the cells that aren't blisters fill, in cells. Rooms without an
 * address the grid knows are left out.
 * @param {{rooms: object[]}} data
 * @param {typeof DECKS.orrin} spec
 */
export function indexDecks(data, spec) {
  const byId = new Map();
  for (const room of data?.rooms ?? []) {
    const cell = parseAddress(room.address);
    if (!cell) continue;
    const passage = String(room.name).toLowerCase() === String(room.address).toLowerCase();
    byId.set(room.id, { ...room, cell, passage, blister: spec.blisters?.includes(room.id) ?? false });
  }
  const decks = [...new Set([...byId.values()].map((r) => r.cell.z))].sort((a, b) => b - a);
  for (const room of byId.values()) room.level = decks.indexOf(room.cell.z);

  const cells = [...byId.values()].filter((r) => !r.blister).map((r) => r.cell);
  const span = (k) => [Math.min(...cells.map((c) => c[k])), Math.max(...cells.map((c) => c[k]))];
  const [x0, x1] = span("x");
  const [y0, y1] = span("y");
  const [z0, z1] = span("z");
  return { byId, decks, hull: cells.length ? { x0, x1, y0, y1, z0, z1 } : null };
}

/** The player's place: a room on the station and the plan it's on, or "off". Never throws. */
export function locateDecks(index, msg) {
  try {
    const room = typeof msg?.roomId === "string" ? index.byId.get(msg.roomId) : undefined;
    if (room) return { kind: "room", id: room.id, level: room.level, x: room.cell.x, y: room.cell.y };
    return { kind: "off", name: typeof msg?.name === "string" ? msg.name : "" };
  } catch {
    return { kind: "off", name: "" };
  }
}

/** The model face key for the player's place: the room's id, or null off the station. */
export function decksKey(where) {
  return where?.kind === "room" ? where.id : null;
}

/** The deck the model is cut away above for the player's place (their own), or null for none. */
export function decksCut(index, where) {
  if (where?.kind !== "room") return null;
  const z = index.byId.get(where.id)?.cell.z;
  return Number.isFinite(z) ? z : null;
}

// --- the model -------------------------------------------------------------------------------

/** Model units per cell: across (side), along (frame) and up (deck). */
export const CELL = { side: 64, frame: 96, deck: 52 };

// A unit cube's six faces, each its outward normal and its corners as signs, wound outward.
const CUBE = [
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], c: [[-1, 1, -1], [1, 1, -1], [1, -1, -1], [-1, -1, -1]] },
  { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [1, 0, 0], c: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { n: [-1, 0, 0], c: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]] },
];
// the blister's profile from the hull down: [radius, depth] as fractions of its radius
const DOME = [[0.66, 0], [0.66, 0.2], [1, 0.34], [0.96, 0.66], [0.76, 0.94], [0.42, 1.1]];
const DOME_SIDES = 12;

/**
 * The hull, a box of cells whose faces are tinted by the room behind them, cut away above the
 * player's deck (`deck`, `outline` and `lid`, see ModelView.draw); each room's cell as a ghost
 * box (`ghost`: drawn only when lit); the blisters in glass outside the hull, and the cradles fore
 * of the nose. Nothing turns.
 * @param {ReturnType<typeof indexDecks>} index
 * @param {typeof DECKS.orrin} spec
 */
export function buildDecksModel(index, spec) {
  const faces = [];
  const { hull } = index;
  if (!hull) return faces;
  const add = (pts, kind, key, extra) =>
    faces.push({
      pts,
      kind,
      key,
      tint: key ? (spec.tints[key] ?? null) : null,
      edges: pts.map(() => true),
      turns: false,
      cull: true,
      layer: 0,
      ...extra,
    });

  const mid = [(hull.x0 + hull.x1) / 2, (hull.y0 + hull.y1) / 2, (hull.z0 + hull.z1) / 2];
  // a cell (side, frame, deck) to model space
  const at = (x, y, z) => [(x - mid[0]) * CELL.side, (z - mid[2]) * CELL.deck, (y - mid[1]) * CELL.frame];
  const half = [CELL.side / 2, CELL.deck / 2, CELL.frame / 2];
  const corner = (c, s) => c.map((v, k) => v + s[k] * half[k]);

  const inHull = (x, y, z) =>
    x >= hull.x0 && x <= hull.x1 && y >= hull.y0 && y <= hull.y1 && z >= hull.z0 && z <= hull.z1;
  const roomAt = new Map();
  for (const r of index.byId.values()) if (!r.blister) roomAt.set(`${r.cell.x}:${r.cell.y}:${r.cell.z}`, r);
  // model axis k (X, Y, Z) -> the cell's step along it (side, deck, frame)
  const step = (cell, k, s) => {
    const [x, y, z] = cell;
    return k === 0 ? [x + s, y, z] : k === 1 ? [x, y, z + s] : [x, y + s, z];
  };

  // the hull: a facet for every cell face on the box's outside, tinted by the room behind it and
  // edged only where the box is, so a deck above the cut is an outline; and each deck's top, the
  // lid it shows when the decks above it are cut away
  for (let x = hull.x0; x <= hull.x1; x++) {
    for (let y = hull.y0; y <= hull.y1; y++) {
      for (let z = hull.z0; z <= hull.z1; z++) {
        const c = at(x, y, z);
        const room = roomAt.get(`${x}:${y}:${z}`);
        for (const { n, c: signs } of CUBE) {
          const k = n.findIndex((v) => v !== 0);
          const outside = !inHull(...step([x, y, z], k, n[k]));
          if (!outside && n[1] !== 1) continue;
          const edges = signs.map((a, i) => {
            const b = signs[(i + 1) % 4];
            const e = [0, 1, 2].find((j) => j !== k && a[j] === b[j]);
            return !inHull(...step([x, y, z], e, a[e]));
          });
          faces.push({
            pts: signs.map((s) => corner(c, s)),
            kind: "outer",
            key: null,
            tint: room ? (spec.tints[room.id] ?? null) : null,
            edges,
            turns: false,
            cull: true,
            layer: 0,
            ...(outside ? { deck: z, outline: true } : { lid: z }),
          });
        }
      }
    }
  }

  // each room's cell, for the highlight
  for (const room of roomAt.values()) {
    const c = at(room.cell.x, room.cell.y, room.cell.z);
    for (const { c: signs } of CUBE) add(signs.map((s) => corner(c, s)), "cell", room.id, { ghost: true, tint: null });
  }

  // blisters: a glass dome hanging off the hull face nearest them, under it or on top
  const bottom = at(0, 0, hull.z0)[1] - half[1];
  const top = at(0, 0, hull.z1)[1] + half[1];
  for (const room of index.byId.values()) {
    if (!room.blister) continue;
    const [cx, , cz] = at(room.cell.x, room.cell.y, room.cell.z);
    const down = room.cell.z < hull.z0 ? -1 : 1;
    const y0 = down < 0 ? bottom : top;
    const R = 0.42 * Math.min(CELL.side, CELL.frame);
    const ring = ([r, d]) =>
      Array.from({ length: DOME_SIDES }, (_, i) => {
        const a = ((i + 0.5) / DOME_SIDES) * 2 * Math.PI;
        return [cx + r * R * Math.sin(a), y0 + down * d * R, cz + r * R * Math.cos(a)];
      });
    const rings = DOME.map(ring);
    for (let j = 0; j + 1 < rings.length; j++) {
      const [p, q] = [rings[j], rings[j + 1]];
      for (let i = 0; i < DOME_SIDES; i++) {
        const i1 = (i + 1) % DOME_SIDES;
        const axis = [cx, (p[i][1] + q[i][1]) / 2, cz];
        add(outward([p[i], p[i1], q[i1], q[i]], axis), "blister", room.id, { layer: -1 });
      }
    }
    // capped at both ends: the top shows once the decks over it are cut away
    const last = rings[rings.length - 1];
    add(outward(last, [cx, last[0][1] - down, cz]), "blister-cap", room.id, { layer: -1 });
    add(outward(rings[0], [cx, y0 + down, cz]), "blister-cap", room.id, { layer: -1 });
  }

  // cradles fore of the nose: compartments, never lit
  const fore = at(0, hull.y1, 0)[2] + half[2];
  for (const [x, z, hx, hy, len] of spec.cradles ?? []) {
    const [cx, cy] = at(x, 0, z);
    const c = [cx, cy, fore + (len * CELL.frame) / 2];
    const h = [hx * CELL.side, hy * CELL.deck, (len * CELL.frame) / 2];
    for (const { c: signs } of CUBE) {
      add(signs.map((s) => c.map((v, k) => v + s[k] * h[k])), "dock", null, { layer: 1, deck: z });
    }
  }

  return faces;
}

/** pts wound so their normal points away from `from`. */
function outward(pts, from) {
  const [a, b, c] = pts;
  const u = b.map((v, i) => v - a[i]);
  const w = c.map((v, i) => v - a[i]);
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const mid = pts.reduce((s, p) => s.map((v, i) => v + p[i] / pts.length), [0, 0, 0]);
  const d = n.reduce((s, v, i) => s + v * (mid[i] - from[i]), 0);
  return d >= 0 ? pts : pts.slice().reverse();
}

// --- the deck plans --------------------------------------------------------------------------

/** Plan units per cell, fore up and starboard right; a room box is inset in its cell. */
export const PLAN = { w: 140, h: 100, inset: 14, band: 18, blister: 40, pad: 12 };

const ACROSS = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] }; // plan direction

/**
 * One deck's plan: every room on it in its cell, the passages between them, and the hatches up and
 * down. A named room is a room box; a passage a band through its cell, running on through every
 * side it opens to; a blister a round glass room. `footprint` is the hull's outline, the same on
 * every deck so the frames line up; `onHull` says whether this deck is inside it.
 * @param {ReturnType<typeof indexDecks>} index
 * @param {number} deck
 */
export function decksLayout(index, deck) {
  const { hull } = index;
  const mid = hull ? [(hull.x0 + hull.x1) / 2, (hull.y0 + hull.y1) / 2] : [0, 0];
  const centre = ({ x, y }) => [(x - mid[0]) * PLAN.w, -(y - mid[1]) * PLAN.h];
  const rooms = [...index.byId.values()].filter((r) => r.cell.z === deck);
  const here = (id) => rooms.find((r) => r.id === id);

  const cells = rooms.map((room) => {
    const [cx, cy] = centre(room.cell);
    if (room.blister) return { room, kind: "blister", cx, cy, r: PLAN.blister };
    if (!room.passage) {
      return { room, kind: "room", cx, cy, w: PLAN.w - 2 * PLAN.inset, h: PLAN.h - 2 * PLAN.inset };
    }
    // a band through the cell: to the cell's edge on every side it opens to, else to where the
    // rooms beside it end
    const open = (dir) => !!here(room.exits?.[dir]);
    const reach = (dir, full) => (open(dir) ? full / 2 : Math.max(PLAN.band, full / 2 - PLAN.inset));
    const across = (open("east") || open("west")) && !open("north") && !open("south");
    if (across) {
      const l = reach("west", PLAN.w);
      const r = reach("east", PLAN.w);
      return { room, kind: "passage", cx: cx + (r - l) / 2, cy, w: l + r, h: 2 * PLAN.band };
    }
    const t = reach("north", PLAN.h);
    const b = reach("south", PLAN.h);
    return { room, kind: "passage", cx, cy: cy + (b - t) / 2, w: 2 * PLAN.band, h: t + b };
  });
  const cellOf = (id) => cells.find((c) => c.room.id === id);

  // passages joining a room to the next cell, once a pair, where the shapes don't already meet
  const links = [];
  const reachOf = (c, horizontal) => (c.kind === "blister" ? c.r : (horizontal ? c.w : c.h) / 2);
  for (const a of cells) {
    for (const [dir, [dx, dy]] of Object.entries(ACROSS)) {
      const b = cellOf(a.room.exits?.[dir]);
      if (!b || a.room.id > b.room.id) continue;
      const [ax, ay] = centre(a.room.cell);
      if (dx) {
        const from = a.cx + dx * reachOf(a, true);
        const to = b.cx - dx * reachOf(b, true);
        if ((to - from) * dx > 0.5) links.push({ x: Math.min(from, to), y: ay - 8, w: Math.abs(to - from), h: 16 });
      } else {
        const from = a.cy + dy * reachOf(a, false);
        const to = b.cy - dy * reachOf(b, false);
        if ((to - from) * dy > 0.5) links.push({ x: ax - 8, y: Math.min(from, to), w: 16, h: Math.abs(to - from) });
      }
    }
  }

  // hatches up and down: at a passage's centre, in a room box's corner, over a blister's name;
  // `side` is where its "up" or "down" goes
  const hatches = [];
  for (const c of cells) {
    for (const dir of ["up", "down"]) {
      if (!c.room.exits?.[dir]) continue;
      const [x, y] = centre(c.room.cell);
      if (c.kind === "passage") hatches.push({ dir, cx: x, cy: y, side: "below" });
      else if (c.kind === "blister") hatches.push({ dir, cx: x, cy: y - c.r / 2 + 2, side: "right" });
      else hatches.push({ dir, cx: x + c.w / 2 - 14, cy: y - c.h / 2 + 14, side: "below" });
    }
  }

  // blisters on the next deck down or up, whose outline this deck shows over them
  const nearby = [...index.byId.values()]
    .filter((r) => r.blister && Math.abs(r.cell.z - deck) === 1)
    .map((room) => ({ room, cx: centre(room.cell)[0], cy: centre(room.cell)[1], r: PLAN.blister, below: room.cell.z < deck }));

  const footprint = hull && {
    x: (hull.x0 - mid[0] - 0.5) * PLAN.w - PLAN.pad,
    y: -(hull.y1 - mid[1] + 0.5) * PLAN.h - PLAN.pad,
    w: (hull.x1 - hull.x0 + 1) * PLAN.w + 2 * PLAN.pad,
    h: (hull.y1 - hull.y0 + 1) * PLAN.h + 2 * PLAN.pad,
  };
  const frames = hull ? Array.from({ length: hull.y1 - hull.y0 + 1 }, (_, i) => ({ n: hull.y1 - i, cy: centre({ x: 0, y: hull.y1 - i })[1] })) : [];
  const onHull = !!hull && deck >= hull.z0 && deck <= hull.z1;
  return { deck, cells, links, hatches, nearby, footprint, frames, onHull, centre };
}

/** The glowing shape for the player's place on a deck's plan, or null. */
export function decksShape(layout, where) {
  if (!layout || where?.kind !== "room") return null;
  const c = layout.cells.find((x) => x.room.id === where.id);
  if (!c) return null;
  if (c.kind === "blister") return { kind: "circle", cx: c.cx, cy: c.cy, r: c.r };
  return { kind: "rect", x: c.cx - c.w / 2, y: c.cy - c.h / 2, width: c.w, height: c.h, rx: c.kind === "room" ? 5 : 3 };
}
