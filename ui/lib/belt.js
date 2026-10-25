// The belt map's pure parts (docs/maps/belt.md): the belt message cleaned, the game's words for where
// she is in a belt, the disc framed in the band, her place glided between the game's ticks, and the
// last sweep's ships in the belt. A belt's frame is km from its core along the star's axes, y toward
// the system's bearing 0, bearings clockwise (navigation.md §2.5, bearingOf in
// ~/dev/empyreal/packages/game/src/systems/belts.ts); the band draws 0 up. A place in a belt is its
// core's, from the charts, plus her x and y, so the bearing ring points the same way as the system.

import { along, isDark, isShip, nameOf, shipLine } from "./contacts.js";
import { courseLine, isClosed, mouthStar, positionOf } from "./orbits.js";
import { SHORT } from "./sky.js";

/** help mining: "sensor range (5 km; more with a sensor array)". */
export const SENSOR_KM = 5;
/** Two ships in one belt are alongside within this, km (ALONGSIDE in systems/space.ts). */
export const ALONGSIDE_KM = 5;

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === "string" ? v : null);

/** The game's words for her place (placeText in systems/belts.ts): "11 km out from the core,
 *  bearing 210°", "at the core" within 1 km of it, "at the outer edge, bearing 210°" within 1 km of the rim. */
export function placeText(place, radius) {
  if (!place) return null;
  if (place.km < 1) return "at the core";
  if (radius !== null && place.km > radius - 1) return `at the outer edge, bearing ${place.bearing}°`;
  return `${Math.round(place.km)} km out from the core, bearing ${place.bearing}°`;
}

function point(p) {
  return Array.isArray(p) && num(p[0]) !== null && num(p[1]) !== null ? [p[0], p[1]] : null;
}

/** The Lua side's belt message (src/station_map/belt.lua), every field checked; null for none. */
export function cleanBelt(msg) {
  if (!msg || typeof msg !== "object") return null;
  const id = str(msg.id);
  const radius = num(msg.radius);
  const p = msg.place && typeof msg.place === "object" ? msg.place : null;
  const place =
    p && num(p.x) !== null && num(p.y) !== null
      ? {
          x: p.x,
          y: p.y,
          km: num(p.km) ?? Math.hypot(p.x, p.y),
          bearing: num(p.bearing) ?? Math.round(((Math.atan2(p.x, p.y) * 180) / Math.PI + 360) % 360),
        }
      : null;
  const log = msg.log && typeof msg.log === "object" ? msg.log : {};
  const track = (Array.isArray(log.track) ? log.track : [])
    .map((seg) => (Array.isArray(seg) ? seg.map(point).filter(Boolean) : []))
    .filter((seg) => seg.length > 0);
  const sweeps = (Array.isArray(log.sweeps) ? log.sweeps : [])
    .filter((s) => s && num(s.x) !== null && num(s.y) !== null)
    .map((s) => ({ x: s.x, y: s.y, r: num(s.r) }));
  const l = log.left;
  const left = l && num(l.x) !== null && num(l.y) !== null && str(l.name) ? { x: l.x, y: l.y, name: l.name, id: str(l.id), at: num(l.at) } : null;
  const sn = log.seen;
  const seen = sn && num(sn.at) !== null && num(sn.x) !== null && num(sn.y) !== null ? { at: sn.at, x: sn.x, y: sn.y } : null;
  const d = msg.docked && typeof msg.docked === "object" ? msg.docked : null;
  const docked = d && num(d.x) !== null && num(d.y) !== null ? { x: d.x, y: d.y, km: num(d.km) ?? Math.hypot(d.x, d.y), bearing: num(d.bearing) ?? headingOf([0, 0], [d.x, d.y]) ?? 0 } : null;
  return {
    id,
    name: str(msg.name),
    radius: radius !== null && radius > 0 ? radius : null,
    place,
    host: str(msg.host),
    hostId: str(msg.host_id),
    docked,
    array: typeof msg.array === "boolean" ? msg.array : null,
    track,
    sweeps,
    left,
    seen,
  };
}

/** Her place in the belt: her own, or her host's while she's docked; null for none. */
export const hereOf = (b) => b?.place ?? b?.docked ?? null;

/**
 * The last sweep's ships in the belt: each `ship` or `unknown` contact placed from where she was as
 * the sweep came (`b.seen`, noted for that sweep only) by its km and bearing, if that's within the
 * disc, as `{ c, p }`, with `km` and `bearing` from `here` (her now) for `rcs`, and `host` if she's
 * the host you left, seen since. Her own host while she's docked is drawn as the pair, not here.
 * Nothing moves a ship on from the sweep.
 */
export function beltShips(b, contacts, here = hereOf(b)) {
  if (!b?.seen || !b.radius || !contacts || num(contacts.at) !== b.seen.at) return [];
  const out = [];
  for (const c of Array.isArray(contacts.contacts) ? contacts.contacts : []) {
    if (!isShip(c) || num(c.km) === null || num(c.bearing) === null) continue;
    if (b.docked && b.hostId && c.id === b.hostId) continue;
    const p = along([b.seen.x, b.seen.y], c.km, c.bearing);
    if (Math.hypot(p[0], p[1]) > b.radius) continue;
    const off = here ? [Math.hypot(p[0] - here.x, p[1] - here.y), headingOf([here.x, here.y], p)] : [null, null];
    const l = b.left;
    const host = !!l && l.at !== null && contacts.at / 1000 > l.at && (l.id ? c.id === l.id : !isDark(c) && c.name === l.name);
    out.push({ c, p, km: off[0], bearing: off[1], host });
  }
  return out;
}

/** A ship's two lines on the belt map: "Full Measure · 4.2 km, 53°", the range and bearing from her
 *  now to where the sweep saw her, and "freighter · seen 4m ago" at wall-clock t (ms). */
export function beltShipText(s, at, t) {
  const where = s.km === null ? "" : s.bearing === null ? " · here" : ` · ${s.km.toFixed(1)} km, ${Math.round(s.bearing) % 360}°`;
  const age = ago((t - at) / 1000);
  return [`${nameOf(s.c)}${where}`, [shipLine(s.c), `seen ${age}${age === "just now" ? "" : " ago"}`].filter(Boolean).join(" · ")];
}

/** The disc in a w × h band: its centre and px per km, leaving room round it for the bearings. */
export function discFrame(w, h, radius) {
  const r = Math.max(12, Math.min(w, h) / 2 - 24);
  return { cx: w / 2, cy: h / 2, k: r / radius, r };
}

/** How far in the map zooms: six times the fit, as the lanes map. */
export const ZOOM_IN = 6;

/** The view that shows the whole belt, discFrame's, as [x, y, w, h] in km with y down (the band's way
 *  up, so pan and zoom work on it as on the lanes map's). */
export function fitView(w, h, radius) {
  const f = discFrame(w, h, radius);
  return [-f.cx / f.k, -f.cy / f.k, w / f.k, h / f.k];
}

/** The frame a view draws in, as discFrame's: the core's place in px, px per km and the rim's px. */
export function viewFrame(vb, w, h, radius) {
  const k = w / vb[2];
  return { cx: -vb[0] * k, cy: -vb[1] * k, k, r: radius * k };
}

/** A view of yours kept as the band changes shape, as the lanes map keeps one: its middle and its
 *  width in km stay, its height follows the band's. */
export function reshape(vb, w, h) {
  const u = vb[2] / (w || 1);
  const mx = vb[0] + vb[2] / 2;
  const my = vb[1] + vb[3] / 2;
  return [mx - (w * u) / 2, my - (h * u) / 2, w * u, h * u];
}

/** A belt point in band px: y up. */
export function toBand(f, x, y) {
  return [f.cx + x * f.k, f.cy - y * f.k];
}

/** Degrees clockwise from the belt's 0 of the way from a to b, or null if they're the same. */
export function headingOf(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (Math.hypot(dx, dy) < 1e-9) return null;
  return (((Math.atan2(dx, dy) * 180) / Math.PI) + 360) % 360;
}

/** Her home: the game's first station, `travel home`'s (`names: [home, tiss]` in content/game/world.yaml,
 *  space.homeId). The charts don't say which it is; it's the same for everyone. */
export const HOME = "tiss";

// The order marks are listed in: her home, the other stations, the star, the planet, the mouths.
const RANK = { station: 1, port: 1, star: 2, planet: 3, mouth: 4 };

/** What the bearing ring names a charted thing: a station by the game's short name, a mouth by the
 *  star it faces ("Petroc · closed" while its lane is). */
function markLabel(it) {
  if (it.kind === "mouth") return isClosed(it) ? `${mouthStar(it.name)} · closed` : mouthStar(it.name);
  return SHORT[it.id] ?? it.name;
}

/**
 * Which way things on her charts lie from the core of belt `beltId` at wall-clock t (ms), degrees
 * clockwise from the system's zero, as the belt's own bearings count. `marks`: the star, the planet
 * the belt goes round, the stations (her home first) and the lane mouths placed on her charts, each
 * { id, kind, label, deg, home, closed }. `next`: where the course she has plotted aims, as the chart
 * draws its line (courseLine), { id, label, deg }, or null. Every bearing is a difference of
 * positionOf's x and y: a mouth's `edge.bearing` is counter-clockwise from x and is never read here.
 * Nothing at all where the charts don't list the belt or can't place it.
 */
export function compassMarks(index, beltId, course, t) {
  const none = { marks: [], next: null };
  if (index?.items.get(beltId)?.kind !== "belt") return none;
  const core = positionOf(index, beltId, t);
  if (!core) return none;
  const degFrom = (p) => (p ? headingOf(core, p) : null);
  const by = index.items.get(beltId)?.orbit?.parent ?? null;
  const marks = [];
  for (const it of index.items.values()) {
    const kind = it.kind;
    if (!RANK[kind] || (kind === "planet" && it.id !== by)) continue;
    const deg = degFrom(positionOf(index, it.id, t));
    if (deg === null) continue; // a mouth with no bearing (a wild lane's), or one the charts can't place
    marks.push({ id: it.id, kind, label: markLabel(it), deg, home: it.id === HOME, closed: kind === "mouth" && isClosed(it) });
  }
  marks.sort((a, b) => b.home - a.home || RANK[a.kind] - RANK[b.kind]);
  const to = typeof course?.to === "string" ? course.to : null;
  const line = to && to !== beltId ? courseLine(index, { location: beltId }, course, t) : null;
  const deg = line ? degFrom(line.to) : null;
  const it = index.items.get(to);
  const next = deg === null ? null : { id: to, label: it ? markLabel(it) : (course.name ?? to), deg };
  return { marks, next };
}

/**
 * Where to write the map's names so none overprints another. Each of `items`, in order (the first
 * pick first), is { x, y, wide }: its mark's place in px and its widest line's width, and optionally
 * `deg` (a bearing ring mark's angle: named on its outward side, and kept off the disc, `outside`),
 * `lines` (1 or 2), `gap` (px from the mark to the words), `base` (the first baseline below y) and
 * `must` (named even with nowhere clear, beside it as it would be alone). It tries beside its mark,
 * then a line or more up or down, then slid further out, then the other side, and takes the first
 * spot clear of the names placed before it, the `avoid` boxes ([x0, y0, x1, y1]), the band's w × h,
 * and, `outside`, the disc out to `clear` px from (cx, cy). Each gets { x, y, anchor, moved } (y the
 * first baseline; `moved` when it's off its mark's line), or null: its mark goes unnamed.
 */
export function placeNames(items, { cx, cy, clear }, w, h, avoid = []) {
  const taken = [...avoid];
  const meets = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const inDisc = (b) => {
    const nx = Math.min(Math.max(cx, b[0]), b[2]);
    const ny = Math.min(Math.max(cy, b[1]), b[3]);
    return Math.hypot(nx - cx, ny - cy) < clear;
  };
  return items.map(({ x, y, wide, deg = 90, lines = 1, gap = 7, base = 3, outside = false, must = false }) => {
    const a = (deg * Math.PI) / 180;
    const right = Math.sin(a) >= 0;
    const away = -Math.cos(a) >= 0 ? 1 : -1; // down, away from the disc, in its lower half; up in its upper
    const tries = [];
    for (const [flip, side] of [[0, right], [1, !right]]) {
      for (const dy of [0, 1, -1, 2, -2, 3]) for (const dx of [0, 1, 2]) tries.push({ side, dy: dy * away * 11, dx: dx * 24, cost: flip * 2.5 + Math.abs(dy) + dx * 1.2 });
    }
    tries.sort((p, q) => p.cost - q.cost);
    const spot = ({ side, dy, dx }) => {
      const lx = side ? x + gap + dx : x - gap - dx;
      const ly = y + base + dy;
      const box = side ? [lx, ly - 8, lx + wide, ly + 2 + (lines - 1) * 10] : [lx - wide, ly - 8, lx, ly + 2 + (lines - 1) * 10];
      return { lx, ly, box, out: box[0] < 2 || box[1] < 0 || box[2] > w - 2 || box[3] > h };
    };
    for (const t of tries) {
      const { lx, ly, box, out } = spot(t);
      if (out || (outside && inDisc(box)) || taken.some((b) => meets(b, box))) continue;
      taken.push(box);
      return { x: lx, y: ly, anchor: t.side ? "start" : "end", moved: t.dy !== 0 || t.dx !== 0 };
    }
    if (!must) return null;
    const alone = { side: right, dy: 0, dx: 0 };
    if (spot(alone).out) alone.side = !right;
    const { lx, ly, box } = spot(alone);
    taken.push(box);
    return { x: lx, y: ly, anchor: alone.side ? "start" : "end", moved: false };
  });
}

/** How many of the newest sweeps are drawn at full strength; older ones fade. */
export const RECENT_SWEEPS = 3;

/**
 * How strongly to draw sweep i of n (oldest first, as the log keeps them): the newest RECENT_SWEEPS
 * as they always were, older ones nearly gone, fainter the older they are, so what she did lately
 * stands out and a belt worked for hours doesn't turn into one bright blob. `fill` and `stroke` are
 * opacities for a disc; `ring` for a sweep with no known range.
 */
export function sweepTone(i, n) {
  if (i >= n - RECENT_SWEEPS) return { fill: 0.08, stroke: 0.3, ring: 0.85 };
  const age = (i + 1) / Math.max(1, n - RECENT_SWEEPS); // (0, 1], 1 the newest of the old
  return { fill: 0.025, stroke: 0.06 + 0.12 * age, ring: 0.2 + 0.25 * age };
}

/** The km rings inside a disc: every `step` km (5, or 1 zoomed in) short of the rim. */
export function ringKms(radius, step = 5) {
  const out = [];
  for (let km = step; km < radius - 0.5; km += step) out.push(km);
  return out;
}

/** The km between rings at k px a km: 5, or 1 once a km is 30 px or more. */
export const ringStep = (k) => (k >= 30 ? 1 : 5);

/** Seconds as "just now", "14m", "2h 5m" or "3d 4h". */
export function ago(s) {
  s = Math.max(0, Math.round(s));
  if (s < 60) return "just now";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Her place between the game's ticks. Ship.Status comes a tick at a time while she moves, so each
 * new place is reached over the time since the last one came (clamped), from wherever she's drawn
 * now: she moves steadily, a tick behind the game.
 */
export class Glide {
  constructor() {
    this.belt = null;
    this.from = null;
    this.to = null;
    this.start = 0;
    this.end = 0;
    this.last = 0;
    this.heading = null;
  }

  /** A new place (km pair) at wall-clock t ms, in belt `id`; null is no place. */
  set(id, p, t) {
    if (!p) {
      this.to = this.from = null;
      this.belt = id;
      return;
    }
    if (!this.to || id !== this.belt) {
      this.belt = id;
      this.from = this.to = p;
      this.start = this.end = this.last = t;
      return;
    }
    if (p[0] === this.to[0] && p[1] === this.to[1]) return;
    const now = this.at(t);
    this.heading = headingOf(now, p) ?? this.heading;
    this.from = now;
    this.to = p;
    this.start = t;
    this.end = t + Math.min(1500, Math.max(250, t - this.last));
    this.last = t;
  }

  /** Where she's drawn at t, or null. */
  at(t) {
    if (!this.to) return null;
    if (t >= this.end || this.end <= this.start) return this.to;
    const f = Math.max(0, (t - this.start) / (this.end - this.start));
    return [this.from[0] + (this.to[0] - this.from[0]) * f, this.from[1] + (this.to[1] - this.from[1]) * f];
  }

  /** True while she's on her way to the last place. */
  moving(t) {
    return !!this.to && t < this.end;
  }
}
