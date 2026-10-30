import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSource } from "./read.mjs";

const fixtures = new URL("../../tests/fixtures/empyreal", import.meta.url).pathname;
const real = join(homedir(), "dev/empyreal");

describe("loadSource", () => {
  it("reads areas, plans, hulls and world places", () => {
    const src = loadSource(fixtures);
    expect(src.areas.map((a) => a.area.id).sort()).toEqual(["mini", "wheelie"]);
    expect(src.areas[0].file).toMatch(/\.yaml$/);
    expect(src.areas.find((a) => a.area.id === "mini").rooms).toHaveLength(4);
    expect(src.plans).toHaveLength(1);
    expect(src.plans[0].area.id).toBe("tub");
    expect(src.plans[0].rooms).toHaveLength(1);
    expect(src.hulls).toEqual([
      { id: "skiff", name: "prospecting skiff", airlock: { clear: 70 }, price: 15000, slots: 2 },
      { id: "tub", name: "tub", class: "medium", plan: "tub", price: 1 },
    ]);
    expect(src.world).toEqual([
      { id: "mini", name: "Mini Outpost", berth: "mini.dock" },
      { id: "wheelie", name: "Wheelie Station", berth: "wheelie.rim-12" },
    ]);
    expect(src.shipGravity).toBe(0.25);
    expect(src.heavyWidth).toBe(110);
  });

  it("throws naming frames.yaml when it has no heavy frame's width", () => {
    const dir = mkdtempSync(join(tmpdir(), "frames-"));
    cpSync(fixtures, dir, { recursive: true });
    writeFileSync(join(dir, "content/game/frames.yaml"), "frames:\n  - id: small_frame\n");
    expect(() => loadSource(dir)).toThrow(/frames\.yaml.*heavy/);
  });

  it("gives ships no gravity when world.yaml has no shipGravity, as the game does", () => {
    const copy = mkdtempSync(join(tmpdir(), "empyreal-"));
    cpSync(fixtures, copy, { recursive: true });
    const world = join(copy, "content/game/world.yaml");
    writeFileSync(world, readFileSync(world, "utf8").replace("  shipGravity: 0.25\n", ""));
    expect(loadSource(copy).shipGravity).toBe(0);
  });

  it("has no commit for a directory that isn't a git checkout", () => {
    const copy = mkdtempSync(join(tmpdir(), "empyreal-"));
    cpSync(fixtures, copy, { recursive: true });
    expect(loadSource(copy).commit).toBeNull();
  });

  it("throws naming the missing areas directory", () => {
    expect(() => loadSource("/nonexistent")).toThrow(/\/nonexistent\/content\/areas/);
  });

  it("names the file of a bad YAML, an empty one, or one without its top key", () => {
    const copy = () => {
      const dir = mkdtempSync(join(tmpdir(), "empyreal-"));
      cpSync(fixtures, dir, { recursive: true });
      return dir;
    };
    for (const [text, why] of [["area: [", /mini\.yaml/], ["", /mini\.yaml.*area/], ["rooms: []\n", /mini\.yaml.*area/]]) {
      const dir = copy();
      writeFileSync(join(dir, "content/areas/mini.yaml"), text);
      expect(() => loadSource(dir), JSON.stringify(text)).toThrow(why);
    }
    const dir = copy();
    writeFileSync(join(dir, "content/game/world.yaml"), "world: {}\n");
    expect(() => loadSource(dir)).toThrow(/world\.yaml.*world\.stations/);
  });

  it.skipIf(!existsSync(join(real, "content/areas")))("loads the real source", () => {
    const src = loadSource(real);
    expect(src.areas.map((a) => a.area.id)).toEqual(expect.arrayContaining(["tiss", "orrin", "wenna", "zennor"]));
    expect(src.plans.length).toBeGreaterThanOrEqual(1);
    const tiss = src.areas.find((a) => a.area.id === "tiss").rooms.map((r) => r.id);
    expect(tiss).toEqual(expect.arrayContaining(["tiss.concourse", "tiss.hub", "tiss.rim-0900", "tiss.lift-3"]));
    expect(src.commit).toMatch(/^[0-9a-f]{7,}$/);
  });
});
