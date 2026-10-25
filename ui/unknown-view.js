// Before the game has said where you are: a quiet sky in each band, a dashed ring with a "?" where
// a station's model would be and an empty dashed floor where its plan would be. It stands in until
// the first location (or a dock) picks a station, so no station is built only to be replaced.
// A sparse starfield, not the models' 1,200 stars: it's the cheapest thing on screen at load.
// Each band is two layers: the stars slice to fill whatever shape the band is, and the mark over
// them keeps its size in the middle (docs/maps/reference/unknown-location-options.png, option A).

import { el, stars } from "./lib/svg.js";

const EDGE = "#3b4a5c";
const DIM = "#7d8a9a";
const BG = "#04060c";

/** One band: a starfield sliced to fill it, and the mark over it, met to fit. */
function band(containerEl, w, h, n, seed, mark) {
  const div = document.createElement("div");
  div.className = "unknown";
  Object.assign(div.style, { position: "relative", width: "100%", height: "100%", overflow: "hidden", background: BG });
  containerEl.appendChild(div);
  for (const [fit, draw] of [["slice", (svg) => stars(svg, 0, 0, w, h, n, seed)], ["meet", mark]]) {
    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: `xMidYMid ${fit}`, "aria-hidden": "true" });
    Object.assign(svg.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    div.appendChild(svg);
    draw(svg);
  }
  return div;
}

function query(svg, x, y, size, fill) {
  el("text", { x, y, "text-anchor": "middle", "dominant-baseline": "central", fill, "font-family": "DejaVu Sans, sans-serif", "font-size": size, "font-weight": 600 }, svg, "?");
}

export class UnknownView {
  /**
   * @param {HTMLElement} modelEl the top band
   * @param {HTMLElement} deckEl the bottom band
   */
  constructor(modelEl, deckEl) {
    this.model = band(modelEl, 380, 250, 150, 21, (svg) => {
      el("circle", { cx: 190, cy: 125, r: 46, fill: BG, stroke: EDGE, "stroke-width": 1.5, "stroke-dasharray": "5 5" }, svg);
      query(svg, 190, 125, 34, DIM);
    });
    this.deck = band(deckEl, 380, 349, 120, 9, (svg) => {
      el("rect", { x: 70, y: 70, width: 240, height: 180, rx: 10, fill: BG, stroke: EDGE, "stroke-width": 1.5, "stroke-dasharray": "6 6" }, svg);
      query(svg, 190, 160, 30, EDGE);
    });
  }

  /** Take both bands' drawings out for good: once you're placed it never shows again. */
  remove() {
    this.model.remove();
    this.deck.remove();
  }
}
