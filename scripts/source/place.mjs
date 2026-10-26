// Places an area's raw rooms on its layout, as the server's layout.ts does: a wheel's by
// placeWheel, decks' by their cells, and none's not at all.
import { parseAddress } from "../../ui/lib/decks.js";
import { partGravity, placeWheel } from "./wheel.mjs";

/** Whether a room is a lift car (layout.ts:156-157): a spoke's by address, or one content declares. */
function isCar(room, wheelAddress) {
  return !!room.car || wheelAddress?.part === "lift";
}

/**
 * Each room with its `at` (decks: {deck, frame, side}; wheel: {x, y, z}), a wheel's with its
 * `terrain`, and every one with its `gravity`. Rooms are copied, not changed.
 * @param {object} area  the YAML's `area:` block
 * @param {object[]} rooms  the area's rooms as loadSource reads them, `off:` and all
 * @param {Record<string, {x: number, y: number, z: number}>} place  where to put rooms the layout
 *   doesn't, by local id (`transfer` for `tiss.transfer`)
 * @returns {{rooms: object[], unplaced: string[]}}  rooms: those placed, lift cars and, without a
 *   layout, all; unplaced: the ids of a layout's rooms left without `at`, lift cars aside
 */
export function placeRooms(area, rooms, place = {}) {
  const layout = area.layout ?? { kind: "none" };
  const local = (id) => id.slice(id.indexOf(".") + 1);
  const wheel = layout.kind === "wheel" ? placeWheel(layout, rooms) : null;
  const unplaced = [];

  const out = [];
  for (const raw of rooms) {
    const room = { ...raw };
    let part;
    if (wheel) {
      const w = wheel.get(raw.id);
      if (w) {
        if (w.at) room.at = w.at;
        room.terrain = w.terrain;
        part = partGravity(layout, w.address); // layout.ts:143
      }
    } else if (layout.kind === "decks") {
      // layout.ts:562: a cell is [beam, frame, deck]; decks have no gravity of their own (:682).
      const cell = parseAddress(raw.address);
      if (cell) room.at = { deck: cell.z, frame: cell.y, side: cell.x };
    }
    // `place` applies only to wheels: decks addresses always parse to a cell. Its {x, y, z} keeps the layout's terrain.
    const key = local(raw.id);
    if (wheel && !room.at && Object.hasOwn(place, key)) {
      const fill = place[key];
      room.at = { x: fill.x, y: fill.y, z: fill.z };
    }
    // A room of a layout the rules can't place stays out of the rooms; a lift car is a car, not unplaced.
    if ((layout.kind === "wheel" || layout.kind === "decks") && !room.at && !isCar(raw, wheel?.get(raw.id)?.address)) {
      unplaced.push(raw.id);
      continue;
    }
    // Its own gravity, else its part's, else its area's.
    room.gravity = raw.gravity ?? part ?? area.gravity;
    out.push(room);
  }
  return { rooms: out, unplaced };
}
