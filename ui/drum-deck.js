// A drum station's deck plan (Wenna Halt): one floor, the Concourse across the
// middle with the Exchange north, the Freight Office south, the Chart Office west and the Berths
// east, and the axis room drawn up the stair or ramp from the hall, since it sits on the drum's
// axis. Layout maths lives in lib/drum.js.

import { DISTRICT_COLOURS as DC } from "./lib/geometry.js";
import { drumLayout, drumShape } from "./lib/drum.js";
import { el } from "./lib/svg.js";
import { DIM, PASSAGE, PLATE, hover, label, roomBox } from "./deck-view.js";

const GLASS = DC.docks;
const STEPS = "#cfd8e3";
const LIGHTS = ["#59d18a", "#59d18a", "#e8b04a", "#59d18a", "#3a4556"]; // clamped, cycling, empty

/**
 * @param {ReturnType<typeof import("./lib/look.js").drumSpec>} spec
 * @returns {(svg: SVGElement, index: object) => object[]} the plans builder DeckView takes: the one
 *   plan, which fits the panel, so the view follows only a highlight near its edge
 */
export function drumPlans(spec) {
  return (svg, index) => buildDrumPlan(svg, index, spec);
}

function buildDrumPlan(svg, index, spec) {
  const layout = drumLayout(index, spec);
  const { boxes, hall, axis, way } = layout;
  const g = el("g", { display: "none" }, svg);
  const find = (id) => boxes.find((b) => b.room.id === id);

  // the drum's floor under the rooms, and the axis room's own round deck
  const x0 = Math.min(...boxes.map((b) => b.cx - b.w / 2)) - 22;
  const x1 = Math.max(...boxes.map((b) => b.cx + b.w / 2)) + 22;
  const y0 = Math.min(...boxes.map((b) => b.cy - b.h / 2)) - 22;
  const y1 = Math.max(...boxes.map((b) => b.cy + b.h / 2)) + 22;
  el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 24, fill: PLATE }, g);
  el("circle", { cx: axis.cx, cy: axis.cy, r: axis.r + 14, fill: PLATE }, g);

  // passages from the hall to each room off it
  if (hall) {
    for (const b of boxes) {
      if (b === hall) continue;
      if (b.cy === hall.cy) {
        const sg = Math.sign(b.cx - hall.cx);
        const from = hall.cx + (sg * hall.w) / 2;
        const to = b.cx - (sg * b.w) / 2;
        el("rect", { x: Math.min(from, to), y: hall.cy - 9, width: Math.abs(to - from), height: 18, fill: PASSAGE }, g);
      } else {
        const sg = Math.sign(b.cy - hall.cy);
        const from = hall.cy + (sg * hall.h) / 2;
        const to = b.cy - (sg * b.h) / 2;
        el("rect", { x: b.cx - 8, y: Math.min(from, to), width: 16, height: Math.abs(to - from), fill: PASSAGE }, g);
      }
    }
  }

  for (const b of boxes) roomBox(g, b.room, b.cx, b.cy, spec.tints[b.room.id] ?? DC.industrial, b.w, b.h);

  // the airlock hatches down the Berths' outer wall, each with its status light
  const berth = find(`${spec.prefix}.berth`);
  if (berth) {
    const n = LIGHTS.length;
    const right = berth.cx + berth.w / 2;
    for (let i = 0; i < n; i++) {
      const y = berth.cy - berth.h / 2 + ((i + 0.5) * berth.h) / n;
      el("rect", { x: right - 3, y: y - 9, width: 8, height: 18, rx: 2, fill: "#0e131a", stroke: GLASS, "stroke-width": 1.2, "pointer-events": "none" }, g);
      el("circle", { cx: right + 10, cy: y, r: 2.2, fill: LIGHTS[i], "pointer-events": "none" }, g);
    }
  }

  // the stair or ramp in the hall, and the way up it to the axis room
  const top = spec.way === "ramp" ? way.cy - way.r * 1.4 : way.cy - way.r;
  el("path", {
    d: `M${way.cx},${top - 4}L${axis.cx},${axis.cy + axis.r + 4}`,
    stroke: DIM,
    "stroke-width": 1.5,
    "stroke-dasharray": "4 4",
    fill: "none",
    "pointer-events": "none",
  }, g);
  if (spec.way === "ramp") ramp(g, way.cx, way.cy, way.r);
  else stair(g, way.cx, way.cy, way.r);
  label(g, way.cx + 12, (way.cy + axis.cy + axis.r) / 2, "up", 9, { fill: DIM, "text-anchor": "start" });

  const gl = el("g", {}, g);
  el("circle", { cx: axis.cx, cy: axis.cy, r: axis.r, fill: GLASS, "fill-opacity": 0.12, stroke: GLASS, "stroke-opacity": 0.5, "stroke-width": 1.2 }, gl);
  if (spec.way === "ramp") lounge(gl, axis);
  else gallery(gl, axis);
  label(gl, axis.cx, axis.cy - 6, axis.room?.name ?? "", 12);
  label(gl, axis.cx, axis.cy + 10, `${axis.room?.gravity ?? 0.1} g`, 10, { fill: DIM });
  hover(gl, axis.room);

  label(g, x0 + 14, y0 + 14, "N ▲", 10, { fill: DIM, "text-anchor": "start", "letter-spacing": 1 });

  const hl = el("g", { "pointer-events": "none" }, g);
  const home = [(x0 + x1) / 2, (axis.cy - axis.r - 14 + y1) / 2];
  return [{ z: 0, g, hl, layout, ring: false, length: 0, home, offsets: [0], margin: 0.42, shape: (where) => drumShape(layout, where) }];
}

/** A spiral stair (`way: "stair"`): a two-turn spiral of radius r about (cx, cy). */
function stair(g, cx, cy, r) {
  el("circle", { cx, cy, r, fill: "#0e131a", stroke: STEPS, "stroke-width": 1.6, "pointer-events": "none" }, g);
  const pts = [];
  const k0 = r - 3;
  for (let i = 0; i <= 48; i++) {
    const a = (i / 24) * 2 * Math.PI;
    const k = (k0 * i) / 48;
    pts.push(`${(cx + k * Math.sin(a)).toFixed(1)},${(cy - k * Math.cos(a)).toFixed(1)}`);
  }
  el("path", { d: `M${pts.join("L")}`, stroke: STEPS, "stroke-width": 1.2, fill: "none", "pointer-events": "none" }, g);
}

/** Wenna's ramp: a strip climbing north across the hall, chevrons pointing up it. */
function ramp(g, cx, cy, r) {
  const w = r * 1.3;
  const h = r * 2.8;
  el("rect", { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: 2, fill: "#0e131a", stroke: STEPS, "stroke-width": 1.6, "pointer-events": "none" }, g);
  for (const dy of [-h / 4, 0, h / 4]) {
    const y = cy + dy + 3;
    el("path", { d: `M${cx - w / 2 + 4},${y}L${cx},${y - 5}L${cx + w / 2 - 4},${y}`, stroke: STEPS, "stroke-width": 1.2, fill: "none", "pointer-events": "none" }, g);
  }
}

/** The axis room up a stair: a ring of windows all round. */
function gallery(g, { cx, cy, r }) {
  for (let i = 0; i < 12; i++) {
    const a0 = ((i + 0.12) / 12) * 2 * Math.PI;
    const a1 = ((i + 0.88) / 12) * 2 * Math.PI;
    el("path", { d: `M${pt(cx, cy, r, a0)}A${r},${r} 0 0 1 ${pt(cx, cy, r, a1)}`, stroke: GLASS, "stroke-width": 3.5, fill: "none" }, g);
  }
}

/** Wenna's Lounge: one wide curved window on the sea, and deep chairs facing it. */
function lounge(g, { cx, cy, r }) {
  const a0 = -0.36 * Math.PI;
  const a1 = 0.36 * Math.PI;
  el("path", { d: `M${pt(cx, cy, r, a0)}A${r},${r} 0 0 1 ${pt(cx, cy, r, a1)}`, stroke: GLASS, "stroke-width": 4.5, fill: "none" }, g);
  for (const a of [-0.22, 0, 0.22].map((t) => t * Math.PI)) {
    const [x, y] = pt(cx, cy, r - 9, a).split(",").map(Number);
    el("rect", { x: x - 4, y: y - 3, width: 8, height: 6, rx: 2, fill: DC.concourse, "fill-opacity": 0.55, transform: `rotate(${(a * 180) / Math.PI} ${x} ${y})`, "pointer-events": "none" }, g);
  }
}

/** The point at angle a (clockwise from north) on a circle of radius r about (cx, cy), as "x,y". */
function pt(cx, cy, r, a) {
  return `${(cx + r * Math.sin(a)).toFixed(1)},${(cy - r * Math.cos(a)).toFixed(1)}`;
}
