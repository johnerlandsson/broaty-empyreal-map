-- Manoeuvre reducer: folds Ship.Devices into what the overview needs to time a dock or an undock
-- on the game's own clock: the nav device's busy verb while it's `dock` or `undock`, when it
-- ends and when it started, both local timestamps (whole seconds), and the station it's about.
-- Ship.Devices gives each device `left`, the seconds to its activity's end, and is re-sent only
-- when that end changes (gmcp.ts sendShipGmcp), so the end is fixed on arrival as now + left.
-- The game sends no length, so a run first seen with less than its par left (dock 20 s, undock
-- 10 s, content/game/actions.yaml) started that much before; one with more (a failed undock
-- check adds 5 s) started now.
-- Pure and cheap; never errors on missing or odd-typed fields.

local M = {}

local PAR = { dock = 20, undock = 10 }
local SLACK = 1 -- s: a resend whose end is within this of the last is the same end, not a new one

local function finite(v)
  return type(v) == 'number' and v == v and v > -math.huge and v < math.huge
end

function M.new()
  return {}
end

-- The nav's verb and seconds left, if it's docking or undocking with a known end.
local function run_of(data)
  if type(data) ~= 'table' or type(data.devices) ~= 'table' then return nil end
  for _, d in ipairs(data.devices) do
    if type(d) == 'table' and d.id == 'nav' then
      if PAR[d.busy] and finite(d.left) and d.left >= 0 then return d.busy, d.left end
      return nil
    end
  end
  return nil
end

local function place(at_of, verb)
  if type(at_of) ~= 'function' then return nil end
  local ok, at = pcall(at_of, verb)
  if ok and type(at) == 'string' then return at end
  return nil
end

-- Folds a Ship.Devices frame in at `now` (os.time()); `at_of(verb)` names the station a run
-- starting now is about, as the scene has it (scene.lua S.manoeuvre_at), or nil. True if the
-- verb, its end or its start changed.
function M.ship_devices(state, data, now, at_of)
  now = finite(now) and now or 0
  local verb, left = run_of(data)
  if not verb then return M.reset(state) end
  local ends = now + left
  if verb == state.verb then
    if math.abs(ends - state.ends) <= SLACK then return false end
    state.ends = ends
    if state.starts > ends then state.starts = ends end
    return true
  end
  state.verb = verb
  state.ends = ends
  state.starts = ends - math.max(PAR[verb], left)
  state.at = place(at_of, verb)
  return true
end

-- What the panel is posted: the verb, the seconds left of it at `now`, its whole length, and the
-- station it's about; { verb = nil } when there's none.
function M.message(state, now)
  if not state.verb then return { verb = nil } end
  now = finite(now) and now or 0
  return {
    verb = state.verb,
    left = math.max(0, state.ends - now),
    total = state.ends - state.starts,
    at = state.at,
  }
end

function M.reset(state)
  local had = state.verb ~= nil
  state.verb, state.ends, state.starts, state.at = nil, nil, nil, nil
  return had
end

return M
