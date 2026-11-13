import { describe, it, expect, vi } from "vitest";
import { LandStore, DIRS } from "./land-store.js";

const frame = (id, x, y, exits = {}) => ({ id, name: id.toUpperCase(), area: "tamsin", coords: { x, y, z: 0 }, exits });

describe("LandStore", () => {
  it("lists the eight compass dirs", () => {
    expect(DIRS).toEqual(["n", "ne", "e", "se", "s", "sw", "w", "nw"]);
  });

  it("routes between places joined both ways, and through a chain", () => {
    const s = new LandStore();
    s.ingest(frame("a", 0, 0, { E: { id: "b", inverse: "W" } }));
    s.ingest(frame("b", 1, 0, { W: { id: "a", inverse: "E" }, E: { id: "c", inverse: "W" } }));
    s.ingest(frame("c", 2, 0, { W: { id: "b", inverse: "E" } }));
    expect(s.route("a", "b")).toEqual(["a", "b"]);
    expect(s.route("a", "c")).toEqual(["a", "b", "c"]);
    expect(s.route("a", "a")).toEqual(["a"]);
    expect(s.here).toBe("c");
  });

  it("keeps an exit to an unwalked place but gives no route", () => {
    const s = new LandStore();
    s.ingest(frame("a", 0, 0, { N: { id: "z", area: "x", inverse: "S" } }));
    expect(s.place("a").exits.n).toEqual({ to: "z", area: "x", back: "s" });
    expect(s.route("a", "z")).toBeNull();
    expect(s.walked("z")).toBe(false);
    expect(s.walked("a")).toBe(true);
  });

  it("has no back without an inverse, and keeps non-compass exits off the board", () => {
    const s = new LandStore();
    s.ingest(frame("a", 0, 0, { E: { id: "b" }, U: { id: "u" }, IN: { id: "i" }, S: { id: "" } }));
    expect(s.place("a").exits).toEqual({ e: { to: "b" } });
  });

  it("ignores bad frames", () => {
    const s = new LandStore();
    expect(s.ingest({ name: "x", coords: { x: 0, y: 0 } })).toBe(false);
    expect(s.ingest({ id: "a", coords: { x: "1", y: 0 } })).toBe(false);
    expect(s.ingest(null)).toBe(false);
    expect(s.places()).toEqual([]);
  });

  it("replaces exits on re-ingest but keeps note and order", () => {
    const s = new LandStore();
    s.ingest(frame("a", 0, 0, { E: { id: "b" } }));
    s.ingest(frame("b", 1, 0));
    s.setNote("a", "camp");
    s.ingest(frame("a", 0, 0, { N: { id: "c" } }));
    expect(s.place("a").exits).toEqual({ n: { to: "c" } });
    expect(s.place("a").note).toBe("camp");
    expect(s.places().map((p) => p.id)).toEqual(["a", "b"]);
    s.setNote("a", null);
    expect(s.place("a").note).toBeUndefined();
  });

  it("load merges places walked before the character was known", () => {
    const s = new LandStore();
    s.ingest(frame("n1", 5, 5));
    s.ingest(frame("old2", 9, 9));
    s.load("ada", {
      v: 1,
      places: [
        { id: "old1", name: "O1", x: 0, y: 0, z: 0, exits: {} },
        { id: "old2", name: "stale", x: 1, y: 1, z: 0, exits: {}, note: "n" },
      ],
    });
    expect(s.who).toBe("ada");
    expect(s.places().map((p) => p.id)).toEqual(["old1", "old2", "n1"]);
    expect(s.place("old2").name).toBe("OLD2");
    expect(s.place("old2").note).toBe("n");
  });

  it("treats junk records as empty", () => {
    const s = new LandStore();
    expect(() => s.load("ada", "junk")).not.toThrow();
    expect(s.places()).toEqual([]);
    s.load("ada", { v: 0 });
    expect(s.places()).toEqual([]);
    s.load("ada", null);
    expect(s.places()).toEqual([]);
  });

  it("clears when the character changes", () => {
    const s = new LandStore();
    s.load("ada", { v: 1, places: [{ id: "a", name: "A", x: 0, y: 0, z: 0, exits: {} }] });
    s.ingest(frame("b", 1, 1));
    s.load("bea", { v: 1, places: [] });
    expect(s.who).toBe("bea");
    expect(s.places()).toEqual([]);
    expect(s.here).toBeNull();
  });

  it("round-trips the record", () => {
    const s = new LandStore();
    s.ingest(frame("a", 0, 0, { E: { id: "b", inverse: "W" } }));
    s.ingest(frame("b", 1, 0));
    s.setNote("b", "hi");
    const rec = JSON.parse(JSON.stringify(s.record()));
    expect(rec.v).toBe(1);
    const t = new LandStore();
    t.load("ada", rec);
    expect(t.places()).toEqual(s.places());
  });

  it("forgets and notifies", () => {
    const s = new LandStore();
    const fn = vi.fn();
    s.onChange(fn);
    s.ingest(frame("a", 0, 0));
    expect(fn).toHaveBeenCalledTimes(1);
    s.setNote("a", "x");
    expect(fn).toHaveBeenCalledTimes(2);
    s.load("ada", null);
    expect(fn).toHaveBeenCalledTimes(3);
    s.forget();
    expect(fn).toHaveBeenCalledTimes(4);
    expect(s.places().map((p) => p.id)).toEqual(["a"]); // where you stand stays
    expect(s.here).toBe("a");
    expect(s.who).toBe("ada");
  });

  it("keeps the place you stand in, without its note, when forgetting", () => {
    const s = new LandStore();
    s.ingest(frame("a", 0, 0));
    s.ingest(frame("b", 1, 0));
    s.setNote("b", "mine");
    s.setNote("a", "other");
    s.forget();
    expect(s.here).toBe("b");
    expect(s.places().map((p) => p.id)).toEqual(["b"]);
    expect(s.place("b").note).toBeUndefined();
    expect(s.route("b", "b")).toEqual(["b"]);
  });

  it("forgets only the places under a prefix, the land you're forgetting", () => {
    const s = new LandStore();
    s.ingest(frame("surface.kerris.1", 0, 0));
    s.setNote("surface.kerris.1", "salt");
    s.ingest(frame("surface.tamsin.1", 0, 0));
    s.ingest(frame("surface.tamsin.2", 1, 0));
    s.forget("surface.tamsin.");
    expect(s.places().map((p) => p.id)).toEqual(["surface.kerris.1", "surface.tamsin.2"]);
    expect(s.place("surface.kerris.1").note).toBe("salt");
    s.forget("surface.kerris.");
    expect(s.places().map((p) => p.id)).toEqual(["surface.tamsin.2"]); // where you stand stays
    expect(s.here).toBe("surface.tamsin.2");
  });
});
