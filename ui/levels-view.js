// A city of levels' top band (Dolcoath): underground, the section through its shaft (section-view.js),
// your level lit and the cage where it is while you ride it; out of doors in the Pit's three rooms
// open to the sky (the Pit, the Drops, the Pithead), the sky over the Pit with its rim round it
// (town-view.js's SkyView, the Pit's skyline). One shows at a time. It needs what main.js and the
// editor ask of a place's model: `div`, `set()`, `setTurning()`, `vb` and `setView()` (the
// section's), and for the sky `setCharts()`, `live` and `draw()`.

import { SectionView } from "./section-view.js";
import { SkyView } from "./town-view.js";

export class LevelsBand {
  /**
   * @param {HTMLElement} containerEl
   * @param {ReturnType<typeof import("./lib/levels.js").indexLevels>} index
   * @param {string} port the city's id in the charts ("dolcoath"), for its sky
   */
  constructor(containerEl, index, port) {
    const div = document.createElement("div");
    div.className = "model";
    Object.assign(div.style, { position: "relative", width: "100%", height: "100%", overflow: "hidden" });
    containerEl.appendChild(div);
    this.div = div;
    this.section = new SectionView(div, index);
    this.sky = new SkyView(div, index, port);
    this.sky.div.style.display = "none";
  }

  get svg() {
    return this.section.svg;
  }

  get vb() {
    return this.section.vb;
  }

  setView(v) {
    this.section.setView(v);
  }

  setTurning() {}

  /** Where you are: the sky out of doors in the Pit, the section anywhere else. */
  set(where, msg) {
    this.section.set(where, msg);
    this.sky.set(where, msg);
    const out = this.sky.outdoors;
    this.sky.div.style.display = out ? "" : "none";
    this.section.div.style.display = out ? "none" : "";
  }

  setCharts(index) {
    this.sky.setCharts(index);
  }

  /** A sky to keep up: out of doors, with charts that place the city. */
  get live() {
    return this.sky.live;
  }

  draw(t) {
    this.sky.draw(t);
  }

  /** What the golden renders keep for where you are. */
  lights() {
    return `${this.section.lights()} outdoors=${this.sky.outdoors} frame=${this.sky.frame}`;
  }
}
