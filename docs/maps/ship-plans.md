# Ship plans

*Status: built. Last updated 2026-10-26.*

The approved mockups are `docs/maps/reference/ship-plans-mockup.html` (the
skiff and the courier) and `docs/maps/reference/freighter-mockup.html`
(option A, the user's pick, 2026-10-22), with its exits from
`docs/maps/reference/freighter-exits-mockup.html` (option A, Passage bars,
the user's pick), and your note on her from
`docs/maps/reference/ship-note-mockup.html` (option A, a quiet second line,
the user's pick, 2026-10-26; rendered in `ship-note-options.png`). Open them
in a browser, served over http. They're
throwaways: take their look, not their code.

## What it is and when it shows

A top-down plan of the whole ship you're aboard, in the bottom band, in
place of the station's deck plan. It shows whenever you're aboard a ship,
docked or out in space, your own or someone else's. Each hull class has its
own drawing, so a skiff and a courier never look alike, and each is drawn
from that hull's description in the game.

The skiff and the courier have one room, the cockpit. The medium freighter
has six, and the plan works as a station plan does: the room you're in is
lit as you walk between them.

The top band doesn't change: the station model while docked (where you're
docked), a space scene while out in your own ship. Aboard someone else's
ship the game doesn't say where that ship is, so the top band keeps the
station it last showed. That's accepted for now: you can't travel in someone
else's ship until joint travel comes, and the maintainer will look at sending
the ship's whereabouts then (2026-10-22).

**Why:** aboard a ship today the panel shows the station's plan, dimmed, with
nothing lit. Your ship is a place too, and soon one with several rooms.

### Goals

- Show which ship you're in and where in it you are, at a glance.
- Each class distinct and recognisable from its description.
- Clear at a glance which spaces are rooms and which are compartments.
- Ready for multi-room ships without redrawing the plan code.

### Non-goals

- Hulls other than the skiff, the courier and the freighter. New hulls get
  drawings when they're added to the game.
- Showing fittings, attachments, cargo, fuel, damage or anything that
  changes. The plan is the hull as built. Your note on her is the one
  exception, as words under the hull, not on the drawing.
- What she's running ("Running: courier, hauler", from Ship.Devices'
  cartridges): option C in the note mockup, not picked (2026-10-26).
- Anyone else's note on their ship. The game sends only yours.
- Other ships nearby, docked alongside, or in a hangar.
- Guessing the class from `Ship.List` or anything else before the server
  sends it.

### Anti-goals

- A compartment that looks like somewhere you could go.
- Labels or legends on compartments.
- A busy drawing: detail beyond what the description names.

## Where its data comes from

### The rooms

A ship's room ids are `ship.<n>.<key>`: `<n>` is the ship's entity id and
`<key>` the room's key in her plan, so the cockpit is `ship.72.cockpit`
(`roomId()` and `shipAt()` in `packages/game/src/systems/ships.ts` in
`~/dev/empyreal`, since empyreal 2558cef). Before that the cockpit was
`ship.<n>`, and the game's migration 27 renamed it wherever a room id was
kept. `mudstd.room.info` gives every ship room `terrain: "ship"`,
`area: "ship.<n>"` and `areaName`, the ship's name ("Mule"). The plan treats
any room whose id starts `ship.` as being aboard a ship.

### The class

Since the server update of 2026-10-22, `Empyreal.Room` describes the ship for
a ship room, in a `ship` object (read off the session logs; the source wasn't
pushed yet):

```
ship: { class: "skiff", id: "ship.41", kind: "prospecting skiff", name: "Magpie" }
ship: { class: "courier", id: "ship.72", kind: "courier", name: "Fair Copy" }
```

`class` is the hull's stable id, as in `content/game/hulls.yaml`, and picks
the drawing; `kind` is its name, used in the caption and the info line. The
Lua location message carries them as `hull` and `hullName`. `ship.id` is the
ship's area, `ship.<n>`, not the room's id. Which of her rooms you're in is the end of
the room's id (`ship.98.hold` is `hold`): the Lua location message carries it
as `shipRoom`, and the plan lights that room. A cockpit id from before
migration 27 (`ship.<n>`) has none, and the first room, the cockpit, is lit.

**The user's decision:** no guessing the class from `Ship.List`'s `kind` (a
display name, sent only for ships you own).

### Your note on her

`ship note mule hauls ore to Orrin` puts a note on a ship of yours, 60
characters at most, and `ship note mule clear` takes it off (travel.md
decision 117, empyreal 0a5f686). Only her owner sees it. `Ship.List` lists
your own ships wherever you are, each with `note` (a string, or null with
none) and `aboard`, true for the one you're aboard (`sendShipListGmcp()` in
`packages/game/src/world/gmcp.ts`). It's refreshed after every command and
sent only when it changes.

- **She's the entry with `aboard: true`**, never one matched by name: two
  ships can share a name, and someone else's ship can share yours. Aboard
  someone else's ship no entry is aboard, so there's no note.
- **A missing `note`** (servers before 0a5f686), an empty one or one that
  isn't a string is no note.
- **Tied to her area.** The note is kept with the area you were in as the
  list came (`ship.<n>`). Anywhere else there's no note, so stepping
  straight from your ship into someone else's never shows yours on theirs,
  even before the next `Ship.List` says you've left her. *My call.*
- It goes to the panel in the location message, as `note`, so the plan
  updates as it's set or cleared and loses it as you leave her.

## Bottom band: the plan

### Look

Style A from the mockup, "blueprint line":

- **The hull is an outline**: Ladder / hull line (`#9fb0c3`), width 1.6, no
  plate. *My call:* filled with the Background colour so the stars don't show
  through the ship.
- **Fore up.** Centred in the band and scaled to fit it, with the zoom
  buttons and wheel zoom as on every plan (*my call:* consistency).
- **Rooms** are the only filled shapes: the room you're in is lit (§6 of the
  style guide). Other rooms, once there are some, are room boxes with no
  district tint: *my call:* Dim at the room box's opacities, until ships have
  something that plays the part of a district.
- **Room labels:** the drawing's own short name ("Cockpit"), not the game's
  room name ("Cockpit of the Mule"), which is too long for a small room.
- **Compartments** are line drawings in Dim (style guide §7), with no labels
  and no hover.
- **Under the hull**, in Dim at 9 to 10: the ship's name and class,
  `Mule · prospecting skiff`. The name from `areaName`, the class from
  `ship.kind` (*my call:* the game's own word, as on the info line, rather
  than the id); with no class, the name alone.
- **Your note**, aboard your own ship when she has one, on a second line
  under that: Dim, italic, at 9, as you typed it (`hauls ore to Orrin`).
  No quotes, no label. A full 60 characters fits on one line under every
  hull at the home zoom, so it's never wrapped or cut (option A, the
  user's pick).

### The skiff

From `content/game/hulls.yaml`: *"One cockpit, every console within reach. A
hold behind your seat, a mining laser on a stubby boom out front, and a drive
that gets you to the belts and back if you mind the fuel."* Exterior: *"A
blunt little hull, most of it cockpit and hold, with a mining laser on a
stubby boom out front and the drive bells clustered at the stern."*

- **Hull:** short and wide, with a blunt nose and cut corners at the stern.
- **Cockpit** (room): the front of the hull, nearly its full width.
- **Hold** (compartment): behind the cockpit, six crates in two rows of
  three, each a square with one diagonal.
- **Laser boom** (compartment): a short line out from the nose, a crossbar
  on it, a diamond lens at the tip with three small beam ticks ahead.
- **Drive bells** (compartment): three flared bells clustered at the stern.

### The courier

From `content/game/hulls.yaml`: *"A narrow cockpit, two seats in line, the
consoles close on either side. Behind the bulkhead a small hold, and behind
that the long lane-rated drive that's most of her length. A second slot sits
empty under its cover plate."* Exterior: *"A long, slim hull, all drive and
not much else..."*

- **Hull:** long and slim, with a pointed nose.
- **Cockpit** (room): narrow, at the nose, with **two seats in line** drawn
  inside it in Text-coloured lines. They're part of the room, not
  compartments.
- **Bulkhead:** a hull-line rule across the hull behind the cockpit.
- **Hold** (compartment): small, two crates side by side.
- **Empty slot** (compartment): a plate with a bolt at each corner, in
  Passage (`#56657a`), a little quieter than the rest.
- **Drive** (compartment): most of the hull's length, a core down the
  middle with coil ribs across it.
- **Drive bells** (compartment): two long bells at the stern.

### The medium freighter

From `content/game/hulls.yaml`: *"A working ship you can walk around in: a
cockpit forward, a passage with an airlock to port and a docking collar to
starboard, a hold behind it, and the engine room aft."* Exterior: *"A boxy
hull three times a skiff's girth, mostly hold, with the cockpit a blunt
blister on her nose and a docking collar ringed in yellow chevrons on her
starboard flank."* Her rooms are in `content/plans/freighter.yaml`, one deck,
frames 4 to 1 fore to aft; the game sends them `coords`, but the drawing
sizes each room by what it is rather than drawing equal cells (option C in
the mockup, turned down because the hold looked no bigger than the airlock).

- **Hull:** boxy and wide, with the cockpit's blister on the nose and cut
  corners at the stern.
- **Rooms**, all six inside the hull:
  - **Cockpit** (`cockpit`): in the blister, with two seats side by side as
    fixtures and its name above them. *(The user: the box sits well inside
    the blister, not filling it.)*
  - **Airlock** (`airlock`), **Passage** (`passage`) and **Collar**
    (`collar`, the game's Docking Collar): one row across her, port to
    starboard.
  - **Hold** (`hold`): most of the hull, with tie-down rails along its port
    and starboard walls as fixtures, quieter than the seats.
  - **Engine Room** (`engine`): aft, full width.
- **Exits:** a Passage bar (`#56657a`) across each way the game's exits go,
  as the station plans join rooms (the user's pick): cockpit to passage,
  passage to airlock and to collar, passage to hold (wider: "the hold's wide
  hatch"), hold to engine room, and the airlock and collar out to the hull.
  Each bar spans the gap from the outside of one room's outline to the
  outside of the other's and never overlaps a room (the user, 2026-10-22;
  `doorway()` works them out from the rooms, and a test holds them to it).
  The rooms are 8 apart to leave the bars room to show.
- **Compartments:** the airlock's outer hatch on the port flank, in Glass; the
  collar's ring on the starboard flank, its chevrons in the status lights'
  yellow (`#e8b04a`, the user's call: the game says yellow); two drive
  bells at the stern.

### The generic ship

For a ship whose class isn't known (no `ship` in the frame) or has no
drawing (a hull added to the game before its drawing): *my call:* a plain
rounded hull with a lit cockpit at the nose, no compartments, and the ship's
name under it. It shouldn't look like either real class.

### Attachments don't change the plan

Slots and attachments only add to a device; they don't replace it. A laser
with a cartridge deck or a heat sink is still a laser, and the courier's
cover plate stays drawn as its description has it (the user, 2026-10-22).

## Rooms, compartments and the highlight

- **The room you're in is lit:** each hull's drawing maps a room key to its
  shape, and the highlight moves to the room whose key ends your room's id
  (`ship.<n>.hold`), as on a station (the user, 2026-10-22). A key the
  drawing doesn't have lights the first room, the cockpit. The skiff and the
  courier have only their cockpit (`ship.<n>.cockpit`).
- **Walking between her rooms** keeps the hull: `mudstd.room.info` comes
  before `Empyreal.Room`, so the location reducer keeps the hull when the new
  room is in the same ship's area, rather than drawing the generic ship for a
  moment.
- **Hover** the room you're in for its name from the game; the other rooms
  show the drawing's short name, since the game hasn't sent theirs.
  Compartments have no hover.

## Info line

The room name from GMCP in capitals, then the class where it's known:
`COCKPIT OF THE MULE · prospecting skiff`. *My call:* the room name already
names the ship, and `hullName` is the game's own word for the class.

## Code

Following the drum stations' pattern:

- `ui/lib/hulls.js`: the hull specs as data (outline, rooms with their keys,
  short names and label placement, passages, compartments, fixtures, bounding box), one per hull id, plus the
  pure helpers: `hullOf()` (unknown ids get the generic ship),
  `isShipRoom()`, `shipShape()` (a room's highlight), `hullExtent()` (what
  the band fits), `shipCaption()` and `shipInfo()`. Tests in
  `ui/lib/hulls.test.js`.
- `ui/ship-deck.js`: draws a hull as a `DeckView` plan (`shipPlans(spec)`)
  and puts the ship's name, class, your note and the room name on it
  (`updateShip()`).
  `DeckView`'s highlight, pulse, zoom and fit (`plan.extent`, `home()`) are
  reused.
- `ui/main.js`: one `DeckView` per hull drawing, built on first use; aboard
  a ship (any `ship.` room) it takes the bottom band and the info line.
- `dev/preview.js`, `dev/preview.html`: boarding steps for the generic ship,
  a skiff (with a note) and a courier (with a full 60-character note), a walk through the freighter's six rooms, and a hull
  menu (`?hull=`) that re-sends the ship room with that hull.

The Lua location message (`src/station_map/location.lua`) carries `area` and
`areaName` from `mudstd.room.info`, `hull` and `hullName` from
`Empyreal.Room`'s `ship`, and `shipRoom` from the room's id; the caption takes
the ship's name from `areaName`, `main.js` picks the drawing by `hull` and
passes `shipRoom` to the highlight.

`src/station_map/note.lua` folds `Ship.List` into your note on the ship
you're aboard, kept with the area it came in (`F.ship_list()`, `F.note()`),
with tests in `tests/note_test.lua`. `src/main.lua` subscribes to
`Ship.List` (in `gmcp_access`; `Ship 1` already advertises it), adds `note`
to every location message, and posts the location again only when the note
shown changes.

## Where it differs from the style guide

- No plate: the hull outline is the floor's edge.
- Rooms have no district tint (above).
