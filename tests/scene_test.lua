package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local S = require('station_map.scene')
local test, eq = t.test, t.eq

local CHARTS = { epoch = 0, system = 'sol', bodies = {}, places = {
  { id = 'tiss', name = 'T.I.S.S.', kind = 'station' },
  { id = 'belt.7', name = 'Dusty Reach', kind = 'belt' },
  { id = 'mouth.2', name = 'Lane to Vega', kind = 'mouth' },
} }

local function status(t)
  local d = { name = 'Mule', status = '', docked = false, location = nil, destination = nil }
  for k, v in pairs(t) do d[k] = v end
  return d
end

test('a fresh state shows the station', function()
  eq(S.scene(S.new()), 'station')
end)

test('docked aboard your ship shows the station', function()
  local s = S.new()
  S.ship_status(s, status({ docked = true, location = 'tiss' }))
  eq(S.scene(s), 'station')
end)

test('undocked off the station is parked', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  eq(S.ship_status(s, status({ location = 'tiss' })), true)
  eq(S.scene(s), 'parked')
end)

test('in transit is travelling', function()
  local s = S.new()
  S.ship_status(s, status({ destination = 'belt.7', progress = 0.2 }))
  eq(S.scene(s), 'travelling')
end)

test('at a charted belt is belt', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ location = 'belt.7' }))
  eq(S.scene(s), 'belt')
end)

test('at a lane mouth is parked', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ location = 'mouth.2' }))
  eq(S.scene(s), 'parked')
end)

test('a place missing from the charts is parked', function()
  local s = S.new()
  S.ship_status(s, status({ location = 'belt.99' }))
  eq(S.scene(s), 'parked')
end)

test('charts arriving after the status turn parked into belt', function()
  local s = S.new()
  S.ship_status(s, status({ location = 'belt.7' }))
  eq(S.space_charts(s, CHARTS), true)
  eq(S.scene(s), 'belt')
end)

test('leaving the ship (null status) shows the station', function()
  local s = S.new()
  S.ship_status(s, status({ destination = 'belt.7' }))
  eq(S.ship_status(s, nil), true)
  eq(S.scene(s), 'station')
end)

test('a non-table status (JSON null sentinel) shows the station', function()
  local s = S.new()
  S.ship_status(s, status({ destination = 'belt.7' }))
  S.ship_status(s, function() end)
  eq(S.scene(s), 'station')
end)

test('progress ticking during transit is not a change', function()
  local s = S.new()
  S.ship_status(s, status({ destination = 'belt.7', progress = 0.2 }))
  eq(S.ship_status(s, status({ destination = 'belt.7', progress = 0.3 })), false)
end)

test('new charts that change nothing here are not a change', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ location = 'belt.7' }))
  eq(S.space_charts(s, CHARTS), false)
end)

test('odd-typed charts are ignored', function()
  local s = S.new()
  eq(S.space_charts(s, 'nope'), false)
  S.space_charts(s, { places = { 'x', { id = 3, kind = 'belt' } } })
  S.ship_status(s, status({ location = 'belt.7' }))
  eq(S.scene(s), 'parked')
end)

test('reset goes back to the station and forgets the charts', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ location = 'belt.7' }))
  eq(S.reset(s), true)
  eq(S.scene(s), 'station')
  S.ship_status(s, status({ location = 'belt.7' }))
  eq(S.scene(s), 'parked')
end)

t.done()
