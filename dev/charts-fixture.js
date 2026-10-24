// Fixture for the orrery preview: Space.Charts as C.charts would post it, and the ship's chart state.
// Built from ~/dev/empyreal/content/game/system.yaml, belts.yaml and galaxy.yaml (Senara, Maelor, Tamsin, Orrin, Wenna
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

/** A lane mouth: `open` is whether its lane is open now, as the game sends it (a trunk always). */
const mouth = (from, to, name, edge, open = true) => {
  const p = { id: `mouth:${from}:${to}`, name, kind: "mouth", orbit: null, fit: null, open };
  if (edge) p.edge = edge;
  return p;
};

/** The epoch is fixed at now - 30000 * 1000 so the moment matches the mockup's. */
const epoch = (now) => now - 30000 * 1000;

/** Zennor, a port on Tamsin's surface turning with its 4-hour day (gmcp.md §8.4), set to face
 *  Senara at `now` (day) or away from it (night). Tamsin's phase is 0 and the epoch 30000 s back. */
function zennor(now, side) {
  const since = (now - epoch(now)) / 1000;
  const tamsin = (360 * since) / period(FRAMES.senara, 6000);
  const turned = (360 * since) / 14400;
  const phase = (((tamsin + (side === "night" ? 0 : 180) - turned) % 360) + 360) % 360;
  const o = { parent: "tamsin", a: 400, e: 0, peri: 0, phase, period: 14400 };
  return { body: { id: "zennor", name: "Zennor", kind: "port", orbit: o }, place: { id: "zennor", name: "Zennor", kind: "station", orbit: o, fit: null } };
}

export function senaraCharts(now, edge = null, side = "day") {
  const tiss = station("tiss", "Tamsin International Space Station", "tamsin", 900);
  const orrinStation = station("orrin_station", "Orrin Station", "orrin", 800);
  const port = zennor(now, side);
  return {
    epoch: epoch(now),
    system: "senara",
    bodies: [
      { id: "senara", name: "Senara", kind: "star", radius: 800 },
      { id: "tamsin", name: "Tamsin", kind: "planet", radius: 400, orbit: orbit("senara", FRAMES.senara, 6000) },
      { id: "orrin", name: "Orrin", kind: "planet", radius: 500, orbit: orbit("senara", FRAMES.senara, 12000, { e: 0.1, phase: 150 }) },
      tiss.body,
      orrinStation.body,
      port.body,
    ],
    places: [
      tiss.place,
      orrinStation.place,
      port.place,
      belt("cinders", "The Cinders", "tamsin", 1800, { phase: 90 }, fit(now, 2 * DAY, 2600)),
      belt("gannet", "Gannet Belt", "tamsin", 2700, { phase: 200 }, fit(now, HOUR, 120)),
      // lost: an error of at least 0.9 * pi * a (a = 8500)
      belt("anvil", "The Anvil", "senara", 8500, { e: 0.05, phase: 40 }, fit(now, 9 * DAY, 25000)),
      mouth("senara", "maelor", "the Maelor lane mouth", edge),
    ],
  };
}

/** Maelor's three mouths at day 60 of the galaxy's year, worked out from galaxy.yaml as the game's
 *  mouthPos does: two trunks (Senara, Elowen) and the Petroc branch, closed (its stars 16.6 units
 *  apart, past its `open` 16). The Senara and Petroc mouths are under a degree apart. */
const MAELOR_LANES = (now) => [
  mouth("maelor", "senara", "the Senara lane mouth", { r: 15000, bearing: 287.01, at: now }, true),
  mouth("maelor", "elowen", "the Elowen lane mouth", { r: 15000, bearing: 198.58, at: now }, true),
  mouth("maelor", "petroc", "the Petroc lane mouth", { r: 15000, bearing: 287.84, at: now }, false),
];

/** Maelor, with its one Senara mouth (no bearing unless edge is given), or with all three (`lanes`). */
export function maelorCharts(now, edge = null, lanes = false) {
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
      ...(lanes ? MAELOR_LANES(now) : [mouth("maelor", "senara", "the Senara lane mouth", edge)]),
    ],
  };
}

/** The Senara mouth's `edge`, as the game sends it (gmcp.md §8.3): 76° is toward Maelor at tick 0.
 *  Without it (the `maelor` and other Senara scenarios) the chart shows a mouth it can't place. */
export const EDGE = (now) => ({ r: 15000, bearing: 76, at: now });

/** chart-ship messages by scenario (Senara); `received` and `depart` are stamped when emitted. */
export const SHIPS = {
  "parked-gannet": { name: "Mule", docked: false, location: "gannet" },
  "under-way-orrin": { name: "Mule", docked: false, destination: "orrin_station", progress: 0.4, eta: 250, from: "tiss" },
  "searching-cinders": { name: "Mule", docked: false, destination: "cinders", progress: 0.3, eta: 120, from: "tiss", searching: "cinders" },
  "at-point": { name: "Mule", docked: false, point: "pt:tamsin:1500:-2000" },
  "docked-tiss": { name: "Mule", docked: true, location: "tiss" },
  "landed-zennor": { name: "Mule", docked: true, location: "zennor" },
  none: null,
};

export const MAELOR_SHIP = { name: "Mule", docked: true, location: "wenna_halt" };

/** Space.Contacts as C.contacts would post it (gmcp.md §8.5): a sweep at Gannet Belt `ago` ms back.
 *  The Mule, named and at rest; Old Faithful, named, under drive; contact-1, dark; T.I.S.S. behind
 *  Tamsin; Orrin Station missed. Ships are placed off where the charts put Gannet Belt then. */
export function senaraContacts(now, positionOf, index, ago = 4 * 60 * 1000) {
  const at = now - ago;
  const g = positionOf(index, "gannet", at);
  const off = (dx, dy) => ({ x: Math.round(g[0] + dx), y: Math.round(g[1] + dy), km: Math.round(Math.hypot(dx, dy)) });
  const place = (id) => {
    const p = positionOf(index, id, at);
    return { x: Math.round(p[0]), y: Math.round(p[1]), km: Math.round(Math.hypot(p[0] - g[0], p[1] - g[1])) };
  };
  const none = { hidden: null, missed: false, moving: null, size: null, hull: null, owner: null };
  return {
    at,
    system: "senara",
    contacts: [
      { kind: "station", id: "tiss", name: "T.I.S.S.", ...place("tiss"), ...none, hidden: "tamsin" },
      { kind: "station", id: "orrin_station", name: "Orrin Station", ...place("orrin_station"), ...none, missed: true },
      { kind: "ship", id: "ship.42", name: "the Mule", ...off(300, 260), ...none, moving: false, size: 1, hull: "skiff", owner: "Dilbo's" },
      { kind: "ship", id: "ship.17", name: "Old Faithful", ...off(1900, -1300), ...none, moving: true, size: 3, hull: "freighter", owner: "Annet's" },
      { kind: "unknown", id: "contact-1", name: "contact-1", ...off(2300, -3600), ...none },
    ],
  };
}
