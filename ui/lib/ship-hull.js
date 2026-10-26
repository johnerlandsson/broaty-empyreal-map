// A ship's hull and what stands on it, in the decks model (John's pick C, from
// docs/maps/reference/ship-hull-looks-mockup.html): each deck's hull path lofted through the deck,
// its edges bevelled and its nose dropped (`profile`), seamed, striped, windowed and lit
// (`surface`), a spine and greebles on the roof, glass over each room with a canopy; and the ship
// fixtures outside it, drive bells, the laser boom and the collar's ring. Everything is in layer 0
// and cut into pieces of a quarter cell at most, so the painter's sort by depth lets the hull hide
// what's behind it. A deck with no path is its box. Pure; no DOM.

import { boundsOf, noseAt, outlineOf, tailAt, wallAt } from "./footprint.js";
import { CELL, clip, CUBE, onPath, SHARP, turnAt, within } from "./solid.js";

/** The finest the hull is cut, in cells: every wall, roof and floor piece is this long at most. */
export const TILE = 0.25;
/** The collar ring's bands: the chevrons' yellow. */
export const CHEVRON = "#e8b04a";
/** Nav lights: red to port, green to starboard (white astern is a plain lamp). */
export const NAV = { port: "#ff3b30", starboard: "#2fe06a" };

const VENT_TOP = "#0d1218";
const WINDOW_EVERY = 0.18; // cells of wall a window pane takes, with its gap
const SIDES = 14; // a bell's or dish's sides
const RING_SIDES = 12;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mean = (pts) => pts.reduce((s, p) => s.map((v, i) => v + p[i] / pts.length), pts[0].map(() => 0));
/** smoothstep on 0 to 1, clamped */
const smooth = (t) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};
/** A cell boundary: k + 0.5. */
const onSeam = (v) => Math.abs(v - Math.round(v - 0.5) - 0.5) < 1e-6;

/** Newell's normal of a polygon. */
function newell(P) {
  const N = [0, 0, 0];
  P.forEach((p, i) => {
    const q = P[(i + 1) % P.length];
    N[0] += (p[1] - q[1]) * (p[2] + q[2]);
    N[1] += (p[2] - q[2]) * (p[0] + q[0]);
    N[2] += (p[0] - q[0]) * (p[1] + q[1]);
  });
  return N;
}

/**
 * A flat face wound away from `from`, its edges kept with their sides, and started at the corner
 * whose three points give its true normal (the renderer takes the normal from the first three).
 */
function oriented(pts, edges, from, extra) {
  let P = pts;
  let E = edges;
  const n = P.length;
  if (dot(newell(P), mean(P).map((v, i) => v - from[i])) < 0) {
    P = P.slice().reverse();
    E = P.map((_, j) => edges[(n - 2 - j + 2 * n) % n]);
  }
  const N = newell(P);
  let best = 0;
  let most = -Infinity;
  for (let i = 0; i < n; i++) {
    const [a, b, c] = [P[i], P[(i + 1) % n], P[(i + 2) % n]];
    const u = b.map((v, k) => v - a[k]);
    const w = c.map((v, k) => v - a[k]);
    const d = dot([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], N);
    if (d > most) [best, most] = [i, d];
  }
  const turn = (xs) => xs.slice(best).concat(xs.slice(0, best));
  return { pts: turn(P), edges: turn(E), kind: "outer", key: null, tint: null, turns: false, cull: true, layer: 0, ...extra };
}

/** pts wound so their normal points away from `from` (three points give it). */
function away(pts, from) {
  const [a, b, c] = pts;
  const u = b.map((v, i) => v - a[i]);
  const w = c.map((v, i) => v - a[i]);
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  return dot(n, mean(pts).map((v, i) => v - from[i])) >= 0 ? pts : pts.slice().reverse();
}

/** A counter-clockwise path moved in by d cells, each corner along its bisector (its mitre kept to 3d). */
function insetPath(pts, d) {
  const n = pts.length;
  const normal = (a, b) => {
    const m = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / m, (b[0] - a[0]) / m];
  };
  return pts.map((p, i) => {
    const n1 = normal(pts[(i + n - 1) % n], p);
    const n2 = normal(p, pts[(i + 1) % n]);
    const k = d / Math.max(0.2, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
    const v = [(n1[0] + n2[0]) * k, (n1[1] + n2[1]) * k];
    const m = Math.hypot(...v);
    const s = m > 3 * d ? (3 * d) / m : 1;
    return [p[0] + v[0] * s, p[1] + v[1] * s];
  });
}

const polyArea = (P) => P.reduce((s, [x, y], i) => s + x * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * y, 0) / 2;

/**
 * A solid lofted from a counter-clockwise path in cells, in model space by M(x, y, h): its walls
 * between rings (a bottom bevel, the bands, a top bevel), each path edge cut at the cell boundaries
 * and every TILE; and its top and bottom cut into TILE squares.
 * @param {(x: number, y: number, h: number) => number[]} M
 * @param {number[][]} path
 * @param {object} o  `bot(x, y)` and `top(x, y)` in model units; `bevelTop` and `bevelBottom` in
 *   cells (also their height); `bands`, fractions up the wall between the bevels; `band(i)` the
 *   extra for the wall over band boundary i (0 the lowest piece); `tint(x, y)`; `seams`; `skip(x, y)`
 *   for top tiles under something; `cuts` {x, y} extra tile lines; `kind`; `bottomCap` (default
 *   true); `baseEdge` (default true); `extra` for every face; `capExtra(piece, up)`, a cap tile's
 *   extra, or null to leave it out
 */
function loft(M, path, o) {
  const faces = [];
  const [bt, bb] = [o.bevelTop ?? 0, o.bevelBottom ?? 0];
  const innerTop = bt ? insetPath(path, bt) : path;
  const innerBottom = bb ? insetPath(path, bb) : path;
  const lo = (x, y) => o.bot(x, y) + bb * CELL.side;
  const hi = (x, y) => o.top(x, y) - bt * CELL.side;
  const rings = [];
  if (bb) rings.push({ P: innerBottom, h: o.bot });
  rings.push({ P: path, h: lo });
  for (const f of o.bands ?? []) rings.push({ P: path, h: (x, y) => lo(x, y) + (hi(x, y) - lo(x, y)) * f });
  rings.push({ P: path, h: hi });
  if (bt) rings.push({ P: innerTop, h: o.top });
  const n = path.length;
  const sharp = path.map((p, i) => turnAt(path[(i + n - 1) % n], p, path[(i + 1) % n]) > SHARP);
  const tint = o.tint ?? (() => null);
  const kind = o.kind ?? "outer";

  // the walls: each path edge cut at the cell boundaries and every TILE, ring to ring
  for (let i = 0; i < n; i++) {
    const a = path[i];
    const c = path[(i + 1) % n];
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (len < 1e-9) continue;
    const cuts = new Set([0, 1]);
    for (const k of [0, 1]) {
      const [u, v] = [Math.min(a[k], c[k]), Math.max(a[k], c[k])];
      for (let s = Math.ceil(u - 0.5) + 0.5; s < v; s++) {
        const t = (s - a[k]) / (c[k] - a[k]);
        if (t > 1e-6 && t < 1 - 1e-6) cuts.add(t);
      }
    }
    const m = Math.ceil(len / TILE - 1e-9);
    for (let j = 1; j < m; j++) cuts.add(j / m);
    const ts = [...cuts].sort((p, q) => p - q);
    const [nx, ny] = [(c[1] - a[1]) / len, -(c[0] - a[0]) / len]; // outward: right of a counter-clockwise path
    const seamAt = (t) => !!o.seams && [0, 1].some((k) => Math.abs(c[k] - a[k]) > 1e-9 && onSeam(a[k] + (c[k] - a[k]) * t));
    for (let j = 0; j + 1 < ts.length; j++) {
      const [t0, t1] = [ts[j], ts[j + 1]];
      const upright = (t, end) => (end === 0 ? t0 === 0 && sharp[i] : t1 === 1 && sharp[(i + 1) % n]) || seamAt(t);
      const [mx, my] = [a[0] + ((c[0] - a[0]) * (t0 + t1)) / 2, a[1] + ((c[1] - a[1]) * (t0 + t1)) / 2];
      for (let r = 0; r + 1 < rings.length; r++) {
        const at = (R, t) => {
          const [p, q] = [R.P[i], R.P[(i + 1) % n]];
          const [x, y] = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
          return M(x, y, R.h(x, y));
        };
        const [R0, R1] = [rings[r], rings[r + 1]];
        const pts = [at(R0, t0), at(R0, t1), at(R1, t1), at(R1, t0)];
        const from = M(mx - nx * 0.3, my - ny * 0.3, (R0.h(mx, my) + R1.h(mx, my)) / 2);
        const band = o.band?.(r - (bb ? 1 : 0)) ?? {};
        faces.push(oriented(pts, [r > 0 || o.baseEdge !== false, upright(t1, 1), true, upright(t0, 0)], from, { kind, tint: tint(mx, my), ...o.extra, ...band }));
      }
    }
  }

  // the top and the bottom, in tiles
  const caps = [[innerTop, o.top, 1]];
  if (o.bottomCap !== false) caps.push([innerBottom, o.bot, -1]);
  for (const [P, h, up] of caps) {
    const lines = (vs, extra) => {
      const [lo0, hi0] = [Math.min(...vs), Math.max(...vs)];
      const out = new Set(extra.filter((e) => e > lo0 && e < hi0).map((e) => +e.toFixed(6)));
      for (let t = Math.floor(lo0 / TILE) * TILE; t <= hi0 + TILE; t += TILE) out.add(+t.toFixed(6));
      return [...out].sort((p, q) => p - q);
    };
    const LX = lines(P.map((p) => p[0]), o.cuts?.x ?? []);
    const LY = lines(P.map((p) => p[1]), o.cuts?.y ?? []);
    for (let ix = 0; ix + 1 < LX.length; ix++) {
      for (let iy = 0; iy + 1 < LY.length; iy++) {
        const piece = clip(clip(clip(clip(P, 0, LX[ix], 1), 0, LX[ix + 1], -1), 1, LY[iy], 1), 1, LY[iy + 1], -1);
        if (piece.length < 3 || Math.abs(polyArea(piece)) < 1e-6) continue;
        const [cx, cy] = mean(piece);
        if (up > 0 && o.skip?.(cx, cy)) continue;
        const extra = o.capExtra ? o.capExtra(piece, up) : {};
        if (extra === null) continue;
        const edges = piece.map((p, k) => {
          const q = piece[(k + 1) % piece.length];
          if (onPath(P, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2])) return true;
          return !!o.seams && ((Math.abs(p[0] - q[0]) < 1e-9 && onSeam(p[0])) || (Math.abs(p[1] - q[1]) < 1e-9 && onSeam(p[1])));
        });
        const pts = piece.map(([x, y]) => M(x, y, h(x, y)));
        faces.push(oriented(pts, edges, M(cx, cy, h(cx, cy) - up * 5), { kind, tint: tint(cx, cy), ...o.extra, ...extra }));
      }
    }
  }
  return faces;
}

/** A fixture's or greeble's face: plain, edged all round, in layer 0. */
const face = (pts, extra) => ({ pts, kind: "dock", key: null, tint: null, edges: pts.map(() => true), turns: false, cull: true, layer: 0, ...extra });

/** A box's six faces about centre c, half-sizes h, in model units. */
const cuboid = (c, h, extra) => CUBE.map(({ c: signs }) => face(signs.map((s) => c.map((v, k) => v + s[k] * h[k])), extra));

/**
 * A tube along model axis k from s0 (radius r0) to s1 (radius r1) about centre c, capped at both
 * ends, each cap facing out of it; `paint(i)` is side i's extra.
 */
function tube(c, k, [s0, s1], [r0, r1], n, extra, paint = () => ({})) {
  const [u, v] = [0, 1, 2].filter((j) => j !== k);
  const ring = (s, r) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((i + 0.5) / n) * 2 * Math.PI;
      const p = c.slice();
      p[k] = s;
      p[u] += r * Math.cos(a);
      p[v] += r * Math.sin(a);
      return p;
    });
  const [A, B] = [ring(s0, r0), ring(s1, r1)];
  const out = [];
  const axis = c.slice();
  axis[k] = (s0 + s1) / 2;
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    out.push(face(away([A[i], A[i1], B[i1], B[i]], axis), { ...extra, edges: [false, true, false, true], ...paint(i) }));
  }
  // a point just inside the tube from each end, so each cap faces out of it
  const inside = (s, toward) => {
    const p = c.slice();
    p[k] = s + Math.sign(toward - s) * Math.min(1, Math.abs(toward - s) / 2);
    return p;
  };
  out.push(face(away(A, inside(s0, s1)), extra), face(away(B, inside(s1, s0)), extra));
  return out;
}

/**
 * A ship's hull, its looks and its fixtures in 3D, from a plan's look (`profile`, `surface`,
 * `greebles`, `fixtures`): faces for the ModelView, all in layer 0, each with its deck. The rooms'
 * own cells and the blisters are the decks builder's.
 * @param {ReturnType<import("./decks.js").indexDecks>} index
 * @param {{id: string, look?: object}} data  a generated plan
 * @returns {object[]}
 */
export function buildShipModel(index, data) {
  const { hull, grid } = index;
  const look = data.look ?? {};
  const profile = look.profile ?? { bevel: 0, noseDrop: 0, noseLength: 1, spine: null };
  const surface = look.surface ?? { seams: false, windows: [], stripe: null, navLights: false };
  const palette = look.palette ?? {};
  const faces = [];

  const mid = [(hull.x0 + hull.x1) / 2, (hull.y0 + hull.y1) / 2, (hull.z0 + hull.z1) / 2];
  const H = CELL.deck / 2;
  const M = (x, y, h) => [(x - mid[0]) * CELL.side, h, (y - mid[1]) * CELL.frame];
  const at = (x, y, z) => M(x, y, (z - mid[2]) * CELL.deck);
  const box = [[hull.x0 - 0.5, hull.y0 - 0.5], [hull.x1 + 0.5, hull.y0 - 0.5], [hull.x1 + 0.5, hull.y1 + 0.5], [hull.x0 - 0.5, hull.y1 + 0.5]];
  const pathOf = (z) => index.hullPaths?.[z] ?? box;
  const rooms = [...index.byId.values()].filter((r) => !r.blister);
  const roomAt = new Map(rooms.map((r) => [`${r.cell.x}:${r.cell.y}:${r.cell.z}`, r]));
  const tintAt = (z) => (x, y) => {
    const cx = Math.min(grid.x1, Math.max(grid.x0, Math.round(x)));
    const cy = Math.min(grid.y1, Math.max(grid.y0, Math.round(y)));
    return roomAt.get(`${cx}:${cy}:${z}`)?.tint ?? null;
  };
  const local = (r) => r.id.slice(data.id.length + 1);
  const bounds = (r) => {
    const b = boundsOf(outlineOf(r.footprint));
    return { x0: b.x0 + r.cell.x, x1: b.x1 + r.cell.x, y0: b.y0 + r.cell.y, y1: b.y1 + r.cell.y };
  };
  // whether a deck's path is over (or under) the whole of a piece
  const covers = (z, piece) => {
    if (z < grid.z0 || z > grid.z1) return false;
    const path = pathOf(z);
    const on = (p) => within(path, p) || onPath(path, p);
    return piece.every((p, i) => on(p) && on(mean([p, piece[(i + 1) % piece.length]])));
  };

  // the profile: the nose drops (the top deck's top, and a third as much the bottom deck's bottom)
  const dropAt = (z) => {
    const nose = Math.max(...pathOf(z).map((p) => p[1]));
    return (y) => smooth((y - (nose - profile.noseLength)) / profile.noseLength) * profile.noseDrop * CELL.deck;
  };
  const topOf = (z) => {
    const drop = z === grid.z1 ? dropAt(z) : () => 0;
    return (x, y) => (z - mid[2]) * CELL.deck + H - drop(y);
  };
  const botOf = (z) => {
    const drop = z === grid.z0 ? dropAt(z) : () => 0;
    return (x, y) => (z - mid[2]) * CELL.deck - H + drop(y) * 0.3;
  };
  const roofTop = topOf(grid.z1);
  const spine = profile.spine;
  const inSpine = (x, y) => !!spine && Math.abs(x) < spine.width / 2 - 1e-6 && y > spine.from + 1e-6 && y < spine.to - 1e-6;
  const spineTop = (grid.z1 - mid[2]) * CELL.deck + H + (spine?.height ?? 0) * CELL.deck;
  const roof = (x, y) => (inSpine(x, y) ? spineTop : roofTop(x, y));

  // the canopies: glass over the fore half of each room with one on the top deck
  const canopies = rooms
    .filter((r) => r.canopy && r.cell.z === grid.z1)
    .map((r) => {
      const b = bounds(r);
      const [cx, hw] = [(b.x0 + b.x1) / 2, (b.x1 - b.x0) / 2 - 0.12];
      return { x0: cx - hw, x1: cx + hw, y0: (b.y0 + b.y1) / 2 - 0.05, y1: b.y1 - 0.08 };
    });
  const stands = [...canopies, ...(spine ? [{ x0: -spine.width / 2, x1: spine.width / 2, y0: spine.from, y1: spine.to }] : [])];
  const under = (x, y) => stands.some((s) => x > s.x0 && x < s.x1 && y > s.y0 && y < s.y1);

  // the stripe and the seam line along the flank, as bands up the wall
  const stripe = surface.stripe;
  const bands = stripe ? [stripe.at, stripe.at + stripe.width] : [];
  if (surface.seams) bands.push(0.62);
  bands.sort((p, q) => p - q);
  const stripeBand = stripe ? bands.indexOf(stripe.at) + 1 : -1;
  const stripePaint = stripe ? { kind: "fore", tint: palette[stripe.paint] ?? null } : null;

  // each deck: its path lofted floor to top, bevelled and dropped at the ship's top and bottom
  for (let z = grid.z0; z <= grid.z1; z++) {
    const [top, bottom] = [z === grid.z1, z === grid.z0];
    faces.push(
      ...loft(M, pathOf(z), {
        bot: botOf(z),
        top: topOf(z),
        bevelTop: top ? profile.bevel : 0,
        bevelBottom: bottom ? profile.bevel : 0,
        bands,
        band: (i) => (i === stripeBand ? stripePaint : null),
        tint: tintAt(z),
        seams: surface.seams,
        extra: { deck: z, outline: true },
        skip: top ? under : undefined,
        cuts: { x: stands.flatMap((s) => [s.x0, s.x1]), y: stands.flatMap((s) => [s.y0, s.y1]) },
        // a top under the deck above is its lid, shown when cut to it; a bottom over the deck below isn't there
        capExtra: (piece, up) => {
          if (up > 0) return !top && covers(z + 1, piece) ? { lid: z, deck: undefined, outline: undefined } : {};
          return !bottom && covers(z - 1, piece) ? null : {};
        },
      }),
    );
  }
  const onTop = { deck: grid.z1, outline: true };
  if (spine) {
    const w = spine.width / 2;
    faces.push(
      ...loft(M, [[-w, spine.from], [w, spine.from], [w, spine.to], [-w, spine.to]], {
        bot: (x, y) => roofTop(x, y) - 1,
        top: () => spineTop,
        bevelTop: Math.min(0.06, profile.bevel),
        bottomCap: false,
        baseEdge: false,
        tint: tintAt(grid.z1),
        seams: surface.seams,
        extra: onTop,
        skip: (x, y) => canopies.some((s) => x > s.x0 && x < s.x1 && y > s.y0 && y < s.y1),
      }),
    );
  }
  for (const c of canopies) {
    faces.push(
      ...loft(M, [[c.x0, c.y0], [c.x1, c.y0], [c.x1, c.y1], [c.x0, c.y1]], {
        bot: (x, y) => roof(x, y) - 1,
        top: (x, y) => roof(x, y) + 6,
        bevelTop: 0.06,
        bottomCap: false,
        baseEdge: false,
        kind: "blister",
        extra: onTop,
      }),
    );
  }

  // lit window strips on the walls beside each windowed room, a pane a piece of wall
  const byLocal = new Map(rooms.map((r) => [local(r), r]));
  for (const id of surface.windows ?? []) {
    const r = byLocal.get(id);
    if (!r) continue;
    const z = r.cell.z;
    const b = bounds(r);
    const path = pathOf(z);
    const [bevelTop, bevelBottom] = [z === grid.z1 ? profile.bevel : 0, z === grid.z0 ? profile.bevel : 0];
    const [bot, top] = [botOf(z), topOf(z)];
    const hAt = ([x, y], f) => {
      const [lo, hi] = [bot(x, y) + bevelBottom * CELL.side, top(x, y) - bevelTop * CELL.side];
      return lo + (hi - lo) * f;
    };
    path.forEach((a, i) => {
      const c = path[(i + 1) % path.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 1e-9) return;
      const pieces = Math.max(1, Math.round(len / WINDOW_EVERY));
      const [nx, ny] = [(c[1] - a[1]) / len, -(c[0] - a[0]) / len];
      const off = 0.8 / CELL.side;
      for (let j = 0; j < pieces; j++) {
        const along = (t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
        const [p0, p1] = [along((j + 0.18) / pieces), along((j + 0.82) / pieces)];
        const m = mean([p0, p1]);
        if (m[0] < b.x0 - 0.3 || m[0] > b.x1 + 0.3 || m[1] < b.y0 - 0.05 || m[1] > b.y1 + 0.05) continue;
        const [q0, q1] = [[p0[0] + nx * off, p0[1] + ny * off], [p1[0] + nx * off, p1[1] + ny * off]];
        const pts = [M(...q0, hAt(p0, 0.66)), M(...q1, hAt(p1, 0.66)), M(...q1, hAt(p1, 0.84)), M(...q0, hAt(p0, 0.84))];
        faces.push(oriented(pts, [false, false, false, false], M(m[0] - nx * 0.3, m[1] - ny * 0.3, hAt(m, 0.75)), { kind: "lamp", deck: z }));
      }
    });
  }

  // nav lights at her widest each side, the point nearest her middle frame, and one astern
  if (surface.navLights) {
    const path = pathOf(grid.z1);
    const ys = path.map((p) => p[1]);
    const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
    const widest = (dir) => {
      const w = Math.max(...path.map((p) => p[0] * dir));
      return path.filter((p) => p[0] * dir > w - 1e-6).reduce((p, q) => (Math.abs(q[1] - midY) < Math.abs(p[1] - midY) ? q : p));
    };
    const s = 3.2;
    const height = (p) => roofTop(...p) - profile.bevel * CELL.side - s - 1;
    for (const [dir, tint] of [[-1, NAV.port], [1, NAV.starboard]]) {
      const p = widest(dir);
      const c = M(p[0], p[1], height(p));
      c[0] += dir * (s + 0.5);
      faces.push(...cuboid(c, [s, s, s], { kind: "lamp", tint, deck: grid.z1 }));
    }
    const sx = mid[0];
    const tail = tailAt(path, sx) ?? Math.min(...ys);
    const c = M(sx, tail, height([sx, tail]));
    c[2] -= s + 0.5;
    faces.push(...cuboid(c, [s, s, s], { kind: "lamp", deck: grid.z1 }));
  }

  // greebles on the roof (or the spine) at their side and frame
  for (const g of look.greebles ?? []) {
    const base = roof(g.side, g.frame);
    const [x, , z] = M(g.side, g.frame, 0);
    const extra = { deck: grid.z1 };
    if (g.type === "vent") {
      faces.push(...cuboid([x, base + 1.5, z], [0.1 * CELL.side, 2, 0.07 * CELL.frame], extra));
      faces.push(...cuboid([x, base + 3.8, z], [0.075 * CELL.side, 0.6, 0.05 * CELL.frame], { ...extra, kind: "outer", tint: VENT_TOP }));
    } else if (g.type === "antenna") {
      const tall = g.height * CELL.deck;
      faces.push(...cuboid([x, base + tall / 2, z], [1.1, tall / 2, 1.1], extra));
      faces.push(...cuboid([x, base + tall, z], [2.2, 2.2, 2.2], { ...extra, kind: "lamp" }));
    } else if (g.type === "dish") {
      faces.push(...cuboid([x, base + 3, z], [1.4, 3, 1.4], extra));
      faces.push(...tube([x, base + 6, z], 1, [base + 5.5, base + 9.5], [2, g.r * CELL.side], SIDES, extra));
    }
  }

  faces.push(...shipFixtures(index, data, { at, pathOf }));
  return faces;
}

/** The ship fixtures in 3D: bells (cones flaring aft), the boom, and the collar's ring banded yellow. */
function shipFixtures(index, data, { at, pathOf }) {
  const faces = [];
  for (const f of data.look?.fixtures ?? []) {
    if (f.type === "bell") {
      const tail = tailAt(pathOf(f.deck), f.side);
      if (tail === null) continue; // off the hull; the build won't let this through
      const c = at(f.side, tail, f.deck);
      faces.push(...tube(c, 2, [c[2] + 2, c[2] - f.len * CELL.frame], [f.r * 0.3 * CELL.side, f.r * CELL.side], SIDES, { deck: f.deck }));
    } else if (f.type === "boom") {
      const nose = noseAt(pathOf(f.deck), f.side);
      if (nose === null) continue;
      const u = f.len;
      const p = (d) => at(f.side, nose + d * u, f.deck);
      const extra = { deck: f.deck };
      const [a, b] = [p(-0.06), p(0.64)];
      faces.push(...cuboid([a[0], a[1], (a[2] + b[2]) / 2], [1.8, 1.8, (b[2] - a[2]) / 2], extra));
      faces.push(...cuboid(p(0.28), [0.11 * u * CELL.side, 1.4, 1.4], extra));
      // the emitter's head: an octahedron
      const h = p(0.74);
      const [hx, hy, hz] = [0.11 * u * CELL.side, 0.08 * u * CELL.side, 0.14 * u * CELL.frame];
      const V = [[h[0] + hx, h[1], h[2]], [h[0], h[1] + hy, h[2]], [h[0] - hx, h[1], h[2]], [h[0], h[1] - hy, h[2]]];
      for (const tip of [[h[0], h[1], h[2] + hz], [h[0], h[1], h[2] - hz]]) {
        for (let i = 0; i < 4; i++) faces.push(face(away([tip, V[i], V[(i + 1) % 4]], h), extra));
      }
      const [t0, t1] = [p(0.88), p(1)];
      faces.push(...cuboid([t0[0], t0[1], (t0[2] + t1[2]) / 2], [1.2, 1.2, (t1[2] - t0[2]) / 2], extra));
    } else if (f.type === "chevrons") {
      const room = index.byId.get(`${data.id}.${f.room}`);
      if (!room) continue; // an orphan; the build reports it
      const hit = wallAt(pathOf(room.cell.z), room.cell, f.wall);
      if (!hit) continue;
      const R = 0.16 * CELL.frame;
      const out = 0.3;
      const paint = (i) => (i % 2 ? { kind: "fore", tint: CHEVRON } : {});
      const c = at(hit[0], hit[1], room.cell.z);
      const extra = { deck: room.cell.z };
      if (f.wall === "port" || f.wall === "starboard") {
        const dx = f.wall === "port" ? -1 : 1;
        faces.push(...tube(c, 0, [c[0] - dx * 2, c[0] + dx * out * CELL.side], [R, R], RING_SIDES, extra, paint));
      } else {
        const dy = f.wall === "aft" ? -1 : 1;
        faces.push(...tube(c, 2, [c[2] - dy * 2, c[2] + dy * out * CELL.frame], [R, R], RING_SIDES, extra, paint));
      }
    }
  }
  return faces;
}
