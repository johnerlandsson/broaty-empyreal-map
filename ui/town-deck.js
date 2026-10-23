// A town's plan (Zennor): looking down at the ground, not a deck. No stars and no plate: bare
// earth, the old windbreak wall in stone round the town with an arch at its gate, the buildings as
// room boxes on stone footings, and the open rooms (street, square, path) as packed earth with a
// dashed edge, named in Dim. The landing field sits in its blast walls, the terraces step down
// each held up by a dry stone wall, and the overlook is up the ridge path's switchbacks. Layout
// maths lives in lib/town.js.

import { DISTRICT_COLOURS as DC } from "./lib/geometry.js";
import { townLayout, townShape } from "./lib/town.js";
import { el } from "./lib/svg.js";
import { DIM, PLATE, hover, label, roomBox } from "./deck-view.js";

// style guide §4.2, Towns
const GROUND = "#110e0b";
const EARTH = "#1c1814";
const STONE = "#4b4338";
const FIELD = PLATE; // fused grey stone
const GREEN = DC.hydroponics;
const NONE = { "pointer-events": "none" };

/**
 * @param {typeof import("./lib/town.js").TOWNS.zennor} spec
 * @returns {(svg: SVGElement, index: object) => object[]} the plans builder DeckView takes: one plan
 */
export function townPlans(spec) {
  return (svg, index) => [buildTownPlan(svg, index, spec)];
}

function buildTownPlan(svg, index, spec) {
  const layout = townLayout(index, spec);
  const { boxes, links, wall, labels, bounds } = layout;
  const g = el("g", { display: "none" }, svg);
  // the ground covers the stars the view draws under every plan
  el("rect", { x: -4000, y: -3000, width: 8000, height: 6000, fill: GROUND }, g);

  // open ground: every street, path and the square as one surface, its outer edge dashed. The
  // edges go down first and the earth over them, so where two pieces meet there's no seam.
  const open = [];
  for (const l of links) if (l.kind === "street" || l.kind === "path") open.push({ ...l, rx: 0 });
  for (const b of boxes) {
    if (b.kind === "street" || b.kind === "path") open.push({ x: b.cx - b.w / 2, y: b.cy - b.h / 2, width: b.w, height: b.h, rx: 2 });
    if (b.kind === "square") open.push({ x: b.cx - b.w / 2, y: b.cy - b.h / 2, width: b.w, height: b.h, rx: 10 });
  }
  const rect = (r, attrs) => el("rect", { x: r.x, y: r.y, width: r.width, height: r.height, rx: r.rx ?? 0, ...attrs, ...NONE }, g);
  for (const r of open) rect(r, { fill: "none", stroke: STONE, "stroke-width": 2, "stroke-dasharray": "4 3" });
  for (const r of open) rect(r, { fill: EARTH });
  // doors into buildings and tracks out to the terraces: earth, no edge
  for (const l of links) if (l.kind === "door" || l.kind === "track") rect(l, { fill: EARTH });

  for (const b of boxes) if (spec.wells?.includes(b.room.id)) el("circle", { cx: b.cx, cy: b.cy + 16, r: 6, fill: GROUND, stroke: STONE, "stroke-width": 1.4, ...NONE }, g);

  if (wall) drawWall(g, wall);

  // climbs: switchbacks up from a path, then a dashed line marked "up"
  for (const l of links) {
    if (l.kind !== "climb") continue;
    const lowFirst = l.lower === l.a;
    const [x1, y1, x2, y2] = lowFirst ? [l.x1, l.y1, l.x2, l.y2] : [l.x2, l.y2, l.x1, l.y1];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
    let start = [x1, y1];
    if (layoutKind(layout, l.lower) === "path" && len > 80) {
      const n = 5;
      const step = 48 / n;
      const pts = [[x1, y1]];
      for (let i = 1; i <= n; i++) {
        const side = i === n ? 0 : i % 2 ? -8 : 8;
        pts.push([x1 + ux * step * i - uy * side, y1 + uy * step * i + ux * side]);
      }
      el("path", { d: `M${pts.map((p) => p.join(",")).join("L")}`, stroke: STONE, "stroke-width": 2, fill: "none", "stroke-linejoin": "round", ...NONE }, g);
      start = pts[n];
    }
    el("path", { d: `M${start.join(",")}L${x2},${y2}`, stroke: DIM, "stroke-width": 1.5, "stroke-dasharray": "4 4", fill: "none", ...NONE }, g);
    label(g, (start[0] + x2) / 2, (start[1] + y2) / 2 - 9, l.dir === "up" || l.dir === "down" ? "up" : "", 9, { fill: DIM });
  }

  for (const b of boxes) {
    const r = { x: b.cx - b.w / 2, y: b.cy - b.h / 2, width: b.w, height: b.h };
    if (b.kind === "building") {
      el("rect", { x: r.x - 4, y: r.y - 4, width: b.w + 8, height: b.h + 8, rx: 6, fill: STONE, ...NONE }, g);
      el("rect", { ...r, rx: 5, fill: GROUND, ...NONE }, g);
      roomBox(g, b.room, b.cx, b.cy, spec.tints[b.room.id] ?? DC.industrial, b.w, b.h);
    } else if (b.kind === "field") field(g, b);
    else if (b.kind === "terraces" || b.kind === "old-terraces") terraces(g, b, b.kind === "old-terraces");
    else if (b.kind === "overlook") overlook(g, b);
    else if (b.kind === "square") label(g, b.cx, b.cy - 8, b.room.name, 12);
    if (b.kind !== "building") hit(g, townShape(layout, { kind: "room", id: b.room.id }), b.room);
  }

  for (const t of labels) {
    t.lines.forEach((s, i) =>
      label(g, t.x, t.y + (i - (t.lines.length - 1) / 2) * 13, s, 11, { fill: DIM, "text-anchor": t.anchor }),
    );
  }

  label(g, bounds.x0 + 14, bounds.y0 + 14, "N ▲", 10, { fill: DIM, "text-anchor": "start", "letter-spacing": 1 });

  const hl = el("g", NONE, g);
  return {
    z: 0,
    g,
    hl,
    layout,
    ring: false,
    length: 0,
    home: layout.home,
    extent: layout.extent,
    offsets: [0],
    margin: 0.35,
    shape: (where) => townShape(layout, where),
  };
}

function layoutKind(layout, id) {
  return layout.byId.get(id)?.kind ?? null;
}

/** A transparent copy of a room's lit shape, for its tooltip. */
function hit(g, shape, room) {
  if (!shape) return;
  const attrs = { fill: "transparent" };
  const node =
    shape.kind === "circle"
      ? el("circle", { cx: shape.cx, cy: shape.cy, r: shape.r, ...attrs }, g)
      : shape.kind === "path"
        ? el("path", { d: shape.d, ...attrs }, g)
        : el("rect", { x: shape.x, y: shape.y, width: shape.width, height: shape.height, ...attrs }, g);
  hover(node, room);
}

/** The windbreak wall: a rounded rectangle in stone, open where the ways out go, an arch at the gate. */
function drawWall(g, w) {
  const { x0, y0, x1, y1, r } = w;
  // each side's run, corner to corner, cut by its gaps
  const sides = {
    north: { from: x0 + r, to: x1 - r, at: (s, e) => `M${s},${y0}H${e}` },
    south: { from: x0 + r, to: x1 - r, at: (s, e) => `M${s},${y1}H${e}` },
    west: { from: y0 + r, to: y1 - r, at: (s, e) => `M${x0},${s}V${e}` },
    east: { from: y0 + r, to: y1 - r, at: (s, e) => `M${x1},${s}V${e}` },
  };
  let d = "";
  for (const [side, run] of Object.entries(sides)) {
    const cuts = w.gaps.filter((p) => p.side === side).sort((a, b) => a.at - b.at);
    let s = run.from;
    for (const c of cuts) {
      if (c.at - c.half > s) d += run.at(s, c.at - c.half);
      s = Math.max(s, c.at + c.half);
    }
    if (run.to > s) d += run.at(s, run.to);
  }
  d += `M${x0},${y0 + r}A${r},${r} 0 0 1 ${x0 + r},${y0}M${x1 - r},${y0}A${r},${r} 0 0 1 ${x1},${y0 + r}`;
  d += `M${x1},${y1 - r}A${r},${r} 0 0 1 ${x1 - r},${y1}M${x0 + r},${y1}A${r},${r} 0 0 1 ${x0},${y1 - r}`;
  el("path", { d, stroke: STONE, "stroke-width": 5, fill: "none", "stroke-linecap": "round", ...NONE }, g);
  for (const c of w.gaps) {
    if (!c.gate) continue;
    const [cx, cy, rot] = {
      north: [c.at, y0, 0],
      south: [c.at, y1, 180],
      west: [x0, c.at, -90],
      east: [x1, c.at, 90],
    }[c.side];
    const k = c.half - 4;
    el("path", { d: `M${-k},3v-6a${k},${k} 0 0 1 ${2 * k},0v6`, transform: `translate(${cx} ${cy}) rotate(${rot})`, stroke: STONE, "stroke-width": 3, fill: "none", ...NONE }, g);
  }
}

/** The landing field: fused stone in its blast walls, three scorched pads. */
function field(g, b) {
  el("rect", { x: b.cx - b.w / 2, y: b.cy - b.h / 2, width: b.w, height: b.h, rx: 8, fill: FIELD, stroke: STONE, "stroke-width": 4, ...NONE }, g);
  for (const dx of [-38, 0, 38]) {
    el("circle", { cx: b.cx + dx, cy: b.cy - 14, r: 13, fill: "#0e131a", stroke: DIM, "stroke-width": 1.2, ...NONE }, g);
    el("circle", { cx: b.cx + dx, cy: b.cy - 14, r: 5, fill: "none", stroke: DIM, "stroke-width": 1, "stroke-dasharray": "2 2", ...NONE }, g);
  }
  label(g, b.cx, b.cy + 22, b.room.name, 12);
}

/** A terrace: green rows, its dry stone wall along the downhill (south) edge; an old one slumped. */
function terraces(g, b, old) {
  const x = b.cx - b.w / 2;
  const y = b.cy - b.h / 2;
  el("rect", { x, y, width: b.w, height: b.h, rx: 3, fill: GREEN, "fill-opacity": old ? 0.1 : 0.16, stroke: GREEN, "stroke-opacity": 0.75, "stroke-width": 1.4, ...NONE }, g);
  el("path", { d: `M${x},${y + b.h}H${x + b.w}`, stroke: STONE, "stroke-width": 4, ...NONE }, g);
  const n = old ? 3 : 5;
  const x0 = x + 8;
  const span = b.w - 16;
  for (let i = 1; i <= n; i++) {
    const ry = y + (i * b.h) / (n + 1);
    const d = old ? `M${x0},${ry}q${span / 4},-3 ${span / 2},0t${span / 2},0` : `M${x0},${ry}H${x0 + span}`;
    el("path", { d, stroke: GREEN, "stroke-opacity": 0.55, "stroke-width": 1.2, fill: "none", ...NONE }, g);
  }
  el("rect", { x: b.cx - 58, y: b.cy - 9, width: 116, height: 18, rx: 3, fill: GROUND, opacity: 0.85, ...NONE }, g);
  label(g, b.cx, b.cy, b.room.name, 12);
}

/** The overlook: a bare round top, its stone bench with its back to the wind (north). */
function overlook(g, b) {
  const r = b.w / 2;
  el("circle", { cx: b.cx, cy: b.cy, r, fill: STONE, "fill-opacity": 0.1, stroke: STONE, "stroke-opacity": 0.9, "stroke-width": 1.4, ...NONE }, g);
  el("rect", { x: b.cx - 12, y: b.cy - r + 10, width: 24, height: 5, rx: 2, fill: DIM, opacity: 0.7, ...NONE }, g);
  const words = b.room.name.split(" ");
  const lines = b.room.name.length > 10 && words.length > 1 ? [words.slice(0, -1).join(" "), words.at(-1)] : [b.room.name];
  lines.forEach((s, i) => label(g, b.cx, b.cy + 4 + (i - (lines.length - 1) / 2) * 13, s, 11));
}
