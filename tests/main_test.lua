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
  if opts.auto_view ~= nil then setting_values.auto_view = opts.auto_view end
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
  env.stored = opts.stored or {}
  _G.storage = {
    get = function(key)
      if opts.bad_storage then error('not JSON') end
      return env.stored[key]
    end,
    set = function(key, v) env.stored[key] = v end,
  }

  -- Mallard's require has no cache: count loads of our module.
  package.loaded['station_map.location'] = nil
  package.loaded['station_map.scene'] = nil
  package.loaded['station_map.charts'] = nil
  package.loaded['station_map.lanes'] = nil
  package.loaded['station_map.work'] = nil
  package.loaded['station_map.manoeuvre'] = nil
  package.loaded['station_map.action'] = nil
  package.loaded['station_map.belt'] = nil
  local real_require = require
  _G.require = function(name)
    if name == 'station_map.location' or name == 'station_map.scene'
        or name == 'station_map.charts' or name == 'station_map.lanes' or name == 'station_map.work'
        or name == 'station_map.manoeuvre'
        or name == 'station_map.action' or name == 'station_map.belt' then
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
  eq(env.requires, { 'station_map.location', 'station_map.scene', 'station_map.charts', 'station_map.lanes',
    'station_map.work', 'station_map.manoeuvre', 'station_map.action', 'station_map.belt' })
  eq(type(env.gmcp_handlers['mudstd.room.info']), 'function')
  eq(type(env.gmcp_handlers['Empyreal.Room']), 'function')
  eq(type(env.gmcp_handlers['Empyreal.Vehicle']), 'function')
  eq(type(env.gmcp_handlers['Ship.Status']), 'function')
  eq(type(env.gmcp_handlers['Ship.Devices']), 'function')
  eq(type(env.gmcp_handlers['Space.Charts']), 'function')
  eq(type(env.gmcp_handlers['Char.Action']), 'function')
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
  eq(names(env), { 'scene', 'chart-ship', 'chart' }) -- auto_view: the chart while she travels
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
  eq(names(env), { 'scene', 'chart-ship', 'chart' }) -- auto_view: the chart off, docked
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
  eq(names(env), { 'charts', 'lanes' })
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
  eq(names(env), { 'settings', 'scene', 'charts', 'chart-ship', 'chart', 'lanes' })
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
  eq(names(env), { 'location', 'charts', 'chart-ship', 'lanes' })
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

-- Petroc's mouths: its trunks, and the Maelor branch closed with her bound there
local PETROC = { system = 'petroc', places = {
  { id = 'morvah_deep', name = 'Morvah Deep', kind = 'station' },
  { id = 'mouth:petroc:keyne', name = 'the Keyne lane mouth', kind = 'mouth', open = true },
  { id = 'mouth:petroc:feock', name = 'the Feock lane mouth', kind = 'mouth', open = true },
  { id = 'mouth:petroc:maelor', name = 'the Maelor lane mouth', kind = 'mouth', open = false },
} }

test('Space.Charts posts lanes and stores the sightings', function()
  local real = os.time
  os.time = function() return 500 end
  local env = boot()
  env.gmcp_handlers['Space.Charts']('Space.Charts', PETROC)
  os.time = real
  local m = post_named(env, 'lanes').data
  eq(m.system, 'petroc')
  eq(#m.visible, 19)
  eq(m.seen['maelor-petroc'], { open = false, at = 500 })
  eq(m.seen['keyne-petroc'], { open = true, at = 500 })
  eq(m.seen['dozmary-petroc'], { open = false, at = 500 }) -- off the charts
  eq(env.stored.lanes['maelor-petroc'], { open = false, at = 500 })
end)

test('stored sightings are loaded and replayed on ready', function()
  local env = boot({ stored = { lanes = { ['keyne-mabyn'] = { open = true, at = 42 } } } })
  env.panel_handlers.ready({})
  eq(names(env), { 'settings', 'lanes' })
  eq(post_named(env, 'lanes').data.seen, { ['keyne-mabyn'] = { open = true, at = 42 } })
end)

test('storage that fails to read is no sightings', function()
  local env = boot({ bad_storage = true })
  env.panel_handlers.ready({})
  eq(names(env), { 'settings' })
end)

test('a jump posts the lane she is in', function()
  local env = boot()
  local h = env.gmcp_handlers['Ship.Status']
  h('Ship.Status', { name = 'Mule', location = 'mouth:petroc:maelor' })
  env.posts = {}
  h('Ship.Status', { name = 'Mule', destination = 'mouth:maelor:petroc', progress = 0, eta = 400,
    status = 'in the Maelor lane 0%' })
  eq(post_named(env, 'lanes').data.transit.lane, 'maelor-petroc')
end)

test('the lanes view and the chart switch each other off', function()
  local env = boot()
  env.panel_handlers.chart({ on = true })
  env.posts = {}
  env.panel_handlers['lanes-view']({ on = true })
  eq(names(env), { 'lanes-view', 'chart' })
  eq(env.posts[1].data, { on = true })
  eq(env.posts[2].data, { on = false })
  env.posts = {}
  env.panel_handlers.chart({ on = true })
  eq(names(env), { 'chart', 'lanes-view' })
  eq(env.posts[2].data, { on = false })
  env.posts = {}
  env.panel_handlers['lanes-view']('junk')
  env.panel_handlers['lanes-view']({ on = false })
  eq(#env.posts, 0)
end)

test('ready replays the lanes view when on', function()
  local env = boot()
  env.panel_handlers['lanes-view']({ on = true })
  env.posts = {}
  env.panel_handlers.ready({})
  eq(names(env), { 'settings', 'lanes-view' })
end)

-- The views switch themselves when what she's doing changes (auto_view, on by default)
local function views(env)
  local out = {}
  for _, p in ipairs(env.posts) do
    if p.name == 'chart' or p.name == 'lanes-view' then out[#out + 1] = p.name .. '=' .. tostring(p.data.on) end
  end
  return out
end

test('travelling switches the chart on, and stopping switches it off', function()
  local env = boot()
  local h = env.gmcp_handlers['Ship.Status']
  h('Ship.Status', { name = 'Mule', docked = true, location = 'tiss' })
  eq(views(env), {})
  h('Ship.Status', { name = 'Mule', location = 'tiss' })
  eq(views(env), {})
  h('Ship.Status', { name = 'Mule', destination = 'orrin_station', progress = 0, eta = 60 })
  eq(views(env), { 'chart=true' })
  env.posts = {}
  h('Ship.Status', { name = 'Mule', destination = 'orrin_station', progress = 50, eta = 30 })
  eq(views(env), {})
  h('Ship.Status', { name = 'Mule', location = 'orrin_station' })
  eq(views(env), { 'chart=false' })
end)

test('a jump switches the lanes map on and the chart off', function()
  local env = boot()
  local h = env.gmcp_handlers['Ship.Status']
  h('Ship.Status', { name = 'Mule', destination = 'mouth:petroc:maelor', progress = 0, eta = 60 })
  h('Ship.Status', { name = 'Mule', location = 'mouth:petroc:maelor' })
  env.posts = {}
  h('Ship.Status', { name = 'Mule', destination = 'mouth:maelor:petroc', progress = 0, eta = 400,
    status = 'in the Maelor lane 0%' })
  eq(views(env), { 'lanes-view=true' })
  env.posts = {}
  h('Ship.Status', { name = 'Mule', destination = 'mouth:maelor:petroc', progress = 10, eta = 360,
    status = 'in the Maelor lane 10%' })
  eq(views(env), {})
  h('Ship.Status', { name = 'Mule', destination = 'wenna_halt', progress = 0, eta = 60 })
  eq(views(env), { 'lanes-view=false', 'chart=true' })
end)

test('a view picked by hand stays until what she is doing changes', function()
  local env = boot()
  local h = env.gmcp_handlers['Ship.Status']
  h('Ship.Status', { name = 'Mule', docked = true, location = 'tiss' })
  env.panel_handlers.chart({ on = true })
  env.posts = {}
  h('Ship.Status', { name = 'Mule', docked = true, location = 'tiss', fuel = 10 })
  eq(views(env), {})
  h('Ship.Status', { name = 'Mule', destination = 'orrin_station', progress = 0, eta = 60 })
  env.panel_handlers.chart({ on = false })
  env.posts = {}
  h('Ship.Status', { name = 'Mule', destination = 'orrin_station', progress = 50, eta = 30 })
  eq(views(env), {})
end)

test('with auto_view off nothing switches, and turning it on switches to fit', function()
  local env = boot({ auto_view = false })
  local h = env.gmcp_handlers['Ship.Status']
  h('Ship.Status', { name = 'Mule', destination = 'orrin_station', progress = 0, eta = 60 })
  eq(views(env), {})
  env.setting_values.auto_view = true
  env.settings_handlers.change('auto_view', true, false)
  eq(views(env), { 'chart=true' })
  eq(names(env)[#env.posts], 'chart') -- no settings post: the panel doesn't need it
end)

test('a disconnect switches nothing; the first status after it does', function()
  local env = boot()
  local h = env.gmcp_handlers['Ship.Status']
  h('Ship.Status', { name = 'Mule', destination = 'orrin_station', progress = 0, eta = 60 })
  env.panel_handlers.chart({ on = false })
  env.posts = {}
  env.world_handlers.disconnect()
  eq(views(env), {})
  h('Ship.Status', { name = 'Mule', destination = 'orrin_station', progress = 50, eta = 30 })
  eq(views(env), { 'chart=true' })
end)

test('disconnect keeps the sightings, stamped', function()
  local real = os.time
  os.time = function() return 500 end
  local env = boot()
  env.gmcp_handlers['Space.Charts']('Space.Charts', PETROC)
  os.time = function() return 900 end
  env.posts = {}
  env.world_handlers.disconnect()
  os.time = real
  local m = post_named(env, 'lanes').data
  eq(m.system, nil)
  eq(m.seen['maelor-petroc'], { open = false, at = 900 })
  eq(env.stored.lanes['maelor-petroc'], { open = false, at = 900 })
end)

-- Ship.Devices: what the sensors and laser are doing, with local times
local SCANNING = { devices = {
  { id = 'sensors', condition = 90, fault = nil, busy = 'scan', left = 10, attachments = {} },
  { id = 'laser', condition = 80, fault = nil, busy = 'mine', left = nil, attachments = {} },
} }

test('Ship.Devices posts the work with its local times', function()
  local real = os.time
  os.time = function() return 1000 end
  local env = boot()
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', SCANNING)
  os.time = real
  eq(names(env), { 'work' })
  eq(env.posts[1].data, { sensors = { busy = 'scan', since = 1000, ends = 1010 }, laser = { busy = 'mine', since = 1000 } })
end)

test('the same Ship.Devices again posts nothing', function()
  local real = os.time
  os.time = function() return 1000 end
  local env = boot()
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', SCANNING)
  env.posts = {}
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', SCANNING)
  os.time = real
  eq(#env.posts, 0)
end)

test('ready replays the work only while something is under way', function()
  local env = boot()
  env.panel_handlers.ready({})
  eq(names(env), { 'settings' })
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', SCANNING)
  env.posts = {}
  env.panel_handlers.ready({})
  eq(names(env), { 'settings', 'work' })
end)

test('disconnect posts no work', function()
  local env = boot()
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', SCANNING)
  env.posts = {}
  env.world_handlers.disconnect()
  local m = post_named(env, 'work')
  eq(m.data, {})
end)

test('Ship.Status at a belt posts where she is in it, and her moving through it', function()
  local real = os.time
  local env = boot()
  local at = function(x, y)
    return { name = 'Sparrow', docked = false, location = 'cinders', belt = { x = x, y = y, radius = 16, core_km = 10, core_bearing = 0 } }
  end
  os.time = function() return 1000 end
  env.gmcp_handlers['Ship.Status']('Ship.Status', at(0, 10))
  eq(post_named(env, 'work').data, { belt = {} })
  env.posts = {}
  os.time = function() return 1001 end
  env.gmcp_handlers['Ship.Status']('Ship.Status', at(0, 10.3))
  os.time = real
  eq(post_named(env, 'work').data, { belt = { moved = 1001, way = 0 } })
end)

-- Docking and undocking, timed by Ship.Devices.

local function nav_busy(busy, left)
  return { devices = { { id = 'nav', condition = 100, busy = busy, left = left, attachments = {} } } }
end

test('an undock from a station posts manoeuvre, timed from now, about the station', function()
  local env = boot()
  env.gmcp_handlers['Ship.Status']('Ship.Status', { name = 'Mule', docked = true, location = 'tiss' })
  env.posts = {}
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', nav_busy('undock', 10))
  local p = post_named(env, 'manoeuvre')
  eq(p.data, { verb = 'undock', left = 10, total = 10, at = 'tiss' })
end)

test('a Ship.Devices resend with the same end posts nothing', function()
  local env = boot()
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', nav_busy('dock', 20))
  env.posts = {}
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', nav_busy('dock', 20))
  eq(post_named(env, 'manoeuvre'), nil)
end)

test('the run ending posts verb nil', function()
  local env = boot()
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', nav_busy('dock', 20))
  env.posts = {}
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', nav_busy(nil, nil))
  eq(post_named(env, 'manoeuvre').data, { verb = nil })
end)

test('stepping off her clears a run: Ship.Devices stops coming', function()
  local env = boot()
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', nav_busy('dock', 20))
  env.posts = {}
  env.gmcp_handlers['Ship.Status']('Ship.Status', nil)
  eq(post_named(env, 'manoeuvre').data, { verb = nil })
end)

test('ready replays a run under way, and nothing without one', function()
  local env = boot()
  env.panel_handlers.ready({})
  eq(post_named(env, 'manoeuvre'), nil)
  env.gmcp_handlers['Ship.Status']('Ship.Status', { name = 'Mule', location = 'orrin_station' })
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', nav_busy('dock', 12))
  env.posts = {}
  env.panel_handlers.ready({})
  local p = post_named(env, 'manoeuvre')
  eq(p.data.verb, 'dock')
  eq(p.data.total, 20)
  eq(p.data.at, 'orrin_station')
end)

test('disconnect clears a run', function()
  local env = boot()
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', nav_busy('undock', 10))
  env.posts = {}
  env.world_handlers.disconnect()
  eq(post_named(env, 'manoeuvre').data, { verb = nil })
end)

local REPAIR = { verb = 'repair', label = 'repairing the laser', stage = 2, stages = 3, left = 31, total = 48, queued = 1 }

test('Char.Action posts what you are doing, its end from the clock', function()
  local real = os.time
  os.time = function() return 1000 end
  local env = boot()
  env.gmcp_handlers['Char.Action']('Char.Action', REPAIR)
  os.time = real
  eq(names(env), { 'action' })
  eq(env.posts[1].data, { action = {
    verb = 'repair', label = 'repairing the laser', stage = 2, stages = 3, ends = 1031, total = 48, queued = 1,
  } })
end)

test('Char.Action null posts doing nothing, and only once', function()
  local env = boot()
  local h = env.gmcp_handlers['Char.Action']
  h('Char.Action', REPAIR)
  env.posts = {}
  h('Char.Action', nil)
  h('Char.Action', nil)
  eq(names(env), { 'action' })
  eq(env.posts[1].data, {})
end)

test('a Char.Action sub-package reaches no reducer', function()
  local env = boot()
  env.gmcp_handlers['Char.Action']('Char.Action.Extra', REPAIR)
  eq(#env.posts, 0)
end)

test('ready replays what you are doing, and not doing nothing', function()
  local env = boot()
  env.panel_handlers.ready({})
  eq(names(env), { 'settings' })
  env.gmcp_handlers['Char.Action']('Char.Action', REPAIR)
  env.posts = {}
  env.panel_handlers.ready({})
  eq(names(env), { 'settings', 'action' })
  eq(env.posts[2].data.action.label, 'repairing the laser')
end)

test('disconnect posts doing nothing, if something was under way', function()
  local env = boot()
  env.world_handlers.disconnect()
  eq(post_named(env, 'action'), nil)
  env.gmcp_handlers['Char.Action']('Char.Action', REPAIR)
  env.posts = {}
  env.world_handlers.disconnect()
  eq(post_named(env, 'action').data, {})
end)

-- The belt map (src/station_map/belt.lua).
local BELT_CHARTS = { system = 'senara', places = { { id = 'gannet-3', name = 'Gannet Belt', kind = 'belt' } } }
local function at_belt(x, y)
  return { name = 'Mule', docked = false, location = 'gannet-3',
    belt = { x = x, y = y, radius = 18, core_km = 1, core_bearing = 0 } }
end

local function belt_on(env)
  local on = nil
  for _, p in ipairs(env.posts) do
    if p.name == 'belt-view' then on = p.data.on end
  end
  return on
end

test('arriving at a belt posts where she is in it and switches the belt map on', function()
  local env = boot()
  env.gmcp_handlers['Space.Charts']('Space.Charts', BELT_CHARTS)
  env.gmcp_handlers['Ship.Status']('Ship.Status', { name = 'Mule', docked = false, destination = 'gannet-3' })
  env.posts = {}
  env.gmcp_handlers['Ship.Status']('Ship.Status', at_belt(3, 4))
  local p = post_named(env, 'belt')
  eq(p.data.id, 'gannet-3')
  eq(p.data.name, 'Gannet Belt')
  eq(p.data.place.x, 3)
  eq(belt_on(env), true)
  eq(env.stored.belts['gannet-3'].track, { { { 3, 4 } } })
end)

test('a move in the belt switches the belt map back on; coming to rest leaves it', function()
  local real = os.time
  local now = 1000
  os.time = function() return now end
  local env = boot()
  local h = env.gmcp_handlers['Ship.Status']
  local dev = function(nav, laser)
    return { devices = { { id = 'nav', busy = nav, left = nav and 20 or nil, attachments = {} },
      { id = 'laser', busy = laser, left = nil, attachments = {} } } }
  end
  h('Ship.Status', at_belt(3, 4))
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', dev(nil, nil))
  env.panel_handlers['belt-view']({ on = false }) -- the view ahead, by hand
  env.posts = {}
  now = 1010
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', dev('rcs', nil)) -- `rcs out`
  eq(belt_on(env), true)
  env.panel_handlers['belt-view']({ on = false })
  env.posts = {}
  now = 1011
  h('Ship.Status', at_belt(3.2, 4)) -- still moving: not a new start
  eq(belt_on(env), nil)
  now = 1030
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', dev(nil, nil)) -- at rest: the view stays
  eq(belt_on(env), nil)
  now = 1040
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', dev(nil, 'mine'))
  now = 1041
  h('Ship.Status', at_belt(3.4, 4)) -- closing on a rock
  eq(belt_on(env), true)
  os.time = real
end)

test('with auto_view off the belt map stays off', function()
  local env = boot({ auto_view = false })
  env.gmcp_handlers['Ship.Status']('Ship.Status', at_belt(3, 4))
  eq(belt_on(env), nil)
end)

test('travelling off the belt switches the belt map off and the chart on', function()
  local env = boot()
  env.gmcp_handlers['Ship.Status']('Ship.Status', at_belt(3, 4))
  env.posts = {}
  env.gmcp_handlers['Ship.Status']('Ship.Status', { name = 'Mule', docked = false, destination = 'tiss' })
  eq(belt_on(env), false)
  eq(post_named(env, 'chart').data, { on = true })
end)

test('the belt map, the chart and the lanes map switch each other off', function()
  local env = boot()
  env.panel_handlers['belt-view']({ on = true })
  env.posts = {}
  env.panel_handlers.chart({ on = true })
  eq(belt_on(env), false)
  env.posts = {}
  env.panel_handlers['belt-view']({ on = true })
  eq(post_named(env, 'chart').data, { on = false })
  env.panel_handlers['lanes-view']({ on = true })
  eq(belt_on(env), false)
  env.panel_handlers['belt-view']('nonsense')
end)

test('a sweep run to its end is stored with the belt', function()
  local real = os.time
  local now = 1000
  os.time = function() return now end
  local env = boot()
  env.gmcp_handlers['Ship.Status']('Ship.Status', at_belt(3, 4))
  local dev = function(busy, left)
    return { devices = { { id = 'sensors', busy = busy, left = left, attachments = {} } } }
  end
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', dev('scan', 10))
  now = 1010
  env.gmcp_handlers['Ship.Devices']('Ship.Devices', dev(nil, nil))
  os.time = real
  eq(env.stored.belts['gannet-3'].sweeps, { { x = 3, y = 4, r = 5 } })
end)

test('stored belt logs are loaded and replayed on ready at that belt', function()
  local env = boot({ stored = { belts = { ['gannet-3'] = { radius = 18, track = { { { 1, 1 } } }, sweeps = {} } } } })
  env.panel_handlers.ready({})
  eq(post_named(env, 'belt'), nil) -- nowhere yet
  env.gmcp_handlers['Ship.Status']('Ship.Status', at_belt(3, 4))
  env.posts = {}
  env.panel_handlers.ready({})
  local p = post_named(env, 'belt')
  eq(p.data.log.track, { { { 1, 1 } }, { { 3, 4 } } })
  eq(post_named(env, 'belt-view').data, { on = true })
end)

test('disconnect at a belt posts her nowhere and keeps the log', function()
  local env = boot()
  env.gmcp_handlers['Ship.Status']('Ship.Status', at_belt(3, 4))
  env.posts = {}
  env.world_handlers.disconnect()
  eq(post_named(env, 'belt').data.id, nil)
  eq(env.stored.belts['gannet-3'] ~= nil, true)
end)

t.done()
