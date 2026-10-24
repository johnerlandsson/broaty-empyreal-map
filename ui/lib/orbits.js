// Orbit maths for the system chart: pure and DOM-free. Positions are a function of
// wall-clock time, worked out when asked; nothing is stepped or stored.

// How far out the edge of a system is, in km. Players are told 15,000 km
// (content/help/lanes.md in the Empyreal source).
export const EDGE_KM = 15000;

// How far out high orbit is over a planet, in its radii (Empyreal's HIGH_ORBIT, navigation.md §6).
export const HIGH_ORBIT = 1.5;

const DEPTH = 8;
const rad = (deg) => (deg * Math.PI) / 180;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Index a charts message by id; a body and a place with the same id merge, keeping the body's
// kind (a port is a station among places, gmcp.md §8.4). A lane mouth's `open` is whether its lane
// is open now (a branch closes for most of the year), null when not sent.
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
    for (const k of ["kind", "radius", "orbit", "fit", "edge", "open"]) it[k] ??= null;
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

// Km from the star at wall-clock t (ms), or null when the data can't place it. A ship on the last
// sweep (`index.seen`, set by the chart) is where it saw her, whatever t: she isn't moved on.
export function positionOf(index, id, t, depth = 0) {
  if (depth > DEPTH) return null;
  const pt = parsePoint(id);
  if (pt) {
    const base = positionOf(index, pt.body, t, depth + 1);
    return base && [base[0] + pt.x, base[1] + pt.y];
  }
  const it = index.items.get(id);
  if (!it) return index.seen?.get(id) ?? null; // a ship where the last sweep saw her, in the star's frame
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

// Whether `here`, km from the star, is on the side of a planet centred at `centre` that faces
// the star: straight up from the centre through it, against the way to the star.
const facesStar = (here, centre) => (here[0] - centre[0]) * -here[0] + (here[1] - centre[1]) * -here[1] > 0; // the star is at the origin

// Whether a port on its planet's surface has its star above the horizon at wall-clock t (ms),
// as the game's isDay (planetside.md §4). Null when the charts can't place the town or its planet.
export function daylit(index, id, t) {
  const planet = parentOf(index, id);
  const here = positionOf(index, id, t);
  const centre = planet === null ? null : positionOf(index, planet, t);
  if (!here || !centre) return null;
  return facesStar(here, centre);
}

// Whether her side of the planet she's in high orbit over faces its star at wall-clock t (ms), the
// same way daylit() has it for a town; null when she's not in high orbit or the side isn't known.
export function orbitLit(index, ship, t) {
  const fix = shipFix(index, ship, t);
  if (!fix.orbit || fix.orbit.angle === null) return null;
  const centre = positionOf(index, fix.orbit.planet, t);
  return centre ? facesStar(fix.pos, centre) : null;
}

// The nearest body that holds both, as the game's Orbits.common: a chain starts at the
// item itself (a point's body), so a body is the frame of a trip to its own moon. Every chain
// ends at the system's star, as the game's locationFrame has it: a lane mouth, with no orbit,
// rides with its star.
export function frameOf(index, a, b) {
  const known = (id) => parsePoint(id) || index.items.has(id) || !!index.seen?.has(id);
  if (!known(a) || !known(b)) return null;
  const star = index.items.get(index.system)?.kind === "star" ? index.system : null;
  const above = (id) => {
    const out = [];
    for (let p = parsePoint(id)?.body ?? id; p !== null && out.length < DEPTH; p = parentOf(index, p)) out.push(p);
    if (star !== null && out.at(-1) !== star) out.push(star);
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

// Where a trip's start is at wall-clock t (ms), km from the star, and the id it rides with: a
// place (`from`), a stop (`stop`, below) or the high orbit she left (`from_over`, below). Null
// when unplaceable.
function startOf(index, start, t, depth) {
  if (depth > DEPTH || !start) return null;
  if (start.from) {
    const p = positionOf(index, start.from, t);
    return p && { pos: p, frame: start.from };
  }
  const halt = start.stop ? stopFix(index, start.stop, depth + 1) : start.from_over ? highOrbit(index, start.from_over, depth + 1) : null;
  const f = halt?.off && positionOf(index, halt.frame, t);
  return f ? { pos: [f[0] + halt.off[0], f[1] + halt.off[1]], frame: halt.frame } : null;
}

// Where high orbit over `planet` is, as an offset from its centre, for a trip there from `p` at
// wall-clock t (ms): HIGH_ORBIT radii out on the side she comes in from, as the game's target().
// Null when the charts give the planet no radius.
function ringOffset(index, planet, p, t) {
  const r = HIGH_ORBIT * (num(index.items.get(planet)?.radius) ?? 0);
  const c = positionOf(index, planet, t);
  if (!(r > 0) || !c || !p) return null;
  const v = [p[0] - c[0], p[1] - c[1]];
  const l = Math.hypot(v[0], v[1]);
  return l > 0 ? [(v[0] / l) * r, (v[1] / l) * r] : [r, 0];
}

const isPlanet = (index, id) => index.items.get(id)?.kind === "planet";

// A trip as a straight line in the frame's offsets, times in ms, from a start as startOf() takes
// it; one to a planet ends in high orbit over it. Null when unplaceable.
function legFrom(index, start, destination, depart, arrive, depth) {
  if (depth > DEPTH || !destination) return null;
  const s = startOf(index, start, depart, depth);
  if (!s) return null;
  const frame = frameOf(index, s.frame, destination);
  if (frame === null) return null;
  const rel = (p, t) => {
    const f = positionOf(index, frame, t);
    return p && f && [p[0] - f[0], p[1] - f[1]];
  };
  let end = positionOf(index, destination, arrive);
  const off = isPlanet(index, destination) ? ringOffset(index, destination, s.pos, depart) : null;
  if (end && off) end = [end[0] + off[0], end[1] + off[1]];
  const a = rel(s.pos, depart);
  const b = rel(end, arrive);
  return a && b ? { frame, from: a, to: b, depart, arrive } : null;
}

// High orbit over a planet: the Lua side keeps the trip she came in on (`over`: the planet, or its
// `name` from her status until the charts named it, the
// trip's start as startOf() takes it, and its depart, whole seconds). She rides with the planet,
// `off` from its centre on the side she came from (the game aims from where she was when she set
// out), or null when the trip's not known.
export function highOrbit(index, over, depth = 0) {
  if (!over || typeof over !== "object") return null;
  // her status named it before the charts came: { name }, matched to a planet's name
  const planet = over.planet ?? [...index.items.values()].find((it) => it.kind === "planet" && it.name === over.name)?.id;
  if (!index.items.has(planet)) return null;
  const depart = num(over.depart);
  const s = depart === null ? null : startOf(index, over, depart * 1000, depth + 1);
  return { planet, frame: planet, off: s ? ringOffset(index, planet, s.pos, depart * 1000) : null };
}

// Her trip as a straight line in the frame's offsets, times in ms; null when unplaceable.
export function legOf(index, ship) {
  const { from, stop, from_over, destination } = ship ?? {};
  const received = num(ship?.received);
  const eta = num(ship?.eta);
  if (!(from || stop || from_over) || !destination || received === null || eta === null) return null;
  const progress = Math.min(Math.max(num(ship.progress) ?? 0, 0), 1);
  const arrive = (received + eta) * 1000;
  // the departure the Lua side kept from the trip's first status: worked out again from a late
  // one, progress (rounded to 2 places) would swing it by minutes
  const kept = num(ship.depart);
  const depart = kept !== null ? kept * 1000 : progress >= 1 ? arrive : arrive - (eta / (1 - progress)) * 1000;
  return legFrom(index, { from, stop, from_over }, destination, depart, arrive, 0);
}

// Where a stop mid-trip left her: the Lua side keeps the trip she stopped on (its start, a place
// or an earlier stop, its destination, depart and arrive, whole seconds) and when she stopped
// (`at`). The game leaves her at rest where she was, riding with the body whose reach she's in;
// the charts don't say how far a body reaches, so she rides with the trip's frame, the same
// body unless she stopped close by a deeper one. Her offset `off` from `frame`, and the `leg`
// she stopped on, or null.
export function stopFix(index, stop, depth = 0) {
  if (!stop || typeof stop !== "object") return null;
  const depart = num(stop.depart);
  const arrive = num(stop.arrive);
  const at = num(stop.at);
  if (depart === null || arrive === null || at === null) return null;
  const leg = legFrom(index, stop, stop.destination, depart * 1000, arrive * 1000, depth);
  if (!leg) return null;
  const span = leg.arrive - leg.depart;
  const k = span > 0 ? Math.min(Math.max((at * 1000 - leg.depart) / span, 0), 1) : 1;
  return {
    frame: leg.frame,
    off: [leg.from[0] + (leg.to[0] - leg.from[0]) * k, leg.from[1] + (leg.to[1] - leg.from[1]) * k],
    leg,
  };
}

// Where your ship is at wall-clock t (ms): at a place, moving, searching, bound or none. In high
// orbit she's at the planet, `orbit` saying so: { planet, angle } with angle (radians, y up) from
// its centre to her, or null when her side isn't known, and then pos is the planet's centre.
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
  const over = highOrbit(index, ship.over);
  const c = over && positionOf(index, over.planet, t);
  if (c) {
    const pos = over.off ? [c[0] + over.off[0], c[1] + over.off[1]] : c;
    const angle = over.off ? Math.atan2(over.off[1], over.off[0]) : null;
    return { kind: "at", place: over.planet, pos, orbit: { planet: over.planet, angle } };
  }
  // stopped mid-trip: at rest where she stopped, at no place
  const halt = stopFix(index, ship.stop);
  const f = halt && positionOf(index, halt.frame, t);
  if (f) return { kind: "at", place: null, pos: [f[0] + halt.off[0], f[1] + halt.off[1]], stopped: halt.leg };
  return { kind: "none" };
}

// The course she has plotted (Ship.Course, gmcp.md §8.6) while she's at rest: a line from where
// she is to where it aims, the destination's place at wall-clock ms `at` plus its `seconds`, when
// she'd arrive had she left as it was plotted. The game works the aim out once and doesn't send it,
// so this does the same: fixed in the frame of the nearest body that holds both ends, it rides with
// that body and never follows the destination round. `from` and `to` in km from the star at t (ms),
// or null: under way (her trip line has it), for a ship (the charts don't place her), or where
// either end can't be placed.
export function courseLine(index, ship, course, t) {
  const to = typeof course?.to === "string" ? course.to : null;
  const at = num(course?.at);
  const seconds = num(course?.seconds);
  if (!to || at === null || seconds === null) return null;
  const fix = shipFix(index, ship, t);
  if (fix.kind !== "at" || !fix.pos?.every(Number.isFinite)) return null;
  const here = fix.place ?? stopFix(index, ship.stop)?.frame ?? null;
  const frame = here === null ? null : frameOf(index, here, to);
  if (frame === null) return null;
  const arrive = at + seconds * 1000;
  const d = positionOf(index, to, arrive);
  const fa = positionOf(index, frame, arrive);
  const f = positionOf(index, frame, t);
  if (!d || !fa || !f) return null;
  return { from: fix.pos, to: [f[0] + d[0] - fa[0], f[1] + d[1] - fa[1]], frame, arrive };
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

// The km box [minX, minY, maxX, maxY] to open the chart on; at rest with a course plotted, it
// takes in where the course aims too.
export function homeBox(index, ship, t, course = null) {
  const box = restBox(index, ship, t);
  const line = course ? courseLine(index, ship, course, t) : null;
  if (!line) return box;
  const xs = [box[0], box[2], line.from[0], line.to[0]];
  const ys = [box[1], box[3], line.from[1], line.to[1]];
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 0.1 * Math.max(Math.abs(line.to[0] - line.from[0]), Math.abs(line.to[1] - line.from[1]));
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

function restBox(index, ship, t) {
  const whole = () => {
    const r = 1.08 * systemRadius(index);
    return [-r, -r, r, r];
  };
  const fix = shipFix(index, ship, t);
  // under way, or adrift where she stopped: her and the trip's two ends
  const leg = fix.kind === "moving" ? fix.leg : fix.stopped;
  if (leg) {
    const f = positionOf(index, leg.frame, t);
    if (!f || !fix.pos?.every(Number.isFinite)) return whole();
    const pts = [fix.pos, [f[0] + leg.from[0], f[1] + leg.from[1]], [f[0] + leg.to[0], f[1] + leg.to[1]]];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 0.15 * Math.max(x1 - x0, y1 - y0);
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  }
  if (fix.kind === "at" || fix.kind === "searching") {
    // in high orbit, the planet she's over and what goes round it
    const parent = fix.orbit ? fix.orbit.planet : fix.place ? parentOf(index, fix.place) : null;
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

// True when the game says a lane mouth's lane is closed now; a mouth with no `open` is drawn open.
export const isClosed = (it) => it?.open === false;

// A mouth's name on the chart and its off-view marker: "Petroc", or "Petroc · closed".
export const mouthLabel = (m) => (isClosed(m) ? `${mouthStar(m.name)} · closed` : mouthStar(m.name));

// Where to draw mouths on the edge, their bearings `degs`, so none is nearer another than `gap`
// degrees: a crowd is spread evenly about its middle, in bearing order, and every other mouth stays
// where it is (a spread one may come out past 360°). `groups` are the crowds (and the loners), as indices into degs in bearing order.
export function spreadOnEdge(degs, gap) {
  const n = degs.length;
  if (!n) return { angles: [], groups: [] };
  gap = Math.min(gap, 360 / n);
  const order = degs.map((d, i) => [((d % 360) + 360) % 360, i]).sort((a, b) => a[0] - b[0]);
  const groups = [];
  for (const o of order) {
    const last = groups.at(-1);
    if (last && o[0] - last.at(-1)[0] < gap) last.push(o);
    else groups.push([o]);
  }
  // the last crowd runs on into the first across 0°
  if (groups.length > 1 && groups[0][0][0] + 360 - groups.at(-1).at(-1)[0] < gap) {
    groups.at(-1).push(...groups.shift().map(([d, i]) => [d + 360, i]));
  }
  const angles = degs.slice();
  for (const g of groups) {
    if (g.length < 2) continue;
    const mid = g.reduce((s, [d]) => s + d, 0) / g.length;
    g.forEach(([, i], k) => {
      angles[i] = mid + (k - (g.length - 1) / 2) * gap;
    });
  }
  return { angles, groups: groups.map((g) => g.map(([, i]) => i)) };
}

// Points within d of each other, as indices: each joins the first cluster whose first point is
// within d of it, else starts its own.
export function clusters(points, d) {
  const out = [];
  points.forEach((p, i) => {
    const c = out.find((c) => Math.hypot(points[c[0]][0] - p[0], points[c[0]][1] - p[1]) < d);
    if (c) c.push(i);
    else out.push([i]);
  });
  return out;
}

// Boxes [x0, y0, x1, y1] that overlap, directly or through others, as groups of indices in order;
// two only join if near(i, j) says so too.
export function overlapping(boxes, near = () => true) {
  const root = boxes.map((_, i) => i);
  const find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
  const meet = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = 0; j < i; j++) if (meet(boxes[i], boxes[j]) && near(i, j)) root[find(i)] = find(j);
  }
  const groups = new Map();
  boxes.forEach((_, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  });
  return [...groups.values()];
}
