// A town's plan (Zennor): looking down at the ground, not a deck. No stars and no plate: bare
// earth, each district on a faint wash of its colour and named in it, the river along the downhill
// side with its bridge, the scarp the Steps climb, the buildings as room boxes on stone footings,
// and the open rooms (street, square, path) as packed earth with a dashed edge, named in Dim. The
// tram is a line in Glass through its stops; the landing field sits in its blast walls, the
// terraces step down each held up by a dry stone wall, and the overlook is up the ridge path's
// switchbacks. Zoomed out, the rooms' names fade and the districts' stay readable. Layout maths
// lives in lib/town.js.

import { DISTRICT_COLOURS as DC } from "./lib/geometry.js";
import { MAX_W, RIVER, townFrame, townLayout, townShape } from "./lib/town.js";
import { el } from "./lib/svg.js";
import { DIM, PLATE, hover, label, roomBox } from "./deck-view.js";

// style guide §4.2, Towns
const GROUND = "#110e0b";
const EARTH = "#332b22"; // light enough to read on every district's wash
const STONE = "#4b4338";
const WATER = "#22384c";
const GLASS = "#cfe3ff";
const FIELD = PLATE; // fused grey stone
const GREEN = DC.hydroponics;
const WASH = 0.085; // a district's wash
const NONE = { "pointer-events": "none" };
const DASH = { "stroke-dasharray": "4 3" };
const NAME_PX = 10; // a district's name is never smaller than this on screen
const FADE = [5, 6.5]; // a room's 12-unit name fades out between these sizes on screen
const AWAY = 0.45; // zoomed out past this (screen px a unit), districts are named over their middles

/**
 * @param {typeof import("./lib/town.js").TOWNS.zennor} spec
 * @returns {(svg: SVGElement, index: object) => object[]} the plans builder DeckView takes: one plan
 */
export function townPlans(spec) {
  return (svg, index) => [buildTownPlan(svg, index, spec)];
}

function buildTownPlan(svg, index, spec) {
  const layout = townLayout(index, spec);
  const { boxes, links, labels, bounds, districts, river, scarp, gate, tram } = layout;
  const g = el("g", { display: "none" }, svg);
  // the ground covers the stars the view draws under every plan
  el("rect", { x: -6000, y: -4000, width: 12000, height: 8000, fill: GROUND }, g);

  // each district's wash: its cells in its colour, the group faded as one so neighbours don't double
  for (const d of districts) {
    const w = el("g", { fill: d.tint ?? DC.industrial, opacity: WASH, ...NONE }, g);
    for (const c of d.cells) el("rect", { ...c, rx: 6 }, w);
  }

  if (river) {
    el("path", { d: river.d, stroke: WATER, "stroke-width": RIVER.w, fill: "none", "stroke-linecap": "round", ...NONE }, g);
    el("path", { d: river.d, stroke: "#2e4a63", "stroke-width": 1.2, "stroke-dasharray": "10 8", fill: "none", ...NONE }, g);
    hover(el("path", { d: river.d, stroke: "transparent", "stroke-width": RIVER.w, fill: "none" }, g), { name: river.name.replace(/^the /, "The ") });
  }

  if (scarp) {
    let ticks = "";
    for (let y = scarp.y0 + 4; y < scarp.y1; y += 9) ticks += `M${scarp.x},${y}l${scarp.downhill * 7},4`;
    el("path", { d: `M${scarp.x},${scarp.y0}V${scarp.y1}`, stroke: STONE, "stroke-width": 2, ...NONE }, g);
    el("path", { d: ticks, stroke: STONE, "stroke-width": 1.3, ...NONE }, g);
  }

  // open ground: every street, path, square and the garden as one surface, its outer edge dashed.
  // The edges go down first and the earth over them, so where two pieces meet there's no seam.
  const isOpen = (l) => l.kind === "street" || l.kind === "path";
  // a link's band: a straight one's rect, a diagonal one's line its width wide (a little wider
  // under it for the dashed edge, as a rect's edge is its outline)
  const band = (l, fill, edge = false) =>
    l.x1 !== undefined
      ? el("line", { x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, stroke: edge ? STONE : fill, "stroke-width": l.width + (edge ? 4 : 0), ...(edge ? DASH : {}), ...NONE }, g)
      : el("rect", { x: l.x, y: l.y, width: l.width, height: l.height, ...(edge ? { fill: "none", stroke: STONE, "stroke-width": 2, ...DASH } : { fill }), ...NONE }, g);
  const openBoxes = boxes.filter((b) => ["street", "path", "square", "garden"].includes(b.kind));
  const boxRect = (b, attrs) =>
    el("rect", { x: b.cx - b.w / 2, y: b.cy - b.h / 2, width: b.w, height: b.h, rx: b.kind === "square" || b.kind === "garden" ? 10 : 2, ...attrs, ...NONE }, g);
  for (const l of links) if (isOpen(l)) band(l, null, true);
  for (const b of openBoxes) boxRect(b, { fill: "none", stroke: STONE, "stroke-width": 2, ...DASH });
  for (const l of links) if (isOpen(l)) band(l, EARTH);
  for (const b of openBoxes) boxRect(b, { fill: EARTH });
  // doors into buildings and tracks out to the terraces: earth, no edge
  for (const l of links) if (l.kind === "door" || l.kind === "track") band(l, EARTH);
  // the bridge: the way over the river, with a parapet each side
  for (const l of links) {
    if (!l.bridge || l.x1 !== undefined) continue;
    const d = l.width > l.height ? `M${l.x - 14},${l.y}h${l.width + 28}M${l.x - 14},${l.y + l.height}h${l.width + 28}` : `M${l.x},${l.y - 14}v${l.height + 28}M${l.x + l.width},${l.y - 14}v${l.height + 28}`;
    el("path", { d, stroke: STONE, "stroke-width": 2.5, ...NONE }, g);
  }

  for (const b of boxes) if (spec.wells?.includes(b.room.id)) el("circle", { cx: b.cx, cy: b.cy + 16, r: 6, fill: GROUND, stroke: STONE, "stroke-width": 1.4, ...NONE }, g);

  if (tram) {
    el("path", { d: tram.d, stroke: GLASS, "stroke-opacity": 0.75, "stroke-width": 3, fill: "none", "stroke-linejoin": "round", ...NONE }, g);
    const stops = tram.stops.map((id) => layout.byId.get(id)?.room.name.replace(/ Station$/, "")).join(" · ");
    hover(el("path", { d: tram.d, stroke: "transparent", "stroke-width": 12, fill: "none" }, g), { name: tram.name, address: stops });
  }

  for (const l of links) {
    if (l.kind === "steps") steps(g, l);
    else if (l.kind === "climb") climb(g, l, layout);
  }

  if (gate) {
    const k = gate.half - 4;
    const t = `translate(${gate.x} ${gate.y}) rotate(${gate.rot})`;
    // a stub of the old wall either side of the gap, and the arch over it
    el("path", { d: `M${-gate.half - 30},0H${-gate.half}M${gate.half},0H${gate.half + 30}`, transform: t, stroke: STONE, "stroke-width": 5, "stroke-linecap": "round", ...NONE }, g);
    el("path", { d: `M${-k},3v-6a${k},${k} 0 0 1 ${2 * k},0v6`, transform: t, stroke: STONE, "stroke-width": 3, fill: "none", ...NONE }, g);
  }

  const stops = new Set(tram?.stops ?? []);
  for (const b of boxes) {
    const r = { x: b.cx - b.w / 2, y: b.cy - b.h / 2, width: b.w, height: b.h };
    const tint = spec.tints?.[b.room.district] ?? DC.industrial;
    if (b.kind === "building") {
      el("rect", { x: r.x - 4, y: r.y - 4, width: b.w + 8, height: b.h + 8, rx: 6, fill: STONE, ...NONE }, g);
      el("rect", { ...r, rx: 5, fill: GROUND, ...NONE }, g);
      if (stops.has(b.room.id)) el("rect", { x: r.x + 4, y: r.y + 4, width: b.w - 8, height: b.h - 8, rx: 3, fill: "none", stroke: GLASS, "stroke-opacity": 0.35, ...NONE }, g);
      roomBox(g, b.room, b.cx, b.cy, tint, b.w, b.h);
    } else if (b.kind === "field") field(g, b);
    else if (b.kind === "terraces" || b.kind === "old-terraces") terraces(g, b, b.kind === "old-terraces");
    else if (b.kind === "overlook") overlook(g, b);
    else if (b.kind === "square") label(g, b.cx, b.cy - 8, b.room.name, 12);
    else if (b.kind === "garden") garden(g, b);
    if (b.kind !== "building") hit(g, townShape(layout, { kind: "room", id: b.room.id }), b.room);
  }

  for (const t of labels) {
    t.lines.forEach((s, i) =>
      label(g, t.x, t.y + (i - (t.lines.length - 1) / 2) * 13, s, 11, { fill: DIM, "text-anchor": t.anchor }),
    );
  }
  if (river) label(g, river.label.x, river.label.y, river.name, 12, { fill: DIM, "font-style": "italic", "letter-spacing": 3, transform: `rotate(-90 ${river.label.x} ${river.label.y})` });

  // what stays readable however far out: the districts' names, and N ▲ in the corner
  for (const t of g.querySelectorAll("text")) t.style.opacity = "var(--names, 1)";
  // each district's name twice: beside it, and over its middle for far out, a word a line
  const nameAttrs = (d) => ({ fill: d.tint ?? DIM, "fill-opacity": 0.85, "font-weight": 600, "letter-spacing": 2, stroke: GROUND, "stroke-opacity": 0.85, "paint-order": "stroke" });
  const names = districts.map((d) => {
    const near = label(g, d.label.x, d.label.y, d.name.toUpperCase(), 15, nameAttrs(d));
    const far = label(g, d.middle.x, d.middle.y, "", 15, { ...nameAttrs(d), display: "none" });
    const lines = d.name.replace(/^the /i, "").toUpperCase().split(" "); // far out, "MARKET / QUARTER"
    lines.forEach((t, i) => el("tspan", { x: d.middle.x, dy: i ? "1.1em" : `${-0.55 * (lines.length - 1)}em` }, far, t));
    return { near, far };
  });
  const north = label(g, bounds.x0 + 14, bounds.y0 + 14, "N ▲", 10, { fill: DIM, "text-anchor": "start", "letter-spacing": 1 });

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
    maxW: Math.max(MAX_W, layout.extent.w * 1.15),
    offsets: [0],
    margin: 0.35,
    shape: (where) => townShape(layout, where),
    frame: (where) => townFrame(layout, index, where),
    onView: (k, view) => {
      // k is screen pixels a plan unit
      const px = 12 * k;
      g.style.setProperty("--names", String(Math.max(0, Math.min(1, (px - FADE[0]) / (FADE[1] - FADE[0])))));
      const size = Math.max(15, NAME_PX / k);
      const away = k < AWAY;
      for (const { near, far } of names) {
        near.setAttribute("display", away ? "none" : "");
        far.setAttribute("display", away ? "" : "none");
        for (const t of [near, far]) {
          t.setAttribute("font-size", size);
          t.setAttribute("stroke-width", size * 0.35);
        }
      }
      if (view) {
        Object.entries({ x: view[0] + 14 / k, y: view[1] + 14 / k, "font-size": 10 / k }).forEach(([a, v]) => north.setAttribute(a, v));
      }
    },
  };
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

/** The Steps: a flight of stone treads between their two rooms, named, their seconds on hover. */
function steps(g, l) {
  const [x1, x2] = [Math.min(l.x1, l.x2), Math.max(l.x1, l.x2)];
  const y = l.y1;
  const h = 26;
  el("rect", { x: x1, y: y - h / 2, width: x2 - x1, height: h, fill: EARTH, ...NONE }, g);
  const n = Math.max(3, Math.round((x2 - x1) / 7));
  let d = "";
  for (let i = 1; i < n; i++) d += `M${x1 + (i * (x2 - x1)) / n},${y - h / 2}v${h}`;
  el("path", { d, stroke: STONE, "stroke-width": 1.6, ...NONE }, g);
  el("path", { d: `M${x1},${y - h / 2}H${x2}M${x1},${y + h / 2}H${x2}`, stroke: STONE, "stroke-width": 2, ...NONE }, g);
  label(g, (x1 + x2) / 2, y - h / 2 - 9, "the Steps", 11, { fill: DIM });
  const s = l.seconds ?? {};
  const body = [s.down !== undefined && `about ${s.down} s down`, s.up !== undefined && `${s.up} s up`].filter(Boolean).join(", ");
  hover(el("rect", { x: x1, y: y - h / 2, width: x2 - x1, height: h, fill: "transparent" }, g), { name: "The Steps", address: body });
}

/** A climb: switchbacks up from a path, then a dashed line marked "up". */
function climb(g, l, layout) {
  const lowFirst = l.lower === l.a;
  const [x1, y1, x2, y2] = lowFirst ? [l.x1, l.y1, l.x2, l.y2] : [l.x2, l.y2, l.x1, l.y1];
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
  let start = [x1, y1];
  if (layout.byId.get(l.lower)?.kind === "path" && len > 80) {
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

/** The garden: a lawn on the open ground, in green, named on it. */
function garden(g, b) {
  el("rect", { x: b.cx - b.w / 2, y: b.cy - b.h / 2, width: b.w, height: b.h, rx: 10, fill: GREEN, "fill-opacity": 0.16, stroke: GREEN, "stroke-opacity": 0.6, "stroke-width": 1.4, ...NONE }, g);
  const words = b.room.name.split(" ");
  const lines = words.length > 1 ? [words.slice(0, -1).join(" "), words.at(-1)] : [b.room.name];
  lines.forEach((s, i) => label(g, b.cx, b.cy + (i - (lines.length - 1) / 2) * 13, s, 11));
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
