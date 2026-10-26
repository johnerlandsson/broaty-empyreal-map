import { describe, expect, it } from "vitest";
import lamorna from "../data/lamorna.js";
import orrin from "../data/orrin.js";
import wenna from "../data/wenna.js";
import zennor from "../data/zennor.js";
import { DISTRICT_COLOURS } from "./geometry.js";
import { decksSpec, drumRooms, drumSpec, townData, townSpec } from "./look.js";

// Today's specs, as decks.js, drum.js and town.js held them before the look moved to tweak files:
// the generated files must give them back exactly.
const ORRIN = {
  prefix: "orrin",
  tints: {
    "orrin.berth": DISTRICT_COLOURS.docks,
    "orrin.deck-3-frame-2": DISTRICT_COLOURS.industrial,
    "orrin.deck-3-frame-1": DISTRICT_COLOURS.industrial,
    "orrin.freight": DISTRICT_COLOURS.industrial,
    "orrin.charts": DISTRICT_COLOURS.docks,
    "orrin.concourse": DISTRICT_COLOURS.industrial,
    "orrin.deck-2-frame-2": DISTRICT_COLOURS.industrial,
    "orrin.market": DISTRICT_COLOURS.concourse,
    "orrin.gallery": DISTRICT_COLOURS.docks,
  },
  blisters: ["orrin.gallery"],
  cradles: [
    [0, 3, 0.3, 0.3, 0.22],
    [-1, 3, 0.34, 0.3, 0.7],
    [1, 3, 0.34, 0.3, 0.7],
    [0, 2, 0.34, 0.3, 0.7],
    [-1, 2, 0.18, 0.16, 0.36],
    [1, 2, 0.18, 0.16, 0.36],
  ],
};

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

describe("decksSpec", () => {
  it("gives Orrin's spec as decks.js had it", () => {
    expect(decksSpec(orrin)).toStrictEqual(ORRIN);
  });

  it("gives a mast as [side, frame, height]", () => {
    expect(decksSpec(lamorna).masts).toStrictEqual([[-1.25, 3.35, 1.65]]);
  });
});

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
