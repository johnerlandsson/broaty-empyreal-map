# Map style guide

*Last updated 2026-10-22.*

This guide is the visual language every map in the panel shares: the station
models, the space scenes, the deck plans and the ship plans. Each kind of map
has its own doc in this folder, and that doc covers only what's specific to
it. When a map needs to break a rule here, its doc says so and says why. When
a rule changes, change it here first.

Most of it is written down from what the T.I.S.S. map already does
(`docs/superpowers/specs/2026-10-21-empyreal-station-map-design.md`). The
rules on rooms and compartments (§7) are new, written for the ship plans.

## 1. The maps

| Map | Band | Shown when | Doc |
|---|---|---|---|
| T.I.S.S. model and deck plans | top, bottom | you're on T.I.S.S., or your ship is docked there | [tiss.md](tiss.md) |
| Drum station models and plans (Wenna Halt) | top, bottom | you're on that station, or your ship is docked there | [drum-stations.md](drum-stations.md) |
| Decks station models and plans (Orrin Station) | top, bottom | you're on that station, or your ship is docked there | [decks-stations.md](decks-stations.md) |
| Space scenes | top | you're out in a ship you own or crew, undocked | [space-scenes.md](space-scenes.md) |
| Ship plans | bottom | you're aboard any ship, docked or not | [ship-plans.md](ship-plans.md) |
| Orrery (the system chart) | top | the ◎ toggle is on | [orrery.md](orrery.md) |

## 2. Principles

1. **Where am I, at a glance.** Every map exists to answer that. Only one
   place is lit at a time, and nothing else competes with it.
2. **A place, not a diagram.** Maps show the place as it's described in the
   game: a drum is round, a skiff is blunt, a lounge has a window. They aren't
   generic boxes-and-lines.
3. **Drawn from the game's own words.** Shapes, fixtures and colours come from
   the MUD's content: room descriptions, hull descriptions, area files in
   `~/dev/empyreal`. Hand-placed data files name the content file they came
   from.
4. **Quiet.** No seams, no labels everywhere, no decoration that needs
   explaining. A thing you can't go into is drawn, not named (§7).
5. **Honest geometry.** Fore is up on every plan. Height is never drawn as
   fore and aft, and a map never makes it look like you're on a different
   floor.
6. **Nothing moves unless you did.** The camera never moves on its own. A
   model only turns to bring your place round when you change place. A plan
   only re-centres when you walk out of the middle of the view.

## 3. The panel

Two bands, split about 42 / 58 by a 1 px rule (`#2b3646`):

- **Top, the overview:** where you are in the whole: the station model, or a
  space scene once you're out in your ship.
- **Bottom, the detail:** the floor you're standing on, or the ship you're in.
- **The info line**, bottom left over the detail band, says where you are in
  words (§9).

Each band has zoom buttons (**+**, **−**, **⌂**) top right, wheel zoom and
drag pan. **⌂** puts the view back where the map starts it.

What swaps in each band, and when, is decided in `ui/main.js` and
`ui/lib/stations.js`. A new map type says in its doc which band it takes and
when it shows.

## 4. Colour

The scene is always dark, whatever Mallard's theme. Only chrome (the info
line, buttons) follows the theme variables (`--bg`, `--fg`, `--font-family`),
with these as fallbacks.

### 4.1 Base

| Name | Value | Used for |
|---|---|---|
| Background | `#04060c` | every band's backdrop, behind the stars |
| Stars | `#fff`, opacity .12 to .72 | seeded scatter (`stars()` in `ui/lib/svg.js`), same every draw |
| Text | `#e3eaf2` | room names on plans |
| Dim | `#7d8a9a` | secondary text (hours, gravity, "up", "closed", FORE ▲), and compartment drawings (§7) |
| Chrome text | `#dfe7f1` | info line fallback, model labels |

### 4.2 Plans

| Name | Value | Used for |
|---|---|---|
| Plate | `#18202b` | the floor under a station's rooms |
| Edge | `#3b4a5c` | hull walls on a station plan |
| Corridor | `#262f3b` | corridor bands |
| Passage | `#56657a` | the short bars joining a room to a corridor or hall |
| Fixture fill | `#0e131a` | inside a lift symbol, stair, ramp or hatch |
| Fixture line | `#cfd8e3` | lift symbols, stairs, ramps |
| Ladder / hull line | `#9fb0c3` | ladderway hatches; the hull outline on a ship plan |
| Glass | `#cfe3ff` | windows, domes, airlock hatches |
| Porthole | `#ffd98a` at .25 to .85 | lit portholes along a station hull |
| Status lights | `#59d18a` ok, `#e8b04a` busy, `#3a4556` empty | berth hatches |

### 4.3 Models and scenes

| Name | Value | Used for |
|---|---|---|
| Tones | `#3a4556`, `#58667b`, `#7e8da3` | the three flat shades of every face, dark to light, by angle to a fixed light |
| Model edge | `#0d1218` | real edges between faces (1.3) and the rocks' outlines |
| Glass mix | Glass mixed in at .45 | domes, window collars |
| Orbit | `#2b3646` | the chart's orbit rings and its dotted edge ring (§13); the same as the panel's rule |
| Star | `#fffaf0` | the chart's star, and the centre of its radial glow (§13) |
| Glass | `#cfe3ff` (§4.2) | the chart's station diamonds and lane mouth chevrons (§13) |

### 4.4 District colours

From `DISTRICT_COLOURS` in `ui/lib/geometry.js`. A room box is tinted by its
district. On a model, fore faces take 70% of the tint and outer faces 25%.

| District | Value |
|---|---|
| concourse | `#d9a441` |
| residential | `#5b8def` |
| hydroponics | `#4caf7a` |
| commons | `#a57be0` |
| offices | `#3fb6b2` |
| midring | `#8796a8` |
| industrial | `#d0703c` |
| docks, hub | `#cfe3ff` |

A station that isn't T.I.S.S. picks from these by what the room is (Orrin's
foundry-orange Concourse is `industrial`, Wenna's kelp-green one
`hydroponics`), rather than adding new colours.

### 4.5 Reserved

**Amber `#ffb347` is the highlight and nothing else.** No room tint, fixture
or label may use it or anything close to it. A new colour goes in this guide
before it goes in code.

On the chart (§13), amber is where you are, and only that:

- your ship's chevron;
- her route: the stretch ahead, the stretch behind, and the ring at her
  destination;
- a belt's arc while she searches for it (she's somewhere along it, as far as
  you know).

Nothing else on the chart is amber.

## 5. Type

- **Font:** `Inter, system-ui, sans-serif` in the scene; the theme's
  `--font-family` (fallback `DejaVu Sans Mono`, monospace) on the info line.
- **Plan sizes:** room names 12, secondary text 10 to 11, small markers 9. A
  room name over 14 characters with more than one word wraps onto two lines.
- **Model labels** (T.I.S.S. only): 22, weight 600, letter-spacing 1.5,
  capitals, with a background-coloured halo, at fixed screen positions with
  leader lines. Other models have no labels.
- **Direction markers:** `FORE ▲` or `N ▲`, 10, dim, letter-spacing 1, top
  left of the plan.

## 6. The highlight

Your place is lit, never marked with a dot:

- **On a plan:** the place's own shape (room box, corridor stretch, lift
  symbol, round room) in amber, fill opacity .3, stroke 3, with the soft glow
  filter (`glowFilter()` in `ui/lib/svg.js`).
- **On a model:** the faces that share your place's key, in amber at fill
  opacity .55 with a light stroke (`#fff3df`, 1.4), drawn on top of the whole
  model so it shows through whatever is in front. A model may give a room a
  box that's drawn only when lit (a decks station lights your room's cell).
- **Pulse:** opacity 1 → .55 → 1 over 1.8 s, forever. A repeated frame for the
  same place doesn't restart it.
- **One place.** Only your place is lit: never other players, never where
  you've been.
- **Off the map:** where the map doesn't know your place, nothing is lit
  (§10).

## 7. Rooms and compartments

A map shows two kinds of space, and it must always be clear which is which:

- **A room** is somewhere you can be: it has a room id in the game. Rooms are
  drawn as room boxes (§8.2), named, can be hovered, and are what the
  highlight lights.
- **A compartment** is part of the place you can't go into: a ship's hold, its
  drive, a laser boom, a station's cradles or portholes. Compartments are
  atmosphere.

How a compartment is drawn:

- **Line drawings, not boxes.** Thin lines (1.1 to 1.4) in Dim, no fill. The
  shape says what it is: crates for a hold, coil ribs along a drive, a lens on
  a laser boom, flared bells for thrusters, a bolted plate over an empty slot.
- **No labels, no hover.** If a compartment needs a word to be understood,
  draw it better.
- **Never lit.** The highlight is only ever on a room.
- **Fixed by what the place is,** not by what's fitted or happening. A laser
  is drawn the same whatever attachments it has.

On a station, decorative parts (cradles, portholes, airlock hatches) already
follow these rules.

## 8. Plans (the bottom band)

### 8.1 Layout

- **Fore up.** On a ring, fore is up and spinward right, matching the game's
  compass (fore = n, spinward = e). On a station drum the plan is laid out as
  the exits go, north up. On a station on decks there's one plan a deck, fore
  up and starboard right, each room in the cell its address names.
- **Plate on stars.** A station's rooms sit on a Plate floor with rounded
  corners, over the starfield. A ship sits in its own hull outline instead
  (see ship-plans.md).
- **Passages** are Passage-coloured bars between a room and the corridor or
  hall it opens off.
- **Fixtures** (lifts, ladders, stairs, ramps, hatches) are small line symbols
  on Fixture fill: `⇅` in a circle for a lift, a hatch with rungs for a
  ladderway, a spiral for a stair, chevrons for a ramp, and for a weightless
  hatchway a round hatch with a ring in Ladder and a small "up" or "down".
- **Up and down** to a room on another level of the same plan is a dashed dim
  line with a small "up".

### 8.2 Room boxes

`roomBox()` in `ui/deck-view.js`:

- Rounded rectangle (rx 5), filled with its district colour at .22, stroked
  with it at .85, width 1.6, named in the middle (12, Text).
- A **closed** room is dashed (5 4), filled at .07, stroked at .5, its name
  at .6, with "closed" in Dim along its bottom edge.
- A round room (a gallery, a lounge) uses the same rules on a circle, with
  Glass where it has windows.

### 8.3 Behaviour

- **Hover** a room or a corridor stop for a Mallard tooltip
  (`panel.tooltip`): its name, its address when that's different, and for a
  closed room, why it's closed.
- **Following you:** the plan switches to your level and re-centres only when
  the highlight leaves the middle of the view (35% from centre by default; a
  plan may set its own `margin`).
- **Navigation:** zoom 280 to 1600 units wide; a plan that fits the panel
  should still allow zoom, for consistency.

## 9. The info line

Your place in words, bottom left, over the detail band, in capitals for the
name and normal case for the rest, joined with ` · `:

- `LAUNDRY · Rim 2:00, aft · 0.9 g`: name, address (when it isn't the name),
  gravity.
- `LIFT 3 · climbing hubward`, `LIFT 3 · at Mid 3:00`.
- Off the map: the room name from GMCP, in capitals.

A new map type says in its doc what its line shows.

## 10. Off the map and fallbacks

- **Off the map.** When you're somewhere the band's map doesn't know, the
  plan stays where it was at 45% opacity, nothing is lit, and the info line
  shows the room name.
- **Unknown kind.** When a map type covers a kind of place it has no drawing
  for (a new hull, say), it shows that type's generic drawing rather than
  nothing (see ship-plans.md).
- **Bad data never throws.** `locate()` and friends are total: any message,
  any shape, falls back to off.

## 11. Models (the top band)

- **Flat-shaded polygons** in SVG, painted far to near, each face one of the
  three Tones by its angle to a fixed light, real edges only (no seams).
- **One fixed camera** (yaw 16°, pitch 38°) for every station, all in the same
  frame: X to 3 o'clock, Y to 12 o'clock, Z fore along the axis. You zoom and
  pan; you never rotate.
- **Turning:** a spinning part (a wheel, a drum) turns the short way round to
  bring your hour to the front, eased, when your hour changes. Only the
  spinning part turns. It can be switched off in Settings, and then it rests
  with 12:00 at the front.
- **Framing** is the union of the silhouette over a full turn, so turning
  never moves the frame.
- **Cut away:** a station on decks is cut away above your deck, so a room
  under another deck isn't lit where the deck above's would be. The decks
  above are only their outline, dashed in Dim (1, .7, `4 4`), and your deck's
  top shows its cells tinted. Off the station it's whole.
- **Tints** follow the district colours (§4.4). Windows and domes take Glass.

## 12. Space scenes (the top band)

- A canvas over the model that fades in (2.5 per second) when you're out in
  your own ship, and out again when you dock.
- Scenery only: no controls, no highlight; the model's zoom buttons hide
  under it.
- The same Background, Tones and Model edge as the models, so a rock looks
  like it belongs with a station.
- Eased, never sudden: the stars speed up and slow down, stars cross-fade to
  rocks.
- The frame loop runs only while something is on screen, and pauses while the
  panel is hidden.
- The chart (§13) can cover the scene. While it does, the scene keeps its
  state but doesn't draw, and its loop stops; it wakes when the chart is
  turned off.

## 13. Charts

The orrery: a true-scale chart of the star system you're in, over the top
band while the **◎** toggle is on (see orrery.md). It's a map of where things
are now, worked out from the clock, so its marks move; the rules below are
what it draws and how.

### 13.1 Marks

- **Backdrop:** Background with the seeded stars, as every band.
- **Orbits:** a 1 px ring or ellipse in Orbit for everything with an orbit,
  around its parent's position now.
- **Star:** a Star disc, at least 5 px across the radius, else its true
  radius, inside a soft radial glow of Star fading out at about 2.6 times it.
- **Planets:** a disc in the darkest Tone with a Model edge outline, its half
  toward the star in the lightest Tone; at least 3.5 px radius, else its true
  radius.
- **Stations:** a small diamond (about 5 px) in Glass.
- **Belts:** an arc along the fit's orbit, centred where the fit puts the
  belt and reaching its error either way: 14 segments, 5 px wide with round
  caps, in the lightest Tone at opacity `.15 + .6 × (1 − |2f − 1|)` for a
  segment at `f` along the arc, so it fades toward its ends, with four small
  rock dots at its centre. A belt that's **lost** (its error is 90% of half
  way round) is its whole orbit, dashed in the middle Tone, and its label
  says "· lost". A belt is never drawn as a point.
- **The edge:** a ring dotted `1 5` in Orbit at the lane mouths' distance,
  whenever the system has a mouth.
- **A mouth with a bearing:** a double chevron in Glass on the edge, pointing
  out along it.
- **A mouth without one:** no mark and no off-view marker. The edge ring is
  named in Dim at its top, one line a mouth: "Maelor lane, somewhere on the
  edge". Nothing on the ring hints at a direction.
- **Your ship:** an amber chevron pointing the way she's going (up when
  she's still), with the model highlight's light stroke (`#fff3df`) and the
  glow, pulsing as the highlight does (§6). Not drawn where the chart can't
  place her.
- **Her route** (under way): the stretch ahead dashed `4 4` in amber at .55,
  the stretch behind solid in amber at .25, and a 5 px amber ring at where
  the destination will be when she arrives. Bound somewhere she can't be
  placed from, only the ring.
- **Searching for a belt:** no chevron and no route. The belt's arc (a lost
  belt's whole dashed ring) is lit amber and pulses.

### 13.2 Labels

- Names in Dim, 10, beside the star, the planets, the belts (with `±N` km,
  thousands separated) and the mouths that have a bearing (by the star they
  face: "Maelor").
- Stations are named on hover only.
- **Folding:** a satellite whose orbit is under 8 px across on screen is
  folded into its parent: no ring, no mark, no label, unless it's your ship's
  place or destination.
- **Naming satellites:** a planet's satellite (a moon, or a belt round a
  planet) is named only once its orbit is 80 px across, so it doesn't crowd
  its parent's name. Before that it's still drawn and still hoverable. The
  same goes for your ship's place or destination, which is always named.

### 13.3 Off view and scale

- **Edge markers:** a body, a belt or a mouth with a bearing that's off the
  view is a small Dim chevron just inside the band's edge, pointing at it, named
  with its distance in thousands of km, 9: "Orrin 16k". The distance is from
  your ship, or from the view's centre when she can't be placed. Stations and
  folded satellites get none. Neither does a lost belt, which is its whole
  ring and so has no one place to point at.
- **Scale bar:** top left, Dim, a 1, 2 or 5 × 10ⁿ km bar with end ticks and
  its length above it, 9.

### 13.4 Behaviour

- **The toggle:** ◎ sits left of the band's + − ⌂, styled like them, and
  shows once the game has sent the charts. While the chart is on it has a Dim
  border, the band's + − ⌂, wheel and drag act on the chart, and what's
  under it keeps its state without drawing.
- **Hover** any mark for a Mallard tooltip: its name; for a belt, its error
  and when it was seen ("±2,600 km, seen 2d 4h ago"); for your ship, where
  she's bound and when she'll arrive; for the edge ring, its label.
- **Framing:** ⌂ frames her line and her when she's under way, else the body
  she's nearest and its satellites, else the whole system. The view reframes
  itself only when the chart is turned on, the system changes (and again on
  the first ship status after it), or a trip starts or ends while you haven't
  zoomed or panned since. Otherwise it holds still, except that it follows
  her, keeping the zoom, when she drifts out from where ⌂, a pan, a zoom or a
  resize left her by more than 35% of the view (as §8.3). A flat 35% from the
  centre would fight ⌂ when it frames her off the middle, so it's measured
  from where she was.
- **Zoom** in to 1,000 km across, out to 2.3 times the system's radius,
  times the band's width over its height when that's more than 1, so the
  whole system always fits a wide band.
- **Live:** redrawn at least once a second while it's shown and the panel
  is visible, never otherwise.

## 14. Adding a map

1. **Write its doc here** from the template below, and add it to §1.
2. **Draw it from the game:** read the area, hull or room content in
   `~/dev/empyreal`, and name the file in a comment at the top of the data.
3. **Use this guide's colours, type and highlight.** Anything new goes in this
   guide first.
4. **Decide rooms and compartments** (§7) before drawing.
5. **Add it to the preview** (`dev/preview.js`) so it can be seen without the
   game, and give its pure layout code vitest tests.

### Template for a map's doc

```markdown
# <Map name>

*Status: <built / designed, not built>. Last updated <date>.*

## What it is and when it shows
## Where its data comes from
## Top band            (or "Not used")
## Bottom band         (or "Not used")
## Rooms, compartments and the highlight
## Info line
## Code
## Where it differs from the style guide
```
