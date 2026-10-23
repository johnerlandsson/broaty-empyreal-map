package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local M = require('station_map.manoeuvre')
local test, eq = t.test, t.eq

local function nav(busy, left)
  return { id = 'nav', condition = 100, fault = nil, busy = busy, left = left, attachments = {} }
end

local function devices(...)
  return { devices = { { id = 'sensors', condition = 90, busy = nil, left = nil, attachments = {} }, ... } }
end

local function at(place) return function() return place end end

test('a fresh state is doing nothing', function()
  eq(M.message(M.new(), 100), { verb = nil })
end)

test('an undock from its start ends `left` from now, over its full 10 s', function()
  local m = M.new()
  eq(M.ship_devices(m, devices(nav('undock', 10)), 100, at('tiss')), true)
  eq(m.verb, 'undock')
  eq(m.ends, 110)
  eq(m.starts, 100)
  eq(M.message(m, 100), { verb = 'undock', left = 10, total = 10, at = 'tiss' })
  eq(M.message(m, 104), { verb = 'undock', left = 6, total = 10, at = 'tiss' })
end)

test('a dock seen mid-run starts from what is left of its 20 s', function()
  local m = M.new()
  M.ship_devices(m, devices(nav('dock', 5)), 100, at('orrin_station'))
  eq(m.starts, 85)
  eq(M.message(m, 100), { verb = 'dock', left = 5, total = 20, at = 'orrin_station' })
end)

test('a failed undock check runs longer than 10 s, and takes all of it', function()
  local m = M.new()
  M.ship_devices(m, devices(nav('undock', 15)), 100, at('tiss'))
  eq(M.message(m, 100), { verb = 'undock', left = 15, total = 15, at = 'tiss' })
end)

test('past its end, the message holds at nothing left', function()
  local m = M.new()
  M.ship_devices(m, devices(nav('dock', 20)), 100, at('tiss'))
  eq(M.message(m, 130).left, 0)
end)

test('a resend with the same end, give or take a second, changes nothing', function()
  local m = M.new()
  M.ship_devices(m, devices(nav('dock', 20)), 100, at('tiss'))
  eq(M.ship_devices(m, devices(nav('dock', 13)), 108, at('tiss')), false)
  eq(m.ends, 120)
end)

test('a moved end (the drift call letting her in early) moves it, from the same start', function()
  local m = M.new()
  M.ship_devices(m, devices(nav('dock', 20)), 100, at('tiss'))
  eq(M.ship_devices(m, devices(nav('dock', 3)), 112, at('tiss')), true)
  eq(m.ends, 115)
  eq(m.starts, 100)
  eq(M.message(m, 112), { verb = 'dock', left = 3, total = 15, at = 'tiss' })
end)

test('where it is about is fixed as it starts', function()
  local m = M.new()
  M.ship_devices(m, devices(nav('dock', 20)), 100, at('tiss'))
  M.ship_devices(m, devices(nav('dock', 19)), 101, at('somewhere else'))
  eq(m.at, 'tiss')
end)

test('asks where for the verb it starts', function()
  local m = M.new()
  local asked
  M.ship_devices(m, devices(nav('undock', 10)), 100, function(verb) asked = verb; return 'tiss' end)
  eq(asked, 'undock')
end)

test('nowhere to show it still keeps the verb, with at nil', function()
  local m = M.new()
  M.ship_devices(m, devices(nav('undock', 10)), 100, at(nil))
  eq(M.message(m, 100), { verb = 'undock', left = 10, total = 10 })
end)

test('the activity ending clears it', function()
  local m = M.new()
  M.ship_devices(m, devices(nav('undock', 10)), 100, at('tiss'))
  eq(M.ship_devices(m, devices(nav(nil, nil)), 110, at('tiss')), true)
  eq(M.message(m, 110), { verb = nil })
  eq(M.ship_devices(m, devices(nav(nil, nil)), 111, at('tiss')), false)
end)

test('dock straight after undock is a new run', function()
  local m = M.new()
  M.ship_devices(m, devices(nav('undock', 10)), 100, at('tiss'))
  eq(M.ship_devices(m, devices(nav('dock', 20)), 110, at('tiss')), true)
  eq(M.message(m, 110), { verb = 'dock', left = 20, total = 20, at = 'tiss' })
end)

test('other nav work is nothing to show', function()
  local m = M.new()
  eq(M.ship_devices(m, devices(nav('travel', 300)), 100, at('tiss')), false)
  eq(M.ship_devices(m, devices(nav('jump', nil)), 100, at('tiss')), false)
  eq(M.message(m, 100), { verb = nil })
end)

test('another device busy docking is not the nav', function()
  local m = M.new()
  eq(M.ship_devices(m, { devices = { { id = 'laser', busy = 'dock', left = 5 } } }, 100, at('tiss')), false)
end)

test('a dock with no known end (not started) is nothing to show', function()
  local m = M.new()
  eq(M.ship_devices(m, devices(nav('dock', nil)), 100, at('tiss')), false)
  eq(m.verb, nil)
end)

test('odd shapes and null clear it and never error', function()
  local odd = {
    'null', nil, 42, 'x', {}, { devices = 'x' }, { devices = { 'x', 7 } },
    devices(nav('dock', 'ten')), devices(nav('dock', -3)), devices(nav('dock', 0 / 0)),
    devices(nav('dock', math.huge)), devices(nav(7, 10)), devices({ id = 7, busy = 'dock', left = 10 }),
  }
  for i = 1, 13 do
    local m = M.new()
    M.ship_devices(m, devices(nav('undock', 10)), 100, at('tiss'))
    M.ship_devices(m, odd[i], 101, at('tiss'))
    eq(M.message(m, 101), { verb = nil }, 'case ' .. i)
  end
end)

test('a bad clock or where is survived', function()
  local m = M.new()
  M.ship_devices(m, devices(nav('undock', 10)), nil, nil)
  eq(M.message(m, nil), { verb = 'undock', left = 10, total = 10 })
  local n = M.new()
  M.ship_devices(n, devices(nav('undock', 10)), 100, function() error('boom') end)
  eq(n.at, nil)
  M.ship_devices(n, devices(nav('undock', 10)), 100, function() return 12 end)
  eq(n.at, nil)
end)

test('reset clears it, true only if there was one', function()
  local m = M.new()
  eq(M.reset(m), false)
  M.ship_devices(m, devices(nav('undock', 10)), 100, at('tiss'))
  eq(M.reset(m), true)
  eq(M.message(m, 100), { verb = nil })
end)

t.done()
