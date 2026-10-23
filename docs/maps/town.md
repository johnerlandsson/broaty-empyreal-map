# Towns

*Status: built for Zennor. Last updated 2026-10-23.*

## What it is and when it shows

A place on a planet's surface, laid out by its compass exits (`layout: none`
in its area file, station.md §2.6 in `~/dev/empyreal/docs`): no addresses
or coords, and on a planet the compass means the compass. Zennor is the only
one, the port of Tamsin below T.I.S.S. (empyreal 86d5b51,
`docs/planetside.md`). A town shows while you're in one of its rooms or your
ship is landed there: while landed, Ship.Status `location` is the port's id,
`zennor`, as a docked ship's is its station's.

| Town | Gravity | Rooms |
|---|---|---|
| Zennor | 1 g | the Landing Field at the north with the Field Office west and the Port Office east; Fore Street south from the Field Gate through the Square (the Exchange west, the Tinner's Arms east) to its foot and the Water House; the Terraces and Lower Terraces below; the Ridge Path east off the top of the street, and `up` to the Overlook |

## Where its data comes from

`ui/data/zennor.js`, copied from `content/areas/zennor.yaml` in the Empyreal
source: each room's id, name, flags and exits as the YAML has them, and the
area's name and gravity. Nothing is placed by hand. A test checks the data
against the YAML whenever `~/dev/empyreal` is there.

`placeRooms()` in `ui/lib/town.js` walks the exits from the spec's `root`
(the Square): a compass exit is one cell that way, x east and y north. Any
other exit (`up`, `down`) carries on the way you came into the room, east if
you didn't, and counts the room's `rise`; height is never drawn as north
(style guide principle 5). A cell already taken pushes the room on further
the same way. So the Overlook, `up` from the Ridge Path you reached going
east, sits east of it, one higher.

What the exits and flags don't say is in `TOWNS` in `ui/lib/town.js`: the
root, a district tint per building, which open rooms are a square, a path,
terraces or a lookout, the rooms inside the town's wall and which room is its
gate, and where a wellhead is. From the flags:

- **A building** is a room without `outdoors`.
- **The landing field** is an outdoor room with `berth`.
- **Street** is any other outdoor room the spec doesn't name.

## Top band: the sky

Not a model: you're on the ground, and the ground and the sky are all there
is to see. Under it is a still, low-poly skyline in the models' Tones, as
from the street: the ridge rising east, the town's low roofs and the Port
Office's squat tower with its glass room, the field's blast wall at the
west, and the salt pans a pale line on the horizon. A taller band shows more
sky, not more ground. + − ⌂, wheel and drag work as on a model.

### Out of doors

In a room open to the sky (`outdoors` in the area file), the band shows what
the game's `look sky` says is overhead, worked out from Space.Charts as the
game's `ground.ts` works it out (planetside.md §4), and moving as you watch:

- **The dome.** A faint dashed arc in Orbit springs from the horizon either
  side of the town, with W and E at its feet. The game's sky has only those
  two directions: everything in it is somewhere on that one arc, from the
  western horizon through overhead to the eastern. A body `alt` degrees up
  sits `alt` degrees along the arc from its side's foot.
- **Senara** is the chart's Star disc with its glow, drawn only while it's
  above the horizon.
- **T.I.S.S.** is a pale fleck by day and a bright spark with a glint once
  it's dark, drawn only while it's above the horizon.
- **Orrin** is a golden star, drawn only when the game names it: when it's
  up and it's dark.
- **Names** in Dim beside each. Hovering over a body gives the game's
  sentence for it ("T.I.S.S. is climbing up out of the west, a bright,
  steady spark."). Hovering over the empty sky gives Senara's.
- **The sky's colour** steps with the game's bands, so it never says more
  than the words. Night is black and crowded with stars. At dusk Senara's
  side glows warm and a few stars are out. At dawn its side pales and
  there are no stars, since the game's dawn names none. By day the dome
  is tinted a dark, dusty blue-grey, a step lighter for each band: just up,
  low, well up, overhead.

It follows ground.ts's rules to the degree. Dawn and dusk are 10° either
side of the horizon, about 7 minutes with Tamsin turning 90° an hour; that's
the code's, not planetside.md's "half hour". It's "well up" from 30° and
overhead from 60°. It's dark below −5°. Rising and heading are judged a
minute ahead, and time is in the game's whole ticks. Positions use the
game's own Kepler sum, not the chart's, because at a pass exactly overhead
rounding decides whether the game says east or west. The bodies and the glow
draw over the ridge, so nothing the game says is up is hidden.

It's redrawn once a second while it's the band showing, the panel is
visible, and neither the chart (◎), the lanes map (⋈) nor a space scene covers
it.

### Indoors

In a room that isn't open to the sky, or while you're aboard your landed
ship, or before the charts have come, the game shows no sky, and neither
does the band: it's the skyline alone, with no stars, no arc and nothing
about the hour. Stepping outdoors brings the sky straight back.

`ui/town-view.js`'s `SkyView` is the whole of it. `main.js` asks of it what
it asks of a model (`div`, `set()` and `setTurning()`), plus `setCharts()`,
`live` and `draw(t)` for its timer.

## Bottom band: the town plan

One plan, north up, `N ▲` top left, framed to the whole town (⌂). It's the
ground seen from above, not a deck: Ground instead of stars and a Plate.

- **Cells** are 140 by 96, each room centred in its own.
- **Buildings** are room boxes on Stone footings, tinted by the spec.
- **Open ground** (the streets, the Square, the Ridge Path) is Earth, one
  surface with a dashed Stone edge round its outside and no seams inside it.
  A street is a band 28 wide through its cell, a path 20. The Square is a
  rounded plaza with its wellhead. Doors into buildings and the tracks out to
  the terraces are Earth strips with no edge.
- **The wall**, the old windbreak, is a rounded rectangle in Stone round the
  spec's walled rooms. It runs through the gate's street, so the gate's arch
  sits on it, and it opens wherever a way goes out through it: the Field
  Gate's arch at the north, the Ridge Path east, the track south.
- **The Landing Field** is fused stone (Plate) in Stone blast walls, with three
  scorched pads.
- **The terraces** are green with their rows and a Stone wall along the
  downhill edge. The Lower Terraces, "wider and older, their walls slumped",
  have fewer, wavier rows.
- **Up** is switchbacks in Stone off the Ridge Path, then the plan's dashed
  "up" line to the Overlook: a bare round top with its bench, its back to the
  wind.
- **Names**: rooms with boxes are named inside them. A street's name, in Dim,
  goes east of it if no way leaves that way, else west, else under it, and
  just inside the wall if it's on the wall's line.

## Rooms, compartments and the highlight

All fourteen of Zennor's rooms are rooms. The wall, the gate's arch, the pads
and blast walls, footings, terrace walls, the wellhead, switchbacks and the
bench are compartments: never lit, no hover.

Lit: a building's or the field's box, the Square, a terrace, the Overlook's
circle, or for a street or path its stretch: a cross from its middle halfway
along each way it joins other open ground (stopping short of a box), so the
Top of Fore Street lights north, south and east, and the Foot of Fore Street
only north. Every room has a tooltip with its name.

## Info line

The room, the town and the gravity: `THE SQUARE · Zennor · 1 g`. The rooms
have no address, so the town's name stands where an address would.

## Code

- `ui/data/zennor.js`: the rooms, from the YAML.
- `ui/lib/town.js`: specs, `placeRooms()`, the index, `locateTown()`,
  `townInfo()`, the plan's layout and highlight shapes.
- `ui/town-deck.js`: the plan's drawing.
- `ui/town-view.js`: the skyline and the sky over it.
- `ui/lib/sky.js`: `groundSky()`, ground.ts's sky from the charts, and
  `skyScene()`, what the dome draws for it.
- `dev/sky-cases.ts` and `dev/sky-cases.json`: the game's own Space.Charts
  and sky text either side of every change over a Tamsin year, which
  `ui/lib/sky.test.js` holds `groundSky()` to word for word. When
  ground.ts or the system's orbits change, re-record:
  `node dev/sky-cases.ts > dev/sky-cases.json`. It runs the game from
  `~/dev/empyreal` (or `EMPYREAL=<path>`), which needs Node 24.7 or later
  and its `node_modules`. The preview's `?sky=` uses the same file.
- `ui/lib/stations.js`: the `zennor.` prefix and the `zennor` dock id.
- `ui/main.js`: `town()` wires a town, with its own `locate` and `info`.

## Adding a town

Copy its rooms from the area's YAML into a data file: id, name, flags and
exits, and the area's id, name and gravity. Add a spec to `TOWNS` (root,
tints, open ground, wall, gate, wells). Add its prefix and port id to
`ui/lib/stations.js`, wire it with `town()` in `ui/main.js`, and add it to the
tests and the preview's walk. The skyline is Zennor's; a second town would
want its own. The sky works for any port the charts place: `SkyView` takes
the port's id, and `SHORT` in `ui/lib/sky.js` the short names of the
stations over it. A town whose exits don't sit on a grid (two
ways into one cell, a loop that doesn't close) is pushed apart by
`placeRooms()`, which keeps it drawable but may not look right; check it.

## Where it differs from the style guide

- **No stars and no Plate under the plan.** It's the ground seen from above,
  so it lies on Ground. Its three colours (Ground, Earth, Stone) are in the
  guide's §4.2.
- **The top band isn't a model.** There's no station to model on the ground.
  The skyline is scenery, and the sky over it is a chart of what the game
  says is overhead, with no highlight (§6 lights places on plans and models,
  and this is neither).
- **A lit sky.** By day the dome is tinted, a step lighter for each of
  Senara's bands, though the scene is otherwise always dark (§4). The tints
  stay dark, dusty blue-greys, so the band still reads as night-dark
  chrome.
- **Open rooms are named in Dim**, beside their band, rather than in Text
  inside a box (§8.2). They aren't boxes, and in Text they'd compete with the
  buildings.
