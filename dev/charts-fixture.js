// Fixture for the orrery preview: Space.Charts as C.charts would post it, and the ship's chart state.
// Built from ~/dev/empyreal/content/game/system.yaml and belts.yaml (Senara, Maelor, Tamsin, Orrin, Wenna
// and the belts). The game sends each orbit's period as frame.period * (a / frame.a)^1.5, with the
// parent's frame; `period` below does the same. km / deg / s; fit times in ms.

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** A body's orbit as the game sends it: missing e / peri / phase are 0. */
const period = (frame, a) => Math.round(frame.period * (a / frame.a) ** 1.5);
function orbit(parent, frame, a, { e = 0, peri = 0, phase = 0 } = {}) {
  return { parent, a, e, peri, phase, period: period(frame, a) };
}

const FRAMES = {
  senara: { a: 6000, period: 259200 },
  tamsin: { a: 900, period: 7200 },
  orrin: { a: 800, period: 10800 },
  maelor: { a: 5000, period: 216000 },
  wenna: { a: 700, period: 9000 },
};

const fit = (now, ago, error) => ({ seen: now - ago, error, at: now });

/** A station is both a body and a place with the same id. */
function station(id, name, parent, a) {
  const o = orbit(parent, FRAMES[parent], a);
  return { body: { id, name, kind: "station", orbit: o }, place: { id, name, kind: "station", orbit: o, fit: null } };
}

function belt(id, name, parent, a, extra, f) {
  return { id, name, kind: "belt", orbit: orbit(parent, FRAMES[parent], a, extra), fit: f };
}

const mouth = (from, to, name, edge) => {
  const p = { id: `mouth:${from}:${to}`, name, kind: "mouth", orbit: null, fit: null };
  if (edge) p.edge = edge;
  return p;
};

/** The epoch is fixed at now - 30000 * 1000 so the moment matches the mockup's. */
const epoch = (now) => now - 30000 * 1000;

export function senaraCharts(now, edge = null) {
  const tiss = station("tiss", "Tamsin International Space Station", "tamsin", 900);
  const orrinStation = station("orrin_station", "Orrin Station", "orrin", 800);
  return {
    epoch: epoch(now),
    system: "senara",
    bodies: [
      { id: "senara", name: "Senara", kind: "star", radius: 800 },
      { id: "tamsin", name: "Tamsin", kind: "planet", radius: 400, orbit: orbit("senara", FRAMES.senara, 6000) },
      { id: "orrin", name: "Orrin", kind: "planet", radius: 500, orbit: orbit("senara", FRAMES.senara, 12000, { e: 0.1, phase: 150 }) },
      tiss.body,
      orrinStation.body,
    ],
    places: [
      tiss.place,
      orrinStation.place,
      belt("cinders", "The Cinders", "tamsin", 1800, { phase: 90 }, fit(now, 2 * DAY, 2600)),
      belt("gannet", "Gannet Belt", "tamsin", 2700, { phase: 200 }, fit(now, HOUR, 120)),
      // lost: an error of at least 0.9 * pi * a (a = 8500)
      belt("anvil", "The Anvil", "senara", 8500, { e: 0.05, phase: 40 }, fit(now, 9 * DAY, 25000)),
      mouth("senara", "maelor", "the Maelor lane mouth", edge),
    ],
  };
}

export function maelorCharts(now, edge = null) {
  const wennaHalt = station("wenna_halt", "Wenna Halt", "wenna", 700);
  return {
    epoch: epoch(now),
    system: "maelor",
    bodies: [
      { id: "maelor", name: "Maelor", kind: "star", radius: 700 },
      { id: "wenna", name: "Wenna", kind: "planet", radius: 450, orbit: orbit("maelor", FRAMES.maelor, 5000, { e: 0.05, phase: 60 }) },
      wennaHalt.body,
    ],
    places: [
      wennaHalt.place,
      belt("kestrel", "Kestrel Belt", "wenna", 2000, { phase: 300 }, fit(now, 6 * HOUR, 200)),
      mouth("maelor", "senara", "the Senara lane mouth", edge),
    ],
  };
}

/** The mouth's edge marker. The bearing is INVENTED: the game doesn't send one, so this only shows how
 *  the chart draws a marker when it has one. */
export const EDGE = (now) => ({ r: 15000, bearing: 76, at: now });

/** chart-ship messages by scenario (Senara); `received` and `depart` are stamped when emitted. */
export const SHIPS = {
  "parked-gannet": { name: "Mule", docked: false, location: "gannet" },
  "under-way-orrin": { name: "Mule", docked: false, destination: "orrin_station", progress: 0.4, eta: 250, from: "tiss" },
  "searching-cinders": { name: "Mule", docked: false, destination: "cinders", progress: 0.3, eta: 120, from: "tiss", searching: "cinders" },
  "at-point": { name: "Mule", docked: false, point: "pt:tamsin:1500:-2000" },
  "docked-tiss": { name: "Mule", docked: true, location: "tiss" },
  none: null,
};

export const MAELOR_SHIP = { name: "Mule", docked: true, location: "wenna_halt" };
