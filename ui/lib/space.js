// The overview's space scenes, as plain data: a starfield seen looking ahead (still when parked,
// streaming when travelling), low-poly rocks drifting past at a belt, with what the ship's sensors
// and laser are doing there, over a port the town on its planet's face below, and in high orbit the
// planet's face, rounder from up there, with cloud on it. No DOM here; the canvas drawing is in space-view.js.

const PARKED = 0.01; // the parked starfield barely drifts

/**
 * What the view eases toward for a scene: space shown, rocks shown, a port's ground shown, the
 * planet's face from high orbit shown, star speed (0..1).
 */
export function targets(scene) {
  switch (scene) {
    case "parked":
      return { space: 1, belt: 0, ground: 0, orbit: 0, speed: PARKED };
    case "travelling":
      return { space: 1, belt: 0, ground: 0, orbit: 0, speed: 1 };
    case "belt":
      return { space: 1, belt: 1, ground: 0, orbit: 0, speed: 0 };
    case "port":
      return { space: 1, belt: 0, ground: 1, orbit: 0, speed: PARKED };
    case "orbit":
      return { space: 1, belt: 0, ground: 0, orbit: 1, speed: PARKED };
    default:
      return { space: 0, belt: 0, ground: 0, orbit: 0, speed: 0 };
  }
}

/**
 * How lit the face below is for daylight() true, false or null (unknown): the day side, the
 * night side, or a dusk between when nothing says which side she's on.
 */
export const litFor = (day) => (day === null ? 0.5 : day ? 1 : 0);

/** Ease v toward target at `rate` per second, frame-rate independent; snaps when close. */
export function approach(v, target, dt, rate) {
  const next = target + (v - target) * Math.exp(-rate * Math.max(0, dt));
  return Math.abs(next - target) < 1e-3 ? target : next;
}

/**
 * Ms between frames once the view has settled on target t (every ease done, no dock or undock
 * under way), with `shown` the work() at a belt: parked or in high orbit the stars barely drift, so
 * a few frames a second do; over a port its beacons blink, so a few more; at a belt the rocks drift
 * past smoothly enough at 30 frames a second, but not while the laser cuts (its flicker) or
 * she moves (the rocks flow fast). Travelling the stars stream: 0, every frame the display gives.
 */
export function frameGap(t, shown = null) {
  if (t.space === 0 || t.speed > PARKED) return 0;
  if (t.belt) return shown?.cut || shown?.moving ? 0 : 1000 / 30;
  if (t.ground) return 1000 / 15;
  return 1000 / 10;
}

// --- docking and undocking -------------------------------------------------------------------

const FAR = 12; // backed out of the berth, the station is 1/FAR of its size as docked
const FADE_FROM = 0.8; // how far away the station starts to fade into the stars

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

/**
 * How far away the station is (0 as docked, 1 backed out of the berth) at `now`, for a dock or an
 * undock timed `{ verb, start, end }` in ms: undocking it falls away over the run, docking it
 * draws near, eased at both ends. Past its end it holds there, as a dock does while the drift
 * call keeps her waiting; anything else is null.
 */
export function awayAt(m, now) {
  if (!m || (m.verb !== "dock" && m.verb !== "undock")) return null;
  const span = m.end - m.start;
  const p = span > 0 ? clamp01((now - m.start) / span) : 1;
  return m.verb === "undock" ? smooth(p) : 1 - smooth(p);
}

/**
 * How the overview draws the station at distance `away`: `zoom`, how many times wider than its
 * docked framing the model's view is (it shrinks by as much); `model`, its opacity, fading into
 * the stars at the far end; and `stars`, the parked starfield's alpha over it, the model's own
 * backdrop of stars showing the rest.
 */
export function awayLook(away) {
  const a = clamp01(away);
  return { zoom: 1 + (FAR - 1) * a, model: 1 - smooth(clamp01((a - FADE_FROM) / (1 - FADE_FROM))), stars: a };
}

const NEAR = 0.02;
const RUSH = 0.45; // depth per second at full speed

/** Stars in a unit box ahead of the camera, z in (0, 1]; nearer stars are brighter. */
export class Starfield {
  constructor(n, rnd) {
    this.rnd = rnd;
    this.stars = Array.from({ length: n }, () => this.spawn(NEAR + rnd() * (1 - NEAR)));
    this.streaks = new Float64Array(n * 6); // segments()'s, reused frame to frame
  }

  /** A star at depth z, somewhere new: into `s` when given (a star recycled), else a new one. */
  spawn(z, s = {}) {
    s.x = this.rnd() * 2 - 1;
    s.y = this.rnd() * 2 - 1;
    s.z = z;
    s.pz = z;
    return s;
  }

  /**
   * Bring the stars dt seconds nearer at `speed`, each streaking back to where it was `trail`
   * seconds before: the step itself, unless the view draws less often than the display does and
   * keeps its streaks a display frame long.
   */
  step(dt, speed, trail = dt) {
    const dz = speed * RUSH * dt;
    if (dz === 0) return;
    const back = speed * RUSH * trail;
    for (const s of this.stars) {
      const z = s.z - dz;
      if (z <= NEAR) {
        this.spawn(1, s);
        continue;
      }
      s.pz = trail === dt ? s.z : z + back;
      s.z = z;
    }
  }

  /**
   * Streaks for a w×h view into `streaks`, six numbers each (x0, y0, x1, y1, alpha, width), and how
   * many; off-screen stars are respawned.
   */
  segments(w, h) {
    const f = w * 0.25;
    const out = this.streaks;
    let n = 0;
    for (const s of this.stars) {
      const x1 = w / 2 + (s.x / s.z) * f;
      const y1 = h / 2 + (s.y / s.z) * f;
      if (x1 < 0 || x1 > w || y1 < 0 || y1 > h) {
        this.spawn(1, s);
        continue;
      }
      const near = 1 - s.z;
      out[n] = w / 2 + (s.x / s.pz) * f;
      out[n + 1] = h / 2 + (s.y / s.pz) * f;
      out[n + 2] = x1;
      out[n + 3] = y1;
      out[n + 4] = Math.min(1, near * 1.4);
      out[n + 5] = Math.max(0.6, near * 2);
      n += 6;
    }
    return n / 6;
  }
}

// --- low-poly rocks --------------------------------------------------------------------------

const LIGHT = (() => {
  const v = [-0.5, 0.75, 0.45]; // as the station model's light
  const m = Math.hypot(...v);
  return v.map((c) => c / m);
})();

const ICO = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  return { v: v.map((p) => { const m = Math.hypot(...p); return p.map((c) => c / m); }), f };
})();

/** A lumpy, squashed icosahedron, unit-ish size. */
export function makeRock(rnd) {
  const sx = 0.7 + rnd() * 0.6;
  const sy = 0.6 + rnd() * 0.4;
  const sz = 0.7 + rnd() * 0.5;
  return ICO.v.map(([x, y, z]) => {
    const k = 0.72 + rnd() * 0.4;
    return [x * k * sx, y * k * sy, z * k * sz];
  });
}

function rotate([x, y, z], a, b) {
  let c = Math.cos(a);
  let s = Math.sin(a);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(b);
  s = Math.sin(b);
  return [x * c + z * s, y, -x * s + z * c];
}

/** The rock's camera-facing faces turned by (a, b), far to near, each with a tone index 0..2. */
export function rockFaces(rock, a, b) {
  const p = rock.map((v) => rotate(v, a, b));
  const faces = [];
  for (const [i, j, k] of ICO.f) {
    const A = p[i];
    const B = p[j];
    const C = p[k];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const m = Math.hypot(...n) || 1;
    if (n[2] <= 0) continue;
    const lit = (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / m;
    faces.push({ pts: [A, B, C], tone: lit > 0.66 ? 2 : lit > 0.33 ? 1 : 0, z: (A[2] + B[2] + C[2]) / 3 });
  }
  return faces.sort((f, g) => f.z - g.z);
}

/**
 * Rocks tumbling right to left; d is nearness (0 far .. 1 near), kept sorted far to near. One may
 * be held still (hold()) while the ship works it: she's come alongside, so it stops drifting.
 */
const MOVE_PX = 30; // px a second the farthest rocks flow past at her full pace
const MOVE_PX_NEAR = 110; // and how much faster the nearest go
const GO_RATE = 1.6; // per second: easing into and out of the flow
const TURN_RATE = 2; // per second: the flow turning to a new heading

export class Belt {
  constructor(n, rnd) {
    this.rnd = rnd;
    this.n = n;
    this.rocks = null;
    this.ids = 0;
    this.held = null; // the held rock's id
    this.go = 0; // 0 drifting idly, 1 her moving at the thrusters' pace; eases between
    this.dir = [0, -1]; // her heading in the view, a unit vector (y down), eased round
  }

  spawn(x, h, y = 10 + this.rnd() * Math.max(0, h - 20)) {
    const r = this.rnd;
    const d = 0.2 + r() * 0.8;
    return {
      id: this.ids++,
      shape: makeRock(r),
      d,
      x,
      y,
      size: 6 + d * d * 34,
      a: r() * 6,
      b: r() * 6,
      wa: r() * 1.2 - 0.6,
      wb: r() * 1.2 - 0.6,
    };
  }

  /** A rock's px a second: the idle drift leftward, giving way to the flow opposite her heading. */
  flow(d) {
    const idle = 6 + d * 22;
    const fast = MOVE_PX + d * MOVE_PX_NEAR;
    return [-idle * (1 - this.go) - this.dir[0] * fast * this.go, -this.dir[1] * fast * this.go];
  }

  /** A rock coming into a w×h view from the edge she's heading for, as the rocks flow now. */
  enter(w, h) {
    const [fx, fy] = this.flow(0.6);
    const r = this.rnd;
    if (r() * (Math.abs(fx) + Math.abs(fy)) < Math.abs(fx)) return this.spawn(fx < 0 ? w + 60 : -60, h);
    const k = this.spawn(-40 + r() * (w + 80), h);
    return { ...k, y: fy < 0 ? h + k.size + 4 : -k.size - 4 }; // just out of sight: the band is short
  }

  /**
   * Advance dt seconds in a w×h view; the first call scatters the rocks across it. `heading`, a unit
   * vector in the view (y down), is her moving that way: the rocks ease into flowing past the other
   * way; null eases them back to the idle drift. A held rock stays put.
   */
  step(dt, w, h, heading = null) {
    if (!this.rocks) this.rocks = Array.from({ length: this.n }, () => this.spawn(-40 + this.rnd() * (w + 80), h));
    this.go = approach(this.go, heading ? 1 : 0, dt, GO_RATE);
    if (heading) {
      const t = 1 - Math.exp(-TURN_RATE * Math.max(0, dt));
      const x = this.dir[0] + (heading[0] - this.dir[0]) * t;
      const y = this.dir[1] + (heading[1] - this.dir[1]) * t;
      const n = Math.hypot(x, y);
      this.dir = n > 1e-6 ? [x / n, y / n] : [heading[0], heading[1]];
    }
    this.rocks = this.rocks.map((k) => {
      if (k.id === this.held) return { ...k, a: k.a + k.wa * dt, b: k.b + k.wb * dt };
      const [vx, vy] = this.flow(k.d);
      const x = k.x + vx * dt;
      const y = k.y + vy * dt;
      const m = k.size * 2;
      // gone past an edge and not coming back: in again from the edge ahead
      if ((x < -m && vx <= 0) || (x > w + m && vx >= 0) || (y < -m && vy <= 0) || (y > h + m && vy >= 0)) return this.enter(w, h);
      return { ...k, x, y, a: k.a + k.wa * dt, b: k.b + k.wb * dt };
    });
    this.rocks.sort((p, q) => p.d - q.d);
  }

  /**
   * While `want`, the rock held still in a w×h view: the one already held, or a near one nearest
   * the middle (any nearest it if none is near and central). Not a rock the game told of: the
   * belt's rocks are scenery, and this is only somewhere for the work to be seen. Null otherwise.
   */
  hold(want, w, h) {
    if (!want || !this.rocks) {
      this.held = null;
      return null;
    }
    const mid = (k) => Math.hypot(k.x - w / 2, k.y - h / 2);
    let k = this.rocks.find((r) => r.id === this.held);
    if (!k) {
      const near = this.rocks.filter((r) => r.d > 0.55 && r.x > w * 0.15 && r.x < w * 0.85);
      k = (near.length ? near : this.rocks).reduce((a, b) => (mid(b) < mid(a) ? b : a));
      this.held = k.id;
    }
    return k;
  }
}

// --- the ship's work at a belt -------------------------------------------------------------

const PAR = { scan: 10, assay: 20 }; // actions.yaml's, for a sweep with no end given
// Closing on a rock has no verb of its own: the laser is busy `mine` from the order, and only the
// place changing says she's moving. Lua stamps it in whole seconds and the game sends it a tick
// apart (one may be skipped when the tenth-km rounding stalls), so she's still this long after.
const SETTLE = 2.5;

function timed(a, now) {
  const since = Number(a.since);
  const ends = Number(a.ends);
  if (!Number.isFinite(since)) return null;
  if (a.ends == null || !Number.isFinite(ends)) return { p: (((now - since) / PAR[a.busy]) % 1 + 1) % 1, left: null };
  const p = ends > since ? Math.min(1, Math.max(0, (now - since) / (ends - since))) : 1;
  return { p, left: Math.max(0, Math.ceil(ends - Math.max(now, since))) };
}

/**
 * What the belt scene shows of the work message (src/station_map/work.lua) at local time `now`,
 * in seconds: the sensors' sweep or assay, each { p: 0..1 through, left: whole seconds or null },
 * whether the laser is cutting, and whether she's moving in the belt, { way, closing }: the
 * thrusters under way, or closing on the rock she's to cut (no beam until she's beside it). `way`
 * is degrees from straight out from the core, null until the place first changes. Only that the
 * work is happening and how long is left: nothing here places a rock.
 */
export function work(msg, now) {
  const s = msg?.sensors;
  const scanning = s?.busy === "scan" || s?.busy === "assay";
  const t = scanning ? timed(s, now) : null;
  const mine = msg?.laser?.busy === "mine";
  const since = num(msg?.laser?.since);
  const moved = num(msg?.belt?.moved);
  // the place changed since the cut was ordered, and lately: she's still closing on the rock
  const closing = mine && since !== null && moved !== null && moved >= since && now - moved < SETTLE;
  // the order just in: hold the beam until it's clear whether she's to close on the rock first
  const settling = mine && !closing && since !== null && now - since < SETTLE;
  const rcs = msg?.nav?.busy === "rcs";
  return {
    sweep: s?.busy === "scan" ? t : null,
    assay: s?.busy === "assay" ? t : null,
    cut: mine && !closing && !settling,
    moving: rcs || closing ? { way: num(msg?.belt?.way), closing } : null,
  };
}

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Her heading in the view for a way in degrees from straight out from the core: out is up (y down). */
export function heading(way) {
  const a = (way * Math.PI) / 180;
  return [Math.sin(a), -Math.cos(a)];
}

/**
 * The ship's move for the deck band's corner card, as actionCard() gives a card, at `now` in ms:
 * the thrusters under way, which way and the seconds left, or closing on a rock with no seconds
 * (the game gives none), with `recheck` the ms until she may have stopped; null while she's still.
 */
export function moveCard(msg, now) {
  const m = work(msg, now / 1000).moving;
  if (!m) return null;
  if (m.closing) {
    const t = msg.belt?.target;
    const label = typeof t === "string" && t ? `closing on ${t}` : "closing on the rock";
    return { label, detail: "", seconds: null, fraction: null, ms: null, recheck: Math.max(0, (msg.belt.moved + SETTLE) * 1000 - now) };
  }
  const w = m.way;
  const label = w === null ? "thrusters" : Math.abs(w) <= 30 ? "thrusters, out from the core" : Math.abs(w) >= 150 ? "thrusters, in toward the core" : "thrusters, on a new heading";
  const since = num(msg.nav.since);
  const ends = num(msg.nav.ends);
  if (since === null || ends === null) return { label, detail: "", seconds: null, fraction: null, ms: null, recheck: null };
  const ms = Math.max(0, ends * 1000 - now);
  const total = ends - since;
  const fraction = total > 0 ? Math.min(1, ms / (total * 1000)) : 0;
  return { label, detail: "", seconds: Math.ceil(ms / 1000), fraction, ms, recheck: null };
}

/** The dim lines in the scene's corner, top to bottom: "cutting", "sweeping · 6 s", "assaying · 8 s". */
export function workLines(w) {
  const secs = (verb, t) => (t.left ? `${verb} · ${t.left} s` : verb);
  const out = [];
  if (w.cut) out.push("cutting");
  if (w.sweep) out.push(secs("sweeping", w.sweep));
  if (w.assay) out.push(secs("assaying", w.assay));
  return out;
}

// --- a town below --------------------------------------------------------------------------

/**
 * A port seen from above, in units of the landing field's width about its centre (y down): the
 * field, low roofs round it, the lamps that show at night and a beacon at each of the field's
 * corners, and dusty patches on the ground about it.
 */
export class Town {
  constructor(rnd) {
    const field = { w: 1, h: 0.4 };
    const outside = (x, y, m) => Math.abs(x) > field.w / 2 + m || Math.abs(y) > field.h / 2 + m;
    const scatter = (n, m, make) => {
      const out = [];
      while (out.length < n) {
        const x = (rnd() - 0.5) * 2.2;
        const y = (rnd() - 0.5) * 1.3;
        if (outside(x, y, m)) out.push(make(x, y));
      }
      return out;
    };
    this.field = field;
    this.pads = [-1 / 3, 0, 1 / 3];
    this.roofs = scatter(26, 0.06, (x, y) => ({ x, y, w: 0.06 + rnd() * 0.13, h: 0.04 + rnd() * 0.09, tone: 1 + Math.floor(rnd() * 2) }));
    this.lamps = scatter(40, 0, (x, y) => ({ x, y, a: 0.35 + rnd() * 0.6 }));
    this.beacons = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => ({ x: (sx * field.w) / 2, y: (sy * field.h) / 2, at: i * 0.25 }));
    this.dust = Array.from({ length: 30 }, () => ({ x: rnd(), y: rnd(), rx: 10 + rnd() * 40, ry: 3 + rnd() * 8, a: rnd() }));
  }
}

// --- a planet from high orbit ----------------------------------------------------------------

/**
 * Cloud on a planet's face seen from high orbit: bands lying along the curve, each an arc about
 * the planet's centre `d` (0 the limb .. 1 the band's foot) down from the limb, centred `a`
 * radians either side of straight down the view, `len` radians long either way, `w` px thick and
 * `alpha` strong by day. Scenery, the same for every planet: the game says nothing of its weather.
 */
export function clouds(n, rnd) {
  return Array.from({ length: n }, () => ({
    d: rnd(),
    a: (rnd() - 0.5) * 1.3,
    len: 0.04 + rnd() * 0.14,
    w: 1.5 + rnd() * 3,
    alpha: 0.04 + rnd() * 0.07,
  }));
}
