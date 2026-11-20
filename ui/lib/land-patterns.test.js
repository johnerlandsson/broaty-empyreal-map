// The octagons' grounds: a colour for every kind of ground, and a texture for all but open
// ground and a road end (spec, "Drawing the board"; style guide §4.2).

import { describe, expect, it } from "vitest";
import { GROUPS, TERRAINS } from "./land-kinds.js";
import { groundStyle } from "./land-patterns.js";

/** CIELAB ΔE (1976) between two #rrggbb colours, D65. */
function deltaE(a, b) {
  const lab = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
    });
    const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
    const x = f((r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047);
    const y = f(r * 0.2126 + g * 0.7152 + bl * 0.0722);
    const z = f((r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

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

  it("gives every terrain the game sends its own colour and texture, the groups' own where they share a name", () => {
    const fills = new Set();
    for (const t of TERRAINS) {
      const { fill, pattern } = groundStyle(t);
      expect(fill, t).toMatch(/^#[0-9a-f]{6}$/);
      expect(pattern?.svg, t).toMatch(/^<(path|rect|circle)/);
      fills.add(fill);
    }
    expect(fills.size).toBe(TERRAINS.length);
    // a terrain of its own can be told from every other ground, title groups' too (CIELAB ΔE)
    for (const t of TERRAINS.filter((t) => !GROUPS.includes(t))) {
      for (const g of [...GROUPS, ...TERRAINS]) {
        if (g !== t) expect(deltaE(groundStyle(t).fill, groundStyle(g).fill), `${t} / ${g}`).toBeGreaterThanOrEqual(10);
      }
    }
    expect(groundStyle("woods")).not.toEqual(groundStyle("open"));
  });

  it("colours a road end Earth, and an unknown group as open ground", () => {
    expect(groundStyle("road").fill).toBe("#332b22");
    expect(groundStyle("nowhere")).toEqual(groundStyle("open"));
  });
});
