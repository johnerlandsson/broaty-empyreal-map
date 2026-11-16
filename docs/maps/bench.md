# Performance bench

`npm run bench` is the plugin's repeatable performance baseline. Run it on
main, run it on an optimisation branch, and compare the two:

```sh
npm run bench -- --cpus 2,3 --out /tmp/main.json          # on main
npm run bench -- --cpus 2,3 --out /tmp/fix.json           # on the branch
npm run bench -- --compare /tmp/main.json /tmp/fix.json
```

Mallard's own perf report can't be used for this. Its callback times are
clock time, so they swell under machine load. Its percentiles only count
calls of 100 µs or more. Its counters never reset. On Linux its webview
CPU/RSS numbers are wrong, because the threads are summed. And it has
nothing per panel.

## What it runs

**1. Lua replay** (`scripts/bench/replay.lua`, plain `lua`). This runs
`src/main.lua` under a stubbed Mallard and feeds it a recorded session,
Mallard's `.mallardlog`. By default that is
`~/.local/share/net.mallard.app/logs/empyreal-7/2026-11-14.mallardlog` and
`2026-11-15.mallardlog`, read where they are.

- The `gmcp.on` stub works as Mallard's does. Prefixes are lowercased. A
  prefix matches a package that equals it or sits under it at a dot, so
  `Empyreal.Room` gets `Empyreal.Room.People`. The handle's `:remove()`
  works. Each matching subscription gets its own conversion, because
  Mallard runs `json_to_lua` once per subscriber. So a *delivery* is counted
  per subscription, with the bytes of that frame's JSON in the log. That
  JSON-to-Lua conversion is the real cost.
- It counts each post to the panel by name, with its JSON bytes (compact, as
  Mallard's serde writes it). It also counts `storage.set` calls and bytes,
  by key with the character's name cut off (`lanes:*`).
- It counts the panel's own posts back to Lua (`land-save`, `ready`, view
  toggles), as the WebKit half recorded them. They are played back into the
  plugin's `on_message` handlers after the same record they followed.
- **Lua CPU** is `os.clock` around each handler, minus the time spent in the
  stubs. It is the median of 5 runs (`--runs`). Each run is a fresh plugin.
  A run that counts anything differently from the first stops the bench.

`os.time` is the log's, so the plugin sees the session's own clock.

**2. Panel replay in headless WebKit** (`scripts/bench/panel.mjs`). This runs
in the Playwright v1.60 container (`mcr.microsoft.com/playwright:v1.60.0-noble`),
because WebKit won't start on the Fedora host. The host page holds the panel
in a 480×720 iframe, the way Mallard hosts it. The panel is `ui/map.html`
with `dev/fake-panel.js` standing in for `window.panel`. No port is opened:
every request to `http://bench.invalid/` is answered from the checkout, and
the container runs with `--network none`. So another worktree's server on
8765 can't get in the way.

The instrumentation is injected into the page, and the app code is never
changed:

- **draws per view.** As each `ui/` module is served, a line is appended
  that wraps the `draw` method of every exported class, such as `ChartView`,
  `LanesView`, `ModelView` and `SkyView`.
- **DOM nodes added.** A MutationObserver counts added nodes and their whole
  subtrees, split into SVG, HTML and text.
- **requestAnimationFrame and timer callbacks** that actually ran.
- **WebKit CPU seconds.** This is `utime + stime` from `/proc/<pid>/stat`
  for the WebKit processes, per process, so every thread is counted once.
  `web` is the web process (`WPEWebProcess`), where the panel's JS, layout
  and painting run. `all` adds the UI and network processes.

The **counts** come from a pass on Playwright's fake clock. The clock is
paused and run forward in 1 s steps, with real rendering let through between
steps. ResizeObserver callbacks are held back and handed over only at those
fixed points, after each message and each step, rather than on whichever
real frame they happen to land. So the counts are the same on every run.
**CPU** comes from a separate real-time pass, where the fake clock is
installed but left running. It is the median of 5 runs per scenario.

The two parts of the panel run:

- **The session.** The messages the Lua replay sent to the panel are emitted
  in order and time-compressed. Up to 2 s of fake time runs between two
  messages (`--cap` in panel.mjs), and any longer gap is fast-forwarded. Its
  CPU is a single run. The posts the panel makes go back to part 1.
- **Idle scenarios, 30 s each** (`--seconds`). Each one is built in
  `scripts/bench/scenarios.mjs` from the game's own recorded payloads
  (`dev/charts-cases.json`, `tests/fixtures/sample.mallardlog`). It runs
  through the real Lua plugin, then its messages go into a fresh panel. The
  window starts after a 2 s settle.

| scenario | what |
|---|---|
| `tiss-standing` | on foot on T.I.S.S., the concourse |
| `travelling` | aboard, under way to Orrin Station (the plugin opens the chart) |
| `chart-parked` | aboard at Gannet Belt, the chart switched on |
| `lanes-in-lane` | aboard in the Senara lane, the lanes map switched on |
| `zennor-sky` | on foot in Zennor's square, its sky |
| `tiss-turn` | T.I.S.S., a walk from the concourse (12:00) to Ladderway 9 at the window's start, which turns the model |
| `background-tab` | travelling, the iframe set to `display:none` with `document.hidden` still false, as in Mallard |

The recorded logs have no flying in them (every Ship.Status in them is
null), which is why the space scenarios are built from the game's own
payloads instead.

## Output

The result is written as JSON (default `bench-results/<branch>.json`, which is
gitignored), and a readable table is printed. `--compare base.json new.json`
lists every **count** that changed. Counts are exact, so any change is real.
It also lists every **timing** (Lua CPU ms, WebKit CPU s, wall time) with its
delta. If the two results were run with different logs, runs or windows, it
warns that the counts don't compare.

Options: `--out FILE`, `--runs N` (5), `--seconds S` (30), `--cpus LIST`
(`taskset -c` for the Lua and the whole container), `--quick` (1 run, 10 s
windows, for trying it out, not for comparing), `--lua-only`, `--fixture`
(the small committed log instead of the private ones), or log paths of your
own. `BENCH_KEEP=1` keeps the work dir, and `BENCH_DEBUG=1` traces the
WebKit steps.

If a count ever differs between two runs of the same commit, three switches
for `panel.mjs` help find out why. Run it by hand in the container on a kept
work dir:

- `BENCH_ONLY=session` skips the scenarios.
- `BENCH_TRACE=1` writes `trace.txt`, with the counts at every message, so
  two runs can be diffed to the message where they part.
- `BENCH_STACKS=1` counts the rAF callbacks by the line that asked for them.

One such cause is already handled. The clock is installed with `pauseAt`
alone: installing it first and pausing after lets the real milliseconds in
between into the page's `performance.now()`. That shifts its 16 ms frames
against the timers, so a turn of the model could take one frame more or
less. Playwright is taken from `~/dev/mallard/node_modules/playwright`
(`--playwright DIR` or `PLAYWRIGHT_DIR` to change it).

A full run takes about 25 minutes. Most of it is the CPU pass: 7 scenarios
× 5 runs × 30 s.

## A quiet machine

The counts don't care about load, but the CPU numbers do. To get timings
worth comparing:

- Close the browser, Mallard, editors' language servers, and other
  worktrees' test watchers and servers. Don't run `npm test` or a build
  alongside.
- Pin the bench to two cores the rest of the desktop isn't busy on, with
  `--cpus 2,3` for example. Use the same cores for both runs you compare.
- Plug the laptop in and leave the power profile alone (`powerprofilesctl
  get` should be the same for both runs). Let it cool between long runs.
- Run base and branch back to back. If a timing delta is within the spread of
  that timing's 5 runs (they're in the JSON as `runs`, `web_runs` and
  `all_runs`), it's noise.
- The result records the load average at the end of the run (`meta.host.load`).
  If it's well above the pinned core count, run it again.

## Privacy

The `.mallardlog` files hold a real character's play. They are read in place
and never copied into the checkout. The work files that hold their messages
go to a temp dir that's deleted afterwards, unless `BENCH_KEEP` is set. The
result holds counts only, and storage keys lose the character's name. Never
commit a log. The small `tests/fixtures/sample.mallardlog` is what the tests
use.
