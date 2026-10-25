import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import zennor from "../data/zennor.js";
import { CELL, STEP, TOWNS, exitTo, indexTown, locateTown, placeRooms, townFrame, townInfo, townLayout, townShape } from "./town.js";

const spec = TOWNS.zennor;
const index = indexTown(zennor, spec);
const layout = townLayout(index, spec);
const room = (id) => index.byId.get(`zennor.${id}`);
const cell = (id) => [room(id).cell.x, room(id).cell.y];
const box = (id) => layout.byId.get(`zennor.${id}`);
const linkOf = (a, b) => layout.links.find((l) => [l.a, l.b].sort().join() === [`zennor.${a}`, `zennor.${b}`].sort().join());
const BACK = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
  northeast: "southwest",
  southwest: "northeast",
  northwest: "southeast",
  southeast: "northwest",
  up: "down",
  down: "up",
};

/** Whether b is on the side of a that dir says, by its sign each way: east is anywhere east in a's row. */
const onItsSide = (a, b, [dx, dy]) => Math.sign(b.x - a.x) === dx && Math.sign(b.y - a.y) === dy;

describe("placeRooms", () => {
  it("takes a step each compass way from the root, diagonals too", () => {
    const rooms = [
      { id: "a", exits: { north: "b", east: "c", southwest: "e" } },
      { id: "b", exits: { south: "a", west: "d" } },
      { id: "c", exits: { west: "a" } },
      { id: "d", exits: { east: "b" } },
      { id: "e", exits: { northeast: "a" } },
    ];
    const p = placeRooms(rooms, "a");
    expect([...p].map(([id, { x, y }]) => [id, x, y])).toEqual([["a", 0, 0], ["b", 0, 1], ["c", 1, 0], ["e", -1, -1], ["d", -1, 1]]);
  });

  it("goes `up` uphill and `down` downhill, east unless told, and counts the rise", () => {
    const rooms = [
      { id: "a", exits: { south: "b", up: "x" } },
      { id: "b", exits: { north: "a", down: "c" } },
      { id: "c", exits: { up: "b" } },
      { id: "x", exits: { down: "a" } },
    ];
    const p = placeRooms(rooms, "a");
    expect(p.get("x")).toEqual({ x: 1, y: 0, rise: 1 });
    expect(p.get("c")).toEqual({ x: -1, y: -1, rise: -1 });
    expect(placeRooms(rooms, "a", "west").get("x")).toEqual({ x: -1, y: 0, rise: 1 });
  });

  it("takes exits as the way to go, not a cell: a way stretches rather than send a room the wrong way", () => {
    // u, west of s, and t, southwest of r, would share a cell
    const rooms = [
      { id: "r", exits: { south: "s", southwest: "t" } },
      { id: "s", exits: { north: "r", west: "u" } },
      { id: "t", exits: { northeast: "r" } },
      { id: "u", exits: { east: "s" } },
    ];
    const p = placeRooms(rooms, "r");
    for (const r of rooms) for (const [dir, to] of Object.entries(r.exits)) expect(onItsSide(p.get(r.id), p.get(to), STEP[dir]), `${r.id} ${dir}`).toBe(true);
    const cells = [...p.values()].map(({ x, y }) => `${x}:${y}`);
    expect(new Set(cells).size).toBe(4);
  });

  it("still places every room when the exits can't all be true, and leaves out what it can't reach", () => {
    const p = placeRooms(
      [
        { id: "a", exits: { east: "b" } },
        { id: "b", exits: { east: "c" } },
        { id: "c", exits: { east: "a" } },
        { id: "lost", exits: { north: "a" } },
      ],
      "a",
    );
    expect([...p.keys()].sort()).toEqual(["a", "b", "c"]);
  });

  it("starts from the first room without a root, and takes nothing", () => {
    expect(placeRooms([{ id: "q" }]).get("q")).toEqual({ x: 0, y: 0, rise: 0 });
    expect(placeRooms([]).size).toBe(0);
    expect(placeRooms(undefined).size).toBe(0);
  });

  it("reads `{ to, via, seconds }` exits as plain ones", () => {
    expect(exitTo("zennor.gate")).toBe("zennor.gate");
    expect(exitTo({ to: "zennor.gate", via: "steps", seconds: 12 })).toBe("zennor.gate");
    expect(exitTo(undefined)).toBe(null);
  });
});

describe("Zennor's data", () => {
  it("has the 45 rooms of content/areas/zennor.yaml in its seven districts at 1 g, all placed", () => {
    expect(zennor.rooms.length).toBe(45);
    expect(index.byId.size).toBe(45);
    expect(zennor.area).toMatchObject({ id: "zennor", name: "Zennor", gravity: 1 });
    expect(zennor.area.districts.map((d) => d.id)).toEqual(["downs", "old-town", "market-quarter", "courts", "rows", "riverside", "terraces"]);
    for (const r of index.byId.values()) {
      expect(r.gravity, r.id).toBe(1);
      expect(zennor.area.districts.some((d) => d.id === r.district), r.id).toBe(true);
    }
    for (const d of zennor.area.districts) expect(room(d.entrance.slice(7))?.district, d.id).toBe(d.id);
  });

  it("has the Steps both ways with their seconds, and the tram's four stops bottom to top", () => {
    expect(room("steps-head").exits.down).toEqual({ to: "zennor.gate", via: "steps", seconds: 12 });
    expect(room("gate").exits.up).toEqual({ to: "zennor.steps-head", via: "steps", seconds: 40 });
    expect(zennor.cars).toEqual([
      { id: "zennor.tram", name: "The Tram", kind: "tram", stops: ["zennor.tram-riverside", "zennor.tram-market", "zennor.tram-uptown", "zennor.tram-downs"] },
    ]);
  });

  it("has every exit's way back", () => {
    for (const r of zennor.rooms) {
      for (const [dir, e] of Object.entries(r.exits)) {
        expect(exitTo(zennor.rooms.find((t) => t.id === exitTo(e))?.exits[BACK[dir]]), `${r.id} ${dir}`).toBe(r.id);
      }
    }
  });

  it("puts every room on the side its exits say, `up` uphill (east), and no two in one cell", () => {
    for (const r of index.byId.values()) {
      for (const [dir, e] of Object.entries(r.exits)) {
        const step = STEP[dir] ?? (dir === "up" ? STEP.east : STEP.west);
        expect(onItsSide(r.cell, index.byId.get(exitTo(e)).cell, step), `${r.id} ${dir}`).toBe(true);
      }
    }
    const cells = [...index.byId.values()].map((r) => `${r.cell.x}:${r.cell.y}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it("runs no way through another room, crosses no two, and stretches few", () => {
    const ways = layout.links.map((l) => [room(l.a.slice(7)).cell, room(l.b.slice(7)).cell, l]);
    const taken = new Set([...index.byId.values()].map((r) => `${r.cell.x}:${r.cell.y}`));
    let stretch = 0;
    for (const [p, q, l] of ways) {
      const n = Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
      for (let k = 1; k < n; k++) expect(taken.has(`${p.x + ((q.x - p.x) * k) / n}:${p.y + ((q.y - p.y) * k) / n}`), `${l.a} ${l.b}`).toBe(false);
      stretch += Math.max(0, Math.abs(p.x - q.x) - 1) + Math.max(0, Math.abs(p.y - q.y) - 1);
    }
    const side = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    for (const [p, q, l] of ways) {
      for (const [r, s, m] of ways) {
        if ([l.a, l.b].some((id) => id === m.a || id === m.b)) continue;
        expect(side(p, q, r) * side(p, q, s) < 0 && side(r, s, p) * side(r, s, q) < 0, `${l.a}-${l.b} × ${m.a}-${m.b}`).toBe(false);
      }
    }
    expect(stretch).toBeLessThanOrEqual(4); // Conduit Square to Court Street and the Pannier Market, it to Slate Rows, the Embankment to Cistern Lane
  });

  it("lays the city out as the valley goes: the old town east of the market, the Steps and the Downs uphill east of it", () => {
    expect(cell("square")).toEqual([0, 0]);
    expect(cell("fore-top")).toEqual([1, 0]);
    expect(cell("gate")).toEqual([2, 0]);
    expect(cell("steps-head")).toEqual([3, 0]); // up the Steps: east, not north
    expect(cell("port-road")).toEqual([4, 0]);
    expect(cell("field")).toEqual([4, 1]);
    expect(cell("overlook")).toEqual([2, 1]); // up from the ridge path: east, one higher
    expect(room("overlook").rise).toBe(1);
    expect(room("steps-head").rise).toBe(1);
    expect(cell("exchange-square")).toEqual([-3, 0]);
    expect(cell("tram-market")).toEqual([-4, -1]); // southwest of Conduit Square
    expect(cell("chandlers")).toEqual([-4, -2]);
    expect(cell("rolls-office")).toEqual([-5, -1]);
    // Riverside is the city's west edge, the Terraces south of it, downriver
    const west = Math.min(...[...index.byId.values()].map((r) => r.cell.x));
    expect(cell("carn-bridge")[0]).toBe(west);
    expect(cell("lower-terraces")[1]).toBe(Math.min(...[...index.byId.values()].map((r) => r.cell.y)));
  });

  it("makes indoor rooms buildings, the berth a field, and the rest open ground by the spec", () => {
    const kinds = Object.fromEntries([...index.byId.values()].map((r) => [r.id.slice(7), r.kind]));
    expect(kinds).toMatchObject({
      field: "field",
      tower: "building",
      "tram-downs": "building",
      gate: "street",
      "steps-head": "street",
      square: "square",
      "exchange-square": "square",
      garden: "garden",
      "ridge-path": "path",
      overlook: "overlook",
      "carn-bridge": "street",
      terraces: "terraces",
      "lower-terraces": "old-terraces",
    });
    for (const d of zennor.area.districts) expect(spec.tints[d.id], d.id).toBeTruthy();
  });

  const yaml = join(homedir(), "dev/empyreal/content/areas/zennor.yaml");
  it.skipIf(!existsSync(yaml))("matches zennor.yaml's rooms, districts, exits, the Steps and the tram", () => {
    const text = readFileSync(yaml, "utf8");
    expect(Number(/\n {2}gravity: ([\d.]+)/.exec(text)[1])).toBe(zennor.area.gravity);
    expect(/\n {2}name: (.+)/.exec(text)[1].trim()).toBe(zennor.area.name);
    const districts = [...text.matchAll(/\n {4}- \{ id: ([\w-]+), name: ([^,]+), entrance: ([\w.-]+) \}/g)].map((m) => ({ id: m[1], name: m[2].trim(), entrance: m[3] }));
    expect(zennor.area.districts).toEqual(districts);
    // `{ to: x, via: steps, seconds: 12 }` as an object; anything else a plain id
    const value = (v) => {
      if (!v.startsWith("{")) return v;
      const o = Object.fromEntries(v.slice(1, -1).split(",").map((s) => s.split(":").map((t) => t.trim())));
      return { ...o, seconds: Number(o.seconds) };
    };
    const rooms = [];
    const cars = [];
    for (const chunk of text.split(/\n {2}- id: /).slice(1)) {
      const id = chunk.split("\n")[0].trim();
      const name = /\n {4}name: (.+)/.exec(chunk)[1].trim();
      if (/\n {4}car:/.test(chunk)) {
        const kind = /\n {6}kind: (\w+)/.exec(chunk)[1];
        const stops = [...chunk.matchAll(/\n {8}- \{ room: ([\w.-]+)/g)].map((m) => m[1]);
        cars.push({ id, name, kind, stops });
        continue;
      }
      const district = /\n {4}district: (.+)/.exec(chunk)[1].trim();
      const flags = /\n {4}flags: \[(.*)\]/.exec(chunk)[1].split(",").map((f) => f.trim()).filter(Boolean);
      const block = /\n {4}exits:\n((?: {6}.+\n?)+)/.exec(chunk)[1];
      const exits = Object.fromEntries([...block.matchAll(/ {6}(\w+): (.+)/g)].map((m) => [m[1], value(m[2].trim())]));
      rooms.push({ id, name, district, flags, exits });
    }
    expect(zennor.rooms.map(({ id, name, district, flags, exits }) => ({ id, name, district, flags, exits }))).toEqual(rooms);
    expect(zennor.cars).toEqual(cars);
  });
});

describe("townLayout", () => {
  it("centres each room in its cell, north up", () => {
    expect([box("square").cx, box("square").cy]).toEqual([0, 0]);
    expect([box("field").cx, box("field").cy]).toEqual([4 * CELL.w, -CELL.h]);
    expect([box("tram-market").cx, box("tram-market").cy]).toEqual([-4 * CELL.w, CELL.h]);
  });

  it("links each exit once: street, path, door, track, a diagonal door, the Steps and a climb up the ridge", () => {
    expect(layout.links.length).toBe(44);
    expect(linkOf("fore-top", "square").kind).toBe("street");
    expect(linkOf("fore-top", "ridge-path").kind).toBe("path");
    expect(linkOf("field", "tower").kind).toBe("door");
    expect(linkOf("terrace-road", "terraces").kind).toBe("track");
    expect(linkOf("ridge-path", "overlook").kind).toBe("climb");
    expect(linkOf("square", "tinners-hall")).toMatchObject({ kind: "door", width: 14 });
    expect(linkOf("steps-head", "gate")).toMatchObject({ kind: "steps", way: "west", lower: "zennor.gate", seconds: { down: 12, up: 40 } });
    expect(linkOf("mill-lane", "carn-bridge").bridge).toBe(true);
  });

  it("runs a diagonal from edge to edge, and the Steps from street to street", () => {
    const d = linkOf("exchange-square", "tram-market");
    const sq = box("exchange-square");
    const st = box("tram-market");
    // out of the square's west side, into the station's top, along the line between their middles
    expect(d.x1).toBe(sq.cx - sq.w / 2);
    expect(d.y2).toBeCloseTo(st.cy - st.h / 2);
    const slope = (st.cy - sq.cy) / (st.cx - sq.cx);
    expect((d.y1 - sq.cy) / (d.x1 - sq.cx)).toBeCloseTo(slope);
    expect((d.y2 - sq.cy) / (d.x2 - sq.cx)).toBeCloseTo(slope);
    const steps = linkOf("steps-head", "gate");
    expect([steps.x1, steps.x2]).toEqual([box("steps-head").cx - 14, box("gate").cx + 14]);
    expect(steps.y1).toBe(0);
  });

  it("names each district beside it, on no room, and gives its cells for the wash", () => {
    const rooms = new Set(layout.boxes.map((b) => `${b.cx}:${b.cy}`));
    expect(layout.districts.map((d) => d.id)).toEqual(zennor.area.districts.map((d) => d.id));
    for (const d of layout.districts) {
      expect(rooms.has(`${d.label.x}:${d.label.y}`), d.id).toBe(false);
      expect(d.cells.length).toBe(zennor.rooms.filter((r) => r.district === d.id).length);
      expect(d.tint).toBe(spec.tints[d.id]);
    }
    expect(layout.districts.find((d) => d.id === "market-quarter").label).toEqual({ x: -3 * CELL.w, y: -2 * CELL.h }); // over the Corn Exchange
  });

  it("puts the river west of every room but the bridge's, and the bridge's way over it", () => {
    const { river } = layout;
    expect(river.name).toBe("the Carn");
    for (const b of layout.boxes) {
      if (b.room.id === "zennor.carn-bridge") continue;
      const p = river.points.find((q) => q[1] === b.cy);
      expect(p[0] + 18, b.room.id).toBeLessThan(b.cx - b.w / 2);
    }
    const bridge = linkOf("mill-lane", "carn-bridge");
    const at = river.points.find((q) => q[1] === box("carn-bridge").cy)[0];
    expect(bridge.x).toBeLessThan(at - 18);
    expect(bridge.x + bridge.width).toBeGreaterThan(at + 18);
  });

  it("draws the scarp midway along the Steps, the Downs' rows high, with the gate's arch at their foot", () => {
    const steps = linkOf("steps-head", "gate");
    expect(layout.scarp).toEqual({ x: (steps.x1 + steps.x2) / 2, y0: -CELL.h * 1.5, y1: CELL.h * 1.5, downhill: -1 });
    expect(layout.gate).toMatchObject({ x: box("gate").cx + 22, y: 0, rot: 90 });
  });

  it("runs the tram's line through its stops, round Pellow's rather than through it", () => {
    const { tram } = layout;
    expect(tram.stops).toEqual(zennor.cars[0].stops);
    const at = (id) => [layout.byId.get(id).cx, layout.byId.get(id).cy];
    for (const id of tram.stops) expect(tram.points).toContainEqual(at(id));
    // Uptown to the Downs: out of Uptown, along under the row, and up into Downs Station
    const i = tram.points.findIndex((p) => p[0] === box("tram-uptown").cx && p[1] === box("tram-uptown").cy);
    expect(tram.points.slice(i + 1, i + 3).map((p) => p[1])).toEqual([1.5 * CELL.h, 1.5 * CELL.h]);
  });

  it("names a street beside it where nothing leaves that way, and never on the river", () => {
    const at = (id) => layout.labels.find((l) => l.room.id === `zennor.${id}`);
    expect(at("port-road")).toMatchObject({ anchor: "start", lines: ["Port Road"] });
    expect(at("ridge-path").anchor).toBe("end");
    expect(at("gate")).toMatchObject({ anchor: "middle", y: box("gate").cy + 26 });
    expect(at("carn-bridge").anchor).toBe("end"); // the far bank
    // the Embankment's west is the water: over its way east instead
    expect(at("embankment")).toMatchObject({ anchor: "start", x: box("embankment").cx + 20 });
    expect(at("embankment").y).toBeLessThan(box("embankment").cy - 14);
    expect(layout.labels.length).toBe(18);
  });

  it("frames everything, wide enough for the whole city", () => {
    const { bounds, extent, home } = layout;
    for (const b of layout.boxes) {
      expect(b.cx - b.w / 2).toBeGreaterThan(bounds.x0);
      expect(b.cy + b.h / 2).toBeLessThan(bounds.y1);
    }
    expect(bounds.x0).toBeLessThan(Math.min(...layout.river.points.map((p) => p[0])) - 18);
    expect(extent.w).toBe(bounds.x1 - bounds.x0);
    expect(home).toEqual([(bounds.x0 + bounds.x1) / 2, (bounds.y0 + bounds.y1) / 2]);
  });
});

describe("townFrame", () => {
  it("frames your district and its name, the Downs while you're aboard, and the city without a district", () => {
    const market = layout.districts.find((d) => d.id === "market-quarter");
    const f = townFrame(layout, index, { kind: "room", id: "zennor.covered-market" });
    expect(f.home[0]).toBe((market.box.x0 + market.box.x1) / 2);
    expect(f.extent.h).toBe(market.box.y1 - market.label.y + 10 + 80);
    expect(townFrame(layout, index, { kind: "off", name: "Cockpit" })).toEqual(townFrame(layout, index, { kind: "room", id: "zennor.field" }));
    expect(townFrame(layout, { ...index, byId: new Map() }, null)).toEqual({ home: layout.home, extent: layout.extent });
  });
});

describe("townShape", () => {
  const at = (id) => townShape(layout, { kind: "room", id: `zennor.${id}`, level: 0 });

  it("lights a room's box, a square's and the garden's rounder, and the overlook's circle", () => {
    expect(at("inn")).toEqual({ kind: "rect", x: -52, y: -CELL.h - 27, width: 104, height: 54, rx: 5 });
    expect(at("exchange-square")).toMatchObject({ kind: "rect", rx: 10 });
    expect(at("garden")).toMatchObject({ kind: "rect", rx: 10 });
    expect(at("overlook")).toEqual({ kind: "circle", cx: 2 * CELL.w, cy: -CELL.h, r: box("overlook").w / 2 });
  });

  it("lights a street's stretch: halfway along each straight way it joins open ground", () => {
    const top = at("fore-top");
    expect([top.cx, top.cy]).toEqual([CELL.w, 0]);
    const pts = top.d.slice(1, -1).split("L").map((p) => p.split(",").map(Number));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    expect(Math.min(...ys)).toBe(-CELL.h / 2); // halfway up the path to the ridge
    expect(Math.max(...ys)).toBe(14); // not into Pellow's
    expect(Math.min(...xs)).toBe(CELL.w / 2); // halfway to the square
    expect(Math.max(...xs)).toBe(CELL.w * 1.5); // halfway to the gate
    // the Steps aren't a street: the head of them lights east only
    const head = at("steps-head").d.slice(1, -1).split("L").map((p) => p.split(",").map(Number));
    expect(Math.min(...head.map((p) => p[0]))).toBe(3 * CELL.w - 14);
  });

  it("lights nothing off the plan", () => {
    expect(townShape(layout, { kind: "off", name: "" })).toBe(null);
    expect(townShape(layout, { kind: "room", id: "zennor.tram" })).toBe(null);
    expect(townShape(null, { kind: "room", id: "zennor.square" })).toBe(null);
  });
});

describe("locateTown and townInfo", () => {
  it("finds your room, or says you're off the plan (aboard the tram, too)", () => {
    expect(locateTown(index, { roomId: "zennor.square" })).toEqual({ kind: "room", id: "zennor.square", level: 0, x: 0, y: 0 });
    expect(locateTown(index, { roomId: "ship.41.cockpit", name: "Cockpit" })).toEqual({ kind: "off", name: "Cockpit" });
    expect(locateTown(index, { roomId: "zennor.tram", name: "The Tram" })).toEqual({ kind: "off", name: "The Tram" });
    for (const m of [null, undefined, 7, "x", { roomId: 3 }]) expect(locateTown(index, m).kind).toBe("off");
  });

  it("says the room, its district, the town and the gravity", () => {
    const line = (msg) => townInfo(locateTown(index, msg), msg, index);
    expect(line({ roomId: "zennor.exchange-square", name: "Conduit Square", gravity: 1 })).toBe("CONDUIT SQUARE · the Market Quarter · Zennor · 1 g");
    expect(line({ roomId: "zennor.overlook" })).toBe("THE OVERLOOK · the Old Town · Zennor · 1 g");
    expect(line({ roomId: "zennor.embankment" })).toBe("THE EMBANKMENT · Riverside · Zennor · 1 g");
    expect(line({ roomId: "zennor.tram", name: "The Tram" })).toBe("THE TRAM");
    expect(line({ roomId: "ship.41.cockpit", name: "Cockpit of the Magpie" })).toBe("COCKPIT OF THE MAGPIE");
    expect(townInfo(null, null, index)).toBe("");
  });
});
