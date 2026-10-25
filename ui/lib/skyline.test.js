import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISTRICTS, PLACES, TERRACES, VALLEY, groundAt, project, skylineFor, terraceFlats } from "./skyline.js";

describe("the valley", () => {
  it("runs west to east, with the river its lowest ground", () => {
    for (const { land, river } of [VALLEY, TERRACES]) {
      for (let i = 1; i < land.length; i++) expect(land[i][0]).toBeGreaterThan(land[i - 1][0]);
      const low = Math.min(...land.map(([, h]) => h));
      expect(groundAt(land, (river[0] + river[1]) / 2)).toBe(low);
    }
  });

  it("climbs from the river to the Downs, uphill east", () => {
    const order = ["riverside", "rows", "courts", "market-quarter", "old-town", "downs"];
    for (let i = 1; i < order.length; i++) {
      expect(PLACES[order[i]]).toBeGreaterThan(PLACES[order[i - 1]]);
      expect(groundAt(VALLEY.land, PLACES[order[i]])).toBeGreaterThan(groundAt(VALLEY.land, PLACES[order[i - 1]]));
    }
  });

  it("interpolates the ground between its points, and holds it level past the ends", () => {
    expect(groundAt([[0, 0], [10, 20]], 5)).toBe(10);
    expect(groundAt([[0, 0], [10, 20]], -5)).toBe(0);
    expect(groundAt([[0, 0], [10, 20]], 50)).toBe(20);
  });

  it("stands everything on its land", () => {
    for (const { land, props } of [VALLEY, TERRACES])
      for (const [x, , w] of props) {
        expect(x).toBeGreaterThan(land[0][0]);
        expect(x + w).toBeLessThan(land[land.length - 1][0]);
      }
  });

  it("finds the terraces' flats, stepping up the east side", () => {
    const flats = terraceFlats();
    expect(flats.length).toBe(9);
    for (let i = 1; i < flats.length; i++) expect(flats[i][2]).toBeGreaterThan(flats[i - 1][2]);
  });
});

describe("skylineFor", () => {
  it("frames the valley on your district: it's in the middle of the band", () => {
    for (const d of Object.keys(PLACES)) {
      const [layer] = skylineFor(d);
      expect(layer.section).toBe(VALLEY);
      expect(project(layer, PLACES[d], 0)[0]).toBe(0);
    }
  });

  it("slides the valley west as you go down to the river", () => {
    const x = (d) => project(skylineFor(d)[0], PLACES.downs, 0)[0];
    expect(x("riverside")).toBeGreaterThan(x("market-quarter"));
    expect(x("market-quarter")).toBeGreaterThan(x("downs"));
  });

  it("puts the city up the valley behind the terraces, far and small", () => {
    const [far, near] = skylineFor("terraces");
    expect(far).toMatchObject({ section: VALLEY, far: true });
    expect(near.section).toBe(TERRACES);
    expect(far.k).toBeLessThan(near.k);
    expect(far.size).toBeLessThan(near.size);
  });

  it("has none for a room with no district, or one that isn't Zennor's", () => {
    for (const d of [null, undefined, "", "concourse", "toString", 5]) expect(skylineFor(d)).toBeNull();
  });

  // Every district the game gives Zennor, if the Empyreal source is here to say.
  const yaml = join(homedir(), "dev/empyreal/content/areas/zennor.yaml");
  it.skipIf(!existsSync(yaml))("has a view for every district in zennor.yaml", () => {
    const ids = [...readFileSync(yaml, "utf8").matchAll(/^\s+district: ([a-z-]+)\s*$/gm)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(DISTRICTS)).toEqual(new Set(ids));
  });
});
