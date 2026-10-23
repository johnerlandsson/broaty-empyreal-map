-- Empyreal map (T.I.S.S., Orrin Station and Wenna Halt so far): folds GMCP location frames into one small message
-- and pushes it to the "map" panel, and your ship's frames into the overview's scene. All state lives here; the panel is a
-- pure presentation layer that asks for a replay with "ready".
--
-- Mallard's require has no cache, so each module is required exactly once.

local L = require('station_map.location')
local S = require('station_map.scene')
local C = require('station_map.charts')

local panel = mud.panel('map')
local state = L.new()
local scene = S.new()
local chart = C.new()

local function has_location(s)
  local m = L.message(s)
  return m.roomId ~= nil or m.lift ~= nil
end

local function post_location()
  panel:post('location', L.message(state))
end

local function post_scene()
  panel:post('scene', { scene = S.scene(scene), station = S.station(scene), port = S.port(scene) })
end

local function post_charts()
  panel:post('charts', C.charts(chart))
end

local function post_chart_ship()
  panel:post('chart-ship', C.ship(chart))
end

local function post_chart_on()
  panel:post('chart', { on = C.on(chart) })
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

-- Each of these folds into the scene first, then the chart.
local function scene_ship(data)
  if S.ship_status(scene, data) then post_scene() end
  C.ship_status(chart, data, os.time())
  -- Always: the panel times a trip from the fresh `received`.
  post_chart_ship()
end

local function scene_charts(data)
  if S.space_charts(scene, data) then post_scene() end
  if C.space_charts(chart, data) then post_charts() end
end

local scene_reducers = {
  ['ship.status'] = scene_ship,
  ['space.charts'] = scene_charts,
}

local function on_gmcp(package, data)
  local name = string.lower(tostring(package))
  local reduce = reducers[name]
  if reduce then
    if reduce(state, data) then post_location() end
    return
  end
  local both = scene_reducers[name]
  if both then
    both(data)
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
  -- The chart stays on: the panel hides it, and its ◎, with no charts.
  if C.reset(chart) then
    post_charts()
    post_chart_ship()
  end
end)

panel:on_message('ready', function()
  post_settings()
  if has_location(state) then post_location() end
  -- The panel starts on the station with none docked at, so only anything else needs replaying.
  if S.scene(scene) ~= 'station' or S.station(scene) then post_scene() end
  if C.charts(chart) then post_charts() end
  if C.ship(chart) then post_chart_ship() end
  if C.on(chart) then post_chart_on() end
end)

panel:on_message('chart', function(data)
  if type(data) ~= 'table' or type(data.on) ~= 'boolean' then return end
  if C.set_on(chart, data.on) then post_chart_on() end
end)

settings.on('change', function(key)
  if key == 'turn_model' then post_settings() end
end)
