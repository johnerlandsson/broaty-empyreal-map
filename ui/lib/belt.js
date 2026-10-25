// The belt map's pure parts (docs/maps/belt.md): the belt message cleaned, the game's words for where
// she is in a belt, the disc framed in the band, her place glided between the game's ticks, and the
// last sweep's ships in the belt. A belt's frame is km from its core along the star's axes, y toward
// the system's bearing 0, bearings clockwise (navigation.md §2.5, bearingOf in
// ~/dev/empyreal/packages/game/src/systems/belts.ts); the band draws 0 up.

import { along, isDark, isShip, nameOf, shipLine } from "./contacts.js";

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

/** The km rings inside a disc: every 5 km short of the rim. */
export function ringKms(radius) {
  const out = [];
  for (let km = 5; km < radius - 0.5; km += 5) out.push(km);
  return out;
}

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
