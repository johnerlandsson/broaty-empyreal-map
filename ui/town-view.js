// A town's top band (Zennor): you're on the ground, so not a model but the skyline from the
// street, a still, low-poly view in the models' Tones: the ridge rising east, the town's low roofs
// and the port office's squat tower with its glass room, the field's blast wall at the west, the
// salt pans a pale line on the horizon. Out of doors the sky is over it, as the game's `look sky`
// tells it (ui/lib/sky.js): a dome from the western horizon through overhead to the eastern, with
// Senara, T.I.S.S. and Orrin where the game puts them, each named and hovered with its sentence,
// the sky's tint, stars and glow stepped with the game's bands. Indoors, or with no charts to say,
// it's the skyline alone, with nothing in its sky. main.js redraws it each second while it's
// live; it needs `div`, `set()` and `setTurning()` as from a ModelView, and `setCharts()`.

import { groundSky, skyScene } from "./lib/sky.js";
import { attachPanZoom, el, stars, zoomButtons } from "./lib/svg.js";

const TONES = ["#3a4556", "#58667b", "#7e8da3"];
const EDGE = "#0d1218";
const GLASS = "#cfe3ff";
const ORBIT = "#2b3646";
const DIM = "#7d8a9a";
const TEXT = "#e3eaf2";
const STAR = "#fffaf0";
const GOLD = "#ffcf6a";
const GLOWS = { dusk: ["#e8925a", 0.35], dawn: ["#b8c8dc", 0.3] };
const DOME = 170; // the sky's radius, its feet on the horizon either side of the town
const HORIZON = 52;
const VIEW = [-190, -150, 380, 250]; // the horizon low in it: a taller band shows more sky, not more ground

export class SkyView {
  /**
   * @param {HTMLElement} containerEl the band
   * @param {{ byId: Map<string, { outdoors: boolean }> }} town indexTown()'s index, for which rooms are open to the sky
   * @param {string} port the town's id in the charts ("zennor")
   */
  constructor(containerEl, town, port) {
    this.town = town;
    this.port = port;
    this.charts = null;
    this.outdoors = false;
    this.tips = new Map(); // data-tip key -> { title, body }: the hovered thing's name and the game's sentence
    this.tipKey = null; // what's hovered
    this.tipShown = null; // what the tooltip last showed, so a redraw doesn't re-show the same
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
    const defs = el("defs", {}, svg);
    el("path", { d: dome() }, el("clipPath", { id: "sky-clip" }, defs));
    el("feGaussianBlur", { stdDeviation: 10 }, el("filter", { id: "sky-soft", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs));
    this.back = el("g", {}, svg); // tint and stars, behind the skyline
    skyline(el("g", {}, svg));
    this.front = el("g", {}, svg); // the dome, its marks and the glow, over it: nothing up is hidden
    this.zoom = attachPanZoom(div, () => this.vb, (v) => this.setView(v), { minW: VIEW[2] * 0.4, maxW: VIEW[2] * 1.6 });
    div.addEventListener("pointermove", (e) => this.hoverAt(e.target));
    div.addEventListener("pointerleave", () => this.hideTip());
    zoomButtons(div, "8px", (f) => (f ? this.zoom(f) : this.setView(VIEW.slice())));
  }

  setView(v) {
    this.vb = v;
    this.svg.setAttribute("viewBox", v.map((n) => +n.toFixed(2)).join(" "));
  }

  /** Where you are: out of doors in one of the town's rooms the sky shows, anywhere else not. */
  set(where) {
    this.outdoors = where?.kind === "room" && !!this.town?.byId.get(where.id)?.outdoors;
    this.draw(Date.now());
  }

  setTurning() {}

  /** The system's charts, an indexCharts() result. */
  setCharts(index) {
    this.charts = index;
    this.draw(Date.now());
  }

  /** Whether there's a sky to keep up: out of doors, with charts that place the town. */
  get live() {
    return this.outdoors && !!this.charts && groundSky(this.charts, this.port, Date.now()) !== null;
  }

  /** Draw the sky at wall-clock t (ms), or clear it to the bare skyline. */
  draw(t) {
    this.back.replaceChildren();
    this.front.replaceChildren();
    this.tips = new Map();
    const sky = this.outdoors && this.charts ? groundSky(this.charts, this.port, t) : null;
    if (sky) this.drawSky(sky);
    this.refreshTip();
  }

  /** The tint, stars and glow behind the skyline, and the dome and its marks over it. */
  drawSky(sky) {
    const scene = skyScene(sky);
    const inside = el("g", { "clip-path": "url(#sky-clip)" }, this.back);
    if (scene.tint) el("path", { d: dome(), fill: scene.tint }, inside);
    if (scene.stars !== "none") stars(inside, -DOME, HORIZON - DOME, DOME * 2, DOME, scene.stars === "all" ? 260 : 25, 11);
    // Dawn's paling, in the sky behind the ridge, rising from Senara's side of the horizon: the
    // glow on the horizon alone sits on the ridge's face, pale on pale, and doesn't show.
    if (scene.glow?.kind === "dawn") {
      const cx = scene.glow.east ? DOME : -DOME;
      const g = el("radialGradient", { id: "sky-dawn", cx, cy: HORIZON, r: 190, gradientUnits: "userSpaceOnUse" }, inside);
      el("stop", { offset: 0, "stop-color": "#8fa2bd", "stop-opacity": 0.7 }, g);
      el("stop", { offset: 0.5, "stop-color": "#4a5a74", "stop-opacity": 0.3 }, g);
      el("stop", { offset: 1, "stop-color": "#04060c", "stop-opacity": 0 }, g);
      el("path", { d: dome(), fill: "url(#sky-dawn)" }, inside);
    }

    const f = this.front;
    if (scene.glow) {
      const [fill, opacity] = GLOWS[scene.glow.kind];
      el("ellipse", { cx: scene.glow.east ? DOME : -DOME, cy: HORIZON, rx: 70, ry: 26, fill, opacity, filter: "url(#sky-soft)" }, f);
    }
    el("path", { d: dome(), fill: "transparent", "data-tip": "sky" }, f);
    this.tips.set("sky", { title: "The sky", body: scene.hover });
    el("path", { d: dome(true), fill: "none", stroke: ORBIT, "stroke-dasharray": "2 3" }, f);
    const label = { fill: DIM, "font-size": 8, "font-family": "var(--font-family, sans-serif)" };
    el("text", { ...label, x: -DOME, y: HORIZON + 11, "text-anchor": "middle" }, f, "W");
    el("text", { ...label, x: DOME, y: HORIZON + 11, "text-anchor": "middle" }, f, "E");
    for (const m of scene.marks) {
      const a = (m.angle * Math.PI) / 180;
      const x = -DOME * Math.cos(a);
      const y = HORIZON - DOME * Math.sin(a);
      const g = el("g", { "data-tip": m.id }, f);
      this.tips.set(m.id, { title: m.name, body: m.line });
      mark(g, m.look, x, y);
      const east = m.angle > 120;
      el("text", { ...label, x: x + (east ? -9 : 9), y: y + 3, "text-anchor": east ? "end" : "start" }, g, m.name);
    }
  }

  // The panel's tooltip, keyed by what's hovered as the chart's is (chart-view.js), so a redraw each
  // second follows the hovered thing as it moves instead of dropping the tooltip.
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
    const same = [this.tipKey, c.title, c.body, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join("|");
    if (same === this.tipShown) return;
    this.tipShown = same;
    window.panel?.tooltip?.show(r, { title: c.title, body: c.body });
  }

  /** After a redraw: follow the hovered thing, or hide if it's gone (set, gone indoors). */
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

/** The dome: closed along the horizon, or just its arc. */
function dome(open = false) {
  return `M${-DOME},${HORIZON}A${DOME},${DOME} 0 0 1 ${DOME},${HORIZON}${open ? "" : "Z"}`;
}

/** A thing in the sky, as skyScene() looks it. */
function mark(g, look, x, y) {
  if (look === "sun") {
    el("circle", { cx: x, cy: y, r: 16, fill: STAR, opacity: 0.18 }, g);
    el("circle", { cx: x, cy: y, r: 6, fill: STAR }, g);
  } else if (look === "spark") {
    el("path", { d: `M${x - 6},${y}h12M${x},${y - 6}v12`, stroke: "#fff", "stroke-width": 0.6, opacity: 0.6 }, g);
    el("circle", { cx: x, cy: y, r: 2.2, fill: "#fff" }, g);
  } else if (look === "fleck") {
    el("circle", { cx: x, cy: y, r: 1.8, fill: TEXT, opacity: 0.6 }, g);
  } else {
    el("circle", { cx: x, cy: y, r: 6, fill: GOLD, opacity: 0.15 }, g);
    el("circle", { cx: x, cy: y, r: 2.4, fill: GOLD }, g);
  }
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
