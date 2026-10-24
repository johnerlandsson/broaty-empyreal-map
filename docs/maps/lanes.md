# The core lanes map

*Status: built. Last updated 2026-10-23.*

## What it is and when it shows

A schematic of the core's six systems and the lanes between them, drawn over
the top band: where you are, the lane she's in while she's in one, and each
branch's state as you last saw it. It answers "which way round?" before a
`plot`. It doesn't replace one: it has no times or fuel.

It shows while the **⋈** button is on. The button sits left of the chart's
◎, styled like it, and appears when ◎ does: once the game has sent the
charts. ⋈, ◎ and the belt map's toggle (belt.md) each cover the top band,
so switching one on switches the others off. With the auto_view setting on, the map switches itself on when
your ship enters a lane and off when she leaves it, as the chart does when
she travels and stops (orrery.md); ⋈ pressed in between holds until what she's
doing changes again. A disconnect hides the button and the map, and leaves it on or off
as it was. A reopened panel gets the choice back. It doesn't outlive the
session. While it's on, the station model or space scene underneath keeps
its state but doesn't draw. The map doesn't zoom or pan: it always fits the band.

The map shows only what the player knows. The topology is public, since
`help lanes` names the six systems, the trunks and the two branches. Two
things aren't public, and the map leaves them out:

- **Where the stars are.** The stops are evenly spaced down the band, inner
  to outer. Nothing about the drawing reflects galaxy.yaml's orbits, and no
  lane is drawn longer for taking longer.
- **When a branch opens.** A branch's state is only what a mouth in your
  system last said. The map never predicts an opening or a closing, and it
  says how old what it shows is.

## Where its data comes from

The **topology** is hard-coded in `ui/lib/lanes.js`: the six systems inner to
outer, each with its stations, and the seven lanes by id, class and ends. The
ids are the game's, the two stars sorted ("maelor-senara"). A vitest test
checks it against `content/game/galaxy.yaml` (the lanes, and the stars' order
by `a`) and `content/game/system.yaml` (every `station` and `port` body under
each star) when `~/dev/empyreal` is there, and is skipped otherwise. Zennor is
a port on Tamsin, and it's listed under Senara with the stations.

**Where you are** is `Space.Charts`' `system`.

**A branch's state** comes from the `mouth` places in `Space.Charts`. The
charts list only the mouths in your system, and of those only the open ones
(a trunk's is always open), plus a closed branch's while she's at its mouth
or bound there, with `open` false (`SpaceSystem.listed`; `help lanes` says
`charts` leaves a closed branch out). Every pair of stars has a lane, so
`src/station_map/lanes.lua` has the stars' ids, and a lane of your system
with no mouth listed is a closed branch, seen closed now. Each sighting is a
lane id, from the mouth's id `mouth:<here>:<there>`, with its `open` and
when. The reducer keeps them:

- every Space.Charts stamps every lane of your system with now: what its
  mouth says, or closed if it has none listed (a Space.Charts with no
  `places`, or a system that's no star in the list, says only what's listed);
- crossing into another system, or disconnecting, stamps the lanes you could
  see till then with now, since you saw them that long;
- `main.lua` stores the sightings in Mallard's `storage` (per plugin and
  world) after each Space.Charts and each disconnect, and loads them at start,
  so "last seen" survives a restart. A stored value that won't read is no
  sightings.

**The lane she's in** comes from `Ship.Status`. In a lane her `destination`
is the far mouth, `mouth:<far>:<near>`, in another system. A trip to a mouth
in your own system has the same shape, so a lane trip is told apart by
either of:

- the status text, "in the Maelor lane 40%" (the game's `statusText`), or
- her having left from the mouth facing it (`mouth:<near>:<far>`), which also
  covers a host's whereabouts, which carry no status text;

and it stays a lane trip for as long as the destination is the same. Her
place along it is timed as the chart times a trip: arrival is each status's
`eta` on from when it came (`received`), and `progress` is the share done. As
she goes in, the game moves her to the far system (`frame`), so its
Space.Charts comes while she's still in the lane, and the far system's mouths
are "now".

## Top band

A timetable, read top to bottom, inner to outer:

- **Stops:** a Star dot (4.5 px radius) on a vertical trunk line, the
  system's name beside it in 11, then its stations, each a Glass diamond and
  its name in Dim, 9. Your system's name is in Text.
- **Trunks:** the line between the stops, 2 px, in the lightest Tone. Trunks
  never close, so they have only the one look.
- **Branches:** brackets to the left of the line, joining their two stops:
  Petroc–Maelor nearer the line, Keyne–Mabyn outside it, its stub at Keyne
  cut where the Petroc bracket crosses it, like a bridge.
  - Open as last seen: solid Glass, 2 px.
  - Closed as last seen: dashed `5 4` in the middle Tone, 1.5 px.
  - Never seen: dotted `1 4` in the darkest Tone.
- **The key**, at the right of the last two stops: each branch's line,
  its name ("Petroc–Maelor") and its state: "open · now" while one of its
  mouths is in your system, "closed · seen 3d 4h ago" otherwise, "not seen"
  if you've never been where it starts.
- **You are here:** an amber ring round your system's dot, with the glow,
  pulsing (§6). Not drawn while she's in a lane.
- **In a lane:** the lane is lit amber, solid at .3 behind her, dashed `4 4`
  at .7 ahead. Her amber chevron sits at her progress, pointing the way she's
  going. The key's top line says "in the Maelor lane · 3m 40s" in amber,
  naming the far star as the game does, with the time left.
- **Live:** redrawn once a second while it's shown, so the ages tick, and
  smoothly (every 100 ms) while she's in a lane.

## Bottom band

Not used.

## Rooms, compartments and the highlight

No rooms. The highlight is your system's ring or her chevron, never both.

## Info line

Unchanged: it's the bottom band's.

## Code

- `ui/lib/lanes.js`: the topology, the message's cleaning, a lane's state
  and words (`laneState`), and her place in a lane (`laneFix`). Pure, tested
  in `lanes.test.js` along with the check against the game's content.
- `ui/lanes-view.js`: the SVG and the ⋈ button.
- `ui/main.js`: the two toggles switching each other off, and the redraw loop
  shared with the chart.
- `src/station_map/lanes.lua`: the reducer, its sightings and the lane she's in;
  `tests/lanes_test.lua`.
- `src/station_map/charts.lua` carries a mouth's `open` through to the chart.
- `src/main.lua`: the `lanes` and `lanes-view` messages, and `storage`.
- `dev/preview.html?lanes=senara` (also `in-trunk`, `in-branch`, `petroc`)
  shows it without the game.
- The options it was picked from: `docs/maps/reference/lanes-mockup.html`
  (B, the timetable).

## Where it differs from the style guide

- **A schematic, not a place** (§2.2): the core has no place a player sees
  whole, and drawing the stars where they are would give away the seasons.
  So it's a line diagram with even spacing, as a transit map is.
- **No zoom or pan** (§8.3): six stops always fit the band.
- **No tooltips** (§13.4): every mark is named, and the key says the rest.
