# Empyreal Map

A [Mallard](https://mallard.vnsf.xyz) plugin for the MUD Empyreal: maps
that follow you as you play. It maps three stations: T.I.S.S., which it
follows as you walk, ride the lifts and visit the docks, the small outpost
Orrin Station, and Wenna Halt, one lane over in Maelor's system. The panel
shows whichever station you're on, or the one your ship is docked at.

---

## The panel

The **Map** panel opens on the right side of the window. It has two
parts.

**The station model (top).** A flat-shaded model of the whole station: the
wheel with its three rings (Rim, Mid and Inner), the four spokes and the hub,
with the spine and the docks hanging below. Your place on the station glows:
the slice of the ring you're standing in, the spoke leg your lift is
travelling, or the dock room you're in. As you move, the wheel turns by
itself until your part of the station faces you. Only the wheel turns; the
spine and the docks hold still beyond the Bearing, as on the real station.

At **Orrin Station** the model is its one drum, spun to half a g. The
Concourse, the Exchange fore of it, the Freight Office aft, the Berths with
their cradles outside, and the Chart Office sit on the drum, and the Gallery's
ring of windows sits at the fore end of the axis. The drum turns your room to
face you, as the wheel does.

**Wenna Halt** is a drum too, laid out the same way and spun to 0.6 g, with
the kelp-green Concourse, a clean row of courier cradles outside the Berths,
and the Lounge's wide window collar at the fore end of the axis.

**Out in your ship.** Once you undock, the station model fades into a view
looking ahead from your ship: a still starfield while you're parked, the
stars streaming past while you travel, and low-poly asteroids tumbling past
while you're at a belt. It's scenery only, with no controls; docking brings
the station back. This follows your own ship. Aboard someone else's, the
station model stays, because the game doesn't yet tell the plugin where
that ship is.

**The deck plan (bottom).** A floor plan of the floor you're on:

- **Rings:** the corridor runs across the panel with its stops labelled by
  hour, rooms fore and aft of it, and lift lobbies marked with the lift
  symbol and the ladderway hatch beside it. The plan wraps, so 12:00 follows
  11:00 and you can pan round forever.
- **Docks:** the Hub at the bottom with its four lift doors, the Bearing,
  the spine running up to the Observation Blister, and the dock rooms either
  side of it.
- **Orrin Station:** one plan for the whole outpost, laid out as its exits
  go. The Concourse runs across the middle, with the Exchange north of it,
  the Freight Office south, the Chart Office west and the Berths east, their
  airlock hatches down the outer wall. The spiral stair in the Concourse
  leads up to the Gallery, at 0.1 g.
- **Wenna Halt:** the same plan, with a ramp up from the Concourse to the
  Lounge, at 0.2 g, its deep chairs facing one wide window on the sea.

Your place is lit with the same glow as in the model, not marked with a dot:
a room box, a stretch of corridor, a lift or the ladderway hatch. The plan
switches to your floor when you arrive there and re-centres only when you
walk out of the middle of the view. Closed rooms are drawn dashed and dimmed.
Hover over a room or a corridor stop to see its name, its address and, for a
closed room, why it's closed.

The line at the bottom left says where you are, for example
`LAUNDRY · Rim 2:00, aft · 0.9 g` or `LIFT 3 · climbing hubward`. When you
leave the station (boarding a ship, say), the deck plan dims, nothing is lit,
and the line shows the room you're in.

Both parts zoom with the scroll wheel or the **+** and **−** buttons and pan
by dragging. **⌂** resets the view.

---

## Settings

Settings are in the Mallard plugin settings panel.

**Turn the station to face you** — When on (the default), the wheel turns so
your location faces the camera. When off, the model holds still with 12:00
at the front, and your place still glows.

---

## Installation

Empyreal Map will be published to the Mallard marketplace. Until then, build
the package (see Packaging below) and install the `empyreal-map-<version>.mallardx`
file with Mallard's **Install from file…**, or use the dev install.

### Dev install

Link the repository into Mallard's development plugin folder, then reload
plugins in Mallard:

```bash
ln -s "$PWD" ~/.local/share/net.mallard.app/plugins-dev/broaty.empyreal-map
```

### Packaging

```bash
npm run pack
```

This writes `empyreal-map-<version>.mallardx` with `plugin.toml`,
this README, `src/` and `ui/` (without the tests).

---

## Development

```bash
npm install
npm test            # vitest for the UI and data code, then the Lua tests
```

**Preview.** Serve the repository root and open the preview, which runs the
panel in a browser with a stand-in for Mallard and a **▶ Walk** button that
replays a walk round T.I.S.S., then flights to Orrin Station and Wenna Halt
and a walk round each:

```bash
python3 -m http.server 8765
# http://localhost:8765/dev/preview.html
```

`?step=N` jumps to step N of the walk, `?scene=belt` (or `parked`, `travelling`) opens on a
space scene, and the menu in the bar switches it. `?debug` shows how often the model
turned and redrew.

### Rebuilding the station data

The T.I.S.S. map (`ui/data/station.js`) is built from the GMCP room frames in
your Mallard session logs, plus the hand-written corrections in
`data/overrides.json`:

```bash
npm run build:data
npm run build:data -- --logs /path/to/logs   # another log folder
```

By default it reads `~/.local/share/net.mallard.app/logs/empyreal-7`. Commit
the regenerated `ui/data/station.js`.

Orrin Station's and Wenna Halt's six rooms each (`ui/data/orrin.js`,
`ui/data/wenna.js`) are written by hand from `content/areas/orrin.yaml` and
`content/areas/wenna.yaml` in the Empyreal source. The game gives those areas
no layout, so the rooms are placed from their exits and descriptions. What
differs between the two drums (colours, cradles, the stair or ramp) is in
`DRUMS` in `ui/lib/drum.js`.

---

## AI disclosure

Much of this plugin's code was written with the help of an LLM (Claude). Design decisions, testing, and review are the author's own.
