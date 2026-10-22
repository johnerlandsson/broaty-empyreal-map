-- Location reducer: folds three GMCP packages (mudstd.room.info,
-- Empyreal.Room, Empyreal.Vehicle) into one small location message, with the
-- ship's hull and which of her rooms you're in when you're aboard one.
-- Pure and cheap; never errors on missing or odd-typed fields.
-- Uses no io/os/debug/coroutine (removed in Mallard's sandbox).

local L = {}

local function str(v)
  if type(v) == 'string' then return v end
  return nil
end

local function num(v)
  if type(v) == 'number' then return v end
  return nil
end

-- A two-element string array copy, or nil if `v` is not a usable table.
local function pair(v)
  if type(v) ~= 'table' then return nil end
  local a, b = str(v[1]), str(v[2])
  if not a and not b then return nil end
  return { a, b }
end

-- Deterministic serialiser (sorted keys) used for change detection.
local function serialise(v)
  local tv = type(v)
  if tv == 'table' then
    local keys = {}
    for k in pairs(v) do keys[#keys + 1] = k end
    table.sort(keys, function(x, y)
      local tx, ty = type(x), type(y)
      if tx ~= ty then return tx < ty end
      return x < y
    end)
    local out = {}
    for i, k in ipairs(keys) do
      out[i] = serialise(k) .. '=' .. serialise(v[k])
    end
    return '{' .. table.concat(out, ',') .. '}'
  elseif tv == 'string' then
    return string.format('%q', v)
  end
  return tostring(v)
end

function L.new()
  return {}
end

function L.message(state)
  local lift = nil
  if state.lift then
    lift = {
      id = state.lift.id,
      at = state.lift.at,
      between = state.lift.between and { state.lift.between[1], state.lift.between[2] } or nil,
      heading = state.lift.heading,
      doors = state.lift.doors,
    }
  end
  return {
    roomId = state.roomId,
    name = state.name,
    address = state.address,
    gravity = state.gravity,
    area = state.area,
    areaName = state.areaName,
    hull = state.hull,
    hullName = state.hullName,
    shipRoom = L.ship_room(state.roomId),
    lift = lift,
  }
end

-- Runs `fn`, returning true if the outgoing message changed because of it.
local function track(state, fn)
  local before = serialise(L.message(state))
  fn()
  return serialise(L.message(state)) ~= before
end

-- Which of a ship's rooms a room id is: the key at the end of `ship.<n>.<key>` ("hold"), or
-- nil for any other room, or a ship's cockpit as the game named it before 2026-10-22 (`ship.<n>`).
function L.ship_room(id)
  if type(id) ~= 'string' then return nil end
  return id:match('^ship%.[^.]+%.(.+)$')
end

function L.room_info(state, data)
  local id = type(data) == 'table' and str(data.id) or nil
  if not id then return false end
  return track(state, function()
    if state.roomId ~= id then
      -- Address and gravity belong to the previous room. So does the ship's hull, unless this
      -- is another room of the same ship: Empyreal.Room says so again just after, and clearing
      -- it in between would draw the generic ship for a moment.
      state.address = nil
      state.gravity = nil
      local area = str(data.area)
      if not (area and area == state.area and L.ship_room(id)) then
        state.hull = nil
        state.hullName = nil
      end
    end
    state.roomId = id
    state.name = str(data.name)
    state.area = str(data.area)
    state.areaName = str(data.areaName)
    state.lift = nil
  end)
end

function L.empyreal_room(state, data)
  if type(data) ~= 'table' then return false end
  local vehicle = type(data.vehicle) == 'table' and data.vehicle or nil
  -- Only a lift car is a lift; any other vehicle (a ship) is a plain room.
  if vehicle and vehicle.kind ~= nil and vehicle.kind ~= 'lift' then vehicle = nil end

  if data.part == 'lift' or vehicle then
    local id = str(data.id) or (vehicle and str(vehicle.id))
    if not id then return false end
    return track(state, function()
      vehicle = vehicle or {}
      state.lift = {
        id = id,
        at = str(vehicle.at),
        between = pair(vehicle.between),
        heading = str(vehicle.heading),
        doors = str(vehicle.doors),
      }
      state.roomId = nil
      state.area = nil
      state.areaName = nil
      state.hull = nil
      state.hullName = nil
      state.name = str(data.address)
      state.address = nil
      state.gravity = num(data.gravity)
    end)
  end

  local id = str(data.id)
  if not id then return false end
  return track(state, function()
    if state.roomId ~= id then
      state.name = nil
      state.area = nil
      state.areaName = nil
    end
    state.roomId = id
    state.address = str(data.address)
    state.gravity = num(data.gravity)
    -- Aboard a ship, `ship` says which: `class` is the hull's id ("skiff"), `kind` its name
    -- ("prospecting skiff").
    local ship = type(data.ship) == 'table' and data.ship or {}
    state.hull = str(ship.class)
    state.hullName = str(ship.kind)
    state.lift = nil
  end)
end

function L.vehicle(state, data)
  if type(data) ~= 'table' or not state.lift then return false end
  if str(data.id) ~= state.lift.id then return false end
  return track(state, function()
    state.lift.at = str(data.at)
    state.lift.between = pair(data.between)
    state.lift.heading = str(data.heading)
    state.lift.doors = str(data.doors)
  end)
end

function L.reset(state)
  return track(state, function()
    state.roomId = nil
    state.name = nil
    state.address = nil
    state.gravity = nil
    state.area = nil
    state.areaName = nil
    state.hull = nil
    state.hullName = nil
    state.lift = nil
  end)
end

return L
