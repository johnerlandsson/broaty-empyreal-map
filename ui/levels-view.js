// A city of levels' top band (Dolcoath), for now: words, no drawing. The city's name, the level
// you're on and how deep it is. The overview, the city in the rock, is a job of its own. Off
// the plan (riding the cage, aboard your landed ship) it keeps the last level, and before any it
// names the top one, where you land. It has a view (`vb`, `setView`) for the editor, which keeps
// a place's views where they were, but it neither turns, pans nor zooms.

import { el } from "./lib/svg.js";

const TXT = "#e3eaf2";
const DIM = "#7d8a9a";
const W = 380;
const H = 170;
const FONT = { "font-family": "Inter, system-ui, sans-serif", "text-anchor": "middle" };

export class LevelsBand {
  /**
   * @param {HTMLElement} containerEl
   * @param {ReturnType<typeof import("./lib/levels.js").indexLevels>} index
   */
  constructor(containerEl, index) {
    this.index = index;
    const div = document.createElement("div");
    div.className = "model";
    Object.assign(div.style, { position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#04060c" });
    containerEl.appendChild(div);
    this.div = div;
    this.vb = [0, 0, W, H];
    const svg = el("svg", { viewBox: this.vb.join(" "), preserveAspectRatio: "xMidYMid meet" });
    Object.assign(svg.style, { display: "block", width: "100%", height: "100%" });
    div.appendChild(svg);
    this.svg = svg;
    const place = String(index.area?.name ?? "").toUpperCase();
    const g = String(index.area?.gravity ?? "");
    el("text", { x: W / 2, y: 52, fill: DIM, "font-size": 11, "letter-spacing": 3, ...FONT }, svg, g ? `${place} · ${g} g` : place);
    this.name = el("text", { x: W / 2, y: 88, fill: TXT, "font-size": 20, "font-weight": 600, "letter-spacing": 3, ...FONT }, svg, "");
    this.depth = el("text", { x: W / 2, y: 114, fill: DIM, "font-size": 12, "letter-spacing": 1, ...FONT }, svg, "");
    this.level = null;
    this.show(index.levels[0] ?? null);
  }

  show(lv) {
    if (lv === this.level) return;
    this.level = lv;
    this.name.textContent = String(lv?.name ?? "").toUpperCase();
    this.depth.textContent = !lv ? "" : lv.depth ? `${lv.depth} fathoms down` : lv.depth === 0 ? "at the surface" : "";
  }

  /** Name the level of where you are; off the plan, keep the last. */
  set(where) {
    if (where?.kind !== "room") return;
    this.show(this.index.levels.find((l) => l.level === where.level) ?? this.level);
  }

  /** The words the golden renders keep for where you are. */
  lights() {
    return `level=${this.level?.level ?? "none"}`;
  }

  setView(v) {
    this.vb = v;
  }

  setTurning() {}
}
