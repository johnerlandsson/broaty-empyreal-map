// Fixture for the orrery preview and tests: Space.Charts as C.charts would post it, and the ship's
// chart state. The charts are the game's own, recorded by dev/charts-cases.ts (dev/charts-cases.js
// moves them on to now): Senara's system as a character with every station and mouth on her charts
// has it, and Maelor's. Only the ships and the sweep are made up here, placed by those charts.
// km / deg / s; fit times in ms.

import { chartCase } from "./charts-cases.js";
import { daylit, indexCharts } from "../ui/lib/orbits.js";
import { sunAlt } from "../ui/lib/sky.js";

/** A port's star well up (day) or well down (night), by the sky the space scenes use. */
function side(index, port, t, want) {
  const alt = sunAlt(index, port, t);
  if (alt === null) {
    const day = daylit(index, port, t);
    return day !== null && day === (want === "day");
  }
  return want === "day" ? alt > 20 : alt < -20;
}

/** Recorded case `name`'s charts moved on to `now`; with `port`, moved on further till it's `want`
 *  (day or night) there at `now`, ten minutes at a time over a year at most. */
function charts(name, now = Date.now(), port = null, want = "day") {
  const c = chartCase(name);
  if (port) {
    const index = indexCharts(c.charts);
    for (let k = 0; k < 6 * 24 * 400; k++) {
      if (side(index, port, c.now + k * 600000, want)) return chartCase(name, now - k * 600000).charts;
    }
  }
  return chartCase(name, now).charts;
}

/** Charts with every lane mouth's bearing taken out, as a wild mouth's would be. */
function loose(charts) {
  for (const p of charts.places) if (p.kind === "mouth") delete p.edge;
  return charts;
}

/**
 * Senara's charts as the game sends them, at wall-clock `now`, with the day on Zennor's `side` (day
 * or night). `loose`: no mouth's bearing known.
 */
export function senaraCharts(now, { side = "day", loose: wild = false } = {}) {
  const c = charts("docked-tiss", now, "zennor", side);
  return wild ? loose(c) : c;
}

/** Senara's charts with Dolcoath's `side` (day or night) of Orrin at now. */
export function pitCharts(now, side = "day") {
  return charts("docked-tiss", now, "dolcoath", side);
}

/**
 * Maelor's charts as the game sends them at `now`: Wenna, Wenna Halt, Kestrel Belt and three lane
 * mouths. `loose`: no mouth's bearing known; `closed`: these mouths' lanes closed, as a branch's
 * may be (made up: the recording has all three open).
 */
export function maelorCharts(now, { loose: wild = false, closed = [] } = {}) {
  const c = charts("docked-wenna-halt", now);
  for (const p of c.places) if (closed.includes(p.id)) p.open = false;
  return wild ? loose(c) : c;
}

/** chart-ship messages by scenario (Senara); `received` and `depart` are stamped when emitted. */
export const SHIPS = {
  "parked-gannet": { name: "Mule", docked: false, location: "gannet-1" },
  "under-way-orrin": { name: "Mule", docked: false, destination: "orrin_station", progress: 0.4, eta: 724, from: "tiss" },
  "searching-cinders": { name: "Mule", docked: false, destination: "cinders-1", progress: 0.3, eta: 120, from: "tiss", searching: "cinders-1" },
  "at-point": { name: "Mule", docked: false, point: "pt:tamsin:38000:-51000" },
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
  const g = positionOf(index, "gannet-1", at);
  // toward Tamsin from the belt, and across: the ships are placed off the belt on Tamsin's side, so
  // a chart framing Tamsin's neighbourhood shows them
  const t = positionOf(index, "tamsin", at);
  const l = Math.hypot(t[0] - g[0], t[1] - g[1]);
  const u = [(t[0] - g[0]) / l, (t[1] - g[1]) / l];
  const by = (a, b) => [u[0] * a - u[1] * b, u[1] * a + u[0] * b];
  // range and bearing from her at Gannet, as gmcp.ts sends them, and x and y, which may go
  const bearing = (dx, dy) => (Math.round((((Math.atan2(dx, dy) * 180) / Math.PI) + 360) % 360 * 10) / 10) % 360;
  const off = (dx, dy) => ({ x: Math.round(g[0] + dx), y: Math.round(g[1] + dy), km: Math.round(Math.hypot(dx, dy)), bearing: bearing(dx, dy) });
  const place = (id) => {
    const p = positionOf(index, id, at);
    const [dx, dy] = [p[0] - g[0], p[1] - g[1]];
    return { x: Math.round(p[0]), y: Math.round(p[1]), km: Math.round(Math.hypot(dx, dy)), bearing: bearing(dx, dy) };
  };
  const none = { hidden: null, missed: false, moving: null, size: null, hull: null, owner: null };
  return {
    at,
    system: "senara",
    her: { name: "Mule", docked: false, location: "gannet-1" }, // as charts.lua kept her when it came
    contacts: [
      { kind: "station", id: "tiss", name: "T.I.S.S.", ...place("tiss"), ...none, hidden: "tamsin" },
      { kind: "station", id: "orrin_station", name: "Orrin Station", ...place("orrin_station"), ...none, missed: true },
      { kind: "ship", id: "ship.42", name: "the Mule", ...off(...by(3000, 2000)), ...none, moving: false, size: 1, hull: "skiff", owner: "Dilbo's" },
      { kind: "ship", id: "ship.17", name: "Old Faithful", ...off(...by(16000, -9000)), ...none, moving: true, size: 3, hull: "freighter", owner: "Annet's" },
      { kind: "unknown", id: "contact-1", name: "contact-1", ...off(...by(26000, 12000)), ...none },
    ],
  };
}
