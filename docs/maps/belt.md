# The belt map

*Status: built. Last updated 2026-10-25.*

## What it is and when it shows

Where your ship is inside the belt she's at, drawn over the top band: the
belt's disc, its core, a bearing ring from the system's zero with the way to
what's on her charts marked round it, and her, with the game's own words for where she is ("11 km out from the core, bearing
210°"). Over it, what you've seen of that belt for yourself: the track of
where she's been, the ground each sweep covered, and where you left your
host. And the ships the last sweep saw in the belt, where it saw them, with
how far and which way each is from her now, so you can `rcs` there. Docked
at her host in a belt, she's drawn with her host where the host is.

The game says where she is but doesn't map it, and leaves what's been worked
to players (mining.md §2.3: "players keep track of that themselves"). This
map is that keeping track. It's a player's own log, not game data.

It shows while its button is on. The button sits left of the lanes' ⋈ (a
dotted rim with a core and a dot off to one side), styled like ◎ and ⋈, and
appears once she's at a belt whose size the plugin knows. The chart, the
lanes map and the belt map each cover the top band, so switching one on
switches the others off. With the auto_view setting on:

- it comes up as she **arrives at a belt**, and as **a move in it starts**,
  by the same rule the space scene moves her by (`W.moving` in
  `src/station_map/work.lua`, `work()` in `ui/lib/space.js`): the thrusters
  under way (Ship.Devices' nav busy `rcs`, yours or a program's), or the
  laser busy `mine` with her place changed since it was ordered and within
  the last 2.5 seconds (closing on a rock);
- it **stays** when she comes to rest, so the view ahead and its laser come
  back only when you pick them;
- it goes, and the chart comes up, when she **travels** away.

A disconnect hides the button and the map and leaves it on or off as it was.
While it's on, the space scene underneath keeps its state but doesn't draw.
The map doesn't zoom or pan: the disc always fits the band.

The map shows only what the player knows. No rocks and no worked-out areas.
Other ships only as the last sweep saw them: where, named as it named them,
and how long ago, never moved on. Each mark is something the game told the
player as it happened: where she was (Ship.Status), that a sweep ran to its
end there (Ship.Devices), which ship she undocked from and where that ship is
while she's docked (Ship.Status `host`), and what the last sweep picked out
(Space.Contacts).
The marks round the bearing ring are what's on her charts (Space.Charts) and
the course she has plotted (Ship.Course), nothing else.

## Where its data comes from

**Her place** is `Ship.Status`' `belt` (gmcp.md §8.2): `{ x, y, radius,
core_km, core_bearing }`, km from the core along the system's axes to a
tenth, how far its rocks reach (the Cinders 16, Gannet 18, the Anvil 19, an
uncharted belt 15), and her distance and bearing from the core, degrees
clockwise from the system's zero. It's null anywhere but a belt. Since
Empyreal 3bece7c (navigation.md §2.5, decision 18) a belt's axes are its
star's: one zero for every bearing in a system, the same one `rcs` and each
contact's `bearing` count from. A place in a belt is its core's place in the
system plus her `x` and `y`. The map draws that 0° (+y) up and never turns
it, so the bearing ring points the same way as the chart.

**Docked at her host**, her own `belt` is null, and `host.belt` (the same
shape) is where her host is in the belt. The map draws the pair there. **The belt** is `Ship.Status`'
`location` (`gannet-3`, `u-12`: the game never reuses one), named from
`Space.Charts`' belt places.

Ship.Status comes every tick while she moves (it's sent when it changes), so
between ticks the panel glides her from where she's drawn to her new place
over the time since the last one came: she moves steadily, a tick behind the
game.

**The bearing ring's marks** are worked out from `Space.Charts` as the chart
does (`positionOf` in `ui/lib/orbits.js`), at the current time: the belt's
core is where her fit of it puts it, and each mark's bearing is the way from
there to the thing, degrees clockwise from the system's zero, `atan2(dx, dy)`
of their places in the star's frame, as the game's `bearingOf` counts. That's
the frame her `x` and `y` are in, so a mark at 120° is the way she'd `rcs` at
120°. A lane mouth's place comes from its `edge` through `positionOf`; its
`edge.bearing` is counter-clockwise from the star's x axis (the orbit frame,
cos and sin) and is never read as a compass bearing. Marked, in this order
(it's the order crowded marks are spread in):

- **her home**, T.I.S.S., the station `travel home` goes to (`names: [home,
  tiss]` in content/game/world.yaml). The charts don't say which is home; it's
  the same for everyone, so the plugin knows it (`HOME` in `ui/lib/belt.js`);
- the **other stations** on her charts, ports (Zennor) among them;
- the **star**;
- the **planet** the belt goes round, if it goes round one (the Anvil goes
  round Senara and has none);
- the **lane mouths** on her charts with a bearing. A wild lane's mouth has no
  `edge`, so no mark.

**Where she'd travel next** is the course she has plotted (`Ship.Course`,
the `course` message): the way to where it aims, as the chart's course line
has it (`courseLine`: the destination where it'll be when she'd arrive,
carried with the body that holds both ends), from the core. None with no
course, for a course to the belt she's at, or for one the charts can't place
(a ship on the last sweep).

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
  vessels.md §5), so it's marked with the host's name, id and the time.
  Docking back at that ship clears it.
- **Where she was at the last sweep:** when a Space.Contacts with a new `at`
  comes while she's at a belt, her place then (or her host's, docked) is
  noted against it (`seen`). The game sends a contact's `km` and `bearing`
  from her at `at`; adding them to this place puts the contact in the belt.
  The same sweep sent again, after a reconnect, keeps the note it had, so a
  sweep is never placed from where she's moved to since.
- **Clearing:** a belt's log goes once its system's Space.Charts no longer
  lists it: it's closed, and its id won't come back. A log notes its system
  from the charts that listed it, so another system's charts never clear it.

**Her sensors' range:** help mining says "sensor range (5 km; more with a
sensor array)". It doesn't say how much more. So the map draws a 5 km ring
round her only when Ship.Devices shows her sensors with no `sensor_array`
attachment. With one, or before Ship.Devices has come, there's no ring, and a
sweep is a ring mark rather than a disc.

**The sweep's ships** are `Space.Contacts` (gmcp.md §8.5, contacts.md) as
`charts.lua` cleans it, posted to the belt map with the chart. A `ship` or
`unknown` contact is drawn if the sweep is the one noted for this belt, it has
a `bearing` (a sweep saved before bearings has none, and isn't drawn here),
and her place at the sweep plus its km and bearing falls within the disc.
Her own host while she's docked isn't drawn again. The place, the name and
the age come from the sweep only.

## Top band

Option A of `docs/maps/reference/belt-mockup.html` (the plotter, as the
chart), with option B's sweep discs:

- **Disc:** the rim, a 1.2 px circle in the middle Tone, at the belt's
  radius, fitted to the band with 24 px round it. Rings every 5 km short of
  the rim, dotted `1 4` in Orbit, labelled up the 0° side in Dim, 8 ("5 km",
  "10", "15").
- **Bearing ring:** ticks outside the rim every 10°, 5 px in the lightest
  Tone every 30° and 2.5 px in the darkest between; "0°", "90°", "180°" and
  "270°" in Dim, 8, each left out when a mark is within 7° of it. 0° is up,
  clockwise, as the game counts, from the system's zero.
- **Marks round it** (option A of `docs/maps/reference/belt-compass-mockup.html`):
  each thing's chart mark (§13.1), 12 px outside the rim at its bearing from
  the core: the star a Star dot in a faint glow, the planet a darkest-Tone disc
  edged in the lightest, a station a Glass diamond, a port a Glass dome, a
  mouth a Glass double chevron pointing out (a closed one's dashed in Dim).
  Named beside it, outward, in Dim, 8.5, with a Background halo: "T.I.S.S. ·
  home", "Orrin Station", "Senara", "Tamsin", "Maelor" ("Petroc · closed").
  A name that would run off the band goes the other side. Marks nearer than
  13 px along the ring are spread evenly about their middle (`spreadOnEdge`,
  as the chart's mouths), each with a Dim leader at .5 back to its true
  bearing.
- **Where she'd travel next:** a small amber chevron with the glow, among the
  marks, pointing out along the way her plotted course goes, an amber leader
  at .6 from the rim, and the destination's name beside it in amber.
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
- **The sweep's ships:** option A of
  `docs/maps/reference/belt-ships-mockup.html` (picked 2026-10-25;
  `belt-ships-options.png` is the render): each as the chart draws her
  (contacts.md), Glass corner brackets round a Glass dot, ticked at the sides
  under drive; a dark ship's brackets in Dim, empty. Beside it, her name with
  the range and bearing from her now to where the sweep saw the ship, in the
  chart's light Dim, 8.5: "Full Measure · 18.6 km, 53°" (km to a tenth, whole
  degrees, as `rcs 53 18.6` takes them); a dark ship's by contact number in
  Dim. Under it at .75, 8, the hull's last word, "under drive" if she was
  moving, and the age: "freighter · seen 4m ago", "seen just now". Words go
  left of the mark where they'd run off the band.
- **Your host, seen since:** if a sweep after you left her saw your host (by
  her id), the "where you left" mark and words dim to .55, and a dotted `1 3`
  Glass line at .35 runs from the diamond to where the sweep saw her.
- **Docked at her host:** her chevron at .8 scale, upright and pulsing,
  inside Glass brackets 7 px across at the host's place, named "Full Measure"
  with "docked" under it. No sensor ring and no track running on to her.
- **Her sensors' reach:** dashed `4 3` in Sensors green at .5, at 5 km round
  her, only when it's known (above).
- **Her:** the amber chevron with the glow, pulsing (§6), pointing the way
  she last moved (up before she has).
- **Words:** top left, the belt's name in capitals (Text, 9.5,
  letter-spacing 1), and under it where she is in Text, 10, broken after the
  comma onto a second line. Docked at her host with no place of her own,
  "docked at the Full Measure", and with the host's place, "docked at the
  Full Measure," over "9 km out from the core, bearing 151°". Words keep a
  Background halo, so marks under them don't cut them.
- **Live:** redrawn once a second while it's shown (the host's "last seen"
  and the ships' "seen" age, and the bearing ring's marks go round with their
  orbits), and every 100 ms while she glides.

## Bottom band

Not used.

## Rooms, compartments and the highlight

No rooms. The highlight is her chevron.

## Info line

Unchanged: it's the bottom band's.

## Code

- `src/station_map/belt.lua`: the reducer: her place, the belt's id and
  name, the host she's docked at and its place, whether a sensor array is
  fitted, the logs (with her place at the last sweep, `B.space_contacts`),
  and the cue as she arrives. `tests/belt_test.lua`.
- `src/station_map/work.lua`: `W.moving`, whether she's moving in the belt,
  shared with the space scene. `tests/work_test.lua`.
- `src/main.lua`: the `belt` and `belt-view` messages, Space.Contacts to the
  belt reducer as well as the chart, the three views
  switching each other off, auto_view's arrival and move starts
  (`follow_belt`), and `storage`.
- `ui/lib/belt.js`: the message's cleaning, `placeText`, the disc's framing,
  `Glide`, her place between ticks, `beltShips` and `beltShipText`, the
  sweep's ships placed and worded, and `compassMarks`, the bearing ring's
  marks and where she'd travel next. Pure, tested in `belt.test.js` (with the
  check that a place in a belt is its core plus her `x` and `y` on the star's
  axes, and that a mouth's bearing comes from its place, not `edge.bearing`).
- `ui/belt-view.js`: the SVG and the button. `setContacts` takes the sweep,
  `setCharts` and `setCourse` the charts and the course.
- `ui/main.js`: the toggles, the charts, the course and the sweep passed on
  from the chart's messages, and the redraw loop shared with the chart and the
  lanes map.
- `dev/preview.html?belt=arriving` (also `rcs-rim`, `sweeps`, `skiff`,
  `freighter-seen`: a skiff whose sweep saw her freighter again, a dark
  contact and the Mule under drive; `docked-pair`: docked at the Full Measure
  8.7 km out; `compass`: Gannet with the Senara charts, the Maelor mouth and a
  course plotted home) shows it without the game.
- The options it was picked from: `docs/maps/reference/belt-mockup.html`; for
  the ships and the docked pair, `belt-ships-mockup.html`; for the bearing
  ring's marks, `belt-compass-mockup.html` (`belt-compass-options.png`).

## Where it differs from the style guide

- **Where you've been is drawn** (§6, "one place"): the track and the sweeps
  are the player's own log, the thing the game leaves them to keep. They're
  quiet next to her (amber at .3 and green washes, never pulsing), so only
  she is lit.
- **No zoom or pan** (§8.3): a belt is at most 19 km across and always fits
  the band.
- **No tooltips** (§13.4): every mark is named, or explained by this doc.
- **Other ships aren't "where she is now"**: as on the chart, a ship is drawn
  where the last sweep saw her and aged, since the game doesn't say more.
