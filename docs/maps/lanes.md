# The lanes map

*Status: built. Last updated 2026-10-30.*

## What it is and when it shows

A schematic of the galaxy's twenty systems and the lanes between them, drawn
over the top band: where you are, the lanes open from there now, the lane
she's in while she's in one, the branches you've seen open elsewhere, and which
systems you can bank from, as far as you know. It answers "which way round?" before a
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
- **Mouths you haven't found.** The charts list only the mouths on your
  character's charts, so a lane whose mouth isn't on them is "not charted",
  never guessed open or closed. That's what the game says too: `plot` tells
  you a place is "past lane mouths you haven't found", and to `scan lanes`
  there.

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
charts list only the mouths in your system that are on your character's
charts (`help charts`: you find a mouth by `scan`, at a chart office, or by
coming out of it; a new character has none), and of those only the open
ones (a trunk's is always open), plus a closed branch's while she's at its
mouth or bound there, with `open` false (`SpaceSystem.listed`; `help lanes`
says `charts` leaves a closed branch out). So a lane of your system with no
mouth listed is either a closed branch or one whose mouth isn't on her
charts. Every pair of stars has a lane, so `src/station_map/lanes.lua` has
the stars' ids and which pairs are trunks, and keeps the mouths it's seen
listed (`charted`). Charts are kept for good, so a mouth once listed is
still on them, and only being closed leaves it out. A lane of your system
with no mouth listed is then:

- a **closed branch**, seen closed now, if it's a branch whose mouth here
  has been listed before;
- **not charted** otherwise: a trunk never closes, so one missing is a mouth
  she hasn't found, and so is a branch never seen listed here. These are
  `uncharted` in the message, and no sighting is made of them; what was
  seen of one from its other end stays as it was.

Each sighting is a lane id, from the mouth's id `mouth:<here>:<there>`,
with its `open` and when. The reducer keeps them:

- every Space.Charts stamps every lane of your system it can say anything
  of with now: what its mouth says, or closed if it's a charted branch with
  none listed (a Space.Charts with no `places`, or a system that's no star
  in the list, says only what's listed);
- crossing into another system, or disconnecting, stamps the lanes you could
  see till then with now, since you saw them that long;
- `main.lua` stores the sightings and the mouths seen listed in Mallard's
  `storage` after each Space.Charts and each disconnect, so "last seen"
  survives a restart. Storage is per plugin and world, but charts are per
  character, so each character's record is kept under `lanes:<name>`, her
  name from `Char.Status` lowercased, as `{ seen, charted }`. Nothing is
  loaded at start: her record is loaded when `Char.Status` first names her,
  which the game sends before `Space.Charts` at login. A different name
  stores the one before's (stamped as of then) and swaps in the new one's;
  sightings made before any name came are the first one named's (as the
  comms log files lines before its first `Char.Status`). A disconnect keeps
  hers, so the same character reconnecting changes nothing. A stored value
  that won't read is no sightings.
- The old record, `lanes`, was the sightings alone, per world, from before
  the game kept charts per character. The first character named with no
  record of her own takes it and it's deleted. Only its open sightings are
  kept: a closed one may only have been a mouth not on her charts. A trunk
  is never loaded closed.

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

**Contact** says where your account can be reached (`help money`, `help
lanes`, `bank.ts` `reachableFrom`). "In contact" is what the maintainer calls
relayed, and the galactic email to come will go by it too, so nothing here is
named for the bank. The maintainer OK'd showing it (2026-10-30). A star is in
contact while open lanes with relays at both ends join it to Senara's system
(`HOME`); a cut-off pair joined only to each other doesn't count, and nobody
has it in a lane. Each star is one of three, worked out by `contactOf` in
`ui/lib/lanes.js`:

- **Fixed, with no age:** the trunks join every Shallows star to Senara for
  good, and a star with no relays is never in contact. Both are public. It
  goes by the relay flags and the trunks, not the band, so a Core star needs
  only its `relay`.
- **In contact or cut off,** by the newest of what you know: a chain of lanes
  seen open (as old as its oldest lane, by the freshest way there), a reading
  (below), there or over lanes seen open from there, or every lane into it
  from a relayed star seen closed (as old as the oldest of those: rare, 14
  lanes for a Mid star). A lane in `visible` counts as seen now.
- **Not known:** nothing to go on, or two things as new that disagree.

Age alone never changes a state: any limit would say how long a lane stays
open. Nothing predicts an opening or a closing.

**The reading** is `Char.Status`'s `accountReachable` (`reach`). It's false
in a lane, as her system is already the far one, and it comes only when it
changes, refreshed every few seconds, so the flag held as she arrives may be
the one before's. So it's only a star's once she's been in that system, out of
a lane, for 10 seconds (`settled`, sent as `reach.after`, so the panel's
once-a-second redraw takes it up with no timer here). Then it goes over
anything worked out, for that star. On leaving, on the next `Char.Status` or
Space.Charts, and at a disconnect it's kept as that star's `{ ok, at }` in
`contact`, in the character's `lanes:<name>` record beside `seen` and
`charted`. A passenger with no `Ship.Status` isn't known to be in a lane, so
a false reading there would be kept against the system; a Shallows star's
never shows, being fixed.

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
  arcs either side of a star with them: every Shallows star, and Kilmar,
  Garrow and Caradon.
- **Contact** is what the arcs look like: solid Glass in contact (1.1 round
  the ring, 1.8 in the Mid), round dots in `#c3ccd8` cut off, dashed `2 2` in
  Dim not known. No arcs is no relays, so cut off, as it always was. Your own
  star's sit outside your amber ring. Beside a star whose contact can change,
  on the inward side (under the deep two), one field on the dark tab: its age
  ("3h", Glass 8 in contact, Dim cut off), `?` not known, or nothing when it's
  true now. The balance isn't repeated: Mallard's Vitals panel has it.
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
  - not charted: not drawn either, and counted in the key (the ring is
    drawn whatever: it's the public topology). A new character's are all
    not charted.
- **The key**, a card in the top-left corner styled as the corner cards are
  (corner-cards.md) but with a Tone rim (`.lanes-card` in `map.css`).
  Folded, the default, it's one line, "From Senara · 4 open · 15 closed",
  or "From Maelor · 2 open · 1 closed · 16 not charted" (a count of none is
  left out, but for open: a new character's is "From Senara · 0 open · 19
  not charted"), and a ▸ that unfolds it: the open lanes are on the map,
  and the ages of the ones seen elsewhere are written on them. Unfolded
  (▾), it lists each lane open from your system with its line, the star it
  goes to and its class (trunk, branch, Mid branch), then "Not charted ·
  scan lanes", each star in Dim with its class and no line, then "Seen open
  elsewhere", each with its line, its name ("Petroc–Maelor") and "2h 10m
  ago". Above them, "Contact with Senara": each star whose contact can change
  with its state in words ("in contact · seen 3h 0m ago", "cut off · now",
  "not known"), then the Shallows and the stars with no relays, "always".
  A list taller than
  the band scrolls. It folds back with ▾, and stays as you left it while the
  panel's open. The key was first a 150 px column at the right, which
  took too much of a narrow panel; the options it was picked
  from are `docs/maps/reference/lanes-key-options.png` (C).
- **You are here:** an amber ring round your system's dot, with the glow,
  pulsing (§6). Not drawn while she's in a lane.
- **In a lane:** the lane is lit amber, solid at .3 behind her, dashed `4 4`
  at .7 ahead. Her amber chevron sits at her progress, pointing the way she's
  going. The card's top line says "in the Maelor lane · no contact", amber
  but for the last words in Dim, naming
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
  open, closed and not charted lanes (`openHere`), the branches seen open elsewhere
  (`seenOpenElsewhere`), each star's contact (`contactOf`, `contactWords`), the layout in units (`layout`), a lane's curve
  (`lanePath`), and her place in a lane (`laneFix`). Pure, tested in
  `lanes.test.js` along with the check against the game's content.
- `ui/lanes-view.js`: the SVG, its zoom and the ⋈ button.
- `ui/main.js`: the two toggles switching each other off, and the redraw loop
  shared with the chart.
- `src/station_map/lanes.lua`: the reducer, the stars and trunks, its
  sightings, the mouths seen listed, the readings, whose they are, and the
  lane she's in;
  `tests/lanes_test.lua`.
- `src/station_map/charts.lua` carries a mouth's `open` through to the chart.
- `src/main.lua`: the `lanes` and `lanes-view` messages, `Char.Status`'s
  name, and `storage`.
- `dev/preview.html?lanes=senara` (also `in-trunk`, `in-mid`, `dozmary`,
  `petroc`; `cutoff`, at Kilmar cut off with the Garrow branch open; `new`, a new character with no mouths charted, and `partly`,
  Maelor with its trunks and one branch charted) shows it without the game; `&zoom=0.5` opens it zoomed in, and
  `&unfold` with the key's card unfolded.
- The options it was picked from: `docs/maps/reference/lanes-ring-options.png`
  (A, the ring; B a departures board; C the ring unrolled into a line), and
  `lanes-ring-core-option.png`, A with a Core. The six-system timetable
  before it was picked from `lanes-mockup.html` (B). Contact was picked from
  `lanes-contact-options.png` (B, the arcs; A a mark by the star, C a line in
  the key), then `lanes-contact-b-options.png` (1, one field by each star:
  `lanes-contact-mockup.html?round2`).

## Where it differs from the style guide

- **A schematic, not a place** (§2.2): no one sees the galaxy whole, and
  drawing the stars where they are would give away when branches open. So
  it's a diagram with even spacing, as a transit map is.
- **Zoom keeps the text its size** (§8.3): it spreads the stars rather than
  magnifying the drawing, since what crowds at the fit is the names.
- **No tooltips** (§13.4): every mark is named, and the key's card says the
  rest.
