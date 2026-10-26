// @vitest-environment happy-dom
// The editor page: the rail lists the places, choosing one builds its overview and plan, a pick on
// either view selects the room in both, and a build that names the open place re-imports it and
// rebuilds the views, keeping the selection. fetch and EventSource are stubbed; place data comes
// from the frozen fixtures.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import kilmar from "../../tests/fixtures/generated/kilmar.js";
import orrin from "../../tests/fixtures/generated/orrin.js";
import freighterJson from "../../data/tweaks/freighter.json";
import freighter from "../../ui/data/plans/freighter.js";
import { startEditor } from "./main.js";

const FIXTURES = { orrin, kilmar };
const STATE = {
  places: [
    { id: "kilmar", prefix: "kilmar", builder: "decks", docks: [] },
    { id: "orrin", prefix: "orrin", builder: "decks", docks: [] },
  ],
  report: { commit: "0a5f686", newPlaces: [], rooms: { added: [{ place: "orrin", id: "orrin.market" }], removed: [], renamed: [] }, orphans: [] },
  palette: {},
  tweaks: { orrin: { json: {}, version: 1 }, palette: { json: {}, version: 1 } },
};

class FakeEvents {
  static last = null;
  constructor(url) {
    this.url = url;
    FakeEvents.last = this;
  }
  close() {}
  emit(event) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

let root;
let imports;
let editor;
let fetchStub;

const start = (hash = "") => {
  imports = [];
  root = document.createElement("div");
  document.body.replaceChildren(root);
  window.location.hash = hash;
  fetchStub = vi.fn(async () => ({ ok: true, json: async () => structuredClone(STATE) }));
  editor = startEditor({
    root,
    fetch: fetchStub,
    EventSource: FakeEvents,
    importPlace: async (id, version) => {
      imports.push([id, version]);
      return structuredClone(FIXTURES[id]);
    },
  });
  return editor.ready;
};

const pointer = (type, node) => node.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: 10, clientY: 10, button: 0, pointerId: 1 }));

beforeEach(() => {
  window.location.hash = "";
});
afterEach(() => {
  editor?.stop();
  delete window.editor;
});

describe("the editor page", () => {
  it("lists both places in the rail, and the report's", async () => {
    await start();
    const names = [...root.querySelectorAll(".rail .it[data-place]")].map((n) => n.textContent);
    expect(names.some((n) => n.includes("Orrin Station"))).toBe(true);
    expect(names.some((n) => n.includes("Kilmar"))).toBe(true);
    expect(root.querySelector(".rail .badge.chg")?.textContent).toBe("1 room");
  });

  it("builds the views when a place is chosen", async () => {
    await start();
    root.querySelector('.rail .it[data-place="orrin"]').click();
    await editor.busy;
    expect(editor.place.id).toBe("orrin");
    expect(root.querySelector("#model svg")).toBeTruthy();
    expect(root.querySelector("#deck svg")).toBeTruthy();
    expect(root.querySelector('.rail .it.on[data-place="orrin"]')).toBeTruthy();
  });

  it("selects a room picked on the plan in both views", async () => {
    await start("#orrin");
    const node = editor.place.views.deck.svg.querySelector('[data-room="orrin.market"]');
    pointer("pointerdown", node);
    pointer("pointerup", node);
    expect(editor.place.roomId).toBe("orrin.market");
    expect(editor.place.views.model.key).toBe("orrin.market");
    expect(editor.place.views.deck.where.id).toBe("orrin.market");
    expect(root.querySelector("#pretend").value).toBe("orrin.market");
  });

  it("names the plan's deck in its tag", async () => {
    await start("#orrin/orrin.market");
    expect(root.querySelector("#plan-tag").textContent).toBe("plan · Deck 2");
    editor.select("orrin.berth");
    expect(root.querySelector("#plan-tag").textContent).toBe("plan · Deck 3");
  });

  it("opens the place and room the hash names", async () => {
    await start("#orrin/orrin.market");
    expect(editor.place.id).toBe("orrin");
    expect(editor.place.views.model.key).toBe("orrin.market");
  });

  it("re-imports the open place on a build that names it, keeping the selection and the view boxes", async () => {
    await start("#orrin/orrin.market");
    const before = editor.place.views;
    before.model.setView([1, 2, 300, 200]);
    before.deck.setView([5, 6, 700, 500]);
    FakeEvents.last.emit({ type: "built", changed: ["orrin"], version: 42 });
    await editor.busy;
    expect(editor.place.views).not.toBe(before);
    expect(imports.at(-1)).toEqual(["orrin", 42]);
    expect(editor.place.roomId).toBe("orrin.market");
    expect(editor.place.views.model.key).toBe("orrin.market");
    expect(editor.place.views.model.vb).toEqual([1, 2, 300, 200]);
    expect(editor.place.views.deck.cur).toEqual([5, 6, 700, 500]);
    expect(root.querySelectorAll("#model .model")).toHaveLength(1);
  });

  it("leaves the open place alone on a build that doesn't name it", async () => {
    await start("#orrin/orrin.market");
    const before = editor.place.views;
    FakeEvents.last.emit({ type: "built", changed: ["kilmar"], version: 43 });
    await editor.busy;
    expect(editor.place.views).toBe(before);
  });

  it("shows a failed build in a bar at the plan's foot, cleared by the next build", async () => {
    await start("#orrin");
    FakeEvents.last.emit({ type: "error", error: "orrin: bad paint" });
    const bar = root.querySelector(".errbar");
    expect(bar.hidden).toBe(false);
    expect(bar.textContent).toContain("bad paint");
    FakeEvents.last.emit({ type: "built", changed: [], version: 44 });
    await editor.busy;
    expect(bar.hidden).toBe(true);
  });

  it("says so when the event stream drops, and reloads once it reopens", async () => {
    await start("#orrin/orrin.market");
    const fetches = fetchStub.mock.calls.length;
    FakeEvents.last.onopen?.();
    await editor.busy;
    expect(fetchStub.mock.calls.length).toBe(fetches); // the first open reloads nothing
    FakeEvents.last.onerror?.();
    const bar = root.querySelector(".errbar");
    expect(bar.hidden).toBe(false);
    expect(bar.textContent).toContain("lost the edit server");
    FakeEvents.last.onopen?.();
    await editor.busy;
    expect(fetchStub.mock.calls.length).toBe(fetches + 1);
    expect(bar.hidden).toBe(true);
    expect(editor.place.roomId).toBe("orrin.market");
  });

  it("says so for an unknown place in the hash at load", async () => {
    await start("#nowhere/x");
    expect(editor.place).toBe(null);
    expect(root.querySelector(".errbar").textContent).toContain("no such place: nowhere");
  });

  it("says so for an unknown place through hashchange, leaving busy resolved", async () => {
    await start("#orrin");
    window.location.hash = "#nowhere";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await expect(editor.busy).resolves.toBeUndefined();
    expect(root.querySelector(".errbar").textContent).toContain("no such place: nowhere");
    expect(editor.place.id).toBe("orrin");
  });

  it("shows a malformed hash rather than throwing", async () => {
    await start("#orrin%E0");
    expect(editor.place).toBe(null);
    expect(root.querySelector(".errbar").textContent).toContain("bad place in the URL");
  });

  it("sets both views from the pretend-I'm-in picker", async () => {
    await start("#orrin");
    const select = root.querySelector("#pretend");
    select.value = "orrin.market";
    select.dispatchEvent(new Event("change"));
    expect(editor.place.views.model.key).toBe("orrin.market");
    expect(window.location.hash).toBe("#orrin/orrin.market");
  });
});

describe("ship classes", () => {
  const PALETTE = { industrial: "#d0703c", docks: "#cfe3ff", residential: "#e8c27a", concourse: "#d9a441" };
  const PLANS = [
    { id: "hull-courier", name: "courier", hulls: ["courier"] },
    { id: "freighter", name: "medium freighter", hulls: ["freighter"] },
    { id: "hull-skiff", name: "prospecting skiff", hulls: ["skiff"] },
    { id: "tug", name: "tug", hulls: ["tug"] },
  ];
  let puts;

  const open = async (hash = "") => {
    imports = [];
    puts = [];
    root = document.createElement("div");
    document.body.replaceChildren(root);
    window.location.hash = hash;
    const disk = {
      ...structuredClone(STATE),
      plans: PLANS,
      palette: PALETTE,
      tweaks: { freighter: { json: structuredClone(freighterJson), version: 5 }, palette: { json: PALETTE, version: 1 } },
    };
    const fetch = vi.fn(async (url, init = {}) => {
      if (init.method === "PUT") {
        const sent = JSON.parse(init.body);
        puts.push({ url, body: sent });
        disk.tweaks[url.split("/").pop()] = { json: sent.json, version: 99 };
        return { ok: true, status: 200, json: async () => ({ ok: true, version: 99, changed: [] }) };
      }
      return { ok: true, status: 200, json: async () => structuredClone(disk) };
    });
    editor = startEditor({
      root,
      fetch,
      EventSource: FakeEvents,
      importPlace: async (id, version, kind) => {
        imports.push([id, version, kind]);
        return structuredClone(kind === "plan" ? { freighter }[id] : FIXTURES[id]);
      },
    });
    await editor.ready;
  };
  const side = () => root.querySelector(".side");
  const toggle = async (name) => {
    const box = side().querySelector(`input[name="${name}"]`);
    box.checked = !box.checked;
    box.dispatchEvent(new Event("change"));
    await editor.busy;
  };

  it("lists the plans under Ship classes by their hull's name", async () => {
    await open();
    const groups = [...root.querySelectorAll(".rail > *")];
    const at = groups.findIndex((n) => n.textContent === "Ship classes");
    const items = groups.slice(at + 1).map((n) => [n.dataset.place, n.textContent]);
    expect(items).toEqual([
      ["hull-courier", "courier"],
      ["freighter", "medium freighter"],
      ["hull-skiff", "prospecting skiff"],
      ["tug", "tug"],
    ]);
  });

  it("opens the freighter's plan and overview, her rooms named for an example ship", async () => {
    await open();
    root.querySelector('.rail .it[data-place="freighter"]').click();
    await editor.busy;
    expect(editor.place.id).toBe("freighter");
    expect(imports.at(-1)[2]).toBe("plan");
    expect(root.querySelector("#model svg")).toBeTruthy();
    expect(root.querySelector("#deck svg")).toBeTruthy();
    expect(root.querySelector('.rail .it.on[data-place="freighter"]')).toBeTruthy();
    const names = [...root.querySelectorAll("#pretend option")].map((o) => o.textContent);
    expect(names).toContain("Cockpit of the Example");
    editor.select("freighter.cockpit");
    expect(editor.place.views.deck.where.id).toBe("freighter.cockpit");
    expect(side().querySelector(".h").textContent).toBe("Cockpit of the Example");
  });

  it("PUTs freighter.json for a paint change", async () => {
    await open("#freighter/freighter.hold");
    side().querySelector('.sw i[title="concourse"]').click();
    await editor.busy;
    expect(puts).toHaveLength(1);
    expect(puts[0].url).toBe("/api/tweaks/freighter");
    expect(puts[0].body.json.paint).toEqual({ hold: "concourse" });
    expect(puts[0].body.version).toBe(5);
  });

  it("PUTs surface.seams false when seams are turned off, keeping the windows", async () => {
    await open("#freighter");
    expect(side().querySelector('input[name="surface-seams"]').checked).toBe(true);
    await toggle("surface-seams");
    expect(puts[0].body.json.surface).toEqual({ windows: ["cockpit", "passage"], seams: false });
  });

  it("turns off each of the hull look's details", async () => {
    await open("#freighter");
    await toggle("profile-bevel");
    expect(puts.at(-1).body.json.profile.bevel).toBe(0);
    await toggle("profile-noseDrop");
    expect(puts.at(-1).body.json.profile.noseDrop).toBe(0);
    await toggle("profile-spine");
    expect(puts.at(-1).body.json.profile.spine).toBe(null);
    await toggle("surface-windows");
    expect(puts.at(-1).body.json.surface.windows).toEqual([]);
    await toggle("surface-stripe");
    expect(puts.at(-1).body.json.surface.stripe).toBe(null);
    await toggle("surface-navLights");
    expect(puts.at(-1).body.json.surface.navLights).toBe(false);
  });

  it("turns a detail back on as the default, not a copy of it", async () => {
    await open("#freighter");
    await toggle("surface-seams");
    expect(side().querySelector('input[name="surface-seams"]').checked).toBe(false);
    await toggle("surface-seams");
    expect(puts.at(-1).body.json.surface).toEqual({ windows: ["cockpit", "passage"] });
    await toggle("profile-spine");
    await toggle("profile-spine");
    expect(puts.at(-1).body.json.profile.spine).toMatchObject({ height: 0.3 });
  });

  it("sets the stripe's colour from the palette", async () => {
    await open("#freighter");
    side().querySelector('.sw.stripe i[title="docks"]').click();
    await editor.busy;
    expect(puts[0].body.json.surface.stripe).toEqual({ paint: "docks", at: 0.3, width: 0.14 });
  });

  it("PUTs the shorter list when a greeble is removed, and a longer one when one is added", async () => {
    await open("#freighter");
    side().querySelector('[name="greeble-remove-1"]').click();
    await editor.busy;
    expect(puts[0].body.json.greebles).toEqual(freighterJson.greebles.filter((_, i) => i !== 1));
    const type = side().querySelector('select[name="greeble-type"]');
    type.value = "dish";
    side().querySelector('[name="greeble-add"]').click();
    await editor.busy;
    expect(puts[1].body.json.greebles).toHaveLength(4);
    expect(puts[1].body.json.greebles.at(-1)).toMatchObject({ type: "dish" });
  });
});
