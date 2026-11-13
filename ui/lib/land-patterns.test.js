// The octagons' grounds: a colour for every kind of ground, and a texture for all but open
// ground and a road end (spec, "Drawing the board"; style guide §4.2).

import { describe, expect, it } from "vitest";
import { GROUPS } from "./land-kinds.js";
import { groundStyle } from "./land-patterns.js";

describe("groundStyle", () => {
  it("gives every group a colour", () => {
    for (const g of GROUPS) expect(groundStyle(g).fill, g).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("gives every group but open and road a texture in screen pixels", () => {
    for (const g of GROUPS) {
      const { pattern } = groundStyle(g);
      if (g === "open" || g === "road") expect(pattern, g).toBeUndefined();
      else {
        expect(pattern.w, g).toBeGreaterThan(0);
        expect(pattern.h, g).toBeGreaterThan(0);
        expect(pattern.svg, g).toMatch(/^<(path|rect|circle)/);
      }
    }
  });

  it("colours a road end Earth, and an unknown group as open ground", () => {
    expect(groundStyle("road").fill).toBe("#332b22");
    expect(groundStyle("nowhere")).toEqual(groundStyle("open"));
  });
});
