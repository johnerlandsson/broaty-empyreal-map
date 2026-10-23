# Zennor's sky: design

*2026-10-23. Branch `rochet/zennor-sky`, on top of the town map (3d76e06).*

## Intent

On the ground at Zennor, a room open to the sky (`outdoors`) shows what's
overhead in its description and in `look sky` (empyreal `docs/planetside.md`
§4, `packages/game/src/systems/ground.ts`). Players read the town's rhythm
from it: day and night, and when T.I.S.S. crosses, which is when a pilot
might launch. The top band at Zennor is a still skyline that the town doc
says will be replaced by this sky view (`docs/maps/town.md`, "Top band").

The sky view shows **exactly what `look sky` would say, moving in real time**,
and nothing more than the game says.

## Goals

- In an outdoor Zennor room, the top band shows the sky as ground.ts
  describes it right now, and it keeps moving while you stand there.
- The maths is a pure function in `ui/lib/` that follows ground.ts rule for
  rule and produces the game's own sentences. Tests check it against output
  from the game's `groundSky`.
- `docs/maps/town.md` and the README describe the sky; the style guide
  gets any new colours.

## Non-goals

- Any other port or town. Only Zennor exists. The function takes the port's
  id and works from the charts, so a second port needs no new maths, but
  nothing else is generalised for it.
- Changes on the game side or the Lua side. Everything needed is already in
  Space.Charts and the town's room data.
- The sky from a ship's cockpit while you're landed. `look canopy` there
  does end with the same `groundSky` sentences (`ships.ts` `view()`), but
  the request is to show the sky "only in outdoor rooms", and the cockpit
  isn't one. Its description doesn't include the sky; you have to look at
  the canopy to see it. So while you're landed and aboard, the band is the
  still skyline.
- Lit windows or any other change to the town. The mockups had them, but
  the game says nothing about lights, and the skyline stays "nothing is
  lit". *(My call.)*

## Anti-goals (a failure even if it works)

- **Showing something the game doesn't.** Indoors, the game has no sky
  (`skyThings` in `world/things.ts` returns nothing). So the band must not
  hint at the sky there: no stars, nothing about the hour.
- **Disagreeing with the words.** If `look sky` says "T.I.S.S. is climbing up
  out of the west", the band shows T.I.S.S. above the western horizon,
  rising. If the game doesn't mention Orrin (it isn't dark yet, or Orrin is
  below the horizon), Orrin isn't drawn. Thresholds are ground.ts's to the
  degree. Where ground.ts and planetside.md disagree, ground.ts wins: dawn
  and dusk are 10° either side of the horizon in the code (about 7 minutes
  with Tamsin turning 90° an hour), not the doc's "half hour".
- **Scenery hiding the sky.** The skyline's ridge rises in the east. A body
  the game says is up, even 1° up, must still be visible.

## The rules, from ground.ts (2026-10-23, empyreal 86d5b51)

All angles are in degrees, from the port's horizon. The port is on its
planet's surface, its "up" is from the planet's centre through the port, and
east is up turned 90° anticlockwise (the way the ground turns).

- `seen(target, t)`:
  - `alt = asin(up · unit(target − here))`.
  - `east` is true when `(−up.y, up.x) · (target − here) > 0`.
  - `rising` is true when the altitude 60 s later is higher.
  - `heading` is the `east` of 60 s later.
- **Senara**, the system's star:
  - ≥ 60: "{Star} stands high overhead, small and white, and the shadows are short."
  - ≥ 30: "{Star} is well up in the {side} of a pale, dusty sky."
  - ≥ 10: "{Star} is low in the {side}, and the shadows reach long to the {other side}."
  - ≥ 0, rising: "{Star} has just come up over the {side}ern horizon, and everything it touches is gold."
  - ≥ 0, setting: "{Star} is going down in the {side}, reddened by the dust."
  - > −10, rising: "The sky is paling in the {side}: {Star} will be up soon."
  - > −10, setting: "Dusk: the {side} still glows where {Star} went down, and the first stars are out."
  - else: "Night: the sky is black and crowded with stars."
- **Dark** means the star's altitude is below −5.
- **Stations** orbiting the port's planet (not ports), each only while its altitude is above 0:
  - ≥ 60: "{short} is passing overhead, {look}, heading {heading}."
  - rising: "{short} is climbing up out of the {side}, {look}."
  - else: "{short} is sinking toward the {side}, {look}."

  `{look}` is "a bright, steady spark" when dark, else "a pale fleck against
  the sky".
- **Other planets** of the same star, only while dark and above 0:
  - ≥ 60: "{Name} is a steady golden star high overhead."
  - else: "{Name} is a steady golden star in the {side}."
- Sentences are joined by single spaces: star, then stations, then planets,
  each group in the game's content order.

At Zennor that's Senara, T.I.S.S. and Orrin.

## The pure function: `ui/lib/sky.js`

`groundSky(index, port, t)` takes an index from `indexCharts`, the port's
id and the time in wall-clock milliseconds. It returns `null` when the charts
can't place the port or its planet. Otherwise it returns:

```js
{
  sun:     { id, name, alt, east, rising, line },
  dark,                                           // star below -5
  band,                                           // "overhead" | "well up" | "low" | "up" | "twilight" | "night"
  bodies:  [{ id, kind: "station" | "planet", name, alt, east, rising, heading, line }],
  text,                                           // the sentences joined, as the game sends them
}
```

- **Time and positions.** A tick is one second (`TICK_MS = 1000`), and the
  charts' `epoch` is the wall clock at tick 0, so tick
  `(t − epoch) / 1000` matches the game's tick. "60 s later" is
  `t + 60000`. Positions come from `positionOf`.
- **Which bodies.** The star is the item of kind `star`. Stations are items
  of kind `station` whose `orbit.parent` is the port's planet. Planets are
  items of kind `planet` other than the port's own. Each group is in the
  charts message's order.
- **Station names.** The game uses the station's `short`, which Space.Charts
  doesn't send. The function takes a `short` map (`{ tiss: "T.I.S.S." }`),
  falling back to the chart's name. *(My call.)*
- **Leave the port out.** `indexCharts` merges Zennor's body (kind `port`)
  with its place (kind `station`). The town work keeps the body's kind, but
  the function still skips the port's own id explicitly, as the game skips
  ports (`isPort`).
- **Whole ticks.** The game counts whole ticks. The function floors
  `(t − epoch) / 1000` to a whole tick before placing anything, so a given
  tick gives the game's words exactly. That leaves a disagreement of at most
  about a second, plus any drift between the server's tick and the client's
  clock, which the plugin can't see. That's accepted. *(My call.)* The value comes from
  `content/areas/tiss.yaml` `short:`, and a comment there names it as the
  source. Orrin Station orbits Orrin, so the game never mentions it from
  Zennor.
- **`daylit`.** `daylit()` in `ui/lib/orbits.js` (from the town work) stays
  as is. The space scene uses it, and it means exactly `sun.alt > 0`. A test
  checks the two agree. *(My call.)*

### Tests: `ui/lib/sky.test.js`

- **Cases checked against the game.** A script in this repo,
  `dev/sky-cases.ts`, imports the game from `~/dev/empyreal`, so nothing in
  the game repo changes. It's run by hand (e.g. `npx tsx`). It loads the
  real content and prints two things:
  - the Space.Charts payload the game would send from Zennor (`epoch` at
    tick 0), saved as the test fixture, so no orbit is copied by hand
  - ground.ts's `groundSky` text at a dozen chosen ticks The ticks are
  picked to cover every Senara band (each rising and setting where it
  applies), the dark threshold at −5, T.I.S.S. climbing, overhead and
  sinking from each side, Orrin up and down, and one tick each side of the
  10° and 0° lines. The output is pasted into the test as a table, with a
  comment naming the empyreal commit and the script. *(My call.)* The
  plugin's tests feed the saved fixture to `groundSky` at those ticks and
  expect the same text, character for character.
- **Thresholds.** Unit tests at exactly 60, 30, 10, 0, −5 and −10. They use
  a stubbed index placed by hand, so each case lands on the boundary.
- **Robustness.** Missing charts, an unknown port, or a port with no planet
  all return `null`.

## The view: replaces `ui/town-view.js`

`town.md` says the sky view replaces that file. `main.js` keeps asking
only for `div`, `set(where)` and `setTurning()`, plus a new
`setCharts(index)`, called from the existing `"charts"` handler as
`space.setCharts` is.

### Outdoors: A, the dome chart (picked from the mockups)

The mockups are in `.superpowers/brainstorm/` (`sky-looks.html`); the user
picked A.

- **The town:** the town work's skyline stays as the ground, with the ridge
  rising east, the low roofs, the Port Office's tower with its glass room,
  and the blast wall.
- **The arc:** a faint dashed half dome (Orbit `#2b3646`) springs from the
  horizon line, with W at its left foot and E at its right, in Dim. A body
  at altitude `a` on side `east` sits at angle `east ? 180 − a : a` along
  the arc, measured from the western foot.
- **Senara:** the chart's Star `#fffaf0` disc with its glow, drawn only
  while `alt ≥ 0`.
- **Twilight:** in the 0 to −10° band, Senara isn't drawn. The horizon
  glows on its side, warm at dusk and paler at dawn.
- **T.I.S.S.:** a pale fleck (Text at low opacity) when not dark; a bright
  spark with a small glint when dark.
- **Orrin:** a golden star (`#ffcf6a`, new, added to the style guide), drawn
  only when the game lists it.
- **Names:** small names in Dim beside each body (Senara, T.I.S.S., Orrin).
- **Hover:** hovering over a body shows its own sentence from the function.
  Hovering over the empty sky shows Senara's sentence. *(My call.)*
- **Sky colour:** it steps with the game's band and doesn't fade
  continuously, so the colour never says more than the words. Daytime stays
  dark-tinted, in keeping with the style guide's "always dark". *(My call.)*
  - **night:** Background, with the seeded stars.
  - **twilight, setting:** a glow on its side, and a few stars ("the first
    stars are out").
  - **twilight, rising:** a paling side and no stars, because the game's
    dawn line doesn't mention stars.
  - **up / low / well up / overhead:** a dark, dusty blue-grey tint inside
    the dome, a step lighter for each band, with no stars.
- **Ridge and bodies:** bodies and the arc draw on top of the skyline's
  ridge, so nothing up is hidden. *(My call. Lowering the ridge would change
  the town work's drawing.)*
- **Real time:** redrawn once a second while it's shown, the panel is
  visible and the chart (◎) isn't covering it. It stops otherwise, as
  `runChart` does. Positions move continuously between redraws.
- **Zoom and pan:** + − ⌂, wheel and drag as now.

### Indoors: 2, the still skyline

In any Zennor room without `outdoors` (`index.byId.get(id).outdoors` from
`indexTown`), and whenever the town shows with no room of its own (landed,
in your ship's cockpit, `where.kind === "off"`; see Non-goals), the band shows the
skyline alone. That means no stars, no arc, no W/E, no bodies, no tint and
no timer: nothing about the hour. Stepping outdoors brings the sky straight
back.

### No charts yet

If you're outdoors but the charts haven't arrived, or the function returns
`null`, the band shows the skyline as indoors. It never shows a guessed sky.

## Docs

- **`docs/maps/town.md`, "Top band":** rewritten for the sky:
  - what it shows outdoors and indoors
  - the rules (point to ground.ts and this spec)
  - the band colours, and real time
  - the "Where it differs from the style guide" entry updated: the top band
    is now a sky chart, and a lit-band sky tint is new
  - "Code" lists `ui/lib/sky.js`
- **`docs/maps/style-guide.md`:** new colours (Orrin's gold, the band tints,
  the twilight glows) and the town row in §1.
- **README:** the town paragraph says that outdoors the top band is
  Zennor's sky (day and night, dawn and dusk, T.I.S.S. crossing, Orrin at
  night) as `look sky` tells it, moving as you watch, and that indoors it's
  the still skyline.
- **planetside.md's "half hour":** flagged to the user as a game-repo doc
  fix. Not done here.

## Left to the builder

- The exact tint values for each band, and the glow shapes, within the
  above.
- How the timer is shared with or separated from the chart's in `main.js`.
- Exactly which ticks the game-side script uses, as long as they cover the
  list above.
- The preview (`dev/preview.js`) gets outdoor steps at a few times of day,
  following its existing Zennor walk.
