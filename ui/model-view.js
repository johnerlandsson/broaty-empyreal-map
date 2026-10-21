// The station model: a flat-shaded, painter's-algorithm drawing of T.I.S.S. as SVG polygons.
// The wheel turns by itself so the player's clock position comes round to the camera; the player's
// place is shown by lighting the faces that share their key. The user can zoom and pan, not rotate.
// Geometry lives in lib/geometry.js and lib/model.js, turn maths in lib/turn.js.

import { BLZ, FRONT, P3, RR, RT, RWZ, project, roll } from "./lib/geometry.js";
import { keyOf } from "./lib/locate.js";
import { buildModel } from "./lib/model.js";
import { shortestTurn, turnDuration } from "./lib/turn.js";
import { attachPanZoom, el, glowFilter, stars, zoomButtons } from "./lib/svg.js";

const HL = "#ffb347";
const HL_STROKE = "#fff3df";
const EDGE = "#0d1218";
const LABEL_FG = "#dfe7f1"; // ring names: light, so they read over the grey faces
const TONES = ["#3a4556", "#58667b", "#7e8da3"];
const SHIP_TONES = ["#6b7a90", "#8a99ae", "#b7c4d4"];
const GLASS = "#cfe3ff";
const LIGHT = (() => {
  const v = [-0.5, 0.75, 0.45];
  const m = Math.hypot(...v);
  return v.map((c) => c / m);
})();
const EPS = 1e-6;
const PAD = 30;
const LABEL_BG = "#04060c";
const LABEL_SIZE = 22;
const LABEL_GAP = 26; // leader run from the wheel's right edge to the label column
const LABEL_W = 84; // room for the longest label ("INNER") at LABEL_SIZE

let instances = 0;

/** Blend colour a toward colour b by t (both "#rrggbb"). */
function mix(a, b, t) {
  const p = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const A = p(a);
  const B = p(b);
  return `#${A.map((c, i) => Math.round(c + (B[i] - c) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** Unit normal of a face, from its first three points. */
function normalOf([a, b, c]) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const m = Math.hypot(...n) || 1;
  return n.map((c) => c / m);
}

/** Flat colour for a face given the cosine of its angle to the light. */
function fillOf(f, lit) {
  const tone = lit > 0.66 ? 2 : lit > 0.33 ? 1 : 0;
  let fill = TONES[tone];
  if (f.kind === "fore" && f.tint) fill = mix(fill, f.tint, 0.7);
  else if (f.kind === "outer" && f.tint) fill = mix(fill, f.tint, 0.25);
  if (f.kind === "ship") fill = SHIP_TONES[tone];
  if (f.kind.startsWith("blister")) fill = mix(fill, GLASS, 0.45);
  return fill;
}

/** The hour the wheel should bring round to the camera for this location, or null for none. */
function hourOf(where) {
  if (!where) return null;
  if (where.kind === "lift") return Number.isFinite(where.hour) ? where.hour : null;
  if (where.kind === "room" && where.level >= 0 && where.level <= 2 && Number.isFinite(where.x)) {
    // a ladderway sits at x = 2h + 1, beside the lift lobby at hour h (same rule as keyOf)
    return where.id?.includes("ladderway") ? (where.x - 1) / 2 : where.x / 2;
  }
  return null;
}

const num = (n) => n.toFixed(1);

export class ModelView {
  /**
   * @param {HTMLElement} containerEl element the model fills
   * @param {ReturnType<typeof import("./lib/locate.js").indexStation>} index
   */
  constructor(containerEl, index) {
    this.faces = buildModel(index);
    this.normals = this.faces.map((f) => normalOf(f.pts));

    const div = document.createElement("div");
    div.className = "model";
    Object.assign(div.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      background: "#04060c",
      cursor: "grab",
      touchAction: "none",
    });
    containerEl.appendChild(div);
    this.div = div;

    // the union of the silhouettes over a full turn, so turning never moves the framing
    this.bounds = this.computeBounds();
    this.labels = this.layoutLabels();
    this.vb = this.bounds.slice();
    const svg = el("svg", { viewBox: this.vb.join(" ") });
    Object.assign(svg.style, { display: "block", width: "100%", height: "100%" });
    div.appendChild(svg);
    this.svg = svg;

    const id = `glow-model-${++instances}`;
    glowFilter(el("defs", {}, svg), id);
    stars(el("g", {}, svg), -2500, -2500, 5000, 5000, 1200, 21);
    this.geo = el("g", {}, svg);
    this.hot = el("g", { filter: `url(#${id})`, "pointer-events": "none" }, svg);
    this.pulse = el("g", {}, this.hot);
    this.shapes = el("g", {}, this.pulse);
    this.drawLabels(el("g", { "pointer-events": "none" }, svg));

    this.phi = FRONT; // 12:00 faces the camera
    this.turning = true;
    this.key = null;
    this.hour = null; // hour of the last location, null when it gave none
    this.started = false; // set() has run at least once
    this.run = 0; // bumped to cancel an animation in flight
    this.raf = 0;
    this.timer = 0;
    this.draw();

    const W = this.bounds[2];
    this.zoom = attachPanZoom(div, () => this.vb, (v) => this.setView(v), { minW: W * 0.25, maxW: W * 1.2 });
    zoomButtons(div, "8px", (f) => {
      if (f) this.zoom(f);
      else this.setView(this.bounds.slice());
    });
  }

  computeBounds() {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let k = 0; k < 12; k++) {
      for (const f of this.faces) {
        for (const p of f.pts) {
          const [x, y] = project(f.turns ? roll(p, k) : p);
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return [x0 - PAD, y0 - PAD, x1 - x0 + 2 * PAD, y1 - y0 + 2 * PAD];
  }

  /**
   * Where the ring names sit: a label column in the right margin, outside the silhouette of the
   * wheel, each tied to the outer edge of its ring by a leader line. The ring edge points are
   * the rightmost points of the turning rings, so they do not move as the wheel turns. Widens
   * this.bounds to take in the column.
   */
  layoutLabels() {
    const right = this.bounds[0] + this.bounds[2] - PAD; // right edge of the union silhouette
    const colX = right + LABEL_GAP;
    const rings = ["RIM", "MID", "INNER"].map((text, z) => {
      let best = [-Infinity, 0];
      for (let h = 0; h < 12; h += 0.05) {
        for (const dz of [-RWZ[z], RWZ[z]]) {
          const p = project(P3(RR[z] + RT[z], h, dz));
          if (p[0] > best[0]) best = p;
        }
      }
      return { text, from: [best[0], best[1]] };
    });
    // stack the labels top to bottom, centred on the rim's edge point, so they never overlap
    const step = LABEL_SIZE + 14;
    const mid = rings[0].from[1] + step;
    rings.forEach((r, i) => (r.y = mid + (i - 1) * step));
    const [dx, dy] = project([0, 0, BLZ + 18]);
    const docks = { text: "DOCKS", x: dx + 14, y: dy + 24 };
    this.bounds[2] = colX + LABEL_W + PAD / 2 - this.bounds[0];
    return { colX, rings, docks };
  }

  /** Ring names and DOCKS at fixed screen positions; they do not turn with the wheel. */
  drawLabels(g) {
    const halo = { stroke: LABEL_BG, "stroke-width": 5, "paint-order": "stroke", "stroke-linejoin": "round" };
    const { colX, rings, docks } = this.labels;
    for (const r of rings) {
      const d = `M${num(r.from[0])},${num(r.from[1])}L${num(colX - 4)},${num(r.y)}`;
      el("path", { d, fill: "none", stroke: LABEL_BG, "stroke-width": 4.5, "stroke-linecap": "round" }, g);
      el("path", { d, fill: "none", stroke: LABEL_FG, "stroke-width": 1.4, "stroke-linecap": "round" }, g);
      el("circle", { cx: r.from[0], cy: r.from[1], r: 3, fill: LABEL_FG, stroke: LABEL_BG, "stroke-width": 1.5 }, g);
    }
    const text = (x, y, t) =>
      el(
        "text",
        {
          x,
          y,
          "font-size": LABEL_SIZE,
          "font-weight": 600,
          "letter-spacing": 1.5,
          fill: LABEL_FG,
          "dominant-baseline": "middle",
          "font-family": "Inter, system-ui, sans-serif",
          ...halo,
        },
        g,
        t,
      );
    for (const r of rings) text(colX, r.y, r.text);
    text(docks.x, docks.y, docks.text);
  }

  setView(v) {
    this.vb = v;
    this.svg.setAttribute("viewBox", v.map((n) => +n.toFixed(2)).join(" "));
  }

  /** Redraw every face at the current roll, far to near, then the lit faces on top. */
  draw() {
    const { phi, key } = this;
    const quads = this.faces.map((f, i) => {
      const P = f.pts.map((p) => project(f.turns ? roll(p, phi) : p));
      const n = f.turns ? roll(this.normals[i], phi) : this.normals[i];
      return { f, P, n, depth: P.reduce((s, p) => s + p[2], 0) / P.length };
    });
    quads.sort((a, b) => a.depth - b.depth);

    const geo = document.createDocumentFragment();
    const hot = document.createDocumentFragment();
    for (const { f, P, n } of quads) {
      const d = `M${P.map((p) => `${num(p[0])},${num(p[1])}`).join("L")}Z`;
      const fill = fillOf(f, Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]));
      el("path", { d, fill, stroke: fill, "stroke-width": 0.8, "stroke-linejoin": "round" }, geo);
      const e = P.map((p, i) => {
        if (f.edges && !f.edges[i]) return "";
        const q = P[(i + 1) % P.length];
        return `M${num(p[0])},${num(p[1])}L${num(q[0])},${num(q[1])}`;
      }).join("");
      if (e) el("path", { d: e, fill: "none", stroke: EDGE, "stroke-width": 1.3, "stroke-linecap": "round" }, geo);
      if (key != null && f.key === key) {
        el("path", { d, fill: HL, "fill-opacity": 0.55, stroke: HL_STROKE, "stroke-width": 1.4, "stroke-linejoin": "round" }, hot);
      }
    }
    this.geo.replaceChildren(geo);
    this.shapes.replaceChildren(hot);
  }

  /** Restart the highlight pulse (opacity 1 -> .55 -> 1 over 1.8 s). */
  restartPulse() {
    this.pulse.replaceChildren(this.shapes);
    el("animate", { attributeName: "opacity", values: "1;0.55;1", dur: "1.8s", repeatCount: "indefinite" }, this.pulse);
  }

  stop() {
    this.run++;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.timer) clearTimeout(this.timer);
    this.raf = 0;
    this.timer = 0;
  }

  /** Animate the roll to target (ease in-out); a timer snaps it there if frames stall. */
  animateTo(target) {
    this.stop();
    const run = this.run;
    const from = this.phi;
    const dur = turnDuration(target - from);
    const t0 = performance.now();
    const step = (now) => {
      if (run !== this.run) return;
      const t = Math.min(1, Math.max(0, (now - t0) / dur));
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      this.phi = from + (target - from) * e;
      this.draw();
      if (t < 1) {
        this.raf = requestAnimationFrame(step);
      } else {
        this.raf = 0;
        clearTimeout(this.timer); // finished normally: no second snap draw
        this.timer = 0;
      }
    };
    this.raf = requestAnimationFrame(step);
    this.timer = setTimeout(() => {
      if (run !== this.run) return;
      this.stop();
      this.phi = target;
      this.draw();
    }, dur + 400);
  }

  /** Light the player's place and turn the wheel to bring their hour to the front. */
  set(where) {
    const key = keyOf(where);
    const hour = hourOf(where);
    if (this.started && key === this.key && hour === this.hour) return;
    const first = !this.started;
    this.started = true;
    const keyChanged = key !== this.key;
    const hourChanged = hour !== this.hour;
    this.key = key;
    this.hour = hour;
    if (keyChanged) this.restartPulse();

    if (first) {
      // a fresh mount (open, reload, reconnect) starts already facing the player: nothing spins
      this.stop();
      if (hour != null && this.turning) this.phi = shortestTurn(this.phi, hour);
      this.draw();
      return;
    }

    if (hour != null && hourChanged && this.turning) {
      const target = shortestTurn(this.phi, hour);
      if (Math.abs(target - this.phi) >= EPS) {
        this.animateTo(target);
        this.draw();
        return;
      }
      this.stop(); // already facing: drop any animation still heading for an older hour
    }
    // no turn: redraw only if the lit faces changed (a running animation redraws every frame anyway)
    if (keyChanged) this.draw();
  }

  /** With turning off the wheel rests at FRONT; turning it on again brings the last hour round. */
  setTurning(enabled) {
    enabled = !!enabled;
    if (enabled === this.turning) return;
    this.turning = enabled;
    if (!enabled) {
      this.stop();
      if (Math.abs(this.phi - FRONT) >= EPS) {
        this.phi = FRONT;
        this.draw();
      }
    } else if (this.hour != null) {
      const target = shortestTurn(this.phi, this.hour);
      if (Math.abs(target - this.phi) >= EPS) this.animateTo(target);
    }
  }
}
