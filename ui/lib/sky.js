// The sky from the ground: what a port's outdoor rooms and `look sky` say is overhead, worked
// out from the charts exactly as the game's ground.ts (empyreal packages/game/src/systems/
// ground.ts, planetside.md §4, calendar.md §8.2) works it out from its orbits, with its thresholds,
// and each port's own words (world.yaml's, over Zennor's). The star and the planets are seen from
// the port's latitude on its tilted planet, on eight points of the compass; the stations cross as
// from the equator, east or west. Space.Charts carries none of the tilt, the latitude or the
// words: build:data puts them in data/sky.js. Pure and DOM-free; see
// docs/superpowers/specs/2026-10-23-zennor-sky-design.md.

import PORTS from "../data/sky.js";

/** Degrees either side of the horizon that are dawn or dusk rather than day or night. */
const TWILIGHT = 10;
/** Degrees above the horizon that are overhead. */
const OVERHEAD = 60;
/** How far ahead, in ticks (seconds), rising and heading are judged. */
const SOON = 60;

/** The names the game calls stations by in the sky (their area's `short`), which the charts
 *  don't send: T.I.S.S.'s is content/areas/tiss.yaml's `short:`. Others go by their chart name. */
export const SHORT = { tiss: "T.I.S.S." };

/** The compass's eight points, clockwise from north, as ground.ts names them. */
export const POINTS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

const RAD = Math.PI / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
const clamp = (v) => Math.max(-1, Math.min(1, v));
const side = (east) => (east ? "east" : "west");
const num = (v, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** A line with its `{name}`s filled in, as the game's fillWords: an unknown name stays as written. */
export const fillWords = (line, values) => line.replace(/\{(\w+)\}/g, (all, k) => values[k] ?? all);

/**
 * Where a body is at a tick, in its star's frame, by the game's own sum (Orbits.local and bodyPos
 * in empyreal's systems/orbits.ts), not orbits.js's wall-clock one: the two agree to rounding, but
 * at a pass exactly overhead rounding decides whether the game says east or west. Null where the
 * charts can't place it.
 */
function bodyAt(index, id, tick, depth = 0) {
  const it = index.items.get(id);
  if (!it || depth > 8) return null;
  if (it.kind === "star") return [0, 0];
  const o = it.orbit;
  const period = num(o?.period, NaN);
  if (!o || !(period > 0)) return null;
  const base = bodyAt(index, o.parent, tick, depth + 1);
  if (!base) return null;
  const e = num(o.e);
  const a = num(o.a);
  const m = num(o.phase) * RAD + (2 * Math.PI * tick) / period;
  let E = m;
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
  const x = a * (Math.cos(E) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const w = num(o.peri) * RAD;
  return [base[0] + (x * Math.cos(w) - y * Math.sin(w)), base[1] + (x * Math.sin(w) + y * Math.cos(w))];
}

/** Senara's band by its altitude, with ground.ts's comparisons: >= 60, >= 30, >= 10, >= 0, > -10. */
export function sunBand(alt) {
  if (alt >= OVERHEAD) return "overhead";
  if (alt >= TWILIGHT * 3) return "well up";
  if (alt >= TWILIGHT) return "low";
  if (alt >= 0) return "up";
  if (alt > -TWILIGHT) return "twilight";
  return "night";
}

/** Where the sun is over a port, as ground.ts's sunPhase (time.md §4.1) and `time` have it: day
 *  from 10 up, night below -10, and between, dawn while it climbs and dusk while it sinks. */
export function sunPhase(alt, rising) {
  if (alt >= TWILIGHT) return "day";
  if (alt > -TWILIGHT) return rising ? "dawn" : "dusk";
  return "night";
}

/** Dark, by the star's altitude: below -5, when stations spark and the planets show. */
export const isDark = (alt) => alt < -TWILIGHT / 2;

/** Whether a station or planet at an altitude is in the sky at all: above 0, not on the line. */
export const isUp = (alt) => alt > 0;

/** The word for each of the star's bands, by which way it's going where that matters. */
const WORD = { overhead: () => "high", "well up": () => "up", low: () => "low", up: (r) => (r ? "rises" : "sets"), twilight: (r) => (r ? "paling" : "dusk"), night: () => "night" };

/**
 * A port's sky, for asking where things are in it at a tick: null when the charts can't place the
 * port or its planet, or there's no sky for it in `ports` (data/sky.js's shape).
 */
function portSky(index, port, ports) {
  const p = ports?.[port];
  const planet = index?.items.get(port)?.orbit?.parent;
  if (!p || !planet || planet !== p.planet) return null;
  const tilt = num(p.tilt) * RAD;
  const lat = num(p.latitude) * RAD;
  const equinox = num(p.equinox) * RAD;
  // The way up from the planet's centre through the port, and the way to a body, at a tick.
  const look = (id, tk) => {
    const here = bodyAt(index, port, tk);
    const centre = bodyAt(index, planet, tk);
    const there = bodyAt(index, id, tk);
    if (!here || !centre || !there) return null;
    return { up: unit(sub(here, centre)), to: sub(there, here) };
  };
  /** As ground.ts's seen(), for the stations: from the equator, east the way the ground turns
   *  (anticlockwise: up turned a right angle that way). */
  const seenAt = (id, tk) => {
    const l = look(id, tk);
    if (!l) return null;
    return { alt: Math.asin(clamp(dot(l.up, unit(l.to)))) / RAD, east: dot([-l.up[1], l.up[0]], l.to) > 0 };
  };
  /** As ground.ts's sky(), for the star and the planets: its declination the tilt by how far its
   *  direction is past the spring equinox's sun, its hour angle the turn of the ground, its height
   *  and point the latitude's. `e` and `n` are its way east and north along the ground, and `u` up. */
  const skyAt = (id, tk) => {
    const l = look(id, tk);
    if (!l) return null;
    const to = unit(l.to);
    const west = dot([-l.up[1], l.up[0]], to) <= 0; // west of the meridian, the hour angle's positive
    const h = Math.acos(clamp(dot(l.up, to))) * (west ? 1 : -1);
    const along = Math.atan2(to[1], to[0]) - equinox - Math.PI;
    const dec = Math.asin(Math.sin(tilt) * Math.sin(along));
    const e = -Math.cos(dec) * Math.sin(h);
    const n = Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(h);
    const u = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h);
    return { alt: Math.asin(clamp(u)) / RAD, e, n, u };
  };
  return {
    planet,
    words: p.words ?? {},
    seen(id, tick) {
      const now = seenAt(id, tick);
      const soon = seenAt(id, tick + SOON);
      if (!now || !soon) return null;
      return { ...now, rising: soon.alt > now.alt, heading: soon.east };
    },
    sky(id, tick) {
      const now = skyAt(id, tick);
      const soon = skyAt(id, tick + SOON);
      if (!now || !soon) return null;
      const point = Math.round((Math.atan2(now.e, now.n) / RAD + 360) / 45) % 8;
      return { ...now, east: now.e > 0, dir: POINTS[point], away: POINTS[(point + 4) % 8], rising: soon.alt > now.alt };
    },
  };
}

const starOf = (index) => [...(index?.items.values() ?? [])].find((it) => it.kind === "star");
const tickOf = (index, t) => Math.floor((t - index.epoch) / 1000);

/**
 * The star's height over a port at wall-clock t (ms), in degrees, as ground.ts's sky() has it: above
 * 0 is the game's isDay. Null when the charts or data/sky.js can't place the port.
 */
export function sunAlt(index, port, t, { ports = PORTS } = {}) {
  try {
    const sky = portSky(index, port, ports);
    const star = starOf(index);
    return (sky && star && sky.sky(star.id, tickOf(index, t))?.alt) ?? null;
  } catch {
    return null;
  }
}

/**
 * The sky over a port at wall-clock t (ms), as the game would tell it, in the port's own words:
 * the star's place (`alt`, its compass point `dir`, the one opposite `away`, its way `e` east and
 * `n` north) and sentence, whether it's dark, its band, and each station of the port's planet
 * that's up and, when dark, each other planet that's up, with the whole as the game's text. Null
 * when the charts can't place the port, its planet or its star, or there's no sky for the port in
 * `ports` (data/sky.js's, by default).
 */
export function groundSky(index, port, t, { ports = PORTS, short = SHORT } = {}) {
  try {
    const sky = portSky(index, port, ports);
    const star = starOf(index);
    if (!sky || !star) return null;
    const tick = tickOf(index, t);
    const s = sky.sky(star.id, tick);
    if (!s) return null;
    const name = star.name;
    const band = sunBand(s.alt);
    const said = sky.words[WORD[band](s.rising)];
    if (typeof said !== "string") return null;
    const line = fillWords(said, { star: name, dir: s.dir, away: s.away });
    const dark = isDark(s.alt);

    const bodies = [];
    // The stations in orbit of this planet, as they cross.
    for (const it of index.items.values()) {
      if (it.kind !== "station" || it.id === port || it.orbit?.parent !== sky.planet) continue;
      const b = sky.seen(it.id, tick);
      if (!b || !isUp(b.alt)) continue;
      const nm = short[it.id] ?? it.name;
      const look = dark ? "a bright, steady spark" : "a pale fleck against the sky";
      const l =
        b.alt >= OVERHEAD
          ? `${nm} is passing overhead, ${look}, heading ${side(b.heading)}.`
          : b.rising
            ? `${nm} is climbing up out of the ${side(b.east)}, ${look}.`
            : `${nm} is sinking toward the ${side(b.east)}, ${look}.`;
      bodies.push({ id: it.id, kind: "station", name: nm, ...b, line: l });
    }
    // At night, the other planets that are up.
    if (dark)
      for (const it of index.items.values()) {
        if (it.kind !== "planet" || it.id === sky.planet) continue;
        const b = sky.sky(it.id, tick);
        if (!b || !isUp(b.alt)) continue;
        const l = b.alt >= OVERHEAD ? `${it.name} is a steady golden star high overhead.` : `${it.name} is a steady golden star in the ${b.dir}.`;
        bodies.push({ id: it.id, kind: "planet", name: it.name, ...b, line: l });
      }

    return {
      sun: { id: star.id, name, ...s, line },
      dark,
      band,
      bodies,
      text: [line, ...bodies.map((b) => b.line)].join(" "),
    };
  } catch {
    return null;
  }
}

/**
 * Where something is on the sky's dome, which looks north with west on the left: its east-west
 * part across, from -1 at the western foot to 1 at the eastern, and its height up, 0 on the horizon
 * to 1 overhead, the north-south part dropped. A station, which the game sees from the equator, is
 * on the dome's arc; the star and a planet, seen from the port's latitude, may be inside it, as
 * the noon sun is, due south. [x, y].
 */
export function skyAt(body) {
  if (typeof body.e === "number") return [body.e, Math.sin((body.alt * Math.PI) / 180)];
  const a = (body.alt * Math.PI) / 180;
  return [(body.east ? 1 : -1) * Math.cos(a), Math.sin(a)];
}

/** The dome's tint in each band Senara is up in, a step lighter as it climbs: dark, dusty
 *  blue-greys, since the scene is always dark (style guide §4). None at twilight or night. */
export const SKY_TINTS = { up: "#1c2430", low: "#232d3a", "well up": "#2c3846", overhead: "#364455" };

/**
 * What the dome draws for a sky from groundSky(): its tint, its stars and its glow, stepped
 * with the game's band so they say no more than its words ("the first stars are out" at dusk,
 * none named at dawn), the empty sky's hover (Senara's line), and a mark for each thing the
 * words name, where they put it: Senara while it's up, the stations as a spark when dark and a
 * fleck when not, the planets as gold.
 */
export function skyScene(sky) {
  const { sun, band } = sky;
  const twilight = band === "twilight";
  const marks = [];
  if (sun.alt >= 0) marks.push({ id: sun.id, look: "sun", at: skyAt(sun), name: sun.name, line: sun.line });
  for (const b of sky.bodies)
    marks.push({
      id: b.id,
      look: b.kind === "planet" ? "gold" : sky.dark ? "spark" : "fleck",
      at: skyAt(b),
      name: b.name,
      line: b.line,
    });
  return {
    tint: SKY_TINTS[band] ?? null,
    stars: band === "night" ? "all" : twilight && !sun.rising ? "few" : "none",
    glow: twilight ? { east: sun.east, x: skyAt(sun)[0], kind: sun.rising ? "dawn" : "dusk" } : null,
    hover: sun.line,
    marks,
  };
}
