import { describe, expect, it } from "vitest";
import { HULLS, SCALE, hullOf, isShipRoom, shipShape, shipCaption, shipInfo, toPlan, hullExtent } from "./hulls.js";

describe("hullOf", () => {
  it("knows the skiff and the courier", () => {
    expect(hullOf("skiff")).toBe(HULLS.skiff);
    expect(hullOf("courier")).toBe(HULLS.courier);
  });
  it("falls back to the generic ship", () => {
    for (const id of [undefined, null, "", "ore_hauler", 7, {}, "generic", "toString"]) expect(hullOf(id)).toBe(HULLS.generic);
  });
});

describe("isShipRoom", () => {
  it("is any room id starting ship.", () => {
    expect(isShipRoom("ship.41")).toBe(true);
    expect(isShipRoom("ship.41.hold")).toBe(true);
    for (const id of ["tiss.berth", "shipyard.x", "ship", "", null, 41]) expect(isShipRoom(id)).toBe(false);
  });
});

describe("hull specs", () => {
  it.each(Object.keys(HULLS))("%s has an outline, a cockpit first and no text in its compartments", (k) => {
    const h = HULLS[k];
    expect(h.id).toBe(k);
    expect(h.outline).toMatch(/^M/);
    expect(h.rooms[0]).toMatchObject({ key: "cockpit", name: "Cockpit" });
    for (const p of [...h.compartments, ...h.fixtures]) expect(["path", "rect", "circle", "line"]).toContain(p.tag);
  });
  it("the generic ship has no compartments; the real ones do", () => {
    expect(HULLS.generic.compartments).toEqual([]);
    expect(HULLS.skiff.compartments.length).toBeGreaterThan(0);
    expect(HULLS.courier.compartments.length).toBeGreaterThan(0);
  });
  it("the courier's seats are fixtures; the skiff has none", () => {
    expect(HULLS.courier.fixtures.length).toBeGreaterThan(0);
    expect(HULLS.skiff.fixtures).toEqual([]);
  });
});

describe("shipShape", () => {
  it("is the skiff's cockpit in plan coordinates", () => {
    // the mockup's skiff cockpit: x 58, y 70, 84 × 58, rx 6
    const [x, y] = toPlan([58, 70]);
    expect(shipShape(HULLS.skiff)).toEqual({ kind: "rect", x, y, width: 84 * SCALE, height: 58 * SCALE, rx: 6 * SCALE });
  });
  it("falls back to the first room for an unknown key", () => {
    expect(shipShape(HULLS.courier, "galley")).toEqual(shipShape(HULLS.courier));
  });
});

describe("hullExtent", () => {
  it("the courier is taller and narrower than the skiff", () => {
    const s = hullExtent(HULLS.skiff);
    const c = hullExtent(HULLS.courier);
    expect(c.h).toBeGreaterThan(s.h * 0.9);
    expect(c.w).toBeLessThan(s.w);
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
