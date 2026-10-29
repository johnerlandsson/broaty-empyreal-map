// @vitest-environment happy-dom
// Refuse bins on the plans (reference/plan-bins-options.png, option B): a mark in each room the
// game flags `bin`, its far corner spinward on a ring, fore starboard on a ship; on the corridor
// beside a stop's hatch for a corridor stop or its ladderway (Inner's, the cleaners' docks).

import { describe, expect, it } from "vitest";
import courier from "./data/plans/hull-courier.js";
import freighter from "./data/plans/freighter.js";
import skiff from "./data/plans/hull-skiff.js";
import tug from "./data/plans/tug.js";
import orrin from "../tests/fixtures/generated/orrin.js";
import tiss from "./data/tiss.js";
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

  it("puts the Concourse's and the Inner ladderways' on the corridor, spinward of the hatch", () => {
    const onCorridor = (plan) => lap(plan.g).map(at).filter(([, y]) => y === 0);
    const cx = (plan, hour) => plan.layout.stops.find((s) => s.hour === hour).cx;
    expect(onCorridor(rim)).toEqual([[cx(rim, 0) + 47, 0]]);
    expect(onCorridor(inner).sort((a, b) => a[0] - b[0])).toEqual([0, 3, 6, 9].map((h) => [cx(inner, h) + 47, 0]).sort((a, b) => a[0] - b[0]));
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
