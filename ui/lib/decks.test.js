import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import orrin from "../data/orrin.js";
import {
  DECKS,
  buildDecksModel,
  decksCut,
  decksKey,
  decksLayout,
  decksShape,
  indexDecks,
  locateDecks,
  parseAddress,
} from "./decks.js";
import { infoLine } from "./locate.js";

const sub = (a, b) => a.map((c, i) => c - b[i]);
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const centroid = (pts) => pts.reduce((s, p) => s.map((c, i) => c + p[i] / pts.length), [0, 0, 0]);
// the renderer's normal: from the first three points
const normal = ([a, b, c]) => cross(sub(b, a), sub(c, a));

const spec = DECKS.orrin;
const index = indexDecks(orrin, spec);
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

describe("Orrin Station's data", () => {
  it("has the nine rooms of content/areas/orrin.yaml, each with an address on the grid", () => {
    expect(ids.length).toBe(9);
    for (const r of orrin.rooms) expect(parseAddress(r.address), r.id).not.toBe(null);
    expect(index.byId.size).toBe(9);
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
    for (const r of orrin.rooms) expect(r.gravity, r.id).toBe(0);
  });

  const yaml = join(homedir(), "dev/empyreal/content/areas/orrin.yaml");
  it.skipIf(!existsSync(yaml))("matches orrin.yaml's names, addresses and exits", () => {
    const rooms = readFileSync(yaml, "utf8")
      .split(/\n {2}- id: /)
      .slice(1)
      .map((chunk) => {
        const id = chunk.split("\n")[0].trim();
        const name = /\n {4}name: (.+)/.exec(chunk)[1].trim();
        const address = /\n {4}address: (.+)/.exec(chunk)[1].trim();
        const block = /\n {4}exits:\n((?: {6}.+\n?)+)/.exec(chunk)[1];
        const exits = Object.fromEntries([...block.matchAll(/ {6}(\w+): ([\w.-]+)/g)].map((m) => [m[1], m[2]]));
        return { id, name, address, exits };
      });
    expect(orrin.rooms.map(({ id, name, address, exits }) => ({ id, name, address, exits }))).toEqual(rooms);
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
    const i = indexDecks({ rooms: [...orrin.rooms, { id: "orrin.loose", name: "Loose", address: "somewhere" }] }, spec);
    expect(i.byId.has("orrin.loose")).toBe(false);
    expect(indexDecks(null, spec)).toMatchObject({ decks: [], hull: null });
    expect(buildDecksModel(indexDecks(null, spec), spec)).toEqual([]);
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
  const faces = buildDecksModel(index, spec);
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
    expect(docks.length).toBe(spec.cradles.length * 6);
    expect(span(docks, 2)[0]).toBeGreaterThanOrEqual(hz1 - 1e-9);
    for (const f of docks) expect(f.layer).toBeGreaterThan(0);
  });

  it("can be cut away above any deck: an outline above, the deck's lid, the cell boxes only when lit", () => {
    for (const f of hull) expect([2, 3]).toContain(f.deck);
    // every deck but the top has a lid of its whole floor: nine cells
    expect(faces.filter((f) => f.lid === 2).length).toBe(9);
    expect(faces.filter((f) => f.lid === 3).length).toBe(0);
    for (const f of of("cell")) expect(f.ghost).toBe(true);
    for (const f of of("dock")) expect(spec.cradles.map((c) => c[1])).toContain(f.deck);
  });

  it("edges the hull only where the box has an edge", () => {
    // the box's twelve edges, each split into cell-long pieces, each piece drawn by the two faces it joins
    const pieces = hull.reduce((n, f) => n + f.edges.filter(Boolean).length, 0);
    const { x0, x1, y0, y1, z0, z1 } = index.hull;
    const [nx, ny, nz] = [x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1];
    expect(pieces).toBe(2 * 4 * (nx + ny + nz));
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
