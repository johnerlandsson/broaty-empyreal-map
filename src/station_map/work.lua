-- Work reducer: folds Ship.Devices into what the ship's sensors and laser are
-- doing, for the belt scene: each one's `busy` verb ('scan', 'assay', 'mine',
-- or anything else the game names), when it began and when it ends, both as
-- local times (os.time() seconds). The game gives each device `left`, the
-- seconds to its activity's end, and re-sends it only as that end changes, so
-- the end is now + left; `mine` has no end (left null): it cuts until something
-- stops it. A program's work is the device's, so it folds the same as yours.
-- Pure and cheap; never errors on missing or odd-typed fields.

local W = {}

local DEVICES = { 'sensors', 'laser' }
local SLACK = 1 -- seconds: a re-send's now + left rounds a second either way

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

local function fold(prev, d, now)
  if not d or type(d.busy) ~= 'string' then return nil end
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
    local next = fold(state[id], devs[id], now)
    if not same(state[id], next) then changed = true end
    state[id] = next
  end
  return changed
end

-- { sensors = { busy, since, ends }, laser = { busy, since } }, each only while busy; a copy.
function W.message(state)
  local out = {}
  for _, id in ipairs(DEVICES) do
    local a = state[id]
    if a then out[id] = { busy = a.busy, since = a.since, ends = a.ends } end
  end
  return out
end

function W.reset(state)
  local any = next(state) ~= nil
  for _, id in ipairs(DEVICES) do state[id] = nil end
  return any
end

return W
