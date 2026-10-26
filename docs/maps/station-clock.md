# Station time

*Status: built. Last updated 2026-10-26.*

## What it is and when it shows

A small tab on the rule between the two bands, at the right: station time.

```
                                  ┌ 13:52 ┐
──────────────────────────────────┤       ├──
                                  └───────┘  [+]
```

Station time is UTC (server 752aa12), and everyone on T.I.S.S. keeps it:
people's shifts and meals, the counters' hours, the tug's pilots (help
people).

It names no shift. The first version said `13:52 · first shift` from help
people's hours, but the maintainer says shifts are T.I.S.S.'s own (2026-10-26):
other stations, and other species, may keep very different days, so the tab
shows the time alone, the same everywhere.

It shows always, over every plan and scene, and before the game has said
where you are. It's the panel's, not either map's, so it sits on the rule
rather than in a band, and it's the same size at any zoom.

## Where its data comes from

The client's own clock, read in UTC. No GMCP: the game says in help that its
time is UTC, and that's all the clock needs.

**This is about to change.** The maintainer is retuning it (2026-10-26):
Empyreal standard time will be like UTC but for a long-gone city on Tamsin,
with 5⅔ Empyreal days to a real day (17/3), so an hour is 10 minutes 35
seconds. Whether the client can work that out alone, from the wall clock and a
known start, or needs it over GMCP is asked and not yet answered.

## Look

Picked from three options on 2026-10-26
([reference/station-clock-options.png](reference/station-clock-options.png));
the mockups still show the shift it has since dropped.

| Part | Look |
|---|---|
| Tab | `#0e131a`, 1 px border `#2b3646` (the rule's colour), radius 9, 10 px from the right edge, centred on the rule |
| Time | 10 px Inter, weight 600, Text `#e3eaf2`, tabular figures: `13:52` |

It sits above the bands' cards (z-index 4) and ignores the pointer. Half of it
is in the top band's bottom-right corner, a few pixels clear of a space
scene's countdown (space-scenes.md), and the deck band's zoom buttons are
under it.

## Code

- `ui/lib/clock.js`: `stationTime(now)`, the time and the milliseconds
  until the minute turns; `ui/lib/clock.test.js`.
- `ui/station-clock.js`: the tab, turning with the minute on a timer that
  wakes as each goes; `ui/station-clock.test.js`.
- `ui/main.js` puts it in `main.station`; `ui/map.css`: `.station-clock`.

## Where it differs from the style guide

- **It moves on its own** (§2.6): it turns once a minute without your doing
  anything. It's chrome, not the map, and it changes nothing on the plan.
- **It's on the rule, not in a band** (§3). Neither band's corners were free
  for something that always shows: the deck band's top left is the action
  card's, its bottom left the info line's, and the top band's corners hold
  its buttons, the chart's and the lanes map's cards and a space scene's
  countdown.
- **It doesn't follow the theme.** It's dark like the cards over the plans,
  whatever the theme.
