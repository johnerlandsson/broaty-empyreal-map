import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { GROUPS, TITLES, groupOf, regionOf, trackOf } from "./land-kinds.js";

const TABLE = {
  open: ["Open Ground", "On the Downs"],
  waymark: ["Cairn", "Marker Stone"],
  high: ["Hilltop", "Summit", "Knoll", "Ice Dome", "Saddle", "Low Pass", "Saddle in the Ice"],
  slope: ["Rising Ground", "Hillside", "Steep Hillside", "Stony Slope"],
  low: ["Hollow", "Head of a Gully", "Head of an Ice Gully"],
  rock: ["Rock Outcrop", "Bare Rock", "Stony Ground", "Crater Rim"],
  dust: ["Drifted Dust", "Dust Plain"],
  workings: ["Old Workings", "Old Shaft", "Fallen Adit"],
  water: ["Pond", "River Bank", "Spring", "Beach"],
  salt: ["The Salt Pans"],
  ice: ["Ice Field", "Ice Slope", "Frozen Shore"],
  road: ["Road End"],
};

describe("land kinds", () => {
  it("reads group, track and region from a name", () => {
    expect(groupOf("surface.tamsin.3.4.1", "Old Workings on the Tinners' Track")).toBe("workings");
    expect(trackOf("Old Workings on the Tinners' Track")).toBe("the Tinners' Track");
    expect(trackOf("On the Terrace Track")).toBe("the Terrace Track");
    expect(groupOf("x", "On the Terrace Track")).toBe("open");
    expect(regionOf("Hollow on the Downs")).toBe("the Downs");
    expect(regionOf("Cairn by the Carn")).toBe("the Carn");
    expect(regionOf("On the Downs")).toBe("the Downs");
    expect(regionOf("Old Workings on the Tinners' Track")).toBe(null);
    expect(groupOf("x", "Head of an Ice Gully on the Downs")).toBe("low");
    expect(groupOf("x", "The Salt Pans")).toBe("salt");
    expect(groupOf("surface.tamsin.join.downs", "The Open Downs")).toBe("road");
    expect(groupOf("x", "Something New")).toBe("open");
    expect(trackOf("Hollow on the Downs")).toBe(null);
    expect(regionOf("The Salt Pans")).toBe(null);
    expect(groupOf("x", "Saddle in the Ice")).toBe("high");
  });

  it("lists the groups in the spec's order", () => {
    expect(GROUPS).toEqual(["open", "road", "waymark", "high", "slope", "low", "rock", "dust", "workings", "water", "salt", "ice"]);
  });

  const rows = Object.entries(TABLE).flatMap(([g, ts]) => ts.map((t) => [t, g]));
  it.each(rows)("%s is %s, bare or with a suffix", (title, group) => {
    expect(TITLES.get(title)).toBe(group);
    expect(groupOf("x", title)).toBe(group);
    if (!title.startsWith("On ") && title !== "The Salt Pans") {
      expect(groupOf("x", `${title} on the Downs`)).toBe(group);
      expect(groupOf("x", `${title} by the Carn`)).toBe(group);
      expect(groupOf("x", `${title} on the Tinners' Track`)).toBe(group);
    }
  });
});

const game = join(homedir(), "dev/empyreal/packages/game/src/systems/surface-words.ts");
const land = join(homedir(), "dev/empyreal/content/game/land.yaml");

describe("the game's titles", () => {
  it.skipIf(!existsSync(game))("are all in TITLES", () => {
    const src = readFileSync(game, "utf8");
    const fn = src.slice(src.indexOf("export function placeTitle"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    const found = new Set();
    for (const line of body.split("\n")) {
      if (!/\breturn\b|\?/.test(line)) continue;
      if (/return\s+`On \$\{/.test(line)) continue;
      for (const m of line.matchAll(/'([A-Z][^']+)'/g)) if (m[1] !== "On ") found.add(m[1]);
    }
    for (const name of ["WORKING_TITLE", "COVER_TITLE"]) {
      const m = src.match(new RegExp(`const ${name} = \\{([^}]*)\\}`));
      for (const v of m[1].matchAll(/:\s*'([^']+)'/g)) found.add(v[1]);
    }
    expect(found.size).toBeGreaterThan(20);
    for (const t of found) {
      expect(TITLES.has(t), `the game titles a place "${t}", missing from TITLES in ui/lib/land-kinds.js; see docs/maps/sync.md`).toBe(true);
    }
  });

  it.skipIf(!existsSync(land))("names every track so it ends in ' Track'", () => {
    const lands = parse(readFileSync(land, "utf8")).lands;
    const tracks = lands.flatMap((l) => l.tracks ?? []);
    expect(tracks.length).toBeGreaterThan(0);
    for (const t of tracks) expect(t.name).toMatch(/ Track$/);
  });
});
