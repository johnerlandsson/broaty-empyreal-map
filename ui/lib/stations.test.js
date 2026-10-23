import { describe, expect, it } from "vitest";
import { pickStation, stationOfDock, stationOfRoom } from "./stations.js";

describe("stations", () => {
  it("knows a room's station by its id", () => {
    expect(stationOfRoom("tiss.market")).toBe("tiss");
    expect(stationOfRoom("tiss.lift-3")).toBe("tiss");
    expect(stationOfRoom("orrin.berth")).toBe("orrin");
    expect(stationOfRoom("ship.41")).toBe(null);
    expect(stationOfRoom("wenna.berth")).toBe("wenna");
    expect(stationOfRoom("zennor.square")).toBe("zennor");
    expect(stationOfRoom("morvah.gallery")).toBe("morvah");
    expect(stationOfRoom("gwithian.market")).toBe("gwithian");
    expect(stationOfRoom("carrow.deck-3-frame-2")).toBe("carrow");
    expect(stationOfRoom("lanyon.berth")).toBe("lanyon");
    expect(stationOfRoom("senara.dock")).toBe(null);
    expect(stationOfRoom(undefined)).toBe(null);
  });

  it("knows a docked ship's station by its place id", () => {
    expect(stationOfDock("tiss")).toBe("tiss");
    expect(stationOfDock("orrin_station")).toBe("orrin");
    expect(stationOfDock("wenna_halt")).toBe("wenna");
    expect(stationOfDock("zennor")).toBe("zennor"); // landed
    expect(stationOfDock("morvah_deep")).toBe("morvah");
    expect(stationOfDock("gwithian_reach")).toBe("gwithian");
    expect(stationOfDock("carrow_yard")).toBe("carrow");
    expect(stationOfDock("lanyon_high")).toBe("lanyon");
    expect(stationOfDock("belt.7")).toBe(null);
    expect(stationOfDock(null)).toBe(null);
  });

  it("goes by the room, then the dock, then what was showing", () => {
    expect(pickStation({ roomId: "orrin.market" }, "tiss", "tiss")).toBe("orrin");
    expect(pickStation({ lift: { id: "tiss.lift-6" } }, "orrin", "orrin")).toBe("tiss");
    expect(pickStation({ roomId: "ship.41" }, "orrin", "tiss")).toBe("orrin");
    expect(pickStation({ roomId: "ship.41" }, null, "orrin")).toBe("orrin");
    expect(pickStation({ roomId: "ship.41.cockpit" }, "zennor", "tiss")).toBe("zennor");
    expect(pickStation({ roomId: "ship.41" }, "lanyon", "orrin")).toBe("lanyon");
    expect(pickStation(null, null, "tiss")).toBe("tiss");
  });
});
