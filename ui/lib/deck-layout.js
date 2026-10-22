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

// Docks: the spine runs up the page (fore up), port rooms left, starboard right.
export const SN = 120; // spacing along the spine
export const SX = 92; // side room distance from the spine
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
  return { z, length: corridor.length * NODE, stops, rooms };
}

/** Docks plan: spine up the page, Hub at the bottom, Freight Transfer below it. */
export function docksLayout(index) {
  const side = [];
  const spine = [];
  for (const room of index.byId.values()) {
    if (room.z !== 3) continue;
    const m = /^tiss\.spine-(\d+)$/.exec(room.id);
    if (m) spine.push({ n: Number(m[1]), room, cx: 0, cy: Y(room.y), h: SN });
    else if (room.x !== 0 && room.terrain === "room") {
      const sg = Math.sign(room.x);
      side.push({ room, cx: sg * SX, cy: Y(room.y), w: RW, h: DOCK_RH });
    }
  }
  spine.sort((a, b) => a.n - b.n);
  const top = spine.length ? spine[spine.length - 1].cy : Y(5);
  const bearing = index.byId.get("tiss.bearing");
  const transfer = index.byId.get("tiss.transfer");
  const blister = index.byId.get("tiss.blister");
  return {
    z: 3,
    rooms: side,
    hub: { room: index.byId.get("tiss.hub"), cx: 0, cy: Y(0), r: HUB_R },
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
  if (id === "tiss.hub") return { kind: "circle", cx: layout.hub.cx, cy: layout.hub.cy, r: layout.hub.r };
  if (id === "tiss.transfer") return rectAround(layout.transfer);
  if (id === "tiss.bearing") return rect(-BEARING.w / 2, layout.bearing.cy - BEARING.h / 2, BEARING.w, BEARING.h, 6);
  if (id === "tiss.blister") {
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
export function fitWidth(extent, aspect, pad = 1.15) {
  const w = Math.max(extent.w, extent.h / aspect) * pad;
  return Math.min(MAX_W, Math.max(MIN_W, w));
}
