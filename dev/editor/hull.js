// A starting hull path for a deck, traced round its rooms' cells, for the editor to offer where a
// deck has only its box. No DOM, no Node; the editor page loads it.

/** How far the traced hull lies outside the cells, in cells. */
const OFFSET = 0.12;

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
 * lattice points: (i, j) is the corner at (i - 0.5, j - 0.5), the low corner of square (i, j).
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
 * The outline of the union of a deck's room cells (its blisters left out; they sit outside the
 * hull), as a counter-clockwise path of corner points only, OFFSET outside the cells: a hull path
 * to start from. Where the rooms make more than one piece, the largest's. Empty for a deck with no
 * rooms.
 * @param {{byId: Map<string, object>}} index  indexDecks's
 * @param {number | string} deck
 * @returns {number[][]}
 */
export function hullFromRooms(index, deck) {
  const cells = new Set();
  for (const room of index.byId.values()) {
    if (room.cell.z === Number(deck) && !room.blister) cells.add(`${room.cell.x},${room.cell.y}`);
  }
  if (!cells.size) return [];
  const loop = corners(loops(cells).sort((a, b) => area2(b) - area2(a))[0]).map(([i, j]) => [i - 0.5, j - 0.5]);
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
