# Map data from source, stage 2: footprints, fixtures and view settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A decks place's tweak file can reshape how a room is drawn (span, corners, outline), and any place's tweak file can set how its overview behaves (cutaway, camera home). The decks builder reads its look straight from the generated file, and every place stays exactly as it draws today until someone sets a tweak.

**Architecture:**
- **Validation:** the tweak schema gains `footprints` and `view`. The build validates them, checks for footprint overlaps, and writes them into `look`, filling in each layout kind's view defaults.
- **One outline per room:** a pure module turns a room's footprint into one outline in cell units. The decks 3D model and the decks plan both draw from that outline, each at its own scale, so they can't disagree.
- **Overview behaviour:** `ModelView` takes the place's view (cutaway mode, camera) as options, in place of today's fixed constants.
- **Adapters:** the decks adapter `decksSpec` is retired, and the decks builder reads `look` itself. The drum, town and wheel adapters stay.

**Tech Stack:** Node ESM, vitest 2, happy-dom (goldens), plain browser ES modules in `ui/`.

**Spec:** `docs/superpowers/specs/2026-10-26-map-data-from-source-design.md` (approved 2026-10-26). Read "Tweak files" (footprints, fixtures, the view section) and "Stages" (stage 2). Stage 1's plan, `docs/superpowers/plans/2026-10-26-map-data-stage-1-build-for-stations.md`, and `docs/maps/sync.md` describe the build this extends.

## Scope (decided for this plan; John may overrule)

- **In:** decks footprints (span, corners, outline) in the model and the plan; the decks builder reading `look.fixtures` directly; the view section's `cutaway` (`off`, `hide-above`, `ghost-above`) on decks places; `camera` (yaw, pitch, zoom) on every place's overview.
- **Deferred, my call:**
  - Wheel footprints (arc and depth) and a wheel cutaway. T.I.S.S. is the only wheel; nothing asks for them yet; its drawing is bespoke and stage 4's ships are decks. When a wheel ship or a wish for T.I.S.S. turns up, they come with their own mockups.
  - Drum and town footprints, for the same reason.
  - Ship fixtures (bells, booms, collar, nose). They arrive with stage 4.
- **Visuals first.** How a reshaped room and a ghosted deck look gets two or three rendered options and John's pick before it's built (Task 3). That's a checkpoint: the controller stops there.

## Global Constraints

- Never write to `~/dev/empyreal`. Never edit generated files by hand; `npm run build:data` writes them. The build never writes `data/tweaks/*.json`.
- A footprint is how a room is drawn, never where it is: a room's cell (its address) never moves.
- Every place without a `footprints` or `view` tweak draws exactly as today. The 17 golden files in `tests/golden/*.txt` must pass untouched in every task. Never re-record them in this plan.
- Footprint units are cells, with the room's own cell from −0.5 to 0.5 on each axis: x across (port −, starboard +) and y along (aft −, fore +).
- `span` keys are `fore`, `aft`, `port`, `starboard`: non-negative numbers of cells. `corners` is one of `square`, `rounded`, `cut`. `outline` is a list of at least 3 `[x, y]` points in cell units, and it replaces span and corners.
- `view.cutaway` is one of `off`, `hide-above`, `ghost-above`. `view.camera` is `{yaw, pitch, zoom}`: degrees, degrees, and a multiplier on the framed view. Today's camera is yaw 16 and pitch 38 (`CAM` in `ui/lib/geometry.js:34`), at zoom 1.
- View defaults per layout kind are today's behaviour: decks `{cutaway: "hide-above"}`; wheel, drum and town `{cutaway: "off"}`. The camera defaults to `CAM` with zoom 1.
- Unknown keys or values in a tweak file are a build error naming the file and key path, as in stage 1.
- `ui/` stays plain browser ES modules and never imports `data/`.
- Write code that reads like the surrounding code.

## Review Focus

1. **Two reshaped rooms overlapping,** or a room's span reaching into another room's cell. The build must stop with an error naming both rooms and the tweak file, not draw them on top of each other. *Test in Task 1.*
2. **A span that reaches past the hull's box** (e.g. the nose room spanning fore). The hull must grow to take it, on the model and on the plan's footprint plate, and the cradles fore of the nose must stay clear of it. *Test in Task 4.*
3. **The player's highlight in a reshaped room** has to follow the new outline on both the plan and the model. A highlight still drawn as the old cell box is the bug most likely to be noticed. *Test in Task 4.*
4. **An `outline` with points far outside the cell, or crossing itself.** The build must reject points outside −1.5…1.5 cells and self-crossing outlines, naming the room. *Test in Task 1.*
5. **A camera tweak on T.I.S.S., which turns.** Its turning (which hour faces the camera) must still bring the player's hour to the front under the new yaw and pitch. *Test in Task 6.*

---

## File Structure

```
scripts/source/tweaks.mjs        + footprints and view in the schema, values checked, look.footprints and look.view
scripts/source/footprints.mjs    overlap check for decks footprints at build time (uses ui/lib/footprint.js)
ui/lib/footprint.js              outlineOf(footprint) -> polygon in cell units; bounds; the corner shapes
ui/lib/decks.js                  indexDecks/buildDecksModel/decksLayout read look (fixtures, footprints), not decksSpec
ui/decks-deck.js                 plan rooms drawn from their outlines
ui/model-view.js                 opts.view: cutaway mode and camera
ui/lib/geometry.js               camera(cam) -> {project, front}; project and FRONT stay as camera(CAM)'s
ui/lib/look.js                   decksSpec removed
docs/maps/reference/footprints-mockup.html + footprints-options.png   (Task 3)
docs/maps/sync.md, docs/maps/decks-stations.md                         (Task 7)
```

---

### Task 1: Footprints and view in the tweak schema and the build

**Files:**
- Modify: `scripts/source/tweaks.mjs` (schema constants, validation, `resolveLook`), `scripts/build-data.mjs` (call the overlap check)
- Create: `scripts/source/footprints.mjs`, `scripts/source/footprints.test.mjs`, `ui/lib/footprint.js`, `ui/lib/footprint.test.js`
- Test: `scripts/source/tweaks.test.mjs`, `scripts/build-data.test.mjs`

**Interfaces:**
- Produces:
  - `outlineOf(fp: {span?, corners?, r?, outline?} | undefined): number[][]`, in `ui/lib/footprint.js`. It returns the polygon in cell units, counter-clockwise. With no footprint it's the unit square `[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]]`. `rounded` gives each corner a quarter circle of 4 segments with radius `r` (default 0.2 cells); `cut` gives each corner a 45° chamfer of `r`.
  - `boundsOf(points): {x0, x1, y0, y1}`
  - `overlaps(rooms: {id, cell: {x, y, z}, fp}[]): [idA, idB][]`, in `scripts/source/footprints.mjs`. Same-deck pairs whose outlines (offset by their cells) overlap in area. Touching edges don't count.
  - `look.footprints`: `{[localId]: footprint}`, as written in the tweak files (inheritance as for `paint`).
  - `look.view`: `{cutaway, camera?}`, the kind default merged with the tweak's `view`.

- [ ] **Step 1: Write the failing tests.**
  - `outlineOf()` is the unit square.
  - `outlineOf({span: {aft: 1}})` has bounds `{x0: -0.5, x1: 0.5, y0: -1.5, y1: 0.5}`.
  - `outlineOf({corners: "cut"})` has 8 points, and its bounds are still the unit square.
  - `outlineOf({corners: "rounded"})` has 16 points.
  - `outlineOf({outline: [[0,0],[1,0],[0.8,1],[0.2,1]], span: {aft: 1}})` returns the outline, and span is ignored.
  - **Tweak loading:**
    - A tweak with `footprints: {hold: {span: {aft: -1}}}` is an error naming `footprints.hold.span.aft`.
    - `{corners: "oval"}` is an error.
    - An outline point `[2, 0]` is an error, since it's outside −1.5…1.5.
    - A self-crossing outline (`[[0,0],[1,1],[1,0],[0,1]]`) is an error.
    - `view: {cutaway: "sideways"}` is an error.
    - `view: {camera: {yaw: 30}}` is an error: all three camera keys are required.
  - **`resolveLook`:**
    - For a decks place with no view tweak it gives `look.view` `{cutaway: "hide-above"}`; for a wheel, `{cutaway: "off"}`.
    - `like` inherits `footprints` key by key.
    - A footprint naming a missing room is an orphan.
  - **Review Focus 1:**
    - In a copied fixture, two adjacent decks rooms where one has `span: {starboard: 0.6}` reaching into the other's cell make the build fail. The error names both rooms and the tweak file, and nothing is written.
    - `span: {starboard: 0.5}` (touching, not overlapping) builds.
- [ ] **Step 2:** Run `npx vitest run scripts/source ui/lib/footprint.test.js scripts/build-data.test.mjs`. Expected: FAIL.
- [ ] **Step 3:** Implement. `footprint.js` is pure, with no DOM; the build imports it from `ui/lib/` as it already imports `parseAddress`. Overlap uses polygon intersection area > 1e-6; write a small convex-or-not polygon clip (Sutherland–Hodgman against each convex piece is enough, since outlines are simple polygons). Leave `footprints` and `view` out of non-decks places' `look`, except `view`, which every kind gets.
- [ ] **Step 4:** Run the tests, then `npm test`. Expected: PASS, with the goldens untouched.
- [ ] **Step 5:** Run `npm run build:data`. Expected: the generated files gain `look.view` (and `look.footprints: {}` on decks places) and nothing else, and the goldens still pass. Commit the regenerated `ui/data`, with `feat(build): footprints and view settings in the tweak files`.

### Task 2: The decks builder reads its look directly

**Files:**
- Modify: `ui/lib/decks.js` (`indexDecks`, `buildDecksModel`, `decksLayout`), `ui/decks-deck.js`, `ui/main.js:60-75`, `tests/golden/render.js:40-55`, `dev/preview.js` (where it builds decks), `ui/lib/look.js` (remove `decksSpec`), `ui/lib/look.test.js`, `ui/lib/decks.test.js`

**Interfaces:**
- Consumes: the generated decks file `{id, rooms, look: {paint, palette, fixtures, footprints, view}}`.
- Produces: `indexDecks(data)`, `buildDecksModel(index, data)`, `decksPlans(data)`, the same functions with the generated file in place of the spec.
  - `indexDecks` reads blisters from `look.fixtures` (`type: "blister"`), and each room's colour from `look.palette[look.paint[local]]` (stored on the indexed room as `tint`).
  - `buildDecksModel` reads cradles and masts from `look.fixtures` by type, in their listed order.
  - Footprints aren't drawn yet; that's Task 4.

- [ ] **Step 1:** Move the frozen-fixture test in `look.test.js` that checks `decksSpec` against today's `DECKS` literal into `decks.test.js`. Rewrite it so `buildDecksModel(indexDecks(fixture), fixture)` deep-equals `buildDecksModel` run on the stage-1 path for the fixtures in `tests/fixtures/generated/` (orrin, kilmar, caradon, garrow). Capture the stage-1 output once as a JSON fixture before changing code.
- [ ] **Step 2:** Run it. Expected: FAIL (the new signature).
- [ ] **Step 3:** Implement, and delete `decksSpec`.
- [ ] **Step 4:** Run `npx vitest run tests/golden ui/lib`, then `npm test`. Expected: PASS, with the goldens untouched.
- [ ] **Step 5:** Commit with `refactor(decks): the builder reads the generated look; decksSpec goes`.

### Task 3: Mockups for reshaped rooms and the ghosted cutaway (checkpoint)

**Files:**
- Create: `docs/maps/reference/footprints-mockup.html`, `docs/maps/reference/footprints-options.png`

- [ ] **Step 1:** Build a throwaway mockup page that imports the plugin's own `ModelView`, `DeckView` and decks builder, served over http as the earlier mockups were (see `docs/maps/reference/tweak-editor-mockup.html`). Use Orrin with three tweaks:
  - the Freight Office `span: {aft: 1}`;
  - the Exchange `corners: "rounded"`;
  - the Chart Office `corners: "cut"`.

  Show it on two decks (Deck 3 lit, and Deck 2 lit with Deck 3 cut away), as overview plus plan.
- [ ] **Step 2:** Draw these options side by side.
  - **How a reshaped room meets the hull:**
    - **A:** the hull stays a box of cells, and the reshaped room's walls are drawn inside it as its own prism, tinted, with the box's outer faces taking that room's tint where it touches them.
    - **B:** the hull is the union of the room outlines on each deck, so a cut or rounded corner on an outside room shows on the hull itself.
    - **C:** as B on the plan, but the 3D hull stays a box. Only the plan shows the shapes, and the model's lit room is its outline prism.
  - **The ghosted cutaway:** each option shows `ghost-above` as the decks above drawn at about 15% fill opacity with their edges, beside today's `hide-above` (dashed outline).
- [ ] **Step 3:** Render to PNG with headless chromium, as earlier mockups were rendered, and look at it yourself. If a shape is wrong, fix it before handing over.
- [ ] **Step 4:** Commit the mockup and the PNG with `docs: footprint and cutaway options`.
- [ ] **Step 5: STOP.** The controller takes the PNG to John and records his pick (and any changes he asks for) in the ledger, then carries it into Tasks 4 and 5's dispatches. Don't build Tasks 4 and 5 until then.

### Task 4: Draw footprints on the decks model and plan

**Files:**
- Modify: `ui/lib/decks.js` (`indexDecks` hull bounds, `buildDecksModel`, `decksLayout`, `decksShape`), `ui/decks-deck.js`
- Test: `ui/lib/decks.test.js`

**Interfaces:**
- Consumes: `outlineOf` and `boundsOf` (Task 1); John's pick from Task 3, which the controller passes in.
- Produces:
  - `decksLayout(index, deck).cells[i]` gains `points`: the room's outline in plan units, centred on its cell centre.
  - `decksShape` returns `{kind: "path", d}` for a room whose footprint isn't the unit square, and the same rect as today otherwise.
  - The model's lit cell for a reshaped room is its outline extruded through the deck.

- [ ] **Step 1: Write the failing tests** (on a copied Orrin fixture with the three Task 3 tweaks):
  - The Freight Office's plan cell `points` reach one frame aft. In plan units that's y + `PLAN.h`, with the box inset kept at the outline's outside edges.
  - **Review Focus 3:**
    - `decksShape` for the Exchange is a `path` whose bounds equal its plan cell's.
    - The model faces keyed `orrin.charts` with `ghost: true` number (8 cut-corner sides + 2 caps).
  - **Review Focus 2:** a fixture where the Berths (the nose) have `span: {fore: 0.5}`:
    - `index.hull.y1` grows by 0.5;
    - the plan footprint plate grows by `0.5 * PLAN.h`;
    - every cradle face's z is beyond the new nose.
  - An untweaked place's faces and plan cells are unchanged. The goldens cover this.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the picked option. Hull bounds come from the union of the rooms' outline bounds (with fractional cells), not only from their cells.
- [ ] **Step 4:** Run `npx vitest run tests/golden ui/lib/decks.test.js`, then `npm test`. Expected: PASS, with the goldens untouched.
- [ ] **Step 5:** Re-render the Task 3 mockup with the real code and compare it with the picked option. Commit with `feat(decks): rooms drawn from their footprints`.

### Task 5: Cutaway modes in the overview

**Files:**
- Modify: `ui/model-view.js` (`constructor` opts, `draw`), `ui/main.js` (pass `view`), `tests/golden/render.js`, `dev/preview.js`
- Test: `ui/model-view.test.js` (create it if there isn't one, with `// @vitest-environment happy-dom`)

**Interfaces:**
- Consumes: `look.view.cutaway`; John's pick for the ghost style from Task 3.
- Produces: `new ModelView(el, index, {…, view: {cutaway, camera}})`. With `cutaway: "off"`, `cutOf` is ignored; with `"hide-above"`, today's behaviour; with `"ghost-above"`, faces above the cut are drawn in the picked ghost style and are never lit.

- [ ] **Step 1: Write the failing tests.** For Orrin at the Exchange (Deck 2):
  - `off`: no dashed wire path, and the Deck 3 faces are drawn as solid;
  - `hide-above`: today's output (matches the golden's model string for that room);
  - `ghost-above`: the Deck 3 faces are drawn with the ghost fill opacity, and none is in the lit group.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run tests/golden ui/model-view.test.js`, then `npm test`. Expected: PASS, with the goldens untouched.
- [ ] **Step 5:** Commit with `feat(model): cutaway off, hide-above or ghost-above, per place`.

### Task 6: A camera home per place

**Files:**
- Modify: `ui/lib/geometry.js:34-61`, `ui/model-view.js`, `ui/main.js`, `tests/golden/render.js`, `dev/preview.js`
- Test: `ui/lib/geometry.test.js`, `ui/model-view.test.js`

**Interfaces:**
- Produces:
  - `camera({yaw, pitch}): {project(p: number[]): number[], front: number}`. The existing exports `project` and `FRONT` become `camera(CAM).project` and `camera(CAM).front`, so `turn.js`, `town-skyline.js` and the rest are unchanged.
  - `ModelView` uses `camera(view.camera ?? CAM)` for drawing and turning, and frames its home view at `zoom` (1 = today's framing; 2 = twice as close).

- [ ] **Step 1: Write the failing tests.**
  - `camera(CAM).project([1,2,3])` equals today's `project([1,2,3])`, and `camera(CAM).front` equals `FRONT`.
  - `camera({yaw: 0, pitch: 0}).project([1, 2, 3])` is `[1, -2, 3]`.
  - **Review Focus 5:** a T.I.S.S. `ModelView` with `camera {yaw: 40, pitch: 25, zoom: 1}`, set to a room at hour 3 with turning on, ends with `phi` such that hour 3 sits at that camera's `front`.
  - With `zoom: 2`, the home view box's width is half of zoom 1's.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run tests/golden ui/lib/geometry.test.js ui/model-view.test.js`, then `npm test`. Expected: PASS, with the goldens untouched.
- [ ] **Step 5:** Commit with `feat(model): a camera home per place`.

### Task 7: Docs

**Files:**
- Modify: `docs/maps/sync.md` (tweak keys), `docs/maps/decks-stations.md`, `README.md` if it lists tweak keys

- [ ] **Step 1:** Document `footprints` (units, `span`, `corners`, `r`, `outline`, and the overlap error) and `view` (`cutaway` per kind with its default, and `camera`), each with an example. Also say what is deferred: wheel, drum and town footprints, and a wheel cutaway.
- [ ] **Step 2:** Run `npm run build:data` (expected: nothing needs you, with no file changes), then `npm test`. Expected: PASS.
- [ ] **Step 3:** Commit with `docs: footprints and view settings`.
