// The walked land away from Tamsin's Zennor (empyreal docs/all-worlds.md, docs/set-pieces.md): a world
// with no port, whose coords are km from 0° N 0° E and whose x comes round at `wrap`; and a site, a
// front on the land with roofed rooms behind it that come with no coords. Frames as the game sends
// them (gmcp.md §9.4, §9.5; set-pieces.md §3), through the store, the layout and the routes.

import { describe, expect, it } from "vitest";
import { landWorld } from "./land-choose.js";
import { layoutLand } from "./land-layout.js";
import { nearestRoadEnd } from "./land-route.js";
import { LandStore } from "./land-store.js";
import land from "../data/land.js";

const RAD = Math.PI / 180;

// Lanyon: no port, radius 6400 km, so x comes round at 2π·6400 km. Its site, the Lark, is at 27.71° N
// 3.16° E (content/sites/lark.yaml), about 353 km east and 3095 km north of 0° N 0° E.
const LANYON_WRAP = +(2 * Math.PI * 6400).toFixed(1);
const L0 = { x: +(3.1567 * RAD * 6400).toFixed(1), y: +(27.7099 * RAD * 6400).toFixed(1) };
const lanyon = (cell, dx, dy, exits = {}, name = "Bare Rock") => ({
  id: `surface.lanyon.412.977.${cell}`,
  name,
  area: "surface.lanyon",
  areaName: "Lanyon",
  terrain: "rock",
  coords: { x: +(L0.x + dx).toFixed(1), y: +(L0.y + dy).toFixed(1), z: 0 },
  wrap: LANYON_WRAP,
  exits,
});
const P1 = "surface.lanyon.412.977.1", P2 = "surface.lanyon.412.977.2", P3 = "surface.lanyon.412.977.3";

function lanyonWalk() {
  const s = new LandStore();
  s.load("ada", null);
  s.ingest(lanyon(1, 0, 0, { E: { id: P2, inverse: "W" }, S: { id: "surface.lanyon.412.977.9", inverse: "N" } }));
  s.ingest(lanyon(2, 1.6, 0.2, { W: { id: P1, inverse: "E" }, N: { id: P3, inverse: "S", style: "climb" } }));
  s.ingest(lanyon(3, 1.7, 1.9, { S: { id: P2, inverse: "N" } }, "Knoll"));
  return s;
}

describe("a walk on a world with no port", () => {
  it("keeps each place where the game says, its x's wrap with it, through a save and a load", () => {
    const s = lanyonWalk();
    expect(s.place(P1)).toMatchObject({ x: L0.x, y: L0.y, wrap: LANYON_WRAP });
    expect(s.route(P1, P3)).toEqual([P1, P2, P3]);
    const again = new LandStore();
    again.load("ada", JSON.parse(JSON.stringify(s.record())));
    expect(again.place(P1)).toEqual(s.place(P1));
    expect(again.place(P3).wrap).toBe(LANYON_WRAP);
  });

  it("lays it out with no town and no roads, every place and way drawn, the unwalked way a stub", () => {
    const s = lanyonWalk();
    const L = layoutLand(s.places(), landWorld("surface.lanyon", land));
    expect(L.zennor).toEqual({ outline: [], roads: [] });
    expect(L.spots.size).toBe(3);
    expect(L.ways.map((w) => [w.a, w.b].sort().join(" ")).sort()).toEqual([`${P1} ${P2}`, `${P2} ${P3}`]);
    expect(L.ways.find((w) => [w.a, w.b].includes(P3)).style).toBe("climb");
    expect(L.stubs).toEqual([expect.objectContaining({ id: P1, dir: "s" })]);
    // places sit 1.3× their km apart wherever on the world they are
    const a = L.spots.get(P1), b = L.spots.get(P2);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(1.3 * Math.hypot(1.6, 0.2), 3);
  });

  it("has no road end to go home by", () => {
    const s = lanyonWalk();
    expect(nearestRoadEnd(s, P3)).toBeNull();
  });
});

// Carrow: no port, radius 6300 km; its site, the Lighter, is at 178.84° W, 1.16° short of the seam
// opposite 0° E, where the game's x jumps from −wrap/2 to +wrap/2.
const CARROW_WRAP = +(2 * Math.PI * 6300).toFixed(1);
const carrow = (cell, lon, exits) => ({
  id: `surface.carrow.88.0.${cell}`,
  name: "Dust Plain",
  area: "surface.carrow",
  terrain: "dust",
  coords: { x: +((((lon + 180) % 360) - 180) * RAD * 6300).toFixed(1), y: -2120.4, z: 0 },
  wrap: CARROW_WRAP,
  exits,
});
const W1 = "surface.carrow.88.0.1", W2 = "surface.carrow.88.0.2", E1 = "surface.carrow.88.0.3";

const SEAM = {
  [W1]: carrow(1, 179.99, { E: { id: W2, inverse: "W" } }),
  [W2]: carrow(2, -179.995, { W: { id: W1, inverse: "E" }, E: { id: E1, inverse: "W" } }),
  [E1]: carrow(3, -179.98, { W: { id: W2, inverse: "E" } }),
};

/** West to east across 180°: 179.99° E, then 179.995° W, then 179.98° W. */
function seamWalk() {
  const s = new LandStore();
  for (const id of [W1, W2, E1]) s.ingest(SEAM[id]);
  return s;
}

describe("a walk across a world's seam", () => {
  it("draws places across the seam beside each other, as they are, wherever you stand", () => {
    const s = seamWalk();
    expect(s.place(W1).x - s.place(W2).x).toBeGreaterThan(CARROW_WRAP / 2); // as the game sends them
    for (const here of [W1, W2, E1]) {
      s.ingest(SEAM[here]);
      const L = layoutLand(s.places(), landWorld("surface.carrow", land), { near: s.here });
      const [a, b, c] = [W1, W2, E1].map((id) => L.spots.get(id));
      // each about 1.3 × 1.65 km east of the one before (0.015° of 6300 km), not a world apart
      const step = 1.3 * 0.015 * RAD * 6300; // the game's coords come to a tenth of a km
      expect(Math.abs(b.x - a.x - step)).toBeLessThan(0.2);
      expect(Math.abs(c.x - b.x - step)).toBeLessThan(0.2);
      // and the place you stand in where its coords put it
      expect(L.spots.get(here).x).toBeCloseTo(1.3 * s.place(here).x, 3);
    }
  });

  it("leaves a land with no wrap as it is", () => {
    const s = seamWalk();
    const places = s.places().map(({ wrap, ...p }) => p);
    const L = layoutLand(places, { town: [], joins: {} }, { near: W1 });
    expect(L.spots.get(W2).x).toBeCloseTo(1.3 * s.place(W2).x, 3);
  });
});

// The Lark on Lanyon (content/sites/lark.yaml): its front, a place of the land, and rooms behind it
// in area `site.lark`, which the game sends with no coords. Doors from the front by compass point.
const FRONT = "surface.lanyon.site.lark";
const HULL = "site.lark.hull", HOLD = "site.lark.hold", CAB = "site.lark.cabin";
const front = (exits) => ({
  id: FRONT,
  name: "The Lark",
  area: "surface.lanyon",
  areaName: "Lanyon",
  terrain: "dust",
  coords: { x: +(L0.x - 1.5).toFixed(1), y: L0.y, z: 0 },
  wrap: LANYON_WRAP,
  exits,
});
const FRONT_EXITS = { E: { id: P1, inverse: "W" }, N: { id: HULL, area: "site.lark", inverse: "S" } };
const room = (id, name, exits) => ({ id, name, area: "site.lark", areaName: "The Lark", site: "lark", exits });

function siteWalk() {
  const s = lanyonWalk();
  s.ingest(lanyon(1, 0, 0, { E: { id: P2, inverse: "W" }, W: { id: FRONT, inverse: "E" } }));
  s.ingest(front(FRONT_EXITS));
  s.ingest(room(HULL, "Inside the Hull", { S: { id: FRONT, area: "surface.lanyon", inverse: "N" }, E: { id: HOLD, inverse: "W" } }));
  s.ingest(room(HOLD, "The Hold", { W: { id: HULL, inverse: "E" }, U: { id: CAB, inverse: "D" } }));
  return s;
}

describe("a walk to a site and into its rooms", () => {
  it("takes a site's front as a place of the land, its door into the site kept", () => {
    const s = siteWalk();
    expect(s.place(FRONT)).toMatchObject({ name: "The Lark", x: L0.x - 1.5, y: L0.y });
    expect(s.place(FRONT).exits.n).toEqual({ to: HULL, area: "site.lark", back: "s" });
  });

  it("takes a room with no coords: you're in it, and it's walked, kept by its front", () => {
    const s = siteWalk();
    expect(s.here).toBe(HOLD);
    expect(s.walked(HULL)).toBe(true);
    expect(s.walked(CAB)).toBe(false);
    expect(s.room(HULL)).toMatchObject({ id: HULL, name: "Inside the Hull", site: "lark", front: FRONT });
    expect(s.room(HOLD)).toMatchObject({ front: FRONT });
    expect(s.room(HOLD).exits).toEqual({ w: { to: HULL, back: "e" } }); // u isn't a compass point
    // never a place of the land: it has no spot of its own
    expect(s.places().map((p) => p.id)).not.toContain(HULL);
    expect(s.place(HULL)).toBeUndefined();
  });

  it("finds a way from a room out over the land, and back in", () => {
    const s = siteWalk();
    expect(s.route(HOLD, P2)).toEqual([HOLD, HULL, FRONT, P1, P2]);
    expect(s.route(P3, HULL)).toEqual([P3, P2, P1, FRONT, HULL]);
  });

  it("only moves you for a step back into a room just as it was", () => {
    const s = siteWalk();
    const v = s.version;
    expect(s.ingest(room(HULL, "Inside the Hull", { S: { id: FRONT, area: "surface.lanyon", inverse: "N" }, E: { id: HOLD, inverse: "W" } }))).toBe(false);
    expect(s.here).toBe(HULL);
    expect(s.version).toBe(v);
  });

  it("ignores a room it can't tie to a walked front", () => {
    const s = new LandStore();
    expect(s.ingest(room(HULL, "Inside the Hull", { S: { id: FRONT, area: "surface.lanyon", inverse: "N" } }))).toBe(false);
    expect(s.walked(HULL)).toBe(false);
  });

  it("keeps its rooms through a save and a load, and forgets them with their world's land", () => {
    const s = siteWalk();
    const again = new LandStore();
    again.load("ada", JSON.parse(JSON.stringify(s.record())));
    expect(again.room(HULL)).toEqual(s.room(HULL));
    expect(again.route(HOLD, P1)).toEqual([HOLD, HULL, FRONT, P1]);
    s.ingest(lanyon(3, 1.7, 1.9, { S: { id: P2, inverse: "N" } }, "Knoll"));
    s.forget("surface.lanyon.");
    expect(s.walked(HULL)).toBe(false);
    expect(s.walked(FRONT)).toBe(false);
    expect(s.walked(P3)).toBe(true); // you stand there
  });

  it("keeps the room you stand in when its land is forgotten, as a place you stand in stays", () => {
    const s = siteWalk();
    s.forget("surface.lanyon.");
    expect(s.here).toBe(HOLD);
    expect(s.walked(HOLD)).toBe(true);
    expect(s.walked(HULL)).toBe(false);
    expect(s.walked(FRONT)).toBe(true); // your room stands at it
    expect(s.walked(P1)).toBe(false);
  });

  it("draws the front as a place, and its door is never a stub", () => {
    const s = siteWalk();
    const L = layoutLand(s.places(), landWorld("surface.lanyon", land), { near: s.here });
    expect(L.spots.has(FRONT)).toBe(true);
    expect(L.stubs.filter((x) => x.id === FRONT)).toEqual([]);
    expect(L.zennor).toEqual({ outline: [], roads: [] });
  });
});
