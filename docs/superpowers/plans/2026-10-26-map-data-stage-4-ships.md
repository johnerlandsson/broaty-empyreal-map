# Map data from source, stage 4: ships from cells, and your own ship in the top band — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- **Every hull the game has is drawn by the decks builder** from generated data: the freighter and the tug from their plans, the skiff and the courier as one-cell ships. Each one's look comes from tweak files, and `ui/lib/hulls.js` is retired.
- **Undocked aboard your own ship** (or one you crew), the top band shows her 3D model in front of today's space scene, with your room lit.

**Architecture:**
- **The build:** it already reads `content/plans/*.yaml` and `hulls.yaml`. It now writes `ui/data/plans/<plan>.js`, in the same generated shape as a place (`kind: "plan"`). A hull with no plan gets a synthesised one-room plan `hull-<id>`. It also writes `ui/data/ships.js`: the hull → plan index plus static imports, as `places.js` does for places.
- **Ship looks:** they are tweak files (`data/tweaks/<plan>.json`, `data/tweaks/hull-<id>.json`). They use the stage 2 keys (`hull`, `footprints`, `paint`, `fixtures`, `view`) plus new ship fixture types, which John picks from a mockup first.
- **The bottom band's ship plan** is `buildPlace` with the decks builder. Runtime room ids `ship.<n>.<key>` map to plan rooms by `<key>`.
- **The top band:** a `ModelView` of your ship sits over `SpaceView`'s canvas while a space scene is showing.

**Tech Stack:** Node ESM, vitest 2 with happy-dom, plain browser ES modules, Lua (unchanged unless a task says so).

**Spec:** `docs/superpowers/specs/2026-10-26-map-data-from-source-design.md`. Read "Ships built from cells, and your own ship in the top band", "The generated files", "Tweak files" (hull, footprints, fixtures) and "Stages".

**John's decisions:**
- **Own-ship band:** option 2 in `docs/maps/reference/own-ship-band-options.png`. Today's scenes stay, with your ship's model in front and your room lit.
- **Docked at another ship's collar** (2026-10-26): your own ship is in front, over the scene of wherever the host is.
  - Drawing the host with your ship at her collar would need the host's class, which GMCP's `Ship.Status.host` doesn't send.
  - That's for Natalie to decide. Don't change the server. Task 9 drafts the request for John.
- **Hulls without a plan** (skiff, courier) get a one-cell ship with their own tweak file (`hull-<id>.json`), rebuilding today's drawings. A mockup comparing them with today's goes to John before `hulls.js` is retired.
- **Ships are built from cells,** provided room sizes and shapes aren't fixed by the cell. Footprints, hull paths and fixtures cover that.

## Global Constraints

- Never write to `~/dev/empyreal`. Never edit generated files by hand. The build never writes `data/tweaks/*.json`.
- The 17 station goldens in `tests/golden/*.txt` must pass untouched. Stations must not change.
- **No spoilers:** from `hulls.yaml` only `id`, `name`, `class` and `plan` are kept; plan rooms keep only the stage 1 room fields. Station-class hulls (`class: station`) aren't ships, so leave them out of `ships.js`.
- Ship room ids at runtime are `ship.<n>.<key>`. A plan room's id is `<plan>.<key>`, and they match by `<key>`.
- One tweak file per plan, or per hull for hulls without a plan (`hull-<id>.json`). Never one per ship.
- The own-ship band shows only aboard your own ship or one you crew. A guest aboard someone else's ship keeps today's behaviour (the last station). In practice: only when a space scene is known for the ship you're aboard, since `Ship.Status`, and so the scene, comes only for those ships.
- The ship caption ("Mule · prospecting skiff"), the info line and your note line under the hull survive the move off `hulls.js`.
- Visual work gets a rendered mockup and John's pick before it's built (Task 2 is a checkpoint).
- Write code that reads like the surrounding code.

## Review Focus

1. **A plan the game adds that nobody has tweaked** (the tug today). It must be built and drawn plain but correct in both bands, and appear in the sync report as a new plan and in the editor under "Ship classes". *Test in Task 1 and Task 6.*
2. **A hull class the plugin doesn't know,** or a ship room key missing from its plan. The bottom band still draws something sensible (the hull's one-cell ship, or the plan with no room lit), with no blank band and no throw. *Test in Task 6.*
3. **A plan id equal to an area id, or `hull-<id>` clashing with a plan or area.** The build stops with a clear message and writes nothing. *Test in Task 1.*
4. **Docking and undocking aboard your own ship.** The station grows out of the stars or shrinks into them behind her while she stays in front. A stopped manoeuvre eases back as today. *Test in Task 7.*
5. **Opening the chart, lanes or belt map while your ship is in the band.** The overlay covers the band, ship included, as it covers the scene today. *Test in Task 7.*

---

### Task 1: The build writes ship plans and the hull index

**Files:**
- Modify: `scripts/build-data.mjs` (plans and hulls are already loaded but not written, around lines 218-223; `generatedIds` and `committedNames` around lines 287-296), `scripts/source/report.mjs` if a plan needs its own list
- Test: `scripts/build-data.test.mjs` (the fixture plan `tub` in `tests/fixtures/empyreal/content/plans/` and its `hulls.yaml`)

**Interfaces:**
- Produces:
  - `ui/data/plans/<plan>.js` in the place shape: `{source, id, name, kind: "plan", gravity, hulls: [hullIds], layout, levels, rooms, look}`, with look resolved from `data/tweaks/<plan>.json`.
  - For each ship hull with no `plan`: `ui/data/plans/hull-<id>.js`, a synthesised plan.
    - Id `hull-<id>`, `layout: {kind: "decks"}`, one room `{id: "hull-<id>.cockpit", name: "Cockpit", address: "Deck 1, frame 1", at: {deck: 1, frame: 1, side: 0}, flags: [], gravity: <the hull's or 1>}`.
    - Its look comes from `data/tweaks/hull-<id>.json`.
    - `source.file` names `content/game/hulls.yaml`.
  - `ui/data/ships.js`: static imports of every plan file, plus `export default {hulls: {<id>: {id, name, class, plan}}}` (`plan` is the generated plan id, `hull-<id>` when synthesised) and `export const plans = {<planId>: data}`. Only hulls whose class isn't `station`.
  - The sync report lists new or removed plans in `newPlaces` / `removedPlaces` (entries carry `kind: "plan"`), and room changes within plans as for places.
  - `generatedIds` and `committedNames` must neither delete nor count `plans/` or `ships.js` as stale area files. A removed plan's generated file is deleted under the same GENERATED-header rule.

- [ ] **Step 1: Write the failing tests** (fixture source in temp dirs):
  - `tub` is written to `out/plans/tub.js` with `kind: "plan"` and the right `hulls`.
  - A fixture hull with no plan gets `out/plans/hull-<id>.js` with one room at Deck 1, frame 1.
  - `ships.js` lists the hulls (not stations) and imports every plan.
  - A second identical build is byte-identical.
  - **Review Focus 1:** a new plan appears in `newPlaces` with `kind: "plan"`.
  - **Review Focus 3:** a plan id equal to an area id, or `hull-x` equal to a plan id, stops the build naming both, and nothing is written.
  - `places.js` is unchanged by plans.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement. Reuse the area path (`placeRooms`, `keepRoom`, `resolveLook`) for plans; the layout kind is the plan's.
- [ ] **Step 4:** Run `npx vitest run scripts`, then `npm test`. Run `npm run build:data` for real. Expected: `plans/freighter.js`, `plans/tug.js`, `plans/hull-skiff.js`, `plans/hull-courier.js` and `ships.js` appear, and station files are unchanged apart from any real source change. If `~/dev/empyreal` has moved on, the report says why. Commit the generated files and `data/sync-report.json` with the code.
- [ ] **Step 5:** Commit with `feat(build): ship plans and the hull index`.

### Task 2: Mockups — today's ships rebuilt from cells (checkpoint)

**Files:**
- Create: `docs/maps/reference/ships-from-cells-mockup.html`, `docs/maps/reference/ships-from-cells-options.png`

- [ ] **Step 1:** Build a throwaway page, served over http like the earlier mockups (see `docs/maps/reference/hull-path-mockup.html`). For each of skiff, courier and freighter, and the tug, it shows:
  - **(a)** today's plan from `ui/lib/hulls.js`, drawn through `ui/ship-deck.js`;
  - **(b)** the same ship from its generated plan (Task 1), drawn by the real decks builder, with a hand-made look: a `hull` path tracing (a)'s outline, `footprints` giving each room (a)'s proportions, and `fixtures` for (a)'s drawn parts;
  - **(c)** (b)'s 3D overview at the panel's top-band size.

  The tug has no (a); show its plain generated drawing and one tweaked version.
- [ ] **Step 2:** Today's drawings have parts the current fixture types (`blister`, `cradle`, `mast`, `drum-cradle`) can't express:
  - the skiff's laser boom, crates and drive bells;
  - the courier's seats, bulkhead, bolted-over slot, drive core and bells;
  - the freighter's crates and drive bells, the collar's yellow chevrons, and the cockpit nose.

  Propose new fixture types, drawn in the mockup with code you write in the page, and put each proposal's JSON shape in a caption under the drawing:
  - **outside the hull:** `bell`, `boom`;
  - **inside a room, plan only:** `prop` with a `kind` of crate, seat, core, bulkhead or slot;
  - **a ring on a room:** `chevrons`.

  Also give at least one variation where it matters, e.g. bells as cones versus flat discs in 3D.
- [ ] **Step 3:** Render to PNG with headless chromium, look at it yourself, and fix anything off.
- [ ] **Step 4:** Commit with `docs: ships from cells, options`.
- [ ] **Step 5: STOP.** The controller takes the PNG to John and records his pick: which fixture types, their shapes, and any changes. Tasks 3–5 use it.

### Task 3: Ship fixture types

**Files:**
- Modify: `scripts/source/schema.mjs` and `tweaks.mjs` (fixture types and fields), `scripts/source/footprints.mjs` (inside or outside the hull checks for the new types), `ui/lib/decks.js` (model), `ui/decks-deck.js` (plan)
- Test: `scripts/source/tweaks.test.mjs`, `ui/lib/decks.test.js`

**Interfaces:**
- Consumes: John's pick (end of Task 2): the fixture types and their exact fields.
- Produces: the picked types validated by the build (unknown fields are errors) and drawn by the decks builder in the plan and, where the pick says so, in the model. Room-bound types (`prop`, `chevrons`) are keyed by local room id, and they are orphans when the room is gone.

- [ ] **Step 1: Write the failing tests:**
  - each type validates (good and bad fields);
  - each draws the expected elements: a plan group with the right shape count, and model faces for 3D types;
  - an orphan room-bound fixture is reported.
  - The station goldens are untouched.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run tests/golden scripts ui`, then `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(decks): ship fixtures`.

### Task 4: Tweak files for every ship, and the side-by-side check

**Files:**
- Create: `data/tweaks/freighter.json`, `data/tweaks/hull-skiff.json`, `data/tweaks/hull-courier.json` (and `tug.json` if John's pick tweaks the tug)
- Modify: `docs/maps/reference/ships-from-cells-mockup.html` (a final row drawn from the real generated data)

- [ ] **Step 1:** Write the tweak files from the picked mockup's look (hull paths, footprints, paint, fixtures, view). Make the cockpit nose and the collar chevrons match the pick.
- [ ] **Step 2:** Run `npm run build:data`. Expected: the ship plans gain their look, the report shows no orphans, and the station files are unchanged.
- [ ] **Step 3:** Render today's `hulls.js` drawings beside the real generated ones (plan and 3D) in the mockup page, and save `docs/maps/reference/ships-from-cells-final.png`.
- [ ] **Step 4: STOP.** The controller shows John the final PNG. Task 6 retires `hulls.js` only after he says the new drawings are right.
- [ ] **Step 5:** Commit with `data: ship looks as tweak files`.

### Task 5: Ship captions, info line and note, off `hulls.js`

**Files:**
- Create: `ui/lib/ships.js`, `ui/lib/ships.test.js`
- Modify: `ui/lib/contacts.js` (its own `HULLS` names map duplicates the hull names)

**Interfaces:**
- Consumes: `ui/data/ships.js` (Task 1).
- Produces:
  - `isShipRoom(id)` (as today);
  - `shipKey(roomId): string | null` (`ship.42.hold` → `hold`);
  - `hullFor(hullId): {id, name, class, plan}` (an unknown hull falls back to a synthesised `generic` entry whose plan is the one-cell `hull-skiff` look);
  - `planFor(hullId): data`;
  - `shipCaption(msg)` and `shipInfo(msg)` (as today).

  `contacts.js` reads hull names from `ships.js`.

- [ ] **Step 1: Write the failing tests:**
  - every function, ported from `ui/lib/hulls.test.js`;
  - an unknown hull id gives the generic one-cell plan;
  - `shipKey("ship.42")` is null, and `shipKey("ship.42.cockpit")` is `cockpit`;
  - contacts' names match `hulls.yaml`'s.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run ui`, then `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(ui): ships read from the generated hull index`.

### Task 6: The bottom band's ship plan from cells; `hulls.js` retired

**Files:**
- Modify: `ui/main.js` (the ship branch, around lines 171-177 and 211-216), `ui/ship-deck.js` (becomes the caption and note overlay on a decks plan, or is folded into `place-views.js`), `ui/place-views.js` (a ship entry point), `dev/preview.js` (the `?hull=` scenarios)
- Delete: `ui/lib/hulls.js`, `ui/lib/hulls.test.js` (after John's OK at the end of Task 4)
- Test: `ui/place-views.test.js`, a new `ui/ship-view.test.js` (happy-dom)

**Interfaces:**
- Consumes: `planFor`, `shipKey`, `shipCaption` (Task 5), and `buildPlace(data, "decks", …)`.
- Produces:
  - `buildShip(plan, modelEl, deckEl, opts)`: `buildPlace` for a plan, whose `locate(index, msg)` maps a runtime `ship.<n>.<key>` room to `<plan>.<key>`, and `deck` shows the caption and note under the hull as today.
  - `main.js` caches ship views by plan id.

- [ ] **Step 1: Write the failing tests:**
  - aboard a freighter (`roomId: "ship.42.hold"`, `hull: "freighter"`), the plan lights `freighter.hold` and shows the caption "Full Measure · medium freighter" and the note;
  - aboard a skiff, the one-cell ship lights its cockpit;
  - **Review Focus 1:** aboard a tug (no tweaks), the plain tug plan draws and lights the room;
  - **Review Focus 2:** an unknown hull, or a key missing from the plan, draws the plan with nothing lit, with no throw and no blank band.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Then delete `hulls.js` and its test once John has approved Task 4's final PNG; the controller says so in the dispatch.
- [ ] **Step 4:** Run `npx vitest run tests/golden ui dev`, then `npm test`. Open `dev/preview.html?hull=freighter` (and skiff, courier) in headless chromium, and compare it with `ships-from-cells-final.png`.
- [ ] **Step 5:** Commit with `feat: ship plans drawn from cells; hulls.js retired`.

### Task 7: Your own ship in the top band

**Files:**
- Modify: `ui/main.js` (show and hide the ship model with the scene, around `show()` and the `scene` and `manoeuvre` handlers), `ui/model-view.js` (a transparent mode without the backdrop and stars, if not already an option), `ui/map.css` (z-order: ship model at 3.5, between the scene canvas at 3 and the overlays at 4)
- Test: `ui/own-ship.test.js` (happy-dom), and `dev/preview.js` scenarios (`?scene=belt&hull=freighter`, and so on)

**Interfaces:**
- Consumes: `buildShip` (Task 6), `SpaceView` (`set`, `setManoeuvre`, `onAway`), and the chart, lanes and belt overlays.
- Produces:
  - Aboard a ship room, and while the scene is a space scene (not `station`, not null), a ship `ModelView` for her plan is shown in the top band.
    - It sits over the canvas, transparent, framed in the band's lower middle as in the approved mockup.
    - It lights your room, cut away as its view says.
  - It hides when the scene is `station` (docked: the station shows as now), when you leave the ship, or when an overlay is on.
  - **Guest aboard someone else's ship:** no scene, so there's no ship model and today's behaviour stands.
  - **Docked at a host ship:** your ship over the host's scene. Nothing special is needed, because `scene` already follows the host.

- [ ] **Step 1: Write the failing tests:**
  - a freighter room with `scene: "belt"` shows the ship model (faces keyed `freighter.*`) with the hold lit;
  - `scene: "station"` hides it;
  - **Review Focus 5:** chart on hides it, and chart off shows it again;
  - **Review Focus 4:** an undock manoeuvre keeps the ship shown while `setAway` runs on the station model behind;
  - a guest (no scene) shows no ship model.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run tests/golden ui`, then `npm test`. Render `dev/preview.html?scene=belt&hull=freighter` and `?scene=port-day&hull=skiff`, and an undock (`?manoeuvre=undock-tiss&hull=skiff`), in headless chromium. Compare them with `docs/maps/reference/own-ship-band-options.png` option 2, and look at the PNGs.
- [ ] **Step 5:** Commit with `feat: your own ship in the top band`.

### Task 8: Ship classes in the editor

**Files:**
- Modify: `dev/edit-server.mjs` (state lists ship plans; the save flow works the same for plan tweak files), `dev/editor/main.js` (the rail's "Ship classes" lists plans by hull name, and opens a plan with `buildShip`), `dev/editor/panel.js` and `dev/editor/handles.js` (the new fixture types' handles where they have a position)
- Test: `dev/edit-server.test.mjs`, `dev/editor/main.test.js`, `dev/editor/handles.test.js`

- [ ] **Step 1: Write the failing tests:**
  - the rail lists the freighter, the tug, the skiff and the courier under "Ship classes";
  - opening the freighter shows its plan and overview;
  - a paint change PUTs `freighter.json`;
  - a bell or boom handle drag PUTs its new position.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run dev`, then `npm test`. Do a live check on a /tmp copy (the `/tmp/t6-shot/shot.mjs` pattern): open the freighter, move a bell, and look at the result.
- [ ] **Step 5:** Commit with `feat(editor): ship classes`.

### Task 9: Docs, and the note for Natalie

**Files:**
- Modify: `docs/maps/ship-plans.md` (rewrite for cells), `docs/maps/sync.md` (plans and hull tweak files), `docs/maps/editor.md` (ship classes), `README.md` (the "Out in your ship" section: your ship in the top band)
- Create: `docs/maps/requests/host-class.md`, the draft for John to send to Natalie

- [ ] **Step 1:** Document ship plans, hull files, the new fixture types and the own-ship band. Remove the `hulls.js` references.
- [ ] **Step 2:** Write `host-class.md`: a short, plain request to add `class` to `Ship.Status.host` (`docs/gmcp.md` §8.2 in empyreal). Say why: so a map can draw the host with your ship at her collar. Say that it reveals nothing hidden, because a hull's class is already shown in-game.
- [ ] **Step 3:** Run `npm test`. Expected: PASS.
- [ ] **Step 4:** Commit with `docs: ships from cells, and your ship in the top band`.
