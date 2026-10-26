import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadTweaks, resolveLook, resolveTweak } from "./tweaks.mjs";

const dir = (name = "") => new URL(`../../tests/fixtures/tweaks/${name}`, import.meta.url).pathname;
const room = (id, extra = {}) => ({ id: `p.${id}`, name: id, address: "Mid 1:00, fore", ...extra });

describe("loadTweaks", () => {
  const tweaks = loadTweaks(dir());

  it("reads the palette and every place by file name", () => {
    expect(tweaks.palette.docks).toBe("#6a7a8a");
    expect(Object.keys(tweaks.places).sort()).toEqual(["base", "mid", "pbase", "pchild", "top"]);
  });

  it("names the file and key of an unknown top-level key", () => {
    expect(() => loadTweaks(dir("bad-key"))).toThrow(/x\.json: foo/);
  });

  it("names the file and room of an unknown palette name", () => {
    expect(() => loadTweaks(dir("bad-paint"))).toThrow(/x\.json: paint\.market.*nope/);
  });

  it("names the file of a JSON error", () => {
    expect(() => loadTweaks(dir("bad-json"))).toThrow(/x\.json/);
  });
});

describe("loadTweaks footprints and view", () => {
  /** A tweaks dir with the fixture palette and x.json holding the tweak. */
  const loadOne = (tweak) => {
    const d = mkdtempSync(join(tmpdir(), "tweaks-"));
    cpSync(dir("palette.json"), join(d, "palette.json"));
    writeFileSync(join(d, "x.json"), JSON.stringify(tweak));
    return () => loadTweaks(d);
  };

  it("takes spans, corners, r and outlines", () => {
    const footprints = { hold: { span: { aft: 1, port: 0.5 }, corners: "rounded", r: 0.3 }, bay: { outline: [[0, 0], [1, 0], [0.8, 1], [0.2, 1]] } };
    const view = { cutaway: "ghost-above", camera: { yaw: 30, pitch: 25, zoom: 1.5 } };
    expect(loadOne({ footprints, view })().places.x).toEqual({ footprints, view });
  });

  it("names the key path of a negative span", () => {
    expect(loadOne({ footprints: { hold: { span: { aft: -1 } } } })).toThrow(/x\.json: footprints\.hold\.span\.aft/);
  });

  it("names an unknown key in a footprint or its span", () => {
    expect(loadOne({ footprints: { hold: { size: 2 } } })).toThrow(/x\.json: footprints\.hold\.size/);
    expect(loadOne({ footprints: { hold: { span: { up: 1 } } } })).toThrow(/x\.json: footprints\.hold\.span\.up/);
  });

  it("refuses unknown corners", () => {
    expect(loadOne({ footprints: { hold: { corners: "oval" } } })).toThrow(/x\.json: footprints\.hold\.corners.*oval/);
  });

  it("refuses an outline point outside -1.5 to 1.5", () => {
    expect(loadOne({ footprints: { hold: { outline: [[0, 0], [2, 0], [0, 1]] } } })).toThrow(/x\.json: footprints\.hold\.outline\[1\]/);
  });

  it("refuses an outline of fewer than 3 points", () => {
    expect(loadOne({ footprints: { hold: { outline: [[0, 0], [1, 0]] } } })).toThrow(/x\.json: footprints\.hold\.outline/);
  });

  it("refuses a self-crossing outline, naming the room", () => {
    expect(loadOne({ footprints: { hold: { outline: [[0, 0], [1, 1], [1, 0], [0, 1]] } } })).toThrow(/x\.json: footprints\.hold\.outline.*cross/);
  });

  it("takes a hull path per deck, a third value rounding a corner", () => {
    const hull = { 1: [[-0.5, 0.5], [0.5, 0.5], [0.5, 3.5, 0.3], [-0.5, 3.5]], "-2": [[0, 0], [1, 0], [0, 1]] };
    expect(loadOne({ hull })().places.x).toEqual({ hull });
  });

  it("takes rounded corners that meet, or reach the next point", () => {
    expect(loadOne({ hull: { 1: [[0, 0], [2, 0], [2, 2, 1], [0, 2, 1]] } })).not.toThrow();
    expect(loadOne({ hull: { 1: [[0, 0], [2, 0], [2, 2, 2], [0, 2]] } })).not.toThrow();
  });

  it("takes null for a deck, putting it back to the box", () => {
    expect(loadOne({ hull: { 3: null } })().places.x).toEqual({ hull: { 3: null } });
  });

  it("refuses a hull of fewer than 3 points, naming the deck", () => {
    expect(loadOne({ hull: { 1: [[0, 0], [1, 0]] } })).toThrow(/x\.json: hull\.1/);
  });

  it("refuses a hull key that isn't a deck number", () => {
    expect(loadOne({ hull: { top: [[0, 0], [1, 0], [0, 1]] } })).toThrow(/x\.json: hull\.top/);
  });

  it("refuses a hull point that isn't [x, y] or [x, y, r], or an r of 0 or less", () => {
    expect(loadOne({ hull: { 1: [[0, 0], [1, 0, 0.1, 2], [0, 1]] } })).toThrow(/x\.json: hull\.1\[1\]/);
    expect(loadOne({ hull: { 1: [[0, 0], [1, 0, -0.2], [0, 1]] } })).toThrow(/x\.json: hull\.1\[1\]/);
    expect(loadOne({ hull: { 1: [[0, 0], [1, 0, 0], [0, 1]] } })).toThrow(/x\.json: hull\.1\[1\]/);
  });

  it("refuses a rounded corner too big for its edges", () => {
    expect(loadOne({ hull: { 1: [[0, 0], [1, 0, 0.6], [1, 1, 0.6], [0, 1]] } })).toThrow(/x\.json: hull\.1/);
  });

  it("refuses a self-crossing hull, naming the deck", () => {
    expect(loadOne({ hull: { 1: [[0, 0], [1, 1], [1, 0], [0, 1]] } })).toThrow(/x\.json: hull\.1.*cross/);
  });

  it("refuses an unknown cutaway", () => {
    expect(loadOne({ view: { cutaway: "sideways" } })).toThrow(/x\.json: view\.cutaway.*sideways/);
  });

  it("refuses a camera without all of yaw, pitch and zoom", () => {
    expect(loadOne({ view: { camera: { yaw: 30 } } })).toThrow(/x\.json: view\.camera\.pitch/);
    expect(loadOne({ view: { camera: { yaw: 30, pitch: 20, zoom: 1, roll: 0 } } })).toThrow(/x\.json: view\.camera\.roll/);
    expect(loadOne({ view: { zoom: 1 } })).toThrow(/x\.json: view\.zoom/);
  });
});

describe("loadTweaks like", () => {
  it("fails at load on a like naming no file", () => {
    expect(() => loadTweaks(dir("bad-like"))).toThrow(/x\.json: like.*typo/);
  });
});

describe("resolveTweak", () => {
  it("merges a parent's place entries under the child's own", () => {
    const t = resolveTweak("pchild", loadTweaks(dir()));
    expect(t.place).toEqual({ a: { x: 1, y: 2, z: 3 }, b: { x: 9, y: 9, z: 9 } });
  });
});

describe("resolveLook paint", () => {
  const tweaks = { palette: { docks: "#1", midring: "#2", industrial: "#3", market: "#4", yards: "#5" }, places: {} };
  const paintOf = (rooms, tweak, kind = "decks") =>
    resolveLook("p", rooms, kind, { ...tweaks, places: { p: tweak } }).look.paint;

  it("prefers the room's paint, then paintDistricts, then a district that is a palette name", () => {
    const rooms = [room("a", { district: "yards" }), room("b", { district: "yards" }), room("c", { district: "market" })];
    expect(paintOf(rooms, { paint: { a: "docks" }, paintDistricts: { yards: "midring" } })).toEqual({
      a: "docks",
      b: "midring",
      c: "market",
    });
  });

  it("defaults by kind: passage, berth, then industrial", () => {
    const rooms = [
      { id: "p.pass", name: "Mid 1:00, fore", address: "mid 1:00, fore" },
      room("dock", { flags: ["berth"] }),
      room("shop"),
    ];
    expect(paintOf(rooms, {})).toEqual({ pass: "midring", dock: "docks", shop: "industrial" });
    expect(paintOf(rooms, {}, "none").pass).toBe("industrial");
  });

  it("resolves a place with no file as plain", () => {
    const out = resolveLook("nowhere", [room("a")], "decks", tweaks);
    expect(out.look).toEqual({ paint: { a: "industrial" }, fixtures: [], footprints: {}, hull: {}, view: { cutaway: "hide-above" } });
    expect(out.orphans).toEqual([]);
  });
});

describe("resolveLook inheritance", () => {
  const tweaks = loadTweaks(dir());
  const rooms = [room("market"), room("gate"), room("yard", { district: "yards" })];

  it("merges a chain: paint by key, fixtures replaced, sections by key", () => {
    const { look } = resolveLook("top", rooms, "decks", tweaks);
    expect(look.paint).toEqual({ market: "market", gate: "midring", yard: "industrial" });
    expect(look.fixtures).toEqual([{ type: "mast", side: 1, frame: 2, height: 3 }]);
    expect(look.drum).toEqual({ way: "straight", axis: { room: "gate", r: 2, len: 10 } });
    expect(look.view).toEqual({ cutaway: "hide-above" });
  });

  it("inherits fixtures when the file has none", () => {
    expect(resolveLook("mid", rooms, "decks", tweaks).look.fixtures).toEqual([{ type: "blister", room: "market" }]);
  });

  it("reports a like cycle with its chain, at load", () => {
    expect(() => loadTweaks(dir("loop"))).toThrow(/a\.json.*a -> b -> a/);
  });

  it("reports a like to a missing place", () => {
    const t = { ...tweaks, places: { x: { like: "gone" } } };
    expect(() => resolveLook("x", [], "decks", t)).toThrow(/x\.json: like.*gone/);
  });
});

describe("resolveLook footprints and view", () => {
  const palette = { industrial: "#3" };
  const fp = (span) => ({ span });
  const tweaks = {
    palette,
    places: {
      base: { footprints: { a: fp({ aft: 1 }), b: fp({ fore: 1 }) }, view: { cutaway: "ghost-above", camera: { yaw: 1, pitch: 2, zoom: 3 } } },
      child: { like: "base", footprints: { b: fp({ port: 1 }) }, view: { cutaway: "off" } },
    },
  };

  it("defaults the view by kind", () => {
    expect(resolveLook("p", [room("a")], "decks", { palette, places: {} }).look.view).toEqual({ cutaway: "hide-above" });
    expect(resolveLook("p", [room("a")], "wheel", { palette, places: {} }).look.view).toEqual({ cutaway: "off" });
    expect(resolveLook("p", [room("a")], "none", { palette, places: {} }).look.view).toEqual({ cutaway: "off" });
  });

  it("puts the tweak's view over the default", () => {
    expect(resolveLook("base", [room("a")], "decks", tweaks).look.view).toEqual({ cutaway: "ghost-above", camera: { yaw: 1, pitch: 2, zoom: 3 } });
  });

  it("inherits footprints and view key by key through like", () => {
    const { look } = resolveLook("child", [room("a"), room("b")], "decks", tweaks);
    expect(look.footprints).toEqual({ a: fp({ aft: 1 }), b: fp({ port: 1 }) });
    expect(look.view).toEqual({ cutaway: "off", camera: { yaw: 1, pitch: 2, zoom: 3 } });
  });

  it("leaves footprints out of a place that isn't decks", () => {
    expect(resolveLook("base", [room("a"), room("b")], "wheel", tweaks).look).not.toHaveProperty("footprints");
  });

  it("reports a footprint for a room the place lacks", () => {
    expect(resolveLook("base", [room("a")], "decks", tweaks).orphans).toEqual(["footprints.b"]);
  });
});

describe("resolveLook hull", () => {
  const palette = { industrial: "#3" };
  const tri = (n) => [[0, 0], [n, 0], [0, n]];
  const tweaks = {
    palette,
    places: {
      base: { hull: { 1: tri(1), 2: tri(2) } },
      child: { like: "base", hull: { 2: tri(3), 5: tri(5) } },
    },
  };
  const decks = [room("a", { at: { deck: 1, frame: 0, side: 0 } }), room("b", { at: { deck: 2, frame: 0, side: 0 } })];

  it("inherits the hull deck by deck through like", () => {
    expect(resolveLook("child", decks, "decks", tweaks).look.hull).toEqual({ 1: tri(1), 2: tri(3), 5: tri(5) });
  });

  it("reports a hull for a deck the place lacks, but not an inherited one", () => {
    expect(resolveLook("child", decks, "decks", tweaks).orphans).toEqual(["hull.5"]);
    expect(resolveLook("base", decks.slice(0, 1), "decks", tweaks).orphans).toEqual(["hull.2"]);
  });

  it("puts a deck back to the box with null, over an inherited path", () => {
    const t = { palette, places: { ...tweaks.places, box: { like: "base", hull: { 2: null } } } };
    expect(resolveLook("box", decks, "decks", t).look.hull).toEqual({ 1: tri(1) });
  });

  it("leaves the hull out of a place that isn't decks", () => {
    expect(resolveLook("p", [room("a")], "wheel", { palette, places: {} }).look).not.toHaveProperty("hull");
  });
});

describe("resolveLook orphans", () => {
  const tweaks = loadTweaks(dir());

  it("reports a tweak for a room the place lacks, but not an inherited one", () => {
    const { orphans, look } = resolveLook("top", [room("market"), room("gate")], "decks", tweaks);
    expect(orphans).toEqual(["paint.ghost"]);
    expect(look.paint.ghost).toBeUndefined();
  });

  it("does not report inherited keys for rooms the place lacks", () => {
    expect(resolveLook("mid", [room("gate")], "decks", tweaks).orphans).toEqual([]);
  });
});

describe("resolveLook orphans in place, town and fixtures", () => {
  it("reports stale place, town and fixture rooms, and only those", () => {
    const rooms = [room("a"), room("b"), room("gate"), room("market")];
    const { orphans } = resolveLook("pchild", rooms, "decks", loadTweaks(dir()));
    expect(orphans).toEqual(["fixtures[0].room", "town.root", "town.wells[1]", "town.ground.zz"]);
  });

  it("reports a stale place entry and a stale town gate", () => {
    const { orphans } = resolveLook("pchild", [room("a"), room("gate"), room("market")], "decks", loadTweaks(dir()));
    expect(orphans).toContain("place.b");
    const t = { palette: {}, places: { x: { town: { gate: "gone" } } } };
    expect(resolveLook("x", [], "decks", t).orphans).toEqual(["town.gate"]);
  });
});
