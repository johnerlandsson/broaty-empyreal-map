import { describe, expect, it } from "vitest";
import { loadTweaks, resolveLook } from "./tweaks.mjs";

const dir = (name = "") => new URL(`../../tests/fixtures/tweaks/${name}`, import.meta.url).pathname;
const room = (id, extra = {}) => ({ id: `p.${id}`, name: id, address: "Mid 1:00, fore", ...extra });

describe("loadTweaks", () => {
  const tweaks = loadTweaks(dir());

  it("reads the palette and every place by file name", () => {
    expect(tweaks.palette.docks).toBe("#6a7a8a");
    expect(Object.keys(tweaks.places).sort()).toEqual(["base", "loop-a", "loop-b", "mid", "top"]);
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
    expect(out.look).toEqual({ paint: { a: "industrial" }, fixtures: [], view: {} });
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
    expect(look.view).toEqual({});
  });

  it("inherits fixtures when the file has none", () => {
    expect(resolveLook("mid", rooms, "decks", tweaks).look.fixtures).toEqual([{ type: "blister", room: "market" }]);
  });

  it("reports a like cycle with its chain", () => {
    expect(() => resolveLook("loop-a", rooms, "decks", tweaks)).toThrow(/loop-a\.json.*loop-a -> loop-b -> loop-a/);
  });

  it("reports a like to a missing place", () => {
    const t = { ...tweaks, places: { x: { like: "gone" } } };
    expect(() => resolveLook("x", [], "decks", t)).toThrow(/x\.json: like.*gone/);
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
