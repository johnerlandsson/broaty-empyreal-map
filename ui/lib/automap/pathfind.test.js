import { describe, it, expect } from "vitest";
import { createMap, addRoom, linkExit } from "./graph.js";
import { findPath, distances } from "./pathfind.js";

// Build a chain r0 -e-> r1 -e-> ... with reverse w links; returns the room objects.
function line(map, n) {
  const rooms = [];
  for (let i = 0; i < n; i++) rooms.push(addRoom(map, { key: `k${i}`, name: `R${i}` }));
  for (let i = 0; i < n - 1; i++) {
    linkExit(map, rooms[i].id, "e", rooms[i + 1].id);
    linkExit(map, rooms[i + 1].id, "w", rooms[i].id);
  }
  return rooms;
}

describe("findPath", () => {
  it("returns an empty path when already at the destination", () => {
    const m = createMap();
    const [a] = line(m, 1);
    expect(findPath(m, a.id, a.id)).toEqual([]);
  });

  it("finds a straight-line path following stored exits", () => {
    const m = createMap();
    const r = line(m, 3);
    const path = findPath(m, r[0].id, r[2].id);
    expect(path.map((s) => s.dir)).toEqual(["e", "e"]);
    expect(path[0].fromId).toBe(r[0].id);
    expect(path[1].toId).toBe(r[2].id);
  });

  it("returns null when the destination is unreachable", () => {
    const m = createMap();
    const r = line(m, 2);
    const island = addRoom(m, { key: "iso", name: "Island" });
    expect(findPath(m, r[0].id, island.id)).toBeNull();
  });

  it("routes across areas (exits are not area-filtered)", () => {
    const m = createMap();
    const a = addRoom(m, { key: "a", name: "Street", areaId: "1" });
    const b = addRoom(m, { key: "b", name: "Hall", areaId: "2" });
    linkExit(m, a.id, "n", b.id);
    linkExit(m, b.id, "s", a.id);
    expect(findPath(m, a.id, b.id).map((s) => s.dir)).toEqual(["n"]);
  });

  it("picks the shorter of two routes (BFS shortest hop)", () => {
    const m = createMap();
    const r = [];
    for (let i = 0; i < 3; i++) r.push(addRoom(m, { key: `s${i}`, name: `S${i}` }));
    linkExit(m, r[0].id, "e", r[1].id); linkExit(m, r[1].id, "w", r[0].id);
    linkExit(m, r[1].id, "e", r[2].id); linkExit(m, r[2].id, "w", r[1].id);
    linkExit(m, r[0].id, "ne", r[2].id); linkExit(m, r[2].id, "sw", r[0].id);
    expect(findPath(m, r[0].id, r[2].id).map((s) => s.dir)).toEqual(["ne"]);
  });
});

describe("distances", () => {
  it("labels BFS hop counts and omits unreachable rooms", () => {
    const m = createMap();
    const r = line(m, 3);
    const iso = addRoom(m, { key: "iso", name: "Iso" });
    const d = distances(m, r[0].id);
    expect(d[r[0].id]).toBe(0);
    expect(d[r[1].id]).toBe(1);
    expect(d[r[2].id]).toBe(2);
    expect(d[iso.id]).toBeUndefined();
  });
});

describe("findPath through in/out", () => {
  it("routes through an in exit and back out", () => {
    const m = createMap();
    const [a, b] = line(m, 2);
    const ship = addRoom(m, { key: "ship", name: "Airlock" });
    linkExit(m, b.id, "in", ship.id);
    linkExit(m, ship.id, "out", b.id);
    expect(findPath(m, a.id, ship.id).map((s) => s.dir)).toEqual(["e", "in"]);
    expect(findPath(m, ship.id, a.id).map((s) => s.dir)).toEqual(["out", "w"]);
  });
});


import { addLink } from "./links.js";
import { LINK_COST } from "./pathfind.js";

describe("findPath over links", () => {
  function shaft() {
    const m = createMap();
    const rooms = ["Rim", "Mid", "Inner", "Hub"].map((name, z) =>
      addRoom(m, { key: name, name, coords: { x: 0, y: 0, z } }));
    return { m, rooms };
  }

  it("takes a link where there's no exit", () => {
    const { m, rooms: [rim, , , hub] } = shaft();
    addLink(m, rim.id, hub.id, { name: "Lift 12" });
    expect(findPath(m, rim.id, hub.id)).toEqual([
      { fromId: rim.id, link: { name: "Lift 12" }, toId: hub.id },
    ]);
  });

  it("prefers exits until the walk is longer than a link", () => {
    const { m, rooms } = shaft();
    for (let i = 0; i < 3; i++) linkExit(m, rooms[i].id, "u", rooms[i + 1].id);
    addLink(m, rooms[0].id, rooms[3].id);
    expect(findPath(m, rooms[0].id, rooms[3].id).map((s) => s.dir)).toEqual(["u", "u", "u"]);
    // A walk longer than LINK_COST steps loses to the link.
    const far = [rooms[3]];
    for (let i = 0; i < LINK_COST; i++) {
      const r = addRoom(m, { key: `F${i}`, name: `F${i}` });
      linkExit(m, far[far.length - 1].id, "e", r.id);
      far.push(r);
    }
    const end = far[far.length - 1];
    addLink(m, rooms[0].id, end.id);
    expect(findPath(m, rooms[0].id, end.id)).toHaveLength(1);
  });

  it("counts a link's cost in distances", () => {
    const { m, rooms: [rim, mid] } = shaft();
    addLink(m, rim.id, mid.id);
    expect(distances(m, rim.id)[mid.id]).toBe(LINK_COST);
  });
});
