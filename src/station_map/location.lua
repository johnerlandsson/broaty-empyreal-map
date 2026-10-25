-- Location reducer: folds three GMCP packages (mudstd.room.info,
-- Empyreal.Room, Empyreal.Vehicle) into one small location message, with the
-- room's district (a town's skyline follows it), the ship's hull and which of
-- her rooms you're in when you're aboard one, the door you came in by when
-- you're in your workshop or bunk, and the car you're riding (a lift or the
-- tram): its kind, its stops and where it is.
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

-- A car's stops, bottom to top, as `{ id, name }` (name only where the game knows it); nil if
-- `v` isn't a list.
local function floors(v)
  if type(v) ~= 'table' then return nil end
  local out = {}
  for _, f in ipairs(v) do
    local id = type(f) == 'table' and str(f.id) or nil
    if id then out[#out + 1] = { id = id, name = str(f.name) } end
  end
  return out
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
    local stops = nil
    if state.lift.floors then
      stops = {}
      for i, f in ipairs(state.lift.floors) do stops[i] = { id = f.id, name = f.name } end
    end
    lift = {
      id = state.lift.id,
      kind = state.lift.kind,
      floors = stops,
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
    district = state.district,
    gravity = state.gravity,
    area = state.area,
    areaName = state.areaName,
    hull = state.hull,
    hullName = state.hullName,
    shipRoom = L.ship_room(state.roomId),
    door = state.door,
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

-- The room a workshop (`unit.<n>`) or bunk (`bunk.<n>`) opens onto: its one exit, `out`, from
-- mudstd.room.info's `exits` (`OUT = { id = ... }`). The game builds these rooms itself, with no
-- address, and they belong to their station as their door does. Nil for any other room or shape.
function L.door(id, exits)
  if type(id) ~= 'string' or not (id:match('^unit%.[^.]+$') or id:match('^bunk%.[^.]+$')) then return nil end
  local out = type(exits) == 'table' and exits.OUT or nil
  local door = type(out) == 'table' and str(out.id) or nil
  if door == '' then return nil end
  return door
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
      state.district = nil
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
    state.door = L.door(id, data.exits)
    state.lift = nil
  end)
end

function L.empyreal_room(state, data)
  if type(data) ~= 'table' then return false end
  local vehicle = type(data.vehicle) == 'table' and data.vehicle or nil
  -- A lift car or the tram is a car; any other vehicle is a plain room.
  if vehicle and vehicle.kind ~= nil and vehicle.kind ~= 'lift' and vehicle.kind ~= 'tram' then vehicle = nil end

  if data.part == 'lift' or vehicle then
    local id = str(data.id) or (vehicle and str(vehicle.id))
    if not id then return false end
    return track(state, function()
      vehicle = vehicle or {}
      state.lift = {
        id = id,
        kind = str(vehicle.kind) or 'lift',
        floors = floors(vehicle.floors),
        at = str(vehicle.at),
        between = pair(vehicle.between),
        heading = str(vehicle.heading),
        doors = str(vehicle.doors),
      }
      state.roomId = nil
      state.area = nil
      state.areaName = nil
      state.door = nil
      state.hull = nil
      state.hullName = nil
      state.name = str(data.address)
      state.address = nil
      state.district = nil
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
      state.door = nil
    end
    state.roomId = id
    state.address = str(data.address)
    state.district = str(data.district)
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
    state.district = nil
    state.gravity = nil
    state.area = nil
    state.areaName = nil
    state.hull = nil
    state.hullName = nil
    state.door = nil
    state.lift = nil
  end)
end

return L
