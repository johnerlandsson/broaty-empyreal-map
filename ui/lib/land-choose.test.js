import { describe, expect, it } from "vitest";
import { landShown, landWorld } from "./land-choose.js";

describe("landShown", () => {
  it("is true on generated land, a surface.* area", () => {
    expect(landShown({ area: "surface.tamsin" })).toBe(true);
  });

  it("is false in Zennor, with no location, and with no area", () => {
    expect(landShown({ area: "zennor" })).toBe(false);
    expect(landShown(null)).toBe(false);
    expect(landShown({})).toBe(false);
  });
});

describe("landWorld", () => {
  const land = { tamsin: { from: "zennor", town: [{ e: 1, n: 1 }], joins: { downs: {} } } };

  it("is the land's entry for the area's body", () => {
    expect(landWorld("surface.tamsin", land)).toBe(land.tamsin);
  });

  it("is an empty land for a body there's no entry for", () => {
    expect(landWorld("surface.kerris", land)).toEqual({ town: [], joins: {} });
    expect(landWorld(undefined, land)).toEqual({ town: [], joins: {} });
  });
});
