# Map data from source, stage 3: the tweak editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run edit` opens a browser page where John picks a place, sees it in the plugin's own overview and plan, selects rooms on either view, and changes paint, footprints, hull paths, fixtures and view settings. Each change is saved straight into `data/tweaks/<place>.json`, the build reruns, and both views redraw.

**Architecture:**
- **The server:** a small Node server (`dev/edit-server.mjs`, no framework) serves the repo and offers a JSON API. A candidate tweak is validated by a build into a temp dir. Only a valid tweak is written to `data/tweaks/`, then the real build writes `ui/data/`. Changes, including hand edits, are announced to the page over server-sent events.
- **The page:** `dev/edit.html` draws the place with the same code the panel uses (place views extracted from `ui/main.js`), with picking switched on.
- **Edits as pure functions:** editing operations are pure functions over tweak JSON, so they're tested without a browser.
- **Dragging:** the page redraws locally while you drag, and saves on release.

**Tech Stack:** Node ESM (http, fs, no new dependencies), vitest 2 with happy-dom, plain browser ES modules.

**Spec:** `docs/superpowers/specs/2026-10-26-map-data-from-source-design.md` (approved 2026-10-26). Read "The tweak editor", "Tweak files" (including "The hull") and "Constraints".

**John's approved looks:**
- Layout A with C's drag handles on the plan: `docs/maps/reference/tweak-editor-options.png`.
- Hull path handles: `docs/maps/reference/hull-path-options.png`, row 3, with a square handle on each point and a ring with the radius on a rounded point.

## Global Constraints

- The editor and its server are dev tools under `dev/` and `scripts/`, never packed (`npm run pack` packs `plugin.toml`, `README.md`, `src` and `ui`).
- The server writes only `data/tweaks/*.json` and, through the build, `ui/data/*.js`. Nothing else, and never `~/dev/empyreal`. An editor save must not rewrite `data/sync-report.json`: the editor's builds pass a temp `--report`.
- A tweak file is only written after a candidate build with it succeeds. A refused edit leaves the file and `ui/data` untouched, and shows the build's error message.
- Tweak files are written as 2-space JSON with a trailing newline, keys in the schema's order (`like, paint, paintDistricts, footprints, hull, fixtures, view, place, drum, town, wheel`), so a hand edit and an editor edit diff cleanly.
- The editor draws with the plugin's own views and builders. It never keeps a renderer of its own.
- Picking (clicks resolving to rooms) is opt-in. The panel's output must not change, and the 17 goldens in `tests/golden/*.txt` pass untouched in every task.
- Rooms never move. Names, exits and flags are read-only in the editor.
- Footprint and hull controls appear only on decks places. On other places the editor offers paint and the view settings their kind allows (stage 2 rulings: cutaway only on decks, camera not on towns).
- Write code that reads like the surrounding code.

## Review Focus

1. **Two saves racing** (a second drag released while the first build is still running). The server must handle them one at a time, and the file must end up as the last one, never torn. *Test in Task 4.*
2. **A tweak file edited by hand while the editor is open.** The editor must reload it and never write its stale copy over the hand edit. Every save carries the file's version it was based on, and the server refuses a stale one with 409. *Test in Task 4.*
3. **A drag that makes the tweak invalid** (a hull point dragged through a room). On release the save is refused, the error shows, and the views go back to the last valid state. *Test in Task 7.*
4. **Editing a halt that is `like` Orrin.** Changes go into the halt's own file only, an inherited value shows where it comes from, and "reset" removes the halt's own key so the inherited one shows again. *Test in Task 3.*
5. **A request naming a file outside `data/tweaks`** (`../../etc/x`, an absolute path, a non-`.json` name). The server refuses it and writes nothing. *Test in Task 4.*

---

## File Structure

```
ui/place-views.js            buildPlace(data, builder, modelEl, deckEl, opts) — the place's model and plan views (from ui/main.js)
ui/model-view.js, ui/deck-view.js   opt-in picking: opts.pick -> data-room on room elements, onPick(fn), toPlan(clientX, clientY)
ui/lib/decks.js              layout.cellAt(x, y): plan units -> cell units (the inverse of centre)
dev/editor/ops.js            pure edits on tweak JSON: paint, footprints, hull, fixtures, view, reset, origin of a value
dev/editor/hull.js           hullFromRooms(index, deck): a deck's rooms' union as a path
dev/edit-server.mjs          the server: static files, /api/state, /api/tweaks/:name, /api/palette, /api/events
dev/edit.html, dev/editor/main.js, dev/editor/panel.js, dev/editor/handles.js, dev/editor/editor.css
docs/maps/editor.md          how to use it
```

---

### Task 1: The place views, shared by the panel and the editor

**Files:**
- Create: `ui/place-views.js`, `ui/place-views.test.js`
- Modify: `ui/main.js:40-90` (the `wheel`, `drum`, `decks` and `town` builders, and `BUILDERS`), `tests/golden/render.js` (its copy of the same builders)

**Interfaces:**
- Produces: `buildPlace(data, builder, modelEl, deckEl, opts = {}): {index, model, deck, locate, info?}`. `builder` is one of `decks`, `drum`, `town` or `wheel`, as in `ui/data/places.js`. `opts` is passed to `ModelView` and `DeckView` (Task 2 adds `pick`). `locate(index, msg)` is the place's own locate function. `main.js` keeps `lastLevel` itself.

- [ ] **Step 1:** Write `place-views.test.js` (happy-dom). For each builder, using the frozen fixtures in `tests/fixtures/generated/` and the generated `tiss.js`, `buildPlace` returns `model`, `deck`, `index` and `locate`, and `locate(index, {roomId: <a room>})` finds the room.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Move the four builders into `ui/place-views.js` unchanged, taking `modelEl` and `deckEl` as parameters. `main.js` and `tests/golden/render.js` import `buildPlace`, so `render.js` no longer keeps its own copy.
- [ ] **Step 4:** Run `npx vitest run tests/golden ui/place-views.test.js`, then `npm test`. Expected: PASS, with the goldens untouched.
- [ ] **Step 5:** Commit with `refactor: the place views in one module, for the panel and the editor`.

### Task 2: Opt-in picking and plan coordinates

**Files:**
- Modify: `ui/model-view.js`, `ui/deck-view.js` (the room elements in each plan builder: `roomBox`, the passages and stops), `ui/decks-deck.js`, `ui/drum-deck.js`, `ui/town-deck.js`, `ui/lib/decks.js` (`decksLayout` gains `cellAt`)
- Test: `ui/model-view.test.js`, `ui/deck-view.test.js` (create), `ui/lib/decks.test.js`

**Interfaces:**
- Produces:
  - `new ModelView(el, index, {…, pick: true})` draws each face that has a `key` with `data-room="<key>"`.
  - `new DeckView(el, index, build, {pick: true})` passes `pick` to the plan builders, which then put `data-room="<id>"` on every room element.
  - Both views gain `onPick(fn)`. A click (pointerdown and pointerup within 4 px, so not a pan) on an element with `data-room` calls `fn(roomId)`.
  - `DeckView.toPlan(clientX, clientY): [x, y]` gives plan units through the SVG's screen matrix.
  - `layout.cellAt(x, y): [side, frame]` on a decks layout, the inverse of `layout.centre`.
  - Without `pick`, no attribute or listener is added.

- [ ] **Step 1: Write the failing tests.**
  - With `pick`, Orrin's model has paths with `data-room="orrin.market"`, and its Deck 2 plan has an element with `data-room="orrin.market"`. Without `pick`, neither has any.
  - A synthetic pointerdown and pointerup on that plan element calls the `onPick` callback with `orrin.market`. A pointerdown, a 20 px move and a pointerup doesn't.
  - `layout.cellAt(...layout.centre({x: 1, y: 2}))` deep-equals `[1, 2]`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run tests/golden ui`, then `npm test`. Expected: PASS, with the goldens untouched.
- [ ] **Step 5:** Commit with `feat(ui): opt-in picking and plan coordinates for the editor`.

### Task 3: Pure edits on tweak JSON

**Files:**
- Create: `dev/editor/ops.js`, `dev/editor/hull.js`, `dev/editor/ops.test.js`, `dev/editor/hull.test.js`

**Interfaces:**
- Consumes: the schema's key order and validation in `scripts/source/tweaks.mjs` (import `checkTweak` or the equivalent if it's exported; export it if not), and `pathOf` and `outlineOf` from `ui/lib/footprint.js`.
- Produces: every function returns a NEW tweak object and never mutates its input. Paths are local ids or deck numbers as strings.
  - `setPaint(t, local, name)`
  - `setFootprint(t, local, fp)`
  - `setHull(t, deck, points)`
  - `moveHullPoint(t, deck, i, [x, y])` (keeps `r`)
  - `addHullPoint(t, deck, afterIndex, [x, y])`
  - `removeHullPoint(t, deck, i)`
  - `setHullCorner(t, deck, i, r)` (`r` 0 removes the rounding)
  - `boxHull(t, deck, inherited: boolean)` (deletes the deck's own path, or sets `null` when an inherited one must be cancelled)
  - `moveFixture(t, i, patch)`
  - `setView(t, patch)`
  - `reset(t, keyPath: string[])`: removes the key and prunes empty parents
  - `origin(tweaks, placeId, keyPath): {from: placeId | null, own: boolean}`: where the resolved value at the path comes from through `like`, or null for a default
  - `ordered(t)`: keys in the schema's order (Global Constraints)
  - `hullFromRooms(index, deck): number[][]`: the outline of the union of the deck's room cells, as a counter-clockwise path with only corner points, 0.12 cells outside the cells (as in the approved mockup)

- [ ] **Step 1: Write the failing tests.**
  - Each op on a sample tweak gives the expected JSON, and leaves its input deep-equal to a copy taken before.
  - `ordered` sorts keys in the schema's order.
  - **Review Focus 4:**
    - With `tweaks.places = {orrin: {paint: {market: "offices"}}, kilmar: {like: "orrin"}}`, `origin(tweaks, "kilmar", ["paint", "market"])` is `{from: "orrin", own: false}`.
    - After `setPaint(kilmar, "market", "docks")` it's `{from: "kilmar", own: true}`.
    - After `reset(kilmar, ["paint", "market"])` it's `{from: "orrin", own: false}` again, and kilmar's tweak is `{like: "orrin"}`.
  - `boxHull(t, "2", true)` gives `hull: {"2": null}`, and `boxHull(t, "2", false)` removes `hull.2`.
  - `hullFromRooms` on Orrin's frozen fixture, deck 3, gives a cross of 12 corner points, with bounds −1.62…1.62 across and 0.38…3.62 along, and every room's cell inside it. Deck 2 gives an L of 6 points.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. `hullFromRooms` traces the boundary of the occupied grid squares, then offsets it outward by 0.12.
- [ ] **Step 4:** Run `npx vitest run dev/editor`. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(editor): pure edits on tweak files`.

### Task 4: The edit server

**Files:**
- Create: `dev/edit-server.mjs`, `dev/edit-server.test.mjs`
- Modify: `package.json` (`"edit": "node dev/edit-server.mjs"`), `vitest.config.js` if `dev/**/*.test.mjs` isn't included, and `scripts/build-data.mjs` if `build()` needs to be importable for one call with a candidate tweaks dir

**Interfaces:**
- Produces: `startServer({root, source, port = 8766}): Promise<{url, close()}>`. The CLI starts it and prints `Editor: http://localhost:8766/dev/edit.html`.
  - `GET /*`: static files under `root`. Never outside it.
  - `GET /api/state` → `{places, report, palette, tweaks: {name: {json, version}}}`. `report` is the last editor build's report, or `data/sync-report.json` at start; `version` is the file's mtime in ms (0 if the file doesn't exist).
  - `PUT /api/tweaks/:name` with body `{json, version}` → `200 {ok: true, version, changed: [placeIds]}`, or `409 {error: "changed on disk", version}`, or `422 {error: "<build message>"}`, or `400` for a bad name.
    - `:name` must match `^[a-z0-9_-]+$` and must not be `palette`.
    - The server first builds into a temp out dir with a temp copy of `data/tweaks` holding the candidate (and a temp report). Only on success does it write the file (`ordered`, 2-space, trailing newline), then run the real build into `ui/data` with a temp `--report`.
  - `PUT /api/palette` with `{json, version}`: the same flow, for `palette.json`.
  - `GET /api/events`: server-sent events. `{type: "built", changed: [placeIds], version}` after each build, including one triggered by `fs.watch` seeing a hand edit in `data/tweaks` (debounced 200 ms).
  - One save at a time: requests queue.

- [ ] **Step 1: Write the failing tests.** Start the server on port 0 against a temp copy of the repo's `data/tweaks`, `ui/data` and `tests/fixtures/empyreal` as `source`.
  - `GET /api/state` lists the places and the tweaks with versions.
  - A valid PUT writes the file in the ordered format, returns `changed`, and the matching `ui/data` file changes. `data/sync-report.json` in the temp copy is byte-identical afterwards.
  - An invalid PUT (a footprint overlap) returns 422 with the build's message, and both the tweak file and `ui/data` are byte-identical afterwards.
  - **Review Focus 1:** two valid PUTs sent without waiting both return 200 (the second with the first's new version passed through: build it from the first response), and the file equals the second.
  - **Review Focus 2:** a PUT with an old `version` after the file was rewritten on disk returns 409, and the file keeps the disk version.
  - **Review Focus 5:** PUTs to `..%2Fx`, `%2Ftmp%2Fx` and `orrin.txt` return 400, and no file appears.
  - Hand-writing a tweak file produces a `built` event on `/api/events` within 2 s.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement with `node:http`, `node:fs` and the build's exported `build()`.
- [ ] **Step 4:** Run `npx vitest run dev/edit-server.test.mjs`, then `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(editor): the edit server`.

### Task 5: The editor page — places, views, shared selection, live reload

**Files:**
- Create: `dev/edit.html`, `dev/editor/main.js`, `dev/editor/editor.css`, `dev/editor/main.test.js` (happy-dom, with `fetch` and `EventSource` stubbed)

**Interfaces:**
- Consumes: `buildPlace` (Task 1), `pick`, `onPick` and `toPlan` (Task 2), and the server API (Task 4).
- Produces: the layout-A page.
  - **Left rail:** the sync report's lists on top (new places, rooms changed, orphans), each item opening its place. Below them, every place from `places.js`, grouped as "Stations" and "Ship classes" (the latter empty until stage 4).
  - **Middle:** the overview above the plan, at the panel's proportions (42 : 58).
  - **Right:** an empty panel for Task 6.
  - Picking on either view selects the room. Both views then light it (`model.set` and `deck.set` with `locate(index, {roomId})`), and the plan shows its deck.
  - On a `built` event that names the open place, the page re-imports `ui/data/<id>.js?v=<version>` and rebuilds the views. It keeps the selection, the plan's deck and both views' view boxes.
  - A "pretend I'm in" picker on the right panel's view section sets both views to that room, exactly as `main.js` does.

- [ ] **Step 1: Write the failing tests.** With stubbed state for Orrin and Kilmar:
  - the rail lists both places;
  - choosing Orrin builds the views;
  - a pick on the plan sets the model's lit key to that room;
  - a `built` event for Orrin re-imports it and keeps the selection.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run dev/editor`, then `npm test`. Start `npm run edit`, render `http://localhost:8766/dev/edit.html` with headless chromium at 1400×800 (Orrin open, Exchange selected; use a URL hash like `#orrin/orrin.market` for the initial state), look at the PNG, and compare it with `docs/maps/reference/tweak-editor-options.png` option A.
- [ ] **Step 5:** Commit with `feat(editor): the page, with shared selection and live reload`.

### Task 6: The side panel — room facts, paint, footprints, view

**Files:**
- Create: `dev/editor/panel.js`, `dev/editor/panel.test.js`
- Modify: `dev/editor/main.js`

**Interfaces:**
- Consumes: the ops (Task 3) and `PUT /api/tweaks/:name` and `/api/palette` (Task 4).
- Produces, for a selected room, as in the approved mockup:
  - The name, id and address, then exits and flags read-only.
  - **Paint:** the palette's swatches, with the current one ringed and an "add colour" (name and colour input) that saves to the palette.
  - **Footprint (decks only):** span inputs fore, aft, port and starboard (step 0.05), corners square/rounded/cut, and `r`.
  - Each value is marked "set here" or "from <place>" (`origin`), with a reset.
- Produces, with nothing selected, the view section:
  - cutaway (decks only);
  - camera yaw, pitch and zoom (not on towns), with "set zoom from current view" (the overview's current view box width against its home);
  - "pretend I'm in".
- Every change runs the op, then PUTs with the version it holds. A 422 shows the message in a bar over the plan and puts the inputs back. A 409 reloads the state and says "changed on disk, reloaded".

- [ ] **Step 1: Write the failing tests** (happy-dom, stubbed fetch):
  - Clicking the `offices` swatch PUTs `kilmar.json` with `paint.market: "offices"`.
  - Reset PUTs it without that key.
  - On Kilmar (`like` Orrin) the market's paint shows "from orrin".
  - A 422 response shows its message and restores the swatch.
  - On a wheel place the footprint section and cutaway aren't rendered.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run dev/editor`, then `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(editor): room and view settings in the side panel`.

### Task 7: Drag handles on the plan — footprints, hull paths, fixtures

**Files:**
- Create: `dev/editor/handles.js`, `dev/editor/handles.test.js`
- Modify: `dev/editor/main.js`, `dev/editor/panel.js` (the hull section)

**Interfaces:**
- Consumes: `toPlan` and `cellAt` (Task 2), the ops and `hullFromRooms` (Task 3), and the save flow (Task 6).
- Produces, on decks places, on the plan in an overlay `<g>`:
  - **Footprint:** for the selected room, a square handle mid-way along each side of its box. Dragging one sets that side's span, snapping to 0.05 cells and never below 0.
  - **Hull path:** the deck's path in blue, with a square handle on each point and a ring on a rounded point, as in `hull-path-options.png` row 3.
    - Drag a point to move it (snap 0.01).
    - Double-click an edge to add a point there.
    - Select a point, then press Delete to remove it, or set its `r` in the panel.
    - With no path, the panel offers "make hull from rooms" (`hullFromRooms`). With a path, it offers "back to the box" (`boxHull`).
  - **Fixtures:** a handle on each cradle's root, which drags along the side, and on each mast, which drags in side and frame.
- During a drag the page patches the open place's `look` in memory and rebuilds the views every animation frame, so the overview follows. On release it saves. If the save is refused (422), the views go back to the last valid look and the bar shows the message.

- [ ] **Step 1: Write the failing tests** (happy-dom, stubbed fetch and a stubbed `toPlan`):
  - Dragging the Freight Office's aft handle one frame down PUTs `footprints.freight.span.aft: 1`.
  - Dragging hull point 0 PUTs the moved point.
  - A double-click on an edge adds a point.
  - **Review Focus 3:** a drag that the stubbed server refuses with 422 restores the previous `look` and shows the message.
  - "make hull from rooms" PUTs `hull.3` equal to `hullFromRooms`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run dev/editor`, then `npm test`. Then, with `npm run edit` on a scratch copy of the repo (`cp -r` to /tmp, so the real `data/tweaks` stays clean), drive one drag with headless chromium if possible, or by calling the page's exposed `window.editor` test hooks. Render the result and look at it.
- [ ] **Step 5:** Commit with `feat(editor): drag handles for footprints, hull paths and fixtures`.

### Task 8: Docs and the sync routine

**Files:**
- Create: `docs/maps/editor.md`
- Modify: `docs/maps/sync.md` (step 3 and 4: use the editor for what the report names), `README.md` (Development: `npm run edit`)

- [ ] **Step 1:** Write `editor.md`:
  - starting it;
  - the three columns;
  - selecting;
  - each control and handle;
  - inherited values and reset;
  - what a refused save looks like;
  - that hand edits are picked up live;
  - that it writes only tweak files and `ui/data`.

  Then link it from `sync.md` and the README.
- [ ] **Step 2:** Run `npm test`. Expected: PASS.
- [ ] **Step 3:** Commit with `docs: the tweak editor`.
