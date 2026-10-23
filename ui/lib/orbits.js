// Orbit maths for the system chart: pure and DOM-free. Positions are a function of
// wall-clock time, worked out when asked; nothing is stepped or stored.

// How far out the edge of a system is, in km. Players are told 15,000 km
// (content/help/lanes.md in the Empyreal source).
export const EDGE_KM = 15000;

const DEPTH = 8;
const rad = (deg) => (deg * Math.PI) / 180;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Index a charts message by id; a body and a place with the same id merge, keeping the body's
// kind (a port is a station among places, gmcp.md §8.4).
export function indexCharts(charts) {
  const items = new Map();
  const put = (it, place) => {
    if (!it || it.id == null) return;
    const have = items.get(it.id) ?? { id: it.id };
    for (const [k, v] of Object.entries(it)) if (v !== null && v !== undefined && !(place && k === "kind" && have.kind != null)) have[k] = v;
    items.set(it.id, have);
  };
  for (const b of charts?.bodies ?? []) put(b, false);
  for (const p of charts?.places ?? []) put(p, true);
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

// Whether a port on its planet's surface has its star above the horizon at wall-clock t (ms),
// as the game's isDay (planetside.md §4): straight up from the planet's centre through the town,
// against the way to the star. Null when the charts can't place the town or its planet.
export function daylit(index, id, t) {
  const planet = parentOf(index, id);
  const here = positionOf(index, id, t);
  const centre = planet === null ? null : positionOf(index, planet, t);
  if (!here || !centre) return null;
  // the star is at the origin: the way to it is -here
  return (here[0] - centre[0]) * -here[0] + (here[1] - centre[1]) * -here[1] > 0;
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
  // the departure the Lua side kept from the trip's first status: worked out again from a late
  // one, progress (rounded to 2 places) would swing it by minutes
  const kept = num(ship.depart);
  const depart = kept !== null ? kept * 1000 : progress >= 1 ? arrive : arrive - (eta / (1 - progress)) * 1000;
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

const apo = (orbit) => (num(orbit?.a) ?? 0) * (1 + Math.min(Math.max(num(orbit?.e) ?? 0, 0), 0.95));

// Km from the star to the edge of what is charted: the lane mouths' distance, else the
// furthest apoapsis from the star, summed through the parents.
export function systemRadius(index) {
  const items = [...index.items.values()];
  if (items.some((it) => it.kind === "mouth" || it.edge)) {
    const rs = items.map((it) => num(it.edge?.r)).filter((r) => r !== null && r > 0);
    return rs.length ? Math.max(...rs) : EDGE_KM;
  }
  let far = 0;
  for (const it of items) {
    let sum = 0;
    let cur = it;
    for (let i = 0; cur?.orbit && i < DEPTH; i++) {
      sum += apo(cur.orbit);
      cur = index.items.get(cur.orbit.parent);
    }
    far = Math.max(far, sum);
  }
  return far > 0 ? far : 1000;
}

// The km box [minX, minY, maxX, maxY] to open the chart on.
export function homeBox(index, ship, t) {
  const whole = () => {
    const r = 1.08 * systemRadius(index);
    return [-r, -r, r, r];
  };
  const fix = shipFix(index, ship, t);
  if (fix.kind === "moving") {
    const f = positionOf(index, fix.leg.frame, t);
    if (!f || !fix.pos) return whole();
    const pts = [fix.pos, [f[0] + fix.leg.from[0], f[1] + fix.leg.from[1]], [f[0] + fix.leg.to[0], f[1] + fix.leg.to[1]]];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 0.15 * Math.max(x1 - x0, y1 - y0);
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  }
  if (fix.kind === "at" || fix.kind === "searching") {
    const parent = fix.place ? parentOf(index, fix.place) : null;
    const body = parent && index.items.get(parent);
    const c = body && body.kind !== "star" ? positionOf(index, parent, t) : null;
    if (!c || !positionOf(index, fix.place, t)) return whole();
    let far = 0;
    for (const it of index.items.values()) if (it.orbit?.parent === parent) far = Math.max(far, apo(it.orbit));
    const r = (far > 0 ? far : 500) * 1.15;
    return [c[0] - r, c[1] - r, c[0] + r, c[1] + r];
  }
  return whole();
}

// An SVG viewBox [x, y, w, h] in km (svg y = -km y) around the box, matching w:h.
export function fitBox(box, w, h) {
  const [x0, y0, x1, y1] = box;
  const aspect = w > 0 && h > 0 ? w / h : 1;
  let vw = Math.max(x1 - x0, 0);
  let vh = Math.max(y1 - y0, 0);
  if (vw / aspect < vh) vw = vh * aspect;
  else vh = vw / aspect;
  if (vw < 1000) {
    vw = 1000;
    vh = vw / aspect;
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return [cx - vw / 2, -cy - vh / 2, vw, vh];
}

// Where to draw an arrow for a point p outside the viewBox vb, on vb shrunk by inset.
export function edgeMarker(vb, p, inset) {
  const [x, y, w, h] = vb;
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + h) return null;
  const dx = p[0] - cx;
  const dy = p[1] - cy;
  const hw = Math.max(w / 2 - inset, 0);
  const hh = Math.max(h / 2 - inset, 0);
  const k = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: cx + dx * k, y: cy + dy * k, angle: Math.atan2(dy, dx) };
}

// True when p has strayed from the centre of the viewBox, so the view should follow.
export function follows(vb, p, margin = 0.35) {
  const [x, y, w, h] = vb;
  return Math.abs(p[0] - (x + w / 2)) > margin * (w / 2) || Math.abs(p[1] - (y + h / 2)) > margin * (h / 2);
}

// How far p is from the centre of the viewBox, as a share of its half width or half height,
// whichever is more: 0 at the centre, 1 on the edge. follows() is offCentre() > margin.
export function offCentre(vb, p) {
  const [x, y, w, h] = vb;
  return Math.max(Math.abs(p[0] - (x + w / 2)) / (w / 2 || 1), Math.abs(p[1] - (y + h / 2)) / (h / 2 || 1));
}

// One redraw's following, for the view vb and her at p: a view you've panned or zoomed (touched)
// never moves on its own; an untouched one re-centres on her, keeping its size, once she's further
// off the middle than margin, a tolerance that starts wherever ⌂ left her (margin null) and only
// tightens, to 0.35 at the least, as she comes back toward the middle.
export function followStep(vb, p, margin, touched) {
  if (touched) return { vb, margin };
  if (margin !== null && follows(vb, p, margin)) return { vb: [p[0] - vb[2] / 2, p[1] - vb[3] / 2, vb[2], vb[3]], margin: 0.35 };
  return { vb, margin: Math.max(0.35, Math.min(margin ?? Infinity, offCentre(vb, p))) };
}

// How a kind of body or place is drawn: as itself if the chart knows it, else as a station, so a
// new kind still shows rather than nothing (style guide §10).
const MARKS = new Set(["star", "planet", "station", "port", "belt", "mouth"]);
export const markOf = (kind) => (MARKS.has(kind) ? kind : "station");

// A port's planet and the angle (radians, y up) from the planet's centre to the port at wall-clock
// t (ms): the chart draws it on the planet's drawn edge there, not on its orbit. Null for anything
// but a port, or a port it can't place.
export function onSurface(index, id, t) {
  const it = index.items.get(id);
  const parent = it?.kind === "port" ? index.items.get(it.orbit?.parent) : null;
  const p = parent && positionOf(index, id, t);
  const c = p && positionOf(index, parent.id, t);
  return c ? { parent, angle: Math.atan2(p[1] - c[1], p[0] - c[0]) } : null;
}

// An orbit under 8 px across is drawn folded into its parent.
export function folded(index, id, kmPerPx) {
  const a = num(index.items.get(id)?.orbit?.a);
  return a !== null && (2 * a) / kmPerPx < 8;
}

// The largest of 1, 2 or 5 x 10^n km that fits in maxPx.
export function scaleKm(kmPerPx, maxPx) {
  const km = kmPerPx * maxPx;
  if (!(km >= 1)) return 1;
  const mag = 10 ** Math.floor(Math.log10(km));
  return [5, 2, 1].map((m) => m * mag).find((v) => v <= km) ?? mag;
}

// A span in ms as the game's `charts` shows it: "2d 4h", "3h 2m", "12m".
export function ago(ms) {
  const mins = Math.floor(Math.max(num(ms) ?? 0, 0) / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mins % 60}m`;
  return `${mins}m`;
}

// "the Maelor lane mouth" -> "Maelor"; anything else stays as it is.
export function mouthStar(name) {
  const s = String(name ?? "");
  return s.replace(/^the\s+/i, "").replace(/\s+lane mouth$/i, "").trim() || s;
}
