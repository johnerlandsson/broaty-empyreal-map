# T.I.S.S.

*Status: built. Last updated 2026-10-22.*

The full design, with the reasons behind it, is
`docs/superpowers/specs/2026-10-21-empyreal-station-map-design.md`. This doc
is the short version, written against the [style guide](style-guide.md).

## What it is and when it shows

The home station: a wheel of three rings (Rim, Mid, Inner) on four spokes
round a hub, with a despun spine of docks hanging below it beyond the
Bearing. It shows while you're in one of its rooms or lifts, or while your
ship is docked there (`pickStation()` in `ui/lib/stations.js`).

## Where its data comes from

`ui/data/station.js`, 98 rooms, built by `npm run build:data` from the GMCP
frames in Mallard session logs (`mudstd.room.info`, `Empyreal.Room`) plus
hand-written corrections in `data/overrides.json`: closed rooms and their
reasons, Freight Transfer's place, inferred ladderways. The game sends
coordinates for every ring room: `x` in half hours (wrapping at 24), `y`
fore or aft depth, `z` the level (0 Rim, 1 Mid, 2 Inner, 3 Hub and docks).

## Top band: the model

- Rings are flat-sided prisms, one face per corridor stop (12 on the Rim, 8
  on Mid and Inner), each split across the deck into five slices to match the
  plan's rows. Spokes are square shafts of three legs; the hub an octagonal
  prism with the Bearing as a collar; the spine square sections with box rooms
  either side and a stepped Blister at the tip; Freight Transfer a box aft of
  the hub. Bay 1 and Bay 2 are boxes carrying on starboard from the Berths'.
- The wheel turns to bring your hour to the front. The spine, Bearing, dock
  rooms and Blister hold still, as on the real station. In the docks the
  wheel keeps its last turn.
- Ring names (RIM, MID, INNER) and DOCKS are labelled at fixed screen
  positions: the only model with labels.
- Lit: a ring slice for a corridor stop or side room, the spoke leg for a
  lift or ladderway, the section or box for a dock room.

## Bottom band: the deck plans

Four plans, one per level:

- **Rim, Mid, Inner:** the ring unrolled, the corridor left to right with
  spinward right, fore rooms above and aft below, two-deep rooms stacked
  beyond. Hull walls with lit portholes run along the fore and aft edges.
  Each corridor stop is labelled with its hour; lobbies have the lift symbol
  and the ladderway hatch beside it. The plan wraps, so 12:00 follows 11:00.
- **Docks:** the spine up the page, fore up, port rooms left and starboard
  right. The round Hub at the bottom with four lift doors on its clock, the
  Bearing above it, Freight Transfer below, the Blister a dome at the top.
  A room further out than the first (`|x| > 1`) sits one box and a passage
  beyond the one before it, so Bay 1 and Bay 2 run on in a row to starboard
  of the Berths, and the plate widens to take them
  (`reference/tiss-bays-mockup.html`, option A).
- Lit: a room box, a corridor stretch, a lift symbol or the ladderway hatch.

## Rooms, compartments and the highlight

Every room the game has is drawn and can be lit. Portholes and the Bearing's
studs are decoration. Closed rooms are dashed and dimmed, as in the style
guide.

## Info line

`LAUNDRY · Rim 2:00, aft · 0.9 g`; in a lift, `LIFT 3 · climbing hubward`
or `LIFT 3 · at Mid 3:00`.

## Code

`ui/deck-view.js` (plans and `DeckView`), `ui/lib/deck-layout.js` (plan
layout), `ui/model-view.js` and `ui/lib/model.js` (the model),
`ui/lib/geometry.js` (constants, districts, camera), `ui/lib/locate.js`
(where you are, face keys, the info line).

## Where it differs from the style guide

- The ring plans are laid out spinward right, not north up: a ring has no
  north. Fore is still up.
- The only model with labels, since three similar rings need names.
