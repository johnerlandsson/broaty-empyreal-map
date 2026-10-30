import { describe, expect, it } from "vitest";
import { FLAGS, ROOM_FIELDS, keepArea, keepHull, keepRoom } from "./filter.mjs";

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
    const car = { kind: "tram", stops: [{ room: "a.c" }] };
    const { room, dropped } = keepRoom({ id: "a.b", gravity: 0, district: "d", canopy: false, car });
    expect(room).toEqual({ id: "a.b", gravity: 0, district: "d", canopy: false, car });
    expect(dropped).toEqual({ fields: [], flags: [] });
  });

  it("keeps of a car only its kind and its stops' rooms, naming the rest by dotted name", () => {
    const { room, dropped } = keepRoom({
      id: "a.b",
      car: { kind: "tram", stops: [{ room: "a.c", press: "c" }, { room: "a.d", press: "d" }], perStop: 15, dwell: 8 },
    });
    expect(room.car).toStrictEqual({ kind: "tram", stops: [{ room: "a.c" }, { room: "a.d" }] });
    expect(dropped.fields).toEqual(["car.perStop", "car.dwell", "car.stops.*.press"]);
  });

  it("keeps of an exit only where it goes, the way through and its seconds", () => {
    const { room, dropped } = keepRoom({
      id: "a.b",
      exits: { north: "a.c", up: { to: "a.d", via: "steps", seconds: 12, hidden: true }, down: { to: "a.e", hidden: true } },
    });
    expect(room.exits).toStrictEqual({ north: "a.c", up: { to: "a.d", via: "steps", seconds: 12 }, down: { to: "a.e" } });
    expect(dropped.fields).toEqual(["exits.*.hidden"]);
  });

  it("drops a flags list that empties out", () => {
    expect(keepRoom({ id: "a.b", flags: ["shop"] }).room).not.toHaveProperty("flags");
  });

  it("exports the allow-lists", () => {
    expect(ROOM_FIELDS).toEqual(["id", "name", "address", "exits", "closed", "gravity", "flags", "district", "canopy", "car"]);
    expect(FLAGS).toEqual(["berth", "airlock", "outdoors", "listed", "bin"]);
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
    expect(keepArea(area)).toEqual({ area: { id: "t", name: "T", gravity: 0.9, layout: { kind: "wheel" }, districts: [{ id: "d" }] }, dropped: { fields: [] } });
  });

  it("omits districts when there are none", () => {
    expect(keepArea({ id: "t", name: "T", gravity: 0, layout: { kind: "decks" } }).area).not.toHaveProperty("districts");
  });

  it("keeps of a layout and its districts only what the map reads, naming the rest by dotted name", () => {
    const layout = {
      kind: "wheel",
      rings: { rim: { every: 1, gravity: 0.9, colour: "red" }, mid: { every: 1.5, gravity: 0.6 } },
      spokes: [12, 3],
      spine: { length: 4, gravity: 0, lit: true },
      hub: { gravity: 0, spin: 1 },
      tilt: 3,
    };
    const districts = [{ id: "d", name: "D", entrance: "t.r", music: "x" }];
    const { area, dropped } = keepArea({ id: "t", name: "T", gravity: 0.9, layout, districts });
    expect(area.layout).toStrictEqual({
      kind: "wheel",
      rings: { rim: { every: 1, gravity: 0.9 }, mid: { every: 1.5, gravity: 0.6 } },
      spokes: [12, 3],
      spine: { length: 4, gravity: 0 },
      hub: { gravity: 0 },
    });
    expect(area.districts).toStrictEqual([{ id: "d", name: "D", entrance: "t.r" }]);
    expect(dropped.fields).toEqual(["layout.tilt", "layout.rings.*.colour", "layout.spine.lit", "layout.hub.spin", "districts.*.music"]);
  });
});

describe("keepHull", () => {
  it("keeps the map's fields, in their fixed order", () => {
    const { hull, dropped } = keepHull({ plan: "tub", bin: true, class: "medium", name: "tub", id: "tub" });
    expect(Object.entries(hull)).toEqual([["id", "tub"], ["name", "tub"], ["class", "medium"], ["plan", "tub"], ["bin", true]]);
    expect(dropped).toEqual({ fields: [], flags: [] });
  });

  it("names every other field by its dotted path, down to the leaves", () => {
    const raw = { id: "skiff", price: 15000, airlock: { clear: 70 }, devices: { nav: { name: "Navigation", stats: { range: 5 } } } };
    const { hull, dropped } = keepHull(raw);
    expect(hull).toEqual({ id: "skiff" });
    expect(dropped.fields).toEqual(["hull.price", "hull.airlock.clear", "hull.devices.nav.name", "hull.devices.nav.stats.range"]);
  });

  it("names a list of values once, and the fields of a list of objects under *", () => {
    const { dropped } = keepHull({ id: "s", names: ["Mule", "Dusty"], crew: [{ role: "pilot" }, { role: "mate", pay: 5 }] });
    expect(dropped.fields).toEqual(["hull.names", "hull.crew.*.role", "hull.crew.*.pay"]);
  });

  it("names an empty object or an empty value by itself", () => {
    expect(keepHull({ id: "s", devices: {}, note: null }).dropped.fields).toEqual(["hull.devices", "hull.note"]);
  });
});
