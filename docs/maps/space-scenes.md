# Space scenes

*Status: built. Last updated 2026-10-22.*

## What it is and when it shows

The view ahead from your ship, in the top band, while you're out in your own
ship, or one you crew, undocked. It fades in over the station model and out
again when you dock.

| Scene | When | What you see |
|---|---|---|
| parked | undocked, not travelling, not at a belt | a starfield, barely drifting |
| travelling | on the way somewhere | the stars streaming past as streaks |
| belt | at an asteroid belt | low-poly rocks tumbling past on a faint backdrop |
| station | docked at a station, or not aboard a ship you own or crew | nothing: the station model shows |

## Where its data comes from

`src/station_map/scene.lua` folds `Ship.Status` (docked, destination,
location) and `Space.Charts` (which places are belts) into the scene and the
station you're docked at. `Ship.Status` comes for the ship you're aboard and
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

## Top band

A canvas over the model: the Background, then stars or rocks. Rocks use the
models' three Tones and Model edge, so they look of a piece with the
stations. Stars ease up to speed and down again; stars cross-fade to rocks.
No controls and no highlight; the model's zoom buttons hide under it.

## Bottom band

Not used. The bottom band shows the ship you're in (see
[ship-plans.md](ship-plans.md)).

## Rooms, compartments and the highlight

None: it's scenery.

## Info line

Unchanged: it says where you are aboard.

## Code

`ui/space-view.js` (the canvas and frame loop), `ui/lib/space.js` (scene
targets, easing, starfield, belt, rocks), `src/station_map/scene.lua`.

## Where it differs from the style guide

Drawn on a canvas, not SVG, for the frame rate; the colours are the same.
