// A city of levels' section underground (Dolcoath): the shaft diagram ui/lib/section.js lays out,
// drawn in the models' Tones on the band's Background. The levels down the shaft evenly spaced,
// each a stop on the cage's shaft with its depth in fathoms to the west and its name to the east;
// the man engine's narrower shaft beside it, its rod in timber; the levels the cage doesn't stop
// at hanging off it, dashed; the Pit's bowl and headframe small on top. Your level is lit; riding
// the cage, the cage is lit instead, where Empyreal.Vehicle puts it, with an arrow the way it's
// going. It has zoom and ⌂ as the station models do, and pans, but doesn't turn. Hover a level
// for its name and depth, the cage for what it's doing.

import { carDoing, stopNames } from "./lib/cars.js";
import { ENGINE, LABEL, PIT, ROW, cageAt, rowTip, sectionLayout } from "./lib/section.js";
import { attachPanZoom, el, zoomButtons } from "./lib/svg.js";

const TONES = ["#3a4556", "#58667b", "#7e8da3"];
const SHAFT = "#05070a";
const TIMBER = "#8a6a44";
const HL = "#ffb347";
const HL_STROKE = "#fff3df";
const TXT = "#e3eaf2";
const DIM = "#7d8a9a";
const BG = "#04060c";
const FONT = { "font-family": "var(--font-family, Inter, system-ui, sans-serif)" };

export class SectionView {
  /**
   * @param {HTMLElement} containerEl
   * @param {ReturnType<typeof import("./lib/levels.js").indexLevels>} index
   */
  constructor(containerEl, index) {
    this.index = index;
    this.layout = sectionLayout(index);
    this.names = stopNames(index);
    const div = document.createElement("div");
    div.className = "model";
    Object.assign(div.style, { position: "relative", width: "100%", height: "100%", overflow: "hidden", background: BG, cursor: "grab", touchAction: "none" });
    containerEl.appendChild(div);
    this.div = div;
    const b = this.layout.bounds;
    this.home = [b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0];
    this.vb = this.home.slice();
    const svg = el("svg", { viewBox: this.vb.join(" "), preserveAspectRatio: "xMidYMid meet" });
    Object.assign(svg.style, { display: "block", width: "100%", height: "100%" });
    div.appendChild(svg);
    this.svg = svg;
    this.base = el("g", {}, svg); // the shafts, the rows and the Pit: drawn once
    this.hot = el("g", { "pointer-events": "none" }, svg); // your level or the cage, lit
    this.tips = new Map();
    this.drawBase();
    this.level = null; // the level lit, or null
    this.cage = null; // cageAt()'s, while you ride it
    this.lift = null;
    this.zoom = attachPanZoom(div, () => this.vb, (v) => this.setView(v), { minW: this.home[2] * 0.25, maxW: this.home[2] * 1.6 });
    zoomButtons(div, "8px", (f) => (f ? this.zoom(f) : this.setView(this.home.slice())));
    div.addEventListener("pointermove", (e) => this.hoverAt(e.target));
    div.addEventListener("pointerleave", () => this.hideTip());
  }

  setView(v) {
    this.vb = v;
    this.svg.setAttribute("viewBox", v.map((n) => +n.toFixed(2)).join(" "));
  }

  setTurning() {}

  drawBase() {
    const g = this.base;
    const { rows, cage, engine } = this.layout;
    const top = rows[0]?.y ?? 0;
    // the Pit: its benches stepping up either side of the floor, the headframe over the shaft
    const step = PIT / 4;
    const d = `M-54,${top - PIT}h6v${step}h6v${step}h6v${step}h6v${step}H30v${-step}h6v${-step}h6v${-step}h6v${-step}h6`;
    el("path", { d, fill: "none", stroke: TONES[1], "stroke-width": 1, "stroke-linejoin": "round" }, g);
    el("path", { d: `M-6,${top}L0,${top - PIT - 6}L6,${top}M0,${top - PIT - 6}L12,${top}`, fill: "none", stroke: TONES[2], "stroke-width": 0.9 }, g);
    el("circle", { cx: 0, cy: top - PIT - 6, r: 2.4, fill: "none", stroke: TONES[2], "stroke-width": 0.8 }, g);
    if (engine) {
      el("rect", { x: ENGINE - 2, y: engine.y0, width: 4, height: engine.y1 - engine.y0, fill: SHAFT, stroke: TONES[0], "stroke-width": 0.5 }, g);
      el("path", { d: `M${ENGINE},${engine.y0}V${engine.y1}`, stroke: TIMBER, "stroke-width": 0.8 }, g);
      el("text", { x: ENGINE + 1, y: engine.y1 + 10, fill: DIM, "font-size": 5.5, "text-anchor": "end", ...FONT }, g, "man engine");
    }
    if (cage) {
      el("rect", { x: -4, y: cage.y0, width: 8, height: cage.y1 - cage.y0, fill: SHAFT, stroke: TONES[1], "stroke-width": 0.6 }, g);
      el("text", { x: 4, y: cage.y1 + 10, fill: DIM, "font-size": 5.5, ...FONT }, g, "cage");
    }
    for (const r of rows) {
      const row = el("g", { "data-tip": `level-${r.level}` }, g);
      this.tips.set(`level-${r.level}`, rowTip(r));
      // a wide, clear strip to hover by
      el("rect", { x: -40, y: r.y - ROW / 2, width: LABEL + 8 * r.name.length * 0.62 + r.x + 50, height: ROW, fill: "transparent" }, row);
      if (r.from !== null) {
        const parent = rows.find((p) => p.level === r.from);
        el("path", { d: `M${r.x},${parent.y}V${r.y - 3}`, stroke: TONES[0], "stroke-dasharray": "2 2", "stroke-width": 1 }, row);
      } else {
        el("path", { d: `M8,${r.y}H${LABEL - 6}`, stroke: TONES[0], "stroke-width": 1.4 }, row);
      }
      el("circle", { cx: r.x, cy: r.y, r: 3, fill: "#0b1018", stroke: TONES[2], "stroke-width": 0.8 }, row);
      el("text", { x: LABEL + r.x, y: r.y + 3, fill: TXT, "font-size": 8, ...FONT }, row, r.name);
      if (r.tag) el("text", { x: -24, y: r.y + 3, fill: DIM, "font-size": 7, "text-anchor": "end", ...FONT }, row, r.tag);
    }
  }

  /** Your level lit, or the cage, where it is, while you ride it. */
  drawHot() {
    const g = this.hot;
    g.replaceChildren();
    const r = this.layout.rows.find((x) => x.level === this.level);
    if (r) {
      if (r.from === null) el("path", { d: `M8,${r.y}H${LABEL - 6}`, stroke: HL, "stroke-width": 2.4 }, g);
      el("circle", { cx: r.x, cy: r.y, r: 4.2, fill: HL, stroke: HL_STROKE, "stroke-width": 0.8 }, g);
      el("text", { x: LABEL + r.x, y: r.y + 3, fill: HL, "font-size": 8, "font-weight": 600, ...FONT }, g, r.name);
    }
    const c = this.cage;
    if (c) {
      const car = el("g", { "data-tip": "cage", "pointer-events": "all" }, g);
      el("rect", { x: -3, y: c.y - 5, width: 6, height: 10, fill: HL, stroke: HL_STROKE, "stroke-width": 0.6 }, car);
      // the way it's going, east of the shaft: between two levels there's nothing else there
      if (c.dir) el("path", { d: c.dir > 0 ? `M7,${c.y - 3}l3,5l3,-5z` : `M7,${c.y + 3}l3,-5l3,5z`, fill: TXT }, car);
    }
  }

  /**
   * Where you are: your room's level lit; riding the cage, the cage, where the location message's
   * `lift` puts it; anywhere else (aboard your ship on the field) nothing.
   */
  set(where, msg) {
    const lift = msg?.lift ?? null;
    this.cage = cageAt(this.layout, this.index, lift);
    this.lift = this.cage ? lift : null;
    this.level = where?.kind === "room" ? where.level : null;
    if (this.cage) this.tips.set("cage", { title: this.layout.car?.name ?? "The Cage", body: carDoing(lift, this.names) });
    else this.tips.delete("cage");
    this.drawHot();
    this.refreshTip();
  }

  /** What the golden renders keep for where you are. */
  lights() {
    return `level=${this.level ?? "none"} cage=${this.cage ? `${this.cage.y}/${this.cage.dir}` : "none"}`;
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
    window.panel?.tooltip?.show(node.getBoundingClientRect(), { title: c.title, body: c.body });
  }

  refreshTip() {
    if (!this.tipKey) return;
    const node = this.svg.querySelector(`[data-tip="${CSS.escape(this.tipKey)}"]`);
    if (node) this.showTip(node);
    else this.hideTip();
  }

  hideTip() {
    if (this.tipKey) window.panel?.tooltip?.hide?.();
    this.tipKey = null;
  }
}
