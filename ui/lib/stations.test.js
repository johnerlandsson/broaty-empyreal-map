import { describe, expect, it } from "vitest";
import { noPlanLine, pickStation, stationOfDock, stationOfRoom } from "./stations.js";

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
    expect(stationOfRoom("kynance.gallery")).toBe("kynance");
    expect(stationOfRoom("marazion.gallery")).toBe("marazion");
    expect(stationOfRoom("penwith.gallery")).toBe("penwith");
    expect(stationOfRoom("botallack.gallery")).toBe("botallack");
    expect(stationOfRoom("polperro.gallery")).toBe("polperro");
    expect(stationOfRoom("lamorna.gallery")).toBe("lamorna");
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
    expect(stationOfDock("kynance_spindle")).toBe("kynance");
    expect(stationOfDock("marazion_quay")).toBe("marazion");
    expect(stationOfDock("penwith_vats")).toBe("penwith");
    expect(stationOfDock("botallack_head")).toBe("botallack");
    expect(stationOfDock("polperro_old_dock")).toBe("polperro");
    expect(stationOfDock("lamorna_light")).toBe("lamorna");
    expect(stationOfDock("belt.7")).toBe(null);
    expect(stationOfDock(null)).toBe(null);
  });

  it("goes by the room, then where she's docked, then what was showing", () => {
    expect(pickStation({ roomId: "orrin.market" }, "tiss", "tiss")).toBe("orrin");
    expect(pickStation({ lift: { id: "tiss.lift-6" } }, "orrin_station", "orrin")).toBe("tiss");
    expect(pickStation({ roomId: "ship.41" }, "orrin_station", "tiss")).toBe("orrin");
    expect(pickStation({ roomId: "ship.41" }, null, "orrin")).toBe("orrin");
    expect(pickStation({ roomId: "ship.41.cockpit" }, "zennor", "tiss")).toBe("zennor");
    expect(pickStation({ roomId: "ship.41" }, "lanyon_high", "orrin")).toBe("lanyon");
    expect(pickStation(null, null, "tiss")).toBe("tiss");
    // a workshop or bunk is its door's station's, whatever's docked or showing
    expect(pickStation({ roomId: "unit.7", door: "tiss.workshops" }, "orrin_station", "orrin")).toBe("tiss");
    expect(pickStation({ roomId: "bunk.3", door: 7 }, "orrin_station", "tiss")).toBe("orrin");
    // ...and a room the game puts in a station's area is that station's
    expect(pickStation({ roomId: "bunk.3", door: 7, area: "wenna" }, "orrin_station", "tiss")).toBe("wenna");
  });

  it("shows nothing for a station it has no plan of, not the last one", () => {
    // standing in one: the game names its area, and it's no ship's
    expect(pickStation({ roomId: "kilmar.commons", area: "kilmar" }, null, "lamorna")).toBe(null);
    expect(pickStation({ roomId: "unit.9", door: "kilmar.commons", area: "kilmar" }, null, "tiss")).toBe(null);
    expect(pickStation({ roomId: "kilmar.berth", area: "kilmar" }, "orrin_station", "orrin")).toBe(null);
    // docked at one, aboard
    expect(pickStation({ roomId: "ship.41", area: "ship.41" }, "kilmar_steading", "lamorna")).toBe(null);
    expect(pickStation({ roomId: "ship.41.cockpit", area: "ship.41" }, "caradon_works", "tiss")).toBe(null);
    // and off the station again, out in the ship, the last one stays
    expect(pickStation({ roomId: "ship.41", area: "ship.41" }, null, null)).toBe(null);
    expect(pickStation({ roomId: "ship.41", area: "ship.41" }, null, "lamorna")).toBe("lamorna");
  });

  it("names the station there's no plan of, if the game does", () => {
    expect(noPlanLine({ roomId: "kilmar.commons", area: "kilmar", areaName: "Kilmar Steading" })).toBe("No plan of Kilmar Steading");
    expect(noPlanLine({ roomId: "kilmar.commons" })).toBe("");
    expect(noPlanLine(null)).toBe("");
  });
});
