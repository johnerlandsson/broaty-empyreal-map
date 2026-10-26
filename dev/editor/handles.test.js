// @vitest-environment happy-dom
// The drag handles on the plan: a room's footprint sides, a deck's hull path and its points, the
// cradles and masts. Each drag patches the open place's look as it goes and saves on release
// through the panel's save flow; a refused save puts the look back. fetch and EventSource are
// stubbed, and so is DeckView's toPlan (no screen matrix in happy-dom): a client pixel is a plan
// unit, from the view box's corner.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import kilmar from "../../tests/fixtures/generated/kilmar.js";
import orrin from "../../tests/fixtures/generated/orrin.js";
import tiss from "../../ui/data/tiss.js";
import { DeckView } from "../../ui/deck-view.js";
import { hullFromRooms } from "./hull.js";
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

const withLook = (data, look) => ({ ...data, look: { ...data.look, ...look } });

let root;
let editor;
let puts;
let replies;

const start = async (hash, { tweaks = {}, fixtures = {} } = {}) => {
  root = document.createElement("div");
  document.body.replaceChildren(root);
  window.location.hash = hash;
  puts = [];
  replies = [];
  const disk = {
    places: [
      { id: "kilmar", prefix: "kilmar", builder: "decks", docks: [] },
      { id: "orrin", prefix: "orrin", builder: "decks", docks: [] },
      { id: "tiss", prefix: "tiss", builder: "wheel", docks: [] },
    ],
    report: null,
    palette: {},
    tweaks: {
      kilmar: { json: { like: "orrin", paint: { kitchen: "concourse" } }, version: 7 },
      orrin: { json: { paint: { market: "concourse" }, fixtures: orrin.look.fixtures }, version: 3 },
      palette: { json: {}, version: 2 },
      ...structuredClone(tweaks),
    },
  };
  const data = { orrin, kilmar, tiss, ...fixtures };
  const fetch = vi.fn(async (url, init = {}) => {
    if (init.method === "PUT") {
      const sent = JSON.parse(init.body);
      puts.push({ url, body: sent });
      const { status, body } = (await replies.shift()) ?? { status: 200, body: { ok: true, version: 99, changed: [] } };
      if (status === 200) disk.tweaks[url.split("/").pop()] = { json: sent.json, version: body.version };
      return { ok: status === 200, status, json: async () => body };
    }
    return { ok: true, status: 200, json: async () => structuredClone(disk) };
  });
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

/** Drags from (x, y) on the handle by (dx, dy) client pixels, and lets go. */
async function drag(node, dx, dy, x = 0, y = 0) {
  fire(node, "pointerdown", x, y);
  fire(window, "pointermove", x + dx / 2, y + dy / 2);
  fire(window, "pointermove", x + dx, y + dy);
  fire(window, "pointerup", x + dx, y + dy);
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

  it("PUTs footprints.freight.span.aft 1 for the Freight Office's aft handle dragged one frame down", async () => {
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
    expect(puts[1].body.json.footprints?.freight).toBeUndefined(); // back to its cell
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

  it("PUTs the moved point when point 0 is dragged, keeping the others", async () => {
    await start("#orrin", ownPath);
    await drag(handle("point-0"), 14, -10);
    expect(puts).toHaveLength(1);
    expect(puts[0].body.json.hull["3"]).toEqual([[-1.52, 1.48], ...PATH.slice(1)]);
  });

  it("copies an inherited path into the place's own tweak on its first edit", async () => {
    await start("#kilmar", likePath);
    expect(root.querySelector('.side [data-key="hull.2"]').textContent).toBe("from orrin");
    await drag(handle("point-0"), 14, -10);
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
    await drag(handle("point-0"), 14, -10);
    expect(editor.place.data.look.hull["3"]).toEqual(PATH);
    expect(editor.place.views.index.hullPaths["3"][0]).toEqual(PATH[0]);
    const bar = root.querySelector(".errbar");
    expect(bar.hidden).toBe(false);
    expect(bar.textContent).toContain("crosses itself");
  });

  it("keeps the dragged look when the save is written but ui/data's rebuild fails (500 with a version)", async () => {
    await start("#orrin", ownPath);
    replies.push({ status: 500, body: { error: "saved data/tweaks/orrin.json, but rebuilding ui/data failed: boom", version: 42 } });
    await drag(handle("point-0"), 14, -10);
    expect(editor.place.data.look.hull["3"]).not.toEqual(PATH);
    expect(root.querySelector(".errbar").textContent).toContain("rebuilding ui/data failed");
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

  it("makes a hull from the rooms, PUTting hull.3 as hullFromRooms gives it", async () => {
    await start("#orrin");
    root.querySelector('.side [name="hull-from-rooms"]').click();
    await editor.busy;
    expect(puts[0].body.json.hull["3"]).toEqual(hullFromRooms(editor.place.views.index, 3));
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
