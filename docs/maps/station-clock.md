# Station time

*Status: removed 2026-10-29.*

> **Removed.** Mallard shows the Empyreal weekday and time in its own Vitals
> panel (Mallard 0.9.1, Empyreal 549316e), so the plugin no longer draws the
> tab or asks for `Empyreal.Clock`. Mallard shows only the weekday and time,
> so Zennor's sun phase (`· dusk`) went with the tab. The rest of this page
> records the tab as it was built; its files are gone.

## What it is and when it shows

A small tab on the rule between the two bands, at the right: the weekday and
station time, and on Tamsin's ports where the sun is, as the game's `time`
says them ("Wednesday, 14:32. In Zennor, Senara's going down.").

```
                          ┌ Wed 13:52 ┐              ┌ Wed 17:26 · dusk ┐
──────────────────────────┤           ├──    ────────┤                  ├──
                          └───────────┘  [+]         └──────────────────┘  [+]
        on T.I.S.S., aboard, in space                  on Zennor's ground
```

The weekday helps because counters say when they're next in by it: "in on
Friday at 13:37".

On a port the sun is one word: `day`, `dawn`, `dusk` or `night`, by ground.ts's
`sunPhase` (time.md §4.1): day from 10° up, night below −10°, and between, dawn
while it climbs and dusk while it sinks. It shows wherever you're in the port's
own rooms, indoors too, as `time` says it there; not aboard a ship landed at
it.

Station time is Empyreal time (server ff2a110): Tamsin's solar day, from
sunrise to sunrise, counted from the meridian of Lyonesse, and everyone keeps
it, on the station, aboard and on the ground (help time). A day is about 4.2
real hours, so an Empyreal hour is about 10½ real minutes and a minute about
10.6 real seconds; the tab turns about five or six times a real minute.

It names no shift. The first version said `13:52 · first shift` from help
people's hours, but the maintainer says shifts are T.I.S.S.'s own (2026-10-26):
other stations, and other species, may keep very different days, so the tab
names none anywhere.

It shows over every plan and scene, once the game has sent the clock. It's
hidden till the first `Empyreal.Clock` and again after a disconnect: there's
no UTC to fall back on, and the client can't work Empyreal time out alone.
It's the panel's, not either map's, so it sits on the rule rather than in a
band, and it's the same size at any zoom.

## Where its data comes from

GMCP `Empyreal.Clock` (empyreal gmcp.md §8.8), sent at login, at each Empyreal
midnight and after a server restart (which the clock waits out, so `midnight`
moves):

```json
{ "weekday": "wednesday", "day": 40, "midnight": 1792828800000, "dayMs": 15247058.82 }
```

`midnight` is the wall-clock ms today began, `dayMs` how long a day is. The
time is a 24-hour day's share of `(now - midnight) / dayMs`, run on the
client's own clock; a few seconds between it and the server's is less than an
Empyreal minute, so it's ignored. If a midnight passes before the next
message, the panel moves the weekday on itself. (time.md §4.2's draft payload
isn't what was built.)

`src/station_map/clock.lua` keeps the last good one (a frame with no weekday
the game names, no midnight or no day of positive length is ignored),
`src/main.lua` dispatches `Empyreal.Clock` by its exact name and posts
`clock` `{ clock = {...} }`, or `{}` at a disconnect, and replays it on
`ready`.

The sun isn't sent: the panel works it out from Space.Charts, as the town's
sky does (`ui/lib/sky.js`'s `groundSky`, checked against the game's own words
over a Tamsin year), and checks it with each Empyreal minute, so it changes
within about ten seconds of the game's. With no charts that place the port, the
tab says the time alone.

## Look

Picked from three options on 2026-10-26
([reference/station-clock-options.png](reference/station-clock-options.png));
the mockups still show the shift it has since dropped. The weekday and the sun
were picked from three more on 2026-10-26 (option B,
[reference/station-clock-day-options.png](reference/station-clock-day-options.png)):
the weekday short, the sun one word, rather than `time`'s words in full (wide,
and Zennor's sky already shows Senara) or a sun mark.

| Part | Look |
|---|---|
| Tab | `#0e131a`, 1 px border `#2b3646` (the rule's colour), radius 9, 10 px from the right edge, centred on the rule |
| Weekday, sun | 10 px Inter, weight 400, `#9aa7b7`: `Wed`, ` · dusk` |
| Time | 10 px Inter, weight 600, Text `#e3eaf2`, tabular figures: `13:52` |

It sits above the bands' cards (z-index 4) and ignores the pointer. Half of it
is in the top band's bottom-right corner, a few pixels clear of a space
scene's countdown (space-scenes.md), and the deck band's zoom buttons are
under it.

## Code

- `src/station_map/clock.lua`: the reducer; `tests/clock_test.lua`, and
  `tests/main_test.lua` for the dispatch, replay and disconnect.
- `ui/lib/clock.js`: `stationTime(clock, now)`, the time, the weekday (moved
  on past midnight) and the ms until the Empyreal minute turns, or null with
  no clock; `ui/lib/clock.test.js`.
- `ui/lib/sky.js`: `sunPhase(alt, rising)`, ground.ts's; `ui/lib/sky.test.js`.
- `ui/station-clock.js`: the tab, `set(msg)` from the `clock` message and
  `setPort(charts, port)`, turning with each Empyreal minute on a timer that
  wakes as each goes, hidden with no clock; `ui/station-clock.test.js`.
- `ui/main.js` puts it in `main.station`, passes it `clock`, and the port
  (a town's, while its room places you there) and the charts as they come;
  `ui/map.css`: `.station-clock`.
- `dev/preview.js` sends a clock: `?clock=HH:MM` (14:32 on a Wednesday unless
  you say), `?clock=none` for none.

## Where it differs from the style guide

- **It moves on its own** (§2.6): it turns each Empyreal minute, about every
  10.6 real seconds, without your doing anything. It's chrome, not the map, and it changes nothing on the plan.
- **It's on the rule, not in a band** (§3). Neither band's corners were free
  for something that shows nearly always: the deck band's top left is the action
  card's, its bottom left the info line's, and the top band's corners hold
  its buttons, the chart's and the lanes map's cards and a space scene's
  countdown.
- **It doesn't follow the theme.** It's dark like the cards over the plans,
  whatever the theme.
