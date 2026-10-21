import { beforeAll, describe, expect, it } from "vitest";
import station from "../data/station.js";
import { NODE, docksLayout, highlightShape, ringLayout } from "./deck-layout.js";
import { indexStation } from "./locate.js";

let index;
let rim;
let docks;
beforeAll(() => {
  index = indexStation(station);
  rim = ringLayout(index, 0);
  docks = docksLayout(index);
});

const box = (layout, id) => layout.rooms.find((r) => r.room.id === id);

describe("ringLayout", () => {
  it("rim plan has 12 stops spaced NODE apart", () => {
    expect(rim.stops).toHaveLength(12);
    expect(rim.length).toBe(1800);
    rim.stops.slice(1).forEach((s, i) => expect(s.cx - rim.stops[i].cx).toBe(NODE));
  });

  it("mid and inner have 8 stops", () => {
    expect(ringLayout(index, 1).stops).toHaveLength(8);
    expect(ringLayout(index, 2).length).toBe(8 * NODE);
  });

  it("marks lobbies at the spoke hours", () => {
    expect(rim.stops.filter((s) => s.lobby).map((s) => s.hour)).toEqual([0, 3, 6, 9]);
  });

  it("fore is up", () => {
    const market = box(rim, "tiss.market");
    const slag = box(rim, "tiss.cantina");
    const kitchen = box(rim, "tiss.kitchen");
    expect(market.cy).toBeLessThan(0);
    expect(slag.cy).toBeGreaterThan(0);
    expect(kitchen.cy).toBeGreaterThan(slag.cy);
  });

  it("12:00 follows 11:00 across the wrap", () => {
    const at = (x) => rim.stops.find((s) => s.x === x).cx;
    expect((((at(0) - at(22)) % rim.length) + rim.length) % rim.length).toBe(NODE);
  });

  it("places every ring room on a stop", () => {
    for (const z of [0, 1, 2]) {
      const l = ringLayout(index, z);
      const cxs = new Set(l.stops.map((s) => s.cx));
      expect(l.rooms.length).toBeGreaterThan(0);
      for (const r of l.rooms) expect(cxs.has(r.cx)).toBe(true);
    }
  });
});

describe("docksLayout", () => {
  it("docks: port left, fore up", () => {
    expect(box(docks, "tiss.fueldepot").cx).toBeLessThan(0);
    expect(box(docks, "tiss.berth").cx).toBeGreaterThan(0);
    const spine = (n) => docks.spine.find((s) => s.n === n);
    expect(spine(4).cy).toBeLessThan(spine(1).cy);
  });

  it("has a round Hub, Bearing, Blister and Transfer", () => {
    expect(docks.hub).toMatchObject({ cx: 0, cy: 0, r: 58 });
    expect(docks.bearing.cy).toBeLessThan(0);
    expect(docks.blister.cy).toBeLessThan(docks.spine[3].cy);
    expect(docks.transfer.cy).toBe(120 + 12);
  });
});

describe("highlightShape", () => {
  it("room: its box", () => {
    const b = box(rim, "tiss.laundry");
    const s = highlightShape(rim, { kind: "room", id: "tiss.laundry", level: 0, x: 4, y: -1 });
    expect(s).toMatchObject({ kind: "rect", x: b.cx - b.w / 2, y: b.cy - b.h / 2, width: b.w, height: b.h });
  });

  it("corridor stop: the stretch", () => {
    const stop = rim.stops.find((s) => s.x === 4);
    const s = highlightShape(rim, { kind: "room", id: "tiss.rim-0200", level: 0, x: 4, y: 0 });
    expect(s).toMatchObject({ kind: "rect", x: stop.cx - NODE / 2, y: -15, width: NODE, height: 30 });
  });

  it("lift at Rim 3:00: a circle at the stop", () => {
    const stop = rim.stops.find((s) => s.lobby && s.hour === 3);
    const s = highlightShape(rim, { kind: "lift", hour: 3, leg: 0, level: 0, atId: "tiss.rim-0300" });
    expect(s).toMatchObject({ kind: "circle", cx: stop.cx, cy: 0, r: 15 });
  });

  it("ladderway: an 18x18 hatch beside the lobby", () => {
    const stop = rim.stops.find((s) => s.lobby && s.hour === 3);
    const s = highlightShape(rim, { kind: "room", id: "tiss.ladderway-3-rim", level: 0, x: 7, y: 0 });
    expect(s).toMatchObject({ kind: "rect", x: stop.cx + 27 - 9, y: -9, width: 18, height: 18 });
  });

  it("docks shapes", () => {
    expect(highlightShape(docks, { kind: "room", id: "tiss.hub", level: 3, x: 0, y: 0 })).toMatchObject({ kind: "circle", cx: 0, cy: 0, r: 58 });
    const berth = box(docks, "tiss.berth");
    expect(highlightShape(docks, { kind: "room", id: "tiss.berth", level: 3, x: 1, y: 4 })).toMatchObject({ kind: "rect", x: berth.cx - berth.w / 2 });
    const spine = highlightShape(docks, { kind: "room", id: "tiss.spine-2", level: 3, x: 0, y: 3 });
    expect(spine).toMatchObject({ kind: "rect", width: 30 });
    const lift = highlightShape(docks, { kind: "lift", hour: 3, leg: 2, level: 3, atId: "tiss.hub" });
    expect(lift.kind).toBe("circle");
    expect(lift.cx).toBeCloseTo(58);
    expect(lift.cy).toBeCloseTo(0);
  });

  it("is null for off-station or unknown", () => {
    expect(highlightShape(rim, { kind: "off", name: "x" })).toBeNull();
    expect(highlightShape(rim, { kind: "room", id: "nope", level: 0, x: 1, y: 1 })).toBeNull();
    expect(highlightShape(rim, null)).toBeNull();
  });
});
