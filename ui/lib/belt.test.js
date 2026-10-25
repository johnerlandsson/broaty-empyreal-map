import { describe, expect, it } from "vitest";
import { Glide, ago, beltShipText, beltShips, cleanBelt, discFrame, headingOf, hereOf, placeText, ringKms, toBand } from "./belt.js";

describe("placeText", () => {
  it("says it as the game does", () => {
    expect(placeText({ km: 11.2, bearing: 210 }, 18)).toBe("11 km out from the core, bearing 210°");
    expect(placeText({ km: 0.9, bearing: 40 }, 18)).toBe("at the core");
    expect(placeText({ km: 17.1, bearing: 5 }, 18)).toBe("at the outer edge, bearing 5°");
    expect(placeText({ km: 17, bearing: 5 }, 18)).toBe("17 km out from the core, bearing 5°");
    expect(placeText(null, 18)).toBe(null);
  });
});

describe("cleanBelt", () => {
  it("is null for nothing", () => {
    expect(cleanBelt(null)).toBe(null);
    expect(cleanBelt("x")).toBe(null);
  });

  it("keeps the well-formed parts", () => {
    const b = cleanBelt({
      id: "gannet-3",
      name: "Gannet Belt",
      radius: 18,
      place: { x: 3, y: 4, km: 5, bearing: 37 },
      host: null,
      array: false,
      log: {
        track: [[[1, 2], ["x", 3], [4, 5]], "bad", []],
        sweeps: [{ x: 1, y: 2, r: 5 }, { x: "a" }, { x: 3, y: 4 }],
        left: { x: 1, y: 1, name: "Full Measure", id: "ship.7", at: 99 },
        seen: { at: 6000, x: 1, y: "n" },
      },
    });
    expect(b).toEqual({
      id: "gannet-3",
      name: "Gannet Belt",
      radius: 18,
      place: { x: 3, y: 4, km: 5, bearing: 37 },
      host: null,
      hostId: null,
      docked: null,
      array: false,
      track: [[[1, 2], [4, 5]]],
      sweeps: [{ x: 1, y: 2, r: 5 }, { x: 3, y: 4, r: null }],
      left: { x: 1, y: 1, name: "Full Measure", id: "ship.7", at: 99 },
      seen: null,
    });
  });

  it("works out km and bearing when they're missing, and drops a bad radius", () => {
    const b = cleanBelt({ id: "g", radius: -1, place: { x: -5, y: 0 }, log: "x" });
    expect(b.place).toEqual({ x: -5, y: 0, km: 5, bearing: 270 });
    expect(b.radius).toBe(null);
    expect(b.track).toEqual([]);
    expect(b.array).toBe(null);
  });
});

describe("framing", () => {
  it("fits the disc in the band's shorter side, bearing 0 up", () => {
    const f = discFrame(380, 252, 18);
    expect(f.r).toBe(102);
    expect(toBand(f, 0, 18)).toEqual([190, 24]);
    expect(toBand(f, 18, 0)).toEqual([292, 126]);
  });

  it("rings every 5 km short of the rim", () => {
    expect(ringKms(18)).toEqual([5, 10, 15]);
    expect(ringKms(15)).toEqual([5, 10]);
    expect(ringKms(15.6)).toEqual([5, 10, 15]);
  });

  it("headings are clockwise from 0", () => {
    expect(headingOf([0, 0], [0, 1])).toBe(0);
    expect(headingOf([0, 0], [1, 0])).toBe(90);
    expect(headingOf([0, 0], [-1, 0])).toBe(270);
    expect(headingOf([1, 1], [1, 1])).toBe(null);
  });
});

describe("ago", () => {
  it("reads as the lanes key does", () => {
    expect(ago(20)).toBe("just now");
    expect(ago(14 * 60)).toBe("14m");
    expect(ago(2 * 3600 + 300)).toBe("2h 5m");
    expect(ago(3 * 86400 + 4 * 3600)).toBe("3d 4h");
  });
});

describe("Glide", () => {
  it("puts her first place at once", () => {
    const g = new Glide();
    g.set("g", [1, 1], 1000);
    expect(g.at(1000)).toEqual([1, 1]);
    expect(g.moving(1000)).toBe(false);
  });

  it("moves her to the next place over the time since the last came", () => {
    const g = new Glide();
    g.set("g", [0, 0], 0);
    g.set("g", [0, 1], 1000);
    expect(g.moving(1500)).toBe(true);
    expect(g.at(1500)).toEqual([0, 0.5]);
    expect(g.at(2000)).toEqual([0, 1]);
    expect(g.heading).toBe(0);
    g.set("g", [1, 1], 3000); // a second later than due: still clamped to 1.5 s
    expect(g.end - g.start).toBe(1500);
    expect(g.heading).toBe(90);
  });

  it("jumps in a new belt, and the same place again changes nothing", () => {
    const g = new Glide();
    g.set("g", [0, 0], 0);
    g.set("c", [5, 5], 1000);
    expect(g.at(1000)).toEqual([5, 5]);
    g.set("c", [5, 5], 2000);
    expect(g.moving(2000)).toBe(false);
    g.set("c", null, 3000);
    expect(g.at(3000)).toBe(null);
  });
});

describe("the last sweep's ships in the belt", () => {
  const AT = 6_000_000;
  // her at (-1.5, -3.5) as the sweep came; a ship's km and bearing from there
  const off = (dx, dy) => ({ km: Math.hypot(dx, dy), bearing: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360 });
  const SWEEP = {
    at: AT,
    system: "senara",
    contacts: [
      { kind: "ship", id: "ship.7", name: "Full Measure", ...off(10.9, 5.1), hull: "freighter", moving: false },
      { kind: "unknown", id: "contact-1", name: "contact-1", ...off(-11, 6.7) },
      { kind: "ship", id: "ship.9", name: "Far Away", ...off(30, 0), hull: "skiff" }, // beyond the rim
      { kind: "ship", id: "ship.3", name: "Old", km: 2, bearing: null, x: 1, y: 1 }, // a sweep from before bearings
      { kind: "station", id: "tiss", name: "T.I.S.S.", km: 900, bearing: 10 },
    ],
  };
  const belt = (extra = {}, log = {}) =>
    cleanBelt({ id: "gannet-3", radius: 18, place: { x: -5.5, y: -9.5 }, log: { seen: { at: AT, x: -1.5, y: -3.5 }, ...log }, ...extra });
  const close = (p, q) => q.forEach((v, i) => expect(p[i]).toBeCloseTo(v, 6));

  it("places each ship from where she was as the sweep came, in the disc only", () => {
    const ships = beltShips(belt(), SWEEP);
    expect(ships.map((s) => s.c.id)).toEqual(["ship.7", "contact-1"]);
    close(ships[0].p, [9.4, 1.6]);
    close(ships[1].p, [-12.5, 3.2]);
  });

  it("gives range and bearing from her now, as rcs takes them", () => {
    const [fm] = beltShips(belt(), SWEEP);
    expect(fm.km).toBeCloseTo(Math.hypot(14.9, 11.1), 6);
    expect(fm.bearing).toBeCloseTo(((Math.atan2(14.9, 11.1) * 180) / Math.PI), 6);
    expect(beltShipText(fm, AT, AT + 4 * 60_000)).toEqual(["Full Measure · 18.6 km, 53°", "freighter · seen 4m ago"]);
    const [, dark] = beltShips(belt(), SWEEP);
    expect(beltShipText(dark, AT, AT + 30_000)[1]).toBe("seen just now");
  });

  it("draws nothing for a sweep she has no place for, or another sweep", () => {
    expect(beltShips(belt({}, { seen: null }), SWEEP)).toEqual([]);
    expect(beltShips(belt(), { ...SWEEP, at: AT + 1 })).toEqual([]);
    expect(beltShips(belt(), null)).toEqual([]);
  });

  it("marks the host she left, seen by a later sweep, by her id", () => {
    const later = beltShips(belt({}, { left: { x: 7.2, y: 5.1, name: "Full Measure", id: "ship.7", at: AT / 1000 - 600 } }), SWEEP);
    expect(later.map((s) => s.host)).toEqual([true, false]);
    const earlier = beltShips(belt({}, { left: { x: 7.2, y: 5.1, name: "Full Measure", id: "ship.7", at: AT / 1000 + 60 } }), SWEEP);
    expect(earlier[0].host).toBe(false);
  });

  it("docked, her place is her host's, and the host isn't drawn twice", () => {
    const b = cleanBelt({ id: "gannet-3", radius: 18, place: null, host: "Full Measure", host_id: "ship.7",
      docked: { x: 4.2, y: -7.6, km: 8.7, bearing: 151 }, log: { seen: { at: AT, x: -1.5, y: -3.5 } } });
    expect(hereOf(b)).toEqual({ x: 4.2, y: -7.6, km: 8.7, bearing: 151 });
    const ships = beltShips(b, SWEEP);
    expect(ships.map((s) => s.c.id)).toEqual(["contact-1"]);
    expect(ships[0].km).toBeCloseTo(Math.hypot(-16.7, 10.8), 6);
  });
});
