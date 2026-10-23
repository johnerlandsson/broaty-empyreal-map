// Which station's maps to show: the one whose room you're in, else the one your ship is docked
// at, else whichever was showing. Pure; no DOM.

const ROOM_PREFIX = {
  tiss: "tiss",
  orrin: "orrin",
  wenna: "wenna",
  morvah: "morvah",
  gwithian: "gwithian",
  carrow: "carrow",
  lanyon: "lanyon",
  zennor: "zennor",
};
// Ship.Status `location` (a Space.Charts place id) while docked, or landed at a port
const DOCK = {
  tiss: "tiss",
  orrin_station: "orrin",
  wenna_halt: "wenna",
  morvah_deep: "morvah",
  gwithian_reach: "gwithian",
  carrow_yard: "carrow",
  lanyon_high: "lanyon",
  zennor: "zennor",
};

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
 * @param {object|null|undefined} msg the last location message
 * @param {string|null} docked the station your ship is docked at
 * @param {string} current the station showing now
 */
export function pickStation(msg, docked, current) {
  return stationOfRoom(msg?.roomId) ?? stationOfRoom(msg?.lift?.id) ?? docked ?? current;
}
