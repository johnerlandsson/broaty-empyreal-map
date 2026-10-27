// The overview away from the station: a canvas over the station model showing the starfield, the
// belt with the ship's work in it (the sensors' sweep, an assay held on a rock, the laser cutting
// one, and the seconds left; the rocks flowing past while her thrusters move her or she closes on
// the rock to cut, out from the core up the view), over a port the town on its planet's face below, lit or dark as
// its star is up or not, or in high orbit the planet's face, rounder from up there, with cloud on it, lit
// or dark as her side faces its star (a dusk between when that's not known); no controls. It fades in over the model (hiding its zoom buttons),
// eases the stars' speed and cross-fades stars and rocks; the frame loop runs only while
// something is on screen, and pauses while the panel is hidden or the system chart covers it.
// Once a scene has settled it draws only as often as what moves in it needs (frameGap), idle on a
// timer between.
// Docking and undocking, it turns see-through over the station model, which shrinks into the
// parked starfield or grows out of it on the game's clock (setManoeuvre, onAway); one stopped
// early eases back to the scene's own picture.

import { daylit, orbitLit } from "./lib/orbits.js";
import { Belt, Starfield, Town, approach, awayAt, awayLook, clouds, frameGap, heading, litFor, rockFaces, targets, work, workLines } from "./lib/space.js";
import { rng } from "./lib/svg.js";

const BG = "#04060c";
const TONES = ["#3a4556", "#58667b", "#7e8da3"]; // the station model's
const EDGE = "#0d1218";
const STAR = "223,231,241";
const FADE = 2.5; // per second: space in and out, stars to rocks, the ground in and out
const SPEED = 0.9; // per second: the stars speeding up and slowing down
const DUSK = 1; // per second: day to night on the ground below, and back
const DRIFT = targets("parked").speed; // the parked stars' drift, theirs as they show through
const BACK = 1.5; // per second: a dock or an undock stopped early, the station back where it was
const LOOK = 1000; // ms between asking whether the face below is in daylight
const STALL = 0.25; // s: the longest step taken at once, after the page stalls
// the planet's face: [top, upper, bottom] of its gradient, by day and by night
const DAY = ["#6e5a44", "#8a7052", "#5c4936"];
const NIGHT = ["#121821", "#0e131b", "#080b11"];
const FIELD = "#b89a74"; // the landing field's dust, the room colour (style guide §4)
const PAD = "#e3d3b8";
const LAMP = "255,217,138"; // the Porthole colour
const BEACON = "232,176,74"; // the busy status light
const RIM = "207,227,255"; // Glass: the thin air at the limb
const SENSE = "89,209,138"; // the ok status light: the sensors' sweep and assay
const BEAM = "207,227,255"; // Glass, the laser's beam, round a white core
const DIM = "#7d8a9a"; // the seconds left, bottom right
const CLOUD = "232,220,200"; // the bands on the face from high orbit
const HAZE = 16; // px of thin air glowing over the limb from high orbit, by day

export class SpaceView {
  /** @param {HTMLElement} containerEl the overview band, already holding the station model */
  constructor(containerEl) {
    const cv = document.createElement("canvas");
    Object.assign(cv.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "3",
      opacity: "0",
      pointerEvents: "none",
    });
    containerEl.appendChild(cv);
    this.cv = cv;
    this.g = cv.getContext("2d");

    const r = rng(42);
    this.field = new Starfield(220, r);
    this.belt = new Belt(14, r);
    this.far = Array.from({ length: 90 }, () => [r(), r(), 0.2 + r() * 0.5]); // the belt's backdrop
    this.town = new Town(r);
    this.clouds = clouds(22, r);
    this.charts = null; // indexCharts() of Space.Charts, to tell day from night below
    this.ship = null; // the chart's ship (src/station_map/charts.lua), for her side in high orbit
    this.port = null;
    this.planet = null; // the planet she's in high orbit over
    this.lit = 1; // 1 the day side below, 0 the night side; eases toward litTarget
    this.litTarget = 1;
    this.looked = -Infinity;
    this.clock = 0; // seconds, for the beacons' blink and the beam's flicker
    this.work = null; // the work message: what the sensors, laser and thrusters are doing, with local times

    this.target = targets("station");
    this.space = 0;
    this.rocks = 0;
    this.ground = 0;
    this.high = 0; // the planet's face from high orbit shown
    this.speed = 0;
    this.raf = 0;
    this.timer = 0; // a settled scene waiting out frameGap() before its next frame
    this.last = 0;
    this.gap = 0; // ms the next frame was put off for, 0 if it wasn't
    this.beat = 1 / 60; // s, the display's own frame, as the frames that weren't put off saw it
    this.shown = null; // the work() the belt last drew
    this.covered = false; // the chart is over the band: keep the state, draw nothing
    this.run = null; // a dock or an undock under way, { verb, start, end } in ms
    this.away = 0; // 0 the station as docked, 1 backed out of the berth
    this.through = false; // drawing the station's distance: see-through over the model
    /** @type {((away: number) => void) | null} draws the model at a distance; 0 puts it back */
    this.onAway = null;

    new ResizeObserver(() => this.resize()).observe(containerEl);
    document.addEventListener("visibilitychange", () => (document.hidden ? this.pause() : this.wake()));
  }

  /**
   * Show a scene: "station", "parked", "travelling", "belt", "port" or "orbit", with the port's id
   * for "port" and the planet's for "orbit".
   */
  set(scene, port = null, planet = null) {
    this.target = targets(scene);
    if (port !== this.port || planet !== this.planet) {
      this.port = port;
      this.planet = planet;
      this.looked = -Infinity;
      if (this.ground === 0 && this.high === 0) this.lit = this.litTarget = this.daylight() ?? this.litTarget; // no fade into a known sky
    }
    this.hurry();
  }

  /** The chart's ship, for which side of the planet she's on in high orbit. */
  setShip(ship) {
    this.ship = ship && typeof ship === "object" ? ship : null;
    this.looked = -Infinity;
  }

  /** What the ship's sensors and laser are doing: the work message (src/station_map/work.lua). */
  setWork(msg) {
    this.work = msg && typeof msg === "object" ? msg : null;
  }

  /** Time a dock or an undock: `{ verb, start, end }` in local ms, or null when none is under way. */
  setManoeuvre(run) {
    this.run = run;
    this.hurry();
  }

  /** The system's charts, an indexCharts() result, for where the port and its star are. */
  setCharts(index) {
    this.charts = index;
    this.looked = -Infinity;
  }

  /**
   * 1 if the face below has its star up now, 0 if not: a port's town, or her side of the planet in
   * high orbit, which is a dusk (0.5) when nothing says which side; null if the charts can't say.
   */
  daylight() {
    if (!this.charts) return null;
    if (this.port) {
      const day = daylit(this.charts, this.port, Date.now());
      return day === null ? null : litFor(day);
    }
    if (this.planet) return litFor(orbitLit(this.charts, this.ship, Date.now()));
    return null;
  }

  /** While covered (the system chart is on) nothing draws and the loop stops; uncovering wakes it. */
  setCovered(covered) {
    this.covered = !!covered;
    if (this.covered) this.pause();
    else this.wake();
  }

  resize() {
    const k = window.devicePixelRatio || 1;
    const w = this.cv.clientWidth;
    const h = this.cv.clientHeight;
    this.cv.width = Math.max(1, Math.round(w * k));
    this.cv.height = Math.max(1, Math.round(h * k));
    this.g.setTransform(k, 0, 0, k, 0, 0);
    this.w = w;
    this.h = h;
    if (this.timer) this.hurry(); // resizing cleared it: no waiting out a gap blank
  }

  wake() {
    if (this.raf || this.timer || document.hidden || this.covered) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  /** Something's changed: draw at the display's next frame, not after a settled scene's wait. */
  hurry() {
    if (!this.timer) return this.wake();
    clearTimeout(this.timer);
    this.timer = 0;
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  pause() {
    if (this.raf) cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.raf = 0;
    this.timer = 0;
  }

  /** Every ease at the scene's own, no dock or undock under way or easing back, the rocks not easing into or out of her move. */
  settled(t) {
    return (
      !this.through &&
      this.space === t.space &&
      this.rocks === t.belt &&
      this.ground === t.ground &&
      this.high === t.orbit &&
      this.speed === t.speed &&
      this.lit === this.litTarget &&
      (!t.belt || this.belt.go === 0)
    );
  }

  frame(now) {
    this.raf = 0;
    if (this.covered) return;
    const dt = Math.max(0, Math.min(STALL, (now - this.last) / 1000)); // a first frame can predate wake()
    this.last = now;
    if (!this.gap && dt > 0) this.beat += (dt - this.beat) * 0.1;
    // put off, the stars keep a display frame's streak, not one as long as the wait
    const trail = this.gap ? Math.min(dt, this.beat) : dt;
    const t = this.target;
    this.space = approach(this.space, t.space, dt, FADE);
    this.rocks = approach(this.rocks, t.belt, dt, FADE);
    this.ground = approach(this.ground, t.ground, dt, FADE);
    this.high = approach(this.high, t.orbit, dt, FADE);
    this.speed = approach(this.speed, t.speed, dt, SPEED);
    this.clock += dt;
    if ((t.ground || t.orbit) && now - this.looked >= LOOK) {
      this.looked = now;
      this.litTarget = this.daylight() ?? this.litTarget; // unknown: keep what's shown
    }
    this.lit = approach(this.lit, this.litTarget, dt, DUSK);

    const timed = awayAt(this.run, Date.now());
    if (timed !== null) {
      this.away = timed;
      this.through = true;
    } else if (this.through) {
      // stopped early, or over with the scene changed: ease to where the scene has the station
      this.away = approach(this.away, t.space, dt, BACK);
      if (this.away === t.space) {
        this.through = false;
        this.space = this.away; // the scene's own fade carries on from here
        this.onAway?.(0);
      }
    }

    if (this.through) {
      this.onAway?.(this.away);
      this.cv.style.opacity = "1";
      this.cv.style.pointerEvents = "none";
      if (this.w) this.drawThrough(dt);
    } else {
      this.cv.style.opacity = String(this.space);
      this.cv.style.pointerEvents = this.space > 0 ? "auto" : "none";
      if (this.space > 0 && this.w) this.draw(dt, trail);
    }

    // back on the station with the fade done: nothing to draw until the next scene
    if (!this.through && this.space === 0 && t.space === 0) return;
    this.gap = this.settled(t) ? frameGap(t, this.shown) : 0;
    if (!this.gap) {
      this.raf = requestAnimationFrame((n) => this.frame(n));
      return;
    }
    // half a display frame early, so the frame asked for then is the one the gap ends on
    const wait = now + this.gap - performance.now() - (this.beat * 1000) / 2;
    this.timer = setTimeout(() => {
      this.timer = 0;
      this.raf = requestAnimationFrame((n) => this.frame(n));
    }, Math.max(0, wait));
  }

  /** Over the station model at a distance: no backdrop, only the parked stars, as strong as it's far. */
  drawThrough(dt) {
    this.g.clearRect(0, 0, this.w, this.h);
    this.field.step(dt, Math.max(this.speed, DRIFT)); // still stars are zero-length strokes, which don't draw
    this.drawStars(awayLook(this.away).stars);
  }

  drawStars(dim) {
    const { g } = this;
    const n = this.field.segments(this.w, this.h);
    const s = this.field.streaks;
    g.lineCap = "round";
    for (let i = 0; i < n * 6; i += 6) {
      g.strokeStyle = `rgba(${STAR},${s[i + 4] * dim})`;
      g.lineWidth = s[i + 5];
      g.beginPath();
      g.moveTo(s[i], s[i + 1]);
      g.lineTo(s[i + 2], s[i + 3]);
      g.stroke();
    }
  }

  draw(dt, trail) {
    const { g, w, h } = this;
    g.globalAlpha = 1;
    g.fillStyle = BG;
    g.fillRect(0, 0, w, h);

    if (this.rocks < 1) {
      this.field.step(dt, this.speed, trail);
      this.drawStars((1 - this.rocks) * (1 - 0.5 * Math.max(this.ground, this.high) * this.lit)); // a sunlit face below outshines them
    }

    if (this.rocks > 0) {
      for (const [x, y, a] of this.far) {
        g.fillStyle = `rgba(${STAR},${a * this.rocks})`;
        g.fillRect(x * w, y * h, 1, 1);
      }
      const shown = (this.shown = work(this.work, Date.now() / 1000));
      // moving, the rocks flow past the other way, once the place has changed to say which way
      const way = shown.moving?.way ?? null;
      this.belt.step(dt, w, h, way === null ? null : heading(way));
      g.strokeStyle = EDGE;
      g.lineWidth = 0.8;
      g.lineJoin = "round";
      for (const k of this.belt.rocks) {
        g.globalAlpha = (0.45 + k.d * 0.55) * this.rocks;
        for (const f of rockFaces(k.shape, k.a, k.b)) {
          g.fillStyle = TONES[f.tone];
          g.beginPath();
          f.pts.forEach(([px, py], i) => (i ? g.lineTo(k.x + px * k.size, k.y - py * k.size) : g.moveTo(k.x + px * k.size, k.y - py * k.size)));
          g.closePath();
          g.fill();
          g.stroke();
        }
      }
      g.globalAlpha = 1;
      this.drawWork(shown);
    }

    if (this.ground > 0) this.drawGround();
    if (this.high > 0) this.drawOrbit();
  }

  /**
   * The ship's work at the belt, over the rocks: the sensors' line crossing the band over a scan's
   * time, brackets and a filling ring on the held rock during an assay, the beam on it while the
   * laser cuts (not while she closes on it), and the seconds left in the corner. Nothing here
   * places or counts a rock.
   */
  drawWork(shown) {
    const { g, w, h } = this;
    const k = this.belt.hold(!!shown.assay || shown.cut, w, h);
    const lines = workLines(shown);
    if (!lines.length) return;
    g.save();
    g.globalAlpha = this.rocks;
    if (shown.sweep) {
      const x = w * shown.sweep.p;
      g.fillStyle = `rgba(${SENSE},0.05)`;
      g.fillRect(0, 0, x, h);
      const grd = g.createLinearGradient(x - 40, 0, x, 0);
      grd.addColorStop(0, `rgba(${SENSE},0)`);
      grd.addColorStop(1, `rgba(${SENSE},0.18)`);
      g.fillStyle = grd;
      g.fillRect(x - 40, 0, 40, h);
      g.strokeStyle = `rgba(${SENSE},0.8)`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    if (k && shown.cut) this.drawBeam(k);
    if (k && shown.assay) {
      const r = k.size * 1.25;
      const c = Math.min(7, r * 0.5);
      g.strokeStyle = `rgba(${SENSE},0.75)`;
      g.lineWidth = 1.2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        g.beginPath();
        g.moveTo(k.x + sx * r, k.y + sy * (r - c));
        g.lineTo(k.x + sx * r, k.y + sy * r);
        g.lineTo(k.x + sx * (r - c), k.y + sy * r);
        g.stroke();
      }
      const top = -Math.PI / 2;
      g.lineWidth = 2;
      g.strokeStyle = `rgba(${SENSE},0.25)`;
      g.beginPath();
      g.arc(k.x, k.y, r * 1.2, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = `rgba(${SENSE},0.85)`;
      g.beginPath();
      g.arc(k.x, k.y, r * 1.2, top, top + Math.PI * 2 * shown.assay.p);
      g.stroke();
    }
    g.font = "10px Inter, system-ui, sans-serif";
    g.fillStyle = DIM;
    g.textAlign = "right";
    lines.forEach((t, i) => g.fillText(t, w - 10, h - 10 - (lines.length - 1 - i) * 14));
    g.restore();
  }

  /** The laser's beam from under the view, where the ship is, onto the near face of rock k, flickering. */
  drawBeam(k) {
    const { g, w, h } = this;
    const ox = w / 2 + 40;
    const oy = h + 10;
    const ang = Math.atan2(k.y - oy, k.x - ox);
    const tx = k.x - Math.cos(ang) * k.size * 0.3;
    const ty = k.y - Math.sin(ang) * k.size * 0.3;
    const flick = 0.85 + 0.15 * Math.sin(this.clock * 31);
    g.lineCap = "round";
    for (const [col, a, lw] of [[BEAM, 0.25, 7], [BEAM, 0.8, 2.2], ["255,255,255", 0.95, 0.9]]) {
      g.strokeStyle = `rgba(${col},${a * flick})`;
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(ox, oy);
      g.lineTo(tx, ty);
      g.stroke();
    }
    const grd = g.createRadialGradient(tx, ty, 0, tx, ty, 14);
    grd.addColorStop(0, `rgba(255,255,255,${0.95 * flick})`);
    grd.addColorStop(0.3, `rgba(${BEAM},0.6)`);
    grd.addColorStop(1, `rgba(${BEAM},0)`);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(tx, ty, 14, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 9; i++) {
      const a = ang + Math.PI + (Math.random() - 0.5) * 2.2;
      const d = 5 + Math.random() * 14;
      g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.6})`;
      g.fillRect(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 1.4, 1.4);
    }
  }

  /** The planet's face across the lower band, the town on it, by day and by night cross-faded. */
  drawGround() {
    const { g, w, h, town, lit } = this;
    const R = w * 1.4;
    const cx = w / 2;
    const top = h * 0.52;
    const cy = top + R;
    const face = (cols) => {
      const grd = g.createLinearGradient(0, top, 0, h);
      grd.addColorStop(0, cols[0]);
      grd.addColorStop(0.15, cols[1]);
      grd.addColorStop(1, cols[2]);
      return grd;
    };

    g.save();
    g.globalAlpha = this.ground;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = face(NIGHT);
    g.fillRect(0, top, w, h - top);
    if (lit > 0) {
      g.globalAlpha = this.ground * lit;
      g.fillStyle = face(DAY);
      g.fillRect(0, top, w, h - top);
    }
    g.globalAlpha = this.ground;
    for (const d of town.dust) {
      g.fillStyle = `rgba(40,28,18,${(0.08 + d.a * 0.1) * lit})`;
      g.beginPath();
      g.ellipse(d.x * w, top + h * 0.03 + d.y * (h - top), d.rx, d.ry, 0, 0, Math.PI * 2);
      g.fill();
    }

    const k = Math.min(Math.max(24, Math.min(70, w * 0.1)), (h - top) * 0.7); // the field's width in px; the town fits the face
    const tx = cx;
    const ty = top + (h - top) * 0.5;
    const X = (u) => tx + u * k;
    const Y = (v) => ty + v * k;
    const { w: fw, h: fh } = town.field;
    if (lit > 0) {
      g.globalAlpha = this.ground * lit;
      g.fillStyle = FIELD;
      g.fillRect(X(-fw / 2), Y(-fh / 2), fw * k, fh * k);
      g.strokeStyle = PAD;
      g.lineWidth = 0.8;
      for (const p of town.pads) {
        g.beginPath();
        g.arc(X(p), ty, fh * k * 0.28, 0, Math.PI * 2);
        g.stroke();
      }
      for (const r of town.roofs) {
        g.fillStyle = TONES[r.tone];
        g.fillRect(X(r.x), Y(r.y), r.w * k, r.h * k);
        g.fillStyle = EDGE;
        g.fillRect(X(r.x), Y(r.y) + r.h * k, r.w * k, 1);
      }
    }
    if (lit < 1) {
      const night = this.ground * (1 - lit);
      g.globalAlpha = 1;
      for (const l of town.lamps) {
        g.fillStyle = `rgba(${LAMP},${l.a * night})`;
        g.fillRect(X(l.x), Y(l.y), 1.4, 1.4);
      }
      g.strokeStyle = `rgba(${LAMP},${0.18 * night})`;
      g.lineWidth = 1;
      g.strokeRect(X(-fw / 2), Y(-fh / 2), fw * k, fh * k);
      const br = k * 0.11;
      for (const b of town.beacons) {
        const blink = 0.55 + 0.45 * Math.cos(2 * Math.PI * (this.clock * 0.8 - b.at));
        const grd = g.createRadialGradient(X(b.x), Y(b.y), 0, X(b.x), Y(b.y), br);
        grd.addColorStop(0, `rgba(${BEACON},${0.95 * blink * night})`);
        grd.addColorStop(1, `rgba(${BEACON},0)`);
        g.fillStyle = grd;
        g.beginPath();
        g.arc(X(b.x), Y(b.y), br, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();

    g.globalAlpha = this.ground;
    g.strokeStyle = `rgba(${RIM},${0.18 + 0.37 * lit})`;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }

  /**
   * The planet's face from high orbit, half its radius up: a rounder limb than over a port, faint
   * cloud lying along the curve, the face darkening toward its edge, and thin air glowing over the
   * limb by day; day and night cross-faded, a dusk between when her side isn't known. No town.
   */
  drawOrbit() {
    const { g, w, h, lit } = this;
    const R = w * 0.78;
    const cx = w / 2;
    const top = h * 0.46;
    const cy = top + R;

    g.save();
    g.globalAlpha = this.high;
    const haze = g.createRadialGradient(cx, cy, R, cx, cy, R + HAZE);
    haze.addColorStop(0, `rgba(${RIM},${0.04 + 0.22 * lit})`);
    haze.addColorStop(1, `rgba(${RIM},0)`);
    g.fillStyle = haze;
    g.beginPath();
    g.arc(cx, cy, R + HAZE, 0, Math.PI * 2);
    g.fill();

    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.clip();
    const face = (cols) => {
      const grd = g.createLinearGradient(0, top, 0, h);
      grd.addColorStop(0, cols[0]);
      grd.addColorStop(0.15, cols[1]);
      grd.addColorStop(1, cols[2]);
      return grd;
    };
    g.fillStyle = face(NIGHT);
    g.fillRect(0, top, w, h - top);
    if (lit > 0) {
      g.globalAlpha = this.high * lit;
      g.fillStyle = face(DAY);
      g.fillRect(0, top, w, h - top);
    }
    g.globalAlpha = this.high;
    g.lineCap = "round";
    const deep = h - top + 20; // the bands reach a little past the band's foot
    for (const c of this.clouds) {
      g.strokeStyle = `rgba(${CLOUD},${c.alpha * (0.2 + 0.8 * lit)})`;
      g.lineWidth = c.w;
      g.beginPath();
      g.arc(cx, cy, R - 6 - c.d * deep, -Math.PI / 2 + c.a - c.len, -Math.PI / 2 + c.a + c.len);
      g.stroke();
    }
    const limb = g.createRadialGradient(cx, cy, R * 0.86, cx, cy, R);
    limb.addColorStop(0, "rgba(4,6,12,0)");
    limb.addColorStop(1, "rgba(4,6,12,0.45)");
    g.fillStyle = limb;
    g.fillRect(0, top, w, h - top);
    g.restore();

    g.globalAlpha = this.high;
    g.strokeStyle = `rgba(${RIM},${0.18 + 0.37 * lit})`;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }
}
