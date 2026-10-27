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

  it("names files under `shownAs` when given, wherever they're read from", () => {
    expect(() => loadTweaks(dir("bad-key"), { shownAs: "data/tweaks" })).toThrow(/^data\/tweaks\/x\.json: foo$/);
    expect(() => loadTweaks(dir("bad-json"), { shownAs: "data/tweaks" })).toThrow(/^data\/tweaks\/x\.json: /);
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

  it("takes corners and r on an outline, r under half its narrower side", () => {
    const outline = [[-0.5, -0.2], [0.5, -0.2], [0.5, 0.2], [-0.5, 0.2]];
    expect(loadOne({ footprints: { bay: { outline, corners: "cut", r: 0.15 } } })().places.x.footprints.bay.r).toBe(0.15);
    expect(loadOne({ footprints: { bay: { outline, corners: "cut", r: 0.25 } } })).toThrow(/x\.json: footprints\.bay\.r must be 0 or more and under half/);
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

describe("loadTweaks palette names", () => {
  const loadPalette = (palette) => {
    const d = mkdtempSync(join(tmpdir(), "tweaks-"));
    writeFileSync(join(d, "palette.json"), JSON.stringify(palette));
    return () => loadTweaks(d);
  };

  it("takes lower-case names with digits and hyphens", () => {
    expect(loadPalette({ docks: "#000", "deep-blue2": "#111" })().palette).toEqual({ docks: "#000", "deep-blue2": "#111" });
  });

  it.each(["Deep Blue!", "a.b", "2nd", "-x", "Docks", ""])("names palette.json and the bad name %j", (name) => {
    expect(loadPalette({ docks: "#000", [name]: "#111" })).toThrow(`palette.json: ${JSON.stringify(name)}`);
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

  it("refuses footprints on a place that isn't decks", () => {
    expect(() => resolveLook("base", [room("a"), room("b")], "wheel", tweaks)).toThrow(/footprints only applies to decks places/);
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

  it("never reports a null hull deck as an orphan (S17)", () => {
    const t = { palette, places: { ...tweaks.places, box: { like: "base", hull: { 2: null, 9: null } } } };
    expect(resolveLook("box", decks, "decks", t).orphans).toEqual([]);
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

describe("resolveLook hull and footprints", () => {
  const tweaks = loadTweaks(dir());
  const look = (tweak, kind) => resolveLook("p", [room("a")], kind, { ...tweaks, places: { p: tweak } });
  const tri = [[0, 0], [1, 0], [0, 1]];

  it("refuses a hull or footprints on a place that is not decks", () => {
    expect(() => look({ hull: { 1: tri } }, "wheel")).toThrow(/data\/tweaks\/p\.json: hull only applies to decks places/);
    expect(() => look({ footprints: { a: { corners: "cut" } } }, "drum")).toThrow(/footprints only applies to decks places/);
  });

  it("accepts them on decks, and empty ones anywhere", () => {
    expect(look({ hull: { 1: tri } }, "decks").look.hull).toEqual({ 1: tri });
    expect(() => look({ hull: {}, footprints: {} }, "town")).not.toThrow();
  });
});

describe("resolveLook keys that would do nothing (S16)", () => {
  const palette = { industrial: "#3", midring: "#4" };
  const passage = room("p1", { name: "Deck 1, frame 1", address: "Deck 1, frame 1" });
  const look = (places, id, rooms, kind) => () => resolveLook(id, rooms, kind, { palette, places });

  it("refuses a footprint on a passage or a blister, naming the file and room", () => {
    const why = /footprints apply to rooms, not passages or blisters/;
    expect(look({ p: { footprints: { p1: { corners: "cut" } } } }, "p", [passage], "decks")).toThrow(/data\/tweaks\/p\.json: footprints\.p1: /);
    expect(look({ p: { footprints: { p1: { corners: "cut" } } } }, "p", [passage], "decks")).toThrow(why);
    const blister = { footprints: { a: { span: { fore: 1 } } }, fixtures: [{ type: "blister", room: "a" }] };
    expect(look({ p: blister }, "p", [room("a")], "decks")).toThrow(why);
    expect(look({ p: { footprints: { a: { corners: "cut" } } } }, "p", [room("a")], "decks")).not.toThrow();
  });

  it("names the file an inherited footprint on a passage comes from", () => {
    const places = { base: { footprints: { p1: { corners: "cut" } } }, child: { like: "base" } };
    expect(look(places, "child", [passage], "decks")).toThrow(/data\/tweaks\/child\.json: footprints\.p1 \(from base\.json via like\)/);
  });

  it("refuses a camera on a town", () => {
    const camera = { camera: { yaw: 1, pitch: 2, zoom: 3 } };
    expect(look({ p: { town: {}, view: camera } }, "p", [room("a")], "none")).toThrow(/data\/tweaks\/p\.json: view\.camera doesn't apply to towns/);
    expect(look({ p: { drum: {}, view: camera } }, "p", [room("a")], "none")).not.toThrow();
    expect(look({ p: { view: camera } }, "p", [room("a")], "wheel")).not.toThrow();
  });

  it("refuses a cutaway other than off on a place that isn't decks", () => {
    expect(look({ p: { view: { cutaway: "ghost-above" } } }, "p", [room("a")], "wheel")).toThrow(/data\/tweaks\/p\.json: view\.cutaway "ghost-above" only applies to decks places/);
    expect(look({ p: { view: { cutaway: "off" } } }, "p", [room("a")], "wheel")).not.toThrow();
    expect(look({ p: { view: { cutaway: "ghost-above" } } }, "p", [room("a")], "decks")).not.toThrow();
  });
});

describe("loadTweaks ship fixtures", () => {
  const loadOne = (tweak) => {
    const d = mkdtempSync(join(tmpdir(), "tweaks-"));
    cpSync(dir("palette.json"), join(d, "palette.json"));
    writeFileSync(join(d, "x.json"), JSON.stringify(tweak));
    return () => loadTweaks(d);
  };
  const fixture = (f) => loadOne({ fixtures: [f] });
  const bell = { type: "bell", side: -0.5, deck: 1, r: 0.23, len: 0.42 };
  const boom = { type: "boom", side: 0, deck: 1, len: 0.83 };
  const chevrons = { type: "chevrons", room: "collar", wall: "starboard" };
  const crates = { type: "prop", kind: "crate", room: "cockpit", at: [0, -1.23], size: [0.35, 0.42], grid: [3, 2], gap: 0.08 };

  it("takes a bell, a boom, chevrons and every kind of prop", () => {
    const props = ["crate", "seat", "bulkhead", "slot", "rails"].map((kind) => ({ type: "prop", kind, room: "a", at: [0, 0], size: [0.2, 0.2] }));
    const core = { type: "prop", kind: "core", room: "a", at: [0, 0], size: [0.4, 1.2], ribs: 7 };
    const fixtures = [bell, boom, chevrons, crates, ...props, core];
    expect(loadOne({ fixtures })().places.x).toEqual({ fixtures });
  });

  it("names an unknown field of each", () => {
    expect(fixture({ ...bell, colour: 1 })).toThrow(/x\.json: fixtures\[0\]\.colour/);
    expect(fixture({ ...boom, r: 1 })).toThrow(/x\.json: fixtures\[0\]\.r/);
    expect(fixture({ ...chevrons, side: 1 })).toThrow(/x\.json: fixtures\[0\]\.side/);
    expect(fixture({ ...crates, deck: 1 })).toThrow(/x\.json: fixtures\[0\]\.deck/);
  });

  it("needs a bell's and a boom's sizes, more than 0, and a whole deck", () => {
    expect(fixture({ ...bell, r: 0 })).toThrow(/x\.json: fixtures\[0\]\.r must be more than 0/);
    expect(fixture({ ...bell, len: undefined })).toThrow(/x\.json: fixtures\[0\]\.len/);
    expect(fixture({ ...bell, deck: 1.5 })).toThrow(/x\.json: fixtures\[0\]\.deck/);
    expect(fixture({ ...boom, side: "port" })).toThrow(/x\.json: fixtures\[0\]\.side/);
    expect(fixture({ ...boom, len: -1 })).toThrow(/x\.json: fixtures\[0\]\.len/);
  });

  it("needs chevrons on a room's wall: port, starboard, fore or aft", () => {
    expect(fixture({ ...chevrons, wall: "up" })).toThrow(/x\.json: fixtures\[0\]\.wall.*up/);
    expect(fixture({ ...chevrons, room: 3 })).toThrow(/x\.json: fixtures\[0\]\.room/);
  });

  it("needs a prop's kind, room, at and size, a whole grid, and ribs only on a core", () => {
    expect(fixture({ ...crates, kind: "barrel" })).toThrow(/x\.json: fixtures\[0\]\.kind.*barrel/);
    expect(fixture({ ...crates, at: [0] })).toThrow(/x\.json: fixtures\[0\]\.at/);
    expect(fixture({ ...crates, size: [0.3, -1] })).toThrow(/x\.json: fixtures\[0\]\.size/);
    expect(fixture({ ...crates, grid: [1.5, 2] })).toThrow(/x\.json: fixtures\[0\]\.grid/);
    expect(fixture({ ...crates, gap: -0.1 })).toThrow(/x\.json: fixtures\[0\]\.gap/);
    expect(fixture({ ...crates, ribs: 3 })).toThrow(/x\.json: fixtures\[0\]\.ribs only applies to a core/);
    expect(fixture({ ...crates, room: undefined })).toThrow(/x\.json: fixtures\[0\]\.room/);
  });
});

describe("loadTweaks ship looks", () => {
  const loadOne = (tweak) => {
    const d = mkdtempSync(join(tmpdir(), "tweaks-"));
    cpSync(dir("palette.json"), join(d, "palette.json"));
    writeFileSync(join(d, "x.json"), JSON.stringify(tweak));
    return () => loadTweaks(d);
  };
  const profile = { bevel: 0.12, noseDrop: 0.35, noseLength: 0.8, spine: { from: -1.1, to: 0.25, width: 1.25, height: 0.3 } };
  const surface = { seams: true, windows: ["cockpit"], stripe: { paint: "residential", at: 0.3, width: 0.14 }, navLights: true };
  const greebles = [
    { type: "vent", side: -0.25, frame: -0.45 },
    { type: "antenna", side: -0.7, frame: 0.05, height: 0.7 },
    { type: "dish", side: 0.65, frame: -0.65, r: 0.14 },
  ];

  it("takes row C's profile, surface and greebles, and nulls for no spine or stripe", () => {
    expect(loadOne({ profile, surface, greebles })().places.x).toEqual({ profile, surface, greebles });
    expect(loadOne({ profile: { spine: null }, surface: { stripe: null } })).not.toThrow();
  });

  it("names an unknown key in each", () => {
    expect(loadOne({ profile: { taper: 1 } })).toThrow(/x\.json: profile\.taper/);
    expect(loadOne({ profile: { spine: { ...profile.spine, depth: 1 } } })).toThrow(/x\.json: profile\.spine\.depth/);
    expect(loadOne({ surface: { decals: true } })).toThrow(/x\.json: surface\.decals/);
    expect(loadOne({ surface: { stripe: { paint: "residential", at: 0.3, width: 0.1, glow: 1 } } })).toThrow(/x\.json: surface\.stripe\.glow/);
    expect(loadOne({ greebles: [{ ...greebles[0], height: 1 }] })).toThrow(/x\.json: greebles\[0\]\.height/);
  });

  it("refuses values out of range", () => {
    expect(loadOne({ profile: { bevel: -0.1 } })).toThrow(/x\.json: profile\.bevel/);
    expect(loadOne({ profile: { noseDrop: 1 } })).toThrow(/x\.json: profile\.noseDrop/);
    expect(loadOne({ profile: { noseLength: 0 } })).toThrow(/x\.json: profile\.noseLength/);
    expect(loadOne({ profile: { spine: { ...profile.spine, to: -2 } } })).toThrow(/x\.json: profile\.spine\.to must be more than from/);
    expect(loadOne({ profile: { spine: { ...profile.spine, width: 0 } } })).toThrow(/x\.json: profile\.spine\.width/);
    expect(loadOne({ surface: { seams: "yes" } })).toThrow(/x\.json: surface\.seams must be true or false/);
    expect(loadOne({ surface: { windows: "cockpit" } })).toThrow(/x\.json: surface\.windows must be a list of room ids/);
    expect(loadOne({ surface: { stripe: { paint: "nope", at: 0.3, width: 0.1 } } })).toThrow(/x\.json: surface\.stripe\.paint.*nope/);
    expect(loadOne({ surface: { stripe: { paint: "docks", at: 0.9, width: 0.2 } } })).toThrow(/x\.json: surface\.stripe/);
  });

  it("refuses an unknown greeble, and an antenna or dish without its size", () => {
    expect(loadOne({ greebles: [{ type: "gun", side: 0, frame: 0 }] })).toThrow(/x\.json: greebles\[0\]\.type.*gun/);
    expect(loadOne({ greebles: [{ type: "antenna", side: 0, frame: 0 }] })).toThrow(/x\.json: greebles\[0\]\.height/);
    expect(loadOne({ greebles: [{ type: "dish", side: 0, frame: 0, r: 0 }] })).toThrow(/x\.json: greebles\[0\]\.r/);
    expect(loadOne({ greebles: { type: "vent" } })).toThrow(/x\.json: greebles must be a list/);
  });
});

describe("resolveLook ship plans", () => {
  const palette = { industrial: "#3", docks: "#1", residential: "#5" };
  const cockpit = room("cockpit", { at: { deck: 1, frame: 1, side: 0 }, canopy: true });
  const hold = room("hold", { at: { deck: 1, frame: 0, side: 0 } });
  const plan = (tweak, rooms = [cockpit, hold]) => resolveLook("p", rooms, "decks", { palette, places: { p: tweak } }, "plan");
  const area = (tweak, kind = "decks") => () => resolveLook("p", [hold], kind, { palette, places: { p: tweak } });

  it("gives an untweaked ship row C's defaults, windows in every room with a canopy", () => {
    const { look } = plan({});
    expect(look.profile).toEqual({ bevel: 0.12, noseDrop: 0.35, noseLength: 0.8, spine: null });
    expect(look.surface).toEqual({ seams: true, windows: ["cockpit"], stripe: { paint: "residential", at: 0.3, width: 0.14 }, navLights: true });
    expect(look.greebles).toEqual([]);
  });

  it("puts the tweak's keys over the defaults, and turns a detail off", () => {
    const { look } = plan({ profile: { bevel: 0, spine: { from: 0, to: 1, width: 1, height: 0.3 } }, surface: { stripe: null, windows: [] }, greebles: [{ type: "vent", side: 0, frame: 0.5 }] });
    expect(look.profile).toEqual({ bevel: 0, noseDrop: 0.35, noseLength: 0.8, spine: { from: 0, to: 1, width: 1, height: 0.3 } });
    expect(look.surface).toEqual({ seams: true, windows: [], stripe: null, navLights: true });
    expect(look.greebles).toEqual([{ type: "vent", side: 0, frame: 0.5 }]);
  });

  it("inherits profile and surface key by key through like", () => {
    const places = { base: { profile: { noseDrop: 0.2 }, surface: { navLights: false } }, p: { like: "base", profile: { bevel: 0.05 } } };
    const { look } = resolveLook("p", [cockpit], "decks", { palette, places }, "plan");
    expect(look.profile).toMatchObject({ bevel: 0.05, noseDrop: 0.2 });
    expect(look.surface.navLights).toBe(false);
  });

  it("leaves the ship looks off a station", () => {
    const { look } = resolveLook("p", [hold], "decks", { palette, places: {} });
    expect(look).not.toHaveProperty("profile");
    expect(look).not.toHaveProperty("surface");
    expect(look).not.toHaveProperty("greebles");
  });

  it("refuses profile, surface, greebles or a ship fixture on a station or other place", () => {
    expect(area({ profile: { bevel: 0.1 } })).toThrow(/data\/tweaks\/p\.json: profile only applies to ship plans/);
    expect(area({ surface: { seams: false } }, "wheel")).toThrow(/data\/tweaks\/p\.json: surface only applies to ship plans/);
    expect(area({ greebles: [] })).toThrow(/greebles only applies to ship plans/);
    expect(area({ fixtures: [{ type: "bell", side: 0, deck: 1, r: 0.1, len: 0.2 }] })).toThrow(/data\/tweaks\/p\.json: fixtures\[0\] \(bell\) only applies to ship plans/);
    expect(area({ fixtures: [{ type: "mast", side: 0, frame: 0, height: 1 }] })).not.toThrow();
  });

  it("refuses a bevel bigger than a rounded hull corner, naming the corner", () => {
    const hull = { 1: [[-0.6, -0.6], [0.6, -0.6], [0.6, 1.6, 0.1], [-0.6, 1.6, 0.3]] };
    expect(() => plan({ hull })).toThrow(/data\/tweaks\/p\.json: profile\.bevel 0\.12 \(the default\) is more than hull\.1\[2\]'s corner radius 0\.1/);
    expect(() => plan({ hull, profile: { bevel: 0.1 } })).not.toThrow();
  });

  it("refuses a greeble half on the spine and half off it", () => {
    const spine = { from: -1.1, to: 0.25, width: 1.25, height: 0.3 };
    const dish = (side) => ({ profile: { spine }, greebles: [{ type: "vent", side: 0, frame: 0 }, { type: "dish", side, frame: -0.65, r: 0.14 }] });
    expect(() => plan(dish(0.65))).toThrow(/data\/tweaks\/p\.json: greebles\[1\] \(dish\) straddles the edge of profile\.spine/);
    expect(() => plan(dish(0.8))).not.toThrow();
    expect(() => plan(dish(0.3))).not.toThrow();
  });

  it("refuses a stripe paint the palette lacks, the default's too", () => {
    expect(() => resolveLook("p", [hold], "decks", { palette: { industrial: "#3" }, places: {} }, "plan")).toThrow(/surface\.stripe\.paint.*residential/);
  });

  it("reports a window, prop or chevrons for a room the plan lacks", () => {
    const tweak = {
      surface: { windows: ["cockpit", "galley"] },
      fixtures: [
        { type: "prop", kind: "crate", room: "bay", at: [0, 0], size: [0.2, 0.2] },
        { type: "chevrons", room: "hold", wall: "aft" },
        { type: "chevrons", room: "collar", wall: "port" },
      ],
    };
    expect(plan(tweak).orphans).toEqual(["fixtures[0].room", "fixtures[2].room", "surface.windows[1]"]);
  });
});
