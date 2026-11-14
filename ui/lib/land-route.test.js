// Finding your way on the walked land (spec, "Finding your way"): the route's line through the
// octagons' middles, the nearest walked road end by steps, and where the "← Zennor" card sits.

import { describe, expect, it } from "vitest";
import { layoutLand } from "./land-layout.js";
import { edgeCard, nearestRoadEnd, routePath } from "./land-route.js";
import { LandStore } from "./land-store.js";

const world = { town: [{ e: -4, n: 6 }, { e: 4, n: 6 }, { e: 4, n: -7 }, { e: -4, n: -7 }], joins: {} };
const place = (id, x, y, exits = {}) => ({ id, name: "Open Ground", x, y, z: 0.4, exits });
const points = (d) => d.match(/-?[\d.]+,-?[\d.]+/g);

describe("routePath", () => {
  it("runs from middle to middle along the ways: three places in a row", () => {
    const places = [
      place("a", 6, 0, { e: { to: "b", back: "w" } }),
      place("b", 7.2, 0, { w: { to: "a", back: "e" }, e: { to: "c", back: "w" } }),
      place("c", 8.4, 0, { w: { to: "b", back: "e" } }),
    ];
    const d = routePath(["a", "b", "c"], layoutLand(places, world));
    expect(d.startsWith("M")).toBe(true);
    const xs = points(d).map((p) => +p.split(",")[0]);
    expect(xs[0]).toBe(6);
    expect(xs).toContain(7.2);
    expect(xs.at(-1)).toBe(8.4);
    expect(points(d).every((p) => p.endsWith(",0"))).toBe(true);
    expect(xs).toEqual([...xs].sort((p, q) => p - q));
  });

  it("follows the way's curve out of and into the faces its exits name, the same either way", () => {
    const places = [place("a", 6, 0, { e: { to: "b", back: "sw" } }), place("b", 7.6, 0.8, { sw: { to: "a", back: "e" } })];
    const L = layoutLand(places, world);
    const there = routePath(["a", "b"], L);
    expect(there).toBe(`M6,0 ${L.ways[0].there}`);
    expect(there).toMatch(/^M6,0 L6\.48,0 C\S+ \S+ \S+ L7\.2,-1\.2$/); // a's east face, a curve, b's middle (its cell)
    expect(points(routePath(["b", "a"], L))).toEqual([...points(there)].reverse());
  });
});

describe("nearestRoadEnd", () => {
  it("picks the road end fewest steps away, not the one nearest on the ground", () => {
    const store = new LandStore();
    const H = "surface.tamsin.1.1.1", NEAR = "surface.tamsin.join.near", FAR = "surface.tamsin.join.far";
    const X = "surface.tamsin.1.1.2", Y = "surface.tamsin.1.1.3";
    // NEAR is one octagon east on the ground, but only reached round by X and Y; FAR is a long way west, one step
    store.ingest({ id: NEAR, name: "Near", coords: { x: 1.2, y: 0 }, exits: { s: { id: Y } } });
    store.ingest({ id: Y, name: "Y", coords: { x: 1.2, y: -2.4 }, exits: { n: { id: NEAR }, w: { id: X } } });
    store.ingest({ id: X, name: "X", coords: { x: 0, y: -2.4 }, exits: { e: { id: Y }, n: { id: H } } });
    store.ingest({ id: FAR, name: "Far", coords: { x: -6, y: 0 }, exits: { e: { id: H } } });
    store.ingest({ id: H, name: "Here", coords: { x: 0, y: 0 }, exits: { w: { id: FAR }, s: { id: X } } });
    expect(nearestRoadEnd(store, H)).toBe(FAR);
  });

  it("is null with no walked road end you can reach", () => {
    const store = new LandStore();
    store.ingest({ id: "surface.tamsin.join.x", name: "End", coords: { x: 1.2, y: 0 }, exits: {} });
    store.ingest({ id: "surface.tamsin.1.1.1", name: "Here", coords: { x: 0, y: 0 }, exits: {} });
    expect(nearestRoadEnd(store, "surface.tamsin.1.1.1")).toBe(null);
  });
});

describe("edgeCard", () => {
  const zennor = { x: -4, y: -6, w: 8, h: 13 };

  it("is null while any of Zennor's block is in view", () => {
    expect(edgeCard({ x: 2, y: -2, w: 20, h: 15 }, zennor)).toBe(null);
    expect(edgeCard({ x: -10, y: -10, w: 30, h: 30 }, zennor)).toBe(null);
  });

  it("sits on the left edge, toward Zennor, with Zennor to the west", () => {
    const c = edgeCard({ x: 20, y: -5, w: 20, h: 15 }, zennor);
    expect(c.side).toBe("left");
    expect(c.x).toBeCloseTo(20);
    expect(c.y).toBeGreaterThanOrEqual(-5);
    expect(c.y).toBeLessThanOrEqual(10);
  });

  it("sits on the top edge with Zennor well to the north", () => {
    expect(edgeCard({ x: -5, y: 30, w: 20, h: 15 }, zennor).side).toBe("top");
  });
});
