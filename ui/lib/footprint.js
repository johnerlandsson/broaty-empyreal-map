// A decks room's footprint: how it's drawn, never where it is. In cells, its own cell from -0.5 to
// 0.5 on each axis: x across (port -, starboard +), y along (aft -, fore +).
// No DOM; safe to load as a browser ES module.

const UNIT = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
/** A corner's radius or chamfer when the footprint gives none, in cells. */
export const CORNER_R = 0.2;
/** Points on each rounded corner's quarter circle, its two ends included: 3 arcs, then the edge to the next. */
const ARC = 4;

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
 * A footprint's outline, counter-clockwise. With none, the unit square. `span` reaches past the
 * cell by cells fore, aft, port and starboard; `corners` (square, rounded or cut) shapes each
 * corner by `r` (at r 0, square); an `outline` replaces both.
 * @param {{span?: Record<string, number>, corners?: string, r?: number, outline?: number[][]}} [fp]
 * @returns {number[][]}
 */
export function outlineOf(fp) {
  if (!fp) return UNIT.map((p) => [...p]);
  if (fp.outline) {
    const points = fp.outline.map((p) => [...p]);
    return area2(points) < 0 ? points.reverse() : points;
  }
  const span = fp.span ?? {};
  const x0 = -0.5 - (span.port ?? 0);
  const x1 = 0.5 + (span.starboard ?? 0);
  const y0 = -0.5 - (span.aft ?? 0);
  const y1 = 0.5 + (span.fore ?? 0);
  return cornered({ x0, x1, y0, y1 }, fp.corners, fp.r ?? CORNER_R);
}

/**
 * A box's outline, counter-clockwise, its corners square, rounded or cut: each reaching rx along
 * the edges across and ry along those up and down (a rounded one a quarter ellipse). A corner whose
 * rx or ry is 0 or less is square; no point is there twice.
 * @param {{x0: number, x1: number, y0: number, y1: number}} bounds
 * @param {string} [corners]  square, rounded or cut
 * @param {number} [rx]
 * @param {number} [ry]
 * @returns {number[][]}
 */
export function cornered({ x0, x1, y0, y1 }, corners, rx = 0, ry = rx) {
  const box = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  if (!corners || corners === "square" || !(rx > 0 && ry > 0)) return box;
  const out = [];
  box.forEach(([x, y], i) => {
    // From the corner's size along the edge coming in to it along the edge going out; a rounded
    // corner's quarter ellipse, centred that far in from both, between them.
    const toward = ([u, v]) => [Math.sign(u - x) * rx, Math.sign(v - y) * ry];
    const [ix, iy] = toward(box[(i + 3) % 4]);
    const [ox, oy] = toward(box[(i + 1) % 4]);
    out.push([x + ix, y + iy]);
    if (corners === "rounded") {
      const [cx, cy] = [x + ix + ox, y + iy + oy];
      const start = (Math.PI / 2) * (i + 2);
      for (let k = 1; k < ARC - 1; k++) {
        const a = start + (Math.PI / 2) * (k / (ARC - 1));
        out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
      }
    }
    out.push([x + ox, y + oy]);
  });
  const same = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= 1e-9;
  return out.filter((p, i) => !same(p, out[(i + out.length - 1) % out.length]));
}

/**
 * @param {number[][]} points
 * @returns {{x0: number, x1: number, y0: number, y1: number}}
 */
export function boundsOf(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/**
 * A hull path's rounded corner i: how far along each edge from the point its arc starts (`reach`),
 * and the arc, centred on the bisector. Null where the point has no r or no corner to round.
 */
function fillet(path, i) {
  const n = path.length;
  const [x, y, r] = path[i];
  if (!r) return null;
  const unit = ([u, v]) => {
    const m = Math.hypot(u - x, v - y);
    return [(u - x) / m, (v - y) / m];
  };
  const a = unit(path[(i + n - 1) % n]);
  const b = unit(path[(i + 1) % n]);
  const half = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) / 2;
  if (!(half > 1e-9 && half < Math.PI / 2 - 1e-9)) return null; // straight on, or doubling back
  const reach = r / Math.tan(half);
  const h = r / Math.sin(half);
  const m = Math.hypot(a[0] + b[0], a[1] + b[1]);
  const [cx, cy] = [x + ((a[0] + b[0]) / m) * h, y + ((a[1] + b[1]) / m) * h];
  const start = Math.atan2(y + a[1] * reach - cy, x + a[0] * reach - cx);
  let turn = Math.atan2(y + b[1] * reach - cy, x + b[0] * reach - cx) - start;
  if (turn > Math.PI) turn -= 2 * Math.PI;
  if (turn < -Math.PI) turn += 2 * Math.PI;
  return { reach, r, cx, cy, start, turn };
}

/**
 * How far along each edge a hull path's rounded corners reach from their points, in cells; 0 at a
 * sharp one. Two on the same edge must fit in it.
 * @param {number[][]} points  [x, y] or [x, y, r]
 * @returns {number[]}
 */
export function reachesOf(points) {
  return points.map((_, i) => fillet(points, i)?.reach ?? 0);
}

/**
 * A hull path, closed and counter-clockwise, with each rounded corner (a point `[x, y, r]`)
 * expanded to the arc of radius r tangent to both its edges: 4 points, 3 arcs, as for a room's
 * rounded corner. Points with no r are kept as they are. Where two arcs meet, or an arc ends on the
 * next point, that point is there once.
 * @param {number[][]} points  [x, y] or [x, y, r], in cells
 * @returns {number[][]}
 */
export function pathOf(points) {
  const path = area2(points) < 0 ? [...points].reverse() : points;
  const out = [];
  path.forEach(([x, y], i) => {
    const arc = fillet(path, i);
    if (!arc) return out.push([x, y]);
    const { r, cx, cy, start, turn } = arc;
    for (let k = 0; k < ARC; k++) {
      const angle = start + (turn * k) / (ARC - 1);
      out.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
  });
  const same = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= 1e-9;
  return out.filter((p, i) => !same(p, out[(i + out.length - 1) % out.length]));
}

/**
 * The nose of a hull path on the line at side x, where a cradle on that side sits: the path's
 * largest frame on that line, or null where the path doesn't reach x.
 * @param {number[][]} path
 * @param {number} x
 * @returns {number | null}
 */
export function noseAt(path, x) {
  let nose = null;
  path.forEach((a, i) => {
    const b = path[(i + 1) % path.length];
    if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) return; // a vertical edge's ends are its neighbours'
    const y = a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    if (nose === null || y > nose) nose = y;
  });
  return nose;
}

/**
 * The tail of a hull path on the line at side x, where a drive bell on that side sits: the path's
 * smallest frame on that line, or null where the path doesn't reach x.
 * @param {number[][]} path
 * @param {number} x
 * @returns {number | null}
 */
export function tailAt(path, x) {
  let tail = null;
  path.forEach((a, i) => {
    const b = path[(i + 1) % path.length];
    if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) return;
    const y = a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    if (tail === null || y < tail) tail = y;
  });
  return tail;
}

/**
 * A hull path's side on the line at frame y, toward `dir` (1 starboard, -1 port): its outermost
 * side that way, where a ring on a room's wall that way meets it; null where the path doesn't
 * reach y.
 * @param {number[][]} path
 * @param {number} y
 * @param {number} dir
 * @returns {number | null}
 */
export function sideAt(path, y, dir) {
  let best = null;
  path.forEach((a, i) => {
    const b = path[(i + 1) % path.length];
    if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) return;
    const x = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
    if (best === null || (x - best) * dir > 0) best = x;
  });
  return best;
}

/**
 * Where a ring on a room's wall meets a hull path: [side, frame] on the path, out from the room's
 * cell (x, y) toward `wall` (port, starboard, fore or aft); null where the path doesn't reach.
 * @param {number[][]} path
 * @param {{x: number, y: number}} cell
 * @param {string} wall
 * @returns {number[] | null}
 */
export function wallAt(path, { x, y }, wall) {
  if (wall === "port" || wall === "starboard") {
    const side = sideAt(path, y, wall === "port" ? -1 : 1);
    return side === null ? null : [side, y];
  }
  const frame = wall === "fore" ? noseAt(path, x) : tailAt(path, x);
  return frame === null ? null : [x, frame];
}

/**
 * A prop's pieces, each a box [x0, y0, x1, y1] in cells: one, or its grid of them, centred on its
 * room's cell plus `at`.
 * @param {{at: number[], size: number[], grid?: number[], gap?: number}} prop
 * @param {{side: number, frame: number}} at  its room's cell
 */
export function propBoxes(prop, { side, frame }) {
  const [w, h] = prop.size;
  const [nx, ny] = prop.grid ?? [1, 1];
  const gap = prop.gap ?? 0;
  const boxes = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const x = side + prop.at[0] + (i - (nx - 1) / 2) * (w + gap);
      const y = frame + prop.at[1] - (j - (ny - 1) / 2) * (h + gap);
      boxes.push([x - w / 2, y - h / 2, x + w / 2, y + h / 2]);
    }
  }
  return boxes;
}
