// A decks station's plans (Orrin Station): one per deck, top deck first, fore up and starboard
// right, each room in the cell its address names, in its footprint's shape. The hull's footprint is
// the same on every deck so the frames line up; a deck with a hull path is plated with it instead;
// a deck outside the hull (a blister's) shows the footprint dashed. A ship's plan also has her
// fixtures (ships-from-cells-mockup.html): drive bells, the boom and the collar's ring under the
// plate, and the props in her rooms over them. Layout maths lives in lib/decks.js.

import { DISTRICT_COLOURS as DC } from "./lib/geometry.js";
import { PLAN, decksLayout, decksShape, fitLabel, pathD } from "./lib/decks.js";
import { noseAt, propBoxes, tailAt, wallAt } from "./lib/footprint.js";
import { boxPath } from "./lib/solid.js";
import { el } from "./lib/svg.js";
import { DIM, PASSAGE, PLATE, TXT, hover, label, roomBox } from "./deck-view.js";

const GLASS = DC.docks;
const EDGE = "#3b4a5c";
const CORR = "#262f3b";
const FIXTURE = "#0e131a";
const HATCH = "#9fb0c3";
const STOP = "#aab8c8";
const LIGHTS = ["#59d18a", "#e8b04a", "#59d18a", "#3a4556", "#59d18a", "#59d18a", "#3a4556"]; // clamped, cycling, empty
const DECK_OF = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const HULL_LINE = "#9fb0c3";
const CHEVRON = "#e8b04a";
const WALL = { starboard: [1, 0], port: [-1, 0], fore: [0, 1], aft: [0, -1] };
const none = { "pointer-events": "none" };

/**
 * @param {{id: string, kind?: string, look?: {fixtures?: object[]}}} [data] the generated file, for
 *   a ship plan's fixtures
 * @returns {(svg: SVGElement, index: object, opts?: {pick?: boolean}) => object[]} the plans
 *   builder DeckView takes: one plan a deck, in the index's level order, all framed by the same
 *   extent; with pick, every room marked for picking
 */
export function decksPlans(data) {
  const fixtures = data?.kind === "plan" ? (data.look?.fixtures ?? []) : [];
  const ship = { id: data?.id, plan: data?.kind === "plan", fixtures };
  return (svg, index, opts) => index.decks.map((deck, level) => buildDeckPlan(svg, index, deck, level, opts?.pick, ship));
}

function buildDeckPlan(svg, index, deck, level, pick, ship) {
  const layout = decksLayout(index, deck);
  const { cells, links, hatches, footprint: fp, plate, frames, onHull } = layout;
  const g = el("g", { display: "none" }, svg);
  const fixtures = shipFixtures(index, layout, ship);
  fixtures.outside(g);

  // the hull: a plate with its walls on a deck inside it (its path, where it has one), else its
  // outline, dashed, and a plate round each blister
  if (plate && onHull) {
    el("path", { d: pathD(plate), fill: PLATE, stroke: EDGE, "stroke-width": 3, "stroke-linejoin": "round" }, g);
  } else if (fp && onHull) {
    el("rect", { x: fp.x, y: fp.y, width: fp.w, height: fp.h, rx: 12, fill: PLATE, stroke: EDGE, "stroke-width": 3 }, g);
  } else if (fp) {
    el("rect", { x: fp.x, y: fp.y, width: fp.w, height: fp.h, rx: 12, fill: "none", stroke: EDGE, "stroke-width": 1.5, "stroke-dasharray": "6 5" }, g);
  }
  for (const c of cells) if (c.kind === "blister") el("circle", { cx: c.cx, cy: c.cy, r: c.r + 14, fill: PLATE, stroke: EDGE, "stroke-width": 2 }, g);

  for (const l of links) el("rect", { x: l.x, y: l.y, width: l.w, height: l.h, fill: PASSAGE }, g);

  for (const c of cells) {
    if (c.kind === "passage") {
      const r = el("rect", { x: c.cx - c.w / 2, y: c.cy - c.h / 2, width: c.w, height: c.h, fill: CORR }, g);
      hover(r, c.room, pick);
      // a stop, unless a hatch takes the cell's middle
      const [x, y] = layout.centre(c.room.cell);
      if (!c.room.exits?.up && !c.room.exits?.down) el("circle", { cx: x, cy: y, r: 4, fill: STOP, ...none }, g);
    } else if (c.kind === "room") {
      const box = roomBox(g, c.room, c.cx, c.cy, c.room.tint ?? DC.industrial, c.w, c.h, c.shaped ? pathD(c.points) : undefined, pick, !ship.plan);
      if (ship.plan) shipName(box, c, fixtures.propsIn(c.room));
      if (c.room.flags?.includes("berth")) airlocks(g, c);
    } else {
      blister(g, c, pick);
    }
  }

  fixtures.inside(g);

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
  const plan = { z: level, g, hl, layout, ring: false, length: 0, home, extent, offsets: [0], margin: 0.42, shape: (where) => decksShape(layout, where) };
  // a ship plan's aft-most drawn point, hull or bell, for what goes under her (ship-deck.js)
  if (ship.plan && fp) plan.aft = Math.max(fp.y + fp.h, fixtures.aft);
  return plan;
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
function blister(g, c, pick) {
  const gl = el("g", {}, g);
  el("circle", { cx: c.cx, cy: c.cy, r: c.r, fill: GLASS, "fill-opacity": 0.14, stroke: GLASS, "stroke-opacity": 0.6, "stroke-width": 1.6 }, gl);
  for (const k of [0.72, 0.42]) {
    el("circle", { cx: c.cx, cy: c.cy, r: c.r * k, fill: "none", stroke: GLASS, "stroke-opacity": 0.22, "stroke-width": 1 }, gl);
  }
  label(gl, c.cx, c.cy + 10, c.room.name, 12);
  hover(gl, c.room, pick);
}

// --- a ship's fixtures ---------------------------------------------------------------------------

const ln = (pts) => `M${pts.map((p) => p.map((v) => +v.toFixed(1)).join(",")).join("L")}`;

/**
 * A ship's fixtures on one deck's plan: `outside(g)` draws the bells, boom and rings (under the
 * plate), `inside(g)` the props (over the rooms). Each fixture is a group marked with its index in
 * the look. A room-bound one whose room is gone, or one off the hull, draws nothing.
 */
function shipFixtures(index, layout, { id, fixtures }) {
  const P = ([x, y]) => layout.centre({ x, y });
  const deck = layout.deck;
  const path = index.hullPaths?.[deck] ?? boxPath(index.hull);
  const roomOf = (f) => index.byId.get(`${id}.${f.room}`);
  const group = (g, i) => el("g", { "data-fixture": i, ...none }, g);
  return {
    aft: -Infinity, // the plan y of the aft-most bell mouth outside() drew, if any
    outside(g) {
      fixtures.forEach((f, i) => {
        if ((f.type === "bell" || f.type === "boom") && f.deck === deck) {
          const end = f.type === "bell" ? tailAt(path, f.side) : noseAt(path, f.side);
          if (end !== null) (f.type === "bell" ? planBell : planBoom)(group(g, i), P, f, end);
          if (end !== null && f.type === "bell") this.aft = Math.max(this.aft, P([f.side, end - f.len])[1]);
        } else if (f.type === "chevrons") {
          const room = roomOf(f);
          const cell = room && room.cell.z === deck ? layout.cells.find((c) => c.room === room) : null;
          const hit = cell ? wallAt(path, room.cell, f.wall) : null;
          if (hit) planRing(group(g, i), P, f, cell, hit);
        }
      });
    },
    /** The plan boxes of a room's props. */
    propsIn(room) {
      return fixtures
        .filter((f) => f.type === "prop" && roomOf(f) === room)
        .flatMap((f) => propBoxes(f, { side: room.cell.x, frame: room.cell.y }))
        .map(([x0, y0, x1, y1]) => {
          const [a, b] = [P([x0, y1]), P([x1, y0])];
          return { x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
        });
    },
    inside(g) {
      fixtures.forEach((f, i) => {
        const room = f.type === "prop" ? roomOf(f) : null;
        if (room && room.cell.z === deck) planProp(group(g, i), P, f, room.cell);
      });
    },
  };
}

/** A ship room's name, fitted to its box clear of its props (fitLabel), a halo where it must go over them. */
function shipName(g, c, props) {
  const box = { x0: c.cx - c.w / 2, y0: c.cy - c.h / 2, x1: c.cx + c.w / 2, y1: c.cy + c.h / 2 };
  const name = c.room.name && c.room.name !== "?" ? c.room.name : "?";
  const fit = fitLabel(name, box, props);
  const halo = fit.halo ? { stroke: PLATE, "stroke-width": 3, "stroke-linejoin": "round", "paint-order": "stroke" } : {};
  for (const l of fit.lines) label(g, l.x, l.y, l.text, +fit.size.toFixed(1), { opacity: c.room.closed ? 0.6 : 1, ...halo });
}

/** A drive bell out of the hull's aft end at its side: a throat flaring to its mouth, and the mouth's rim. */
function planBell(g, P, f, tail) {
  const t = f.r * 0.3;
  const [y0, y1] = [tail + 0.03, tail - f.len];
  const [a, b, c, d] = [P([f.side - t, y0]), P([f.side - t, tail - f.len * 0.45]), P([f.side - f.r, y1]), P([f.side + f.r, y1])];
  const [e, h] = [P([f.side + t, tail - f.len * 0.45]), P([f.side + t, y0])];
  el("path", { d: `M${a}Q${b} ${c}L${d}Q${e} ${h}Z`, fill: PLATE, stroke: HULL_LINE, "stroke-width": 1.6, "stroke-linejoin": "round" }, g);
  el("path", { d: ln([P([f.side - f.r * 0.82, y1 + f.len * 0.12]), P([f.side + f.r * 0.82, y1 + f.len * 0.12])]), stroke: EDGE, "stroke-width": 1.2 }, g);
}

/** The mining laser boom out of the nose at its side: rod, crossbar, the emitter's diamond, and the tip with its prongs. */
function planBoom(g, P, f, nose) {
  const at = (dx, dy) => P([f.side + dx * f.len, nose + dy * f.len]);
  const s = { stroke: HULL_LINE, "stroke-width": 1.8, fill: "none", "stroke-linecap": "round" };
  el("path", { d: ln([at(0, -0.06), at(0, 0.64)]), ...s }, g);
  el("path", { d: ln([at(-0.11, 0.28), at(0.11, 0.28)]), ...s }, g);
  el("path", { d: `${ln([at(0, 0.6), at(0.11, 0.74), at(0, 0.88), at(-0.11, 0.74)])}Z`, ...s, fill: PLATE }, g);
  el("path", { d: `${ln([at(0, 0.93), at(0, 1)])}${ln([at(-0.11, 0.95), at(-0.07, 0.9)])}${ln([at(0.11, 0.95), at(0.07, 0.9)])}`, ...s }, g);
}

/** The collar's ring where its room's wall meets the hull: a way out to it, the ring, and its two yellow chevrons pointing out. */
function planRing(g, P, f, room, [hx, hy]) {
  const [dx, dy] = WALL[f.wall];
  const [along, out] = [0.4, 0.12]; // the ring's length along the hull and how far it stands out, in cells
  const ends = dx ? [P([hx - 0.02 * dx, hy + along / 2]), P([hx + out * dx, hy - along / 2])] : [P([hx + along / 2, hy - 0.02 * dy]), P([hx - along / 2, hy + out * dy])];
  const [x0, x1] = [Math.min(ends[0][0], ends[1][0]), Math.max(ends[0][0], ends[1][0])];
  const [y0, y1] = [Math.min(ends[0][1], ends[1][1]), Math.max(ends[0][1], ends[1][1])];
  // the way out, from the room's box to the hull, as a passage bar
  const [px, py] = P([hx, hy]);
  if (dx) {
    const from = room.cx + (dx * room.w) / 2;
    el("rect", { x: Math.min(from, px), y: py - 8, width: Math.abs(px - from), height: 16, fill: PASSAGE }, g);
  } else {
    const from = room.cy - (dy * room.h) / 2;
    el("rect", { x: px - 8, y: Math.min(from, py), width: 16, height: Math.abs(py - from), fill: PASSAGE }, g);
  }
  el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 3, fill: FIXTURE, stroke: HULL_LINE, "stroke-width": 1.6 }, g);
  const c = { stroke: CHEVRON, "stroke-width": 1.8, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
  const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2];
  const s = 3.4;
  for (const k of [-1, 1]) {
    if (dx) {
      const y = my + k * (y1 - y0) * 0.24;
      el("path", { d: ln([[mx - dx * s, y - s], [mx + dx * s, y], [mx - dx * s, y + s]]), ...c }, g);
    } else {
      const x = mx + k * (x1 - x0) * 0.24;
      el("path", { d: ln([[x - s, my + dy * s], [x, my - dy * s], [x + s, my + dy * s]]), ...c }, g);
    }
  }
}

/** A prop in a room, plan only: one, or its grid of them, centred on the room's cell plus `at`. */
function planProp(g, P, f, cell) {
  for (const [x0, y0, x1, y1] of propBoxes(f, { side: cell.x, frame: cell.y })) {
    const [a, b] = [P([x0, y1]), P([x1, y0])]; // the plan's top left and bottom right: fore is up
    propOne(g, f, a, b);
  }
}

function propOne(g, f, [x0, y0], [x1, y1]) {
  const [W, H] = [x1 - x0, y1 - y0];
  const line = { fill: "none", stroke: DIM, "stroke-width": 1.4, "stroke-linejoin": "round" };
  if (f.kind === "crate") {
    el("rect", { x: x0, y: y0, width: W, height: H, rx: 2, ...line }, g);
    el("path", { d: ln([[x0, y0], [x1, y1]]), ...line }, g);
  } else if (f.kind === "seat") {
    // a cushion and the curve of its back, facing fore
    const d = `M${x0},${y0}h${W}v${H * 0.66}h${-W}Z M${x0},${y0 + H * 0.66}l${W * 0.2},${H * 0.34}h${W * 0.6}l${W * 0.2},${-H * 0.34}`;
    el("path", { d, ...line, stroke: TXT, "stroke-width": 1.3 }, g);
  } else if (f.kind === "core") {
    const bw = W * 0.36;
    el("rect", { x: x0 + (W - bw) / 2, y: y0, width: bw, height: H, rx: 3, ...line }, g);
    const n = f.ribs ?? 7;
    for (let i = 0; i < n; i++) {
      const y = y0 + H * (0.1 + (0.8 * i) / (n - 1));
      el("path", { d: ln([[x0, y], [x1, y]]), ...line }, g);
    }
  } else if (f.kind === "bulkhead") {
    el("path", { d: ln([[x0, y0], [x1, y0]]), stroke: HULL_LINE, "stroke-width": 2 }, g);
  } else if (f.kind === "slot") {
    el("rect", { x: x0, y: y0, width: W, height: H, rx: 3, ...line, stroke: PASSAGE }, g);
    for (const [bx, by] of [[0.15, 0.2], [0.85, 0.2], [0.15, 0.8], [0.85, 0.8]]) el("circle", { cx: x0 + W * bx, cy: y0 + H * by, r: 2.2, fill: PASSAGE }, g);
  } else if (f.kind === "rails") {
    // tie-down rails down both long sides
    for (const [x, s] of [[x0, 1], [x1, -1]]) {
      el("path", { d: ln([[x, y0], [x, y1]]), ...line, opacity: 0.6 }, g);
      for (let i = 1; i < 6; i++) el("path", { d: ln([[x, y0 + (H * i) / 6], [x + s * 7, y0 + (H * i) / 6]]), ...line, opacity: 0.6 }, g);
    }
  }
}
