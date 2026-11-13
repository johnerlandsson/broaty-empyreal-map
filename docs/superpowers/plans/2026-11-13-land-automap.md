# The Walked Land's Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map Tamsin's generated land (`surface.tamsin.*`) as you walk it, in the Map panel. The bottom band is a board of octagons coloured by the kind of ground, with tracks, ways and the route home. The top band is Tamsin seen from above.

**Architecture:** The Lua side passes each `surface.*` `mudstd.room.info` frame to the panel as `land-room`, and keeps a saved map per character in Mallard's storage (`land-save` / `land-load`). In the panel:

- pure modules keep the map (`land-store.js`, on a copy of the automapper's graph and route finder), read the kind of ground from the name (`land-kinds.js`) and lay out the board (`land-layout.js`);
- `land-deck.js` and `land-globe.js` draw the two bands;
- `ui/main.js` shows them whenever the location's area starts with `surface.`.

**Tech Stack:** Lua 5.x (Mallard plugin API: `gmcp`, `panel`, `storage`), ES modules in the panel, SVG, vitest (+ happy-dom for DOM tests), plain-Lua tests, `scripts/build-data.mjs` for generated data.

**Spec:** `docs/superpowers/specs/2026-11-13-land-automap-design.md`. Its picked mockups are in `docs/maps/reference/`: `land-picked-mockup.html` / `land-picked.png` for the look and `land-questions-mockup.html` / `land-questions.png` for the bend and chevron. Both mockups' geometry code is the reference for drawing. Read the spec before any task.

## Global Constraints

- **Only walked places.** Nothing is ever drawn or named that you haven't stood in. Ways not taken are stubs; their targets' names are never shown ([[no-spoilers]]).
- **Never print a height, a distance in km, or any number about the ground.** The only number shown is "N steps the way you know".
- **Don't edit `~/dev/empyreal`.** Read it only, and only where it exists (tests skip without it).
- **Highlight:**
  - Amber `#ffb347` is the highlight and nothing else.
  - Only your octagon glows: fill .3, stroke 3, `glowFilter`, `pulse()` from `ui/lib/svg.js`.
  - The route is dashed amber 1.5 px at .75, with no glow.
- **Style-guide colours:** Ground `#110e0b`, Earth `#332b22`, Stone `#4b4338`, Dim `#7d8a9a`, Fixture line `#cfd8e3`. A new colour goes in `docs/maps/style-guide.md` §4.2 before code uses it (Task 6 does this first).
- **The board:**
  - Tiling 1.2 km. Octagons are regular, flat to flat 1.2 km, faces to the eight compass points, centred on Zennor's point (0, 0).
  - Board geometry is in km (x east, y north); the SVG flips y. Widths given as "k" in the spec are km; widths given in px use `vector-effect="non-scaling-stroke"`.
- **Code from the automapper** is copied from `~/dev/mallardx-automapper` commit `5134d5f`. Don't change the automapper itself.
- **Storage:** the key is `land:<character>`. Saving goes through Lua; the panel has no storage of its own.
- **Commits:** commit only on the task's commit step, on branch `rochet/automap-proc-gen`, ending with the attribution line in the session's instructions. Never `git worktree add`.
- **Copy:** the info line and cards use the game's place names as sent. UI words are plain English, as in the spec ("N steps the way you know", "Note…", "Remove note", "Forget this land…", "← Zennor").

## Review Focus

1. **A frame before the character is known.** At login the room frame can come before `Char.Status`. The places walked meanwhile must survive `land-load`: they are merged in, and the newer frame wins. They must not be wiped. Pinned in Task 4.
2. **A bad stored value.** A stored record that is missing, from an older shape, or not a table loads as an empty map, without throwing, in both Lua and JS. Pinned in Tasks 3 and 4.
3. **Switching characters, or forgetting, mid-session.** The board must clear and reload for the new character, and a late `land-save` from the old one must not be written under the new name. Pinned in Task 3.
4. **The same layout after reload.** A collision's winner is decided by walk order, so the saved order must give the same board after a reload as before it. Pinned in Task 5.
5. **Exits to Zennor and stubs.** A road end's exit into Zennor (`area: "zennor"`) is never a dotted stub and never shows a name. It is drawn as Zennor's road, and clicking "← Zennor" routes to a walked road end. Pinned in Tasks 5 and 7.

---

### Task 1: The automapper's engine, copied in

**Files:**
- Create: `ui/lib/automap/graph.js`, `ui/lib/automap/links.js`, `ui/lib/automap/pathfind.js` (copied verbatim from `~/dev/mallardx-automapper/ui/`)
- Create: `ui/lib/automap/graph.test.js`, `links.test.js`, `pathfind.test.js` (copied, imports adjusted only if needed)
- Create: `ui/lib/automap/README.md`

**Interfaces:**
- Produces (as the automapper has them):
  - `createMap()`
  - `addRoom(map, {key, name, coords}) -> room` (room `.id` is internal; `.key` is our game id)
  - `getRoomByKey(map, key)`
  - `linkExit(map, fromId, dir, toId)`
  - `findPath(map, fromId, toId) -> [{fromId, dir, toId}] | [] | null`

These three files are all the engine we need. `graph.js` and `links.js` have no imports, and `pathfind.js` imports only `links.js`. Room ids are the game's, so `identity.js` (placing rooms that have no ids) isn't needed, and `floors.js` / `render.js` aren't copied. This is the spec's "Left to the builder" choice; say so in the README.

- [ ] **Step 1: Copy the three modules and their tests.** Check that each copied file is byte-identical to the automapper's: `diff` against `~/dev/mallardx-automapper/ui/<file>` at commit `5134d5f` shows no difference.
- [ ] **Step 2: Run** `npx vitest run ui/lib/automap`. Expected: PASS. If a copied test imports a module we didn't copy, drop that test case and list it in the README.
- [ ] **Step 3: Write `README.md`.** It says:
  - the source repo and commit `5134d5f`;
  - which files were copied and why only these;
  - "our changes: none";
  - how to update: copy again, re-run, re-apply any changes listed here.
- [ ] **Step 4: Commit.** `git commit -m "feat(land): copy the automapper's graph and route finder in"`

---

### Task 2: The kind of ground, from the name

**Files:**
- Create: `ui/lib/land-kinds.js`
- Test: `ui/lib/land-kinds.test.js`

**Interfaces:**
- Produces:
  - `TITLES: Map<string, Group>`. Every exact title in the spec's table, plus `"Road End"` → `"road"` (the game's title for a join with no name).
  - `type Group = "open"|"road"|"waymark"|"high"|"slope"|"low"|"rock"|"dust"|"workings"|"water"|"salt"|"ice"`.
  - `GROUPS: Group[]`, in the spec's table order.
  - `groupOf(id: string, name: string): Group`. An id containing `.join.` is `"road"`. Otherwise the name has " on …" / " by …" stripped. A base starting with `"On "` is `"open"`. Anything not in `TITLES` is `"open"`.
  - `trackOf(name: string): string|null`. The X in "on X" / "On X", when X ends in " Track". Otherwise null.
  - `regionOf(name: string): string|null`. The X in "on X" / "On X" / "by X", when X is not a track. Otherwise null.

- [ ] **Step 1: Write the failing tests:**

```js
expect(groupOf("surface.tamsin.3.4.1", "Old Workings on the Tinners' Track")).toBe("workings");
expect(trackOf("Old Workings on the Tinners' Track")).toBe("the Tinners' Track");
expect(trackOf("On the Terrace Track")).toBe("the Terrace Track");
expect(groupOf("x", "On the Terrace Track")).toBe("open");
expect(regionOf("Hollow on the Downs")).toBe("the Downs");
expect(regionOf("Cairn by the Carn")).toBe("the Carn");
expect(regionOf("On the Downs")).toBe("the Downs");
expect(regionOf("Old Workings on the Tinners' Track")).toBe(null);
expect(groupOf("x", "Head of an Ice Gully on the Downs")).toBe("low");
expect(groupOf("x", "The Salt Pans")).toBe("salt");
expect(groupOf("surface.tamsin.join.downs", "The Open Downs")).toBe("road");
expect(groupOf("x", "Something New")).toBe("open");
```

  Also one `it.each` over the spec's whole table, checking that each title maps to its group.
- [ ] **Step 2: Write the game check, in the same test file.** Use `it.skipIf(!existsSync(file))`, as `scripts/source/read.test.mjs` does with `join(homedir(), "dev/empyreal/...")`.
  - Read `packages/game/src/systems/surface-words.ts`. Collect the string literals returned in `placeTitle` (from `return '…'`, and from `? '…' : '…'` inside returns) and the values of `WORKING_TITLE` and `COVER_TITLE`.
  - Skip template returns starting with `On ${`.
  - Expect each one in `TITLES`, with the failure message naming the title and pointing to `docs/maps/sync.md`.
  - A second check reads `content/game/land.yaml` and expects every `tracks[].name` to end in " Track", so `trackOf` sees it.
- [ ] **Step 3: Run** `npx vitest run ui/lib/land-kinds.test.js`. Expected: FAIL (module missing).
- [ ] **Step 4: Implement `ui/lib/land-kinds.js`.** It is pure, with no imports.
- [ ] **Step 5: Run** the test again. Expected: PASS, with the game checks running here because `~/dev/empyreal` exists.
- [ ] **Step 6: Commit.** `git commit -m "feat(land): the kind of ground, tracks and regions from a place's name"`

---

### Task 3: Lua: land frames to the panel, the map kept per character

**Files:**
- Create: `src/station_map/land.lua`
- Modify: `src/main.lua` (reducer dispatch in `on_gmcp`, `char_status`, `ready` handler, new `panel:on_message('land-save', …)`, disconnect)
- Test: `tests/land_test.lua` (new), `tests/main_test.lua` (boot list gets `station_map.land`; new cases)
- Modify: `package.json` (`test:lua` runs `tests/land_test.lua`)

**Interfaces:**
- Produces, Lua → panel:
  - `land-room`: `{ id, name, area, areaName, coords = {x, y, z}, exits = { [DIR] = { id, area?, inverse? } } }`. `DIR` is as the game sends it (`N`, `NE`, …, `U`, `D`, `IN`, `OUT`).
  - `land-load`: `{ who = string, record = table|nil }`. `record` is whatever the panel last saved for `who` (nil when there's none, or when what's stored isn't a table).
- Consumes, panel → Lua: `land-save`: `{ who = string, record = table }`.
- `land.lua`:
  - `G.frame(data) -> table|nil`. It returns the `land-room` message for a `mudstd.room.info` frame whose `area` is a string starting with `surface.` and that has an `id` and numeric `coords.x`, `coords.y`. Otherwise it returns nil. Only the fields above are copied, and non-table exits are dropped.
  - `G.record(saved) -> table|nil`. It returns the saved value if it's a table, otherwise nil.

Behaviour in `main.lua`:

- On `mudstd.room.info`, after the location reducer, if `G.frame(data)` gives a message, keep it as `last_land` and `panel:post('land-room', msg)`.
- When `char_status` names a new character (where `N.become` runs now), `panel:post('land-load', { who = who, record = G.record(storage.get('land:' .. who)) })`, inside `pcall` as `stored_lanes` does.
- On `ready`, replay `land-load` for the current `N.who(lanes)` if one is known, then `last_land` if any (in that order).
- On `land-save`, store `record` under `land:<who>` only when `data.who == N.who(lanes)` and `record` is a table.
- On disconnect, `last_land = nil`.

- [ ] **Step 1: Write the failing tests.**
  - `tests/land_test.lua`:
    - `G.frame` passes a `surface.tamsin.1.2.3` frame through with coords and exits (`N = {id=…, inverse='S'}`, `E = {id='zennor.port-road', area='zennor'}`);
    - it returns nil for `area = 'zennor'`, for a missing area, and for no coords;
    - `G.record('junk')` is nil.
  - `tests/main_test.lua`:
    - a land frame posts `land-room` after `location`;
    - `Char.Status` with `name = 'Ada'` posts `land-load` `{who='Ada', record=stored['land:Ada']}`;
    - `land-save` from `who='Ada'` writes `stored['land:Ada']`;
    - `land-save` with `who='Bea'` while Ada is current writes nothing (Review Focus 3);
    - `ready` replays `land-load`, then the last `land-room`;
    - `bad_storage = true` still posts `land-load` with `record = nil` (Review Focus 2).
- [ ] **Step 2: Run** `npm run test:lua`. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement `land.lua` and the `main.lua` wiring above.** Add `station_map.land` to `main_test.lua`'s reload list.
- [ ] **Step 4: Run** `npm run test:lua`. Expected: PASS, all files.
- [ ] **Step 5: Commit.** `git commit -m "feat(land): pass land frames to the panel, keep each character's map"`

---

### Task 4: The land store

**Files:**
- Create: `ui/lib/land-store.js`
- Test: `ui/lib/land-store.test.js`

**Interfaces:**
- Consumes:
  - Task 1: `createMap`, `addRoom`, `getRoomByKey`, `linkExit`, `findPath` from `./automap/*.js`.
  - Task 3: the `land-room` message shape.
- Produces:
  - `type Dir = "n"|"ne"|"e"|"se"|"s"|"sw"|"w"|"nw"`.
  - `DIRS: Dir[]`, in that order.
  - `type Exit = { to: string, area?: string, back?: Dir }`. `back` is the inverse when the game sent one. With no `back`, the way is one-way.
  - `type Place = { id, name, x, y, z, exits: Partial<Record<Dir, Exit>>, note?: string }`.
  - `class LandStore`, with:
    - `constructor()` (empty, `who = null`).
    - `ingest(frame) -> boolean` (changed). It adds or replaces the place and sets `here`.
      - Exit keys are lower-cased.
      - Non-compass exits (`U`, `D`, `IN`, `OUT`) are kept off the board and out of routes.
      - A place walked again has its name and exits replaced by the new frame's. It keeps its note and its first-walked order.
    - `here: string|null`.
    - `places(): Place[]`, in first-walked order.
    - `place(id): Place|undefined`.
    - `walked(id): boolean`.
    - `setNote(id, text|null)`.
    - `route(fromId, toId) -> string[]|null`. These are the place ids along the shortest walked route, both ends included. It runs `findPath` over walked places and known exits only.
    - `record() -> { v: 1, places: Place[] }`.
    - `load(who, record)`:
      - it sets `who`;
      - a record that isn't `{v: 1, places: []}` is treated as empty;
      - places already ingested while `who` was null are merged over the loaded ones, newer winning, and stay after them in order (Review Focus 1);
      - loading for a different `who` than the current non-null one first clears.
    - `forget()`: clears places, notes and `here`, but keeps `who`.
    - `onChange(fn)`: called after any change, for the debounced save.

The engine's `map` is rebuilt from `places()` whenever a route is asked for after a change. Keep this simple: walked places are hundreds, not thousands.

- [ ] **Step 1: Write the failing tests**, with frames built by a small `frame(id, x, y, exits)` helper:
  - ingesting two places joined both ways gives `route(a, b)` equal to `[a, b]`, and a three-place chain gives the middle one;
  - an exit to an unwalked id is kept in `place(a).exits` but gives `route` null to it;
  - an exit with no `inverse` has no `back`;
  - re-ingesting `a` with a new exit replaces its exits and keeps its note and order;
  - `load("Ada", record)` after two ingests with `who` null keeps both and the loaded ones, with `places()` order loaded-then-new (Review Focus 1);
  - `load("Ada", "junk")` and `load("Ada", {v: 0})` give empty and don't throw (Review Focus 2);
  - `load("Bea", …)` after Ada clears Ada's places first (Review Focus 3);
  - `record()` round-trips through `JSON.parse(JSON.stringify())` and `load` to equal `places()`;
  - `forget()` empties, and `onChange` fires on ingest, setNote, load and forget.
- [ ] **Step 2: Run** `npx vitest run ui/lib/land-store.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement `ui/lib/land-store.js`.**
- [ ] **Step 4: Run** the test again. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(land): keep the walked places, notes and routes"`

---

### Task 5: Zennor's outline in the data, and the board's layout

**Files:**
- Create: `scripts/source/land.mjs`, `scripts/source/land.test.mjs`
- Modify: `scripts/build-data.mjs`:
  - read `content/game/land.yaml` alongside the other sources (the list near line 43);
  - write `ui/data/land.js` with `moduleText` (near line 455);
  - add `land.js` to `INDEXES`;
  - extend `scripts/build-data.test.mjs` for the new file.
- Create (generated): `ui/data/land.js`
- Create: `ui/lib/land-layout.js`, `ui/lib/land-layout.test.js`

**Interfaces:**
- `land.mjs`: `landData(yaml) -> { [world]: { from, town: [{e, n}], joins: { [joinId]: { at: {e, n}, room } } } }`, from `lands[]`.
  - `town` is the outline of the stroke with `kind: town`.
  - Today that gives `ui/data/land.js` = `{ tamsin: { from: "zennor", town: [{e:-4,n:6}, {e:4,n:6}, {e:4,n:-7}, {e:-4,n:-7}], joins: { "carn-bridge": …, "terrace-road": …, downs: … } } }`.
  - Latitude needs no new data: it's `zennor.latitude` (40) in `ui/data/sky.js` already. Longitude changes nothing on a globe with no day and night (spec, top band), so it isn't added. This is a correction to the spec's "added by build:data"; note it in the commit message.
- `land-layout.js`:
  - `CELL = 1.2`.
  - `layoutLand(places: Place[], world: {town, joins}) -> Layout`, where `Layout` is:
    - `cells: Map<id, {i, j, x, y}>` (x, y = i·CELL, j·CELL);
    - `ways: Way[]`;
    - `corners: {x, y}[]` (diagonal squares to draw, once each);
    - `stubs: {id, dir, x1, y1, x2, y2}[]`;
    - `zennor: { outline: {x, y}[], roads: {id, x1, y1, x2, y2}[] }`;
    - `labels: { text, kind: "region"|"track", x, y, angle }[]`.
  - `Way = { a, b, kind: "door"|"diagonal"|"bend"|"long", track: string|null, oneWay: boolean, path: string, chevron?: {x, y, angle} }`. `path` is SVG path data in km with y flipped (svg y = −north), ready for `<path d>`.
  - `octagon(x, y) -> string`, the path for a cell's octagon in the same units.
  - `faceMid(cell, dir) -> {x, y}`.

Layout rules (values from the spec, "Drawing the board"):

- **Cells.** Places take cells in `places()` order: `i = round(x / CELL)`, `j = round(y / CELL)`. If the cell is taken, the place takes the nearest free cell by distance to its true spot. Ties go to the lower `i`, then the higher `j`.
- **Ways.** There is one way per unordered pair of walked places with an exit between them.
  - `oneWay` is true when no exit leads back.
  - Neighbours (Chebyshev distance 1) that agree give `door` (side) or `diagonal` (corner). They agree when the leaving exit's dir equals the compass point from cell a to cell b, and so does the exit back if there is one.
  - Neighbours that disagree give `bend`. Its cubic runs from `faceMid(a, exitDir)` to `faceMid(b, arriveDir)`. Each control point is 0.85 × CELL/2 out along its face's normal. `arriveDir` is the exit back's dir, or the opposite of `exitDir` on a one-way way.
    - Track bends add middle→face at both ends.
    - Plain bends add a quarter-way spur at both ends.
    - A bent diagonal adds no corner square.
  - Anything farther apart is `long`: face to face, by the same leave/arrive dirs, straight.
  - `track` is X when both places have `trackOf` X, or when one is a road end (`.join.`) and the other is on X.
  - `chevron` is set on one-way ways. It sits at the path's middle, with `angle` pointing from a to b.
- **Corners.** A `diagonal` way puts its corner square's centre, (a + b)/2, in `corners`, deduplicated.
- **Stubs.** One per exit whose target isn't walked and has no `area`, or whose `area` starts with `surface.`. It runs 0.45 km out from `faceMid` along the face normal. An exit with any other `area` (Zennor) is never a stub (Review Focus 5).
- **Zennor.**
  - The outline is `town` mapped `{x: e, y: n}`, then flipped.
  - There is one road per walked road end whose id is `surface.<world>.join.<joinId>` and which has an exit with a non-`surface.` area. The road runs from that exit's `faceMid` to the nearest point on the outline.
- **Labels.**
  - A region label sits at the mean of its walked places. It is upright (`angle` −90) when the walked extent is taller than wide; otherwise `angle` is 0.
  - A track label sits at the middle of the track's longest walked way, at that way's angle, kept within −90..90.

- [ ] **Step 1: Write the failing tests.**
  - `land.test.mjs`: `landData` on a small YAML string gives `town` and `joins`, and a land with no town gives `town: []`.
  - `build-data.test.mjs`: the generated `land.js` has `tamsin.town` with 4 points.
  - `land-layout.test.js`:
    - nine places in a 3×3 grid, each joined to all eight neighbours both ways with agreeing dirs, give 20 ways: 12 `door`, 8 `diagonal`, 4 corners, and no `bend`. The data comes from `/tmp/land-scripts/nine-data.mjs`; copy its `make(false)` grid into the test as plain objects.
    - a `southwest` exit to a place whose cell is straight south gives one `bend`, and its path starts at `faceMid(a, "sw")`;
    - two places rounding to the same cell: the second takes a neighbouring free cell. Loading `record()` into a fresh store and laying out again gives identical `cells` (Review Focus 4);
    - an exit with no back gives `oneWay` and a `chevron`;
    - an unwalked target gives a stub 0.45 long. An exit with `area: "zennor"` gives no stub, and a road from a walked `join.downs` (Review Focus 5);
    - two places on "the Tinners' Track" joined give `track: "the Tinners' Track"`, and a road end joined to one also does;
    - a place on the Downs gives a "the Downs" region label.
- [ ] **Step 2: Run** `npx vitest run scripts/source/land.test.mjs ui/lib/land-layout.test.js scripts/build-data.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement `land.mjs`, the build-data wiring and `land-layout.js`.** Then run `npm run build:data` and check that `git diff ui/data` shows only the new `land.js`.
- [ ] **Step 4: Run** the tests again. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(land): Zennor's outline in the data, the board's layout"`

---

### Task 6: Drawing the board

**Files:**
- Modify first: `docs/maps/style-guide.md`:
  - a §1 row for the land's map;
  - a new §4.2 table "On the land's map" with the twelve group colours and the texture line colours/opacities taken from `land-picked-mockup.html`;
  - the corner square `#1a1511`, Zennor's block `#16120f`.
- Create: `ui/land-deck.js`, `ui/land-deck.test.js` (`// @vitest-environment happy-dom`)
- Create: `ui/lib/land-patterns.js` (pure: group → `{fill, pattern?: {w, h, svg}}`), tested in `ui/lib/land-patterns.test.js`

**Interfaces:**
- Consumes:
  - Task 2: `groupOf`.
  - Task 4: `LandStore`.
  - Task 5: `layoutLand`, `octagon`, `CELL`, `ui/data/land.js`.
  - From `ui/lib/svg.js`: `el`, `glowFilter`, `pulse`, `attachPanZoom`, `zoomButtons`.
- Produces: `class LandDeck`, with:
  - `constructor(deckEl, world)`. `world` is the `tamsin` entry of `ui/data/land.js`.
  - `.div`.
  - `draw(store)`. It redraws everything from `store.places()` and `store.here`.
  - `home()`. It centres on you at 26 px per km.
  - `follow()`. It re-centres only when your octagon is outside the middle half of the view.
  - `show(bool)`.
  - `svg` (for tests).
  - `[data-place=id]` on each octagon's group.

Draw order, bottom to top:

1. Ground `#110e0b`.
2. Zennor's block (`#16120f`, dashed Stone edge, "ZENNOR" in Dim spaced capitals) and its roads in Earth.
3. Corner squares.
4. Octagons: the group fill, then the pattern in screen pixels (`patternUnits="userSpaceOnUse"`, rescaled on zoom so the texture stays one size), drawn 2 px under full size with a 1.2 px Stone edge.
5. Track edges (Stone 0.22 + 4 px, dashes 4/3), then the track bands (Earth 0.22).
6. Doors (Earth bar 0.24 × 0.2 across the face), diagonals (Earth 0.1), and bends and long ways (Earth 0.13).
7. Stubs (Dim, 1.6 px, dash 0.1/3.4, round caps).
8. Chevrons (`#cfd8e3`, 2.2 px, ~0.22 tall).
9. Note marks: a folded corner, Dim, top right inside the octagon.
10. Labels (Dim italic, spaced).
11. Your octagon (amber `#ffb347` fill .3, stroke 3, `glowFilter`, `pulse`).
12. Chrome: N ▲ top left; + − ⌂ via `zoomButtons`.

Match `land-picked-mockup.html` by eye.

- [ ] **Step 1: Update the style guide** with the colours above, as its own edit before any code.
- [ ] **Step 2: Write the failing tests:**
  - `land-patterns` gives a fill for every group in `GROUPS`, and a pattern for every group except open and road;
  - `LandDeck.draw` on two walked places and one unwalked exit gives:
    - two `[data-place]`;
    - one dotted stub;
    - no text anywhere containing the unwalked id or a digit, except in the chrome (Global Constraints);
  - only one element has the glow filter, and it's on `store.here`'s octagon;
  - a Zennor `land.js` draws the "ZENNOR" text.
- [ ] **Step 3: Run** `npx vitest run ui/land-deck.test.js ui/lib/land-patterns.test.js`. Expected: FAIL.
- [ ] **Step 4: Implement `land-patterns.js` and `land-deck.js`.**
- [ ] **Step 5: Run** the tests. Expected: PASS.
- [ ] **Step 6: Screenshot check.** Render a dev page that draws `walk3.json`'s places (`/tmp/land-scripts/walk3.json`, the test walk) and screenshot it with WebKit, as in [[webkit-screenshots]]. Compare it side by side with `land-picked.png`, then fix any gaps.
- [ ] **Step 7: Commit.** `git commit -m "feat(land): draw the walked land as a board of octagons"`

---

### Task 7: Finding your way, notes and forgetting

**Files:**
- Modify: `ui/land-deck.js`
- Create: `ui/lib/land-route.js` (pure helpers), `ui/lib/land-route.test.js`
- Test: `ui/land-deck.test.js` (more cases)

**Interfaces:**
- Consumes: Task 4 `store.route`, `store.setNote`, `store.forget`; Task 5 `layoutLand` output.
- Produces:
  - `land-route.js`:
    - `routePath(ids, layout) -> string`, the dashed line through the cells' middles, following the ways' own paths;
    - `nearestRoadEnd(store, fromId) -> string|null`, the walked `.join.` place with the shortest route;
    - `edgeCard(view: {x, y, w, h}, zennorBox) -> {x, y, side}|null`, null when any of Zennor's block is in view.
  - On `LandDeck`:
    - `onNote(fn(id, text|null))`;
    - `onForget(fn())`;
    - `target: string|null`;
    - `draw(store)` redraws the route from `store.here` to `target` whenever both exist, and clears `target` on arrival.

Behaviour (spec, "Finding your way" and "Notes and forgetting"):

- **Click** a walked place to set `target` and show:
  - the route (dashed amber 1.5 px at .75, no glow);
  - the target's dashed amber outline;
  - the card "<name>" / "N steps the way you know".

  Clicking the target again, clicking empty ground, or pressing Esc clears it. A click is a press that doesn't pan, as `attachPick` does.
- **Hover** a place: a card with its name and note.
- **Right-click** a place: menu "Note…" (an inline text input in the hover card; Enter saves, Esc cancels) and "Remove note" (only with a note). Right-click empty ground: "Forget this land…", then one confirm, then `onForget`.
- **"← Zennor":** a card on the view's edge toward Zennor when `edgeCard` isn't null. Clicking it sets `target` to `nearestRoadEnd`.
- **No route:** when there's no route (the place was reached one-way), the card says the name and "No way back you know"; that wording is my call.

- [ ] **Step 1: Write the failing tests:**
  - `routePath` over three ids has three points;
  - `nearestRoadEnd` picks the nearer of two walked road ends by steps, not by distance;
  - `edgeCard` is null with Zennor's box in view, and gives side "left" with Zennor to the west;
  - in `land-deck.test.js`:
    - a click on a place adds one route path and a card whose text includes "2 steps the way you know";
    - Esc removes both;
    - right-click "Note…" calls `onNote`;
    - "Forget this land…" calls `onForget` only after the confirm;
    - the "← Zennor" card routes to a road end.
- [ ] **Step 2: Run** `npx vitest run ui/lib/land-route.test.js ui/land-deck.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers and the interactions.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(land): routes to any walked place, notes, forgetting, the way home"`

---

### Task 8: Tamsin from above

**Files:**
- Create: `ui/land-globe.js`, `ui/land-globe.test.js` (happy-dom)

**Interfaces:**
- Consumes:
  - `faceOf("tamsin")` from `ui/lib/worlds.js`;
  - `stars`, `el`, `glowFilter`, `rng` from `ui/lib/svg.js`;
  - `ui/data/sky.js` `zennor.latitude`.
- Produces: `class LandGlobe`, with:
  - `constructor(modelEl, { latitude })`;
  - `.div`;
  - `set(coords: {x, y})`;
  - `show(bool)`.

The globe is a whole low-poly globe on seeded stars:

- **Facets.** Facets in `faceOf("tamsin")` colours: ground, and sea on 15%, seeded so they're the same every time.
- **Light.** Lit from a fixed upper-left light, with no day and night.
- **Turn.** Turned so your spot sits a little north of the middle. Your spot is at latitude 40° plus `y`/R and longitude `x`/R. R is the globe's radius in km; take Tamsin's radius from `ui/data/worlds.js`, else a fixed value.
- **Your spot.** Amber with a 2.4 px ring and `glowFilter`.
- **No text.** There are no labels.

The drawing reference is the top band of `land-picked-mockup.html`.

- [ ] **Step 1: Write the failing tests:**
  - it draws one glowing spot;
  - it has no `<text>`;
  - facets are the same on two builds;
  - `set` with `x` moved 30 km moves the spot by less than 2 px.
- [ ] **Step 2: Run** `npx vitest run ui/land-globe.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(land): Tamsin from above in the top band"`

---

### Task 9: Showing the land in the panel, and the docs

**Files:**
- Modify: `ui/main.js` (imports; the `render()` branch; handlers for `land-room` and `land-load`; the debounced `land-save`)
- Create: `ui/lib/land-choose.js`, `ui/lib/land-choose.test.js`
- Create: `docs/maps/land.md`
- Modify: `docs/maps/sync.md`, `README.md`

**Interfaces:**
- Consumes: Task 3 messages; Task 4 `LandStore`; Task 6–7 `LandDeck`; Task 8 `LandGlobe`; `ui/data/land.js`; `ui/data/sky.js`.
- Produces: `landShown(msg) -> boolean` in `ui/lib/land-choose.js`. It is true when `msg?.area` is a string starting with `"surface."`.

In `main.js`:

- **Building.** One `LandStore`. A `LandDeck` and a `LandGlobe` are built on the first land location; until then nothing is built.
- **`render()`.** Before the station branches: if `landShown(last)`, then:
  - `show(undefined)` the station models;
  - `showDeck(null)`;
  - hide `unknown`;
  - show the land views and `runShip()`;
  - set `info.textContent = last.name`;
  - return.

  Leaving the land hides them again, and Zennor's maps come back as now.
- **`land-room`.** `store.ingest(msg)`, then `deck.draw(store)`, `deck.follow()` and `globe.set(msg.coords)`.
- **`land-load`.** `store.load(msg.who, msg.record)`, then redraw.
- **Saving.** `store.onChange` → a debounced (1 s, as the automapper's) `panel.post("land-save", { who: store.who, record: store.record() })`. It is skipped while `store.who` is null.
- **Deck events.** `onNote` → `store.setNote`; `onForget` → `store.forget()`.

- [ ] **Step 1: Write the failing test.** `landShown({area: "surface.tamsin"})` is true, and `({area: "zennor"})`, `(null)` and `({})` are false.
- [ ] **Step 2: Run** `npx vitest run ui/lib/land-choose.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `land-choose.js` and the `main.js` wiring.
- [ ] **Step 4: Run the full suite:** `npm test`. Expected: PASS, both vitest and Lua.
- [ ] **Step 5: Check it in the real panel.** Use the `run` skill, or a WebKit screenshot of the panel fed recorded frames:
  - walk from Zennor's road end out three places and back;
  - see the board, the globe and the info line;
  - see the route on click;
  - see the map come back after a reload.
- [ ] **Step 6: Write the docs.**
  - `docs/maps/land.md`: what the map shows and where its data comes from (sections as the spec's "Design").
  - `docs/maps/sync.md`: a step saying that when the `land-kinds` game check fails, the new title goes in a group (tell John if none fits); and look for land on a new world in `content/game/land.yaml`.
  - `README.md`: one line for the land's map.
- [ ] **Step 7: Commit.** `git commit -m "feat(land): show the walked land's map on Tamsin"`
