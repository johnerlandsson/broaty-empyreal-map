// A town's top band (Zennor): on the ground, so not a model but the skyline from the street. A
// still, low-poly view in the models' Tones under the stars: the ridge rising east, the town's low
// roofs and the port office's squat tower with its glass room, the field's blast wall at the
// west, the salt pans a pale line on the horizon. Nothing is lit and nothing moves. It stands in
// for the sky view (zennor-sky), which will replace this file: main.js needs only `div`, `set()`
// and `setTurning()`, as from a ModelView.

import { attachPanZoom, el, stars, zoomButtons } from "./lib/svg.js";

const TONES = ["#3a4556", "#58667b", "#7e8da3"];
const EDGE = "#0d1218";
const GLASS = "#cfe3ff";
const HORIZON = 52;
const VIEW = [-190, -150, 380, 250]; // the horizon low in it: a taller band shows more sky, not more ground

export class SkylineView {
  /** @param {HTMLElement} containerEl the band */
  constructor(containerEl) {
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
    this.vb = VIEW.slice();
    const svg = el("svg", { viewBox: this.vb.join(" "), preserveAspectRatio: "xMidYMax meet" });
    Object.assign(svg.style, { display: "block", width: "100%", height: "100%" });
    div.appendChild(svg);
    this.svg = svg;
    stars(el("g", {}, svg), -1500, -1500, 3000, 1500 + HORIZON - 4, 1400, 11);
    skyline(el("g", {}, svg));
    this.zoom = attachPanZoom(div, () => this.vb, (v) => this.setView(v), { minW: VIEW[2] * 0.4, maxW: VIEW[2] * 1.6 });
    zoomButtons(div, "8px", (f) => (f ? this.zoom(f) : this.setView(VIEW.slice())));
  }

  setView(v) {
    this.vb = v;
    this.svg.setAttribute("viewBox", v.map((n) => +n.toFixed(2)).join(" "));
  }

  /** Where you are in town changes nothing here. */
  set() {}

  setTurning() {}
}

function skyline(g) {
  const face = (d, fill) => el("path", { d, fill, stroke: EDGE, "stroke-width": 1.3, "stroke-linejoin": "round" }, g);
  // the salt pans, white to the horizon beyond the valley's mouth
  el("path", { d: `M-1500,${HORIZON}H1500`, stroke: GLASS, "stroke-opacity": 0.35, "stroke-width": 1.5 }, g);
  // the ridge behind the town, east, running on out of view
  face(`M10,${HORIZON}L95,-22L140,-6L190,-30L260,-12L360,-26L1500,-26V60H10Z`, TONES[1]);
  face(`M95,-22L120,60H10Z`, TONES[0]);
  face(`M95,-22L140,-6L190,-30L260,-12L360,-26L1500,-26V60H120Z`, TONES[2]);
  // the ground
  face(`M-1500,${HORIZON + 8}H1500V900H-1500Z`, TONES[0]);
  // the town's roofs, low and thick-walled: a front face, its end in shadow, the roof in the light
  const block = (x, w, h) => {
    const y = HORIZON + 8;
    face(`M${x},${y}V${y - h}H${x + w}V${y}Z`, TONES[1]);
    face(`M${x + w},${y}V${y - h}l8,-4V${y - 4}Z`, TONES[0]);
    face(`M${x},${y - h}l8,-4H${x + w + 8}l-8,4Z`, TONES[2]);
  };
  block(-160, 30, 9);
  block(-120, 34, 12);
  block(-80, 26, 16);
  block(-44, 40, 11);
  block(4, 30, 14);
  block(42, 22, 34); // the port office's tower
  el("path", { d: `M42,${HORIZON + 8 - 34}h22`, stroke: GLASS, "stroke-width": 3, "stroke-opacity": 0.8 }, g); // its glass room
  // the field's blast wall, west of the town
  el("path", { d: `M-200,${HORIZON + 8}V${HORIZON + 2}H-168V${HORIZON + 8}`, fill: "none", stroke: TONES[2], "stroke-width": 2 }, g);
}
