import { describe, expect, it } from "vitest";
import { faceMid, layoutLand, OCT, octagon } from "./land-layout.js";
import { LandStore } from "./land-store.js";

const T = "the Tinners' Track";
const world = { town: [{ e: -4, n: 6 }, { e: 4, n: 6 }, { e: 4, n: -7 }, { e: -4, n: -7 }], joins: { downs: { at: { e: 4.8, n: 1 }, room: "zennor.port-road" } } };
const OPP = { n: "s", ne: "sw", e: "w", se: "nw", s: "n", sw: "ne", w: "e", nw: "se" };
const UNIT = { n: [0, 1], ne: [1, 1], e: [1, 0], se: [1, -1], s: [0, -1], sw: [-1, -1], w: [-1, 0], nw: [-1, 1] };
const place = (id, name, x, y, exits = {}) => ({ id, name, x, y, z: 0.4, exits });
/** The compass point whose face of a's octagon the straight line from a to b leaves by (north-up spots). */
function faceLeft(a, b) {
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return ["e", "ne", "n", "nw", "w", "sw", "s", "se"][((Math.round(ang / 45) % 8) + 8) % 8];
}

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
  it("draws a regular octagon flat to flat OCT across, with y flipped", () => {
    const pts = octagon(0, 0).match(/-?[\d.]+(e-?\d+)?,-?[\d.]+(e-?\d+)?/g).map((p) => p.split(",").map(Number));
    expect(pts).toHaveLength(8);
    expect(Math.max(...pts.map(([x]) => x))).toBeCloseTo(OCT / 2);
    expect(Math.max(...pts.map(([, y]) => y))).toBeCloseTo(OCT / 2);
    const [x, y] = octagon(2.4, 1.2).match(/^M(-?[\d.]+),(-?[\d.]+)/).slice(1).map(Number);
    expect(y).toBeLessThan(0); // flipped: north is up the screen
    expect(Math.abs(x - 2.4)).toBeLessThan(OCT / 2 + 1e-9);
  });

  it("is small enough that two places as close as the game puts them (1.1 km) don't touch", () => {
    expect(OCT).toBeLessThan(1.1);
  });

  it("puts each face's middle half an octagon out, toward its compass point", () => {
    const c = { x: 1.2, y: 0 };
    expect(faceMid(c, "n")).toEqual({ x: 1.2, y: OCT / 2 });
    const sw = faceMid(c, "sw");
    expect(sw.x).toBeCloseTo(1.2 - OCT / 2 / Math.SQRT2);
    expect(sw.y).toBeCloseTo(-OCT / 2 / Math.SQRT2);
  });
});

describe("layoutLand", () => {
  it("gives a block of nine 20 ways, each square out of both faces its exits name and straight between", () => {
    const out = layoutLand(nine(), world);
    expect(out.ways).toHaveLength(20);
    expect(out.ways.every((w) => !w.oneWay && !w.chevron && w.track === null)).toBe(true);
    for (const w of out.ways) {
      const A = out.spots.get(w.a), B = out.spots.get(w.b);
      // places 1.2 apart: the faces are 0.24 apart (0.24 * √2 corner to corner), so each end is a third of that
      expect(w.points).toHaveLength(6);
      expect(w.points[0]).toEqual({ x: A.x, y: -A.y || 0 });
      expect(w.points[5]).toEqual({ x: B.x, y: -B.y || 0 });
      const dx = Math.sign(B.x - A.x), dy = Math.sign(B.y - A.y), u = Math.hypot(dx, dy);
      const [f1, e1, e2, f2] = w.points.slice(1, 5);
      expect(f1.x).toBeCloseTo(A.x + (dx / u) * (OCT / 2));
      expect(-f1.y).toBeCloseTo(A.y + (dy / u) * (OCT / 2));
      const gap = 1.2 * Math.hypot(dx, dy) - OCT;
      expect(Math.hypot(e1.x - f1.x, e1.y - f1.y)).toBeCloseTo(gap / 3);
      expect(Math.hypot(e2.x - f2.x, e2.y - f2.y)).toBeCloseTo(gap / 3);
      expect(w.path.startsWith(`M${+f1.x.toFixed(4)},`)).toBe(true); // a plain way starts at the face
      expect(w.path.split(" L")).toHaveLength(4);
    }
    expect(out.stubs).toEqual([]);
    expect(out.spots.get(nid(1, 1))).toEqual({ x: 1.2, y: 1.2 });
  });

  it("puts each place at its true spot, off any grid, so a way leaves by the side its exit names", () => {
    // on a 1.2 km tiling b would sit straight south of a, against a's southwest exit
    const a = place("surface.tamsin.1.1.1", "Cairn", 0, 0, { sw: { to: "surface.tamsin.1.1.2", back: "ne" } });
    const b = place("surface.tamsin.1.1.2", "Hollow", -0.8, -1.2, { ne: { to: a.id, back: "sw" } });
    const out = layoutLand([a, b], world);
    expect(out.spots.get(a.id)).toEqual({ x: 0, y: 0 });
    expect(out.spots.get(b.id)).toEqual({ x: -0.8, y: -1.2 });
    expect(out.ways).toHaveLength(1);
    const [w] = out.ways;
    expect(w).toMatchObject({ a: a.id, b: b.id, oneWay: false });
    // out of a's southwest face and into b's northeast face, square out of each: the faces are only
    // about 0.54 apart, so each end is a third of that, not the full 0.3
    const [, f1, e1, e2, f2] = w.points;
    const h = OCT / 2 / Math.SQRT2, s = Math.hypot(f2.x - f1.x, f2.y - f1.y) / 3 / Math.SQRT2;
    expect(s * Math.SQRT2).toBeLessThan(0.3);
    expect(f1.x).toBeCloseTo(-h); expect(f1.y).toBeCloseTo(h);
    expect(e1.x).toBeCloseTo(-h - s); expect(e1.y).toBeCloseTo(h + s);
    expect(f2.x).toBeCloseTo(-0.8 + h); expect(f2.y).toBeCloseTo(1.2 - h);
    expect(e2.x).toBeCloseTo(-0.8 + h + s); expect(e2.y).toBeCloseTo(1.2 - h - s);
    expect(faceLeft(out.spots.get(a.id), out.spots.get(b.id))).toBe("sw");
    expect(faceLeft(out.spots.get(b.id), out.spots.get(a.id))).toBe("ne");
  });

  it("gives every way of a walk a line out of the face its exit names", () => {
    // a ring of eight round a middle place, each a little off its compass point
    const mid = place("surface.tamsin.3.3.0", "Open Ground", 10, 10);
    const ring = Object.entries(UNIT).map(([d, [dx, dy]], k) => {
      const len = Math.hypot(dx, dy), turn = ((k % 2 ? 1 : -1) * 15 * Math.PI) / 180;
      const x = (dx / len) * 2.2, y = (dy / len) * 2.2;
      const p = place(`surface.tamsin.3.3.${k + 1}`, "Hollow", 10 + x * Math.cos(turn) - y * Math.sin(turn), 10 + x * Math.sin(turn) + y * Math.cos(turn), { [OPP[d]]: { to: mid.id, back: d } });
      mid.exits[d] = { to: p.id, back: OPP[d] };
      return p;
    });
    const out = layoutLand([mid, ...ring], world);
    expect(out.ways).toHaveLength(8);
    for (const [d, e] of Object.entries(mid.exits)) expect(faceLeft(out.spots.get(mid.id), out.spots.get(e.to))).toBe(d);
    // 2.2 km apart: room for the full 0.3 square out of each face
    for (const w of out.ways) {
      const [, f1, e1, e2, f2] = w.points;
      expect(Math.hypot(e1.x - f1.x, e1.y - f1.y)).toBeCloseTo(0.3);
      expect(Math.hypot(e2.x - f2.x, e2.y - f2.y)).toBeCloseTo(0.3);
    }
  });

  it("lays a walk out the same after a reload", () => {
    const a = place("surface.tamsin.1.1.1", "Cairn", 0.4, 0.4);
    const b = place("surface.tamsin.1.1.2", "Hollow", 1.2, 1.2, { sw: { to: a.id } });
    const store = new LandStore();
    store.load("Ann", { v: 1, places: [a, b] });
    const first = layoutLand(store.places(), world);
    const again = new LandStore();
    again.load("Ann", store.record());
    expect(layoutLand(again.places(), world)).toEqual(first);
    expect(first.spots.get(b.id)).toEqual({ x: 1.2, y: 1.2 });
  });

  it("marks a way with no exit back one-way, a to b, with a chevron between its end and b's middle", () => {
    const a = place("surface.tamsin.1.1.1", "Rising Ground", 0, 0, { e: { to: "surface.tamsin.1.1.2" } });
    const b = place("surface.tamsin.1.1.2", "Hollow", 1.2, 0);
    // b is walked first, so a's being the place with the exit is what makes it a
    const out = layoutLand([b, a], world);
    expect(out.ways).toHaveLength(1);
    const [w] = out.ways;
    expect(w).toMatchObject({ a: a.id, b: b.id, oneWay: true });
    // out of a's east face (0.48), a third of the 0.72 to b's middle on to 0.72 (under the full 0.3), then on to 1.2
    expect(w.points.map((p) => p.x)).toEqual([0, 0.48, 0.72, 1.2].map((x) => expect.closeTo(x)));
    expect(w.chevron.x).toBeCloseTo(0.96);
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
    const f = faceMid(out.spots.get(end.id), "n");
    expect([n.x1, n.y1]).toEqual([f.x, -f.y]);
    expect(n.y2).toBeLessThan(n.y1); // out to the north, up the screen
    expect(out.zennor.outline).toEqual([{ x: -4, y: -6 }, { x: 4, y: -6 }, { x: 4, y: 7 }, { x: -4, y: 7 }]);
    expect(out.zennor.roads).toHaveLength(1);
    const road = out.zennor.roads[0];
    const w = faceMid(out.spots.get(end.id), "w");
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

  it("gives a north-south track's name the same angle whichever way it was walked", () => {
    const south = place("surface.tamsin.1.1.1", `On ${T}`, 6, 0, { n: { to: "surface.tamsin.1.1.2", back: "s" } });
    const north = place("surface.tamsin.1.1.2", `Bare Rock on ${T}`, 6, 1.2, { s: { to: south.id, back: "n" } });
    const angle = (ps) => layoutLand(ps, world).labels.find((l) => l.kind === "track").angle;
    expect(angle([south, north])).toBe(angle([north, south]));
    expect(angle([south, north])).toBe(-90);
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
