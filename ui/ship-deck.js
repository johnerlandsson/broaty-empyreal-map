// The ship plan: a top-down drawing of the ship you're aboard, fore up, in the bottom band in place
// of the station's deck plan. The hull outline, its compartments (Dim line drawings: no text, no
// hover, never lit), the Passage bars of the ways between rooms, its rooms as room boxes, and
// fixtures inside rooms (seats, the hold's rails).
// The drawings are data in lib/hulls.js, in the mockup's 200 × 300 box; they're drawn here in a
// group scaled to plan units, with the labels outside it so the text isn't scaled.

import { SCALE, hullExtent, shipCaption, shipShape, toPlan } from "./lib/hulls.js";
import { el } from "./lib/svg.js";
import { DIM, TXT, label, roomBox } from "./deck-view.js";

const HULL = "#9fb0c3";
const BG = "#04060c";
const ROOM_FONT = 12;
const CAPTION_FONT = 10;
const NOTE_FONT = 9;

/**
 * @param {typeof import("./lib/hulls.js").HULLS.skiff} spec
 * @returns {(svg: SVGElement, index: object) => object[]} the plans builder DeckView takes: the one
 *   plan, framed whole by its extent
 */
export function shipPlans(spec) {
  return (svg) => [buildShipPlan(svg, spec)];
}

/**
 * Put the game's name for the room you're in on its hover (the others keep the drawing's), the
 * ship's name and class under the hull, and your note on her under those (`msg.note`: the Lua side
 * sends it only aboard your own ship). The room is `msg.shipRoom`'s, else the first, as lit.
 */
export function updateShip(view, msg) {
  const plan = view.plans[0];
  plan.caption.textContent = shipCaption(msg);
  plan.note.textContent = typeof msg?.note === "string" ? msg.note : "";
  const here = plan.rooms.find((r) => r.key === msg?.shipRoom) ?? plan.rooms[0];
  const name = typeof msg?.name === "string" && msg.name !== "" ? msg.name : null;
  for (const room of plan.rooms) room.name = (room === here && name) || room.short;
}

/** One drawn part, with the drawing's defaults where the part doesn't set its own. */
function drawPart(parent, { tag, attrs }, stroke) {
  el(tag, { fill: "none", stroke, "pointer-events": "none", ...attrs }, parent);
}

function buildShipPlan(svg, spec) {
  const g = el("g", { display: "none" }, svg);
  const s = el("g", { transform: `scale(${SCALE}) translate(-100 -150)` }, g);

  el("path", { d: spec.outline, fill: BG, stroke: HULL, "stroke-width": 1.6, "pointer-events": "none" }, s);
  for (const p of spec.compartments) drawPart(s, p, DIM);
  for (const p of spec.passages ?? []) drawPart(s, p, "none");

  // the rooms: Dim room boxes, their names drawn below in plan units; hover on the box only
  const rooms = spec.rooms.map((r) => {
    const room = { name: r.name, short: r.name, key: r.key };
    const { x, y, width, height, rx } = r.shape;
    const box = roomBox(s, room, x + width / 2, y + height / 2, DIM, width, height);
    for (const t of box.querySelectorAll("text")) t.remove();
    // the box's corners and line as the drawing has them, in plan units after the scale
    box.querySelector("rect")?.setAttribute("rx", rx);
    box.querySelector("rect")?.setAttribute("stroke-width", 1.6 / SCALE);
    return room;
  });

  for (const p of spec.fixtures) drawPart(s, p, TXT);

  for (const r of spec.rooms) {
    const [x, y] = labelAt(r);
    label(g, x, y, r.name, ROOM_FONT);
  }

  const [x0, , x1, y1] = spec.box;
  const [cx, bottom] = toPlan([(x0 + x1) / 2, y1]);
  const caption = label(g, cx, bottom + 11, "", CAPTION_FONT, { fill: DIM });
  const note = label(g, cx, bottom + 24, "", NOTE_FONT, { fill: DIM, "font-style": "italic" });

  const hl = el("g", { "pointer-events": "none" }, g);
  return {
    z: 0,
    g,
    hl,
    ring: false,
    length: 0,
    offsets: [0],
    home: [0, 0],
    margin: 0.5,
    extent: hullExtent(spec),
    shape: (where) => shipShape(spec, where?.room),
    caption,
    note,
    rooms,
  };
}

/**
 * Where a room's name goes, in plan coordinates: at the drawing's `labelY` if it has one; else the
 * room's centre, or, for a `labelTop` room (fixtures drawn under its name, as the courier's seats),
 * the room's top quarter, or just above the room if the name doesn't fit there.
 */
function labelAt(r) {
  const { x, y, width, height } = r.shape;
  const [px, py] = toPlan([x + width / 2, y]);
  const w = width * SCALE;
  const h = height * SCALE;
  if (r.labelY !== undefined) return [px, toPlan([0, r.labelY])[1]];
  if (!r.labelTop) return [px, py + h / 2];
  const quarter = h / 4;
  const textW = r.name.length * ROOM_FONT * 0.55;
  if (quarter >= ROOM_FONT + 2 && textW <= w - 4) return [px, py + quarter / 2 + 1];
  return [px, py - ROOM_FONT / 2 - 3];
}
