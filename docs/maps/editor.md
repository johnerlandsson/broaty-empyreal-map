# The tweak editor

The tweak editor is a page in the browser for the look of a place. You pick
a room, change its colour or shape, and see the map change. Your changes stay
unsaved until you press **Save**, which writes the tweak files in
`data/tweaks/`, the same ones you could edit by hand. It is a development
tool. It is not part of the plugin.

## Starting it

```bash
npm run edit
# Editor: http://localhost:8766/dev/edit.html
```

The server listens on `localhost`, port 8766, and nowhere else. It answers
only to the host names `localhost:8766` and `127.0.0.1:8766`, so a web page
from another site cannot reach it. Stop it with Ctrl-C.

To use another port, give it with `--port`:

```bash
npm run edit -- --port 8770
# Editor: http://localhost:8770/dev/edit.html
```

It reads the Empyreal source at `~/dev/empyreal`, as `npm run build:data`
does. It never writes there.

## What it writes

Only `data/tweaks/*.json` and, through the build, `ui/data/`, and only when
you press **Save**. It never writes `data/sync-report.json` or the source.
The report you see in the editor is the one from the last `npm run
build:data`. After each save the editor updates only its orphans, unplaced
rooms and places with no builder, which follow the tweaks. The new places and
changed rooms stay as the sync found them.

A change goes like this:

1. The page sends every file with unsaved changes, this one included.
2. The server builds the map into a temporary folder with those files in a
   copy of the tweaks: a trial build. It writes nothing.
3. If the trial passes, the change is kept, unsaved, and the map is drawn
   from the trial. If it stops, the change is dropped. See "A refused
   change".

A save goes like this:

1. The page sends every unsaved file with the version it last saw.
2. The server builds them as a trial once more. If any file changed on disk
   since the page saw it, or the build stops, nothing is written.
3. If all is well, the server writes every file and rebuilds `ui/data/`.
4. The page loads the new data and redraws.

If the files are written but the rebuild of `ui/data/` then fails, the bar
says `saved data/tweaks/<file>, but rebuilding ui/data failed:` and the
message. The save stands, and the inputs keep the new value. The next build
that works, from a save or a hand edit, fixes the map.

A tweak file is written in a fixed order of keys, two spaces of indent, so
a save may reorder a file you wrote by hand.

## Unsaved changes, Save and Discard

While anything is unsaved, a bar across the top of the map says how many
changes and in which files, for example `● 3 unsaved changes  orrin.json · 2
palette.json · 1`. It says `checking…` while a trial build runs.

- **Save** writes every unsaved file at once, in one build. Ctrl+S (Cmd+S)
  does the same.
- **Discard** drops every unsaved change. The map goes back to the saved
  files.

A place with unsaved changes has an amber dot in the rail. You can move
between places: each keeps its unsaved changes, and Save and Discard cover
them all. Its panel marks a value not yet saved `● unsaved`, in amber.

A change that brings a file back to how it was saved leaves nothing unsaved
in it.

If you leave or reload the page with changes unsaved, the browser asks
first. Unsaved changes are not kept after a reload.

## The three columns

- Left, the rail. **From the last sync** lists the places the report names,
  with badges for `new`, rooms changed and orphans. A place with no data to
  open is greyed. **Stations** lists the decks, drum, town and wheel
  places. **Ship classes** lists the ship plans by their hull's name (the
  freighter as `medium freighter`), or says `none yet`. Click one to open it.
- Middle, the map. The overview (the 3D model) is above, the plan below. On
  a decks place the plan shows one deck, and its tag says which.
- Right, the side panel. It holds the selected room, the place's view, and
  on a decks place or a ship the hull of the plan's deck. On a ship it also
  holds the hull's look and the greebles. Under it is **pretend I'm in**.

## Ship classes

A ship class is a generated plan in `ui/data/plans/`, drawn as the map draws
a ship. Its tweak file is `data/tweaks/<plan>.json`, for example
`freighter.json` or `hull-skiff.json`. A room name with `{name}` in it shows
with the ship name `Example`, so `Cockpit of the {name}` reads `Cockpit of
the Example`. Paint, footprints, the hull, the view and the handles work as on
a station.

### Ship · hull look

A switch for each part of the hull's look. Turn one off to take it away.

- `bevel`, `nose drop`: off sets `profile.bevel` or `profile.noseDrop` to 0.
- `spine`: off sets `profile.spine` to `null`. On again gives a spine down
  the middle third of the hull.
- `seams`, `nav lights`: off sets `surface.seams` or `surface.navLights` to
  `false`.
- `windows`: off sets `surface.windows` to `[]`.
- `stripe`: off sets `surface.stripe` to `null`. While it is on, **stripe
  colour** shows the palette. Click a swatch to colour the stripe.

Turning a switch back on removes the value from the file, so the default (or
the value through `like`) shows again. If that is off too, the editor writes
the default's value instead.

### Greebles

The ship's greebles, each with its type, side and frame, and a **remove**
button. Pick a type and click **add greeble** to add one on the centre line,
half way along the hull. Then drag it on the plan. The build refuses a greeble
that is half on the spine.

## Selecting

Click a room in the overview or on the plan. It lights in both. **Pretend
I'm in** does the same from a list of the place's rooms, and shows the room
the way the player sees it when they stand there. `(nowhere)` clears it.

The address bar holds the place and the room as `#place/room`, for example
`#orrin/orrin.market`. Reload the page, or send the link, and it opens the
same room. Changing the hash by hand works too.

## The side panel

The panel has a heading for each part. A value says where it comes from:

- `set here`: the place's own tweak file has it. A `reset` link next to it
  removes it from this file.
- `from <place>`: the place gets it through `like`. See below.
- `default`: nothing sets it.
- `● unsaved`, in amber, before any of these: you changed it, and it isn't
  saved yet.

### From the game

The room's exits and flags, as the source gives them. These are read only.

### Paint

The swatches are the palette. Click one to colour the room.

**add colour** makes a new palette colour. Give it a name and pick a colour.
A name is lower-case letters, digits and hyphens, starting with a letter. The
editor refuses a name the palette already has. The colour goes into
`data/tweaks/palette.json` and is then in the swatches.

### Footprint

Footprints are on decks places only. A passage and a blister have none, so
for them the section is not shown. See the Footprints section in
[sync.md](sync.md) for what they mean.

- `span`: how far the room reaches past its cell, in cells, for fore, aft,
  port and stbd (starboard). Empty is 0.
- `corners`: square, rounded or cut.
- `r`: the radius of a rounded or cut corner. The grey number is the default.

If the room's footprint is an `outline`, the panel says so at the top of the
section, with the file it is in. The outline replaces the span, so that is
turned off. `corners` and `r` round or cut each of the outline's corners.
Every ship room the plans give has an outline. The editor does not change the
outline's points; edit them in the file by hand.

On the plan, `r` is measured on the room box as it is drawn, so `r 0.2` looks
like a fifth of a cell.

### View

- `cutaway`: off, hide above or ghost above. Decks places only.
- `camera`: yaw, pitch and zoom of the overview's home angle. Every place
  except a town has it.
- **set zoom from current view** reads the zoom of the overview as it is on
  the screen now, and sets that as the camera's zoom. Zoom the overview with
  the mouse first.

### Hull

Decks places only. This is the plan's deck: change the deck on the plan to
change which hull the panel shows. A deck outside the hull, such as one with
only a blister, has no hull, so the section is not shown there.

- **make hull from rooms** draws a path round the deck's rooms, each with its
  footprint: its span, or the box round its outline. A footprint the place
  gets through `like` counts too. If the rooms make more than one piece, the
  path goes round the largest, and the editor warns you. If the deck has no
  rooms, it says so.
- **back to the box** puts the deck back to its box. If the hull comes from
  your own file, that removes it. If it comes through `like`, the editor
  writes `null` over it, which opts out. See "The hull" in
  [sync.md](sync.md).
- **point N r** shows when a hull point is picked. It rounds that corner. 0
  or empty makes it sharp.

## The handles

On a decks place or a ship the plan carries handles: amber for a room's sides,
blue for the hull and fixtures.

- Amber arrows mid-way along each side of the selected room's box set that
  side's `span`. Each points the way the span grows. Drag one out or in. It
  snaps to 0.05 cells and never goes below 0. A room with an outline drawn by
  hand, a passage or a blister has none.
- The hull path of the plan's deck is drawn with a blue square on each point.
  Drag a point to move it. It snaps (see "Snapping a hull point"). Click a
  point to pick it, and its `r` shows in the panel. A ring with the number
  marks a rounded corner.
- Double-click an edge of the path to add a point there. It snaps the same
  way. The new point is picked.
- Press Delete or Backspace to remove the picked point. A path needs three
  points at least, and the editor says so if you try to go below that. The
  keys do nothing while you type in a field.
- A diamond marks each cradle and mast, on its own deck only: a cradle on
  the deck it is on, a mast on the top deck. A cradle drags along its side. A
  mast drags in side and frame. Both snap to 0.05 cells. A dashed box shows
  the cradle.
- On a ship, a diamond marks each drive bell, at the hull's tail, and the
  boom, at its nose. Each drags along its side. A circle marks each greeble on
  the top deck. It drags in side and frame. All snap to 0.05 cells.

A drag redraws as you go and makes its change, unsaved, when you let go. A
drag that ends where it started changes nothing.

## The grid and the other decks

On a decks place or a ship, the plan has a grid under the deck's plate: cell
edges in a solid line, quarter cells faint. You see it round the hull, not
over the rooms.

The hull of the deck above is drawn over the plan, dashed in amber, and the
hull of the deck below dotted in teal. Each has a small ring on every point
and its deck at one corner, for example `Deck 3 ▲`. A deck with no path of
its own shows its box, `(box)`. A deck outside the hull, such as one with only
a blister, shows nothing. A ship with one deck has no other deck to show.

The card in the plan's top-left corner turns the grid `on` or `off`, and picks
the decks shown: `above`, `below`, `both` or `off`. The page keeps both choices
after a reload.

## Snapping a hull point

When you drag a hull point, or add one, each of its x and y goes to the first
of these that is within a few pixels:

1. The same x or y as another point: one of its own path's, then one of the
   decks shown.
2. A cell's edge, or 0.12 cells either side of one (the margin **make hull
   from rooms** leaves round the rooms).
3. Else the nearest 0.05 cells.

While you drag, a dashed magenta line ties the point to each point it lines
up with, with a ring and its name there (`point 3`, `Deck 3 · point 4`), and
the point's x, y shows beside it.

Hold **Alt** while you drag to place the point freely, to 0.01 cells, with no
snapping. Turning the decks `off` on the card stops snapping to them too.

## Inherited values

A place that has `"like": "orrin"` gets Orrin's footprints, hull and fixtures
until it sets its own. The panel marks such a value `from orrin`.

The first edit of an inherited value copies it into the place's own file, then
changes the copy. For a hull path, the fixtures or the greebles that is the
whole list. Orrin
is not touched. After that the value says `set here`. Use `reset` to give it
back to Orrin's.

Where a halt inherits Orrin's hull and a change clashes with it, the build
names the file the hull came from and suggests the opt-out
`"hull": {"N": null}`. It is explained in "The hull" in [sync.md](sync.md).

## A refused change

When the trial build of a change stops, the change is dropped. Then:

- the message from the build is shown in the bar at the foot of the plan;
- the inputs go back to the value before the change;
- after a drag, the plan goes back to the look before it.

Your other unsaved changes stay. The message is the one `npm run build:data`
would give, with the file (`data/tweaks/<file>`) and the key, and it ends
`Nothing written`. Fix what it names and try again. The bar clears at the
next change that works.

Since every unsaved change has passed a trial, a save is refused only when a
file changed on disk just before it. See "Hand edits".

If a tweak file does not parse, the bar shows the error. The panel says to fix
the file by hand and turns off edits to that place until you do.

What you are typing in a field is kept when the panel redraws after a change.

## Hand edits

The server watches `data/tweaks/`. If you edit a tweak file in your own
editor, it rebuilds a moment after the changes stop, and the page redraws
the open place at once. The selection, the plan's deck and the zoom stay as
they were. If the build fails, the bar shows `build failed:` and the message.

A hand edit to a file you have unsaved changes in is never overwritten. The
page makes your changes again on top of the file as it now is, and tries them
again. The bar says `data/tweaks/<file> changed on disk; your unsaved edits are
now on top of it`. Check the map, then save.

If your changes no longer apply to the new file (a hull point you moved is
gone, say), or no longer build, the page keeps them but will not save them:
the file is struck through in the bar, Save is off, and the bar says why.
Discard to take the file as it is on disk.

A save is checked against each file on disk (see "What it writes"). If one
changed just before the save, nothing is written, and the page takes your
changes over as above.

If the server stops, the page says `lost the edit server; reconnecting…`.
Start it again with `npm run edit`. The page reconnects and reloads by itself.

## In the sync routine

Step 3 of the routine in [sync.md](sync.md) reads the report. Open the editor
for what it names: the places under **From the last sync** are the new ones,
those with rooms changed, and those with orphans. The editor shows the look
of a place. It does not change what the map says. That is in the source.
