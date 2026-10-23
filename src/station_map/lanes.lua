-- Lanes reducer: folds Space.Charts and Ship.Status into what the core lanes map draws from: the
-- system you're in, the lanes whose mouths are in it (`visible`), each lane's open or closed state
-- as you last saw it (`seen`, kept by main.lua in Mallard's storage), and the lane she's in while
-- she's in one (`transit`). A lane's state is only ever what a mouth here says (Space.Charts'
-- `open`); nothing here guesses when a branch will open.
-- Pure and cheap; never errors on missing or odd-typed fields.

local N = {}

local function str(v)
  if type(v) == 'string' then return v end
  return nil
end

local function num(v)
  if type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge then return v end
  return nil
end

function N.new()
  return { system = nil, visible = {}, seen = {}, transit = nil, left = nil, on = false }
end

-- A mouth's lane, from its id (`mouth:senara:maelor`, Senara's mouth facing Maelor): the lane's
-- id is its two stars sorted, as galaxy.yaml names lanes ("maelor-senara"). Nil for anything else.
function N.lane_of(id)
  if type(id) ~= 'string' then return nil end
  local here, there = id:match('^mouth:([%w_]+):([%w_]+)$')
  if not here then return nil end
  local a, b = here, there
  if b < a then a, b = b, a end
  return { id = a .. '-' .. b, here = here, there = there }
end

-- The lanes seen now are seen until `now`: what you saw of them is as of then.
local function stamp(state, now)
  for _, id in ipairs(state.visible) do
    local s = state.seen[id]
    if s then s.at = now end
  end
end

function N.space_charts(state, data, now)
  if type(data) ~= 'table' then return false end
  now = num(now) or 0
  local system = str(data.system)
  local changed = system ~= state.system
  if changed then stamp(state, now) end
  state.system = system
  local visible = {}
  if type(data.places) == 'table' then
    for _, p in ipairs(data.places) do
      local lane = type(p) == 'table' and p.kind == 'mouth' and N.lane_of(p.id)
      if lane then
        visible[#visible + 1] = lane.id
        if type(p.open) == 'boolean' then
          local old = state.seen[lane.id]
          if not old or old.open ~= p.open then changed = true end
          state.seen[lane.id] = { open = p.open, at = now }
        end
      end
    end
  end
  table.sort(visible)
  if table.concat(visible, ',') ~= table.concat(state.visible, ',') then changed = true end
  state.visible = visible
  return changed
end

local function same_transit(a, b)
  if a == nil or b == nil then return a == b end
  for _, k in ipairs({ 'lane', 'from', 'to', 'progress', 'eta', 'received' }) do
    if a[k] ~= b[k] then return false end
  end
  return true
end

-- In a lane, her destination is the far mouth, in another system. The game's status says so
-- ("in the Maelor lane 40%"); a host's whereabouts carry no status, so failing that, she's in it
-- if she left from the mouth facing it, or was already in it on this trip.
function N.ship_status(state, data, now)
  local before = state.transit
  if type(data) ~= 'table' then
    state.transit, state.left = nil, nil
    return before ~= nil
  end
  local host = type(data.host) == 'table' and data.host or nil
  local at = host or data
  local dest, loc = str(at.destination), str(at.location)
  local status = (not host) and str(data.status) or nil
  local transit = nil
  local lane = N.lane_of(dest)
  if lane then
    local by_status = status and status:match('^in the .+ lane') ~= nil
    local by_mouth = state.left == ('mouth:' .. lane.there .. ':' .. lane.here)
    local same = before and before.lane == lane.id and before.to == lane.here
    if by_status or by_mouth or same then
      transit = { lane = lane.id, from = lane.there, to = lane.here,
        progress = num(at.progress), eta = num(at.eta), received = num(now) or 0 }
    end
  end
  if loc then
    state.left = loc
  elseif not dest then
    state.left = nil
  end
  state.transit = transit
  return not same_transit(before, transit)
end

-- Stored sightings back in (`storage.get`), keeping only well-formed ones.
function N.load(state, saved)
  if type(saved) ~= 'table' then return end
  for id, s in pairs(saved) do
    if type(id) == 'string' and type(s) == 'table' and type(s.open) == 'boolean' and num(s.at) then
      state.seen[id] = { open = s.open, at = s.at }
    end
  end
end

-- The sightings, for main.lua to store.
function N.saved(state) return state.seen end

-- A disconnect: you're nowhere, so what you could see is as of now; the sightings stay.
function N.reset(state, now)
  local changed = state.system ~= nil or state.transit ~= nil or #state.visible > 0
  stamp(state, num(now) or 0)
  state.system, state.visible, state.transit, state.left = nil, {}, nil, nil
  return changed
end

function N.set_on(state, on)
  on = on == true
  if state.on == on then return false end
  state.on = on
  return true
end

function N.on(state) return state.on end

function N.message(state)
  return { system = state.system, visible = state.visible, seen = state.seen, transit = state.transit }
end

return N
