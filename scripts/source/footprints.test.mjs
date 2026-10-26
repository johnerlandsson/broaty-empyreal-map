import { describe, expect, it } from "vitest";
import orrin from "../../tests/fixtures/generated/orrin.js";
import { crosses, hullClash, hullClashes, overlaps } from "./footprints.mjs";

const room = (id, x, y, z = 1, fp) => ({ id, cell: { x, y, z }, fp });

describe("overlaps", () => {
  it("finds none among plain cells side by side", () => {
    expect(overlaps([room("a", 0, 0), room("b", 1, 0), room("c", 0, 1)])).toEqual([]);
  });

  it("finds a span reaching into the next cell", () => {
    expect(overlaps([room("a", 0, 0, 1, { span: { starboard: 0.6 } }), room("b", 1, 0)])).toEqual([["a", "b"]]);
  });

  it("doesn't count a span that only touches another cell", () => {
    // a span is in cells past the room's own, so 0.5 reaches half way into the next cell
    expect(overlaps([room("a", 0, 0, 1, { span: { starboard: 1 } }), room("b", 2, 0)])).toEqual([]);
    expect(overlaps([room("a", 0, 0, 1, { span: { starboard: 0.5 } }), room("b", 1, 0)])).toEqual([["a", "b"]]);
  });

  it("only compares rooms on the same deck", () => {
    expect(overlaps([room("a", 0, 0, 1, { span: { fore: 1 } }), room("b", 0, 1, 2)])).toEqual([]);
  });

  it("clears a concave outline whose notch takes the other's corner", () => {
    // an L in the cell, reaching into the cell fore and starboard, but not into the corner cell
    const l = { outline: [[-0.5, -0.5], [1.5, -0.5], [1.5, 0.5], [0.5, 0.5], [0.5, 1.5], [-0.5, 1.5]] };
    expect(overlaps([room("a", 0, 0, 1, l), room("b", 1, 1)])).toEqual([]);
    expect(overlaps([room("a", 0, 0, 1, l), room("b", 1, 0)])).toEqual([["a", "b"]]);
  });

  it("doesn't count a cut corner meeting a rounded one", () => {
    expect(overlaps([room("a", 0, 0, 1, { corners: "cut" }), room("b", 1, 1, 1, { corners: "rounded" })])).toEqual([]);
  });
});

describe("crosses", () => {
  it("is true for a self-crossing outline", () => {
    expect(crosses([[0, 0], [1, 1], [1, 0], [0, 1]])).toBe(true);
  });

  it("is false for a simple one, convex or not", () => {
    expect(crosses([[0, 0], [1, 0], [0.8, 1], [0.2, 1]])).toBe(false);
    expect(crosses([[0, 0], [1, 0], [1, 1], [0.5, 0.2], [0, 1]])).toBe(false);
  });
});

describe("hullClash", () => {
  // the mockup's deck 3 for Orrin: a cross round its rooms, 0.12 outside the cells, the nose chamfered 0.3
  const M = 0.5 + 0.12;
  const deck3 = [
    [-M, 1 - M], [M, 1 - M], [M, 2 - M], [1 + M, 2 - M], [1 + M, 2 + M], [M, 2 + M],
    [M, 3 + M - 0.3], [M - 0.3, 3 + M], [-M + 0.3, 3 + M], [-M, 3 + M - 0.3],
    [-M, 2 + M], [-1 - M, 2 + M], [-1 - M, 2 - M], [-M, 2 - M],
  ];
  const look = (hull, extra = {}) => ({ ...orrin.look, footprints: {}, hull, ...extra });

  it("passes Orrin's deck 3 in the mockup's hull, the chamfer trimming the Berths' cell corner", () => {
    expect(hullClash(orrin.rooms, look({ 3: deck3 }))).toBeNull();
  });

  it("finds a room the hull cuts 0.15 into", () => {
    const short = deck3.map(([x, y]) => [x, y > 3 ? 3.35 : y]);
    expect(hullClash(orrin.rooms, look({ 3: short }))).toEqual({ deck: "3", room: "orrin.berth" });
  });

  it("finds a cradle whose side misses the hull, and a mast off the top deck's hull", () => {
    const narrow = [[-M, 1 - M], [M, 1 - M], [M, 3 + M], [-M, 3 + M]];
    expect(hullClash(orrin.rooms.filter((r) => r.at.side === 0), look({ 3: narrow }))).toEqual({ deck: "3", fixture: 2, type: "cradle" });
    const mast = (side) => ({ type: "mast", side, frame: 2, height: 1 });
    expect(hullClash(orrin.rooms, look({ 3: deck3 }, { fixtures: [mast(1)] }))).toBeNull();
    expect(hullClash(orrin.rooms, look({ 3: deck3 }, { fixtures: [mast(1), { ...mast(1), frame: 3 }] }))).toEqual({ deck: "3", fixture: 1, type: "mast" });
  });

  it("finds nothing for a rounded or cut room at any r in a hull round its cell (S14)", () => {
    const rooms = [{ id: "x.a", at: { deck: 1, frame: 0, side: 0 } }];
    const hull = { 1: [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]] };
    for (const corners of ["rounded", "cut"]) {
      for (const r of [0, 0.02, 0.05, 0.1, 0.15, 0.3, 0.45]) {
        expect(hullClash(rooms, { hull, footprints: { a: { corners, r } }, fixtures: [] }), `${corners} ${r}`).toBeNull();
      }
    }
  });
});

describe("hullClashes, ship fixtures and greebles", () => {
  // a skiff-like hull round one cockpit at frame 1, its nose a point at frame 2
  const hull = { 1: [[-1, -0.5], [1, -0.5], [1, 1.5], [0, 2], [-1, 1.5]] };
  const rooms = [{ id: "s.cockpit", at: { deck: 1, frame: 1, side: 0 } }, { id: "s.hold", at: { deck: 1, frame: 0, side: 0 } }];
  const look = (fixtures, greebles = []) => ({ hull, footprints: {}, fixtures, greebles });

  it("passes bells and a boom on the hull's line, props inside it, chevrons on a wall it has, greebles on its roof", () => {
    const fixtures = [
      { type: "bell", side: -0.5, deck: 1, r: 0.2, len: 0.4 },
      { type: "boom", side: 0, deck: 1, len: 0.8 },
      { type: "prop", kind: "crate", room: "hold", at: [0, -0.1], size: [0.3, 0.3], grid: [3, 1], gap: 0.1 },
      { type: "chevrons", room: "hold", wall: "port" },
    ];
    expect(hullClashes(rooms, look(fixtures, [{ type: "vent", side: 0.5, frame: 1 }]))).toEqual([]);
  });

  it("finds a bell or boom whose side misses the hull", () => {
    const fixtures = [{ type: "bell", side: 1.5, deck: 1, r: 0.2, len: 0.4 }, { type: "boom", side: -2, deck: 1, len: 0.8 }];
    expect(hullClashes(rooms, look(fixtures))).toEqual([{ deck: "1", fixture: 0, type: "bell" }, { deck: "1", fixture: 1, type: "boom" }]);
  });

  it("finds a prop reaching out of the hull, any of its grid", () => {
    const fixtures = [{ type: "prop", kind: "crate", room: "hold", at: [0, 0], size: [0.4, 0.3], grid: [5, 1], gap: 0.1 }];
    expect(hullClashes(rooms, look(fixtures))).toEqual([{ deck: "1", fixture: 0, type: "prop" }]);
  });

  it("finds a greeble off the top deck's hull", () => {
    expect(hullClashes(rooms, look([], [{ type: "vent", side: 0, frame: 0 }, { type: "dish", side: 0.9, frame: 1.9, r: 0.1 }]))).toEqual([{ deck: "1", greeble: 1, type: "dish" }]);
  });

  it("leaves a prop or chevrons for a missing room to the orphans", () => {
    const fixtures = [{ type: "prop", kind: "crate", room: "gone", at: [5, 5], size: [0.3, 0.3] }, { type: "chevrons", room: "gone", wall: "aft" }];
    expect(hullClashes(rooms, look(fixtures))).toEqual([]);
  });
});
