import { describe, it, expect } from "vitest";
import {
  createMap, addRoom, getRoom, getRoomByKey, linkExit,
  setCurrent, currentRoom, toJSON, fromJSON, setTerrains,
  addArea, getArea, getAreaByKey, listAreas,
} from "./graph.js";

describe("graph", () => {
  it("creates an empty map", () => {
    const m = createMap();
    expect(m.version).toBe(2);
    expect(m.rooms).toEqual({});
    expect(m.currentId).toBeNull();
  });

  it("adds rooms with unique ids and key index, defaulting coords", () => {
    const m = createMap();
    const a = addRoom(m, { key: "K1", name: "Foo", env: "city" });
    const b = addRoom(m, { key: "K2", name: "Bar", env: "forest", coords: { x: 1, y: 0, z: 0 } });
    expect(a.id).not.toBe(b.id);
    expect(a.coords).toEqual({ x: 0, y: 0, z: 0 });
    expect(b.coords).toEqual({ x: 1, y: 0, z: 0 });
    expect(getRoom(m, a.id)).toBe(a);
    expect(getRoomByKey(m, "K2")).toBe(b);
    expect(getRoomByKey(m, "nope")).toBeNull();
  });

  it("links exits and sets current", () => {
    const m = createMap();
    const a = addRoom(m, { key: "K1", name: "A", env: "city" });
    const b = addRoom(m, { key: "K2", name: "B", env: "city" });
    linkExit(m, a.id, "n", b.id);
    expect(a.exits.n).toEqual({ to: b.id });
    setCurrent(m, b.id);
    expect(currentRoom(m)).toBe(b);
  });

  it("round-trips through JSON", () => {
    const m = createMap();
    const a = addRoom(m, { key: "K1", name: "A", env: "city" });
    const b = addRoom(m, { key: "K2", name: "B", env: "city" });
    linkExit(m, a.id, "n", b.id);
    setCurrent(m, a.id);
    const restored = fromJSON(toJSON(m));
    expect(restored.currentId).toBe(a.id);
    expect(getRoomByKey(restored, "K2").name).toBe("B");
    expect(getRoom(restored, a.id).exits.n).toEqual({ to: b.id });
  });

  it("returns a fresh map on bad or version-mismatched JSON", () => {
    expect(fromJSON("not json").version).toBe(2);
    expect(fromJSON("not json").rooms).toEqual({});
    expect(fromJSON(JSON.stringify({ version: 999 })).rooms).toEqual({});
  });

  it("creates a v2 map with area containers", () => {
    const m = createMap();
    expect(m.version).toBe(2);
    expect(m.areas).toEqual({});
    expect(m.areaKeyIndex).toEqual({});
    expect(m.nextAreaId).toBe(1);
  });

  it("adds areas with unique ids, key index, and derived label", () => {
    const m = createMap();
    const a = addArea(m, { key: "__overworld__", label: "Overworld" });
    const b = addArea(m, { key: null, label: "Interior" });
    expect(a.id).not.toBe(b.id);
    expect(getArea(m, a.id)).toBe(a);
    expect(getAreaByKey(m, "__overworld__")).toBe(a);
    expect(getAreaByKey(m, "nope")).toBeNull();
    // a null-keyed area is never indexed for lookup
    expect(b.key).toBeNull();
  });

  it("assigns areaId to rooms and lists areas by numeric id order", () => {
    const m = createMap();
    const a1 = addArea(m, { key: "k1", label: "Zone One" });
    const a2 = addArea(m, { key: "k2", label: "Zone Two" });
    const r = addRoom(m, { key: "R", name: "R", env: "", areaId: a2.id });
    expect(r.areaId).toBe(a2.id);
    expect(listAreas(m)).toEqual([
      { id: a1.id, label: "Zone One" },
      { id: a2.id, label: "Zone Two" },
    ]);
  });

  it("migrates a v1 map into a single Overworld area", () => {
    // Build a v1-shaped blob by hand (no areas).
    const v1 = JSON.stringify({
      version: 1,
      rooms: {
        "1": { id: "1", key: "A", name: "A", env: "city", coords: { x: 0, y: 0, z: 0 }, exits: { n: { to: "2" } } },
        "2": { id: "2", key: "B", name: "B", env: "city", coords: { x: 0, y: -1, z: 0 }, exits: { s: { to: "1" } } },
      },
      keyIndex: { A: "1", B: "2" },
      nextId: 3,
      currentId: "1",
    });
    const m = fromJSON(v1);
    expect(m.version).toBe(2);
    const areas = listAreas(m);
    expect(areas.length).toBe(1);
    expect(areas[0].label).toBe("Overworld");
    // every room reassigned, coords + exits intact
    expect(getRoom(m, "1").areaId).toBe(areas[0].id);
    expect(getRoom(m, "2").areaId).toBe(areas[0].id);
    expect(getRoom(m, "2").coords).toEqual({ x: 0, y: -1, z: 0 });
    expect(getRoom(m, "1").exits.n).toEqual({ to: "2" });
    expect(m.currentId).toBe("1");
  });

  it("round-trips a v2 map with areas", () => {
    const m = createMap();
    const area = addArea(m, { key: "__overworld__", label: "Overworld" });
    const r = addRoom(m, { key: "R", name: "R", env: "", areaId: area.id, coords: { x: 2, y: 0, z: 0 } });
    setCurrent(m, r.id);
    const restored = fromJSON(toJSON(m));
    expect(restored.version).toBe(2);
    expect(getAreaByKey(restored, "__overworld__").label).toBe("Overworld");
    expect(getRoom(restored, r.id).areaId).toBe(area.id);
    expect(restored.currentId).toBe(r.id);
  });
});

describe("terrains", () => {
  it("merges definitions, reports change, and survives a round-trip", () => {
    const m = createMap();
    expect(m.terrains).toEqual({});
    expect(setTerrains(m, { city: { label: "City", color: "#c0c0c0" } })).toBe(true);
    expect(setTerrains(m, { city: { label: "City", color: "#c0c0c0" } })).toBe(false);
    expect(setTerrains(m, { forest: { label: "Forest", color: null } })).toBe(true);
    expect(Object.keys(m.terrains)).toEqual(["city", "forest"]);
    expect(fromJSON(toJSON(m)).terrains).toEqual(m.terrains);
  });

  it("loads an older save without terrains as none", () => {
    const old = JSON.stringify({ version: 2, rooms: {}, areas: {} });
    expect(fromJSON(old).terrains).toEqual({});
  });
});
