// A decks room's footprint: how it's drawn, never where it is. In cells, its own cell from -0.5 to
// 0.5 on each axis: x across (port -, starboard +), y along (aft -, fore +).
// No DOM; safe to load as a browser ES module.

const UNIT = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
/** A corner's radius or chamfer when the footprint gives none, in cells. */
const R = 0.2;
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
 * corner by `r`; an `outline` replaces both.
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
  const box = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  if (!fp.corners || fp.corners === "square") return box;

  const r = fp.r ?? R;
  const out = [];
  box.forEach(([x, y], i) => {
    // From r along the edge coming in to r along the edge going out; a rounded corner's quarter
    // circle, centred r in from both, between them.
    const toward = ([u, v]) => [Math.sign(u - x) * r, Math.sign(v - y) * r];
    const [ix, iy] = toward(box[(i + 3) % 4]);
    const [ox, oy] = toward(box[(i + 1) % 4]);
    out.push([x + ix, y + iy]);
    if (fp.corners === "rounded") {
      const [cx, cy] = [x + ix + ox, y + iy + oy];
      const start = (Math.PI / 2) * (i + 2);
      for (let k = 1; k < ARC - 1; k++) {
        const a = start + (Math.PI / 2) * (k / (ARC - 1));
        out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }
    out.push([x + ox, y + oy]);
  });
  return out;
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
