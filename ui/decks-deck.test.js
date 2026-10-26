// @vitest-environment happy-dom
// A ship's plan: her fixtures drawn on it as John picked them (ships-from-cells-mockup.html), each
// its own group, the bells, boom and ring under the hull's plate and the props over the rooms.

import { describe, expect, it } from "vitest";
import orrin from "../tests/fixtures/generated/orrin.js";
import freighterPlan from "./data/plans/freighter.js";
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
