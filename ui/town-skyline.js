// Draws Zennor's skyline (ui/lib/skyline.js) into the town's top band, under its sky
// (town-view.js): still and low-poly, in the models' Tones, its layers far to near. Once the sky
// is dark, lamps are lit in its windows ("By night it's lamps, from the river to the ridges on
// both sides", the Overlook).

import { TERRACES, groundAt, project, terraceFlats } from "./lib/skyline.js";
import { el, rng } from "./lib/svg.js";

const TONES = ["#3a4556", "#58667b", "#7e8da3"];
const FAR = ["#232b37", "#2e3846", "#3b4757"]; // the city up the valley from the terraces, further off
const EDGE = "#0d1218";
const GLASS = "#cfe3ff";
const LAMP = "#ffd98a"; // the stations' portholes' warm light
const KILN = "#e8925a"; // the dusk glow's
const CROPS = "#4caf7a"; // hydroponics' green, for the terraces' rows
const HORIZON = 52;

/** Draw a skylineFor() result into g, replacing what's there. */
export function drawSkyline(g, layers, { lamps = false } = {}) {
  g.replaceChildren();
  // the ice cap, far up the valley to the north, "a bright line where the sky starts"
  el("path", { d: `M-1500,${HORIZON}H1500`, stroke: GLASS, "stroke-opacity": 0.4, "stroke-width": 1.4 }, g);
  for (const layer of layers) drawLayer(g, layer, lamps);
}

function drawLayer(g, layer, lamps) {
  const { section } = layer;
  const tones = layer.far ? FAR : TONES;
  const P = (x, h) => project(layer, x, h).map((n) => +n.toFixed(1));
  const at = (x, h) => P(x, h).join(",");
  const path = (pts) => pts.map(([x, h]) => at(x, h)).join("L");
  const s = layer.size;
  const face = (d, fill, extra) => el("path", { d, fill, stroke: EDGE, "stroke-width": layer.far ? 0.8 : 1.1, "stroke-linejoin": "round", ...extra }, g);

  if (section.ridge) {
    const [x0] = P(section.ridge[0][0], 0), [x1] = P(section.ridge[section.ridge.length - 1][0], 0);
    face(`M${path(section.ridge)}L${x1},400L${x0},400Z`, layer.far ? "#1a2029" : "#212833");
  }
  const land = section.land;
  face(`M${path(land)}L${P(land[land.length - 1][0], 0)[0]},900L${P(land[0][0], 0)[0]},900Z`, tones[0]);
  if (section.scarp) {
    const [a, b] = section.scarp;
    const top = land.filter(([x]) => x >= a && x <= b);
    face(`M${path(top)}L${at(b, groundAt(land, b) - 22)}L${at(a + 12, groundAt(land, a))}Z`, tones[1]);
    // the Downs' top, lit, on to the horizon east
    el("path", { d: `M${path(land.filter(([x]) => x >= b))}`, fill: "none", stroke: tones[2], "stroke-width": 1.6 }, g);
  }
  const [r0, r1] = section.river;
  el("path", { d: `M${at(r0, 0)}H${P(r1, 0)[0]}`, stroke: GLASS, "stroke-opacity": 0.55, "stroke-width": 2 * s }, g);

  if (section.tram) {
    const { from, to } = section.tram;
    const rail = [];
    for (let x = from; x <= to; x += 6) rail.push([x, groundAt(land, x) + 1.5]);
    el("path", { d: `M${path(rail)}`, fill: "none", stroke: tones[2], "stroke-width": 0.9 * s, "stroke-dasharray": `${2 * s} ${s}` }, g);
  }
  if (section === TERRACES) terraces(g, layer, P);

  section.props.forEach((p, i) => prop(g, P, s, land, p, tones, lamps ? rng(101 + i) : null));

  if (section.tram) {
    const { car } = section.tram;
    const [cx, cy] = P(car, groundAt(land, car) + 2);
    face(`M${cx - 5 * s},${cy}l${10 * s},${-3 * s}v${-5 * s}l${-10 * s},${3 * s}Z`, tones[2]);
  }
}

/** The terraces' rows, low and dark against the soil, and each one's leat along its top edge. */
function terraces(g, layer, P) {
  const s = layer.size;
  for (const [x0, x1, h] of terraceFlats()) {
    const [a, y] = P(x0, h), [b] = P(x1, h);
    el("path", { d: `M${a + 2},${y - 1.2 * s}H${b - 3}`, stroke: CROPS, "stroke-opacity": 0.5, "stroke-width": 1.6 * s, "stroke-dasharray": `${1.2 * s} ${0.8 * s}` }, g);
    el("circle", { cx: b - 1, cy: y - 0.6 * s, r: 0.9 * s, fill: GLASS, opacity: 0.6 }, g);
  }
}

/** One thing standing on the land: [x, kind, w, h]. `lamp` a seeded generator once it's dark. */
function prop(g, P, s, land, [x, kind, w, h], tones, lamp) {
  const base = Math.min(groundAt(land, x), groundAt(land, x + w));
  const [x0, bot] = P(x, base - 3);
  const [x1, top] = P(x + w, base + h);
  const W = x1 - x0;
  const face = (d, fill) => el("path", { d, fill, stroke: EDGE, "stroke-width": 1.1, "stroke-linejoin": "round" }, g);
  const depth = 3 * s;
  // a front face, its end in shadow, the roof in the light
  const box = (btop) => {
    face(`M${x0},${bot}V${btop}H${x1}V${bot}Z`, tones[1]);
    face(`M${x1},${bot}V${btop}l${depth},${-depth / 2}V${bot}Z`, tones[0]);
    face(`M${x0},${btop}l${depth},${-depth / 2}H${x1 + depth}l${-depth},${depth / 2}Z`, tones[2]);
  };
  const lamps = (btop, n) => {
    if (!lamp) return;
    for (let i = 0; i < n; i++) {
      const on = lamp() < 0.55, lx = x0 + lamp() * W, ly = btop + 2 * s + lamp() * Math.max(0, bot - btop - 4 * s), o = 0.35 + lamp() * 0.5;
      if (on) el("circle", { cx: lx, cy: ly, r: 0.7 * s + 0.3, fill: LAMP, opacity: o }, g);
    }
  };
  switch (kind) {
    case "block":
      box(top);
      lamps(top, 2);
      break;
    case "tenement":
      box(top);
      lamps(top, 5);
      break;
    case "barn":
      box(top + 3 * s);
      face(`M${x0},${top + 3 * s}L${x0 + W / 2},${top - s}L${x1},${top + 3 * s}Z`, tones[2]);
      lamps(top + 3 * s, 1);
      break;
    case "mill": // its wheel in the race
      box(top);
      el("circle", { cx: x0 + W * 0.2, cy: bot - 2 * s, r: 3 * s, fill: "none", stroke: tones[2], "stroke-width": 0.8 }, g);
      lamps(top, 3);
      break;
    case "chimney":
      face(`M${x0},${bot}V${top}h${2.5 * s}V${bot}Z`, tones[1]);
      break;
    case "kiln": // "The kilns never go out"
      face(`M${x0},${bot}L${x0 + W * 0.25},${top}h${W * 0.5}L${x1},${bot}Z`, tones[1]);
      el("circle", { cx: x0 + W / 2, cy: top, r: 1.6 * s, fill: KILN, opacity: 0.7 }, g);
      break;
    case "columns": // a building of state, pedimented, columned
      box(top);
      face(`M${x0 - s},${top}L${x0 + W / 2},${top - 4 * s}L${x1 + s},${top}Z`, tones[2]);
      for (let c = x0 + 2 * s; c < x1 - s; c += 3 * s) el("path", { d: `M${c},${top + s}V${bot}`, stroke: EDGE, "stroke-width": 0.7 }, g);
      break;
    case "tree": // whitewashed trunk
      el("path", { d: `M${x0},${bot}V${top + 3 * s}`, stroke: "#c9c2b4", "stroke-width": 0.9 * s }, g);
      el("circle", { cx: x0, cy: top + 2 * s, r: 2.8 * s, fill: tones[0], stroke: EDGE, "stroke-width": 0.8 }, g);
      break;
    case "vault": { // the Corn Exchange: "a vaulted roof of glass and iron"
      const vt = top + 5 * s;
      box(vt);
      face(`M${x0},${vt}A${W / 2},${5 * s} 0 0 1 ${x1},${vt}Z`, tones[2]);
      el("path", { d: `M${x0 + 1},${vt}A${W / 2 - 1},${5 * s - 1} 0 0 1 ${x1 - 1},${vt}`, fill: "none", stroke: GLASS, "stroke-width": 1, "stroke-opacity": 0.75 }, g);
      lamps(vt, 4);
      break;
    }
    case "pannier": { // the Pannier Market's iron roof
      const pt = top + 2 * s;
      box(pt);
      el("path", { d: `M${x0},${pt}l${W / 4},${-2 * s}l${W / 4},${2 * s}l${W / 4},${-2 * s}l${W / 4},${2 * s}`, fill: "none", stroke: tones[2], "stroke-width": 0.9 }, g);
      break;
    }
    case "hall": // the Tinners' Hall
      box(top + 3 * s);
      face(`M${x0},${top + 3 * s}L${x0 + W / 2},${top - s}L${x1},${top + 3 * s}Z`, tones[2]);
      lamps(top + 3 * s, 2);
      break;
    case "arch": // the Field Gate, with no gate in it
      face(`M${x0},${bot}V${top}H${x1}V${bot}H${x0 + W * 0.75}V${top + W * 0.35}A${W * 0.25},${W * 0.25} 0 0 0 ${x0 + W * 0.25},${top + W * 0.35}V${bot}Z`, tones[2]);
      break;
    case "bridge": { // its deck at h, its arches over the river
      const [bx0, by] = P(x, h), [bx1] = P(x + w, h);
      const n = 5, aw = (bx1 - bx0) / n;
      let d = `M${bx0},${by}H${bx1}V${by + 1.5 * s}`;
      for (let i = n; i > 0; i--) d += `H${bx0 + i * aw - 0.6 * s}A${aw / 2 - 0.6 * s},${4 * s} 0 0 0 ${bx0 + (i - 1) * aw + 0.6 * s},${by + 1.5 * s}`;
      face(d + "Z", tones[1]);
      break;
    }
    case "winding": // the tram's winding house and its great cable wheel
      box(top);
      el("circle", { cx: x0 + W / 2, cy: top - 2 * s, r: 5 * s, fill: "none", stroke: tones[2], "stroke-width": 1.1 }, g);
      break;
    case "wall": // a blast wall round the field
      el("path", { d: `M${x0},${bot - 1}V${top}H${x1}V${bot - 1}`, fill: "none", stroke: tones[2], "stroke-width": 1.4 }, g);
      break;
    case "tower": // the Port Office's squat tower and its controllers' glass room
      box(top);
      el("path", { d: `M${x0},${top}H${x1}`, stroke: GLASS, "stroke-width": 2.6 * s, "stroke-opacity": 0.8 }, g);
      lamps(top, 2);
      break;
    case "tank": // a fuel tank half sunk in the ground
      face(`M${x0},${bot - 1}A${W / 2},${bot - top || 3} 0 0 1 ${x1},${bot - 1}Z`, tones[1]);
      break;
    case "mast":
      el("path", { d: `M${x0},${bot}V${top}M${x0 - 2 * s},${top + 3 * s}h${4 * s}`, stroke: tones[2], "stroke-width": 0.9 }, g);
      break;
  }
}
