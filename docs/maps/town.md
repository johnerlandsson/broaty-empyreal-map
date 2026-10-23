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

## Top band: the skyline

Not a model: you're on the ground, and the ground is all there is to see.
A still, low-poly skyline in the models' Tones under the stars, as from the
street: the ridge rising east, the town's low roofs and the Port Office's
squat tower with its glass room, the field's blast wall at the west, and the
salt pans a pale line on the horizon. A taller band shows more sky, not more
ground. Nothing is lit and nothing moves; + − ⌂, wheel and drag work as on a
model.

It stands in for the sky view (zennor-sky), which is planned to replace it.
`ui/town-view.js` is the whole of it, and `main.js` asks of it only what it
asks of a model: `div`, `set()` and `setTurning()`.

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
- `ui/town-view.js`: the skyline.
- `ui/lib/stations.js`: the `zennor.` prefix and the `zennor` dock id.
- `ui/main.js`: `town()` wires a town, with its own `locate` and `info`.

## Adding a town

Copy its rooms from the area's YAML into a data file: id, name, flags and
exits, and the area's id, name and gravity. Add a spec to `TOWNS` (root,
tints, open ground, wall, gate, wells). Add its prefix and port id to
`ui/lib/stations.js`, wire it with `town()` in `ui/main.js`, and add it to the
tests and the preview's walk. The skyline is Zennor's; a second town would
want its own, or the sky view. A town whose exits don't sit on a grid (two
ways into one cell, a loop that doesn't close) is pushed apart by
`placeRooms()`, which keeps it drawable but may not look right; check it.

## Where it differs from the style guide

- **No stars and no Plate under the plan.** It's the ground seen from above,
  so it lies on Ground. Its three colours (Ground, Earth, Stone) are in the
  guide's §4.2.
- **The top band isn't a model.** There's no station to model on the ground;
  the skyline is scenery until the sky view replaces it, and has no highlight
  (§6 lights places on plans and models, and this is neither).
- **Open rooms are named in Dim**, beside their band, rather than in Text
  inside a box (§8.2). They aren't boxes, and in Text they'd compete with the
  buildings.
