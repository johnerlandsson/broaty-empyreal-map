// @vitest-environment happy-dom
// The side panel: a room's paint and footprint and the place's view, each saved through the edit
// server with the version the page holds. fetch and EventSource are stubbed; place data comes from
// the frozen fixtures (and T.I.S.S. from ui/data, the one wheel).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import kilmar from "../../tests/fixtures/generated/kilmar.js";
import orrin from "../../tests/fixtures/generated/orrin.js";
import tiss from "../../ui/data/tiss.js";
import { startEditor } from "./main.js";

const FIXTURES = { orrin, kilmar, tiss };
const PALETTE = { concourse: "#d9a441", hydroponics: "#4caf7a", offices: "#3fb6b2", midring: "#8796a8", industrial: "#d0703c", docks: "#cfe3ff", commons: "#a57be0" };
const STATE = {
  places: [
    { id: "kilmar", prefix: "kilmar", builder: "decks", docks: [] },
    { id: "orrin", prefix: "orrin", builder: "decks", docks: [] },
    { id: "tiss", prefix: "tiss", builder: "wheel", docks: [] },
  ],
  report: null,
  palette: PALETTE,
  tweaks: {
    kilmar: { json: { like: "orrin", paint: { kitchen: "concourse" } }, version: 7 },
    orrin: { json: { paint: { market: "concourse" } }, version: 3 },
    palette: { json: PALETTE, version: 2 },
  },
};

class FakeEvents {
  constructor() {}
  close() {}
}

let root;
let editor;
let puts;
let replies; // queued responses to PUTs: {status, body}

const start = (hash, state = STATE) => {
  root = document.createElement("div");
  document.body.replaceChildren(root);
  window.location.hash = hash;
  puts = [];
  replies = [];
  const fetch = vi.fn(async (url, init = {}) => {
    if (init.method === "PUT") {
      puts.push({ url, body: JSON.parse(init.body) });
      const { status, body } = replies.shift() ?? { status: 200, body: { ok: true, version: 99, changed: [] } };
      return { ok: status === 200, status, json: async () => body };
    }
    return { ok: true, status: 200, json: async () => structuredClone(state) };
  });
  editor = startEditor({ root, fetch, EventSource: FakeEvents, importPlace: async (id) => structuredClone(FIXTURES[id]) });
  return editor.ready;
};

const side = () => root.querySelector(".side");
const swatch = (name) => side().querySelector(`.sw i[title="${name}"]`);

beforeEach(() => {
  window.location.hash = "";
});
afterEach(() => {
  delete window.editor;
});

describe("the side panel", () => {
  it("shows the room's name, id and address, and its exits and flags", async () => {
    await start("#kilmar/kilmar.market");
    expect(side().querySelector(".h").textContent).toBe("Exchange");
    expect(side().querySelector(".id").textContent).toBe("kilmar.market · Deck 2, frame 2, port 1");
    expect(side().textContent).toContain("east → Deck 2, frame 2");
    expect(side().textContent).toContain("listed");
  });

  it("PUTs the place's tweak with the new paint when a swatch is clicked", async () => {
    await start("#kilmar/kilmar.market");
    swatch("offices").click();
    await editor.busy;
    expect(puts).toHaveLength(1);
    expect(puts[0].url).toBe("/api/tweaks/kilmar");
    expect(puts[0].body.version).toBe(7);
    expect(puts[0].body.json.paint.market).toBe("offices");
    expect(puts[0].body.json.paint.kitchen).toBe("concourse");
  });

  it("PUTs it without the key on reset", async () => {
    await start("#kilmar/kilmar.kitchen");
    side().querySelector('[data-key="paint.kitchen"] .reset').click();
    await editor.busy;
    expect(puts).toHaveLength(1);
    expect(puts[0].url).toBe("/api/tweaks/kilmar");
    expect(puts[0].body.json).toEqual({ like: "orrin" });
  });

  it("says a value comes through like, or is set here", async () => {
    await start("#kilmar/kilmar.market");
    const mark = side().querySelector('[data-key="paint.market"]');
    expect(mark.textContent).toContain("from orrin");
    expect(mark.querySelector(".reset")).toBe(null); // nothing of its own to reset
    expect(swatch("concourse").classList.contains("on")).toBe(true);
    editor.select("kilmar.kitchen");
    expect(side().querySelector('[data-key="paint.kitchen"]').textContent).toContain("set here");
  });

  it("shows a 422's message over the plan and puts the swatch back", async () => {
    await start("#kilmar/kilmar.market");
    replies.push({ status: 422, body: { error: "data/tweaks/kilmar.json: paint.market: bad" } });
    swatch("offices").click();
    await editor.busy;
    const bar = root.querySelector(".errbar");
    expect(bar.hidden).toBe(false);
    expect(bar.textContent).toContain("paint.market: bad");
    expect(swatch("offices").classList.contains("on")).toBe(false);
    expect(swatch("concourse").classList.contains("on")).toBe(true);
  });

  it("reloads on a 409 and says so", async () => {
    await start("#kilmar/kilmar.market");
    replies.push({ status: 409, body: { error: "changed on disk", version: 8 } });
    swatch("offices").click();
    await editor.busy;
    expect(root.querySelector(".errbar").textContent).toContain("changed on disk, reloaded");
  });

  it("holds the version a save returns for the next", async () => {
    await start("#kilmar/kilmar.market");
    swatch("offices").click();
    await editor.busy;
    swatch("commons").click();
    await editor.busy;
    expect(puts[1].body.version).toBe(99);
    expect(puts[1].body.json.paint.market).toBe("commons");
  });

  it("saves a footprint's span and corners", async () => {
    await start("#kilmar/kilmar.market");
    const fore = side().querySelector('input[name="fore"]');
    expect(fore.step).toBe("0.05");
    fore.value = "0.5";
    fore.dispatchEvent(new Event("change"));
    await editor.busy;
    expect(puts[0].body.json.footprints.market).toEqual({ span: { fore: 0.5 } });
    side().querySelector('.seg[data-name="corners"] [data-value="cut"]').click();
    await editor.busy;
    expect(puts[1].body.json.footprints.market).toEqual({ span: { fore: 0.5 }, corners: "cut" });
  });

  it("has no footprint for a passage", async () => {
    await start("#kilmar/kilmar.deck-2-frame-2");
    expect(side().querySelector('[data-sec="footprint"]')).toBe(null);
  });

  it("adds a colour to the palette", async () => {
    await start("#kilmar/kilmar.market");
    side().querySelector('input[name="colour-name"]').value = "rust";
    side().querySelector('input[name="colour"]').value = "#aa5533";
    side().querySelector(".add-colour").click();
    await editor.busy;
    expect(puts[0].url).toBe("/api/palette");
    expect(puts[0].body).toEqual({ json: { ...PALETTE, rust: "#aa5533" }, version: 2 });
  });

  it("sets the cutaway and the camera, and zoom from the overview's view", async () => {
    await start("#kilmar");
    expect(side().querySelector('.seg[data-name="cutaway"] .on').dataset.value).toBe("hide-above");
    side().querySelector('.seg[data-name="cutaway"] [data-value="ghost-above"]').click();
    await editor.busy;
    expect(puts[0].body.json.view).toEqual({ cutaway: "ghost-above" });

    const yaw = side().querySelector('input[name="yaw"]');
    expect(yaw.value).toBe("16");
    yaw.value = "30";
    yaw.dispatchEvent(new Event("change"));
    await editor.busy;
    expect(puts[1].body.json.view).toEqual({ cutaway: "ghost-above", camera: { yaw: 30, pitch: 38, zoom: 1 } });

    const model = editor.place.views.model;
    const [x, y, w, h] = model.home;
    model.setView([x, y, w / 2, h / 2]);
    side().querySelector(".zoom-from-view").click();
    await editor.busy;
    expect(puts[2].body.json.view.camera).toEqual({ yaw: 30, pitch: 38, zoom: 2 });
  });

  it("has no footprint or cutaway on a wheel", async () => {
    await start("#tiss");
    const room = [...editor.place.views.index.byId.values()].find((r) => r?.id && r.name !== r.address);
    editor.select(room.id);
    expect(side().querySelector(".h").textContent).toBe(room.name);
    expect(side().querySelector('[data-sec="footprint"]')).toBe(null);
    expect(side().querySelector('.seg[data-name="cutaway"]')).toBe(null);
    expect(side().querySelector('input[name="yaw"]')).toBeTruthy();
  });

  it("shows a broken tweak file's error and disables its edits", async () => {
    const state = structuredClone(STATE);
    state.tweaks.kilmar = { json: null, version: 5, error: "data/tweaks/kilmar.json: Unexpected token" };
    await start("#kilmar/kilmar.market", state);
    expect(root.querySelector(".errbar").textContent).toContain("Unexpected token");
    expect(side().textContent).toContain("Unexpected token");
    swatch("offices").click();
    await editor.busy;
    expect(puts).toHaveLength(0);
    expect(side().querySelector('input[name="fore"]').disabled).toBe(true);
  });
});
