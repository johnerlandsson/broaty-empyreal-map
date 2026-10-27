# Space scenes

*Status: built. Last updated 2026-10-24.*

## What it is and when it shows

The view ahead from your ship, in the top band, while you're out in your own
ship, or one you crew, undocked. It fades in over the station model and out
again when you dock.

| Scene | When | What you see |
|---|---|---|
| parked | undocked, not travelling, not at a belt | a starfield, barely drifting |
| travelling | on the way somewhere | the stars streaming past as streaks |
| belt | at an asteroid belt | low-poly rocks tumbling past on a faint backdrop, with the ship's sensors sweeping, an assay held on a rock or the laser cutting one while she's at it, and the rocks flowing past the other way while she moves across the belt |
| port | parked over a port (Zennor), not landed | the planet's face across the lower band with the town on it, lit or dark, under the still stars |
| orbit | in high orbit over a planet (`travel tamsin`) | the planet's face, rounder than over a port, with faint cloud on it and no town, lit or dark as her side faces the star, or a dusk between when that isn't known, under the still stars |
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
star. The star is a few thousand km off, not at infinity, so the terminator
falls a few degrees past the quarter turn, as it does in the game. The view
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
The wait is a card in the deck band instead ([action-card.md](action-card.md)).

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
keeps its state and its loop stops until the chart is turned off.

Over a port, the planet's limb is a wide arc across the band, its top a little
above halfway down, with the still stars above it (dimmed by half by day: a
sunlit face outshines them) and a thin rim of Glass for the air. The town sits
in the middle of the face, its size by the band's width and the face's height:

- **By day:** a dusty ochre face (`#6e5a44` at the limb, `#8a7052`, `#5c4936`
  at the bottom of the band) with darker dust patches; the landing field in the
  room colour (`#b89a74`) with three pads ringed in `#e3d3b8`, and low roofs in
  the models' two lighter Tones with a Model edge shadow. *"Low roofs and a
  landing field marked out in the dust."*
- **By night:** a near-black face (`#121821` to `#080b11`), the town a scatter
  of lamps in the Porthole colour, the field a faint outline and a beacon at
  each corner blinking in turn in the busy status light (`#e8b04a`). *"A
  scatter of lights and the landing field's beacons blinking."*

The ground fades in and out with the scene, as rocks do.

In high orbit (option B of `docs/maps/reference/high-orbit-mockup.html`,
rendered in `high-orbit-options.png`), she's half the planet's radius up, so
it looks rounder than over a port: the limb is an arc of 0.78 band widths'
radius, its top a little short of halfway down, falling away to both lower
corners. The face is the port's, in the same day and night colours, with no
town, no dust and no lamps:

- **Cloud:** 22 short bands, each an arc round the planet's centre so it lies
  along the curve, in `rgba(232,220,200)` at .04 to .11 by day and a fifth of
  that by night. Scenery, the same on every planet: the game says nothing of
  weather.
- **The limb** darkens toward the edge (to .45 of the Background), and by day
  thin air glows 16 px out from it in Glass (.26 by day, .04 by night), over
  the Glass rim the port has.
- **Unknown side:** a dusk, the day and night faces half and half, the stars
  dimmed by a quarter.

Every planet is drawn in Tamsin's dusty ochre for now: the charts give a
planet's kind and radius and nothing of what it looks like. The face's size
doesn't depend on the radius: high orbit is always 1.5 radii out, so every
planet looks the same size from there.

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
  deck band's corner card ([action-card.md](action-card.md)), not here.
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
`workLines()`, the town's layout, a dock's or an undock's
distance, the orbit scene's cloud and `litFor`), `ui/lib/orbits.js` (`daylit`, `orbitLit`), `ui/model-view.js` (`setAway`),
`src/station_map/scene.lua`, `src/station_map/work.lua`,
`src/station_map/manoeuvre.lua`. The preview's `?scene=port-day` and
`?scene=port-night` put Zennor's town on the day or night side, and
`?scene=orbit-day`, `orbit-night` and `orbit-unknown` put her in high orbit
over Tamsin on the star's side, the far side or no side known.
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
planet's face is in colours of its own (above): Tamsin is dry and dusty, and
nothing else in the maps is ground.
