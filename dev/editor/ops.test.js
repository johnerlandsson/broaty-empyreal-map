import { describe, expect, it } from "vitest";
import { checkTweak } from "../../scripts/source/tweaks.mjs";
import {
  addHullPoint,
  boxHull,
  moveFixture,
  moveHullPoint,
  ordered,
  origin,
  removeHullPoint,
  reset,
  setFootprint,
  setHull,
  setHullCorner,
  setPaint,
  setView,
} from "./ops.js";

const PALETTE = { docks: "#000", offices: "#111", midring: "#222" };

const sample = () => ({
  like: "orrin",
  paint: { market: "offices" },
  footprints: { charts: { span: { fore: 0.5 } } },
  hull: { 3: [[-1, 0], [1, 0, 0.2], [1, 3], [-1, 3]] },
  fixtures: [{ type: "cradle", side: 0, deck: 3, hw: 0.3, hh: 0.3, len: 0.22 }],
  view: { cutaway: "ghost-above" },
});

/** Runs an op on a sample and checks it left the sample as it was. */
function edited(op, t = sample()) {
  const before = structuredClone(t);
  const out = op(t);
  expect(t, "the input is untouched").toEqual(before);
  expect(out).not.toBe(t);
  return out;
}

describe("the editor's edits", () => {
  it("paints a room", () => {
    const out = edited((t) => setPaint(t, "berth", "docks"));
    expect(out.paint).toEqual({ market: "offices", berth: "docks" });
    expect(edited((t) => setPaint(t, "market", "docks"), {}).paint).toEqual({ market: "docks" });
  });

  it("sets a room's footprint, and a null one removes it", () => {
    const fp = { span: { port: 1 }, corners: "rounded" };
    const out = edited((t) => setFootprint(t, "freight", fp));
    expect(out.footprints).toEqual({ charts: { span: { fore: 0.5 } }, freight: fp });
    expect(out.footprints.freight).not.toBe(fp);
    expect(edited((t) => setFootprint(t, "charts", null)).footprints).toBeUndefined();
  });

  it("sets a deck's hull path", () => {
    const points = [[0, 0], [1, 0], [0, 1]];
    const out = edited((t) => setHull(t, "2", points));
    expect(out.hull[2]).toEqual(points);
    expect(out.hull[3]).toEqual(sample().hull[3]);
  });

  it("moves a hull point, keeping its rounding", () => {
    expect(edited((t) => moveHullPoint(t, "3", 1, [1.5, -0.5])).hull[3][1]).toEqual([1.5, -0.5, 0.2]);
    expect(edited((t) => moveHullPoint(t, "3", 0, [-1.5, 0])).hull[3][0]).toEqual([-1.5, 0]);
  });

  it("adds a hull point after another", () => {
    const out = edited((t) => addHullPoint(t, "3", 1, [1.5, 1.5]));
    expect(out.hull[3]).toEqual([[-1, 0], [1, 0, 0.2], [1.5, 1.5], [1, 3], [-1, 3]]);
    expect(edited((t) => addHullPoint(t, "3", 3, [-1.5, 1.5])).hull[3][4]).toEqual([-1.5, 1.5]);
  });

  it("removes a hull point", () => {
    expect(edited((t) => removeHullPoint(t, "3", 1)).hull[3]).toEqual([[-1, 0], [1, 3], [-1, 3]]);
  });

  it("rounds a hull corner, and r 0 squares it", () => {
    expect(edited((t) => setHullCorner(t, "3", 2, 0.3)).hull[3][2]).toEqual([1, 3, 0.3]);
    expect(edited((t) => setHullCorner(t, "3", 1, 0)).hull[3][1]).toEqual([1, 0]);
  });

  it("boxes a deck: null over an inherited path, else its own path removed", () => {
    expect(edited((t) => boxHull(t, "2", true)).hull).toEqual({ 2: null, 3: sample().hull[3] });
    expect(edited((t) => boxHull(t, "3", false)).hull).toBeUndefined();
    const two = { hull: { 2: [[0, 0], [1, 0], [0, 1]], 3: [[0, 0], [1, 0], [0, 1]] } };
    expect(edited((t) => boxHull(t, "2", false), two).hull).toEqual({ 3: two.hull[3] });
  });

  it("moves a fixture, an undefined key removing it", () => {
    const out = edited((t) => moveFixture(t, 0, { side: -1, len: 0.5 }));
    expect(out.fixtures).toEqual([{ type: "cradle", side: -1, deck: 3, hw: 0.3, hh: 0.3, len: 0.5 }]);
    expect(() => moveFixture(sample(), 1, { side: 1 })).toThrow(/fixtures\[1\]/);
  });

  it("sets the view, an undefined key removing it", () => {
    const camera = { yaw: 10, pitch: 20, zoom: 1.5 };
    expect(edited((t) => setView(t, { camera })).view).toEqual({ cutaway: "ghost-above", camera });
    expect(edited((t) => setView(t, { cutaway: undefined })).view).toBeUndefined();
  });

  it("resets a key and prunes the parents it leaves empty", () => {
    expect(edited((t) => reset(t, ["paint", "market"])).paint).toBeUndefined();
    expect(edited((t) => reset(t, ["footprints", "charts", "span", "fore"])).footprints).toBeUndefined();
    expect(edited((t) => reset(t, ["hull", "3"])).hull).toBeUndefined();
    expect(edited((t) => reset(t, ["view"])).view).toBeUndefined();
    expect(edited((t) => reset(t, ["paint", "nowhere"])).paint).toEqual({ market: "offices" });
    expect(edited((t) => reset(t, ["drum", "rooms", "x"])).drum).toBeUndefined();
  });

  it("gives tweaks the schema still accepts", () => {
    let t = sample();
    t = setPaint(t, "berth", "docks");
    t = setHullCorner(addHullPoint(t, "3", 2, [0, 3.5]), "3", 3, 0.25);
    t = boxHull(t, "2", true);
    t = setView(t, { camera: { yaw: 0, pitch: 30, zoom: 1 } });
    expect(() => checkTweak("x.json", t, PALETTE)).not.toThrow();
  });
});

describe("ordered", () => {
  it("puts the keys in the schema's order, the room ids as they were", () => {
    const t = {
      view: { camera: { zoom: 1, yaw: 0, pitch: 30 }, cutaway: "off" },
      fixtures: [{ room: "gallery", type: "blister" }],
      hull: { 3: [[0, 0], [1, 0], [0, 1]] },
      paint: { b: "docks", a: "offices" },
      footprints: { charts: { r: 0.1, span: { starboard: 1, fore: 0.5 }, corners: "rounded" } },
      like: "orrin",
    };
    const out = ordered(t);
    expect(Object.keys(out)).toEqual(["like", "paint", "footprints", "hull", "fixtures", "view"]);
    expect(Object.keys(out.paint)).toEqual(["b", "a"]);
    expect(Object.keys(out.footprints.charts)).toEqual(["span", "corners", "r"]);
    expect(Object.keys(out.footprints.charts.span)).toEqual(["fore", "starboard"]);
    expect(Object.keys(out.fixtures[0])).toEqual(["type", "room"]);
    expect(Object.keys(out.view)).toEqual(["cutaway", "camera"]);
    expect(Object.keys(out.view.camera)).toEqual(["yaw", "pitch", "zoom"]);
    expect(out).toEqual(t);
  });
});

describe("origin, editing a halt that is like Orrin (Review Focus 4)", () => {
  const tweaks = () => ({ palette: PALETTE, places: { orrin: { paint: { market: "offices" } }, kilmar: { like: "orrin" } } });

  it("shows an inherited value's file, the halt's own once set, and the inherited one after reset", () => {
    const t = tweaks();
    expect(origin(t, "kilmar", ["paint", "market"])).toEqual({ from: "orrin", own: false });

    t.places.kilmar = setPaint(t.places.kilmar, "market", "docks");
    expect(t.places.kilmar).toEqual({ like: "orrin", paint: { market: "docks" } });
    expect(t.places.orrin).toEqual({ paint: { market: "offices" } });
    expect(origin(t, "kilmar", ["paint", "market"])).toEqual({ from: "kilmar", own: true });

    t.places.kilmar = reset(t.places.kilmar, ["paint", "market"]);
    expect(t.places.kilmar).toEqual({ like: "orrin" });
    expect(origin(t, "kilmar", ["paint", "market"])).toEqual({ from: "orrin", own: false });
  });

  it("gives null for a default, and the whole list's file for a fixture", () => {
    const t = tweaks();
    expect(origin(t, "kilmar", ["paint", "berth"])).toEqual({ from: null, own: false });
    t.places.orrin.fixtures = [{ type: "blister", room: "gallery" }];
    expect(origin(t, "kilmar", ["fixtures", "0"])).toEqual({ from: "orrin", own: false });
    t.places.kilmar.hull = { 2: null };
    expect(origin(t, "kilmar", ["hull", "2"])).toEqual({ from: "kilmar", own: true });
  });
});
