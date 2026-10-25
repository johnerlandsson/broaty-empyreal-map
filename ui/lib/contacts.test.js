import { describe, expect, it } from "vitest";
import { along, card, chased, hullName, markText, nameOf, placeOf, shipLine, shipTip, sweepAge, sweepOf } from "./contacts.js";
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

describe("placeOf", () => {
  it("is her place at the sweep plus km along the bearing, 0° up (+y) and clockwise", () => {
    const close = (p, q) => q.forEach((v, i) => expect(p[i]).toBeCloseTo(v, 9));
    close(along([1, 2], 3, 0), [1, 5]);
    close(along([1, 2], 3, 90), [4, 2]);
    close(along([1, 2], 3, 180), [1, -1]);
    close(along([1, 2], 3, 270), [-2, 2]);
    close(placeOf({ km: 10, bearing: 53.1, x: 999, y: 999 }, [0, 0]), [10 * Math.sin((53.1 * Math.PI) / 180), 10 * Math.cos((53.1 * Math.PI) / 180)]);
  });

  it("falls back on x and y with no bearing or no place for her, and is null with neither", () => {
    expect(placeOf({ km: 10, bearing: null, x: 3, y: 4 }, [0, 0])).toEqual([3, 4]);
    expect(placeOf({ km: 10, bearing: 20, x: 3, y: 4 }, null)).toEqual([3, 4]);
    expect(placeOf({ km: 10, bearing: 20 }, null)).toBeNull();
  });

  it("puts the sweep's ships and marks where they were seen from her", () => {
    const s = sweepOf({ ...CONTACTS, contacts: [
      { kind: "ship", id: "ship.7", name: "Full Measure", km: 5, bearing: 90 },
      { kind: "station", id: "tiss", name: "T.I.S.S.", km: 900, bearing: 0, hidden: "tamsin" },
    ] }, "senara", [100, 200]);
    expect(s.seen.get("ship.7")[0]).toBeCloseTo(105, 9);
    expect(s.seen.get("ship.7")[1]).toBeCloseTo(200, 9);
    expect(s.where.get("tiss")[1]).toBeCloseTo(1100, 9);
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

  it("lands where x and y had her, placed from her at the belt by km and bearing", () => {
    const index = indexCharts(charts);
    const at = 1_000_000;
    const her = { location: "gannet" };
    const g = shipFix(index, her, at).pos;
    // the game's contact: her place plus the offset, and its range and bearing to a tenth
    const dx = 2300;
    const dy = -3600;
    const bearing = Math.round((((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360) * 10) / 10;
    const c = { kind: "unknown", id: "contact-1", name: "contact-1", km: Math.hypot(dx, dy), bearing, x: g[0] + dx, y: g[1] + dy };
    index.seen = sweepOf({ at, system: "senara", her, contacts: [c] }, "senara", g).seen;
    const p = positionOf(index, "contact-1", 9e9);
    expect(Math.hypot(p[0] - c.x, p[1] - c.y)).toBeLessThan(c.km * (Math.PI / 180) * 0.05); // the bearing to a tenth: within half of it
    const fix = shipFix(index, { from: "gannet", destination: "contact-1", progress: 0.5, eta: 100, depart: 900, received: 1000 }, 1_050_000);
    expect(fix.leg.to).toEqual(p);
  });

  it("leaves her bound for a ship that isn't on the sweep", () => {
    const index = indexCharts(charts);
    index.seen = sweepOf(CONTACTS, "senara").seen;
    const ship = { from: "gannet", destination: "contact-7", progress: 0.5, eta: 100, depart: 900, received: 1000 };
    expect(shipFix(index, ship, 1_050_000).kind).toBe("bound");
  });
});
