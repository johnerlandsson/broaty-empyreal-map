import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISTRICTS, PIT, PLACES, SKYLINES, TERRACES, VALLEY, groundAt, pitRimFor, project, skylineFor, skylineOf, terraceFlats } from "./skyline.js";

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

describe("the Pit's rim", () => {
  it("runs west to east, its floor the lowest ground, the benches climbing both sides to the rim", () => {
    const { land, floor } = PIT;
    for (let i = 1; i < land.length; i++) expect(land[i][0]).toBeGreaterThan(land[i - 1][0]);
    expect(groundAt(land, 0)).toBe(0);
    expect(groundAt(land, floor[0])).toBe(0);
    expect(groundAt(land, floor[1])).toBe(0);
    // stepping up: never down, going out from the floor either way
    const out = (side) => land.filter(([x]) => side * x >= floor[1]).sort((a, b) => side * (a[0] - b[0])).map(([, h]) => h);
    for (const side of [-1, 1]) {
      const hs = out(side);
      for (let i = 1; i < hs.length; i++) expect(hs[i]).toBeGreaterThanOrEqual(hs[i - 1]);
    }
    // the rim stands above the sky's horizon (y 52 in the band): the sky is a lid on it
    const layer = pitRimFor("dolcoath.field").find((l) => l.section === PIT);
    expect(project(layer, 190, groundAt(land, 190))[1]).toBeLessThan(52);
  });

  it("frames on each of the Pit's three outdoor rooms: its north wall face on, then the benches either side, then what stands in front", () => {
    for (const room of ["dolcoath.field", "dolcoath.drops", "dolcoath.pithead"]) {
      const layers = pitRimFor(room);
      expect(layers[0].section.wall.length).toBeGreaterThan(0);
      expect(layers[0].far).toBe(true);
      expect(layers[1].section).toBe(PIT);
    }
    const kinds = (room) => pitRimFor(room).flatMap((l) => l.section.props.map((p) => p[1]));
    expect(kinds("dolcoath.pithead")).toContain("headframe");
    expect(kinds("dolcoath.pithead")).toContain("mist");
    expect(pitRimFor("dolcoath.drops")).toHaveLength(4); // its banks in front
    for (const room of [null, undefined, "", "dolcoath.lamp-room", "zennor.square", "toString"]) expect(pitRimFor(room)).toBeNull();
  });
});

describe("SKYLINES", () => {
  it("frames Zennor on your district and the Pit on your room, keeping the last where it has none", () => {
    expect(SKYLINES.zennor.frame({ kind: "room", id: "zennor.square" }, { district: "market-quarter" })).toBe("market-quarter");
    expect(SKYLINES.zennor.frame({ kind: "off" }, {})).toBeNull();
    expect(SKYLINES.dolcoath.frame({ kind: "room", id: "dolcoath.drops" }, { district: "pit" })).toBe("dolcoath.drops");
    expect(SKYLINES.dolcoath.frame({ kind: "room", id: "dolcoath.bal-cross" })).toBeNull();
    expect(SKYLINES.dolcoath.frame({ kind: "off" })).toBeNull();
  });

  it("starts where you'd land, and lines only Zennor's horizon with the ice cap", () => {
    expect(SKYLINES.zennor).toMatchObject({ start: "downs", cap: true });
    expect(SKYLINES.dolcoath).toMatchObject({ start: "dolcoath.field", cap: false });
    expect(SKYLINES.zennor.layers("downs")).toEqual(skylineFor("downs"));
  });

  it("gives a port with no skyline drawn a bare one: just its sky", () => {
    const bare = skylineOf("pendeen");
    expect(bare.frame({ kind: "room", id: "x" }, { district: "y" })).toBeNull();
    expect(bare.layers(null)).toEqual([]);
    expect(skylineOf("toString").layers(null)).toEqual([]);
  });
});
