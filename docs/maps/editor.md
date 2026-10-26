# The tweak editor

The tweak editor is a page in the browser for the look of a place. You pick
a room, change its colour or shape, and see the map change. It writes the
tweak files in `data/tweaks/`, the same ones you could edit by hand. It is a
development tool. It is not part of the plugin.

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

Only `data/tweaks/*.json` and, through the build, `ui/data/`. It never
writes `data/sync-report.json` or the source. The report you see in the
editor is the one from the last `npm run build:data`. After each save the
editor updates only its orphans, unplaced rooms and places with no builder,
which follow the tweaks. The new places and changed rooms stay as the sync
found them.

A save goes like this:

1. The page sends the whole tweak file with the version it last saw.
2. The server builds the map into a temporary folder with that file in a
   copy of the tweaks. If the build stops, nothing is written. See "A
   refused save".
3. If the build passes, the server writes the file and rebuilds `ui/data/`.
4. The page loads the new data and redraws.

If the file is written but the rebuild of `ui/data/` then fails, the bar
says `saved data/tweaks/<file>, but rebuilding ui/data failed:` and the
message. The save stands, and the inputs keep the new value. The next build
that works, from a save or a hand edit, fixes the map.

A tweak file is written in a fixed order of keys, two spaces of indent, so
a save may reorder a file you wrote by hand.

If the file changed on disk since the page last saw it, the save does not
happen. The page reloads and says `changed on disk, reloaded`.

## The three columns

- Left, the rail. **From the last sync** lists the places the report names,
  with badges for `new`, rooms changed and orphans. A place with no data to
  open is greyed. **Stations** lists the decks, drum, town and wheel
  places. **Ship classes** lists the rest, or says `none yet`. Click a place
  to open it.
- Middle, the map. The overview (the 3D model) is above, the plan below. On
  a decks place the plan shows one deck, and its tag says which.
- Right, the side panel. It holds the selected room, the place's view, and
  on a decks place the hull of the plan's deck. Under it is **pretend I'm
  in**.

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

If the room has an `outline` drawn by hand, the panel says so. The outline
replaces the span and corners, and the editor does not change it.

### View

- `cutaway`: off, hide above or ghost above. Decks places only.
- `camera`: yaw, pitch and zoom of the overview's home angle. Every place
  except a town has it.
- **set zoom from current view** reads the zoom of the overview as it is on
  the screen now, and saves that as the camera's zoom. Zoom the overview with
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

On a decks place the plan carries handles in blue.

- Square handles mid-way along each side of the selected room's box set that
  side's `span`. Drag one out or in. It snaps to 0.05 cells and never goes
  below 0. A room with an outline drawn by hand, a passage or a blister has
  none.
- The hull path of the plan's deck is drawn with a square on each point. Drag
  a point to move it. It snaps to 0.01 cells. Click a point to pick it, and
  its `r` shows in the panel. A ring with the number marks a rounded corner.
- Double-click an edge of the path to add a point there. The new point is
  picked.
- Press Delete or Backspace to remove the picked point. A path needs three
  points at least, and the editor says so if you try to go below that. The
  keys do nothing while you type in a field.
- A diamond marks each cradle and mast, on its own deck only: a cradle on
  the deck it is on, a mast on the top deck. A cradle drags along its side. A
  mast drags in side and frame. Both snap to 0.05 cells. A dashed box shows
  the cradle.

A drag redraws as you go and saves when you let go. A drag that ends where it
started saves nothing.

## Inherited values

A place that has `"like": "orrin"` gets Orrin's footprints, hull and fixtures
until it sets its own. The panel marks such a value `from orrin`.

The first edit of an inherited value copies it into the place's own file, then
changes the copy. For a hull path or the fixtures that is the whole list. Orrin
is not touched. After that the value says `set here`. Use `reset` to give it
back to Orrin's.

Where a halt inherits Orrin's hull and a change clashes with it, the build
names the file the hull came from and suggests the opt-out
`"hull": {"N": null}`. It is explained in "The hull" in [sync.md](sync.md).

## A refused save

When the build stops, the file is not written. Then:

- the message from the build is shown in the bar at the foot of the plan;
- the inputs go back to the last saved value;
- after a drag, the plan goes back to the last saved look.

The message is the one `npm run build:data` would give, with the file
(`data/tweaks/<file>`) and the key, and it ends `Nothing written`. Fix what
it names and try again. The bar clears at the next
save that works.

If a tweak file does not parse, the bar shows the error. The panel says to fix
the file by hand and turns off edits to that place until you do.

What you are typing in a field is kept when the panel redraws after a save.

## Hand edits

The server watches `data/tweaks/`. If you edit a tweak file in your own
editor, it rebuilds a moment after the changes stop, and the page redraws
the open place at once. The selection, the plan's deck and the zoom stay as
they were. If the build fails, the bar shows `build failed:` and the message.

A save from the page after a hand edit is checked against the file on disk
(see "What it writes"). So the page never overwrites what you changed by
hand without reloading first.

If the server stops, the page says `lost the edit server; reconnecting…`.
Start it again with `npm run edit`. The page reconnects and reloads by itself.

## In the sync routine

Step 3 of the routine in [sync.md](sync.md) reads the report. Open the editor
for what it names: the places under **From the last sync** are the new ones,
those with rooms changed, and those with orphans. The editor shows the look
of a place. It does not change what the map says. That is in the source.
