package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local S = require('station_map.scene')
local test, eq = t.test, t.eq

local CHARTS = { epoch = 0, system = 'sol', bodies = {
  { id = 'zennor', name = 'Zennor', kind = 'port' },
  { id = 'tamsin', name = 'Tamsin', kind = 'planet', radius = 400 },
}, places = {
  { id = 'tiss', name = 'T.I.S.S.', kind = 'station' },
  { id = 'zennor', name = 'Zennor', kind = 'station' },
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

test('over a port is port, and names it', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  eq(S.ship_status(s, status({ location = 'zennor' })), true)
  eq(S.scene(s), 'port')
  eq(S.port(s), 'zennor')
  eq(S.station(s), nil)
end)

test('landed at a port is the station, with no port overhead', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ docked = true, location = 'zennor' }))
  eq(S.scene(s), 'station')
  eq(S.port(s), nil)
end)

test('off a port, port is nil', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ location = 'tiss' }))
  eq(S.port(s), nil)
  S.ship_status(s, status({ destination = 'zennor' }))
  eq(S.port(s), nil)
end)

test('a host at rest over a port puts her guest over it too', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ docked = true, host = { docked = false, location = 'zennor' } }))
  eq(S.scene(s), 'port')
  eq(S.port(s), 'zennor')
end)

test('charts arriving after the status turn parked into port', function()
  local s = S.new()
  S.ship_status(s, status({ location = 'zennor' }))
  eq(S.scene(s), 'parked')
  eq(S.space_charts(s, CHARTS), true)
  eq(S.scene(s), 'port')
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

-- Docked at another ship (gmcp.md §8.2, 2026-10-22): her own `docked` is true and `location` null,
-- and `host` is where her host is, which is where she is.
local function riding(host)
  local h = { id = 'ship.98', name = 'Old Reliable', docked = false, location = nil, destination = nil, progress = nil, eta = nil }
  for k, v in pairs(host) do h[k] = v end
  return status({ name = 'Halfpenny', docked = true, location = nil, host = h })
end

test('riding a host under way is travelling, not the station', function()
  local s = S.new()
  S.ship_status(s, status({ docked = true, location = 'tiss' }))
  eq(S.ship_status(s, riding({ destination = 'tiss', progress = 0.64, eta = 79 })), true)
  eq(S.scene(s), 'travelling')
  eq(S.station(s), nil)
end)

test('riding a host at rest at a belt is the belt', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, riding({ location = 'belt.7' }))
  eq(S.scene(s), 'belt')
end)

test('riding a host at rest off a station is parked', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, riding({ location = 'tiss' }))
  eq(S.scene(s), 'parked')
  eq(S.station(s), nil)
end)

test('riding a host docked at a station is that station', function()
  local s = S.new()
  S.ship_status(s, riding({ docked = true, location = 'tiss' }))
  eq(S.scene(s), 'station')
  eq(S.station(s), 'tiss')
end)

test('the host arriving is a change; her progress ticking is not', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, riding({ destination = 'belt.7', progress = 0.2, eta = 90 }))
  eq(S.ship_status(s, riding({ destination = 'belt.7', progress = 0.3, eta = 80 })), false)
  eq(S.ship_status(s, riding({ location = 'belt.7' })), true)
  eq(S.scene(s), 'belt')
end)

test('a null or odd-typed host is no host', function()
  local s = S.new()
  S.ship_status(s, status({ docked = true, location = 'tiss', host = 'ship.98' }))
  eq(S.scene(s), 'station')
  eq(S.station(s), 'tiss')
  S.ship_status(s, status({ location = 'tiss', host = nil }))
  eq(S.scene(s), 'parked')
  local odd = riding({})
  odd.host.docked = 'yes'
  odd.host.location = 7
  odd.host.destination = {}
  S.ship_status(s, odd)
  eq(S.scene(s), 'parked')
  eq(S.station(s), nil)
end)

-- The station a dock or an undock is about (S.manoeuvre_at).

test('undocking from a station is about that station', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ docked = true, location = 'tiss' }))
  eq(S.manoeuvre_at(s, 'undock'), 'tiss')
  eq(S.manoeuvre_at(s, 'dock'), nil)
end)

test("docking from a station's approach is about that station", function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ location = 'orrin_station' }))
  eq(S.manoeuvre_at(s, 'dock'), 'orrin_station')
  eq(S.manoeuvre_at(s, 'undock'), nil)
end)

test("a port's landing and lift-off are about nothing: the ground has its own picture", function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ location = 'zennor' }))
  eq(S.manoeuvre_at(s, 'dock'), nil)
  S.ship_status(s, status({ docked = true, location = 'zennor' }))
  eq(S.manoeuvre_at(s, 'undock'), nil)
end)

test('at a belt, travelling or off a ship, nothing', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  eq(S.manoeuvre_at(s, 'dock'), nil)
  S.ship_status(s, status({ location = 'belt.7' }))
  eq(S.manoeuvre_at(s, 'dock'), nil)
  S.ship_status(s, status({ destination = 'belt.7' }))
  eq(S.manoeuvre_at(s, 'dock'), nil)
  eq(S.manoeuvre_at(s, 'travel'), nil)
end)

test('off a host docked at a station, the undock is about the station; off one in space, nothing', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, riding({ docked = true, location = 'tiss' }))
  eq(S.manoeuvre_at(s, 'undock'), 'tiss')
  S.ship_status(s, riding({ location = 'belt.7' }))
  eq(S.manoeuvre_at(s, 'undock'), nil)
end)

-- High orbit (Empyreal 2a84c78): Ship.Status's location is null there, as at a stop mid-trip.
local function to_tamsin(s)
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ location = 'tiss' }), 0)
  S.ship_status(s, status({ destination = 'tamsin', progress = 0, eta = 100 }), 1)
end

test('a trip to a planet that comes due and goes loose is high orbit over it', function()
  local s = S.new()
  to_tamsin(s)
  eq(S.ship_status(s, status({}), 101), true)
  eq(S.scene(s), 'orbit')
  eq(S.planet(s), 'tamsin')
  eq(S.port(s), nil)
  eq(S.station(s), nil)
end)

test('a status a few seconds short of the eta is still the arrival', function()
  local s = S.new()
  to_tamsin(s)
  S.ship_status(s, status({}), 97)
  eq(S.scene(s), 'orbit')
end)

test('loose well before the eta is a stop on the way, parked', function()
  local s = S.new()
  to_tamsin(s)
  S.ship_status(s, status({}), 40)
  eq(S.scene(s), 'parked')
  eq(S.planet(s), nil)
end)

test('a later eta (debris) moves the arrival with it', function()
  local s = S.new()
  to_tamsin(s)
  S.ship_status(s, status({ destination = 'tamsin', progress = 0.9, eta = 60 }), 90)
  S.ship_status(s, status({}), 110)
  eq(S.scene(s), 'parked')
end)

test('high orbit holds through later loose statuses, and ends with the next trip', function()
  local s = S.new()
  to_tamsin(s)
  S.ship_status(s, status({}), 101)
  eq(S.ship_status(s, status({}), 500), false)
  eq(S.scene(s), 'orbit')
  eq(S.ship_status(s, status({ destination = 'tiss', progress = 0, eta = 50 }), 600), true)
  eq(S.scene(s), 'travelling')
  eq(S.planet(s), nil)
end)

test('a trip to a station that comes due loose is not high orbit', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ destination = 'tiss', progress = 0, eta = 10 }), 0)
  S.ship_status(s, status({}), 10)
  eq(S.scene(s), 'parked')
end)

test('loaded with her already in high orbit, there is no trip to say so: parked', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({}), 0)
  eq(S.scene(s), 'parked')
end)

test('charts arriving after the arrival turn parked into orbit', function()
  local s = S.new()
  S.ship_status(s, status({ destination = 'tamsin', progress = 0, eta = 100 }), 1)
  S.ship_status(s, status({}), 101)
  eq(S.scene(s), 'parked')
  eq(S.space_charts(s, CHARTS), true)
  eq(S.scene(s), 'orbit')
end)

test('a host in high orbit puts her guest there too', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ docked = true, host = { destination = 'tamsin', progress = 0, eta = 100 } }), 0)
  S.ship_status(s, status({ docked = true, host = {} }), 100)
  eq(S.scene(s), 'orbit')
  eq(S.planet(s), 'tamsin')
end)

test('gaining a host forgets her own trip', function()
  local s = S.new()
  to_tamsin(s)
  S.ship_status(s, status({ docked = true, host = {} }), 101)
  eq(S.scene(s), 'parked')
end)

test('there is no docking from high orbit', function()
  local s = S.new()
  to_tamsin(s)
  S.ship_status(s, status({}), 101)
  eq(S.manoeuvre_at(s, 'dock'), nil)
end)

test('reset forgets the planets', function()
  local s = S.new()
  to_tamsin(s)
  S.ship_status(s, status({}), 101)
  S.reset(s)
  S.ship_status(s, status({ destination = 'tamsin', progress = 0, eta = 1 }), 0)
  S.ship_status(s, status({}), 1)
  eq(S.scene(s), 'parked')
end)

-- Her status says it: the hop from T.I.S.S. to Tamsin is 3 s, and in play no status came while
-- she was under way (2026-10-24): adrift off T.I.S.S., then "over Tamsin".
test('a status saying over a planet is high orbit, with no trip seen', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ location = 'tiss', status = 'at Tamsin International Space Station' }), 0)
  S.ship_status(s, status({ status = 'adrift' }), 3)
  eq(S.scene(s), 'parked')
  eq(S.ship_status(s, status({ status = 'over Tamsin' }), 165), true)
  eq(S.scene(s), 'orbit')
  eq(S.planet(s), 'tamsin')
end)

test('loaded with her already over a planet, the status says so', function()
  local s = S.new()
  S.ship_status(s, status({ status = 'over Tamsin' }), 0)
  eq(S.scene(s), 'parked') -- no charts yet to name it
  eq(S.space_charts(s, CHARTS), true)
  eq(S.scene(s), 'orbit')
  eq(S.planet(s), 'tamsin')
end)

test('over something the charts have no planet by that name for is parked', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ status = 'over Zennor' }), 0)
  eq(S.scene(s), 'parked')
end)

test('setting off from high orbit ends it, status and all', function()
  local s = S.new()
  S.space_charts(s, CHARTS)
  S.ship_status(s, status({ status = 'over Tamsin' }), 0)
  S.ship_status(s, status({ destination = 'tiss', progress = 0, eta = 3, status = 'over Tamsin' }), 1)
  eq(S.scene(s), 'travelling')
  S.ship_status(s, status({ location = 'tiss', status = 'at Tamsin International Space Station' }), 4)
  eq(S.scene(s), 'parked')
end)

t.done()
