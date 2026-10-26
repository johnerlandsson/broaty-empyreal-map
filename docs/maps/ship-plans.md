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
throwaways: take their look, not their code. Stage 4 added
`ships-from-cells-mockup.html` (the plans from cells), `ship-hull-looks-mockup.html`
(the hull's look, John's pick C) and `own-ship-band-mockup.html` (your ship in
the top band).

## What it is and when it shows

A top-down plan of the whole ship you're aboard, in the bottom band, in
place of the station's deck plan. It shows whenever you're aboard a ship,
docked or out in space, your own or someone else's. Each hull class has its
own plan, built from the game's cells as a station's is, so a skiff and a
courier never look alike.

The skiff and the courier have one room, the cockpit. The medium freighter
has six, and the plan works as a station plan does: the room you're in is
lit as you walk between them.

The top band shows the station model while docked (where you're docked) and
a space scene while out in your own ship, with her model in front of it
(see "Your ship in the top band"). Aboard someone else's ship the game
doesn't say where that ship is, so the top band keeps the station it last
showed. That's accepted for now: you can't travel in someone
else's ship until joint travel comes, and the maintainer will look at sending
the ship's whereabouts then (2026-10-22).

**Why:** aboard a ship today the panel shows the station's plan, dimmed, with
nothing lit. Your ship is a place too, and soon one with several rooms.

### Goals

- Show which ship you're in and where in it you are, at a glance.
- Each class distinct and recognisable from its description.
- Clear at a glance which spaces are rooms and which are fixtures outside the hull.
- Ready for multi-room ships without redrawing the plan code.

### Non-goals

- Hulls the game doesn't have. A new hull gets a one-room plan on the next
  sync, and a tweak file when someone draws it.
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

- A fixture that looks like somewhere you could go.
- Labels or legends on fixtures.
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

### How a ship is built

A ship's plan is made from cells, as a station's is. Each hull in the game
(`content/game/hulls.yaml`) names a plan in `content/plans/` or has none.
`npm run build:data` reads them and writes:

- `ui/data/plans/<plan>.js`, one for each plan, with its rooms, gravity and
  look. The freighter has `content/plans/freighter.yaml`, so
  `plans/freighter.js`. The tug has its own too.
- `hull-<id>`, a plan the build makes for a hull with no plan of its own
  (`hull-skiff`, `hull-courier`): one room, the cockpit, at Deck 1, frame 1.
  Its name, address, flags and canopy are the game's own cockpit's, as the
  game's loader gives a ship with no plan. Anyone who adds a plan to a hull
  in the game gets the real one on the next sync.
- `ui/data/ships.js`, the index: each hull's `id`, `name`, `class` and
  `plan`, and every plan by id.

A plan's gravity is its own, else the world's `shipGravity`, as the game has
it; a room's is its own, else the plan's. The build stops, naming both, when
two plans or a plan and a place share an id, or when a hull names a plan the
source doesn't have.

Her look is `data/tweaks/<plan>.json`: `freighter.json`, `tug.json`,
`hull-skiff.json` and `hull-courier.json`. The keys are in
[sync.md](sync.md). Those four files are the editor's too ([editor.md](editor.md)).

### What the plan draws

The decks builder draws the plan, with a few things only a ship has
(`ui/decks-deck.js`):

- **The hull** is its deck's path, plated, with an edge line. A deck with no
  path has its box.
- **Rooms** are room boxes in their footprints, with no district tint. The
  room you're in is lit (below).
- **Fixtures**, from the look:
  - `bell`: a drive bell out of the hull's aft end at its side.
  - `boom`: the mining laser's boom out of the nose.
  - `chevrons`: the collar's ring where its room's wall meets the hull, with
    two chevrons in the status lights' yellow (`#e8b04a`: the game says
    yellow).
  - `prop`: something standing in a room, drawn over it. A `kind` of
    `crate`, `seat`, `core`, `bulkhead`, `slot` or `rails`, `size` cells
    big, `at` an offset from the room's cell, and a `grid` of them with a
    `gap` between. A core has `ribs` across it. Props are on the plan only,
    not on the model.
- **Names:** each room's short name, fitted to its box clear of its props;
  where a name has to go over them it gets a halo. Under the hull, the ship's
  name and class, and your note.

Bells, boom and ring are under the plate; props are over the rooms. The
build stops, listing them all, when a hull path cuts through a room or leaves
a fixture or a greeble outside it.

The profile (`bevel`, `noseDrop`, `noseLength`, `spine`), the surface
(`seams`, `windows`, `stripe`, `navLights`) and the greebles (`vent`,
`antenna`, `dish`) belong to the 3D model in the top band, not to this plan.

### The hulls

- **The prospecting skiff** (`hull-skiff`): one room, the cockpit, with six
  crates in two rows of three (the hold, as props), three drive bells at the
  stern and the laser boom out front. Short and wide.
- **The courier** (`hull-courier`): one room, the cockpit, long and slim.
  Props in it, fore to aft: two seats in line, a bulkhead, two crates, an
  empty slot under its cover plate (a `slot` prop) and the drive as a `core`
  with ribs. Two bells at the stern. Attachments don't change it: a laser with a cartridge deck is still a laser
  (the user, 2026-10-22).
- **The medium freighter** (`freighter`): six rooms on one deck, frames 4 to
  1 fore to aft. The cockpit sits in the blister on her nose, with two seats
  as props. The airlock, the passage and the collar are one row across her,
  port to starboard; the hold is most of the hull with tie-down `rails`; the
  engine room is aft. Two bells at the stern, the collar's ring on the
  starboard flank. The rooms are sized by what they are, not drawn as equal
  cells. Each way through is a Passage bar (`#56657a`) across the gap
  between two rooms, never over a room.
- **The tug** (`tug`): her own plan, with a collar whose ring is on the aft
  wall and two small bells at the stern.

The look of each is in its tweak file; read that for the numbers.

### The generic ship

For a ship whose class isn't known (no `ship` in the frame) or has no entry
in `ships.js`: the skiff's one-room plan, named "ship" until the game says
otherwise. *My call:* it is a real hull's drawing, not a made-up one, so it
never looks broken.

## Rooms and the highlight

- **The room you're in is lit.** `buildShip` maps `ship.<n>.<key>` to the
  plan's `<plan>.<key>`; a key the plan hasn't is drawn with nothing lit. On
  the plan the room is lit as on a station's; on the 3D model a lit room
  shows as its own shape, kept just inside the hull, so you see where she
  is through the hull.
- **Walking between her rooms** keeps the hull: `mudstd.room.info` comes
  before `Empyreal.Room`, so the location reducer keeps the hull when the new
  room is in the same ship's area, rather than drawing the generic ship for a
  moment.
- **Hover** the room you're in for its name from the game; the other rooms
  show the plan's short name, since the game hasn't sent theirs.

## Your ship in the top band

Aboard your own ship, once she is out, her model stands in front of the
space scene (`ui/main.js`, `runShip()`): the same plan as the bottom band's,
built as a model with the room you're in lit.

It shows only when all of these hold:

- you are in a ship room, and the panel knows a space scene for the ship you
  are aboard (so your own, or one you crew), or a dock or undock is under
  way;
- the scene isn't the station (docked at a station, the station shows as it
  always did);
- the chart, the lanes map and the belt map aren't open (they cover her as
  they cover the scene).

A guest aboard someone else's ship has no scene, so no ship: the top band
keeps the station, as before.

During a dock or an undock (the `manoeuvre` message) her box gets a
`manoeuvre` class, and she stands aside, smaller, in the lower right
(`ui/map.css`), clear of the station drawing near or falling away. When it ends she is
centred again.

She is drawn with no background or stars of her own, so the scene shows
round her. The hull is in layer 0 and cut into pieces of a quarter cell at
most, so the hull hides what is behind it as it turns (`ui/lib/ship-hull.js`).

## Info line

The room name from GMCP in capitals, then the class where it's known:
`COCKPIT OF THE MULE · prospecting skiff`. *My call:* the room name already
names the ship, and `hullName` is the game's own word for the class.


## Code

Following the drum stations' pattern:

- `ui/data/ships.js` and `ui/data/plans/*.js` (generated by `npm run build:data`):
  each hull's entry (`id`, `name`, `class`, `plan`) and its plan in cells,
  with the look from `data/tweaks/<plan>.json`.
- `ui/lib/ships.js`: the pure helpers: `isShipRoom()`, `shipKey()` (the
  room's key from `ship.<n>.<key>`), `hullFor()` and `planFor()` (an unknown
  hull gets the generic one-cell plan), `shipCaption()` and `shipInfo()`.
- `ui/decks-deck.js` and `ui/lib/decks.js`: the decks builder's plan and
  model, with the ship's fixtures and props on the plan; `ui/lib/ship-hull.js`
  builds her hull, roof, windows and fixtures as the model's faces.
- `ui/place-views.js` `buildShip(plan, modelEl, deckEl, {name})`: the plan
  built by the decks builder, `{name}` in its room names filled with the
  ship's; its `locate()` maps `ship.<n>.<key>` to `<plan>.<key>` (a key the
  plan hasn't is drawn with nothing lit) and `update(msg)` lights the room and
  sets the lines under the hull.
- `ui/ship-deck.js`: the ship's name and class and your note under the hull,
  clear of her bells (`captionShip()`, `updateShip()`).
- `ui/main.js`: one ship view per plan, built on first use and again for a
  ship of another name; aboard a ship (any `ship.` room) it takes the bottom
  band and the info line, and `runShip()` puts her model in the top band
  (above).
- `dev/preview.js`, `dev/preview.html`: boarding steps for the generic ship,
  a skiff (with a note) and a courier (with a full 60-character note), a walk through the freighter's six rooms, and a hull
  menu (`?hull=`, every hull in `ui/data/ships.js`) that re-sends the ship room with that hull.

The Lua location message (`src/station_map/location.lua`) carries `area` and
`areaName` from `mudstd.room.info`, `hull` and `hullName` from
`Empyreal.Room`'s `ship`, and `shipRoom` from the room's id; the caption takes
the ship's name from `areaName`, `main.js` picks the plan by `hull` and
lights the room by the key in `roomId`.

`src/station_map/note.lua` folds `Ship.List` into your note on the ship
you're aboard, kept with the area it came in (`F.ship_list()`, `F.note()`),
with tests in `tests/note_test.lua`. `src/main.lua` subscribes to
`Ship.List` (in `gmcp_access`; `Ship 1` already advertises it), adds `note`
to every location message, and posts the location again only when the note
shown changes.

## Where it differs from the style guide

- No plate: the hull outline is the floor's edge.
- Rooms have no district tint (above).
