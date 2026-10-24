-- Work reducer: folds Ship.Devices into what the ship's sensors and laser are
-- doing, for the belt scene: each one's `busy` verb ('scan', 'assay', 'mine',
-- or anything else the game names), when it began and when it ends, both as
-- local times (os.time() seconds). The game gives each device `left`, the
-- seconds to its activity's end, and re-sends it only as that end changes, so
-- the end is now + left; `mine` has no end (left null): it cuts until something
-- stops it. A program's work is the device's, so it folds the same as yours.
--
-- Moving in the belt (mining.md §2.3 in ~/dev/empyreal): nav busy 'rcs' is the thrusters under
-- way, with its `left`, and is all of nav kept (dock and undock are manoeuvre.lua's). Closing on a
-- rock has no verb of its own: the laser is busy 'mine' all the way there, and only Ship.Status's
-- `belt` x/y changing says she's moving. So Ship.Status folds in too: when the place last changed
-- (local time) and the way she went, in degrees clockwise from straight out from the core where
-- she was (0 out, 180 in, 90 round the core clockwise), from her last two places. Her laser target
-- comes along for the card's "closing on rock-12". The game rounds the place to a tenth of a km.
-- Pure and cheap; never errors on missing or odd-typed fields.

local W = {}

local DEVICES = { 'sensors', 'laser', 'nav' }
local KEEP = { nav = { rcs = true } } -- of nav, only the thrusters; any verb of the others
local SLACK = 1 -- seconds: a re-send's now + left rounds a second either way
local CORE = 0.5 -- km: nearer the core than this there's no straight out (rcs.ts)

function W.new()
  return {}
end

local function seconds(v)
  if type(v) ~= 'number' or v ~= v or v == math.huge or v == -math.huge then return nil end
  return math.max(0, v)
end

-- The first entry for each device we draw, by id.
local function by_id(data)
  local out = {}
  if type(data) ~= 'table' or type(data.devices) ~= 'table' then return out end
  for _, d in ipairs(data.devices) do
    if type(d) == 'table' and type(d.id) == 'string' and out[d.id] == nil then out[d.id] = d end
  end
  return out
end

local function fold(id, prev, d, now)
  if not d or type(d.busy) ~= 'string' then return nil end
  if KEEP[id] and not KEEP[id][d.busy] then return nil end
  local left = seconds(d.left)
  local ends = left and now + left or nil
  local again = prev and prev.busy == d.busy
    and not (prev.ends and now >= prev.ends and ends and ends > prev.ends + SLACK) -- the last one ended: a new one
  if again and ends and prev.ends and math.abs(ends - prev.ends) <= SLACK then ends = prev.ends end
  return { busy = d.busy, since = again and prev.since or now, ends = ends }
end

local function same(a, b)
  if a == nil or b == nil then return a == b end
  return a.busy == b.busy and a.since == b.since and a.ends == b.ends
end

-- Fold a Ship.Devices frame at local time `now`; true if anything drawn changed.
function W.ship_devices(state, data, now)
  local devs = by_id(data)
  local changed = false
  for _, id in ipairs(DEVICES) do
    local next = fold(id, state[id], devs[id], now)
    if not same(state[id], next) then changed = true end
    state[id] = next
  end
  return changed
end

local function finite(v)
  return type(v) == 'number' and v == v and v > -math.huge and v < math.huge
end

-- Degrees in (-180, 180].
local function wrap(a)
  a = a % 360
  if a > 180 then a = a - 360 end
  return a
end

-- The way from (px, py) to (x, y) against straight out from the core at (px, py), or `last` at
-- the core, where there's no out.
local function way_of(px, py, x, y, last)
  if math.sqrt(px * px + py * py) < CORE then return last end
  local heading = math.deg(math.atan(x - px, y - py))
  local out = math.deg(math.atan(px, py))
  return math.floor(wrap(heading - out) + 0.5)
end

-- Fold a Ship.Status frame at local time `now`; true if anything drawn changed.
function W.ship_status(state, data, now)
  local b = type(data) == 'table' and data.belt or nil
  local laser = type(data) == 'table' and type(data.laser) == 'table' and data.laser or {}
  local target = type(laser.target) == 'string' and laser.target or nil
  if type(b) ~= 'table' or not finite(b.x) or not finite(b.y) then
    local had = state.place ~= nil
    state.place = nil
    return had
  end
  local p = state.place
  if p == nil then
    state.place = { x = b.x, y = b.y, target = target }
    return true
  end
  local changed = p.target ~= target
  p.target = target
  if b.x ~= p.x or b.y ~= p.y then
    p.way = way_of(p.x, p.y, b.x, b.y, p.way)
    p.x, p.y, p.moved = b.x, b.y, now
    changed = true
  end
  return changed
end

-- { sensors = { busy, since, ends }, laser = { busy, since }, nav = { busy, since, ends },
-- belt = { moved, way, target } }, each device only while busy and the belt only in one; a copy.
function W.message(state)
  local out = {}
  for _, id in ipairs(DEVICES) do
    local a = state[id]
    if a then out[id] = { busy = a.busy, since = a.since, ends = a.ends } end
  end
  local p = state.place
  if p then out.belt = { moved = p.moved, way = p.way, target = p.target } end
  return out
end

function W.reset(state)
  local any = next(state) ~= nil
  for _, id in ipairs(DEVICES) do state[id] = nil end
  state.place = nil
  return any
end

return W
