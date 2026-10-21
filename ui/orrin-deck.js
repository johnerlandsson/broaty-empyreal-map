// Orrin Station's deck plan: one floor, the Concourse across the middle with the Exchange north,
// the Freight Office south, the Chart Office west and the Berths east, and the Gallery drawn up
// the stair from the hall, since it sits on the drum's axis. Layout maths lives in lib/orrin.js.

import { DISTRICT_COLOURS as DC } from "./lib/geometry.js";
import { TINTS, orrinLayout, orrinShape } from "./lib/orrin.js";
import { el } from "./lib/svg.js";
import { DIM, PASSAGE, PLATE, hover, label, roomBox } from "./deck-view.js";

const GLASS = DC.docks;
const LIGHTS = ["#59d18a", "#59d18a", "#e8b04a", "#59d18a", "#3a4556"]; // clamped, cycling, empty

/** @returns {object[]} the one plan, in the shape DeckView keeps; it fits the panel, so the view
 * follows only a highlight near its edge */
export function buildOrrinPlans(svg, index) {
  const layout = orrinLayout(index);
  const { boxes, hall, gallery, stair } = layout;
  const g = el("g", { display: "none" }, svg);
  const find = (id) => boxes.find((b) => b.room.id === id);

  // the drum's floor under the rooms, and the Gallery's own round deck up at the axis
  const x0 = Math.min(...boxes.map((b) => b.cx - b.w / 2)) - 22;
  const x1 = Math.max(...boxes.map((b) => b.cx + b.w / 2)) + 22;
  const y0 = Math.min(...boxes.map((b) => b.cy - b.h / 2)) - 22;
  const y1 = Math.max(...boxes.map((b) => b.cy + b.h / 2)) + 22;
  el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 24, fill: PLATE }, g);
  el("circle", { cx: gallery.cx, cy: gallery.cy, r: gallery.r + 14, fill: PLATE }, g);

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

  for (const b of boxes) roomBox(g, b.room, b.cx, b.cy, TINTS[b.room.id] ?? DC.industrial, b.w, b.h);

  // the airlock hatches down the Berths' outer wall, each with its status light
  const berth = find("orrin.berth");
  if (berth) {
    const n = LIGHTS.length;
    const right = berth.cx + berth.w / 2;
    for (let i = 0; i < n; i++) {
      const y = berth.cy - berth.h / 2 + ((i + 0.5) * berth.h) / n;
      el("rect", { x: right - 3, y: y - 9, width: 8, height: 18, rx: 2, fill: "#0e131a", stroke: GLASS, "stroke-width": 1.2, "pointer-events": "none" }, g);
      el("circle", { cx: right + 10, cy: y, r: 2.2, fill: LIGHTS[i], "pointer-events": "none" }, g);
    }
  }

  // the spiral stair in the hall, and the way up it to the Gallery
  el("path", {
    d: `M${stair.cx},${stair.cy - stair.r - 4}L${gallery.cx},${gallery.cy + gallery.r + 4}`,
    stroke: DIM,
    "stroke-width": 1.5,
    "stroke-dasharray": "4 4",
    fill: "none",
    "pointer-events": "none",
  }, g);
  el("circle", { cx: stair.cx, cy: stair.cy, r: stair.r, fill: "#0e131a", stroke: "#cfd8e3", "stroke-width": 1.6, "pointer-events": "none" }, g);
  el("path", { d: spiral(stair.cx, stair.cy, stair.r - 3), stroke: "#cfd8e3", "stroke-width": 1.2, fill: "none", "pointer-events": "none" }, g);
  label(g, stair.cx + 12, (stair.cy + gallery.cy + gallery.r) / 2, "up", 9, { fill: DIM, "text-anchor": "start" });

  // the Gallery: a ring of windows looking down the well
  const gl = el("g", {}, g);
  el("circle", { cx: gallery.cx, cy: gallery.cy, r: gallery.r, fill: GLASS, "fill-opacity": 0.12, stroke: GLASS, "stroke-opacity": 0.5, "stroke-width": 1.2 }, gl);
  for (let i = 0; i < 12; i++) {
    const a0 = ((i + 0.12) / 12) * 2 * Math.PI;
    const a1 = ((i + 0.88) / 12) * 2 * Math.PI;
    const p = (a) => `${(gallery.cx + gallery.r * Math.sin(a)).toFixed(1)},${(gallery.cy - gallery.r * Math.cos(a)).toFixed(1)}`;
    el("path", { d: `M${p(a0)}A${gallery.r},${gallery.r} 0 0 1 ${p(a1)}`, stroke: GLASS, "stroke-width": 3.5, fill: "none" }, gl);
  }
  label(gl, gallery.cx, gallery.cy - 6, gallery.room?.name ?? "Gallery", 12);
  label(gl, gallery.cx, gallery.cy + 10, `${gallery.room?.gravity ?? 0.1} g`, 10, { fill: DIM });
  hover(gl, gallery.room);

  label(g, x0 + 14, y0 + 14, "N ▲", 10, { fill: DIM, "text-anchor": "start", "letter-spacing": 1 });

  const hl = el("g", { "pointer-events": "none" }, g);
  const home = [(x0 + x1) / 2, (gallery.cy - gallery.r - 14 + y1) / 2];
  return [{ z: 0, g, hl, layout, ring: false, length: 0, home, offsets: [0], margin: 0.42, shape: (where) => orrinShape(layout, where) }];
}

/** A two-turn spiral of radius r about (cx, cy), for the stair. */
function spiral(cx, cy, r) {
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 24) * 2 * Math.PI;
    const k = (r * i) / 48;
    pts.push(`${(cx + k * Math.sin(a)).toFixed(1)},${(cy - k * Math.cos(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
}
