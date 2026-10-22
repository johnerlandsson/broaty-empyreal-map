import { describe, expect, it } from "vitest";
import { EDGE_KM, errorAt, frameOf, indexCharts, isLost, legOf, offsetOn, parentOf, parsePoint, positionOf, shipFix } from "./orbits.js";

const rad = (d) => (d * Math.PI) / 180;
const orbit = (parent, a, period, extra = {}) => ({ parent, a, e: 0, peri: 0, phase: 0, period, ...extra });

const charts = (edge) => ({
  epoch: 0,
  system: "senara",
  bodies: [
    { id: "senara", name: "Senara", kind: "star" },
    { id: "tamsin", name: "Tamsin", kind: "planet", radius: 6000, orbit: orbit("senara", 6000, 259200) },
    { id: "tiss", name: "Tiss", kind: "moon", orbit: orbit("tamsin", 900, 7200) },
    { id: "orrin", name: "Orrin", kind: "planet", orbit: orbit("senara", 12000, 733137, { e: 0.1, phase: 150 }) },
  ],
  places: [
    { id: "orrin_station", name: "Orrin Station", kind: "station", orbit: orbit("orrin", 800, 3600) },
    { id: "gannet", name: "Gannet", kind: "belt", orbit: orbit("tamsin", 2700, 50000) },
    { id: "mouth", name: "The Mouth", kind: "mouth", ...(edge ? { edge } : {}) },
  ],
});

const idx = indexCharts(charts({ r: 15000, bearing: 90, at: "senara" }));
const T = 123456789;

describe("EDGE_KM", () => {
  it("is 15000", () => expect(EDGE_KM).toBe(15000));
});

describe("indexCharts", () => {
  it("indexes bodies and places by id", () => {
    expect(idx.system).toBe("senara");
    expect(idx.epoch).toBe(0);
    expect(idx.items.get("tiss").name).toBe("Tiss");
    expect(idx.items.get("gannet").kind).toBe("belt");
  });

  it("merges a body and a place with the same id", () => {
    const i = indexCharts({
      epoch: 0,
      system: "s",
      bodies: [{ id: "x", name: "X", kind: "planet", radius: 5, orbit: orbit("s", 1, 1) }],
      places: [{ id: "x", name: "X", kind: "planet", fit: 3 }],
    });
    expect(i.items.get("x")).toMatchObject({ radius: 5, fit: 3 });
    expect(i.items.get("x").orbit.a).toBe(1);
  });

  it("copes with missing lists", () => {
    expect(indexCharts({}).items.size).toBe(0);
    expect(indexCharts(null).items.size).toBe(0);
  });
});

describe("offsetOn", () => {
  it("circular quarter turn", () => {
    const [x, y] = offsetOn(orbit("tamsin", 900, 7200), 0, 1800000);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(900, 6);
  });

  it("eccentric at periapsis and apoapsis", () => {
    const [x, y] = offsetOn({ a: 12000, e: 0.1, peri: 30, phase: 0, period: 1000 }, 0, 0);
    expect(x).toBeCloseTo(10800 * Math.cos(rad(30)), 6);
    expect(y).toBeCloseTo(10800 * Math.sin(rad(30)), 6);
    const [u, v] = offsetOn({ a: 12000, e: 0.1, peri: 30, phase: 180, period: 1000 }, 0, 0);
    expect(u).toBeCloseTo(13200 * Math.cos(rad(210)), 6);
    expect(v).toBeCloseTo(13200 * Math.sin(rad(210)), 6);
  });

  it("is [0,0] for bad data", () => {
    expect(offsetOn(null, 0, 0)).toEqual([0, 0]);
    expect(offsetOn({ a: 1, period: 0 }, 0, 0).every(Number.isFinite)).toBe(true);
  });
});

describe("positionOf", () => {
  it("nests a moon on its planet", () => {
    const t = positionOf(idx, "tamsin", T);
    const o = offsetOn(idx.items.get("tiss").orbit, 0, T);
    const p = positionOf(idx, "tiss", T);
    expect(p[0]).toBeCloseTo(t[0] + o[0], 6);
    expect(p[1]).toBeCloseTo(t[1] + o[1], 6);
  });

  it("puts the star at the origin", () => {
    expect(positionOf(idx, "senara", T)).toEqual([0, 0]);
  });

  it("places a point relative to its body", () => {
    const t = positionOf(idx, "tamsin", T);
    const p = positionOf(idx, "pt:tamsin:1500:-2000", T);
    expect(p[0]).toBeCloseTo(t[0] + 1500, 6);
    expect(p[1]).toBeCloseTo(t[1] - 2000, 6);
  });

  it("parses points", () => {
    expect(parsePoint("pt:tamsin:1500:-2000")).toEqual({ body: "tamsin", x: 1500, y: -2000 });
    expect(parsePoint("pt:tamsin:x:1")).toBeNull();
    expect(parsePoint("tamsin")).toBeNull();
    expect(parsePoint(null)).toBeNull();
  });

  it("puts the mouth on the edge, or nowhere", () => {
    const [x, y] = positionOf(idx, "mouth", T);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(15000, 6);
    const bare = indexCharts(charts(null));
    expect(positionOf(bare, "mouth", T)).toBeNull();
  });

  it("is null for unknown or cyclic parents", () => {
    const i = indexCharts({
      epoch: 0,
      system: "s",
      bodies: [
        { id: "a", name: "A", kind: "planet", orbit: orbit("b", 1, 1) },
        { id: "b", name: "B", kind: "planet", orbit: orbit("a", 1, 1) },
        { id: "c", name: "C", kind: "planet", orbit: orbit("nope", 1, 1) },
      ],
    });
    expect(positionOf(i, "a", 0)).toBeNull();
    expect(positionOf(i, "c", 0)).toBeNull();
    expect(positionOf(i, "zzz", 0)).toBeNull();
    expect(positionOf(i, "pt:nope:1:1", 0)).toBeNull();
  });
});

describe("parentOf", () => {
  it("names the body an item orbits", () => {
    expect(parentOf(idx, "tiss")).toBe("tamsin");
    expect(parentOf(idx, "pt:tamsin:1:1")).toBe("tamsin");
    expect(parentOf(idx, "senara")).toBeNull();
    expect(parentOf(idx, "mouth")).toBeNull();
  });
});

describe("frameOf", () => {
  it("finds the nearest body both orbit", () => {
    expect(frameOf(idx, "tiss", "gannet")).toBe("tamsin");
    expect(frameOf(idx, "tiss", "orrin_station")).toBe("senara");
    expect(frameOf(idx, "pt:tamsin:1:1", "tiss")).toBe("tamsin");
    expect(frameOf(idx, "tiss", "nope")).toBeNull();
  });

  it("lets a body be the frame of a trip to what orbits it", () => {
    expect(frameOf(idx, "tamsin", "tiss")).toBe("tamsin");
    expect(frameOf(idx, "pt:tamsin:1:1", "tamsin")).toBe("tamsin");
  });
});

describe("belt error", () => {
  it("holds until at", () => expect(errorAt({ seen: 0, error: 100, at: 3.6e6 }, 2700, 3.6e6)).toBe(100));
  it("grows as time^1.5", () => expect(errorAt({ seen: 0, error: 100, at: 3.6e6 }, 2700, 4 * 3.6e6)).toBeCloseTo(800, 6));
  it("holds for a fresh fit", () => {
    expect(errorAt({ seen: 0, error: 5, at: 300000 }, 2700, 1e12)).toBe(5);
  });
  it("caps at half way round", () => {
    expect(errorAt({ seen: 0, error: 100, at: 3.6e6 }, 2700, 1e12)).toBeCloseTo(Math.PI * 2700, 6);
  });
  it("is lost near the cap", () => {
    expect(isLost(0.9 * Math.PI * 2700, 2700)).toBe(true);
    expect(isLost(0.9 * Math.PI * 2700 - 1, 2700)).toBe(false);
  });
});

describe("legOf and shipFix", () => {
  const ship = { docked: false, from: "tiss", destination: "gannet", progress: 0.5, eta: 100, received: 1000 };
  const near = (a, b) => {
    expect(a[0]).toBeCloseTo(b[0], 6);
    expect(a[1]).toBeCloseTo(b[1], 6);
  };

  it("works out the leg", () => {
    const leg = legOf(idx, ship);
    expect(leg.arrive).toBe(1100000);
    expect(leg.depart).toBe(900000);
    expect(leg.frame).toBe("tamsin");
    near(leg.from, offsetOn(idx.items.get("tiss").orbit, 0, 900000));
    near(leg.to, offsetOn(idx.items.get("gannet").orbit, 0, 1100000));
  });

  it("copes with progress 1", () => {
    const s = { ...ship, progress: 1 };
    const leg = legOf(idx, s);
    expect(leg.depart).toBe(leg.arrive);
    const fix = shipFix(idx, s, 1100000);
    const f = positionOf(idx, "tamsin", 1100000);
    near(fix.pos, [f[0] + leg.to[0], f[1] + leg.to[1]]);
  });

  it("moves midway", () => {
    const leg = legOf(idx, ship);
    const fix = shipFix(idx, ship, 1000000);
    const f = positionOf(idx, "tamsin", 1000000);
    near(fix.pos, [f[0] + (leg.from[0] + leg.to[0]) / 2, f[1] + (leg.from[1] + leg.to[1]) / 2]);
    expect(fix.kind).toBe("moving");
    expect(fix.place).toBe("gannet");
    expect(fix.heading).toBeCloseTo(Math.atan2(leg.to[1] - leg.from[1], leg.to[0] - leg.from[0]), 9);
  });

  it("clamps before and after the leg", () => {
    const leg = legOf(idx, ship);
    const f = positionOf(idx, "tamsin", 5e6);
    near(shipFix(idx, ship, 5e6).pos, [f[0] + leg.to[0], f[1] + leg.to[1]]);
  });

  it("is at a place when docked or at a point", () => {
    const d = shipFix(idx, { docked: true, location: "orrin_station" }, T);
    expect(d).toMatchObject({ kind: "at", place: "orrin_station" });
    near(d.pos, positionOf(idx, "orrin_station", T));
    const p = shipFix(idx, { docked: false, point: "pt:tamsin:1500:-2000" }, T);
    expect(p.kind).toBe("at");
    near(p.pos, positionOf(idx, "pt:tamsin:1500:-2000", T));
  });

  it("is bound when she can't be placed", () => {
    expect(shipFix(idx, { ...ship, from: undefined }, T)).toEqual({ kind: "bound", place: "gannet" });
    expect(shipFix(idx, { ...ship, destination: "nowhere" }, T).kind).toBe("bound");
    expect(shipFix(idx, { ...ship, from: "nowhere" }, T).kind).toBe("bound");
  });

  it("is searching, never moving", () => {
    expect(shipFix(idx, { ...ship, searching: "gannet" }, T)).toEqual({ kind: "searching", place: "gannet" });
  });

  it("is none with nothing", () => {
    expect(shipFix(idx, null, T)).toEqual({ kind: "none" });
    expect(shipFix(idx, { docked: false }, T)).toEqual({ kind: "none" });
  });
});
