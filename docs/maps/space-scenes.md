# Space scenes

*Status: built. Last updated 2026-10-23.*

## What it is and when it shows

The view ahead from your ship, in the top band, while you're out in your own
ship, or one you crew, undocked. It fades in over the station model and out
again when you dock.

| Scene | When | What you see |
|---|---|---|
| parked | undocked, not travelling, not at a belt | a starfield, barely drifting |
| travelling | on the way somewhere | the stars streaming past as streaks |
| belt | at an asteroid belt | low-poly rocks tumbling past on a faint backdrop |
| port | parked over a port (Zennor), not landed | the planet's face across the lower band with the town on it, lit or dark, under the still stars |
| station | docked at a station, or not aboard a ship you own or crew | nothing: the station model shows |

## Where its data comes from

`src/station_map/scene.lua` folds `Ship.Status` (docked, destination,
location) and `Space.Charts` (which places are belts, which bodies are ports)
into the scene, the station you're docked at and the port you're over. `Ship.Status` comes for the ship you're aboard and
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

## Bottom band

Not used. The bottom band shows the ship you're in (see
[ship-plans.md](ship-plans.md)).

## Rooms, compartments and the highlight

None: it's scenery.

## Info line

Unchanged: it says where you are aboard.

## Code

`ui/space-view.js` (the canvas and frame loop, and the ground below a port),
`ui/lib/space.js` (scene targets, easing, starfield, belt, rocks, the town's
layout), `ui/lib/orbits.js` (`daylit`), `src/station_map/scene.lua`. The
preview's `?scene=port-day` and `?scene=port-night` put Zennor's town on the
day or night side.

## Where it differs from the style guide

Drawn on a canvas, not SVG, for the frame rate; the colours are the same. The
planet's face is in colours of its own (above): Tamsin is dry and dusty, and
nothing else in the maps is ground.
