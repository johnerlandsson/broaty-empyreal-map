// Where a dragged hull point lands. Each axis on its own goes to the nearest within reach of: another
// point's x or y (the path's own others, then those of the decks shown, each named for the tie
// drawn to it); else a cell's edge or the traced hull's margin off one (hull.js's 0.12); else
// the 0.05 grid. Held free (Alt), it goes to 0.01, as before snapping. No DOM, no Node.

/** How far the traced hull lies outside a cell's edge, in cells: hull.js's OFFSET. */
export const MARGIN = 0.12;

/** The grid a point falls to where nothing nearer takes it, in cells. */
export const STEP = 0.05;

/** v to the nearest step, tidied so 0.9 is 0.9, never 0.9000000000000001, and never -0. */
export const toStep = (v, step) => Number((Math.round(v / step) * step).toFixed(6)) || 0;

/** The edge lines and margins near v: each cell edge (a cell centre ± 0.5) and the margin either side of it. */
function edgesNear(v) {
  const out = [];
  for (let n = Math.floor(v) - 1; n <= Math.ceil(v) + 1; n++) {
    const edge = n + 0.5;
    out.push(edge, edge - MARGIN, edge + MARGIN);
  }
  return out.map((e) => toStep(e, 1e-6));
}

/**
 * A hull point dragged to `at`, snapped.
 * @param {number[]} at [x, y] in cells, as dragged
 * @param {{points?: {at: number[], label: string}[], reach: number[], free?: boolean}} opts `points`
 *   to align with, nearest first where two are as near; `reach` how far a snap reaches on each axis,
 *   in cells (a few pixels on the screen)
 * @returns {{at: number[], ties: {axis: 0 | 1, to: number[], label: string}[]}} where it lands, and
 *   each point it lines up with
 */
export function snapPoint(at, { points = [], reach, free = false }) {
  if (free) return { at: at.map((v) => toStep(v, 0.01)), ties: [] };
  const out = [];
  const ties = [];
  for (const axis of [0, 1]) {
    const v = at[axis];
    let best = null;
    for (const p of points) {
      const d = Math.abs(p.at[axis] - v);
      if (d <= reach[axis] && (!best || d < best.d)) best = { d, p };
    }
    if (best) {
      out[axis] = best.p.at[axis];
      ties.push({ axis, to: best.p.at, label: best.p.label });
      continue;
    }
    const edge = edgesNear(v).reduce((a, e) => (Math.abs(e - v) < Math.abs(a - v) ? e : a));
    out[axis] = Math.abs(edge - v) <= reach[axis] ? edge : toStep(v, STEP);
  }
  return { at: out, ties };
}
