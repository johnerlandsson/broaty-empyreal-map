// The layout of the walked land's board (spec, "Drawing the board"): each walked place's octagon
// on a 1.2 km tiling centred on Zennor's point, the ways between them, the dotted stubs of ways not
// taken, Zennor's block and roads, and the names of regions and tracks. Pure (no DOM).
//
// Units are km. `cells` and faceMid() are north-up (x east, y north), as the places are; every
// other point in a Layout, and every path, is ready for the SVG: y flipped (svg y = −north). Angles
// are SVG degrees (clockwise from east on screen).

import { regionOf, trackOf } from "./land-kinds.js";

export const CELL = 1.2;

const H = CELL / 2; // the apothem: centre to the middle of a face
const SIDE = CELL / (2 * (1 + Math.SQRT2)); // half a face's length
const SQ = H - SIDE; // centre to corner of the small square where four octagons meet
const BAR = 0.12; // half a doorway's length
const PULL = 0.85 * H; // a bend's control points, out from their faces
const STUB = 0.45;

const S = Math.SQRT1_2;
const UNIT = { n: [0, 1], ne: [S, S], e: [1, 0], se: [S, -S], s: [0, -1], sw: [-S, -S], w: [-1, 0], nw: [-S, S] };
const ORDER = Object.keys(UNIT);
const OPP = { n: "s", ne: "sw", e: "w", se: "nw", s: "n", sw: "ne", w: "e", nw: "se" };
const BY_STEP = { "0,1": "n", "1,1": "ne", "1,0": "e", "1,-1": "se", "0,-1": "s", "-1,-1": "sw", "-1,0": "w", "-1,1": "nw" };

const fy = (y) => (y === 0 ? 0 : -y);
const num = (v) => String(+v.toFixed(4) || 0);
const pt = (p) => `${num(p.x)},${num(fy(p.y))}`;
const flip = (p) => ({ x: p.x, y: fy(p.y) });
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const out = (p, dir, d) => ({ x: p.x + UNIT[dir][0] * d, y: p.y + UNIT[dir][1] * d });
const toward = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
/** The SVG angle of the line from p to q (north-up points). */
const angleOf = (p, q) => (Math.atan2(-(q.y - p.y), q.x - p.x) * 180) / Math.PI;

/** The path of a cell's octagon centred on (x, y), north-up, flat to flat CELL. */
export function octagon(x, y) {
  const c = [[SIDE, H], [H, SIDE], [H, -SIDE], [SIDE, -H], [-SIDE, -H], [-H, -SIDE], [-H, SIDE], [-SIDE, H]];
  return `M${c.map(([dx, dy]) => pt({ x: x + dx, y: y + dy })).join(" L")} Z`;
}

/** The middle of a cell's face toward a compass point, north-up. */
export function faceMid(cell, dir) {
  return out(cell, dir, H);
}

/** Each place's cell, in walk order: the one its true spot rounds to, else the nearest free one. */
function placeCells(places) {
  const cells = new Map();
  const taken = new Set();
  const take = (id, i, j) => {
    taken.add(`${i},${j}`);
    cells.set(id, { i, j, x: i * CELL, y: j * CELL });
  };
  for (const p of places) {
    const i0 = Math.round(p.x / CELL), j0 = Math.round(p.y / CELL);
    if (!taken.has(`${i0},${j0}`)) {
      take(p.id, i0, j0);
      continue;
    }
    // Search ring by ring; a ring farther out can still hold a nearer cell, so go on to twice the
    // first ring with a free cell before choosing.
    let best = null;
    let last = Infinity;
    for (let r = 1; r <= last; r++) {
      for (let i = i0 - r; i <= i0 + r; i++) {
        for (let j = j0 - r; j <= j0 + r; j++) {
          if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r || taken.has(`${i},${j}`)) continue;
          const d = Math.hypot(i * CELL - p.x, j * CELL - p.y);
          const better = !best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && (i < best.i || (i === best.i && j > best.j)));
          if (better) best = { i, j, d };
        }
      }
      if (best && last === Infinity) last = 2 * r + 1;
    }
    take(p.id, best.i, best.j);
  }
  return cells;
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

function cubic(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return { x: k[0] * p0.x + k[1] * p1.x + k[2] * p2.x + k[3] * p3.x, y: k[0] * p0.y + k[1] * p1.y + k[2] * p2.y + k[3] * p3.y };
}

/** One way per unordered pair of walked places with an exit between them. */
function layoutWays(places, cells) {
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
    const leave = exitTo(a, b.id);
    const back = exitTo(b, a.id);
    const oneWay = !back;
    const arrive = back ?? OPP[leave];
    const A = cells.get(a.id), B = cells.get(b.id);
    const di = B.i - A.i, dj = B.j - A.j;
    const track = trackBetween(a, b);
    const near = Math.max(Math.abs(di), Math.abs(dj)) === 1;
    const step = BY_STEP[`${di},${dj}`];
    const agree = near && leave === step && (!back || back === OPP[step]);
    let kind, path, centre;
    if (agree) {
      kind = Math.abs(di) === 1 && Math.abs(dj) === 1 ? "diagonal" : "door";
      centre = mid(A, B);
      if (track) path = `M${pt(A)} L${pt(B)}`;
      else {
        // a doorway bar across the shared face, or a line across the corner square
        const half = kind === "door" ? BAR : SQ;
        const len = Math.hypot(B.x - A.x, B.y - A.y);
        const u = { x: (B.x - A.x) / len, y: (B.y - A.y) / len };
        path = `M${pt({ x: centre.x - u.x * half, y: centre.y - u.y * half })} L${pt({ x: centre.x + u.x * half, y: centre.y + u.y * half })}`;
      }
    } else {
      const f1 = faceMid(A, leave), f2 = faceMid(B, arrive);
      if (near) {
        kind = "bend";
        const c1 = out(f1, leave, PULL), c2 = out(f2, arrive, PULL);
        const curve = `C${pt(c1)} ${pt(c2)} ${pt(f2)}`;
        // a track runs middle to middle; a plain way is the curve, then a spur a quarter of the way
        // into each octagon
        path = track
          ? `M${pt(A)} L${pt(f1)} ${curve} L${pt(B)}`
          : `M${pt(f1)} ${curve} M${pt(f1)} L${pt(toward(f1, A, 0.25))} M${pt(f2)} L${pt(toward(f2, B, 0.25))}`;
        centre = cubic(f1, c1, c2, f2, 0.5);
      } else {
        kind = "long";
        path = `M${pt(f1)} L${pt(f2)}`;
        centre = mid(f1, f2);
      }
    }
    const way = { a: a.id, b: b.id, kind, track, oneWay, path };
    if (oneWay) way.chevron = { ...flip(centre), angle: angleOf(A, B) };
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
 */
export function layoutLand(places, world) {
  const cells = placeCells(places);
  const walked = new Set(places.map((p) => p.id));
  const ways = layoutWays(places, cells);

  const corners = [];
  const seen = new Set();
  for (const w of ways) {
    if (w.kind !== "diagonal") continue;
    const c = flip(mid(cells.get(w.a), cells.get(w.b)));
    const key = `${num(c.x)},${num(c.y)}`;
    if (!seen.has(key)) {
      seen.add(key);
      corners.push(c);
    }
  }

  const stubs = [];
  for (const p of places) {
    for (const dir of ORDER) {
      const e = p.exits?.[dir];
      if (!e || walked.has(e.to)) continue;
      if (e.area && !e.area.startsWith("surface.")) continue; // into Zennor: its road, never a stub
      const f = faceMid(cells.get(p.id), dir), g = out(f, dir, STUB);
      stubs.push({ id: p.id, dir, x1: f.x, y1: fy(f.y), x2: g.x, y2: fy(g.y) });
    }
  }

  const town = (world?.town ?? []).map(({ e, n }) => ({ x: e, y: n }));
  const roads = [];
  for (const p of places) {
    const m = /^surface\.[^.]+\.join\.([^.]+)$/.exec(p.id);
    if (!m || !world?.joins?.[m[1]] || !town.length) continue;
    const dir = ORDER.find((d) => p.exits?.[d]?.area && !p.exits[d].area.startsWith("surface."));
    if (!dir) continue;
    const f = faceMid(cells.get(p.id), dir), q = nearestOn(town, f);
    roads.push({ id: p.id, x1: f.x, y1: fy(f.y), x2: q.x, y2: fy(q.y) });
  }

  const labels = [];
  const regions = new Map();
  for (const p of places) {
    const r = regionOf(p.name);
    if (!r) continue;
    if (!regions.has(r)) regions.set(r, []);
    regions.get(r).push(cells.get(p.id));
  }
  for (const [text, cs] of regions) {
    const xs = cs.map((c) => c.x), ys = cs.map((c) => c.y);
    const tall = Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs);
    const at = { x: xs.reduce((s, v) => s + v, 0) / cs.length, y: ys.reduce((s, v) => s + v, 0) / cs.length };
    labels.push({ text, kind: "region", ...flip(at), angle: tall ? -90 : 0 });
  }
  const longest = new Map();
  for (const w of ways) {
    if (!w.track) continue;
    const A = cells.get(w.a), B = cells.get(w.b), len = Math.hypot(B.x - A.x, B.y - A.y);
    if (!longest.has(w.track) || len > longest.get(w.track).len) longest.set(w.track, { A, B, len });
  }
  for (const [text, { A, B }] of longest) {
    let angle = angleOf(A, B);
    if (angle > 90) angle -= 180;
    else if (angle < -90) angle += 180;
    labels.push({ text, kind: "track", ...flip(mid(A, B)), angle });
  }

  return { cells, ways, corners, stubs, zennor: { outline: town.map(flip), roads }, labels };
}
