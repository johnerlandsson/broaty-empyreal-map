import { describe, expect, it } from "vitest";
import { landBody, landLatitude, landShown, landWorld } from "./land-choose.js";

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

describe("landBody", () => {
  it("is the body of a surface.<body> area, else null", () => {
    expect(landBody("surface.tamsin")).toBe("tamsin");
    expect(landBody("surface.kerris")).toBe("kerris");
    expect(landBody("zennor")).toBe(null);
    expect(landBody("surface.")).toBe(null);
    expect(landBody(undefined)).toBe(null);
  });
});

describe("landLatitude", () => {
  const sky = { zennor: { latitude: 12.5 } };

  it("is the latitude of the port the land's measured from", () => {
    expect(landLatitude({ from: "zennor" }, sky)).toBe(12.5);
  });

  it("is 0 with no port, or a port with no sky", () => {
    expect(landLatitude({ town: [], joins: {} }, sky)).toBe(0);
    expect(landLatitude({ from: "nowhere" }, sky)).toBe(0);
    expect(landLatitude({ from: "toString" }, sky)).toBe(0);
  });
});
