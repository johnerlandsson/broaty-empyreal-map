// Ships off the generated hull index (ui/data/ships.js): which rooms are aboard, a hull's entry and
// plan, and the caption and info line. Pure and DOM-free.

import ships, { plans } from "../data/ships.js";

// a hull with no entry draws as the one-cell skiff look
const GENERIC = { id: "generic", name: "ship", class: null, plan: "hull-skiff" };

/** Whether a room id is aboard a ship: anything starting "ship.". */
export function isShipRoom(id) {
  return typeof id === "string" && id.startsWith("ship.");
}

/** The room's key in its ship ("ship.42.hold" is "hold"); null for the ship's own id or a room ashore. */
export function shipKey(roomId) {
  if (!isShipRoom(roomId)) return null;
  const key = roomId.split(".").slice(2).join(".");
  return key || null;
}

/** The hull's index entry {id, name, class, plan}; an unknown hull gets the generic one. */
export function hullFor(id) {
  return typeof id === "string" && Object.hasOwn(ships.hulls, id) ? ships.hulls[id] : GENERIC;
}

/** The generated plan data for a hull id. */
export function planFor(id) {
  return plans[hullFor(id).plan];
}

const text = (v) => (typeof v === "string" && v !== "" ? v : "");

/** The caption under the hull: "Mule · prospecting skiff", whichever of the two is known. */
export function shipCaption(msg) {
  return [text(msg?.areaName), text(msg?.hullName)].filter(Boolean).join(" · ");
}

/** The info line aboard: "COCKPIT OF THE MULE · prospecting skiff", whichever of the two is known. */
export function shipInfo(msg) {
  return [text(msg?.name).toUpperCase(), text(msg?.hullName)].filter(Boolean).join(" · ");
}
