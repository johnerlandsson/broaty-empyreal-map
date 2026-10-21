import { beforeAll, describe, expect, it } from "vitest";
import station from "../data/station.js";
import { indexStation, infoLine, keyOf, locate } from "./locate.js";

let index;
beforeAll(() => {
  index = indexStation(station);
});

describe("indexStation", () => {
  it("indexes rooms by id and sorts corridors by x", () => {
    expect(index.byId.get("tiss.laundry").name).toBeTruthy();
    for (const z of [0, 1, 2]) {
      const xs = index.corridors[z].map((r) => r.x);
      expect(xs.length).toBeGreaterThan(0);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
      expect(index.corridors[z].every((r) => r.terrain === "corridor" || r.terrain === "lobby")).toBe(true);
    }
  });
});

describe("locate", () => {
  it("room", () => {
    const w = locate(index, { roomId: "tiss.laundry" }, null);
    expect(w).toMatchObject({ kind: "room", level: 0, x: 4, y: -1 });
    expect(keyOf(w)).toBe("r0:4:-1");
  });

  it("two deep", () => {
    expect(keyOf(locate(index, { roomId: "tiss.kitchen" }, null))).toBe("r0:0:-2");
  });

  it("docks room", () => {
    const w = locate(index, { roomId: "tiss.berth" }, null);
    expect(w.level).toBe(3);
    expect(keyOf(w)).toBe("tiss.berth");
  });

  it("lift between", () => {
    const msg = { lift: { id: "tiss.lift-3", between: ["tiss.mid-0300", "tiss.inner-0300"], heading: "hubward" } };
    const w = locate(index, msg, 1);
    expect(w).toMatchObject({ kind: "lift", hour: 3, leg: 1, level: 1 });
    expect(keyOf(w)).toBe("spoke:3:1");
    expect(infoLine(w, msg, index)).toBe("LIFT 3 · climbing hubward");
  });

  it("lift between with null prevLevel uses the first room's level", () => {
    const msg = { lift: { id: "tiss.lift-3", between: ["tiss.mid-0300", "tiss.inner-0300"] } };
    expect(locate(index, msg, null)).toMatchObject({ level: 1, leg: 1 });
  });

  it("lift descending", () => {
    const msg = { lift: { id: "tiss.lift-9", between: ["tiss.inner-0900", "tiss.mid-0900"], heading: "rimward" } };
    const w = locate(index, msg, 2);
    expect(infoLine(w, msg, index)).toBe("LIFT 9 · descending rimward");
  });

  it("lift at hub", () => {
    const msg = { lift: { id: "tiss.lift-3", at: "tiss.hub" } };
    const w = locate(index, msg, null);
    expect(w).toMatchObject({ kind: "lift", leg: 2, level: 3, atId: "tiss.hub" });
    expect(infoLine(w, msg, index)).toBe("LIFT 3 · at The Hub");
  });

  it("lift at a ring lobby", () => {
    const msg = { lift: { id: "tiss.lift-9", at: "tiss.mid-0900" } };
    const w = locate(index, msg, null);
    expect(w).toMatchObject({ hour: 9, leg: 1, level: 1 });
  });

  it("lift 12 hour", () => {
    expect(locate(index, { lift: { id: "tiss.lift-12", at: "tiss.rim-1200" } }, null).hour).toBe(0);
  });

  it("ladderway", () => {
    const w = locate(index, { roomId: "tiss.ladderway-9-mid" }, null);
    expect(w).toMatchObject({ kind: "room", level: 1 });
    expect(keyOf(w)).toBe("spoke:9:1");
  });

  it("unknown id is off", () => {
    const msg = { roomId: "ship.41", name: "Cockpit of the Magpie" };
    const w = locate(index, msg, null);
    expect(w.kind).toBe("off");
    expect(keyOf(w)).toBeNull();
    expect(infoLine(w, msg, index)).toBe("COCKPIT OF THE MAGPIE");
  });

  it("empty message is off", () => {
    const w = locate(index, {}, null);
    expect(w.kind).toBe("off");
    expect(infoLine(w, {}, index)).toBe("");
  });

  it("never throws on odd shapes", () => {
    for (const m of [null, undefined, 5, "x", [], { lift: null }, { lift: {} }, { lift: { id: "nope" } },
      { lift: { id: "tiss.lift-x", between: ["a"] } }, { lift: { id: "tiss.lift-4", between: "zz" } }]) {
      const w = locate(index, m, null);
      expect(w).toBeTruthy();
      expect(() => keyOf(w)).not.toThrow();
      expect(() => infoLine(w, m, index)).not.toThrow();
    }
  });

  it("info line", () => {
    const msg = { roomId: "tiss.laundry", address: "Rim 2:00, aft", gravity: 0.9, name: "Laundry" };
    expect(infoLine(locate(index, msg, null), msg, index)).toBe("LAUNDRY · Rim 2:00, aft · 0.9 g");
  });

  it("info line falls back to station data and omits missing parts", () => {
    const msg = { roomId: "tiss.laundry" };
    const line = infoLine(locate(index, msg, null), msg, index);
    expect(line.startsWith(index.byId.get("tiss.laundry").name.toUpperCase())).toBe(true);
    expect(line).toContain(" g");
    const bare = { roomId: "tiss.laundry", name: "Laundry" };
    const fake = { byId: new Map([["tiss.laundry", { ...index.byId.get("tiss.laundry"), address: null, gravity: null }]]), corridors: index.corridors };
    expect(infoLine(locate(fake, bare, null), bare, fake)).toBe("LAUNDRY");
  });

  it("gravity 0 is shown", () => {
    const msg = { roomId: "tiss.berth", gravity: 0 };
    expect(infoLine(locate(index, msg, null), msg, index)).toMatch(/ · 0 g$/);
  });
});
