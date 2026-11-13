import { describe, expect, it } from "vitest";
import { CELL, faceMid, layoutLand, octagon } from "./land-layout.js";
import { LandStore } from "./land-store.js";

const T = "the Tinners' Track";
const world = { town: [{ e: -4, n: 6 }, { e: 4, n: 6 }, { e: 4, n: -7 }, { e: -4, n: -7 }], joins: { downs: { at: { e: 4.8, n: 1 }, room: "zennor.port-road" } } };
const OPP = { n: "s", ne: "sw", e: "w", se: "nw", s: "n", sw: "ne", w: "e", nw: "se" };
const place = (id, name, x, y, exits = {}) => ({ id, name, x, y, z: 0.4, exits });
/** The path's first point, as numbers. */
const start = (path) => path.match(/^M(-?[\d.e-]+),(-?[\d.e-]+)/).slice(1).map(Number);

// The nine-place grid of /tmp/land-scripts/nine-data.mjs make(false), centred on (0, 0): each
// place joined to all eight neighbours both ways with agreeing dirs (its off-grid stubs left out).
const D = { n: [0, 1], ne: [1, 1], e: [1, 0], se: [1, -1], s: [0, -1], sw: [-1, -1], w: [-1, 0], nw: [-1, 1] };
const NAMES = [
  ["Knoll on the Downs", "Cairn", "Pond on the Downs"],
  ["Old Workings", "Open Ground", "Stony Ground"],
  ["Hollow on the Downs", "Drifted Dust", "Rising Ground"],
];
const nid = (i, j) => `surface.tamsin.9.9.${i + 1}${j + 1}`;
function nine() {
  const places = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const i = c - 1, j = 1 - r;
    const exits = {};
    for (const [d, [dx, dy]] of Object.entries(D)) {
      const ni = i + dx, nj = j + dy;
      if (Math.abs(ni) <= 1 && Math.abs(nj) <= 1) exits[d] = { to: nid(ni, nj), back: OPP[d] };
    }
    places.push(place(nid(i, j), NAMES[r][c], i * 1.2, j * 1.2, exits));
  }
  return places;
}

describe("octagon and faceMid", () => {
  it("draws a regular octagon flat to flat CELL across, with y flipped", () => {
    const pts = octagon(0, 0).match(/-?[\d.]+(e-?\d+)?,-?[\d.]+(e-?\d+)?/g).map((p) => p.split(",").map(Number));
    expect(pts).toHaveLength(8);
    expect(Math.max(...pts.map(([x]) => x))).toBeCloseTo(CELL / 2);
    expect(Math.max(...pts.map(([, y]) => y))).toBeCloseTo(CELL / 2);
    const [x, y] = octagon(2.4, 1.2).match(/^M(-?[\d.]+),(-?[\d.]+)/).slice(1).map(Number);
    expect(y).toBeLessThan(0); // flipped: north is up the screen
    expect(Math.abs(x - 2.4)).toBeLessThan(CELL / 2 + 1e-9);
  });

  it("puts each face's middle half a cell out, toward its compass point", () => {
    const c = { i: 1, j: 0, x: 1.2, y: 0 };
    expect(faceMid(c, "n")).toEqual({ x: 1.2, y: 0.6 });
    const ne = faceMid(c, "sw");
    expect(ne.x).toBeCloseTo(1.2 - 0.6 / Math.SQRT2);
    expect(ne.y).toBeCloseTo(-0.6 / Math.SQRT2);
  });
});

describe("layoutLand", () => {
  it("gives a block of nine 20 ways: 12 doors, 8 diagonals, 4 corner squares and no bends", () => {
    const out = layoutLand(nine(), world);
    expect(out.ways).toHaveLength(20);
    expect(out.ways.filter((w) => w.kind === "door")).toHaveLength(12);
    expect(out.ways.filter((w) => w.kind === "diagonal")).toHaveLength(8);
    expect(out.ways.filter((w) => w.kind === "bend")).toHaveLength(0);
    expect(out.corners).toHaveLength(4);
    expect(out.ways.every((w) => !w.oneWay && !w.chevron && w.track === null)).toBe(true);
    expect(out.stubs).toEqual([]);
    expect(out.cells.get(nid(1, 1))).toEqual({ i: 1, j: 1, x: CELL, y: CELL });
  });

  it("bends a southwest exit to the octagon straight south, leaving by the southwest face", () => {
    const a = place("surface.tamsin.1.1.1", "Cairn", 0, 0, { sw: { to: "surface.tamsin.1.1.2", back: "ne" } });
    const b = place("surface.tamsin.1.1.2", "Hollow", 0.3, -1.3, { ne: { to: a.id, back: "sw" } });
    const out = layoutLand([a, b], world);
    expect(out.ways).toHaveLength(1);
    const [w] = out.ways;
    expect(w).toMatchObject({ a: a.id, b: b.id, kind: "bend", oneWay: false });
    const f = faceMid(out.cells.get(a.id), "sw");
    const [x, y] = start(w.path);
    expect(x).toBeCloseTo(f.x);
    expect(y).toBeCloseTo(-f.y);
    expect(w.path).toContain("C");
    expect(out.corners).toEqual([]);
  });

  it("gives the later of two places in one octagon the nearest free one, the same after a reload", () => {
    const a = place("surface.tamsin.1.1.1", "Cairn", 0.1, 0.1);
    const b = place("surface.tamsin.1.1.2", "Hollow", 0.5, 0.2); // rounds to (0, 0) too, nearer east
    const out = layoutLand([a, b], world);
    expect(out.cells.get(a.id)).toMatchObject({ i: 0, j: 0 });
    expect(out.cells.get(b.id)).toMatchObject({ i: 1, j: 0 });

    const store = new LandStore();
    store.load("Ann", { v: 1, places: [a, b] });
    const first = layoutLand(store.places(), world).cells;
    const again = new LandStore();
    again.load("Ann", store.record());
    expect(layoutLand(again.places(), world).cells).toEqual(first);
    expect(first.get(b.id)).toMatchObject({ i: 1, j: 0 });
  });

  it("marks a way with no exit back one-way, a to b, with a chevron at its middle", () => {
    const a = place("surface.tamsin.1.1.1", "Rising Ground", 0, 0, { e: { to: "surface.tamsin.1.1.2" } });
    const b = place("surface.tamsin.1.1.2", "Hollow", 1.2, 0);
    // b is walked first, so a's being the place with the exit is what makes it a
    const out = layoutLand([b, a], world);
    expect(out.ways).toHaveLength(1);
    const [w] = out.ways;
    expect(w).toMatchObject({ a: a.id, b: b.id, kind: "door", oneWay: true });
    expect(w.chevron.x).toBeCloseTo(0.6);
    expect(w.chevron.y).toBeCloseTo(0);
    expect(w.chevron.angle).toBeCloseTo(0); // pointing east
  });

  it("stubs an exit to an unwalked place 0.45 out, never one into Zennor, and draws a walked road end's road", () => {
    const end = place("surface.tamsin.join.downs", "The Open Downs", 4.8, 1, {
      w: { to: "zennor.port-road", area: "zennor" },
      n: { to: "surface.tamsin.1.1.9", area: "surface.tamsin" },
      e: { to: "surface.tamsin.1.1.8" },
    });
    const out = layoutLand([end], world);
    expect(out.stubs.map((s) => s.dir).sort()).toEqual(["e", "n"]);
    for (const s of out.stubs) expect(Math.hypot(s.x2 - s.x1, s.y2 - s.y1)).toBeCloseTo(0.45);
    const n = out.stubs.find((s) => s.dir === "n");
    const f = faceMid(out.cells.get(end.id), "n");
    expect([n.x1, n.y1]).toEqual([f.x, -f.y]);
    expect(n.y2).toBeLessThan(n.y1); // out to the north, up the screen
    expect(out.zennor.outline).toEqual([{ x: -4, y: -6 }, { x: 4, y: -6 }, { x: 4, y: 7 }, { x: -4, y: 7 }]);
    expect(out.zennor.roads).toHaveLength(1);
    const road = out.zennor.roads[0];
    const w = faceMid(out.cells.get(end.id), "w");
    expect(road).toMatchObject({ id: end.id, x1: w.x, y1: -w.y, x2: 4 });
    expect(road.y2).toBeCloseTo(-w.y);
  });

  it("puts a way between two places on a track, or a road end and one, on the track", () => {
    const end = place("surface.tamsin.join.downs", "The Open Downs", 4.8, 1, { e: { to: "surface.tamsin.1.1.1", back: "w" } });
    const a = place("surface.tamsin.1.1.1", `On ${T}`, 6, 1.2, { w: { to: end.id, back: "e" }, e: { to: "surface.tamsin.1.1.2", back: "w" } });
    const b = place("surface.tamsin.1.1.2", `Bare Rock on ${T}`, 7.2, 1.2, { w: { to: a.id, back: "e" } });
    const out = layoutLand([end, a, b], world);
    const way = (p, q) => out.ways.find((w) => (w.a === p.id && w.b === q.id) || (w.a === q.id && w.b === p.id));
    expect(way(a, b).track).toBe(T);
    expect(way(end, a).track).toBe(T);
    const label = out.labels.find((l) => l.kind === "track");
    expect(label).toMatchObject({ text: T });
    expect(label.angle).toBeGreaterThanOrEqual(-90);
    expect(label.angle).toBeLessThanOrEqual(90);
  });

  it("names a region at the mean of its walked places", () => {
    const a = place("surface.tamsin.1.1.1", "Knoll on the Downs", 2.4, 1.2);
    const out = layoutLand([a], world);
    expect(out.labels).toEqual([{ text: "the Downs", kind: "region", x: 2.4, y: -1.2, angle: 0 }]);
  });

  it("stands a region's name upright only when its walked spread is at least twice as tall as wide", () => {
    const spread = (name, w, h) => [place("surface.tamsin.2.2.1", name, 0, 0), place("surface.tamsin.2.2.2", name, w, h)];
    const angle = (ps) => layoutLand(ps, world).labels.find((l) => l.kind === "region").angle;
    expect(angle(spread("Knoll on the Downs", 9.6, 14.4))).toBe(0); // about 9 by 14 km: level
    expect(angle(spread("River Bank by the Carn", 2.4, 6))).toBe(-90); // about 2 by 6 km: upright
  });
});
