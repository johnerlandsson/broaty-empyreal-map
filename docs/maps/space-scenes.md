# Space scenes

*Status: built. Last updated 2026-11-09.*

## What it is and when it shows

The view ahead from your ship, in the top band, while you're out in your own
ship, or one you crew, undocked. It fades in over the station model and out
again when you dock.

| Scene | When | What you see |
|---|---|---|
| parked | undocked, not travelling, not at a belt | a starfield, barely drifting |
| travelling | on the way somewhere | the stars streaming past as streaks |
| belt | at an asteroid belt | low-poly rocks tumbling past on a faint backdrop, with the ship's sensors sweeping, an assay held on a rock or the laser cutting one while she's at it, and the rocks flowing past the other way while she moves across the belt |
| port | parked over a port (Zennor, Dolcoath), not landed | the planet's face across the lower band in its low-poly facets, the sea far off where it has one, with the port on it as its hull describes it, Zennor's town or Dolcoath's pit, lit or dark, under the still stars |
| orbit | in high orbit over a planet (`travel tamsin`) | the planet's face, rounder than over a port, drawn by its climate in its star's light (a giant by its envelope, with its bands) and no town, lit or dark as her side faces the star, or a dusk between when that isn't known, under the still stars |
| station | docked at a station, or not aboard a ship you own or crew | nothing: the station model shows |

## Where its data comes from

`src/station_map/scene.lua` folds `Ship.Status` (docked, destination,
location) and `Space.Charts` (which places are belts, which bodies are ports)
into the scene, the station you're docked at, the port you're over and the planet you're in high orbit over. `Ship.Status` comes for the ship you're aboard and
can fly, your own or one you crew (crew get `leaseLeft` null, which the
plugin doesn't read), so only as a guest aboard someone else's ship does the
scene stay `station`.

**Docked at another ship** (a skiff at a freighter's collar), her own
`docked` is true with no `location`, since she's at no station, and
`Ship.Status`'s `host` says where her host is: `docked`, `location` and
`destination` as the top level has them, but the host's (gmcp.md §8.2 in
`~/dev/empyreal`, since 2026-10-22). She rides where her host goes, so the
scene and the station are read from `host` when it's set: a host under way
is `travelling`, one at rest at a belt `belt`, and one docked at T.I.S.S.
with the skiff at her collar the T.I.S.S. model. Before `host`, the plugin
read `docked` as "at a station" and kept showing the last station while the
freighter travelled.

**The ship's work at a belt.** `src/station_map/work.lua` folds `Ship.Devices`
(gmcp.md §8.2 in `~/dev/empyreal`) into what the sensors and the laser are
doing: each one's `busy` verb, when it began and when it ends, both as local
times (`os.time()` seconds), posted as the `work` message:
`{ sensors = { busy = 'scan', since = 1000, ends = 1010 }, laser = { busy = 'mine', since = 990 } }`,
each only while busy. Since 2026-10-23 (Empyreal 7dc0991) each device has
`left`, the seconds to its activity's end, re-sent only as that end changes,
so the client counts down; the end is now + `left`, and a re-send a second
off by rounding keeps the end it had. At a belt the sensors are `busy` with
`scan` (a sweep for rocks, par 10 s, paced by the user's skill, or by a
program at par) or `assay` (one rock, par 20 s), and the laser with `mine`,
which has no end (`left` is null: it cuts in 30 s cycles until the rock is
gone, the hold is full or something stops it, `mining.ts`'s `startMine` sets
no `ends`). The same verb again after the last one ended is a fresh start.
`Ship.Devices` is only sent aboard a ship you can fly and isn't cleared when
you leave her, so the last frame stays until the next, but it's only drawn
in the belt scene. The panel works out how far through and how many seconds
are left from the wall clock (`work()` in `ui/lib/space.js`).

**Moving in the belt** (mining.md §2.3 in `~/dev/empyreal`, 8eb5113 and
d731230, 2026-10-23). Since then a belt has a frame: Ship.Status's `belt` is
`{ x, y, radius, core_km, core_bearing }` in km from its core, to a tenth,
null outside one, and two things move her across it at the thrusters' pace
(0.25 km/s at full drive, eased with it):

- **`rcs`**, a nav activity: `busy: 'rcs'` with `left` to the move's end
  (5 km in about 20 s). `halt` or `stop` leaves her where she's got to.
- **Closing on a rock.** `mine` on a rock beyond 0.5 km moves her there
  before it cuts. The laser is `busy: 'mine'` all the way, with `left` null as
  ever, and nothing in GMCP marks the approach: only her `belt` x/y changing
  each second says she's moving. It cuts once she's beside the rock. `mine`
  while an `rcs` is under way stops the move and closes from where she is.

`work.lua` keeps nav only while it's `rcs` (dock and undock are
`manoeuvre.lua`'s) and folds Ship.Status's `belt` in too: when her place last
changed, as a local time, and the way she went between her last two places,
in degrees from straight out from the core where she was (0 out, 180 in, 90
round it clockwise), held over from the last move within 0.5 km of the core,
where there's no out. Her laser target comes with it, for the card. The `work`
message gains `nav = { busy = 'rcs', since, ends }` and `belt = { moved, way,
target }`, the latter while she's in a belt. A first place in a belt (arriving,
undocking) isn't a move.

The panel's `work()` calls her moving while nav is busy with `rcs`, or while
the laser is busy with `mine` and her place has changed since the cut was
ordered and within the last 2.5 s (the game sends it a tick apart, Lua
stamps it in whole seconds, and the tenth-km rounding can skip a tick). A cut
just ordered holds its beam for those 2.5 s until it's clear whether she's
closing first. So a rock within reach starts cutting a couple of seconds after
the order, and one further off once she's stopped beside it.

A scan or assay run by a cartridge program shows the same as one by hand:
`busy` is the device's, whoever started it. The plugin doesn't ask for or
show what a scan found or an assay said; the game tells the player that in
words, and the map stays out of it (no spoilers).

**Over a port.** Arriving above a port, *"You arrive over Zennor. 'land' to
bring her down."*, she's at rest with `location` the port's id and `docked`
false. A port is a body of kind `port` in Space.Charts (among `places` it's a
`station`, gmcp.md §8.4), so the scene is `port` and the scene message names
it (`{ scene = 'port', port = 'zennor' }`). Landed, she's docked there, and
the scene is `station` as at any station.

**Lit or dark** is the game's canopy's (`isDay` in
`packages/game/src/systems/ground.ts`, planetside.md §3.1 and §4): day when
the star is above the town's horizon. A port's `orbit` is round its planet at
the planet's radius with its period the planet's day, so `daylit` in
`ui/lib/orbits.js` works it out from Space.Charts at the wall clock: the way
straight up from the planet's centre through the town, against the way to the
star. At true size the star is 1.00 TU (71,400,000 km) off and Tamsin 6,400 km in radius, so
the terminator falls a two-hundredth of a degree past the quarter turn: in
effect at it, as in the game. The view
asks once a second and cross-fades (1 per second) when the answer changes;
Tamsin's day is 4 hours, so a session sees a dawn or a dusk. There's no
twilight look: the canopy says only lit or dark. Until the charts can place
the town it keeps what it last showed, the day side at first. This is no more
than the player knows: the canopy tells them, and the orbits are the ones the
chart draws.

**In high orbit** (navigation.md §6 in `~/dev/empyreal`, 2a84c78,
2026-10-24). `travel tamsin` flies her into high orbit over Tamsin, 1.5 times
its radius out on the side she comes in from: *"You come into high orbit over
Tamsin."* The game treats it as a point riding with the planet, so
`Ship.Status` has `location` null there, as it has after a stop mid-trip, and
`docked` false. Her `status` names it: *"over Tamsin"*, the game's
`statusText`, which says "over" only there (over a port it's "at Zennor").
`scene.lua` matches the name to a body of kind `planet` in Space.Charts, when
the scene is worked out, so charts that come after the status still name it.
That covers a plugin loaded with her already up there, and a short hop: in
play (2026-10-24) the 3 s hop from T.I.S.S. to Tamsin came and went with no
status under way, so the plugin never saw a trip. A host's whereabouts carry
no status, so failing that, a trip whose destination is a planet that has
come due, its `eta` run out to within 5 s as `charts.lua` has it, followed by
a loose status, is high orbit over that planet; a loose status well before
then is a stop on the way, `parked`. It holds until she sets off or docks
somewhere. The scene message names the planet
(`{ scene = 'orbit', planet = 'tamsin' }`). A host in high orbit puts her
guest there only if the plugin saw the host's trip. Planets can't be docked at, so a dock
from high orbit never times a station's approach.

**Her side, lit or dark.** The game puts her on the side she came in from:
the way from the planet's centre to where she was when she set out. The scene
takes it from the chart's ship (orrery.md): `charts.lua` keeps the trip she
came in on, its start and when it began, and `orbitLit` in `ui/lib/orbits.js`
asks the same thing `daylit` asks of a town, whether the way straight up from
the planet's centre through her is against the way to the star. It's asked
once a second and cross-fades as over a port. With no trip known (above, or
the trip had no start the plugin saw) it's a dusk, halfway between day and
night, rather than a guess. That's the usual case for a short hop, where
the status gives the planet and no trip. The game aims from where she was when the course
was plotted, which may be a little before she set out, so a trip plotted long
before it's flown can put her side a few degrees off.

## Docking and undocking

Undocking and docking take time in the game, and the overview takes the same
time: the scene still changes when `docked` flips, but the station gets there
first.

**What the game says** (`~/dev/empyreal`, since 7dc0991, 2026-10-23). The nav
device's `busy` in `Ship.Devices` is `undock` while she backs out of the berth
and `dock` while she runs in, and its `left` is the seconds to the end. It's
re-sent only when the end changes (`sendShipGmcp` in `gmcp.ts`), never as it
counts down, so the plugin counts down itself. In `Ship.Status`:

- **Undocking** (`startUndock`/`tickUndock` in `systems/space.ts`): `docked`
  stays true and `location` the station for the whole run (her `status` says
  "undocking from"); `docked` flips to false as it ends. It's 10 s
  (`content/game/actions.yaml`), 15 s if the pilot's check fails.
- **Docking** (`startDock`/`tickDock`): she's at the station's approach, so
  `docked` is false and `location` the station's id the whole run; `docked`
  flips to true as it ends. It's 20 s, but the drift call a third of the way
  in can hold it: `left` sits at 0 until it's answered, and an answer can bring
  the end 5 s earlier, which is re-sent.

**What the plugin keeps.** `src/station_map/manoeuvre.lua` folds
`Ship.Devices` into the nav's verb while it's `dock` or `undock` with a known
`left`, its end as a local timestamp (`os.time()` + `left`, fixed on arrival),
its start, and the station it's about. The game sends no length, so a run
first seen with less than its par left started that much before, and one with
more (the failed undock) started then. A resend whose end is within a second
of the last is the same end. Anything else, an odd shape or null, clears it.
`S.manoeuvre_at` in `scene.lua` names the station: undocking, the one the
scene shows you docked at, your host's if you're at a ship's collar in a bay;
docking, the one whose approach you're parked at. A port's landing and
lift-off are left alone (the ground has a picture of its own), and so is a
run off a host out in space, where the picture is the host's either side.
Off the ship, `Ship.Status` null clears it, since `Ship.Devices` stops coming.
The panel gets `manoeuvre`: `{ verb, left, total, at }`, or `{ verb = nil }`,
with `left` counted to the moment it's posted, so `ready` replays what's left.
Since Empyreal 96249e1 (channels.md decision 39) she first calls Control and
waits for the answer, the nav busy `dock` or `undock` with `left` null: that's
no run here, and the cleared frame, with `left`, starts one with its full par.
The wait is a card in the deck band instead ([corner-cards.md](corner-cards.md)).

**What the panel draws.** One number, how far away the station is (0 as
docked, 1 backed out of the berth), drives it (`awayAt`, `awayLook` in
`ui/lib/space.js`). Undocking it goes 0 to 1 over the run, docking 1 to 0,
eased at both ends; past the end it holds, as a dock does waiting on the drift
call. While a run is on, the space canvas is see-through: no Background, only
the parked stars at that strength, over the station model, which shrinks in
its framing to a twelfth of its size and fades in the last fifth of the
distance, its own backdrop of stars giving way to the canvas's (`setAway` in
`ui/model-view.js`, its zoom buttons hidden). Undocking ends with the station
a speck gone into the stars as the scene turns `parked`; docking ends on the
model as docked as the scene turns `station`, so neither change shows a seam.
Docking draws the model of the station being approached, which isn't yet the
one you're docked at. Opened part-way, it starts from what's left. A run that
stops early (`stop`, a fault, the host gone) eases back to where the scene has
the station, at 1.5 per second, and the model is put back as it was.

**Docking at a ship.** `Ship.Status` doesn't say whether a dock at a station's
approach is for a berth or for a ship parked there, so it's drawn as the
station's; if she ends up at the ship's collar, the scene stays `parked` and
the station eases back into the stars. This is no more than the player knows:
it's their own ship's manoeuvre, timed as their prompt times it.

## Top band

A canvas over the model: the Background, then stars or rocks. Rocks use the
models' three Tones and Model edge, so they look of a piece with the
stations. Stars ease up to speed and down again; stars cross-fade to rocks.
No controls and no highlight; the model's zoom buttons hide under it. The
system chart (the ◎ button, see [orrery.md](orrery.md)) can cover it; the scene
keeps its state and its loop stops until the chart is turned off, when it's
already at what it's become: a scene that changed under the chart or the lanes
map doesn't fade in again over the station model.

Over a port, the planet's limb is a wide arc across the band, its top a little
above halfway down, with the still stars above it (dimmed by half by day: a
sunlit face outshines them) and its air over the limb as from high orbit. The
town sits in the middle of the face, its size by the band's width and the
face's height. The face is the planet's own, in the same low-poly style as from
high orbit ("Over a port's face", below); a port `worlds.js` doesn't know is
the old dusty ochre (`#6e5a44` at the limb, `#8a7052`, `#5c4936`), or the Pit's
cold grey, with Glass at the limb:

- **By day:** Tamsin's facets with darker dust patches; the landing field in the
  room colour (`#b89a74`) with three pads ringed in `#e3d3b8`, and low roofs in
  the models' two lighter Tones with a Model edge shadow. *"Low roofs and a
  landing field marked out in the dust."*
- **By night:** a near-black face (`#121821` to `#080b11`), the town a scatter
  of lamps in the Porthole colour, the field a faint outline and a beacon at
  each corner blinking in turn in the busy status light (`#e8b04a`). *"A
  scatter of lights and the landing field's beacons blinking."*

**Over Dolcoath** the port is the Pit, drawn as its `pit` hull's exterior has
it (content/game/hulls.yaml): *"A vast terraced pit in the frozen ground, its
benches stepping down to a floor marked out in pads, a winding house standing
over the shaft at its edge."* John's pick E
(`reference/dolcoath-overview-options.png`, 2026-11-07); D (the benches as
smooth oval rings) and F (the pit seen at a slant) were turned down.

- **By day:** Orrin's ice in facets, no dust, no sea (its `coast` is 0). The pit is angular and low-poly: ten corners, a little uneven, as a
  dug pit is, squashed to the scene's slant, and six benches stepping down to
  the floor, each a wide tread in the light Tone and a narrow riser in the
  middle Tone where its wall faces the light (from the upper left) and the
  dark one where it doesn't, all edged in the Model edge. The haul road spirals
  down round them, dashed. The floor is steel plate (`#5d6470`), the pads'
  plates a shade lighter with three pads ringed in `#e3d3b8`, the winding house
  a box in the dark Tone at the floor's north edge with the shaft's black collar
  under it, and the Drops' crushed stone at its south end.
- **By night:** the pit is a black hole in the dark face. The floodlights
  light the floor and leave the terraces black (the Pit's floodlights,
  content/areas/dolcoath.yaml): a warm glow over the plates in the Porthole
  colour, the pads faintly ringed, and a beacon at each corner of the floor
  blinking in turn as the field's do.

Which way a port is drawn comes from its hull. Space.Charts doesn't say, so
the data build carries each dock's hull from world.yaml into
`ui/data/places.js` (`hulls`), and `main.js` hands the map to the space view:
`pit` is the Pit, anything else (Zennor's `port`) the town. Zennor looks as it
did. The Pit has its own seeded generator, so the town and the cloud are the
same as before.

The ground fades in and out with the scene, as rocks do.

### Over a port's face

(The far sea of `docs/maps/reference/port-looks-mockup.html`, rendered in
`port-looks-options.png`, picked 2026-11-09 over land only, coarse facets,
valley relief, a river, lakes and a river to the sea.) The face below a port
is its planet's face from high orbit (below) seen from much lower: the same
colours in the same star's light, and facets the same size on screen, 17 px
(`PORT_CELL`), laid as a jittered grid over the band rather than round the
curve. `portFacets` in `ui/lib/worlds.js` works them out once a port and band
size.

**The sea, far off.** `worlds.js` gives each port its planet and its site's
`coast` (system.yaml, weather.md §3 in `~/dev/empyreal`: how close the sea's
influence is, 0 none). Where the planet has seas and the port a coast, its sea
lies along the far horizon on one side, the port's seed saying which, reaching
in from the limb 0.8 of a facet for each 0.1 of coast, with a slow wave along
its shore, and never within 2.2 town widths of the port: the port stands on its
own land, the sea some way off. Zennor's 0.2 puts Tamsin's sea on the left
of the horizon; Dolcoath's 0, and Orrin's ice, give it none. A sea with no
`sea` share is none in either scene. An airless world's port has the same hard
grey limb and no glow as from high orbit (`drawAir` and `drawLimb` are the two
scenes' one drawing of air). No river or lakes:
the prose has Zennor's river, but nothing places it, and lakes would be made up.

In high orbit (option B of `docs/maps/reference/high-orbit-mockup.html`,
rendered in `high-orbit-options.png`), she's half the planet's radius up, so
it looks rounder than over a port: the limb is an arc of 0.78 band widths'
radius, its top a little short of halfway down, falling away to both lower
corners. Its night face is the port's, near-black; by day it's drawn by what the
game says of the world, under "A world's face" below. No town, no dust and no
lamps. Shared by every planet:

- **The limb** darkens toward the edge (to .3 of the Background on a world
  with a climate, .45 on a giant), and by day its air glows 16 px out from it
  (22 under a veil), at .26 by day and .04 by night times the air's glow, over
  a 1.5 px rim in the same colour. An airless world has no glow and a hard
  1 px grey rim (`rgba(120,130,145)`).
- **Unknown side:** a dusk, the day and night faces half and half, the stars
  dimmed by a quarter.

The face's size doesn't depend on the radius: high orbit is always 1.5 radii
out, so every planet looks the same size from there.

### A world's face

(Option B of `docs/maps/reference/world-looks-mockup.html`, rendered in
`world-looks-options.png`, picked 2026-11-09.) Empyreal gives every solid world
a `climate` in system.yaml (albedo, air in bar, greenhouse, gases,
volatiles), every gaseous one an `envelope` (below) and every star a temperature and stage (worlds.md, atmospheres.md
and stars.md in `~/dev/empyreal`). The build reads them and writes
`ui/data/worlds.js` (sync.md): each star's colour, and each planet's face as
the game's own physics has it. It imports the game's `climate.ts`,
`stars.ts` and `tides.ts`, as it does `port-words.ts`, so what's ice, sea or haze is the
game's answer, not a copy of its formulas:

| `worlds.js` | From the game | Drawn |
|---|---|---|
| `stars.<id>.colour` | `starColour(temperature)`, the canopy's word; null for a star with no surface | the light the face is seen by, and the star on the chart and the lanes map (style guide §13) |
| `planets.<id>.star` | up its orbits' parents | whose light |
| `air` | `climate.air` | the limb's glow, by its log: 0.17 at Penwith's 0.015 bar, 0.51 at a bar, 1 at Lelant's 90; none airless |
| `albedo` | `climate.albedo` | how bright rock is (ice a little) |
| `ground` | `ice` where any volatile's `surfaceOf` is ice, else `rock` | ice near-white, rock a brown-grey |
| `frost` | a trace whose `phaseOf` is ice, on rock | about one facet in seven half-way to white |
| `seas` | each volatile whose `surfaceOf` is seas, with its `sea` share | clumps of facets over about that share: water deep blue, anything else (methane, ethane) near black |
| `veil` | `veilOf`, the substance's `veil` words that `look` from orbit says | the whole face in the colour its words name (`VEIL_WORDS`, "rust-brown" at Lamorna, "pale yellow" at Lelant), nearly flat, with nothing under it shown |
| `giant: true` | an `envelope` instead of a `climate`: a gaseous world | its envelope's colour in facets in its star's light, its 22 bands over them, 1.6 times as strong (option B of `port-giant-looks-mockup.html`, picked 2026-11-09); see "A giant's face" below |
| `ports.<id>` | its `surface.parent` and `site.coast` (0 where none) | the face below it and its far sea (above) |

Drawn as low-poly facets, as the station model and Dolcoath's benches are:
7 rings down from the limb by 16 columns across, two triangles a cell, the
inner points jittered, each shaded by which way it leans and darker further
down the face, seeded by the planet's id so it's the same every time. Every
colour is seen in its star's light at `TINT` .45: an eye in that light
half-adapts to it, so Orrin's ice under orange Senara is still ice, and
Kynance under blue-white Piran is the "white curve … in a blue dusk" its prose
has. That's what players read: Tamsin "brown, white and a little blue" from
T.I.S.S. (its white is weather, not drawn), Lamorna "a dim curve of rust-brown
haze" from Lamorna Light, Henwood "green and grey" and Pensilva "a brown
curve" from their stations.

**No weather.** What the canopy says of cloud, "Whorls of cloud drift across
it", is weather (`fromSpace` in weather.ts), which changes and isn't in GMCP,
so no world has cloud on it; the veil is drawn because it doesn't change.
A planet `worlds.js` doesn't know (a build older than it) is drawn as before,
Tamsin's ochre with bands. `dev/worlds.html`, served over http, draws every
port from above and every planet from high orbit in the data, by day
(`?night`, `?dusk`, `?only=a,b`), for checking a sync at a glance.

### A giant's face

(Option A of `docs/maps/reference/giant-envelopes-mockup.html`, rendered in
`giant-envelopes-options.png`, picked 2026-11-13.) Since empyreal b6728d0
every gaseous world authors an `envelope` in place of a climate: its gases
and their shares, its albedo and its heat from inside in W/m² (planets.md
§3.1–3.2). The game's site shows them on each planet's card, so they're no
spoiler. The build reads them with the game's own code and writes only what
the face needs (`envelopeOf` in `scripts/source/worlds.mjs`):

| `worlds.js` | From the game | Drawn |
|---|---|---|
| `albedo` | `envelope.albedo` | how bright the face is: full at a Jupiter's .34, Caradon 1's .1 about half (`envelopeBright`) |
| `clouds` | the gas of its cloud deck: of its gases, those climate.ts's `phaseOf` has ice or liquid at 1 bar and its 1-bar mean (`envelopeTemperatures`, with `specificHeat` of its gases), the one with the lowest boiling point, as it lies highest; null where none condenses | the deck's zones and belts (`DECKS`): ammonia Jupiter's cream and tan, water and carbon dioxide white, any other gas a plain pale grey; null is clear hydrogen seen deep, a pale sky blue |
| `methane` | its methane share over 2% (about Uranus's and Neptune's), at most 1 | takes red, a little green and less blue out (`METHANE_PULL`), so a clear world goes blue-green; over a deck half as much (`OVER_DECK`), the light coming back from higher up |
| `embers` | its night side's 1-bar temperature from `envelopeTemperatures`, 0 at the Draper point (798 K) to 1 at 1,500 K; the world is locked by the loader's rule (`lockTime` from tides.ts at an envelope's tidal quality, round a main-sequence, subgiant or giant star, with no `day` of its own) | by night, its facets dull red by their own light (`emberRgb`), each a little different and dimmer down the face, cross-faded with the day face as she passes the terminator; none at 0 |

Today that gives the four cold Jupiters (Morvah, Keyne 5, Germoe 3,
Kilmar 4) ammonia cloud, the cool sub-Neptunes (Maelor 2, Petroc 2,
Breage 4, Trencrom 3) water and Goonhilly 3 carbon dioxide, white tinted a
little blue-green; the ice giants, the warm sub-Neptunes and Garrow 2, a
warm Jupiter too hot for ammonia, are clear: blue-green, Garrow 2 a paler
blue with its tenth of the methane. Caradon 1, a locked hot Jupiter, is
clear and dark by day, and its 1,000 K night side glows. No other night
side is hot enough.

The facets are one colour, the deck's zones and belts half and half, shaded
as a rocky world's are. Its bands go over them as before, in its zones'
colour a quarter of the way to white, in its star's light, and its air glows
over the limb in clear air's colour a third of the way (a half, on a clear
world) to its zones'. Nothing records what tints Jupiter's belts, so a cold
Jupiter's tan is the map's, after Jupiter's, not the game's. The temperatures
at 1 bar are where the deck is taken, not where real clouds lie, which is a
little higher and colder: Jupiter's ammonia cloud is near 0.7 bar.

A giant whose envelope `worlds.js` doesn't know (a planet written as a bare
`giant`) is the old ochre (`GIANT`) under the old cream bands (`GIANT_BANDS`),
with clear air's glow.

**Drawing it.** A face's facets are drawn once, at full alpha, onto a canvas
of the band's size, each triangle filled and edged in its own colour, and kept
while the planet or port and the band's size hold (`faceImage`). The scene
draws that canvas whole at whatever alpha it's fading or dusking at, so a facet's
edge is never laid over its neighbour's twice, and a frame draws one image, not
hundreds of triangles. The last planet and port shown are kept when the scene
moves on, so leaving high orbit or a port fades the face that was there, not the
old ochre.

**Light at a moon.** The build lights a world with a climate at the distance of
whatever it orbits that orbits the star, as the game's loader does
(`lightOn`): a moon at its planet's distance, not its own from the planet.

**The report.** Of a planet's `climate` the build reads the five fields in
`CLIMATE_FIELDS` (worlds.mjs), of its `envelope` the three in
`ENVELOPE_FIELDS`, and its `gravity`, and reports any other, as
`planet.climate.<field>` or `planet.envelope.<field>`, so a new one isn't
missed.

**At a belt, the ship's work** (style guide §12) is drawn over the rocks, and
fades with them:

- **Scanning:** a line in the ok status light (`#59d18a` at .8) crosses the
  band left to right, from where the scan began to its end, with a faint wash
  (.05) behind it and a 40 px glow trailing it. A scan the game gives no end
  for sweeps round at its par.
- **Assaying:** corner brackets round one rock and a ring about it filling
  clockwise from the top over the assay's time, in the same green.
- **Mining:** the laser's beam from below the band, where the ship is, onto
  the rock's near face: a Glass glow, a Glass beam and a white core,
  flickering, with a white-hot glow and sparks where it bites.
- **Moving** (`rcs`, or closing on a rock): the rocks flow past opposite her
  heading, the near ones faster (30 px/s for the farthest to 140 for the
  nearest), easing in and out (1.6 per second) and turning to a new heading
  (2 per second) in place of the idle drift. Up the band is straight out from
  the core, so `rcs out` streams the rocks down, `rcs in` up, and a bearing
  round the core sideways.
  Until her place first changes (a second into a move) the rocks drift as
  ever. Closing on a rock, there's no beam: it comes on once she's beside it.
  Nothing else marks it: no wakes, no thruster glow (option A of
  `docs/maps/reference/belt-motion-mockup.html`). The move's seconds go in the
  deck band's corner card ([corner-cards.md](corner-cards.md)), not here.
- **The countdown** is in the bottom-right corner, Dim, 10: `cutting` over
  `sweeping · 6 s` or `assaying · 8 s`, with the seconds dropped when there
  are none left (the game is about to say it's done). Mining has no seconds:
  it has no end.

The rock an assay or the laser works is a near one nearest the middle of the
band, held still while the work goes on (she's come alongside) and let go
when it ends. While she closes on a rock no rock is held, so the one the beam
finds when she stops is whichever is near the middle then. It's not the
game's rock: the rocks are scenery, and a sweep never adds, counts or places
any. The work shows only that it's happening and how long is left, and the
flow only that she's moving and which way, from her own place, which the game
tells her.

## Bottom band

Not used. The bottom band shows the ship you're in (see
[ship-plans.md](ship-plans.md)).

## Rooms, compartments and the highlight

None. The ship's work at a belt isn't a highlight: it's not amber and never
marks where you are.

## Info line

Unchanged: it says where you are aboard.

## Code

`ui/space-view.js` (the canvas and frame loop, the ground below a port and the planet from high orbit),
`ui/lib/space.js` (scene targets, easing, starfield, belt, rocks, the held
rock and the flow while she moves, `work()`, `heading()`, `moveCard()` and
`workLines()`, the town's layout and the Pit's (`Town`, `Pit`, `groundOf()`), a dock's or an undock's
distance, a giant's bands and `litFor`), `ui/lib/worlds.js` (stars' colours, `faceOf`, `envelopeRgb`, `facets`, `emberFacets`, `portFace`, `portFacets`), `ui/lib/orbits.js` (`daylit`, `orbitLit`), `ui/model-view.js` (`setAway`),
`src/station_map/scene.lua`, `src/station_map/work.lua`,
`src/station_map/manoeuvre.lua`. The preview's `?scene=port-day` and
`?scene=port-night` put Zennor's town on the day or night side, `?scene=pit-day`
and `?scene=pit-night` Dolcoath's pit (with `pitCharts()`, Senara's charts with
Dolcoath placed), and
`?scene=orbit-day`, `orbit-night` and `orbit-unknown` put her in high orbit
over Tamsin on the star's side, the far side or no side known, come in from
50,000 km off. Their charts are the game's own (`dev/charts-cases.ts`,
orrery.md), Senara's moved on till it's day or night at the port, and
`?game=high-orbit-tamsin&band=scene` and `?game=landed-zennor&band=scene` show
a recorded moment as the game had it. Checked at true size (2026-11-09):
Tamsin 6,400 km, high orbit 9,600 km from its centre, both lit and dark as the
game's sky has them; nothing in the scenes is drawn to km, so none of it moved.
`?work=scanning` (or `assaying`, `mining`, `idle`) opens on the belt with the
ship at that work, a scan or assay starting again a second after it ends, as
a program at par would. `?move=rcs-out` plays the thrusters out from the core for 20 s,
`?move=closing-cut` `mine` closing on rock-12 for 6 s and then cutting, and
`?move=halted` an `rcs in` halted 7 s in, each over and over. `?manoeuvre=undock-tiss` and `?manoeuvre=dock-orrin`
run an undock from T.I.S.S. and a dock at Orrin Station, `&left=N` opening
part-way and `&stop=N` stopping early. The options for how to draw it are in
`reference/dock-approach-mockup.html`, and for her moving in a belt in
`reference/belt-motion-mockup.html` (A, the plain flow, was picked, with out
from the core up).

## Where it differs from the style guide

Drawn on a canvas, not SVG, for the frame rate; the colours are the same. The
planet's face is in colours of its own (above), by its climate and its star's
light, and nothing else in the maps is ground.
