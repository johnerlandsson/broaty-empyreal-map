// The overview's space scenes, as plain data: a starfield seen looking ahead (still when parked,
// streaming when travelling), low-poly rocks drifting past at a belt, with what the ship's sensors
// and laser are doing there, and over a port the town on its planet's face below. No DOM here; the canvas
// drawing is in space-view.js.

const PARKED = 0.01; // the parked starfield barely drifts

/** What the view eases toward for a scene: space shown, rocks shown, ground shown, star speed (0..1). */
export function targets(scene) {
  switch (scene) {
    case "parked":
      return { space: 1, belt: 0, ground: 0, speed: PARKED };
    case "travelling":
      return { space: 1, belt: 0, ground: 0, speed: 1 };
    case "belt":
      return { space: 1, belt: 1, ground: 0, speed: 0 };
    case "port":
      return { space: 1, belt: 0, ground: 1, speed: PARKED };
    default:
      return { space: 0, belt: 0, ground: 0, speed: 0 };
  }
}

/** Ease v toward target at `rate` per second, frame-rate independent; snaps when close. */
export function approach(v, target, dt, rate) {
  const next = target + (v - target) * Math.exp(-rate * Math.max(0, dt));
  return Math.abs(next - target) < 1e-3 ? target : next;
}

const NEAR = 0.02;
const RUSH = 0.45; // depth per second at full speed

/** Stars in a unit box ahead of the camera, z in (0, 1]; nearer stars are brighter. */
export class Starfield {
  constructor(n, rnd) {
    this.rnd = rnd;
    this.stars = Array.from({ length: n }, () => this.spawn(NEAR + rnd() * (1 - NEAR)));
  }

  spawn(z) {
    return { x: this.rnd() * 2 - 1, y: this.rnd() * 2 - 1, z, pz: z };
  }

  step(dt, speed) {
    const dz = speed * RUSH * dt;
    if (dz === 0) return;
    this.stars.forEach((s, i) => {
      const z = s.z - dz;
      this.stars[i] = z <= NEAR ? this.spawn(1) : { ...s, pz: s.z, z };
    });
  }

  /** Streaks as [x0, y0, x1, y1, alpha, width] for a w×h view; off-screen stars are respawned. */
  segments(w, h) {
    const f = w * 0.25;
    const out = [];
    this.stars.forEach((s, i) => {
      const x1 = w / 2 + (s.x / s.z) * f;
      const y1 = h / 2 + (s.y / s.z) * f;
      if (x1 < 0 || x1 > w || y1 < 0 || y1 > h) {
        this.stars[i] = this.spawn(1);
        return;
      }
      const near = 1 - s.z;
      out.push([w / 2 + (s.x / s.pz) * f, h / 2 + (s.y / s.pz) * f, x1, y1, Math.min(1, near * 1.4), Math.max(0.6, near * 2)]);
    });
    return out;
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
export class Belt {
  constructor(n, rnd) {
    this.rnd = rnd;
    this.n = n;
    this.rocks = null;
    this.ids = 0;
    this.held = null; // the held rock's id
  }

  spawn(x, h) {
    const r = this.rnd;
    const d = 0.2 + r() * 0.8;
    return {
      id: this.ids++,
      shape: makeRock(r),
      d,
      x,
      y: 10 + r() * Math.max(0, h - 20),
      size: 6 + d * d * 34,
      a: r() * 6,
      b: r() * 6,
      wa: r() * 1.2 - 0.6,
      wb: r() * 1.2 - 0.6,
    };
  }

  /** Advance dt seconds in a w×h view; the first call scatters the rocks across it. */
  step(dt, w, h) {
    if (!this.rocks) this.rocks = Array.from({ length: this.n }, () => this.spawn(-40 + this.rnd() * (w + 80), h));
    this.rocks = this.rocks.map((k) => {
      const x = k.id === this.held ? k.x : k.x - (6 + k.d * 22) * dt;
      if (x < -k.size * 2) return this.spawn(w + 60, h);
      return { ...k, x, a: k.a + k.wa * dt, b: k.b + k.wb * dt };
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
 * and whether the laser is cutting. Only that the work is happening and how long is left.
 */
export function work(msg, now) {
  const s = msg?.sensors;
  const scanning = s?.busy === "scan" || s?.busy === "assay";
  const t = scanning ? timed(s, now) : null;
  return {
    sweep: s?.busy === "scan" ? t : null,
    assay: s?.busy === "assay" ? t : null,
    cut: msg?.laser?.busy === "mine",
  };
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
