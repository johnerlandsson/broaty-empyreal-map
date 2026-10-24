-- Belt reducer: folds Ship.Status `belt` (mining.md §2.3, gmcp.md §8.2: her place in the belt she's
-- at, km in the belt's own frame, and her distance and bearing from its core) and her location, the
-- belt's id, into where she is in it; and keeps, per belt, the player's own log of it: the track of
-- her places, a sweep where she was as each scan ran to its end (Ship.Devices), and where she left
-- her host (a skiff undocking from a ship at the belt starts where her host is). The game leaves
-- what's been worked to players ("players keep track of that themselves"); this is that, never game
-- data. main.lua keeps the logs in Mallard's storage; a belt's log goes once its system's charts
-- no longer list it (it's closed, and its id never comes back).
-- It also cues the top band: 'arrived' as she reaches a belt, 'moved' as a move in it starts (the
-- thrusters, or her place changing after a still spell, as `mine` closes on a rock).
-- Pure and cheap; never errors on missing or odd-typed fields.

local B = {}

B.MAX_POINTS = 600 -- a belt's track keeps its newest points
B.MAX_SWEEPS = 200
B.SENSOR_KM = 5 -- help mining: "sensor range (5 km; more with a sensor array)"
local STILL = 3 -- seconds: a place changing after this long still is a new move (a tick may stall)
local SLACK = 1 -- seconds: a re-send's now + left rounds a second either way
local BEND = 0.15 -- km: a point this near the line from the one before to the next is on it

local function str(v)
  if type(v) == 'string' then return v end
  return nil
end

local function num(v)
  if type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge then return v end
  return nil
end

local function tenth(n) return math.floor(n * 10 + 0.5) / 10 end

function B.new()
  return { logs = {}, belts = {}, names = {}, system = nil, on = false }
end

-- Ship.Status `belt` as { x, y, radius, km, bearing }, or nil for anything else.
local function place_of(b)
  if type(b) ~= 'table' then return nil end
  local x, y, radius = num(b.x), num(b.y), num(b.radius)
  if not x or not y or not radius or radius <= 0 then return nil end
  local km = num(b.core_km) or tenth(math.sqrt(x * x + y * y))
  local bearing = num(b.core_bearing) or (math.floor(math.deg(math.atan(x, y)) + 0.5) + 360) % 360
  return { x = x, y = y, radius = radius, km = km, bearing = bearing }
end

local function log_for(state, id)
  local log = state.logs[id]
  if not log then
    log = { track = {}, sweeps = {} }
    if state.belts[id] then log.system = state.system end
    state.logs[id] = log
  end
  return log
end

-- Whether b lies on the way from a to c: near the line, and between them.
local function on_line(a, b, c)
  local dx, dy = c[1] - a[1], c[2] - a[2]
  local len = math.sqrt(dx * dx + dy * dy)
  if len == 0 then return false end
  local off = math.abs((b[1] - a[1]) * dy - (b[2] - a[2]) * dx) / len
  local ahead = (b[1] - a[1]) * (c[1] - b[1]) + (b[2] - a[2]) * (c[2] - b[2])
  return off <= BEND and ahead >= 0
end

local function trim(track)
  local n = 0
  for _, seg in ipairs(track) do n = n + #seg end
  while n > B.MAX_POINTS and track[1] do
    table.remove(track[1], 1)
    n = n - 1
    if #track[1] == 0 then table.remove(track, 1) end
  end
end

-- Add her place to the log's track: a new stretch for a new visit, else onto the last, a straight
-- run kept as its two ends. True if the track changed.
local function add_point(log, x, y, fresh)
  local track = log.track
  if fresh or #track == 0 then
    if #track == 0 or #track[#track] > 0 then track[#track + 1] = {} end
  end
  local seg = track[#track]
  local last = seg[#seg]
  if last and last[1] == x and last[2] == y then return false end
  local p = { x, y }
  if #seg >= 2 and on_line(seg[#seg - 1], last, p) then
    seg[#seg] = p
  else
    seg[#seg + 1] = p
  end
  trim(track)
  return true
end

-- Fold Ship.Status at local time `now`; true if what the belt map draws changed.
function B.ship_status(state, data, now)
  now = num(now) or 0
  local before_id, before_place, before_host = state.id, state.place, state.host
  local logged = false
  if type(data) ~= 'table' then
    state.id, state.place, state.host, state.scan, state.nav, state.moved = nil, nil, nil, nil, nil, nil
    return before_id ~= nil or before_place ~= nil or before_host ~= nil
  end
  local host = type(data.host) == 'table' and data.host or nil
  local place = (not host) and place_of(data.belt) or nil
  local id = nil
  if place then
    id = str(data.location)
    if not id then place = nil end
  elseif host then
    local loc = str(host.location)
    if loc and state.belts[loc] and host.docked ~= true and not str(host.destination) then id = loc end
  end
  local host_name = host and (str(host.name) or 'host') or nil

  if id and id ~= before_id then
    state.cue = 'arrived'
    state.moved = nil
  end
  if place then
    local log = log_for(state, id)
    log.radius = place.radius
    log.name = state.names[id] or log.name
    -- just off her host, here at the belt: her first place is where the host was
    if before_host and before_id == id and not before_place then
      log.left = { x = place.x, y = place.y, name = before_host, at = now }
      logged = true
    end
    local fresh = before_place == nil or before_id ~= id
    if add_point(log, place.x, place.y, fresh) then logged = true end
    if not fresh and (place.x ~= before_place.x or place.y ~= before_place.y) then
      if not state.moved or now - state.moved > STILL then state.cue = 'moved' end
      state.moved = now
    end
  elseif id and host_name then
    local log = state.logs[id]
    if log and log.left and log.left.name == host_name then
      log.left = nil -- docked back at her: where she was left is where she is
      logged = true
    end
  end
  state.id, state.place, state.host = id, place, host_name
  if logged then state.unsaved = true end
  local moved = (place and before_place) and (place.x ~= before_place.x or place.y ~= before_place.y
    or place.km ~= before_place.km or place.bearing ~= before_place.bearing or place.radius ~= before_place.radius)
  return logged or id ~= before_id or host_name ~= before_host
    or (place == nil) ~= (before_place == nil) or moved == true
end

-- The first entry for each device, by id.
local function by_id(data)
  local out = {}
  if type(data) ~= 'table' or type(data.devices) ~= 'table' then return out end
  for _, d in ipairs(data.devices) do
    if type(d) == 'table' and type(d.id) == 'string' and out[d.id] == nil then out[d.id] = d end
  end
  return out
end

local function has_array(d)
  if type(d.attachments) ~= 'table' then return false end
  for _, a in ipairs(d.attachments) do
    if type(a) == 'table' and a.kind == 'sensor_array' then return true end
  end
  return false
end

-- Fold Ship.Devices at local time `now`: a scan run to its end logs a sweep where she is, and the
-- thrusters starting cue a move. True if what the belt map draws changed.
function B.ship_devices(state, data, now)
  now = num(now) or 0
  local devs = by_id(data)
  local changed = false
  local sensors, nav = devs.sensors, devs.nav
  local array = nil
  if sensors then array = has_array(sensors) end
  if array ~= state.array then
    state.array = array
    changed = state.id ~= nil -- drawn only at a belt
  end

  local scan = nil
  if sensors and sensors.busy == 'scan' then
    local left = num(sensors.left)
    scan = { ends = left and now + math.max(0, left) or nil }
  end
  local prev = state.scan
  if prev and prev.ends then
    local again = scan and scan.ends and scan.ends <= prev.ends + SLACK
    if again then
      scan.ends = prev.ends
    elseif now >= prev.ends - SLACK and state.id and state.place then
      local log = log_for(state, state.id)
      local p = state.place
      log.sweeps[#log.sweeps + 1] = { x = p.x, y = p.y, r = state.array == false and B.SENSOR_KM or nil }
      while #log.sweeps > B.MAX_SWEEPS do table.remove(log.sweeps, 1) end
      state.unsaved = true
      changed = true
    end
  end
  state.scan = scan

  local rcs = nav and nav.busy == 'rcs' or false
  if rcs and not state.nav and state.id and state.place then
    state.cue = 'moved'
    state.moved = now
  end
  state.nav = rcs or nil
  return changed
end

-- Fold Space.Charts: the belts in this system, by id, with their names; a log whose belt its own
-- system's charts no longer list is gone. True if the belt map's message changed: the name of the
-- belt she's at, or its log gone.
function B.space_charts(state, data)
  if type(data) ~= 'table' then return false end
  local system = str(data.system)
  local belts, names = {}, {}
  if type(data.places) == 'table' then
    for _, p in ipairs(data.places) do
      local id = type(p) == 'table' and p.kind == 'belt' and str(p.id)
      if id then
        belts[id] = true
        names[id] = str(p.name)
      end
    end
  end
  local here = state.id
  local changed = here ~= nil and names[here] ~= nil and names[here] ~= state.names[here]
  state.system, state.belts = system, belts
  for id, name in pairs(names) do state.names[id] = name end
  for id, log in pairs(state.logs) do
    if belts[id] then
      if log.system ~= system then
        log.system = system
        state.unsaved = true
      end
      if names[id] and log.name ~= names[id] then
        log.name = names[id]
        state.unsaved = true
      end
    elseif system and log.system == system then
      state.logs[id] = nil
      state.unsaved = true
      if id == here then changed = true end
    end
  end
  return changed
end

-- 'arrived' or 'moved' if the band should switch to the belt map since last asked, else nil.
function B.take_cue(state)
  local cue = state.cue
  state.cue = nil
  return cue
end

-- True once if the logs changed since last asked: main.lua stores them then.
function B.take_unsaved(state)
  local u = state.unsaved == true
  state.unsaved = nil
  return u
end

-- Stored logs back in (`storage.get`), keeping only well-formed parts.
function B.load(state, saved)
  if type(saved) ~= 'table' then return end
  for id, log in pairs(saved) do
    if type(id) == 'string' and type(log) == 'table' then
      local track, sweeps = {}, {}
      if type(log.track) == 'table' then
        for _, seg in ipairs(log.track) do
          if type(seg) == 'table' then
            local out = {}
            for _, p in ipairs(seg) do
              if type(p) == 'table' and num(p[1]) and num(p[2]) then out[#out + 1] = { p[1], p[2] } end
            end
            if #out > 0 then track[#track + 1] = out end
          end
        end
      end
      if type(log.sweeps) == 'table' then
        for _, s in ipairs(log.sweeps) do
          if type(s) == 'table' and num(s.x) and num(s.y) then
            sweeps[#sweeps + 1] = { x = s.x, y = s.y, r = num(s.r) }
          end
        end
      end
      local left = nil
      local l = log.left
      if type(l) == 'table' and num(l.x) and num(l.y) and str(l.name) then
        left = { x = l.x, y = l.y, name = l.name, at = num(l.at) }
      end
      state.logs[id] = { system = str(log.system), name = str(log.name), radius = num(log.radius),
        track = track, sweeps = sweeps, left = left }
    end
  end
end

-- The logs, for main.lua to store.
function B.saved(state) return state.logs end

-- A disconnect: she's nowhere; the logs stay.
function B.reset(state)
  local changed = state.id ~= nil or state.place ~= nil or state.host ~= nil
  state.id, state.place, state.host, state.scan, state.nav, state.moved, state.cue = nil, nil, nil, nil, nil, nil, nil
  state.system, state.belts = nil, {}
  return changed
end

function B.set_on(state, on)
  on = on == true
  if state.on == on then return false end
  state.on = on
  return true
end

function B.on(state) return state.on end

-- What the belt map draws: the belt she's at (or her host is), her place in it, the host she's
-- docked at, whether a sensor array is fitted (nil: not known), and the belt's log.
function B.message(state)
  local id = state.id
  local log = id and state.logs[id] or nil
  local p = state.place
  return {
    id = id,
    name = id and (state.names[id] or (log and log.name)) or nil,
    radius = p and p.radius or (log and log.radius) or nil,
    place = p and { x = p.x, y = p.y, km = p.km, bearing = p.bearing } or nil,
    host = state.host,
    array = state.array,
    log = log and { track = log.track, sweeps = log.sweeps, left = log.left } or { track = {}, sweeps = {} },
  }
end

return B
