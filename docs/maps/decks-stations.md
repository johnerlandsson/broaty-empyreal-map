# Decks stations

*Status: built for Orrin Station, Morvah Deep, Gwithian Reach, Carrow Yard, Lanyon High,
Kynance Spindle, Marazion Quay, Penwith Vats, Botallack Head, Polperro Old Dock, Lamorna
Light, Kilmar Steading, Caradon Works and Garrow Stop. Last updated 2026-10-24.*

## What it is and when it shows

A station that doesn't spin, laid out on decks (`layout: kind: decks` in its
area file; station.md §2.6 in `~/dev/empyreal/docs`). Whatever its shape,
every room is a cell of one grid, and its address names the cell:
`Deck 3, frame 2, port 1`. It shows while you're in one of its rooms or your
ship is docked there.

A station on decks the plugin has no plan of yet (none, since the Mid's three
were added; one the game builds later) shows nothing: both bands stay empty and
the info line says "No plan of" and its name. `pickStation()` in
`ui/lib/stations.js` knows a station's room by the area the game puts it in
(a ship's is `ship.<n>`), and a dock by its place id, so it doesn't keep the
last station up in its place.

| Station | Gravity | Shape | Rooms |
|---|---|---|---|
| Orrin Station | 0 g | a box three frames long and two decks deep, the Gallery in a glass blister on Deck 1, under Deck 2 | the Berths, Freight Office and Chart Office off Deck 3's passage; a hatchway down to the Concourse on Deck 2, the Exchange off its passage, and a hatch down to the Gallery |
| Morvah Deep | 0 g | as Orrin | as Orrin |
| Gwithian Reach | 0 g | as Orrin | as Orrin |
| Carrow Yard | 0 g | as Orrin | as Orrin |
| Lanyon High | 0 g | as Orrin | as Orrin |
| Kynance Spindle | 0 g | as Orrin | as Orrin |
| Marazion Quay | 0 g | as Orrin | as Orrin |
| Penwith Vats | 0 g | as Orrin | as Orrin |
| Botallack Head | 0 g | as Orrin | as Orrin |
| Polperro Old Dock | 0 g | as Orrin | as Orrin |
| Lamorna Light | 0 g | as Orrin | as Orrin |
| Kilmar Steading | 0 g | one deck, a cross of five cells in a box three frames long, the Gallery in a glass blister on Deck 1, under the Commons | the Berths, Exchange, Kitchen and Commons round Deck 2's passage; a hatchway down from the Commons to the Gallery |
| Caradon Works | 0 g | a box two frames long and two decks deep, the Gallery in a glass blister on Deck 1, under Deck 2 | the Berths, Exchange and Canteen off Deck 3's passage; a hatchway down to the Shift Hall, alone on Deck 2, and another down to the Gallery |
| Garrow Stop | 0 g | a box two frames long and two decks deep, no blister | the Berths, Exchange and Snug off Deck 2's passage; a hatchway down to the Commons on Deck 1, and the Lookout fore of it, under the Berths |

The four halts (empyreal bc71307) and the ring's six (empyreal 04978ca) are
outposts of Orrin's class, laid out as it is room for room; only their
prefixes and prose differ. What sets them
apart on the map is their tints and cradles, from their descriptions:

| Station | Passages and Concourse | Freight Office | Chart Office | Exchange | Cradles |
|---|---|---|---|---|---|
| Orrin Station | `industrial` (foundry orange) | `industrial` | `docks` | `concourse` | big ones for ore tugs and drop cans, skiffs' at the corners |
| Morvah Deep | `concourse` (hazard yellow) | `midring` | `offices` (the weather screens) | `offices` | five short, squat ones for skimmers |
| Gwithian Reach | `industrial` (rust red) | `midring` (ingots) | `docks` | `concourse` | ore barges, a long water tanker, skiffs' at the corners |
| Carrow Yard | `midring` (sensible grey) | `industrial` (ships' parts) | `docks` | `offices` (the yards' bids) | five alike, in even rows |
| Lanyon High | `hydroponics` (green cord, vines) | `concourse` (grain) | `docks` | `commons` | three broad ones for grain ships |
| Kynance Spindle | `docks` (white lagging, very bright) | `residential` (blue water tanks) | `residential` (the floes marked in blue) | `concourse` (small and warm) | a narrow well, three long ones for ice haulers |
| Marazion Quay | `concourse` (green on gold, pepper) | `hydroponics` (greens and spice) | `offices` (the weather map) | `commons` (factors in bright shirts) | five alike for the growers' traders |
| Penwith Vats | `hydroponics` (faded green, touched up) | `midring` (vat drums, ice tanks) | `docks` | `offices` (a clerk with a crest) | two wide ones for the towns' carriers, a long one for an ice hauler |
| Botallack Head | `midring` (grey grit); the Concourse `industrial` (coveralls, the old workings' lamp) | `industrial` (ore bins) | `docks` | `concourse` (the assay board) | three low, heavy ones for ore carriers, prospectors' skiffs at the corners |
| Polperro Old Dock | `commons` (faded enamel: no paint is named, so a colour no other station's passages wear) | `concourse` (the customs hall's brass) | `docks` | `midring` (empty mountings) | a wide well and five alike, more than it needs |
| Lamorna Light | `concourse` (pale cream, lit warm) | `midring` (ration crates) | `docks` | `commons` (a clerk tallying the run) | three for stores tenders |

The Mid's three halts (empyreal 925f15b) are smaller, six rooms each round one
passage, with a berth that takes nothing bigger than a medium ship, and none is
the Authority's, so they don't take Orrin's look. Their passages are grey, as
written (Kilmar's felt, Caradon's company grey, Garrow's bare metal), and their
rooms carry the colour:

| Station | Exchange | The rest | Cradles |
|---|---|---|---|
| Kilmar Steading | `hydroponics` (grain and greens) | Kitchen `concourse` (bread, the stove), Commons `commons` (the quilts) | two even ones for the settlers' boats |
| Caradon Works | `offices` (company prices behind a grille) | Canteen `concourse`, Shift Hall `industrial` (lockers, the time clock) | two long, matched ones for ore boats |
| Garrow Stop | `industrial` (ore on the assay scale) | Snug `concourse` (the stove, the bar), Commons `residential` (hammocks) | two cramped ones that don't match |

The Berths, the Gallery and Garrow's Lookout are `docks` everywhere.

**Garrow's Lookout isn't drawn as a blister,** though its description calls it
one ("at the station's fore end, below and ahead"). Its cell, Deck 1, frame 2,
is inside the box the other rooms fill, under the Berths, and a blister here
is a cell outside the hull, hung under it or on top. So it's a room of the
hull, tinted as glass. (The user chose this over a dome on Deck 1's fore face
or a chin dome, 2026-10-24.)

Orrin Station was a drum until the game rebuilt it on decks (empyreal
3833090, 772647b). Wenna Halt is still one (see
[drum-stations.md](drum-stations.md)).

## Where its data comes from

`ui/data/orrin.js` (and `morvah.js`, `gwithian.js`, `carrow.js`,
`lanyon.js`, `kynance.js`, `marazion.js`, `penwith.js`, `botallack.js`,
`polperro.js`, `lamorna.js`, `kilmar.js`, `caradon.js`, `garrow.js`),
generated from `content/areas/orrin.yaml` (and the others) in the Empyreal
source: each room's id, name, address, flags and exits, as the YAML has them
(north fore, south aft, west port, east starboard), and the area's gravity.
Nothing is placed by hand. `parseAddress()` in `ui/lib/decks.js` reads each
address as the game's coords do: x the side (starboard positive), y the frame
(counting fore), z the deck (counting up, away from the planet). A test
checks each station's data against its YAML whenever `~/dev/empyreal` is
there.

What the addresses don't say is in the place's tweak file in `data/tweaks/`
(see `docs/maps/sync.md`): a tint per room (`paint`), which room is the
blister, the cradles at the nose and any masts on the roof (`fixtures`).

From the addresses and the exits:

- **The hull** is the box the cells fill, leaving out the blisters.
- **A passage** is a room named by its own address (`Deck 3, frame 2`). Any
  other room is a room.
- **A blister** sits in a cell outside the hull, below or above it.

## Top band: the model

The hull as a box of cells: X starboard, Y up (deck), Z fore (frame), in
the same frame and camera as every other station. Each cell's outer faces take
the tint of the room behind them. Edges are drawn only where the box has
them. A blister hangs off the hull as a glass dome, capped top and bottom.
Cradles stand fore of the nose. A mast (`masts` in the spec; only Lamorna
Light has one) stands up off the roof with its lamp at the top, the lamp a
warm white lit the same from every side, so it reads as burning. Nothing
turns.

**Cut away above your deck.** From the fixed camera, a room on a lower deck
lies under the deck above it. Lit through the hull, it would land where the
next cell aft does, and look like it's on the wrong deck. So the decks above
yours are lifted off and drawn only as a dashed outline in Dim. Your deck's
top shows its cells tinted, like a floor plan, with your room's cell standing
on it. In the Gallery both decks are outlined, so the blister under them
shows. The cradles and a mast belong to the top deck and go with it. Off the
station the box is whole.

Lit: your room's cell, as a box the size of the cell, or the blister's glass.

## Bottom band: the deck plan

One plan a deck, the top deck first, fore up and starboard right, each cell
140 by 100. On a deck the hull spans, the floor is a Plate with the hull's
walls in Edge. On a deck outside it (a blister's), the hull is a dashed
outline and a Plate circles the blister. The footprint is the same on every
deck, so the frames line up and the view doesn't move when you change deck.
`FORE ▲` and the deck with its gravity (`DECK 3 · 0 g`) sit over the top
left, and the frames are labelled down the port side.

- **Rooms** are room boxes inset in their cells.
- **Passages** are Corridor bands through their cells. A band runs on to the
  cell's edge on every side it opens to, and otherwise stops where the rooms
  beside it do. A stop dot marks the cell's middle unless a hatch is there.
- **Passage bars** join the shapes wherever an exit goes between cells that
  don't already meet.
- **Hatches** up and down (Orrin's hatchways): a round hatch on Fixture fill
  with a Ladder ring and a small "up" or "down". A passage's is in its middle,
  a room's in its top-right corner, a blister's over its name. A room with
  both, as Caradon's Shift Hall, has "down" in the corner below "up".
- **A blister** is a round glass room with its dome's rings drawn in. The
  deck above it shows its outline, dashed in Glass, under the hatch down.
- **The Berths** have airlock hatches with status lights on every wall that
  no exit goes through.

## Rooms, compartments and the highlight

All nine of Orrin's rooms are rooms, the passages and the Gallery included.
Cradles, airlock hatches and status lights are compartments:
on the plan they're never lit and have no hover. A passage lights its stretch
of band, a room its box, the blister its circle.

## Info line

As the style guide: name, address where it isn't the name, gravity.
`FREIGHT OFFICE · Deck 3, frame 2, port 1 · 0 g`; a passage is just its
address, `DECK 3, FRAME 2 · 0 g`.

## Code

- `ui/lib/decks.js`: specs, addresses, the index, `locateDecks()`, model
  faces, plan layout and highlight shapes.
- `ui/decks-deck.js`: the plans' drawing.
- `ui/main.js`: `decks()` wires a station.
- `ui/model-view.js`: the `cutOf` option and `ghost`, `deck`, `outline` and
  `lid` faces that make the cutaway.
- `ui/deck-view.js`: plans with an `extent` keep the view when you change
  level.

## Adding a decks station

The game adds the area. Run `npm run build:data`: it makes the data file and
adds the station to `ui/data/places.js`, which the plugin, the tests and the
preview all read, so no code changes. If it needs colours, add
`data/tweaks/<place>.json` with `paint` (tints from the palette) and
`fixtures`, or a `like` naming a station it looks like. See `sync.md`. The
preview's walk is the one thing to add by hand, if you want the new station
in it. The hull is always the cells' box: Kilmar's cross and Caradon's and Garrow's
empty cells are drawn as hull, as Orrin's corners are. A hull drawn from its
cells alone, and a blister set into a cell inside the box, were tried for the
Mid's halts and not taken. Signs and lifts on decks aren't in
the game yet, and nothing here draws them.

## Where it differs from the style guide

- **The model is cut away above your deck.** It's the only model that
  changes shape as you move (§11). It does so only when you change deck,
  which is you moving (principle 6), and it keeps honest geometry
  (principle 5): without the cut, a lower deck's room lights where the deck
  above's would be.
- **Your room is lit as its whole cell**, a box that's drawn only when lit,
  rather than as faces of the model (§6). A room inside the box has no faces
  of its own.
- **Changing deck doesn't re-centre the plan** (§8.3), because every deck
  shares one frame.
- **The lamp ignores the light** (§11: every face one of three Tones by its angle), being a light itself:
  Lamorna Light's, the "lamp on a mast at the nose" of its area file, stood
  up at the nose's port corner, clear of the Berths when they're lit.
- **No thruster bells**, though Orrin's description has stationkeeping
  thrusters aft of Deck 3 (§7 suggests flared bells). Under the plan's aft
  wall they looked like a ship's stern, as on the ship plans, so they're
  left out.
