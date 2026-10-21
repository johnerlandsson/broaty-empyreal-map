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
  local real_require = require
  _G.require = function(name)
    if name == 'station_map.location' then
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

test('wires panel and requires the module once', function()
  local env = boot()
  eq(env.panel_id, 'map')
  eq(#env.requires, 1)
  eq(type(env.gmcp_handlers['mudstd.room.info']), 'function')
  eq(type(env.gmcp_handlers['Empyreal.Room']), 'function')
  eq(type(env.gmcp_handlers['Empyreal.Vehicle']), 'function')
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

t.done()
