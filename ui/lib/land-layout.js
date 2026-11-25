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

import { frontSite } from "./land-choose.js";
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

/** The styles the board draws (gmcp.md §9.5.3), the first that fits winning: a climb over a road,
 *  since what a way costs you matters more than what it follows; a road over a game trail. */
const STYLES = ["climb", "road", "trail"];

/** An exit's style, if it's one the board draws; else null (a plain way). */
const drawnStyle = (e) => (STYLES.includes(e?.style) ? e.style : null);

/** The styles of all p's exits to q (a place can have two ways to one neighbour). */
const exitStyles = (p, q) => ORDER.filter((d) => p.exits?.[d]?.to === q.id).map((d) => drawnStyle(p.exits[d]));

/** Whether any of p's exits came with a style: a place saved since the game sends them. */
const styled = (p) => ORDER.some((d) => p.exits?.[d]?.style);

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

/** How the way between p and q goes, and the name of its track: as any exit either way between
 *  them says, the first of STYLES that fits. Where nothing's said and neither place has a styled
 *  exit at all (both saved before the game sent styles), a track if the names put both on one; a
 *  place the game sent since says none for a way that isn't a road, so its names don't count. A
 *  road is named from its places' names: the track they share, else the one only one of them is on. */
function styleBetween(p, q) {
  const said = [...exitStyles(p, q), ...exitStyles(q, p)];
  const style = STYLES.find((s) => said.includes(s)) ?? null;
  const named = trackBetween(p, q);
  if (style === "road") {
    const tp = trackOf(p.name), tq = trackOf(q.name);
    return { style, track: named ?? (tp && !tq ? tp : tq && !tp ? tq : null) };
  }
  if (style) return { style, track: null };
  return named && !styled(p) && !styled(q) ? { style: "road", track: named } : { style: null, track: null };
}

/**
 * One way per unordered pair of walked places with an exit between them. A plain way is one smooth
 * curve from the face its exit names to the face of the exit back, square to both, so you can see
 * which side it leaves by and nothing has a corner. A one-way way curves from its face into the
 * other place's middle, with a chevron halfway along what shows of it. A track runs straight from
 * middle to middle. `style` is how it goes (climb, road, trail or null; a road is a track, its
 * name in `track` if the places' names give one). `path` is what's drawn; `there` and `back` are the line a route takes along it
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
    const { style, track } = styleBetween(a, b);
    const way = { a: a.id, b: b.id, style, track, oneWay };
    if (style === "road") {
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
 * A place's x on the side of its world's seam nearest `ref`, the place you stand in (else the first walked):
 * the game's x comes round at the place's `wrap` (gmcp.md §9.5), so across the seam, opposite where
 * the land's measured from, it jumps by the wrap. A world with no port is measured from 0° E, so its
 * seam is at 180°, where a site can stand (the Lighter on Carrow, at 178.8° W).
 */
function unwrapped(p, ref) {
  if (!p.wrap) return p.x;
  return p.x - Math.round((p.x - ref.x) / p.wrap) * p.wrap;
}

/**
 * @param {object[]} places  the walked places, in first-walked order (LandStore.places())
 * @param {{town: {e: number, n: number}[], joins: Record<string, object>}} world  the land's entry in ui/data/land.js
 * @param {{spread?: number, near?: string, rooms?: object[]}} [opts]  how much further apart to draw
 *   places than they are (SPREAD); the place you stand in, whose side of the world's seam the others
 *   are drawn on; and the sites' rooms walked (LandStore.rooms()), drawn by their fronts
 */
export function layoutLand(places, world, { spread = SPREAD, near, rooms = [] } = {}) {
  const ref = places.find((q) => q.id === near) ?? places[0];
  const spots = new Map(places.map((p) => [p.id, { x: +(unwrapped(p, ref) * spread).toFixed(4), y: +(p.y * spread).toFixed(4) }]));
  const walked = new Set(places.map((p) => p.id));
  const ways = layoutWays(places, spots);

  const stubs = [];
  for (const p of places) {
    for (const dir of ORDER) {
      const e = p.exits?.[dir];
      if (!e || walked.has(e.to)) continue;
      if (e.area && !e.area.startsWith("surface.")) continue; // into Zennor: its road, never a stub
      const f = faceMid(spots.get(p.id), dir), g = out(f, dir, STUB);
      stubs.push({ id: p.id, dir, style: drawnStyle(e), x1: f.x, y1: fy(f.y), x2: g.x, y2: fy(g.y) });
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

  return { spots, ways, stubs, zennor: { outline: town.map(flip), roads }, labels, ...layoutRooms(places, spots, rooms) };
}

/** A site's room's square, km across (A of reference/land-sites-options.png). */
export const ROOM = 0.5;
/** How far a door runs out of the front's face, to a room's square; and a step from one room's
 *  middle to the next's, along each axis. */
const DOOR = 0.17;
const STEP = 0.62;
/** The ways deeper into a site that aren't compass points: a room by one sits beside its room. */
const DEEPER = ["u", "d", "in", "out"];
const sign = (v) => (v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0);
/** A step to the next room by compass point: STEP along each axis it names. */
const stepOut = (p, dir) => ({ x: p.x + sign(UNIT[dir][0]) * STEP, y: p.y + sign(UNIT[dir][1]) * STEP });
/** How far a room's middle stays from an octagon's: past its corners and half the square. */
const CLEAR = H / Math.cos(Math.PI / 8) + ROOM / 2;

/**
 * The walked rooms of the sites whose fronts are drawn (set-pieces.md §3), each a small square: one
 * through a front's door just outside the face it leaves by, one through a room's compass door a STEP
 * on from that room, and one by up, down, in or out beside the room it's reached from, in the first
 * free spot clockwise from straight out from the front. `rooms` are north-up middles by id; `doors`
 * the short lines between them, ready for the SVG: one per pair walked (`walked`), a short walked
 * door out of a front's face into a room placed elsewhere (or with no free spot), and a bar out of
 * the face for a compass door into a room not yet entered (`to` null), so you can see there's a way
 * in, never where to.
 */
function layoutRooms(places, spots, rooms) {
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const octs = [...spots.values()];
  const placed = new Map();
  const doors = [];
  const paired = new Set(); // "a\nb", sorted: the doors drawn between two rooms
  const taken = [];
  const free = (c) =>
    taken.every((t) => Math.max(Math.abs(t.x - c.x), Math.abs(t.y - c.y)) > ROOM + 1e-6) &&
    octs.every((s) => Math.hypot(s.x - c.x, s.y - c.y) > CLEAR - 1e-6);
  const put = (id, c) => {
    placed.set(id, c);
    taken.push(c);
  };
  const door = (from, to, a, b, walked, dir) => doors.push({ from, to, dir, walked, x1: a.x, y1: fy(a.y), x2: b.x, y2: fy(b.y) });
  // the edge of a square's middle c toward d (north-up), for a door's end
  const edge = (c, d) => {
    const len = Math.max(Math.abs(d.x), Math.abs(d.y)) || 1;
    return { x: c.x + (d.x / len) * (ROOM / 2), y: c.y + (d.y / len) * (ROOM / 2) };
  };

  const queue = [];
  for (const p of places) {
    if (frontSite(p.id) === null) continue;
    for (const dir of ORDER) {
      const e = p.exits?.[dir];
      if (!e || !e.area?.startsWith("site.")) continue;
      const f = faceMid(spots.get(p.id), dir), at = out(f, dir, DOOR);
      const r = byId.get(e.to);
      if (!r) {
        door(p.id, null, f, at, false, dir); // not gone through
        continue;
      }
      const c = out(f, dir, DOOR + ROOM / 2);
      if (r.front !== p.id || placed.has(r.id) || !free(c)) {
        door(p.id, r.id, f, at, true, dir); // gone through, its room drawn elsewhere or not at all
        continue;
      }
      put(r.id, c);
      door(p.id, r.id, f, at, true, dir);
      queue.push({ r, from: spots.get(p.id) });
    }
  }
  // on through the rooms, nearest the front first
  while (queue.length) {
    const { r, from } = queue.shift();
    const c = placed.get(r.id);
    const outward = { x: c.x - from.x, y: c.y - from.y };
    for (const [dir, e] of Object.entries(r.exits ?? {})) {
      const q = byId.get(e.to);
      const compass = ORDER.includes(dir);
      if (placed.has(e.to)) {
        // a door between two placed rooms, once
        const key = [r.id, e.to].sort().join("\n");
        if (!paired.has(key)) {
          paired.add(key);
          const qc = placed.get(e.to), d = { x: qc.x - c.x, y: qc.y - c.y };
          door(r.id, e.to, edge(c, d), edge(qc, { x: -d.x, y: -d.y }), true, dir);
        }
        continue;
      }
      if (!q) {
        // a compass door into a room not entered: never the way back out onto the land
        if (compass && !spots.has(e.to) && !e.to.startsWith("surface.") && !e.area?.startsWith("surface.")) {
          const a = edge(c, { x: UNIT[dir][0], y: UNIT[dir][1] });
          door(r.id, null, a, out(a, dir, DOOR), false, dir);
        }
        continue;
      }
      let at = null;
      if (compass) at = free(stepOut(c, dir)) ? stepOut(c, dir) : null;
      else if (DEEPER.includes(dir)) {
        // clockwise from straight out from the front
        const start = (Math.round((Math.atan2(outward.x, outward.y) * 4) / Math.PI) + 8) % 8;
        for (let k = 0; k < 8 && !at; k++) {
          const cand = stepOut(c, ORDER[(start + k) % 8]);
          if (free(cand)) at = cand;
        }
      }
      if (!at) continue;
      put(q.id, at);
      paired.add([r.id, q.id].sort().join("\n"));
      const d = { x: at.x - c.x, y: at.y - c.y };
      door(r.id, q.id, edge(c, d), edge(at, { x: -d.x, y: -d.y }), true, dir);
      queue.push({ r: q, from: c });
    }
  }
  return { rooms: placed, doors };
}
