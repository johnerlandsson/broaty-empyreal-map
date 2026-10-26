// The station model: a flat-shaded, painter's-algorithm drawing of a station as SVG polygons,
// T.I.S.S. unless given another's faces. The wheel (or drum) turns by itself so the player's clock
// position comes round to the camera; the player's place is shown by lighting the faces that share
// their key. Each place may have its own camera (angle and how close its home framing is); the user
// can zoom and pan from there, not rotate. Docking and undocking, it shrinks or grows in its framing
// as the space scene's timing says (setAway).
// Geometry lives in lib/geometry.js, lib/model.js, lib/drum.js and lib/decks.js, turn maths in
// lib/turn.js.

import { BLZ, CAM, P3, RR, RT, RWZ, camera, roll } from "./lib/geometry.js";
import { keyOf } from "./lib/locate.js";
import { buildModel } from "./lib/model.js";
import { awayLook } from "./lib/space.js";
import { shortestTurn, turnDuration } from "./lib/turn.js";
import { attachPanZoom, attachPick, el, glowFilter, stars, zoomButtons } from "./lib/svg.js";

const HL = "#ffb347";
const HL_STROKE = "#fff3df";
const EDGE = "#0d1218";
const LABEL_FG = "#dfe7f1"; // ring names: light, so they read over the grey faces
const TONES = ["#3a4556", "#58667b", "#7e8da3"];
const GLASS = "#cfe3ff";
const LAMP = "#fff4d6"; // a lamp, burning: lit the same from every side
const DIM = "#7d8a9a"; // a cut-away deck's outline
const GHOST_FILL = 0.15; // a ghosted deck's faces: nearly clear,
const GHOST_EDGE = "#9aa7b7"; // with their edges showing
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

/** Flat colour for a face given the cosine of its angle to the light; a lamp burns its own colour (a nav light's tint) or white, lit the same from every side. */
function fillOf(f, lit) {
  if (f.kind === "lamp") return f.tint ?? LAMP;
  const tone = lit > 0.66 ? 2 : lit > 0.33 ? 1 : 0;
  let fill = TONES[tone];
  if (f.kind === "fore" && f.tint) fill = mix(fill, f.tint, 0.7);
  else if (f.kind === "outer" && f.tint) fill = mix(fill, f.tint, 0.25);
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

/** A view box `zoom` times as close as `[x, y, w, h]`, about the same centre. */
function homeOf([x, y, w, h], zoom) {
  if (zoom === 1) return [x, y, w, h];
  return [x + (w - w / zoom) / 2, y + (h - h / zoom) / 2, w / zoom, h / zoom];
}

/** A path along a projected face's edges, leaving out those `edges` marks false. */
function edgePath(P, edges) {
  return P.map((p, i) => {
    if (edges && !edges[i]) return "";
    const q = P[(i + 1) % P.length];
    return `M${num(p[0])},${num(p[1])}L${num(q[0])},${num(q[1])}`;
  }).join("");
}

/**
 * For picking: each face key a room is drawn with, to that room's id, through the place's keyOf and
 * the where its locate gives for the room (a wheel's rooms by x, y and z, a decks station's by
 * cell and level; a drum's key is the id). On a wheel a ring's key is its stretch of corridor or
 * its units, and a spoke's its ladderway.
 */
function roomsByKey(index, keyOf) {
  const out = new Map();
  for (const room of index?.byId?.values() ?? []) {
    const where = { kind: "room", id: room.id, level: room.level ?? room.z, x: room.cell?.x ?? room.x, y: room.cell?.y ?? room.y };
    const key = keyOf(where);
    if (key != null && !out.has(key)) out.set(key, room.id);
  }
  return out;
}

export class ModelView {
  /**
   * @param {HTMLElement} containerEl element the model fills
   * @param {ReturnType<typeof import("./lib/locate.js").indexStation>} index
   * @param {{faces?: object[], keyOf?: (where: object) => string|null,
   *   hourOf?: (where: object) => number|null, cutOf?: (where: object) => number|null,
   *   labels?: boolean, view?: {cutaway?: "off"|"hide-above"|"ghost-above",
   *   camera?: {yaw: number, pitch: number, zoom: number}}, pick?: boolean, transparent?: boolean}} [opts] another station's model: its faces, the face key and hour for a
   *   place, the deck to cut the model away above (faces with a higher `deck` are drawn as a
   *   dashed outline, and those with that `lid` as its top), and whether to draw T.I.S.S.'s ring
   *   names, and how the place is viewed: `cutaway` is whether cutting away happens at all ("off"),
   *   leaves the decks above out ("hide-above", as when absent) or draws them as a ghost
   *   ("ghost-above"), and `camera` is the angle it's seen from (CAM when absent) and how close its
   *   home framing is (`zoom`: 1 frames the whole model, 2 is twice as close); `pick` (the tweak
   *   editor's) marks each face with a key for picking, and a click on one calls onPick's callback;
   *   `transparent` (your ship over the space scene) draws no background and no stars of its own
   */
  constructor(containerEl, index, opts = {}) {
    this.faces = opts.faces ?? buildModel(index);
    this.keyOf = opts.keyOf ?? keyOf;
    this.hourOf = opts.hourOf ?? hourOf;
    this.cutOf = opts.cutOf ?? (() => null);
    this.cut = null;
    this.cutaway = opts.view?.cutaway ?? "hide-above";
    this.cam = camera(opts.view?.camera ?? CAM);
    this.pick = !!opts.pick;
    if (this.pick) this.roomOf = roomsByKey(index, this.keyOf);
    this.normals = this.faces.map((f) => normalOf(f.pts));

    const div = document.createElement("div");
    div.className = "model";
    Object.assign(div.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      background: opts.transparent ? "transparent" : "#04060c",
      cursor: "grab",
      touchAction: "none",
    });
    containerEl.appendChild(div);
    this.div = div;

    // the union of the silhouettes over a full turn, so turning never moves the framing
    this.bounds = this.computeBounds();
    this.labels = opts.labels === false ? null : this.layoutLabels();
    this.home = homeOf(this.bounds, opts.view?.camera?.zoom ?? 1);
    this.vb = this.home.slice();
    const svg = el("svg", { viewBox: this.vb.join(" ") });
    Object.assign(svg.style, { display: "block", width: "100%", height: "100%" });
    div.appendChild(svg);
    this.svg = svg;

    const id = `glow-model-${++instances}`;
    glowFilter(el("defs", {}, svg), id);
    this.backdrop = el("g", {}, svg);
    if (!opts.transparent) stars(this.backdrop, -2500, -2500, 5000, 5000, 1200, 21);
    this.geo = el("g", {}, svg);
    this.hot = el("g", { filter: `url(#${id})`, "pointer-events": "none" }, svg);
    this.pulse = el("g", {}, this.hot);
    this.shapes = el("g", {}, this.pulse);
    if (this.labels) this.drawLabels(el("g", { "pointer-events": "none" }, svg));

    this.phi = this.cam.front; // 12:00 faces the camera
    this.turning = true;
    this.key = null;
    this.hour = null; // hour of the last location, null when it gave none
    this.started = false; // set() has run at least once
    this.run = 0; // bumped to cancel an animation in flight
    this.raf = 0;
    this.timer = 0;
    this.away = 0; // 0 as docked, 1 backed out of the berth (setAway)
    this.draw();

    // from a quarter of the nearer of home and the whole model to a bit past the farther one
    const [near, far] = [Math.min(this.home[2], this.bounds[2]), Math.max(this.home[2], this.bounds[2])];
    this.zoom = attachPanZoom(div, () => this.vb, (v) => this.setView(v), { minW: near * 0.25, maxW: far * 1.2 });
    zoomButtons(div, "8px", (f) => {
      if (f) this.zoom(f);
      else this.setView(this.home.slice());
    });
    if (this.pick) attachPick(div, (id) => this.picked?.(id));
  }

  /** With pick: fn(roomId) on a click (not a pan) on a face of a room; a face no room has (a hull)
   *  isn't picked. */
  onPick(fn) {
    this.picked = fn;
  }

  computeBounds() {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let k = 0; k < 12; k++) {
      for (const f of this.faces) {
        for (const p of f.pts) {
          const [x, y] = this.cam.project(f.turns ? roll(p, k) : p);
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
          const p = this.cam.project(P3(RR[z] + RT[z], h, dz));
          if (p[0] > best[0]) best = p;
        }
      }
      return { text, from: [best[0], best[1]] };
    });
    // stack the labels top to bottom, centred on the rim's edge point, so they never overlap
    const step = LABEL_SIZE + 14;
    const mid = rings[0].from[1] + step;
    rings.forEach((r, i) => (r.y = mid + (i - 1) * step));
    const [dx, dy] = this.cam.project([0, 0, BLZ + 18]);
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

  /**
   * Draw the station `away` from as docked (0) to backed out of the berth (1), as awayLook has it:
   * smaller in its framing, its backdrop of stars giving way to the space scene's over it, fading
   * at the far end, and no zoom buttons. Back at 0 it's as it was, framed as docked: its home.
   */
  setAway(away) {
    if (away === this.away) return;
    this.away = away;
    const { zoom, model, stars: field } = awayLook(away);
    const [x, y, w, h] = this.home;
    this.setView(away === 0 ? this.home.slice() : [x + (w - w * zoom) / 2, y + (h - h * zoom) / 2, w * zoom, h * zoom]);
    this.backdrop.style.opacity = away === 0 ? "" : String(1 - field);
    this.svg.style.opacity = model === 1 ? "" : String(model);
    const buttons = this.div.querySelector(".zoom");
    if (buttons) buttons.style.visibility = away === 0 ? "" : "hidden";
  }

  setView(v) {
    this.vb = v;
    this.svg.setAttribute("viewBox", v.map((n) => +n.toFixed(2)).join(" "));
  }

  /**
   * Redraw every face at the current roll, far to near (lowest layer first), then the lit faces
   * on top. A face marked `cull` is left out while it faces away, or while its `anchor` does.
   * Cut away above a deck, a face on a deck over it is left out, or only its edges drawn dashed if
   * it's an `outline` face; a `lid` face is drawn only when its deck is the one cut to.
   */
  draw() {
    const { phi, key } = this;
    const { project } = this.cam;
    const cut = this.cutaway === "off" ? null : this.cut;
    const ghostly = this.cutaway === "ghost-above";
    const turned = (f, v) => (f.turns ? roll(v, phi) : v);
    const away = (v) => project(v)[2] < 0;
    const quads = [];
    const wire = [];
    const ghosts = [];
    this.faces.forEach((f, i) => {
      // cut away above the player's deck: those decks are an outline, the cut deck gets its lid
      if (f.lid != null && f.lid !== cut) return;
      const above = cut != null && f.deck != null && f.deck > cut;
      if (above && !ghostly) {
        if (f.outline) wire.push(edgePath(f.pts.map((p) => project(turned(f, p))), f.edges));
        return;
      }
      const n = turned(f, this.normals[i]);
      if (f.cull && (away(n) || (f.anchor && away(turned(f, f.anchor))))) return;
      const P = f.pts.map((p) => project(turned(f, p)));
      (above ? ghosts : quads).push({ f, P, n, layer: f.layer ?? 0, depth: P.reduce((s, p) => s + p[2], 0) / P.length });
    });
    const byDepth = (a, b) => a.layer - b.layer || a.depth - b.depth;
    quads.sort(byDepth);
    ghosts.sort(byDepth);

    // picking: a keyed face carries its key; the pointer goes through a keyless one (a hull), so a
    // room inside it is picked through it
    const room = (f) => {
      if (!this.pick) return {};
      const id = this.roomOf.get(f.key);
      return id ? { "data-room": id } : { "pointer-events": "none" };
    };
    const geo = document.createDocumentFragment();
    const hot = document.createDocumentFragment();
    for (const { f, P, n } of quads) {
      const d = `M${P.map((p) => `${num(p[0])},${num(p[1])}`).join("L")}Z`;
      // a ghost face is drawn only when lit (a room's cell inside a hull, seen through it), and
      // unseen for picking
      if (f.ghost && this.roomOf?.has(f.key)) el("path", { d, fill: "transparent", stroke: "none", ...room(f) }, geo);
      if (!f.ghost) {
        const fill = fillOf(f, Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]));
        el("path", { d, fill, stroke: fill, "stroke-width": 0.8, "stroke-linejoin": "round", ...room(f) }, geo);
        const e = edgePath(P, f.edges);
        if (e) el("path", { d: e, fill: "none", stroke: EDGE, "stroke-width": 1.3, "stroke-linecap": "round", ...room(f) }, geo);
      }
      if (key != null && f.key === key) {
        el("path", { d, fill: HL, "fill-opacity": 0.55, stroke: HL_STROKE, "stroke-width": 1.4, "stroke-linejoin": "round" }, hot);
      }
    }
    // a ghosted deck is faint and never lit: the fill at a low opacity, with its edges
    for (const { f, P, n } of ghosts) {
      if (f.ghost) continue;
      const fill = fillOf(f, Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]));
      el("path", { d: `M${P.map((p) => `${num(p[0])},${num(p[1])}`).join("L")}Z`, fill, "fill-opacity": GHOST_FILL, stroke: "none", ...room(f) }, geo);
      const e = edgePath(P, f.edges);
      if (e) el("path", { d: e, fill: "none", stroke: GHOST_EDGE, "stroke-opacity": 0.55, "stroke-width": 1, "stroke-linecap": "round", ...room(f) }, geo);
    }
    const w = wire.join("");
    if (w) el("path", { d: w, fill: "none", stroke: DIM, "stroke-opacity": 0.7, "stroke-width": 1, "stroke-dasharray": "4 4" }, geo);
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
    const key = this.keyOf(where);
    const hour = this.hourOf(where);
    const cut = this.cutOf(where);
    const cutChanged = cut !== this.cut;
    this.cut = cut;
    if (this.started && key === this.key && hour === this.hour && !cutChanged) return;
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
      if (hour != null && this.turning) this.phi = shortestTurn(this.phi, hour, this.cam.front);
      this.draw();
      return;
    }

    if (hour != null && hourChanged && this.turning) {
      const target = shortestTurn(this.phi, hour, this.cam.front);
      if (Math.abs(target - this.phi) >= EPS) {
        this.animateTo(target);
        this.draw();
        return;
      }
      this.stop(); // already facing: drop any animation still heading for an older hour
    }
    // no turn: redraw only if the lit faces changed (a running animation redraws every frame anyway)
    if (keyChanged || cutChanged) this.draw();
  }

  /** With turning off the wheel rests at the camera's front; turning it on again brings the last hour round. */
  setTurning(enabled) {
    enabled = !!enabled;
    if (enabled === this.turning) return;
    this.turning = enabled;
    if (!enabled) {
      this.stop();
      if (Math.abs(this.phi - this.cam.front) >= EPS) {
        this.phi = this.cam.front;
        this.draw();
      }
    } else if (this.hour != null) {
      const target = shortestTurn(this.phi, this.hour, this.cam.front);
      if (Math.abs(target - this.phi) >= EPS) this.animateTo(target);
    }
  }
}
