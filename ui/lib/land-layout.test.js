import { describe, expect, it } from "vitest";
import { faceMid, layoutLand as spreadLand, OCT, octagon, SPREAD } from "./land-layout.js";
import { LandStore } from "./land-store.js";

// The layout's geometry at true spots; the spread itself is pinned on its own.
const layoutLand = (places, world, opts) => spreadLand(places, world, { spread: 1, ...opts });

const T = "the Tinners' Track";
const world = { town: [{ e: -4, n: 6 }, { e: 4, n: 6 }, { e: 4, n: -7 }, { e: -4, n: -7 }], joins: { downs: { at: { e: 4.8, n: 1 }, room: "zennor.port-road" } } };
const OPP = { n: "s", ne: "sw", e: "w", se: "nw", s: "n", sw: "ne", w: "e", nw: "se" };
const UNIT = { n: [0, 1], ne: [1, 1], e: [1, 0], se: [1, -1], s: [0, -1], sw: [-1, -1], w: [-1, 0], nw: [-1, 1] };
const place = (id, name, x, y, exits = {}) => ({ id, name, x, y, z: 0.4, exits });
/** The points of a path, in order: [[x, y], …] in the SVG's frame. */
const pts = (d) => d.match(/-?[\d.]+,-?[\d.]+/g).map((p) => p.split(",").map(Number));
const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);

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
  it("gives a block of nine 20 ways, each one curve square out of both faces its exits name", () => {
    const out = layoutLand(nine(), world);
    expect(out.ways).toHaveLength(20);
    expect(out.ways.every((w) => !w.oneWay && !w.chevron && w.track === null)).toBe(true);
    for (const w of out.ways) {
      const A = out.spots.get(w.a), B = out.spots.get(w.b);
      expect(w.path).toMatch(/^M\S+ C\S+ \S+ \S+$/);
      const [f1, c1, c2, f2] = pts(w.path);
      const dx = Math.sign(B.x - A.x), dy = Math.sign(B.y - A.y), u = Math.hypot(dx, dy);
      // it starts at the middle of a's face toward b, and ends at the middle of b's toward a
      expect(f1[0]).toBeCloseTo(A.x + (dx / u) * (OCT / 2));
      expect(-f1[1]).toBeCloseTo(A.y + (dy / u) * (OCT / 2));
      expect(f2[0]).toBeCloseTo(B.x - (dx / u) * (OCT / 2));
      expect(-f2[1]).toBeCloseTo(B.y - (dy / u) * (OCT / 2));
      // pulled square out of each face by 0.42 of the gap between them, and never less than 0.12:
      // side by side the faces are 0.24 apart, corner to corner 1.2 * √2 − 0.96
      const pull = Math.max(0.12, 0.42 * (1.2 * u - OCT));
      expect(c1[0]).toBeCloseTo(f1[0] + (dx / u) * pull);
      expect(-c1[1]).toBeCloseTo(-f1[1] + (dy / u) * pull);
      expect(c2[0]).toBeCloseTo(f2[0] - (dx / u) * pull);
      expect(-c2[1]).toBeCloseTo(-f2[1] - (dy / u) * pull);
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
    // out of a's southwest face and into b's northeast face, pulled square out of each
    const [f1, c1, c2, f2] = pts(w.path);
    const h = OCT / 2 / Math.SQRT2, s = (0.42 * dist(f1, f2)) / Math.SQRT2;
    expect(f1[0]).toBeCloseTo(-h); expect(f1[1]).toBeCloseTo(h);
    expect(c1[0]).toBeCloseTo(-h - s); expect(c1[1]).toBeCloseTo(h + s);
    expect(f2[0]).toBeCloseTo(-0.8 + h); expect(f2[1]).toBeCloseTo(1.2 - h);
    expect(c2[0]).toBeCloseTo(-0.8 + h + s); expect(c2[1]).toBeCloseTo(1.2 - h - s);
    expect(faceLeft(out.spots.get(a.id), out.spots.get(b.id))).toBe("sw");
    expect(faceLeft(out.spots.get(b.id), out.spots.get(a.id))).toBe("ne");
  });

  it("pulls a long way's curve no further than 0.75 out of its faces", () => {
    const a = place("surface.tamsin.1.1.1", "Cairn", 0, 0, { e: { to: "surface.tamsin.1.1.2", back: "w" } });
    const b = place("surface.tamsin.1.1.2", "Hollow", 4, 0.4, { w: { to: a.id, back: "e" } });
    const [w] = layoutLand([a, b], world).ways;
    const [f1, c1, c2, f2] = pts(w.path);
    expect(c1).toEqual([expect.closeTo(f1[0] + 0.75), expect.closeTo(f1[1])]);
    expect(c2).toEqual([expect.closeTo(f2[0] - 0.75), expect.closeTo(f2[1])]);
  });

  it("runs a track straight from middle to middle, and names it along that line", () => {
    const a = place("surface.tamsin.1.1.1", `On ${T}`, 0, 0, { e: { to: "surface.tamsin.1.1.2", back: "w" } });
    const b = place("surface.tamsin.1.1.2", `Bare Rock on ${T}`, 1.4, 0.4, { w: { to: a.id, back: "e" } });
    const out = layoutLand([a, b], world);
    expect(out.ways[0]).toMatchObject({ track: T, path: "M0,0 L1.4,-0.4", there: "L1.4,-0.4", back: "L0,0" });
    const name = out.labels.find((l) => l.kind === "track");
    expect(name).toMatchObject({ text: T, x: expect.closeTo(0.7), y: expect.closeTo(-0.2) });
    expect(name.angle).toBeCloseTo((Math.atan2(-0.4, 1.4) * 180) / Math.PI);
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
    for (const [d, e] of Object.entries(mid.exits)) {
      expect(faceLeft(out.spots.get(mid.id), out.spots.get(e.to))).toBe(d);
      // the curve starts at the middle of that face, heading square out of it
      const w = out.ways.find((v) => v.b === e.to);
      const [f1, c1] = pts(w.path), len = Math.hypot(...UNIT[d]);
      expect(f1[0]).toBeCloseTo(10 + (UNIT[d][0] / len) * (OCT / 2));
      expect(-f1[1]).toBeCloseTo(10 + (UNIT[d][1] / len) * (OCT / 2));
      expect((c1[0] - f1[0]) * UNIT[d][1] - (f1[1] - c1[1]) * UNIT[d][0]).toBeCloseTo(0);
    }
  });

  it("spreads the land 1.3× from Zennor's point, Zennor's block with it, octagons the same size", () => {
    expect(SPREAD).toBe(1.3);
    const a = place("surface.tamsin.1.1.1", "Cairn", 2, -1, { e: { to: "surface.tamsin.1.1.2", back: "w" } });
    const b = place("surface.tamsin.1.1.2", "Hollow", 3.2, -1, { w: { to: a.id, back: "e" } });
    const out = spreadLand([a, b], world);
    expect(out.spots.get(a.id)).toEqual({ x: 2.6, y: -1.3 });
    expect(out.spots.get(b.id)).toEqual({ x: 4.16, y: -1.3 });
    expect(out.zennor.outline[0]).toEqual({ x: expect.closeTo(-5.2), y: expect.closeTo(-7.8) }); // (−4, 6), y flipped
    // the way still runs face to face of 0.96 km octagons: a's east face at 2.6 + 0.48
    expect(out.ways[0].path.startsWith("M3.08,1.3 C")).toBe(true);
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

  it("marks a way with no exit back one-way, a to b: a curve into b's middle, its chevron in the gap", () => {
    const a = place("surface.tamsin.1.1.1", "Rising Ground", 0, 0, { e: { to: "surface.tamsin.1.1.2" } });
    const b = place("surface.tamsin.1.1.2", "Hollow", 1.2, 0);
    // b is walked first, so a's being the place with the exit is what makes it a
    const out = layoutLand([b, a], world);
    expect(out.ways).toHaveLength(1);
    const [w] = out.ways;
    expect(w).toMatchObject({ a: a.id, b: b.id, oneWay: true });
    // out of a's east face (0.48), pulled 0.42 of the 0.72 to b's middle, and on into it
    expect(w.path).toBe("M0.48,0 Q0.7824,0 1.2,0");
    expect(w.there).toBe("L0.48,0 Q0.7824,0 1.2,0");
    expect(w.back).toBe("Q0.7824,0 0.48,0 L0,0");
    // the chevron sits between the octagons (a's face at 0.48, b's at 0.72), pointing east
    expect(w.chevron.x).toBeGreaterThan(0.5);
    expect(w.chevron.x).toBeLessThan(0.7);
    expect(w.chevron.y).toBeCloseTo(0);
    expect(w.chevron.angle).toBeCloseTo(0);
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
