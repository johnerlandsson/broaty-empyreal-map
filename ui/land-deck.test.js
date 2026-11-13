// @vitest-environment happy-dom
// The walked land's board (spec, "Drawing the board"): an octagon a walked place, a dotted stub a
// way not taken, Zennor's block, and only your octagon lit. Nothing unwalked is ever named, and
// no number is printed on the board (Global Constraints).

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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

// The "here" octagon pulses (ui/lib/svg.js), which starts a module-level interval that outlives
// the test; fake it so a tick never lands after the happy-dom window is gone.
beforeAll(() => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] }));
afterAll(() => vi.useRealTimers());
afterEach(() => {
  document.body.replaceChildren();
});

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

  it("dashes Zennor's edge 4/3 px over a 1 px line, all in km so the dashes scale with it", () => {
    const deck = make();
    deck.draw(walk());
    deck.rescale(20);
    const edge = deck.svg.querySelector("[data-zennor]");
    expect(edge.getAttribute("vector-effect")).toBe(null);
    expect(+edge.getAttribute("stroke-width")).toBeCloseTo(1 / 20, 6);
    expect(edge.getAttribute("stroke-dasharray").split(" ").map(Number)).toEqual([4 / 20, 3 / 20]);
  });

  it("never pairs non-scaling-stroke with a dash", () => {
    const deck = make();
    deck.draw(walk());
    for (const n of deck.svg.querySelectorAll("[vector-effect]")) {
      for (let p = n; p && p !== deck.svg; p = p.parentNode) expect(p.getAttribute("stroke-dasharray")).toBe(null);
    }
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

describe("LandDeck: finding your way, notes and forgetting", () => {
  const C = "surface.tamsin.806.856.2424854";
  const END = "surface.tamsin.join.downs";
  /** A, B and C in a row along the track, both ways; you at C. */
  function three() {
    const store = new LandStore();
    store.ingest({ id: A, name: "On the Tinners' Track", coords: { x: 6.2, y: 1.2 }, exits: { e: { id: B, inverse: "w" } } });
    store.ingest({ id: B, name: "Bare Rock on the Tinners' Track", coords: { x: 7.4, y: 1.6 }, exits: { w: { id: A, inverse: "e" }, e: { id: C, inverse: "w" } } });
    store.ingest({ id: C, name: "Old Workings on the Tinners' Track", coords: { x: 8.6, y: 1.6 }, exits: { w: { id: B, inverse: "e" } } });
    return store;
  }
  const press = (node, type, at = {}) => node.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, buttons: 1, clientX: 10, clientY: 10, ...at }));
  const click = (node) => {
    press(node, "pointerdown");
    press(node, "pointerup", { buttons: 0 });
  };
  const octOf = (deck, id) => deck.svg.querySelector(`[data-place="${id}"] use`);
  const card = (deck) => deck.div.querySelector(".land-card");
  const routes = (deck) => deck.svg.querySelectorAll("[data-route]");
  const menuItem = (deck, text) => [...deck.div.querySelectorAll(".land-menu button")].find((b) => b.textContent === text);
  const rightClick = (node) => node.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 30, clientY: 40 }));

  it("lights the route to a clicked place, its outline and a card of the steps", () => {
    const deck = make();
    deck.draw(three());
    click(octOf(deck, A));
    expect(deck.target).toBe(A);
    expect(routes(deck).length).toBe(1);
    const path = routes(deck)[0];
    expect(path.getAttribute("stroke")).toBe("#ffb347");
    expect(path.getAttribute("stroke-opacity")).toBe("0.75");
    expect(path.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(path.closest("[filter]")).toBe(null);
    expect(deck.svg.querySelector(`[data-target="${A}"]`)).toBeTruthy();
    expect(card(deck).textContent).toContain("On the Tinners' Track");
    expect(card(deck).textContent).toContain("2 steps the way you know");
  });

  it("clears on Esc, on clicking the target again and on empty ground", () => {
    const deck = make();
    deck.draw(three());
    click(octOf(deck, A));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(deck.target).toBe(null);
    expect(routes(deck).length).toBe(0);
    expect(card(deck)).toBe(null);
    click(octOf(deck, A));
    click(octOf(deck, A));
    expect(deck.target).toBe(null);
    click(octOf(deck, A));
    click(deck.svg);
    expect(deck.target).toBe(null);
    expect(routes(deck).length).toBe(0);
  });

  it("redraws the route from where you are now, and clears the target on arrival", () => {
    const deck = make();
    const store = three();
    deck.draw(store);
    click(octOf(deck, A));
    store.ingest({ ...store.place(B), coords: { x: 7.4, y: 1.6 }, exits: { w: { id: A, inverse: "e" }, e: { id: C, inverse: "w" } } });
    deck.draw(store);
    expect(card(deck).textContent).toContain("1 step the way you know");
    store.ingest({ id: A, name: "On the Tinners' Track", coords: { x: 6.2, y: 1.2 }, exits: { e: { id: B, inverse: "w" } } });
    deck.draw(store);
    expect(deck.target).toBe(null);
    expect(routes(deck).length).toBe(0);
  });

  it("says so when there's no way back you know", () => {
    const deck = make();
    const store = three();
    store.ingest({ id: "surface.tamsin.far", name: "Pond on the Downs", coords: { x: 18, y: 1.2 }, exits: {} });
    deck.draw(store);
    click(octOf(deck, A));
    expect(routes(deck).length).toBe(0);
    expect(card(deck).textContent).toContain("No way back you know");
    expect(card(deck).textContent).not.toMatch(/\d/);
  });

  it("shows a place's name and note on hover", () => {
    const shown = [];
    window.panel = { tooltip: { show: (_, tip) => shown.push(tip), hide() {} } };
    const deck = make();
    const store = three();
    store.setNote(A, "tin here");
    deck.draw(store);
    deck.svg.querySelector(`[data-place="${A}"]`).dispatchEvent(new MouseEvent("mouseenter"));
    expect(shown.at(-1)).toEqual({ title: "On the Tinners' Track", body: "tin here" });
    delete window.panel;
  });

  it("right-click Note… takes a note inline and calls onNote; Remove note only with a note", () => {
    const deck = make();
    const store = three();
    deck.draw(store);
    const notes = [];
    deck.onNote((id, text) => notes.push([id, text]));
    rightClick(octOf(deck, A));
    expect(menuItem(deck, "Remove note")).toBe(undefined);
    menuItem(deck, "Note…").click();
    const input = deck.div.querySelector(".land-card input");
    input.value = "tin here";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(notes).toEqual([[A, "tin here"]]);
    expect(deck.div.querySelector(".land-card input")).toBe(null);

    store.setNote(A, "tin here");
    deck.draw(store);
    rightClick(octOf(deck, A));
    menuItem(deck, "Remove note").click();
    expect(notes.at(-1)).toEqual([A, null]);
  });

  it("Esc in the note's input cancels it", () => {
    const deck = make();
    deck.draw(three());
    const notes = [];
    deck.onNote((id, text) => notes.push([id, text]));
    rightClick(octOf(deck, A));
    menuItem(deck, "Note…").click();
    const input = deck.div.querySelector(".land-card input");
    input.value = "never mind";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(notes).toEqual([]);
    expect(deck.div.querySelector(".land-card input")).toBe(null);
  });

  it("Forget this land… calls onForget only after the confirm, and Keep doesn't", () => {
    const deck = make();
    deck.draw(three());
    let forgot = 0;
    deck.onForget(() => forgot++);
    rightClick(deck.svg);
    expect(menuItem(deck, "Note…")).toBe(undefined);
    menuItem(deck, "Forget this land…").click();
    expect(forgot).toBe(0);
    const button = (text) => [...deck.div.querySelectorAll(".land-confirm button")].find((b) => b.textContent === text);
    button("Keep").click();
    expect(forgot).toBe(0);
    expect(deck.div.querySelector(".land-confirm")).toBe(null);
    rightClick(deck.svg);
    menuItem(deck, "Forget this land…").click();
    button("Forget").click();
    expect(forgot).toBe(1);
  });

  it("puts a ← Zennor card on the edge when Zennor's out of view, and it routes to a road end", () => {
    const deck = make();
    deck.div.getBoundingClientRect = () => ({ left: 0, top: 0, width: 520, height: 400, right: 520, bottom: 400 });
    const store = new LandStore();
    store.ingest({ id: END, name: "The Open Downs", coords: { x: 4.8, y: 1 }, exits: { w: { id: "zennor.port-road", area: "zennor" }, e: { id: A, inverse: "w" } } });
    store.ingest({ id: A, name: "On the Tinners' Track", coords: { x: 6.2, y: 1.2 }, exits: { w: { id: END, inverse: "e" }, e: { id: B, inverse: "w" } } });
    store.ingest({ id: B, name: "Bare Rock on the Tinners' Track", coords: { x: 7.4, y: 1.6 }, exits: { w: { id: A, inverse: "e" } } });
    deck.draw(store);
    deck.home();
    expect(deck.div.querySelector(".land-edge")).toBe(null); // Zennor's in view
    deck.centre(40, -1.2, 26);
    const edge = deck.div.querySelector(".land-edge");
    expect(edge.textContent).toBe("← Zennor");
    click(edge);
    edge.click();
    expect(deck.target).toBe(END);
    expect(routes(deck).length).toBe(1);
    expect(card(deck).textContent).toContain("2 steps the way you know");
  });
});

describe("LandDeck: the route card and ← Zennor on a road end", () => {
  const END = "surface.tamsin.join.downs";
  const LONG = "Old Workings on the Tinners' Track";
  function walked() {
    const store = new LandStore();
    store.ingest({ id: END, name: "The Open Downs", coords: { x: 4.8, y: 1 }, exits: { w: { id: "zennor.port-road", area: "zennor" }, e: { id: A, inverse: "w" } } });
    store.ingest({ id: A, name: LONG, coords: { x: 6.2, y: 1.2 }, exits: { w: { id: END, inverse: "e" } } });
    return store;
  }
  const press = (node, type) => node.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: 10, clientY: 10 }));

  it("lets the route card's name wrap whole, and places it by its measured width", () => {
    const deck = make();
    deck.div.getBoundingClientRect = () => ({ left: 0, top: 0, width: 520, height: 400, right: 520, bottom: 400 });
    const store = walked();
    deck.draw(store);
    deck.home();
    store.ingest({ id: B, name: "B", coords: { x: 8, y: 1.2 }, exits: {} });
    store.here = END;
    deck.draw(store);
    const oct = deck.svg.querySelector(`[data-place="${A}"] use`);
    press(oct, "pointerdown");
    press(oct, "pointerup");
    const card = deck.div.querySelector(".land-card");
    expect(card.querySelector(".name").textContent).toBe(LONG);
    expect(card.querySelector(".name").style.textOverflow).toBe("");
    expect(card.querySelector(".name").style.whiteSpace).toBe("");
    // a wide measured card does not fit on the left, so it goes to the right
    const left = (w) => {
      Object.defineProperty(card, "offsetWidth", { value: w, configurable: true });
      deck.placeCards();
      return parseInt(card.style.left, 10);
    };
    const narrow = left(20), wide = left(5000);
    expect(narrow).toBeLessThan(wide);
  });

  it("shows no ← Zennor while you stand on a road end", () => {
    const deck = make();
    deck.div.getBoundingClientRect = () => ({ left: 0, top: 0, width: 520, height: 400, right: 520, bottom: 400 });
    const store = walked();
    store.here = A;
    deck.draw(store);
    deck.home();
    deck.centre(40, -1.2, 26);
    expect(deck.div.querySelector(".land-edge")).not.toBe(null);
    store.here = END;
    deck.draw(store);
    deck.centre(40, -1.2, 26);
    expect(deck.div.querySelector(".land-edge")).toBe(null);
  });
});
