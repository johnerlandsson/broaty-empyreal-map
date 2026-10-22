# The orrery: design

Date: 2026-10-22
Status: approved 2026-10-22

## What this is

A chart of the star system you're in, drawn live in the Map panel's top
band from GMCP `Space.Charts` and `Ship.Status`. It shows every body and
every place the character knows, each where it is now and moving: the
star, the planets, the stations, the belts with how uncertain their orbits
are, the lane mouths at the system's edge, your ship, and her route when
she's under way.

Why: the game deliberately leaves planning tools to players (travel.md
decision 24) and sends the orbits so a plugin can draw an orrery (decision
47). Today the plugin reads `Space.Charts` only to learn which places are
belts (`src/station_map/scene.lua`).

The user picked option **B** from `docs/maps/reference/orrery-mockup.html`:
a toggle on the top band and one true-scale chart you zoom.

## Goals

- Everything the character knows about the system, where it is now,
  moving live.
- Belts drawn with their uncertainty, and the uncertainty growing with
  time since the belt was seen.
- Lane mouths at the edge: where they face when the game says, and
  otherwise only that they're somewhere on it.
- Your ship, and her route when she's under way.
- It follows `system`: crossing into Maelor's system switches the chart.
- Usable docked, for planning a trip, as well as out in the ship.

## Non-goals

- Planning tools: launch windows, quotes, fuel, travel times. The chart
  shows where things are; it doesn't solve anything.
- Other ships, other players, wrecks: nothing the payload doesn't carry.
- Other star systems. The chart is the system you're in.
- Clicking a place to fly there.
- A setting for the chart, beyond the toggle itself.

## Anti-goals (a failure even if it works)

- **More precision than the character has.** A belt is never drawn as a
  point where its fit is an arc. The chart never extrapolates an orbit the
  game didn't send, never narrows an error the game sent, and never
  invents a position it can't work out from the payload (a mouth without
  its bearing, a loose ship without a location).
- **Spoiling the game.** The map reflects what the player knows and no
  more (the user, 2026-10-22). It never asks the game for anything that
  would give away what the game hides, such as where a belt really is
  while she searches for it. Where the payload carries something the
  player couldn't know, the chart doesn't use it.
- **Distorted distance.** Every distance on the chart is true at its
  scale. No compressed or logarithmic radii, no magnified bubbles.
- **A camera that moves on its own** (style guide §2.6), beyond the rules
  in "Framing" below.
- **Breaking the scenery.** The starfield, the belt rocks and the station
  models behave exactly as now when the chart is off.

## Where it lives

The top band. A new button, **◎**, sits to the left of the band's
**+ − ⌂**, and switches the band between what it shows now (the station
model, or the space scene once you're out) and the chart.

- The button shows once a `Space.Charts` has arrived, docked or not,
  aboard or not, and hides again on disconnect.
- It's lit (Dim border, as the mockup has it) while the chart is on.
- The chart stays on or off as you left it, through docking, undocking
  and walking about. The Lua side keeps the choice so a remounted panel
  gets it back; it doesn't outlive the session (my call: not a setting).
- While the chart is on, the band's + − ⌂ and wheel and drag act on the
  chart. The space scene's canvas and the station model underneath keep
  their state but don't draw (the space view's frame loop pauses while
  hidden, as it does for a hidden panel).
- The bottom band and the info line are unchanged.

## The payload, and what's missing from it

`Space.Charts` (schema `packages/game/src/world/gmcp-schema.ts`, sender
`sendChartsGmcp` in `world/gmcp.ts`, in `~/dev/empyreal`):

- `epoch`: wall-clock ms at tick 0. A tick is a second.
- `system`: the star's id.
- `bodies`: `{id, name, kind: star|planet|station, radius, orbit}`.
- `places`: `{id, name, kind: station|belt|mouth, orbit, fit}`. A
  station appears as both a body and a place, with the same id.
- An `orbit` is `{parent, a (km), e, peri (deg), phase (deg), period (s)}`.
  Mean anomaly at wall-clock time t (ms) is
  `phase + 360 * (t - epoch) / 1000 / period` degrees.
- A belt's `fit` is `{seen, error, at}`: wall-clock ms it was last seen,
  and how far off it may be, in km, as of wall-clock ms `at`. Null for a
  place known exactly.
- It's resent when places or fits change, and every game hour (errors
  grow).

**The mouth's bearing isn't sent.** A mouth has `orbit: null`. It sits
15,000 km out, facing the other star, but which way that is depends on the
galaxy's star orbits, which the payload doesn't carry. The user chose to
have the game send it. The field asked of the game's maintainer
(2026-10-22) is:

```ts
edge: { r: number /* km from the star */, bearing: number /* deg, as orbit angles */, at: number /* wall-clock ms */ } | null
```

on each place, set only for a mouth. The maintainer (cupcake, 2026-10-22)
may keep mouths' directions for players to track and share, so the
bearing may never come. **The chart must work without it.** If the field
lands under another name or shape, follow what the game sends. The chart shows the bearing as of `at`. It
doesn't project it forward, since it drifts only slowly and the payload is
resent hourly.

`Ship.Status` (same schema file) gives `docked`, `location`,
`destination`, `progress` (0–1, two decimals), `eta` (ticks), and `host`
with the same five fields when she's docked at another ship. It's null
off any ship you can fly.

## Positions

All in the system's frame, km from the star, x to the right and y up, with
angles counterclockwise from +x, as the game's orbit angles are (the
builder should confirm the game's convention from `systems/orbits.ts` and
match it, so `peri` and `bearing` line up).

- **A body or place with an orbit:** its parent's position plus its
  offset on its orbit at t, solving Kepler's equation for the eccentric
  anomaly. A belt's orbit is the character's fit, so its position is
  where the fit puts it.
- **A mouth:** `r` along `bearing` from the star, once `edge` is sent.
  Without it, a mouth has a distance but no position: 15,000 km from the
  star, which `help lanes` tells every player (`content/help/lanes.md`).
  It's a named constant in `ui/lib/orbits.js` that cites that file.
- **A point** (`pt:<body>:<x>:<y>`, km from the body, as the game names
  them): the body's position plus (x, y). Only `destination` ever carries
  a point id. Once she's arrived, `location` is null (`space.ts`, "A point
  is no place").
- **Unknown ids** (a place not in the charts, a body missing its parent):
  no position. Never throw (style guide §10).

**Time:** the panel's wall clock, `Date.now()`, against `epoch`. Positions
are only as good as the client's clock (my call: no skew correction; a
skew of a second is a tick).

## Your ship

Read from `host` when set (she rides with her host), else from her own
fields, as `scene.lua` does.

- **Docked:** at the station's position (`location`).
- **At a place** (`location` set, not docked): at that place, a belt's
  being its fit's.
- **Stopped at a point:** the game sends `location` null, but the player
  told her where to go and she holds there, riding with its frame. The
  Lua side remembers the point she was bound for when `destination` goes
  from a point id to null with `location` null, and she's drawn there
  until the next trip, docking, or a `location` arriving. A point in
  another system, or a status that isn't hers (a host's change), drops
  it.
- **Under way** (`destination` set): the game flies her in a straight
  line, in the frame of the body that holds both ends, from where she was
  at departure to where the destination will be on arrival
  (`systems/space.ts`, the `transit` position). The chart does the same:
  - `from`, the place she left, is remembered by the Lua side: the
    `location` (or docked station) she had in the last `Ship.Status`
    before `destination` appeared.
  - The frame is the nearest body that both `from` and the destination
    orbit, directly or not (Tamsin for T.I.S.S. to Gannet Belt, Senara for
    T.I.S.S. to Orrin Station).
  - Arrival is when the Lua side received the status plus `eta` seconds.
    The Lua side stamps each `Ship.Status` with `os.time()` (whole seconds,
    the game's tick) so a remounted panel still has it. Departure is
    arrival less `eta / (1 - progress)`. Recompute both on each status.
  - Her line runs from `from`'s offset from the frame body at departure
    to the destination's offset at arrival. Her position at t is the
    frame body's position at t plus the point `(t - depart) / (arrive -
    depart)` along it, clamped to 0..1.
  - She points along the line.
- **Searching for a belt.** When she reaches where her charts put a belt
  and it isn't there, the game starts new legs: a hop to where the belt
  really is, or sweeps on along the fit's orbit. `destination` stays the
  belt, and `progress` and `eta` start again. Where those legs go isn't
  the player's to know, so the chart doesn't draw them. The Lua side
  marks a trip **searching** when, with the same destination (a belt),
  `progress` falls, or `eta` grows by more than a few seconds over what
  the time since the last status would allow. Searching, she isn't drawn
  as a chevron. Instead the belt's own arc is drawn in the highlight
  colour (amber, pulsing, as §6 lights a place), since she's somewhere
  along it as far as you know. Her route isn't drawn. Between legs she
  stops loose to sweep (`space.ts`, `missed`): `destination` and
  `location` both go null. A trip to a belt that ends that way is
  searching too. Searching holds through sweeps and hops, and ends when
  she's at the belt (`location` is it), docks, or is bound for or at
  anywhere else. A search the game gives up on leaves her loose with the
  arc still lit until then; that's accepted, since she's still near
  that orbit as far as the player knows.
- **Can't be placed:** under way with no `from` (the panel or client
  started mid-trip, or she left from a loose position), loose in space
  with no `location`, or in a lane (her destination is a mouth in another
  system): she isn't drawn. Under way with no `from`, the destination's
  ring is still drawn.
- **No `Ship.Status`** (off any ship you can fly, or aboard as a guest):
  no ship. The chart still shows the system.

## What it looks like

As the mockup's option B, in the style guide's colours. New colours and
marks go in the style guide (§4.3 and a new "Charts" section) before
code.

- **Backdrop:** Background with the seeded stars, as every band.
- **Orbits:** a 1 px circle or ellipse in the rule colour `#2b3646` for
  each body and place with an orbit, around its parent's current
  position.
- **Star:** a soft white disc, `#fffaf0`, with a radial glow, at least
  5 px, else its true radius.
- **Planets:** a disc in the darkest Tone with Model edge, its half toward
  the star in the lightest Tone, at least 3.5 px, else its true radius.
- **Stations:** a small diamond in Glass.
- **Belts:** an arc along the fit's orbit, centred on where the fit puts
  the belt, reaching `error` km either way along the orbit, drawn in the
  lightest Tone and fading toward its ends, with a few rock dots at its
  centre. Once the error reaches 90% of half way round (the game's
  "lost"), the belt is its whole orbit, dashed, labelled "lost".
- **Error over time:** the error as sent holds at `at`. After `at` it
  grows, never shrinks:
  `error(t) = error × ((t − seen) / (at − seen))^1.5` for t > at, capped
  at half way round (π a), using the sent error while `at − seen` is
  under ten minutes (a fresh observation). The game's error
  (`fitError` in `systems/fits.ts`) is a part growing linearly and a
  drift growing as time^1.5, both counted from no later than `seen`, so
  this is never less than the game's (my call). The hourly resend
  corrects it.
- **The edge:** a dotted ring at the mouths' distance whenever the system
  has a known mouth.
- **Mouths with a bearing:** a double chevron in Glass on the edge,
  pointing out along its bearing.
- **Mouths without one:** no mark and no off-view marker. Instead the
  edge ring is named in Dim, at its top: "Maelor lane, somewhere on the
  edge" (one line per mouth). Hovering the ring says the same. Nothing
  about the ring hints at a direction.
- **Your ship:** an amber chevron (the highlight colour, since it's where
  you are, §6), with the Model highlight's light stroke and glow, pulsing
  as the highlight does. Nothing else on the chart is amber.
- **Route:** the line ahead of her dashed amber at .55, the stretch
  behind her solid amber at .25, and a thin amber ring at the
  destination's arrival point.
- **Labels:** names in Dim, 10 px, beside the star, planets, belts and
  mouths (a mouth by the star it faces, "Maelor"), and a belt's with
  "±N km". Stations are named on hover only. A satellite whose orbit is
  under 8 px across on screen is folded into its parent: no ring, no
  mark, no label, unless it's your ship's place or destination.
- **Off-view markers:** a body, mouth or belt off the view is a small Dim
  chevron at the band's edge pointing at it, with its name and distance
  from your ship in thousands of km ("Orrin 16k"), or from the view's
  centre when there's no ship. Stations and folded satellites get none.
- **Scale bar:** top left, Dim, a round number of km.
- **Hover:** a Mallard tooltip (`panel.tooltip`) on any mark: its name;
  for a belt, its error and how long ago it was seen ("±2,600 km, seen 2d
  4h ago"); for your ship, where she's bound and when she'll arrive.

## Framing

Zoom and pan as on the plans: + − and wheel zoom, drag pans. The zoom runs
from about 1,000 km across to the whole system with a margin (the edge,
or the farthest orbit if no mouth is placed).

**⌂ frames:**
- under way: her line's two ends and her, with a margin;
- else, with a ship that can be placed: the body she's nearest in the
  tree (the parent of her place, Tamsin at Gannet Belt, Senara at The
  Anvil) and its farthest known satellite's orbit, with a margin; for the
  star, the whole system;
- else: the whole system.

**The view reframes itself (as ⌂ does) only when:** the chart is switched
on; `system` changes; or a trip starts or ends while the view hasn't been
zoomed or panned since it was last framed. And as the plans do (§8.3), it
re-centres without changing zoom when your ship leaves the middle of the
view (35% from centre). Otherwise it holds still.

## Following the system

The chart always shows the system in the latest `Space.Charts`. When
`system` changes, everything is replaced and the view reframes. A `from`
remembered in the old system is dropped.

## Live updates

Positions are worked out from the clock, never stepped. The chart redraws
at least once a second while it's shown and the panel is visible, and not
at all otherwise. A smoother rate for the ship under way is the builder's
call.

## Architecture

- **`src/station_map/charts.lua`** (new reducer, alongside `scene.lua`):
  keeps the last `Space.Charts`, cleaned (bad entries dropped, fields
  typed), and the ship's chart state: her fields and her host's, the
  `received` stamp, the remembered `from`, the remembered point, and
  `searching`. Pure and total, as
  `scene.lua` is. `scene.lua` keeps reading belts as now.
- **`src/main.lua`:** posts `charts` (the cleaned payload) and `chart-ship`
  (the ship state) to the panel when they change, and keeps and replays
  the chart's on/off, which the panel posts back as `chart` `{on}`. All
  three are replayed on `ready`.
- **`ui/lib/orbits.js`** (new, pure, no DOM): Kepler, positions of bodies
  and places at a time, points, the transit line and the ship's position,
  error growth, frames and framing boxes, off-view marker placement.
  Vitest tests for each.
- **`ui/chart-view.js`** (new): the SVG, the toggle, zoom and pan (reusing
  `attachPanZoom` and `zoomButtons` from `ui/lib/svg.js`), the frame loop,
  tooltips.
- **`ui/main.js`:** wires the messages to the chart view, and the view to
  the space view and station model so only one draws.
- **Tests:** Lua tests in `tests/charts_test.lua` for the reducer
  (including `from` and `received`), vitest for `ui/lib/orbits.js`, test
  first. The game's own orbit maths (`systems/orbits.ts`) is the oracle:
  pick test cases from it.

## Preview harness

A scenario in `dev/preview.js`: `?chart` opens with the chart on, fed a
`Space.Charts` for Senara's system built from system.yaml and belts.yaml
as the mockup has it (its mouth without `edge`, as the game sends it
today; a menu entry adds an invented `edge` at 76° to see that drawing), a
belt fit fresh, one a day old, one lost, and a ship parked at Gannet Belt.
The bar's menu adds: under way from T.I.S.S. to Orrin Station; searching
for The Cinders; stopped at a point off Tamsin; docked at T.I.S.S.; no
ship; Maelor's system (Wenna, Wenna Halt, Kestrel Belt and
its mouth), to watch the switch.

## Docs

- `docs/maps/orrery.md`, from the style guide's template.
- The style guide: the orrery in §1's table, its colours in §4, a Charts
  section, and §12's note that the chart can cover the space scene.
- `docs/maps/space-scenes.md`: the chart can cover the scene.
- README: a paragraph on the chart.

## Left to the builder

- The exact sizes, margins and fade of the marks, within the mockup's
  look.
- Label collision handling beyond folding small satellites.
- How the toggle and the zoom buttons share the band's corner.
- The redraw rate above once a second.
