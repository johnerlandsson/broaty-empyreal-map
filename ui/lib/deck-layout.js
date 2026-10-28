// Pure layout for the deck plans: where every stop, room and docks part sits in plan coordinates.
// No DOM; safe to load as a browser ES module and in vitest.

import { STEP, ang } from "./geometry.js";

// Rings: the corridor runs left to right (spinward right), fore rooms above, aft below.
export const NODE = 150; // distance between corridor stops
export const CH = 15; // corridor half-height
export const RW = 116; // room box width
export const RH = 58; // room box height
export const GAP = 9; // gap between room boxes
export const HULLY = 175; // hull wall distance from the corridor centre line
export const JUT_PAD = 22; // a jut's wall stands this far outside the rooms it takes in
const JUT_R = 10; // the radius of a jut's outer corners

// Docks: the spine runs up the page (fore up), port rooms left, starboard right.
export const SN = 120; // spacing along the spine
export const SX = 92; // side room distance from the spine
export const SXSTEP = 142; // each room further out (|x| > 1, as T.I.S.S.'s bays) is one box and a passage beyond
export const DOCK_RH = 54; // docks side room height
export const HUB_R = 58;
export const BEARING = { w: 68, h: 28 };
export const TRANSFER = { w: 140, h: 46 };
export const BLISTER_R = 46;
export const BLISTER_BASE = 36; // the dome's flat edge sits this far above the spine stop

const Y = (y) => -y * SN || 0; // `|| 0` keeps -0 out
const isLadderway = (room) => room.terrain === "ladderway" || String(room.id).includes("ladderway");

/** The y of a ring room box centre: fore (y > 0) is up. */
function boxCy(y) {
  const d = CH + GAP + (Math.abs(y) - 1) * (RH + GAP) + RH / 2;
  return y > 0 ? -d : d;
}

/**
 * @returns {{z:number, length:number,
 *   stops:{id:string,x:number,cx:number,hour:number,lobby:boolean}[],
 *   rooms:{room:object,cx:number,cy:number,w:number,h:number,door:{x:number,y:number,w:number,h:number}}[]}}
 */
export function ringLayout(index, z) {
  const corridor = index.corridors[z] ?? [];
  const cxOf = (x) => (x / STEP[z]) * NODE;
  const stops = corridor.map((r) => ({
    id: r.id,
    x: r.x,
    cx: cxOf(r.x),
    hour: r.x / 2,
    lobby: r.terrain === "lobby",
  }));
  const rooms = [];
  for (const room of index.byId.values()) {
    if (room.z !== z || room.y === 0 || isLadderway(room)) continue;
    if (room.terrain === "corridor" || room.terrain === "lobby") continue;
    const cx = cxOf(room.x);
    const cy = boxCy(room.y);
    // the little passage joining the box to the room nearer the corridor
    const near = Math.sign(-room.y) * (Math.abs(cy) - RH / 2);
    const from = Math.sign(-room.y) * (Math.abs(room.y) === 1 ? CH : Math.abs(cy) - RH / 2 - GAP);
    rooms.push({
      room,
      cx,
      cy,
      w: RW,
      h: RH,
      door: { x: cx - 8, y: Math.min(from, near), w: 16, h: Math.abs(near - from) },
    });
  }
  return { z, length: corridor.length * NODE, stops, rooms, juts: juts(rooms) };
}

/**
 * Where a ring's hull juts out: a stop whose rooms reach nearer the wall than its pad, fore or
 * aft (T.I.S.S.'s Old Shops, seven deep off Inner 7:30), as {cx, side, reach, w}: side -1 fore
 * (up), 1 aft; reach the wall's distance from the corridor; w its width, the box and a pad each side.
 */
function juts(rooms) {
  const out = new Map();
  for (const b of rooms) {
    const side = Math.sign(b.cy);
    const reach = Math.abs(b.cy) + b.h / 2 + JUT_PAD;
    if (reach <= HULLY) continue;
    const key = `${b.cx}:${side}`;
    if ((out.get(key)?.reach ?? 0) < reach) out.set(key, { cx: b.cx, side, reach, w: RW + 2 * JUT_PAD });
  }
  return [...out.values()].sort((a, b) => a.side - b.side || a.cx - b.cx);
}

/**
 * One lap's hull wall on one side, x from -NODE/2 to length - NODE/2, as an SVG path: along the
 * wall at HULLY, out round each jut (its outer corners rounded) and back. Juts of the laps either
 * side count, so a jut at the seam carries on across it. Juts that meet merge, the wall at the
 * deeper's reach where they overlap.
 */
export function hullWall(layout, side) {
  const { length: L } = layout;
  const x0 = -NODE / 2;
  const x1 = L - NODE / 2;
  const mine = layout.juts
    .filter((j) => j.side === side)
    .flatMap((j) => [-L, 0, L].map((off) => ({ a: j.cx + off - j.w / 2, b: j.cx + off + j.w / 2, reach: j.reach })))
    .filter((j) => j.b > x0 && j.a < x1);
  // the wall's distance at each stretch between breakpoints, as runs of one depth
  const xs = [...new Set([x0, x1, ...mine.flatMap((j) => [j.a, j.b])])].filter((x) => x >= x0 && x <= x1).sort((a, b) => a - b);
  const runs = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const mid = (xs[i] + xs[i + 1]) / 2;
    const d = Math.max(HULLY, ...mine.filter((j) => j.a <= mid && mid <= j.b).map((j) => j.reach));
    if (runs.length && runs[runs.length - 1].d === d) runs[runs.length - 1].b = xs[i + 1];
    else runs.push({ a: xs[i], b: xs[i + 1], d });
  }
  const y = (d) => +(side * d).toFixed(2);
  // a corner rounds where the wall turns outward round it (a jut's outer corners), never where it turns in
  let d = `M${x0},${y(runs[0].d)}`;
  runs.forEach((run, i) => {
    const prev = runs[i - 1]?.d ?? run.d;
    const next = runs[i + 1]?.d ?? run.d;
    const r = Math.min(JUT_R, (run.b - run.a) / 2);
    const inR = prev < run.d ? Math.min(r, run.d - prev) : 0;
    const outR = next < run.d ? Math.min(r, run.d - next) : 0;
    if (prev !== run.d) {
      d += `V${y(run.d - inR * Math.sign(run.d - prev))}`;
      if (inR) d += `Q${run.a},${y(run.d)} ${run.a + inR},${y(run.d)}`;
    }
    d += `H${run.b - outR}`;
    if (outR) d += `Q${run.b},${y(run.d)} ${run.b},${y(run.d - outR)}`;
  });
  return d;
}

/** Docks plan: spine up the page, Hub at the bottom, Freight Transfer below it. */
export function docksLayout(index) {
  const { roles } = index;
  const side = [];
  const spine = roles.spine.map((id, i) => {
    const room = index.byId.get(id);
    return { n: i + 1, room, cx: 0, cy: Y(room.y), h: SN };
  });
  const onSpine = new Set(roles.spine);
  for (const room of index.byId.values()) {
    if (room.z !== 3 || onSpine.has(room.id)) continue;
    if (room.x !== 0 && room.terrain === "room") {
      const sg = Math.sign(room.x);
      const cx = sg * (SX + (Math.abs(room.x) - 1) * SXSTEP);
      // its passage runs in from the spine, or from the room before it
      const from = Math.abs(room.x) === 1 ? sg * CH : cx - sg * (SXSTEP - RW / 2);
      side.push({ room, cx, cy: Y(room.y), w: RW, h: DOCK_RH, from });
    }
  }
  const top = spine.length ? spine[spine.length - 1].cy : Y(5);
  const bearing = index.byId.get(roles.bearing);
  const transfer = index.byId.get(roles.transfer);
  const blister = index.byId.get(roles.blister);
  return {
    z: 3,
    rooms: side,
    hub: { room: index.byId.get(roles.hub), cx: 0, cy: Y(0), r: HUB_R },
    bearing: { room: bearing, cx: 0, cy: Y(1), ...BEARING },
    spine,
    blister: { room: blister, cx: 0, cy: top - BLISTER_BASE, r: BLISTER_R },
    transfer: { room: transfer, cx: 0, cy: Y(-1) + 12, ...TRANSFER },
  };
}

/** Where on the Hub circle the lift door for a clock hour sits. */
export function hubDoor(layout, hour) {
  return {
    cx: layout.hub.cx + HUB_R * Math.sin(ang(hour)),
    cy: layout.hub.cy - HUB_R * Math.cos(ang(hour)),
  };
}

const rect = (x, y, width, height, rx = 5) => ({ kind: "rect", x, y, width, height, rx });
const rectAround = (b) => rect(b.cx - b.w / 2, b.cy - b.h / 2, b.w, b.h, 5);

function ringShape(layout, where) {
  const lobbyAt = (hour) => layout.stops.find((s) => s.lobby && s.hour === hour % 12);
  if (where.kind === "lift") {
    const stop = lobbyAt(where.hour);
    return stop ? { kind: "circle", cx: stop.cx, cy: 0, r: 15 } : null;
  }
  if (where.kind !== "room") return null;
  if (String(where.id).includes("ladderway")) {
    // ladderway x is hour*2+1; the lobby of that hour sits at x-1
    const stop = layout.stops.find((s) => s.lobby && s.x === where.x - 1) ?? lobbyAt((where.x - 1) / 2);
    return stop ? rect(stop.cx + 27 - 9, -9, 18, 18, 2) : null;
  }
  const box = layout.rooms.find((r) => r.room.id === where.id);
  if (box) return rectAround(box);
  const stop = layout.stops.find((s) => s.id === where.id) ?? layout.stops.find((s) => s.x === where.x);
  return stop ? rect(stop.cx - NODE / 2, -CH, NODE, 2 * CH, 4) : null;
}

function docksShape(layout, where) {
  if (where.kind === "lift") {
    const d = hubDoor(layout, where.hour);
    return { kind: "circle", cx: d.cx, cy: d.cy, r: 15 };
  }
  if (where.kind !== "room") return null;
  const id = where.id;
  const is = (part) => part.room && part.room.id === id;
  if (is(layout.hub)) return { kind: "circle", cx: layout.hub.cx, cy: layout.hub.cy, r: layout.hub.r };
  if (is(layout.transfer)) return rectAround(layout.transfer);
  if (is(layout.bearing)) return rect(-BEARING.w / 2, layout.bearing.cy - BEARING.h / 2, BEARING.w, BEARING.h, 6);
  if (is(layout.blister)) {
    const { cx, cy, r } = layout.blister;
    return { kind: "path", d: `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy} Z`, cx, cy: cy - r / 2 };
  }
  const spine = layout.spine.find((s) => s.room.id === id);
  if (spine) return rect(-CH, spine.cy - spine.h / 2, 2 * CH, spine.h, 4);
  const box = layout.rooms.find((r) => r.room.id === id);
  return box ? rectAround(box) : null;
}

/** The glowing shape for the player's position, in plan coordinates, or null. */
export function highlightShape(layout, where) {
  if (!layout || !where || typeof where !== "object") return null;
  return layout.hub ? docksShape(layout, where) : ringShape(layout, where);
}


/** A stable key for "this level, this highlight", so repeated frames can be told apart from real moves. */
export function shapeKey(level, shape) {
  return shape ? `${level}:${JSON.stringify(shape)}` : `${level}:none`;
}

export const MIN_W = 280; // zoom limits, as viewBox widths
export const MAX_W = 1600;

/** The viewBox width that shows a whole extent, padded, in a band of `aspect` (height / width). */
export function fitWidth(extent, aspect, pad = 1.15, maxW = MAX_W) {
  const w = Math.max(extent.w, extent.h / aspect) * pad;
  return Math.min(maxW, Math.max(MIN_W, w));
}
