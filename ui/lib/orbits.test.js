import { describe, expect, it } from "vitest";
import { EDGE_KM, frameOf, indexCharts, offsetOn, parentOf, parsePoint, positionOf } from "./orbits.js";

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
});
