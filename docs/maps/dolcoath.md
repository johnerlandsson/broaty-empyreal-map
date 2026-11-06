# Dolcoath

*Status: built. The plans and the cage are done; the top band is words only, and the overview
is a job of its own. Last updated 2026-11-07.*

## What it is and when it shows

Dolcoath is Orrin's city and port, cut down through the rock under an old open pit (empyreal
6441e99, `docs/orrin.md` §4, `help dolcoath`, `help shaft`). It has 59 rooms in five districts at
1.5 g: 58 rooms on foot and the cage. The Pit is the landing field, and three rooms are out of
doors (the Pit, the Drops, the Pithead). Everything else is underground: the Old Levels at 20 and
40 fathoms, the Town at 80, the Smelts at 120 and the Workings at 160, running down to the Bottom
of the Winze at 200.

It shows while you're in one of its rooms or your ship is landed there (Ship.Status `location`
`dolcoath`, as a landed ship's is Zennor's).

| Level | Depth | Rooms |
|---|---|---|
| The Pit | the surface | 7: the Pit, the Field Office, the Port Office, the Drops, the Pithead, the Lamp Room, the Man Engine Head |
| Twenty Fathom | 20 | 7: the station, the man engine, the Exchange, the Count House, the Assay Office, the Shaft Gallery, Wheal Prosper Hall |
| Forty Fathom | 40 | 5: the station, the man engine, the Long Drive, Wheal Kitty Hall, the Head of the Great Stair |
| The Town | 80 | 14, Bal Cross in the middle |
| The Smelts | 120 | 8, Smelters' Road in the middle |
| The Workings | 160 | 15, out past the Lamp Line |
| Pump Gallery | under 160, depth not given | 1, down from the Engine Hall |
| The Bottom of the Winze | 200 | 1, down from the Crosscut |

## Where its data comes from

`ui/data/dolcoath.js`, generated from `content/areas/dolcoath.yaml` by the `levels` builder. The
area has no `layout`, as Zennor has none, so the builder is picked by the `levels` section of
`data/tweaks/dolcoath.json`.

**Which level a room is on** is worked out at build time (`scripts/source/levels.mjs`) and written
as the room's `at: { level }`, 0 the top:

1. The cage's stops seed the levels, its top stop (the Pithead) level 0. The car gives its stops
   bottom to top.
2. Every room a stop reaches by compass exits, through any `via`, is on that stop's level. The
   stops flood together, so a room between two goes to the nearer.
3. A room left over that an `up` or `down` reaches starts a level of its own, with every room
   compass exits join to it, just below (or above) the level it's reached from.
4. The levels go top to bottom by depth. A level takes the depth the tweak's `depths` gives a room
   on it; one without a depth takes the depth of the level it hangs from, so it stays next to it.

The walks alone put the Pump Gallery and the Winze both one level below the Workings. Neither is
joined to the other, so each gets a level of its own. Only the Winze has a depth in the source
(200 FM, in its prose), which the tweak gives it, so it comes last. A room nothing reaches is
reported as `unplaced`. The cage itself is never on a level.

The cage's stops keep their `name`s ("the Town", "Forty Fathom"): the build used to drop them
(`car.stops.*.name`).

**The tweak's `levels` section** has what the YAML doesn't:

- `ground`: open rooms that aren't a street: the Pithead and the Drops are `square`s, as Zennor's
  squares are. The Pit, an outdoor berth, is the landing field without saying.
- `depths`: each level's depth in fathoms, keyed by a room on it. The stations' depths are painted
  on their walls (`help shaft`) and the Winze's is in its prose.
- `names`: a level's name, keyed by a room on it, where its stop's won't do: the Pit, not "the
  Pithead". A level with no stop is called by its room.

`paintDistricts` tints the districts: the Pit docks, the Old Levels commons, the Town residential,
the Smelts industrial, the Workings midring. `paint` makes the Exchange, the city's market,
concourse, as Orrin Station's market is.

## Top band: words

For now, only words over the plan: `DOLCOATH · 1.5 g`, the level you're on (`THE TOWN`), and how
deep it is (`80 fathoms down`, `at the surface`, or nothing where the depth isn't known). Off the
plan, riding the cage or aboard your landed ship, it keeps the last level; before any, the Pit.
`ui/levels-view.js`'s `LevelsBand`. It doesn't use Zennor's sky: `SkyView` is Zennor's valley and
`place-views.js` names `zennor` for it. The overview, the city in the rock, is a job of its own.

## Bottom band: a plan a level

John's pick B (`reference/dolcoath-levels-options.png`, 2026-11-07): one plan a level, switching
as you change level the way a decks station's plans switch decks. A and C (marks inside the rooms
with a depth gauge, and every level stacked in one tall plan) were turned down.

- **Each level** is drawn as Zennor's plan is (town.md), its rooms placed by their compass
  exits (`placeRooms()`), on the plans' Ground, which here is the rock, with each district's wash
  and its name. The cage's station is at 0, 0 on every level and the man engine one cell west, so
  the two shafts line up from the Pit to the Workings. Buildings are room boxes on Stone footings
  tinted by district; the Pit is the landing field in its blast walls with its pads; the Pithead
  and the Drops are open yards of Earth. A room box tints by district except the Exchange.
- **N ▲** is followed by the level's title: `THE TOWN · 80 FM`, `THE PIT`, `PUMP GALLERY`.
- **The ways off a level** are drawn beside the room they leave from, on a side no exit leaves
  by and with no room beyond it: south, else north, west, east. The man engine tries its cage's
  side first, so the two match.
  - **The cage's shaft** is a black well off its station, hatched, with the cage's barred gate in
    it and a dashed gate line to the station. Its words name the stations above and below by
    depth: `▲ 40 FM`, `▼ 120 FM`, `▲ PIT`.
  - **The man engine** is a narrow slot off its room, its rod down the middle in timber and a stage
    across it each stroke. Its words are its seconds each way: `▲ 16 s`, `▼ 12 s`.
  - **The Great Stair** is a flight of Stone treads on Earth running off its room, named
    `▼ the Great Stair`, `▲▼` at its head, where it goes both ways.
  - **A plain way up or down** (the Engine Hall to the Pump Gallery, the Crosscut to the Winze) is
    a small dark well off its room, named for the room it goes to: `▼ Pump Gallery`.
  - **On hover** each says where it goes, by level, with its seconds from the YAML where it has
    them: "The man engine: Up, Forty Fathom, about 16 s; Down, the Smelts, about 12 s". The cage
    names its stations above and below. It has no seconds: its 20 s a level is the car's
    `perStop`, which the build doesn't keep.
- **Bins** are the plans' mark in the room's south-east corner (Bal Cross, Fore Row, Long Row,
  the Market, the Kibble, Smelters' Road, the Crib), as Zennor's are.
- **No light marks.** The Workings past the Lamp Line are drawn like any rooms: the Lamp Line
  and the dark drives are public in `help dolcoath`, and `unlit` rooms aren't marked (John
  declined room light, 2026-11-03).
- **The legend** names the cage shaft, the man engine, the Great Stair and a plain way, where a
  level draws them, with the bins and you are here.

### Framing and zoom

⌂ frames the whole level where it fits, never smaller than 560 by 380 plan units, so a level of
one room isn't blown up. The Town and the Workings are bigger than their names can be read at in
the panel, so ⌂ frames as much as 640 by 460 round your room, kept inside the level. Changing
level re-frames on the new one. Names fade zoomed out as Zennor's do.

## Rooms, compartments and the highlight

All 58 rooms are rooms; the ways off a level, the washes, footings, pads and bins are not, and
are never lit. The ways have tooltips. Lit: your room's box, the field's, or a yard's.

## The cage

The cage is a car (cars.md), declared in the YAML as the tram is, of kind `cage`. Riding it, the
bottom band shows the car itself: an open box of iron bars, 600 by 300 cm as the game has it,
its checker-plate floor worn bright down the middle, a rail round it, the brass panel on its post
with a button a station, and gates, a lattice while they're shut, on the shaft side. Its line of
stations stands upright beside it, the Pithead at the top, each by the name the cage gives it,
and the cage on its station or midway between two with an arrow up or down. The info line is
`THE CAGE · down, the Town → the Smelts`, `THE CAGE · at Town Station`.

## Info line

The room, its district, the city and the gravity, as Zennor's:
`THE EXCHANGE · the Old Levels · Dolcoath · 1.5 g`.

## What GMCP lacks

Nothing the plans need. Each room's level comes from the YAML, and the game sends the room you're
in, its district, and while riding the cage its stations, heading and gates. The depths aren't
data anywhere in the game, only prose, so the tweak has them. The Pump Gallery's depth isn't
given at all.

## Code

- `scripts/source/levels.mjs`: `levelRooms()`, each room's level, tested in `levels.test.mjs`.
- `scripts/source/filter.mjs`: keeps a car stop's `name`.
- `scripts/source/schema.mjs`, `tweaks.mjs`: the `levels` section, its checks and its orphans.
- `ui/lib/levels.js`: `indexLevels()`, each level's rooms placed by `placeRooms()`, the levels'
  names and depths; `locateLevels()`, `levelsInfo()`, `waysOff()`, `wayTip()`,
  `levelLayout()` (townLayout's for a level, with its ways placed) and `levelFrame()`.
- `ui/levels-deck.js`: the plans, each a `townPlan()` (town-deck.js) with the ways drawn over it.
- `ui/levels-view.js`: the top band's words.
- `ui/lib/look.js`: `levelsSpec()`, `levelsData()`.
- `ui/lib/cars.js`, `ui/car-deck.js`: the cage.
- `src/station_map/location.lua`: lets the `cage` kind through as a car.
- `tests/fixtures/generated/dolcoath.js`: the data frozen for the UI's tests.
