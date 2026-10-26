// A starting hull path for a deck, traced round its rooms' footprint boxes, for the editor to
// offer where a deck has only its box. No DOM, no Node; the editor page loads it.

import { boundsOf, outlineOf } from "../../ui/lib/footprint.js";

/** How far the traced hull lies outside the footprints, in cells. */
const OFFSET = 0.12;
/** Grid squares to a cell the footprints are traced on: a 0.05 grid. */
const STEPS = 20;
/** Slack for a bound on a grid line but for floating point, in grid squares. */
const SLACK = 1e-6;

/** A coordinate to a millionth of a cell, so a path written to a file reads -1.62, not -1.6199999999999999. */
const tidy = (v) => Math.round(v * 1e6) / 1e6 || 0;

/** Twice the signed area: positive for counter-clockwise. */
function area2(points) {
  let sum = 0;
  points.forEach(([x, y], i) => {
    const [u, v] = points[(i + 1) % points.length];
    sum += x * v - u * y;
  });
  return sum;
}

/**
 * The loops round a set of grid squares, each counter-clockwise with the squares on its left, as
 * lattice points: (i, j) is the low corner of square (i, j).
 * Where two squares touch only at a corner, the loop turns left there, keeping them apart.
 */
function loops(cells) {
  const has = (x, y) => cells.has(`${x},${y}`);
  const out = new Map(); // lattice point -> the boundary edges leaving it, as their far ends
  const edge = (a, b) => {
    const key = `${a[0]},${a[1]}`;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(b);
  };
  for (const key of cells) {
    const [x, y] = key.split(",").map(Number);
    if (!has(x, y - 1)) edge([x, y], [x + 1, y]);
    if (!has(x + 1, y)) edge([x + 1, y], [x + 1, y + 1]);
    if (!has(x, y + 1)) edge([x + 1, y + 1], [x, y + 1]);
    if (!has(x - 1, y)) edge([x, y + 1], [x, y]);
  }
  const found = [];
  for (const [startKey, ends] of out) {
    while (ends.length) {
      const loop = [startKey.split(",").map(Number)];
      let next = ends.pop();
      while (`${next[0]},${next[1]}` !== startKey) {
        const [px, py] = loop[loop.length - 1];
        const leaving = out.get(`${next[0]},${next[1]}`);
        // the leftmost turn: the cross product of the way in and the way out, largest first
        const turn = (b) => (next[0] - px) * (b[1] - next[1]) - (next[1] - py) * (b[0] - next[0]);
        leaving.sort((a, b) => turn(a) - turn(b));
        loop.push(next);
        next = leaving.pop();
      }
      found.push(loop);
    }
  }
  return found;
}

/** A loop with its points that lie on a straight run dropped, so only its corners are left. */
function corners(loop) {
  return loop.filter((p, i) => {
    const a = loop[(i + loop.length - 1) % loop.length];
    const b = loop[(i + 1) % loop.length];
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
  });
}

/**
 * The grid squares, "i,j" on the 0.05 grid, that a deck's rooms' footprint boxes cover (its
 * blisters left out): each room's cell reached by its footprint's span, or a custom outline's
 * bounds, rounded out to the grid.
 */
function cellsOf(index, deck, footprints) {
  const cells = new Set();
  for (const [id, room] of index.byId) {
    if (room.cell.z !== Number(deck) || room.blister) continue;
    const { x0, x1, y0, y1 } = boundsOf(outlineOf(footprints[id.slice(id.indexOf(".") + 1)]));
    const lo = (v, c) => Math.floor((v + c) * STEPS + SLACK);
    const hi = (v, c) => Math.ceil((v + c) * STEPS - SLACK);
    for (let i = lo(x0, room.cell.x); i < hi(x1, room.cell.x); i++) {
      for (let j = lo(y0, room.cell.y); j < hi(y1, room.cell.y); j++) cells.add(`${i},${j}`);
    }
  }
  return cells;
}

/**
 * How many pieces a deck's rooms make (footprints touching only at a corner are apart);
 * hullFromRooms goes round the largest.
 * @param {{byId: Map<string, object>}} index  indexDecks's
 * @param {number | string} deck
 * @param {Record<string, object>} [footprints]  the place's resolved footprints, by room id without the place
 */
export function roomPieces(index, deck, footprints = {}) {
  return loops(cellsOf(index, deck, footprints)).filter((loop) => area2(loop) > 0).length;
}

/**
 * The outline of the union of a deck's room footprint boxes (its blisters left out; they sit
 * outside the hull), as a counter-clockwise path of corner points only, OFFSET outside them: a
 * hull path to start from. Where the rooms make more than one piece, the largest's. Empty for a
 * deck with no rooms.
 * @param {{byId: Map<string, object>}} index  indexDecks's
 * @param {number | string} deck
 * @param {Record<string, object>} [footprints]  the place's resolved footprints (its own and
 *   through `like`), by room id without the place
 * @returns {number[][]}
 */
export function hullFromRooms(index, deck, footprints = {}) {
  const cells = cellsOf(index, deck, footprints);
  if (!cells.size) return [];
  const loop = corners(loops(cells).sort((a, b) => area2(b) - area2(a))[0]).map(([i, j]) => [i / STEPS, j / STEPS]);
  // each corner moves out along both its edges' outward normals; on a grid they're square to each other
  return loop.map(([x, y], k) => {
    const [ax, ay] = loop[(k + loop.length - 1) % loop.length];
    const [bx, by] = loop[(k + 1) % loop.length];
    const normal = (dx, dy) => [Math.sign(dy), -Math.sign(dx)];
    const [n1x, n1y] = normal(x - ax, y - ay);
    const [n2x, n2y] = normal(bx - x, by - y);
    return [tidy(x + OFFSET * (n1x + n2x)), tidy(y + OFFSET * (n1y + n2y))];
  });
}
