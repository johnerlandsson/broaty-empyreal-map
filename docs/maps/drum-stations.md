# Drum stations

*Status: built for Wenna Halt. Last updated 2026-10-22.*

## What it is and when it shows

A small outpost of one spinning drum. Wenna Halt is the only one now; Orrin
Station was one until the game rebuilt it on decks (see
[decks-stations.md](decks-stations.md)), and the drum code still takes a
stair as well as a ramp up to the axis room. A drum has six rooms: the
Concourse, a hall round the drum; the Exchange fore of it; the Freight
Office aft; the Berths and the Chart Office either side; and a room up near
the axis at low gravity, reached by a stair or a ramp. A drum shows while
you're in one of its rooms or your ship is docked there.

| Station | Gravity | Concourse | Axis room | Way up | Cradles |
|---|---|---|---|---|---|
| Wenna Halt | 0.6 g | kelp green (`hydroponics`) | the Lounge, one wide window and deep chairs, 0.2 g | ramp | a row of four sized for couriers |

## Where its data comes from

Generated: `ui/data/wenna.js`, by `npm run build:data` from
`content/areas/wenna.yaml` in the Empyreal source. The game gives the area no
layout, so rooms are placed by hand in the `drum.rooms` of
`data/tweaks/wenna.json`, from their exits and descriptions: `x` west to east, `y` south to north, `hour` round
the drum for the model, `band` along the axis (-1 aft, 0, 1 fore).
Everything that differs between drums is in the place's tweak file: tints
(`paint`), the cradles (`fixtures`), and the axis room's collar and the way
up (`drum.axis`, `drum.way`).

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

Run `npm run build:data` for its room data file, add `data/tweaks/<place>.json`
choosing tints from the palette, add its prefix and dock id to
`ui/lib/stations.js`, and add it to the drum tests and the preview's walk.
A station that isn't laid out like these six rooms needs its own map type
and its own doc, as Orrin Station's decks have.

## Where it differs from the style guide

Nothing.
