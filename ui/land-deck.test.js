// @vitest-environment happy-dom
// The walked land's board (spec, "Drawing the board"): an octagon a walked place, a dotted stub a
// way not taken, Zennor's block, and only your octagon lit. Nothing unwalked is ever named, and
// no number is printed on the board (Global Constraints).

import { describe, expect, it } from "vitest";
import land from "./data/land.js";
import { LandDeck } from "./land-deck.js";
import { LandStore } from "./lib/land-store.js";

const A = "surface.tamsin.806.856.2293775";
const B = "surface.tamsin.806.856.2359314";
const UNWALKED = "surface.tamsin.806.856.2424854";

function walk() {
  const store = new LandStore();
  store.ingest({ id: A, name: "On the Tinners' Track", coords: { x: 6.2, y: 1.2, z: 0.414 }, exits: { e: { id: B, inverse: "w" } } });
  store.ingest({
    id: B,
    name: "Bare Rock on the Tinners' Track",
    coords: { x: 7.4, y: 1.6, z: 0.417 },
    exits: { w: { id: A, inverse: "e" }, e: { id: UNWALKED, inverse: "w" } },
  });
  return store;
}

function make(world = land.tamsin) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const deck = new LandDeck(host, world);
  return deck;
}

describe("LandDeck.draw", () => {
  it("draws an octagon for each walked place", () => {
    const deck = make();
    deck.draw(walk());
    const ids = [...deck.svg.querySelectorAll("[data-place]")].map((n) => n.getAttribute("data-place"));
    expect(ids.sort()).toEqual([A, B].sort());
  });

  it("draws one dotted stub for the way not taken", () => {
    const deck = make();
    deck.draw(walk());
    const stubs = deck.svg.querySelectorAll("[data-stub]");
    expect(stubs.length).toBe(1);
    const dots = stubs[0].parentNode; // dotted: round caps on a short dash and a long gap
    expect(dots.getAttribute("stroke-linecap")).toBe("round");
    const [dash, gap] = dots.getAttribute("stroke-dasharray").split(" ").map(Number);
    expect(gap).toBeGreaterThan(10 * dash);
  });

  it("names nothing unwalked and prints no number, outside the chrome", () => {
    const deck = make();
    deck.draw(walk());
    const texts = [...deck.svg.querySelectorAll("text")].map((t) => t.textContent);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      expect(t).not.toContain(UNWALKED);
      expect(t).not.toMatch(/\d/);
    }
    const outside = deck.div.cloneNode(true);
    for (const c of outside.querySelectorAll(".zoom, .north")) c.remove();
    expect(outside.textContent).not.toMatch(/\d/);
  });

  it("lights only your octagon", () => {
    const deck = make();
    const store = walk();
    deck.draw(store);
    const glowing = deck.svg.querySelectorAll("[filter]");
    expect(glowing.length).toBe(1);
    expect(glowing[0].getAttribute("data-here")).toBe(B);
    expect(glowing[0].querySelector("[fill-opacity='0.3']")).toBeTruthy();
    store.ingest({ ...{ id: A, name: "On the Tinners' Track", coords: { x: 6.2, y: 1.2 } }, exits: { e: { id: B, inverse: "w" } } });
    deck.draw(store);
    const again = deck.svg.querySelectorAll("[filter]");
    expect(again.length).toBe(1);
    expect(again[0].getAttribute("data-here")).toBe(A);
  });

  it("draws Zennor's block and its name", () => {
    const deck = make();
    deck.draw(walk());
    const names = [...deck.svg.querySelectorAll("text")].map((t) => t.textContent);
    expect(names).toContain("ZENNOR");
  });

  it("has N ▲ and the zoom buttons as chrome", () => {
    const deck = make();
    expect(deck.div.querySelector(".north").textContent).toBe("N ▲");
    expect(deck.div.querySelectorAll(".zoom button").length).toBe(3);
  });

  it("shows and hides", () => {
    const deck = make();
    deck.show(false);
    expect(deck.div.style.display).toBe("none");
    deck.show(true);
    expect(deck.div.style.display).toBe("");
  });
});

describe("LandDeck's view", () => {
  const sized = (deck, w = 520, h = 400) => {
    deck.div.getBoundingClientRect = () => ({ left: 0, top: 0, width: w, height: h, right: w, bottom: h });
  };
  const view = (deck) => deck.svg.getAttribute("viewBox").split(" ").map(Number);

  it("home() centres on you at 26 px a km", () => {
    const deck = make();
    sized(deck);
    deck.draw(walk());
    deck.home();
    const [x, y, w, h] = view(deck);
    expect(520 / w).toBeCloseTo(26, 5);
    expect(h / w).toBeCloseTo(400 / 520, 5);
    // B rounds to cell (6, 1): x 7.2, svg y −1.2
    expect(x + w / 2).toBeCloseTo(7.2, 5);
    expect(y + h / 2).toBeCloseTo(-1.2, 5);
  });

  it("follow() re-centres only when you leave the middle half of the view", () => {
    const deck = make();
    sized(deck);
    const store = walk();
    deck.draw(store);
    deck.home();
    const before = view(deck);
    store.ingest({ id: A, name: "On the Tinners' Track", coords: { x: 6.2, y: 1.2 }, exits: {} });
    deck.draw(store);
    deck.follow(); // one octagon west: still in the middle half
    expect(view(deck)).toEqual(before);
    store.ingest({ id: "surface.tamsin.far", name: "Pond on the Downs", coords: { x: 18, y: 1.2 }, exits: {} });
    deck.draw(store);
    deck.follow();
    const [x, , w] = view(deck);
    expect(x + w / 2).toBeCloseTo(18, 5);
    expect(w).toBeCloseTo(before[2], 5);
  });
});
