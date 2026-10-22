# Ship plans

*Status: built. Last updated 2026-10-22.*

The approved mockup is `docs/maps/reference/ship-plans-mockup.html` (open it
in a browser). It's a throwaway: take its look, not its code.

## What it is and when it shows

A top-down plan of the whole ship you're aboard, in the bottom band, in
place of the station's deck plan. It shows whenever you're aboard a ship,
docked or out in space, your own or someone else's. Each hull class has its
own drawing, so a skiff and a courier never look alike, and each is drawn
from that hull's description in the game.

Today every ship has one room, its cockpit. Ships with more rooms are coming,
and the plan works as a station plan does: rooms are lit as you walk between
them.

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

- Hulls other than the skiff and the courier. New hulls get drawings when
  they're added to the game.
- Showing fittings, attachments, cargo, fuel, damage or anything that
  changes. The plan is the hull as built.
- Other ships nearby, docked alongside, or in a hangar.
- Guessing the class from `Ship.List` or anything else before the server
  sends it.

### Anti-goals

- A compartment that looks like somewhere you could go.
- Labels or legends on compartments.
- A busy drawing: detail beyond what the description names.

## Where its data comes from

### The rooms

A ship's room ids are `ship.<n>`, the ship's entity id (`shipAt()` in
`packages/game/src/systems/ships.ts` in `~/dev/empyreal`); the cockpit's id
is the ship's. `mudstd.room.info` gives every ship room `terrain: "ship"`,
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
Lua location message carries them as `hull` and `hullName`. Nothing says yet
which part of the ship a room is; once ships have more rooms the server will
need to, and it gets carried as `shipRoom`.

**The user's decision:** no guessing the class from `Ship.List`'s `kind` (a
display name, sent only for ships you own).

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

- **One room today, the cockpit,** lit whenever you're aboard (any `ship.<n>`
  room).
- **More rooms later:** each hull's drawing maps a room key to its shape,
  and the highlight moves to the room you're in, as on a station (the user,
  2026-10-22). How a room is keyed waits on what the server sends for a
  ship's rooms.
- **Hover** a room for its name from the game. Compartments have no hover.

## Info line

The room name from GMCP in capitals, then the class where it's known:
`COCKPIT OF THE MULE · prospecting skiff`. *My call:* the room name already
names the ship, and `hullName` is the game's own word for the class.

## Code

Following the drum stations' pattern:

- `ui/lib/hulls.js`: the hull specs as data (outline, rooms with their short
  names, compartments, fixtures, bounding box), one per hull id, plus the
  pure helpers: `hullOf()` (unknown ids get the generic ship),
  `isShipRoom()`, `shipShape()` (a room's highlight), `hullExtent()` (what
  the band fits), `shipCaption()` and `shipInfo()`. Tests in
  `ui/lib/hulls.test.js`.
- `ui/ship-deck.js`: draws a hull as a `DeckView` plan (`shipPlans(spec)`)
  and puts the ship's name, class and room name on it (`updateShip()`).
  `DeckView`'s highlight, pulse, zoom and fit (`plan.extent`, `home()`) are
  reused.
- `ui/main.js`: one `DeckView` per hull drawing, built on first use; aboard
  a ship (any `ship.` room) it takes the bottom band and the info line.
- `dev/preview.js`, `dev/preview.html`: boarding steps for the generic ship,
  a skiff and a courier, and a hull menu (`?hull=`) that re-sends the ship
  room with that hull.

The Lua location message (`src/station_map/location.lua`) carries `area` and
`areaName` from `mudstd.room.info`, and `hull` and `hullName` from
`Empyreal.Room`'s `ship`; the caption takes the ship's name from `areaName`,
and `main.js` picks the drawing by `hull`. When the server says which part of
the ship a room is, carry it as `shipRoom`: `main.js` already passes it to the
highlight.

## Where it differs from the style guide

- No plate: the hull outline is the floor's edge.
- Rooms have no district tint (above).
