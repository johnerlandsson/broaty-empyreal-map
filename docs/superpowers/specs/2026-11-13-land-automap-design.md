# The walked land: design

*2026-11-13. Branch `rochet/automap-proc-gen`, on top of 125654b. Mockups in
`docs/maps/reference/land-*` (the picked look: `land-picked.png`, nine places
joined: `land-nine.png`, the disagreeing ways, hachures and one-way ways:
`land-questions.png`).*

## Intent

Since empyreal b6728d0 you can walk out of Zennor onto Tamsin's generated land.
The panel has no map for it: both bands go blank and the info line says "No plan
of Tamsin". John wants the land mapped as he walks it, for two things:

- **seeing the shape of the land** he has crossed, and
- **finding his way back.**

It has to look like our static maps, tell kinds of ground apart and show the
tracks.

The game's maintainer means to let players build later: a tight cluster of rooms
cleared around a wilderness room, which changes as the game goes on. That is out
of scope here (see Non-goals), but it is why a general mapper engine was chosen
over a one-off drawing.

## What the game gives us

Read from the empyreal source (`packages/game/src/systems/surface*.ts`,
`world/gmcp.ts`, `docs/surface.md`, `docs/gmcp.md`):

- **Area.** Every generated place is in the area `surface.<world>`, today only
  `surface.tamsin`. Ids are `surface.tamsin.<row>.<col>.<cell>`, and the three
  road ends are `surface.tamsin.join.{downs,carn-bridge,terrace-road}`.
- **Size.** The land runs 30 km round Zennor (`WILD_KM`) and then stops.
- **Positions.** `mudstd.room.info` `coords` are true km east (`x`) and north
  (`y`) of Zennor's point, to 0.1 km, with the height in km as `z`, also to
  0.1 km (100 m). Places sit
  on a 0.4 km lattice (`LATTICE_KM`) and are at least 1.1 km apart (`SPACING`;
  plain fill places 2.2 km).
- **Exits.** Up to one per compass octant, each with the target's id. A route
  can be up to 5 km long. One-way routes exist (down a scree), and show as a
  missing `inverse`. An exit back into Zennor carries `area: "zennor"`.
- **Ground kind.** Not sent as data. `terrain` is always `room`, and `tags` are
  `outdoors` and `unkept`. The kind is in the **name**, which `placeTitle()` in
  `surface-words.ts` builds from a fixed list: "Knoll on the Downs", "Old Shaft
  on the Terrace Track", "Pond", "River Bank by the Carn", "On the Tinners'
  Track". A name a surveyor has registered (surface.md §8) replaces all of that.
- **No chart.** The game sends no `mudstd.map.rooms` for the land, and never
  names a place you haven't walked. `go` only reaches places you've walked,
  which is exactly what this map will hold.

## Goals

- Out on generated land, the bottom band is a map of every place you have
  walked, drawn as a board of octagons, with your place lit as on the static
  plans.
- An octagon's background (a colour, with a texture over it) says what kind of
  ground the place is. Tracks run through as roads.
- Click any walked place to light the walked route to it. A card points to
  Zennor when it's off the view.
- The map is kept per character, survives logouts, and can be forgotten.
- Right-click a walked place to add, change or remove a note.
- The top band shows Tamsin from above with your spot lit.
- The sync routine catches new kinds of place the game starts to name.

## Non-goals

- **Fixed places.** Stations, towns and ships keep their hand-drawn maps, and a
  new fixed area gets one too. The engine maps only `surface.*` areas.
- **Player-built places.** They get their own design when the game has them.
- **Land not walked.** There are no charts, nothing guessed past an exit, and
  no seas drawn from a beach's name.
- **Walking for you.** The map never sends a command; the game's `go` does that.
- **Editing beyond notes.** No renaming, own colours, symbols or moving places.
- **The automapper plugin itself.** It isn't changed. Both plugins can run side
  by side, each with its own storage.

## Anti-goals (it fails if…)

- It shows anything you haven't walked (`no-spoilers`).
- It prints a height, distance in metres or other number about the ground. A
  step count is fine.
- More than your own place glows (style guide §6, "One place").
- It breaks the static maps or their view switching.

## Constraints

- **No server changes.** The game is read-only reference, and any new GMCP is
  the maintainer's call.
- **Our style guide** (`docs/maps/style-guide.md`):
  - amber `#ffb347` is the highlight only;
  - a new colour goes in the guide before it goes in code;
  - the camera never moves on its own;
  - a plan re-centres only when you walk out of the middle of the view.
- **Mallard's plugin API.** Our plugin has no `sends` permission and keeps that.
  Storage is per plugin and world, so per-character data is keyed by the
  character's name, as the lanes' sightings are (`src/main.lua`).

## Approaches

Three ways were weighed:

1. **A land plan entirely our own.** A small store and our own drawing. It is
   cheap and fully ours, but a one-off.
2. **The automapper's engine inside our panel (picked).** Copy the pure JS
   engine of `~/dev/mallardx-automapper` (room graph, room identity, route
   finding) into our plugin, and draw with our own renderer in our own style.
   It gives a proven graph and route finder, and room to grow toward
   player-built places.
3. **Teach the automapper plugin about land.** It would help every game, but
   the land would be drawn as the automapper's grid of squares in its own
   panel, not in our style.

John picked 2: "running its engine inside our map panel."

## Decisions (John's, 2026-11-13)

1. **Copy the engine in**, pinned to a stated automapper commit and updated by
   hand, like the game's data. We change our copy where the land needs it.
2. **Only generated land.** The engine maps `surface.*` areas; fixed places get
   hand-drawn maps.
3. **The ground kind comes from place names**, read against a table. The sync
   routine gets a step that checks the game's names for new kinds.
4. **Top band: the planet from above**, Tamsin's low-poly face with your spot
   lit. Not the sky, which would show Zennor's skyline.
5. **A route to any place you click**, walked places only.
6. **One map per character**, plus "Forget this land" behind a confirmation.
   No size limit.
7. **Notes only** for editing.
8. **Ways not taken: dotted Dim stubs**, not faded (faded means "leaves the
   map" on Zennor's plan), not notches, not rings.
9. **A board of octagons** on a tiling, each place in the octagon its true spot
   falls in. Chosen over paths on bare ground, low-poly ground, height bands,
   joined octagons and octagons at their true spots.
10. **No symbols in the octagons.** The background says the kind, as colour
    with texture.
11. **Your place lit as on the static plans.** The route is quiet: dashed
    amber, no glow.
12. **Roads about a quarter narrower** than the first mockup, so the ground
    shows.
13. **A diagonal way is its own thin line across the corner square**, so two
    through one square make an ×. A track's dashed Stone edge is wider so it
    still reads.
14. **Where the octagons and the game's exit disagree, the way bends** out of
    the face its exit names, round to the face it arrives by.
15. **No hachures.** The game's heights are too coarse.
16. **One-way ways get a small chevron** pointing the way you can go.
17. **True spots, straight ways** (2026-11-13, after playing the first build;
    option B of `docs/maps/reference/land-ways-options.png`). Each octagon sits
    at its place's true spot, 0.96 km across so none touch, and every way is a
    straight line from middle to middle, under the octagons. This replaces
    decisions 9, 13 and 14: off the tracks places are about 2.2 km apart, so
    the board was mostly long lines and bends. At true spots the line leaves
    by the side the exit names, so there's nothing to bend. "Drawing the
    board" below describes the first build; `docs/maps/land.md` has the
    layout as built.
18. **Ways leave square to their face** (2026-11-13, after playing true spots;
    the longer stubs of `docs/maps/reference/land-stubs-options.png`, no
    compass letters). Among walked places a line from middle to middle didn't
    show which side a way left by. Each way now runs 0.3 km square out of the
    face its exit names (a third of the gap where places are closer), and the
    two ends are joined by a straight line. The route and tracks follow it.
19. **Thin curves, your exits lit** (2026-11-13, after playing decision 18; E
    of `docs/maps/reference/land-curves-lit-options.png`, from the options in
    `land-calm-options.png`). The square stubs made tracks climb like stairs
    and close neighbours squiggle. Every plain way is now one thin curve from
    face to face, square to both; tracks run straight from middle to middle;
    a one-way chevron sits in the gap between the octagons. The ways you can
    leave your place by are the same curves drawn lighter and heavier, with
    nothing laid over them. This replaces decision 18.
20. **The land spread 1.3×** (2026-11-14; B of
    `docs/maps/reference/land-spread-options.png`). Close places were hard to
    read. A 1.2 km grid was tried and taken back (`land-grid-options.png`);
    pushing only close places apart bent the tracks. Instead the whole land,
    Zennor's block with it, is drawn 1.3× further from Zennor's point than
    it is, octagons the same size: same shape, more room.

## Design

### How a room reaches the map

The Lua side already receives every `mudstd.room.info` (`src/main.lua`, via
`L.room_info`). For a frame whose `area` starts with `surface.`, it also posts
the frame to the panel as a new `land-room` message: `id`, `name`, `area`,
`areaName`, `coords` and `exits`, each exit as `{ id, area?, inverse? }`.
`location` goes on as now. The rest of the frame isn't needed.

### The engine

Copy into `ui/lib/automap/` the automapper's pure modules that build the graph
and find routes (`graph.js`, `identity.js`, `pathfind.js`, and whatever they
import). Leave out its drawing, menus, settings, capture and speedwalk. A header
in each file names the automapper commit (5134d5f, 0.11.0 at the time of
writing) and our changes. Their vitest tests come too, where they test what we
keep.

**Height isn't a floor.** We never use the engine's floors (`floors.js` isn't
copied), and our renderer ignores `z` for placement. The builder checks that
nothing copied treats `z` as a floor in a way that matters, for example
`identity.js`'s occupied-cell checks compare all three axes. If something does,
change our copy so a `surface.*` area keeps `z` as height and has one floor.

### What's kept

`ui/lib/land-store.js` (pure) wraps the engine for the land:

- **Taking a frame.** It ingests a `land-room` frame into the graph, keyed by
  room id, at the frame's true `coords`, linking exits to rooms already known.
  It marks the room walked, since only frames for the room you're in arrive.
- **Saving.** It serialises the walked places, with each one's `name`, `x`,
  `y`, `z`, exits (`dir → id`, and whether one-way) and `note?`. The panel
  posts this to Lua debounced (a `land-save` message), and Lua keeps it under
  `land:<character>` in Mallard's storage, as `lanes:<who>` is kept. At login,
  or when the character becomes known, Lua sends it back (`land-load`). With no
  character known yet, the map waits, as the lanes do.
- **Forgetting.** "Forget this land" clears the area's places and notes for
  this character.

### The kind of ground

`ui/lib/land-kinds.js` (pure) maps a place to one of eleven **ground groups**.
It strips " on …" and " by …" from the name and matches the rest:

| Group | Names |
|---|---|
| open | Open Ground, On the Downs, any "On <track>", and any name not in the table |
| waymark | Cairn, Marker Stone |
| high | Hilltop, Summit, Knoll, Ice Dome, Saddle, Low Pass, Saddle in the Ice |
| slope | Rising Ground, Hillside, Steep Hillside, Stony Slope |
| low | Hollow, Head of a Gully, Head of an Ice Gully |
| rock | Rock Outcrop, Bare Rock, Stony Ground, Crater Rim |
| dust | Drifted Dust, Dust Plain |
| workings | Old Workings, Old Shaft, Fallen Adit |
| water | Pond, River Bank, Spring, Beach |
| salt | The Salt Pans |
| ice | Ice Field, Ice Slope, Frozen Shore |

The road ends are their own group, **road**, by their `.join.` id: their names
are written by hand and don't follow the pattern.

From the same name:

- **Track.** "on the X Track" / "On the X Track" puts the place on track X. A
  way between two places on the same track is drawn as track. Road ends' names
  are written by hand and name no track, but every track starts at one
  (`land.yaml`), so a way between a road end and a place on track X counts as
  track X (*my call*). The way's own words ("along the Tinners' Track") would
  say it outright, but the game doesn't send them: `Empyreal.Room`'s
  `ways[dir].word` is the compass word, and `routeWords` stay on the server.
- **Region.** "on the Downs" / "by the Carn" gives the place's region, used
  only for the region's name on the map.

The exact title list is checked against the game (see "Keeping up with the
game").

### Drawing the board

`ui/land-deck.js` draws the bottom band and `ui/lib/land-layout.js` (pure) works
out the layout. Values below are from the picked mockup
(`land-picked-mockup.html`), `k` being pixels per km.

- **The tiling.** Octagons on a 1.2 km square tiling (three lattice steps)
  centred on Zennor's point. A place takes the octagon its true `x, y` rounds
  to. If two walked places round to the same octagon (rare: they're at least
  1.1 km apart), the later one takes the nearest free octagon.
- **Octagons.** Regular, flat to flat 1.2 km, with each face toward one of the
  eight compass points. Each is drawn 2 px under the full size, with a 1.2 px
  Stone (`#4b4338`) edge.
- **Ground.** Only walked octagons are drawn. Open ground is `#110e0b` with no
  stars, as on Zennor's plan.
- **Backgrounds.** Each group's colour, with its texture drawn over it as an
  SVG pattern in screen pixels, so the texture is the same size at any zoom:

  | Group | Colour | Texture |
  |---|---|---|
  | open | `#261f18` | none |
  | road | `#332b22` (Earth) | none |
  | waymark | `#2f2820` | short upright ticks |
  | high | `#3b3722` | ▲ chevrons |
  | slope | `#33291c` | diagonal slants |
  | low | `#1f2619` | ▼ chevrons |
  | rock | `#34363a` | scattered small stones |
  | dust | `#4a3a22` | fine dots |
  | workings | `#4a2a1e` | small spoil heaps |
  | water | `#1f3a52` | ripples |
  | salt | `#4c4a42` | small squares |
  | ice | `#5a6878` | fine diagonal lines |

  These colours, and the textures' line colours from the mockup, go in the
  style guide's §4.2 (a new "On the land's map" table) first.
- **Ways between neighbours.** Two places in octagons side by side share a face.
  A way between them is a doorway: an Earth bar 0.24 k long and 0.2 k wide
  across the shared face. A way between diagonal neighbours goes through the
  small square where four octagons meet: the square is drawn once
  (`#1a1511`, Stone edge), with each diagonal way as its own Earth line 0.1 k
  wide across it. Two ways through one square make an ×.
- **When the octagons and the exit disagree: bend.** A place's octagon is
  rounded from its true spot, so the shared face can be a different compass
  point from the game's exit. For example, a `southwest` exit to a place in the
  octagon straight south. This happens on about one way in four
  (`land-questions.png`).
  - **Detecting it.** A way between neighbours disagrees when the exit at either
    end names a different compass point from the octagon the other place is in.
  - **Drawing it.** Such a way leaves by the face its exit names and curves
    round to the face it arrives by: a cubic curve between the two face
    midpoints, each control point 0.85 × half the octagon's width straight out
    from its face. The face it arrives by is the face of the exit back, or, on a
    one-way way, the face opposite the way in.
  - **Tracks.** A track runs middle → exit face → curve → arriving face →
    middle.
  - **Plain ways.** A plain way is the curve with a short spur into each octagon
    (a quarter of the way to its middle), 0.13 k wide.
  - **Corner squares.** A diagonal pair drawn as a bend doesn't draw its corner
    square.

  The map then never shows a wrong direction to type. It was chosen over
  leaving it, over straight face-to-face roads, and over nudging places to fit,
  which drifted and still left 18% wrong over the whole land.
- **Longer ways.** A way to a place more than one octagon off runs over open
  ground, from the face it leaves by to the face it arrives by, as an Earth line
  0.13 k wide.
- **One-way ways.** A way with no exit back (down a scree) gets a small chevron
  in Fixture line `#cfd8e3`, 2.2 px, about 0.22 k tall. It sits where the way
  crosses between the two octagons (a bend's middle, or a longer way's middle)
  and points the way you can go. They're rare: about 1 way in 100.
- **No hachures.** The game sends heights to 0.1 km, too coarse to tell a climb
  from level ground: at 45 m a km about a third would be wrong. The slope,
  high and low ground backgrounds carry the lie of the land instead.
- **Tracks.** A way along a track, between neighbours or over open ground, is
  drawn as Zennor's roads are: an Earth band 0.22 k wide with a dashed Stone
  edge (Stone 0.22 k + 4 wide, dashes 4/3, under the band).
- **Zennor.** Zennor's ground is drawn from the `town` outline in
  `content/game/land.yaml` (km from Zennor), as a block `#16120f` with a dashed
  Stone edge and "ZENNOR" in Dim spaced capitals. Its roads out run in Earth
  from its edge to each road end you have walked. `build:data` adds the outline
  to the data, as it adds Zennor's rooms.
- **Ways not taken.** Each exit whose target you haven't walked is a dotted Dim
  stub out of the face it leaves by: 0.45 k long, 1.6 px, dash 0.1/3.4, round
  caps. It never fades.
- **Your place.** Your octagon in amber at fill .3 and stroke 3, with the plans'
  `glowFilter`, pulsing as `pulse()` does. This is the same light as
  `deck-view.js` `drawHighlight`.
- **Notes.** A place with a note gets a small folded corner, Dim, at the top
  right inside its octagon.
- **Names on the map.** Region names in Dim italic, spaced, at the middle of the
  region's walked places: "the Downs", and "the Carn" upright beside it as on
  Zennor's plan. Track names in Dim italic along the walked track. A place's own
  name shows only on hover and in the info line.
- **Chrome.**
  - `N ▲` at top left, and + − ⌂ at top right with wheel and drag, as on every
    plan. ⌂ centres on you.
  - The info line says the name of the place you're in.
  - The plan starts centred on you at about 26 px per km, and re-centres only
    when you walk out of the middle of the view.

### Finding your way

- **Click a walked place** to light the shortest walked route to it from where
  you are (the engine's route finder, over walked places and known exits only):
  - the route is a dashed amber line, 1.5 px at .75, with no glow;
  - the target gets a dashed amber outline;
  - a card beside it gives its name and "N steps the way you know".

  Click it again, click empty ground, or press Esc to clear. A step out of the
  room keeps the target and redraws the route from your new place, until you
  arrive or clear it.
- **The way home.** When Zennor's ground is wholly off the view, a card
  "← Zennor" sits on the view's edge toward it, like the automapper's area
  cards. Clicking it lights the route to the nearest walked road end.
- **Hover** a walked place to see a card with its name and its note.

### Notes and forgetting

Right-click a walked place for **Note…** (add or change) and **Remove note**.
Right-click empty ground for **Forget this land…**, which asks once and then
clears this character's map of the area. Notes are kept with the map.

### The top band

Tamsin from above as the mockup draws it, which is new: no existing scene
draws a whole globe (the orbit scene in `space-view.js` is a band across the
limb).

- **Globe.** A whole low-poly globe on the seeded stars, its facets in Tamsin's
  own colours (`faceOf("tamsin")`, ground and its 15% sea).
- **Light.** Lit from a fixed light at the upper left, with no day and night
  (*my call*: the band says where on the world you are, not the time, and the
  sky isn't sent).
- **Your spot.** Turned so your spot sits a little north of the middle, lit
  amber with a 2.4 px ring and the glow.
- **Where the spot is.** Zennor's latitude (40° N, from the game's `bodies`)
  and longitude, added to the data by `build:data`, moved by your `coords` (at
  most 30 km), so in practice it's Zennor's spot.

There are no labels and no weather.

### Choosing the view

`ui/main.js` picks the land view whenever the location's `area` starts with
`surface.`. The info line then says the place's name instead of "No plan of
Tamsin". Leaving the land (stepping into Zennor) returns to Zennor's maps as
now.

### Keeping up with the game

- **A test,** run when `~/dev/empyreal` is there as the data tests are, reads
  `packages/game/src/systems/surface-words.ts`. It collects every title
  `placeTitle` can return (its `case` returns, `WORKING_TITLE`, `COVER_TITLE`),
  and fails if one isn't in `land-kinds.js`'s table.
- **`docs/maps/sync.md`** gets a step: when that test fails, put the new title
  in a group (and tell John if none fits); and look for land on a new world
  (`content/game/land.yaml`), whose area will map with no change.
- **The automapper commit** we copied from is in `ui/lib/automap/README.md`.
  Updating means copying again and re-applying our noted changes.

### Docs

- A new `docs/maps/land.md` for the map.
- A row in the style guide's §1 table, and the new colours in §4.2.
- A line in the README.

## Left to the builder

- Which automapper modules exactly. What's copied is whatever `graph`,
  `identity` and `pathfind` need, and no DOM.
- Whether to use the engine's `ingestRoom` as is, or a thin wrapper, as long as
  coords are honoured and exits linked.
- The debounce for saving (the automapper's is fine).
- Texture line colours and opacities within reason, matching the mockup.
- The pulse and glow come from `ui/lib/svg.js` as they are.
