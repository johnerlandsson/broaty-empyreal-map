// Build-time checks on decks footprints: an outline that crosses itself, and rooms whose drawn
// outlines overlap on a deck. The outlines are ui/lib/footprint.js's, as the map draws them.
import { boundsOf, outlineOf } from "../../ui/lib/footprint.js";

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
