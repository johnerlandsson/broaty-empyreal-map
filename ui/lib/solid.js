// Solids in the model's frame, for the decks builder and the ships' hulls: model units per cell,
// a unit cube's faces, and the plane geometry their faces are cut and wound with. Pure; no DOM.

/** Model units per cell: across (side), along (frame) and up (deck). */
export const CELL = { side: 64, frame: 96, deck: 52 };

// A unit cube's six faces, each its outward normal and its corners as signs, wound outward.
export const CUBE = [
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], c: [[-1, 1, -1], [1, 1, -1], [1, -1, -1], [-1, -1, -1]] },
  { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [1, 0, 0], c: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { n: [-1, 0, 0], c: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]] },
];

/** A wall's upright edge is drawn where the path turns by more than this (radians), so not along an arc. */
export const SHARP = (35 * Math.PI) / 180;

/** How far a path turns at b, coming from a and going on to c, in radians. */
export function turnAt(a, b, c) {
  const t = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]));
  return t > Math.PI ? 2 * Math.PI - t : t;
}

/** Twice a polygon's signed area, in its own plane's x and y: positive for counter-clockwise. */
export function area2(points) {
  return points.reduce((s, [x, y], i) => {
    const [u, v] = points[(i + 1) % points.length];
    return s + x * v - u * y;
  }, 0);
}

export const centre2 = (points) => points.reduce((s, p) => [s[0] + p[0] / points.length, s[1] + p[1] / points.length], [0, 0]);

/** Whether a point is inside a polygon (its edge counts as either). */
export function within(points, [x, y]) {
  let inside = false;
  points.forEach(([ax, ay], i) => {
    const [bx, by] = points[(i + 1) % points.length];
    if (ay > y !== by > y && x < ax + ((y - ay) / (by - ay)) * (bx - ax)) inside = !inside;
  });
  return inside;
}

/** Whether a point lies on one of a closed path's edges. */
export function onPath(path, [x, y]) {
  return path.some(([ax, ay], i) => {
    const [bx, by] = path[(i + 1) % path.length];
    const len = Math.hypot(bx - ax, by - ay);
    const t = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (len * len);
    return Math.abs((x - ax) * (by - ay) - (y - ay) * (bx - ax)) / len < 1e-6 && t > -1e-6 && t < 1 + 1e-6;
  });
}

/** A polygon cut by the line where its axis k is v, keeping the side `keep` (1 above, -1 below). */
export function clip(points, k, v, keep) {
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

/** Newell's normal of a flat polygon: the right way for a concave one too. */
export function newell(pts) {
  const N = [0, 0, 0];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    N[0] += (p[1] - q[1]) * (p[2] + q[2]);
    N[1] += (p[2] - q[2]) * (p[0] + q[0]);
    N[2] += (p[0] - q[0]) * (p[1] + q[1]);
  });
  return N;
}

/**
 * A flat face's points and edges started at its most convex corner, so the renderer's normal (from
 * the first three points) is the face's own on a concave piece too.
 */
export function convexFirst(pts, edges) {
  const n = pts.length;
  const normalAt = (i) => {
    const [a, b, c] = [pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    const u = b.map((v, k) => v - a[k]);
    const w = c.map((v, k) => v - a[k]);
    return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  };
  // the face's normal (Newell's), then the corner turning most its way
  const N = newell(pts);
  let best = 0;
  let most = -Infinity;
  for (let i = 0; i < n; i++) {
    const d = normalAt(i).reduce((s, v, k) => s + v * N[k], 0);
    if (d > most) [best, most] = [i, d];
  }
  const turn = (xs) => xs.slice(best).concat(xs.slice(0, best));
  return { pts: turn(pts), edges: turn(edges) };
}

/**
 * A flat face's points and edges wound so its normal (Newell's) points away from `from`, each edge
 * kept with its side, then started at its most convex corner (convexFirst).
 */
export function facing(pts, edges, from) {
  const n = pts.length;
  const mid = pts.reduce((s, p) => s.map((v, i) => v + p[i] / n), [0, 0, 0]);
  if (newell(pts).reduce((s, v, i) => s + v * (mid[i] - from[i]), 0) >= 0) return convexFirst(pts, edges);
  const back = pts.slice().reverse();
  return convexFirst(back, back.map((_, j) => edges[(2 * n - 2 - j) % n]));
}

/** pts wound so their normal points away from `from`. */
export function outward(pts, from) {
  const [a, b, c] = pts;
  const u = b.map((v, i) => v - a[i]);
  const w = c.map((v, i) => v - a[i]);
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const mid = pts.reduce((s, p) => s.map((v, i) => v + p[i] / pts.length), [0, 0, 0]);
  const d = n.reduce((s, v, i) => s + v * (mid[i] - from[i]), 0);
  return d >= 0 ? pts : pts.slice().reverse();
}

/** A box hull's path, in cells, counter-clockwise: the box round its cells (none without one). */
export function boxPath(hull) {
  if (!hull) return [];
  const [x0, x1, y0, y1] = [hull.x0 - 0.5, hull.x1 + 0.5, hull.y0 - 0.5, hull.y1 + 0.5];
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}
