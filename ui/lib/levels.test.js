import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
// Dolcoath as generated on the day its plans were built, frozen so a sync can't move it.
import generated from "../../tests/fixtures/generated/dolcoath.js";
import current from "../data/dolcoath.js";
import { levelsData, levelsSpec } from "./look.js";
import { FRAME, indexLevels, levelFrame, levelLayout, levelTag, levelTitle, levelsInfo, locateLevels, wayTip, waysOff } from "./levels.js";
import { STEP, exitTo } from "./town.js";

const spec = levelsSpec(generated);
const index = indexLevels(levelsData(generated), spec);
const room = (id) => index.byId.get(`dolcoath.${id}`);
const level = (n) => index.levels.find((l) => l.level === n);
const ways = (n) => waysOff(index, n);
const wayOf = (n, id, kind) => ways(n).find((w) => w.room === `dolcoath.${id}` && w.kind === kind);

describe("indexLevels", () => {
  it("has every room but the cage, each on its level", () => {
    expect(index.byId.size).toBe(58);
    expect(index.byId.has("dolcoath.cage")).toBe(false);
    expect(index.levels.map((l) => l.rooms.length)).toEqual([7, 7, 5, 14, 8, 15, 1, 1]);
  });

  it("names each level by the tweak, else its cage stop, else its room, with its depth from the tweak", () => {
    expect(index.levels.map((l) => [l.name, l.depth])).toEqual([
      ["the Pit", 0],
      ["Twenty Fathom", 20],
      ["Forty Fathom", 40],
      ["the Town", 80],
      ["the Smelts", 120],
      ["the Workings", 160],
      ["Pump Gallery", null],
      ["The Bottom of the Winze", 200],
    ]);
    expect(index.levels.map((l) => l.stop?.slice(9) ?? null)).toEqual(["pithead", "twenty", "forty", "town-station", "smelts-station", "workings-station", null, null]);
    expect(index.levels.map(levelTag)).toEqual(["PIT", "20 FM", "40 FM", "80 FM", "120 FM", "160 FM", "PUMP GALLERY", "200 FM"]);
    expect(levelTitle(level(3))).toBe("THE TOWN · 80 FM");
    expect(levelTitle(level(0))).toBe("THE PIT");
  });

  it("puts each level's cage station at 0, 0 and its man engine a cell west, so the shafts line up", () => {
    for (const [stop, engine] of [["pithead", "engine-head"], ["twenty", "engine-twenty"], ["forty", "engine-forty"], ["town-station", "engine-town"], ["smelts-station", "engine-smelts"], ["workings-station", "engine-workings"]]) {
      expect(room(stop).cell).toEqual({ x: 0, y: 0 });
      expect(room(engine).cell).toEqual({ x: -1, y: 0 });
    }
  });

  it("places every compass exit its true way, on its own level, with no two rooms in a cell", () => {
    for (const r of index.byId.values()) {
      for (const [dir, e] of Object.entries(r.exits)) {
        const to = index.byId.get(exitTo(e));
        if (!STEP[dir]) continue;
        expect(to.level).toBe(r.level);
        const [dx, dy] = STEP[dir];
        expect([Math.sign(to.cell.x - r.cell.x), Math.sign(to.cell.y - r.cell.y)]).toEqual([dx, dy]);
      }
    }
    for (const lv of index.levels) {
      const cells = lv.rooms.map((id) => `${index.byId.get(id).cell.x}:${index.byId.get(id).cell.y}`);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });

  it("knows the outdoor rooms' ground and the field, and the Exchange keeps its own paint", () => {
    expect(room("field").kind).toBe("field");
    expect(room("pithead").kind).toBe("square");
    expect(room("drops").kind).toBe("square");
    expect(room("exchange").kind).toBe("building");
    expect(spec.roomTints["dolcoath.exchange"]).toBe(generated.look.palette.concourse);
    expect(spec.tints["old-levels"]).toBe(generated.look.palette.commons);
  });

  it("keeps the names the cage gives its stops", () => {
    expect(index.cars).toHaveLength(1);
    expect(index.cars[0].kind).toBe("cage");
    expect(index.cars[0].named["dolcoath.town-station"]).toBe("the Town");
  });
});

describe("locateLevels and the info line", () => {
  it("puts you on your room's level, or off the plan", () => {
    expect(locateLevels(index, { roomId: "dolcoath.bal-cross" })).toEqual({ kind: "room", id: "dolcoath.bal-cross", level: 3, x: 1, y: 0 });
    expect(locateLevels(index, { roomId: "dolcoath.cage", name: "The Cage" })).toEqual({ kind: "off", name: "The Cage" });
    expect(locateLevels(null, { roomId: "dolcoath.bal-cross" })).toEqual({ kind: "off", name: "" });
  });

  it("names the room, its district, the city and the gravity", () => {
    const where = locateLevels(index, { roomId: "dolcoath.exchange" });
    expect(levelsInfo(where, { areaName: "Dolcoath", gravity: 1.5 }, index)).toBe("THE EXCHANGE · the Old Levels · Dolcoath · 1.5 g");
  });
});

describe("waysOff", () => {
  it("has the cage's shaft at each station, naming the stations above and below", () => {
    const town = wayOf(3, "town-station", "cage");
    expect(town.up).toMatchObject({ to: "dolcoath.forty", name: "Forty Fathom", level: 2 });
    expect(town.down).toMatchObject({ to: "dolcoath.smelts-station", name: "the Smelts", level: 4 });
    expect(wayOf(0, "pithead", "cage").up).toBeNull();
    expect(wayOf(5, "workings-station", "cage").down).toBeNull();
  });

  it("has the man engine and the Great Stair with their seconds, and a plain way down with none", () => {
    expect(wayOf(3, "engine-town", "man-engine")).toMatchObject({ name: "the man engine", up: { levelName: "Forty Fathom", seconds: 16 }, down: { levelName: "the Smelts", seconds: 12 } });
    expect(wayOf(2, "stair-head", "stair")).toMatchObject({ name: "the Great Stair", up: { levelName: "Twenty Fathom", seconds: 24 }, down: { levelName: "the Town", seconds: 18 } });
    expect(wayOf(5, "engine-hall", "plain")).toMatchObject({ up: null, down: { name: "Pump Gallery", seconds: null } });
    expect(ways(6)).toEqual([expect.objectContaining({ kind: "plain", up: expect.objectContaining({ name: "Engine Hall" }), down: null })]);
  });

  it("leaves each room by a side no exit takes and no room is beyond, the man engine by its cage's", () => {
    expect(wayOf(3, "town-station", "cage").side).toBe("south");
    expect(wayOf(3, "engine-town", "man-engine").side).toBe("south");
    expect(wayOf(0, "pithead", "cage").side).toBe("north"); // the field is south of it
    expect(wayOf(0, "engine-head", "man-engine").side).toBe("north");
    expect(wayOf(3, "stair-foot", "stair").side).toBe("west"); // the Town Station is south, Kitto's north
    for (const lv of index.levels) {
      const cells = new Set(lv.rooms.map((id) => index.byId.get(id).cell).map((c) => `${c.x}:${c.y}`));
      for (const w of ways(lv.level)) expect(cells.has(w.cell)).toBe(false);
    }
  });

  it("says where each way goes on hover, with its seconds", () => {
    expect(wayTip(wayOf(3, "engine-town", "man-engine"))).toEqual({
      title: "The man engine",
      rows: [
        { label: "Up", value: "Forty Fathom, about 16 s" },
        { label: "Down", value: "the Smelts, about 12 s" },
      ],
    });
    expect(wayTip(wayOf(1, "wheal-prosper", "stair"))).toEqual({ title: "The Great Stair", rows: [{ label: "Down", value: "Forty Fathom, about 10 s" }] });
    expect(wayTip(wayOf(3, "town-station", "cage"))).toEqual({ title: "The Cage", rows: [{ label: "Up", value: "Forty Fathom" }, { label: "Down", value: "the Smelts" }] });
    expect(wayTip(wayOf(5, "crosscut", "plain"))).toEqual({ title: "A way down", rows: [{ label: "Down", value: "The Bottom of the Winze" }] });
  });
});

describe("levelLayout and levelFrame", () => {
  it("lays out a level's rooms alone, its ways off beside their rooms, inside its bounds", () => {
    const l = levelLayout(index, spec, 3);
    expect(l.boxes).toHaveLength(14);
    expect(l.links.every((k) => k.kind !== "climb" && k.kind !== "steps")).toBe(true);
    expect(l.ways.map((w) => w.kind).sort()).toEqual(["cage", "man-engine", "stair"]);
    for (const w of l.ways) {
      expect(w.cx).toBeGreaterThan(l.bounds.x0);
      expect(w.cx).toBeLessThan(l.bounds.x1);
      expect(w.cy).toBeGreaterThan(l.bounds.y0);
      expect(w.cy).toBeLessThan(l.bounds.y1);
    }
    const well = l.ways.find((w) => w.kind === "cage");
    expect(well.tags).toEqual({ up: "40 FM", down: "120 FM" });
    // the district's name isn't put where a way off is
    const town = l.districts.find((d) => d.id === "town");
    expect(l.ways.some((w) => Math.abs(w.cx - town.label.x) < 70 && Math.abs(w.cy - town.label.y) < 48)).toBe(false);
  });

  it("frames a small level whole, never smaller than the least frame, and a big one round you", () => {
    const pump = levelLayout(index, spec, 6);
    expect(levelFrame(pump, null).extent).toEqual(FRAME.min);
    const town = levelLayout(index, spec, 3);
    const f = levelFrame(town, locateLevels(index, { roomId: "dolcoath.gardens" }));
    expect(f.extent.w).toBe(FRAME.max.w);
    // kept inside the level: the Lamp Gardens are at its east end
    expect(f.home[0] + f.extent.w / 2).toBeCloseTo(town.bounds.x1);
  });
});

// Every room the game gives Dolcoath, if the Empyreal source is here to say.
const yaml = join(homedir(), "dev/empyreal/content/areas/dolcoath.yaml");
describe.skipIf(!existsSync(yaml))("against dolcoath.yaml", () => {
  it("has, as generated now, every room the source has, and the cage's stops in its order", () => {
    const { rooms } = parse(readFileSync(yaml, "utf8"));
    const now = indexLevels(levelsData(current), levelsSpec(current));
    expect(new Set(now.byId.keys())).toEqual(new Set(rooms.filter((r) => !r.car).map((r) => r.id)));
    const cage = rooms.find((r) => r.car);
    expect(now.cars[0].stops).toEqual(cage.car.stops.map((s) => s.room));
  });
});
