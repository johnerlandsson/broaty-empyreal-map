-- Empyreal map (T.I.S.S., Orrin Station and Wenna Halt so far): folds GMCP location frames into one small message
-- and pushes it to the "map" panel, and your ship's frames into the overview's scene, its docking and
-- undocking (timed by Ship.Devices), the system chart, the
-- core lanes map and what her sensors and laser are doing. The lanes' states as last seen are kept in Mallard's storage, so they outlive a restart. All state lives here; the panel is a
-- pure presentation layer that asks for a replay with "ready".
--
-- Mallard's require has no cache, so each module is required exactly once.

local L = require('station_map.location')
local S = require('station_map.scene')
local C = require('station_map.charts')
local N = require('station_map.lanes')
local W = require('station_map.work')
local M = require('station_map.manoeuvre')

local panel = mud.panel('map')
local state = L.new()
local scene = S.new()
local chart = C.new()
local lanes = N.new()
local work = W.new()
local manoeuvre = M.new()

-- storage is per plugin and world; a bad stored value (or none) is no sightings
if storage then
  local ok, saved = pcall(storage.get, 'lanes')
  if ok then N.load(lanes, saved) end
end

local function save_lanes()
  if storage then pcall(storage.set, 'lanes', N.saved(lanes)) end
end

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

local function post_manoeuvre()
  panel:post('manoeuvre', M.message(manoeuvre, os.time()))
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

local function post_lanes()
  panel:post('lanes', N.message(lanes))
end

local function post_lanes_on()
  panel:post('lanes-view', { on = N.on(lanes) })
end

local function post_work()
  panel:post('work', W.message(work))
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

-- Each of these folds into the scene first, then the chart, then the lanes.
local function scene_ship(data)
  if S.ship_status(scene, data) then post_scene() end
  -- Off her, Ship.Devices isn't sent again (gmcp.ts sendShipGmcp): what she was doing goes too.
  if type(data) ~= 'table' and M.reset(manoeuvre) then post_manoeuvre() end
  C.ship_status(chart, data, os.time())
  -- Always: the panel times a trip from the fresh `received`.
  post_chart_ship()
  if N.ship_status(lanes, data, os.time()) then post_lanes() end
end

local function scene_charts(data)
  if S.space_charts(scene, data) then post_scene() end
  if C.space_charts(chart, data) then post_charts() end
  if N.space_charts(lanes, data, os.time()) then post_lanes() end
  save_lanes() -- every time: a lane seen now was seen until now
end

local function ship_devices(data)
  if W.ship_devices(work, data, os.time()) then post_work() end
  local at = function(verb) return S.manoeuvre_at(scene, verb) end
  if M.ship_devices(manoeuvre, data, os.time(), at) then post_manoeuvre() end
end

local scene_reducers = {
  ['ship.status'] = scene_ship,
  ['ship.devices'] = ship_devices,
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
for _, prefix in ipairs({ 'mudstd.room.info', 'Empyreal.Room', 'Empyreal.Vehicle', 'Ship.Status', 'Ship.Devices', 'Space.Charts' }) do
  gmcp.on(prefix, on_gmcp)
end

world.on('disconnect', function()
  L.reset(state)
  post_location()
  if S.reset(scene) then post_scene() end
  if M.reset(manoeuvre) then post_manoeuvre() end
  -- The chart stays on: the panel hides it, and its ◎, with no charts.
  if C.reset(chart) then
    post_charts()
    post_chart_ship()
  end
  if N.reset(lanes, os.time()) then post_lanes() end
  save_lanes()
  if W.reset(work) then post_work() end
end)

panel:on_message('ready', function()
  post_settings()
  if has_location(state) then post_location() end
  -- The panel starts on the station with none docked at, so only anything else needs replaying.
  if S.scene(scene) ~= 'station' or S.station(scene) then post_scene() end
  if manoeuvre.verb then post_manoeuvre() end -- what's left of it now: the panel starts part-way
  if C.charts(chart) then post_charts() end
  if C.ship(chart) then post_chart_ship() end
  if C.on(chart) then post_chart_on() end
  if N.message(lanes).system or next(N.saved(lanes)) then post_lanes() end
  if N.on(lanes) then post_lanes_on() end
  if next(W.message(work)) then post_work() end
end)

-- The chart and the lanes map each cover the top band: switching one on switches the other off.
panel:on_message('chart', function(data)
  if type(data) ~= 'table' or type(data.on) ~= 'boolean' then return end
  if C.set_on(chart, data.on) then post_chart_on() end
  if data.on and N.set_on(lanes, false) then post_lanes_on() end
end)

panel:on_message('lanes-view', function(data)
  if type(data) ~= 'table' or type(data.on) ~= 'boolean' then return end
  if N.set_on(lanes, data.on) then post_lanes_on() end
  if data.on and C.set_on(chart, false) then post_chart_on() end
end)

settings.on('change', function(key)
  if key == 'turn_model' then post_settings() end
end)
