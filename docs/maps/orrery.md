# The orrery

*Status: built. Last updated 2026-10-24.*

## What it is and when it shows

A true-scale chart of the star system you're in, drawn over the top band: the
star, the planets, the stations, the belts with how sure the game is of where
they are, the lane mouths, your ship, her route when she's under way, and the
course she has plotted while she's stopped or docked. Every mark is worked out
from the clock, so it moves.

It shows while the **◎** button is on. The button sits left of the band's
+ − ⌂ and appears once the game has sent the charts, docked or not, aboard a
ship or not. It hides again when you disconnect, and the chart with it. With
the auto_view setting on (the default), the chart switches itself on when your
ship starts travelling in a system and off when she stops (docks, parks, reaches
a belt, a port or high orbit over a planet, or you step off her). It switches only when what she's doing
changes, so ◎ pressed in between holds until then; the first status after a
login or a reconnect counts as a change. With the setting off, the chart stays
on or off as you left it through docking, undocking, walking about and a dropped
connection. Either way, a reopened panel gets the choice back. It doesn't
outlive the session. The lanes map's **⋈** (lanes.md) sits left of ◎,
and the belt map's toggle (belt.md) left of that; switching any of the three
on switches the others off.

While it's on, + −, the wheel and drag act on the chart, and the station model
or space scene underneath keeps its state but doesn't draw. The chart shows the
system in the latest charts, so crossing into another star's system switches it.

The map shows only what the character knows. Three things are withheld on
purpose:

- **Search legs.** When she reaches where her charts put a belt and it isn't
  there, she hops or sweeps on to find it. Where those legs go isn't the
  player's to know, so they're never drawn. While she searches, the belt's own
  arc lights amber and pulses instead, since she's somewhere along it as far as
  you know. She isn't drawn as a chevron and her route isn't drawn.
- **Where a wild lane's mouth faces.** The game sends it only for stable lanes
  (see below), so a wild lane's mouth gets no mark and no off-view marker, and
  nothing on the chart hints at a direction.
- **When a branch opens.** A closed mouth says it's closed and nothing more:
  the game never says when it will open (`help lanes`: "watch the stars"), and
  the chart doesn't work it out from the stars' orbits.

## Where its data comes from

`Space.Charts`, from the game's `sendChartsGmcp` in `~/dev/empyreal`: the
star's id as `system`, the clock's `epoch`, the `bodies` (star, planets,
stations, ports) and the `places` (stations, belts, mouths), each with an orbit
(parent, `a` in km, `e`, `peri`, `phase`, `period` in seconds). A belt carries a
`fit` of when it was `seen` and how far off it may be (`error`, km, as of `at`).
It is resent when places or fits change and every game hour.

**Ports.** A town on a planet (since 2026-10-22, Zennor on Tamsin) is a body of
kind `port` whose orbit is its planet's surface: `a` is the planet's radius and
`period` its day (gmcp.md §8.4). Among `places` the same id is a `station`; the
two merge into one item, keeping the body's kind, so it's drawn once, as a
port. Docked there, she has landed; there and not docked, she's over it (the
game's "You arrive over Zennor.").

`Ship.Status` gives her `name`, `docked`, `location`, `destination`, `progress`
and `eta`, and her host's when she's docked at another ship, which is where she
rides. `src/station_map/charts.lua` also remembers what the payload leaves out:
the place she left (`from`), the point she's holding at once her trip there
ends, whether she's searching for a belt, when each status came and when the
trip began (`depart`; whole seconds, the game's tick). That is how her route and
her place are worked out:

- docked or at a place: at its position, a belt's being where the fit puts it;
- under way: a straight line in the frame of the nearest body that holds both
  ends, from where she left to where the destination will be when she arrives,
  as the game flies her. A lane mouth has no orbit and rides with its star, as
  in the game, so a trip to or from one is in the star's frame. Arrival is each status's `eta` on from when it came.
  Departure is kept from the trip's first status: `progress` comes rounded to
  two places, so worked out again late in a trip it would swing by minutes;
- a trip only ends, or a search starts a new leg, once it has come due. Before
  that a longer `eta` is a delay (debris), not a search, and going loose is a
  stop or a hold wherever she was: she isn't placed at the point she was bound
  for, and the belt isn't lit;
- stopped mid-trip (`stop` or `hold`): the game sends only "adrift", with no
  location. charts.lua keeps the trip she stopped on and when she stopped, as
  `stop`, and the chart places her where that put her, at rest. The game has
  her ride with the body whose reach she's in, which the charts don't give, so
  she rides with the trip's frame: the same body unless she stopped close by a
  deeper one. Her next trip starts from there. A trip from a stop can be
  stopped on in turn, up to four deep;
- not drawn when she can't be placed: under way with no remembered start (the
  panel or the plugin started mid-trip, a plugin reload included), loose with
  nowhere known, in a lane, or when no
  `Ship.Status` came (as a guest aboard someone else's ship). The destination's
  ring is still drawn if she's bound somewhere.

**High orbit** (Empyreal 2a84c78, 2026-10-24). A planet is a destination:
`travel tamsin` ends 1.5 times Tamsin's radius out, on the side she came in
from, where she rides with it. `Ship.Status` sends `location` null there and
no offset, so charts.lua works it out as `scene.lua` does (space-scenes.md):
her status "over Tamsin", or a trip to a planet that comes due and goes loose,
leaves her `over` it. When it saw the trip, charts.lua keeps it,
`over = { planet, from, depart }` (or `stop` or `from_over` in place of
`from`); from the status alone it's `{ planet }`, or `{ name }` until the
charts name it. The chart does the game's sums
again: her side is the way from the planet's centre to where she set out, at
the moment she set out, and she rides with the planet from there. With no
start known it knows only the planet. A trip to a planet is drawn ending on
that ring, not at the planet's centre, and her next trip starts from the ring
(`from_over`), stops on it included. (The game aims from where she was when the
course was plotted, a little before she sets out if she plotted at the berth,
so the side can be a few degrees off.)

**The course she has plotted.** Since 2026-10-24 (Empyreal cbcc84f and
664c662) `plot` stores a course, and `Ship.Course` carries it (gmcp.md §8.6):
`to` (a location id, or for a ship her vessel key or `contact-N`), `name`,
`km`, `seconds`, `fuel` from where she'd be when it was done, `ragged` (a
failed plot, ×1.15 time and fuel) and `at`, wall-clock ms it was plotted. It's
null with no course, or no ship. The game sends it as a plot finishes, and
null as she arrives or `plot clear` drops it; a plot still being worked out
isn't sent. It comes under the `Ship 1` the plugin already advertises, and
`Ship.Course` is in `gmcp_access`.

The game aims a course at a fixed point: where the place would be on arriving,
in the frame it rides in. That point isn't sent, so the chart works out the
same one, once: the destination's position at `at` plus `seconds`, fixed in the
frame of the nearest body that holds her and it (the trip line's frame). It
rides with that body and **never follows the destination round**: an old plot's
line ends where the place was going to be, which may be well behind it now, as
flying it would find. The game adds the undock's few seconds to a course
plotted at a berth; the chart doesn't, which moves the point by a few km.

Out of a lane, the game sends her status at the far mouth before the new
system's charts. Crossing into a new system forgets only what isn't one of its
bodies or places, so her first trip from the mouth still has its start.

A belt is drawn as an arc along its fit, reaching the error either way. After
`at` the error grows and never shrinks, until the hourly resend corrects it. At
90% of half way round it is **lost**: the whole orbit, dashed.

**Lane mouths.** A mouth has no orbit, only a distance, 15,000 km out, which
`help lanes` tells every player. Since 2026-10-22 the game sends where a
stable lane's mouth faces, as `edge {r, bearing, at}`: the bearing in degrees,
counterclockwise from +x as orbit angles are, as of `at`. It creeps round as
the stars orbit the galaxy, about 0.08° an hour for Maelor's, and the hourly
resend keeps it fresh, so the chart doesn't project it. The maintainer counts a
stable lane's direction (Senara to Maelor or Keyne) as public, but **wild
lanes**, which come and go nearer the galactic core, won't get one, so a mouth
without `edge` is still drawn only as "somewhere on the edge".

Since 2026-10-23 (Empyreal 2fd6c81) a mouth also carries `open`: whether its
lane is open now. A trunk always is; a branch (Petroc–Maelor, Keyne–Mabyn) is
open only about forty days a year, while its stars pass close. The charts are
resent when it changes. `open` is null for every other place, and a mouth
without it is drawn open. A system can have three mouths now: Keyne and Maelor
have two trunks and a branch each.

## Top band

Everything the style guide's §13 draws:

- **Orbits** as thin rings, round or elliptical, round each parent's position
  now. The **edge** is a dotted ring at the mouths' distance.
- **The star** with a soft glow; **planets** as discs lit on the side toward the
  star; **stations** as small Glass diamonds, named on hover only.
- **Belts** as a fading arc with a few rocks at its centre, named with their
  error ("Gannet Belt ±2,600"). A lost belt is its whole orbit, dashed, named
  "· lost".
- **Mouths** with a bearing (a stable lane's) as a double chevron named by the
  star it leads to; without one (a wild lane's), the edge ring is named at its
  top, a line a mouth: "Maelor lane, somewhere on the edge". A **closed**
  mouth's chevrons are dashed in Dim, as a closed room's outline is, and its
  name says so: "Petroc · closed", "Petroc lane, closed, somewhere on the edge".
  Mouths nearer each other than 18 px at the zoom you're at (Maelor's Senara
  and Petroc mouths can be under a degree apart) are spread evenly along the
  edge about their middle and their names stacked; zoomed in they sit where
  the game puts them.
- **Ports** as a small Glass dome on their planet's edge where the town is now,
  turning with the planet, and no orbit ring. The dome sits on the disc as
  drawn, so it stays on the edge when the planet is drawn bigger than it is.
  Named outward from the planet, or under the planet's name when it's on the
  bottom of the disc, by the satellites' rule; hovered, "on Tamsin's surface".
- **A body of a kind the chart doesn't know** as a station's diamond, so it
  still shows.
- **The last sweep** (`Space.Contacts`): its ships where it saw them, notes on
  what it had behind a body or missed, and its age in a card in the bottom-left
  corner. See [contacts.md](contacts.md). A chase's route ends where the sweep
  saw the ship.
- **Your ship** as an amber chevron, and **her route** dashed ahead, solid
  behind, with a ring where she'll arrive. Nothing else on the chart is amber
  except a belt she's searching, the ring of a high orbit she's in, and the
  course she has plotted.
- **In high orbit**, an amber dashed ring round the planet at 1.5 times its
  disc as drawn (so it stays outside a disc drawn bigger than it is), her
  chevron on it on the side she came in from, and the ring named "high orbit
  over Tamsin" above it. With her side unknown it's the ring alone, a little
  stronger, as the neutral mark; hovered, "high orbit over Tamsin, which side
  not known". ⌂ frames the planet out to its furthest satellite.
- **The course she has plotted**, while she's docked, landed, parked or
  stopped: a line from her chevron to where it aims, amber dotted `1 4` at
  .45, fainter than a trip's line, with a 4 px amber ring at .5 at the aim.
  In high orbit it starts from her chevron on the ring. It isn't drawn for a
  course to a ship (the charts don't place her), to a wild lane's mouth (no
  bearing), in high orbit with her side not known, or where her place can't
  be worked out; the card still shows. Its destination is never folded into its parent. Once
  she's under way her route takes over, and the line goes.
- **The course card**, top left over the chart, while she's at rest with a
  course: "Course for The Cinders", then "2,000 km · 3m 51s · 7 fuel" as the
  game words them, then "plotted 4m ago" ("just now" under a minute), with
  "ragged" in amber before it for a failed plot. The scale bar moves down
  under it. It goes once she's under way.

  ```
  ┌ Course for Orrin Station       ┐
  │ 9,840 km · 21m 5s · 32 fuel    │
  └ ragged · plotted 1h 12m ago    ┘
  ```
- **Names** are small and Dim. A planet's satellite is named only once its
  orbit is 80 px across (it is drawn, and hoverable, before). A satellite whose
  orbit is under 8 px across folds into its parent, unless it's where she is or
  is bound.
- **Off the view**, a body, a mouth with a bearing or a belt that isn't lost
  gets a small chevron at the band's edge, with its name and its distance from
  your ship in thousands of km ("Orrin 16k"), or from the middle of the view
  when she can't be placed. A lost belt gets none, and nor does a body whose
  disc (the star's bright glow) still reaches into the band. A closed mouth's
  is named "Petroc · closed 21k", its chevron dashed. Markers within 12 px of
  each other share one chevron (dashed only if all of them are closed mouths),
  and markers within 48 px whose names would overlap stack them as one, a line
  each. A name that still overlaps one already placed goes on the other side of
  its own chevron if there's room; bigger stacks are placed first.
- **A scale bar**, top left, under the course card when there is one.
- **Hover** any mark for its name; a belt's error and when it was seen; a
  port's planet; where she's bound and when she'll arrive, or where she's
  docked or landed; "closed" under a closed mouth's name.

**Zoom and framing.** + − and the wheel zoom, drag pans, ⌂ frames. You can zoom
in to 1,000 km across and out to 2.3 times the system's radius, times the band's
width over its height when that's more than 1, so the whole system always fits a
wide band. ⌂ frames her line and her when she's under way, else the body she's
nearest with its satellites (and the course's aim, when one is drawn), else
the whole system. The view reframes itself only when the chart is turned on,
when the system changes (and again on the first ship status after it), and
when a trip starts or ends, or a course is plotted or cleared, while you
haven't zoomed or panned since. Until you pan or zoom, it also follows her, keeping the
zoom, when she drifts out from where ⌂ or a resize left her by more than 35% of
the view. Once you pan or zoom, it holds still until ⌂.

## Bottom band

Not used. The bottom band shows the ship you're in (see
[ship-plans.md](ship-plans.md)).

## Rooms, compartments and the highlight

None: it's a chart, not a floor. Your ship is lit, in the highlight colour with
its pulse (style guide §6), and so is a belt she's searching for.

## Info line

Unchanged: it says where you are aboard.

## Code

- `src/station_map/charts.lua`: the reducer. Cleans `Space.Charts`, keeps her
  state (`name`, `from`, the held point, `searching`, `received`, `depart`,
  `stop`, the high orbit she's `over` and the one a trip left, `from_over`)
  and the chart's on/off, which a disconnect leaves as it was. Pure; tests in `tests/charts_test.lua`.
- `src/station_map/course.lua`: the course reducer. Cleans `Ship.Course` into
  `{ course = { to, name, km, seconds, fuel, ragged, at } }`, or `{}` for none:
  no `to` is no course, no name falls back to `to`, and a figure that isn't a
  finite number of 0 or more is left out. Tests in `tests/course_test.lua`.
- `src/main.lua`: posts `charts`, `chart-ship` and `chart` `{on}` to the panel
  when they change, takes the choice back from the panel, and replays all three
  on `ready`; posts `course` as it changes, replays it on `ready` and clears it
  on disconnect (`tests/main_test.lua`).
- `ui/lib/orbits.js`: pure maths with no DOM. Kepler's equation, positions at a
  time, the transit line and her position, error growth, framing boxes, the
  off-view markers and folding, spreading crowded mouths and stacking
  crowded markers, and the course's line (`courseLine`). Tests in
  `ui/lib/orbits.test.js`.
- `ui/lib/course.js`: `courseCard(msg, ship, now)`, the card's words for the
  moment, or null under way or with no course. Tests in `ui/lib/course.test.js`.
- `ui/lib/contacts.js`: the last sweep, for the chart (contacts.md).
- `ui/chart-view.js`: the SVG, the ◎ button, zoom and pan (`attachPanZoom` and
  `zoomButtons` from `ui/lib/svg.js`), following her, the tooltips, the course's
  line and its card (`.course-card` in `ui/map.css`), which updates on each
  redraw, so its age needs no timer of its own.
- `ui/main.js`: wires the messages to the chart and keeps the redraw timer.
  `setCovered` in `ui/space-view.js` stops the scene drawing while the chart is
  over it.
- Preview: `dev/charts-fixture.js` builds Senara's and Maelor's systems from the
  game's content, and `?chart=` in `dev/preview.js` opens the chart on one of
  its scenarios (`parked-gannet`, `under-way-orrin`, `searching-cinders`,
  `at-point`, `docked-tiss`, `landed-zennor`, `none`, `maelor`, `maelor-lanes` for Maelor's
  three mouths with the Petroc branch closed, `edge` for Senara's mouth with
  its bearing, `to-tamsin` under way to high orbit, `high-orbit` and
  `high-orbit-unknown` up there with her side known or not, or `sweep` and `chase` for the last
  sweep, contacts.md). The bar's menu switches between them. `?course=` opens it with
  a course: `cinders-tiss` (docked, plotted 4m ago), `ragged-orrin` (parked at
  Gannet, a ragged plot over an hour old, its aim fallen behind the station),
  `contact` (a ship seen by her signature: the card alone), `from-orbit`
  (in high orbit over Tamsin, the line from her place on the ring) or `under-way` (her
  trip line has it, and the card goes).
  `docs/maps/reference/course-options.png` has the three looks weighed for the
  course; the amber dotted one was picked.
  `docs/maps/reference/closed-mouth-mockup.html` has the three looks weighed
  for a closed mouth; the dashed one was picked.

## Where it differs from the style guide

- Drawn as SVG, but redrawn from scratch every second (and about ten times a
  second while she's under way) rather than animated, because every position
  comes from the clock.
- Amber marks something that isn't a model highlight: her route, a belt
  she's searching for, and the course she has plotted, which is her route
  before she flies it.
- **The course card is chrome over the chart**, as the corner cards are over a
  plan (style guide §3, corner-cards.md): the same size at any zoom, rimmed in
  its amber, ignoring the pointer. It has no bar and no seconds, since
  nothing's counting down; its age ticks with the chart's own redraws. It
  pushes the scale bar down rather than covering it.
