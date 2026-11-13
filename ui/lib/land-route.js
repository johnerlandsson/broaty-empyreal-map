// Finding your way on the walked land (spec, "Finding your way"): the line a route takes across the
// board, the walked road end back to Zennor fewest steps away, and where the "← Zennor" card sits
// on the view's edge. Pure (no DOM).
//
// Units are km, in the SVG's frame (y flipped), as layoutLand's ways are.

import { num } from "./land-layout.js";

/**
 * The SVG path of a route (place ids, both ends included): from each octagon's middle to the next
 * along the way between them, as the ways run.
 * @param {string[]} ids
 * @param {{spots: Map<string, {x: number, y: number}>, ways: {a: string, b: string, there: string, back: string}[]}} layout layoutLand's
 */
export function routePath(ids, layout) {
  if (!ids?.length) return "";
  const byPair = new Map(layout.ways.map((w) => [`${w.a}\n${w.b}`, w]));
  const at = (id) => {
    const c = layout.spots.get(id);
    return `${num(c.x)},${num(-c.y)}`;
  };
  const steps = [`M${at(ids[0])}`];
  for (let i = 1; i < ids.length; i++) {
    const there = byPair.get(`${ids[i - 1]}\n${ids[i]}`), back = byPair.get(`${ids[i]}\n${ids[i - 1]}`);
    steps.push(there ? there.there : back ? back.back : `L${at(ids[i])}`);
  }
  return steps.join(" ");
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
