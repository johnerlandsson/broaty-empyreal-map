// The game's own charts, recorded by dev/charts-cases.ts (dev/charts-cases.json): each case as the
// panel would have it, every wall-clock time moved on so the recorded moment is `now`, as the
// preview and the tests want them. Positions are worked out from the clock, so moving every time
// by the same span puts everything where it was when the game sent it.

import recorded from "./charts-cases.json" with { type: "json" };

export const EMPYREAL = recorded.empyreal;
export const CASES = Object.keys(recorded.cases);

const by = (v, d) => (typeof v === "number" ? v + d : v);

/** Space.Charts with its times moved on by d ms. */
function chartsBy(charts, d) {
  if (!charts) return null;
  return {
    ...charts,
    epoch: by(charts.epoch, d),
    places: charts.places.map((p) => ({
      ...p,
      fit: p.fit && { ...p.fit, seen: by(p.fit.seen, d), at: by(p.fit.at, d) },
      edge: p.edge && { ...p.edge, at: by(p.edge.at, d) },
    })),
  };
}

/**
 * Case `name` as of wall-clock `now` (ms; the recorded moment when absent): `charts` (Space.Charts),
 * `ship` (the chart-ship message charts.lua makes of Ship.Status, `received` and `depart` in whole
 * seconds), `status` (Ship.Status), `course` (the course message, `{ course }` or `{}`) and
 * `contacts` (Space.Contacts, with `her`, the ship as she was at the sweep), each a fresh copy.
 */
export function chartCase(name, now = null) {
  const c = recorded.cases[name];
  if (!c) throw new Error(`no recorded case ${name}`);
  const d = now === null ? 0 : now - c.now;
  const s = Math.round(d / 1000);
  const ship = c.ship && structuredClone(c.ship);
  if (ship) {
    ship.received = by(ship.received, s);
    ship.depart = by(ship.depart, s);
    if (ship.over) ship.over.depart = by(ship.over.depart, s);
  }
  return {
    now: c.now + d,
    charts: chartsBy(structuredClone(c.charts), d),
    ship,
    status: structuredClone(c.status),
    course: c.course ? { course: { ...c.course, at: by(c.course.at, d) } } : {},
    contacts: c.contacts && { ...structuredClone(c.contacts), at: by(c.contacts.at, d), her: ship },
    pos: structuredClone(c.pos),
  };
}
