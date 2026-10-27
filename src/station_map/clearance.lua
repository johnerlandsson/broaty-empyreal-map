-- Clearance reducer: folds Ship.Devices and Ship.Status into whether she's waiting on Control's
-- clearance, for the plan's card. `dock` and `undock` (and land or lift at a port, the same verbs)
-- call on the system's traffic and wait for the answer (Empyreal 96249e1, channels.md decision 39):
-- a controller two to four seconds on, the automated voice one, longer behind other ships' calls.
-- Waiting, the nav is busy 'dock' or 'undock' with no end, `left` null (space.ts awaitingClearance);
-- cleared, Ship.Devices comes again with `left` and the run is manoeuvre.lua's. The game sends no
-- countdown for the wait. Where she waits is her status's ("awaiting clearance at T.I.S.S.", a
-- port's or a ship's name likewise), which Ship.Status brings just before Ship.Devices
-- (gmcp.ts sendShipGmcp); it's kept till the wait ends, and only names the place: whether she
-- waits is Ship.Devices' alone.
-- Pure and cheap; never errors on missing or odd-typed fields.

local Q = {}

local VERBS = { dock = true, undock = true }

function Q.new()
  return {}
end

-- The nav's verb, if it's docking or undocking with no end yet: `left` null (nil, or Mallard's
-- null sentinel), anything but a number, as work.lua has it.
local function waiting_of(data)
  if type(data) ~= 'table' or type(data.devices) ~= 'table' then return nil end
  for _, d in ipairs(data.devices) do
    if type(d) == 'table' and d.id == 'nav' then
      if VERBS[d.busy] and type(d.left) ~= 'number' then return d.busy end
      return nil
    end
  end
  return nil
end

-- Folds a Ship.Devices frame in; true if the wait began, ended or changed verb.
function Q.ship_devices(state, data)
  local verb = waiting_of(data)
  if verb == state.verb then return false end
  state.verb = verb
  if not verb then state.at = nil end
  return true
end

-- Folds a Ship.Status frame in; true if the place she waits at changed. Off her (null) the wait
-- goes too: Ship.Devices isn't sent again.
function Q.ship_status(state, data)
  if type(data) ~= 'table' then return Q.reset(state) end
  local at = type(data.status) == 'string' and data.status:match('^awaiting clearance at (.+)$') or nil
  if not at then
    if not state.verb then state.at = nil end -- a status from before a wait names nothing
    return false
  end
  local changed = state.verb ~= nil and at ~= state.at
  state.at = at
  return changed
end

-- What the panel is posted: the verb waiting and where, as her status names it; { verb = nil }
-- when she isn't.
function Q.message(state)
  if not state.verb then return { verb = nil } end
  return { verb = state.verb, at = state.at }
end

function Q.reset(state)
  local had = state.verb ~= nil
  state.verb, state.at = nil, nil
  return had
end

return Q
