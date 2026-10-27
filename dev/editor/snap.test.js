// Where a dragged hull point lands: a point's x or y, a cell's edge or its margin, the grid, or free.

import { describe, expect, it } from "vitest";
import { snapPoint } from "./snap.js";

const reach = [0.05, 0.05];

describe("snapping a hull point", () => {
  it("falls to the 0.05 grid where nothing is in reach", () => {
    expect(snapPoint([0.23, 1.07], { reach })).toEqual({ at: [0.25, 1.05], ties: [] });
  });

  it("goes to a cell's edge, or the traced hull's margin off one", () => {
    expect(snapPoint([0.53, 1.84], { reach }).at).toEqual([0.5, 1.85]);
    expect(snapPoint([0.6, 2.64], { reach }).at).toEqual([0.62, 2.62]);
    expect(snapPoint([-1.6, -0.41], { reach }).at).toEqual([-1.62, -0.38]);
  });

  it("lines up with a point's x or y, each axis on its own, naming the tie", () => {
    const points = [
      { at: [1.62, 2.62], label: "Deck 3 · point 4" },
      { at: [-1.62, 2.66], label: "point 3" },
    ];
    expect(snapPoint([1.6, 2.65], { points, reach })).toEqual({
      at: [1.62, 2.66],
      ties: [
        { axis: 0, to: [1.62, 2.62], label: "Deck 3 · point 4" },
        { axis: 1, to: [-1.62, 2.66], label: "point 3" },
      ],
    });
  });

  it("takes the first of two points as near, a point over an edge", () => {
    const points = [
      { at: [0.3, 0], label: "point 1" },
      { at: [0.3, 5], label: "Deck 3 · point 0" },
    ];
    expect(snapPoint([0.32, 1.23], { points, reach }).ties).toEqual([{ axis: 0, to: [0.3, 0], label: "point 1" }]);
    expect(snapPoint([0.48, 1.23], { points: [{ at: [0.45, 9], label: "point 2" }], reach }).at[0]).toBe(0.45);
  });

  it("goes to 0.01, past everything, held free", () => {
    expect(snapPoint([0.533, 2.617], { points: [{ at: [0.5, 2.62], label: "point 1" }], reach, free: true })).toEqual({ at: [0.53, 2.62], ties: [] });
  });
});
