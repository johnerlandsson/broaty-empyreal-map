// Orrin Station: the model's faces and the deck plan's layout, for a small outpost of one drum.
// Same station frame as T.I.S.S.'s (X = 3 o'clock, Y = 12 o'clock, Z = fore along the axis), so
// the one camera and renderer draw both. Pure; no DOM.

import { DISTRICT_COLOURS, P3, roll } from "./geometry.js";

// --- the model -------------------------------------------------------------------------------

export const DRUM_R = 176;
export const HUB_R = 34;
// Band edges along the axis: aft rim | Freight Office | the hall | Exchange | fore rim.
export const BANDS = [-125, -85, -35, 35, 85, 125];
const FACETS = 24; // half an hour each, so a room's hour spans two
const CAP_MID = 105; // the end caps are split in two rings so the faces stay small
const GALLERY = { r: 48, len: 26 };
const AXLE = { r: 30, len: 22 };

/** Each room's tint, as its kind of room is tinted on T.I.S.S. */
export const TINTS = {
  "orrin.concourse": DISTRICT_COLOURS.industrial, // foundry orange
  "orrin.market": DISTRICT_COLOURS.concourse,
  "orrin.freight": DISTRICT_COLOURS.industrial,
  "orrin.berth": DISTRICT_COLOURS.docks,
  "orrin.charts": DISTRICT_COLOURS.docks,
  "orrin.gallery": DISTRICT_COLOURS.docks,
};

/**
 * The drum, the Gallery's window collar at the fore end of the axis, the axle aft, and the
 * cradles outside the Berths. Every face turns with the drum and is culled when it faces away
 * (`cull`); a cradle is also hidden while its foot is on the far side (`anchor`). `layer` draws
 * the axle under the drum and the cradles and Gallery over it.
 * @param {ReturnType<typeof import("./locate.js").indexStation>} index
 */
export function buildOrrinModel(index) {
  const faces = [];
  const add = (pts, kind, key, extra) =>
    faces.push({
      pts,
      kind,
      key,
      tint: key ? (TINTS[key] ?? null) : null,
      edges: pts.map(() => true),
      turns: true,
      cull: true,
      layer: 0,
      ...extra,
    });

  // which room sits at (hour, band); the Gallery is on the axis, not the drum
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
  prism(GALLERY.r, Z1, Z1 + GALLERY.len, 12, "blister", "orrin.gallery", 2);
  prism(AXLE.r, Z0 - AXLE.len, Z0, 8, "hub", null, -1);

  // Cradles: blocks standing out from the hull beside the Berths, big ones for ore tugs and drop
  // cans and a small one for skiffs at the end. [hour offset, z, half-width, height, half-length]
  const berth = index.byId.get("orrin.berth");
  if (berth && Number.isFinite(berth.hour)) {
    const cradles = [
      [-0.22, -14, 16, 30, 15],
      [0.12, -14, 16, 30, 15],
      [0.36, 16, 8, 16, 9],
    ];
    for (const [dh, z, hx, hy, hz] of cradles) {
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
export function orrinKey(where) {
  return where?.kind === "room" ? where.id : null;
}

/** The hour the drum turns to the camera for this place, or null (the Gallery is on the axis). */
export function orrinHour(index, where) {
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
export const STAIR = { x: 96, r: 13 };
export const GALLERY_R = 40;

/**
 * @returns {{boxes: {room: object, cx: number, cy: number, w: number, h: number}[],
 *   hall: object|null, gallery: {room: object|undefined, cx: number, cy: number, r: number},
 *   stair: {cx: number, cy: number, r: number}}}
 */
export function orrinLayout(index) {
  const get = (id) => index.byId.get(id);
  const ns = HALL.h / 2 + GAP + ROOM.h / 2; // hall centre to the Exchange's or Freight's
  const place = {
    "orrin.concourse": { cx: 0, cy: 0, ...HALL },
    "orrin.market": { cx: 0, cy: -ns, ...ROOM },
    "orrin.freight": { cx: 0, cy: ns, ...ROOM },
    "orrin.charts": { cx: -(HALL.w / 2 + PASS + ROOM.w / 2), cy: 0, ...ROOM },
    "orrin.berth": { cx: HALL.w / 2 + PASS + BERTH.w / 2, cy: 0, ...BERTH },
  };
  const boxes = [];
  for (const [id, p] of Object.entries(place)) {
    const room = get(id);
    if (room) boxes.push({ room, ...p });
  }
  return {
    boxes,
    hall: boxes.find((b) => b.room.id === "orrin.concourse") ?? null,
    gallery: { room: get("orrin.gallery"), cx: STAIR.x, cy: -(ns + ROOM.h / 2 + 20 + GALLERY_R), r: GALLERY_R },
    stair: { cx: STAIR.x, cy: 0, r: STAIR.r },
  };
}

/** The glowing shape for the player's place on the plan, or null. */
export function orrinShape(layout, where) {
  if (!layout || where?.kind !== "room") return null;
  if (where.id === "orrin.gallery") {
    const { cx, cy, r } = layout.gallery;
    return { kind: "circle", cx, cy, r };
  }
  const b = layout.boxes.find((x) => x.room.id === where.id);
  return b ? { kind: "rect", x: b.cx - b.w / 2, y: b.cy - b.h / 2, width: b.w, height: b.h, rx: 5 } : null;
}
