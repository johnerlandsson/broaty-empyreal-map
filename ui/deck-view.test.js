// @vitest-environment happy-dom
// Picking, for the tweak editor: with `pick`, Orrin's plan rooms carry data-room, and a click (not
// a pan) on one calls onPick with its id; without it, the plan is as it was.

import { describe, expect, it } from "vitest";
import orrin from "../tests/fixtures/generated/orrin.js";
import tiss from "./data/tiss.js";
import { buildPlace } from "./place-views.js";

const ID = "orrin.market";

const make = (opts) => buildPlace(orrin, "decks", document.createElement("div"), document.createElement("div"), opts);
const planOf = (place, id) => place.deck.plans[place.index.byId.get(id).level].g;
const pointer = (type, node, x, y) =>
  node.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, buttons: type === "pointerup" ? 0 : 1, pointerId: 1 }));

describe("picking", () => {
  it("marks the plan's rooms with data-room only when asked", () => {
    const on = make({ pick: true });
    expect(planOf(on, ID).querySelector(`[data-room="${ID}"]`)).toBeTruthy();
    const off = make();
    expect(off.deck.svg.querySelector("[data-room]")).toBe(null);
  });

  it("calls onPick on a click on a plan room, not on a pan", () => {
    const place = make({ pick: true });
    const picked = [];
    place.deck.onPick((id) => picked.push(id));
    const node = planOf(place, ID).querySelector(`[data-room="${ID}"]`);
    pointer("pointerdown", node, 100, 100);
    pointer("pointerup", node, 102, 101);
    expect(picked).toEqual([ID]);
    pointer("pointerdown", node, 100, 100);
    pointer("pointermove", node, 120, 100);
    pointer("pointermove", node, 101, 100);
    pointer("pointerup", node, 101, 100);
    expect(picked).toEqual([ID]);
  });
});

describe("toPlan", () => {
  it("takes a screen point to plan units through the svg's screen matrix", () => {
    const place = make({ pick: true });
    place.deck.svg.getScreenCTM = () => new DOMMatrix([2, 0, 0, 2, 100, 50]); // 2 px a unit, plan 0,0 at 100,50
    expect(place.deck.toPlan(140, 30)).toEqual([20, -10]);
  });
});

describe("the pulse", () => {
  // T.I.S.S.'s ring plan wraps, so its light is drawn once a lap: three copies, each pulsing
  const make = () => {
    const place = buildPlace(tiss, "wheel", document.createElement("div"), document.createElement("div"));
    const at = (id) => place.locate(place.index, { roomId: id });
    return { place, at };
  };
  const pulsing = (deck) => [...deck.plans[deck.level].hl.querySelectorAll("[opacity]")];

  it("lights each lap of the ring, pulsing from full", () => {
    const { place, at } = make();
    place.deck.set(at("tiss.market"));
    const lit = pulsing(place.deck);
    expect(lit).toHaveLength(3);
    for (const n of lit) expect(n.getAttribute("opacity")).toBe("1");
    expect(place.deck.svg.querySelector("animate")).toBe(null);
  });

  it("keeps the pulse running for the same place, and starts it again for a new one", () => {
    const { place, at } = make();
    place.deck.set(at("tiss.market"));
    const lit = pulsing(place.deck);
    for (const n of lit) n.setAttribute("opacity", "0.6"); // part way through a breath
    place.deck.set(at("tiss.market"));
    expect(pulsing(place.deck)).toEqual(lit);
    for (const n of lit) expect(n.getAttribute("opacity")).toBe("0.6");
    place.deck.set(at("tiss.laundry"));
    const next = pulsing(place.deck);
    expect(next.some((n) => lit.includes(n))).toBe(false);
    for (const n of next) expect(n.getAttribute("opacity")).toBe("1");
  });
});

describe("a deep room on a ring", () => {
  it("keeps the Cradle Room, seven rooms fore, inside a wide, short band's view", () => {
    const place = buildPlace(tiss, "wheel", document.createElement("div"), document.createElement("div"));
    place.deck.aspect = 0.45; // the band as the panel has it, much wider than tall
    place.deck.cur = [0, 0, 600, 270];
    place.deck.set(place.locate(place.index, { roomId: "tiss.cradle-room" }));
    const [, vy, , vh] = place.deck.cur;
    const b = place.deck.plans[2].layout.rooms.find((r) => r.room.id === "tiss.cradle-room");
    expect(b.cy - b.h / 2).toBeGreaterThanOrEqual(vy);
    expect(b.cy + b.h / 2).toBeLessThanOrEqual(vy + vh);
  });

  it("draws the inner ring's fore wall round the Old Shops", () => {
    const place = buildPlace(tiss, "wheel", document.createElement("div"), document.createElement("div"));
    const top = Math.min(...[...place.deck.plans[2].g.querySelectorAll("path[data-hull]")].flatMap((p) =>
      [...p.getAttribute("d").matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0]))));
    const b = place.deck.plans[2].layout.rooms.find((r) => r.room.id === "tiss.cradle-room");
    expect(top).toBeLessThan(b.cy - b.h / 2);
  });
});
