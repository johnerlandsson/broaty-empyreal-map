// The overview away from the station: a canvas over the station model showing the starfield or
// the belt, pure scenery with no controls. It fades in over the model (hiding its zoom buttons),
// eases the stars' speed and cross-fades stars and rocks; the frame loop runs only while
// something is on screen, and pauses while the panel is hidden or the system chart covers it.

import { Belt, Starfield, approach, rockFaces, targets } from "./lib/space.js";
import { rng } from "./lib/svg.js";

const BG = "#04060c";
const TONES = ["#3a4556", "#58667b", "#7e8da3"]; // the station model's
const EDGE = "#0d1218";
const STAR = "223,231,241";
const FADE = 2.5; // per second: space in and out, stars to rocks
const SPEED = 0.9; // per second: the stars speeding up and slowing down

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

    this.target = targets("station");
    this.space = 0;
    this.rocks = 0;
    this.speed = 0;
    this.raf = 0;
    this.last = 0;
    this.covered = false; // the chart is over the band: keep the state, draw nothing

    new ResizeObserver(() => this.resize()).observe(containerEl);
    document.addEventListener("visibilitychange", () => (document.hidden ? this.pause() : this.wake()));
  }

  /** Show a scene: "station", "parked", "travelling" or "belt". */
  set(scene) {
    this.target = targets(scene);
    this.wake();
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
    this.speed = approach(this.speed, t.speed, dt, SPEED);

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
      for (const [x0, y0, x1, y1, a, lw] of this.field.segments(w, h)) {
        g.strokeStyle = `rgba(${STAR},${a * (1 - this.rocks)})`;
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
  }
}
