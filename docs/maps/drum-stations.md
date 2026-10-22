# Drum stations

*Status: built for Orrin Station and Wenna Halt. Last updated 2026-10-22.*

## What it is and when it shows

A small outpost of one spinning drum. Both drums so far have the same six
rooms: the Concourse, a hall round the drum; the Exchange fore of it; the
Freight Office aft; the Berths and the Chart Office either side; and a room
up near the axis at low gravity, reached by a stair or a ramp. A drum shows
while you're in one of its rooms or your ship is docked there.

| Station | Gravity | Concourse | Axis room | Way up | Cradles |
|---|---|---|---|---|---|
| Orrin Station | 0.5 g | foundry orange (`industrial`) | the Gallery, a ring of windows, 0.1 g | spiral stair | two big ones for ore tugs and drop cans, a small one for skiffs |
| Wenna Halt | 0.6 g | kelp green (`hydroponics`) | the Lounge, one wide window and deep chairs, 0.2 g | ramp | a row of four sized for couriers |

## Where its data comes from

Hand-written: `ui/data/orrin.js` and `ui/data/wenna.js`, from
`content/areas/orrin.yaml` and `content/areas/wenna.yaml` in the Empyreal
source. The game gives these areas no layout, so rooms are placed from their
exits and descriptions: `x` west to east, `y` south to north, `hour` round
the drum for the model, `band` along the axis (-1 aft, 0, 1 fore).
Everything that differs between drums is in `DRUMS` in `ui/lib/drum.js`:
room id prefix, tints, the axis room's collar, the way up, the cradles.

## Top band: the model

The drum as 24 facets round by five bands along the axis, the end caps split
in two rings, the axis room's window collar at the fore end (Glass mixed in)
and an axle aft. Cradles stand out from the hull beside the Berths. The whole
drum turns to bring your room's hour to the front; the axis room has no hour,
so it doesn't turn the drum. Lit: your room's faces, or the collar for the
axis room. No labels.

## Bottom band: the deck plan

One plan for the whole outpost, north up, `N ▲` top left. The Concourse runs
across the middle on a Plate floor, the Exchange north, the Freight Office
south, the Chart Office west, the Berths east with their airlock hatches and
status lights down the outer wall. The stair (a spiral) or ramp (chevrons)
in the Concourse has a dashed "up" line to the axis room, drawn as a round
room with its windows in Glass and its gravity under its name.

## Rooms, compartments and the highlight

All six rooms are rooms. Cradles, hatches and status lights are decoration.
Lit: a room box, or the axis room's circle.

## Info line

As the style guide: name, address where the game sends one, gravity.

## Code

`ui/lib/drum.js` (specs, model faces, plan layout, highlight shapes),
`ui/drum-deck.js` (the plan's drawing), `ui/main.js` (wiring `drum()` for
each station).

## Adding a drum

Add its room data file from the area's YAML, add a spec to `DRUMS` choosing
tints from the district colours, add its prefix and dock id to
`ui/lib/stations.js`, and add it to the drum tests and the preview's walk.
A station that isn't laid out like these six rooms needs its own map type
and its own doc.

## Where it differs from the style guide

Nothing.
