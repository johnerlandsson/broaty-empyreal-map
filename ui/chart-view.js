// The system chart (the orrery): a true-scale chart of the star system over the top band, switched
// on and off by a ◎ button left of the band's zoom buttons. Everything is worked out from the clock
// on each draw (lib/orbits.js); this file only projects km to px and draws. The view is a viewBox
// in km with y flipped (svg y = -km y), zoomed and panned like the plans; the svg itself is in px.
// Marks and their colours are the style guide's §13 (docs/maps/style-guide.md).

import {
  EDGE_KM,
  ago,
  clusters,
  edgeMarker,
  errorAt,
  fitBox,
  folded,
  followStep,
  homeBox,
  indexCharts,
  isClosed,
  isLost,
  markOf,
  mouthLabel,
  mouthStar,
  onSurface,
  overlapping,
  parsePoint,
  positionOf,
  scaleKm,
  shipFix,
  spreadOnEdge,
  systemRadius,
} from "./lib/orbits.js";
import { attachPanZoom, el, glowFilter, stars, zoomButtons } from "./lib/svg.js";

const HL = "#ffb347";
const HL_STROKE = "#fff3df";
const DIM = "#7d8a9a";
const ORBIT = "#2b3646";
const STAR = "#fffaf0";
const GLASS = "#cfe3ff";
const EDGE = "#0d1218";
const TONES = ["#3a4556", "#58667b", "#7e8da3"];
const FONT = "Inter, system-ui, sans-serif";
const BELT_SEGMENTS = 14;
const ROCKS = [
  [-2, -1],
  [1.5, 1.5],
  [2, -2],
  [-1, 2],
];
const LABEL_PX = 80; // a satellite of a planet is named once its orbit is this many px across
const BUTTONS_W = 64; // the top right corner the ◎ and + − ⌂ take, px
const BUTTONS_H = 112;
const MARKER_INSET = 14; // px from the band's edge to an off-view chevron
const TOP_CLEAR = 22; // px kept clear at the top for the scale bar and the buttons
const MOUTH_GAP = 18; // px: mouths nearer than this on the edge are spread apart, their names stacked
const MARKER_GAP = 12; // px: off-view markers nearer than this are one chevron, a line each
const STACK_GAP = 48; // px: off-view markers nearer than this whose names would overlap stack them

let instances = 0;

const fmt = (n) => Math.round(n).toLocaleString("en");

/** "16k", "8.5k": thousands of km, as the off-view markers name them. */
function thousands(km) {
  const k = km / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

/** Seconds as "4m 10s", "1h 2m" or "40s". */
function span(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Run one mark's drawing; bad data skips the mark, never the frame (style guide §10). */
function safe(fn) {
  try {
    fn();
  } catch {
    // a mark the data can't draw is left out
  }
}

export class ChartView {
  /**
   * @param {HTMLElement} bandEl the top band
   * @param {{onToggle?: (on: boolean) => void}} [opts] onToggle is called when the user flips ◎
   */
  constructor(bandEl, opts = {}) {
    this.band = bandEl;
    this.onToggle = opts.onToggle ?? (() => {});
    this.index = null;
    this.ship = null;
    this.on = false;
    this.touched = false; // zoomed or panned since the view was last framed
    this.vb = [-EDGE_KM, -EDGE_KM, 2 * EDGE_KM, 2 * EDGE_KM];
    // how far off the centre she may be before the view follows her: 35%, or wherever ⌂ left her
    // if that's further (null: measure at the next draw); a view you've touched doesn't follow
    this.margin = null;
    this.shipAt = null; // her last drawn position, km in viewBox units (y flipped)
    this.tips = new Map();
    this.tipKey = null;
    this.tipShown = null; // what the tooltip last showed, so a redraw doesn't re-show the same
    this.fresh = false; // the system just changed and her status for it hasn't come yet
    this.homeLater = false; // ⌂ ran while the band had no size: frame again once it has one

    const div = document.createElement("div");
    div.className = "chart";
    Object.assign(div.style, {
      position: "absolute",
      inset: "0",
      zIndex: "4",
      display: "none",
      overflow: "hidden",
      background: "#04060c",
      cursor: "grab",
      touchAction: "none",
    });
    bandEl.appendChild(div);
    this.div = div;

    const svg = el("svg", {});
    Object.assign(svg.style, { display: "block", width: "100%", height: "100%" });
    div.appendChild(svg);
    this.svg = svg;
    const id = `chart-${++instances}`;
    const defs = el("defs", {}, svg);
    glowFilter(defs, `${id}-glow`);
    const glow = defs.lastChild; // widen it: a small chevron's blur would be clipped at the default
    glow.setAttribute("x", "-100%");
    glow.setAttribute("y", "-100%");
    glow.setAttribute("width", "300%");
    glow.setAttribute("height", "300%");
    glow.firstChild.setAttribute("stdDeviation", 2.2);
    const sun = el("radialGradient", { id: `${id}-sun` }, defs);
    el("stop", { offset: "0", "stop-color": STAR }, sun);
    el("stop", { offset: ".35", "stop-color": STAR, "stop-opacity": 0.9 }, sun);
    el("stop", { offset: "1", "stop-color": STAR, "stop-opacity": 0 }, sun);
    this.sunFill = `url(#${id}-sun)`;

    stars(el("g", { "pointer-events": "none" }, svg), 0, 0, 2400, 1400, 2000, 31);
    this.marks = el("g", {}, svg);
    // the ship and a searched belt pulse; only the children of `lit` are replaced, so the pulse
    // never restarts (as model-view.js does)
    const hot = el("g", { filter: `url(#${id}-glow)` }, svg);
    this.pulse = el("g", {}, hot);
    this.lit = el("g", {}, this.pulse);
    el("animate", { attributeName: "opacity", values: "1;0.55;1", dur: "1.8s", repeatCount: "indefinite" }, this.pulse);
    this.over = el("g", { "pointer-events": "none" }, svg); // edge markers and the scale bar

    this.zoom = attachPanZoom(div, () => this.vb, (v) => this.userView(v), { minW: 1000, maxW: Infinity });
    zoomButtons(div, "8px", (f) => {
      if (f) this.zoom(f);
      else this.home();
    });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "System chart";
    Object.assign(btn.style, {
      position: "absolute",
      right: "36px",
      top: "8px",
      zIndex: "5",
      display: "none",
      width: "24px",
      height: "24px",
      borderRadius: "5px",
      border: `1px solid ${ORBIT}`,
      background: "var(--bg, #04060c)",
      color: "var(--fg, #dfe7f1)",
      cursor: "pointer",
      padding: "0",
    });
    // drawn, not a ◎ glyph: a glyph sits wherever the font's metrics put it, off the button's middle
    const icon = el("svg", { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", "stroke-width": 1.3 }, btn);
    icon.style.display = "block";
    icon.style.margin = "auto";
    el("circle", { cx: 8, cy: 8, r: 6.5 }, icon);
    el("circle", { cx: 8, cy: 8, r: 3 }, icon);
    btn.style.background = "color-mix(in srgb, var(--bg, #04060c) 70%, transparent)";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.setOn(!this.on);
      this.onToggle(this.on);
    });
    bandEl.appendChild(btn);
    this.btn = btn;

    div.addEventListener("pointermove", (e) => this.hoverAt(e.target));
    div.addEventListener("pointerdown", () => this.hideTip());
    div.addEventListener("pointerleave", () => this.hideTip());
    new ResizeObserver(() => {
      this.margin = null; // the band changing shape isn't her leaving the middle
      if (this.homeLater && !this.touched && this.sized()) this.home();
      else this.draw(Date.now());
    }).observe(bandEl);
  }

  /** True while the chart covers the band: switched on, with charts to show. */
  get shown() {
    return this.on && !!this.index;
  }

  /** True while her position changes by the moment (a smoother redraw is worth it). */
  get moving() {
    return !!this.index && shipFix(this.index, this.ship, Date.now()).kind === "moving";
  }

  /** The cleaned Space.Charts, or null (disconnected): the chart and its toggle go. */
  setCharts(charts) {
    const was = this.index?.system ?? null;
    this.index = charts && typeof charts === "object" ? indexCharts(charts) : null;
    this.btn.style.display = this.index ? "" : "none";
    this.sync();
    if (this.index && this.index.system !== was) {
      // the ship's status for the new system usually follows the charts: frame again on it
      this.fresh = true;
      this.home();
    } else this.draw(Date.now());
  }

  /** The ship's chart state from the Lua side, or null for no ship. */
  setShip(ship) {
    const t = Date.now();
    const kind = (s) => (this.index ? shipFix(this.index, s, t).kind : "none");
    const before = kind(this.ship);
    this.ship = ship && typeof ship === "object" ? ship : null;
    const after = kind(this.ship);
    const fresh = this.fresh;
    this.fresh = false;
    if (!this.touched && (fresh || (before === "moving") !== (after === "moving"))) this.home();
    else this.draw(t);
  }

  /** Switch the chart on or off (from the Lua side's replay or the ◎ button). */
  setOn(on) {
    on = !!on;
    if (on === this.on) return;
    this.on = on;
    this.btn.style.borderColor = on ? "var(--fg-muted, #7d8a9a)" : ORBIT;
    this.sync();
    if (on) this.home();
    else this.hideTip();
  }

  sync() {
    this.div.style.display = this.shown ? "" : "none";
    if (!this.shown) this.hideTip();
  }

  size() {
    return [this.band.clientWidth || 1, this.band.clientHeight || 1];
  }

  /** True once the band has a real size to frame a view in. */
  sized() {
    return this.band.clientWidth > 1 && this.band.clientHeight > 1;
  }

  /** Frame the view as ⌂ does: her trip, the body she's nearest, or the whole system. */
  home() {
    this.touched = false;
    this.margin = null; // ⌂ may frame her off the middle (with her body's satellites): that isn't her leaving it
    if (!this.index) return;
    this.homeLater = !this.sized();
    const t = Date.now();
    const [w, h] = this.size();
    safe(() => {
      const vb = fitBox(homeBox(this.index, this.ship, t), w, h);
      if (vb.every(Number.isFinite)) this.vb = this.clamp(vb);
    });
    this.draw(t);
  }

  /** The widest the view may be: the whole system with a margin, whatever the band's shape. */
  maxW() {
    const [w, h] = this.size();
    return 2.3 * systemRadius(this.index) * Math.max(1, w / h);
  }

  clamp(v) {
    if (!this.index) return v;
    const max = this.maxW();
    if (v[2] <= max) return v;
    const k = max / v[2];
    const cx = v[0] + v[2] / 2;
    const cy = v[1] + v[3] / 2;
    return [cx - (v[2] * k) / 2, cy - (v[3] * k) / 2, v[2] * k, v[3] * k];
  }

  /** The user zoomed or panned. */
  userView(v) {
    const max = this.index ? this.maxW() : Infinity;
    if (v[2] > max && v[2] > this.vb[2]) {
      // already zoomed right out: a further zoom out is ignored rather than clamped about the
      // middle, which would pan the view
      if (this.vb[2] >= max * 0.999) return;
      v = this.clamp(v);
    }
    // a pan (or a zoom in) is taken as it is, even while the band's new shape leaves the view
    // wider than the limit
    this.vb = v;
    this.touched = true; // the view is yours now: it stops following her until ⌂
    this.margin = null;
    this.draw(Date.now());
  }

  /** Km per px, and the km rectangle the band actually shows (y flipped). */
  scale() {
    const [w, h] = this.size();
    return Math.max(this.vb[2] / w, this.vb[3] / h);
  }

  visible() {
    const [w, h] = this.size();
    const s = this.scale();
    const cx = this.vb[0] + this.vb[2] / 2;
    const cy = this.vb[1] + this.vb[3] / 2;
    return [cx - (w * s) / 2, cy - (h * s) / 2, w * s, h * s];
  }

  /** Redraw every mark at wall-clock t (ms). */
  draw(t) {
    if (!this.shown) return;
    const index = this.index;
    const [w, h] = this.size();
    this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    let fix = { kind: "none" };
    safe(() => (fix = shipFix(index, this.ship, t)));
    const herPos = (fix.kind === "at" || fix.kind === "moving") && fix.pos?.every(Number.isFinite) ? fix.pos : null;

    // follow her when she leaves the middle of the view, keeping the zoom (style guide §8.3), but
    // only until you pan or zoom: from then the view is yours until ⌂
    this.shipAt = herPos && [herPos[0], -herPos[1]];
    if (this.shipAt) {
      const seen = this.visible();
      const step = followStep(seen, this.shipAt, this.margin, this.touched);
      this.margin = step.margin;
      if (step.vb !== seen) this.vb = [this.shipAt[0] - this.vb[2] / 2, this.shipAt[1] - this.vb[3] / 2, this.vb[2], this.vb[3]];
    }

    const s = this.scale();
    const cx = this.vb[0] + this.vb[2] / 2;
    const cy = this.vb[1] + this.vb[3] / 2;
    /** km (y up) to px */
    const P = (p) => [w / 2 + (p[0] - cx) / s, h / 2 + (-p[1] - cy) / s];
    const pos = (id) => {
      const p = positionOf(index, id, t);
      return p && p.every(Number.isFinite) ? p : null;
    };

    const marks = document.createDocumentFragment();
    const labels = el("g", { "pointer-events": "none" });
    const over = document.createDocumentFragment();
    const lit = document.createDocumentFragment();
    const tips = new Map();
    const tip = (node, key, title, body = "") => {
      node.setAttribute("data-tip", key);
      tips.set(key, { title, body });
    };
    // A label for a mark inside the band is kept inside it, clear of the buttons (its width is
    // guessed: there's no layout here). A label beside a mark (anchor start or end) that doesn't
    // fit is centred at `above` instead, rather than pushed over the mark.
    const label = (x, y, text, anchor = "middle", above = null) => {
      if (x >= 0 && x <= w) {
        const tw = text.length * 5.5;
        const right = y < BUTTONS_H ? w - BUTTONS_W : w;
        if (above && ((anchor === "end" && x - tw < 4) || (anchor === "start" && x + tw > right - 4))) {
          [x, y] = above;
          anchor = "middle";
        }
        const lo = anchor === "end" ? tw : anchor === "middle" ? tw / 2 : 0;
        const hi = anchor === "start" ? tw : anchor === "middle" ? tw / 2 : 0;
        x = Math.min(Math.max(x, lo + 4), right - hi - 4);
      }
      return el("text", { x, y, "font-size": 10, fill: DIM, "text-anchor": anchor, "font-family": FONT }, labels, text);
    };

    const items = [...index.items.values()];
    const keep = new Set([fix.place, this.ship?.destination].filter(Boolean));
    // folded into its parent (style guide §13.2), or the satellite of something folded
    const foldedParent = (it) => {
      const p = index.items.get(it.orbit.parent);
      return !!p?.orbit && folded(index, p.id, s);
    };
    const hidden = (it) => !keep.has(it.id) && !!it.orbit && (folded(index, it.id, s) || foldedParent(it));
    // a moon's or a planet's belt's name crowds its parent's until its orbit is LABEL_PX across
    const crowded = (it) => {
      if (keep.has(it.id) || !it.orbit) return false;
      const p = index.items.get(it.orbit.parent);
      return p?.kind !== "star" && (2 * (Number(it.orbit.a) || 0)) / s < LABEL_PX;
    };
    const offView = []; // [name, km position, drawn radius px, closed] for the edge markers

    // a planet's disc: its true radius, or at least 3.5 px
    const discR = (it) => Math.max(3.5, (Number(it.radius) || 0) / s);
    // where a port is drawn: on its planet's disc as drawn, where the town is now (px), with the
    // way out from the planet's centre; null for anything else
    const ground = (id) => {
      const on = onSurface(index, id, t);
      const c = on && pos(on.parent.id);
      if (!c) return null;
      const [px, py] = P(c);
      const r = discR(on.parent);
      const u = [Math.cos(on.angle), -Math.sin(on.angle)];
      return { x: px + u[0] * r, y: py + u[1] * r, u, base: [px, py], r, parent: on.parent };
    };

    // the star's position, for lighting the planets
    const star = items.find((it) => it.kind === "star");
    const starPos = star ? pos(star.id) : [0, 0];

    // orbit rings (a port's is its planet's surface: no ring)
    for (const it of items) {
      if (!it.orbit || hidden(it) || markOf(it.kind) === "port") continue;
      safe(() => {
        const base = pos(it.orbit.parent);
        if (!base) return;
        ring(marks, it.orbit, base, P, s, w, h, { stroke: ORBIT, "stroke-width": 1, fill: "none", "pointer-events": "none" });
      });
    }

    // the edge, with the mouths that have no bearing named at its top
    const mouths = items.filter((it) => it.kind === "mouth");
    if (mouths.length) {
      safe(() => {
        const R = systemRadius(index);
        const c = P([0, 0]);
        const r = R / s;
        el("circle", { cx: c[0], cy: c[1], r, fill: "none", stroke: ORBIT, "stroke-dasharray": "1 5", "pointer-events": "none" }, marks);
        const loose = mouths
          .filter((m) => !pos(m.id))
          .map((m) => `${mouthStar(m.name)} lane${isClosed(m) ? ", closed," : ""} somewhere on the edge`);
        loose.forEach((text, i) => label(c[0], c[1] - r + 16 + i * 12, text)); // just inside its top
        const hit = el("circle", { cx: c[0], cy: c[1], r, fill: "none", stroke: "transparent", "stroke-width": 8, "pointer-events": "stroke" }, marks);
        if (loose.length) tip(hit, "edge", loose[0], loose.slice(1).join("\n"));
        else tip(hit, "edge", "The edge", `${fmt(R)} km out`);
      });
    }

    // belts: an arc as wide as the fit's error, or the whole orbit dashed once it's lost
    const searched = fix.kind === "searching" ? fix.place : null;
    for (const it of items) {
      if (it.kind !== "belt" || !it.orbit || hidden(it)) continue;
      safe(() => {
        const base = pos(it.orbit.parent);
        const here = pos(it.id);
        if (!base || !here) return;
        const err = errorAt(it.fit, it.orbit.a, t);
        const lost = isLost(err, it.orbit.a);
        const g = el("g", {}, marks);
        beltArc(g, it.orbit, base, here, err, lost, P, s, w, h, { colour: lost ? TONES[1] : TONES[2] });
        if (it.id === searched) beltArc(el("g", { "pointer-events": "none" }, lit), it.orbit, base, here, err, lost, P, s, w, h, { colour: HL, rocks: false });
        const c = P(here);
        const b = P(base);
        const ox = c[0] - b[0];
        const oy = c[1] - b[1];
        const n = Math.hypot(ox, oy) || 1;
        const text = `${it.name} ${lost ? "· lost" : `±${fmt(err)}`}`;
        if (!crowded(it)) label(c[0] + (ox / n) * 12, c[1] + (oy / n) * 12 + 3, text, ox < 0 ? "end" : "start", [c[0], c[1] - 10]);
        const seen = Number.isFinite(it.fit?.seen) ? `, seen ${ago(t - it.fit.seen)} ago` : "";
        tip(g, `belt:${it.id}`, it.name, `±${fmt(err)} km${seen}`);
        if (!lost) offView.push([it.name, here]); // a lost belt is its whole ring: no one place to point at
      });
    }

    // the star, the planets and the stations
    for (const it of items) {
      if (hidden(it)) continue;
      safe(() => {
        if (markOf(it.kind) === "star") {
          const p = pos(it.id);
          if (!p) return;
          const [x, y] = P(p);
          const r = Math.max(5, (Number(it.radius) || 0) / s);
          const g = el("g", {}, marks);
          el("circle", { cx: x, cy: y, r: r * 2.6, fill: this.sunFill, "pointer-events": "none" }, g);
          el("circle", { cx: x, cy: y, r, fill: STAR }, g);
          label(x, y + r * 2.2 + 8, it.name); // below the brightest of the glow, so it reads
          tip(g, `body:${it.id}`, it.name);
          offView.push([it.name, p, r * 1.6]); // its glow is still half as bright out there: it reads as the star
        } else if (markOf(it.kind) === "planet") {
          const p = pos(it.id);
          if (!p) return;
          const [x, y] = P(p);
          const r = discR(it);
          const g = el("g", {}, marks);
          el("circle", { cx: x, cy: y, r, fill: TONES[0], stroke: EDGE, "stroke-width": 1 }, g);
          if (starPos) {
            // the half toward the star, lit
            const [sx, sy] = P(starPos);
            const a = Math.atan2(sy - y, sx - x);
            const nx = -Math.sin(a) * r;
            const ny = Math.cos(a) * r;
            el("path", { d: `M${x + nx},${y + ny} A${r},${r} 0 0 0 ${x - nx},${y - ny} Z`, fill: TONES[2] }, g);
          }
          if (!crowded(it)) label(x, y + r + 12, it.name);
          tip(g, `body:${it.id}`, it.name);
          offView.push([it.name, p, r]);
        } else if (markOf(it.kind) === "station") {
          const p = pos(it.id);
          if (!p) return;
          const [x, y] = P(p);
          const d = el("rect", { x: x - 2.6, y: y - 2.6, width: 5.2, height: 5.2, fill: GLASS, transform: `rotate(45 ${x} ${y})` }, marks);
          tip(d, `body:${it.id}`, it.name);
        }
      });
    }

    // ports, over their planets: a dome on the planet's edge, flat side down, named outward from it
    // (under the planet's own name when it's on the bottom of the disc)
    for (const it of items) {
      if (markOf(it.kind) !== "port" || hidden(it)) continue;
      safe(() => {
        const at = ground(it.id);
        if (!at) return;
        const { x, y, u } = at;
        const deg = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
        const g = el("g", {}, marks);
        el("path", { d: "M0,-3.6 A3.6,3.6 0 0 1 0,3.6 Z", fill: GLASS, transform: `translate(${x} ${y}) rotate(${deg})` }, g);
        el("circle", { cx: x, cy: y, r: 6, fill: "transparent" }, g);
        if (!crowded(it)) {
          if (u[1] > 0.5) label(x, at.base[1] + at.r + 24, it.name);
          else label(x + u[0] * 9, y + u[1] * 9 + 3, it.name, u[0] >= 0 ? "start" : "end", [x, y - 10]);
        }
        tip(g, `body:${it.id}`, it.name, `on ${at.parent.name}'s surface`);
      });
    }

    // mouths with a bearing: a double chevron on the edge, pointing out, dashed in Dim if its lane is
    // closed (style guide §13). Mouths too near each other at this zoom are spread along the edge,
    // their names stacked.
    safe(() => {
      const placed = mouths.map((m) => [m, pos(m.id)]).filter(([, p]) => p);
      const R = systemRadius(index) / s;
      const { angles, groups } = spreadOnEdge(
        placed.map(([, p]) => (Math.atan2(p[1], p[0]) * 180) / Math.PI),
        ((MOUTH_GAP / Math.max(R, 1)) * 180) / Math.PI,
      );
      placed.forEach(([m, p], i) => {
        const r = Math.hypot(p[0], p[1]);
        const a = (angles[i] * Math.PI) / 180;
        const [x, y] = P([r * Math.cos(a), r * Math.sin(a)]);
        const closed = isClosed(m);
        const g = el("g", {}, marks);
        el("path", {
          d: "M-5,-6 L3,0 L-5,6 M-1,-6 L7,0 L-1,6",
          fill: "none",
          stroke: closed ? DIM : GLASS,
          "stroke-width": 1.4,
          ...(closed ? { "stroke-dasharray": "2.2 1.8" } : {}),
          transform: `translate(${x} ${y}) rotate(${-angles[i]})`,
        }, g);
        el("circle", { cx: x, cy: y, r: 8, fill: "transparent" }, g);
        tip(g, `mouth:${m.id}`, m.name, closed ? "closed" : "");
        offView.push([mouthLabel(m), p, 0, closed]);
      });
      // a crowd's names, one line a mouth in bearing order, just inside its middle; stacked up from
      // the edge below the star, down from it above
      for (const grp of groups) {
        const mid = (grp.reduce((sum, i) => sum + angles[i], 0) / grp.length) * (Math.PI / 180);
        const r = Math.hypot(...placed[grp[0]][1]);
        const [x, y] = P([r * Math.cos(mid), r * Math.sin(mid)]);
        const lx = x - Math.cos(mid) * 12;
        const ly = y + Math.sin(mid) * 12 + 3;
        const up = Math.sin(mid) < 0;
        grp.forEach((i, k) => {
          const dy = (up ? k - (grp.length - 1) : k) * 12;
          // one that won't fit beside them goes above them instead, the stack centred
          label(lx, ly + dy, mouthLabel(placed[i][0]), Math.cos(mid) >= 0 ? "end" : "start", [x, y - 12 - (grp.length - 1 - k) * 12]);
        });
      }
    });

    // her route and her chevron
    safe(() => {
      const shipName = this.ship?.name ?? "Your ship";
      const nameOf = (id) => {
        const pt = parsePoint(id);
        if (pt) return `a point off ${index.items.get(pt.body)?.name ?? pt.body}`;
        return index.items.get(id)?.name ?? String(id);
      };
      if (fix.kind === "moving") {
        const f = pos(fix.leg.frame);
        if (!f) return;
        const a = P([f[0] + fix.leg.from[0], f[1] + fix.leg.from[1]]);
        const b = P([f[0] + fix.leg.to[0], f[1] + fix.leg.to[1]]);
        const me = P(fix.pos);
        el("line", { x1: a[0], y1: a[1], x2: me[0], y2: me[1], stroke: HL, "stroke-opacity": 0.25, "stroke-width": 1.2, "pointer-events": "none" }, marks);
        el("line", { x1: me[0], y1: me[1], x2: b[0], y2: b[1], stroke: HL, "stroke-opacity": 0.55, "stroke-width": 1.2, "stroke-dasharray": "4 4", "pointer-events": "none" }, marks);
        el("circle", { cx: b[0], cy: b[1], r: 5, fill: "none", stroke: HL, "stroke-opacity": 0.7, "stroke-width": 1.2, "pointer-events": "none" }, marks);
        const c = chevron(lit, me, -fix.heading);
        tip(c, "ship", shipName, `bound for ${nameOf(fix.place)}, ${span((fix.leg.arrive - t) / 1000)}`);
      } else if (fix.kind === "bound") {
        const eta = Number(this.ship?.eta);
        const received = Number(this.ship?.received);
        const at = Number.isFinite(eta) && Number.isFinite(received) ? (received + eta) * 1000 : t;
        const d = positionOf(index, fix.place, at) ?? pos(fix.place);
        if (!d) return;
        const b = P(d);
        el("circle", { cx: b[0], cy: b[1], r: 5, fill: "none", stroke: HL, "stroke-opacity": 0.7, "stroke-width": 1.2, "pointer-events": "none" }, marks);
      } else if (fix.kind === "at" && herPos) {
        // at a port, on its dome: the planet's disc may be drawn bigger than it is
        const at = fix.place ? ground(fix.place) : null;
        const c = chevron(lit, at ? [at.x, at.y] : P(herPos), -Math.PI / 2);
        const docked = at ? "landed at" : "docked at";
        // at no place: stopped mid-trip, at rest where she was
        const where = fix.place ? `${this.ship?.docked ? docked : at ? "over" : "at"} ${nameOf(fix.place)}` : "adrift";
        tip(c, "ship", shipName, where);
      }
    });

    // off-view markers: bodies, belts and placed mouths beyond the band's edge
    const view = this.visible();
    const inner = [view[0], view[1] + TOP_CLEAR * s, view[2], view[3] - TOP_CLEAR * s];
    const from = herPos ?? [cx, -cy];
    // each off-view thing's marker; those that land together are one chevron (dashed if all of them
    // are closed mouths) with a line each
    const shown = [];
    for (const [name, p, r = 0, closed = false] of offView) {
      safe(() => {
        // off the band, it's marked just inside it, below the scale bar and the buttons
        if (!edgeMarker(view, [p[0], -p[1]], 0)) return;
        // a body whose disc still reaches into the band is seen: no marker
        const [px, py] = P(p);
        if (Math.hypot(Math.max(0, -px, px - w), Math.max(0, -py, py - h)) < r) return;
        const m = edgeMarker(inner, [p[0], -p[1]], MARKER_INSET * s);
        if (!m) return;
        const km = Math.hypot(p[0] - from[0], p[1] - from[1]);
        shown.push({ at: P([m.x, -m.y]), angle: m.angle, text: `${name} ${thousands(km)}`, closed });
      });
    }
    // a chevron a cluster; then the names of nearby clusters whose names would overlap stacked as one
    // (a far one's name stays by its own chevron)
    const drawn = clusters(shown.map((it) => it.at), MARKER_GAP).map((c) => {
      const [x, y] = shown[c[0]].at;
      const angle = shown[c[0]].angle;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const anchor = cos > 0.3 ? "end" : cos < -0.3 ? "start" : "middle";
      const tx = x - cos * 10;
      const ty = y - sin * 10 + 3;
      const lines = c.map((i) => shown[i].text);
      const tw = Math.max(...lines.map((l) => l.length * 5));
      const x0 = anchor === "end" ? tx - tw : anchor === "middle" ? tx - tw / 2 : tx;
      return { c, x, y, angle, anchor, tx, ty, lines, box: [x0, ty - 9, x0 + tw, ty + 11 * (lines.length - 1) + 2] };
    });
    for (const k of drawn) {
      safe(() => {
        el("path", {
          d: "M-4,-5 L3,0 L-4,5",
          fill: "none",
          stroke: DIM,
          "stroke-width": 1.3,
          ...(k.c.every((i) => shown[i].closed) ? { "stroke-dasharray": "2 1.6" } : {}),
          transform: `translate(${k.x} ${k.y}) rotate(${(k.angle * 180) / Math.PI})`,
        }, over);
      });
    }
    const near = (i, j) => Math.hypot(drawn[i].x - drawn[j].x, drawn[i].y - drawn[j].y) < STACK_GAP;
    // a name that would still overlap names already placed goes on the other side of its chevron,
    // if it fits in the band there; the biggest stacks are placed first, so it's the lone names that move
    const placedBoxes = [];
    const meets = (a) => placedBoxes.some((b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]);
    const stacks = overlapping(drawn.map((k) => k.box), near);
    const size = (grp) => grp.reduce((n, g) => n + drawn[g].lines.length, 0);
    stacks.sort((a, b) => size(b) - size(a));
    for (const grp of stacks) {
      safe(() => {
        const k = drawn[grp[0]];
        const lines = grp.flatMap((g) => drawn[g].lines);
        // stacked away from the band's edge: up from the bottom, down from the top
        const sin = Math.sin(k.angle);
        const lift = sin > 0.3 ? -(lines.length - 1) : sin < -0.3 ? 0 : -(lines.length - 1) / 2;
        const tw = Math.max(...lines.map((l) => l.length * 5));
        const top = k.ty + lift * 11 - 9;
        const bottom = k.ty + (lift + lines.length - 1) * 11 + 2;
        const boxAt = (x, anchor) => {
          const x0 = anchor === "end" ? x - tw : anchor === "middle" ? x - tw / 2 : x;
          return [x0, top, x0 + tw, bottom];
        };
        let [x, anchor] = [k.tx, k.anchor];
        if (meets(boxAt(x, anchor))) {
          const sides = anchor === "start" ? [[k.x - 8, "end"]] : anchor === "end" ? [[k.x + 8, "start"]] : [[k.x - 8, "end"], [k.x + 8, "start"]];
          const other = sides.find(([sx, sa]) => {
            const b = boxAt(sx, sa);
            return b[0] >= 0 && b[2] <= w && !meets(b);
          });
          if (other) [x, anchor] = other;
        }
        placedBoxes.push(boxAt(x, anchor));
        lines.forEach((line, n) => {
          const t2 = el("text", { x, y: k.ty + (lift + n) * 11, "font-size": 9, fill: DIM, "text-anchor": anchor, "font-family": FONT });
          t2.textContent = line;
          over.appendChild(t2);
        });
      });
    }

    // the scale bar, top left
    safe(() => {
      const km = scaleKm(s, 90);
      const L = km / s;
      const x = 16;
      const y = 18;
      el("line", { x1: x, y1: y, x2: x + L, y2: y, stroke: DIM, "stroke-width": 1 }, over);
      for (const xx of [x, x + L]) el("line", { x1: xx, y1: y - 3, x2: xx, y2: y + 3, stroke: DIM, "stroke-width": 1 }, over);
      const tx = el("text", { x: x + L / 2, y: y - 6, "font-size": 9, fill: DIM, "text-anchor": "middle", "font-family": FONT });
      tx.textContent = `${fmt(km)} km`;
      over.appendChild(tx);
    });

    marks.appendChild(labels);
    this.marks.replaceChildren(marks);
    this.lit.replaceChildren(lit);
    this.over.replaceChildren(over);
    this.tips = tips;
    this.refreshTip();
  }

  hoverAt(target) {
    const node = target?.closest?.("[data-tip]");
    const key = node?.getAttribute("data-tip") ?? null;
    if (key === this.tipKey) return;
    if (!key) return this.hideTip();
    this.tipKey = key;
    this.showTip(node);
  }

  showTip(node) {
    const c = this.tips.get(this.tipKey);
    if (!c) return this.hideTip();
    const r = node.getBoundingClientRect();
    // a redraw that changes nothing the tooltip shows doesn't show it again
    const same = [this.tipKey, c.title, c.body, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join("|");
    if (same === this.tipShown) return;
    this.tipShown = same;
    window.panel?.tooltip?.show(r, { title: c.title, body: c.body });
  }

  /** After a redraw: follow the hovered mark (her eta counts down), or hide if it's gone. */
  refreshTip() {
    if (!this.tipKey) return;
    const node = this.svg.querySelector(`[data-tip="${CSS.escape(this.tipKey)}"]`);
    if (node) this.showTip(node);
    else this.hideTip();
  }

  hideTip() {
    if (this.tipKey) window.panel?.tooltip?.hide?.();
    this.tipKey = null;
    this.tipShown = null;
  }
}

/** An amber chevron at p (px), pointing `angle` (radians, screen), into the pulse group. */
function chevron(parent, p, angle) {
  return el(
    "path",
    {
      d: "M7,0 L-5,-5 L-2,0 L-5,5 Z",
      fill: HL,
      stroke: HL_STROKE,
      "stroke-width": 0.8,
      "stroke-linejoin": "round",
      transform: `translate(${p[0]} ${p[1]}) rotate(${(angle * 180) / Math.PI})`,
    },
    parent,
  );
}

/** Km from the parent on an orbit, at polar angle phi (radians, from the parent, y up). */
function onOrbit(orbit, phi) {
  const a = Number(orbit.a) || 0;
  const e = Math.min(Math.max(Number(orbit.e) || 0, 0), 0.95);
  const w = ((Number(orbit.peri) || 0) * Math.PI) / 180;
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(phi - w));
  return [r * Math.cos(phi), r * Math.sin(phi)];
}

/** True when a ring of radius r px about c can cross the w x h band (else it's skipped). */
function crosses(c, r, w, h) {
  const nx = Math.max(0, -c[0], c[0] - w);
  const ny = Math.max(0, -c[1], c[1] - h);
  const far = Math.max(Math.hypot(c[0], c[1]), Math.hypot(c[0] - w, c[1]), Math.hypot(c[0], c[1] - h), Math.hypot(c[0] - w, c[1] - h));
  return Math.hypot(nx, ny) <= r + 4 && far >= r - 4;
}

/** An orbit as a circle or an ellipse about its parent at base (km). */
function ring(parent, orbit, base, P, s, w, h, attrs) {
  const a = Number(orbit.a) || 0;
  if (a <= 0) return null;
  const e = Math.min(Math.max(Number(orbit.e) || 0, 0), 0.95);
  const peri = Number(orbit.peri) || 0;
  const w0 = (peri * Math.PI) / 180;
  const c = P([base[0] - a * e * Math.cos(w0), base[1] - a * e * Math.sin(w0)]);
  const rx = a / s;
  if (!crosses(c, rx, w, h)) return null;
  if (e === 0) return el("circle", { cx: c[0], cy: c[1], r: rx, ...attrs }, parent);
  const ry = (a * Math.sqrt(1 - e * e)) / s;
  return el("ellipse", { cx: c[0], cy: c[1], rx, ry, transform: `rotate(${-peri} ${c[0]} ${c[1]})`, ...attrs }, parent);
}

/** A belt as the fit has it: 14 fading segments either side of where the fit puts it, with rocks
 *  at the centre; or, lost, its whole orbit dashed. */
function beltArc(g, orbit, base, here, err, lost, P, s, w, h, { colour, rocks = true }) {
  if (lost) {
    ring(g, orbit, base, P, s, w, h, { fill: "none", stroke: colour, "stroke-dasharray": "2 4", "stroke-width": 1.4 });
    // hit area along the ring for the tooltip
    ring(g, orbit, base, P, s, w, h, { fill: "none", stroke: "transparent", "stroke-width": 8, "pointer-events": "stroke" });
    return;
  }
  const th = Math.atan2(here[1] - base[1], here[0] - base[0]);
  const r = Math.hypot(here[0] - base[0], here[1] - base[1]) || Number(orbit.a) || 1;
  const half = Math.min(Math.PI, err / r);
  const pt = (phi) => {
    const o = onOrbit(orbit, phi);
    return P([base[0] + o[0], base[1] + o[1]]);
  };
  for (let i = 0; i < BELT_SEGMENTS; i++) {
    const f = (i + 0.5) / BELT_SEGMENTS;
    const a0 = th - half + (2 * half * i) / BELT_SEGMENTS;
    const a1 = th - half + (2 * half * (i + 1)) / BELT_SEGMENTS;
    const pts = [0, 1, 2, 3].map((k) => pt(a0 + ((a1 - a0) * k) / 3));
    el(
      "path",
      {
        d: `M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L")}`,
        fill: "none",
        stroke: colour,
        "stroke-opacity": 0.15 + 0.6 * (1 - Math.abs(2 * f - 1)),
        "stroke-width": 5,
        "stroke-linecap": "round",
      },
      g,
    );
  }
  if (rocks) {
    const c = P(here);
    for (const [dx, dy] of ROCKS) el("circle", { cx: c[0] + dx, cy: c[1] + dy, r: 1.2, fill: colour }, g);
  }
}
