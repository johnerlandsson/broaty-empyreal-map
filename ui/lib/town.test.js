import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import zennor from "../data/zennor.js";
import { CELL, STEP, TOWNS, indexTown, locateTown, placeRooms, townInfo, townLayout, townShape } from "./town.js";

const spec = TOWNS.zennor;
const index = indexTown(zennor, spec);
const layout = townLayout(index, spec);
const room = (id) => index.byId.get(`zennor.${id}`);
const cell = (id) => [room(id).cell.x, room(id).cell.y];
const box = (id) => layout.byId.get(`zennor.${id}`);
const BACK = { north: "south", south: "north", east: "west", west: "east", up: "down", down: "up" };

describe("placeRooms", () => {
  it("takes a step each compass way from the root", () => {
    const rooms = [
      { id: "a", exits: { north: "b", east: "c" } },
      { id: "b", exits: { south: "a", west: "d" } },
      { id: "c", exits: { west: "a" } },
      { id: "d", exits: { east: "b" } },
    ];
    const p = placeRooms(rooms, "a");
    expect([...p].map(([id, { x, y }]) => [id, x, y])).toEqual([["a", 0, 0], ["b", 0, 1], ["c", 1, 0], ["d", -1, 1]]);
  });

  it("carries `up` on the way you came, east when you didn't, and counts the rise", () => {
    const p = placeRooms(
      [
        { id: "a", exits: { south: "b", up: "x" } },
        { id: "b", exits: { up: "c" } },
        { id: "c", exits: { down: "b", up: "e" } },
        { id: "e", exits: {} },
        { id: "x", exits: {} },
      ],
      "a",
    );
    expect(p.get("x")).toEqual({ x: 1, y: 0, rise: 1, heading: "east" });
    expect(p.get("c")).toEqual({ x: 0, y: -2, rise: 1, heading: "south" });
    expect(p.get("e")).toEqual({ x: 0, y: -3, rise: 2, heading: "south" });
  });

  it("pushes a room on past a taken cell, and leaves out what it can't reach", () => {
    const p = placeRooms(
      [
        { id: "a", exits: { east: "b", up: "c" } },
        { id: "b", exits: {} },
        { id: "c", exits: {} },
        { id: "lost", exits: { north: "a" } },
      ],
      "a",
    );
    expect(p.get("c")).toMatchObject({ x: 2, y: 0 });
    expect(p.has("lost")).toBe(false);
  });

  it("starts from the first room without a root, and takes nothing", () => {
    expect(placeRooms([{ id: "q" }]).get("q")).toEqual({ x: 0, y: 0, rise: 0, heading: null });
    expect(placeRooms([]).size).toBe(0);
    expect(placeRooms(undefined).size).toBe(0);
  });
});

describe("Zennor's data", () => {
  it("has the fourteen rooms of content/areas/zennor.yaml at 1 g, all placed", () => {
    expect(zennor.rooms.length).toBe(14);
    expect(index.byId.size).toBe(14);
    expect(zennor.area).toEqual({ id: "zennor", name: "Zennor", gravity: 1 });
    for (const r of index.byId.values()) expect(r.gravity, r.id).toBe(1);
  });

  it("has every exit's way back, and no two rooms in one cell", () => {
    for (const r of zennor.rooms) {
      for (const [dir, to] of Object.entries(r.exits)) {
        expect(zennor.rooms.find((t) => t.id === to)?.exits[BACK[dir]], `${r.id} ${dir}`).toBe(r.id);
      }
    }
    const cells = [...index.byId.values()].map((r) => `${r.cell.x}:${r.cell.y}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it("puts every compass exit one cell its way", () => {
    for (const r of index.byId.values()) {
      for (const [dir, to] of Object.entries(r.exits)) {
        if (!STEP[dir]) continue;
        const t = index.byId.get(to);
        expect([t.cell.x - r.cell.x, t.cell.y - r.cell.y], `${r.id} ${dir}`).toEqual(STEP[dir]);
      }
    }
  });

  it("lays the town out as the help says: the field north, Fore Street south to the terraces, the ridge east", () => {
    expect(cell("square")).toEqual([0, 0]);
    expect(cell("field")).toEqual([0, 3]);
    expect(cell("field-office")).toEqual([-1, 3]);
    expect(cell("tower")).toEqual([1, 3]);
    expect(cell("gate")).toEqual([0, 2]);
    expect(cell("fore-top")).toEqual([0, 1]);
    expect(cell("fore-foot")).toEqual([0, -1]);
    expect(cell("lower-terraces")).toEqual([0, -3]);
    expect(cell("ridge-path")).toEqual([1, 1]);
    // up the ridge: on east, one higher, not north
    expect(cell("overlook")).toEqual([2, 1]);
    expect(room("overlook").rise).toBe(1);
  });

  it("makes indoor rooms buildings, the berth a field, and the rest open ground by the spec", () => {
    const kinds = Object.fromEntries([...index.byId.values()].map((r) => [r.id.slice(7), r.kind]));
    expect(kinds).toEqual({
      field: "field",
      "field-office": "building",
      tower: "building",
      gate: "street",
      "fore-top": "street",
      "ridge-path": "path",
      overlook: "overlook",
      square: "square",
      exchange: "building",
      inn: "building",
      "fore-foot": "street",
      "water-house": "building",
      terraces: "terraces",
      "lower-terraces": "old-terraces",
    });
    for (const r of index.byId.values()) if (r.kind === "building") expect(spec.tints[r.id], r.id).toBeTruthy();
  });

  const yaml = join(homedir(), "dev/empyreal/content/areas/zennor.yaml");
  it.skipIf(!existsSync(yaml))("matches zennor.yaml's names, flags, exits and gravity", () => {
    const text = readFileSync(yaml, "utf8");
    expect(Number(/\n {2}gravity: ([\d.]+)/.exec(text)[1])).toBe(zennor.area.gravity);
    expect(/\n {2}name: (.+)/.exec(text)[1].trim()).toBe(zennor.area.name);
    const rooms = text
      .split(/\n {2}- id: /)
      .slice(1)
      .map((chunk) => {
        const id = chunk.split("\n")[0].trim();
        const name = /\n {4}name: (.+)/.exec(chunk)[1].trim();
        const flags = /\n {4}flags: \[(.*)\]/.exec(chunk)[1].split(",").map((f) => f.trim()).filter(Boolean);
        const block = /\n {4}exits:\n((?: {6}.+\n?)+)/.exec(chunk)[1];
        const exits = Object.fromEntries([...block.matchAll(/ {6}(\w+): ([\w.-]+)/g)].map((m) => [m[1], m[2]]));
        return { id, name, flags, exits };
      });
    expect(zennor.rooms.map(({ id, name, flags, exits }) => ({ id, name, flags, exits }))).toEqual(rooms);
  });
});

describe("townLayout", () => {
  it("centres each room in its cell, north up", () => {
    expect([box("square").cx, box("square").cy]).toEqual([0, 0]);
    expect([box("field").cx, box("field").cy]).toEqual([0, -3 * CELL.h]);
    expect([box("water-house").cx, box("water-house").cy]).toEqual([-CELL.w, CELL.h]);
  });

  it("links each exit once: street, path, door, track, and a climb up the ridge", () => {
    const kind = (a, b) => layout.links.find((l) => [l.a, l.b].sort().join() === [`zennor.${a}`, `zennor.${b}`].sort().join())?.kind;
    expect(layout.links.length).toBe(13);
    expect(kind("gate", "field")).toBe("street");
    expect(kind("fore-top", "square")).toBe("street");
    expect(kind("fore-top", "ridge-path")).toBe("path");
    expect(kind("field", "tower")).toBe("door");
    expect(kind("square", "inn")).toBe("door");
    expect(kind("fore-foot", "terraces")).toBe("track");
    expect(kind("terraces", "lower-terraces")).toBe("track");
    expect(kind("ridge-path", "overlook")).toBe("climb");
  });

  it("runs a link from edge to edge, and the climb east from the path to the overlook's rim", () => {
    const door = layout.links.find((l) => l.b === "zennor.inn" || l.a === "zennor.inn");
    expect(door.x).toBe(box("square").w / 2);
    expect(door.x + door.width).toBe(CELL.w - box("inn").w / 2);
    const climb = layout.links.find((l) => l.kind === "climb");
    expect(climb).toMatchObject({ way: "east", lower: "zennor.ridge-path", x1: CELL.w + box("ridge-path").w / 2, x2: 2 * CELL.w - box("overlook").w / 2 });
    expect(climb.y1).toBe(climb.y2);
  });

  it("walls the town from the gate to the foot of the street, open at the gate, the ridge path and the track", () => {
    const w = layout.wall;
    expect(w.y0).toBe(box("gate").cy);
    expect(w.x0).toBeLessThan(box("exchange").cx - box("exchange").w / 2);
    expect(w.x1).toBeGreaterThan(box("inn").cx + box("inn").w / 2);
    expect(w.y1).toBeGreaterThan(box("water-house").cy + box("water-house").h / 2);
    expect(w.y1).toBeLessThan(box("terraces").cy - box("terraces").h / 2);
    expect(w.gaps.map(({ side, at, gate }) => [side, at, gate]).sort()).toEqual([
      ["east", box("ridge-path").cy, false],
      ["north", 0, true],
      ["south", 0, false],
    ]);
  });

  it("names a street beside it where nothing leaves that way", () => {
    const at = (id) => layout.labels.find((l) => l.room.id === `zennor.${id}`);
    expect(at("gate")).toMatchObject({ anchor: "start", lines: ["Field Gate"], y: box("gate").cy + 13 }); // inside the wall
    expect(at("fore-foot").y).toBe(box("fore-foot").cy);
    expect(at("fore-top")).toMatchObject({ anchor: "end", lines: ["Top of", "Fore Street"] });
    expect(at("fore-foot").anchor).toBe("start");
    expect(at("ridge-path").anchor).toBe("middle"); // the street west, the climb east
    expect(layout.labels.length).toBe(4);
  });

  it("frames everything", () => {
    const { bounds, extent, home } = layout;
    for (const b of layout.boxes) {
      expect(b.cx - b.w / 2).toBeGreaterThan(bounds.x0);
      expect(b.cy + b.h / 2).toBeLessThan(bounds.y1);
    }
    expect(extent.w).toBe(bounds.x1 - bounds.x0);
    expect(home).toEqual([(bounds.x0 + bounds.x1) / 2, (bounds.y0 + bounds.y1) / 2]);
  });
});

describe("townShape", () => {
  const at = (id) => townShape(layout, { kind: "room", id: `zennor.${id}`, level: 0 });

  it("lights a room's box, the square's rounder, and the overlook's circle", () => {
    expect(at("inn")).toEqual({ kind: "rect", x: CELL.w - 52, y: -27, width: 104, height: 54, rx: 5 });
    expect(at("square")).toMatchObject({ kind: "rect", rx: 10 });
    expect(at("field")).toMatchObject({ kind: "rect", width: box("field").w });
    expect(at("overlook")).toEqual({ kind: "circle", cx: 2 * CELL.w, cy: -CELL.h, r: box("overlook").w / 2 });
  });

  it("lights a street's stretch: halfway along each way it joins open ground", () => {
    const top = at("fore-top");
    expect(top.kind).toBe("path");
    expect([top.cx, top.cy]).toEqual([0, -CELL.h]);
    const pts = top.d.slice(1, -1).split("L").map((p) => p.split(",").map(Number));
    const ys = pts.map((p) => p[1]);
    const xs = pts.map((p) => p[0]);
    expect(Math.min(...ys)).toBe(-CELL.h - CELL.h / 2); // halfway to the gate
    expect(Math.max(...ys)).toBe(-CELL.h + CELL.h / 2); // halfway to the square, short of its edge
    expect(Math.max(...xs)).toBe(CELL.w / 2); // halfway along the path to the ridge
    expect(Math.min(...xs)).toBe(-14); // nothing west
    // the foot: north to the square, but not down the track or into the water house
    const foot = at("fore-foot").d.slice(1, -1).split("L").map((p) => p.split(",").map(Number));
    expect(Math.max(...foot.map((p) => p[1]))).toBe(CELL.h + 14);
    expect(Math.min(...foot.map((p) => p[0]))).toBe(-14);
  });

  it("lights nothing off the plan", () => {
    expect(townShape(layout, { kind: "off", name: "" })).toBe(null);
    expect(townShape(layout, { kind: "room", id: "tiss.market" })).toBe(null);
    expect(townShape(null, { kind: "room", id: "zennor.square" })).toBe(null);
  });
});

describe("locateTown and townInfo", () => {
  it("finds your room, or says you're off the plan", () => {
    expect(locateTown(index, { roomId: "zennor.square" })).toEqual({ kind: "room", id: "zennor.square", level: 0, x: 0, y: 0 });
    expect(locateTown(index, { roomId: "ship.41.cockpit", name: "Cockpit" })).toEqual({ kind: "off", name: "Cockpit" });
    for (const m of [null, undefined, 7, "x", { roomId: 3 }]) expect(locateTown(index, m).kind).toBe("off");
  });

  it("says the room, the town and the gravity", () => {
    const line = (msg) => townInfo(locateTown(index, msg), msg, index);
    expect(line({ roomId: "zennor.square", name: "The Square", gravity: 1 })).toBe("THE SQUARE · Zennor · 1 g");
    expect(line({ roomId: "zennor.overlook" })).toBe("THE OVERLOOK · Zennor · 1 g");
    expect(line({ roomId: "ship.41.cockpit", name: "Cockpit of the Magpie" })).toBe("COCKPIT OF THE MAGPIE");
    expect(townInfo(null, null, index)).toBe("");
  });
});
