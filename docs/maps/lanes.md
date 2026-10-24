# The lanes map

*Status: built. Last updated 2026-10-24.*

## What it is and when it shows

A schematic of the galaxy's twenty systems and the lanes between them, drawn
over the top band: where you are, the lanes open from there now, the lane
she's in while she's in one, and the branches you've seen open elsewhere. It answers "which way round?" before a
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
its state but doesn't draw.

The map shows only what the player knows. The topology is public:
`help lanes` gives the Shallows' twelve in ring order with the trunks
joining them round, says every other pair of stars has a branch, and says
where the relays are; `help mid` names the Mid's eight, and says Dozmary
and Garrow are the deepest. Two things aren't public, and the map leaves
them out:

- **Where the stars are.** The Shallows are evenly spaced round a circle,
  the Mid's evenly round a smaller one inside it, the deep two nearest the
  centre. Nothing about the drawing reflects galaxy.yaml's orbits, and no
  lane is drawn longer for taking longer.
- **When a branch opens.** A branch's state is only what the charts in your
  system last said. The map never predicts an opening or a closing, and it
  says how old what it shows is.

The galaxy has a third band, the Core, inward of the Mid, that the game
doesn't have yet. The layout takes it from the star list: when stars with
`band: "core"` are added to `SYSTEMS`, they're drawn on a disc at the centre
and the Mid becomes a band round it, its deep stars on its inner edge, and a
lane between two Mid stars goes round the band instead of across the Core
(`docs/maps/reference/lanes-ring-core-option.png`).

## Where its data comes from

The **topology** is hard-coded in `ui/lib/lanes.js`: the twenty stars, the
Shallows round the ring from Petroc and then the Mid, each with its band,
whether it has relays, whether it's one of the deep two, and its stations.
The lanes come from them, as the game makes them: a trunk between each
Shallows star and the next round the ring, Feock back to Petroc, and a
branch for every other pair, class `mid` if an end is in the Mid: 12 trunks,
54 Shallows branches, 124 Mid ones. Their ids are the game's, the two stars
sorted ("maelor-senara"). A vitest test checks it against
`content/game/galaxy.yaml` (the stars in order with their bands and relays,
the trunks, and a branch for every other pair), `content/help/lanes.md` (the
ring's order, the Mid's names, where the relays are), and
`content/game/system.yaml` (every `station` and `port` body under each star)
when `~/dev/empyreal` is there, and is skipped otherwise; and that the Lua
side has the same stars. Zennor is a port on Tamsin, and it's listed under
Senara with the stations.

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

The ring, with the Mid inside it, across the band left of the zoom buttons,
and a key in a card in the top-left corner
(`docs/maps/reference/lanes-ring-options.png`, option A):

- **The Shallows:** a Star dot (4 px radius) for each of the twelve, evenly
  round a circle in ring order, Petroc at the top and clockwise. The circle
  is the trunks, 2 px in the lightest Tone: trunks never close, so they have
  only the one look.
- **The Mid:** a disc inside the ring (`#0c1320`, its rim dashed `2 3` in
  the darkest Tone, "THE MID" inside its lower left), its eight a smaller
  dot (3.2 px, .8): six evenly round it, Dozmary and Garrow either side of
  the centre.
- **Names** outward from the centre, 10 for the Shallows and 8.5 for the
  Mid, the deep two in italics. Yours is in Text, those an open lane from
  here reaches are `#c3ccd8`, the rest Dim at .75.
- **Stations:** a Glass diamond over a settled star. **Relays:** two short
  arcs either side of a star with them, in the lightest Tone: every Shallows
  star, and Kilmar, Garrow and Caradon.
- **Branches**, each a curve bowed toward the centre, so one between
  neighbours isn't taken for the ring:
  - open from your system now: solid Glass, 1.8 px, a Mid branch dashed
    `6 2.5`;
  - seen open elsewhere, and not one of your system's: dotted `2 3` in
    Glass, at .75 seen under an hour ago, .5 under a day, .3 older. Its age
    is all the fading says. While the key is folded, the age is written on
    it too ("2h", "1d", in Glass 8 on a dark tab), at its middle or nudged
    along it to where it's clearest of the stars;
  - closed: not drawn. Your system's are counted in the key. With 178
    branches, mostly closed, every visit records about sixteen closed ones,
    and drawing them would bury the map.
- **The key**, a card in the top-left corner styled as the action card is
  (action-card.md) but with a Tone rim (`.lanes-card` in `map.css`).
  Folded, the default, it's one line, "From Senara · 4 open · 15 closed",
  and a ▸ that unfolds it: the open lanes are on the map, and the ages of
  the ones seen elsewhere are written on them. Unfolded (▾), it lists each
  lane open from your system with its line, the star it goes to and its
  class (trunk, branch, Mid branch), then "Seen open elsewhere", each with
  its line, its name ("Petroc–Maelor") and "2h 10m ago". A list taller than
  the band scrolls. It folds back with ▾, and stays as you left it while the
  panel's open. The key was first a 150 px column at the right, which
  took too much of a narrow panel; the options it was picked
  from are `docs/maps/reference/lanes-key-options.png` (C).
- **You are here:** an amber ring round your system's dot, with the glow,
  pulsing (§6). Not drawn while she's in a lane.
- **In a lane:** the lane is lit amber, solid at .3 behind her, dashed `4 4`
  at .7 ahead. Her amber chevron sits at her progress, pointing the way she's
  going. The card's top line says "in the Maelor lane" in amber, naming
  the far star as the game does, with the time left at its right. Her system is the far one
  already (the game moves her there as she goes in), so the key's lanes are
  its.
- **Zoom and pan:** the wheel, a drag (not one starting on the card), and the
  + − ⌂ buttons at the right, as on the chart. It's fitted to the band until you zoom or
  pan, then yours until ⌂; it zooms from the fit to six times in, and no
  further out than the fit. Zooming spreads the stars: the names, dots and
  key stay their size, so names that crowd at the fit come apart.
- **Live:** redrawn once a second while it's shown, so the ages tick, and
  smoothly (every 100 ms) while she's in a lane.

## Bottom band

Not used.

## Rooms, compartments and the highlight

No rooms. The highlight is your system's ring or her chevron, never both.

## Info line

Unchanged: it's the bottom band's.

## Code

- `ui/lib/lanes.js`: the topology, the message's cleaning, your system's
  open lanes (`openHere`), the branches seen open elsewhere
  (`seenOpenElsewhere`), the layout in units (`layout`), a lane's curve
  (`lanePath`), and her place in a lane (`laneFix`). Pure, tested in
  `lanes.test.js` along with the check against the game's content.
- `ui/lanes-view.js`: the SVG, its zoom and the ⋈ button.
- `ui/main.js`: the two toggles switching each other off, and the redraw loop
  shared with the chart.
- `src/station_map/lanes.lua`: the reducer, the stars, its sightings and the
  lane she's in; `tests/lanes_test.lua`.
- `src/station_map/charts.lua` carries a mouth's `open` through to the chart.
- `src/main.lua`: the `lanes` and `lanes-view` messages, and `storage`.
- `dev/preview.html?lanes=senara` (also `in-trunk`, `in-mid`, `dozmary`,
  `petroc`) shows it without the game; `&zoom=0.5` opens it zoomed in, and
  `&unfold` with the key's card unfolded.
- The options it was picked from: `docs/maps/reference/lanes-ring-options.png`
  (A, the ring; B a departures board; C the ring unrolled into a line), and
  `lanes-ring-core-option.png`, A with a Core. The six-system timetable
  before it was picked from `lanes-mockup.html` (B).

## Where it differs from the style guide

- **A schematic, not a place** (§2.2): no one sees the galaxy whole, and
  drawing the stars where they are would give away when branches open. So
  it's a diagram with even spacing, as a transit map is.
- **Zoom keeps the text its size** (§8.3): it spreads the stars rather than
  magnifying the drawing, since what crowds at the fit is the names.
- **No tooltips** (§13.4): every mark is named, and the key's card says the
  rest.
