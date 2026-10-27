// @vitest-environment happy-dom
// What the plan shows to edit by (guides.js) and where a dragged hull point lands (snap.js): the
// grid under the plate, the decks above and below with their points, the card that switches them,
// and the ties a dragged point draws to what it lines up with. fetch and EventSource are stubbed,
// and so is DeckView's toPlan, as in handles.test.js: a client pixel is a plan unit.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import orrin from "../../tests/fixtures/generated/orrin.js";
import tiss from "../../ui/data/tiss.js";
import freighter from "../../tests/fixtures/generated/plans/freighter.js";
import freighterJson from "../../tests/fixtures/generated/plans/freighter.tweak.json";
import { DeckView } from "../../ui/deck-view.js";
import { fakeServer } from "./fake-server.js";
import { startEditor } from "./main.js";

/** A hull point dragged free, past snapping, as with Alt held. */
const FREE = { altKey: true };

const withLook = (data, look) => ({ ...data, look: { ...data.look, ...look } });

let root;
let editor;
let puts; // each change's trial, as fake-server.js records it

const start = async (hash, { tweaks = {}, fixtures = {} } = {}) => {
  root = document.createElement("div");
  document.body.replaceChildren(root);
  window.location.hash = hash;
  const disk = {
    places: [
      { id: "orrin", prefix: "orrin", builder: "decks", docks: [] },
      { id: "tiss", prefix: "tiss", builder: "wheel", docks: [] },
    ],
    plans: [{ id: "freighter", name: "medium freighter", hulls: ["freighter"] }],
    report: null,
    palette: {},
    tweaks: { orrin: { json: {}, version: 3 }, freighter: { json: freighterJson, version: 4 }, palette: { json: {}, version: 2 }, ...structuredClone(tweaks) },
  };
  const data = { orrin, tiss, freighter, ...fixtures };
  const server = fakeServer(disk);
  puts = server.tries;
  editor = startEditor({ root, fetch: vi.fn(server.fetch), EventSource: FakeEvents, importPlace: async (id) => structuredClone(data[id]) });
  await editor.ready;
};

class FakeEvents {
  close() {}
}

const plan = () => editor.place.views.deck.svg;
const handle = (name) => plan().querySelector(`.handles [data-handle="${name}"]`);
const fire = (target, type, x, y, extra = {}) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, buttons: type === "pointerup" ? 0 : 1, pointerId: 1, ...extra }));

/** Drags from (x, y) on the handle by (dx, dy) client pixels, and lets go; `extra` on each event. */
async function drag(node, dx, dy, x = 0, y = 0, extra = {}) {
  fire(node, "pointerdown", x, y, extra);
  fire(window, "pointermove", x + dx / 2, y + dy / 2, extra);
  fire(window, "pointermove", x + dx, y + dy, extra);
  fire(window, "pointerup", x + dx, y + dy, extra);
  await editor.busy;
}

beforeEach(() => {
  window.location.hash = "";
  localStorage.clear();
  vi.spyOn(DeckView.prototype, "toPlan").mockImplementation(function (x, y) {
    return [this.cur[0] + x, this.cur[1] + y];
  });
});
afterEach(() => {
  editor?.stop();
  delete window.editor;
  vi.restoreAllMocks();
});

describe("the grid, the other decks and snapping", () => {
  // Deck 2's path round the Exchange and the Concourse's frame; Deck 3's, its starboard side at 1.33
  const DECK2 = [[-1.62, 1.38], [0.62, 1.38], [0.62, 2.62], [-1.62, 2.62]];
  const DECK3 = [[-1.62, 1.38], [1.33, 1.38], [1.33, 2.62], [-1.62, 2.62]];
  const twoDecks = {
    tweaks: { orrin: { json: { hull: { 2: DECK2, 3: DECK3 } }, version: 3 } },
    fixtures: { orrin: withLook(orrin, { hull: { 2: DECK2, 3: DECK3 } }) },
  };
  const card = (name, value) => root.querySelector(`.plan-card .seg[data-name="${name}"] [data-value="${value}"]`);

  it("draws a grid under the plate, and turns it off from the plan's card, kept across reloads", async () => {
    await start("#orrin/orrin.market", twoDecks);
    const plate = editor.place.views.deck.plans[editor.place.views.deck.level].g;
    expect(plate.firstChild.getAttribute("class")).toBe("grid");
    expect(plate.querySelector(".grid .edges").getAttribute("d").split("M").length).toBeGreaterThan(20);
    card("grid", "off").click();
    expect(plan().querySelector(".grid")).toBe(null);
    expect(localStorage.getItem("tweak-editor.grid")).toBe("off");
    editor.stop();
    await start("#orrin/orrin.market", twoDecks);
    expect(plan().querySelector(".grid")).toBe(null);
  });

  it("shows the deck above dashed with a ring on each point, and the deck below or none from the card", async () => {
    await start("#orrin/orrin.market", twoDecks);
    const above = plan().querySelector('.deck-guide.above[data-deck="3"]');
    expect(above).toBeTruthy();
    expect(above.querySelectorAll("circle")).toHaveLength(4);
    expect(above.textContent).toBe("Deck 3 ▲");
    // Deck 1 is outside the hull: nothing below
    expect(plan().querySelector(".deck-guide.below")).toBe(null);
    editor.select("orrin.berth"); // Deck 3: Deck 2 below
    expect(plan().querySelector('.deck-guide.below[data-deck="2"]').textContent).toBe("Deck 2 ▼");
    card("decks", "off").click();
    expect(plan().querySelector(".deck-guide")).toBe(null);
  });

  it("shows a neighbouring deck with no path of its own as its box", async () => {
    await start("#orrin/orrin.market", {
      tweaks: { orrin: { json: { hull: { 2: DECK2 } }, version: 3 } },
      fixtures: { orrin: withLook(orrin, { hull: { 2: DECK2 } }) },
    });
    const box = plan().querySelector('.deck-guide.above[data-deck="3"]');
    expect(box.textContent).toBe("Deck 3 ▲ (box)");
    // on the plate's corners, the box every deck without a path has
    const { footprint } = editor.place.views.deck.plans[editor.place.views.deck.level].layout;
    const xs = [...box.querySelectorAll("circle")].map((c) => Number(c.getAttribute("cx")));
    expect(Math.min(...xs)).toBeCloseTo(footprint.x);
    expect(Math.max(...xs)).toBeCloseTo(footprint.x + footprint.w);
  });

  it("snaps a dragged point to the deck above's x and its own path's y, tied to each while dragged", async () => {
    await start("#orrin/orrin.market", twoDecks);
    const node = handle("point-1");
    fire(node, "pointerdown", 0, 0);
    fire(window, "pointermove", 98, 0); // to 1.32
    editor.flush();
    const labels = [...plan().querySelectorAll(".handles .tie-label")].map((n) => n.textContent);
    expect(labels).toEqual(["Deck 3 · point 1", "point 0"]);
    expect(plan().querySelectorAll(".handles .tie")).toHaveLength(2);
    expect(plan().querySelector(".handles .readout").textContent).toBe("1.33, 1.38");
    fire(window, "pointerup", 98, 0);
    await editor.busy;
    expect(plan().querySelector(".handles .tie")).toBe(null);
    expect(puts[0].body.json.hull["2"][1]).toEqual([1.33, 1.38]);
  });

  it("falls to the grid with the decks off, and to 0.01 with Alt held", async () => {
    await start("#orrin/orrin.market", twoDecks);
    card("decks", "off").click();
    await drag(handle("point-1"), 98, 0);
    expect(puts[0].body.json.hull["2"][1]).toEqual([1.3, 1.38]);
    await drag(handle("point-1"), 3, 0, 0, 0, FREE);
    expect(puts[1].body.json.hull["2"][1]).toEqual([1.32, 1.38]);
  });

  it("snaps a point added on an edge, near a cell's edge, to it", async () => {
    await start("#orrin/orrin.market", twoDecks);
    const cur = editor.place.views.deck.cur;
    const layout = editor.place.views.deck.plans[editor.place.views.deck.level].layout;
    const [x, y] = layout.centre({ x: -0.48, y: 1.38 });
    plan().querySelector('.handles [data-edge="0"]').dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: x - cur[0], clientY: y - cur[1] }));
    await editor.busy;
    expect(puts[0].body.json.hull["2"][1]).toEqual([-0.5, 1.38]);
  });

  it("draws the grid on a ship's plan, with no other deck", async () => {
    await start("#freighter");
    expect(plan().querySelector(".grid")).toBeTruthy();
    expect(plan().querySelector(".deck-guide")).toBe(null);
    expect(root.querySelector(".plan-card").hidden).toBe(false);
  });

  it("hides the card off decks", async () => {
    await start("#tiss");
    expect(root.querySelector(".plan-card").hidden).toBe(true);
  });
});
