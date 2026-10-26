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
