import { describe, expect, it } from "vitest";
import ships, { plans } from "../data/ships.js";
import { hullFor, isShipRoom, planFor, shipCaption, shipInfo, shipKey } from "./ships.js";
import { hullName } from "./contacts.js";

describe("hullFor and planFor", () => {
  it("knows the skiff, the courier, the freighter and the tug", () => {
    for (const id of ["skiff", "courier", "freighter", "tug"]) {
      expect(hullFor(id)).toBe(ships.hulls[id]);
      expect(planFor(id)).toBe(plans[ships.hulls[id].plan]);
    }
  });
  it("falls back to a generic one-cell ship", () => {
    for (const id of [undefined, null, "", "ore_hauler", 7, {}, "generic", "toString"]) {
      expect(hullFor(id)).toMatchObject({ id: "generic", plan: "hull-skiff" });
      expect(typeof hullFor(id).name).toBe("string");
      expect(planFor(id)).toBe(plans["hull-skiff"]);
    }
  });
});

describe("isShipRoom", () => {
  it("is any room id starting ship.", () => {
    expect(isShipRoom("ship.41")).toBe(true);
    expect(isShipRoom("ship.41.hold")).toBe(true);
    for (const id of ["tiss.berth", "shipyard.x", "ship", "", null, 41]) expect(isShipRoom(id)).toBe(false);
  });
});

describe("shipKey", () => {
  it("is the part of the id after the ship's number", () => {
    expect(shipKey("ship.42.hold")).toBe("hold");
    expect(shipKey("ship.42.cockpit")).toBe("cockpit");
    expect(shipKey("ship.42")).toBeNull();
    for (const id of ["tiss.berth", "", null, 42]) expect(shipKey(id)).toBeNull();
  });
});

describe("contacts' hull names", () => {
  it("are the index's", () => {
    for (const h of Object.values(ships.hulls)) expect(hullName(h.id)).toBe(h.name);
    expect(hullName("barge")).toBe("barge");
    expect(hullName(null)).toBeNull();
  });
});

describe("shipCaption and shipInfo", () => {
  const full = { roomId: "ship.41", name: "Cockpit of the Mule", areaName: "Mule", hull: "skiff", hullName: "prospecting skiff" };
  it("names the ship and its class", () => {
    expect(shipCaption(full)).toBe("Mule · prospecting skiff");
    expect(shipInfo(full)).toBe("COCKPIT OF THE MULE · prospecting skiff");
  });
  it("leaves out what it doesn't know", () => {
    expect(shipCaption({ areaName: "Mule" })).toBe("Mule");
    expect(shipCaption({ hullName: "courier" })).toBe("courier");
    expect(shipInfo({ name: "Cockpit of the Mule" })).toBe("COCKPIT OF THE MULE");
    for (const m of [{}, null, undefined, { areaName: 3, name: "", hullName: {} }]) {
      expect(shipCaption(m)).toBe("");
      expect(shipInfo(m)).toBe("");
    }
  });
});
