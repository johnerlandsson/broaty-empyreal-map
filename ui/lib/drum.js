// The drum stations, Orrin Station and Wenna Halt: the model's faces and the deck plan's layout,
// for a small outpost of one drum. Both have the same six rooms off a hall round the drum, so one
// spec per station says what differs. Same station frame as T.I.S.S.'s (X = 3 o'clock, Y = 12
// o'clock, Z = fore along the axis), so the one camera and renderer draw them all. Pure; no DOM.

import { DISTRICT_COLOURS, P3, roll } from "./geometry.js";

// --- the stations ----------------------------------------------------------------------------

/**
 * What differs between the drums. `prefix` is the rooms' id prefix ("orrin.berth"); `axis` the
 * room up at the axis and the size of its window collar; `cradles` the blocks outside the Berths,
 * each [hour offset, z, half-width, height, half-length]; `way` how you go up to the axis room.
 */
export const DRUMS = {
  // A foundry port: everything painted the same orange, big cradles for ore tugs and drop cans and
  // a small one for skiffs, and a spiral stair up to a gallery of windows all round.
  orrin: {
    prefix: "orrin",
    axis: { id: "orrin.gallery", r: 48, len: 26 },
    way: "stair",
    tints: {
      "orrin.concourse": DISTRICT_COLOURS.industrial, // foundry orange
      "orrin.market": DISTRICT_COLOURS.concourse,
      "orrin.freight": DISTRICT_COLOURS.industrial,
      "orrin.berth": DISTRICT_COLOURS.docks,
      "orrin.charts": DISTRICT_COLOURS.docks,
      "orrin.gallery": DISTRICT_COLOURS.docks,
    },
    cradles: [
      [-0.22, -14, 16, 30, 15],
      [0.12, -14, 16, 30, 15],
      [0.36, 16, 8, 16, 9],
    ],
  },
  // An older, better-kept halt: kelp planters in a carpeted hall, a neat office for freight, a
  // clean row of cradles sized for couriers, and a ramp up to a lounge with one wide window.
  wenna: {
    prefix: "wenna",
    axis: { id: "wenna.lounge", r: 58, len: 18 },
    way: "ramp",
    tints: {
      "wenna.concourse": DISTRICT_COLOURS.hydroponics, // the kelp planters
      "wenna.market": DISTRICT_COLOURS.concourse,
      "wenna.freight": DISTRICT_COLOURS.offices,
      "wenna.berth": DISTRICT_COLOURS.docks,
      "wenna.charts": DISTRICT_COLOURS.docks,
      "wenna.lounge": DISTRICT_COLOURS.docks,
    },
    cradles: [
      [-0.3, -12, 8, 20, 11],
      [-0.08, -12, 8, 20, 11],
      [0.14, -12, 8, 20, 11],
      [0.36, -12, 8, 20, 11],
    ],
  },
};

// --- the model -------------------------------------------------------------------------------

export const DRUM_R = 176;
export const HUB_R = 34;
// Band edges along the axis: aft rim | Freight Office | the hall | Exchange | fore rim.
export const BANDS = [-125, -85, -35, 35, 85, 125];
const FACETS = 24; // half an hour each, so a room's hour spans two
const CAP_MID = 105; // the end caps are split in two rings so the faces stay small
const AXLE = { r: 30, len: 22 };

/**
 * The drum, the axis room's window collar at the fore end of the axis, the axle aft, and the
 * cradles outside the Berths. Every face turns with the drum and is culled when it faces away
 * (`cull`); a cradle is also hidden while its foot is on the far side (`anchor`). `layer` draws
 * the axle under the drum and the cradles and the collar over it.
 * @param {ReturnType<typeof import("./locate.js").indexStation>} index
 * @param {typeof DRUMS.orrin} spec
 */
export function buildDrumModel(index, spec) {
  const faces = [];
  const add = (pts, kind, key, extra) =>
    faces.push({
      pts,
      kind,
      key,
      tint: key ? (spec.tints[key] ?? null) : null,
      edges: pts.map(() => true),
      turns: true,
      cull: true,
      layer: 0,
      ...extra,
    });

  // which room sits at (hour, band); the axis room is on the axis, not the drum
  const at = new Map();
  for (const room of index.byId.values()) {
    if (Number.isFinite(room.hour) && Number.isFinite(room.band)) at.set(`${room.hour % 12}:${room.band}`, room.id);
  }

  const Z0 = BANDS[0];
  const Z1 = BANDS[BANDS.length - 1];
  for (let i = 0; i < FACETS; i++) {
    const h0 = (i * 12) / FACETS - 0.5;
    const h1 = h0 + 12 / FACETS;
    const hour = ((Math.round((h0 + h1) / 2) % 12) + 12) % 12;
    for (let b = 0; b < BANDS.length - 1; b++) {
      const z0 = BANDS[b];
      const z1 = BANDS[b + 1];
      const key = at.get(`${hour}:${b - 2}`) ?? null;
      add([P3(DRUM_R, h0, z0), P3(DRUM_R, h0, z1), P3(DRUM_R, h1, z1), P3(DRUM_R, h1, z0)], "outer", key);
    }
    for (const [r0, r1] of [[HUB_R, CAP_MID], [CAP_MID, DRUM_R]]) {
      add([P3(r0, h0, Z1), P3(r0, h1, Z1), P3(r1, h1, Z1), P3(r1, h0, Z1)], "cap", null);
      add([P3(r0, h0, Z0), P3(r1, h0, Z0), P3(r1, h1, Z0), P3(r0, h1, Z0)], "cap", null);
    }
  }

  // A prism on the axis from z0 to z1, its far-from-the-drum end capped.
  const prism = (r, z0, z1, n, kind, key, layer) => {
    const a = (i) => ((i + 0.5) / n) * 12;
    for (let i = 0; i < n; i++) {
      add([P3(r, a(i), z0), P3(r, a(i), z1), P3(r, a(i + 1), z1), P3(r, a(i + 1), z0)], kind, key, { layer });
    }
    const capZ = Math.abs(z1) > Math.abs(z0) ? z1 : z0;
    const ring = Array.from({ length: n }, (_, i) => P3(r, a(i), capZ));
    add(capZ > 0 ? ring.reverse() : ring, `${kind}-cap`, key, { layer });
  };
  prism(spec.axis.r, Z1, Z1 + spec.axis.len, 12, "blister", spec.axis.id, 2);
  prism(AXLE.r, Z0 - AXLE.len, Z0, 8, "hub", null, -1);

  // Cradles: blocks standing out from the hull beside the Berths
  const berth = index.byId.get(`${spec.prefix}.berth`);
  if (berth && Number.isFinite(berth.hour)) {
    for (const [dh, z, hx, hy, hz] of spec.cradles) {
      const h = berth.hour + dh;
      box([0, DRUM_R + hy / 2, z], hx, hy / 2, hz, h, "dock", berth.id, { layer: 1, anchor: roll([0, 1, 0], h) });
    }
  }

  // A box centred on c with half-sizes hx/hy/hz in the frame of hour 0, then rolled to hour h.
  function box(c, hx, hy, hz, h, kind, key, extra) {
    const v = (sx, sy, sz) => roll([c[0] + sx * hx, c[1] + sy * hy, c[2] + sz * hz], h);
    const sides = [
      [v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)],
      [v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1), v(-1, -1, -1)],
      [v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)],
      [v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1)],
      [v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)],
      [v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1), v(-1, -1, -1)],
    ];
    for (const pts of sides) add(pts, kind, key, extra);
  }

  return faces;
}

/** The model face key for the player's place: the room's id, or null off the station. */
export function drumKey(where) {
  return where?.kind === "room" ? where.id : null;
}

/** The hour the drum turns to the camera for this place, or null (the axis room is on the axis). */
export function drumHour(index, where) {
  if (where?.kind !== "room") return null;
  const h = index.byId.get(where.id)?.hour;
  return Number.isFinite(h) ? h : null;
}

// --- the deck plan ---------------------------------------------------------------------------

// West to east across the panel, north (fore) up, as the exits go.
export const HALL = { w: 300, h: 46 };
export const ROOM = { w: 116, h: 58 };
export const BERTH = { w: 64, h: 150 };
export const GAP = 9;
export const PASS = 22; // passage from the hall to a room at either end
export const WAY = { x: 96, r: 13 }; // the foot of the stair or ramp up to the axis room
export const AXIS_R = 40;

/**
 * @param {typeof DRUMS.orrin} spec
 * @returns {{boxes: {room: object, cx: number, cy: number, w: number, h: number}[],
 *   hall: object|null, axis: {room: object|undefined, cx: number, cy: number, r: number},
 *   way: {cx: number, cy: number, r: number}}}
 */
export function drumLayout(index, spec) {
  const id = (name) => `${spec.prefix}.${name}`;
  const ns = HALL.h / 2 + GAP + ROOM.h / 2; // hall centre to the Exchange's or Freight's
  const place = {
    [id("concourse")]: { cx: 0, cy: 0, ...HALL },
    [id("market")]: { cx: 0, cy: -ns, ...ROOM },
    [id("freight")]: { cx: 0, cy: ns, ...ROOM },
    [id("charts")]: { cx: -(HALL.w / 2 + PASS + ROOM.w / 2), cy: 0, ...ROOM },
    [id("berth")]: { cx: HALL.w / 2 + PASS + BERTH.w / 2, cy: 0, ...BERTH },
  };
  const boxes = [];
  for (const [key, p] of Object.entries(place)) {
    const room = index.byId.get(key);
    if (room) boxes.push({ room, ...p });
  }
  return {
    boxes,
    hall: boxes.find((b) => b.room.id === id("concourse")) ?? null,
    axis: { room: index.byId.get(spec.axis.id), cx: WAY.x, cy: -(ns + ROOM.h / 2 + 20 + AXIS_R), r: AXIS_R },
    way: { cx: WAY.x, cy: 0, r: WAY.r },
  };
}

/** The glowing shape for the player's place on the plan, or null. */
export function drumShape(layout, where) {
  if (!layout || where?.kind !== "room") return null;
  if (where.id === layout.axis.room?.id) {
    const { cx, cy, r } = layout.axis;
    return { kind: "circle", cx, cy, r };
  }
  const b = layout.boxes.find((x) => x.room.id === where.id);
  return b ? { kind: "rect", x: b.cx - b.w / 2, y: b.cy - b.h / 2, width: b.w, height: b.h, rx: 5 } : null;
}
