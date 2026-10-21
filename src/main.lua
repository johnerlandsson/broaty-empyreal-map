-- Empyreal map (T.I.S.S. so far): folds GMCP location frames into one small message
-- and pushes it to the "map" panel. All state lives here; the panel is a
-- pure presentation layer that asks for a replay with "ready".
--
-- Mallard's require has no cache, so each module is required exactly once.

local L = require('station_map.location')

local panel = mud.panel('map')
local state = L.new()

local function has_location(s)
  local m = L.message(s)
  return m.roomId ~= nil or m.lift ~= nil
end

local function post_location()
  panel:post('location', L.message(state))
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

local function on_gmcp(package, data)
  local reduce = reducers[string.lower(tostring(package))]
  if not reduce then
    log.debug('empyreal map: ignoring GMCP package ' .. tostring(package))
    return
  end
  if reduce(state, data) then post_location() end
end

-- Subscribe with the names Mallard advertises (original casing).
for _, prefix in ipairs({ 'mudstd.room.info', 'Empyreal.Room', 'Empyreal.Vehicle' }) do
  gmcp.on(prefix, on_gmcp)
end

world.on('disconnect', function()
  L.reset(state)
  post_location()
end)

panel:on_message('ready', function()
  post_settings()
  if has_location(state) then post_location() end
end)

settings.on('change', function(key)
  if key == 'turn_model' then post_settings() end
end)
