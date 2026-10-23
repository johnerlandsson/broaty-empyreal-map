# The orrery

*Status: built. Last updated 2026-10-22.*

## What it is and when it shows

A true-scale chart of the star system you're in, drawn over the top band: the
star, the planets, the stations, the belts with how sure the game is of where
they are, the lane mouths, your ship, and her route when she's under way. Every
mark is worked out from the clock, so it moves.

It shows while the **◎** button is on. The button sits left of the band's
+ − ⌂ and appears once the game has sent the charts, docked or not, aboard a
ship or not. It hides again when you disconnect, and the chart with it. The
chart stays on or off as you left it through docking, undocking, walking about
and a dropped connection, and a reopened panel gets the choice back. It doesn't
outlive the session.

While it's on, + −, the wheel and drag act on the chart, and the station model
or space scene underneath keeps its state but doesn't draw. The chart shows the
system in the latest charts, so crossing into another star's system switches it.

The map shows only what the character knows. Two things are withheld on
purpose:

- **Search legs.** When she reaches where her charts put a belt and it isn't
  there, she hops or sweeps on to find it. Where those legs go isn't the
  player's to know, so they're never drawn. While she searches, the belt's own
  arc lights amber and pulses instead, since she's somewhere along it as far as
  you know. She isn't drawn as a chevron and her route isn't drawn.
- **Where a wild lane's mouth faces.** The game sends it only for stable lanes
  (see below), so a wild lane's mouth gets no mark and no off-view marker, and
  nothing on the chart hints at a direction.

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
  as the game flies her. Arrival is each status's `eta` on from when it came.
  Departure is kept from the trip's first status: `progress` comes rounded to
  two places, so worked out again late in a trip it would swing by minutes;
- a trip only ends, or a search starts a new leg, once it has come due. Before
  that a longer `eta` is a delay (debris), not a search, and going loose is a
  stop or a hold wherever she was: she isn't placed at the point she was bound
  for, and the belt isn't lit;
- not drawn when she can't be placed: under way with no remembered start (the
  panel started mid-trip), loose with nowhere known, in a lane, or when no
  `Ship.Status` came (as a guest aboard someone else's ship). The destination's
  ring is still drawn if she's bound somewhere.

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
  top, a line a mouth: "Maelor lane, somewhere on the edge".
- **Ports** as a small Glass dome on their planet's edge where the town is now,
  turning with the planet, and no orbit ring. The dome sits on the disc as
  drawn, so it stays on the edge when the planet is drawn bigger than it is.
  Named outward from the planet, or under the planet's name when it's on the
  bottom of the disc, by the satellites' rule; hovered, "on Tamsin's surface".
- **A body of a kind the chart doesn't know** as a station's diamond, so it
  still shows.
- **Your ship** as an amber chevron, and **her route** dashed ahead, solid
  behind, with a ring where she'll arrive. Nothing else on the chart is amber
  except a belt she's searching.
- **Names** are small and Dim. A planet's satellite is named only once its
  orbit is 80 px across (it is drawn, and hoverable, before). A satellite whose
  orbit is under 8 px across folds into its parent, unless it's where she is or
  is bound.
- **Off the view**, a body, a mouth with a bearing or a belt that isn't lost
  gets a small chevron at the band's edge, with its name and its distance from
  your ship in thousands of km ("Orrin 16k"), or from the middle of the view
  when she can't be placed. A lost belt gets none, and nor does a body whose
  disc (the star's bright glow) still reaches into the band.
- **A scale bar**, top left.
- **Hover** any mark for its name; a belt's error and when it was seen; a
  port's planet; where she's bound and when she'll arrive, or where she's
  docked or landed.

**Zoom and framing.** + − and the wheel zoom, drag pans, ⌂ frames. You can zoom
in to 1,000 km across and out to 2.3 times the system's radius, times the band's
width over its height when that's more than 1, so the whole system always fits a
wide band. ⌂ frames her line and her when she's under way, else the body she's
nearest with its satellites, else the whole system. The view reframes itself
only when the chart is turned on, when the system changes (and again on the
first ship status after it), and when a trip starts or ends while you haven't
zoomed or panned since. Until you pan or zoom, it also follows her, keeping the
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
  state (`name`, `from`, the held point, `searching`, `received`, `depart`)
  and the chart's on/off, which a disconnect leaves as it was. Pure; tests in `tests/charts_test.lua`.
- `src/main.lua`: posts `charts`, `chart-ship` and `chart` `{on}` to the panel
  when they change, takes the choice back from the panel, and replays all three
  on `ready`.
- `ui/lib/orbits.js`: pure maths with no DOM. Kepler's equation, positions at a
  time, the transit line and her position, error growth, framing boxes, the
  off-view markers and folding. Tests in `ui/lib/orbits.test.js`.
- `ui/chart-view.js`: the SVG, the ◎ button, zoom and pan (`attachPanZoom` and
  `zoomButtons` from `ui/lib/svg.js`), following her, the tooltips.
- `ui/main.js`: wires the messages to the chart and keeps the redraw timer.
  `setCovered` in `ui/space-view.js` stops the scene drawing while the chart is
  over it.
- Preview: `dev/charts-fixture.js` builds Senara's and Maelor's systems from the
  game's content, and `?chart=` in `dev/preview.js` opens the chart on one of
  its scenarios (`parked-gannet`, `under-way-orrin`, `searching-cinders`,
  `at-point`, `docked-tiss`, `landed-zennor`, `none`, `maelor`, or `edge` for an invented mouth
  bearing). The bar's menu switches between them.

## Where it differs from the style guide

- Drawn as SVG, but redrawn from scratch every second (and about ten times a
  second while she's under way) rather than animated, because every position
  comes from the clock.
- Amber marks something that isn't a model highlight: her route, and a belt
  she's searching for.
