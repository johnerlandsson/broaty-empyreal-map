// The walked land's board (spec, "Drawing the board"): Tamsin's land round Zennor in the bottom
// band, an octagon each walked place on a 1.2 km tiling, the ways between them, dotted stubs for
// the ways not taken, and Zennor's block with its roads out. Only what you've stood in is drawn
// or named. The layout is lib/land-layout.js's; this draws it, redrawing everything on draw().
//
// The board is in km (the viewBox); what's given in screen pixels (edges, textures, labels, the
// track edges' and stubs' dashes) is kept that size at any zoom by rescale(), on every view change.

import { DIM, label } from "./deck-view.js";
import { groupOf } from "./lib/land-kinds.js";
import { CELL, layoutLand, octagon } from "./lib/land-layout.js";
import { groundStyle } from "./lib/land-patterns.js";
import { attachPanZoom, el, glowFilter, pulse, zoomButtons } from "./lib/svg.js";

const HL = "#ffb347";
const GROUND = "#110e0b";
const EARTH = "#332b22";
const STONE = "#4b4338";
const FIXTURE = "#cfd8e3";
const ZENNOR = "#16120f";
const CORNER = "#1a1511";
const HOME_K = 26; // px a km when centred on you
const MIN_W = 2; // km across the view, zoomed in
const MAX_W = 160; // km across, zoomed out
const BASE = [600, 520]; // px assumed before the band has been measured
const SQ = CELL / 2 - CELL / (2 * (1 + Math.SQRT2)); // centre to corner of a corner square
const NOTE = "M0,0 h5.2 v5.2 l-1.7,1.7 h-3.5 Z"; // a folded corner, px
const NOTE_AT = { x: 0.3, y: -0.4 }; // its top left from the octagon's middle, km (svg y)
const NS = "http://www.w3.org/2000/svg";

let instances = 0;

const f = (v) => +v.toFixed(4);

export class LandDeck {
  /**
   * @param {HTMLElement} deckEl element the board fills
   * @param {{town: {e: number, n: number}[], joins: object}} world the land's entry in ui/data/land.js
   */
  constructor(deckEl, world) {
    const n = ++instances;
    this.world = world;
    const div = document.createElement("div");
    div.className = "deck land";
    Object.assign(div.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      background: GROUND,
      cursor: "grab",
      touchAction: "none",
    });
    deckEl.appendChild(div);
    this.div = div;

    const svg = el("svg", { preserveAspectRatio: "xMidYMid slice" });
    Object.assign(svg.style, { display: "block", width: "100%", height: "100%" });
    div.appendChild(svg);
    this.svg = svg;
    const defs = el("defs", {}, svg);
    const glowId = `glow-land-${n}`;
    glowFilter(defs, glowId);
    this.glow = `url(#${glowId})`;
    // every octagon is a use of this one path, drawn 2 px under full size by rescale()
    this.octId = `land-oct-${n}`;
    this.oct = el("path", { id: this.octId, d: octagon(0, 0), "vector-effect": "non-scaling-stroke" }, defs);
    this.patterns = new Map(); // group -> its pattern element
    this.patternPrefix = `land-${n}-`;
    this.defs = defs;
    this.board = el("g", {}, svg);

    const north = document.createElement("div");
    north.className = "north";
    north.textContent = "N ▲";
    Object.assign(north.style, {
      position: "absolute",
      left: "10px",
      top: "8px",
      color: DIM,
      font: "10px Inter, system-ui, sans-serif",
      letterSpacing: "1px",
      pointerEvents: "none",
    });
    div.appendChild(north);

    this.focus = null; // [x, svg y] of your octagon's middle
    this.homed = false;
    this.px = 0;
    this.aspect = BASE[1] / BASE[0];
    const w = BASE[0] / HOME_K;
    this.cur = [-w / 2, (-w * this.aspect) / 2, w, w * this.aspect];
    this.apply();

    this.zoom = attachPanZoom(div, () => this.cur, (v) => this.setView(v), { minW: MIN_W, maxW: MAX_W });
    zoomButtons(div, "8px", (fac) => (fac ? this.zoom(fac) : this.home()));
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => {
        const k = this.px ? this.px / this.cur[2] : HOME_K;
        if (!this.measure()) return;
        if (this.homePending) {
          this.home();
          return;
        }
        this.centre(this.cur[0] + this.cur[2] / 2, this.cur[1] + this.cur[3] / 2, k);
      }).observe(div);
    }
  }

  /** The band's size, if it can be measured (not while hidden). */
  measure() {
    const r = this.div.getBoundingClientRect?.();
    if (!r || r.width <= 0 || r.height <= 0) return false;
    this.px = r.width;
    this.aspect = r.height / r.width;
    return true;
  }

  /** Centre the view on (x, y) at k px a km. */
  centre(x, y, k) {
    const w = (this.px || BASE[0]) / k;
    const h = w * this.aspect;
    this.setView([x - w / 2, y - h / 2, w, h]);
  }

  /** Centre on you (else on Zennor) at 26 px a km. */
  home() {
    this.homePending = !this.measure(); // hidden: home again once it has a size
    this.homed = true;
    const [x, y] = this.focus ?? [0, 0];
    this.centre(x, y, HOME_K);
  }

  /** Re-centre on you only when your octagon is outside the middle half of the view. */
  follow() {
    if (!this.focus) return;
    const [x, y] = this.focus;
    const [vx, vy, vw, vh] = this.cur;
    if (Math.abs(x - (vx + vw / 2)) > vw / 4 || Math.abs(y - (vy + vh / 2)) > vh / 4) {
      this.setView([x - vw / 2, y - vh / 2, vw, vh]);
    }
  }

  show(on) {
    this.div.style.display = on ? "" : "none";
  }

  setView(v) {
    this.cur = v;
    this.apply();
  }

  apply() {
    this.svg.setAttribute("viewBox", this.cur.map((v) => +v.toFixed(4)).join(" "));
    this.rescale((this.px || BASE[0]) / this.cur[2]);
  }

  /** Keep what's sized in screen pixels that size at k px a km. */
  rescale(k) {
    this.k = k;
    const full = CELL * k;
    this.oct.setAttribute("transform", `scale(${f(Math.max(0.5, (full - 2) / full))})`);
    for (const p of this.patterns.values()) p.setAttribute("patternTransform", `scale(${f(1 / k)})`);
    const px = (v) => f(v / k);
    this.trackEdges?.setAttribute("stroke-width", f(0.22 + 4 / k));
    this.trackEdges?.setAttribute("stroke-dasharray", `${px(4)} ${px(3)}`);
    this.stubs?.setAttribute("stroke-width", px(1.6));
    this.stubs?.setAttribute("stroke-dasharray", `${px(0.1)} ${px(3.4)}`);
    this.edge?.setAttribute("stroke-dasharray", `${px(4)} ${px(3)}`);
    for (const { node, x, y, angle } of this.fixed ?? []) {
      node.setAttribute("transform", `translate(${f(x)} ${f(y)})${angle ? ` rotate(${f(angle)})` : ""} scale(${px(1)})`);
    }
  }

  /** The pattern for a group's texture, made the first time it's needed; null for none. */
  pattern(group) {
    const { pattern } = groundStyle(group);
    if (!pattern) return null;
    if (!this.patterns.has(group)) {
      const p = el("pattern", { id: this.patternPrefix + group, width: pattern.w, height: pattern.h, patternUnits: "userSpaceOnUse" }, this.defs);
      const doc = new DOMParser().parseFromString(`<svg xmlns="${NS}">${pattern.svg}</svg>`, "image/svg+xml");
      for (const c of [...doc.documentElement.childNodes]) p.appendChild(document.importNode(c, true));
      this.patterns.set(group, p);
    }
    return `url(#${this.patternPrefix}${group})`;
  }

  /** Something drawn in screen pixels at (x, y), turned by angle; rescale() keeps it that size. */
  pinned(parent, x, y, angle = 0) {
    const g = el("g", {}, parent);
    this.fixed.push({ node: g, x, y, angle });
    return g;
  }

  /** Redraw the whole board from the store's walked places and where you are. */
  draw(store) {
    const places = store.places();
    const L = layoutLand(places, this.world);
    const byId = new Map(places.map((p) => [p.id, p]));
    this.board.replaceChildren();
    this.fixed = [];
    const g = (attrs) => el("g", attrs, this.board);
    const use = (parent, attrs) => el("use", { href: `#${this.octId}`, ...attrs }, parent);

    // Zennor's block, its name and its roads out
    const town = L.zennor.outline;
    if (town.length) {
      const zg = g({});
      this.edge = el("polygon", { points: town.map((p) => `${f(p.x)},${f(p.y)}`).join(" "), fill: ZENNOR, stroke: STONE, "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, zg);
      const xs = town.map((p) => p.x), ys = town.map((p) => p.y);
      const name = this.pinned(zg, (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
      label(name, 0, 0, "ZENNOR", 12, { fill: DIM, "letter-spacing": 1.5 });
    } else this.edge = null;
    const roads = g({ stroke: EARTH, "stroke-width": 0.24, "stroke-linecap": "round" });
    for (const r of L.zennor.roads) el("line", { x1: f(r.x1), y1: f(r.y1), x2: f(r.x2), y2: f(r.y2) }, roads);

    // the corner squares under diagonal ways
    const corners = g({ fill: CORNER, stroke: STONE, "stroke-width": 1, "vector-effect": "non-scaling-stroke" });
    for (const c of L.corners) {
      el("polygon", { points: [[c.x, c.y - SQ], [c.x + SQ, c.y], [c.x, c.y + SQ], [c.x - SQ, c.y]].map(([x, y]) => `${f(x)},${f(y)}`).join(" ") }, corners);
    }

    // the octagons: the ground's colour, its texture over it, a Stone edge
    const octs = g({});
    for (const p of places) {
      const c = L.cells.get(p.id);
      const group = groupOf(p.id, p.name);
      const og = el("g", { "data-place": p.id, transform: `translate(${f(c.x)} ${f(-c.y)})` }, octs);
      use(og, { fill: groundStyle(group).fill, stroke: STONE, "stroke-width": 1.2 });
      const pat = this.pattern(group);
      if (pat) use(og, { fill: pat, stroke: "none", "pointer-events": "none" });
    }

    // the ways: tracks (a dashed Stone edge under an Earth band), then doors, diagonals, bends and longer ways
    const tracks = L.ways.filter((w) => w.track);
    this.trackEdges = g({ stroke: STONE, fill: "none" });
    for (const w of tracks) el("path", { d: w.path }, this.trackEdges);
    const bands = g({ stroke: EARTH, "stroke-width": 0.22, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" });
    for (const w of tracks) el("path", { d: w.path }, bands);
    const ways = g({ stroke: EARTH, fill: "none", "stroke-linejoin": "round" });
    for (const w of L.ways) {
      if (w.track) continue;
      const attrs = { door: { "stroke-width": 0.2, "stroke-linecap": "butt" }, diagonal: { "stroke-width": 0.1, "stroke-linecap": "round" } }[w.kind] ?? {
        "stroke-width": 0.13,
        "stroke-linecap": "round",
      };
      el("path", { d: w.path, ...attrs }, ways);
    }

    // the ways not taken
    this.stubs = g({ stroke: DIM, "stroke-linecap": "round" });
    for (const s of L.stubs) el("line", { "data-stub": "", x1: f(s.x1), y1: f(s.y1), x2: f(s.x2), y2: f(s.y2) }, this.stubs);

    // one-way ways: a chevron pointing the way you can go
    const chevrons = g({ stroke: FIXTURE, "stroke-width": 2.2, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" });
    for (const w of L.ways) {
      if (!w.chevron) continue;
      const { x, y, angle } = w.chevron;
      el("path", { d: "M-0.06,-0.11 L0.06,0 L-0.06,0.11", "vector-effect": "non-scaling-stroke", transform: `translate(${f(x)} ${f(y)}) rotate(${f(angle)})` }, chevrons);
    }

    // notes: a folded corner at the octagon's top right
    const notes = g({ fill: DIM, "fill-opacity": 0.9 });
    for (const p of places) {
      if (!p.note) continue;
      const c = L.cells.get(p.id);
      el("path", { d: NOTE }, this.pinned(notes, c.x + NOTE_AT.x, -c.y + NOTE_AT.y));
    }

    // names: regions, and tracks along the track
    const names = g({});
    for (const l of L.labels) {
      const at = this.pinned(names, l.x, l.y, l.angle);
      if (l.kind === "region") label(at, 0, 0, l.text, 12, { fill: DIM, "font-style": "italic", "letter-spacing": 2 });
      else label(at, 0, -17, l.text, 10.5, { fill: DIM, "font-style": "italic", "letter-spacing": 1 });
    }

    // your octagon, lit
    const here = store.here && byId.has(store.here) ? L.cells.get(store.here) : null;
    this.focus = here ? [here.x, -here.y] : null;
    if (here) {
      const hl = g({ "data-here": store.here, filter: this.glow, transform: `translate(${f(here.x)} ${f(-here.y)})` });
      pulse(use(hl, { fill: HL, "fill-opacity": 0.3, stroke: HL, "stroke-width": 3, "pointer-events": "none" }));
    }

    this.rescale(this.k ?? HOME_K);
    if (here && !this.homed) this.home();
  }
}
