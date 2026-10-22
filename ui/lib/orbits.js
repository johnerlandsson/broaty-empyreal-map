// Orbit maths for the system chart: pure and DOM-free. Positions are a function of
// wall-clock time, worked out when asked; nothing is stepped or stored.

// How far out the edge of a system is, in km. Players are told 15,000 km
// (content/help/lanes.md in the Empyreal source).
export const EDGE_KM = 15000;

const DEPTH = 8;
const rad = (deg) => (deg * Math.PI) / 180;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Index a charts message by id; a body and a place with the same id merge.
export function indexCharts(charts) {
  const items = new Map();
  const put = (it) => {
    if (!it || it.id == null) return;
    const have = items.get(it.id) ?? { id: it.id };
    for (const [k, v] of Object.entries(it)) if (v !== null && v !== undefined) have[k] = v;
    items.set(it.id, have);
  };
  for (const b of charts?.bodies ?? []) put(b);
  for (const p of charts?.places ?? []) put(p);
  for (const it of items.values()) {
    it.name ??= it.id;
    for (const k of ["kind", "radius", "orbit", "fit", "edge"]) it[k] ??= null;
  }
  return { system: charts?.system ?? null, epoch: num(charts?.epoch) ?? 0, items };
}

// Km from the parent at wall-clock t (ms), by Kepler's equation (Newton's method).
export function offsetOn(orbit, epoch, t) {
  const a = num(orbit?.a);
  const period = num(orbit?.period);
  if (a === null || !period || period <= 0) return [0, 0];
  const e = Math.min(Math.max(num(orbit.e) ?? 0, 0), 0.95);
  const m = rad((num(orbit.phase) ?? 0) + (360 * (t - epoch)) / 1000 / period);
  let E = m;
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const w = nu + rad(num(orbit.peri) ?? 0);
  return [r * Math.cos(w), r * Math.sin(w)];
}

// A point id "pt:<body>:<x>:<y>" is a spot in km from a body.
export function parsePoint(id) {
  const m = /^pt:([^:]+):(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?)$/.exec(String(id ?? ""));
  return m ? { body: m[1], x: Number(m[2]), y: Number(m[3]) } : null;
}

// The id an item sits relative to, or null for a star, the mouth and unknowns.
export function parentOf(index, id) {
  const pt = parsePoint(id);
  if (pt) return pt.body;
  return index.items.get(id)?.orbit?.parent ?? null;
}

// Km from the star at wall-clock t (ms), or null when the data can't place it.
export function positionOf(index, id, t, depth = 0) {
  if (depth > DEPTH) return null;
  const pt = parsePoint(id);
  if (pt) {
    const base = positionOf(index, pt.body, t, depth + 1);
    return base && [base[0] + pt.x, base[1] + pt.y];
  }
  const it = index.items.get(id);
  if (!it) return null;
  if (it.orbit) {
    const base = positionOf(index, it.orbit.parent, t, depth + 1);
    if (!base) return null;
    const off = offsetOn(it.orbit, index.epoch, t);
    return [base[0] + off[0], base[1] + off[1]];
  }
  if (it.kind === "star") return [0, 0];
  const r = num(it.edge?.r);
  const bearing = num(it.edge?.bearing);
  if (r !== null && bearing !== null) return [r * Math.cos(rad(bearing)), r * Math.sin(rad(bearing))];
  return null;
}

// The nearest body that holds both, as the game's Orbits.common: a chain starts at the
// item itself (a point's body), so a body is the frame of a trip to its own moon.
export function frameOf(index, a, b) {
  const known = (id) => parsePoint(id) || index.items.has(id);
  if (!known(a) || !known(b)) return null;
  const above = (id) => {
    const out = [];
    for (let p = parsePoint(id)?.body ?? id; p !== null && out.length < DEPTH; p = parentOf(index, p)) out.push(p);
    return out;
  };
  const up = new Set(above(a));
  return above(b).find((p) => up.has(p)) ?? null;
}

// How far off a belt body's remembered fit is at wall-clock t (ms), in km. The sent
// error holds until the fit's `at`, then grows as time^1.5, up to half way round.
export function errorAt(fit, a, t) {
  const error = num(fit?.error) ?? 0;
  const seen = num(fit?.seen) ?? 0;
  const at = num(fit?.at) ?? seen;
  if (t <= at || at - seen < 600000) return error;
  return Math.min(error * ((t - seen) / (at - seen)) ** 1.5, Math.PI * (num(a) ?? 0));
}

// Lost once the error is nearly half way round the orbit.
export const isLost = (errorKm, a) => errorKm >= 0.9 * Math.PI * a;

// Her trip as a straight line in the frame's offsets, times in ms; null when unplaceable.
export function legOf(index, ship) {
  const { from, destination } = ship ?? {};
  const received = num(ship?.received);
  const eta = num(ship?.eta);
  if (!from || !destination || received === null || eta === null) return null;
  const frame = frameOf(index, from, destination);
  if (frame === null) return null;
  const progress = Math.min(Math.max(num(ship.progress) ?? 0, 0), 1);
  const arrive = (received + eta) * 1000;
  const depart = progress >= 1 ? arrive : arrive - (eta / (1 - progress)) * 1000;
  const at = (id, t) => {
    const p = positionOf(index, id, t);
    const f = positionOf(index, frame, t);
    return p && f && [p[0] - f[0], p[1] - f[1]];
  };
  const a = at(from, depart);
  const b = at(destination, arrive);
  return a && b ? { frame, from: a, to: b, depart, arrive } : null;
}

// Where your ship is at wall-clock t (ms): at a place, moving, searching, bound or none.
export function shipFix(index, ship, t) {
  if (!ship || typeof ship !== "object") return { kind: "none" };
  if (ship.searching) {
    const place = typeof ship.searching === "string" ? ship.searching : (ship.destination ?? ship.location ?? null);
    return { kind: "searching", place };
  }
  if (ship.destination) {
    const place = ship.destination;
    const leg = legOf(index, ship);
    const f = leg && positionOf(index, leg.frame, t);
    if (!leg || !f) return { kind: "bound", place };
    const span = leg.arrive - leg.depart;
    const k = span > 0 ? Math.min(Math.max((t - leg.depart) / span, 0), 1) : 1;
    const dx = leg.to[0] - leg.from[0];
    const dy = leg.to[1] - leg.from[1];
    return {
      kind: "moving",
      place,
      pos: [f[0] + leg.from[0] + dx * k, f[1] + leg.from[1] + dy * k],
      heading: Math.atan2(dy, dx),
      leg,
    };
  }
  const here = ship.location || ship.point;
  if (here) return { kind: "at", place: here, pos: positionOf(index, here, t) };
  return { kind: "none" };
}
