// Finding your way on the walked land (spec, "Finding your way"): the line a route takes across the
// board, the walked road end back to Zennor fewest steps away, and where the "← Zennor" card sits
// on the view's edge. Pure (no DOM).
//
// Units are km, in the SVG's frame (y flipped), as layoutLand's ways are.

import { num } from "./land-layout.js";

/**
 * The SVG path of a route (place ids, both ends included): from each octagon's middle to the next
 * along the way between them, out of and into the faces its exits name, as the ways run.
 * @param {string[]} ids
 * @param {{spots: Map<string, {x: number, y: number}>, ways: {a: string, b: string, points: {x: number, y: number}[]}[]}} layout layoutLand's
 */
export function routePath(ids, layout) {
  if (!ids?.length) return "";
  const byPair = new Map(layout.ways.map((w) => [`${w.a}\n${w.b}`, w]));
  const c = layout.spots.get(ids[0]);
  const pts = [{ x: c.x, y: -c.y }];
  for (let i = 1; i < ids.length; i++) {
    const there = byPair.get(`${ids[i - 1]}\n${ids[i]}`), back = byPair.get(`${ids[i]}\n${ids[i - 1]}`);
    const q = layout.spots.get(ids[i]);
    pts.push(...(there ? there.points.slice(1) : back ? back.points.slice(0, -1).reverse() : [{ x: q.x, y: -q.y }]));
  }
  return pts.map((p, i) => `${i ? "L" : "M"}${num(p.x)},${num(p.y)}`).join(" ");
}

/** The walked road end (a `.join.` place) fewest steps from fromId, by the ways you know; null if none. */
export function nearestRoadEnd(store, fromId) {
  let best = null;
  for (const p of store.places()) {
    if (!p.id.includes(".join.")) continue;
    const r = store.route(fromId, p.id);
    if (r && (!best || r.length < best.length)) best = { id: p.id, length: r.length };
  }
  return best?.id ?? null;
}

/**
 * Where the "← Zennor" card goes: the point where the line from the view's middle toward Zennor's
 * middle leaves the view, and which edge that is. Null while any of Zennor's block is in view.
 * @param {{x: number, y: number, w: number, h: number}} view the viewBox
 * @param {{x: number, y: number, w: number, h: number}} zennorBox Zennor's block's bounding box, same frame
 * @returns {{x: number, y: number, side: "left"|"right"|"top"|"bottom"}|null}
 */
export function edgeCard(view, zennorBox) {
  const z = zennorBox;
  const apart = z.x > view.x + view.w || z.x + z.w < view.x || z.y > view.y + view.h || z.y + z.h < view.y;
  if (!apart) return null;
  const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
  const dx = z.x + z.w / 2 - cx, dy = z.y + z.h / 2 - cy;
  // how far along (dx, dy) the line reaches each pair of edges; the nearer is where it leaves
  const tx = dx ? view.w / 2 / Math.abs(dx) : Infinity;
  const ty = dy ? view.h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  const side = tx <= ty ? (dx < 0 ? "left" : "right") : dy < 0 ? "top" : "bottom";
  return { x: cx + dx * t, y: cy + dy * t, side };
}
