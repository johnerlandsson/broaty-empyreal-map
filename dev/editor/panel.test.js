// @vitest-environment happy-dom
// The side panel: a room's paint and footprint and the place's view, each change tried with a
// trial build and kept unsaved, then saved with Save through the edit server with the version the
// page read, or dropped with Discard. fetch and EventSource are stubbed; place data comes from
// the frozen fixtures (and T.I.S.S. from ui/data, the one wheel).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import kilmar from "../../tests/fixtures/generated/kilmar.js";
import orrin from "../../tests/fixtures/generated/orrin.js";
import tiss from "../../ui/data/tiss.js";
import { fakeServer } from "./fake-server.js";
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
  static last = null;
  constructor() {
    FakeEvents.last = this;
  }
  close() {}
  emit(event) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

let root;
let editor;
let puts; // each change's trial, as fake-server.js records it
let saves;
let disk;
let replies; // queued responses to trials and saves: {status, body}, or a promise of one

const start = (hash, state = STATE) => {
  root = document.createElement("div");
  document.body.replaceChildren(root);
  window.location.hash = hash;
  disk = structuredClone(state); // what the server would read back: each save is written
  const server = fakeServer(disk);
  ({ tries: puts, saves, replies } = server);
  const fetch = vi.fn(server.fetch);
  editor = startEditor({ root, fetch, EventSource: FakeEvents, importPlace: async (id) => structuredClone(FIXTURES[id]) });
  return editor.ready;
};

const side = () => root.querySelector(".side");
/** A hand edit: tweak files as they are on disk now. */
const hand = (tweaks) => Object.assign(disk.tweaks, structuredClone(tweaks));
const swatch = (name) => side().querySelector(`.sw i[title="${name}"]`);

beforeEach(() => {
  window.location.hash = "";
});
afterEach(() => {
  editor?.stop();
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

  it("tries the place's tweak with the new paint when a swatch is clicked, keeping it unsaved", async () => {
    await start("#kilmar/kilmar.market");
    swatch("offices").click();
    await editor.busy;
    expect(puts).toHaveLength(1);
    expect(puts[0].url).toBe("/api/tweaks/kilmar");
    expect(puts[0].body.json.paint.market).toBe("offices");
    expect(puts[0].body.json.paint.kitchen).toBe("concourse");
    expect(saves).toHaveLength(0);
    expect(swatch("offices").classList.contains("on")).toBe(true);
    const mark = side().querySelector('[data-key="paint.market"]');
    expect(mark.classList.contains("pend")).toBe(true);
    expect(mark.textContent).toContain("unsaved");
  });

  it("saves every unsaved file with the version it was read at, in one PUT", async () => {
    await start("#kilmar/kilmar.market");
    swatch("offices").click();
    await editor.busy;
    editor.select("kilmar.kitchen");
    swatch("commons").click();
    await editor.busy;
    await editor.open("orrin", "orrin.market");
    await editor.busy;
    swatch("docks").click();
    await editor.busy;
    const bar = root.querySelector(".savebar");
    expect(bar.hidden).toBe(false);
    expect(bar.textContent).toContain("3 unsaved changes");
    expect(bar.textContent).toContain("kilmar.json · 2");
    expect(bar.textContent).toContain("orrin.json · 1");
    expect(root.querySelector('.rail .it[data-place="kilmar"] .dot')).toBeTruthy();
    // each trial has every unsaved file
    expect(Object.keys(puts[2].files).sort()).toEqual(["kilmar", "orrin"]);

    bar.querySelector('[name="save"]').click();
    await editor.busy;
    expect(saves).toEqual([
      {
        kilmar: { json: { like: "orrin", paint: { kitchen: "commons", market: "offices" } }, version: 7 },
        orrin: { json: { paint: { market: "docks" } }, version: 3 },
      },
    ]);
    expect(bar.hidden).toBe(true);
    expect(root.querySelector(".rail .dot")).toBe(null);
    expect(side().querySelector('[data-key="paint.market"]').textContent).toContain("set here");

    // the next is read at the version the save gave
    swatch("commons").click();
    await editor.busy;
    root.querySelector('.savebar [name="save"]').click();
    await editor.busy;
    expect(saves[1].orrin.version).toBe(99);
  });

  it("drops every unsaved edit on Discard", async () => {
    await start("#kilmar/kilmar.market");
    swatch("offices").click();
    await editor.busy;
    root.querySelector('.savebar [name="discard"]').click();
    await editor.busy;
    expect(root.querySelector(".savebar").hidden).toBe(true);
    expect(swatch("concourse").classList.contains("on")).toBe(true);
    expect(saves).toHaveLength(0);
  });

  it("has nothing unsaved where a change brings a file back as it was", async () => {
    await start("#kilmar/kilmar.kitchen");
    swatch("offices").click();
    await editor.busy;
    swatch("concourse").click();
    await editor.busy;
    expect(root.querySelector(".savebar").hidden).toBe(true);
  });

  it("asks before leaving the page with edits unsaved, and saves on Ctrl+S", async () => {
    await start("#kilmar/kilmar.market");
    const leave = () => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(leave()).toBe(false);
    swatch("offices").click();
    await editor.busy;
    expect(leave()).toBe(true);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true }));
    await editor.busy;
    expect(saves).toHaveLength(1);
    expect(leave()).toBe(false);
  });

  it("tries it without the key on reset", async () => {
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

  it("shows a refused trial's message at the plan's foot, puts the swatch back and keeps nothing unsaved", async () => {
    await start("#kilmar/kilmar.market");
    replies.push({ status: 422, body: { error: "data/tweaks/kilmar.json: paint.market: bad" } });
    swatch("offices").click();
    await editor.busy;
    const bar = root.querySelector(".errbar");
    expect(bar.hidden).toBe(false);
    expect(bar.textContent).toContain("paint.market: bad");
    expect(swatch("offices").classList.contains("on")).toBe(false);
    expect(swatch("concourse").classList.contains("on")).toBe(true);
    expect(root.querySelector(".savebar").hidden).toBe(true);
  });

  it("holds the saved versions when the save was written but ui/data wasn't rebuilt (500 with versions)", async () => {
    await start("#kilmar/kilmar.market");
    swatch("offices").click();
    await editor.busy;
    replies.push({ status: 500, body: { error: "saved data/tweaks/kilmar.json, but rebuilding ui/data failed: boom", versions: { kilmar: 42 } } });
    root.querySelector('.savebar [name="save"]').click();
    await editor.busy;
    expect(root.querySelector(".errbar").textContent).toContain("rebuilding ui/data failed: boom");
    expect(root.querySelector(".savebar").hidden).toBe(true);
    expect(swatch("offices").classList.contains("on")).toBe(true);
    swatch("commons").click();
    await editor.busy;
    root.querySelector('.savebar [name="save"]').click();
    await editor.busy;
    expect(saves[1].kilmar.version).toBe(42);
  });

  it("takes the unsaved edits over to a file changed by hand, on a save refused for it (409), and tries them again", async () => {
    const state = structuredClone(STATE);
    await start("#kilmar/kilmar.market", state);
    swatch("offices").click();
    await editor.busy;
    // the hand edit lands before the save; the server refuses it, writing nothing
    hand({ kilmar: { json: { like: "orrin", paint: { kitchen: "concourse", berth: "docks" } }, version: 8 } });
    replies.push({ status: 409, body: { error: "changed on disk", versions: { kilmar: 8 } } });
    root.querySelector('.savebar [name="save"]').click();
    await editor.busy;
    expect(root.querySelector(".errbar").textContent).toContain("data/tweaks/kilmar.json changed on disk; your unsaved edits are now on top of it");
    expect(puts.at(-1).files.kilmar).toEqual({ like: "orrin", paint: { kitchen: "concourse", berth: "docks", market: "offices" } });
    root.querySelector('.savebar [name="save"]').click();
    await editor.busy;
    expect(saves.at(-1).kilmar).toEqual({ json: { like: "orrin", paint: { kitchen: "concourse", berth: "docks", market: "offices" } }, version: 8 });
  });

  it("takes them over on a hand edit the server announces, and stops a save where they no longer apply", async () => {
    await start("#orrin");
    editor.select("orrin.market");
    swatch("docks").click();
    await editor.busy;
    hand({ orrin: { json: { paint: { market: "commons" }, view: { cutaway: "off" } }, version: 4 } });
    FakeEvents.last.emit({ type: "built", changed: ["orrin"], version: 51 });
    await editor.busy;
    expect(puts.at(-1).files.orrin).toEqual({ paint: { market: "docks" }, view: { cutaway: "off" } });
    expect(root.querySelector(".savebar").hidden).toBe(false);

    hand({ orrin: { json: null, version: 5, error: "data/tweaks/orrin.json: Unexpected token" } });
    FakeEvents.last.emit({ type: "built", changed: ["orrin"], version: 52 });
    await editor.busy;
    expect(root.querySelector(".errbar").textContent).toContain("no longer apply");
    const save = root.querySelector('.savebar [name="save"]');
    expect(save.disabled).toBe(true);
    root.querySelector('.savebar [name="discard"]').click();
    await editor.busy;
    expect(root.querySelector(".savebar").hidden).toBe(true);
  });

  it("tries a footprint's span and corners", async () => {
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
    expect(puts[0].url).toBe("/api/tweaks/palette");
    expect(puts[0].body.json).toEqual({ ...PALETTE, rust: "#aa5533" });
    expect(swatch("rust")).toBeTruthy(); // in the swatches, unsaved
    root.querySelector('.savebar [name="save"]').click();
    await editor.busy;
    expect(saves[0]).toEqual({ palette: { json: { ...PALETTE, rust: "#aa5533" }, version: 2 } });
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

  it("keeps what's being typed in another field across a change and the trial after it", async () => {
    await start("#kilmar/kilmar.market");
    let answer;
    replies.push(new Promise((r) => (answer = r)));
    const fore = side().querySelector('input[name="fore"]');
    fore.value = "0.5";
    fore.dispatchEvent(new Event("change"));
    const aft = side().querySelector('input[name="aft"]');
    aft.focus();
    aft.value = "0.2";
    answer({ status: 200, body: { ok: true, trial: 50, changed: ["kilmar"] } });
    await editor.busy;
    const now = side().querySelector('input[name="aft"]');
    expect(now).not.toBe(aft); // the panel was drawn again
    expect(now.value).toBe("0.2");
    expect(document.activeElement).toBe(now);
    expect(side().querySelector('input[name="fore"]').value).toBe("0.5");
  });

  it("keeps the focus on an input stepped by its spinner", async () => {
    await start("#kilmar/kilmar.market");
    const yaw = side().querySelector('input[name="yaw"]');
    yaw.focus();
    yaw.value = "17";
    yaw.dispatchEvent(new Event("change"));
    await editor.busy;
    expect(puts[0].body.json.view.camera.yaw).toBe(17);
    expect(document.activeElement?.name).toBe("yaw");
    expect(document.activeElement.value).toBe("17");
  });

  it("refuses a colour name that isn't lower case, digits and hyphens", async () => {
    await start("#kilmar/kilmar.market");
    for (const name of ["Deep Blue!", "a.b", "2nd"]) {
      side().querySelector('input[name="colour-name"]').value = name;
      side().querySelector(".add-colour").click();
      await editor.busy;
      expect(root.querySelector(".errbar").textContent).toContain("not a palette name");
    }
    expect(puts).toHaveLength(0);
  });
});
