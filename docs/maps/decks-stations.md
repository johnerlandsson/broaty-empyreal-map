# Decks stations

*Status: built for Orrin Station, Morvah Deep, Gwithian Reach, Carrow Yard and Lanyon High.
Last updated 2026-10-23.*

## What it is and when it shows

A station that doesn't spin, laid out on decks (`layout: kind: decks` in its
area file; station.md §2.6 in `~/dev/empyreal/docs`). Whatever its shape,
every room is a cell of one grid, and its address names the cell:
`Deck 3, frame 2, port 1`. It shows while you're in one of its rooms or your
ship is docked there.

| Station | Gravity | Shape | Rooms |
|---|---|---|---|
| Orrin Station | 0 g | a box three frames long and two decks deep, the Gallery in a glass blister on Deck 1, under Deck 2 | the Berths, Freight Office and Chart Office off Deck 3's passage; a hatchway down to the Concourse on Deck 2, the Exchange off its passage, and a hatch down to the Gallery |
| Morvah Deep | 0 g | as Orrin | as Orrin |
| Gwithian Reach | 0 g | as Orrin | as Orrin |
| Carrow Yard | 0 g | as Orrin | as Orrin |
| Lanyon High | 0 g | as Orrin | as Orrin |

The four halts (empyreal bc71307) are outposts of Orrin's class, laid out as
it is room for room; only their prefixes and prose differ. What sets them
apart on the map is their tints and cradles, from their descriptions:

| Station | Passages and Concourse | Freight Office | Chart Office | Exchange | Cradles |
|---|---|---|---|---|---|
| Orrin Station | `industrial` (foundry orange) | `industrial` | `docks` | `concourse` | big ones for ore tugs and drop cans, skiffs' at the corners |
| Morvah Deep | `concourse` (hazard yellow) | `midring` | `offices` (the weather screens) | `offices` | five short, squat ones for skimmers |
| Gwithian Reach | `industrial` (rust red) | `midring` (ingots) | `docks` | `concourse` | ore barges, a long water tanker, skiffs' at the corners |
| Carrow Yard | `midring` (sensible grey) | `industrial` (ships' parts) | `docks` | `offices` (the yards' bids) | five alike, in even rows |
| Lanyon High | `hydroponics` (green cord, vines) | `concourse` (grain) | `docks` | `commons` | three broad ones for grain ships |

The Berths and the Gallery are `docks` everywhere.

Orrin Station was a drum until the game rebuilt it on decks (empyreal
3833090, 772647b). Wenna Halt is still one (see
[drum-stations.md](drum-stations.md)).

## Where its data comes from

`ui/data/orrin.js` (and `morvah.js`, `gwithian.js`, `carrow.js`,
`lanyon.js`), copied from `content/areas/orrin.yaml` (and the others) in the
Empyreal source: each room's id, name, address, flags and exits, as the YAML has them
(north fore, south aft, west port, east starboard), and the area's gravity.
Nothing is placed by hand. `parseAddress()` in `ui/lib/decks.js` reads each
address as the game's coords do: x the side (starboard positive), y the frame
(counting fore), z the deck (counting up, away from the planet). A test
checks each station's data against its YAML whenever `~/dev/empyreal` is
there.

What the addresses don't say is in `DECKS` in `ui/lib/decks.js`: the room id
prefix, a district tint per room, which rooms are blisters, and the cradles at
the nose.

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
Cradles stand fore of the nose. Nothing turns.

**Cut away above your deck.** From the fixed camera, a room on a lower deck
lies under the deck above it. Lit through the hull, it would land where the
next cell aft does, and look like it's on the wrong deck. So the decks above
yours are lifted off and drawn only as a dashed outline in Dim. Your deck's
top shows its cells tinted, like a floor plan, with your room's cell standing
on it. In the Gallery both decks are outlined, so the blister under them
shows. Off the station the box is whole.

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
  a room's in its top-right corner, a blister's over its name.
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

Copy its rooms from the area's YAML into a data file: id, name, address,
gravity, flags and exits. Add a spec to `DECKS`, choosing tints from the
district colours. Add its prefix and dock id to `ui/lib/stations.js`, wire
it with `decks()` in `ui/main.js`, and add it to the tests and the preview's
walk. A shape other than a box (a cross, an L) would need the hull drawn from
its cells rather than their bounding box. Signs and lifts on decks aren't in
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
- **No thruster bells**, though Orrin's description has stationkeeping
  thrusters aft of Deck 3 (§7 suggests flared bells). Under the plan's aft
  wall they looked like a ship's stern, as on the ship plans, so they're
  left out.
