# What you're doing

*Status: built. Last updated 2026-10-24.*

## What it is and when it shows

A card in the bottom band's top-left corner, across from the zoom buttons,
while you're doing something that takes time: the action's label as the game
words it, its stage of how many when it has more than one, how many lines
wait behind it, the seconds left and an amber bar that drains to its end.
Doing nothing hides it. It shows over whichever plan the band holds (T.I.S.S.,
a drum, a decks station, a ship plan or the town) and over a dimmed one.

```
┌ repairing the mining laser   29 s ┐   [+]
│ stage 1 of 3 · 1 waiting          │   [−]
└ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬────────────────── ┘   [⌂]
```

Examples of what it says: `climbing`, `hauling your load`, `dragging the
crated stove`, `pushing the trolley`, `repairing the laser` (stage 2 of 3),
`eating spacer's stew`, `putting on the EVA suit`, and an attended scan's
`sweeping The Cinders`.

**Moves** (the verb `move`) land you in another room when they end: a ladder
climb, a slow haul overloaded, dragging a crate, pushing a trolley. The game
says nothing about which way a move goes, so the card doesn't either, and the
plan doesn't light the room you're heading for. The plan moves when you land,
as it does for any step, and the card goes at the same time.

**A ship's device at work.** An attended scan is the person's action (actions.md
§13, step 3), so the card shows it like any other. The overview's belt scene
already draws the sweep from `Ship.Devices` ([space-scenes.md](space-scenes.md)),
and it's left as it is: the card stays in the bottom band and adds nothing to
the top.

## Where its data comes from

GMCP `Char.Action` (`~/dev/empyreal`, docs/actions.md §9 and §13 step 4,
`sendActionGmcp` in packages/game/src/world/gmcp.ts, since 7dc0991 on
2026-10-23): `{ verb, label, stage, stages, left, total, queued }`, or null
when you're doing nothing. Times are whole seconds. `left` and `total` cover
the whole action, not its stage. The game sends it when an action starts, at
each stage, when it ends and when the queue changes, never as it counts down,
so the client counts down itself. Typing a command at the right moment gets
the same frame again.

The plugin asks for it with `Char.Action 1` in `[gmcp] advertise`. Mallard
sends the union of its plugins' entries as `Core.Supports.Set`, and with a
Supports set the game sends only the packages it names (`gmcpAllowed`).
`Char.Action` is also in `gmcp_access`.

`src/station_map/action.lua` folds it, pure and total, into `{ action = {
verb, label, stage, stages, ends, total, queued } }`, or `{}` for nothing:

- `ends` is `os.time()` plus `left` when the frame came, a local timestamp,
  so a panel that re-mounts mid-action picks up the countdown where it is.
  Lua's clock is whole seconds, so the card can be up to a second early.
- No label falls back to the verb, and with neither there's nothing to show.
  Stages default to 1 of 1, and the stage stays within them. The queue is a
  whole number, 0 or more. A `left` that isn't a finite number of 0 or more
  gives no `ends` and no `total`, so the card shows the label alone. A
  `total` under `left` is raised to it.
- Anything that isn't a table, null included, is doing nothing.

Posted as `action` on each change, replayed on `ready` while something's under
way, and cleared on disconnect.

## Top band

Not used.

## Bottom band

The card is an HTML element in the deck band, not part of the plan's SVG, so
it's the same size at any zoom and in the same place on every plan. It sits
above the plans and the highlight (z-index 3) and ignores the pointer, so a
drag under it still pans. The label truncates with an ellipsis before it
would reach the zoom buttons.

| Part | Look |
|---|---|
| Card | `rgba(14,19,26,.92)` with a 1 px border of the highlight's amber at .55, radius 6, soft shadow |
| Label | 12 px, weight 600, Text `#e3eaf2` |
| Seconds | 11 px, `#9aa7b7`, right-aligned on the label's line: `29 s` |
| Detail | 10 px, `#9aa7b7`: `stage 2 of 3`, `1 waiting`, or both joined with ` · `; hidden when empty |
| Bar | 3 px, track `#2b3646`, fill the highlight's amber `#ffb347`; hidden with no known end |

The bar drains by a linear Web Animation from where it is to empty at the
action's end, started again on each frame. It isn't a CSS transition: that
starts from the width last drawn, and a card just shown may have none drawn
yet, so its bar sat empty until the next stage. The seconds tick on a timer that wakes
as each whole second goes, and only while something's under way. Past its end
and before the game's null, the card holds at `0 s` with an empty bar.

## Rooms, compartments and the highlight

Unchanged. Your place is lit as ever. While you climb you're still in the room
you're climbing from, and that's the room that's lit.

## Info line

Unchanged: it says where you are, and the card says what you're doing.

## Code

- `src/station_map/action.lua`: the reducer; `tests/action_test.lua`.
- `src/main.lua`: subscribes to `Char.Action`, posts `action`, replays it on
  `ready` and clears it on disconnect; `tests/main_test.lua`.
- `ui/lib/action.js`: `actionCard(msg, now)`, which gives the label, detail,
  seconds, fraction and milliseconds left for the moment; `ui/lib/action.test.js`.
- `ui/action-card.js`: the card, its bar's animation and its timer.
- `ui/map.css`: `.action-card`.
- `dev/preview.js`: `?action=climbing-tiss`, `repair-skiff` and `drag-orrin`
  (and the bar's menu) play an action to its end. The repair goes through its
  three stages with a line waiting, and a move lands you in the next room.

## Where it differs from the style guide

- **It's chrome over the plan, not drawn on it.** The mockups put a ring or a
  caption on the lit room. Over a ship's drawing, a caption on the room was
  hard to pick out, so it went to a fixed corner of the band, like a
  notification (§3).
- **It moves on its own.** The bar drains and the seconds count down without
  your moving (§2.6). It's still you who started it: the card shows only
  while an action you started is under way.
- **It covers a corner of the plan.** On a decks station's default view it
  covers the `FORE ▲ / DECK 3` label while an action runs.
- **Screen readers aren't given it** (`aria-hidden`). The game tells them in
  text, without countdowns or bars (actions.md §9), and a counting card in
  the accessibility tree would only add noise.
