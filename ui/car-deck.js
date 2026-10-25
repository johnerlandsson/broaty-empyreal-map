// The car you're riding, in the bottom band in place of the station's or the city's plan, as a
// one-room ship is shown: a T.I.S.S. spoke lift's square car, or Zennor's tram, the long wooden
// car of its description (its floor stepped in three, slatted benches down both sides, a brake
// wheel at each end, the brass panel by the doors). The car is its one room, lit. Under it, what
// it's doing in Dim, and the line of its stops with the car on it, its heading an arrow; its
// doors are drawn open or shut. Layout and words are lib/cars.js.

import { CARS, carDoing, stopLine } from "./lib/cars.js";
import { el } from "./lib/svg.js";
import { DIM, TXT, label } from "./deck-view.js";

const HULL = "#9fb0c3"; // the hull line, as a ship's
const FIX = "#0e131a"; // fixture fill
const GLASS = "#cfe3ff";
const WOOD = "#8a6a46"; // the tram's benches
const BRASS = "#d9a441";
const HL = "#ffb347";
const BG = "#04060c";
const LINE_W = 280; // the line of stops
const NONE = { "pointer-events": "none" };

/**
 * @param {"lift"|"tram"} kind
 * @returns {(svg: SVGElement) => object[]} the plans builder DeckView takes: the one plan
 */
export function carPlans(kind) {
  return (svg) => [buildCarPlan(svg, kind)];
}

/** Draw what the car's doing, where it is on its line, and its doors. */
export function updateCar(view, lift, names) {
  const plan = view.plans[0];
  plan.caption.textContent = carDoing(lift, names);
  plan.name.textContent = plan.carName;
  for (const d of plan.doors) d.setAttribute("display", lift?.doors === "open" ? "none" : "");

  const g = plan.line;
  g.replaceChildren();
  const { stops, car } = stopLine(lift, names, LINE_W);
  if (!stops.length) return;
  const y = plan.lineY;
  el("path", { d: `M${stops[0].x},${y}H${stops.at(-1).x}`, stroke: DIM, "stroke-width": 2, ...NONE }, g);
  for (const s of stops) {
    el("circle", { cx: s.x, cy: y, r: 5, fill: BG, stroke: DIM, "stroke-width": 2, ...NONE }, g);
    label(g, s.x, y + 17, s.name, 10, { fill: DIM });
  }
  if (!car) return;
  const m = el("g", { transform: `translate(${car.x} ${y})`, filter: view.glow, ...NONE }, g);
  el("rect", { x: -15, y: -7, width: 30, height: 14, rx: 6, fill: HL, "fill-opacity": 0.35, stroke: HL, "stroke-width": 2.5 }, m);
  if (car.dir) el("path", { d: `M${car.dir * 19},-5l${car.dir * 8},5l${-car.dir * 8},5Z`, fill: HL }, m);
}

/** Set the car's name, the game's or the plan's, for updateCar to draw. */
export function nameCar(view, name) {
  view.plans[0].carName = name;
}

function buildCarPlan(svg, kind) {
  const spec = CARS[kind] ?? CARS.lift;
  const g = el("g", { display: "none" }, svg);
  const { w, h } = spec;
  const x = -w / 2;
  const y = -h / 2;

  el("rect", { x: x - 6, y: y - 6, width: w + 12, height: h + 12, rx: kind === "tram" ? 14 : 12, fill: BG, stroke: HULL, "stroke-width": 2, ...NONE }, g);
  el("rect", { x, y, width: w, height: h, rx: 10, fill: HL, "fill-opacity": 0.06, stroke: DIM, "stroke-width": 1.4, ...NONE }, g);
  // the doors: a gap in the hull on the platform (south) side, its two leaves meeting across it
  // while they're shut
  const doors = [];
  const door = (cx, half) => {
    el("rect", { x: cx - half, y: y + h + 1, width: 2 * half, height: 10, fill: BG, ...NONE }, g);
    doors.push(el("path", { d: `M${cx - half},${y + h + 6}h${half - 1}M${cx + 1},${y + h + 6}h${half - 1}`, stroke: GLASS, "stroke-width": 2, ...NONE }, g));
  };

  if (kind === "tram") {
    // the floor stepped in three, to sit level on the slope
    for (const i of [1, 2]) el("path", { d: `M${x + (i * w) / 3},${y + 4}V${y + h - 4}`, stroke: DIM, "stroke-width": 1.2, "stroke-dasharray": "3 3", ...NONE }, g);
    // slatted benches down both sides, a run a step
    for (const by of [y + 10, y + h - 22]) {
      for (let i = 0; i < 3; i++) {
        const bx = x + 22 + (i * w) / 3;
        const bw = w / 3 - 44;
        el("rect", { x: bx, y: by, width: bw, height: 12, rx: 2, fill: FIX, stroke: WOOD, "stroke-width": 1.3, ...NONE }, g);
        let d = "";
        for (let k = 1; k < 6; k++) d += `M${bx + (k * bw) / 6},${by}v12`;
        el("path", { d, stroke: WOOD, "stroke-width": 0.8, ...NONE }, g);
      }
    }
    // a brake wheel at each end
    for (const ex of [x + 12, x + w - 12]) {
      el("circle", { cx: ex, cy: 0, r: 9, fill: FIX, stroke: HULL, "stroke-width": 1.4, ...NONE }, g);
      el("path", { d: `M${ex - 9},0h18M${ex},-9v18`, stroke: HULL, "stroke-width": 1, ...NONE }, g);
    }
    // the brass panel by the doors, a button a stop
    el("rect", { x: -10, y: y + h - 18, width: 20, height: 12, rx: 2, fill: FIX, stroke: BRASS, "stroke-width": 1.2, ...NONE }, g);
    for (let k = 0; k < 4; k++) el("circle", { cx: -6 + k * 4, cy: y + h - 12, r: 1.3, fill: BRASS, ...NONE }, g);
    door(x + w / 3, 16);
    door(x + (2 * w) / 3, 16);
  } else {
    // the panel beside the doors
    el("rect", { x: x + w - 22, y: y + h - 40, width: 12, height: 28, rx: 2, fill: FIX, stroke: HULL, "stroke-width": 1.2, ...NONE }, g);
    for (let k = 0; k < 4; k++) el("circle", { cx: x + w - 16, cy: y + h - 34 + k * 6, r: 1.4, fill: HULL, ...NONE }, g);
    door(0, 26);
  }

  const name = label(g, 0, 0, spec.name, 13, { fill: TXT });
  const caption = label(g, 0, y + h + 26, "", 11, { fill: DIM });
  const line = el("g", NONE, g);
  const lineY = y + h + 66;

  const hl = el("g", NONE, g);
  const room = { x, y, width: w, height: h, rx: 10 };
  return {
    z: 0,
    g,
    hl,
    ring: false,
    length: 0,
    offsets: [0],
    home: [0, (y - 6 + lineY + 24) / 2],
    margin: 0.5,
    extent: { w: Math.max(w + 12, LINE_W + 60), h: lineY + 24 - (y - 6) },
    shape: () => ({ kind: "rect", ...room }),
    caption,
    name,
    carName: spec.name,
    doors,
    line,
    lineY,
  };
}
