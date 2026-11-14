// The layout of the walked land's map (docs/maps/land.md): each walked place's octagon at its true
// spot, spread 1.3× from Zennor's point (Zennor's block with it), the ways between them (a curve
// square out of each exit's face; a track straight), the dotted stubs of ways not taken, Zennor's
// block and roads, and the names of regions and tracks. Pure (no DOM).
//
// The spread keeps the land's shape, and the game picks an exit's compass point from the true
// bearing, so a way's curve out of the face its exit names hardly has to turn.
//
// Units are km. `spots` and faceMid() are north-up (x east, y north), as the places are; every
// other point in a Layout, and every path, is ready for the SVG: y flipped (svg y = −north). Angles
// are SVG degrees (clockwise from east on screen).

import { regionOf, trackOf } from "./land-kinds.js";

/** An octagon's width, flat to flat, km: places are at least 1.1 km apart, so none touch. */
export const OCT = 0.96;

/** How much further apart the map draws places than they are: the whole land, Zennor's block with
 *  it, spread out from Zennor's point, so close places get room between them and nothing changes shape. */
export const SPREAD = 1.3;

const H = OCT / 2; // the apothem: centre to the middle of a face
const SIDE = OCT / (2 * (1 + Math.SQRT2)); // half a face's length
const STUB = 0.45;
// A way's curve pulls square out of each face by PULL of the gap between the faces, within these (km).
const PULL = 0.42;
const PULL_MIN = 0.12;
const PULL_MAX = 0.75;

const S = Math.SQRT1_2;
const UNIT = { n: [0, 1], ne: [S, S], e: [1, 0], se: [S, -S], s: [0, -1], sw: [-S, -S], w: [-1, 0], nw: [-S, S] };
const ORDER = Object.keys(UNIT);

const fy = (y) => (y === 0 ? 0 : -y);
/** A number for an SVG attribute or path: to 4 decimals, and never "-0". */
export const num = (v) => String(+v.toFixed(4) || 0);
const pt = (p) => `${num(p.x)},${num(fy(p.y))}`;
const flip = (p) => ({ x: p.x, y: fy(p.y) });
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const out = (p, dir, d) => ({ x: p.x + UNIT[dir][0] * d, y: p.y + UNIT[dir][1] * d });
/** The SVG angle of the line from p to q (north-up points). */
const angleOf = (p, q) => (Math.atan2(-(q.y - p.y), q.x - p.x) * 180) / Math.PI;

/** The path of an octagon centred on (x, y), north-up, flat to flat OCT. */
export function octagon(x, y) {
  const c = [[SIDE, H], [H, SIDE], [H, -SIDE], [SIDE, -H], [-SIDE, -H], [-H, -SIDE], [-H, SIDE], [-SIDE, H]];
  return `M${c.map(([dx, dy]) => pt({ x: x + dx, y: y + dy })).join(" L")} Z`;
}

/** The middle of the face toward a compass point of the octagon at spot, north-up. */
export function faceMid(spot, dir) {
  return out(spot, dir, H);
}

/** The first compass point (in DIRS order) by which place p's exits lead to id. */
const exitTo = (p, id) => ORDER.find((d) => p.exits?.[d]?.to === id);

const isEnd = (p) => p.id.includes(".join.");

function trackBetween(p, q) {
  const tp = trackOf(p.name), tq = trackOf(q.name);
  if (tp && tp === tq) return tp;
  if (isEnd(p) && !isEnd(q) && tq) return tq;
  if (isEnd(q) && !isEnd(p) && tp) return tp;
  return null;
}

/** The point at t on the curve from p by the control point c to q, and the SVG angle it runs at there. */
function along(p, c, q, t) {
  const u = 1 - t;
  const at = { x: u * u * p.x + 2 * u * t * c.x + t * t * q.x, y: u * u * p.y + 2 * u * t * c.y + t * t * q.y };
  const on = { x: at.x + u * (c.x - p.x) + t * (q.x - c.x), y: at.y + u * (c.y - p.y) + t * (q.y - c.y) };
  return { at, angle: angleOf(at, on) };
}

/**
 * One way per unordered pair of walked places with an exit between them. A plain way is one smooth
 * curve from the face its exit names to the face of the exit back, square to both, so you can see
 * which side it leaves by and nothing has a corner. A one-way way curves from its face into the
 * other place's middle, with a chevron halfway along what shows of it. A track runs straight from
 * middle to middle. `path` is what's drawn; `there` and `back` are the line a route takes along it
 * from one middle to the other (path commands, to follow an M or another way's).
 */
function layoutWays(places, spots) {
  const byId = new Map(places.map((p) => [p.id, p]));
  const pairs = new Map();
  for (const p of places) {
    for (const d of ORDER) {
      const to = p.exits?.[d]?.to;
      if (!to || to === p.id || !byId.has(to)) continue;
      const key = [p.id, to].sort().join("\n");
      if (!pairs.has(key)) pairs.set(key, [p, byId.get(to)]);
    }
  }
  const ways = [];
  for (const [p, q] of pairs.values()) {
    // a is the earlier, unless only the later has an exit: then a is the place you can leave
    const [a, b] = exitTo(p, q.id) ? [p, q] : [q, p];
    const leave = exitTo(a, b.id), back = exitTo(b, a.id);
    const oneWay = !back;
    const A = spots.get(a.id), B = spots.get(b.id);
    const track = trackBetween(a, b);
    const way = { a: a.id, b: b.id, track, oneWay };
    if (track) {
      way.path = `M${pt(A)} L${pt(B)}`;
      way.there = `L${pt(B)}`;
      way.back = `L${pt(A)}`;
      if (oneWay) way.chevron = { ...flip(mid(A, B)), angle: angleOf(A, B) };
    } else {
      const f1 = faceMid(A, leave), f2 = back ? faceMid(B, back) : B;
      const pull = Math.min(PULL_MAX, Math.max(PULL_MIN, PULL * Math.hypot(f2.x - f1.x, f2.y - f1.y)));
      const c1 = out(f1, leave, pull);
      if (oneWay) {
        way.path = `M${pt(f1)} Q${pt(c1)} ${pt(B)}`;
        way.there = `L${pt(f1)} Q${pt(c1)} ${pt(B)}`;
        way.back = `Q${pt(c1)} ${pt(f1)} L${pt(A)}`;
        // the chevron: halfway to where the curve goes under b's octagon
        let lo = 0, hi = 1;
        for (let k = 0; k < 20; k++) {
          const t = (lo + hi) / 2, { at } = along(f1, c1, B, t);
          if (Math.hypot(at.x - B.x, at.y - B.y) > H) lo = t;
          else hi = t;
        }
        const { at, angle } = along(f1, c1, B, lo / 2);
        way.chevron = { ...flip(at), angle };
      } else {
        const c2 = out(f2, back, pull);
        way.path = `M${pt(f1)} C${pt(c1)} ${pt(c2)} ${pt(f2)}`;
        way.there = `L${pt(f1)} C${pt(c1)} ${pt(c2)} ${pt(f2)} L${pt(B)}`;
        way.back = `L${pt(f2)} C${pt(c2)} ${pt(c1)} ${pt(f1)} L${pt(A)}`;
      }
    }
    ways.push(way);
  }
  return ways;
}

/** The nearest point to p on a closed outline, north-up. */
function nearestOn(outline, p) {
  let best = null;
  for (let k = 0; k < outline.length; k++) {
    const s = outline[k], e = outline[(k + 1) % outline.length];
    const dx = e.x - s.x, dy = e.y - s.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - s.x) * dx + (p.y - s.y) * dy) / len2)) : 0;
    const q = { x: s.x + dx * t, y: s.y + dy * t };
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (!best || d < best.d) best = { ...q, d };
  }
  return best;
}

/**
 * @param {object[]} places  the walked places, in first-walked order (LandStore.places())
 * @param {{town: {e: number, n: number}[], joins: Record<string, object>}} world  the land's entry in ui/data/land.js
 * @param {{spread?: number}} [opts]  how much further apart to draw places than they are (SPREAD)
 */
export function layoutLand(places, world, { spread = SPREAD } = {}) {
  const spots = new Map(places.map((p) => [p.id, { x: +(p.x * spread).toFixed(4), y: +(p.y * spread).toFixed(4) }]));
  const walked = new Set(places.map((p) => p.id));
  const ways = layoutWays(places, spots);

  const stubs = [];
  for (const p of places) {
    for (const dir of ORDER) {
      const e = p.exits?.[dir];
      if (!e || walked.has(e.to)) continue;
      if (e.area && !e.area.startsWith("surface.")) continue; // into Zennor: its road, never a stub
      const f = faceMid(spots.get(p.id), dir), g = out(f, dir, STUB);
      stubs.push({ id: p.id, dir, x1: f.x, y1: fy(f.y), x2: g.x, y2: fy(g.y) });
    }
  }

  const town = (world?.town ?? []).map(({ e, n }) => ({ x: e * spread, y: n * spread }));
  const roads = [];
  for (const p of places) {
    const m = /^surface\.[^.]+\.join\.([^.]+)$/.exec(p.id);
    if (!m || !world?.joins?.[m[1]] || !town.length) continue;
    const dir = ORDER.find((d) => p.exits?.[d]?.area && !p.exits[d].area.startsWith("surface."));
    if (!dir) continue;
    const f = faceMid(spots.get(p.id), dir), q = nearestOn(town, f);
    roads.push({ id: p.id, x1: f.x, y1: fy(f.y), x2: q.x, y2: fy(q.y) });
  }

  const labels = [];
  const regions = new Map();
  for (const p of places) {
    const r = regionOf(p.name);
    if (!r) continue;
    if (!regions.has(r)) regions.set(r, []);
    regions.get(r).push(spots.get(p.id));
  }
  for (const [text, cs] of regions) {
    const xs = cs.map((c) => c.x), ys = cs.map((c) => c.y);
    // upright only when at least twice as tall as wide, so a broad region like the Downs stays level
    const high = Math.max(...ys) - Math.min(...ys), wide = Math.max(...xs) - Math.min(...xs);
    const tall = high > 0 && high >= 2 * wide;
    const at = { x: xs.reduce((s, v) => s + v, 0) / cs.length, y: ys.reduce((s, v) => s + v, 0) / cs.length };
    labels.push({ text, kind: "region", ...flip(at), angle: tall ? -90 : 0 });
  }
  const longest = new Map();
  for (const w of ways) {
    if (!w.track) continue;
    const A = spots.get(w.a), B = spots.get(w.b), len = Math.hypot(B.x - A.x, B.y - A.y);
    if (!longest.has(w.track) || len > longest.get(w.track).len) longest.set(w.track, { A, B, len });
  }
  for (const [text, { A, B }] of longest) {
    let angle = angleOf(A, B);
    if (angle >= 90) angle -= 180;
    else if (angle < -90) angle += 180;
    labels.push({ text, kind: "track", ...flip(mid(A, B)), angle });
  }

  return { spots, ways, stubs, zennor: { outline: town.map(flip), roads }, labels };
}
