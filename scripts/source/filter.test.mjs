import { describe, expect, it } from "vitest";
import { FLAGS, ROOM_FIELDS, keepArea, keepRoom } from "./filter.mjs";

describe("keepRoom", () => {
  it("keeps the allowed fields and flags and reports the rest", () => {
    const out = keepRoom({
      id: "a.b",
      name: "B",
      address: "Deck 1, frame 1",
      desc: "x",
      keywords: ["k"],
      flags: ["listed", "droid_dock"],
      exits: { north: "a.c", in: { to: "a.d", via: "hatch" } },
      closed: "Shut.",
    });
    expect(out.room).toEqual({
      id: "a.b",
      name: "B",
      address: "Deck 1, frame 1",
      flags: ["listed"],
      exits: { north: "a.c", in: { to: "a.d", via: "hatch" } },
      closed: "Shut.",
    });
    expect(out.dropped).toEqual({ fields: ["desc", "keywords"], flags: ["droid_dock"] });
  });

  it("keeps gravity, district, canopy and car, even when falsy", () => {
    const { room, dropped } = keepRoom({ id: "a.b", gravity: 0, district: "d", canopy: true, car: true });
    expect(room).toEqual({ id: "a.b", gravity: 0, district: "d", canopy: true, car: true });
    expect(dropped).toEqual({ fields: [], flags: [] });
  });

  it("drops a flags list that empties out", () => {
    expect(keepRoom({ id: "a.b", flags: ["shop"] }).room).not.toHaveProperty("flags");
  });

  it("exports the allow-lists", () => {
    expect(ROOM_FIELDS).toEqual(["id", "name", "address", "exits", "closed", "gravity", "flags", "district", "canopy", "car"]);
    expect(FLAGS).toEqual(["berth", "airlock", "outdoors", "listed"]);
  });
});

describe("keepArea", () => {
  it("keeps id, name, gravity, layout and districts", () => {
    const area = {
      id: "t",
      name: "T",
      short: "x",
      gravity: 0.9,
      layout: { kind: "wheel" },
      districts: [{ id: "d" }],
      fallbackRoom: "t.r",
    };
    expect(keepArea(area)).toEqual({ id: "t", name: "T", gravity: 0.9, layout: { kind: "wheel" }, districts: [{ id: "d" }] });
  });

  it("omits districts when there are none", () => {
    expect(keepArea({ id: "t", name: "T", gravity: 0, layout: { kind: "decks" } })).not.toHaveProperty("districts");
  });
});
