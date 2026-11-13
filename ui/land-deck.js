// The walked land's map (docs/maps/land.md): Tamsin's land round Zennor in the bottom band, an
// octagon each walked place where it really is, the ways between them as straight lines, dotted
// stubs for the ways not taken, and Zennor's block with its roads out. Only what you've stood in is drawn
// or named. The layout is lib/land-layout.js's; this draws it, rebuilding the board on draw() only
// when the walked places have changed.
//
// The board is in km (the viewBox); what's given in screen pixels (edges, textures, labels, the
// track edges' and stubs' dashes) is kept that size at any zoom by rescale(), on every view change.
//
// Finding your way (spec, "Finding your way" and "Notes and forgetting"): click a walked place to
// light the route there from where you are, with a card of its steps; hover one for its name and
// note; right-click one for its note, or the ground to forget the land; and "← Zennor" on the
// view's edge while Zennor is out of sight. The cards are HTML over the board, kept beside their
// place on every view change. The deck never changes the store: notes and forgetting go out by
// onNote() and onForget().

import { DIM, label } from "./deck-view.js";
import { groupOf } from "./lib/land-kinds.js";
import { layoutLand, num, OCT, octagon } from "./lib/land-layout.js";
import { groundStyle } from "./lib/land-patterns.js";
import { edgeCard, nearestRoadEnd, routePath } from "./lib/land-route.js";
import { attachPanZoom, attachPick, el, glowFilter, pulse, zoomButtons } from "./lib/svg.js";

const HL = "#ffb347";
const GROUND = "#110e0b";
const EARTH = "#332b22";
const STONE = "#4b4338";
const FIXTURE = "#cfd8e3";
const ZENNOR = "#16120f";
const HOME_K = 26; // px a km when centred on you
const MIN_W = 2; // km across the view, zoomed in
const MAX_W = 160; // km across, zoomed out
const BASE = [600, 520]; // px assumed before the band has been measured
const CHEVRON = "M-3.5,-3.5 L2.5,0 L-3.5,3.5"; // px, pointing along +x: narrow enough to read as an arrow at any turn
const NOTE = "M0,0 h5.2 v5.2 l-1.7,1.7 h-3.5 Z"; // a folded corner, px
const NOTE_AT = { x: 0.24, y: -0.32 }; // its top left from the octagon's middle, km (svg y)
const NS = "http://www.w3.org/2000/svg";
const ARROW = { left: "←", right: "→", top: "↑", bottom: "↓" };

/** "N steps the way you know", for a route of place ids (both ends included). */
export const stepsText = (route) => (route.length === 2 ? "1 step the way you know" : `${route.length - 1} steps the way you know`);

let instances = 0;

export class LandDeck {
  /**
   * @param {HTMLElement} deckEl element the board fills
   * @param {{town: {e: number, n: number}[], joins: object}} world the land's entry in ui/data/land.js
   * @param {string} body the world whose land this is (area `surface.<body>`): only its places are drawn
   */
  constructor(deckEl, world, body) {
    const n = ++instances;
    this.world = world;
    this.prefix = `surface.${body}.`;
    this.places = []; // this land's walked places, as last drawn
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

    const svg = el("svg", { preserveAspectRatio: "xMidYMid slice", "data-pick": "ground" });
    Object.assign(svg.style, { display: "block", width: "100%", height: "100%" });
    div.appendChild(svg);
    this.svg = svg;
    const defs = el("defs", {}, svg);
    const glowId = `glow-land-${n}`;
    glowFilter(defs, glowId);
    this.glow = `url(#${glowId})`;
    // every octagon is a use of this one path
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

    this.store = null;
    this.L = null;
    this.target = null; // the walked place you clicked, whose route is lit
    this.editing = null; // the place whose note is being written
    this.noteFns = [];
    this.forgetFns = [];
    this.onEsc = (e) => {
      if (e.key === "Escape") this.setTarget(null);
    };
    attachPick(div, (id) => this.pick(id), "data-pick");
    // a press on the board closes a menu, a confirm or a note being written
    div.addEventListener("pointerdown", () => this.closeAll());
    div.addEventListener("contextmenu", (e) => {
      if (e.target.closest?.("input")) return; // the note's input keeps its own menu
      e.preventDefault();
      if (!this.svg.contains(e.target) || !this.places.length) return;
      this.closeAll();
      const id = e.target.closest?.("[data-pick]")?.getAttribute("data-pick");
      const r = div.getBoundingClientRect();
      const at = [e.clientX - r.left, e.clientY - r.top];
      if (id && id !== "ground") {
        const items = [["Note…", () => this.editNote(id)]];
        if (this.store.place(id)?.note) items.push(["Remove note", () => this.note(id, null)]);
        this.openMenu(at, items);
      } else this.openMenu(at, [["Forget this land…", () => this.askForget(at)]]);
    });
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
    if (!on) this.hideTip();
    this.div.style.display = on ? "" : "none";
  }

  setView(v) {
    this.cur = v;
    this.apply();
  }

  apply() {
    this.svg.setAttribute("viewBox", this.cur.map(num).join(" "));
    this.rescale((this.px || BASE[0]) / this.cur[2]);
    this.placeCards?.();
  }

  /** Keep what's sized in screen pixels that size at k px a km. */
  rescale(k) {
    this.k = k;
    for (const p of this.patterns.values()) p.setAttribute("patternTransform", `scale(${num(1 / k)})`);
    const px = (v) => num(v / k);
    this.trackEdges?.setAttribute("stroke-width", num(0.22 + 4 / k));
    this.trackEdges?.setAttribute("stroke-dasharray", `${px(4)} ${px(3)}`);
    this.stubs?.setAttribute("stroke-width", px(1.6));
    this.stubs?.setAttribute("stroke-dasharray", `${px(0.1)} ${px(3.4)}`);
    // Zennor's edge is dashed, so it's all in km (no non-scaling-stroke: its dashes would be in px)
    this.edge?.setAttribute("stroke-width", px(1));
    this.edge?.setAttribute("stroke-dasharray", `${px(4)} ${px(3)}`);
    // the route and the target's outline: dashed, so in km too
    this.routeLine?.setAttribute("stroke-width", px(1.5));
    this.routeLine?.setAttribute("stroke-dasharray", `${px(5)} ${px(4)}`);
    if (this.targetLine) {
      this.targetLine.setAttribute("stroke-width", px(1.5));
      this.targetLine.setAttribute("stroke-dasharray", `${px(4)} ${px(3)}`);
    }
    // a track's name stands clear of the octagons along it: half an octagon and 9 px off its line
    for (const t of this.trackNames ?? []) t.setAttribute("y", num(-((OCT / 2) * k + 9)));
    for (const { node, x, y, angle } of this.fixed ?? []) {
      node.setAttribute("transform", `translate(${num(x)} ${num(y)})${angle ? ` rotate(${num(angle)})` : ""} scale(${px(1)})`);
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

  /**
   * Draw the store's walked places on this land and where you are. The board is rebuilt only when
   * the places have changed since the last draw (the store's version); a step into a place walked
   * before only moves your light, the route and the cards.
   */
  draw(store) {
    if (store !== this.store || store.version !== this.drawn) {
      this.store = store;
      this.drawn = store.version;
      this.build(store);
    }

    // your octagon, lit
    const here = store.here ? this.L.spots.get(store.here) ?? null : null;
    this.focus = here ? [here.x, -here.y] : null;
    if (!here) {
      this.hl?.remove();
      this.hl = null;
    } else {
      if (!this.hl) {
        this.hl = el("g", { filter: this.glow }, this.hereG);
        el("use", { href: `#${this.octId}`, fill: HL, "fill-opacity": 0.3, stroke: HL, "stroke-width": 3, "pointer-events": "none" }, this.hl);
      }
      if (this.hl.getAttribute("data-here") !== store.here) {
        this.hl.setAttribute("data-here", store.here);
        this.hl.setAttribute("transform", `translate(${num(here.x)} ${num(-here.y)})`);
        pulse(this.hl.firstChild); // a new place's light starts its breath from full
      }
    }
    // a walked road end to show the way home to, unless you stand on one
    this.ends = this.hasEnd && !!here && !store.here.includes(".join.");

    // a target forgotten, or reached, is done with
    if (this.target && (!store.walked(this.target) || this.target === store.here)) this.setTarget(null);
    else this.drawRoute();
    if (this.editing && !store.walked(this.editing)) this.closeAll();

    this.rescale(this.k ?? HOME_K);
    if (here && !this.homed) this.home();
    this.placeCards();
  }

  /** Take down the panel's tooltip if this board put it up. */
  hideTip() {
    if (!this.tipFor) return;
    this.tipFor = null;
    window.panel?.tooltip?.hide?.();
  }

  /** Rebuild the board from the store's walked places on this land. */
  build(store) {
    this.hideTip(); // its octagon is replaced, so no mouseleave would come
    const places = store.places().filter((p) => p.id.startsWith(this.prefix));
    this.places = places;
    this.hasEnd = places.some((p) => p.id.includes(".join."));
    const L = layoutLand(places, this.world);
    this.L = L;
    this.board.replaceChildren();
    this.fixed = [];
    const g = (attrs) => el("g", attrs, this.board);
    const use = (parent, attrs) => el("use", { href: `#${this.octId}`, ...attrs }, parent);

    // Zennor's block, its name and its roads out
    const town = L.zennor.outline;
    if (town.length) {
      const zg = g({});
      this.edge = el("polygon", { points: town.map((p) => `${num(p.x)},${num(p.y)}`).join(" "), fill: ZENNOR, stroke: STONE, "data-zennor": "" }, zg);
      const xs = town.map((p) => p.x), ys = town.map((p) => p.y);
      this.zbox = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      const name = this.pinned(zg, (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
      label(name, 0, 0, "ZENNOR", 12, { fill: DIM, "letter-spacing": 1.5 });
    } else {
      this.edge = null;
      this.zbox = null;
    }
    const roads = g({ stroke: EARTH, "stroke-width": 0.24, "stroke-linecap": "round" });
    for (const r of L.zennor.roads) el("line", { x1: num(r.x1), y1: num(r.y1), x2: num(r.x2), y2: num(r.y2) }, roads);

    // the plain ways, under the octagons: each a straight line from middle to middle
    const ways = g({ stroke: EARTH, "stroke-width": 0.13, fill: "none", "stroke-linecap": "round" });
    for (const w of L.ways) if (!w.track) el("path", { "data-way": "", d: w.path }, ways);

    // the octagons: the ground's colour, its texture over it, a Stone edge
    const octs = g({});
    for (const p of places) {
      const c = L.spots.get(p.id);
      const group = groupOf(p.id, p.name);
      const og = el("g", { "data-place": p.id, "data-pick": p.id, transform: `translate(${num(c.x)} ${num(-c.y)})` }, octs);
      og.addEventListener("mouseenter", () => {
        this.tipFor = p.id;
        window.panel?.tooltip?.show(og.getBoundingClientRect(), { title: p.name, body: p.note ?? "" });
      });
      og.addEventListener("mouseleave", () => this.hideTip());
      use(og, { fill: groundStyle(group).fill, stroke: STONE, "stroke-width": 1.2 });
      const pat = this.pattern(group);
      if (pat) use(og, { fill: pat, stroke: "none", "pointer-events": "none" });
    }

    // the tracks, over the octagons they run through: a dashed Stone edge under an Earth band
    const tracks = L.ways.filter((w) => w.track);
    this.trackEdges = g({ stroke: STONE, fill: "none" });
    for (const w of tracks) el("path", { d: w.path }, this.trackEdges);
    const bands = g({ stroke: EARTH, "stroke-width": 0.22, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" });
    for (const w of tracks) el("path", { "data-track": "", d: w.path }, bands);

    // the ways not taken
    this.stubs = g({ stroke: DIM, "stroke-linecap": "round" });
    for (const s of L.stubs) el("line", { "data-stub": "", x1: num(s.x1), y1: num(s.y1), x2: num(s.x2), y2: num(s.y2) }, this.stubs);

    // one-way ways: a chevron pointing the way you can go, the same size at any zoom
    const chevrons = g({ stroke: FIXTURE, "stroke-width": 2, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" });
    for (const w of L.ways) {
      if (!w.chevron) continue;
      const { x, y, angle } = w.chevron;
      el("path", { "data-chevron": "", d: CHEVRON }, this.pinned(chevrons, x, y, angle));
    }

    // notes: a folded corner at the octagon's top right
    const notes = g({ fill: DIM, "fill-opacity": 0.9 });
    for (const p of places) {
      if (!p.note) continue;
      const c = L.spots.get(p.id);
      el("path", { d: NOTE }, this.pinned(notes, c.x + NOTE_AT.x, -c.y + NOTE_AT.y));
    }

    // names: regions, and tracks along the track (rescale() keeps a track's clear of its octagons)
    const names = g({});
    this.trackNames = [];
    for (const l of L.labels) {
      const at = this.pinned(names, l.x, l.y, l.angle);
      if (l.kind === "region") label(at, 0, 0, l.text, 12, { fill: DIM, "font-style": "italic", "letter-spacing": 2 });
      else this.trackNames.push(label(at, 0, -17, l.text, 10.5, { fill: DIM, "font-style": "italic", "letter-spacing": 1 }));
    }

    // the route to the place you clicked, under your light; then your light (draw() sets it)
    this.routeG = g({ "pointer-events": "none" });
    this.hereG = g({});
    this.hl = null;
  }

  /** Call fn(id, text) for a note written (text) or removed (null). */
  onNote(fn) {
    this.noteFns.push(fn);
  }

  /** Call fn() once forgetting the land is confirmed. */
  onForget(fn) {
    this.forgetFns.push(fn);
  }

  note(id, text) {
    for (const fn of this.noteFns) fn(id, text);
  }

  /** A click: a walked place sets the target, the target again, your place or the ground clears it. */
  pick(id) {
    const s = this.store;
    if (!s || id === "ground" || id === this.target || id === s.here || !s.walked(id)) this.setTarget(null);
    else this.setTarget(id);
  }

  /** Light the route to a walked place, or clear it (null). Esc clears it while one is set. */
  setTarget(id) {
    this.target = id;
    const doc = this.div.ownerDocument;
    if (id && !this.escOn) doc.addEventListener("keydown", this.onEsc);
    if (!id && this.escOn) doc.removeEventListener("keydown", this.onEsc);
    this.escOn = !!id;
    this.drawRoute();
    this.rescale(this.k ?? HOME_K);
    this.placeCards();
  }

  /** The route from where you are to the target, and its outline, into the route layer. */
  drawRoute() {
    this.routeLine = null;
    this.targetLine = null;
    this.route = null;
    if (!this.routeG) return;
    this.routeG.replaceChildren();
    const s = this.store, t = this.target;
    if (!s || !t || !this.L) return;
    this.route = s.here ? s.route(s.here, t) : null;
    if (this.route) {
      this.routeLine = el(
        "path",
        { "data-route": "", d: routePath(this.route, this.L), fill: "none", stroke: HL, "stroke-opacity": 0.75, "stroke-linecap": "round", "stroke-linejoin": "round" },
        this.routeG,
      );
    }
    const c = this.L.spots.get(t);
    this.targetLine = el("path", { "data-target": t, d: octagon(c.x, c.y), fill: "none", stroke: HL, "stroke-opacity": 0.75 }, this.routeG);
  }

  /** A km point on the board, in px from the band's top left. */
  toPx(x, y) {
    const k = this.k ?? HOME_K;
    return [(x - this.cur[0]) * k, (y - this.cur[1]) * k];
  }

  /** An HTML card over the board: a press on it neither pans nor picks. */
  overlay(cls, tag = "div") {
    const n = document.createElement(tag);
    n.className = cls;
    n.addEventListener("pointerdown", (e) => e.stopPropagation());
    n.addEventListener("contextmenu", (e) => e.stopPropagation());
    this.div.appendChild(n);
    return n;
  }

  /** The cards: the target's (or the note being written), beside its octagon, and "← Zennor". */
  placeCards() {
    if (!this.store) return;
    const id = this.editing ?? this.target;
    const editing = !!this.editing;
    if (this.card && (this.card.dataset.for !== id || this.card.classList.contains("note") !== editing)) {
      this.card.remove();
      this.card = null;
    }
    if (id && this.store.walked(id)) {
      const p = this.store.place(id);
      if (!this.card) {
        this.card = this.overlay(editing ? "land-card note" : "land-card");
        this.card.dataset.for = id;
        const name = document.createElement("div");
        name.className = "name";
        name.textContent = p.name;
        this.card.appendChild(name);
        if (editing) this.card.appendChild(this.noteInput(id, p.note ?? ""));
        else {
          this.card.appendChild(document.createElement("div")).className = "detail";
        }
      }
      if (!editing) this.card.querySelector(".detail").textContent = this.route ? stepsText(this.route) : "No way back you know";
      // beside the octagon: to its left, else its right where the left's off the band
      const c = this.L.spots.get(id);
      const [x, y] = this.toPx(c.x, -c.y);
      const half = (OCT / 2) * (this.k ?? HOME_K);
      const w = this.card.offsetWidth || (editing ? 190 : 160); // measured: the card grows to fit its name
      const left = x - half - 8 - w >= 6 ? x - half - 8 - w : x + half + 8;
      Object.assign(this.card.style, { left: `${Math.round(left)}px`, top: `${Math.round(y - 19)}px` });
    } else if (this.card) {
      this.card.remove();
      this.card = null;
    }
    this.placeEdge();
  }

  /** "← Zennor" on the view's edge toward it, while none of Zennor's block is in view. */
  placeEdge() {
    const at = this.ends && this.zbox ? edgeCard({ x: this.cur[0], y: this.cur[1], w: this.cur[2], h: this.cur[3] }, this.zbox) : null;
    if (!at) {
      this.zennorCard?.remove();
      this.zennorCard = null;
      return;
    }
    if (!this.zennorCard) {
      this.zennorCard = this.overlay("land-edge", "button");
      this.zennorCard.type = "button";
      this.zennorCard.addEventListener("click", () => {
        const s = this.store;
        const end = nearestRoadEnd(s, s.here) ?? this.places.find((p) => p.id.includes(".join."))?.id;
        if (end && end !== s.here) this.setTarget(end);
      });
    }
    this.zennorCard.textContent = `${ARROW[at.side]} Zennor`;
    const [x, y] = this.toPx(at.x, at.y);
    const W = this.px || BASE[0], H = W * this.aspect;
    // kept wholly in the band: on a band too short for the clear space wanted, the band wins
    const clamp = (v, lo, hi) => {
      hi = Math.max(0, hi);
      return Math.round(Math.max(Math.min(lo, hi), Math.min(hi, v)));
    };
    const cardH = this.zennorCard.offsetHeight || 22;
    const st = this.zennorCard.style;
    st.left = st.right = st.top = st.bottom = "";
    // clear of N ▲ in the top left and the zoom buttons in the top right
    if (at.side === "left") Object.assign(st, { left: "8px", top: `${clamp(y - 11, 28, H - cardH - 8)}px` });
    else if (at.side === "right") Object.assign(st, { right: "8px", top: `${clamp(y - 11, 96, H - cardH - 8)}px` });
    else if (at.side === "top") Object.assign(st, { top: "8px", left: `${clamp(x - 34, 48, W - 120)}px` });
    else Object.assign(st, { bottom: "8px", left: `${clamp(x - 34, 8, W - 76)}px` });
  }

  /** The note's input: Enter keeps it (empty removes it), Esc lets it be. */
  noteInput(id, text) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = text;
    input.placeholder = "A note";
    input.addEventListener("keydown", (e) => {
      e.stopPropagation(); // Esc here cancels the note, not the route
      if (e.key === "Enter") {
        const v = input.value.trim();
        this.closeAll();
        this.note(id, v || null);
      } else if (e.key === "Escape") this.closeAll();
    });
    queueMicrotask(() => input.isConnected && input.focus());
    return input;
  }

  editNote(id) {
    this.closeAll();
    this.editing = id;
    this.placeCards();
  }

  /** Close a menu, a confirm and a note being written. */
  closeAll() {
    this.menu?.remove();
    this.menu = null;
    this.confirm?.remove();
    this.confirm = null;
    if (this.editing) {
      this.editing = null;
      this.placeCards();
    }
  }

  /** A menu at [x, y] px of [label, fn] items; choosing one closes it. */
  openMenu([x, y], items) {
    this.menu = this.overlay("land-menu");
    for (const [text, fn] of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.addEventListener("click", () => {
        this.closeAll();
        fn();
      });
      this.menu.appendChild(b);
    }
    this.pin(this.menu, x, y, 130, 24 * items.length + 8);
  }

  /** Forgetting the land asks once, in the panel (a window dialog may not open in its webview). */
  askForget([x, y]) {
    this.confirm = this.overlay("land-confirm");
    const t = document.createElement("div");
    t.textContent = "Forget this land?";
    const d = document.createElement("div");
    d.className = "detail";
    d.textContent = "Every place you've walked here, and its notes.";
    const row = document.createElement("div");
    row.className = "buttons";
    for (const [text, go] of [
      ["Forget", true],
      ["Keep", false],
    ]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.addEventListener("click", () => {
        this.closeAll();
        if (go) for (const fn of this.forgetFns) fn();
      });
      row.appendChild(b);
    }
    this.confirm.append(t, d, row);
    this.pin(this.confirm, x, y, 190, 70);
  }

  /** Put an overlay of about w × h px at [x, y], kept inside the band. */
  pin(node, x, y, w, h) {
    const W = this.px || BASE[0], H = W * this.aspect;
    node.style.left = `${Math.round(Math.max(4, Math.min(W - w - 4, x)))}px`;
    node.style.top = `${Math.round(Math.max(4, Math.min(H - h - 4, y)))}px`;
  }
}
