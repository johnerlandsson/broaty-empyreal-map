// Stations laid out on decks (station.md §2.6 in the Empyreal source): a station that doesn't
// spin, every room a cell of one grid, addressed "Deck 3, frame 2, port 1". The address is the
// cell, as the game's coords are: x the side (starboard positive), y the frame (counting fore), z
// the deck (counting up, away from the planet). Everything here is placed from those cells, so a
// new station on decks needs its rooms and a look (lib/look.js), not a hand-made layout. The model
// uses the other stations' frame (X = 3 o'clock, starboard; Y = 12 o'clock, up; Z = fore), so the
// one camera and renderer draw it. Pure; no DOM.

import { boundsOf, CORNER_R, cornered, noseAt, outlineOf, pathOf } from "./footprint.js";

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
 * unnamed cell, named by its address) or a `blister`, its `tint` (the colour the look paints it,
 * or null), its `footprint` (the look's, or null) and its `level`: the plan it's on, the top deck
 * first. `grid` is the box the cells that aren't blisters fill, in whole cells; `hull` the box their
 * outlines fill, in cells (a cell centre at its side and frame, so it's `grid` unless a footprint
 * reaches past its cell); `hullPaths` each deck's hull path from the look, rounded corners expanded
 * (pathOf), where it has one. Rooms without an address the grid knows are left out.
 * @param {{rooms: object[], look?: object}} data a generated decks file
 */
export function indexDecks(data) {
  const byId = new Map();
  const { paint, palette, fixtures, footprints, hull: paths } = data?.look ?? {};
  const blisters = (fixtures ?? []).filter((f) => f.type === "blister").map((f) => `${data.id}.${f.room}`);
  for (const room of data?.rooms ?? []) {
    const cell = parseAddress(room.address);
    if (!cell) continue;
    const passage = String(room.name).toLowerCase() === String(room.address).toLowerCase();
    const local = room.id.slice(data.id.length + 1);
    const tint = palette?.[paint?.[local]] ?? null;
    byId.set(room.id, { ...room, cell, passage, blister: blisters.includes(room.id), tint, footprint: footprints?.[local] ?? null });
  }
  const decks = [...new Set([...byId.values()].map((r) => r.cell.z))].sort((a, b) => b - a);
  for (const room of byId.values()) room.level = decks.indexOf(room.cell.z);

  const solid = [...byId.values()].filter((r) => !r.blister);
  if (!solid.length) return { byId, decks, grid: null, hull: null, hullPaths: {} };
  const span = (k) => [Math.min(...solid.map((r) => r.cell[k])), Math.max(...solid.map((r) => r.cell[k]))];
  const [x0, x1] = span("x");
  const [y0, y1] = span("y");
  const [z0, z1] = span("z");
  // each outline's reach past its cell centre, the half cell a plain one has taken off
  const reach = solid.map((r) => ({ cell: r.cell, b: boundsOf(outlineOf(r.footprint)) }));
  const lo = (k, e) => Math.min(...reach.map(({ cell, b }) => cell[k] + b[e] + 0.5));
  const hi = (k, e) => Math.max(...reach.map(({ cell, b }) => cell[k] + b[e] - 0.5));
  const hull = { x0: lo("x", "x0"), x1: hi("x", "x1"), y0: lo("y", "y0"), y1: hi("y", "y1"), z0, z1 };
  const hullPaths = {};
  for (const [deck, points] of Object.entries(paths ?? {})) {
    if (points && Number(deck) >= z0 && Number(deck) <= z1) hullPaths[deck] = pathOf(points);
  }
  return { byId, decks, grid: { x0, x1, y0, y1, z0, z1 }, hull, hullPaths };
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
 * The hull, cut away above the player's deck (`deck`, `outline` and `lid`, see ModelView.draw):
 * each deck a box of cells whose faces are tinted by the room behind them, or, where the look gives
 * the deck a hull path, that path raised through the deck, tinted the same way. Each room's outline
 * through its deck as a ghost (`ghost`: drawn only when lit), a box for a plain one; the blisters in
 * glass outside the hull, and the cradles fore of the nose. Nothing turns.
 * @param {ReturnType<typeof indexDecks>} index
 * @param {{look?: {fixtures?: object[]}}} data the generated decks file the index was made from
 */
export function buildDecksModel(index, data) {
  const faces = [];
  const { hull, grid } = index;
  if (!hull) return faces;
  const paths = index.hullPaths ?? {};
  const fixtures = (type) => (data.look?.fixtures ?? []).filter((f) => f.type === type);
  const add = (pts, kind, key, extra) =>
    faces.push({
      pts,
      kind,
      key,
      tint: key ? (index.byId.get(key)?.tint ?? null) : null,
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
  // a point on a deck's plane, in cells, to model space: up -1 its floor, 1 its top
  const level = ([x, y], z, up) => {
    const c = at(x, y, z);
    return [c[0], c[1] + up * half[1], c[2]];
  };

  // whether a deck's hull is over (or under) the whole of a piece, in cells: every corner and the
  // middle of every edge on it or inside it, so a piece it only partly covers keeps its own top
  const covers = (z, piece) => {
    if (z < grid.z0 || z > grid.z1) return false;
    const on = paths[z]
      ? (p) => within(paths[z], p) || onPath(paths[z], p)
      : ([x, y]) => x >= hull.x0 - 0.5 - 1e-9 && x <= hull.x1 + 0.5 + 1e-9 && y >= hull.y0 - 0.5 - 1e-9 && y <= hull.y1 + 0.5 + 1e-9;
    return piece.every((p, i) => on(p) && on(centre2([p, piece[(i + 1) % piece.length]])));
  };
  // a cell's square as the box draws it, its outer cells reaching to the hull
  const square = (x, y) => {
    const x0 = x === grid.x0 ? hull.x0 - 0.5 : x - 0.5;
    const x1 = x === grid.x1 ? hull.x1 + 0.5 : x + 0.5;
    const y0 = y === grid.y0 ? hull.y0 - 0.5 : y - 0.5;
    const y1 = y === grid.y1 ? hull.y1 + 0.5 : y + 0.5;
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  };
  // a cell of the grid is in the hull if it has no path or its deck's path takes all of it
  const inHull = (x, y, z) =>
    x >= grid.x0 && x <= grid.x1 && y >= grid.y0 && y <= grid.y1 && z >= grid.z0 && z <= grid.z1 &&
    (!paths[z] || covers(z, square(x, y)));
  const roomAt = new Map();
  for (const r of index.byId.values()) if (!r.blister) roomAt.set(`${r.cell.x}:${r.cell.y}:${r.cell.z}`, r);
  // model axis k (X, Y, Z) -> the cell's step along it (side, deck, frame)
  const step = (cell, k, s) => {
    const [x, y, z] = cell;
    return k === 0 ? [x + s, y, z] : k === 1 ? [x, y, z + s] : [x, y + s, z];
  };
  // how far the box's outer cells reach past their own, by model axis, toward s: where a room's
  // outline takes the hull past the grid
  const past = (x, y, s) => [
    x === grid.x0 && s[0] < 0 ? grid.x0 - hull.x0 : x === grid.x1 && s[0] > 0 ? hull.x1 - grid.x1 : 0,
    0,
    y === grid.y0 && s[2] < 0 ? grid.y0 - hull.y0 : y === grid.y1 && s[2] > 0 ? hull.y1 - grid.y1 : 0,
  ];
  const unit = [CELL.side, CELL.deck, CELL.frame];

  // a deck without a path: a facet for every cell face on the box's outside, tinted by the room
  // behind it and edged only where the box is, so a deck above the cut is an outline; and each
  // deck's top, the lid it shows when the decks above it are cut away
  for (let x = grid.x0; x <= grid.x1; x++) {
    for (let y = grid.y0; y <= grid.y1; y++) {
      for (let z = grid.z0; z <= grid.z1; z++) {
        if (paths[z]) continue;
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
            pts: signs.map((s) => corner(c, s).map((v, j) => v + s[j] * past(x, y, s)[j] * unit[j])),
            kind: "outer",
            key: null,
            tint: room?.tint ?? null,
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

  // a deck with a path: walls along every edge and its top and bottom, each in a piece a cell so
  // it takes the tint of the room behind it and the painter's sort stays sane on a concave deck
  const xs = Array.from({ length: grid.x1 - grid.x0 }, (_, i) => grid.x0 + i + 0.5);
  const ys = Array.from({ length: grid.y1 - grid.y0 }, (_, i) => grid.y0 + i + 0.5);
  const cellOf = ([x, y]) => [
    Math.min(grid.x1, Math.max(grid.x0, Math.round(x))),
    Math.min(grid.y1, Math.max(grid.y0, Math.round(y))),
  ];
  const tintAt = (p, z) => roomAt.get(`${cellOf(p).join(":")}:${z}`)?.tint ?? null;
  const hullFace = (pts, edges, tint, extra) =>
    faces.push({ ...convexFirst(pts, edges), kind: "outer", key: null, tint, turns: false, cull: true, layer: 0, ...extra });
  for (let z = grid.z0; z <= grid.z1; z++) {
    const path = paths[z];
    if (!path) continue;
    const n = path.length;
    // a wall's upright edge is drawn only at a corner, not along a rounded one's arc
    const sharp = path.map((p, i) => turnAt(path[(i + n - 1) % n], p, path[(i + 1) % n]) > SHARP);
    path.forEach((a, i) => {
      const b = path[(i + 1) % n];
      const cuts = [0, 1];
      for (const [k, lines] of [[0, xs], [1, ys]]) {
        for (const v of lines) {
          const t = (v - a[k]) / (b[k] - a[k]);
          if (t > 1e-6 && t < 1 - 1e-6) cuts.push(t);
        }
      }
      cuts.sort((u, v) => u - v);
      const along = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      for (let j = 0; j + 1 < cuts.length; j++) {
        const [p, q] = [along(cuts[j]), along(cuts[j + 1])];
        const ends = [j + 2 === cuts.length && sharp[(i + 1) % n], j === 0 && sharp[i]];
        // wound outward: the path is counter-clockwise, so out is to its right
        const pts = [level(p, z, 1), level(q, z, 1), level(q, z, -1), level(p, z, -1)];
        hullFace(pts, [true, ends[0], true, ends[1]], tintAt(along((cuts[j] + cuts[j + 1]) / 2), z), { deck: z, outline: true });
      }
    });
    // the top, a lid where the deck above is over all of it, else the roof; the bottom unless a
    // deck is under all of it
    const bx = [-Infinity, ...xs, Infinity];
    const by = [-Infinity, ...ys, Infinity];
    for (let i = 0; i + 1 < bx.length; i++) {
      for (let j = 0; j + 1 < by.length; j++) {
        let piece = path;
        if (bx[i] > -Infinity) piece = clip(piece, 0, bx[i], 1);
        if (bx[i + 1] < Infinity) piece = clip(piece, 0, bx[i + 1], -1);
        if (by[j] > -Infinity) piece = clip(piece, 1, by[j], 1);
        if (by[j + 1] < Infinity) piece = clip(piece, 1, by[j + 1], -1);
        if (piece.length < 3 || Math.abs(area2(piece)) < 1e-9) continue;
        const tint = roomAt.get(`${grid.x0 + i}:${grid.y0 + j}:${z}`)?.tint ?? null;
        const edges = piece.map((p, k) => onPath(path, centre2([p, piece[(k + 1) % piece.length]])));
        // counter-clockwise seen from above is the bottom's winding, outward
        const top = piece.map((p) => level(p, z, 1)).reverse();
        const topEdges = edges.slice(0, -1).reverse().concat(edges.slice(-1));
        hullFace(top, topEdges, tint, covers(z + 1, piece) ? { lid: z } : { deck: z, outline: true });
        if (!covers(z - 1, piece)) hullFace(piece.map((p) => level(p, z, -1)), edges, tint, { deck: z, outline: true });
      }
    }
  }

  // each room's cell, for the highlight: a box, or its outline through the deck
  for (const room of roomAt.values()) {
    const c = at(room.cell.x, room.cell.y, room.cell.z);
    const outline = outlineOf(room.footprint);
    if (isUnit(outline)) {
      for (const { c: signs } of CUBE) add(signs.map((s) => corner(c, s)), "cell", room.id, { ghost: true, tint: null });
      continue;
    }
    const pts = outline.map(([x, y]) => [room.cell.x + x, room.cell.y + y]);
    const z = room.cell.z;
    const ghost = (ps, edges) => add(ps, "cell", room.id, { ghost: true, tint: null, ...(edges ? convexFirst(ps, edges) : {}) });
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      ghost([level(a, z, 1), level(b, z, 1), level(b, z, -1), level(a, z, -1)]);
    });
    ghost(pts.map((p) => level(p, z, 1)).reverse(), pts.map(() => true));
    ghost(pts.map((p) => level(p, z, -1)), pts.map(() => true));
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

  // cradles fore of the nose (on a deck with a path, its nose on the cradle's side): compartments,
  // never lit
  const box = at(0, hull.y1, 0)[2] + half[2];
  for (const { side: x, deck: z, hw: hx, hh: hy, len } of fixtures("cradle")) {
    const nose = paths[z] ? noseAt(paths[z], x) : null;
    if (paths[z] && nose === null) continue; // off its deck's hull; the build won't let this through
    const fore = nose === null ? box : at(0, nose, 0)[2];
    const [cx, cy] = at(x, 0, z);
    const c = [cx, cy, fore + (len * CELL.frame) / 2];
    const h = [hx * CELL.side, hy * CELL.deck, (len * CELL.frame) / 2];
    for (const { c: signs } of CUBE) {
      add(signs.map((s) => c.map((v, k) => v + s[k] * h[k])), "dock", null, { layer: 1, deck: z });
    }
  }

  // masts up off the roof, each a lamp at its top, burning whatever the light; they go with the top
  // deck when it's cut away, as the cradles do
  const roof = at(0, 0, hull.z1)[1] + half[1];
  const cuboid = (c, h, kind, layer) => {
    for (const { c: signs } of CUBE) add(signs.map((s) => c.map((v, k) => v + s[k] * h[k])), kind, null, { layer, deck: hull.z1 });
  };
  for (const { side: x, frame: y, height } of fixtures("mast")) {
    const [cx, , cz] = at(x, y, 0);
    const tall = height * CELL.deck;
    cuboid([cx, roof + tall / 2, cz], [MAST, tall / 2, MAST], "mast", 1);
    cuboid([cx, roof + tall, cz], [LAMP, LAMP, LAMP], "lamp", 2);
  }

  return faces;
}

const MAST = 3.5; // a mast's half-width, in model units
const LAMP = 11; // its lamp's

/** A wall's upright edge is drawn where the path turns by more than this (radians), so not along an arc. */
const SHARP = (35 * Math.PI) / 180;

/** How far a path turns at b, coming from a and going on to c, in radians. */
function turnAt(a, b, c) {
  const t = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]));
  return t > Math.PI ? 2 * Math.PI - t : t;
}

/** Twice a polygon's signed area, in its own plane's x and y: positive for counter-clockwise. */
function area2(points) {
  return points.reduce((s, [x, y], i) => {
    const [u, v] = points[(i + 1) % points.length];
    return s + x * v - u * y;
  }, 0);
}

const centre2 = (points) => points.reduce((s, p) => [s[0] + p[0] / points.length, s[1] + p[1] / points.length], [0, 0]);

/** Whether a point is inside a polygon (its edge counts as either). */
function within(points, [x, y]) {
  let inside = false;
  points.forEach(([ax, ay], i) => {
    const [bx, by] = points[(i + 1) % points.length];
    if (ay > y !== by > y && x < ax + ((y - ay) / (by - ay)) * (bx - ax)) inside = !inside;
  });
  return inside;
}

/** Whether a point lies on one of a closed path's edges. */
function onPath(path, [x, y]) {
  return path.some(([ax, ay], i) => {
    const [bx, by] = path[(i + 1) % path.length];
    const len = Math.hypot(bx - ax, by - ay);
    const t = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (len * len);
    return Math.abs((x - ax) * (by - ay) - (y - ay) * (bx - ax)) / len < 1e-6 && t > -1e-6 && t < 1 + 1e-6;
  });
}

/** A polygon cut by the line where its axis k is v, keeping the side `keep` (1 above, -1 below). */
function clip(points, k, v, keep) {
  const kept = (p) => (p[k] - v) * keep >= -1e-9;
  const out = [];
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    if (kept(p)) out.push(p);
    if (kept(p) !== kept(q)) {
      const t = (v - p[k]) / (q[k] - p[k]);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  });
  return out;
}

/** Whether an outline is the plain unit square, drawn as a box. */
function isUnit(outline) {
  return outline.length === 4 && outline.every(([x, y]) => Math.abs(x) === 0.5 && Math.abs(y) === 0.5);
}

/**
 * A flat face's points and edges started at its most convex corner, so the renderer's normal (from
 * the first three points) is the face's own on a concave piece too.
 */
function convexFirst(pts, edges) {
  const n = pts.length;
  const normalAt = (i) => {
    const [a, b, c] = [pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    const u = b.map((v, k) => v - a[k]);
    const w = c.map((v, k) => v - a[k]);
    return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  };
  // the face's normal (Newell's), then the corner turning most its way
  const N = [0, 0, 0];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % n];
    N[0] += (p[1] - q[1]) * (p[2] + q[2]);
    N[1] += (p[2] - q[2]) * (p[0] + q[0]);
    N[2] += (p[0] - q[0]) * (p[1] + q[1]);
  });
  let best = 0;
  let most = -Infinity;
  for (let i = 0; i < n; i++) {
    const d = normalAt(i).reduce((s, v, k) => s + v * N[k], 0);
    if (d > most) [best, most] = [i, d];
  }
  const turn = (xs) => xs.slice(best).concat(xs.slice(0, best));
  return { pts: turn(pts), edges: turn(edges) };
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
 * down. A named room is a room box, its `points` its outline inset as a box is (a box unless its
 * footprint reshapes it, and then `cx`, `cy`, `w` and `h` are the outline's bounds); a passage a
 * band through its cell, running on through every side it opens to; a blister a round glass room.
 * `footprint` is the box round the hull, the same on every deck so the frames line up; `plate` the
 * deck's hull path, where it has one (else null, and the plate is the footprint); `onHull` says
 * whether this deck is inside the hull. `centre(cell)` is a cell's centre on the plan, and
 * `cellAt(x, y)` its inverse, the [side, frame] (fractional) under a plan point.
 * @param {ReturnType<typeof indexDecks>} index
 * @param {number} deck
 */
export function decksLayout(index, deck) {
  const { hull, grid } = index;
  const mid = hull ? [(hull.x0 + hull.x1) / 2, (hull.y0 + hull.y1) / 2] : [0, 0];
  const centre = ({ x, y }) => [(x - mid[0]) * PLAN.w, -(y - mid[1]) * PLAN.h];
  const toPlan = ([x, y]) => centre({ x, y });
  // + 0 so the centreline is 0, never -0
  const cellAt = (px, py) => [px / PLAN.w + mid[0] + 0, -py / PLAN.h + mid[1] + 0];
  const rooms = [...index.byId.values()].filter((r) => r.cell.z === deck);
  const here = (id) => rooms.find((r) => r.id === id);

  const cells = rooms.map((room) => {
    const [cx, cy] = centre(room.cell);
    if (room.blister) return { room, kind: "blister", cx, cy, r: PLAN.blister };
    if (!room.passage) {
      const fp = room.footprint;
      const outline = outlineOf(fp);
      const points = (fp?.outline ? inset(outline.map(([x, y]) => [x * PLAN.w, y * PLAN.h]), PLAN.inset) : planBox(fp, outline)).map(([x, y]) => [cx + x, cy - y]);
      if (isUnit(outline)) return { room, kind: "room", cx, cy, w: PLAN.w - 2 * PLAN.inset, h: PLAN.h - 2 * PLAN.inset, points };
      const b = boundsOf(points);
      return { room, kind: "room", cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, w: b.x1 - b.x0, h: b.y1 - b.y0, points, shaped: true };
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

  // hatches up and down: at a passage's centre, in a room box's corner (a room with both, as
  // Caradon's Shift Hall, has down in the corner below), over a blister's name; `side` is where its
  // "up" or "down" goes
  const hatches = [];
  for (const c of cells) {
    for (const dir of ["up", "down"]) {
      if (!c.room.exits?.[dir]) continue;
      const [x, y] = centre(c.room.cell);
      if (c.kind === "passage") hatches.push({ dir, cx: x, cy: y, side: "below" });
      else if (c.kind === "blister") hatches.push({ dir, cx: x, cy: y - c.r / 2 + 2, side: "right" });
      else if (dir === "down" && c.room.exits.up) hatches.push({ dir, cx: c.cx + c.w / 2 - 14, cy: c.cy + c.h / 2 - 30, side: "below" });
      else hatches.push({ dir, cx: c.cx + c.w / 2 - 14, cy: c.cy - c.h / 2 + 14, side: "below" });
    }
  }

  // blisters on the next deck down or up, whose outline this deck shows over them
  const nearby = [...index.byId.values()]
    .filter((r) => r.blister && Math.abs(r.cell.z - deck) === 1)
    .map((room) => ({ room, cx: centre(room.cell)[0], cy: centre(room.cell)[1], r: PLAN.blister, below: room.cell.z < deck }));

  // the box round the hull, and round every deck's path where one reaches past it
  let footprint = hull && {
    x: (hull.x0 - mid[0] - 0.5) * PLAN.w - PLAN.pad,
    y: -(hull.y1 - mid[1] + 0.5) * PLAN.h - PLAN.pad,
    w: (hull.x1 - hull.x0 + 1) * PLAN.w + 2 * PLAN.pad,
    h: (hull.y1 - hull.y0 + 1) * PLAN.h + 2 * PLAN.pad,
  };
  const paths = Object.values(index.hullPaths ?? {});
  if (footprint && paths.length) {
    const b = boundsOf(paths.flat().map(toPlan));
    const x0 = Math.min(footprint.x, b.x0);
    const y0 = Math.min(footprint.y, b.y0);
    const x1 = Math.max(footprint.x + footprint.w, b.x1);
    const y1 = Math.max(footprint.y + footprint.h, b.y1);
    footprint = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  const path = index.hullPaths?.[deck];
  const plate = path ? path.map(toPlan) : null;
  const frames = grid ? Array.from({ length: grid.y1 - grid.y0 + 1 }, (_, i) => ({ n: grid.y1 - i, cy: centre({ x: 0, y: grid.y1 - i })[1] })) : [];
  const onHull = !!hull && deck >= hull.z0 && deck <= hull.z1;
  return { deck, cells, links, hatches, nearby, footprint, plate, frames, onHull, centre, cellAt };
}

/** A polygon's outline as an SVG path, to a tenth of a unit. */
export function pathD(points) {
  return `M${points.map((p) => p.map((v) => +v.toFixed(1)).join(",")).join("L")}Z`;
}

/**
 * A span-and-corners footprint's room box on the plan, about its cell's centre, y up: its outline's
 * bounds inset as a box is, its corners that size less the inset (none left, square), so a small r
 * never folds the box over itself.
 */
function planBox(fp, outline) {
  const b = boundsOf(outline);
  const box = { x0: b.x0 * PLAN.w + PLAN.inset, x1: b.x1 * PLAN.w - PLAN.inset, y0: b.y0 * PLAN.h + PLAN.inset, y1: b.y1 * PLAN.h - PLAN.inset };
  const r = fp?.r ?? CORNER_R;
  return cornered(box, fp?.corners, r * PLAN.w - PLAN.inset, r * PLAN.h - PLAN.inset);
}

/**
 * A counter-clockwise polygon moved in by d, each edge along its normal and each corner where its
 * two edges meet; as a room box is inset in its cell, so a box stays a box.
 */
function inset(points, d) {
  const n = points.length;
  const line = (i) => {
    const [a, b] = [points[i], points[(i + 1) % n]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dir = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    return { at: [a[0] - dir[1] * d, a[1] + dir[0] * d], dir }; // in is to the left
  };
  return points.map((_, i) => {
    const p = line((i + n - 1) % n);
    const q = line(i);
    const cross = p.dir[0] * q.dir[1] - p.dir[1] * q.dir[0];
    if (Math.abs(cross) < 1e-9) return q.at;
    const t = ((q.at[0] - p.at[0]) * q.dir[1] - (q.at[1] - p.at[1]) * q.dir[0]) / cross;
    return [p.at[0] + p.dir[0] * t, p.at[1] + p.dir[1] * t];
  });
}

/** The glowing shape for the player's place on a deck's plan, or null: a reshaped room's outline as a path. */
export function decksShape(layout, where) {
  if (!layout || where?.kind !== "room") return null;
  const c = layout.cells.find((x) => x.room.id === where.id);
  if (!c) return null;
  if (c.kind === "blister") return { kind: "circle", cx: c.cx, cy: c.cy, r: c.r };
  if (c.shaped) return { kind: "path", d: pathD(c.points), cx: c.cx, cy: c.cy };
  return { kind: "rect", x: c.cx - c.w / 2, y: c.cy - c.h / 2, width: c.w, height: c.h, rx: c.kind === "room" ? 5 : 3 };
}
