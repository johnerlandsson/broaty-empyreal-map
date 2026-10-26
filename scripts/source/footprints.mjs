// Build-time checks on decks footprints: an outline that crosses itself, rooms whose drawn
// outlines overlap on a deck, and hull paths that cut a room or leave a fixture outside. The
// outlines and paths are ui/lib/footprint.js's, as the map draws them.
import { boundsOf, noseAt, outlineOf, pathOf } from "../../ui/lib/footprint.js";

/** An overlap smaller than this, in square cells, is a shared edge, not an overlap. */
const EPS = 1e-6;

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

function area(points) {
  let sum = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    sum += p[0] * q[1] - q[0] * p[1];
  });
  return sum / 2;
}

/** Whether segments ab and cd meet, ends and all. */
function meet(a, b, c, d) {
  const [d1, d2, d3, d4] = [cross(c, d, a), cross(c, d, b), cross(a, b, c), cross(a, b, d)];
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (p, q, r) => Math.min(p[0], q[0]) <= r[0] && r[0] <= Math.max(p[0], q[0]) && Math.min(p[1], q[1]) <= r[1] && r[1] <= Math.max(p[1], q[1]);
  return (d1 === 0 && on(c, d, a)) || (d2 === 0 && on(c, d, b)) || (d3 === 0 && on(a, b, c)) || (d4 === 0 && on(a, b, d));
}

/**
 * Whether an outline crosses or touches itself: any two edges that aren't neighbours meet.
 * @param {number[][]} points
 */
export function crosses(points) {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // the closing edge's neighbour
      if (meet(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** A simple counter-clockwise polygon as triangles, by clipping ears. Collinear points go. */
function triangles(points) {
  const pts = [...points];
  const out = [];
  while (pts.length > 3) {
    const n = pts.length;
    let cut = false;
    for (let i = 0; i < n && !cut; i++) {
      const [a, b, c] = [pts[(i + n - 1) % n], pts[i], pts[(i + 1) % n]];
      const turn = cross(a, b, c);
      if (Math.abs(turn) < 1e-12) {
        pts.splice(i, 1);
        cut = true;
      } else if (turn > 0 && !pts.some((p) => p !== a && p !== b && p !== c && cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0)) {
        out.push([a, b, c]);
        pts.splice(i, 1);
        cut = true;
      }
    }
    if (!cut) throw new Error("footprint outline isn't a simple polygon");
  }
  if (pts.length === 3 && Math.abs(area(pts)) > 0) out.push(pts);
  return out;
}

/** The part of a polygon inside a counter-clockwise convex one (Sutherland-Hodgman). */
function clip(subject, convex) {
  let out = subject;
  convex.forEach((a, i) => {
    const b = convex[(i + 1) % convex.length];
    const input = out;
    out = [];
    input.forEach((p, j) => {
      const q = input[(j + 1) % input.length];
      const [sp, sq] = [cross(a, b, p), cross(a, b, q)];
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    });
  });
  return out;
}

/** The area two simple counter-clockwise polygons share. */
function shared(a, b) {
  return triangles(b).reduce((sum, t) => sum + (a.length ? Math.abs(area(clip(a, t))) : 0), 0);
}

/**
 * Pairs of rooms on the same deck whose outlines, each placed on its cell, overlap in area.
 * Touching edges don't count.
 * @param {{id: string, cell: {x: number, y: number, z: number}, fp?: object}[]} rooms
 * @returns {[string, string][]}
 */
export function overlaps(rooms) {
  const placed = rooms.map(({ id, cell, fp }) => {
    const points = outlineOf(fp).map(([x, y]) => [x + cell.x, y + cell.y]);
    return { id, z: cell.z, points, box: boundsOf(points) };
  });
  const pairs = [];
  placed.forEach((a, i) => {
    for (const b of placed.slice(i + 1)) {
      if (a.z !== b.z) continue;
      if (a.box.x1 <= b.box.x0 || b.box.x1 <= a.box.x0 || a.box.y1 <= b.box.y0 || b.box.y1 <= a.box.y0) continue;
      if (shared(a.points, b.points) > EPS) pairs.push([a.id, b.id]);
    }
  });
  return pairs;
}

/**
 * Whether an outline lies wholly inside a path: no more than a sliver of its area outside. Both
 * simple and counter-clockwise.
 * @param {number[][]} points
 * @param {number[][]} path
 */
function inside(points, path) {
  return Math.abs(area(points)) - shared(points, path) <= EPS;
}

/** How far inside its outline a room must be in its deck's hull, in cells: the drawn room box. */
const INSET = 0.1;

const isConvex = (points) => points.every((p, i) => cross(points[(i + points.length - 1) % points.length], p, points[(i + 1) % points.length]) >= -1e-12);

/**
 * A counter-clockwise outline brought in by d: each edge moved d inward where the outline is
 * convex; a concave one scaled about its centroid by 1 - 2d / its narrower side.
 */
function inset(points, d) {
  const n = points.length;
  if (!isConvex(points)) {
    const { x0, x1, y0, y1 } = boundsOf(points);
    const k = 1 - (2 * d) / Math.min(x1 - x0, y1 - y0);
    const [cx, cy] = points.reduce(([sx, sy], [x, y]) => [sx + x / n, sy + y / n], [0, 0]);
    return points.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
  }
  // left of each edge is inward; a corner moves to where its two edges' moved lines meet
  const normal = (a, b) => {
    const m = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [-(b[1] - a[1]) / m, (b[0] - a[0]) / m];
  };
  return points.map((p, i) => {
    const [ax, ay] = normal(points[(i + n - 1) % n], p);
    const [bx, by] = normal(p, points[(i + 1) % n]);
    const det = ax * by - ay * bx;
    if (Math.abs(det) < 1e-12) return [p[0] + ax * d, p[1] + ay * d];
    return [p[0] + (d * by - ay * d) / det, p[1] + (ax * d - d * bx) / det];
  });
}

/** Whether a point is inside a path (even-odd), its edges counting as inside. */
function contains(path, [x, y]) {
  let odd = false;
  for (let i = 0; i < path.length; i++) {
    const [a, b] = [path[i], path[(i + 1) % path.length]];
    if (cross(a, b, [x, y]) === 0 && meet(a, b, [x, y], [x, y])) return true;
    if ((a[1] > y) !== (b[1] > y) && x < a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0])) odd = !odd;
  }
  return odd;
}

/**
 * The first thing a deck's hull path leaves out, or null: a room on that deck whose outline,
 * brought in 0.1 to the drawn room box, isn't inside it; a cradle on it whose side misses the path;
 * a mast whose point isn't inside the top deck's path. Decks with no path keep their box.
 * @param {{id: string, at?: {deck: number, frame: number, side: number}}[]} rooms
 * @param {{hull: Record<string, number[][]>, footprints: Record<string, object>, fixtures: object[]}} look
 * @returns {{deck: string, room: string} | {deck: string, fixture: number, type: string} | null}
 */
export function hullClash(rooms, look) {
  const local = (id) => id.slice(id.indexOf(".") + 1);
  const decks = rooms.filter((r) => r.at).map((r) => r.at.deck);
  const top = decks.length ? String(Math.max(...decks)) : null;
  for (const [deck, points] of Object.entries(look.hull)) {
    const path = pathOf(points);
    for (const r of rooms.filter((room) => String(room.at?.deck) === deck)) {
      const outline = inset(outlineOf(look.footprints[local(r.id)]), INSET).map(([x, y]) => [x + r.at.side, y + r.at.frame]);
      if (!inside(outline, path)) return { deck, room: r.id };
    }
    for (const [i, f] of look.fixtures.entries()) {
      const out =
        (f.type === "cradle" && String(f.deck) === deck && noseAt(path, f.side) === null) ||
        (f.type === "mast" && deck === top && !contains(path, [f.side, f.frame]));
      if (out) return { deck, fixture: i, type: f.type };
    }
  }
  return null;
}
