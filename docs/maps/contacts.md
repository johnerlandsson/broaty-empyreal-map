# Sweep contacts on the system chart

*Status: built. Last updated 2026-10-24.*

## What it is

The last sweep's picture, drawn over the system chart (orrery.md): the ships it
picked out, where it saw them; what it had behind a planet or the star; what a
noisy sweep missed. A card in the chart's bottom-left corner says how old the
sweep is. While your ship chases another, her route runs to where the sweep saw
that ship.

It's a picture as of the sweep, and the chart draws it as one. A ship is drawn
where she was seen and stays there however long ago that was: the chart never
moves her on along her way, even though the game knows her track. Only a new
sweep moves her.

## Where its data comes from

`Space.Contacts` (Empyreal's gmcp.md §8.5, 780d893, c041930 and 18769cb). It
comes once a sweep, for the ship you operate: `at` (the sweep's wall-clock ms),
`system`, and `contacts`, each with `kind` (`body`, `station`, `mouth`, `belt`,
`ship` or `unknown`), `id`, `name`, `km` from her at the sweep, `x` and `y` in
the star's frame then, `hidden` (the body that eclipsed it) and `missed` (a
noisy sweep got no return). A ship also has `moving`, `size`, `hull` and
`owner`. It's null when there's no ship or no sweep in the system she's in, and
the game doesn't move it on with time.

`src/station_map/charts.lua` cleans it (`C.space_contacts`): it drops a contact
it can't place and keeps the rest as sent, except a dark ship's. An `unknown`
contact keeps only her contact number (as both `id` and `name`), `km`, `x`, `y`,
`hidden` and `missed`, so nothing more of her ever reaches the panel. `src/main.lua`
posts it as `chart-contacts` when it changes, replays it on `ready`, and posts
null on a disconnect. `plugin.toml` lists `Space.Contacts` in `gmcp_access`. The
`Space 1` advertise already covers it.

The chart draws a sweep only when it's of the system in the charts. A sweep
from the last system stays hidden until the game replaces it.

## What the chart draws

Look B of `docs/maps/reference/contacts-mockup.html` (picked 2026-10-24;
`contacts-options.png` is the render):

- **A named ship** (`ship`: by transponder, or within 20 km): a target's four
  corner brackets in Glass round a Glass dot, at `x`/`y`. Her name is beside it
  in a light Dim. A second, smaller line gives her hull's last word, and adds
  "under drive" when she was moving: "freighter · under drive". Under drive, the
  brackets also have a short tick out of each side. Hovered, the tooltip says
  "medium freighter, Annet's / under drive, 6,200 km off at the sweep".
- **A dark ship** (`unknown`): the brackets in Dim, empty, named only by her
  contact number, "contact-1". No hull, size, owner or drive, on the chart, in
  the card or in the tooltip ("where the last sweep saw her").
- **Something behind a body** (a station, port or mouth the sweep listed from
  your charts as eclipsed): its usual mark dimmed to .35, a faint line dotted
  `1 3` running to the limb of the body that hid it, and an italic name below
  left: "T.I.S.S., behind Tamsin".
- **A missed return**: its mark dimmed and struck through, named "Orrin
  Station, missed" in italics.
- Ships get off-view markers like bodies do ("contact-1 7.4k"), measured from
  where she is now to where the ship was seen.

The note goes where the chart draws the thing now. Its position from the sweep
is used only for something the charts don't have. A folded satellite (orrery.md)
gets no note.

### The card

The card sits in the bottom-left corner, clear of the scale bar (top left) and
the buttons (top right). It looks like the lanes map's card and stays the same
size at any zoom. Folded, it says "Last sweep · 4m ago": the age to the minute,
"just now" for the first minute, so the card changes at most once a minute. ▸
unfolds it to a list: each ship, nearest first, with what's known of her and how
far off she was ("Old Faithful  freighter · under drive · 6,200 km",
"contact-1  7,400 km"), then each thing the sweep had behind a body ("T.I.S.S.
behind Tamsin") or missed. A press on the card is the card's, not a pan. With no
sweep for this system, the card isn't shown.

## Chases

When `Ship.Status`'s `destination` is a ship on the sweep, by her vessel key
(`ship.42`) or by contact number (`contact-1`), as gmcp.md §8.6 sends it, the
sweep's ships are put on the chart's index (`index.seen`). `positionOf` then
finds that ship where she was seen, in the star's frame, at any time. Her trip
draws like any other: a line in the star's frame from where she left to that
point, solid behind, dashed ahead. The amber ring at the end is 8 px across so
it sits round the brackets. The card adds an amber "After contact-1" line above
the sweep's age, and her tooltip says "bound for contact-1, where the sweep saw
her".

This is where the sweep saw the ship, not where the game is steering: the game
re-aims every 10 s from a fresh track it doesn't send, and the chart doesn't
guess at it. A chase after a ship that isn't on the sweep stays "bound", with
no line.

## Code

- `src/station_map/charts.lua`: `C.space_contacts`, `C.contacts`. A disconnect
  clears the sweep with the charts. Tests are in `tests/charts_test.lua`, and
  the wiring tests are in `tests/main_test.lua`.
- `ui/lib/contacts.js`: pure. `sweepOf` (the sweep against the charts'
  system), the wording (`shipLine`, `shipTip`, `markText`, `sweepAge`), `chased`
  and the card's text (`card`). Tests are in `ui/lib/contacts.test.js`, chases
  included.
- `ui/lib/orbits.js`: `positionOf` and `frameOf` read `index.seen`.
- `ui/chart-view.js`: `setContacts`, the marks, the notes and the card
  (`drawSweepCard`). `ui/map.css` has `.sweep-card`.
- Preview: `?chart=sweep` (a sweep at Gannet Belt 4 minutes ago: the Mule, Old
  Faithful, contact-1, T.I.S.S. behind Tamsin, Orrin Station missed) and
  `?chart=chase` (after contact-1 from the belt). `&unfold` opens the card
  unfolded. The fixture is `senaraContacts` in `dev/charts-fixture.js`.
