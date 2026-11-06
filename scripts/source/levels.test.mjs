import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { levelRooms } from "./levels.mjs";

const r = (id, exits = {}) => ({ id: `x.${id}`, exits: Object.fromEntries(Object.entries(exits).map(([d, e]) => [d, typeof e === "string" ? `x.${e}` : { ...e, to: `x.${e.to}` }])) });
const car = (...stops) => ({ id: "x.car", car: { kind: "cage", stops: stops.map((s) => ({ room: `x.${s}` })) } });
const levelOf = (out) => Object.fromEntries([...out.levels].map(([id, n]) => [id.slice(2), n]));

describe("levelRooms", () => {
  it("puts each car stop on a level, its top stop first, and the rooms its compass exits reach with it", () => {
    const rooms = [car("low", "high"), r("high", { east: "hall" }), r("hall", { west: "high", north: "gallery" }), r("gallery", { south: "hall" }), r("low", { northeast: "yard" }), r("yard", { southwest: "low" })];
    const out = levelRooms(rooms);
    expect(levelOf(out)).toEqual({ high: 0, hall: 0, gallery: 0, low: 1, yard: 1 });
    expect(out.unplaced).toEqual([]);
  });

  it("never puts the car on a level, and a way up or down never joins two levels' rooms", () => {
    const rooms = [car("low", "high"), r("high", { down: { to: "foot", via: "stair", seconds: 9 } }), r("low", { west: "foot" }), r("foot", { east: "low", up: "high" })];
    const out = levelRooms(rooms);
    expect(out.levels.has("x.car")).toBe(false);
    expect(levelOf(out)).toEqual({ high: 0, low: 1, foot: 1 });
  });

  it("gives a room only a way down reaches a level of its own below, with the rooms its compass joins", () => {
    const rooms = [car("bottom", "top"), r("top"), r("bottom", { down: "sump" }), r("sump", { up: "bottom", east: "pool" }), r("pool", { west: "sump" })];
    expect(levelOf(levelRooms(rooms))).toEqual({ top: 0, bottom: 1, sump: 2, pool: 2 });
  });

  it("hangs a level a way up reaches above the one it's reached from", () => {
    const rooms = [car("bottom", "top"), r("top"), r("bottom", { up: "loft" }), r("loft", { down: "bottom" })];
    expect(levelOf(levelRooms(rooms))).toEqual({ top: 0, loft: 1, bottom: 2 });
  });

  it("gives two unjoined rooms down from one level a level each, in the source's order, unless depths say otherwise", () => {
    const rooms = [car("deep", "top"), r("top"), r("deep", { down: "pump", east: "cross" }), r("cross", { west: "deep", down: "winze" }), r("pump", { up: "deep" }), r("winze", { up: "cross" })];
    expect(levelOf(levelRooms(rooms))).toMatchObject({ pump: 2, winze: 3 });
    // the winze given the deeper depth still comes last; given a shallower one than the pump's level it comes first
    expect(levelOf(levelRooms(rooms, { top: 0, deep: 160, winze: 200 }))).toMatchObject({ pump: 2, winze: 3 });
    expect(levelOf(levelRooms(rooms, { top: 0, deep: 160, pump: 190, winze: 170 }))).toMatchObject({ winze: 2, pump: 3 });
  });

  it("orders the levels by depth where they have one", () => {
    const rooms = [car("b", "a"), r("a"), r("b")];
    expect(levelOf(levelRooms(rooms, { a: 50, b: 10 }))).toEqual({ a: 1, b: 0 });
  });

  it("leaves a room nothing reaches on no level", () => {
    const out = levelRooms([car("a"), r("a"), r("lost")]);
    expect(out.unplaced).toEqual(["x.lost"]);
  });

  // Dolcoath as the game has it, if the Empyreal source is here to say.
  const yaml = join(homedir(), "dev/empyreal/content/areas/dolcoath.yaml");
  it.skipIf(!existsSync(yaml))("puts Dolcoath's rooms on its cage's six levels, the Pump Gallery and the Winze below them", () => {
    const { rooms } = parse(readFileSync(yaml, "utf8"));
    const depths = JSON.parse(readFileSync(new URL("../../data/tweaks/dolcoath.json", import.meta.url), "utf8")).levels.depths;
    const out = levelRooms(rooms, depths);
    expect(out.unplaced).toEqual([]);
    const at = (local) => out.levels.get(`dolcoath.${local}`);
    expect(["pithead", "twenty", "forty", "town-station", "smelts-station", "workings-station", "pump-gallery", "winze"].map(at)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // the Great Stair's three rooms on three levels
    expect(["wheal-prosper", "stair-head", "stair-foot"].map(at)).toEqual([1, 2, 3]);
    // every compass exit stays on its level; every way up or down leaves it
    for (const room of rooms.filter((x) => !x.car)) {
      for (const [dir, e] of Object.entries(room.exits ?? {})) {
        const to = typeof e === "string" ? e : e.to;
        if (dir === "up" || dir === "down") expect(out.levels.get(to)).not.toBe(out.levels.get(room.id));
        else expect(out.levels.get(to)).toBe(out.levels.get(room.id));
      }
    }
  });
});
