// A decks station's plans (Orrin Station): one per deck, top deck first, fore up and starboard
// right, each room in the cell its address names. The hull's footprint is the same on every deck
// so the frames line up; a deck outside it (a blister's) shows it dashed. Layout maths lives in
// lib/decks.js.

import { DISTRICT_COLOURS as DC } from "./lib/geometry.js";
import { PLAN, decksLayout, decksShape } from "./lib/decks.js";
import { el } from "./lib/svg.js";
import { DIM, PASSAGE, PLATE, hover, label, roomBox } from "./deck-view.js";

const GLASS = DC.docks;
const EDGE = "#3b4a5c";
const CORR = "#262f3b";
const FIXTURE = "#0e131a";
const HATCH = "#9fb0c3";
const STOP = "#aab8c8";
const LIGHTS = ["#59d18a", "#e8b04a", "#59d18a", "#3a4556", "#59d18a", "#59d18a", "#3a4556"]; // clamped, cycling, empty
const DECK_OF = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const none = { "pointer-events": "none" };

/**
 * @param {typeof import("./lib/decks.js").DECKS.orrin} spec
 * @returns {(svg: SVGElement, index: object) => object[]} the plans builder DeckView takes: one plan
 *   a deck, in the index's level order, all framed by the same extent
 */
export function decksPlans(spec) {
  return (svg, index) => index.decks.map((deck, level) => buildDeckPlan(svg, index, spec, deck, level));
}

function buildDeckPlan(svg, index, spec, deck, level) {
  const layout = decksLayout(index, deck);
  const { cells, links, hatches, footprint: fp, frames, onHull } = layout;
  const g = el("g", { display: "none" }, svg);

  // the hull: a plate with its walls on a deck inside it, else its outline, dashed, and a plate
  // round each blister
  if (fp && onHull) {
    el("rect", { x: fp.x, y: fp.y, width: fp.w, height: fp.h, rx: 12, fill: PLATE, stroke: EDGE, "stroke-width": 3 }, g);
  } else if (fp) {
    el("rect", { x: fp.x, y: fp.y, width: fp.w, height: fp.h, rx: 12, fill: "none", stroke: EDGE, "stroke-width": 1.5, "stroke-dasharray": "6 5" }, g);
  }
  for (const c of cells) if (c.kind === "blister") el("circle", { cx: c.cx, cy: c.cy, r: c.r + 14, fill: PLATE, stroke: EDGE, "stroke-width": 2 }, g);

  // thruster bells aft of a cell's wall: compartments, line drawings
  if (fp && onHull) {
    for (const [side, d] of spec.thrusters ?? []) {
      if (d !== deck) continue;
      const [x] = layout.centre({ x: side, y: 0 });
      thrusters(g, x, fp.y + fp.h);
    }
  }

  // a blister on the next deck, outlined where it hangs under (or sits on) this one
  for (const b of layout.nearby) {
    el("circle", { cx: b.cx, cy: b.cy, r: b.r, fill: "none", stroke: GLASS, "stroke-opacity": 0.35, "stroke-width": 1.2, "stroke-dasharray": "4 4", ...none }, g);
  }

  for (const l of links) el("rect", { x: l.x, y: l.y, width: l.w, height: l.h, fill: PASSAGE }, g);

  for (const c of cells) {
    if (c.kind === "passage") {
      const r = el("rect", { x: c.cx - c.w / 2, y: c.cy - c.h / 2, width: c.w, height: c.h, fill: CORR }, g);
      hover(r, c.room);
      // a stop, unless a hatch takes the cell's middle
      const [x, y] = layout.centre(c.room.cell);
      if (!c.room.exits?.up && !c.room.exits?.down) el("circle", { cx: x, cy: y, r: 4, fill: STOP, ...none }, g);
    } else if (c.kind === "room") {
      roomBox(g, c.room, c.cx, c.cy, spec.tints[c.room.id] ?? DC.industrial, c.w, c.h);
      if (c.room.flags?.includes("berth")) airlocks(g, c);
    } else {
      blister(g, c);
    }
  }

  for (const h of hatches) {
    el("circle", { cx: h.cx, cy: h.cy, r: 9, fill: FIXTURE, stroke: HATCH, "stroke-width": 1.4, ...none }, g);
    el("circle", { cx: h.cx, cy: h.cy, r: 3.5, fill: "none", stroke: HATCH, "stroke-width": 1.1, ...none }, g);
    if (h.side === "right") label(g, h.cx + 13, h.cy, h.dir, 9, { fill: DIM, "text-anchor": "start" });
    else label(g, h.cx, h.cy + 17, h.dir, 9, { fill: DIM });
  }

  // fore up, the deck and its gravity over the plan, the frames down its port side
  if (fp) {
    label(g, fp.x, fp.y - 26, "FORE ▲", 10, { fill: DIM, "text-anchor": "start", "letter-spacing": 1 });
    const gs = [...new Set(cells.map((c) => c.room.gravity).filter(Number.isFinite))];
    const head = gs.length === 1 ? `DECK ${deck} · ${gs[0]} g` : `DECK ${deck}`;
    label(g, fp.x, fp.y - 11, head, 10, { fill: DIM, "text-anchor": "start", "letter-spacing": 1 });
    for (const f of frames) label(g, fp.x - 8, f.cy, `frame ${f.n}`, 9, { fill: DIM, "text-anchor": "end" });
  }

  const hl = el("g", { "pointer-events": "none" }, g);
  const extent = fp ? { w: fp.w + 2 * 70, h: fp.h + 2 * 44 } : { w: 400, h: 300 };
  const home = fp ? [fp.x + fp.w / 2, fp.y + fp.h / 2] : [0, 0];
  return { z: level, g, hl, layout, ring: false, length: 0, home, extent, offsets: [0], margin: 0.42, shape: (where) => decksShape(layout, where) };
}

/** Airlock hatches on every wall of the berth that no exit goes through, each with a status light. */
function airlocks(g, c) {
  let n = 0;
  for (const [dir, [dx, dy]] of Object.entries(DECK_OF)) {
    if (c.room.exits?.[dir]) continue;
    const long = dx ? c.h : c.w;
    const count = Math.max(1, Math.round(long / 40));
    for (let i = 0; i < count; i++) {
      const t = -long / 2 + ((i + 0.5) * long) / count;
      const x = c.cx + (dx ? (dx * c.w) / 2 : t);
      const y = c.cy + (dy ? (dy * c.h) / 2 : t);
      const [w, h] = dx ? [8, 16] : [16, 8];
      el("rect", { x: x - w / 2 + dx * 1.5, y: y - h / 2 + dy * 1.5, width: w, height: h, rx: 2, fill: FIXTURE, stroke: GLASS, "stroke-width": 1.2, ...none }, g);
      const off = dx ? [dx * 11, 0] : [0, dy * 11];
      const lx = x + off[0] + (dx ? 0 : 11);
      const ly = y + off[1] + (dx ? 11 : 0);
      el("circle", { cx: lx, cy: ly, r: 2.2, fill: LIGHTS[n++ % LIGHTS.length], ...none }, g);
    }
  }
}

/** A blister: a round glass room, its dome's rings drawn in, named, with any hatch above the name. */
function blister(g, c) {
  const gl = el("g", {}, g);
  el("circle", { cx: c.cx, cy: c.cy, r: c.r, fill: GLASS, "fill-opacity": 0.14, stroke: GLASS, "stroke-opacity": 0.6, "stroke-width": 1.6 }, gl);
  for (const k of [0.72, 0.42]) {
    el("circle", { cx: c.cx, cy: c.cy, r: c.r * k, fill: "none", stroke: GLASS, "stroke-opacity": 0.22, "stroke-width": 1 }, gl);
  }
  label(gl, c.cx, c.cy + 10, c.room.name, 12);
  hover(gl, c.room);
}

/** Two stationkeeping thruster bells, flaring aft from the hull wall at y. */
function thrusters(g, cx, y) {
  for (const dx of [-16, 16]) {
    const x = cx + dx;
    el("path", { d: `M${x - 4},${y}L${x - 4},${y + 5}L${x - 9},${y + 16}L${x + 9},${y + 16}L${x + 4},${y + 5}L${x + 4},${y}`, stroke: DIM, "stroke-width": 1.2, fill: "none", ...none }, g);
  }
}
