-- Scene reducer: folds Ship.Status and Space.Charts into which picture the
-- overview shows: 'station', 'parked', 'travelling' or 'belt'.
-- Ship.Status only comes for a ship of your own you're aboard (null off
-- her), so aboard anyone else's ship this stays 'station'.
-- Pure and cheap; never errors on missing or odd-typed fields.

local S = {}

local function str(v)
  if type(v) == 'string' then return v end
  return nil
end

function S.new()
  return { belts = {} }
end

function S.scene(state)
  local ship = state.ship
  if not ship or ship.docked then return 'station' end
  if ship.destination then return 'travelling' end
  if ship.location and state.belts[ship.location] then return 'belt' end
  return 'parked'
end

-- Runs `fn`, returning true if the scene changed because of it.
local function track(state, fn)
  local before = S.scene(state)
  fn()
  return S.scene(state) ~= before
end

function S.ship_status(state, data)
  return track(state, function()
    if type(data) ~= 'table' then
      state.ship = nil
      return
    end
    state.ship = {
      docked = data.docked == true,
      location = str(data.location),
      destination = str(data.destination),
    }
  end)
end

function S.space_charts(state, data)
  if type(data) ~= 'table' or type(data.places) ~= 'table' then return false end
  return track(state, function()
    local belts = {}
    for _, p in ipairs(data.places) do
      if type(p) == 'table' and p.kind == 'belt' and str(p.id) then belts[p.id] = true end
    end
    state.belts = belts
  end)
end

function S.reset(state)
  return track(state, function()
    state.ship = nil
    state.belts = {}
  end)
end

return S
