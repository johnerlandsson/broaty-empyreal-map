import { describe, expect, it } from "vitest";
import { areaBeyond, exitsBeyond } from "./beyond.mjs";

const names = new Map([["tamsin", "Tamsin"]]);

describe("areaBeyond", () => {
  it("names a generated place's area by its body, never the place", () => {
    expect(areaBeyond("surface.tamsin.join.downs", names)).toEqual({ area: "surface.tamsin", areaName: "Tamsin" });
    expect(areaBeyond("surface.tamsin.3.120.44", names)).toEqual({ area: "surface.tamsin", areaName: "Tamsin" });
  });

  it("has none for a room in a content area, or land on a body the source doesn't have", () => {
    expect(areaBeyond("zennor.square", names)).toBeNull();
    expect(areaBeyond("surface.senara.join.x", names)).toBeNull();
    expect(areaBeyond(undefined, names)).toBeNull();
  });
});

describe("exitsBeyond", () => {
  it("adds the area to each exit off the area, keeping the rest of it, and leaves the others", () => {
    const exits = { east: { to: "surface.tamsin.join.downs", via: "route" }, west: "surface.tamsin.join.bridge", north: "zennor.field" };
    expect(exitsBeyond(exits, names)).toEqual({
      east: { to: "surface.tamsin.join.downs", via: "route", area: "surface.tamsin", areaName: "Tamsin" },
      west: { to: "surface.tamsin.join.bridge", area: "surface.tamsin", areaName: "Tamsin" },
      north: "zennor.field",
    });
  });
});
