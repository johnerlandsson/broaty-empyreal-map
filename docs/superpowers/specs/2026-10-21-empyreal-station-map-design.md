# Empyreal station map: design

Date: 2026-10-21
Status: approved 2026-10-21

## What this is

A [Mallard](https://mallard.vnsf.xyz) plugin for the MUD **Empyreal**
(`empyreal.fly.dev:4000`, closed beta). It adds a map panel showing where
the player is on **T.I.S.S.**, the wheel-shaped space station where new
players start. Empyreal's developer also maintains Mallard, and both of
them have reviewed the visual direction.

The map has two jobs, and the design serves both:

1. **Orientation:** where am I, what's around me, and which floor am I on.
   It also helps a player plan the order to visit places in.
2. **Atmosphere:** show the station as a real object, a turning wheel in
   space with a still spine, not as a grid of boxes.

Prior art: the same author's Discworld plugin, **Cowtography**
(`/home/john/dev/mallardx-discworld-cowtography`). It's a useful reference
for Mallard plugin structure, panel messaging, tests and packaging. Its
features (search, routing, speedwalk) are *not* goals here.

## The station's geometry (why the map looks the way it does)

From the in-game help (`claude_resources/station.txt`) and the GMCP data:

- Three rings (Rim 0.9 g, Mid 0.6 g, Inner 0.3 g) are joined by four spokes
  (at 12, 3, 6 and 9 o'clock) to a hub. The spin provides gravity, so
  **"up" means toward the hub** (hubward) and "down" means toward the rim.
- Addresses are clock positions. The rim has a corridor stop every hour
  (12 stops). Mid and Inner have one every 1.5 hours (8 stops each).
- Rooms open off a corridor **fore** and **aft**, which runs along the
  station's axis. They are on the **same floor** as the corridor. A room
  can open off another room, which makes it two deep.
- The **spine** runs fore from the hub along the axis and **does not
  turn**. The **Bearing** joins the turning hub to the still spine. The
  spine holds the Docks: Spine 1–4 with port and starboard rooms, plus the
  Observation Blister at its fore tip. Freight Transfer is "up" from the
  Hub (aft of it).
- Each spoke has a lift (a vehicle that moves between floors) and a
  ladderway (one room per ring, beside the lift).

**The key lesson from the design rounds:** an early design drew fore and
aft rooms as offsets *toward or away from the hub*, which made rooms on
the same floor look like different heights. The maintainer flagged this.
**Height (hubward) and fore/aft must never share a screen axis in the
same view.** That rule drives the two-part layout below.

## The panel

One custom panel, split horizontally:

```
┌───────────────────────────────┐
│  STATION MODEL (≈42%)    + − ⌂│  overview: which floor, which hour,
│  stylized 3D, flat-shaded     │  where the docks are
├───────────────────────────────┤
│  DECK PLAN (≈58%)        + − ⌂│  the floor you're standing on,
│  unrolled, fore up, sp right  │  as a true floor plan
│                               │
│ LAUNDRY · Rim 2:00, aft · 0.9 g│  info line
└───────────────────────────────┘
```

The approved mockup is
`docs/superpowers/reference/mockup-orbit-turning.tpl.html` (the station data is injected at `__DATA__`; inline it from `docs/superpowers/reference/station.json` to open it in a browser).
It is a throwaway spike, so take its look and behaviour, not its code
structure.

### Top: the station model (overview)

- A **stylized, flat-shaded 3D model** drawn as SVG polygons:
  - **Rings** are flat-sided prisms with **one face per corridor stop**:
    12 faces for the Rim, 8 each for Mid and Inner.
  - Each face is split across the deck into **five slices**: aft two
    deep, aft, corridor, fore, and fore two deep. The slices match the
    deck plan's rows.
  - **Spokes** are square shafts with **three legs**: rim to mid, mid to
    inner, and inner to hub.
  - The **hub** is an octagonal prism, with the Bearing as a collar.
  - The **spine** is square sections, one per spine number, with **box
    rooms** to port and starboard and a stepped **Blister** at the tip.
  - **Freight Transfer** is a box aft of the hub, and two **docked
    skiffs** sit at the Berths. The skiffs are decorative.
- **Look:**
  - Three flat tones per face from a fixed light, with thin dark edges.
  - District colour on the fore faces of each ring, and lightly on its
    outer faces.
  - A starfield background.
  - Only real edges are drawn (segment and deck edges), not slice seams.
- **Camera:** fixed (yaw 16°, pitch 38°). The spine and docks hang below
  the hub. The user **cannot rotate** the model, only zoom (scroll wheel,
  `+`, `−`, `⌂` to reset) and pan by dragging when zoomed in.
- **Turning to face you:** when the player's clock position changes, the
  **wheel turns by itself** (animated, the short way round) until the
  player's hour sits at the point nearest the camera. **Only the wheel
  turns:** rings, spokes, hub and Freight Transfer rotate, while the
  spine, Bearing, docks rooms, Blister and skiffs stay still. In the
  docks, the wheel keeps its last orientation.
- **Highlight, no dot:** the player's location lights up with a warm,
  softly pulsing glow. It is drawn on top of the model so it shows
  through anything in front of it.
  - Corridor stop: that face's corridor slice.
  - Side room: the slice for its side and depth.
  - In a lift: the spoke leg being travelled.
  - Docks: that spine section or room box, the Hub, the Bearing,
    Freight Transfer or the Blister.
- **Labels:** small text reading RIM, MID, INNER and DOCKS, at fixed
  screen positions.

### Bottom: the deck plan (detail)

The floor you're on, drawn flat as a true floor plan. There are four
plans, and the panel shows the one for the player's level:

- **Rim, Mid, Inner:** the ring unrolled. The corridor runs left to right
  with **spinward to the right**; **fore** rooms sit above it and **aft**
  rooms below. This matches the game's compass (fore = n, spinward = e).
  - Two-deep rooms stack beyond their parent room.
  - Hull walls run along the fore and aft edges with lit portholes, and
    space shows beyond them.
  - Lift lobbies show a lift symbol with the ladderway hatch beside it.
  - Each corridor stop is labelled with its hour.
  - The plan **wraps** (12:00 follows 11:00), so panning never runs out.
- **Docks:**
  - The spine runs up the page with **fore up**, **port rooms left** and
    **starboard rooms right**.
  - The round Hub sits at the bottom, with four lift doors on its painted
    clock.
  - The Bearing sits between the Hub and Spine 1, and Freight Transfer
    sits below the Hub.
  - The Blister is a dome at the top, and two unlabelled skiffs are
    moored off the Berths. *My call:* no ship names, since the ships
    actually docked vary.
- **Room boxes:**
  - Tinted by district and labelled with the room name.
  - Rooms the shipped data marks **closed** are drawn dashed and dimmed,
    with "closed".
- **Highlight:** the player's room box, corridor stretch or lift symbol
  glows, the same way as in the model.
- **Following the player:** the plan switches to the player's level and
  re-centres only when the player leaves the middle part of the view.
- **Navigation:** zoom with the scroll wheel or `+ − ⌂`, and pan by
  dragging.
- **Info line** (bottom left): the room name, address and gravity, e.g.
  `LAUNDRY · Rim 2:00, aft · 0.9 g`. In a lift: `LIFT 3 · climbing hubward`
  or `LIFT 3 · at Mid 3:00`.

### Off the map

When the player is somewhere that isn't in the station data (their ship,
in space, or a future area):
- the model shows no highlight
- the deck plan keeps its last level, dimmed
- the info line shows the room name from GMCP (e.g. `COCKPIT OF THE MAGPIE`)

*Builder's call, made by me:* the user hasn't decided how ship interiors
should look. This "dimmed, not on station" state is a placeholder.

### Hover

Hovering a room box or corridor stop in the deck plan shows a Mallard
tooltip (`panel.tooltip`) with the name, address and, for closed rooms,
the reason (e.g. "The schoolroom is locked; the station has no teacher
yet."). *My call.* It's cheap and fits the orientation job.

## Data

### Shipped, complete station

**The user's decision:** the plugin ships with the **complete station**
already mapped. It does not build the map as the player explores.

The data is built from Mallard session logs
(`~/.local/share/net.mallard.app/logs/empyreal-7/*.mallardlog`, JSON
lines), using the GMCP frames recorded while the user walked every room
on 2026-10-21.

- **Rooms:** 95, including 4 closed and 9 ladderway rooms inferred from
  the one ladderway that was walked.
- **Per room:**
  - `id`, `name`
  - `coords {x,y,z}`: `x` in half-hours (0–23, `wrap.x = 24`); `y` is
    fore (+) or aft (−) depth for ring rooms; `z` is 0 for Rim, 1 for
    Mid, 2 for Inner, 3 for Hub/Docks. For z = 3, `y` is 0 for the Hub,
    1 for the Bearing, *n*+1 for Spine *n* and its side rooms (`x` −1 is
    port, +1 starboard), 6 for the Blister, and −1 for Freight Transfer.
  - `region` / `regionName`
  - `terrain` (`corridor`, `lobby`, `ladderway`, `hub`, `room`, `ship`)
  - `tags`, `address`, `gravity`, `exits`
  - `closed` and a `closedReason` string
- **Hand-written overrides** (a small, checked-in file) cover what the
  logs can't give:
  - closed rooms and their reasons
  - Freight Transfer's position (the game sends no coords for it)
  - inferred ladderways
  - Schoolroom and Observation Blister positions where they weren't
    walked

**A build script** (Node, like Cowtography's `scripts/`) turns logs plus
overrides into **one ES module the panel imports**, `ui/data/station.js`.
The script is re-run when the game changes. It reads **both GMCP
formats**:
- the current one: `mudstd.room.info` with `region`, `terrain`, `tags`,
  `wrap` and `links`, plus `Empyreal.Room`
- the older one, which lacks `region`, `terrain` and `wrap`

It prefers the newest frame per room. **Inference rules:**
- `terrain`: from the address and exits when absent.
- `region`: from the address and the district table in the help text
  when absent.

A copy of the extraction work so far is in `docs/superpowers/reference/extract.py` and
`docs/superpowers/reference/station.py`, and the output is `docs/superpowers/reference/station.json`.
These are Python prototypes; port the logic.

### Live GMCP (what the game sends now)

Captured 2026-10-21 after the latest deploy:

- **`mudstd.room.info`:**
  - `{ id, name, area: "tiss", areaName, coords{x,y,z}, exits{DIR:{id, inverse}}, region, regionName, terrain, tags[], wrap{x:24}, links[{id,name}] }`
  - `links` lists lift destinations (named `Lift 12` and so on).
  - It is **not** sent while you're inside a lift.
- **`Empyreal.Room`:**
  - `{ id, address, district, gravity, part: "rim"|"mid"|"inner"|"hub"|"spine"|"lift"|..., details[], ways{DIR:{word,name,lift}}, lift?{id,name,floors[]} }`
  - When **inside a lift**: `id: "tiss.lift-9"`, `part: "lift"`,
    `vehicle{ at, between, doors, heading, floors[] }`.
- **`Empyreal.Vehicle`:**
  - `{ id, at, between:[fromId,toId]|null, doors, heading: "hubward"|"rimward"|null }`
  - Sent while a lift moves.
- **`mudstd.room.terrain`:** a legend `[{id, label, color}]`. *Not used*
  in v1. District colours are our own.

## Runtime architecture

**Lua stays thin; the panel does the work.**

- **Lua** (`src/main.lua` plus a few modules):
  - Subscribes with `gmcp.on` to `mudstd.room.info`, `Empyreal.Room` and
    `Empyreal.Vehicle`.
  - Reduces them to a small **location** message and posts it to the
    panel: `{ roomId | null, name, address, gravity, lift: { id, at, between, heading, doors } | null }`.
  - Remembers the last location, and **replays it when the panel sends
    `ready`**. Panels re-mount on open, reload and reconnect.
  - Resets on world disconnect.
  - `[gmcp] advertise` lists the packages above.
  - Handlers must stay well under Mallard's 750 ms callback limit
    (trivial here).
- **Panel** (`ui/`, plain ES modules; Mallard's CSP blocks inline
  scripts, `fetch` and bundling):
  - imports `ui/data/station.js`
  - builds the model and the four deck plans
  - turns location messages into highlights, wheel turns and plan
    switches
- **Mapping a location to the station:**
  - **A room id** that's in the data: highlight it.
  - **A lift:**
    - If the lift is `at` a floor, highlight that floor's lobby on the
      plan and the spoke leg next to it in the model.
    - If it's `between` two floors, highlight the spoke leg joining them.
      The plan switches at the destination floor once the lift arrives.
    - The lift's hour comes from its id (`lift-9` → 9:00) or from the
      floors' rooms.
  - **Anything else:** off the map.

## Behaviour details

- **Turn animation:**
  - Duration scales with the angle (about 0.35 s plus 0.12 s per hour
    turned).
  - Uses `requestAnimationFrame`, with a timer that **snaps to the final
    angle** if frames don't arrive. In a headless test, an animation that
    relied only on frames never finished.
  - Re-sorting about 700 faces per frame was fine in the prototype.
- **Depth sorting:** painter's algorithm on face centroids. Long parts
  are split into short segments to keep the ordering right. Small
  artefacts are acceptable; obvious ones (a spoke showing through the
  rim) should be fixed.
- **Lift lobbies:** standing in a lobby highlights the corridor slice,
  not a spoke.
- **Ladderways:**
  - On the deck plan, the hatch beside the lift glows.
  - In the model, the spoke leg next to that floor glows. On Mid and
    Inner, where two legs touch the floor, light the **hubward** leg
    (*my call*). On the Rim there is only one leg.
- **Hub, Bearing, Freight Transfer:** shown on the Docks plan.

## Settings

- `turn_model` (bool, default on): "Turn the station to face you". When
  off, the wheel stays still at the default orientation. *My call*, for
  motion sensitivity.

## Manifest essentials

- **Identity:** `id = "broaty.empyreal-station-map"`, `name = "Empyreal Station Map"`,
  `language = "lua"`, `entry = "src/main.lua"`,
  `mallard_api_version = "1.0"`, `minimum_app_version` = the user's
  Mallard 0.28.0.
- `[worlds] match = ["empyreal.fly.dev:*"]`.
- `[permissions] gmcp_access` covers the three packages. `sends` is not
  needed.
- `[panels.map]`: custom, `default_dock = "right"`, about 380×600.

## Goals

- Always show where the player is, at a glance, including which floor.
- Make the station feel like a place (the turning wheel, space, the
  district colours).
- Correct geometry: height and fore/aft never confused.
- Work with what Empyreal sends today, and survive the extra fields it
  adds.

## Non-goals (v1)

- Route-finding, click-to-walk and search. The game has `go`,
  `directions` and `nearby`.
- Mapping other areas, ship interiors and space. The design leaves room
  for more maps later (`area` / `region` per room).
- Learning or editing the map in-game.
- A screen-reader version of the map (Empyreal has its own screen-reader
  mode).

## Anti-goals (would be a failure even if it works)

- Fore/aft drawn as height, or anything else that misreports which floor
  a room is on.
- A busy diagram: seams, labels everywhere, or a moving camera the user
  didn't ask for. Only the wheel turns, and only when the player changes
  hour.
- Jank in the client: heavy work in Lua callbacks, or a panel that
  re-renders the whole model every GMCP frame when nothing changed.

## Testing

- **JS (vitest), pure modules:**
  - projection and roll maths
  - which face keys to highlight for a location
  - shortest-turn angle
  - the deck plan positions
  - log extraction and inference, against fixtures cut from real
    `.mallardlog` lines (both GMCP formats)
- **Lua:** tests that stub the Mallard globals (`gmcp`, `mud.panel`,
  `world`), like Cowtography's tests. Check that frames turn into the
  right location messages, including a lift ride (`Empyreal.Room` with
  `vehicle`, then `Empyreal.Vehicle` updates) and the `ready` replay.
- **Manual:**
  - dev-install by symlinking the repo into
    `~/.local/share/net.mallard.app/plugins-dev/`
  - walk the station
  - check: the lift ride, the docks, boarding the ship (off the map), and
    a panel close and reopen

## Left to the builder

- Module boundaries and file layout under `src/` and `ui/`.
- Exact colours, sizes and fonts, within the mockup's look. UI chrome
  (buttons, info line) should use Mallard's theme variables (`--fg`,
  `--fg-muted`, `--bg` and so on, with fallbacks); the space scene itself
  stays dark.
- Packaging script details (`npm run pack` producing a `.mallardx` zip
  with `plugin.toml`, `src/`, `ui/`).

