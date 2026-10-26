import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import tiss from "../../ui/data/tiss.js";
import { placeRooms } from "./place.mjs";
import { loadSource } from "./read.mjs";

const fixtures = new URL("../../tests/fixtures/empyreal", import.meta.url).pathname;
const real = join(homedir(), "dev/empyreal");
const hasReal = existsSync(join(real, "content/areas"));

function placed(src, id, place) {
  const { area, rooms } = src.areas.find((a) => a.area.id === id);
  const out = placeRooms(area, rooms, place);
  return { ...out, byId: new Map(out.rooms.map((r) => [r.id, r])) };
}

describe("placeRooms on the fixtures", () => {
  const src = loadSource(fixtures);

  it("places a wheel's rooms by address, as layout.ts does", () => {
    const { byId, unplaced } = placed(src, "wheelie");
    expect(byId.get("wheelie.rim-12")).toMatchObject({ at: { x: 0, y: 0, z: 0 }, terrain: "lobby", gravity: 0.9 });
    expect(byId.get("wheelie.rim-6")).toMatchObject({ at: { x: 12, y: 0, z: 0 }, terrain: "corridor" });
    expect(byId.get("wheelie.shop")).toMatchObject({ at: { x: 0, y: 1, z: 0 }, terrain: "room" });
    expect(byId.get("wheelie.back").at).toEqual({ x: 0, y: 2, z: 0 });
    expect(byId.get("wheelie.ladderway-12")).toMatchObject({ at: { x: 1, y: 0, z: 0 }, terrain: "ladderway" });
    expect(byId.get("wheelie.hub")).toMatchObject({ at: { x: 0, y: 0, z: 3 }, terrain: "hub", gravity: 0 });
    expect(unplaced).toEqual(["wheelie.hub-freight"]);
    expect(byId.has("wheelie.hub-freight")).toBe(false);
  });

  it("leaves a lift car unplaced, but not in unplaced, with the rim's gravity", () => {
    const { byId, unplaced } = placed(src, "wheelie");
    const car = byId.get("wheelie.lift-12");
    expect(car).toBeDefined();
    expect(car).not.toHaveProperty("at");
    expect(car.gravity).toBe(0.9);
    expect(unplaced).not.toContain("wheelie.lift-12");
  });

  it("places an unplaced room from `place`, by local id", () => {
    const { byId, unplaced } = placed(src, "wheelie", { "hub-freight": { x: 0, y: -1, z: 3 } });
    expect(byId.get("wheelie.hub-freight")).toMatchObject({ at: { x: 0, y: -1, z: 3 }, terrain: "room" });
    expect(unplaced).toEqual([]);
  });

  it("places decks' rooms at their cells, with the area's gravity", () => {
    const { byId, unplaced } = placed(src, "mini");
    expect(byId.get("mini.dock")).toMatchObject({ at: { deck: 1, frame: 1, side: 0 }, gravity: 0 });
    expect(byId.get("mini.bridge").at).toEqual({ deck: 2, frame: 2, side: 0 });
    expect(byId.get("mini.dock")).not.toHaveProperty("terrain");
    expect(unplaced).toEqual([]);
  });

  it("passes rooms through without a layout, keeping the raw fields", () => {
    const area = { id: "n", gravity: 1 };
    const raw = [{ id: "n.a", name: "A", desc: "x", off: "n.b" }, { id: "n.b", gravity: 0.5 }];
    const { rooms, unplaced } = placeRooms(area, raw);
    expect(rooms).toEqual([{ id: "n.a", name: "A", desc: "x", off: "n.b", gravity: 1 }, { id: "n.b", gravity: 0.5 }]);
    expect(unplaced).toEqual([]);
    expect(raw[0]).not.toHaveProperty("gravity");
  });
});

describe.skipIf(!hasReal)("placeRooms on the real source", () => {
  const src = hasReal ? loadSource(real) : null;

  it("places T.I.S.S.'s rooms where the log-built station.js had them", () => {
    const { byId } = placed(src, "tiss");
    const want = {
      "tiss.concourse": [{ x: 0, y: 0, z: 0 }, "lobby"],
      "tiss.hub": [{ x: 0, y: 0, z: 3 }, "hub"],
      "tiss.bearing": [{ x: 0, y: 1, z: 3 }, "room"],
      "tiss.spine-2": [{ x: 0, y: 3, z: 3 }, "corridor"],
      "tiss.barber": [{ x: 2, y: -2, z: 0 }, "room"],
      "tiss.laundry": [{ x: 4, y: -1, z: 0 }],
      "tiss.ladderway-3-mid": [{ x: 7, y: 0, z: 1 }, "ladderway"],
      "tiss.blister": [{ x: 0, y: 6, z: 3 }],
      "tiss.inner-1200": [{ x: 0, y: 0, z: 2 }, "lobby"],
      "tiss.flats": [{ x: 9, y: -1, z: 1 }],
    };
    for (const [id, [at, terrain]] of Object.entries(want)) {
      expect(byId.get(id)?.at, id).toEqual(at);
      if (terrain) expect(byId.get(id).terrain, id).toBe(terrain);
    }
  });

  it("leaves tiss.transfer unplaced unless `place` places it", () => {
    const bare = placed(src, "tiss");
    expect(bare.unplaced).toContain("tiss.transfer");
    expect(bare.byId.has("tiss.transfer")).toBe(false);
    const { byId, unplaced } = placed(src, "tiss", { transfer: { x: 0, y: -1, z: 3 } });
    expect(byId.get("tiss.transfer").at).toEqual({ x: 0, y: -1, z: 3 });
    expect(unplaced).not.toContain("tiss.transfer");
  });

  it("gives lift cars no place and doesn't count them unplaced", () => {
    const { rooms, unplaced } = placed(src, "tiss");
    const cars = rooms.filter((r) => /^Lift \d+$/.test(r.address ?? ""));
    expect(cars.map((c) => c.id)).toEqual(expect.arrayContaining(["tiss.lift-12", "tiss.lift-3", "tiss.lift-6", "tiss.lift-9"]));
    for (const car of cars) {
      expect(car, car.id).not.toHaveProperty("at");
      expect(unplaced).not.toContain(car.id);
    }
  });

  it("agrees with every placed room of the generated tiss.js", () => {
    const { byId } = placed(src, "tiss", { transfer: { x: 0, y: -1, z: 3 } });
    const mismatches = [];
    let compared = 0;
    for (const old of tiss.rooms.filter((r) => r.at)) {
      const r = byId.get(old.id);
      if (!r) continue;
      compared++;
      const got = r.at ? [r.at.x, r.at.y, r.at.z, r.terrain, r.gravity] : null;
      const want = [old.at.x, old.at.y, old.at.z, old.terrain, old.gravity];
      if (JSON.stringify(got) !== JSON.stringify(want))
        mismatches.push(`${old.id}: tiss.js ${JSON.stringify(want)}, placed ${JSON.stringify(got)}`);
    }
    // a room only one side has (the source moved on since the last build) isn't compared
    expect(compared).toBeGreaterThan(0);
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });

  it("places Orrin's rooms on its decks", () => {
    const { byId } = placed(src, "orrin");
    expect(byId.get("orrin.market").at).toEqual({ deck: 2, frame: 2, side: -1 });
  });
});
