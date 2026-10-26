# Map style guide

*Last updated 2026-10-26.*

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
| Decks station models and plans (Orrin Station and the thirteen halts) | top, bottom | you're on that station, or your ship is docked there | [decks-stations.md](decks-stations.md) |
| Town sky and plan (Zennor) | top, bottom | you're in the city, or your ship is landed there | [town.md](town.md) |
| Space scenes | top | you're out in a ship you own or crew, undocked | [space-scenes.md](space-scenes.md) |
| Ship plans | bottom | you're aboard any ship, docked or not | [ship-plans.md](ship-plans.md) |
| Cars (a lift, the tram) | bottom | you're riding one | [cars.md](cars.md) |
| Orrery (the system chart) | top | the ◎ toggle is on | [orrery.md](orrery.md) |
| Lanes map | top | the ⋈ toggle is on | [lanes.md](lanes.md) |
| Belt map | top | its toggle is on, at a belt | [belt.md](belt.md) |
| Unknown location | top, bottom | the panel has loaded and the game hasn't said where you are yet | §10 |
| What you're doing (a card, not a map) | bottom, top-left corner | you're doing something that takes time | [action-card.md](action-card.md) |
| Station time (a tab, not a map) | on the rule between the bands, right | always | [station-clock.md](station-clock.md) |

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
- **The action card**, top left over the detail band, says what you're doing
  while it takes time, with the seconds left and a draining bar
  ([action-card.md](action-card.md)). It's chrome, the same size at any zoom,
  and it's hidden when you're doing nothing.
- **Station time**, a tab on the rule between the bands at the right, says
  the time on the station (UTC): `13:52`
  ([station-clock.md](station-clock.md)). It always shows, and turns with the
  minute on its own.

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

On a town's plan (the ground, not a deck; see town.md):

| Name | Value | Used for |
|---|---|---|
| Ground | `#110e0b` | the bare earth under the whole plan, in place of the stars and Plate |
| Earth | `#332b22` | open ground you walk across: streets, a square, a path, doors and tracks, the Steps; light enough to stand out on every district's wash (about 1.25:1, against 1.0 at the first `#1c1814`) |
| Stone | `#4b4338` | the stub of a town's old wall and its gate arch, building footings, blast walls, terrace walls, an open room's dashed edge, the Steps' treads and the scarp's hatching |
| Water | `#22384c`, its dashed middle `#2e4a63` | a river (the Carn) |
| District wash | a district's colour (§4.4) at .085 | the ground under each district's rooms, so the districts read as areas |
| Glass | `#cfe3ff` (§4.3) at .75 | the tram's line through its stops, and a faint inner edge on each stop's box |

### 4.3 Models and scenes

| Name | Value | Used for |
|---|---|---|
| Tones | `#3a4556`, `#58667b`, `#7e8da3` | the three flat shades of every face, dark to light, by angle to a fixed light |
| Model edge | `#0d1218` | real edges between faces (1.3) and the rocks' outlines |
| Glass mix | Glass mixed in at .45 | domes, window collars |
| Orbit | `#2b3646` | the chart's orbit rings and its dotted edge ring (§13); the same as the panel's rule |
| Star | `#fffaf0` | the chart's star, and the centre of its radial glow (§13) |
| Glass | `#cfe3ff` (§4.2) | the chart's station diamonds, port domes and lane mouth chevrons (§13) |
| Planet star | `#ffcf6a` | another planet seen from the ground at night, a steady golden star (Orrin from Zennor, town.md) |
| Day tints | `#1c2430`, `#232d3a`, `#2c3846`, `#364455` | a town's sky dome while its star is just up, low, well up and overhead (`SKY_TINTS` in `ui/lib/sky.js`) |
| Dusk glow | `#e8925a` at .35 | the horizon where the star went down, at dusk |
| Dawn glow | `#b8c8dc` at .3 | the horizon where the star will come up, at dawn |
| Dawn sky | `#8fa2bd` at .7 → `#4a5a74` at .3 → none, radius 190 | the sky rising from that horizon at dawn, behind the skyline, so it shows above the ridge |
| Sensors | `#59d18a`, the ok status light (§4.2), at .05 to .85 | at a belt, the sensors' sweep line and the wash behind it, and an assay's brackets and ring (§12); on the belt map, each sweep's ground and her sensors' reach (§13.6) |
| Beam | Glass round a `#fff` core | at a belt, the mining laser's beam and the glow where it bites (§12) |

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
  you've been. The belt map draws where you've been in a belt, as the
  player's own log (§13.6), but quietly and never lit.
- **At a door:** in a room the map doesn't have but whose door it does (a
  workshop or bunk), the door room is lit dimly (fill .12, stroke 2 at .7, no
  pulse) and a small amber tab on its far edge pulses for the door. Only the
  door the game names; never a guessed position beyond it. The model lights
  the door room as usual.
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
  up and starboard right, each room in the cell its address names. On a town
  on the ground, north up, one cell a step as its compass exits go.
- **Plate on stars.** A station's rooms sit on a Plate floor with rounded
  corners, over the starfield. A ship sits in its own hull outline instead
  (see ship-plans.md), and a town lies on Ground, with no stars (see town.md).
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
- `LIFT 3 · climbing hubward, Rim → Mid`, `LIFT 3 · at Mid 3:00`, `THE TRAM · uphill, Market → Uptown` (cars.md).
- At a door (§6): `JUNIPER'S SMALL WORKSHOP · off Workshop Row · 0.3 g`, the
  door in place of an address.
- Off the map: the room name from GMCP, in capitals.

A new map type says in its doc what its line shows.

## 10. Off the map and fallbacks

- **Off the map.** When you're somewhere the band's map doesn't know (and,
  for a workshop or bunk, doesn't know its door either), the
  plan stays where it was at 45% opacity, nothing is lit, and the info line
  shows the room name.
- **Unknown location.** Until the first location (or a dock) places you, each
  band is a sparse starfield (~150 stars) with a dashed Edge outline and a
  "?" in the middle: a ring in the top band, an empty floor in the bottom.
  The info line says `LOCATION UNKNOWN`. No station is built until one is
  picked, so the panel loads fast. It never comes back once you're placed;
  at a station there's no plan of, both bands stay blank (`ui/unknown-view.js`,
  `docs/maps/reference/unknown-location-options.png`, option A).
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
- Undocking and docking take the game's time, not a fade: the canvas turns
  see-through over the model, which shrinks to a twelfth of its size into the
  parked stars as she backs out, or grows out of them to its docked framing as
  she runs in, eased at both ends and fading only in the last fifth of the
  distance. One stopped early eases back (1.5 per second).
- No controls and no highlight; the model's zoom buttons hide under it.
- **The ship's work at a belt** is the one thing drawn over the scenery: the
  sensors' line crossing the band left to right over a scan's time, with a
  faint wash behind it; brackets and a ring filling clockwise round one rock
  during an assay; the laser's beam from below the band, where the ship is,
  onto one rock while it cuts. The rock worked holds still (she's come
  alongside); the rest drift on. What's under way and the seconds left are
  in the bottom-right corner, Dim, 10, one line each, the laser's first:
  `cutting`, `sweeping · 6 s`, `assaying · 8 s`. A program's work looks the
  same as yours: it's the device that's busy.
- **Her moving in a belt** (the thrusters, or closing on a rock) is the rocks
  flowing past opposite her heading, near ones faster, eased in, out and
  round; nothing else is drawn for it. Up the band is straight out from the
  core. No beam until she's beside the rock. The move's seconds go in the
  deck band's corner card, under yours, not in the scene (§3).
- **The rocks stay scenery.** The work never draws, counts, names or places
  a rock the game hasn't told the player about: a sweep finds nothing on
  screen, and the rock an assay or the laser holds is any near one in the
  middle, not the game's.
- The same Background, Tones and Model edge as the models, so a rock looks
  like it belongs with a station.
- Eased, never sudden: the stars speed up and slow down, stars cross-fade to
  rocks, and the ground below a port fades in and from day to night.
- The ground below a port is the one place with colours of its own: Tamsin's
  dusty face by day, near-black with Porthole lamps by night (space-scenes.md).
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
- **Stations:** a small diamond (about 5 px) in Glass. A body or place of a
  kind the chart has no drawing for takes the station's (§10).
- **Ports** (a town on a planet's surface): a half-disc about 3.6 px in
  radius in Glass, flat side on the planet's disc as drawn, where the town is
  now, so it turns with the planet and stays on the edge when the disc is
  drawn at its 3.5 px least. No orbit ring: its orbit is the planet's surface.
  Your ship there sits on the dome.
- **Belts:** an arc along the fit's orbit, centred where the fit puts the
  belt and reaching its error either way: 14 segments, 5 px wide with round
  caps, in the lightest Tone at opacity `.15 + .6 × (1 − |2f − 1|)` for a
  segment at `f` along the arc, so it fades toward its ends, with four small
  rock dots at its centre. A belt that's **lost** (its error is 90% of half
  way round) is its whole orbit, dashed in the middle Tone, and its label
  says "· lost". A belt is never drawn as a point.
- **The edge:** a ring dotted `1 5` in Orbit at the lane mouths' distance,
  whenever the system has a mouth.
- **A mouth with a bearing** (a stable lane's): a double chevron in Glass on the edge, pointing
  out along it. A **closed** one (its branch lane is closed now) is the same chevron dashed
  `2.2 1.8` in Dim, as a closed room is dashed (§8.2). Mouths nearer than 18 px are spread
  evenly along the edge about their middle.
- **A mouth without one** (a wild lane's): no mark and no off-view marker. The edge ring is
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
- **Her plotted course** (at rest, with one stored): amber dotted `1 4` at
  .45 from her chevron to where it aims, fixed when plotted, with a 4 px
  amber ring at .5 there; and a card top left, rimmed amber as the action
  card is, saying where to, its km, time and fuel, "ragged" in amber, and
  how long ago it was plotted. The scale bar goes under the card. Under way,
  her route takes over and both go.
- **The last sweep's ships** (contacts.md): a target's four corner brackets,
  10 px across with 2.6 px arms, at where the sweep saw her, never moved on.
  Named, they're in Glass round a 1.3 px Glass dot, ticked out of each side
  under drive. A dark ship's are in Dim and empty. Chasing one, the route's ring
  is 8 px, round the brackets.
- **Behind a body, or missed:** the station's, port's or mouth's own mark at
  .35. Behind a body, a line dotted `1 3` in Dim runs from it to the body's limb;
  missed, a Dim stroke strikes through it.
- **Searching for a belt:** no chevron and no route. The belt's arc (a lost
  belt's whole dashed ring) is lit amber and pulses.

### 13.2 Labels

- Names in Dim, 10, beside the star, the planets, the belts (with `±N` km,
  thousands separated) and the mouths that have a bearing (by the star they
  face: "Maelor"; a closed one "Petroc · closed"). Spread mouths' names are
  stacked, a line each in bearing order, stacked up from the edge below the
  star and down from it above.
- Stations are named on hover only, unless the last sweep had one behind a
  body or missed: then it's named below left in italics, "T.I.S.S., behind
  Tamsin", "Orrin Station, missed".
- A sweep's ship is named beside her brackets in Dim, 10. A named one also gets
  her hull's last word, with "· under drive" if she was moving, in 9 below. A
  dark one is named only by her contact number.
- A port is named outward from its planet, beside the dome, or centred on the
  line under the planet's name when the dome is on the bottom of the disc,
  where the two would meet.
- **Folding:** a satellite (a port among them) whose orbit is under 8 px
  across on screen is folded into its parent: no ring, no mark, no label, unless it's your ship's
  place or destination.
- **Naming satellites:** a planet's satellite (a moon, a belt round a
  planet, or a port on it) is named only once its orbit is 80 px across, so it doesn't crowd
  its parent's name. Before that it's still drawn and still hoverable. The
  same goes for your ship's place or destination, which is always named.

### 13.3 Off view and scale

- **Edge markers:** a body, a belt or a mouth with a bearing that's off the
  view is a small Dim chevron just inside the band's edge, pointing at it, named
  with its distance in thousands of km, 9: "Orrin 16k", a closed mouth's
  "Petroc · closed 21k" with its chevron dashed `2 1.6`. Markers within 12 px
  share a chevron, a line each; markers within 48 px whose names would overlap
  stack them, and a name still in the way goes the other side of its chevron. The distance is from
  your ship, or from the view's centre when she can't be placed. Stations,
  ports and folded satellites get none. Neither does a lost belt, which is its whole
  ring and so has no one place to point at, nor a body whose disc reaches into
  the band (the star's, out to 1.6 times its radius, where its glow is still
  half as bright), since you can see it.
- **Scale bar:** top left (under the course card when it's there), Dim, a 1, 2 or 5 × 10ⁿ km bar with end ticks and
  its length above it, 9.
- **The sweep's card:** bottom left, the lanes card's look (§13.5). Folded, it
  shows the sweep's age to the minute; unfolded, what the sweep saw. While she
  chases a ship, an amber "After …" line goes above the age. It's the only
  place the age shows: nothing on the plan is dated.

### 13.4 Behaviour

- **The toggle:** ◎ sits left of the band's + − ⌂, styled like them, and
  shows once the game has sent the charts. A disconnect hides it and the
  chart, but leaves the chart on or off as it was. While the chart is on it has a Dim
  border, the band's + − ⌂, wheel and drag act on the chart, and what's
  under it keeps its state without drawing. Switching it on switches the
  lanes map (§13.5) and the belt map (§13.6) off, and the other way round.
- **Hover** any mark for a Mallard tooltip: its name; for a belt, its error
  and when it was seen ("±2,600 km, seen 2d 4h ago"); for a port, its planet
  ("on Tamsin's surface"); for your ship, where she's bound and when she'll
  arrive, or where she's docked ("landed at" a port, "over" it undocked), or
  "adrift" where she stopped mid-trip; for the edge ring, its label.
- **Framing:** ⌂ frames her line and her when she's under way (or the trip
  she stopped on and her, adrift where she stopped), else the body
  she's nearest and its satellites, else the whole system. The view reframes
  itself only when the chart is turned on, the system changes (and again on
  the first ship status after it), or a trip starts or ends while you haven't
  zoomed or panned since. Until you pan or zoom, it also follows her, keeping
  the zoom, when she drifts out from where ⌂ or a resize left her by more than
  35% of the view (as §8.3). A flat 35% from the centre would fight ⌂ when it
  frames her off the middle, so it's measured from where she was. Once you pan
  or zoom, the view is yours and holds still until ⌂ (§2.6): following her
  then would pull it back from wherever you'd taken it.
- **Zoom** in to 1,000 km across, out to 2.3 times the system's radius,
  times the band's width over its height when that's more than 1, so the
  whole system always fits a wide band. When the band narrows and leaves the
  view wider than that, it still pans; only zooming further out is refused.
  ⌂ pressed while the band has no size frames again once it has one.
- **Live:** redrawn at least once a second while it's shown and the panel
  is visible, never otherwise.

### 13.5 The lanes map

A schematic of the galaxy's systems and lanes (see lanes.md), behind the
**⋈** toggle left of ◎, styled and shown like it. It shares the chart's colours:

- **Stars:** the Shallows as Star dots (4 px) evenly round a ring, in ring
  order from Petroc at the top, clockwise; the Mid's (3.2 px, at .8) on a
  disc inside it (`#0c1320`, its rim dashed `2 3` in the darkest Tone),
  Dozmary and Garrow, the deepest, nearest the centre. Never placed where
  the stars are. Names outward, 10 for the Shallows and 8.5 for the Mid,
  the deep ones in italics: yours in Text, those an open lane reaches
  `#c3ccd8`, the rest Dim at .75. A Glass diamond over a settled star; two
  short arcs either side of one with relays, in the lightest Tone.
- **Trunks:** the ring itself, 2 px in the lightest Tone.
- **Branches:** only your system's open now, solid Glass 1.8 px (a Mid
  branch dashed `6 2.5`), and those seen open elsewhere, dotted `2 3`, at
  .75 under an hour old, .5 under a day, .3 older. Each is bowed toward
  the centre. Closed ones aren't drawn; the key counts them. Nothing
  predicts a branch opening.
- **The key:** a card in the top-left corner, as the action card
  ([action-card.md](action-card.md)) but rimmed in the darkest Tone: folded to "From Senara · 4 open ·
  15 closed" and a ▸, with each branch seen elsewhere's age written on it
  in Glass 8; unfolded, the lanes listed, scrolling if it must.
- **You are here:** the amber ring of the highlight (§6) round your system.
  **In a lane:** the lane lit amber, behind her solid at .3 and ahead dashed
  `4 4` at .7, with her amber chevron, and "in the Maelor lane" and the
  time left in amber at the top of the key.
- **Zoom:** wheel, drag and the + − ⌂ buttons, from the fit to six times
  in. The stars spread; names, marks and the key stay their size.

### 13.6 The belt map

Where she is in the belt she's at (see belt.md), behind a toggle left of ⋈,
styled and shown like it, and drawn as the chart is:

- **The disc:** the rim at the belt's radius in the middle Tone, 1.2 px;
  rings every 5 km dotted `1 4` in Orbit, labelled in Dim, 8; ticks outside
  the rim every 10°, longer and lighter every 30°, with 0°, 90°, 180° and
  270° in Dim, 8. The system's 0° is up and the disc never turns.
- **Round the ring:** the way from the core to what's on her charts, each its
  chart mark just outside the ticks (§13.1: the star, the belt's planet, the
  stations with her home first, the lane mouths with a bearing), named
  outward in Dim, 8.5; crowded marks spread with a Dim leader to their true
  bearing. Where she'd travel next, her plotted course, is a small amber
  chevron pointing out, named in amber.
- **The core:** a small Star cross.
- **Her:** the amber chevron (§13.1), pointing the way she last moved.
  Between the game's ticks she glides, never jumps.
- **The player's log**, which the game leaves to them, drawn quietly under
  her: her track solid amber at .3, 2 px (the chart's stretch behind), earlier
  visits at .15; each sweep the 5 km disc it covered in Sensors at .08,
  stroked at .3, the newest three only, older ones fading to .025 and under
  .2, or a small Sensors ring where the range isn't known; where she left her
  host a Glass diamond in its dashed `3 3` Glass ring at .45, the 5 km she
  needs to be within to dock (left out once she is), named "where you left
  the Full Measure · last seen 14m ago" in Dim.
- **Names never overprint:** the ring's, the ships' and the host's are placed
  together, each beside its mark where it's clear, else moved a line or along
  with a Dim hair to it; a ring name with nowhere clear is left off.
- **Her sensors' reach:** dashed `4 3` in Sensors at .5, drawn only when the
  game has told the player the range (5 km, with no sensor array fitted).
- **The last sweep's ships:** as on the chart (§13), Glass brackets round a
  dot, dark ones in Dim; named with the range and bearing from her now and
  aged ("seen 4m ago"). Your host seen since you left her: the sweep's
  mark replaces the "where you left" one, the alongside ring round it.
- **Docked at her host:** her chevron at .8 inside the host's Glass brackets.
- **Words:** the belt's name in capitals and where she is in the game's
  words ("11 km out from the core, bearing 210°"), top left in Text, with a
  Background halo.
- **Zoom:** wheel, drag and + − ⌂, from the whole belt to six times in, the
  rim and the bearing ring zooming with it; zoomed in, it follows her until
  you drag it, as the chart does.
- **Never:** rocks, worked-out ground, a ship moved on from where the sweep
  saw her, or a range the game hasn't given.

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
