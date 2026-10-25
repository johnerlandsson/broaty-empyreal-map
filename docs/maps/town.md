# Towns

*Status: built for Zennor, the city. Last updated 2026-10-25.*

## What it is and when it shows

A place on a planet's surface, laid out by its compass exits (`layout: none`
in its area file, station.md §2.6 in `~/dev/empyreal/docs`): no addresses
or coords, and on a planet the compass means the compass. Zennor is the only
one, Tamsin's capital below T.I.S.S., rewritten from a town of fourteen rooms
into a city of 45 (empyreal 94cb413 and 09ea111, `docs/planetside.md` §5,
§7 and §12). A town shows while you're in one of its rooms or your ship is
landed there: while landed, Ship.Status `location` is the port's id,
`zennor`, as a docked ship's is its station's.

| Town | Gravity | Rooms |
|---|---|---|
| Zennor | 1 g | 45 in seven districts, climbing the east side of the Carn's valley, so uphill is east: the Downs at the top (the Landing Field, the Field Office, the Port Office, the Port Road, Downs Station, the Head of the Steps); the Steps down the scarp to the Old Town (the Field Gate, Fore Street, the Square, the Tinner's Arms, Tinners' Hall, Pellow's, Uptown Station, the Ridge Path and the Overlook); the Market Quarter below it (Conduit Square, the Corn Exchange, the Pannier Market, Chandlers' Row, the Salt Pan, Market Hill, Market Station); the Courts west of that; the Rows stepping down to Riverside on the river; and the Terraces downriver to the south. The tram runs four stops, Riverside, Market, Uptown and Downs |

## Where its data comes from

`ui/data/zennor.js`, copied from `content/areas/zennor.yaml` in the Empyreal
source: each room's id, name, district, flags and exits as the YAML has them
(an exit `via: steps` as `{ to, via, seconds }`), the area's name, gravity
and districts (id, name, entrance), and the tram car's stops bottom to top in
`cars`. The car itself is a room that moves, so it isn't one of the rooms and
isn't placed: riding it, the band shows the car instead (cars.md). Nothing
is placed by hand. A
test checks the data against the YAML whenever `~/dev/empyreal` is there.

`placeRooms()` in `ui/lib/town.js` walks the exits from the spec's `root`
(the Square). A city's compass doesn't sit on a grid: Zennor's YAML puts
Market Station (southwest of Conduit Square), Chandlers' Row (west of the
Pannier Market) and the Rolls Office (south of Court Street) all one step
from the same cell, so placing one cell a step, as the town did, pushed rooms
off their exits. Instead, each exit says only which side of the room the next
one is, x east and y north: an east exit's room is in the same row,
somewhere east; a north exit's in the same column, somewhere north; a
northeast one's somewhere north and somewhere east. Every way would rather be
one cell long, and each row and column settles where most of its ways are.
Where two rooms would share a cell, a way would run through another room's
cell, or two ways would cross, the pair is pulled apart along whichever axis
and order stretches the ways least, and it goes again until nothing clashes.
For Zennor four ways come out two cells long (Conduit Square to Court Street
and to the Pannier Market, the Pannier Market to Slate Rows, and the
Embankment to Cistern Lane), and every exit points its true way.

`up` goes the spec's `uphill` way and `down` the other, and both count the
room's `rise`. On Zennor's hillside uphill is east, so the Head of the Steps
is east of the Field Gate and the Overlook east of the Ridge Path. Height is
still never drawn as north (style guide principle 5): on a valley side, up
is a direction on the ground.

What the exits and flags don't say is in `TOWNS` in `ui/lib/town.js`: the
root, uphill, a tint per district (from `DISTRICT_COLOURS`, style guide §4.4:
the Downs docks, the Old Town commons, the Market Quarter concourse, the
Courts offices, the Rows residential, Riverside industrial for its mills and
kiln, the Terraces hydroponics), which open rooms are a square, the garden, a
path, terraces or a lookout, the gate, where a wellhead is, the river and its
bridge, and the district on the flat above the scarp. From the flags:

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

## Bottom band: the city plan

One plan, north up, `N ▲` in the top left corner of the view. It's the ground
seen from above, not a deck: Ground instead of stars and a Plate.

- **Districts.** Each district's cells lie on a wash of its colour at .085,
  the cells drawn whole and faded as one, so neighbours in one district join
  up and the districts read as areas. Its name is in its colour in spaced
  caps with a Ground halo, in an empty cell beside it: the nearest to its
  middle, rather north than south, with no room, way, tram line or river in
  it, no room either side, and few rooms of other districts round it.
- **Cells** are 140 by 96, each room centred in its own.
- **Buildings** are room boxes on Stone footings, tinted by their district.
- **Open ground** (the streets, the squares, the garden, the Ridge Path) is
  Earth, one surface with a dashed Stone edge round its outside and no seams
  inside it. A street is a band 28 wide through its cell, a path 20. Conduit
  Square and the Square are rounded plazas with their wellheads (the Conduit,
  the old well); the Founders' Garden is green on the earth. Doors into
  buildings and the tracks out to the terraces are Earth strips with no edge.
  A way that runs diagonally (Conduit Square to Market Station, the Square to
  Tinners' Hall) is a band at its angle, from edge to edge.
- **The river,** the Carn, is Water down the plan's downhill side: a point a
  row just clear of the rooms in that row and the rows either side, joined
  smoothly and run off the top and bottom of the plan, with a dashed line
  down its middle and its name beside it, rotated, on its longest straight
  reach. Carn Bridge is over the water, so the river runs between it and
  Mill Lane, and the way between them has a Stone parapet each side.
- **The scarp** is a Stone line midway along the Steps, from the top of the
  Downs' rows to the bottom, hatched on its downhill side.
- **The Steps** are a flight of Stone treads on Earth between the Field Gate
  and the Head of the Steps, named "the Steps" in Dim. Hovering shows their
  seconds from the YAML: "about 12 s down, 40 s up".
- **The gate.** The old windbreak wall is gone from the plan: the city has
  grown a long way past it. Where the Steps leave the Field Gate is its arch,
  with a stub of the wall either side.
- **The tram** is a line in Glass at .75 through its four stops, bottom to
  top, straight from stop to stop where that clears every other building,
  else out of the stop half a row south (or north), along, and up into the
  next, as it goes round Pellow's between Uptown and the Downs. It crosses
  streets level. Each stop's box has a faint inner edge in Glass. Hovering
  over the line names it and its stops.
- **The Landing Field** is fused stone (Plate) in Stone blast walls, with three
  scorched pads.
- **The terraces** are green with their rows and a Stone wall along the
  downhill edge. The Lower Terraces, "wider and older, their walls slumped",
  have fewer, wavier rows.
- **Up** from the Ridge Path is switchbacks in Stone, then the plan's dashed
  "up" line east to the Overlook: a bare round top with its bench, its back
  to the wind.
- **Names**: rooms with boxes are named inside them. A street's name, in Dim,
  goes east of it if no way leaves that way, else west, else under it, else
  over it, else just over its way out east; never on the river or across the
  tram's line.

### Framing and zoom

All 45 rooms fit the 380 px panel only at about a fifth of their size, where
a room's 12-unit name is under 3 px. So ⌂ frames your district (its rooms and
its name, padded), not the city; aboard your landed ship, or anywhere off
the plan, the Downs. When you walk out of sight of the view, it re-frames
on your new district; walking near the edge only pans, as on a station.

Wheel or − zooms out as far as the whole city (the plan's own limit, wider
than a station's 1600). As it does, the rooms' and streets' names fade out
between 6.5 and 5 px on screen, and the districts' names never go below 10
px. Past .45 px a unit they move to their districts' middles, a word a line
and without "the" ("MARKET / QUARTER"), so the whole city reads as a map of
its districts. `onView` on the plan does this; `DeckView` calls it with the
scale each time the view changes, and asks the plan's `frame(where)` for
⌂ and its `maxW` for the zoom limit.

## Rooms, compartments and the highlight

All 45 rooms are rooms. The washes, the river, the scarp, the Steps, the
tram line, the gate's arch, the pads and blast walls, footings, terrace
walls, wellheads, switchbacks and the bench are compartments: never lit. The
river, the Steps and the tram line have tooltips.

Lit: a building's or the field's box, a square or the garden, a terrace, the
Overlook's circle, or for a street or path its stretch: a cross from its
middle halfway along each straight way it joins other open ground (stopping
short of a box), so Top of Fore Street lights east, west and north, and the
Head of the Steps only east (the Steps aren't street). Every room has a
tooltip with its name. Aboard the tram the band shows the car and its line of
stops instead (cars.md).

## Info line

The room, its district, the town and the gravity:
`CONDUIT SQUARE · the Market Quarter · Zennor · 1 g`. The rooms have no
address, so the district and the town stand where an address would. In the
380 px panel a long one is cut short with an ellipsis, as the line always is.

## Code

- `ui/data/zennor.js`: the rooms, districts and the tram's stops, from the YAML.
- `ui/lib/town.js`: specs, `placeRooms()`, the index, `locateTown()`,
  `townInfo()`, the plan's layout (links, districts, river, scarp, gate,
  tram, labels), `townFrame()` and the highlight shapes.
- `ui/town-deck.js`: the plan's drawing, and its names by zoom.
- `ui/deck-view.js`: a plan's optional `frame(where)`, `maxW` and `onView()`.
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
- `dev/zennor-walk.js`: the preview's walk, every room once at least, down
  the Steps and back up on the tram; `dev/zennor-walk.test.js` holds each
  step to an exit or a tram stop.
- `ui/lib/stations.js`: the `zennor.` prefix and the `zennor` dock id.
- `ui/main.js`: `town()` wires a town, with its own `locate` and `info`.

## Adding a town

Copy its rooms from the area's YAML into a data file: id, name, district,
flags and exits, and the area's id, name, gravity and districts, and any
cars. Add a spec to `TOWNS` (root, uphill, district tints, open ground, gate,
wells, river, scarp). Add its prefix and port id to `ui/lib/stations.js`,
wire it with `town()` in `ui/main.js`, and add it to the tests and the
preview's walk. The skyline is Zennor's valley; a second town would want its
own section and places for its districts. The sky works for any port the
charts place: `SkyView` takes the port's id, and `SHORT` in `ui/lib/sky.js`
the short names of the stations over it. The river is drawn only for an
uphill of east or west. Where the exits can't all be true at once (a loop
that doesn't close), `placeRooms()` still places every room, but some may
share a cell; check the plan.

## Where it differs from the style guide

- **No stars and no Plate under the plan.** It's the ground seen from above,
  so it lies on Ground. Its colours (Ground, Earth, Stone, Water) are in the
  guide's §4.2.
- **District washes.** A station tints only its room boxes by district;
  the city also lays each district's cells on a faint wash of its colour,
  because at a city's size the districts are what you find your way by.
- **Names that change with the zoom.** Every other plan's labels are fixed
  in plan units. The city's rooms fade out zoomed far out, and the
  districts' names hold a size on screen.
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
