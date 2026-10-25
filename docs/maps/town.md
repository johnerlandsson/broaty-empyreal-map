# Towns

*Status: built for Zennor. Last updated 2026-10-25.*

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
is to see. Under the sky is a still, low-poly skyline in the models' Tones:
the city across the Carn's valley, framed on the district you're in. A taller
band shows more sky, not more ground. + − ⌂, wheel and drag work as on a
model.

### The skyline

Zennor is a city of 400,000 climbing the east side of the Carn's valley
(empyreal 94cb413, `docs/planetside.md` §5.1), and its size is in what its
rooms look out on (decision 17). The skyline is the valley in section,
looking north up the river, so west is on the left as it is on the sky's
dome. From west to east:

- **Westbank**, "as big again as this one", tenements and mill chimneys
  climbing to its own ridge.
- **The Carn** at the bottom, a bright line, with Carn Bridge's five arches.
- **Riverside**'s mills, wheels in the race, a chimney and the Kiln Yard's
  kiln, which never goes out.
- **The Rows**' tenements, four and five storeys, stepping up the slope.
- **The Courts**' buildings of state, pedimented and columned, and the
  Founders' Garden's whitewashed trees.
- **The Market Quarter**: the Corn Exchange's vault of glass and iron, the
  Pannier Market's iron roof, the arcades.
- **The old town**'s low ochre houses and the Tinners' Hall, with the ridge
  of the Ridge Path and the Overlook behind them, and the Field Gate's arch
  at the foot of the scarp.
- **The scarp**, with the tram's rails from Riverside Station up its face
  and the car halfway.
- **The Downs** on top: the winding house and its cable wheel, the Field
  Office, blast walls round the field, the Port Office's squat tower with its
  glass room, fuel tanks half sunk, a mast, then open upland.

Far up the valley to the north the ice cap is a bright line on the horizon,
"where the sky starts" (the Overlook). It shows only through the valley's
notch.

**Framed on your district.** Empyreal.Room's `district`, which the location
message now carries, slides the section so your district stands under the
middle of the sky, and walking down the city slides it west to east. From
the Downs the city falls away below you to the river and Westbank. From the
Embankment it climbs up both sides. Somewhere with no district, the tram car
or your ship on the field, the skyline keeps the last one. Before any
district has come it's framed on the Downs, where you land.

**The Terraces** are south of the city, where the valley widens, and off
the section. Their view is their own: the terraces stepping up the east side
near you, each with a row of crops in hydroponics green and its leat at the
top edge, the Seed House among them. Behind them is the city's section,
small and in darker tones, "city all the way up the valley side, roofs on
roofs to the Downs" (Terrace Road).

**Lamps.** Once the sky is dark (the game's dark: Senara below −5°, when
T.I.S.S. turns a spark), lamps are lit in the windows in Porthole amber,
"from the river to the ridges on both sides". They're lit only out of doors,
where the game tells you it's night. Indoors there's no hour to go by, so
there are no lamps. The kiln glows in the dusk colour at all hours.

The skyline is drawn from the rooms' prose. Nothing in it is a room, and
nothing in it is named or hovered.

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
  side glows warm and a few stars are out. At dawn the sky pales, a glow rising
  from its side of the horizon behind the skyline, and there are no stars,
  since the game's dawn names none. By day the dome
  is tinted a dark, dusty blue-grey, a step lighter for each band: just up,
  low, well up, overhead.

It follows ground.ts's rules to the degree. Dawn and dusk are 10° either
side of the horizon, about 7 minutes with Tamsin turning 90° an hour; that's
the code's, not planetside.md's "half hour". It's "well up" from 30° and
overhead from 60°. It's dark below −5°. Rising and heading are judged a
minute ahead, and time is in the game's whole ticks. Positions use the
game's own Kepler sum, not the chart's, because at a pass exactly overhead
rounding decides whether the game says east or west. The bodies and the glow
draw over the skyline, so nothing the game says is up is hidden.

It's redrawn once a second while it's the band showing, the panel is
visible, and neither the chart (◎), the lanes map (⋈) nor a space scene covers
it.

### Indoors

In a room that isn't open to the sky, or while you're aboard your landed
ship, or before the charts have come, the game shows no sky, and neither
does the band: it's the skyline alone, with no stars, no arc, no lamps and
nothing about the hour. Stepping outdoors brings the sky straight back.

`ui/town-view.js`'s `SkyView` is the sky and the band. `main.js` asks of it
what it asks of a model (`div`, `set()` and `setTurning()`), plus
`setCharts()`, `live` and `draw(t)` for its timer. `set(where, msg)` also
takes the location message, for its `district`.

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
- `ui/town-view.js`: the band and the sky over the skyline.
- `ui/lib/skyline.js`: the valley's section (`VALLEY`), the terraces'
  (`TERRACES`), where each district is across it (`PLACES`), and
  `skylineFor()`, the layers to draw for a district. Pure, tested in
  `skyline.test.js`, including that every district in zennor.yaml has a
  view when `~/dev/empyreal` is there.
- `ui/town-skyline.js`: draws them.
- `src/station_map/location.lua`: Empyreal.Room's `district`, into the
  location message.
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
tests and the preview's walk. The skyline is Zennor's valley; a second
town would want its own section and places for its districts. The sky works for any port the charts place: `SkyView` takes
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
- **Hydroponics green for crops.** The terraces' rows take the hydroponics
  district colour (§4.4) at half strength. Nothing else on the skyline is
  tinted, and nothing is highlighted: which district you're in is said by
  where the skyline is framed, not by amber.
- **A lit sky.** By day the dome is tinted, a step lighter for each of
  Senara's bands, though the scene is otherwise always dark (§4). The tints
  stay dark, dusty blue-greys, so the band still reads as night-dark
  chrome.
- **Open rooms are named in Dim**, beside their band, rather than in Text
  inside a box (§8.2). They aren't boxes, and in Text they'd compete with the
  buildings.
