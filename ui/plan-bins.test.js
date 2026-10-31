// @vitest-environment happy-dom
// Refuse bins on the plans (reference/plan-bins-options.png, option B): a mark in each room the
// game flags `bin`, its far corner spinward on a ring, fore starboard on a ship; on the corridor
// a corridor stop's on the corridor, a ladderway's (the cleaners' docks: Rim 12 and 6, Mid 9,
// Inner 3) inside its widened hatch (reference/hatch-bins-options.png, option B);
// on a town's plan, every room's in its south-east corner.

import { describe, expect, it } from "vitest";
import courier from "./data/plans/hull-courier.js";
import freighter from "./data/plans/freighter.js";
import skiff from "./data/plans/hull-skiff.js";
import tug from "./data/plans/tug.js";
import orrin from "../tests/fixtures/generated/orrin.js";
import tiss from "./data/tiss.js";
import zennor from "./data/zennor.js"; // the fixture is older than the game's bins
import { highlightShape } from "./lib/deck-layout.js";
import { textWidth } from "./lib/decks.js";
import { buildPlace, buildShip } from "./place-views.js";

const div = () => document.createElement("div");
const at = (mark) => mark.getAttribute("transform").match(/translate\((\S+) (\S+)\)/).slice(1).map(Number);
const marks = (g) => [...g.querySelectorAll("[data-bin]")];
// a ring draws each thing three times, a lap either side, so the middle lap's are the ones at 0
const lap = (g) => marks(g).filter((m) => m.closest("g[transform]")?.getAttribute("transform") === "translate(0 0)");

describe("bins on T.I.S.S.'s rings", () => {
  const place = buildPlace(tiss, "wheel", div(), div());
  const [rim, mid, inner, docks] = place.deck.plans;
  const flagged = (z) => tiss.rooms.filter((r) => r.at?.z === z && r.flags?.includes("bin")).length;

  it("marks every flagged room once a lap, and nothing on the docks", () => {
    expect(lap(rim.g)).toHaveLength(flagged(0));
    expect(lap(mid.g)).toHaveLength(flagged(1));
    expect(lap(inner.g)).toHaveLength(flagged(2));
    expect(marks(rim.g)).toHaveLength(3 * flagged(0));
    expect(marks(docks.g)).toHaveLength(0);
  });

  it("puts a fore room's in its top spinward corner and an aft room's in its bottom one", () => {
    const box = (id) => rim.layout.rooms.find((b) => b.room.id === id);
    const near = (id) => lap(rim.g).map(at).find(([x, y]) => Math.abs(x - box(id).cx) < box(id).w / 2 && Math.abs(y - box(id).cy) < box(id).h / 2);
    const market = box("tiss.market");
    expect(near("tiss.market")).toEqual([market.cx + market.w / 2 - 11, market.cy - market.h / 2 + 11]);
    const laundry = box("tiss.laundry");
    expect(near("tiss.laundry")).toEqual([laundry.cx + laundry.w / 2 - 11, laundry.cy + laundry.h / 2 - 11]);
  });

  const onCorridor = (plan) => lap(plan.g).map(at).filter(([, y]) => Math.abs(y) < 15).sort((a, b) => a[0] - b[0]);
  const cx = (plan, hour) => plan.layout.stops.find((s) => s.hour === hour).cx;

  it("puts the docks' inside their hatches and the Concourse's on the lift's other side", () => {
    expect(onCorridor(rim)).toEqual([[cx(rim, 0) - 23, 0], [cx(rim, 0) + 43, 0], [cx(rim, 6) + 43, 0]]);
    expect(onCorridor(mid)).toEqual([[cx(mid, 9) + 43, 0]]);
    expect(onCorridor(inner)).toEqual([[cx(inner, 3) + 43, 0]]);
  });

  it("widens a dock's hatch round its bin, and no other hatch", () => {
    const hatches = (plan) => [...plan.g.querySelector('g[transform="translate(0 0)"]').querySelectorAll('rect[y="-7"][fill="none"]')];
    const wide = (plan) => hatches(plan).filter((r) => +r.getAttribute("width") === 31).map((r) => +r.getAttribute("x") - 20);
    expect(wide(rim)).toEqual([cx(rim, 0), cx(rim, 6)]);
    expect(wide(mid)).toEqual([cx(mid, 9)]);
    expect(wide(inner)).toEqual([cx(inner, 3)]);
    expect(hatches(mid).filter((r) => +r.getAttribute("width") === 14)).toHaveLength(3);
  });

  it("lights a dock's whole hatch, and a plain hatch as before", () => {
    const lit = (id, x) => highlightShape(mid.layout, { kind: "room", id, level: 1, x, y: 0 });
    expect(lit("tiss.ladderway-9-mid", 19)).toMatchObject({ x: cx(mid, 9) + 18, width: 35, height: 18 });
    expect(lit("tiss.ladderway-3-mid", 7)).toMatchObject({ x: cx(mid, 3) + 18, width: 18, height: 18 });
  });
});

describe("bins on the ship plans", () => {
  const plan = (data) => buildShip(data, div(), div(), { name: "Mule" }).deck.plans[0];

  it("marks the freighter's Passage in its fore starboard corner, and nothing else of hers", () => {
    const p = plan(freighter);
    const passage = p.layout.cells.find((c) => c.room.id === "freighter.passage");
    expect(marks(p.g).map(at)).toEqual([[passage.cx + passage.w / 2 - 11, passage.cy - passage.h / 2 + 11]]);
  });

  // a shaped cockpit's mark: inside her shape, clear of her name, near the fore starboard corner
  const shaped = (data, id) => {
    const p = plan(data);
    const c = p.layout.cells.find((cell) => cell.room.id === id);
    const [m] = marks(p.g);
    expect(marks(p.g)).toHaveLength(1);
    const [x, y] = at(m);
    const [x1, y0] = [c.cx + c.w / 2, c.cy - c.h / 2];
    const names = [...p.g.querySelectorAll("text")].filter((t) => t.textContent && "Cockpit of the Mule".includes(t.textContent));
    return { c, x, y, x1, y0, names };
  };

  it("marks a skiff's cockpit inside its cut corner, near the top", () => {
    const { c, x, y, x1, y0 } = shaped(skiff, "hull-skiff.cockpit");
    expect(x).toBeGreaterThan(c.cx + c.w / 4);
    expect(x < x1 - 11 || y > y0 + 11).toBe(true); // moved off the corner, past the cut
    expect(y).toBeLessThan(y0 + 30);
  });

  it("marks a courier's round cockpit on her starboard side, below her name", () => {
    const { c, x, y, names } = shaped(courier, "hull-courier.cockpit");
    expect(x).toBeGreaterThan(c.cx);
    const lowest = Math.max(...names.map((t) => +t.getAttribute("y") + +t.getAttribute("font-size") * 0.6));
    expect(y - 6).toBeGreaterThanOrEqual(lowest);
  });

  it("marks nothing on the tug, which has no bin", () => {
    expect(marks(plan(tug).g)).toHaveLength(0);
  });
});

describe("bins on a decks station's plan", () => {
  it("puts a room's in its fore starboard corner, or fore port where its hatch is", () => {
    const flagged = new Set(["orrin.market", "orrin.concourse"]);
    const data = { ...orrin, rooms: orrin.rooms.map((r) => (flagged.has(r.id) ? { ...r, flags: [...(r.flags ?? []), "bin"] } : r)) };
    const place = buildPlace(data, "decks", div(), div());
    const cellOf = (id) => place.deck.plans.flatMap((p) => p.layout.cells).find((c) => c.room.id === id);
    const all = place.deck.plans.flatMap((p) => marks(p.g).map(at));
    const [market, concourse] = [cellOf("orrin.market"), cellOf("orrin.concourse")];
    expect(concourse.room.exits.up).toBeTruthy();
    expect(all).toEqual(
      expect.arrayContaining([
        [market.cx + market.w / 2 - 11, market.cy - market.h / 2 + 11],
        [concourse.cx - concourse.w / 2 + 11, concourse.cy - concourse.h / 2 + 11],
      ]),
    );
    expect(all).toHaveLength(2);
  });
});

describe("bins on a town's plan", () => {
  const plan = buildPlace(zennor, "town", div(), div()).deck.plans[0];
  const { boxes, links, tram } = plan.layout;
  const flagged = zennor.rooms.filter((r) => r.flags?.includes("bin")).map((r) => r.id);
  const box = (id) => boxes.find((b) => b.room.id === id);
  const all = () => marks(plan.g);
  const markIn = (id) => {
    const b = box(id);
    return all().map(at).find(([x, y]) => Math.abs(x - b.cx) < b.w / 2 && Math.abs(y - b.cy) < b.h / 2);
  };
  // the mark's half width and height, with a little room round it
  const [HW, HH] = [5, 6];
  const overlaps = ([x, y], r) => x + HW > r.x0 && x - HW < r.x1 && y + HH > r.y0 && y - HH < r.y1;
  const distance = ([x, y], [x1, y1], [x2, y2]) => {
    const [dx, dy] = [x2 - x1, y2 - y1];
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - x1 - t * dx, y - y1 - t * dy);
  };

  it("marks the four rooms the game flags, one each, and nothing else", () => {
    expect(flagged).toEqual(["zennor.square", "zennor.exchange-square", "zennor.covered-market", "zennor.tram-market"]);
    expect(all()).toHaveLength(4);
    for (const id of flagged) expect(markIn(id), id).toBeDefined();
  });

  it("puts each in its south-east corner, open square or building", () => {
    for (const id of flagged) {
      const b = box(id);
      expect(markIn(id), id).toEqual([b.cx + b.w / 2 - 11, b.cy + b.h / 2 - 11]);
    }
    expect(flagged.map((id) => box(id).kind)).toEqual(["square", "square", "building", "building"]);
  });

  it("keeps clear of every name on the plan", () => {
    const names = [...plan.g.querySelectorAll("text")].filter((t) => t.textContent && t.getAttribute("display") !== "none");
    expect(names.map((t) => t.textContent)).toEqual(expect.arrayContaining(["The Square", "Conduit Square", "Pannier Market", "Market Station"]));
    for (const t of names) {
      const [x, y, size] = ["x", "y", "font-size"].map((a) => +t.getAttribute(a));
      const w = textWidth(t.textContent, size);
      const anchor = t.getAttribute("text-anchor");
      const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
      const r = { x0, x1: x0 + w, y0: y - size * 0.6, y1: y + size * 0.6 };
      for (const id of flagged) expect(overlaps(markIn(id), r), `${id} on ${t.textContent}`).toBe(false);
    }
  });

  it("keeps clear of the squares' wellheads", () => {
    const wells = [...plan.g.querySelectorAll('circle[r="6"]')];
    expect(wells).toHaveLength(2);
    for (const w of wells) {
      const [cx, cy] = [+w.getAttribute("cx"), +w.getAttribute("cy")];
      const r = { x0: cx - 6.7, x1: cx + 6.7, y0: cy - 6.7, y1: cy + 6.7 };
      for (const id of flagged) expect(overlaps(markIn(id), r), id).toBe(false);
    }
  });

  it("stays inside a tram stop's outline", () => {
    const outlines = [...plan.g.querySelectorAll('rect[stroke="#cfe3ff"]')];
    const b = box("zennor.tram-market");
    const outline = outlines.find((r) => +r.getAttribute("x") === b.cx - b.w / 2 + 4 && +r.getAttribute("y") === b.cy - b.h / 2 + 4);
    expect(outline).toBeDefined();
    const [x, y] = markIn("zennor.tram-market");
    expect(x + HW).toBeLessThan(+outline.getAttribute("x") + +outline.getAttribute("width"));
    expect(y + HH).toBeLessThan(+outline.getAttribute("y") + +outline.getAttribute("height"));
  });

  it("keeps clear of the ways into each room and the tram's line", () => {
    const way = (l) => (l.x1 !== undefined ? [[l.x1, l.y1], [l.x2, l.y2]] : l.width > l.height ? [[l.x, l.y + l.height / 2], [l.x + l.width, l.y + l.height / 2]] : [[l.x + l.width / 2, l.y], [l.x + l.width / 2, l.y + l.height]]);
    const wide = (l) => (l.x1 !== undefined ? (l.width ?? 26) : Math.min(l.width, l.height)); // the Steps are 26 wide
    const stops = tram.d.slice(1).split("L").map((p) => p.split(",").map(Number));
    for (const id of flagged) {
      const m = markIn(id);
      for (const l of links) expect(distance(m, ...way(l)), `${id} by ${l.a} to ${l.b}`).toBeGreaterThan(wide(l) / 2 + Math.hypot(HW, HH) / 2);
      for (let i = 1; i < stops.length; i++) expect(distance(m, stops[i - 1], stops[i]), id).toBeGreaterThan(Math.hypot(HW, HH));
    }
  });

  it("draws each over its room's ground", () => {
    const drawn = [...plan.g.querySelectorAll("*")];
    const of = new Map(all().map((m) => [at(m).join(), drawn.indexOf(m)]));
    for (const id of flagged) {
      const b = box(id);
      const under = drawn.filter((n) => n.tagName.toLowerCase() === "rect" && +n.getAttribute("x") === b.cx - b.w / 2 && +n.getAttribute("y") === b.cy - b.h / 2 && n.getAttribute("fill") !== "transparent");
      expect(under.length, id).toBeGreaterThan(0);
      for (const n of under) expect(drawn.indexOf(n), id).toBeLessThan(of.get(markIn(id).join()));
    }
  });
});
