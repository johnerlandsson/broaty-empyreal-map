// A city of levels' plans (Dolcoath), one a level, switching as you change level as a station's
// decks do (John's pick B, reference/dolcoath-levels-options.png). Each level is drawn as a town's
// plan is (town-deck.js): its rooms placed by their compass exits, on bare rock, tinted by
// district. Over that go the ways that leave it, beside the room they leave from, each naming
// where it goes: the cage's shaft as a black well off its station with the cage's barred gate in
// it, the man engine's narrow slot with its rod and stages, the Great Stair's treads running off,
// and a plain way up or down as a small well. Hovering over one gives where it goes and, where the
// game has them, its seconds. Layout and words are lib/levels.js.

import { FLIGHT, HATCH, SLOT, WELL, levelFrame, levelLayout, levelTitle, wayTip } from "./lib/levels.js";
import { el } from "./lib/svg.js";
import { DIM, hover, label } from "./deck-view.js";
import { townPlan } from "./town-deck.js";

// style guide §4.2, Towns, and the plans' lift colour
const EARTH = "#332b22";
const STONE = "#4b4338";
const SHAFT = "#030303"; // a shaft's dark
const HATCHING = "#1c1814";
const LIFT = "#cfd8e3";
const TIMBER = "#a07a4e"; // the man engine's rod
const FIX = "#0e131a";
const NONE = { "pointer-events": "none" };

/** What a plan's legend names for each kind of way off a level. */
const LEGEND = { cage: "shaft", "man-engine": "rod", stair: "flight", plain: "hatchway" };

/**
 * @param {ReturnType<typeof import("./lib/look.js").levelsSpec>} spec
 * @returns {(svg: SVGElement, index: object, opts?: {pick?: boolean}) => object[]} the plans
 *   builder DeckView takes: one plan a level, top down
 */
export function levelsPlans(spec) {
  return (svg, index, opts) =>
    index.levels.map((lv) => {
      const layout = levelLayout(index, spec, lv.level);
      return townPlan(svg, index, spec, opts?.pick, {
        layout,
        title: levelTitle(lv),
        draw: (g) => {
          for (const w of layout.ways) drawWay(g, w);
        },
        frame: (where) => levelFrame(layout, where),
        legend: [...new Set(layout.ways.map((w) => LEGEND[w.kind]).filter(Boolean))],
      });
    });
}

/** A rect `across` wide and `along` long, centred on cx, cy, its length along the way out. */
function box(w, across, along) {
  const [width, height] = w.uy ? [across, along] : [along, across];
  return { x: w.cx - width / 2, y: w.cy - height / 2, width, height };
}

/** One way off the level: its drawing, its words and its tooltip. */
function drawWay(g, w) {
  const gw = el("g", { "data-way": w.kind }, g);
  let across = HATCH;
  if (w.kind === "cage") {
    across = WELL.w;
    const r = box(w, WELL.w, WELL.h);
    // the gate from the station to the shaft, then the shaft, hatched dark, the cage's gate in it
    el("path", { d: `M${w.x},${w.y}L${w.cx - (w.ux * WELL.h) / 2},${w.cy - (w.uy * WELL.h) / 2}`, stroke: LIFT, "stroke-width": 2, "stroke-dasharray": "2 2", ...NONE }, gw);
    el("rect", { ...r, fill: SHAFT, stroke: STONE, "stroke-width": 3, ...NONE }, gw);
    el("path", { d: `M${r.x},${r.y}l${r.width},${r.height}M${r.x + r.width},${r.y}l${-r.width},${r.height}`, stroke: HATCHING, "stroke-width": 1, ...NONE }, gw);
    const c = { x: w.cx - 13, y: w.cy - 11, width: 26, height: 22 };
    el("rect", { ...c, rx: 1.5, fill: FIX, stroke: LIFT, "stroke-width": 1.4, ...NONE }, gw);
    el("path", { d: [-6, 0, 6].map((dx) => `M${w.cx + dx},${c.y}v${c.height}`).join(""), stroke: LIFT, "stroke-width": 0.9, ...NONE }, gw);
  } else if (w.kind === "man-engine") {
    across = SLOT.w;
    const r = box(w, SLOT.w, SLOT.h);
    el("path", { d: `M${w.x},${w.y}L${w.cx - (w.ux * SLOT.h) / 2},${w.cy - (w.uy * SLOT.h) / 2}`, stroke: STONE, "stroke-width": 2, ...NONE }, gw);
    el("rect", { ...r, fill: SHAFT, stroke: STONE, "stroke-width": 3, ...NONE }, gw);
    // the rod down the slot's length, a stage across it every stroke
    const [hx, hy] = [(w.ux * SLOT.h) / 2, (w.uy * SLOT.h) / 2];
    el("path", { d: `M${w.cx - hx},${w.cy - hy}L${w.cx + hx},${w.cy + hy}`, stroke: TIMBER, "stroke-width": 4, ...NONE }, gw);
    const [px, py] = [-w.uy * 7, w.ux * 7];
    const stages = [-10, 0, 10].map((t) => `M${w.cx + w.ux * t - px},${w.cy + w.uy * t - py}l${2 * px},${2 * py}`).join("");
    el("path", { d: stages, stroke: TIMBER, "stroke-width": 1.6, ...NONE }, gw);
  } else if (w.kind === "stair") {
    across = FLIGHT.w;
    const r = box(w, FLIGHT.w, FLIGHT.len);
    el("rect", { ...r, fill: EARTH, ...NONE }, gw);
    // the treads across the flight, its two sides along it
    const [px, py] = [(-w.uy * FLIGHT.w) / 2, (w.ux * FLIGHT.w) / 2];
    let d = "";
    for (let t = 6; t < FLIGHT.len; t += 6) d += `M${w.x + w.ux * t - px},${w.y + w.uy * t - py}l${2 * px},${2 * py}`;
    el("path", { d, stroke: STONE, "stroke-width": 1.4, ...NONE }, gw);
    const [ex, ey] = [w.x + w.ux * FLIGHT.len, w.y + w.uy * FLIGHT.len];
    el("path", { d: `M${w.x - px},${w.y - py}L${ex - px},${ey - py}M${w.x + px},${w.y + py}L${ex + px},${ey + py}`, stroke: STONE, "stroke-width": 2, ...NONE }, gw);
  } else {
    const r = box(w, HATCH, HATCH);
    el("path", { d: `M${w.x},${w.y}L${w.cx - (w.ux * HATCH) / 2},${w.cy - (w.uy * HATCH) / 2}`, stroke: DIM, "stroke-width": 1.5, "stroke-dasharray": "3 3", ...NONE }, gw);
    el("rect", { ...r, rx: 2, fill: SHAFT, stroke: STONE, "stroke-width": 2, ...NONE }, gw);
    el("circle", { cx: w.cx, cy: w.cy, r: 4, fill: "none", stroke: DIM, "stroke-width": 1, ...NONE }, gw);
  }

  // its words: a line each way, beside it going north or south, under it going east or west; the
  // stair's its name, with which ways it goes
  const lines =
    w.kind === "stair"
      ? [`${w.up ? "▲" : ""}${w.down ? "▼" : ""} ${w.name}`]
      : [w.up && w.tags.up && `▲ ${w.tags.up}`, w.down && w.tags.down && `▼ ${w.tags.down}`].filter(Boolean);
  const side = !!w.uy;
  const [tx, ty] = side ? [w.cx + across / 2 + 6, w.cy - ((lines.length - 1) * 13) / 2] : [w.cx, w.cy + across / 2 + 12];
  lines.forEach((t, i) => label(gw, tx, ty + i * 13, t, 11, { fill: DIM, "text-anchor": side ? "start" : "middle" }));

  // the tooltip, over the drawing and its words
  const { title, rows } = wayTip(w);
  const r = box(w, Math.max(across, 24), w.len);
  const hit = side ? { ...r, width: r.width + 84 } : { ...r, x: r.x - 30, width: r.width + 60, height: r.height + 30 };
  hover(el("rect", { ...hit, fill: "transparent" }, gw), { name: title }, false, rows);
}
