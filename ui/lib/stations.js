// Which station's maps to show: the one whose room you're in (a workshop or bunk is its door's
// station), else the one your ship is docked at, else whichever was showing; none for a station
// there's no plan of. Pure; no DOM.

import places from "../data/places.js";

// A room id's prefix -> its place, and Ship.Status `location` (a Space.Charts place id) while
// docked, or landed at a port -> the place whose Berths it is; both from the generated index.
const ROOM_PREFIX = Object.fromEntries(places.map((p) => [p.prefix, p.id]));
const DOCK = Object.fromEntries(places.flatMap((p) => p.docks.map((d) => [d, p.id])));

/** The station a room or lift id belongs to ("tiss.market" -> "tiss"), or null. */
export function stationOfRoom(id) {
  const m = typeof id === "string" ? /^([a-z_]+)\./.exec(id) : null;
  return (m && ROOM_PREFIX[m[1]]) || null;
}

/** The station a docked ship's place id names ("orrin_station" -> "orrin"), or null. */
export function stationOfDock(place) {
  return (typeof place === "string" && DOCK[place]) || null;
}

/**
 * The station to show: the one whose room you're in (by its id, its door's, or the area the game
 * puts it in), else the one your ship is docked at, else whichever was showing. Null for a station
 * there's no plan of, standing in it or docked there, so the last one isn't shown in its place.
 * @param {object|null|undefined} msg the last location message
 * @param {string|null} dock where your ship is docked (Ship.Status `location`), or null
 * @param {string|null} current the station showing now, null for none
 */
export function pickStation(msg, dock, current) {
  const room = stationOfRoom(msg?.roomId) ?? stationOfRoom(msg?.door) ?? stationOfRoom(msg?.lift?.id);
  if (room) return room;
  if (typeof msg?.roomId === "string" && typeof msg?.area === "string" && !/^(ship|hull)\./.test(msg.area)) {
    return ROOM_PREFIX[msg.area] ?? null; // a station's room, a workshop or bunk too: the game says whose
  }
  if (typeof dock === "string") return stationOfDock(dock);
  return current;
}

/** The info line where there's no plan: "No plan of Pendeen Halt", or "" if it's unnamed. */
export function noPlanLine(msg) {
  const name = typeof msg?.areaName === "string" ? msg.areaName.trim() : "";
  return name ? `No plan of ${name}` : "";
}
