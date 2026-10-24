// The belt map: where your ship is in the belt she's at, over the top band, switched on and off by a
// button left of the lanes' ⋈ (docs/maps/belt.md). The belt's disc at the radius its rocks reach, km
// rings, its core, a bearing ring in the belt's own degrees, and her, moving between the game's
// ticks; and the player's own log of the belt: her track, each sweep's ground, and where she left
// her host. Nothing the game hasn't told the player: no rocks, nothing worked out, no other ships.
// Marks and colours are the style guide's §13.6.

import { ALONGSIDE_KM, Glide, SENSOR_KM, ago, cleanBelt, discFrame, placeText, ringKms, toBand } from "./lib/belt.js";
import { el, glowFilter, stars } from "./lib/svg.js";

const HL = "#ffb347";
const HL_STROKE = "#fff3df";
const DIM = "#7d8a9a";
const ORBIT = "#2b3646";
const STAR = "#fffaf0";
const GLASS = "#cfe3ff";
const GREEN = "#59d18a";
const BG = "#04060c";
const TEXT = "#e3eaf2";
const TONES = ["#3a4556", "#58667b", "#7e8da3"];
const FONT = "Inter, system-ui, sans-serif";
const CHAR_W = 4.6; // a guess at an 8.5 px label's width per character (there's no layout here)

let instances = 0;

export class BeltView {
  /**
   * @param {HTMLElement} bandEl the top band
   * @param {{onToggle?: (on: boolean) => void}} [opts] onToggle is called when the user flips the button
   */
  constructor(bandEl, opts = {}) {
    this.band = bandEl;
    this.onToggle = opts.onToggle ?? (() => {});
    this.belt = null;
    this.on = false;
    this.glide = new Glide();

    const div = document.createElement("div");
    div.className = "belt";
    Object.assign(div.style, { position: "absolute", inset: "0", zIndex: "4", display: "none", overflow: "hidden", background: BG });
    bandEl.appendChild(div);
    this.div = div;

    const svg = el("svg", {});
    Object.assign(svg.style, { display: "block", width: "100%", height: "100%" });
    div.appendChild(svg);
    this.svg = svg;
    const id = `belt-${++instances}`;
    const defs = el("defs", {}, svg);
    glowFilter(defs, `${id}-glow`);
    const glow = defs.lastChild;
    glow.setAttribute("x", "-100%");
    glow.setAttribute("y", "-100%");
    glow.setAttribute("width", "300%");
    glow.setAttribute("height", "300%");
    glow.firstChild.setAttribute("stdDeviation", 2.2);
    stars(el("g", { "pointer-events": "none" }, svg), 0, 0, 2400, 1400, 2000, 37);
    this.marks = el("g", {}, svg);
    // her chevron pulses; only the children of `lit` are replaced, so the pulse never restarts
    const hot = el("g", { filter: `url(#${id}-glow)` }, svg);
    this.pulse = el("g", {}, hot);
    this.lit = el("g", {}, this.pulse);
    el("animate", { attributeName: "opacity", values: "1;0.55;1", dur: "1.8s", repeatCount: "indefinite" }, this.pulse);
    this.words = el("g", { "pointer-events": "none" }, svg);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Where you are in the belt";
    Object.assign(btn.style, {
      position: "absolute",
      right: "92px",
      top: "8px",
      zIndex: "5",
      display: "none",
      width: "24px",
      height: "24px",
      borderRadius: "5px",
      border: `1px solid ${ORBIT}`,
      background: "color-mix(in srgb, var(--bg, #04060c) 70%, transparent)",
      color: "var(--fg, #dfe7f1)",
      cursor: "pointer",
      padding: "0",
    });
    // drawn, as the chart's ◎ is: the belt's dotted rim, its core, and her off to one side
    const icon = el("svg", { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", "stroke-width": 1.3 }, btn);
    icon.style.display = "block";
    icon.style.margin = "auto";
    el("circle", { cx: 8, cy: 8, r: 6.5, "stroke-dasharray": "2 1.6" }, icon);
    el("circle", { cx: 8, cy: 8, r: 0.9, fill: "currentColor", stroke: "none" }, icon);
    el("circle", { cx: 10.8, cy: 5.4, r: 1.6, fill: "currentColor", stroke: "none" }, icon);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.setOn(!this.on);
      this.onToggle(this.on);
    });
    bandEl.appendChild(btn);
    this.btn = btn;

    new ResizeObserver(() => this.draw(Date.now())).observe(bandEl);
  }

  /** True while the map covers the band: switched on, at a belt whose size is known. */
  get shown() {
    return this.on && this.ready;
  }

  get ready() {
    return !!(this.belt && this.belt.id && this.belt.radius);
  }

  /** True while she's on her way between ticks: worth redrawing more often than once a second. */
  get moving() {
    return this.shown && this.glide.moving(Date.now());
  }

  /** The Lua side's belt message, or null. */
  setBelt(msg) {
    const t = Date.now();
    this.belt = cleanBelt(msg);
    const p = this.belt?.place;
    this.glide.set(this.belt?.id ?? null, p ? [p.x, p.y] : null, t);
    this.btn.style.display = this.ready ? "" : "none";
    this.sync();
    this.draw(t);
  }

  /** Switch the map on or off (from the Lua side, the button, or ◎ or ⋈ taking the band). */
  setOn(on) {
    on = !!on;
    if (on === this.on) return;
    this.on = on;
    this.btn.style.borderColor = on ? "var(--fg-muted, #7d8a9a)" : ORBIT;
    this.sync();
    this.draw(Date.now());
  }

  sync() {
    this.div.style.display = this.shown ? "" : "none";
  }

  /** Redraw at wall-clock t (ms): her place glides between ticks, and the host's age changes. */
  draw(t) {
    if (!this.shown) return;
    const w = this.band.clientWidth || 1;
    const h = this.band.clientHeight || 1;
    this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const b = this.belt;
    const f = discFrame(w, h, b.radius);
    const { cx, cy, k } = f;
    const marks = document.createDocumentFragment();
    const lit = document.createDocumentFragment();
    const words = document.createDocumentFragment();
    const text = (parent, tx, ty, s, attrs = {}) =>
      el("text", { x: tx, y: ty, "font-size": 9, fill: DIM, "font-family": FONT, ...attrs }, parent, s);
    // words over marks keep a Background halo, so a track or a ring under them doesn't cut them
    const halo = { stroke: BG, "stroke-width": 3, "stroke-linejoin": "round", "paint-order": "stroke" };

    // the disc: its rim, the km rings, the core, and the bearing ring outside it
    el("circle", { cx, cy, r: f.r, fill: "none", stroke: TONES[1], "stroke-width": 1.2 }, marks);
    for (const km of ringKms(b.radius)) {
      el("circle", { cx, cy, r: km * k, fill: "none", stroke: ORBIT, "stroke-dasharray": "1 4" }, marks);
      text(marks, cx + 3, cy - km * k + 10, km === 5 ? "5 km" : String(km), { "font-size": 8, opacity: 0.8 });
    }
    for (let d = 0; d < 360; d += 10) {
      const a = (d * Math.PI) / 180;
      const long = d % 30 === 0;
      const r1 = f.r + (long ? 5 : 2.5);
      el("line", { x1: cx + Math.sin(a) * f.r, y1: cy - Math.cos(a) * f.r, x2: cx + Math.sin(a) * r1, y2: cy - Math.cos(a) * r1,
        stroke: long ? TONES[2] : TONES[0], "stroke-width": 1 }, marks);
    }
    for (const d of [0, 90, 180, 270]) {
      const a = (d * Math.PI) / 180;
      const r = f.r + 13;
      text(marks, cx + Math.sin(a) * r, cy - Math.cos(a) * r + 3, `${d}°`, { "font-size": 8, "text-anchor": "middle" });
    }
    el("path", { d: `M${cx - 4},${cy}H${cx + 4}M${cx},${cy - 4}V${cy + 4}`, stroke: STAR, "stroke-width": 1.2 }, marks);

    // each sweep's ground: the disc its sensors reached, where the range is known, else a ring
    for (const s of b.sweeps) {
      const [x, y] = toBand(f, s.x, s.y);
      if (s.r) el("circle", { cx: x, cy: y, r: s.r * k, fill: GREEN, "fill-opacity": 0.08, stroke: GREEN, "stroke-opacity": 0.3 }, marks);
      else el("circle", { cx: x, cy: y, r: 3.5, fill: BG, stroke: GREEN, "stroke-width": 1.2, opacity: 0.85 }, marks);
    }

    // where she left her host, with the ring she has to be within to dock again; last seen, as it may have moved
    if (b.left) {
      const [x, y] = toBand(f, b.left.x, b.left.y);
      const rr = ALONGSIDE_KM * k;
      el("circle", { cx: x, cy: y, r: rr, fill: "none", stroke: GLASS, "stroke-opacity": 0.45, "stroke-dasharray": "3 3" }, marks);
      el("path", { d: `M${x},${y - 4}L${x + 3},${y}L${x},${y + 4}L${x - 3},${y}Z`, fill: "none", stroke: GLASS, "stroke-width": 1.1 }, marks);
      const line1 = `where you left the ${b.left.name}`;
      const line2 = b.left.at === null ? "last seen" : `last seen ${ago(t / 1000 - b.left.at)}${t / 1000 - b.left.at < 60 ? "" : " ago"}`;
      const wide = Math.max(line1.length, line2.length) * CHAR_W;
      const right = x + 8 + wide < w - 4;
      const lx = right ? x + 8 : x - 8;
      const anchor = right ? "start" : "end";
      text(words, lx, y - 6, line1, { "font-size": 8.5, "text-anchor": anchor, ...halo });
      text(words, lx, y + 4, line2, { "font-size": 8, opacity: 0.75, "text-anchor": anchor, ...halo });
    }

    // her track: each visit a stretch, the last carried on to where she's drawn now
    const now = this.glide.at(t);
    b.track.forEach((seg, i) => {
      const pts = seg.map((p) => toBand(f, p[0], p[1]));
      if (i === b.track.length - 1 && now) {
        const last = seg[seg.length - 1];
        const to = this.glide.to;
        // while she glides to her latest place, the track stops where she's drawn
        if (to && last[0] === to[0] && last[1] === to[1]) pts.pop();
        pts.push(toBand(f, now[0], now[1]));
      }
      if (pts.length < 2) return;
      el("polyline", { points: pts.map((p) => p.join(",")).join(" "), fill: "none", stroke: HL, "stroke-opacity": 0.3,
        "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, marks);
    });

    // her, with her sensors' reach when it's known
    if (now) {
      const [x, y] = toBand(f, now[0], now[1]);
      if (b.array === false) {
        el("circle", { cx: x, cy: y, r: SENSOR_KM * k, fill: "none", stroke: GREEN, "stroke-opacity": 0.5, "stroke-dasharray": "4 3" }, marks);
      }
      el("path", { d: "M0,-8 L5,6 L0,3 L-5,6 Z", fill: HL, stroke: HL_STROKE, "stroke-width": 0.8, "stroke-linejoin": "round",
        transform: `translate(${x} ${y}) rotate(${this.glide.heading ?? 0})` }, lit);
    }

    // the belt's name and where she is, in the game's words
    text(words, 12, 20, (b.name ?? b.id).toUpperCase(), { "font-size": 9.5, fill: TEXT, "letter-spacing": 1, ...halo });
    const said = b.place ? placeText(b.place, b.radius) : b.host ? `docked at the ${b.host}` : null;
    if (said) {
      const comma = said.indexOf(", ");
      const lines = comma > 0 ? [said.slice(0, comma + 1), said.slice(comma + 2)] : [said];
      lines.forEach((s, i) => text(words, 12, 33 + i * 12, s, { "font-size": 10, fill: TEXT, ...halo }));
    }

    this.marks.replaceChildren(marks);
    this.lit.replaceChildren(lit);
    this.words.replaceChildren(words);
  }
}
