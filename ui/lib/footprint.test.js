import { describe, expect, it } from "vitest";
import { boundsOf, outlineOf } from "./footprint.js";

const UNIT = { x0: -0.5, x1: 0.5, y0: -0.5, y1: 0.5 };

/** Twice the signed area: positive for counter-clockwise. */
const area2 = (pts) => pts.reduce((s, [x, y], i) => {
  const [u, v] = pts[(i + 1) % pts.length];
  return s + x * v - u * y;
}, 0);

describe("outlineOf", () => {
  it("is the unit square with no footprint", () => {
    expect(outlineOf()).toEqual([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]);
  });

  it("reaches a span's cells past its own", () => {
    expect(boundsOf(outlineOf({ span: { aft: 1 } }))).toEqual({ x0: -0.5, x1: 0.5, y0: -1.5, y1: 0.5 });
    expect(boundsOf(outlineOf({ span: { port: 0.5, starboard: 1, fore: 2 } }))).toEqual({ x0: -1, x1: 1.5, y0: -0.5, y1: 2.5 });
  });

  it("cuts each corner, inside the same bounds", () => {
    const pts = outlineOf({ corners: "cut" });
    expect(pts).toHaveLength(8);
    expect(boundsOf(pts)).toEqual(UNIT);
    expect(pts).toContainEqual([-0.3, -0.5]);
    expect(pts).toContainEqual([-0.5, -0.3]);
  });

  it("rounds each corner, inside the same bounds", () => {
    const pts = outlineOf({ corners: "rounded" });
    expect(pts).toHaveLength(16);
    const b = boundsOf(pts);
    for (const k of Object.keys(UNIT)) expect(b[k]).toBeCloseTo(UNIT[k], 9);
    for (const [x, y] of pts.filter(([x, y]) => x > 0.3 && y > 0.3)) expect(Math.hypot(x - 0.3, y - 0.3)).toBeCloseTo(0.2, 9);
  });

  it("takes r for the corners", () => {
    expect(outlineOf({ corners: "cut", r: 0.1 })).toContainEqual([0.5, 0.4]);
  });

  it("is counter-clockwise", () => {
    for (const fp of [undefined, { corners: "cut" }, { corners: "rounded", span: { fore: 1 } }]) expect(area2(outlineOf(fp))).toBeGreaterThan(0);
    expect(area2(outlineOf({ outline: [[0, 0], [0, 1], [1, 0]] }))).toBeGreaterThan(0);
  });

  it("returns an outline as given, ignoring span and corners", () => {
    const outline = [[0, 0], [1, 0], [0.8, 1], [0.2, 1]];
    expect(outlineOf({ outline, span: { aft: 1 }, corners: "cut" })).toEqual(outline);
  });
});
