# Empyreal Map

A [Mallard](https://mallard.vnsf.xyz) plugin for the MUD Empyreal: maps
that follow you as you play. It maps seven stations: T.I.S.S., which it
follows as you walk, ride the lifts and visit the docks, the small outpost
Orrin Station, Wenna Halt, one lane over in Maelor's system, and the four
halts further out, Morvah Deep, Gwithian Reach, Carrow Yard and Lanyon
High. It also maps Zennor, the town on the planet Tamsin below T.I.S.S. The
panel shows whichever place you're in, or the one your ship is docked or
landed at, and charts the star system you're in and the lanes across the
core.

---

## The panel

The **Map** panel opens on the right side of the window. It has two
parts.

**The station model (top).** A flat-shaded model of the whole station: the
wheel with its three rings (Rim, Mid and Inner), the four spokes and the hub,
with the spine and the docks hanging below. Your place on the station glows:
the slice of the ring you're standing in, the spoke leg your lift is
travelling, or the dock room you're in. As you move, the wheel turns by
itself until your part of the station faces you. Only the wheel turns; the
spine and the docks hold still beyond the Bearing, as on the real station.

**Orrin Station** doesn't spin: it's a weightless box, three frames long and
two decks deep, with cradles at its nose for ore tugs and drop cans and the
Gallery in a glass blister underneath. Your room's cell glows. When you're
on Deck 2, Deck 3 is lifted off and drawn only as a dashed outline, so your
deck is the top of the model. In the Gallery, both decks are outlined and
the blister hangs below them.

**Morvah Deep, Gwithian Reach, Carrow Yard and Lanyon High** are built as
Orrin is, room for room, and drawn the same way. Each wears its own paint:
Morvah's hazard yellow, with short cradles for its squat skimmers;
Gwithian's rust red, with ore barges and a water tanker; Carrow's sensible
grey, its cradles in even rows; and Lanyon's green, with broad cradles for
its grain ships.

**Wenna Halt** is a drum, spun to 0.6 g, with the kelp-green Concourse round
it, a clean row of courier cradles outside the Berths, and the Lounge's wide
window collar at the fore end of the axis. The drum turns your room to face
you, as the wheel does.

**Zennor** is on the ground, so instead of a model the top band shows its
skyline: the ridge rising east, the town's low roofs and the Port Office's
squat tower. Out of doors, the sky is over it as the game's `look sky` tells
it, moving as you watch: day and night, dawn and dusk, T.I.S.S. climbing out
of the west, passing overhead and setting, and Orrin as a golden star at
night. Each is drawn where the game puts it on a dome from the western
horizon to the eastern, and hovering over one shows the game's own sentence
for it. Indoors you can't see the sky, so the band is the skyline alone.

**Out in your ship.** Once you undock, the station model fades into a view
looking ahead from your ship: a still starfield while you're parked, the
stars streaming past while you travel, low-poly asteroids tumbling past
while you're at a belt, and over Zennor the town below on Tamsin's face, on
the day side or the night side as it is in the game. At a belt you see the
ship's work: the sensors' green line crossing the view as she sweeps for
rocks, brackets and a filling ring round a rock while she assays one, and
the laser's beam on a rock while she mines, with the seconds left in the
corner. A program's work shows the same as yours. The rocks themselves stay
scenery: the map never shows what a scan found. There are no controls; docking brings
the station back. Docked at another ship, say a skiff at a freighter's
collar, you see what the freighter sees: the stars streaming past while she
travels, the station while she's docked at one. This follows the ship you can fly: your own, or one you
crew. Aboard someone else's ship as a guest, the station model stays,
because the game doesn't tell the plugin where that ship is.

**The chart.** Once the game has sent the system's charts, a ◎ button appears
beside the top band's zoom buttons. It swaps the band for a true-scale chart of
the star system you're in: the star, planets and stations, each where it is now
and moving, the belts drawn as arcs as wide as the game's doubt about them
(wider the longer since they were seen, and a ring once lost), the lane mouths
at the edge, and your ship in amber with her route when she's under way.
Zoom and drag as on a plan, ⌂ to frame. It shows only what you know: while she
searches for a belt the arc lights up instead of her path, and a lane mouth
gets a mark only if the game says where it faces: a stable lane's does, a wild
lane's is only "somewhere on the edge". A branch lane's mouth is dashed and
named "closed" while the lane is closed, which is most of the year; the chart
doesn't say when it'll open, because the game doesn't. Press ◎ again for the
station or the view ahead.

**The core lanes.** Beside ◎, a ⋈ button swaps the band for a map of the
core's six systems: Petroc, Keyne, Senara, Maelor, Elowen and Mabyn, top to
bottom, inner to outer, each with its stations. The trunks run down a line
between them. The two branches, Petroc–Maelor and Keyne–Mabyn, are brackets
beside it: solid when you last saw them open, dashed when closed, dotted if
you've never been where they start. A key says how long ago you saw each
one ("open · now", "closed · seen 3d 4h ago"). You only find out from the
mouths in the system you're in, and the map remembers what you saw across
restarts. It never guesses when a branch will open. Your system has the
amber ring; in a lane, the lane is lit and your ship moves along it with the
time left. The spacing is even, not where the stars really are. ⋈ and ◎
switch each other off.

**The deck plan (bottom).** A floor plan of the floor you're on:

- **Rings:** the corridor runs across the panel with its stops labelled by
  hour, rooms fore and aft of it, and lift lobbies marked with the lift
  symbol and the ladderway hatch beside it. The plan wraps, so 12:00 follows
  11:00 and you can pan round forever.
- **Docks:** the Hub at the bottom with its four lift doors, the Bearing,
  the spine running up to the Observation Blister, and the dock rooms either
  side of it, with Bay 1 and Bay 2, where medium ships dock, carrying on to
  starboard past the Berths.
- **Orrin Station:** a plan for each deck, fore up, with every room in the
  cell its address names. Deck 3 has the Berths at the nose, the passage aft
  with the Freight Office to port and the Chart Office to starboard, and a
  hatch down. Deck 2 has the Concourse, the Exchange and the hatch down to
  the Gallery, whose blister is outlined beneath it. Deck 1 is the Gallery
  alone, under the hull's outline. Each plan says its deck and 0 g, and the
  frames are numbered down the side. The four halts' plans are the same,
  in their own colours.
- **Wenna Halt:** one plan for the whole outpost, laid out as its exits go:
  the Concourse across the middle, the Exchange north, the Freight Office
  south, the Chart Office west and the Berths east with their airlock
  hatches, and a ramp up to the Lounge, at 0.2 g, its deep chairs facing
  one wide window on the sea.
- **Zennor:** the town from above, north up, laid out as its exits go, on
  bare earth inside its old stone wall. The Landing Field is at the north in
  its blast walls, with the Field Office and the Port Office either side.
  Fore Street runs south through the arch of the Field Gate to the Square,
  with the Exchange and the Tinner's Arms off it, and on to the Water House
  and out of the wall to the green Terraces stepping down below. The Ridge
  Path leaves the top of the street east, through the wall and up its
  switchbacks to the Overlook. Buildings are boxes on stone footings, and the
  streets are packed earth. On a street, its stretch of the street lights.

Your place is lit with the same glow as in the model, not marked with a dot:
a room box, a stretch of corridor, a lift or the ladderway hatch. The plan
switches to your floor when you arrive there and re-centres only when you
walk out of the middle of the view. Closed rooms are drawn dashed and dimmed.
In your workshop or bunk, which the station plan doesn't have, the room you
came in from (Workshop Row or the Bunkhouse) is lit softly, with a small
bright tab on its far edge for the door, and the model lights it as usual.
The map shows only that door, not where in the row your unit is.
Hover over a room or a corridor stop to see its name, its address and, for a
closed room, why it's closed.

**Aboard a ship.** The bottom band shows the ship's plan in place of the
station's: the whole hull from above, fore up, with the room you're in lit
and the ship's name and class under it. Each class has its own drawing (the
prospecting skiff, the courier and the medium freighter); a class without a
drawing yet shows a plain generic hull. On the freighter the light follows
you between her six rooms: the cockpit in the blister on her nose, the
passage with the airlock to port and the docking collar to starboard, the
hold and the engine room, with a bar across each way through. Hover over a
room for its name.

The line at the bottom left says where you are, for example
`LAUNDRY · Rim 2:00, aft · 0.9 g` or `LIFT 3 · climbing hubward`. Aboard a
ship it shows the room and the ship's class where it's known:
`COCKPIT OF THE MULE · prospecting skiff`. In Zennor, whose rooms have no
address, it shows the town: `THE SQUARE · Zennor · 1 g`. In your workshop or bunk
it names it and its door: `JUNIPER'S SMALL WORKSHOP · off Workshop Row · 0.3 g`.
Anywhere else off the station
plans, the deck plan dims, nothing is lit, and the line shows the room
you're in.

Both parts zoom with the scroll wheel or the **+** and **−** buttons and pan
by dragging. **⌂** resets the view.

---

## Settings

Settings are in the Mallard plugin settings panel.

**Turn the station to face you** — When on (the default), the wheel turns so
your location faces the camera. When off, the model holds still with 12:00
at the front, and your place still glows.

---

## Installation

Empyreal Map will be published to the Mallard marketplace. Until then, build
the package (see Packaging below) and install the `empyreal-map-<version>.mallardx`
file with Mallard's **Install from file…**, or use the dev install.

### Dev install

Link the repository into Mallard's development plugin folder, then reload
plugins in Mallard:

```bash
ln -s "$PWD" ~/.local/share/net.mallard.app/plugins-dev/broaty.empyreal-map
```

### Packaging

```bash
npm run pack
```

This writes `empyreal-map-<version>.mallardx` with `plugin.toml`,
this README, `src/` and `ui/` (without the tests).

---

## Development

```bash
npm install
npm test            # vitest for the UI and data code, then the Lua tests
```

**Preview.** Serve the repository root and open the preview, which runs the
panel in a browser with a stand-in for Mallard and a **▶ Walk** button that
replays a walk round T.I.S.S., then flights to Orrin Station, Wenna Halt and
the four halts and a walk round each, then a landing at Zennor and a walk
round the town:

```bash
python3 -m http.server 8765
# http://localhost:8765/dev/preview.html
```

`?step=N` jumps to step N of the walk, `?scene=belt` (or `parked`, `travelling`, `port-day`, `port-night`) opens on a
space scene, and the menu in the bar switches it. `?work=scanning` (or `assaying`, `mining`, `idle`)
opens on the belt with the ship at that work. `?debug` shows how often the model
turned and redrew.

### Rebuilding the station data

The T.I.S.S. map (`ui/data/station.js`) is built from the GMCP room frames in
your Mallard session logs, plus the hand-written corrections in
`data/overrides.json`:

```bash
npm run build:data
npm run build:data -- --logs /path/to/logs   # another log folder
```

By default it reads `~/.local/share/net.mallard.app/logs/empyreal-7`. Commit
the regenerated `ui/data/station.js`.

Orrin Station's nine rooms (`ui/data/orrin.js`) are copied from
`content/areas/orrin.yaml` in the Empyreal source: ids, names, addresses and
exits. Nothing is placed by hand: each room's cell comes from its address
(`Deck 3, frame 2, port 1`), and a test checks the file against the YAML
when `~/dev/empyreal` is there. What the addresses don't say (colours, the
blister, cradles) is in `DECKS` in `ui/lib/decks.js`. The four halts
(`ui/data/morvah.js`, `gwithian.js`, `carrow.js`, `lanyon.js`) are copied
from their area files the same way, and checked the same way.

Wenna Halt's six rooms (`ui/data/wenna.js`) are written by hand from
`content/areas/wenna.yaml`. The game gives that area no layout, so the rooms
are placed from their exits and descriptions. What's particular to the drum
(colours, cradles, the ramp) is in `DRUMS` in `ui/lib/drum.js`.

Zennor's fourteen rooms (`ui/data/zennor.js`) are copied from
`content/areas/zennor.yaml`: ids, names, flags and exits, and the area's
gravity. Nothing is placed by hand. The rooms have no addresses or coords, so
each one's place comes from its compass exits, one cell a step, and a test
checks the file against the YAML when `~/dev/empyreal` is there. What the
exits don't say (colours, which open ground is a square, a path or terraces,
the wall) is in `TOWNS` in `ui/lib/town.js`.

---

## AI disclosure

Much of this plugin's code was written with the help of an LLM (Claude). Design decisions, testing, and review are the author's own.
