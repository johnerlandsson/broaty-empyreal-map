# Zennor's Sky Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Zennor's still skyline with a sky that shows, in outdoor
rooms, exactly what the game's `look sky` says, moving in real time. Indoors,
the band stays a still skyline with no stars.

**Architecture:**
- A pure `ui/lib/sky.js` ports ground.ts's `groundSky` to the plugin's chart
  index (`indexCharts`, `positionOf`). It also maps the result to drawing
  decisions (`skyScene`). Both are checked against cases recorded from the
  game itself by `dev/sky-cases.ts`.
- `ui/town-view.js`'s `SkylineView` becomes `SkyView`: the same skyline, with
  the dome chart (mockup A) over it when you're outdoors.
- `ui/main.js` feeds it the charts and redraws it once a second while it's
  live.

**Tech Stack:** plain ES modules, SVG, vitest 2. Node 22 runs the game's
TypeScript directly.

**Spec:** `docs/superpowers/specs/2026-10-23-zennor-sky-design.md`

## Global Constraints

- ground.ts's rules to the degree:
  - `TWILIGHT = 10` and `OVERHEAD = 60`; "well up" is ≥ 30.
  - Dark is `sun.alt < -5`.
  - Rising and heading are judged 60 s later.
  - A station is shown only when `alt > 0`; a planet only when dark and `alt > 0`.
- The game's sentences are copied character for character from
  `~/dev/empyreal/packages/game/src/systems/ground.ts` (empyreal 7492196),
  including the `{side}ern horizon` form.
- Time is in whole ticks: `tick = Math.floor((t - index.epoch) / 1000)`, and
  "60 s later" is `tick + 60`.
- Nothing beyond the game's words:
  - Indoors (or with no sky to show), the band has no stars, arc, W/E,
    bodies or tint.
  - Sky colour steps with the band; it never fades continuously.
  - No lit windows.
- Station short names come from a map: `SHORT = { tiss: "T.I.S.S." }`, with
  a comment naming `content/areas/tiss.yaml` `short:` as the source. Any
  other station falls back to its chart name.
- The port's own id is never listed as a station.
- Colours are the style guide's. The new ones are Orrin's gold `#ffcf6a`,
  the four day tints, and the dusk and dawn glows, all added to
  `docs/maps/style-guide.md`.
- No changes to the game repo or the Lua side.

## Review Focus

1. **Charts arrive or change while you're already standing outdoors.** The
   sky appears, or updates, at once, without waiting for you to move.
   (Task 4, preview step.)
2. **The charts are for another system, or don't place Zennor.** For
   example, Maelor's charts are still held after a jump, or the
   message has no `zennor`. The band is the still skyline, not a
   guessed sky. (Task 2, test `returns null for charts without the port`.)
3. **You go indoors, or the ◎ chart covers the band, or the panel is hidden.**
   The timer stops; on return the sky is drawn for now, not as it was.
   (Task 4, preview step.)
4. **Exactly on a threshold.** At exactly 10°, 0° or −5°, the band and words
   are ground.ts's (`>=` versus `>`). (Task 2, threshold tests.)
5. **Another station orbiting Tamsin with no entry in `SHORT`.** It's
   listed under its chart name, and the port isn't. (Task 2, test
   `lists other stations of the planet by chart name, never the port`.)

---

### Task 1: Record the game's own sky

**Files:**
- Create: `dev/sky-cases.ts`
- Create (generated, committed): `dev/sky-cases.json`

**Interfaces:**
- Produces: `dev/sky-cases.json`, shaped as
  `{ empyreal: string, port: "zennor", charts: <the Space.Charts data object>, cases: [{ tick: number, text: string }] }`.
  `charts.epoch` is the wall clock at tick 0.

- [ ] **Step 1: Install the plugin's dev dependencies**

Run: `npm install`
Expected: `node_modules/.bin/vitest` exists.

- [ ] **Step 2: Write `dev/sky-cases.ts`**

A Node 22 script, run as `node dev/sky-cases.ts > dev/sky-cases.json`.
- **The game's path:** `process.env.EMPYREAL`, else `~/dev/empyreal`.
- **The game itself:** import `TestWorld` from `<path>/tests/harness.ts` and
  `groundSky` from `<path>/packages/game/src/systems/ground.ts` with
  dynamic `import()` of file URLs, so `@smud/game` resolves from the game
  repo.
- **The charts:**
  1. Create a `new TestWorld()` and `await w.newMiner("sky", "Lark")`.
  2. Take the last `{ pkg: "Space.Charts" }` entry of `client.gmcp` as
     `charts`.
- **`empyreal`:** `git -C <path> rev-parse --short HEAD`.
- **The cases:** scan every tick from 0 to 259200, which is one Tamsin
  year, so every Senara band, T.I.S.S. pass and Orrin rising is in it.
  1. Call `groundSky(w.game, "zennor", tick)` at each tick.
  2. Wherever the text changes between `tick − 1` and `tick`, record both
     ticks.
  3. Also record tick 0.
  4. Drop duplicates, then sort by tick.

- [ ] **Step 3: Run it and check the output**

Run: `node dev/sky-cases.ts > dev/sky-cases.json && node -e 'const j=require("./dev/sky-cases.json"); const t=j.cases.map(c=>c.text).join(" "); console.log(j.cases.length, ["stands high overhead","well up","is low in","just come up","going down","paling","Dusk:","Night:","climbing up","passing overhead","sinking toward","bright, steady spark","pale fleck","golden star high overhead","golden star in the"].map(s=>s+":"+t.includes(s)).join(" "))'`
Expected: a few hundred cases, and every phrase `:true`. If a phrase is
`false`, widen the scan before going on; that phrase isn't covered.

- [ ] **Step 4: Commit**

```bash
git add dev/sky-cases.ts dev/sky-cases.json package-lock.json
git commit -m "chore(sky): record the game's own sky over Zennor for a year"
```

---

### Task 2: `groundSky`, the game's sky from the charts

**Files:**
- Create: `ui/lib/sky.js`
- Test: `ui/lib/sky.test.js`

**Interfaces:**
- Consumes: `indexCharts`, `positionOf`, `parentOf` and `daylit` from
  `ui/lib/orbits.js`; `dev/sky-cases.json` from Task 1.
- Produces:
  - `export const SHORT = { tiss: "T.I.S.S." }`
  - `export function groundSky(index, port, t, short = SHORT)`. It returns
    `null`, or:

    ```
    {
      sun: { id, name, alt, east, rising, line },
      dark: boolean,
      band: "overhead" | "well up" | "low" | "up" | "twilight" | "night",
      bodies: [{ id, kind: "station" | "planet", name, alt, east, rising, heading, line }],
      text: string,
    }
    ```

    Each `bodies` entry is something the game lists, in the charts'
    order: stations first, then planets.

- [ ] **Step 1: Write the failing tests**

```js
import cases from "../../dev/sky-cases.json" with { type: "json" };
const idx = indexCharts(cases.charts);
const at = (tick, ms = 0) => idx.epoch + tick * 1000 + ms;

it("says what the game says, at every change over a year", () => {
  for (const c of cases.cases) expect(groundSky(idx, "zennor", at(c.tick))?.text, `tick ${c.tick}`).toBe(c.text);
});
it("counts whole ticks: 999 ms into a tick is still that tick", () => {
  for (const c of cases.cases) expect(groundSky(idx, "zennor", at(c.tick, 999)).text).toBe(c.text);
});
it("agrees with daylit()", () => { /* for each case: (sun.alt > 0) === daylit(idx, "zennor", at(tick)) */ });
it("names T.I.S.S. by its short name", () => { /* some case's bodies include { id: "tiss", name: "T.I.S.S." } */ });
it("returns null for charts without the port", () => {
  expect(groundSky(indexCharts({ ...cases.charts, bodies: cases.charts.bodies.filter((b) => b.id !== "zennor"), places: [] }), "zennor", at(0))).toBeNull();
  expect(groundSky(indexCharts(null), "zennor", 0)).toBeNull();
  expect(groundSky(idx, "nowhere", at(0))).toBeNull();
});
it("returns null for a port whose planet the charts can't place", () => { /* drop tamsin from bodies → null */ });
it("lists other stations of the planet by chart name, never the port", () => {
  /* add { id: "pier", name: "Pier", kind: "station", orbit: <tiss's orbit, phase +180> } to places;
     at a tick where it's up, bodies has name "Pier" and no entry with id "zennor" */
});
```

Then add threshold tests on a hand-placed index:
- **The stub:** a star at the origin; a planet on a circular orbit with a
  huge `period`, so it doesn't move in 60 s; the port on it with
  `period: 14400`; one station.
- **Placing the sun:** put the port's `phase` so Senara is at altitude 60,
  30, 10, 0, −5 and −10 exactly. The altitude is 90° minus the angle
  between "up" and the way to the star.
- **Expected `band` and first sentence:**
  - 60 → `"overhead"`, "stands high overhead"
  - 30 → `"well up"`
  - 10 → `"low"`
  - 0 → `"up"`, "just come up" when rising
  - −10 → `"night"`
  - −9.9 → `"twilight"`
- **`dark`:** −5 → `false`, and −5.1 → `true`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run ui/lib/sky.test.js`
Expected: FAIL, `groundSky` is not exported.

- [ ] **Step 3: Implement `groundSky` in `ui/lib/sky.js`**

Port `seen()` and `groundSky()` from ground.ts as they are:
- **`up`:** the unit vector from the planet's position to the port's.
- **`east`:** `dot([-up[1], up[0]], to) > 0`.
- **`heading`:** the `east` 60 ticks later.
- **Positions:** from `positionOf(index, id, epoch + tick * 1000)`, so the
  whole tick is used, not `t`.
- **Which bodies:**
  - The star is the item with `kind === "star"`.
  - Stations are items with `kind === "station"`, `id !== port` and
    `orbit.parent === planet`.
  - Planets are items with `kind === "planet"` and `id !== planet`.
  - Each group keeps the index's insertion order.
- **`band`** comes from the same branches that choose Senara's sentence.
- **`line`** is each sentence on its own; `text` is the lines joined with
  `" "`.
- **Comments:** the header comment names ground.ts and the spec.
- **Errors:** wrap the body in `try`/`catch`, returning `null`, as
  `locateTown` does.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run ui/lib/sky.test.js`
Expected: PASS. If a recorded case fails, the port is wrong, not the case.

- [ ] **Step 5: Commit**

```bash
git add ui/lib/sky.js ui/lib/sky.test.js
git commit -m "feat(sky): the game's sky over a port, from the charts"
```

---

### Task 3: `skyScene`, what the dome draws

**Files:**
- Modify: `ui/lib/sky.js`
- Test: `ui/lib/sky.test.js`

**Interfaces:**
- Consumes: the `groundSky` result (Task 2).
- Produces:
  - `export function skyAngle(alt, east)`. It returns the degrees along the
    dome from its western foot: `east ? 180 - alt : alt`.
  - `export function skyScene(sky)`. It returns:

    ```
    {
      tint: string | null,
      stars: "none" | "few" | "all",
      glow: null | { east: boolean, kind: "dusk" | "dawn" },
      hover: string,
      marks: [{ id, look: "sun" | "spark" | "fleck" | "gold", angle, name, line }],
    }
    ```

    `hover` is the sun's line, shown over the empty sky.

- [ ] **Step 1: Write the failing tests**

```js
it("puts the sun on the dome only when it's up", () => { /* band "night"/"twilight": no mark with look "sun"; "up": one, angle === skyAngle(sun.alt, sun.east) */ });
it("steps the sky with the game's band", () => {
  // night: tint null, stars "all", glow null
  // twilight setting: stars "few", glow { east: sun.east, kind: "dusk" }
  // twilight rising: stars "none", glow { kind: "dawn" }
  // up, low, well up, overhead: stars "none", four different tints, each lighter (higher HSL lightness) than the last
});
it("draws a station as a spark when dark, a fleck when not", () => {});
it("draws a planet as gold", () => {});
it("marks exactly what the words list", () => {
  for (const c of cases.cases) {
    const sky = groundSky(idx, "zennor", at(c.tick));
    const s = skyScene(sky);
    expect(s.marks.map((m) => m.line)).toEqual([...(sky.sun.alt >= 0 ? [sky.sun.line] : []), ...sky.bodies.map((b) => b.line)]);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run ui/lib/sky.test.js`
Expected: FAIL, `skyScene` is not exported.

- [ ] **Step 3: Implement `skyAngle` and `skyScene`**

- **Tints:** for the four lit bands, dark dusty blue-greys inside the
  "always dark" scene. Start near `#1c2633` for "up" and go a step lighter
  each band, to about `#3a4a5c` for "overhead". The builder picks the
  values; they go in the style guide in Task 5.
- **Marks:** the sun's mark comes first, then the bodies in order.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run ui/lib/sky.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/lib/sky.js ui/lib/sky.test.js
git commit -m "feat(sky): what the dome draws for each of the game's skies"
```

---

### Task 4: `SkyView` in the top band, wired and previewed

**Files:**
- Modify: `ui/town-view.js` (the `SkylineView` class becomes `SkyView`)
- Modify: `ui/main.js` (`town()`, the `"charts"` handler, a sky timer)
- Modify: `dev/preview.js`, `dev/preview.html` (a sky menu)

**Interfaces:**
- Consumes: `groundSky`, `skyScene` and `skyAngle` (Tasks 2–3), and
  `indexTown`'s `byId.get(id).outdoors`.
- Produces: `class SkyView`, with:
  - `constructor(containerEl, townIndex, port)`
  - `div`
  - `set(where)`: outdoors when `where.kind === "room"` and the room is
    `outdoors`
  - `setTurning()`: a no-op
  - `setCharts(index)`
  - `draw(t)`
  - `get live()`: outdoors and `groundSky` isn't `null`

- [ ] **Step 1: Turn `SkylineView` into `SkyView`**

- **Layers, back to front:** Background; a sky group (tint, stars, glow);
  the skyline as it is today, with the free-floating `stars(...)` call
  removed; then a dome group (arc, W/E, marks, names).
- **The dome:** centred at `(0, HORIZON)` with radius 170, in the existing
  `VIEW`. A mark at `angle` sits at
  `(-170·cos(angle°), HORIZON − 170·sin(angle°))`.
- **Marks:**
  - sun: the Star disc and glow
  - spark: white, with a glint
  - fleck: Text at about .6 opacity
  - gold: `#ffcf6a`
- **Names and hover:** each mark has its name beside it in Dim and a
  `<title>` with its `line`. The dome's background gets a `<title>` with
  `hover`.
- **Glows:**
  - dusk: warm, `#e8925a` at about .35
  - dawn: paler and cooler
  - Both sit on the horizon at the glow's side.
- **Stars:** clipped to the dome. Use the existing `stars()`; "few" means
  about 25.
- **`draw(t)`:** clears and redraws only the sky and dome groups. Indoors,
  or with no sky, both groups are empty, and the result is the skyline
  alone.
- **`set` and `setCharts`:** each calls `draw(Date.now())` itself, so a
  change shows at once.
- **The file's header comment:** describe the sky, and drop "stands in for
  the sky view".

- [ ] **Step 2: Wire it in `ui/main.js`**

- **Construct it:** `town()` builds `new SkyView(modelEl, index, "zennor")`
  in place of `SkylineView`.
- **Feed it the charts:** the `"charts"` handler also calls
  `stations.zennor.model.setCharts(chart.index)`.
- **Add `runSky()`, shaped like `runChart`.** It holds one
  `setInterval(() => model.draw(Date.now()), 1000)`, running only when all
  of these hold:
  - `current === "zennor"`
  - `model.live`
  - `!chart.shown`
  - `!document.hidden`
  - the space scene isn't covering the band

  It draws once at once when it starts.
- **When to call it:** at the end of `render()`, in the `"scene"`,
  `"charts"` and `"chart"` handlers, and on `visibilitychange`.

- [ ] **Step 3: Add a sky menu to the preview**

- **The control:** a `sky` select in `dev/preview.html`, with entries for
  night, dusk, dawn, Senara low and Senara overhead, plus T.I.S.S.
  overhead, each picked from `dev/sky-cases.json`'s ticks.
- **When one is chosen:** emit `charts` as `cases.charts` with
  `epoch: Date.now() - tick * 1000`, so that moment is now and then runs
  on. Then put the walk on `zennor.square`.
- **Document it:** add `?sky=<name>` to the header comment's list.

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: all vitest and Lua tests pass.

- [ ] **Step 5: Check it in the preview**

Open `dev/preview.html?sky=night` (see the `run` skill or the README's dev
notes for serving it). Check each of these:
1. **Outdoors, the hover lines match.** In `zennor.square`, T.I.S.S. and
   Orrin show, and hovering over each gives the recorded case's sentence.
2. **It moves.** After about 30 s, T.I.S.S. has visibly moved along the
   arc.
3. **Indoors, it's bare.** Stepping to `zennor.exchange` shows the bare
   skyline: no stars, no arc. Stepping back to the Square brings the sky
   back at its current place.
4. **The ◎ chart.** With it on, the sky stops redrawing (check with
   `?debug` or a breakpoint); with it off, the sky is current again.
5. **Charts while outdoors.** Switching the sky menu while standing in the
   Square changes the sky at once (Review Focus 1).
6. **Dusk and dawn.** `?sky=dusk` shows a warm western glow, a few stars
   and no Senara. `?sky=dawn` shows a pale eastern glow and no stars.

Take a screenshot of night, dusk and overhead for the hand-over.

- [ ] **Step 6: Commit**

```bash
git add ui/town-view.js ui/main.js dev/preview.js dev/preview.html
git commit -m "feat(sky): Zennor's sky over the town, as look sky tells it"
```

---

### Task 5: Docs

**Files:**
- Modify: `docs/maps/town.md`, `docs/maps/style-guide.md`, `README.md`

- [ ] **Step 1: `docs/maps/town.md`**

- **Rewrite "Top band"** as "Top band: the sky", covering:
  - outdoors: the dome, what each mark is, the hover lines, the steps of
    colour by band, real time
  - indoors, landed, or with no charts: the still skyline with no stars
  - the rules, pointing to ground.ts and the spec, and noting that ground.ts's
    10° twilight is used, not planetside.md's "half hour"
- **"Where it differs from the style guide":** the top band is a sky chart,
  with lit-band tints.
- **"Code":** add `ui/lib/sky.js` and `dev/sky-cases.ts`, and how to re-record
  the cases when ground.ts changes.

- [ ] **Step 2: `docs/maps/style-guide.md`**

- **§1's town row:** the top band is the sky.
- **§4.3:** add Orrin's gold `#ffcf6a`, the four band tints and the dusk and
  dawn glows, with what each is used for.
- **Date:** bump "Last updated".

- [ ] **Step 3: `README.md`**

In the town's part of "The panel", say:
- outdoors, the top band is Zennor's sky as `look sky` tells it: day and
  night, dawn and dusk, T.I.S.S. crossing, and Orrin at night, moving as
  you watch, with hover for the game's words
- indoors, it's the town's skyline

- [ ] **Step 4: Commit**

```bash
git add docs/maps/town.md docs/maps/style-guide.md README.md
git commit -m "docs(sky): Zennor's sky in the town doc, style guide and README"
```
