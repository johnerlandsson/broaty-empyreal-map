// @vitest-environment happy-dom
// A ship's plan: her fixtures drawn on it as John picked them (ships-from-cells-mockup.html), each
// its own group, the bells, boom and ring under the hull's plate and the props over the rooms.

import { describe, expect, it } from "vitest";
import orrin from "../tests/fixtures/generated/orrin.js";
import courierPlan from "./data/plans/hull-courier.js";
import freighterPlan from "./data/plans/freighter.js";
import { fitLabel, LABEL, textWidth } from "./lib/decks.js";
import { propBoxes } from "./lib/footprint.js";
import { buildPlace } from "./place-views.js";

const HULL = [
  [-0.6, 3.37], [-0.6, 4.2, 0.58], [0.6, 4.2, 0.58], [0.6, 3.37], [1.13, 3.37, 0.13],
  [1.13, 0.07], [0.97, -0.13], [-0.97, -0.13], [-1.13, 0.07], [-1.13, 3.37, 0.13],
];
const prop = (kind, extra = {}) => ({ type: "prop", kind, room: "hold", at: [0, 0], size: [0.2, 0.2], ...extra });

/** The freighter's plan with these fixtures, and each fixture's group by its index. */
function plan(fixtures) {
  const data = { ...freighterPlan, look: { ...freighterPlan.look, hull: { 1: HULL }, footprints: {}, fixtures } };
  const place = buildPlace(data, "decks", document.createElement("div"), document.createElement("div"));
  const g = place.deck.plans[0].g;
  return { g, of: (i) => g.querySelector(`[data-fixture="${i}"]`) };
}
const shapes = (group) => group.querySelectorAll("path, rect, circle").length;

describe("ship fixtures on the plan", () => {
  it("draws a bell as its flare and mouth, and the boom as rod, crossbar, head and tip", () => {
    const { of } = plan([{ type: "bell", side: -0.5, deck: 1, r: 0.23, len: 0.42 }, { type: "boom", side: 0, deck: 1, len: 0.8 }]);
    expect(shapes(of(0))).toBe(2);
    expect(shapes(of(1))).toBe(4);
  });

  it("draws the collar's ring: the way out, the ring and two yellow chevrons", () => {
    const { of } = plan([{ type: "chevrons", room: "collar", wall: "starboard" }]);
    expect(shapes(of(0))).toBe(4);
    expect([...of(0).querySelectorAll("path")].filter((p) => p.getAttribute("stroke") === "#e8b04a").length).toBe(2);
  });

  it("draws every kind of prop, a grid of them repeated", () => {
    const { of } = plan([
      prop("crate", { grid: [3, 2], gap: 0.05 }),
      prop("seat", { grid: [2, 1] }),
      prop("core", { size: [0.3, 0.8], ribs: 5 }),
      prop("bulkhead"),
      prop("slot"),
      prop("rails", { size: [1.5, 0.8] }),
    ]);
    expect(shapes(of(0))).toBe(12); // six crates, each a box and its diagonal
    expect(shapes(of(1))).toBe(2);
    expect(shapes(of(2))).toBe(6);
    expect(shapes(of(3))).toBe(1);
    expect(shapes(of(4))).toBe(5);
    expect(shapes(of(5))).toBe(12);
  });

  it("puts the outside fixtures under the hull's plate and the props over the rooms", () => {
    const { g, of } = plan([{ type: "bell", side: 0.5, deck: 1, r: 0.2, len: 0.4 }, prop("crate")]);
    const kids = [...g.children];
    const plate = kids.findIndex((n) => n.getAttribute("stroke-width") === "3");
    const rooms = kids.filter((n) => n.tagName.toLowerCase() === "g" && n.querySelector("text"));
    expect(plate).toBeGreaterThanOrEqual(0);
    expect(kids.indexOf(of(0))).toBeLessThan(plate);
    expect(kids.indexOf(of(1))).toBeGreaterThan(Math.max(...rooms.map((n) => kids.indexOf(n))));
  });

  it("draws nothing for a prop or ring whose room is gone, and never throws", () => {
    const { of } = plan([prop("crate", { room: "gone" }), { type: "chevrons", room: "gone", wall: "aft" }]);
    expect(of(0)).toBe(null);
    expect(of(1)).toBe(null);
  });

  it("draws a station's plan as it was: no fixture groups", () => {
    const place = buildPlace(orrin, "decks", document.createElement("div"), document.createElement("div"));
    expect(place.deck.svg.querySelector("[data-fixture]")).toBe(null);
  });
});

describe("ship room names on the plan", () => {
  /** A plan as the panel names her rooms, built; each room's box, its name's lines and its props' boxes. */
  function named(plan, ship) {
    const data = { ...plan, rooms: plan.rooms.map((r) => ({ ...r, name: r.name.replace("{name}", ship) })) };
    const place = buildPlace(data, "decks", document.createElement("div"), document.createElement("div"));
    const { layout, g } = place.deck.plans[0];
    return (key) => {
      const c = layout.cells.find((x) => x.room.id === `${plan.id}.${key}`);
      const box = { x0: c.cx - c.w / 2, y0: c.cy - c.h / 2, x1: c.cx + c.w / 2, y1: c.cy + c.h / 2 };
      const texts = [...g.querySelectorAll("text")].filter((t) => c.room.name.includes(t.textContent) && t.textContent.length > 2);
      const lines = texts.map((t) => {
        const [x, y, size] = ["x", "y", "font-size"].map((k) => Number(t.getAttribute(k)));
        const w = textWidth(t.textContent, size);
        return { text: t.textContent, size, x0: x - w / 2, x1: x + w / 2, y0: y - size / 2, y1: y + size / 2, halo: t.hasAttribute("paint-order") };
      });
      const props = [...g.querySelectorAll("[data-fixture]")].flatMap((p) => [...p.querySelectorAll("rect, path")]);
      return { box, lines, props };
    };
  }
  const inside = (l, b) => l.x0 >= b.x0 - 1e-6 && l.x1 <= b.x1 + 1e-6 && l.y0 >= b.y0 - 1e-6 && l.y1 <= b.y1 + 1e-6;
  const meets = (a, b) => a.x1 > b.x0 && a.x0 < b.x1 && a.y1 > b.y0 && a.y0 < b.y1;
  const seatBoxes = (plan, key) => plan.look.fixtures.filter((f) => f.type === "prop" && f.room === key);

  const cases = [
    [courierPlan, "Swift", "cockpit"],
    [freighterPlan, "Mallard", "cockpit"],
    [freighterPlan, "Mallard", "collar"],
  ];
  for (const [plan, ship, key] of cases) {
    it(`fits the ${plan.id} ${key}'s name in its box, on one line or two, no smaller than the floor`, () => {
      const { box, lines } = named(plan, ship)(key);
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines.length).toBeLessThanOrEqual(2);
      for (const l of lines) {
        expect(inside(l, box), `${l.text} in ${JSON.stringify(box)}`).toBe(true);
        expect(l.size).toBeGreaterThanOrEqual(LABEL.floor - 0.05);
        expect(l.size).toBeLessThanOrEqual(LABEL.size);
      }
      expect(lines.map((l) => l.text).join(" ")).toBe(plan.rooms.find((r) => r.id === `${plan.id}.${key}`).name.replace("{name}", ship));
    });
  }

  for (const [plan, ship] of [[freighterPlan, "Mallard"], [courierPlan, "Swift"]]) {
    it(`keeps the ${plan.id} cockpit's name off her seats, fore of them, where the box has room for it`, () => {
      const lines = named(plan, ship)("cockpit").lines;
      const place = buildPlace(plan, "decks", document.createElement("div"), document.createElement("div"));
      const { layout } = place.deck.plans[0];
      const room = layout.cells.find((c) => c.room.id === `${plan.id}.cockpit`).room;
      const P = ([x, y]) => layout.centre({ x, y });
      const seats = seatBoxes(plan, "cockpit")
        .filter((f) => f.kind === "seat")
        .flatMap((f) => propBoxes(f, { side: room.cell.x, frame: room.cell.y }))
        .map(([x0, y0, x1, y1]) => {
          const [a, b] = [P([x0, y1]), P([x1, y0])];
          return { x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
        });
      expect(seats.length).toBe(2);
      for (const l of lines) {
        expect(l.halo).toBe(false);
        for (const s of seats) {
          expect(meets(l, s), `${l.text} over a seat`).toBe(false);
          expect(l.y1).toBeLessThanOrEqual(s.y0);
        }
      }
    });
  }

  it("names a room over its props with a halo when they leave no room", () => {
    const fit = fitLabel("Cockpit of the Swift", { x0: 0, y0: 0, x1: 70, y1: 90 }, [{ x0: 5, y0: 5, x1: 65, y1: 85 }]);
    expect(fit.halo).toBe(true);
    expect(fit.size).toBeGreaterThanOrEqual(LABEL.floor);
    expect(fit.lines.map((l) => l.text)).toEqual(["Cockpit of", "the Swift"]);
  });

  it("keeps a plain box's name at full size when it fits", () => {
    const fit = fitLabel("Passage", { x0: 0, y0: 0, x1: 100, y1: 60 }, []);
    expect(fit).toMatchObject({ size: LABEL.size, halo: false });
    expect(fit.lines).toEqual([{ text: "Passage", x: 50, y: 30 }]);
  });
});
