# Empyreal Station Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Mallard plugin (`broaty.empyreal-station-map`) whose panel shows a flat-shaded, self-turning 3D model of T.I.S.S. over a deck plan of the player's floor, highlighting where the player is.

**Architecture:** A Node build script turns recorded GMCP logs plus a small overrides file into `ui/data/station.js`. At runtime, thin Lua reduces three GMCP packages to a `location` message and replays it when the panel says `ready`. The panel is plain ES modules: pure geometry/model/layout modules (unit-tested with vitest) and two DOM views (model, deck plan) driven by `ui/main.js`.

**Tech Stack:** Lua 5.4 (Mallard sandbox), vanilla ES modules + SVG, Node 22, vitest 2.

**Spec:** `docs/superpowers/specs/2026-10-21-empyreal-station-map-design.md`. Read it first. The visual reference is `docs/superpowers/reference/mockup-orbit-turning.tpl.html` (the spike). Its constants are copied into this plan; take its look, not its structure.

## Global Constraints

- Manifest: `id = "broaty.empyreal-station-map"`, `name = "Empyreal Station Map"`, `language = "lua"`, `entry = "src/main.lua"`, `mallard_api_version = "1.0"`, `minimum_app_version = "0.28.0"`, `[worlds] match = ["empyreal.fly.dev:*"]`.
- GMCP packages: `mudstd.room.info`, `Empyreal.Room`, `Empyreal.Vehicle`. `sends` permission not needed.
- Panel code is ES modules loaded by relative path. No inline `<script>`, no `fetch`/XHR, no bundler (Mallard CSP: `script-src 'self'`, `connect-src 'none'`).
- Mallard Lua `require` has no cache. Require each module exactly once, from `src/main.lua`, and pass dependencies in.
- Lua callbacks must stay far under Mallard's 750 ms watchdog. No loops over station data in Lua.
- **Height (hubward) and fore/aft never share a screen axis in one view.** Deck plans: fore up, spinward right (docks: fore up, port left, starboard right).
- Only the wheel turns (rings, spokes, hub, Freight Transfer). The spine, Bearing, docks rooms, Blister and skiffs never rotate. The user cannot rotate; zoom/pan only.
- No dot marker anywhere. Location is shown by highlight only.
- Highlight colour `#ffb347`. District colours: concourse `#d9a441`, residential `#5b8def`, hydroponics `#4caf7a`, commons `#a57be0`, offices `#3fb6b2`, midring `#8796a8`, industrial `#d0703c`, docks/hub `#cfe3ff`.
- UI chrome (buttons, info line) uses Mallard theme vars with fallbacks (`var(--fg, #dfe7f1)`, `var(--fg-muted, #7d8a9a)`, `var(--bg, #04060c)`). The space scene stays dark.

## Review Focus

1. **A GMCP frame for an id not in the station data** (ship `ship.41`, space, new rooms after a game update): the panel shows the off-map state (no highlight, deck dimmed, the GMCP name in the info line) and never throws. Pinned in Task 5 (`locate` returns `kind:"off"`) and Task 3 (Lua forwards an unknown id unchanged).
2. **Panel opened mid-session, or reopened while the player is mid-lift-ride:** after `ready`, the panel shows the current room or lift leg immediately, not a blank map. Pinned in Task 4 (`ready` replays the settings and last location).
3. **GMCP frames arriving in a new order or missing fields** (`Empyreal.Room` before `mudstd.room.info`, no `gravity`, `vehicle` without `between`): no Lua error, and the location stays sensible. Pinned in Task 3.
4. **Repeated identical frames** (the game re-sends the room on `look`, and `Empyreal.Room` follows `mudstd.room.info`): no duplicate posts, so the wheel never re-animates. Pinned in Task 3 (dedupe) and Task 6 (`shortestTurn` returns the same angle when already facing).
5. **Wrap-around at 11:00 → 12:00** in both the turn (the wheel turns one hour, not eleven) and the deck plan (12:00 drawn right after 11:00, highlight visible). Pinned in Task 6 and Task 7.

---

## File Structure

```
plugin.toml                    manifest (Task 4)
package.json, vitest.config.js scripts + test config (Task 1)
data/overrides.json            hand-written facts the logs can't give (Task 2)
scripts/station-data.mjs       pure: log lines -> rooms (Task 1)
scripts/build-station.mjs      CLI: logs + overrides -> ui/data/station.js (Task 2)
src/main.lua                   wiring: gmcp/world/settings/panel (Task 4)
src/station_map/location.lua   pure reducer: frames -> location message (Task 3)
tests/support/t.lua            tiny Lua test helper (Task 3)
tests/location_test.lua, tests/main_test.lua
tests/fixtures/sample.mallardlog  real log lines, both GMCP formats (Task 1)
ui/data/station.js             generated, committed (Task 2)
ui/lib/geometry.js             constants, districtOf, ang, P3, roll, project, FRONT (Task 5)
ui/lib/locate.js               location message -> Where, keyOf, infoLine (Task 5)
ui/lib/model.js                buildModel(station) -> faces (Task 6)
ui/lib/turn.js                 shortestTurn, turnDuration (Task 6)
ui/lib/deck-layout.js          ring/docks plan positions (Task 7)
ui/lib/svg.js                  el(), stars(), glowFilter(), attachPanZoom() (Task 7)
ui/deck-view.js                DeckView DOM (Task 7)
ui/model-view.js               ModelView DOM (Task 8)
ui/map.html, ui/map.css, ui/main.js   panel shell (Task 9)
dev/preview.html, dev/fake-panel.js   browser preview with a fake window.panel (Task 9, not packed)
```

Pure modules (`ui/lib/*`, `scripts/station-data.mjs`) never touch the DOM. Tests sit next to them as `*.test.js` / `*.test.mjs` and are excluded from the pack.

---

### Task 1: Project scaffold and log extraction library

**Files:**
- Create: `package.json`, `vitest.config.js`, `scripts/station-data.mjs`, `scripts/station-data.test.mjs`, `tests/fixtures/sample.mallardlog`

**Interfaces:**
- Produces (in `scripts/station-data.mjs`):
  - `parseGmcpLines(lines: string[]) -> Frame[]`, where `Frame = { pkg: string, data: object, t: number }`. Keep only `kind:"protocol"` lines whose `event.kind === "gmcp"`. Skip malformed JSON silently.
  - `collectRooms(frames: Frame[]) -> Map<id, Room>`. Merges `mudstd.room.info` (`id`, `name`, `coords`, `region`, `regionName`, `terrain`, `tags`, `exits` flattened to `{DIR: id}`) and `Empyreal.Room` (`address`, `gravity`, `district`, `part`) per id. Later frames overwrite earlier ones field by field. Ignores ids not starting with `tiss.`, frames without coords for mudstd, and `Empyreal.Room` frames with `part:"lift"`. Also accepts the old `Room.Info` package (`num`→id, `exits` as `{dir:id}`) as a fallback source.
  - `Room = { id, name, x, y, z, region|null, regionName|null, terrain|null, tags:[], address|null, gravity|null, exits:{DIR:id}, walked:true }`.

- [ ] **Step 1: Scaffold.** `package.json` (name `empyreal-station-map`, `"type":"module"`, devDependency `vitest ^2`). Scripts:
  - `test` = `vitest run && npm run test:lua`
  - `test:lua` = `lua tests/location_test.lua && lua tests/main_test.lua`
  - `build:data` = `node scripts/build-station.mjs`
  - `pack` (Task 9)

  `vitest.config.js` includes `scripts/**/*.test.mjs` and `ui/**/*.test.js`. Run `npm install`.

- [ ] **Step 2: Cut the fixture from real logs.** It needs both GMCP formats, a lift ride and the ship. Run from the repo root:
  ```bash
  L=~/.local/share/net.mallard.app/logs/empyreal-7
  { grep -m2 '"package":"mudstd.room.info".*"id":"tiss.concourse"' $L/2026-10-20.mallardlog
    grep -m1 '"package":"Empyreal.Room".*"id":"tiss.concourse"' $L/2026-10-20.mallardlog
    grep -m1 '"package":"Room.Info"' $L/*.mallardlog | cut -d: -f2-
    grep -m1 '"package":"mudstd.room.info".*"id":"tiss.ladderway-9-rim"' $L/2026-10-21.mallardlog
    grep -m1 '"package":"mudstd.room.info".*"region":"concourse".*"id":"tiss.market"' $L/2026-10-21.mallardlog
    grep -m1 '"package":"mudstd.room.info".*"id":"tiss.kitchen".*"terrain"' $L/2026-10-21.mallardlog
    grep -m1 '"package":"Empyreal.Room".*"id":"tiss.lift-9"' $L/2026-10-21.mallardlog
    grep '"package":"Empyreal.Vehicle"' $L/2026-10-21.mallardlog | tail -2
    grep -m1 '"package":"mudstd.room.info".*"id":"ship.41"' $L/*.mallardlog | cut -d: -f2-
    echo 'not json'; } > tests/fixtures/sample.mallardlog
  wc -l tests/fixtures/sample.mallardlog   # about 12 lines; the last is the malformed one
  ```
  If a grep returns nothing, find an equivalent line with `grep -c` across the log files. The fixture must hold one old-format and one new-format `mudstd.room.info`.

- [ ] **Step 3: Write failing tests** in `scripts/station-data.test.mjs`:
  - `parseGmcpLines skips non-gmcp and malformed lines`: the fixture gives `frames.length === lines - 1` (only the `not json` line is dropped) and every `frame.pkg` is a string.
  - `collectRooms merges both formats`: `rooms.get("tiss.concourse")` has `x:0, y:0, z:0`, `name:"Main Concourse"`, `address:"Rim 12:00"`, `gravity:0.9`, `exits.N === "tiss.market"`.
  - `collectRooms keeps new-format fields`: `tiss.market` has `region:"concourse"`, `terrain:"room"`; `tiss.kitchen` has `y:-2`.
  - `collectRooms ignores lifts and other areas`: no key `tiss.lift-9`, no key `ship.41`.
  - `ladderway coords`: `tiss.ladderway-9-rim` has `x:19, y:0, z:0`.
- [ ] **Step 4:** Run `npx vitest run scripts/station-data.test.mjs`. Expect FAIL (module missing).
- [ ] **Step 5:** Implement `parseGmcpLines` and `collectRooms`.
- [ ] **Step 6:** Run the tests again. Expect PASS.
- [ ] **Step 7:** Commit: `git add package.json package-lock.json vitest.config.js scripts tests/fixtures && git commit -m "feat(data): parse GMCP room frames from Mallard logs"`

### Task 2: Station build script, overrides and generated data

**Files:**
- Create: `data/overrides.json`, `scripts/build-station.mjs`
- Modify: `scripts/station-data.mjs`, `scripts/station-data.test.mjs`
- Create (generated): `ui/data/station.js`

**Interfaces:**
- Consumes: `parseGmcpLines`, `collectRooms` (Task 1).
- Produces:
  - `completeStation(rooms: Map, overrides) -> StationRoom[]` (sorted by id) in `scripts/station-data.mjs`.
  - `ui/data/station.js`: `export default { wrap: 24, rooms: StationRoom[] }`.
  - `StationRoom = { id, name, x, y, z, region, terrain, address, gravity, exits, closed:boolean, closedReason:string|null, walked:boolean }`.

**Rules for `completeStation`, in order:**
1. **Overrides** (`overrides.rooms[id]`) are merged over the rooms. An override for a missing id creates the room with `walked:false`.
2. **Ladderways:** for each spoke hour `h` in `[12,3,6,9]` and ring `z` in 0..2, add `tiss.ladderway-{h}-{rim|mid|inner}` if missing:
   - `x = (h%12)*2 + 1`, `y = 0`, `z`
   - `name = "Ladderway {h}, {Rim|Mid|Inner}"`, `address = "{Rim|Mid|Inner} {h}:00, ladderway"`
   - `terrain:"ladderway"`, `walked:false`
3. **Inference** when a field is null:
   - `terrain`:
     - `"ladderway"` if the id contains `ladderway`
     - `"hub"` for `tiss.hub`/`tiss.bearing`
     - `"lobby"` if `y===0 && z<3 && x%6===0`
     - `"corridor"` if `y===0 && z<3`
     - else `"room"`
   - `region`:
     - `z===2` → `"industrial"`
     - `z===1` → `"offices"` if `x>=21 || x<=3`, else `"midring"`
     - `z===0` → by hour `x/2`: 11, 12 and 1 → `"concourse"`; 2–4 → `"residential"`; 5–7 → `"hydroponics"`; 8–10 → `"commons"`
     - `z===3` → `"hub"` for y ≤ 1 (Hub, Bearing, Freight Transfer), else `"docks"`
     - ladderways → `"ladderways"`
   - `gravity`: from z, `[0.9, 0.6, 0.3, 0][z]`.
4. **Defaults:** `closed` defaults to `false`, and `closedReason` to `null`.
5. **Drop:** rooms without coordinates after all of the above are dropped, with a warning to stderr naming them.

**`data/overrides.json`** (exact content):
```json
{ "rooms": {
  "tiss.clinic":      { "name": "Clinic", "x": 16, "y": 1, "z": 0, "address": "Rim 8:00, fore", "closed": true,
                        "closedReason": "The clinic's shutters are down until the station finds a doctor." },
  "tiss.schoolroom":  { "name": "Schoolroom", "x": 20, "y": 1, "z": 0, "address": "Rim 10:00, fore", "closed": true,
                        "closedReason": "The schoolroom is locked; the station has no teacher yet." },
  "tiss.flats":       { "name": "Mid-Ring Flats", "x": 9, "y": -1, "z": 1, "address": "Mid 4:30, aft", "closed": true,
                        "closedReason": "The flats are sealed off while they are refitted for housing." },
  "tiss.machineshop": { "name": "Machine Shop", "x": 9, "y": -1, "z": 2, "address": "Inner 4:30, aft", "closed": true,
                        "closedReason": "The machine shop is shuttered until someone takes it on." },
  "tiss.transfer":    { "x": 0, "y": -1, "z": 3, "address": "Hub, freight" }
} }
```

- [ ] **Step 1: Write failing tests** (add to `scripts/station-data.test.mjs`, using the fixture plus a hand-built `Map`):
  - `completeStation adds 12 ladderways`: the result holds `tiss.ladderway-12-mid` with `x:1, z:1, terrain:"ladderway", walked:false`. Walked `tiss.ladderway-9-rim` keeps `walked:true`.
  - `completeStation applies overrides`: `tiss.clinic` has `closed:true`, a non-empty `closedReason` and `walked:false`. `tiss.transfer` gets `z:3, y:-1`.
  - `completeStation infers region and terrain`: a bare room `{id:"tiss.inner-0430", x:9, y:0, z:2}` gets `region:"industrial"`, `terrain:"corridor"`, `gravity:0.3`. A bare `{x:18, y:0, z:0}` gets `terrain:"lobby"`, `region:"commons"`.
  - `completeStation is sorted and drops coordless rooms`.
- [ ] **Step 2:** Run. Expect FAIL.
- [ ] **Step 3:** Implement `completeStation` as specified above.
- [ ] **Step 4: Write `scripts/build-station.mjs`.**
  - Usage: `node scripts/build-station.mjs [--logs DIR] [--out ui/data/station.js]`, with `DIR` defaulting to `~/.local/share/net.mallard.app/logs/empyreal-7`.
  - Reads every `*.mallardlog` in name order.
  - Writes `// Generated by scripts/build-station.mjs — do not edit.\nexport default ` + `JSON.stringify(..., null, 1)`.
  - Prints a summary line: `N rooms (W walked, C closed)`.
- [ ] **Step 5:** Run `npm test -- --run scripts` (expect PASS), then `npm run build:data`.
  - Expect at least `95 rooms`, with `4 closed`.
  - Spot-check: `node -e 'import("./ui/data/station.js").then(m=>console.log(m.default.rooms.find(r=>r.id==="tiss.blister")))'` prints `x:0, y:6, z:3`.
  - Compare the id set with `docs/superpowers/reference/station.json`. It should be the same ids, plus any new ones.
- [ ] **Step 6:** Commit: `git add data scripts ui/data && git commit -m "feat(data): build complete station data from logs and overrides"`

### Task 3: Lua location reducer

**Files:**
- Create: `src/station_map/location.lua`, `tests/support/t.lua`, `tests/location_test.lua`

**Interfaces:**
- Produces (`require('station_map.location')` returns a module `L`):
  - `L.new() -> state`
  - `L.room_info(state, data)`, `L.empyreal_room(state, data)`, `L.vehicle(state, data)`, `L.reset(state)`: each returns `true` if the outgoing message changed.
  - `L.message(state) -> table`, shaped as `{ roomId = string|nil, name = string|nil, address = string|nil, gravity = number|nil, lift = { id, at, between = {a,b}|nil, heading, doors }|nil }`.
- `tests/support/t.lua` exports `test(name, fn)`, `eq(actual, expected, msg)` (deep compare for tables), and `done()`, which prints a summary and calls `os.exit(1)` on any failure.

**Reducer rules:**
- `room_info`: sets `roomId = data.id` and `name = data.name`, and clears `lift`. A missing `id` leaves the state unchanged and returns `false`.
- `empyreal_room`:
  - If `data.part == "lift"` or `data.vehicle`: `lift = {id=data.id, at, between, heading, doors}` from `data.vehicle`, `roomId = nil`, `name = data.address`.
  - Otherwise, if `data.id`: `roomId = data.id` (keep `name` if the id is unchanged), `address = data.address`, `gravity = data.gravity`, `lift = nil`.
- `vehicle`: only when `state.lift` and `data.id == state.lift.id`. Update `at`, `between`, `heading` and `doors`. Otherwise return `false`.
- **Change detection:** compare a serialised form of `message()` before and after. Return `false` when it's equal (Review Focus 4).

- [ ] **Step 1: Write failing tests** in `tests/location_test.lua`, with `package.path = './src/?.lua;./tests/?.lua;' .. package.path`:
  - `room_info sets room`: after `room_info(s, {id="tiss.market", name="Market Hall"})`, `message(s).roomId == "tiss.market"` and `lift == nil`.
  - `empyreal_room adds address and gravity`: after the above, `empyreal_room(s, {id="tiss.market", address="Rim 12:00, fore", gravity=0.9, part="rim"})` gives `address == "Rim 12:00, fore"`, `gravity == 0.9` and `name == "Market Hall"`.
  - `empyreal_room before room_info`: on a fresh state, `empyreal_room(s, {id="tiss.gym", address="Mid 3:00, fore"})` gives `roomId == "tiss.gym"` with no error.
  - `entering a lift`: `empyreal_room(s, {id="tiss.lift-9", part="lift", address="Lift 9", vehicle={at="tiss.rim-0900", doors="open"}})` gives `roomId == nil` and `lift.id == "tiss.lift-9"`, `lift.at == "tiss.rim-0900"`.
  - `vehicle moves the lift`: `vehicle(s, {id="tiss.lift-9", at=nil, between={"tiss.rim-0900","tiss.mid-0900"}, heading="hubward", doors="closed"})` gives `lift.between[2] == "tiss.mid-0900"`, `lift.at == nil` and returns `true`.
  - `vehicle for another lift is ignored`: returns `false`.
  - `leaving the lift`: `room_info(s, {id="tiss.mid-0900", name="Mid 9:00"})` clears `lift`.
  - `unknown area passes through`: `room_info(s, {id="ship.41", name="Cockpit of the Magpie"})` gives `roomId == "ship.41"`.
  - `missing fields don't error`: `empyreal_room(s, {})` returns `false`, and `vehicle(s, {})` returns `false`.
  - `identical frame reports no change`: a second identical `room_info` returns `false`.
  - `reset clears`: after `reset(s)`, `message(s).roomId == nil`.
- [ ] **Step 2:** Run `lua tests/location_test.lua`. Expect FAIL (module not found).
- [ ] **Step 3:** Implement `src/station_map/location.lua` and `tests/support/t.lua`.
- [ ] **Step 4:** Run again. Expect all PASS and exit code 0.
- [ ] **Step 5:** Commit: `git add src tests/support tests/location_test.lua && git commit -m "feat(lua): reduce GMCP frames to a location message"`

### Task 4: Plugin manifest and Lua wiring

**Files:**
- Create: `plugin.toml`, `src/main.lua`, `tests/main_test.lua`

**Interfaces:**
- Consumes: the `station_map.location` module (Task 3).
- Produces the panel protocol (relied on by Task 9):
  - Lua → panel `"location"`: the `L.message()` table.
  - Lua → panel `"settings"`: `{ turn_model = boolean }`.
  - Panel → Lua `"ready"`: `{}`. Lua replies with `"settings"`, then `"location"`, but only once a location is known.

**`plugin.toml`:**
- Global Constraints keys, plus `version = "0.1.0"`, `description = "Map of T.I.S.S. for Empyreal: a turning station model over a deck plan of your floor."`, `authors = ["John Erlandsson"]`, `license = "MIT"`.
- `[permissions] gmcp_access = ["mudstd.room.info", "Empyreal.Room", "Empyreal.Vehicle"]`.
- `[gmcp] advertise = ["mudstd.room", "Empyreal.Room", "Empyreal.Vehicle"]`.
- `[panels.map] title = "Station Map"`, `entry = "ui/map.html"`, `default_dock = "right"`, `default_size = { width = 380, height = 600 }`.
- `[settings.turn_model] type = "bool"`, `default = true`, `label = "Turn the station to face you"`, `description = "Rotate the station model so your location faces the camera."`.

**`src/main.lua`:**
- Requires `station_map.location` once and calls `mud.panel("map")`.
- `gmcp.on` handlers for the three packages call the reducer and `panel:post("location", L.message(state))` when it returns `true`.
- `world.on("disconnect")` resets the state and posts `location`.
- `panel:on_message("ready")` replays.
- `settings.on("change")` posts `settings` when the key is `turn_model`.
- Uses `log.debug` for unknown packages only.

- [ ] **Step 1: Write failing tests** in `tests/main_test.lua`. Stub the globals: `gmcp.on` records handlers by package; `mud.panel` returns a fake with `post` (records) and `on_message`; `world.on`; `settings.get` returns `true`; `settings.on`; `log.debug`.
  - `room frame posts location`: calling the `mudstd.room.info` handler with `{id="tiss.market", name="Market Hall"}` posts one `location` with `roomId == "tiss.market"`.
  - `duplicate frame posts nothing`.
  - `ready replays settings then location`: after a room frame, invoking `ready` posts `settings` (`turn_model == true`) then `location`, in that order.
  - `ready before any location posts only settings`.
  - `mid-ride ready replays the lift`: after the `Empyreal.Room` lift frame and one `Empyreal.Vehicle` frame, `ready` replays `location.lift.between`.
  - `disconnect posts an empty location`: `roomId == nil`.
  - `settings change posts settings`.
- [ ] **Step 2:** Run `lua tests/main_test.lua`. Expect FAIL.
- [ ] **Step 3:** Implement `plugin.toml` and `src/main.lua`.
- [ ] **Step 4:** Run `npm run test:lua`. Expect PASS.
- [ ] **Step 5:** Commit: `git add plugin.toml src/main.lua tests/main_test.lua && git commit -m "feat(lua): wire GMCP, settings and panel replay"`

### Task 5: Geometry and locating the player (pure JS)

**Files:**
- Create: `ui/lib/geometry.js`, `ui/lib/geometry.test.js`, `ui/lib/locate.js`, `ui/lib/locate.test.js`

**Interfaces:**
- **Produces** (`geometry.js`):
  - Constants:
    - `RING = ["Rim","Mid","Inner","Hub"]`, `STEP = [2,3,3]` (x units between corridor stops), `SPOKE_HOURS = [0,3,6,9]`, `WRAP = 24`
    - `DISTRICT_COLOURS` (Global Constraints)
    - `RR = [300,205,115]`, `RT = [22,18,16]`, `RWZ = [46,34,32]`
    - `HUBR = 32`, `HUBZ = 34`, `SPR = 18`, `SPZ = n => 58 + 72*n`, `BLZ = SPZ(4) + 40`
    - `SLICE = [-1,-.6,-.2,.2,.6,1]`, `CAM = {yaw:16, pitch:38}`
  - `districtOf(z, x) -> "concourse"|...|"docks"`: same rule as Task 2's region inference; for z = 3, `"docks"`.
  - `ang(h) -> radians` (`h/12*2π`).
  - `P3(r, h, z) -> [x,y,z]` with `[r·sin(ang h), r·cos(ang h), z]`.
  - `roll(p, phiHours) -> [x,y,z]`, so a point at hour `h` moves to `h+phi`.
  - `project(p) -> [sx, sy, depth]`: yaw about Y, then pitch about X; screen y is down, and larger depth is nearer.
  - `FRONT`: the hour nearest the camera, `atan2(-sin(yaw)·cos(pitch), sin(pitch))` converted to hours.
- **Produces** (`locate.js`):
  - `indexStation(station) -> { byId: Map, corridors: {0:[...],1:[...],2:[...]} }`. Corridors are sorted by x, terrain `corridor`/`lobby` only.
  - `locate(index, msg, prevLevel) -> Where`. `Where` is one of:
    - `{ kind:"room", id, level:0..3, x, y }`
    - `{ kind:"lift", hour:0..11, leg:0..2, level, atId|null }`
    - `{ kind:"off", name }`
  - `keyOf(where) -> string|null`. Model face key: `"r{z}:{x}:{clamp(y,-2,2)}"` for ring rooms; `"spoke:{hour}:{leg}"` for lifts and ladderways; the room id for z = 3; `null` for off.
  - `infoLine(where, msg, index) -> string`.

**Rules:**
- **Level of a room:** its `z`.
- **Ladderway room** (`terrain:"ladderway"`): `kind:"room"`, but `keyOf` gives `spoke:{(x-1)/2}:{z}`, the hubward leg.
- **Lift hour:** from the id `tiss.lift-N` (`N%12`).
- **Lift leg:**
  - `between [a,b]` → `min(level a, level b)`.
  - `at f` → `min(level f, 2)`.
  - Ladderway room at ring `z` → leg `z`, which is the hubward leg (spec).
- **Lift level:** the `at` room's level. While `between`, it's `prevLevel` (the plan switches only on arrival). If `prevLevel` is null, use the level of `between[0]`.
- **Info line**, uppercase name, `·` separators:
  - room: `${name} · ${address} · ${gravity} g` (e.g. `LAUNDRY · Rim 2:00, aft · 0.9 g`)
  - lift between: `LIFT 9 · climbing hubward` (or `· descending rimward`)
  - lift at: `LIFT 9 · at Mid 9:00`, using the floor room's name from the index
  - off: `${name}` uppercased, or `""`

- [ ] **Step 1: Write failing tests:**
  - `geometry.test.js`:
    - `roll moves hour 0 to hour 3`: `roll(P3(1,0,0), 3)` ≈ `P3(1,3,0)`.
    - `FRONT is about -0.6 hours for CAM 16/38`: assert `-0.9 < FRONT < -0.3`.
    - `project puts a fore point lower on screen than the hub`: `project([0,0,200])[1] > project([0,0,0])[1]`. This guards "docks hang below".
    - `districtOf`: `(0,22)→"concourse"`, `(0,4)→"residential"`, `(1,21)→"offices"`, `(1,9)→"midring"`, `(2,0)→"industrial"`.
  - `locate.test.js`, against `ui/data/station.js`:
    - `room`: `{roomId:"tiss.laundry"}` gives `kind:"room"`, `level:0`, `x:4`, `y:-1`, and `keyOf` gives `"r0:4:-1"`.
    - `two deep`: `tiss.kitchen` gives the key `"r0:0:-2"`.
    - `docks room`: `tiss.berth` gives `level:3` and key `"tiss.berth"`.
    - `lift between`: `{lift:{id:"tiss.lift-3", between:["tiss.mid-0300","tiss.inner-0300"], heading:"hubward"}}` with `prevLevel 1` gives `hour:3`, `leg:1`, `level:1`, and `infoLine` `"LIFT 3 · climbing hubward"`.
    - `lift at hub`: `at:"tiss.hub"` gives `leg:2`, `level:3`, and info `"LIFT 3 · at The Hub"`.
    - `lift 12 hour`: gives `hour:0`.
    - `ladderway`: `tiss.ladderway-9-mid` gives key `"spoke:9:1"`.
    - `unknown id is off` (Review Focus 1): `{roomId:"ship.41", name:"Cockpit of the Magpie"}` gives `kind:"off"`, `keyOf` `null`, and info `"COCKPIT OF THE MAGPIE"`.
    - `empty message is off`: `{}` gives `kind:"off"`, info `""`.
    - `info line`: `tiss.laundry` with `{address:"Rim 2:00, aft", gravity:0.9, name:"Laundry"}` gives `"LAUNDRY · Rim 2:00, aft · 0.9 g"`.
- [ ] **Step 2:** Run `npx vitest run ui/lib`. Expect FAIL.
- [ ] **Step 3:** Implement both modules.
- [ ] **Step 4:** Run. Expect PASS.
- [ ] **Step 5:** Commit: `git add ui/lib && git commit -m "feat(ui): station geometry and player location"`

### Task 6: Model builder and turn maths (pure JS)

**Files:**
- Create: `ui/lib/model.js`, `ui/lib/model.test.js`, `ui/lib/turn.js`, `ui/lib/turn.test.js`

**Interfaces:**
- Consumes: `geometry.js`, `indexStation` (Task 5).
- **Produces:**
  - `buildModel(index) -> Face[]`, with `Face = { pts:[[x,y,z]...], kind, key|null, tint|null, edges:boolean[], turns:boolean }`.
  - `shortestTurn(phi, hour, front=FRONT) -> targetPhi`: the target closest to `phi` with `(targetPhi + hour) ≡ front (mod 12)`.
  - `turnDuration(deltaHours) -> ms` = `350 + 120*|delta|`.

**Model content** (as in the spec and the mockup's `buildModel`):
- **Rings:** for each ring, one segment per corridor stop of that ring, spanning `hour ± (12/n)/2`. Each segment has five slices (`SLICE`).
  - Every slice gets an outer and an inner quad.
  - Slice 4 also gets a `fore` cap, and slice 0 an `aft` cap.
  - The key is `r{z}:{x}:{slice-2}` and the tint is `DISTRICT_COLOURS[districtOf]`.
  - `edges` are true only on segment boundaries and deck edges. Outer quad: `[s===0, true, s===4, true]`. Inner quad: `[s===4, true, s===0, true]`.
- **Spokes:** three legs per spoke hour, between radii
  `LV = [RR0-RT0, RR1+RT1, RR1-RT1, RR2+RT2, RR2-RT2, HUBR]`, with pairs (0,1), (2,3), (4,5).
  - Each leg is 4 boxes, half-size 8 across, keyed `spoke:{h}:{leg}`.
  - Rotate the boxes by `+h` (the spike had a sign bug that mirrored 3 and 9).
- **Hub:** an octagonal prism `r=HUBR`, `z ±HUBZ`, key `tiss.hub`.
- **Bearing:** an octagonal prism `r=23`, `z HUBZ..HUBZ+16`, key `tiss.bearing`.
- **Spine:**
  - Four square sections `r=SPR`, `z SPZ(n)±36`, keys `tiss.spine-{n}`, plus an unkeyed root section `HUBZ+16..SPZ(1)-36`.
  - Side rooms: boxes at `x=±(SPR+26)`, `z=SPZ(y-1)`, half-sizes 26/16/28, keyed by room id. Use station rooms with `z=3`, `x≠0`, `y` from 2 to 5.
- **Blister:** two octagonal prisms (`r=26` over `BLZ-12..BLZ+4`, `r=16` over `+4..+18`), key `tiss.blister`.
- **Freight Transfer:** a box at `z=-HUBZ-14`, half-size 18/14/14, key `tiss.transfer`.
- **Skiffs:** two unkeyed boxes beside Spine 3 starboard.
- `turns = true` for ring, spoke, hub and transfer faces; `false` for everything else.

- [ ] **Step 1: Write failing tests:**
  - `model.test.js`:
    - `has a corridor slice for every corridor stop`: for each corridor room `r`, at least one face has key `r{z}:{x}:0`.
    - `rim has 12 segments, mid and inner 8`: count distinct x per ring among `fore` faces.
    - `the spine does not turn`: every face keyed `tiss.spine-*`, `tiss.blister`, `tiss.bearing`, or a side-room id has `turns:false`; every ring face has `turns:true`.
    - `spoke 3 points to 3 o'clock`: the mean x of the `spoke:3:0` points is greater than 0 (guards the mirrored-spoke bug).
    - `every keyOf a station room has faces`: for every room in the station, `keyOf(locate(...))` is null or matches at least one face.
  - `turn.test.js`:
    - `already facing`: `shortestTurn(FRONT-2, 2)` equals `FRONT-2` (Review Focus 4).
    - `wraps forward across 12`: from facing hour 11 (`phi=FRONT-11`), moving to hour 0 gives a target with `target - phi` ≈ −1 (one hour back in phi, not +11) (Review Focus 5).
    - `never turns more than 6 hours`, over hours 0..11.
    - `turnDuration(2)` returns 590.
- [ ] **Step 2:** Run `npx vitest run ui/lib`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expect PASS.
- [ ] **Step 5:** Commit: `git add ui/lib && git commit -m "feat(ui): station model faces and turn maths"`

### Task 7: Deck plans (layout + view)

**Files:**
- Create: `ui/lib/deck-layout.js`, `ui/lib/deck-layout.test.js`, `ui/lib/svg.js`, `ui/deck-view.js`

**Interfaces:**
- Consumes: `indexStation`, `districtOf` and `DISTRICT_COLOURS` (Task 5).
- **Produces** (`deck-layout.js`):
  - `ringLayout(index, z) -> { length, stops:[{id,x,cx,hour,lobby}], rooms:[{room,cx,cy,w,h,door:{x,y,w,h}}] }`.
    - Constants: `NODE=150`, `CH=15` (corridor half-height), `RW=116`, `RH=58`, `GAP=9`, `HULLY=175`.
    - `cx = x/STEP[z]*NODE`.
    - Fore (`y>0`) is up: `cy = -(CH+GAP+(|y|-1)*(RH+GAP)+RH/2)` for fore, positive for aft.
  - `docksLayout(index) -> { rooms:[{room,cx,cy,w,h}], hub:{cx,cy,r}, bearing:{...}, spine:[{n,cx,cy,h}], blister:{...}, transfer:{...} }`.
    - Constants: `SN=120`, `SX=92`; `Y(y) = -y*SN`.
    - Port (`x<0`) is left; the Hub is a circle `r=58` at `Y(0)`; Freight Transfer is at `Y(-1)+12`.
  - `highlightShape(layout, where) -> {kind:"rect"|"circle", ...} | null`:
    - corridor stop: the corridor stretch `cx±NODE/2`, height `2*CH`
    - room: its box
    - lift: a circle `r=15` at the lobby
    - ladderway: an 18×18 rect around the hatch, at the lobby's `cx+27`
    - docks: the matching shape
- **Produces** (`svg.js`):
  - `el(tag, attrs, parent, text)`, `stars(g, x, y, w, h, n, seed)`, `glowFilter(defs, id)`
  - `attachPanZoom(div, get, set, {minW,maxW}) -> zoom(f)`: wheel zoom about the cursor, drag pan.
  - `zoomButtons(container, top, onZoom)`, with buttons `+` (÷1.5), `−` (×1.5), `⌂` (reset).
- **Produces** (`deck-view.js`):
  - `class DeckView { constructor(containerEl, index); set(where); dim(on:boolean) }`.
  - It draws all four plans once and shows the plan for `where.level`, using the mockup's `buildRingDeck`/`buildDocksDeck` look: hull plate, seams, portholes, corridor district underline, lobby `⇅` and ladder hatch, hour labels, closed rooms dashed and dimmed with "closed", docks Bearing collar, the Hub with four lift doors, the Blister dome, two unlabelled skiffs.
  - Rings are drawn three times (offset `-length, 0, +length`) so the plan wraps.
  - Re-centre when the plan changes, or when the highlight leaves the middle 70% of the view. For lifts, keep the last plan until arrival.
  - Hover on a room box or stop calls `window.panel?.tooltip?.show(rect, {title: name, body: address, rows: closed ? [{label:"Closed", value: closedReason, valueColor:"muted"}] : []})`, and `hide()` on leave.

- [ ] **Step 1: Write failing tests** in `deck-layout.test.js`:
  - `rim plan has 12 stops spaced NODE apart`, with `length === 1800`.
  - `fore is up`: the Market Hall's `cy < 0`; the Slag Heap's `cy > 0`; the Kitchen's `cy` > the Slag Heap's.
  - `12:00 follows 11:00 across the wrap` (Review Focus 5): `stops` at x=22 and x=0 are `NODE` apart modulo `length`.
  - `docks: port left, fore up`: the Fuel Depot's `cx < 0`, the Berths' `cx > 0`, and Spine 4's `cy` < Spine 1's `cy`.
  - `highlightShape` for `tiss.laundry` is a rect equal to its room box, and for a lift at Rim 3:00 a circle at the stop's `cx`.
- [ ] **Step 2:** Run `npx vitest run ui/lib/deck-layout.test.js`. Expect FAIL.
- [ ] **Step 3:** Implement `deck-layout.js` and `svg.js`.
- [ ] **Step 4:** Run. Expect PASS.
- [ ] **Step 5:** Implement `ui/deck-view.js`. It is checked visually in Task 9.
- [ ] **Step 6:** Commit: `git add ui && git commit -m "feat(ui): deck plans for rings and docks"`

### Task 8: Model view (render, highlight, turning, zoom)

**Files:**
- Create: `ui/model-view.js`

**Interfaces:**
- Consumes: `buildModel`, `shortestTurn`, `turnDuration`, `project`, `roll`, `FRONT`, `keyOf`, and `svg.js` helpers.
- Produces: `class ModelView { constructor(containerEl, index); set(where); setTurning(enabled:boolean) }`.

**Behaviour:**
- **Render:** project every face with `roll(p, phi)` applied when `face.turns` is true. Sort by mean depth, ascending.
- **Faces:**
  - Draw each face filled, with its stroke set to the same fill at width 0.8, so there are no seams.
  - Then draw only the edges where `edges[i]` is true, in `#0d1218` at width 1.3.
  - Flat tone: `|n·L|` with `L = normalize([-.5,.75,.45])`. Above .66 use `#7e8da3`, above .33 use `#58667b`, else `#3a4556`.
  - Tints: `fore` faces mix 70% toward the tint, `outer` faces 25%.
  - Skiffs use their own lighter greys; the Blister mixes 45% toward `#cfe3ff`.
- **Highlight:** faces whose key equals `keyOf(where)` are drawn again in a top group: fill `#ffb347` at 0.55, stroke `#fff3df` 1.4, a glow filter, and a CSS pulse of opacity 1 → .55 → 1 over 1.8 s.
- **Turning:**
  - On `set`, when `where` gives an hour (a ring room's `x/2`, or a lift's `hour`) and turning is enabled, animate `phi` to `shortestTurn` over `turnDuration`, with ease-in-out, using `requestAnimationFrame`.
  - Also set a `setTimeout(dur + 400)` that snaps to the target if frames stalled.
  - When the hour is unchanged, or the location is off or in the docks, don't animate. Redraw only if the key changed (anti-goal: no re-render when nothing changed).
  - With turning disabled, `phi` stays at `FRONT` (12:00 faces the camera).
- **Labels:** RIM, MID, INNER at `P3(RR[z]+RT[z], FRONT+2.6, RWZ[z])`, and DOCKS beside `[0,0,BLZ+18]`, at fixed screen positions (they don't rotate).
- **viewBox:** fit to the union of the projected bounds over `phi` in 0..11 (compute once), plus padding.
- **Controls:** `attachPanZoom` with `minW = 0.25·W` and `maxW = 1.2·W`, plus `zoomButtons`. No rotation input.

- [ ] **Step 1:** Implement `ModelView`.
- [ ] **Step 2:** Run `npx vitest run`. Expect all existing tests to still pass. This view is verified in Task 9.
- [ ] **Step 3:** Commit: `git add ui/model-view.js && git commit -m "feat(ui): turning station model view"`

### Task 9: Panel shell, preview harness, packaging, manual verification

**Files:**
- Create: `ui/map.html`, `ui/map.css`, `ui/main.js`, `dev/preview.html`, `dev/fake-panel.js`, `README.md`
- Modify: `package.json` (the `pack` script)

**Interfaces:**
- Consumes: the panel protocol (Task 4), `indexStation`/`locate`/`infoLine` (Task 5), `ModelView` (Task 8) and `DeckView` (Task 7).

**Panel files:**
- **`ui/map.html`:** a `#model` element (top 42%), a 1px separator, a `#deck` element (bottom 58%), and an `#info` line. Load with `<script type="module" src="main.js">`.
- **`ui/main.js`:**
  - Imports the station and builds both views.
  - `panel.on("settings", s => model.setTurning(s.turn_model))`.
  - `panel.on("location", msg => { where = locate(index, msg, lastLevel); if (where.kind !== "off") lastLevel = where.level; model.set(where); deck.set(where); deck.dim(where.kind === "off"); info.textContent = infoLine(where, msg, index) })`.
  - Last line: `panel.post("ready", {})`.
- **`dev/fake-panel.js`:** defines `window.panel = { on, post, tooltip: {show(){}, hide(){}} }` before `main.js` loads. `dev/preview.html` loads it, then `../ui/main.js`, and adds a **▶ Walk** button that replays this route:
  - Concourse → Market Hall → Concourse → Rim 1:00 → Residential → Laundry → Residential → Rim 3:00
  - Lift 3 to Mid, then Gym; Lift 3 to Inner, then Fabricator; Lift 3 to the Hub
  - Bearing → Spine 1–3 → Berths
  - `ship.41`

  Lift steps should send the real message shapes from Task 3, as `location` messages through the fake panel.
- **Packaging:** the `pack` script becomes `rm -f empyreal-station-map-$npm_package_version.mallardx && zip -r empyreal-station-map-$npm_package_version.mallardx plugin.toml README.md src ui -x 'ui/**/*.test.js'`.
- **`README.md`:** what the plugin does, a short description of the panel, the turn setting, how to rebuild the station data (`npm run build:data`), dev install, and an AI disclosure (the same wording style as Cowtography's README).

- [ ] **Step 1:** Implement `ui/map.html`, `ui/map.css` and `ui/main.js`.
- [ ] **Step 2: Headless check.**
  - Run `python3 -m http.server 8765` from the repo root in the background.
  - Screenshot `http://localhost:8765/dev/preview.html` with `chromium-browser --headless=new --window-size=420,700 --virtual-time-budget=4000 --screenshot=/tmp/p.png <url>`.
  - Read the image and check:
    - the model is in the top band with the spine hanging below the hub
    - the deck plan is below
    - the Main Concourse corridor is highlighted in both
  - Add `?step=N` support to the preview (it jumps to route step N on load), then screenshot the steps for the Laundry, mid-ride, the Berths and `ship.41`.
  - Check:
    - the Laundry highlight is on the aft slice
    - mid-ride, the spoke leg is lit
    - at the Berths, the docks plan shows with the Berths box lit
    - at `ship.41`, the deck is dimmed, there's no highlight, and the info line reads `COCKPIT OF THE MAGPIE`
- [ ] **Step 3: Wrap and repeat checks** (Review Focus 5 and 4):
  - Preview steps Rim 11:00 → Concourse. The wheel turns one hour, not eleven.
  - Re-send the same location twice. Nothing re-animates (add a console counter of turns in `ModelView` under `?debug`).
- [ ] **Step 4:** Run `npm test`. Expect all vitest and Lua tests to PASS.
- [ ] **Step 5:** Run `npm run pack`. Then run `unzip -l empyreal-station-map-0.1.0.mallardx` and check it contains `plugin.toml`, `src/main.lua`, `src/station_map/location.lua`, `ui/map.html` and `ui/data/station.js`, and no `*.test.js` and no `dev/`.
- [ ] **Step 6: Dev install for the user.** Run `ln -s "$PWD" ~/.local/share/net.mallard.app/plugins-dev/broaty.empyreal-station-map`. Tell the user to reload plugins in Mallard and do the manual checks:
  - walk a ring
  - ride a lift
  - visit the docks
  - board the ship
  - close and reopen the panel mid-ride
- [ ] **Step 7:** Commit: `git add ui dev README.md package.json && git commit -m "feat: station map panel, preview harness and packaging"`
