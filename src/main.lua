-- Empyreal map (T.I.S.S., Orrin Station and Wenna Halt so far): folds GMCP location frames into one small message
-- and pushes it to the "map" panel, and your ship's frames into the overview's scene, its docking and
-- undocking (timed by Ship.Devices) and her waiting on Control's clearance for one, the system chart, the
-- lanes map, the belt map (each switched on and off to fit what she's doing, unless the auto_view setting is
-- off), the course she has plotted, what her sensors and laser are doing, and what you're doing (Char.Action) into the plan's card.
-- Your note on the ship you're aboard (Ship.List) goes with the location, for the ship plan. The lanes' states as last seen
-- (each character's, by Char.Status's name), and each belt's log (her track and sweeps in it), are kept in Mallard's storage, so they
-- outlive a restart. All state lives here; the panel is a
-- pure presentation layer that asks for a replay with "ready".
--
-- Mallard's require has no cache, so each module is required exactly once.

local L = require('station_map.location')
local S = require('station_map.scene')
local C = require('station_map.charts')
local N = require('station_map.lanes')
local W = require('station_map.work')
local M = require('station_map.manoeuvre')
local Q = require('station_map.clearance')
local A = require('station_map.action')
local K = require('station_map.course')
local B = require('station_map.belt')
local F = require('station_map.note')
local T = require('station_map.clock')

local panel = mud.panel('map')
local state = L.new()
local scene = S.new()
local chart = C.new()
local lanes = N.new()
local work = W.new()
local manoeuvre = M.new()
local clearance = Q.new()
local doing = A.new()
local course = K.new()
local belt = B.new()
local notes = F.new()
local clock = T.new()

-- storage is per plugin and world, but charts are per character, so the lanes' sightings are kept under
-- `lanes:<name>`, loaded when Char.Status names her. `lanes` alone is the old record, before charts were per
-- character: the first character named with none of her own takes it. A bad stored value (or none) is no sightings.
local legacy_lanes = nil
if storage then
  local ok, saved = pcall(storage.get, 'lanes')
  if ok and type(saved) == 'table' then legacy_lanes = saved end
  local ok2, logs = pcall(storage.get, 'belts')
  if ok2 then B.load(belt, logs) end
end

local function store_lanes(who, record)
  if storage and who then pcall(storage.set, 'lanes:' .. who, record) end
end

local function save_lanes()
  store_lanes(N.who(lanes), N.saved(lanes))
end

-- Her stored sightings, or the old record if she has none and it's still unclaimed.
local function stored_lanes(who)
  if not storage then return nil end
  local ok, saved = pcall(storage.get, 'lanes:' .. who)
  if not ok then return nil end
  if saved == nil and legacy_lanes then
    saved, legacy_lanes = legacy_lanes, nil
    pcall(storage.set, 'lanes', nil)
  end
  return saved
end

local function save_belts()
  if B.take_unsaved(belt) and storage then pcall(storage.set, 'belts', B.saved(belt)) end
end

local function has_location(s)
  local m = L.message(s)
  return m.roomId ~= nil or m.lift ~= nil
end

-- The location, with your note on her while you're aboard your own ship and she has one.
local function location_message()
  local m = L.message(state)
  m.note = F.note(notes, m.area)
  return m
end

local function post_location()
  panel:post('location', location_message())
end

-- Ship.List comes after every command: post the location only when the note it shows changes.
local function ship_list(data)
  local area = L.message(state).area
  local before = F.note(notes, area)
  F.ship_list(notes, data, area)
  if F.note(notes, area) ~= before and has_location(state) then post_location() end
end

local function post_scene()
  panel:post('scene', { scene = S.scene(scene), station = S.station(scene), port = S.port(scene),
    planet = S.planet(scene) })
end

local function post_manoeuvre()
  panel:post('manoeuvre', M.message(manoeuvre, os.time()))
end

local function post_clearance()
  panel:post('clearance', Q.message(clearance))
end

local function post_charts()
  panel:post('charts', C.charts(chart))
end

local function post_chart_ship()
  panel:post('chart-ship', C.ship(chart))
end

local function post_chart_contacts()
  panel:post('chart-contacts', C.contacts(chart))
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

local function post_belt()
  panel:post('belt', B.message(belt))
end

local function post_belt_on()
  panel:post('belt-view', { on = B.on(belt) })
end

local function post_work()
  panel:post('work', W.message(work))
end

local function post_action()
  panel:post('action', A.message(doing))
end

local function post_course()
  panel:post('course', K.message(course))
end

local function post_clock()
  panel:post('clock', T.message(clock))
end

local function post_settings()
  panel:post('settings', { turn_model = settings.get('turn_model') ~= false })
end

-- What she's doing, as far as the top band cares: 'lane' (in one), 'travelling' (in a system)
-- or 'stopped' (anything else, her off too).
local function activity()
  if N.message(lanes).transit then return 'lane' end
  if S.scene(scene) == 'travelling' then return 'travelling' end
  return 'stopped'
end

-- The chart, the lanes map and the belt map each cover the top band: switching one on switches
-- the others off. A nil belt_on leaves the belt map as it is.
local function set_views(chart_on, lanes_on, belt_on)
  if not chart_on and C.set_on(chart, false) then post_chart_on() end
  if not lanes_on and N.set_on(lanes, false) then post_lanes_on() end
  if belt_on == false and B.set_on(belt, false) then post_belt_on() end
  if chart_on and C.set_on(chart, true) then post_chart_on() end
  if lanes_on and N.set_on(lanes, true) then post_lanes_on() end
  if belt_on and B.set_on(belt, true) then post_belt_on() end
end

-- Stopped, the belt map is left as it is: it comes up as she arrives at a belt or a move in it
-- starts (follow_belt), and stays when she comes to rest.
local function fit_views(now)
  local belt_on = nil
  if now == 'travelling' or now == 'lane' then belt_on = false end
  set_views(now == 'travelling', now == 'lane', belt_on)
end

-- With auto_view on, the band switches to fit only when what she's doing changes, so a view
-- picked by hand stays until then. Nil until the first status, and again after a disconnect.
local doing_now = nil

local function follow_activity()
  local now = activity()
  if now == doing_now then return end
  doing_now = now
  if settings.get('auto_view') ~= false then fit_views(now) end
end

-- With auto_view on, the belt map comes up as she arrives at a belt and as a move in it starts
-- (the thrusters, or closing on a rock: work.lua's W.moving, as the scene has it), and stays as she
-- comes to rest. Nil after a disconnect, so a move under way then isn't a start.
local moving_now = nil

local function follow_belt()
  local arrived = B.take_cue(belt) ~= nil
  local moving = W.moving(work, os.time())
  local started = moving and moving_now == false
  moving_now = moving
  if (arrived or started) and settings.get('auto_view') ~= false then set_views(false, false, true) end
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
  if S.ship_status(scene, data, os.time()) then post_scene() end
  -- Off her, Ship.Devices isn't sent again (gmcp.ts sendShipGmcp): what she was doing goes too.
  if type(data) ~= 'table' and M.reset(manoeuvre) then post_manoeuvre() end
  if Q.ship_status(clearance, data) then post_clearance() end
  C.ship_status(chart, data, os.time())
  -- Always: the panel times a trip from the fresh `received`.
  post_chart_ship()
  if N.ship_status(lanes, data, os.time()) then post_lanes() end
  -- Where she is in a belt, so the scene can tell her moving through it.
  if W.ship_status(work, data, os.time()) then post_work() end
  if B.ship_status(belt, data, os.time()) then post_belt() end
  save_belts()
  follow_activity()
  follow_belt()
end

local function scene_charts(data)
  if S.space_charts(scene, data) then post_scene() end
  if C.space_charts(chart, data) then post_charts() end
  if N.space_charts(lanes, data, os.time()) then post_lanes() end
  save_lanes() -- every time: a lane seen now was seen until now
  if B.space_charts(belt, data) then post_belt() end
  save_belts()
end

local function ship_devices(data)
  if W.ship_devices(work, data, os.time()) then post_work() end
  local at = function(verb) return S.manoeuvre_at(scene, verb) end
  if M.ship_devices(manoeuvre, data, os.time(), at) then post_manoeuvre() end
  if Q.ship_devices(clearance, data) then post_clearance() end
  if B.ship_devices(belt, data, os.time()) then post_belt() end
  save_belts()
  follow_belt()
end

-- Who's playing: another character's name swaps in her sightings, the one before's stored.
local function char_status(data)
  local who = N.who_of(data)
  if not who or who == N.who(lanes) then return end
  local was, record = N.become(lanes, who, stored_lanes(who), os.time())
  store_lanes(was, record)
  save_lanes()
  post_lanes()
end

-- The sweep goes to the chart, and to the belt map, which notes where she was as it came.
local function space_contacts(data)
  if C.space_contacts(chart, data) then post_chart_contacts() end
  if B.space_contacts(belt, C.contacts(chart)) then post_belt() end
  save_belts()
end

local scene_reducers = {
  ['ship.status'] = scene_ship,
  ['ship.devices'] = ship_devices,
  ['space.charts'] = scene_charts,
  ['space.contacts'] = space_contacts,
}

local function on_gmcp(package, data)
  local name = string.lower(tostring(package))
  local reduce = reducers[name]
  if reduce then
    if reduce(state, data) then post_location() end
    return
  end
  if name == 'char.status' then
    char_status(data)
    return
  end
  if name == 'char.action' then
    if A.char_action(doing, data, os.time()) then post_action() end
    return
  end
  if name == 'ship.list' then
    ship_list(data)
    return
  end
  if name == 'ship.course' then
    if K.ship_course(course, data) then post_course() end
    return
  end
  if name == 'empyreal.clock' then
    if T.empyreal_clock(clock, data) then post_clock() end
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
for _, prefix in ipairs({ 'mudstd.room.info', 'Empyreal.Room', 'Empyreal.Vehicle', 'Ship.Status', 'Ship.Devices', 'Space.Charts', 'Ship.Course', 'Ship.List', 'Space.Contacts', 'Char.Status', 'Char.Action', 'Empyreal.Clock' }) do
  gmcp.on(prefix, on_gmcp)
end

world.on('disconnect', function()
  F.reset(notes)
  L.reset(state)
  post_location()
  if S.reset(scene) then post_scene() end
  if M.reset(manoeuvre) then post_manoeuvre() end
  if Q.reset(clearance) then post_clearance() end
  -- The chart stays on: the panel hides it, and its ◎, with no charts.
  local had_contacts = C.contacts(chart) ~= nil
  if C.reset(chart) then
    post_charts()
    post_chart_ship()
    if had_contacts then post_chart_contacts() end
  end
  if N.reset(lanes, os.time()) then post_lanes() end
  save_lanes()
  if W.reset(work) then post_work() end
  if A.reset(doing) then post_action() end
  if K.reset(course) then post_course() end
  if B.reset(belt) then post_belt() end
  save_belts()
  if T.reset(clock) then post_clock() end -- the tab hides till the next login's
  doing_now = nil -- the views stay as they are; the first status after it fits them
  moving_now = nil
end)

panel:on_message('ready', function()
  post_settings()
  if has_location(state) then post_location() end
  -- The panel starts on the station with none docked at, so only anything else needs replaying.
  if S.scene(scene) ~= 'station' or S.station(scene) then post_scene() end
  if manoeuvre.verb then post_manoeuvre() end -- what's left of it now: the panel starts part-way
  if clearance.verb then post_clearance() end
  if C.charts(chart) then post_charts() end
  if C.ship(chart) then post_chart_ship() end
  if C.contacts(chart) then post_chart_contacts() end
  if C.on(chart) then post_chart_on() end
  if N.message(lanes).system or next(N.message(lanes).seen) then post_lanes() end
  if N.on(lanes) then post_lanes_on() end
  if B.message(belt).id then post_belt() end
  if B.on(belt) then post_belt_on() end
  if next(W.message(work)) then post_work() end
  if A.message(doing).action then post_action() end
  if K.message(course).course then post_course() end
  if T.message(clock).clock then post_clock() end
end)

panel:on_message('chart', function(data)
  if type(data) ~= 'table' or type(data.on) ~= 'boolean' then return end
  if C.set_on(chart, data.on) then post_chart_on() end
  if data.on and N.set_on(lanes, false) then post_lanes_on() end
  if data.on and B.set_on(belt, false) then post_belt_on() end
end)

panel:on_message('lanes-view', function(data)
  if type(data) ~= 'table' or type(data.on) ~= 'boolean' then return end
  if N.set_on(lanes, data.on) then post_lanes_on() end
  if data.on and C.set_on(chart, false) then post_chart_on() end
  if data.on and B.set_on(belt, false) then post_belt_on() end
end)

panel:on_message('belt-view', function(data)
  if type(data) ~= 'table' or type(data.on) ~= 'boolean' then return end
  if B.set_on(belt, data.on) then post_belt_on() end
  if data.on and C.set_on(chart, false) then post_chart_on() end
  if data.on and N.set_on(lanes, false) then post_lanes_on() end
end)

settings.on('change', function(key)
  if key == 'turn_model' then post_settings() end
  -- switched on, it fits the band to what she's doing now (once there's a status to go by)
  if key == 'auto_view' and doing_now and settings.get('auto_view') ~= false then fit_views(doing_now) end
end)
