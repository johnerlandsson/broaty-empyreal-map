-- Empyreal map (T.I.S.S. so far): folds GMCP location frames into one small message
-- and pushes it to the "map" panel, and your ship's frames into the overview's scene. All state lives here; the panel is a
-- pure presentation layer that asks for a replay with "ready".
--
-- Mallard's require has no cache, so each module is required exactly once.

local L = require('station_map.location')
local S = require('station_map.scene')

local panel = mud.panel('map')
local state = L.new()
local scene = S.new()

local function has_location(s)
  local m = L.message(s)
  return m.roomId ~= nil or m.lift ~= nil
end

local function post_location()
  panel:post('location', L.message(state))
end

local function post_scene()
  panel:post('scene', { scene = S.scene(scene) })
end

local function post_settings()
  panel:post('settings', { turn_model = settings.get('turn_model') ~= false })
end

-- gmcp.on matches by prefix and case-insensitively, and passes the server's
-- original casing: key the reducers by lowercase name and dispatch on the
-- exact (lowercased) package, so sub-packages never reach a reducer.
local reducers = {
  ['mudstd.room.info'] = L.room_info,
  ['empyreal.room'] = L.empyreal_room,
  ['empyreal.vehicle'] = L.vehicle,
}

local scene_reducers = {
  ['ship.status'] = S.ship_status,
  ['space.charts'] = S.space_charts,
}

local function on_gmcp(package, data)
  local name = string.lower(tostring(package))
  local reduce = reducers[name]
  if reduce then
    if reduce(state, data) then post_location() end
    return
  end
  reduce = scene_reducers[name]
  if reduce then
    if reduce(scene, data) then post_scene() end
    return
  end
  log.debug('empyreal map: ignoring GMCP package ' .. tostring(package))
end

-- Subscribe with the names Mallard advertises (original casing).
for _, prefix in ipairs({ 'mudstd.room.info', 'Empyreal.Room', 'Empyreal.Vehicle', 'Ship.Status', 'Space.Charts' }) do
  gmcp.on(prefix, on_gmcp)
end

world.on('disconnect', function()
  L.reset(state)
  post_location()
  if S.reset(scene) then post_scene() end
end)

panel:on_message('ready', function()
  post_settings()
  if has_location(state) then post_location() end
  -- The panel starts on the station, so only another scene needs replaying.
  if S.scene(scene) ~= 'station' then post_scene() end
end)

settings.on('change', function(key)
  if key == 'turn_model' then post_settings() end
end)
