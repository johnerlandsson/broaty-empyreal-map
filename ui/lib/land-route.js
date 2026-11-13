// Finding your way on the walked land (spec, "Finding your way"): the line a route takes across the
// board, the walked road end back to Zennor fewest steps away, and where the "← Zennor" card sits
// on the view's edge. Pure (no DOM).
//
// Units are km, in the SVG's frame (y flipped), as layoutLand's ways are.

const f = (v) => String(+v.toFixed(4) || 0);
const PT = /-?[\d.]+,-?[\d.]+/g;
const BEND = /(-?[\d.]+,-?[\d.]+) C(-?[\d.]+,-?[\d.]+) (-?[\d.]+,-?[\d.]+) (-?[\d.]+,-?[\d.]+)/;

/**
 * What a way adds between its two octagons' middles, going from a to b: nothing for a doorway or
 * a corner square (the straight line middle to middle crosses it), a line face to face for a longer
 * way, and its own curve for a bend.
 */
function between(way, forward) {
  if (way.kind === "bend") {
    const [, f1, c1, c2, f2] = way.path.match(BEND);
    return forward ? [`L${f1}`, `C${c1} ${c2} ${f2}`] : [`L${f2}`, `C${c2} ${c1} ${f1}`];
  }
  if (way.kind === "long") {
    const [f1, f2] = way.path.match(PT);
    return forward ? [`L${f1}`, `L${f2}`] : [`L${f2}`, `L${f1}`];
  }
  return [];
}

/**
 * The SVG path of a route (place ids, both ends included) through each octagon's middle, following
 * the ways' own paths where they don't run straight between the middles.
 * @param {string[]} ids
 * @param {{cells: Map<string, {x: number, y: number}>, ways: object[]}} layout layoutLand's
 */
export function routePath(ids, layout) {
  if (!ids?.length) return "";
  const ways = new Map(layout.ways.map((w) => [`${w.a}\n${w.b}`, w]));
  const mid = (id) => {
    const c = layout.cells.get(id);
    return `${f(c.x)},${f(-c.y)}`;
  };
  const d = [`M${mid(ids[0])}`];
  for (let i = 1; i < ids.length; i++) {
    const a = ids[i - 1], b = ids[i];
    const there = ways.get(`${a}\n${b}`);
    const back = ways.get(`${b}\n${a}`);
    if (there || back) d.push(...between(there ?? back, !!there));
    d.push(`L${mid(b)}`);
  }
  return d.join(" ");
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
