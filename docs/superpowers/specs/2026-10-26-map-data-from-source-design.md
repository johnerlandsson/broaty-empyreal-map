# Map data from the Empyreal source: design

Date: 2026-10-26
Status: approved 2026-10-26

## What this is and why

The plugin's maps are going to be built from the Empyreal source
(`~/dev/empyreal`, read only), not from session logs and hand copies.

Today:

- T.I.S.S. (`ui/data/station.js`) is built by `scripts/build-station.mjs` from
  Mallard session logs, plus seven hand corrections in `data/overrides.json`
  for rooms nobody walked into or that the logs got wrong.
- The fourteen deck stations and Zennor are copied by hand from
  `content/areas/*.yaml` into `ui/data/*.js`. Wenna is written by hand.
- Each place's look is code. Deck stations use `DECKS` in `ui/lib/decks.js`,
  Wenna uses `DRUMS` in `drum.js`, and Zennor uses `TOWNS` in `town.js`.
  T.I.S.S.'s look is spread over constants and literal room ids in
  `geometry.js`, `model.js` and `deck-layout.js`.
- Ship plans are drawn by hand in `ui/lib/hulls.js`.

The source is complete and authoritative. Logs only hold rooms someone
walked into. Empyreal is going to grow a lot: many more stations and ships,
multi-level ships that appear in `content/plans/` before anyone walks them,
and perhaps buildings and vehicles. Keeping the maps up to date has to stay
cheap as that happens.

The person who tweaks the maps is John. Problems are noticed by him or
reported by Empyreal's maintainer. In his other plugin (Cowtography), what
works is seeing the map while he changes it. This design keeps that.

## Goals

1. **One command builds every map from the source.** `npm run build:data`
   reads `content/areas/*.yaml`, `content/plans/*.yaml` and
   `content/game/hulls.yaml`. It keeps only what the map needs and a player
   may know, places rooms by the server's own rules, and applies the human
   tweaks. It writes generated `ui/data/` files stamped with the Empyreal
   commit, and a report of what changed.
2. **Three layers, kept apart.** Rooms come from the source and are generated.
   The look lives in human tweak files, `data/tweaks/<place>.json`. Drawing is
   code. Generated files are never edited by hand. A sync never writes a tweak
   file.
3. **Plain but correct by default.** A new station, ship or plan that arrives
   in a sync is drawn sensibly with no tweak file at all. Tweaks are optional
   polish that John adds when he gets to it.
4. **Flexible for whatever the game describes.** Each layout kind the game has
   (`decks`, `wheel`, `none`) gets one builder. New places of a known kind
   need no code. A new kind (a building, a vehicle) gets a new builder when
   the game first describes one.
5. **A tweak editor.** A browser page that draws one place with the plugin's
   own 3D overview and plan. John can select a room on either view, recolour
   it, reshape its footprint with drag handles, move fixtures, and set how the
   overview behaves. Every change is saved into the tweak file and both views
   redraw.
6. **Ships built from cells, and your own ship in the top band.** Ship plans
   come from `content/plans/` and are drawn by the same builders as stations,
   which retires `hulls.js`. Undocked aboard your ship, the top band shows her
   3D model inside today's space scenes.
7. **A written sync routine** in the repo's docs, run by hand when John asks
   after an Empyreal push.

## Non-goals

- Running the sync automatically (on a timer, a hook or CI). It runs when
  John asks.
- Moving rooms. Where a room is comes from its address and the server's
  rules. The editor never moves a room (with one exception, see Wenna below).
- Editing anything the game owns (names, exits, closed doors, flags) anywhere
  but in Empyreal.
- Zennor's skyline art (`VALLEY`, `TERRACES`, `PLACES` in `ui/lib/skyline.js`)
  becoming editable. It stays in code for now (my call; see "Left to the
  builder").
- Free colours. Paint comes from a named palette.

## Anti-goals (a failure even if it works)

- **Spoilers.** The generated data must hold nothing a player shouldn't know.
  Descriptions, features, keywords, devices, machines and berth details stay
  out. The build never reaches for hidden mechanics.
- **Editing `~/dev/empyreal`.** Read it, never write it. If the source is
  missing something the map needs, explain it to the maintainer and let her
  decide.
- **The maps change on screen during the move-over**, apart from the
  T.I.S.S. rooms named below.
- **Tweaks lost on a sync**, or a tweak silently ignored because its room was
  renamed.
- **An editor preview that differs from the plugin**, because the editor drew
  with code of its own.
- **Per-place code.** No place id written into drawing code. A new station of
  a known kind must need no code change.
- **Upkeep that grows with the number of places.** Inheritance, defaults and
  a report that names only what needs a human are what keep it small.

## Constraints

- The plugin is a Mallard panel (`ui/`, plain ES modules, no bundler) plus
  Lua (`src/`). Generated data stays plain ES modules in `ui/data/`, loaded
  as they are now.
- The repo has no YAML parser. The build adds the `yaml` package as a dev
  dependency (my call). The existing YAML tests parse with regexes; they can
  switch to it.
- The editor and the build are development tools. Neither goes into the
  `.mallardx` (`npm run pack` packs `plugin.toml`, `README.md`, `src` and `ui`,
  so the build lives in `scripts/` and the editor in `dev/`).
- Worktrees are made and removed by John with rochet, never by Claude.
- Visual work gets two or three rendered options and a pick before it is
  built (PNG handed over, as with the mockups below).

## Decided

### The layers

```
~/dev/empyreal (read only)          data/tweaks/*.json (John)       ui/lib/*, ui/*.js (code)
 content/areas/*.yaml  ─┐                    │                        builders per layout kind,
 content/plans/*.yaml  ─┼─ npm run build:data ┴─► ui/data/**/*.js ──►  3D overview and plan
 content/game/hulls.yaml┘          │              (generated)
                                   └─► data/sync-report.json
```

### What the build keeps from the source

It also reads `content/game/world.yaml`, keeping only which place in the
charts each area belongs to (`orrin_station` → `orrin`, from its berth) (my
call). From that it generates the place index that `ROOM_PREFIX` and `DOCK`
in `ui/lib/stations.js`, and the per-place imports and builder table in
`ui/main.js`, hold by hand today. Without it, every new station would still
need a code edit.

Per area or plan: `id`, `name`, `gravity`, `layout` (kind, and a wheel's rings
and spokes), and `districts` where the area has them.

Per room:

- `id`, `name`, `address`
- `exits`, kept as the source writes them: an id, or `{to, via, seconds}`
- `closed`, the reason string the game gives at the door
- `gravity`, from the room, else the layout, else the area
- `flags`, only those on an allow-list: `berth`, `airlock`, `outdoors` and
  `listed` to start with (my call). Any other flag (`droid_dock`, `charger`,
  `start` and so on) is dropped and named in the report, so adding it is a
  decision.
- `district`
- `canopy` (plans only)
- `car`, for lifts and the tram

Nothing else. Each kept field is a deliberate choice. A new field in the
source is ignored until someone decides the map needs it.

### Placing rooms: one builder per layout kind

A room's place is its address in its own layout's terms, never flattened
into one kind of grid:

- **decks** (`Deck N, frame N[, port|starboard N]`): `{deck, frame, side}`.
  This covers the fourteen deck stations and the freighter.
- **wheel** (`Rim|Mid|Inner H:MM [fore|aft|ladderway]`, `Spine N [...]`,
  `Hub [...]`, `Lift H`): ring, clock, fore/aft depth, spine and hub, as
  `layout.ts` places them (x = half hours from 12:00, z = ring index, y =
  ±depth along the `off:` chain). This covers T.I.S.S.
- **none**, with no addresses at all: this covers Wenna and Zennor. Zennor
  keeps the town builder, which places rooms from their compass exits as
  today. Wenna keeps the drum builder, and its rooms' places on the drum are
  set in its tweak file. That is the one case where a tweak places rooms,
  because the game gives them no place.

The build mirrors the server's rules in `packages/game/src/content/layout.ts`
(address grammar, coordinates, gravity, the room kinds a mapper colours by).
It does not import the server's code. Tests check the result against the
YAML whenever `~/dev/empyreal` is present, as `decks.test.js` does now.

When the rules can't place a room, the build doesn't guess. Today's example
is a hub side like `Hub, freight` (T.I.S.S.'s Freight Transfer), which
`layout.ts` gives no coordinates. The report lists it under "needs a place",
and it stays off the map until a `place` entry in its tweak file puts it
there. `data/overrides.json`'s Freight Transfer entry becomes that tweak.

### The generated files

Areas go in `ui/data/<area>.js`. T.I.S.S.'s file becomes `tiss.js`, after its
area id. Plans go in `ui/data/plans/<plan>.js`. `ui/data/hulls.js` maps each
hull to its plan, keeping only `id`, `name`, `class` and `plan` from
`hulls.yaml`. The shape, approved by John on 2026-10-26:

```js
// ui/data/plans/freighter.js — GENERATED by npm run build:data. Do not edit.
export default {
  source: { commit: "0a5f686", file: "content/plans/freighter.yaml", tweaks: "data/tweaks/freighter.json" },
  id: "freighter",
  kind: "plan",                     // "area" for stations and towns
  hulls: ["freighter"],             // hulls built to this plan (plans only)
  layout: { kind: "decks" },        // or wheel (with its rings and spokes), or none
  levels: [1],                      // decks bottom up; a wheel's rings rim first

  // from the game only, filtered
  rooms: [
    { id: "freighter.cockpit", name: "Cockpit of the {name}", address: "Deck 1, frame 4",
      at: { deck: 1, frame: 4, side: 0 },   // the address in its layout's own terms
      exits: { south: "freighter.passage" }, flags: [], canopy: true, gravity: 1 },
    // closed rooms carry closed: "<reason>"
  ],

  // the look, fully worked out: kind defaults, then "like", then this place's own tweaks
  look: {
    paint: { "freighter.hold": "midring" },          // every room, a palette name
    footprints: { "freighter.hold": { span: { aft: 0.5 }, corners: "cut" } },
    fixtures: [ { type: "bell", at: { deck: 1, frame: 0.6, side: 0 }, size: 0.4 } ],
    view: { cutaway: "hide-above", camera: { yaw: 35, pitch: 28, distance: 1.6 } },
  },
};
```

- `rooms` is only the game's. `look` is only the look. That makes it clear
  where everything came from.
- `look` is fully worked out, so the drawing code never deals with defaults
  or inheritance.
- `{name}` in a plan room's name is filled in with the ship's name when she
  is drawn.
- Every generated file starts with the "GENERATED, do not edit" line and the
  Empyreal commit.

### Tweak files

`data/tweaks/<place>.json` holds one place or one plan. Every key is optional,
and a missing file means "plain". Rooms are keyed by their **local id**, the
part after the place prefix (`market`, not `orrin.market`), so that
inheritance works across places.

```jsonc
{
  "like": "orrin",                       // inherit everything, then override below
  "paint":      { "market": "offices" },
  "footprints": { "hold": { "span": { "aft": 0.5 }, "corners": "cut" },
                  "cockpit": { "outline": [[0,0],[1,0],[0.8,1],[0.2,1]] } },
  "hull":       { "3": [[-1.62,1.62],[1.62,1.62],[1.62,2.38],[0.62,2.38],[0.62,3.62,0.35],[-0.62,3.62],[-0.62,2.38],[-1.62,2.38]] },
  "fixtures":   [ { "type": "mast", "at": { "side": -1, "frame": 3 }, "height": 1.2 } ],
  "view":       { "cutaway": "ghost-above", "camera": { "yaw": 30, "pitch": 25, "zoom": 1.5 } },
  "place":      { "transfer": { "x": 0, "y": -1, "z": 3 } },   // only for rooms the rules can't place
  "drum":       { ... }                  // a section named after the builder, for what only it has
}
```

- **Paint** is a palette name. The default is the room's `district` where the
  source gives one (T.I.S.S., Zennor). Otherwise it's a plain colour for the
  room's kind (passage, room, berth, airlock), so deck stations and ships
  start plain.
- **The palette** is `data/tweaks/palette.json`: names to colours, starting
  with today's `DISTRICT_COLOURS`. John adds names (Zennor's courts, riverside
  and so on) in the editor. Code reads the palette from the generated data,
  not from a constant.
- **A footprint** is how a room is drawn, never where it is. It's given in
  its layout's units:
  - decks: a `span` in cells past its own (fore, aft, port, starboard), and
    `corners` (square, rounded, cut), or an `outline` of points in cell units
    for odd shapes
  - wheel: an arc (from and to, in hours) and a depth within its ring
  - The 3D overview raises the footprint to its deck's height, and for a wheel
    bends it round the ring. The plan draws the same footprint flat, in its
    own stretched proportions, which are allowed for readability. Rooms with
    no footprint get one plain cell.
- **The hull** (added 2026-10-26, John's pick from `docs/maps/reference/hull-path-options.png`)
  is a shape of its own, drawn as a closed path in the layout's own grid. Rooms are drawn inside it
  and never shape it. A layout part with no `hull` entry keeps today's shape, so nothing changes
  until someone draws one.
  - decks: one path per deck, keyed by deck number, in the side × frame grid (a cell centre at its
    side and frame, a cell spanning ±0.5). A point `[x, y, r]` rounds that corner with radius `r`
    cells. The path is the plan's plate, the 3D hull (raised through the deck's height), the dashed
    outline when the deck is cut away, and where fixtures like cradles sit. The build refuses a hull
    that cuts through a room's footprint or leaves a fixture outside it, naming both.
  - wheel (later): a path per ring in its unrolled hour × fore/aft grid, drawn on the ring plan
    that repeats as you pan, and wrapped round the ring in 3D at its radius and thickness. Spokes,
    hub and spine are numbers in the `wheel` section (radii, thicknesses, widths, lengths), not
    paths.
  - drum (later): the plan's plate is a path in the drum's x × y grid, as on decks; the 3D drum is
    numbers (radius, length, the axis room's collar), with an optional path in the unrolled
    hour × band grid wrapped round it for a bulge or a flat.
  - The editor shows every hull path on the plan with a handle on each point and a ring on a
    rounded one, and can seed a path from the rooms (their union) for you to adjust.
- **Fixtures** are things outside the rooms: blisters, cradles, masts, and for
  ships drive bells, booms, the collar and the nose. Each has a type, a
  position in layout units, and its sizes. Both views place them from that
  position. A fixture can be marked `plan: false` to leave it off the plan.
  Today's `blisters` and `cradles` arrays and Lamorna's `masts` become fixture
  entries.
- **The view section** holds `cutaway` (`off`, `hide-above`, or `ghost-above`;
  on a wheel, the rings outside yours or the near half) and `camera` (the
  overview's home yaw, pitch and zoom). Each layout kind has defaults equal to
  today's behaviour.
- **A builder's own section** holds what only that kind has: Wenna's room
  places, axis and ramp under `drum`; Zennor's ground kinds, gate, wells,
  river and scarp under `town`; T.I.S.S.'s spoke, hub and dock look under
  `wheel`. Each section is checked against its builder's schema at build
  time, and an unknown key is an error, not ignored.
- **Inheritance.** `like` names another place's tweak file. Its values apply
  first and this file's override them, key by key. The deck halts become
  `"like": "orrin"` plus their own paint and cradles.
- **Ships** have one tweak file per plan (`data/tweaks/freighter.json`),
  or per hull for hulls without a plan (`hull-skiff.json`), never per ship.

### The sync report

`data/sync-report.json` is written by each build and committed with it. The
build also prints it. It lists only what may need John:

- new places and plans, drawn plain until tweaked
- new, removed and renamed rooms per place (renames are matched by address)
- rooms and exits appearing on a map for the first time (on the first run,
  T.I.S.S.'s exits that the logs never had)
- flags dropped because they're not on the allow-list
- rooms that need a place
- **orphaned tweaks**: tweak keys naming a room that no longer exists. The
  build warns and doesn't fail, and the editor shows them so they can be
  moved or deleted.
- source fields it doesn't recognise, as a hint to look

### Moving over without the maps changing

1. **Before anything moves,** record what every place draws today: each
   builder's pure output (the model faces, and each deck's plan layout),
   for T.I.S.S., Wenna, the fourteen deck stations and Zennor. Store it as
   golden files in `tests/golden/`.
2. Move each place's look out of `DECKS`, `DRUMS`, `TOWNS` and the T.I.S.S.
   constants into tweak files, and make the builders read `look` and the
   palette instead of code.
3. Switch each place to its generated file. The new pipeline must reproduce
   its golden output exactly, one place at a time. Only then is that place's
   old file and spec deleted.
4. **T.I.S.S. is the one allowed difference.** The rooms nobody walked into
   are already on today's map through `overrides.json`. What the source adds
   is exits that today's file lacks: the closed rooms, Freight Transfer and
   nine ladderways. John agreed that what's new from the source may appear
   as long as the report lists it. So the first report lists each added exit,
   and the golden comparison allows exactly those. The four lift cars
   (`tiss.lift-12/3/6/9`, `Lift H`) go into the data for the cars view but
   aren't drawn on the wheel, as now (my call). `data/overrides.json` and the
   log build are then retired. The closed rooms' reasons come from the
   source, and Freight Transfer gets its `place` tweak.

After the move-over, the golden files stay as regression tests, and a
deliberate look change re-records them.

### The tweak editor

Option A from `docs/maps/reference/tweak-editor-options.png`, with option C's
drag handles, as John picked on 2026-10-26:

- **Left:** places and plans, with the last sync's report on top (new,
  changed, orphaned) and every station and ship class below.
- **Middle:** the 3D overview above the plan, stacked as in the plugin's
  panel. Both are the plugin's own views (`ModelView`, `DeckView` and the
  builders), fed the edited `look`.
- **Right:** the selected room (its game facts read-only, then paint and
  footprint), or, with nothing selected, the place's view settings (cutaway,
  camera home with "set from current view", and "pretend I'm in", which
  shows the overview exactly as a player in that room sees it).
- **Selection is shared:** clicking a room on either view selects and lights
  it on both.
- **Dragging on the plan:** the selected room's outline has handles that
  change its footprint, and fixtures can be dragged to move them. The
  overview redraws as you drag.
- **Inheritance shows:** each value is marked as inherited ("like Orrin") or
  set here, with a reset.
- **Saving:** every change is written straight to the tweak file and that
  place is rebuilt. There is no separate compile.
- **How it runs (my call):** `npm run edit` starts a small Node server, with
  no framework, that serves the repo, writes `data/tweaks/*.json`, and runs
  the build for one place. Saves are checked against the schema first. A bad
  value is refused with a message and the file is left alone.
- **Order (my call):** step one is a page that redraws whenever a tweak file
  is saved, so editing the JSON by hand already shows changes live. Selection,
  the panels and dragging come after.

### Ships built from cells, and your own ship in the top band

- John approved building ships from cells on 2026-10-26, provided room sizes
  and shapes aren't fixed by the cell. Footprints and fixtures provide that.
  The freighter is drawn by the decks builder from
  `ui/data/plans/freighter.js`, and her look (the hold's size, the cockpit's
  nose, the collar's chevrons, drive bells) goes in
  `data/tweaks/freighter.json`. `hulls.js` and its hand-drawn plans are
  retired once her new drawing is approved.
- A future plan with a spun ring uses the wheel builder. Builders are chosen
  by layout kind, not by whether the place is a ship or a station.
- **Which plan:** the server already says which hull you're aboard
  (`Empyreal.Room` `ship.class`, read in `src/station_map/location.lua`).
  `ui/data/hulls.js` maps that hull to its plan. Ship room ids at runtime are
  `ship.<n>.<key>`, and they match plan rooms by `<key>`.
- **Hulls with no plan** (skiff, courier) get a one-cell ship and a tweak
  file of their own, `data/tweaks/hull-<hull>.json`, as John decided on
  2026-10-26. Today's hand drawings in `hulls.js` (the skiff's outline, laser
  boom, crates and bells; the courier's seats, bulkhead, crates, bolted-over
  slot, drive core and bells) are rebuilt there as a footprint and fixtures,
  so the plan and the 3D model both have them. A mockup comparing them with
  today's drawings goes to John before `hulls.js` is retired. A hull the
  game later gives a plan moves to its plan's tweak file, and the report
  says so. They're listed under ship classes in the editor.
- **The top band, undocked aboard your ship:** option 2 from
  `docs/maps/reference/own-ship-band-options.png`, as John picked on
  2026-10-26. Today's space scenes stay (the belt with the sensors' sweep, the
  assay and the beam, the town below over a port, the planet in high orbit),
  and her 3D model sits in front of them with your room lit and the cutaway on
  your deck.
- **Docked:** the band shows the station, as now.
- **Docking and undocking (my call):** she stays in front while the station
  grows out of the stars, or shrinks into them, behind her.

### The sync routine (written into the repo's docs)

`docs/maps/sync.md` holds the routine, and README's "Rebuilding the station
data" points at it:

1. `git -C ~/dev/empyreal pull`
2. `npm run build:data`
3. Read the report to John: what changed, and what needs a human (new places
   drawn plain, rooms needing a place, orphaned tweaks).
4. `npm test`, then check the preview (`dev/preview.html`) and, for anything
   the report names, the editor.
5. Commit as `data: sync with empyreal <sha>`, with the generated files and
   the report.

## Stages

Each stage lands on its own and leaves the plugin working.

1. **The build, for stations.** Add the YAML parse, field filtering, decks and
   wheel placement, generated files and the report. Record golden output,
   move the look into tweak files and the palette, switch every station and
   Zennor over with no change on screen (T.I.S.S.'s listed exceptions only),
   retire the log build and overrides, and write the sync docs.
2. **Footprints, fixtures and view settings** in the builders: spans,
   corners and outlines, generic fixtures, and the cutaway modes and camera.
3. **The editor:** first the live-reload page, then selection, the panels,
   drag handles and palette editing.
4. **Ships from cells and the own-ship band:** plans and hulls generated, the
   freighter's look as tweaks (with mockups for John to approve before it
   replaces `hulls.js`), and the top band's option 2.

## Coordination

The ship-overview worktree's work moves here, and John will retire that
worktree. Once John approves this design, and before any building starts, a
summary of what was decided goes to the ship-overview session, so nothing it
worked out is lost.

## Left to the builder

- The exact JSON schema for each builder's section, as long as unknown keys
  are errors.
- Whether generated exits use the source's words (`north`) or today's
  station.js letters (`N`), as long as the drawing code reads one form.
  Prefer the source's.
- How golden output is serialised, and which pure functions it covers, as
  long as it catches any change to faces and plan layout.
- How the editor reloads a place after a save.
- Keeping Zennor's skyline art in code. Moving it into tweaks can follow if
  John wants it editable.
- How the report matches renames (by address, then by name).
