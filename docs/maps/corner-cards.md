# Corner cards

*Status: built. Last updated 2026-10-29.*

## What they are and when they show

Cards in the bottom band's top-left corner, across from the zoom buttons,
stacked 6 px apart: the ship's move in a belt, and her waiting on Control's
clearance. Each is hidden while it has nothing to say, and the stack closes up
round it, so one card on its own sits at the top of the corner. They show over
whichever plan the band holds and over a dimmed one.

What you're doing (`Char.Action`) used to be a card here too, over these two.
Mallard now shows it in its own Vitals panel, so the plugin doesn't
([action-card.md](action-card.md), removed 2026-10-29).

**The ship's move in a belt** says `thrusters, out from the core` (`in toward
the core` within 30° of straight in, `on a new heading` otherwise, plain
`thrusters` until her place first changes) with the move's seconds and bar, or
`closing on rock-12` (her laser target, `closing on the rock` with none) with
neither, since the game gives the approach no end. It comes from the `work`
message ([space-scenes.md](space-scenes.md)): `rcs` and `mine` are the ship's
devices at work. It goes as she stops, the card checking again 2.5 s after her
last move, since a stop while closing comes with no message.

```
┌ thrusters, out from the core 17 s ┐   [+]
└ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬──────── ┘   [−]
```

**Waiting on Control's clearance** says `awaiting clearance · T.I.S.S.`, a
port's name for a landing or a lift-off (`awaiting clearance · Zennor`), a
ship's for docking at one (`awaiting clearance · the Full Measure`), plain
`awaiting clearance` when her status names nowhere. It has no seconds and no
bar: the game sends no countdown for the wait. `dock` and `undock` (land and
lift too) call on the system's traffic and wait for the answer (Empyreal
96249e1, channels.md decision 39): a controller two to four seconds on, the
automated voice one, longer behind other ships' calls. It goes as she's
cleared and the run starts (the overview's dock or undock,
[space-scenes.md](space-scenes.md)), as she stops, as you step off her and on
a disconnect.

```
┌ awaiting clearance · T.I.S.S.     ┐   [+]
└───────────────────────────────────┘   [−]
```

## Where their data comes from

The move card's is the `work` message ([space-scenes.md](space-scenes.md)).

The clearance card's is `Ship.Devices`: waiting, the nav is busy `dock` or
`undock` with `left` null (the game's own test is space.ts
`awaitingClearance()`); cleared, the frame comes again with `left` and the
run is `manoeuvre.lua`'s, which times nothing till then.
`src/station_map/clearance.lua` folds it into `{ verb, at }`, or `{ verb =
nil }`. Where she waits is her `Ship.Status` text's, `awaiting clearance at
<place>`, which the game sends just before `Ship.Devices`; it only names the
place, kept till the wait ends, and whether she waits is `Ship.Devices`'
alone. A null `Ship.Status` (off her) ends it, as `Ship.Devices` stops coming.
Posted as `clearance` on each change, replayed on `ready` while she waits,
and cleared on disconnect.

## Bottom band

A card is an HTML element in the deck band, not part of the plan's SVG, so
it's the same size at any zoom and in the same place on every plan. The stack
sits above the plans and the highlight (z-index 3) and ignores the pointer, so
a drag under it still pans. The label truncates with an ellipsis before it
would reach the zoom buttons.

| Part | Look |
|---|---|
| Card | `rgba(14,19,26,.92)` with a 1 px border of the highlight's amber at .55, radius 6, soft shadow |
| Label | 12 px, weight 600, Text `#e3eaf2` |
| Seconds | 11 px, `#9aa7b7`, right-aligned on the label's line: `17 s` |
| Detail | 10 px, `#9aa7b7`; hidden when empty |
| Bar | 3 px, track `#2b3646`, fill the highlight's amber `#ffb347`; hidden with no known end |

The bar drains by a linear Web Animation from where it is to empty at the
end, started again on each message. It isn't a CSS transition: that starts
from the width last drawn, and a card just shown may have none drawn yet. The
seconds tick on a timer that wakes as each whole second goes, and only while
something's under way.

Screen readers aren't given them (`aria-hidden`): the game tells them in text,
without countdowns or bars.

## Code

- `ui/corner-card.js`: `CornerCard`, one card in the stack, its bar's
  animation and its timer, given what it shows of its message: `moveCard`
  (`ui/lib/space.js`, tested in `ui/lib/space.test.js`), which also wakes at
  `recheck` to go when she's stopped, or `clearanceCard`.
- `ui/lib/clearance.js`: `clearanceCard(msg)`; `ui/lib/clearance.test.js`.
- `src/station_map/clearance.lua`: the clearance reducer; `tests/clearance_test.lua`,
  and the wait being no run in `tests/manoeuvre_test.lua`. The clearance
  card's wiring is `ui/clearance-card.test.js`.
- `ui/map.css`: `.corner-cards` (the stack in the corner) and `.corner-card`.
- `dev/preview.js`: `?move=rcs-out`, `closing-cut` and `halted` show the
  ship's card. `?clearance=undock-tiss` (3 s), `dock-orrin-queued` (10 s,
  behind other calls) and `land-zennor` (1 s, the automated voice) wait aboard
  the Magpie and then go into the run; `&stop=N` stops N s into the wait.
