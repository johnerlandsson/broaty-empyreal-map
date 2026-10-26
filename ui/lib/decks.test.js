import { describe, expect, it } from "vitest";
// Orrin and the Mid's halts as generated on the day they moved to generated data, frozen so a
// sync can't move them; every station on decks today is checked live below.
import models from "../../tests/fixtures/decks-models.json";
import caradon from "../../tests/fixtures/generated/caradon.js";
import garrow from "../../tests/fixtures/generated/garrow.js";
import kilmar from "../../tests/fixtures/generated/kilmar.js";
import orrin from "../../tests/fixtures/generated/orrin.js";
import places, { data as generated } from "../data/places.js";
import {
  CELL,
  PLAN,
  buildDecksModel,
  decksCut,
  decksKey,
  decksLayout,
  decksShape,
  indexDecks,
  locateDecks,
  parseAddress,
} from "./decks.js";
import { boundsOf, noseAt, pathOf } from "./footprint.js";
import { DISTRICT_COLOURS } from "./geometry.js";
import { infoLine } from "./locate.js";

const sub = (a, b) => a.map((c, i) => c - b[i]);
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const centroid = (pts) => pts.reduce((s, p) => s.map((c, i) => c + p[i] / pts.length), [0, 0, 0]);
// the renderer's normal: from the first three points
const normal = ([a, b, c]) => cross(sub(b, a), sub(c, a));

const index = indexDecks(orrin);
const ids = orrin.rooms.map((r) => r.id);
const room = (id) => index.byId.get(id);
// a step each way, as the yaml's compass words go: north fore, west port
const STEP = { north: [0, 1, 0], south: [0, -1, 0], east: [1, 0, 0], west: [-1, 0, 0], up: [0, 0, 1], down: [0, 0, -1] };
const BACK = { north: "south", south: "north", east: "west", west: "east", up: "down", down: "up" };

describe("parseAddress", () => {
  it("reads deck, frame and side as the game's coords", () => {
    expect(parseAddress("Deck 3, frame 2")).toEqual({ x: 0, y: 2, z: 3 });
    expect(parseAddress("Deck 3, frame 2, port 1")).toEqual({ x: -1, y: 2, z: 3 });
    expect(parseAddress("Deck 5, frame 12, starboard 4")).toEqual({ x: 4, y: 12, z: 5 });
  });

  it("takes it without commas, in any case, and a side alone as the first room off the centreline", () => {
    expect(parseAddress("deck 2 frame 3 port")).toEqual({ x: -1, y: 3, z: 2 });
    expect(parseAddress("DECK 2 FRAME 3 STARBOARD 2")).toEqual({ x: 2, y: 3, z: 2 });
  });

  it("knows nothing else", () => {
    for (const a of ["Rim 2:00, aft", "Deck 3", "frame 2", "Deck 3, frame 2, aft 1", "", null, undefined, 7]) {
      expect(parseAddress(a), String(a)).toBe(null);
    }
  });
});

// every station on decks, by its place id: its generated data, whatever the source has now
const STATIONS = Object.fromEntries(places.filter((p) => p.builder === "decks").map((p) => [p.id, generated[p.id]]));

describe.each(Object.entries(STATIONS))("%s's data", (key, data) => {
  const index = indexDecks(data);
  const look = data.look;
  const cradles = look.fixtures.filter((f) => f.type === "cradle");
  const blisters = look.fixtures.filter((f) => f.type === "blister").map((f) => `${data.id}.${f.room}`);
  const room = (id) => index.byId.get(id);

  it(`has the rooms of content/areas/${key}.yaml, each with an address on the grid`, () => {
    expect(data.rooms.length).toBeGreaterThan(0);
    for (const r of data.rooms) {
      expect(r.id.startsWith(`${data.id}.`), r.id).toBe(true);
      expect(parseAddress(r.address), r.id).not.toBe(null);
    }
    expect(index.byId.size).toBe(data.rooms.length);
  });

  it("puts no two rooms in one cell", () => {
    const cells = [...index.byId.values()].map(({ cell: c }) => `${c.x}:${c.y}:${c.z}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it("has every exit go to the next cell its way, with its way back", () => {
    for (const r of index.byId.values()) {
      for (const [dir, to] of Object.entries(r.exits)) {
        const t = room(to);
        expect(sub([t.cell.x, t.cell.y, t.cell.z], [r.cell.x, r.cell.y, r.cell.z]), `${r.id} ${dir}`).toEqual(STEP[dir]);
        expect(t.exits[BACK[dir]], `${to} ${BACK[dir]}`).toBe(r.id);
      }
    }
  });

  it("is weightless throughout", () => {
    for (const r of data.rooms) expect(r.gravity, r.id).toBe(0);
  });

  it("tints every room, and only in district colours", () => {
    const colours = Object.values(DISTRICT_COLOURS);
    for (const r of index.byId.values()) expect(colours, r.id).toContain(r.tint);
  });

  it("has its blisters among its rooms, and cradles that don't overlap", () => {
    for (const id of blisters) expect(room(id), id).toBeDefined();
    for (const [i, a] of cradles.entries()) {
      for (const b of cradles.slice(i + 1)) {
        const apart = a.deck !== b.deck || Math.abs(a.side - b.side) * CELL.side >= (a.hw + b.hw) * CELL.side;
        expect(apart, `${a} ${b}`).toBe(true);
      }
    }
  });

  it("draws every room on its own deck's plan, none overlapping, and no two hatches in one place", () => {
    for (const deck of index.decks) {
      const layout = decksLayout(index, deck);
      for (const r of index.byId.values()) {
        if (r.cell.z === deck) expect(decksShape(layout, { kind: "room", id: r.id }), r.id).not.toBe(null);
      }
      const boxes = layout.cells.map((c) => (c.kind === "blister" ? [c.cx - c.r, c.cy - c.r, c.cx + c.r, c.cy + c.r] : [c.cx - c.w / 2, c.cy - c.h / 2, c.cx + c.w / 2, c.cy + c.h / 2]));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, b] = [boxes[i], boxes[j]];
          expect(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], `${layout.cells[i].room.id} ${layout.cells[j].room.id}`).toBe(true);
        }
      }
      for (const [i, a] of layout.hatches.entries()) {
        for (const b of layout.hatches.slice(i + 1)) expect(Math.hypot(a.cx - b.cx, a.cy - b.cy), `deck ${deck}`).toBeGreaterThanOrEqual(24);
      }
    }
  });

  it("hangs its blisters outside the hull's box, and stands its cradles on its decks, fore of the nose", () => {
    const { hull } = index;
    for (const id of blisters) {
      const { x, y, z } = room(id).cell;
      expect(x < hull.x0 || x > hull.x1 || y < hull.y0 || y > hull.y1 || z < hull.z0 || z > hull.z1, id).toBe(true);
    }
    const nose = [...index.byId.values()].find((r) => r.flags.includes("berth")).cell;
    expect(nose.y).toBe(hull.y1);
    for (const c of cradles) expect(c.deck >= hull.z0 && c.deck <= hull.z1, JSON.stringify(c)).toBe(true);
  });
});

describe("indexDecks", () => {
  it("puts the top deck's plan first", () => {
    expect(index.decks).toEqual([3, 2, 1]);
    expect(room("orrin.berth").level).toBe(0);
    expect(room("orrin.concourse").level).toBe(1);
    expect(room("orrin.gallery").level).toBe(2);
  });

  it("makes the hull the box of every cell but the blister's: three frames long, two decks deep", () => {
    expect(index.hull).toEqual({ x0: -1, x1: 1, y0: 1, y1: 3, z0: 2, z1: 3 });
  });

  it("knows a passage by its name being its address, and the Gallery for a blister", () => {
    const passages = [...index.byId.values()].filter((r) => r.passage).map((r) => r.id);
    expect(passages.sort()).toEqual(["orrin.deck-2-frame-2", "orrin.deck-3-frame-1", "orrin.deck-3-frame-2"]);
    expect([...index.byId.values()].filter((r) => r.blister).map((r) => r.id)).toEqual(["orrin.gallery"]);
  });

  it("leaves out a room it can't place, and copes with nothing", () => {
    const i = indexDecks({ ...orrin, rooms: [...orrin.rooms, { id: "orrin.loose", name: "Loose", address: "somewhere" }] });
    expect(i.byId.has("orrin.loose")).toBe(false);
    expect(indexDecks(null)).toMatchObject({ decks: [], hull: null });
    expect(buildDecksModel(indexDecks(null), null)).toEqual([]);
  });
});

describe("locateDecks, decksKey and decksCut", () => {
  it("finds every room on its deck's plan", () => {
    for (const id of ids) expect(locateDecks(index, { roomId: id })).toMatchObject({ kind: "room", id, level: room(id).level });
  });

  it("is off anywhere else, and never throws", () => {
    expect(locateDecks(index, { roomId: "tiss.market", name: "Market" })).toEqual({ kind: "off", name: "Market" });
    for (const m of [null, undefined, 3, "x", { roomId: 5 }, { get roomId() { throw new Error("no"); } }]) {
      expect(locateDecks(index, m).kind).toBe("off");
    }
  });

  it("keys a room by its id and cuts the model to its deck", () => {
    expect(decksKey({ kind: "room", id: "orrin.market" })).toBe("orrin.market");
    expect(decksKey({ kind: "off", name: "" })).toBe(null);
    expect(decksCut(index, { kind: "room", id: "orrin.berth" })).toBe(3);
    expect(decksCut(index, { kind: "room", id: "orrin.market" })).toBe(2);
    expect(decksCut(index, { kind: "room", id: "orrin.gallery" })).toBe(1);
    expect(decksCut(index, { kind: "room", id: "tiss.market" })).toBe(null);
    expect(decksCut(index, { kind: "off" })).toBe(null);
  });

  it("gives the info line the address and 0 g, and a passage just its address", () => {
    const line = (id) => infoLine(locateDecks(index, { roomId: id }), { roomId: id }, index);
    expect(line("orrin.freight")).toBe("FREIGHT OFFICE · Deck 3, frame 2, port 1 · 0 g");
    expect(line("orrin.deck-3-frame-2")).toBe("DECK 3, FRAME 2 · 0 g");
    expect(line("orrin.gallery")).toBe("GALLERY · Deck 1, frame 2 · 0 g");
  });
});

describe("buildDecksModel", () => {
  const faces = buildDecksModel(index, orrin);
  const of = (kind) => faces.filter((f) => f.kind === kind);
  const span = (fs, k) => {
    const v = fs.flatMap((f) => f.pts.map((p) => p[k]));
    return [Math.min(...v), Math.max(...v)];
  };
  const hull = faces.filter((f) => f.outline);
  const [hy0] = span(hull, 1);
  const [, hz1] = span(hull, 2);

  it("lights faces for every room, and nothing for a compartment", () => {
    for (const id of ids) expect(faces.some((f) => f.key === id), id).toBe(true);
    for (const f of [...of("outer"), ...of("dock")]) expect(f.key).toBe(null);
  });

  it("turns nothing", () => {
    for (const f of faces) expect(f.turns).toBe(false);
  });

  it("is longer fore and aft than it's wide, and deeper than a deck", () => {
    const [x0, x1] = span(hull, 0);
    const [z0, z1] = span(hull, 2);
    const [y0, y1] = span(hull, 1);
    expect(z1 - z0).toBeGreaterThan(x1 - x0);
    expect(y1 - y0).toBeGreaterThan(0);
  });

  it("winds every culled face to face outward", () => {
    const solid = (fs) => centroid(fs.flatMap((f) => f.pts));
    const hullMid = solid(hull);
    const docks = of("dock");
    for (const f of faces) {
      const c = centroid(f.pts);
      let from;
      if (f.outline) from = hullMid;
      else if (f.lid != null) from = [c[0], c[1] - 1, c[2]]; // a deck's top faces up
      else if (f.kind === "cell") from = solid(faces.filter((g) => g.kind === "cell" && g.key === f.key));
      else if (f.kind === "dock") {
        const i = docks.indexOf(f); // a cradle's six faces are consecutive
        from = solid(docks.slice(i - (i % 6), i - (i % 6) + 6));
      } else if (f.kind === "blister-cap") from = solid(faces.filter((g) => g.kind === "blister"));
      else from = [solid(of("blister"))[0], c[1], solid(of("blister"))[2]]; // the dome's side, from its axis
      expect(dot(normal(f.pts), sub(c, from)), `${f.kind} ${f.key}`).toBeGreaterThan(0);
    }
  });

  it("hangs the Gallery's glass blister under the hull, drawn before it", () => {
    const blister = faces.filter((f) => f.key === "orrin.gallery");
    expect(blister.every((f) => f.kind.startsWith("blister") && f.layer < 0)).toBe(true);
    expect(span(blister, 1)[1]).toBeLessThanOrEqual(hy0 + 1e-9);
  });

  it("stands the cradles fore of the nose, over the hull", () => {
    const docks = of("dock");
    expect(docks.length).toBe(orrin.look.fixtures.filter((f) => f.type === "cradle").length * 6);
    expect(span(docks, 2)[0]).toBeGreaterThanOrEqual(hz1 - 1e-9);
    for (const f of docks) expect(f.layer).toBeGreaterThan(0);
  });

  it("can be cut away above any deck: an outline above, the deck's lid, the cell boxes only when lit", () => {
    for (const f of hull) expect([2, 3]).toContain(f.deck);
    // every deck but the top has a lid of its whole floor: nine cells
    expect(faces.filter((f) => f.lid === 2).length).toBe(9);
    expect(faces.filter((f) => f.lid === 3).length).toBe(0);
    for (const f of of("cell")) expect(f.ghost).toBe(true);
    for (const f of of("dock")) expect(orrin.look.fixtures.filter((f) => f.type === "cradle").map((c) => c.deck)).toContain(f.deck);
  });

  it("edges the hull only where the box has an edge", () => {
    // the box's twelve edges, each split into cell-long pieces, each piece drawn by the two faces it joins
    const pieces = hull.reduce((n, f) => n + f.edges.filter(Boolean).length, 0);
    const { x0, x1, y0, y1, z0, z1 } = index.hull;
    const [nx, ny, nz] = [x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1];
    expect(pieces).toBe(2 * 4 * (nx + ny + nz));
  });

  it("has no mast unless its look gives it one", () => {
    for (const [key, data] of Object.entries(STATIONS)) {
      if (data.look.fixtures.some((f) => f.type === "mast")) continue;
      const fs = buildDecksModel(indexDecks(data), data);
      expect(fs.some((f) => f.kind === "mast" || f.kind === "lamp"), key).toBe(false);
    }
  });
});

describe("Lamorna Light's lamp", () => {
  const lamorna = generated.lamorna;
  const index = indexDecks(lamorna);
  const faces = buildDecksModel(index, lamorna);
  const of = (kind) => faces.filter((f) => f.kind === kind);
  const span = (fs, k) => {
    const v = fs.flatMap((f) => f.pts.map((p) => p[k]));
    return [Math.min(...v), Math.max(...v)];
  };
  const hull = faces.filter((f) => f.outline);

  it("stands a mast up off the roof at the nose, the lamp at its top", () => {
    const mast = of("mast");
    const lamp = of("lamp");
    expect(mast.length).toBe(6);
    expect(lamp.length).toBe(6);
    const roof = span(hull, 1)[1];
    expect(span(mast, 1)[0]).toBeCloseTo(roof);
    expect(span(lamp, 1)[0]).toBeGreaterThan(roof);
    expect(span(lamp, 1)[1]).toBeCloseTo(span(mast, 1)[1] + (span(lamp, 1)[1] - span(lamp, 1)[0]) / 2);
    // forward of the hull's middle, and to port
    expect(span(mast, 2)[0]).toBeGreaterThan(0);
    expect(span(mast, 0)[1]).toBeLessThan(0);
    for (const f of [...mast, ...lamp]) expect(f.key).toBe(null);
  });

  it("goes with the top deck when it's cut away, as the cradles do, the lamp drawn over the mast", () => {
    for (const f of [...of("mast"), ...of("lamp")]) expect(f.deck).toBe(index.hull.z1);
    expect(Math.min(...of("lamp").map((f) => f.layer))).toBeGreaterThan(Math.max(...of("mast").map((f) => f.layer)));
  });

  it("winds the mast and the lamp outward", () => {
    for (const kind of ["mast", "lamp"]) {
      const fs = of(kind);
      const mid = centroid(fs.flatMap((f) => f.pts));
      for (const f of fs) expect(dot(normal(f.pts), sub(centroid(f.pts), mid)), kind).toBeGreaterThan(0);
    }
  });
});

describe("decksLayout", () => {
  const layouts = Object.fromEntries(index.decks.map((d) => [d, decksLayout(index, d)]));
  const mid = (id) => {
    const s = decksShape(layouts[room(id).cell.z], { kind: "room", id });
    return s.kind === "circle" ? [s.cx, s.cy] : [s.x + s.width / 2, s.y + s.height / 2];
  };

  it("has a shape for every room on its own deck's plan, and none for anywhere else", () => {
    for (const id of ids) expect(decksShape(layouts[room(id).cell.z], { kind: "room", id }), id).not.toBe(null);
    expect(decksShape(layouts[3], { kind: "room", id: "orrin.concourse" })).toBe(null);
    expect(decksShape(layouts[3], { kind: "off" })).toBe(null);
    expect(decksShape(null, { kind: "room", id: "orrin.berth" })).toBe(null);
  });

  it("draws rooms as boxes, passages as bands and the blister round", () => {
    const kind = (id) => layouts[room(id).cell.z].cells.find((c) => c.room.id === id).kind;
    expect(kind("orrin.freight")).toBe("room");
    expect(kind("orrin.deck-3-frame-2")).toBe("passage");
    expect(kind("orrin.gallery")).toBe("blister");
  });

  it("puts fore up and port left, and lines the frames up deck to deck", () => {
    expect(mid("orrin.berth")[1]).toBeLessThan(mid("orrin.deck-3-frame-2")[1]);
    expect(mid("orrin.deck-3-frame-1")[1]).toBeGreaterThan(mid("orrin.deck-3-frame-2")[1]);
    expect(mid("orrin.freight")[0]).toBeLessThan(mid("orrin.deck-3-frame-2")[0]);
    expect(mid("orrin.charts")[0]).toBeGreaterThan(mid("orrin.deck-3-frame-2")[0]);
    const at = (id) => layouts[room(id).cell.z].centre(room(id).cell);
    expect(at("orrin.concourse")).toEqual(at("orrin.deck-3-frame-1"));
    expect(at("orrin.gallery")).toEqual(at("orrin.deck-2-frame-2"));
    expect(mid("orrin.gallery")).toEqual(at("orrin.gallery"));
    expect(layouts[3].footprint).toEqual(layouts[1].footprint);
  });

  it("overlaps no two rooms on a deck", () => {
    for (const { cells } of Object.values(layouts)) {
      const boxes = cells.map((c) => (c.kind === "blister" ? [c.cx - c.r, c.cy - c.r, c.cx + c.r, c.cy + c.r] : [c.cx - c.w / 2, c.cy - c.h / 2, c.cx + c.w / 2, c.cy + c.h / 2]));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, b] = [boxes[i], boxes[j]];
          expect(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], `${cells[i].room.id} ${cells[j].room.id}`).toBe(true);
        }
      }
    }
  });

  it("joins every room to the next one its exits go to, by a passage bar or the band itself", () => {
    const l3 = layouts[3];
    // Berths, Freight and Chart Office each have a bar to the passage; its two cells meet
    expect(l3.links.length).toBe(3);
    const band = (id) => l3.cells.find((c) => c.room.id === id);
    const [a, b] = [band("orrin.deck-3-frame-2"), band("orrin.deck-3-frame-1")];
    expect(a.cy + a.h / 2).toBeCloseTo(b.cy - b.h / 2);
    expect(layouts[2].links.length).toBe(2); // the Exchange and the Concourse
    expect(layouts[1].links.length).toBe(0);
  });

  it("puts a hatch at every way up or down", () => {
    const all = Object.values(layouts).flatMap((l) => l.hatches.map((h) => `${l.deck}:${h.dir}`));
    expect(all.sort()).toEqual(["1:up", "2:down", "2:up", "3:down"]);
  });

  it("shows the hull on its decks and only its outline on the blister's, with the blister outlined on Deck 2", () => {
    expect(layouts[3].onHull && layouts[2].onHull).toBe(true);
    expect(layouts[1].onHull).toBe(false);
    expect(layouts[2].nearby.map((b) => b.room.id)).toEqual(["orrin.gallery"]);
    expect(layouts[2].nearby[0].below).toBe(true);
    expect(layouts[3].nearby).toEqual([]);
  });

  it("labels the hull's three frames, fore first", () => {
    expect(layouts[3].frames.map((f) => f.n)).toEqual([3, 2, 1]);
  });
});

describe("the Mid's halts", () => {
  const shapes = { kilmar, caradon, garrow };
  const at = (key) => indexDecks(shapes[key]);

  it("are smaller boxes than Orrin's, each its own shape", () => {
    expect(at("kilmar").hull).toEqual({ x0: -1, x1: 1, y0: 1, y1: 3, z0: 2, z1: 2 }); // one deck, three frames
    expect(at("caradon").hull).toEqual({ x0: -1, x1: 1, y0: 1, y1: 2, z0: 2, z1: 3 });
    expect(at("garrow").hull).toEqual({ x0: -1, x1: 1, y0: 1, y1: 2, z0: 1, z1: 2 });
  });

  it("put the top deck's plan first, Deck 1 last", () => {
    expect(at("kilmar").decks).toEqual([2, 1]);
    expect(at("caradon").decks).toEqual([3, 2, 1]);
    expect(at("garrow").decks).toEqual([2, 1]);
  });

  it("hang Kilmar's and Caradon's Galleries under the hull, on a deck of their own", () => {
    for (const key of ["kilmar", "caradon"]) {
      const index = at(key);
      expect(index.byId.get(`${key}.gallery`).blister).toBe(true);
      expect(decksLayout(index, 1).onHull).toBe(false);
      expect(decksLayout(index, 1).cells.map((c) => c.kind)).toEqual(["blister"]);
    }
  });

  it("keep Garrow's Lookout as a room of the hull on Deck 1, fore of the Commons and under the Berths", () => {
    const index = at("garrow");
    const lookout = index.byId.get("garrow.lookout");
    expect(lookout.blister).toBe(false);
    expect(lookout.cell).toEqual({ x: 0, y: 2, z: 1 });
    const deck1 = decksLayout(index, 1);
    expect(deck1.onHull).toBe(true);
    expect(deck1.cells.find((c) => c.room.id === "garrow.lookout").kind).toBe("room");
    expect(deck1.links.length).toBe(1); // the Lookout to the Commons
    const faces = buildDecksModel(index, garrow);
    expect(faces.some((f) => f.kind.startsWith("blister"))).toBe(false);
    expect(faces.some((f) => f.kind === "cell" && f.key === "garrow.lookout")).toBe(true);
  });

  it("put Caradon's Shift Hall hatches up and down in different corners", () => {
    const hall = decksLayout(at("caradon"), 2).hatches;
    expect(hall.map((h) => h.dir).sort()).toEqual(["down", "up"]);
    const [up, down] = ["up", "down"].map((d) => hall.find((h) => h.dir === d));
    expect(down.cy).toBeGreaterThan(up.cy);
  });

  it("cut the model to the deck you're on", () => {
    expect(decksCut(at("kilmar"), { kind: "room", id: "kilmar.kitchen" })).toBe(2);
    expect(decksCut(at("caradon"), { kind: "room", id: "caradon.hall" })).toBe(2);
    expect(decksCut(at("garrow"), { kind: "room", id: "garrow.lookout" })).toBe(1);
  });

  it("give the info line the room's address", () => {
    const line = (key, id) => {
      const index = at(key);
      return infoLine(locateDecks(index, { roomId: id }), { roomId: id }, index);
    };
    expect(line("kilmar", "kilmar.kitchen")).toBe("KITCHEN · Deck 2, frame 2, starboard 1 · 0 g");
    expect(line("caradon", "caradon.hall")).toBe("SHIFT HALL · Deck 2, frame 1 · 0 g");
    expect(line("garrow", "garrow.deck-2-frame-1")).toBe("DECK 2, FRAME 1 · 0 g");
  });
});

describe("the generated look", () => {
  // buildDecksModel as it was when it read the spec decksSpec made, captured before that went
  it.each(Object.entries({ orrin, kilmar, caradon, garrow }))("gives %s's model as it was", (id, data) => {
    expect(JSON.parse(JSON.stringify(buildDecksModel(indexDecks(data), data)))).toEqual(models[id]);
  });

  it("tints a room from the palette by its paint, and leaves an unpainted one without", () => {
    expect(indexDecks(orrin).byId.get("orrin.berth").tint).toBe(DISTRICT_COLOURS.docks);
    const bare = { ...orrin, look: { ...orrin.look, paint: {} } };
    expect(indexDecks(bare).byId.get("orrin.berth").tint).toBe(null);
  });

  it("reads a look without view or footprints, as the frozen files have it", () => {
    expect(orrin.look.footprints).toBeUndefined();
    expect(buildDecksModel(indexDecks(orrin), orrin).length).toBeGreaterThan(0);
  });
});

// Orrin copied, with footprints and hull paths as the tweak files would give them (tweaks can't
// exist for a test): the three of the footprint mockups, and the hull paths of the hull path mockup
describe("footprints and hull paths", () => {
  const T3 = { freight: { span: { aft: 1 } }, market: { corners: "rounded" }, charts: { corners: "cut" } };
  const M = 0.5 + 0.12;
  const HULL = {
    3: [
      [-M, 1 - M], [M, 1 - M], [M, 2 - M], [1 + M, 2 - M], [1 + M, 2 + M], [M, 2 + M],
      [M, 3 + M - 0.3], [M - 0.3, 3 + M], [-M + 0.3, 3 + M], [-M, 3 + M - 0.3],
      [-M, 2 + M], [-1 - M, 2 + M], [-1 - M, 2 - M], [-M, 2 - M],
    ],
    2: [[-M, 1 - M], [M, 1 - M], [M, 2 + M], [-1 - M, 2 + M, 0.35], [-1 - M, 2 - M], [-M, 2 - M]],
  };
  const tweak = (footprints, hull) => ({ ...orrin, look: { ...orrin.look, footprints, hull: hull ?? {} } });
  const numbers = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number);
  const pairs = (d) => numbers(d).reduce((out, v, i) => (i % 2 ? (out[out.length - 1].push(v), out) : [...out, [v]]), []);
  const bounds = (pts) => boundsOf(pts);
  const span = (fs, k) => {
    const v = fs.flatMap((f) => f.pts.map((p) => p[k]));
    return [Math.min(...v), Math.max(...v)];
  };

  describe("rooms with the footprint mockups' three tweaks", () => {
    const data = tweak(T3);
    const index = indexDecks(data);
    const layout = (deck) => decksLayout(index, deck);
    const cellOf = (deck, id) => layout(deck).cells.find((c) => c.room.id === id);

    it("carries each room's footprint on the index", () => {
      expect(index.byId.get("orrin.freight").footprint).toEqual({ span: { aft: 1 } });
      expect(index.byId.get("orrin.berth").footprint).toBe(null);
    });

    it("reaches the Freight Office's plan box one frame aft, inset as a box is", () => {
      const c = cellOf(3, "orrin.freight");
      const [x, y] = layout(3).centre(c.room.cell);
      const b = bounds(c.points);
      expect(b.x0).toBeCloseTo(x - PLAN.w / 2 + PLAN.inset);
      expect(b.x1).toBeCloseTo(x + PLAN.w / 2 - PLAN.inset);
      expect(b.y0).toBeCloseTo(y - PLAN.h / 2 + PLAN.inset);
      expect(b.y1).toBeCloseTo(y + PLAN.h / 2 - PLAN.inset + PLAN.h);
    });

    it("keeps a plain room's box as it was, its points its corners", () => {
      const c = cellOf(3, "orrin.berth");
      expect(decksShape(layout(3), { kind: "room", id: "orrin.berth" }).kind).toBe("rect");
      expect(bounds(c.points)).toEqual({ x0: c.cx - c.w / 2, x1: c.cx + c.w / 2, y0: c.cy - c.h / 2, y1: c.cy + c.h / 2 });
    });

    it("lights the Exchange as a path the size of its plan box", () => {
      const s = decksShape(layout(2), { kind: "room", id: "orrin.market" });
      expect(s.kind).toBe("path");
      const c = cellOf(2, "orrin.market");
      const b = bounds(pairs(s.d));
      expect(b.x0).toBeCloseTo(c.cx - c.w / 2, 0);
      expect(b.x1).toBeCloseTo(c.cx + c.w / 2, 0);
      expect(b.y0).toBeCloseTo(c.cy - c.h / 2, 0);
      expect(b.y1).toBeCloseTo(c.cy + c.h / 2, 0);
      expect(pairs(s.d).length).toBe(16);
    });

    it("lights the Chart Office in the model as its cut outline through the deck: 8 sides and 2 caps", () => {
      const faces = buildDecksModel(index, data);
      const lit = faces.filter((f) => f.key === "orrin.charts" && f.ghost);
      expect(lit.length).toBe(10);
      const mid = centroid(lit.flatMap((f) => f.pts));
      for (const f of lit) expect(dot(normal(f.pts), sub(centroid(f.pts), mid))).toBeGreaterThan(0);
    });

    it("keeps the hull's box: every outline is inside the cells", () => {
      expect(index.hull).toEqual({ x0: -1, x1: 1, y0: 1, y1: 3, z0: 2, z1: 3 });
    });
  });

  describe("a nose that reaches fore (Review Focus 2)", () => {
    const data = tweak({ berth: { span: { fore: 0.5 } } });
    const index = indexDecks(data);
    const plain = indexDecks(orrin);

    it("grows the hull half a frame fore", () => {
      expect(index.hull.y1).toBe(plain.hull.y1 + 0.5);
      expect(decksLayout(index, 3).frames.map((f) => f.n)).toEqual([3, 2, 1]);
    });

    it("grows the plan's plate by half a frame", () => {
      expect(decksLayout(index, 3).footprint.h).toBeCloseTo(decksLayout(plain, 3).footprint.h + 0.5 * PLAN.h);
      expect(decksLayout(index, 3).footprint.w).toBeCloseTo(decksLayout(plain, 3).footprint.w);
    });

    it("stands every cradle fore of the new nose", () => {
      const faces = buildDecksModel(index, data);
      const hull = faces.filter((f) => f.outline);
      const before = buildDecksModel(plain, orrin).filter((f) => f.outline);
      const nose = span(hull, 2)[1];
      expect(nose - span(hull, 2)[0]).toBeCloseTo(span(before, 2)[1] - span(before, 2)[0] + 0.5 * CELL.frame);
      const docks = faces.filter((f) => f.kind === "dock");
      expect(docks.length).toBeGreaterThan(0);
      for (const f of docks) for (const p of f.pts) expect(p[2]).toBeGreaterThanOrEqual(nose - 1e-9);
      const berth = faces.filter((f) => f.key === "orrin.berth");
      expect(span(berth, 2)[1]).toBeCloseTo(nose);
    });
  });

  describe("Orrin with the hull path mockup's paths", () => {
    const data = tweak({}, HULL);
    const index = indexDecks(data);
    const faces = buildDecksModel(index, data);
    const mid = [(index.hull.x0 + index.hull.x1) / 2, (index.hull.y0 + index.hull.y1) / 2];
    const toPlan = ([x, y]) => [(x - mid[0]) * PLAN.w, -(y - mid[1]) * PLAN.h];
    const toModel = ([x, y]) => [(x - mid[0]) * CELL.side, (y - mid[1]) * CELL.frame];

    it("puts each deck's path, rounded, on the index", () => {
      expect(index.hullPaths[3]).toEqual(pathOf(HULL[3]));
      expect(index.hullPaths[2]).toEqual(pathOf(HULL[2]));
      expect(index.hullPaths[1]).toBeUndefined();
    });

    it("plates Deck 3's plan with its path", () => {
      const l = decksLayout(index, 3);
      const want = bounds(pathOf(HULL[3]).map(toPlan));
      const got = bounds(l.plate);
      for (const k of ["x0", "x1", "y0", "y1"]) expect(got[k]).toBeCloseTo(want[k]);
      expect(decksLayout(index, 1).plate).toBe(null);
    });

    it("walls every edge of each deck's path, facing out", () => {
      for (const z of [2, 3]) {
        const path = pathOf(HULL[z]);
        const walls = faces.filter((f) => f.kind === "outer" && f.deck === z && Math.abs(normal(f.pts)[1]) < 1e-6);
        path.forEach((a, i) => {
          const b = path[(i + 1) % path.length];
          const [A, B] = [toModel(a), toModel(b)];
          const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
          const on = (p) => {
            const t = ((p[0] - A[0]) * (B[0] - A[0]) + (p[2] - A[1]) * (B[1] - A[1])) / (len * len);
            return Math.abs((p[0] - A[0]) * (B[1] - A[1]) - (p[2] - A[1]) * (B[0] - A[0])) / len < 1e-6 && t > -1e-6 && t < 1 + 1e-6;
          };
          const along = walls.filter((f) => f.pts.every(on));
          const length = (f) => Math.hypot(span([f], 0)[1] - span([f], 0)[0], span([f], 2)[1] - span([f], 2)[0]);
          const covered = along.reduce((s, f) => s + length(f), 0);
          expect(covered, `deck ${z} edge ${i}`).toBeCloseTo(len);
          // outward: to the right of a counter-clockwise path
          const out = [B[1] - A[1], 0, -(B[0] - A[0])];
          for (const f of along) expect(dot(normal(f.pts), out), `deck ${z} edge ${i}`).toBeGreaterThan(0);
        });
      }
    });

    it("roofs the top deck with its path and gives Deck 2 its lid, both facing up", () => {
      const area = (pts) => Math.abs(pts.reduce((s, [x, y], i) => s + x * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * y, 0)) / 2;
      const flat = (f) => Math.abs(normal(f.pts)[0]) < 1e-6 && Math.abs(normal(f.pts)[2]) < 1e-6;
      const roof = faces.filter((f) => f.kind === "outer" && f.deck === 3 && flat(f) && normal(f.pts)[1] > 0);
      const lid = faces.filter((f) => f.lid === 2);
      const sum = (fs) => fs.reduce((s, f) => s + area(f.pts.map((p) => [p[0], p[2]])), 0);
      expect(sum(roof)).toBeCloseTo(area(pathOf(HULL[3])) * CELL.side * CELL.frame);
      expect(sum(lid)).toBeCloseTo(area(pathOf(HULL[2])) * CELL.side * CELL.frame);
      for (const f of lid) expect(normal(f.pts)[1]).toBeGreaterThan(0);
      expect(faces.some((f) => f.lid === 3)).toBe(false);
    });

    it("roots the cradles at the nose of the path on their deck, leaving out one off it", () => {
      const docks = faces.filter((f) => f.kind === "dock");
      // the mockup's L on Deck 2 doesn't reach the starboard cradle's side; the build won't pass that
      const cradles = orrin.look.fixtures.filter((f) => f.type === "cradle" && noseAt(pathOf(HULL[f.deck]), f.side) !== null);
      expect(cradles.length).toBe(5);
      expect(docks.length).toBe(cradles.length * 6);
      cradles.forEach((c, i) => {
        const box = docks.slice(i * 6, i * 6 + 6);
        expect(span(box, 2)[0]).toBeCloseTo((noseAt(pathOf(HULL[c.deck]), c.side) - mid[1]) * CELL.frame);
      });
    });
  });

  describe("decks whose paths don't follow the cells", () => {
    const R = [[-1.5, 0.5], [1.5, 0.5], [1.5, 3.5], [-1.5, 3.5]];
    const CHAMFER = [[-1.5, 0.5], [1.5, 0.5], [1.5, 2.7], [0.7, 3.5], [-1.5, 3.5]];
    const area = (pts) => Math.abs(pts.reduce((s, [x, y], i) => s + x * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * y, 0)) / 2;
    const flat = (f) => Math.abs(normal(f.pts)[0]) < 1e-6 && Math.abs(normal(f.pts)[2]) < 1e-6;
    // in cells², the flat outer faces facing up (or down) of a deck, lids left out
    const sum = (faces, deck, up) =>
      faces
        .filter((f) => f.kind === "outer" && f.deck === deck && flat(f) && normal(f.pts)[1] * up > 0)
        .reduce((s, f) => s + area(f.pts.map((p) => [p[0], p[2]])), 0) / (CELL.side * CELL.frame);
    const model = (hull) => {
      const data = tweak({}, hull);
      return buildDecksModel(indexDecks(data), data);
    };

    it("leaves no hole in the top under a chamfered deck", () => {
      const faces = model({ 3: CHAMFER, 2: R });
      expect(sum(faces, 2, 1) + sum(faces, 3, 1)).toBeGreaterThanOrEqual(area(R) - 1e-6);
      expect(sum(faces, 2, 1)).toBeCloseTo(1); // the whole cell piece the chamfer uncovers, as roof
    });

    it("leaves no hole in the bottom of a deck over a chamfered one", () => {
      const faces = model({ 3: R, 2: CHAMFER });
      expect(sum(faces, 3, -1) + sum(faces, 2, -1)).toBeGreaterThanOrEqual(area(R) - 1e-6);
    });

    it("leaves no hole in the top of a box deck under a chamfered path", () => {
      const faces = model({ 3: CHAMFER });
      expect(sum(faces, 2, 1) + sum(faces, 3, 1)).toBeGreaterThanOrEqual(area(R) - 1e-6);
    });
  });
});
