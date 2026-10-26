import { describe, expect, it } from "vitest";
import { boundsOf, noseAt, outlineOf, pathOf } from "./footprint.js";

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

describe("pathOf", () => {
  it("keeps a path with no rounded corner as given, counter-clockwise", () => {
    expect(pathOf([[0, 0], [2, 0], [2, 2], [0, 2]])).toEqual([[0, 0], [2, 0], [2, 2], [0, 2]]);
    expect(area2(pathOf([[0, 0], [0, 2], [2, 2], [2, 0]]))).toBeGreaterThan(0);
  });

  it("expands a rounded corner to 4 points on its arc, inside the same bounds", () => {
    const pts = pathOf([[0, 0], [2, 0], [2, 2, 0.5], [0, 2]]);
    expect(pts).toHaveLength(7);
    const b = boundsOf(pts);
    for (const [k, v] of Object.entries({ x0: 0, x1: 2, y0: 0, y1: 2 })) expect(b[k]).toBeCloseTo(v, 9);
    for (const [x, y] of pts.slice(2, 6)) expect(Math.hypot(x - 1.5, y - 1.5)).toBeCloseTo(0.5, 9);
    expect(pts[2][0]).toBeCloseTo(2, 9);
    expect(pts[2][1]).toBeCloseTo(1.5, 9);
  });

  it("rounds a corner the same way round a clockwise path", () => {
    const pts = pathOf([[0, 2], [2, 2, 0.5], [2, 0], [0, 0]]);
    expect(pts).toHaveLength(7);
    expect(area2(pts)).toBeGreaterThan(0);
    for (const [x, y] of pts.filter(([x, y]) => x > 1.5 && y > 1.5)) expect(Math.hypot(x - 1.5, y - 1.5)).toBeCloseTo(0.5, 9);
  });
});

describe("noseAt", () => {
  // a cross: a body from frame 0 to 2, and a nose at side 0 to frame 4
  const cross = [[-1, 0], [1, 0], [1, 2], [0.5, 2], [0.5, 4], [-0.5, 4], [-0.5, 2], [-1, 2]];

  it("is the path's largest frame on the line at side x", () => {
    expect(noseAt(cross, 0)).toBe(4);
    expect(noseAt(cross, 0.8)).toBe(2);
    expect(noseAt(cross, 0.5)).toBe(4);
    expect(noseAt(cross, 1)).toBe(2);
  });

  it("is null where the path doesn't reach x", () => {
    expect(noseAt(cross, 1.2)).toBeNull();
  });
});
