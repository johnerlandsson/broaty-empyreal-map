import { describe, expect, it } from "vitest";
import orrin from "../../tests/fixtures/generated/orrin.js";
import wenna from "../../tests/fixtures/generated/wenna.js";
import zennor from "../../tests/fixtures/generated/zennor.js";
import lamorna from "../data/lamorna.js";
import tiss from "../data/tiss.js";
import { DISTRICT_COLOURS } from "./geometry.js";
import { drumRooms, drumSpec, tissRooms, townData, townSpec } from "./look.js";

// Today's specs, as drum.js and town.js held them before the look moved to tweak files:
// the generated files of that day (frozen under tests/fixtures/generated, so a sync can't move
// them) must give them back exactly.
const WENNA = {
  prefix: "wenna",
  axis: { id: "wenna.lounge", r: 58, len: 18 },
  way: "ramp",
  tints: {
    "wenna.concourse": DISTRICT_COLOURS.hydroponics,
    "wenna.market": DISTRICT_COLOURS.concourse,
    "wenna.freight": DISTRICT_COLOURS.offices,
    "wenna.berth": DISTRICT_COLOURS.docks,
    "wenna.charts": DISTRICT_COLOURS.docks,
    "wenna.lounge": DISTRICT_COLOURS.docks,
  },
  cradles: [
    [-0.3, -12, 8, 20, 11],
    [-0.08, -12, 8, 20, 11],
    [0.14, -12, 8, 20, 11],
    [0.36, -12, 8, 20, 11],
  ],
};

const ZENNOR = {
  prefix: "zennor",
  root: "zennor.square",
  uphill: "east",
  tints: {
    downs: DISTRICT_COLOURS.docks,
    "old-town": DISTRICT_COLOURS.commons,
    "market-quarter": DISTRICT_COLOURS.concourse,
    courts: DISTRICT_COLOURS.offices,
    rows: DISTRICT_COLOURS.residential,
    riverside: DISTRICT_COLOURS.industrial,
    terraces: DISTRICT_COLOURS.hydroponics,
  },
  ground: {
    "zennor.square": "square",
    "zennor.exchange-square": "square",
    "zennor.garden": "garden",
    "zennor.ridge-path": "path",
    "zennor.overlook": "overlook",
    "zennor.terraces": "terraces",
    "zennor.lower-terraces": "old-terraces",
  },
  gate: "zennor.gate",
  wells: ["zennor.square", "zennor.exchange-square"],
  river: { name: "the Carn", bridge: "zennor.carn-bridge" },
  scarp: "downs",
};

describe("drumSpec and drumRooms", () => {
  it("gives Wenna's spec as drum.js had it", () => {
    expect(drumSpec(wenna)).toStrictEqual(WENNA);
  });

  it("places each room round the drum, in the order the tweak lists them", () => {
    const rooms = drumRooms(wenna);
    expect(rooms.map((r) => r.id)).toEqual(["wenna.concourse", "wenna.market", "wenna.freight", "wenna.berth", "wenna.charts", "wenna.lounge"]);
    expect(rooms[3]).toMatchObject({ name: "Berths", x: 1, y: 0, z: 0, hour: 1, band: 0, terrain: "room", gravity: 0.6 });
    expect(rooms[5]).toMatchObject({ hour: null, band: null, terrain: "lounge", gravity: 0.2 });
  });
});

describe("townSpec and townData", () => {
  it("gives Zennor's spec as town.js had it", () => {
    expect(townSpec(zennor)).toStrictEqual(ZENNOR);
  });

  it("takes the tram out of the rooms and makes it a car, its stops bottom to top", () => {
    const data = townData(zennor);
    expect(data.rooms.some((r) => r.car)).toBe(false);
    expect(data.cars).toStrictEqual([
      {
        id: "zennor.tram",
        name: "The Tram",
        kind: "tram",
        stops: ["zennor.tram-riverside", "zennor.tram-market", "zennor.tram-uptown", "zennor.tram-downs"],
      },
    ]);
    expect(data.area).toMatchObject({ id: "zennor", name: "Zennor", gravity: 1 });
    expect(data.area.districts.map((d) => d.id)).toEqual(["downs", "old-town", "market-quarter", "courts", "rows", "riverside", "terraces"]);
  });
});

describe("tissRooms", () => {
  const mini = {
    id: "w",
    rooms: [
      { id: "w.rim-1200", name: "Rim 12:00", address: "Rim 12:00", at: { x: 0, y: 0, z: 0 }, terrain: "lobby", gravity: 0.9, district: "plaza",
        exits: { north: "w.shop", east: "w.rim-0100", in: { to: "w.ladder", via: "hatch" } } },
      { id: "w.shop", name: "Shop", address: "Rim 12:00 fore", at: { x: 0, y: 1, z: 0 }, terrain: "room", gravity: 0.9, district: "plaza",
        exits: { south: "w.rim-1200" }, closed: "Shut for stocktaking." },
      { id: "w.bearing", name: "The Bearing", address: "Hub bearing", at: { x: 0, y: 1, z: 3 }, terrain: "room", gravity: 0, district: "hub",
        exits: { out: "w.hub", up: "w.a", down: "w.b", west: "w.c" } },
      { id: "w.lift-12", name: "Lift 12", address: "Lift 12", terrain: "corridor", gravity: 0.9 },
    ],
    look: { paint: { "rim-1200": "plaza", shop: "plaza", bearing: "hub", "lift-12": "plaza" }, palette: { plaza: "#d9a441", hub: "#cfe3ff" } },
  };

  it("gives today's station shape: place, region, exits as N S E W U D IN OUT, closed, paint", () => {
    const { wrap, rooms } = tissRooms(mini);
    expect(wrap).toBe(24);
    const byId = Object.fromEntries(rooms.map((r) => [r.id, r]));
    expect(byId["w.rim-1200"]).toStrictEqual({
      id: "w.rim-1200", name: "Rim 12:00", x: 0, y: 0, z: 0, region: "plaza", terrain: "lobby", address: "Rim 12:00", gravity: 0.9,
      exits: { N: "w.shop", E: "w.rim-0100", IN: "w.ladder" }, closed: false, closedReason: null, walked: true, paint: "#d9a441",
    });
    expect(byId["w.shop"]).toMatchObject({ address: "Rim 12:00, fore", closed: true, closedReason: "Shut for stocktaking." });
    expect(byId["w.bearing"]).toMatchObject({ address: "Hub, bearing", exits: { OUT: "w.hub", U: "w.a", D: "w.b", W: "w.c" }, paint: "#cfe3ff" });
  });

  it("leaves out the rooms with no place (the lift cars)", () => {
    expect(tissRooms(mini).rooms.map((r) => r.id).sort()).toEqual(["w.bearing", "w.rim-1200", "w.shop"]);
  });

  it("sorts the rooms by id, as the plans and model drew them", () => {
    expect(tissRooms(mini).rooms.map((r) => r.id)).toEqual(["w.bearing", "w.rim-1200", "w.shop"]);
  });

  it("has T.I.S.S.'s placed rooms, no lift car among them", () => {
    const rooms = tissRooms(tiss).rooms;
    expect(rooms.map((r) => r.id)).toEqual(expect.arrayContaining(["tiss.concourse", "tiss.hub", "tiss.rim-0900"]));
    expect(rooms).toHaveLength(tiss.rooms.filter((r) => r.at).length);
    expect(rooms.some((r) => r.id.startsWith("tiss.lift-"))).toBe(false);
  });
});
