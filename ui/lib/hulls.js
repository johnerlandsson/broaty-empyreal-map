// The ship hulls: the top-down drawings of the ship you're aboard, as data. Sources are
// content/game/hulls.yaml in ~/dev/empyreal (which hull a ship has) and the approved mockup
// docs/maps/reference/ship-plans-mockup.html (the coordinates). Each hull is drawn in the mockup's
// 200 × 300 box, fore up, centre x 100; toPlan() turns that into plan coordinates centred on 0, 0.
// Compartments and fixtures are drawings only: no text, no hover, never lit. Pure; no DOM.

// --- the drawings ----------------------------------------------------------------------------

/** One drawn element: an SVG tag and its attributes (geometry, and only the overrides the drawing needs). */
const part = (tag, attrs) => ({ tag, attrs });
const path = (d, sw) => part("path", { d, "stroke-width": sw });
const line = (x1, y1, x2, y2, sw) => part("line", { x1, y1, x2, y2, "stroke-width": sw });
const rect = (x, y, width, height, rx, sw) => part("rect", { x, y, width, height, rx, "stroke-width": sw });

/** A hold crate: a box with its diagonal. */
const crate = (x, y, w, h, rx, sw) => [rect(x, y, w, h, rx, sw), path(`M${x},${y} L${x + w},${y + h}`, sw)];

const SLOT = "#56657a";
const bolt = (cx, cy) => part("circle", { cx, cy, r: 1.2, fill: SLOT, stroke: SLOT, "stroke-width": 1.1 });

/**
 * The hull specs, keyed by id. `outline` is the hull's SVG path; `rooms` the boxes you can be in
 * (the cockpit first); `compartments` the Dim line drawings; `fixtures` the Text ones drawn inside
 * rooms (the courier's seats); `box` the bounding box [x0, y0, x1, y1] of everything drawn.
 */
export const HULLS = {
  // The prospecting skiff: a squat hull with a mining laser boom, six hold crates and three engine bells.
  skiff: {
    id: "skiff",
    outline: "M60,60 Q100,50 140,60 L160,110 L160,215 L140,230 L60,230 L40,215 L40,110 Z",
    rooms: [{ key: "cockpit", name: "Cockpit", shape: { kind: "rect", x: 58, y: 70, width: 84, height: 58, rx: 6 } }],
    compartments: [
      // boom
      line(100, 60, 100, 24, 1.4),
      line(94, 44, 106, 44, 1.4),
      path("M100,10 L106,18 L100,26 L94,18 Z", 1.4),
      line(100, 2, 100, 6, 1.4),
      line(94, 5, 96, 8, 1.4),
      line(106, 5, 104, 8, 1.4),
      // hold
      ...[145, 176].flatMap((y) =>
        [64, 89.5, 115].flatMap((x) => crate(x, y, 21, 25, 1.5, 1.2)),
      ),
      // bells
      { tag: "path", attrs: { d: "M74,231 Q74,240 67,253 L85,253 Q78,240 78,231 Z", fill: "none", "stroke-width": 1.3 } },
      { tag: "path", attrs: { d: "M98,231 Q98,242 90,257 L110,257 Q102,242 102,231 Z", fill: "none", "stroke-width": 1.3 } },
      { tag: "path", attrs: { d: "M122,231 Q122,240 115,253 L133,253 Q126,240 126,231 Z", fill: "none", "stroke-width": 1.3 } },
    ],
    fixtures: [],
    box: [40, 2, 160, 257],
  },
  // The courier: a long narrow hull, two seats, a bulkhead, two crates, a bolted-over empty slot,
  // the drive core with its coil ribs and two engine bells.
  courier: {
    id: "courier",
    outline: "M100,15 Q122,40 122,70 L122,255 L112,266 L88,266 L78,255 L78,70 Q78,40 100,15 Z",
    rooms: [{ key: "cockpit", name: "Cockpit", shape: { kind: "rect", x: 84, y: 40, width: 32, height: 56, rx: 8 } }],
    compartments: [
      // bulkhead, in the hull colour
      part("line", { x1: 80, y1: 102, x2: 120, y2: 102, stroke: "#9fb0c3", "stroke-width": 1.2 }),
      // hold
      ...crate(87, 110, 12, 22, 1.5, 1.2),
      ...crate(101, 110, 12, 22, 1.5, 1.2),
      // empty slot under a bolted cover plate, in Passage
      part("rect", { x: 88, y: 141, width: 24, height: 18, rx: 2, stroke: SLOT, "stroke-width": 1.1 }),
      bolt(91.5, 144.5),
      bolt(108.5, 144.5),
      bolt(91.5, 155.5),
      bolt(108.5, 155.5),
      // drive core and coil ribs
      rect(95, 168, 10, 82, 3, 1.2),
      path("M86,176 h28 M86,186 h28 M86,196 h28 M86,206 h28 M86,216 h28 M86,226 h28 M86,236 h28", 1.2),
      // bells
      { tag: "path", attrs: { d: "M91,267 Q91,276 85,286 L99,286 Q94,276 94,267 Z", fill: "none", "stroke-width": 1.3 } },
      { tag: "path", attrs: { d: "M106,267 Q106,276 101,286 L115,286 Q109,276 109,267 Z", fill: "none", "stroke-width": 1.3 } },
    ],
    fixtures: [
      path("M94,52 h12 v8 h-12 z M94,60 l2,4 h8 l2,-4", 1.2),
      path("M94,74 h12 v8 h-12 z M94,82 l2,4 h8 l2,-4", 1.2),
    ],
    box: [78, 15, 122, 286],
  },
  // Any other ship: a plain hull with a cockpit and nothing else drawn.
  generic: {
    id: "generic",
    outline: "M100,40 Q130,40 130,90 L130,240 Q130,260 100,260 Q70,260 70,240 L70,90 Q70,40 100,40 Z",
    rooms: [{ key: "cockpit", name: "Cockpit", shape: { kind: "rect", x: 78, y: 60, width: 44, height: 50, rx: 8 } }],
    compartments: [],
    fixtures: [],
    box: [70, 40, 130, 260],
  },
};

// --- geometry --------------------------------------------------------------------------------

/** Plan units per mockup unit. */
export const SCALE = 1.6;

/** Room left under the hull for its caption, in plan units: enough that, framed on 0, 0, the
 * caption clears the info line in the band's bottom corner. */
const CAPTION_H = 48;

/** Mockup coordinates to plan coordinates, centring the ship's 200 × 300 box on 0, 0. */
export function toPlan([x, y]) {
  return [(x - 100) * SCALE, (y - 150) * SCALE];
}

/** The hull spec for a hull id; anything but "skiff" or "courier" gets the generic ship. */
export function hullOf(id) {
  return id === "skiff" || id === "courier" ? HULLS[id] : HULLS.generic;
}

/** Whether a room id is aboard a ship: anything starting "ship.". */
export function isShipRoom(id) {
  return typeof id === "string" && id.startsWith("ship.");
}

/** The room with that key, else the first, as a rect in plan coordinates. */
export function shipShape(spec, key = null) {
  const room = spec.rooms.find((r) => r.key === key) ?? spec.rooms[0];
  const s = room.shape;
  const [x, y] = toPlan([s.x, s.y]);
  return { kind: "rect", x, y, width: s.width * SCALE, height: s.height * SCALE, rx: s.rx * SCALE };
}

/** The plan-coordinate size of the hull with its boom, bells and caption, to fit the band. */
export function hullExtent(spec) {
  const [x0, y0, x1, y1] = spec.box;
  return { w: (x1 - x0) * SCALE, h: (y1 - y0) * SCALE + CAPTION_H };
}

// --- captions --------------------------------------------------------------------------------

const text = (v) => (typeof v === "string" && v !== "" ? v : "");

/** The caption under the hull: "Mule · prospecting skiff", whichever of the two is known. */
export function shipCaption(msg) {
  return [text(msg?.areaName), text(msg?.hullName)].filter(Boolean).join(" · ");
}

/** The info line aboard: "COCKPIT OF THE MULE · prospecting skiff", whichever of the two is known. */
export function shipInfo(msg) {
  return [text(msg?.name).toUpperCase(), text(msg?.hullName)].filter(Boolean).join(" · ");
}
