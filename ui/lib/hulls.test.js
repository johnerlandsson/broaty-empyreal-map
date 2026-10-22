import { describe, expect, it } from "vitest";
import { HULLS, SCALE, hullOf, isShipRoom, shipShape, shipCaption, shipInfo, toPlan, hullExtent } from "./hulls.js";

describe("hullOf", () => {
  it("knows the skiff, the courier and the freighter", () => {
    expect(hullOf("skiff")).toBe(HULLS.skiff);
    expect(hullOf("courier")).toBe(HULLS.courier);
    expect(hullOf("freighter")).toBe(HULLS.freighter);
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

describe("the freighter", () => {
  const f = HULLS.freighter;
  it("has the game's six rooms, by the keys of their ids (content/plans/freighter.yaml)", () => {
    expect(f.rooms.map((r) => r.key)).toEqual(["cockpit", "airlock", "passage", "collar", "hold", "engine"]);
  });
  it("lays them out as the game does: the airlock to port of the passage, the collar to starboard, fore to aft", () => {
    const at = Object.fromEntries(f.rooms.map((r) => [r.key, r.shape]));
    const cy = (s) => s.y + s.height / 2;
    expect(at.airlock.x + at.airlock.width).toBeLessThan(at.passage.x);
    expect(at.passage.x + at.passage.width).toBeLessThan(at.collar.x);
    expect(cy(at.airlock)).toBe(cy(at.passage));
    expect(cy(at.collar)).toBe(cy(at.passage));
    const fore = ["cockpit", "passage", "hold", "engine"].map((k) => at[k]);
    for (let i = 1; i < fore.length; i++) expect(fore[i].y).toBeGreaterThan(fore[i - 1].y + fore[i - 1].height);
  });
  it("is mostly hold", () => {
    const area = (r) => r.shape.width * r.shape.height;
    const hold = f.rooms.find((r) => r.key === "hold");
    for (const r of f.rooms) if (r !== hold) expect(area(hold)).toBeGreaterThan(area(r));
  });
  describe("its doorways", () => {
    // a room's outline is stroked 1 wide on its edge, so it reaches half a unit outside the box
    const outline = (s) => ({ x0: s.x - 0.5, y0: s.y - 0.5, x1: s.x + s.width + 0.5, y1: s.y + s.height + 0.5 });
    const bar = (p) => ({ x0: p.attrs.x, y0: p.attrs.y, x1: p.attrs.x + p.attrs.width, y1: p.attrs.y + p.attrs.height });
    const eps = 1e-9;
    const overlaps = (a, b) => a.x0 < b.x1 - eps && b.x0 < a.x1 - eps && a.y0 < b.y1 - eps && b.y0 < a.y1 - eps;
    const touches = (a, b) =>
      a.x0 <= b.x1 + eps && b.x0 <= a.x1 + eps && a.y0 <= b.y1 + eps && b.y0 <= a.y1 + eps && !overlaps(a, b);
    const rooms = f.rooms.map((r) => ({ key: r.key, o: outline(r.shape) }));
    const joins = (p) => rooms.filter((r) => touches(bar(p), r.o)).map((r) => r.key).sort();

    it("are Passage bars, unstroked", () => {
      for (const p of f.passages) expect(p).toMatchObject({ tag: "rect", attrs: { fill: "#56657a", stroke: "none" } });
    });
    it("never overlap a room's outline", () => {
      for (const p of f.passages) for (const r of rooms) expect(overlaps(bar(p), r.o), `${r.key}`).toBe(false);
    });
    it("join the rooms the game's exits join, and the airlock and collar to the hull", () => {
      expect(f.passages.map(joins)).toEqual([
        ["cockpit", "passage"],
        ["airlock", "passage"],
        ["collar", "passage"],
        ["hold", "passage"],
        ["engine", "hold"],
        ["airlock"],
        ["collar"],
      ]);
    });
    it("the hold's wide hatch is the widest", () => {
      const w = f.passages.map((p) => p.attrs.width);
      expect(w[3]).toBe(Math.max(...w));
    });
  });
  it("keeps every room inside its box", () => {
    const [x0, y0, x1, y1] = f.box;
    for (const { shape: s } of f.rooms) {
      expect(s.x).toBeGreaterThanOrEqual(x0);
      expect(s.y).toBeGreaterThanOrEqual(y0);
      expect(s.x + s.width).toBeLessThanOrEqual(x1);
      expect(s.y + s.height).toBeLessThanOrEqual(y1);
    }
  });
});

describe("shipShape", () => {
  it("is the room with that key", () => {
    const [x, y] = toPlan([36, 106]);
    expect(shipShape(HULLS.freighter, "hold")).toEqual({ kind: "rect", x, y, width: 128 * SCALE, height: 98 * SCALE, rx: 4 * SCALE });
  });
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
