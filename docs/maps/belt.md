# The belt map

*Status: built. Last updated 2026-10-24.*

## What it is and when it shows

Where your ship is inside the belt she's at, drawn over the top band: the
belt's disc, its core, a bearing ring in the belt's own degrees, and her,
with the game's own words for where she is ("11 km out from the core,
bearing 210°"). Over it, what you've seen of that belt for yourself: the
track of where she's been, the ground each sweep covered, and where you left
your host.

The game says where she is but doesn't map it, and leaves what's been worked
to players (mining.md §2.3: "players keep track of that themselves"). This
map is that keeping track. It's a player's own log, not game data.

It shows while its button is on. The button sits left of the lanes' ⋈ (a
dotted rim with a core and a dot off to one side), styled like ◎ and ⋈, and
appears once she's at a belt whose size the plugin knows. The chart, the
lanes map and the belt map each cover the top band, so switching one on
switches the others off. With the auto_view setting on:

- it comes up as she **arrives at a belt**, and as **a move in it starts**:
  an `rcs` (Ship.Devices' nav busy `rcs`), or her place changing after three
  seconds or more still (`mine` closing on a rock, or a program's move);
- it **stays** when she comes to rest, so the view ahead and its laser come
  back only when you pick them;
- it goes, and the chart comes up, when she **travels** away.

A disconnect hides the button and the map and leaves it on or off as it was.
While it's on, the space scene underneath keeps its state but doesn't draw.
The map doesn't zoom or pan: the disc always fits the band.

The map shows only what the player knows. No rocks, no worked-out areas, no
other ships. Each mark is something the game told the player as it happened:
where she was (Ship.Status), that a sweep ran to its end there (Ship.Devices),
and which ship she undocked from (Ship.Status `host`).

## Where its data comes from

**Her place** is `Ship.Status`' `belt` (gmcp.md §8.2): `{ x, y, radius,
core_km, core_bearing }`, km in the belt's own frame to a tenth, how far its
rocks reach (the Cinders 16, Gannet 18, the Anvil 19, an uncharted belt 15),
and her distance and bearing from the core, degrees clockwise from the
belt's own zero. It's null anywhere but a belt. The bearing means nothing
outside the belt but stays the same while the belt is open, so the map draws
the belt's 0° up and never turns it. **The belt** is `Ship.Status`'
`location` (`gannet-3`, `u-12`: the game never reuses one), named from
`Space.Charts`' belt places.

Ship.Status comes every tick while she moves (it's sent when it changes), so
between ticks the panel glides her from where she's drawn to her new place
over the time since the last one came: she moves steadily, a tick behind the
game.

**The words** are `placeText` in `systems/belts.ts`, done again on her
`core_km` and `core_bearing`: "at the core" within 1 km of it, "at the outer
edge, bearing 210°" within 1 km of the rim, else "11 km out from the core,
bearing 210°".

**The log** is kept by `src/station_map/belt.lua`, per belt id, and stored by
`main.lua` in Mallard's `storage` (`belts`) whenever it changes:

- **Track:** each new place is added to the stretch for this visit. A
  straight run (an `rcs` or a close on a rock) keeps only its two ends: a
  point within 0.15 km of the line from the one before to the next is on it.
  Each visit to the belt starts a new stretch. A belt keeps its newest 600
  points.
- **Sweeps:** when the sensors' `scan` ends (Ship.Devices: busy `scan` with
  `left`, then not), and it ran to its end (now is within a second of its
  end), a sweep is logged where she is. A scan stopped short says no "Sweep
  complete", so it isn't logged. Back-to-back scans, as a program sweeps, each
  log. A sweep keeps its range, 5 km, when no sensor array is fitted
  (below), and none otherwise. A belt keeps its newest 200.
- **Where you left your host:** when `host` goes from set to null while her
  host was at the belt (not docked, not under way) and she's now at that same
  belt, her first place is where her host was (the game starts her there,
  vessels.md §5), so it's marked with the host's name and the time. Docking
  back at that ship clears it.
- **Clearing:** a belt's log goes once its system's Space.Charts no longer
  lists it: it's closed, and its id won't come back. A log notes its system
  from the charts that listed it, so another system's charts never clear it.

**Her sensors' range:** help mining says "sensor range (5 km; more with a
sensor array)". It doesn't say how much more. So the map draws a 5 km ring
round her only when Ship.Devices shows her sensors with no `sensor_array`
attachment. With one, or before Ship.Devices has come, there's no ring, and a
sweep is a ring mark rather than a disc.

## Top band

Option A of `docs/maps/reference/belt-mockup.html` (the plotter, as the
chart), with option B's sweep discs:

- **Disc:** the rim, a 1.2 px circle in the middle Tone, at the belt's
  radius, fitted to the band with 24 px round it. Rings every 5 km short of
  the rim, dotted `1 4` in Orbit, labelled up the 0° side in Dim, 8 ("5 km",
  "10", "15").
- **Bearing ring:** ticks outside the rim every 10°, 5 px in the lightest
  Tone every 30° and 2.5 px in the darkest between; "0°", "90°", "180°" and
  "270°" in Dim, 8. 0° is up, clockwise, as the game counts.
- **Core:** a small Star cross.
- **Sweeps:** each the 5 km disc it covered, Sensors green filled at .08 and
  stroked at .3, so the ground you've swept shows where they overlap. Without
  a known range, a 3.5 px ring in Sensors green.
- **Where you left your host:** a Glass diamond outline, the 5 km alongside
  ring she needs to be within to dock again dashed `3 3` in Glass at .45, and
  beside it in Dim "where you left the Full Measure", with "last seen 14m ago"
  under it at .75. It's labelled last seen because the host may have moved.
- **Her track:** solid amber at .3, 2 px, as the chart's stretch behind her
  (§13.1), a polyline a visit, the latest running to where she's drawn now.
- **Her sensors' reach:** dashed `4 3` in Sensors green at .5, at 5 km round
  her, only when it's known (above).
- **Her:** the amber chevron with the glow, pulsing (§6), pointing the way
  she last moved (up before she has).
- **Words:** top left, the belt's name in capitals (Text, 9.5,
  letter-spacing 1), and under it where she is in Text, 10, broken after the
  comma onto a second line. Docked at her host with no place of her own,
  "docked at the Full Measure". Words keep a Background halo, so marks under
  them don't cut them.
- **Live:** redrawn once a second while it's shown (the host's "last seen"
  ages), and every 100 ms while she glides.

## Bottom band

Not used.

## Rooms, compartments and the highlight

No rooms. The highlight is her chevron.

## Info line

Unchanged: it's the bottom band's.

## Code

- `src/station_map/belt.lua`: the reducer: her place, the belt's id and
  name, the host she's docked at, whether a sensor array is fitted, the logs,
  and the cues for the band. `tests/belt_test.lua`.
- `src/main.lua`: the `belt` and `belt-view` messages, the three views
  switching each other off, auto_view's cues (`follow_belt`), and `storage`.
- `ui/lib/belt.js`: the message's cleaning, `placeText`, the disc's framing,
  and `Glide`, her place between ticks. Pure, tested in `belt.test.js`.
- `ui/belt-view.js`: the SVG and the button.
- `ui/main.js`: the toggles, and the redraw loop shared with the chart and the
  lanes map.
- `dev/preview.html?belt=arriving` (also `rcs-rim`, `sweeps`, `skiff`) shows
  it without the game.
- The options it was picked from: `docs/maps/reference/belt-mockup.html`.

## Where it differs from the style guide

- **Where you've been is drawn** (§6, "one place"): the track and the sweeps
  are the player's own log, the thing the game leaves them to keep. They're
  quiet next to her (amber at .3 and green washes, never pulsing), so only
  she is lit.
- **No zoom or pan** (§8.3): a belt is at most 19 km across and always fits
  the band.
- **No tooltips** (§13.4): every mark is named, or explained by this doc.
