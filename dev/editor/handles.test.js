// @vitest-environment happy-dom
// The drag handles on the plan: a room's footprint sides, a deck's hull path and its points, the
// cradles and masts. Each drag patches the open place's look as it goes and makes its change on
// release through the panel, tried with a trial build and kept unsaved; a refused one puts the
// look back. fetch and EventSource are
// stubbed, and so is DeckView's toPlan (no screen matrix in happy-dom): a client pixel is a plan
// unit, from the view box's corner.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import kilmar from "../../tests/fixtures/generated/kilmar.js";
import orrin from "../../tests/fixtures/generated/orrin.js";
import tiss from "../../ui/data/tiss.js";
import freighter from "../../tests/fixtures/generated/plans/freighter.js";
import freighterJson from "../../tests/fixtures/generated/plans/freighter.tweak.json";
import skiff from "../../tests/fixtures/generated/plans/hull-skiff.js";
import skiffJson from "../../tests/fixtures/generated/plans/hull-skiff.tweak.json";
import { DeckView } from "../../ui/deck-view.js";
import { hullFromRooms } from "./hull.js";
import { fakeServer } from "./fake-server.js";
import { startEditor } from "./main.js";

// Deck 3's path round its cross of cells, 0.38 outside each; and one with a rounded corner
const PATH = [
  [-1.62, 1.38],
  [1.62, 1.38],
  [1.62, 2.62],
  [-1.62, 2.62],
];
const ROUNDED = [[-1.62, 1.38], [1.62, 1.38], [1.62, 2.62, 0.35], [-1.62, 2.62]];
const MAST = { type: "mast", side: -0.5, frame: 2.5, height: 1.5 };

/** A hull point dragged free, past snapping, as with Alt held. */
const FREE = { altKey: true };

const withLook = (data, look) => ({ ...data, look: { ...data.look, ...look } });

let root;
let editor;
let puts; // each change's trial, as fake-server.js records it
let saves;
let replies;

const start = async (hash, { tweaks = {}, fixtures = {} } = {}) => {
  root = document.createElement("div");
  document.body.replaceChildren(root);
  window.location.hash = hash;
  const disk = {
    places: [
      { id: "kilmar", prefix: "kilmar", builder: "decks", docks: [] },
      { id: "orrin", prefix: "orrin", builder: "decks", docks: [] },
      { id: "tiss", prefix: "tiss", builder: "wheel", docks: [] },
    ],
    plans: [
      { id: "freighter", name: "medium freighter", hulls: ["freighter"] },
      { id: "hull-skiff", name: "prospecting skiff", hulls: ["skiff"] },
    ],
    report: null,
    palette: {},
    tweaks: {
      kilmar: { json: { like: "orrin", paint: { kitchen: "concourse" } }, version: 7 },
      orrin: { json: { paint: { market: "concourse" }, fixtures: orrin.look.fixtures }, version: 3 },
      freighter: { json: freighterJson, version: 4 },
      "hull-skiff": { json: skiffJson, version: 4 },
      palette: { json: {}, version: 2 },
      ...structuredClone(tweaks),
    },
  };
  const data = { orrin, kilmar, tiss, freighter, "hull-skiff": skiff, ...fixtures };
  const server = fakeServer(disk);
  ({ tries: puts, saves, replies } = server);
  const fetch = vi.fn(server.fetch);
  editor = startEditor({ root, fetch, EventSource: FakeEvents, importPlace: async (id) => structuredClone(data[id]) });
  await editor.ready;
};

class FakeEvents {
  close() {}
}

const plan = () => editor.place.views.deck.svg;
const handle = (name) => plan().querySelector(`.handles [data-handle="${name}"]`);
const fire = (target, type, x, y, extra = {}) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, buttons: type === "pointerup" ? 0 : 1, pointerId: 1, ...extra }));

/** Drags from (x, y) on the handle by (dx, dy) client pixels, and lets go; `extra` on each event (Alt held: {altKey: true}). */
async function drag(node, dx, dy, x = 0, y = 0, extra = {}) {
  fire(node, "pointerdown", x, y, extra);
  fire(window, "pointermove", x + dx / 2, y + dy / 2, extra);
  fire(window, "pointermove", x + dx, y + dy, extra);
  fire(window, "pointerup", x + dx, y + dy, extra);
  await editor.busy;
}

beforeEach(() => {
  window.location.hash = "";
  vi.spyOn(DeckView.prototype, "toPlan").mockImplementation(function (x, y) {
    return [this.cur[0] + x, this.cur[1] + y];
  });
});
afterEach(() => {
  editor?.stop();
  delete window.editor;
  vi.restoreAllMocks();
});

describe("footprint handles", () => {
  it("has one on each side of the selected room", async () => {
    await start("#orrin/orrin.freight");
    for (const side of ["fore", "aft", "port", "starboard"]) expect(handle(`span-${side}`)).toBeTruthy();
  });

  it("draws them as amber arrows pointing out, unlike the hull's blue squares", async () => {
    await start("#orrin/orrin.freight");
    const fore = handle("span-fore");
    expect(fore.tagName.toLowerCase()).toBe("path");
    expect(fore.getAttribute("fill")).toBe("#e8b04a");
    // the tip is above the side's middle: fore is up on the plan
    const c = editor.place.views.deck.plans[editor.place.views.deck.level].layout.cells.find((x) => x.room.id === "orrin.freight");
    const [tx, ty] = fore.getAttribute("d").slice(1).split("L")[0].split(",").map(Number);
    expect(tx).toBeCloseTo(c.cx);
    expect(ty).toBeLessThan(c.cy - c.h / 2);
  });

  it("tries footprints.freight.span.aft 1 for the Freight Office's aft handle dragged one frame down", async () => {
    await start("#orrin/orrin.freight");
    await drag(handle("span-aft"), 0, 100);
    expect(puts).toHaveLength(1);
    expect(puts[0].url).toBe("/api/tweaks/orrin");
    expect(puts[0].body.json.footprints.freight).toEqual({ span: { aft: 1 } });
    expect(puts[0].body.json.paint).toEqual({ market: "concourse" });
  });

  it("snaps to 0.05 and never goes below 0", async () => {
    await start("#orrin/orrin.freight");
    await drag(handle("span-port"), -33, 0);
    expect(puts[0].body.json.footprints.freight.span).toEqual({ port: 0.25 });
    await drag(handle("span-port"), 200, 0);
    // back to its cell, the file as it was read: nothing unsaved, nothing more to try
    expect(puts).toHaveLength(1);
    expect(root.querySelector(".savebar").hidden).toBe(true);
    expect(editor.place.data.look.footprints?.freight).toBeUndefined();
  });

  it("follows the drag in the place's look, and rebuilds the views", async () => {
    await start("#orrin/orrin.freight");
    const before = editor.place.views;
    const node = handle("span-fore");
    fire(node, "pointerdown", 0, 0);
    fire(window, "pointermove", 0, -50);
    expect(editor.place.data.look.footprints.freight).toEqual({ span: { fore: 0.5 } });
    editor.flush();
    expect(editor.place.views).not.toBe(before);
    expect(editor.place.roomId).toBe("orrin.freight");
    fire(window, "pointerup", 0, -50);
    await editor.busy;
  });

  it("sets an inherited span to an explicit 0 when dragged back to its cell", async () => {
    const fp = { market: { span: { aft: 0.5 } } };
    await start("#kilmar/kilmar.market", {
      tweaks: { orrin: { json: { footprints: fp }, version: 3 } },
      fixtures: { kilmar: withLook(kilmar, { footprints: fp }) },
    });
    await drag(handle("span-aft"), 0, -50);
    expect(puts[0].url).toBe("/api/tweaks/kilmar");
    expect(puts[0].body.json.footprints.market).toEqual({ span: { aft: 0 } });
  });

  it("ends a drag let go of outside the window at the next move, saving it", async () => {
    await start("#orrin/orrin.freight");
    fire(handle("span-aft"), "pointerdown", 0, 0);
    fire(window, "pointermove", 0, 100);
    fire(window, "pointermove", 0, 200, { buttons: 0 }); // the release went elsewhere
    await editor.busy;
    expect(puts).toHaveLength(1);
    expect(puts[0].body.json.footprints.freight).toEqual({ span: { aft: 1 } });
    fire(window, "pointermove", 0, 300);
    fire(window, "pointerup", 0, 300);
    await editor.busy;
    expect(puts).toHaveLength(1);
  });

  it("has none on a footprint drawn by hand as an outline", async () => {
    const outline = [[-0.5, -0.5], [0.5, -0.5], [0.6, 0.5], [-0.5, 0.5]];
    await start("#orrin/orrin.freight", { fixtures: { orrin: withLook(orrin, { footprints: { freight: { outline } } }) } });
    expect(handle("span-aft")).toBeNull();
  });

  it("has none on a passage or a blister, or off decks", async () => {
    await start("#orrin/orrin.deck-3-frame-2");
    expect(handle("span-aft")).toBeNull();
    await editor.open("orrin", "orrin.gallery");
    await editor.busy;
    expect(handle("span-aft")).toBeNull();
    await editor.open("tiss");
    await editor.busy;
    expect(plan().querySelector(".handles")).toBeNull();
  });
});

describe("hull handles", () => {
  // Kilmar (its frozen fixture's top deck is 2) is like Orrin
  const likePath = { tweaks: { orrin: { json: { hull: { 2: PATH } }, version: 3 } }, fixtures: { kilmar: withLook(kilmar, { hull: { 2: PATH } }) } };
  const ownPath = { tweaks: { orrin: { json: { hull: { 3: PATH } }, version: 3 } }, fixtures: { orrin: withLook(orrin, { hull: { 3: PATH } }) } };

  it("draws the path with a handle on each point and a ring on a rounded one", async () => {
    await start("#orrin", { tweaks: { orrin: { json: { hull: { 3: ROUNDED } }, version: 3 } }, fixtures: { orrin: withLook(orrin, { hull: { 3: ROUNDED } }) } });
    expect(plan().querySelector(".handles .hull-path")).toBeTruthy();
    expect(plan().querySelectorAll('.handles [data-handle^="point-"]')).toHaveLength(4);
    expect(plan().querySelectorAll(".handles .ring")).toHaveLength(1);
    expect(plan().querySelector(".handles .ring-label").textContent).toBe("r 0.35");
  });

  it("tries the moved point when point 0 is dragged, keeping the others", async () => {
    await start("#orrin", ownPath);
    await drag(handle("point-0"), 14, -10, 0, 0, FREE);
    expect(puts).toHaveLength(1);
    expect(puts[0].body.json.hull["3"]).toEqual([[-1.52, 1.48], ...PATH.slice(1)]);
  });

  it("copies an inherited path into the place's own tweak on its first edit", async () => {
    await start("#kilmar", likePath);
    expect(root.querySelector('.side [data-key="hull.2"]').textContent).toBe("from orrin");
    await drag(handle("point-0"), 14, -10, 0, 0, FREE);
    expect(puts[0].url).toBe("/api/tweaks/kilmar");
    expect(puts[0].body.json.hull["2"]).toEqual([[-1.52, 1.48], ...PATH.slice(1)]);
    expect(puts[0].body.json.like).toBe("orrin");
  });

  it("adds a point where an edge is double-clicked", async () => {
    await start("#orrin", ownPath);
    const edge = plan().querySelector('.handles [data-edge="0"]');
    const { cur } = editor.place.views.deck;
    // the plan's centre is the hull box's: side 0, frame 2; frame 1.38 is 62 units below it
    edge.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: 0 - cur[0], clientY: 62 - cur[1] }));
    await editor.busy;
    expect(puts[0].body.json.hull["3"]).toEqual([PATH[0], [0, 1.38], ...PATH.slice(1)]);
  });

  it("removes a selected point on Delete, and sets its r from the panel", async () => {
    await start("#orrin", ownPath);
    await drag(handle("point-2"), 0, 0); // a click: selects, saves nothing
    expect(puts).toHaveLength(0);
    expect(handle("point-2").classList.contains("on")).toBe(true);
    const r = root.querySelector('.side input[name="hull-r"]');
    r.value = "0.3";
    r.dispatchEvent(new Event("change"));
    await editor.busy;
    expect(puts[0].body.json.hull["3"][2]).toEqual([1.62, 2.62, 0.3]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    await editor.busy;
    expect(puts[1].body.json.hull["3"]).toHaveLength(3);
  });

  it("puts the look back and shows the message when the save is refused (422)", async () => {
    await start("#orrin", ownPath);
    replies.push({ status: 422, body: { error: "data/tweaks/orrin.json: hull.3: crosses itself" } });
    await drag(handle("point-0"), 14, -10, 0, 0, FREE);
    expect(editor.place.data.look.hull["3"]).toEqual(PATH);
    expect(editor.place.views.index.hullPaths["3"][0]).toEqual(PATH[0]);
    const bar = root.querySelector(".errbar");
    expect(bar.hidden).toBe(false);
    expect(bar.textContent).toContain("crosses itself");
  });

  it("keeps the dragged look, unsaved, when the trial passes", async () => {
    await start("#orrin", ownPath);
    await drag(handle("point-0"), 14, -10, 0, 0, FREE);
    expect(editor.place.data.look.hull["3"]).not.toEqual(PATH);
    expect(root.querySelector(".savebar").hidden).toBe(false);
    expect(root.querySelector(".errbar").hidden).toBe(true);
  });

  it("puts back the last built look when two queued saves are both refused", async () => {
    await start("#orrin", ownPath);
    let answer;
    replies.push(new Promise((r) => (answer = r)), { status: 422, body: { error: "hull.3: second" } });
    const node = handle("point-0");
    fire(node, "pointerdown", 0, 0);
    fire(window, "pointermove", 14, -10);
    fire(window, "pointerup", 14, -10); // A: saving, its answer held back
    fire(handle("point-1"), "pointerdown", 0, 0);
    fire(window, "pointermove", 14, 0);
    fire(window, "pointerup", 14, 0); // B: queued behind A, its look A's preview and more
    answer({ status: 422, body: { error: "hull.3: first" } });
    await editor.busy;
    expect(puts).toHaveLength(2);
    expect(editor.place.data.look.hull["3"]).toEqual(PATH);
    expect(root.querySelector(".errbar").textContent).toContain("second");
  });

  it("drops the picked point when an added one is refused", async () => {
    await start("#orrin", ownPath);
    replies.push({ status: 422, body: { error: "hull.3: bad" } });
    const { cur } = editor.place.views.deck;
    plan().querySelector('.handles [data-edge="0"]').dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: -cur[0], clientY: 62 - cur[1] }));
    await editor.busy;
    expect(editor.place.data.look.hull["3"]).toEqual(PATH);
    expect(plan().querySelector(".handles .on")).toBeNull();
    expect(root.querySelector('.side input[name="hull-r"]')).toBeNull();
  });

  it("makes a hull from the rooms, trying hull.3 as hullFromRooms gives it", async () => {
    await start("#orrin");
    root.querySelector('.side [name="hull-from-rooms"]').click();
    await editor.busy;
    expect(puts[0].body.json.hull["3"]).toEqual(hullFromRooms(editor.place.views.index, 3));
  });

  it("makes the hull round the footprints the place resolves, one inherited through like", async () => {
    const footprints = { market: { span: { aft: 1 } } };
    await start("#kilmar", { fixtures: { kilmar: withLook(kilmar, { footprints }) } });
    expect(editor.place.views.index.decks[editor.place.views.deck.level]).toBe(2);
    root.querySelector('.side [name="hull-from-rooms"]').click();
    await editor.busy;
    const index = editor.place.views.index;
    expect(puts[0].body.json.hull["2"]).toEqual(hullFromRooms(index, 2, footprints));
    expect(puts[0].body.json.hull["2"]).not.toEqual(hullFromRooms(index, 2));
  });

  it("warns in the bar when the rooms make more than one piece", async () => {
    const apart = { ...orrin, rooms: orrin.rooms.filter((r) => r.id !== "orrin.deck-3-frame-2") };
    await start("#orrin", { fixtures: { orrin: apart } });
    root.querySelector('.side [name="hull-from-rooms"]').click();
    await editor.busy;
    expect(puts).toHaveLength(1);
    expect(root.querySelector(".errbar").textContent).toContain("4 pieces");
  });

  it("goes back to the box", async () => {
    await start("#orrin", ownPath);
    root.querySelector('.side [name="hull-box"]').click();
    await editor.busy;
    expect(puts[0].body.json.hull).toBeUndefined();
  });

  it("cancels an inherited path with null to go back to the box", async () => {
    await start("#kilmar", likePath);
    root.querySelector('.side [name="hull-box"]').click();
    await editor.busy;
    expect(puts[0].body.json.hull).toEqual({ 2: null });
  });
});

describe("fixture handles", () => {
  it("drags a cradle along its side", async () => {
    await start("#orrin");
    await drag(handle("fixture-2"), 70, 40); // fixtures[2]: the port cradle on Deck 3, side -1
    expect(puts[0].body.json.fixtures[2]).toEqual({ ...orrin.look.fixtures[2], side: -0.5 });
    expect(puts[0].body.json.fixtures).toHaveLength(orrin.look.fixtures.length);
  });

  it("copies inherited fixtures into the place's own tweak on its first edit", async () => {
    // as the build would give it: Kilmar's look has the fixtures it inherits from Orrin's tweak
    await start("#kilmar", { tweaks: { orrin: { json: { fixtures: kilmar.look.fixtures }, version: 3 } } });
    const cradle = kilmar.look.fixtures.findIndex((f) => f.type === "cradle" && f.deck === 2);
    await drag(handle(`fixture-${cradle}`), -14, 0);
    expect(puts[0].url).toBe("/api/tweaks/kilmar");
    expect(puts[0].body.json.fixtures).toHaveLength(kilmar.look.fixtures.length);
    expect(puts[0].body.json.fixtures[cradle].side).toBe(kilmar.look.fixtures[cradle].side - 0.1);
  });

  it("drags a mast in side and frame, on the top deck", async () => {
    const fixtures = [...orrin.look.fixtures, MAST];
    await start("#orrin", { tweaks: { orrin: { json: { fixtures }, version: 3 } }, fixtures: { orrin: withLook(orrin, { fixtures }) } });
    await drag(handle(`fixture-${fixtures.length - 1}`), 35, -50);
    expect(puts[0].body.json.fixtures.at(-1)).toEqual({ ...MAST, side: -0.25, frame: 3 });
  });
});

describe("ship handles", () => {
  // the frozen freighter and skiff; each expected value is worked out from them
  const near = (n) => Number(n.toFixed(2));

  it("drags a bell along its side, trying its new position", async () => {
    await start("#freighter");
    const i = freighterJson.fixtures.findIndex((f) => f.type === "bell");
    expect(handle(`fixture-${i}`)).toBeTruthy();
    await drag(handle(`fixture-${i}`), -14, 30);
    expect(puts[0].url).toBe("/api/tweaks/freighter");
    expect(puts[0].body.json.fixtures[i]).toEqual({ ...freighterJson.fixtures[i], side: near(freighterJson.fixtures[i].side - 0.1) });
    expect(puts[0].body.json.fixtures).toHaveLength(freighterJson.fixtures.length);
  });

  it("drags a boom along its side", async () => {
    await start("#hull-skiff");
    const i = skiffJson.fixtures.findIndex((f) => f.type === "boom");
    await drag(handle(`fixture-${i}`), 14, 0);
    expect(puts[0].url).toBe("/api/tweaks/hull-skiff");
    expect(puts[0].body.json.fixtures[i]).toEqual({ ...skiffJson.fixtures[i], side: near(skiffJson.fixtures[i].side + 0.1) });
  });

  it("drags a greeble in side and frame", async () => {
    await start("#freighter");
    const i = freighterJson.greebles.findIndex((g) => g.type === "antenna");
    const from = freighterJson.greebles[i];
    await drag(handle(`greeble-${i}`), 14, -50); // 0.1 to starboard, half a frame fore
    expect(puts[0].body.json.greebles[i]).toEqual({ ...from, side: near(from.side + 0.1), frame: near(from.frame + 0.5) });
    expect(puts[0].body.json.greebles).toHaveLength(freighterJson.greebles.length);
  });

  it("works the hull path on a plan as on a station", async () => {
    await start("#freighter");
    expect(plan().querySelectorAll('.handles [data-handle^="point-"]')).toHaveLength(freighterJson.hull["1"].length);
    await drag(handle("point-0"), 14, -10, 0, 0, FREE);
    const [x, y] = freighterJson.hull["1"][0];
    expect(puts[0].body.json.hull["1"][0]).toEqual([near(x + 0.1), near(y + 0.1)]);
  });
});
