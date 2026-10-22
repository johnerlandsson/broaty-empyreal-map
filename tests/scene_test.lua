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

test('docked, the station is the one she is docked at', function()
  local s = S.new()
  eq(S.station(s), nil)
  eq(S.ship_status(s, status({ docked = true, location = 'orrin_station' })), true)
  eq(S.scene(s), 'station')
  eq(S.station(s), 'orrin_station')
end)

test('undocked, there is no station', function()
  local s = S.new()
  S.ship_status(s, status({ location = 'orrin_station' }))
  eq(S.station(s), nil)
end)

test('docking at another station is a change', function()
  local s = S.new()
  S.ship_status(s, status({ docked = true, location = 'tiss' }))
  eq(S.ship_status(s, status({ docked = true, location = 'orrin_station' })), true)
  eq(S.ship_status(s, status({ docked = true, location = 'orrin_station' })), false)
end)

test('reset forgets the docked station', function()
  local s = S.new()
  S.ship_status(s, status({ docked = true, location = 'orrin_station' }))
  eq(S.reset(s), true)
  eq(S.station(s), nil)
end)

test("a crew member's Ship.Status, leaseLeft null, drives the scene as an owner's", function()
  -- The host's JSON null may arrive as a missing key or as a sentinel value; try both.
  local NULL = setmetatable({}, { __tostring = function() return 'null' end })
  local steps = {
    { docked = true, location = 'tiss' },
    { location = 'tiss' },
    { destination = 'belt.7', progress = 0.5 },
    { location = 'belt.7' },
    { docked = true, location = 'orrin_station' },
  }
  local owner, crew, crew_sentinel = S.new(), S.new(), S.new()
  for _, s in ipairs({ owner, crew, crew_sentinel }) do S.space_charts(s, CHARTS) end
  for _, step in ipairs(steps) do
    local o = status(step); o.leaseLeft = 3600
    local c = status(step); c.leaseLeft = nil
    local cs = status(step); cs.leaseLeft = NULL
    local changed = S.ship_status(owner, o)
    eq(S.ship_status(crew, c), changed)
    eq(S.ship_status(crew_sentinel, cs), changed)
    eq(S.scene(crew), S.scene(owner))
    eq(S.scene(crew_sentinel), S.scene(owner))
    eq(S.station(crew), S.station(owner))
    eq(S.station(crew_sentinel), S.station(owner))
  end
  eq(S.scene(owner), 'station')
  eq(S.station(crew), 'orrin_station')
end)

t.done()
