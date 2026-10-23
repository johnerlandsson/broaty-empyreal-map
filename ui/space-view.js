// The overview away from the station: a canvas over the station model showing the starfield, the
// belt, or over a port the town on its planet's face below, lit or dark as its star is up or not;
// pure scenery with no controls. It fades in over the model (hiding its zoom buttons),
// eases the stars' speed and cross-fades stars and rocks; the frame loop runs only while
// something is on screen, and pauses while the panel is hidden or the system chart covers it.

import { daylit } from "./lib/orbits.js";
import { Belt, Starfield, Town, approach, rockFaces, targets } from "./lib/space.js";
import { rng } from "./lib/svg.js";

const BG = "#04060c";
const TONES = ["#3a4556", "#58667b", "#7e8da3"]; // the station model's
const EDGE = "#0d1218";
const STAR = "223,231,241";
const FADE = 2.5; // per second: space in and out, stars to rocks, the ground in and out
const SPEED = 0.9; // per second: the stars speeding up and slowing down
const DUSK = 1; // per second: day to night on the ground below, and back
const LOOK = 1000; // ms between asking whether the town below is in daylight
// the planet's face: [top, upper, bottom] of its gradient, by day and by night
const DAY = ["#6e5a44", "#8a7052", "#5c4936"];
const NIGHT = ["#121821", "#0e131b", "#080b11"];
const FIELD = "#b89a74"; // the landing field's dust, the room colour (style guide §4)
const PAD = "#e3d3b8";
const LAMP = "255,217,138"; // the Porthole colour
const BEACON = "232,176,74"; // the busy status light
const RIM = "207,227,255"; // Glass: the thin air at the limb

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
    this.charts = null; // indexCharts() of Space.Charts, to tell day from night below a port
    this.port = null;
    this.lit = 1; // 1 the day side below, 0 the night side; eases toward litTarget
    this.litTarget = 1;
    this.looked = -Infinity;
    this.clock = 0; // seconds, for the beacons' blink

    this.target = targets("station");
    this.space = 0;
    this.rocks = 0;
    this.ground = 0;
    this.speed = 0;
    this.raf = 0;
    this.last = 0;
    this.covered = false; // the chart is over the band: keep the state, draw nothing

    new ResizeObserver(() => this.resize()).observe(containerEl);
    document.addEventListener("visibilitychange", () => (document.hidden ? this.pause() : this.wake()));
  }

  /** Show a scene: "station", "parked", "travelling", "belt" or "port", with the port's id for the last. */
  set(scene, port = null) {
    this.target = targets(scene);
    if (port !== this.port) {
      this.port = port;
      this.looked = -Infinity;
      if (this.ground === 0) this.lit = this.litTarget = this.daylight() ?? this.litTarget; // no fade into a known sky
    }
    this.wake();
  }

  /** The system's charts, an indexCharts() result, for where the port and its star are. */
  setCharts(index) {
    this.charts = index;
    this.looked = -Infinity;
  }

  /** 1 if the port below has its star up now, 0 if not, null if the charts can't say. */
  daylight() {
    if (!this.port || !this.charts) return null;
    const day = daylit(this.charts, this.port, Date.now());
    return day === null ? null : day ? 1 : 0;
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
  }

  wake() {
    if (this.raf || document.hidden || this.covered) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  pause() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  frame(now) {
    if (this.covered) {
      this.raf = 0;
      return;
    }
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); // a first frame can predate wake()
    this.last = now;
    const t = this.target;
    this.space = approach(this.space, t.space, dt, FADE);
    this.rocks = approach(this.rocks, t.belt, dt, FADE);
    this.ground = approach(this.ground, t.ground, dt, FADE);
    this.speed = approach(this.speed, t.speed, dt, SPEED);
    this.clock += dt;
    if (t.ground && now - this.looked >= LOOK) {
      this.looked = now;
      this.litTarget = this.daylight() ?? this.litTarget; // unknown: keep what's shown
    }
    this.lit = approach(this.lit, this.litTarget, dt, DUSK);

    this.cv.style.opacity = String(this.space);
    this.cv.style.pointerEvents = this.space > 0 ? "auto" : "none";
    if (this.space > 0 && this.w) this.draw(dt);

    // back on the station with the fade done: nothing to draw until the next scene
    this.raf = this.space === 0 && t.space === 0 ? 0 : requestAnimationFrame((n) => this.frame(n));
  }

  draw(dt) {
    const { g, w, h } = this;
    g.globalAlpha = 1;
    g.fillStyle = BG;
    g.fillRect(0, 0, w, h);

    if (this.rocks < 1) {
      this.field.step(dt, this.speed);
      g.lineCap = "round";
      const dim = (1 - this.rocks) * (1 - 0.5 * this.ground * this.lit); // a sunlit face below outshines them
      for (const [x0, y0, x1, y1, a, lw] of this.field.segments(w, h)) {
        g.strokeStyle = `rgba(${STAR},${a * dim})`;
        g.lineWidth = lw;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      }
    }

    if (this.rocks > 0) {
      for (const [x, y, a] of this.far) {
        g.fillStyle = `rgba(${STAR},${a * this.rocks})`;
        g.fillRect(x * w, y * h, 1, 1);
      }
      this.belt.step(dt, w, h);
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
    }

    if (this.ground > 0) this.drawGround();
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
}
