import { describe, expect, it } from "vitest";
import { crosses, overlaps } from "./footprints.mjs";

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
