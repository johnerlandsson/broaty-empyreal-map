package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local test, eq = t.test, t.eq

-- Fresh stubbed Mallard environment, then load src/main.lua once.
local function boot(opts)
  opts = opts or {}
  local env = { gmcp_handlers = {}, panel_handlers = {}, world_handlers = {},
    settings_handlers = {}, posts = {}, debug = {}, requires = {} }
  local setting_values = { turn_model = true }
  if opts.turn_model ~= nil then setting_values.turn_model = opts.turn_model end
  env.setting_values = setting_values

  local panel = {}
  function panel:post(name, tbl) env.posts[#env.posts + 1] = { name = name, data = tbl } end
  function panel:on_message(name, fn) env.panel_handlers[name] = fn end

  _G.gmcp = { on = function(prefix, fn) env.gmcp_handlers[prefix] = fn end }
  _G.mud = { panel = function(id) env.panel_id = id; return panel end }
  _G.world = { on = function(ev, fn) env.world_handlers[ev] = fn end }
  _G.settings = {
    get = function(key) return setting_values[key] end,
    on = function(ev, fn) env.settings_handlers[ev] = fn end,
  }
  _G.log = { debug = function(...) env.debug[#env.debug + 1] = { ... } end }

  -- Mallard's require has no cache: count loads of our module.
  package.loaded['station_map.location'] = nil
  package.loaded['station_map.scene'] = nil
  package.loaded['station_map.charts'] = nil
  local real_require = require
  _G.require = function(name)
    if name == 'station_map.location' or name == 'station_map.scene'
        or name == 'station_map.charts' then
      env.requires[#env.requires + 1] = name
      package.loaded[name] = nil
    end
    return real_require(name)
  end
  dofile('src/main.lua')
  _G.require = real_require
  return env
end

local function names(env)
  local out = {}
  for i, p in ipairs(env.posts) do out[i] = p.name end
  return out
end

-- The posts that are not the orrery's (charts, chart-ship, chart).
local function core(env)
  local out = {}
  for _, p in ipairs(env.posts) do
    if p.name ~= 'charts' and p.name ~= 'chart-ship' and p.name ~= 'chart' then out[#out + 1] = p end
  end
  return out
end

local function post_named(env, name)
  for _, p in ipairs(env.posts) do
    if p.name == name then return p end
  end
end

test('wires panel and requires each module once', function()
  local env = boot()
  eq(env.panel_id, 'map')
  eq(env.requires, { 'station_map.location', 'station_map.scene', 'station_map.charts' })
  eq(type(env.gmcp_handlers['mudstd.room.info']), 'function')
  eq(type(env.gmcp_handlers['Empyreal.Room']), 'function')
  eq(type(env.gmcp_handlers['Empyreal.Vehicle']), 'function')
  eq(type(env.gmcp_handlers['Ship.Status']), 'function')
  eq(type(env.gmcp_handlers['Space.Charts']), 'function')
  eq(type(env.world_handlers.disconnect), 'function')
  eq(type(env.panel_handlers.ready), 'function')
  eq(type(env.settings_handlers.change), 'function')
end)

test('room frame posts location', function()
  local env = boot()
  env.gmcp_handlers['mudstd.room.info']('mudstd.room.info', { id = 'tiss.market', name = 'Market Hall' })
  eq(#env.posts, 1)
  eq(env.posts[1].name, 'location')
  eq(env.posts[1].data.roomId, 'tiss.market')
end)

test('duplicate frame posts nothing', function()
  local env = boot()
  local h = env.gmcp_handlers['mudstd.room.info']
  h('mudstd.room.info', { id = 'tiss.market', name = 'Market Hall' })
  h('mudstd.room.info', { id = 'tiss.market', name = 'Market Hall' })
  eq(#env.posts, 1)
end)

test('ready replays settings then location', function()
  local env = boot()
  env.gmcp_handlers['mudstd.room.info']('mudstd.room.info', { id = 'tiss.market', name = 'Market Hall' })
  env.posts = {}
  env.panel_handlers.ready({})
  eq(names(env), { 'settings', 'location' })
  eq(env.posts[1].data.turn_model, true)
  eq(env.posts[2].data.roomId, 'tiss.market')
end)

test('ready before any location posts only settings', function()
  local env = boot()
  env.panel_handlers.ready({})
  eq(names(env), { 'settings' })
  eq(env.posts[1].data, { turn_model = true })
end)

test('mid-ride ready replays the lift', function()
  local env = boot()
  env.gmcp_handlers['Empyreal.Room']('Empyreal.Room', { id = 'tiss.lift-9', part = 'lift',
    address = 'Lift 9', vehicle = { at = 'tiss.rim-0900', doors = 'open' } })
  env.gmcp_handlers['Empyreal.Vehicle']('Empyreal.Vehicle', { id = 'tiss.lift-9', at = nil,
    between = { 'tiss.rim-0900', 'tiss.mid-0900' }, heading = 'hubward', doors = 'closed' })
  eq(#env.posts, 2)
  env.posts = {}
  env.panel_handlers.ready({})
  eq(names(env), { 'settings', 'location' })
  eq(env.posts[2].data.lift.between, { 'tiss.rim-0900', 'tiss.mid-0900' })
end)

test('disconnect posts an empty location', function()
  local env = boot()
  env.gmcp_handlers['mudstd.room.info']('mudstd.room.info', { id = 'tiss.market', name = 'Market Hall' })
  env.posts = {}
  env.world_handlers.disconnect()
  eq(#env.posts, 1)
  eq(env.posts[1].name, 'location')
  eq(env.posts[1].data.roomId, nil)
  -- A ready after disconnect has no location to replay.
  env.posts = {}
  env.panel_handlers.ready({})
  eq(names(env), { 'settings' })
end)

test('settings change posts settings', function()
  local env = boot()
  env.setting_values.turn_model = false
  env.settings_handlers.change('turn_model', false, true)
  eq(#env.posts, 1)
  eq(env.posts[1].name, 'settings')
  eq(env.posts[1].data.turn_model, false)
  env.posts = {}
  env.settings_handlers.change('other', 1, 2)
  eq(#env.posts, 0)
end)

test('unknown package is logged and ignored', function()
  local env = boot()
  env.gmcp_handlers['Empyreal.Room']('Empyreal.Room.Extra', { id = 'x' })
  eq(#env.posts, 0)
  eq(#env.debug, 1)
end)

test('dispatch is case-insensitive on the package name', function()
  local env = boot()
  env.gmcp_handlers['mudstd.room.info']('MUDSTD.ROOM.INFO', { id = 'tiss.market', name = 'Market Hall' })
  eq(#env.posts, 1)
  eq(env.posts[1].data.roomId, 'tiss.market')
  env.gmcp_handlers['Empyreal.Room']('EMPYREAL.ROOM', { id = 'tiss.market', address = 'Rim 12:00, fore' })
  eq(env.posts[2].data.address, 'Rim 12:00, fore')
end)

test('a sub-package in another case is still ignored', function()
  local env = boot()
  env.gmcp_handlers['Empyreal.Room']('empyreal.room.extra', { id = 'x' })
  eq(#env.posts, 0)
  eq(#env.debug, 1)
end)

local CHARTS = { places = { { id = 'belt.7', name = 'Dusty Reach', kind = 'belt' } } }

test('setting off posts the travelling scene', function()
  local env = boot()
  env.gmcp_handlers['Ship.Status']('Ship.Status', { name = 'Mule', docked = false, destination = 'belt.7', progress = 0 })
  eq(names(env), { 'scene', 'chart-ship' })
  eq(env.posts[1].data, { scene = 'travelling' })
end)

test('transit progress posts nothing more', function()
  local env = boot()
  local h = env.gmcp_handlers['Ship.Status']
  h('Ship.Status', { name = 'Mule', docked = false, destination = 'belt.7', progress = 0.1 })
  h('Ship.Status', { name = 'Mule', docked = false, destination = 'belt.7', progress = 0.2 })
  eq(#core(env), 1)
end)

test('arriving at a charted belt posts the belt scene', function()
  local env = boot()
  env.gmcp_handlers['Space.Charts']('Space.Charts', CHARTS)
  eq(#core(env), 0)
  env.gmcp_handlers['Ship.Status']('Ship.Status', { name = 'Mule', docked = false, location = 'belt.7' })
  eq(post_named(env, 'scene').data, { scene = 'belt' })
end)

test('arriving over a port posts the port scene with the port', function()
  local env = boot()
  env.gmcp_handlers['Space.Charts']('Space.Charts', { bodies = { { id = 'zennor', name = 'Zennor', kind = 'port' } } })
  env.gmcp_handlers['Ship.Status']('Ship.Status', { name = 'Mule', docked = false, location = 'zennor' })
  eq(post_named(env, 'scene').data, { scene = 'port', port = 'zennor' })
end)

test('ready replays the scene when away from the station', function()
  local env = boot()
  env.gmcp_handlers['Ship.Status']('Ship.Status', { name = 'Mule', docked = false, location = 'tiss' })
  env.posts = {}
  env.panel_handlers.ready({})
  eq(names(env), { 'settings', 'scene', 'chart-ship' })
  eq(env.posts[2].data, { scene = 'parked' })
end)

test('disconnect in space posts the station scene', function()
  local env = boot()
  env.gmcp_handlers['Ship.Status']('Ship.Status', { name = 'Mule', docked = false, destination = 'belt.7' })
  env.posts = {}
  env.world_handlers.disconnect()
  eq(names(env), { 'location', 'scene', 'charts', 'chart-ship' })
  eq(env.posts[2].data, { scene = 'station' })
end)

test('docking posts the station scene with the station she is docked at', function()
  local env = boot()
  local h = env.gmcp_handlers['Ship.Status']
  h('Ship.Status', { name = 'Mule', docked = false, destination = 'orrin_station' })
  env.posts = {}
  h('Ship.Status', { name = 'Mule', docked = true, location = 'orrin_station' })
  eq(names(env), { 'scene', 'chart-ship' })
  eq(env.posts[1].data, { scene = 'station', station = 'orrin_station' })
end)

test('ready replays the scene when docked', function()
  local env = boot()
  env.gmcp_handlers['Ship.Status']('Ship.Status', { name = 'Mule', docked = true, location = 'orrin_station' })
  env.posts = {}
  env.panel_handlers.ready({})
  eq(names(env), { 'settings', 'scene', 'chart-ship' })
  eq(env.posts[2].data, { scene = 'station', station = 'orrin_station' })
end)

test('Space.Charts posts charts after the scene', function()
  local env = boot()
  env.gmcp_handlers['Space.Charts']('Space.Charts', { system = 'sol', places = { { id = 'belt.7', kind = 'belt' } } })
  eq(names(env), { 'charts' })
  eq(env.posts[1].data.system, 'sol')
  env.posts = {}
  env.gmcp_handlers['Space.Charts']('Space.Charts', { system = 'sol', places = { { id = 'belt.7', kind = 'belt' } } })
  eq(#env.posts, 0)
end)

test('Space.Charts posts the scene before the charts', function()
  local env = boot()
  env.gmcp_handlers['Ship.Status']('Ship.Status', { name = 'Mule', docked = false, location = 'belt.7' })
  env.posts = {}
  env.gmcp_handlers['Space.Charts']('Space.Charts', CHARTS)
  eq(names(env), { 'scene', 'charts' })
  eq(env.posts[1].data, { scene = 'belt' })
end)

test('Ship.Status posts chart-ship with received, every time', function()
  local env = boot()
  local real = os.time
  local now = 1000
  os.time = function() return now end
  local h = env.gmcp_handlers['Ship.Status']
  h('Ship.Status', { name = 'Mule', docked = true, location = 'tiss' })
  now = 1005
  h('Ship.Status', { name = 'Mule', docked = true, location = 'tiss' })
  os.time = real
  local n = 0
  for _, p in ipairs(env.posts) do
    if p.name == 'chart-ship' then n = n + 1 end
  end
  eq(n, 2)
  eq(post_named(env, 'chart-ship').data.received, 1000)
  eq(env.posts[#env.posts].data.received, 1005)
end)

test('the panel chart message is kept and replayed on ready', function()
  local env = boot()
  env.gmcp_handlers['Space.Charts']('Space.Charts', { system = 'sol' })
  env.gmcp_handlers['Ship.Status']('Ship.Status', { name = 'Mule', docked = true, location = 'tiss' })
  env.panel_handlers.chart({ on = true })
  eq(env.posts[#env.posts].name, 'chart')
  eq(env.posts[#env.posts].data, { on = true })
  env.posts = {}
  env.panel_handlers.chart({ on = true })
  eq(#env.posts, 0)
  env.panel_handlers.chart('junk')
  env.panel_handlers.chart({ on = 'yes' })
  eq(#env.posts, 0)
  env.panel_handlers.ready({})
  eq(names(env), { 'settings', 'scene', 'charts', 'chart-ship', 'chart' })
  eq(post_named(env, 'chart').data, { on = true })
end)

test('ready replays chart only when on', function()
  local env = boot()
  env.panel_handlers.ready({})
  eq(names(env), { 'settings' })
end)

test('disconnect posts charts nil and keeps the chart on', function()
  local env = boot()
  env.gmcp_handlers['Space.Charts']('Space.Charts', { system = 'sol' })
  env.panel_handlers.chart({ on = true })
  env.posts = {}
  env.world_handlers.disconnect()
  eq(names(env), { 'location', 'charts', 'chart-ship' })
  eq(post_named(env, 'charts').data, nil)
  eq(post_named(env, 'chart-ship').data, nil)
  -- a panel remounted while disconnected is told it's still on
  env.posts = {}
  env.panel_handlers.ready({})
  eq(names(env), { 'settings', 'chart' })
  eq(post_named(env, 'chart').data, { on = true })
end)

test('chart-ship carries her name', function()
  local env = boot()
  env.gmcp_handlers['Ship.Status']('Ship.Status', { name = 'Mule', docked = true, location = 'tiss' })
  eq(post_named(env, 'chart-ship').data.name, 'Mule')
end)

t.done()
