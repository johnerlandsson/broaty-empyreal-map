import { describe, expect, it } from "vitest";
import { card, chased, hullName, markText, nameOf, shipLine, shipTip, sweepAge, sweepOf } from "./contacts.js";
import { indexCharts, positionOf, shipFix } from "./orbits.js";

const none = { hidden: null, missed: false };
// Space.Contacts as charts.lua cleans it: a dark ship has only her number and where she was
const CONTACTS = {
  at: 1_000_000,
  system: "senara",
  contacts: [
    { kind: "station", id: "tiss", name: "T.I.S.S.", km: 900, x: 10, y: 20, ...none, hidden: "tamsin" },
    { kind: "station", id: "orrin_station", name: "Orrin Station", km: 9000, x: 30, y: 40, ...none, missed: true },
    { kind: "station", id: "wenna_halt", name: "Wenna Halt", km: 500, x: 1, y: 1, ...none },
    { kind: "ship", id: "ship.17", name: "Old Faithful", km: 6200, x: 50, y: 60, ...none, moving: true, size: 3, hull: "freighter", owner: "Annet's" },
    { kind: "ship", id: "ship.42", name: "the Mule", km: 35, x: 70, y: 80, ...none, moving: false, size: 1, hull: "skiff", owner: "Dilbo's" },
    { kind: "unknown", id: "contact-1", name: "contact-1", km: 7400, x: 90, y: -100, ...none },
  ],
};

describe("sweepOf", () => {
  it("indexes a sweep of the charts' system", () => {
    const s = sweepOf(CONTACTS, "senara");
    expect(s.at).toBe(1_000_000);
    expect(s.ships.map((c) => c.id)).toEqual(["ship.17", "ship.42", "contact-1"]);
    expect([...s.marks.keys()]).toEqual(["tiss", "orrin_station"]);
    expect(s.seen.get("contact-1")).toEqual([90, -100]);
    expect(s.seen.has("tiss")).toBe(false);
  });

  it("is null for another system's sweep, none, or one with no time", () => {
    expect(sweepOf(CONTACTS, "maelor")).toBeNull();
    expect(sweepOf(null, "senara")).toBeNull();
    expect(sweepOf({ ...CONTACTS, at: "soon" }, "senara")).toBeNull();
  });

  it("skips contacts it can't place", () => {
    const s = sweepOf({ ...CONTACTS, contacts: [{ kind: "ship", id: "ship.1", x: "far", y: 0 }, null] }, "senara");
    expect(s.ships).toEqual([]);
  });
});

describe("what the chart says of them", () => {
  const s = sweepOf(CONTACTS, "senara");
  const [faithful, mule, dark] = s.ships;

  it("names a named ship's hull and whether she's under drive", () => {
    expect(shipLine(faithful)).toBe("freighter · under drive");
    expect(shipLine(mule)).toBe("skiff");
    expect(hullName("courier")).toBe("courier");
    expect(hullName("barge")).toBe("barge");
  });

  it("tells a named ship's hull, owner and distance, as of the sweep", () => {
    expect(shipTip(faithful)).toEqual({ title: "Old Faithful", body: "medium freighter, Annet's\nunder drive, 6,200 km off at the sweep" });
    expect(shipTip(mule).body).toBe("prospecting skiff, Dilbo's\nat rest, 35 km off at the sweep");
  });

  it("never says more of a dark ship than her contact number", () => {
    // even if a hull or owner slipped through, it isn't shown
    const leaky = { ...dark, name: "Shadow", hull: "skiff", owner: "Someone", moving: true, size: 1 };
    expect(nameOf(leaky)).toBe("contact-1");
    expect(shipLine(leaky)).toBe("");
    expect(shipTip(leaky)).toEqual({ title: "contact-1", body: "where the last sweep saw her" });
    const row = card({ ...s, ships: [leaky], marks: new Map() }, null, s.at).rows[0];
    expect(row).toEqual(["contact-1", "7,400 km"]);
  });

  it("notes what a body hid and what the sweep missed", () => {
    const body = (id) => ({ tamsin: "Tamsin" })[id] ?? id;
    expect(markText(s.marks.get("tiss"), body)).toBe("T.I.S.S., behind Tamsin");
    expect(markText(s.marks.get("orrin_station"), body)).toBe("Orrin Station, missed");
  });

  it("gives the sweep's age to the minute", () => {
    expect(sweepAge(s, s.at + 30_000)).toBe("just now");
    expect(sweepAge(s, s.at + 250_000)).toBe("4m ago");
    expect(sweepAge(s, s.at + 3_720_000)).toBe("1h 2m ago");
  });
});

describe("card", () => {
  const s = sweepOf(CONTACTS, "senara");
  const body = (id) => ({ tamsin: "Tamsin" })[id] ?? id;

  it("folds to the sweep's age and unfolds to its ships, nearest first, then what it couldn't see", () => {
    const c = card(s, { location: "gannet" }, s.at + 250_000, body);
    expect(c.chase).toBeNull();
    expect(c.head).toBe("Last sweep · 4m ago");
    expect(c.rows).toEqual([
      ["the Mule", "skiff · 35 km"],
      ["Old Faithful", "freighter · under drive · 6,200 km"],
      ["contact-1", "7,400 km"],
      ["T.I.S.S.", "behind Tamsin"],
      ["Orrin Station", "missed"],
    ]);
  });

  it("says which ship she's after", () => {
    expect(card(s, { destination: "contact-1" }, s.at, body).chase).toBe("After contact-1");
    expect(card(s, { destination: "ship.42" }, s.at, body).chase).toBe("After the Mule");
    expect(card(s, { destination: "tiss" }, s.at, body).chase).toBeNull();
    expect(chased(s, { destination: "ship.99" })).toBeNull();
  });
});

describe("a chase", () => {
  const charts = {
    epoch: 0,
    system: "senara",
    bodies: [
      { id: "senara", name: "Senara", kind: "star" },
      { id: "tamsin", name: "Tamsin", kind: "planet", radius: 400, orbit: { parent: "senara", a: 6000, e: 0, peri: 0, phase: 0, period: 259200 } },
    ],
    places: [{ id: "gannet", name: "Gannet Belt", kind: "belt", orbit: { parent: "tamsin", a: 2700, e: 0, peri: 0, phase: 90, period: 7200 } }],
  };

  it("draws her trip to where the sweep saw the ship, in the star's frame, never moved on", () => {
    const index = indexCharts(charts);
    index.seen = sweepOf(CONTACTS, "senara").seen;
    expect(positionOf(index, "contact-1", 0)).toEqual([90, -100]);
    expect(positionOf(index, "contact-1", 9e9)).toEqual([90, -100]);
    const ship = { from: "gannet", destination: "contact-1", progress: 0.5, eta: 100, depart: 900, received: 1000 };
    const fix = shipFix(index, ship, 1_050_000);
    expect(fix.kind).toBe("moving");
    expect(fix.leg.frame).toBe("senara");
    expect(fix.leg.to).toEqual([90, -100]);
  });

  it("leaves her bound for a ship that isn't on the sweep", () => {
    const index = indexCharts(charts);
    index.seen = sweepOf(CONTACTS, "senara").seen;
    const ship = { from: "gannet", destination: "contact-7", progress: 0.5, eta: 100, depart: 900, received: 1000 };
    expect(shipFix(index, ship, 1_050_000).kind).toBe("bound");
  });
});
