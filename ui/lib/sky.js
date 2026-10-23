// The sky from the ground: what a port's outdoor rooms and `look sky` say is overhead, worked
// out from the charts exactly as the game's ground.ts (empyreal packages/game/src/systems/
// ground.ts, planetside.md §4) works it out from its orbits, with its thresholds and its words.
// Pure and DOM-free; see docs/superpowers/specs/2026-10-23-zennor-sky-design.md.

/** Degrees either side of the horizon that are dawn or dusk rather than day or night. */
const TWILIGHT = 10;
/** Degrees above the horizon that are overhead. */
const OVERHEAD = 60;
/** How far ahead, in ticks (seconds), rising and heading are judged. */
const SOON = 60;

/** The names the game calls stations by in the sky (their area's `short`), which the charts
 *  don't send: T.I.S.S.'s is content/areas/tiss.yaml's `short:`. Others go by their chart name. */
export const SHORT = { tiss: "T.I.S.S." };

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
const side = (east) => (east ? "east" : "west");
const rad = (deg) => (deg * Math.PI) / 180;
const num = (v, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

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
  const m = rad(num(o.phase)) + (2 * Math.PI * tick) / period;
  let E = m;
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
  const x = a * (Math.cos(E) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const w = rad(num(o.peri));
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

/** Dark, by the star's altitude: below -5, when stations spark and the planets show. */
export const isDark = (alt) => alt < -TWILIGHT / 2;

/** Whether a station or planet at an altitude is in the sky at all: above 0, not on the line. */
export const isUp = (alt) => alt > 0;

/**
 * The sky over a port at wall-clock t (ms), as the game would tell it: Senara's place and
 * sentence, whether it's dark, its band, and each station of the port's planet that's up and,
 * when dark, each other planet that's up, with the whole as the game's text. Null when the
 * charts can't place the port, its planet or its star.
 */
export function groundSky(index, port, t, short = SHORT) {
  try {
    const planet = index?.items.get(port)?.orbit?.parent;
    const star = [...index.items.values()].find((it) => it.kind === "star");
    if (!planet || !star) return null;
    const tick = Math.floor((t - index.epoch) / 1000);
    const pos = (id, tk) => bodyAt(index, id, tk);
    // Where something is in the port's sky at a tick: degrees above its horizon, and which side,
    // east the way the ground turns (anticlockwise: up turned a right angle that way).
    const at = (id, tk) => {
      const here = pos(port, tk);
      const centre = pos(planet, tk);
      const there = pos(id, tk);
      if (!here || !centre || !there) return null;
      const up = unit(sub(here, centre));
      const to = sub(there, here);
      const alt = (Math.asin(Math.max(-1, Math.min(1, dot(up, unit(to))))) * 180) / Math.PI;
      return { alt, east: dot([-up[1], up[0]], to) > 0 };
    };
    const seen = (id) => {
      const now = at(id, tick);
      const soon = at(id, tick + SOON);
      if (!now || !soon) return null;
      return { ...now, rising: soon.alt > now.alt, heading: soon.east };
    };

    const s = seen(star.id);
    if (!s) return null;
    const name = star.name;
    const band = sunBand(s.alt);
    const line = {
      overhead: () => `${name} stands high overhead, small and white, and the shadows are short.`,
      "well up": () => `${name} is well up in the ${side(s.east)} of a pale, dusty sky.`,
      low: () => `${name} is low in the ${side(s.east)}, and the shadows reach long to the ${side(!s.east)}.`,
      up: () =>
        s.rising
          ? `${name} has just come up over the ${side(s.east)}ern horizon, and everything it touches is gold.`
          : `${name} is going down in the ${side(s.east)}, reddened by the dust.`,
      twilight: () =>
        s.rising
          ? `The sky is paling in the ${side(s.east)}: ${name} will be up soon.`
          : `Dusk: the ${side(s.east)} still glows where ${name} went down, and the first stars are out.`,
      night: () => "Night: the sky is black and crowded with stars.",
    }[band]();
    const dark = isDark(s.alt);

    const bodies = [];
    // The stations in orbit of this planet, as they cross.
    for (const it of index.items.values()) {
      if (it.kind !== "station" || it.id === port || it.orbit?.parent !== planet) continue;
      const b = seen(it.id);
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
        if (it.kind !== "planet" || it.id === planet) continue;
        const b = seen(it.id);
        if (!b || !isUp(b.alt)) continue;
        const l =
          b.alt >= OVERHEAD
            ? `${it.name} is a steady golden star high overhead.`
            : `${it.name} is a steady golden star in the ${side(b.east)}.`;
        bodies.push({ id: it.id, kind: "planet", name: it.name, ...b, line: l });
      }

    return {
      sun: { id: star.id, name, alt: s.alt, east: s.east, rising: s.rising, line },
      dark,
      band,
      bodies,
      text: [line, ...bodies.map((b) => b.line)].join(" "),
    };
  } catch {
    return null;
  }
}

/** Degrees along the sky's dome from its western foot, through overhead (90), to its eastern. */
export const skyAngle = (alt, east) => (east ? 180 - alt : alt);

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
  if (sun.alt >= 0) marks.push({ id: sun.id, look: "sun", angle: skyAngle(sun.alt, sun.east), name: sun.name, line: sun.line });
  for (const b of sky.bodies)
    marks.push({
      id: b.id,
      look: b.kind === "planet" ? "gold" : sky.dark ? "spark" : "fleck",
      angle: skyAngle(b.alt, b.east),
      name: b.name,
      line: b.line,
    });
  return {
    tint: SKY_TINTS[band] ?? null,
    stars: band === "night" ? "all" : twilight && !sun.rising ? "few" : "none",
    glow: twilight ? { east: sun.east, kind: sun.rising ? "dawn" : "dusk" } : null,
    hover: sun.line,
    marks,
  };
}
