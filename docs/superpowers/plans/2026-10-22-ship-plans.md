# Ship Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While you're aboard a ship, the bottom band shows a top-down plan of that ship (a drawing per hull class, a generic one otherwise) instead of the station's deck plan, with your room lit.

**Architecture:** Hull drawings are pure data in `ui/lib/hulls.js` (outline, rooms, compartments, copied from the approved mockup), with pure helpers for the highlight shape, the caption and the info line. `ui/ship-deck.js` turns a hull spec into a plan for the existing `DeckView`, which gains "fit this plan to the band" support. `ui/main.js` builds one ship view per hull on first use and shows it whenever the room id starts `ship.`. The class comes from `msg.hull` / `msg.hullName` on the location message; the Lua side doesn't send them yet (the server field hasn't landed), so the live panel shows the generic ship and the preview sends a hull to show the real drawings.

**Tech Stack:** Plain ES modules and SVG in the panel, vitest for pure JS, Lua 5.4 with the repo's `tests/support/t.lua` for the Lua side.

**Spec:** `docs/maps/ship-plans.md`, following `docs/maps/style-guide.md`.

## Global Constraints

- Hull outline: `#9fb0c3`, stroke-width 1.6, filled with the background `#04060c` so stars don't show through.
- Compartments: line drawings in Dim `#7d8a9a` (the courier's empty slot in Passage `#56657a`), stroke 1.1 to 1.4, no fill, **no text, no hover, never lit**.
- Courier seats are part of the cockpit, drawn in Text `#e3eaf2` lines.
- Rooms are room boxes (`roomBox()` from `ui/deck-view.js`) coloured Dim, named with the drawing's short name ("Cockpit"); hover shows the game's room name.
- The highlight, pulse and amber `#ffb347` come from `DeckView`; nothing else may use amber.
- Fore up. Zoom buttons and wheel zoom stay.
- Caption under the hull, Dim, font size 10: `Mule · prospecting skiff`; the name alone with no class; nothing with neither.
- Info line aboard: `COCKPIT OF THE MULE · prospecting skiff`; the room name alone with no class.
- Unknown or missing hull id → the generic drawing.
- No guessing the class from `Ship.List`.
- Any room id starting `ship.` is aboard a ship.

## Review Focus

- **A ship frame with no name and no areaName** (Empyreal.Room arriving before mudstd.room.info) → caption and info line are empty or partial, never "undefined" or a stray " · ". Pinned in Task 2's `shipCaption`/`shipInfo` tests.
- **A hull id the plugin has no drawing for** (`"ore_hauler"`, `""`, a number) → the generic drawing. Pinned in Task 2's `hullOf` test.
- **Stepping off the ship back onto the station** → the ship plan hides, the station's deck plan shows again undimmed with your room lit. Checked in Task 4's preview walk.
- **Opening or reloading the panel while aboard** (the ship view is built while its band is hidden, size 0) → the ship is framed whole once shown. Pinned by Task 3's `home()` and checked in Task 4 with `?step=`.
- **The same ship frame sent again** → no re-centring, the pulse keeps running. `DeckView`'s existing key check covers it; checked in Task 4 with `?step=N&repeat&debug` (deckHighlights +0).

---

### Task 1: Carry the area in the location message

**Files:**
- Modify: `src/station_map/location.lua` (`L.message`, `L.room_info`, `L.reset`)
- Test: `tests/location_test.lua`

**Interfaces:**
- Produces: the `location` message gains `area` and `areaName` (strings or nil), from `mudstd.room.info`. A ship room has `area = "ship.<n>"`, `areaName = "Mule"`.

- [ ] **Step 1: Write the failing tests** in `tests/location_test.lua`:

```lua
test('room_info carries the area and its name', function()
  local f = L.new()
  eq(L.room_info(f, { id = 'ship.41', name = 'Cockpit of the Magpie', area = 'ship.41', areaName = 'Magpie' }), true)
  local m = L.message(f)
  eq(m.area, 'ship.41')
  eq(m.areaName, 'Magpie')
end)

test('a room without an area clears the last one', function()
  local f = L.new()
  L.room_info(f, { id = 'ship.41', name = 'Cockpit of the Magpie', area = 'ship.41', areaName = 'Magpie' })
  L.room_info(f, { id = 'tiss.berth', name = 'Berths' })
  eq(L.message(f).area, nil)
  eq(L.message(f).areaName, nil)
end)

test('odd-typed area fields are ignored', function()
  local f = L.new()
  L.room_info(f, { id = 'ship.41', area = 7, areaName = {} })
  eq(L.message(f).area, nil)
  eq(L.message(f).areaName, nil)
end)

test('reset clears the area', function()
  local f = L.new()
  L.room_info(f, { id = 'ship.41', area = 'ship.41', areaName = 'Magpie' })
  L.reset(f)
  eq(L.message(f).areaName, nil)
end)
```

- [ ] **Step 2: Run to see them fail**

Run: `lua tests/location_test.lua`
Expected: the four new tests FAIL (`area` is nil).

- [ ] **Step 3: Implement.** `L.room_info` sets `state.area = str(data.area)` and `state.areaName = str(data.areaName)` inside its `track`; `L.message` returns them; `L.reset` clears them. `Empyreal.Room` and lift handling don't touch them.

- [ ] **Step 4: Run all tests**

Run: `npm run test:lua`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/station_map/location.lua tests/location_test.lua
git commit -m "feat(location): carry the room's area and area name"
```

---

### Task 2: Hull drawings as data

**Files:**
- Create: `ui/lib/hulls.js`
- Test: `ui/lib/hulls.test.js`

**Interfaces:**
- Produces (all pure, no DOM):
  - `HULLS: { skiff, courier, generic }`, each a hull spec `{ id: string, outline: string /* SVG path d */, rooms: Room[], compartments: Part[], fixtures: Part[] }`, where `Room = { key: string, name: string, shape: { kind: "rect", x, y, width, height, rx } }` and `Part = { tag: "path"|"rect"|"circle"|"line", attrs: object }`. Coordinates are the mockup's (a 200 × 300 box, fore up, centre x 100). `fixtures` are drawn inside rooms (the courier's seats) in Text; `compartments` in Dim.
  - `SCALE = 1.6` and `toPlan([x, y]) => [ (x - 100) * SCALE, (y - 150) * SCALE ]`: mockup coordinates to plan coordinates, centring the ship on 0, 0.
  - `hullOf(id: unknown) => HullSpec`: `HULLS[id]` for `"skiff"` or `"courier"`, otherwise `HULLS.generic`.
  - `isShipRoom(id: unknown) => boolean`: a string starting `"ship."`.
  - `shipShape(spec: HullSpec, key?: string|null) => { kind: "rect", x, y, width, height, rx }`: the room with that key, else the first room, in plan coordinates (position and size multiplied by `SCALE`, `rx` too).
  - `hullExtent(spec) => { w: number, h: number }`: the plan-coordinate size of the outline's bounding box plus the caption, used to fit the band. Take it from a per-spec `box: [x0, y0, x1, y1]` in mockup coordinates (from the outline plus boom and bells) rather than parsing the path.
  - `shipCaption(msg) => string` and `shipInfo(msg) => string` (formats in Global Constraints). `msg` is the location message; read `areaName`, `name` and `hullName`, each only if it's a non-empty string.

- [ ] **Step 1: Write the failing tests** in `ui/lib/hulls.test.js`:

```js
import { describe, expect, it } from "vitest";
import { HULLS, SCALE, hullOf, isShipRoom, shipShape, shipCaption, shipInfo, toPlan, hullExtent } from "./hulls.js";

describe("hullOf", () => {
  it("knows the skiff and the courier", () => {
    expect(hullOf("skiff")).toBe(HULLS.skiff);
    expect(hullOf("courier")).toBe(HULLS.courier);
  });
  it("falls back to the generic ship", () => {
    for (const id of [undefined, null, "", "ore_hauler", 7, {}, "generic", "toString"]) expect(hullOf(id)).toBe(HULLS.generic);
  });
});

describe("isShipRoom", () => {
  it("is any room id starting ship.", () => {
    expect(isShipRoom("ship.41")).toBe(true);
    expect(isShipRoom("ship.41.hold")).toBe(true);
    for (const id of ["tiss.berth", "shipyard.x", "ship", "", null, 41]) expect(isShipRoom(id)).toBe(false);
  });
});

describe("hull specs", () => {
  it.each(Object.keys(HULLS))("%s has an outline, a cockpit first and no text in its compartments", (k) => {
    const h = HULLS[k];
    expect(h.id).toBe(k);
    expect(h.outline).toMatch(/^M/);
    expect(h.rooms[0]).toMatchObject({ key: "cockpit", name: "Cockpit" });
    for (const p of [...h.compartments, ...h.fixtures]) expect(["path", "rect", "circle", "line"]).toContain(p.tag);
  });
  it("the generic ship has no compartments; the real ones do", () => {
    expect(HULLS.generic.compartments).toEqual([]);
    expect(HULLS.skiff.compartments.length).toBeGreaterThan(0);
    expect(HULLS.courier.compartments.length).toBeGreaterThan(0);
  });
  it("the courier's seats are fixtures; the skiff has none", () => {
    expect(HULLS.courier.fixtures.length).toBeGreaterThan(0);
    expect(HULLS.skiff.fixtures).toEqual([]);
  });
});

describe("shipShape", () => {
  it("is the skiff's cockpit in plan coordinates", () => {
    // the mockup's skiff cockpit: x 58, y 70, 84 × 58, rx 6
    const [x, y] = toPlan([58, 70]);
    expect(shipShape(HULLS.skiff)).toEqual({ kind: "rect", x, y, width: 84 * SCALE, height: 58 * SCALE, rx: 6 * SCALE });
  });
  it("falls back to the first room for an unknown key", () => {
    expect(shipShape(HULLS.courier, "galley")).toEqual(shipShape(HULLS.courier));
  });
});

describe("hullExtent", () => {
  it("the courier is taller and narrower than the skiff", () => {
    const s = hullExtent(HULLS.skiff);
    const c = hullExtent(HULLS.courier);
    expect(c.h).toBeGreaterThan(s.h * 0.9);
    expect(c.w).toBeLessThan(s.w);
  });
});

describe("shipCaption and shipInfo", () => {
  const full = { roomId: "ship.41", name: "Cockpit of the Mule", areaName: "Mule", hull: "skiff", hullName: "prospecting skiff" };
  it("names the ship and its class", () => {
    expect(shipCaption(full)).toBe("Mule · prospecting skiff");
    expect(shipInfo(full)).toBe("COCKPIT OF THE MULE · prospecting skiff");
  });
  it("leaves out what it doesn't know", () => {
    expect(shipCaption({ areaName: "Mule" })).toBe("Mule");
    expect(shipCaption({ hullName: "courier" })).toBe("courier");
    expect(shipInfo({ name: "Cockpit of the Mule" })).toBe("COCKPIT OF THE MULE");
    for (const m of [{}, null, undefined, { areaName: 3, name: "", hullName: {} }]) {
      expect(shipCaption(m)).toBe("");
      expect(shipInfo(m)).toBe("");
    }
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run ui/lib/hulls.test.js`
Expected: FAIL, `./hulls.js` not found.

- [ ] **Step 3: Implement `ui/lib/hulls.js`.** Header comment in the style of `ui/lib/drum.js`, naming `content/game/hulls.yaml` in `~/dev/empyreal` and `docs/maps/reference/ship-plans-mockup.html` as the sources.
  - **skiff** and **courier:** copy the coordinates from the mockup's style-A SVGs and its `<defs>` groups (`skiff-boom`, `skiff-hold`, `skiff-bells`, `courier-seats`, `courier-hold`, `courier-slot`, `courier-drive`, `courier-bells`).
    - The outline is the hull `path`. The cockpit is the highlighted `rect` (skiff: 58, 70, 84 × 58, rx 6; courier: 84, 40, 32 × 56, rx 8).
    - The courier's bulkhead line (y 102) is a compartment drawn in the hull colour: give that one part `attrs.stroke: "#9fb0c3"`. Every other part takes its colour from the drawing (Task 4), except the slot's `stroke: "#56657a"`.
    - Bells: the mockup fills them; here they're outlines only, `fill: "none"`.
  - **generic:** outline `M100,40 Q130,40 130,90 L130,240 Q130,260 100,260 Q70,260 70,240 L70,90 Q70,40 100,40 Z`, cockpit `{ x: 78, y: 60, width: 44, height: 50, rx: 8 }`, no compartments or fixtures.
  - Look `HULLS` up with `Object.hasOwn` so `"toString"` falls back.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run ui/lib/hulls.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/lib/hulls.js ui/lib/hulls.test.js
git commit -m "feat(ships): skiff, courier and generic hull drawings as data"
```

---

### Task 3: Let a plan fit itself to the band

**Files:**
- Modify: `ui/lib/deck-layout.js` (add `fitWidth`)
- Modify: `ui/deck-view.js` (`homeView`, the ⌂ handler, a new `home()`)
- Test: `ui/lib/deck-layout.test.js`

**Interfaces:**
- Produces:
  - `fitWidth(extent: {w, h}, aspect: number, pad = 1.15) => number`: the viewBox width that shows the whole extent, padded, in a band of `aspect` (height / width): `Math.max(extent.w, extent.h / aspect) * pad`, clamped to [`280`, `1600`] (the existing `MIN_W` / `MAX_W`; move those two constants to `deck-layout.js` and import them in `deck-view.js`).
  - A plan object may carry `extent: {w, h}`. `DeckView.homeView()` then frames `plan.home` at `fitWidth(plan.extent, this.aspect)` instead of `BASE_W`, and ⌂ does the same for such a plan. Plans without `extent` behave exactly as now.
  - `DeckView.home()`: `this.fit(); this.setView(this.homeView());`, for a view that was just made visible.

- [ ] **Step 1: Write the failing tests** in `ui/lib/deck-layout.test.js`:

```js
describe("fitWidth", () => {
  it("fits a tall plan by its height in a wide band", () => {
    expect(fitWidth({ w: 200, h: 480 }, 0.5)).toBeCloseTo(960 * 1.15);
  });
  it("fits a wide plan by its width in a tall band", () => {
    expect(fitWidth({ w: 400, h: 300 }, 1.5)).toBeCloseTo(400 * 1.15);
  });
  it("stays inside the zoom limits", () => {
    expect(fitWidth({ w: 10, h: 10 }, 1)).toBe(280);
    expect(fitWidth({ w: 10, h: 5000 }, 0.5)).toBe(1600);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run ui/lib/deck-layout.test.js`
Expected: FAIL, `fitWidth` is not exported.

- [ ] **Step 3: Implement** `fitWidth` and the `DeckView` changes as in Interfaces.

- [ ] **Step 4: Run the whole JS suite**

Run: `npx vitest run`
Expected: all pass (the station plans are unchanged).

- [ ] **Step 5: Commit**

```bash
git add ui/lib/deck-layout.js ui/lib/deck-layout.test.js ui/deck-view.js
git commit -m "feat(deck): plans can fit themselves to the band"
```

---

### Task 4: Draw the ship plan and show it aboard

**Files:**
- Create: `ui/ship-deck.js`
- Modify: `ui/main.js`, `dev/preview.js`, `dev/preview.html`
- Modify: `README.md` (The panel), `docs/maps/ship-plans.md` (status, Code)

**Interfaces:**
- Consumes: `HULLS`, `hullOf`, `isShipRoom`, `shipShape`, `shipCaption`, `shipInfo`, `toPlan`, `SCALE`, `hullExtent` (Task 2); `plan.extent`, `DeckView.home()` (Task 3); `roomBox`, `hover`, `label`, `DIM`, `TXT` from `ui/deck-view.js`; `el` from `ui/lib/svg.js`; `area`/`areaName` on the location message (Task 1).
- Produces:
  - `shipPlans(spec) => (svg, index) => [plan]`: the builder `DeckView` takes (as `drumPlans` does). The one plan has `z: 0, ring: false, length: 0, offsets: [0], home: [0, 0], margin: 0.5, extent: hullExtent(spec), shape: (where) => shipShape(spec, where?.room)`, plus `caption` (the caption's text node) and `rooms` (the room objects passed to `roomBox`/`hover`, so their `name` can be updated for hover).
  - `updateShip(view: DeckView, msg) => void`: sets the caption to `shipCaption(msg)` and the first room's hover name to `msg.name` (falling back to the drawing's name).

- [ ] **Step 1: Write `ui/ship-deck.js`.**
  - One `<g display="none">` per plan (as `drum-deck.js` does). Inside it, a group with `transform="scale(1.6) translate(-100 -150)"` holds, in order:
    1. the outline: fill `#04060c`, stroke `#9fb0c3`, width 1.6;
    2. the compartments: stroke `DIM` unless the part sets its own, `fill: "none"`;
    3. each room's `roomBox` with no name text (`DIM` colour);
    4. the fixtures, stroke `TXT`.
  - Room labels (font 12) go outside the scaled group, in plan coordinates via `toPlan`, so the text isn't scaled.
  - The courier's cockpit label mustn't sit on its seats: put it in the cockpit's top quarter, or just above the cockpit if it doesn't fit.
  - The caption: `label()`, font 10, `DIM`, centred under the hull's `box`.
  - Hover on the room box only.
  - Then the `hl` group last, as the other plans do.

- [ ] **Step 2: Wire `ui/main.js`.**
  - Keep a `ships` map of hull id → `DeckView`, built on first use with `new DeckView(deckEl, null, shipPlans(spec))`. `DeckView` doesn't use `index` itself; check that `null` is safe there, or pass `{ byId: new Map() }`.
  - In `render()`, when `isShipRoom(last?.roomId)`:
    - Hide every station's deck div, and show only `ships[hullOf(last.hull).id]`. Call its `home()` when it has just become visible.
    - Call `updateShip(view, last)`, then `view.set({ kind: "room", id: last.roomId, level: 0, room: last.shipRoom ?? null })`.
    - Set the info line to `shipInfo(last)`.
    - The station model still gets `locate(...)` as now (it shows no highlight).
  - Otherwise hide every ship view, and the station path runs as today. Don't leave `show()` assuming the station deck is visible: re-show the current station's deck div when you leave a ship.
  - Update the file's header comment to mention the ship plan.

- [ ] **Step 3: Extend the preview.**
  - In `dev/preview.js`, give `COCKPIT` `area: "ship.41", areaName: "Magpie"`. It sends no hull, so it shows the generic ship.
  - After the existing `"Cockpit of the Magpie (ship.41)"` step, add two steps:
    - `{ label: "Cockpit of the Mule (skiff)", msg: { roomId: "ship.12", name: "Cockpit of the Mule", area: "ship.12", areaName: "Mule", hull: "skiff", hullName: "prospecting skiff" } }`
    - the same for `ship.13`, the Kittiwake, `hull: "courier", hullName: "courier"`.
  - Then a step back to the Magpie, so the existing flight steps follow unchanged.
  - Add a `<select id="hull" title="Ship's hull">` to the bar in `dev/preview.html`, with options `(none)`, `skiff` and `courier`. On change, re-emit the last location message with `hull` and `hullName` set (or deleted for none) when it's a ship room. Add `?hull=` to the header comment's list.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Check it in the preview.** `python3 -m http.server 8765`, open `http://localhost:8765/dev/preview.html` and check:
  - **Walk through the Berths → Magpie → Mule → Kittiwake → Magpie → flying to Orrin → Orrin Berths.** The bottom band shows the generic ship, then the skiff, then the courier, each whole and centred with the cockpit lit and pulsing. Compartments are grey line drawings with no text. The caption reads `Magpie`, `Mule · prospecting skiff`, `Kittiwake · courier`. The info line reads `COCKPIT OF THE MULE · prospecting skiff`. At Orrin Berths the station plan is back, undimmed, with the Berths lit.
  - **`?step=<the Mule step>`:** the skiff is framed whole on first load.
  - **`?step=<the Mule step>&repeat&debug`:** the repeat line shows `deckHighlights +0`.
  - **The hull menu** switches the Magpie between generic, skiff and courier.
  - **⌂** re-frames the ship. Resize the panel and press ⌂: still whole.
  - **Hovering the cockpit** shows "Cockpit of the Mule". Hovering a compartment shows nothing.

- [ ] **Step 6: Update the docs.**
  - **`README.md`, The panel:** add a short **Aboard a ship** paragraph: the bottom band shows the ship's plan, a drawing per class (skiff, courier), and a plain generic ship until the game tells the plugin a ship's class. Also replace the sentence saying the deck plan dims when you board a ship.
  - **`docs/maps/ship-plans.md`:** set the status to *"built; the live panel shows the generic ship until the server sends the hull"*. Name the files in **Code**, replacing *"Left to the builder"*.

- [ ] **Step 7: Commit**

```bash
git add ui/ship-deck.js ui/main.js dev/preview.js dev/preview.html README.md docs/maps/ship-plans.md
git commit -m "feat(ships): ship plan in the bottom band while aboard"
```

---

## Later, when the server's hull field lands (not part of this plan)

Read the field in `L.empyreal_room` (it currently drops any non-lift `vehicle`), put `hull` and `hullName` on the location message, add Lua tests, and remove the generic-only note from the README and `ship-plans.md`. If the server also says which part of the ship a room is, send it as `shipRoom`. `main.js` already passes `shipRoom` to the highlight.
