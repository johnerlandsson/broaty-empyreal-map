package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local C = require('station_map.charts')
local test, eq = t.test, t.eq

local function charts(extra)
  local d = { epoch = 1000, system = 'sol', bodies = {
    { id = 'tiss', name = 'T.I.S.S.', kind = 'station',
      orbit = { parent = 'tamsin', a = 100, e = 0.1, peri = 10, phase = 20, period = 600 } },
  }, places = {
    { id = 'tiss', name = 'T.I.S.S.', kind = 'station' },
    { id = 'gannet', name = 'Gannet Belt', kind = 'belt',
      orbit = { parent = 'tamsin', a = 5000, period = 9000 },
      fit = { seen = 1, error = 2600, at = 3 } },
    { id = 'mouth:senara:maelor', name = 'Maelor', kind = 'mouth' },
  } }
  for k, v in pairs(extra or {}) do d[k] = v end
  return d
end

local function fresh()
  local s = C.new()
  C.space_charts(s, charts())
  return s
end

test('a fresh state is empty and off', function()
  local s = C.new()
  eq(C.charts(s), nil)
  eq(C.ship(s), nil)
  eq(C.on(s), false)
end)

test('cleans orbits, fits, edges and places', function()
  local s = C.new()
  eq(C.space_charts(s, charts({ places = {
    { id = 'a', name = 'A', kind = 'belt', orbit = { a = 1, period = 5 } },
    { id = 'b', name = 'B', kind = 'belt', orbit = { parent = 'x', a = 1, period = 0 } },
    { id = 'c', name = 'C', kind = 'belt', orbit = { parent = 'x', a = 1, period = 5 } },
    { name = 'no id', kind = 'belt' },
    { id = 'd', name = 'D', kind = 'belt', fit = { seen = 1, error = 'x', at = 3 } },
    { id = 'm', name = 'M', kind = 'mouth', edge = { r = 15000, bearing = 90, at = 5 } },
    { id = 'n', name = 'N', kind = 'mouth', edge = { r = 15000, bearing = 90 } },
  } })), true)
  local p = C.charts(s).places
  eq(#p, 6)
  eq(p[1].orbit, nil)
  eq(p[2].orbit, nil)
  eq(p[3].orbit, { parent = 'x', a = 1, e = 0, peri = 0, phase = 0, period = 5 })
  eq(p[4].fit, nil)
  eq(p[5].edge, { r = 15000, bearing = 90, at = 5 })
  eq(p[6].edge, nil)
  eq(C.charts(s).bodies[1].orbit.e, 0.1)
  eq(C.charts(s).epoch, 1000)
end)

test('a mouth keeps open, a boolean only', function()
  local s = C.new()
  C.space_charts(s, charts({ places = {
    { id = 'mouth:petroc:maelor', name = 'the Maelor lane mouth', kind = 'mouth', open = false },
    { id = 'mouth:petroc:keyne', name = 'the Keyne lane mouth', kind = 'mouth', open = true },
    { id = 'tiss', name = 'T.I.S.S.', kind = 'station', open = 'yes' },
  } }))
  local p = C.charts(s).places
  eq(p[1].open, false)
  eq(p[2].open, true)
  eq(p[3].open, nil)
  -- a branch closing is a change to the charts
  eq(C.space_charts(s, charts({ places = {
    { id = 'mouth:petroc:maelor', name = 'the Maelor lane mouth', kind = 'mouth', open = true },
    { id = 'mouth:petroc:keyne', name = 'the Keyne lane mouth', kind = 'mouth', open = true },
    { id = 'tiss', name = 'T.I.S.S.', kind = 'station', open = 'yes' },
  } })), true)
end)

test('same charts again is not a change', function()
  local s = fresh()
  eq(C.space_charts(s, charts()), false)
end)

test('charts not a table changes nothing', function()
  local s = fresh()
  eq(C.space_charts(s, 'x'), false)
  eq(C.charts(s).system, 'sol')
end)

test('received is now', function()
  local s = fresh()
  C.ship_status(s, { docked = true, location = 'tiss' }, 100)
  eq(C.ship(s).received, 100)
end)

test('from is where she was', function()
  local s = fresh()
  C.ship_status(s, { docked = true, location = 'tiss' }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0, eta = 300 }, 1)
  eq(C.ship(s).from, 'tiss')
  local u = fresh()
  C.ship_status(u, { location = 'gannet' }, 0)
  C.ship_status(u, { destination = 'orrin_station', progress = 0, eta = 300 }, 1)
  eq(C.ship(u).from, 'gannet')
end)

test('first status already under way has no from', function()
  local s = fresh()
  C.ship_status(s, { destination = 'gannet', progress = 0.5, eta = 100 }, 0)
  eq(C.ship(s).from, nil)
end)

test('a new destination mid-flight has no from', function()
  local s = fresh()
  C.ship_status(s, { location = 'tiss' }, 0)
  C.ship_status(s, { destination = 'a', progress = 0.1, eta = 100 }, 1)
  C.ship_status(s, { destination = 'b', progress = 0, eta = 100 }, 2)
  eq(C.ship(s).from, nil)
end)

test('from holds through the trip', function()
  local s = fresh()
  C.ship_status(s, { location = 'tiss' }, 0)
  C.ship_status(s, { destination = 'a', progress = 0.1, eta = 100 }, 1)
  C.ship_status(s, { destination = 'a', progress = 0.2, eta = 90 }, 11)
  eq(C.ship(s).from, 'tiss')
end)

test('a point is remembered', function()
  local s = fresh()
  C.ship_status(s, { destination = 'pt:tamsin:1500:-2000', progress = 0.9, eta = 5 }, 0)
  C.ship_status(s, { docked = false }, 6)
  eq(C.ship(s).point, 'pt:tamsin:1500:-2000')
  C.ship_status(s, { destination = 'tiss', progress = 0, eta = 100 }, 20)
  eq(C.ship(s).from, 'pt:tamsin:1500:-2000')
  eq(C.ship(s).point, nil)
end)

test('searching when progress falls once the leg is due', function()
  local s = fresh()
  C.ship_status(s, { destination = 'gannet', progress = 0.98, eta = 4 }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0.1, eta = 100 }, 4)
  eq(C.ship(s).searching, 'gannet')
end)

test('searching when eta grows once the leg is due', function()
  local s = fresh()
  C.ship_status(s, { destination = 'gannet', progress = 0.95, eta = 8 }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0, eta = 200 }, 5)
  eq(C.ship(s).searching, 'gannet')
  local u = fresh()
  C.ship_status(u, { destination = 'gannet', progress = 0.5, eta = 100 }, 0)
  C.ship_status(u, { destination = 'gannet', progress = 0.6, eta = 90 }, 10)
  eq(C.ship(u).searching, nil)
end)

test('a sweep is searching', function()
  local s = fresh()
  C.ship_status(s, { destination = 'gannet', progress = 0.9, eta = 10 }, 0)
  C.ship_status(s, { docked = false }, 11)
  eq(C.ship(s).searching, 'gannet')
  C.ship_status(s, { destination = 'gannet', progress = 0, eta = 80 }, 20)
  eq(C.ship(s).searching, 'gannet')
  C.ship_status(s, { location = 'gannet' }, 99)
  eq(C.ship(s).searching, nil)
end)

test('a trip to a station that ends loose is not searching', function()
  local s = fresh()
  C.ship_status(s, { destination = 'tiss', progress = 0.9, eta = 10 }, 0)
  C.ship_status(s, { docked = false }, 11)
  eq(C.ship(s).searching, nil)
end)

test('host fields win', function()
  local s = fresh()
  C.ship_status(s, { docked = true, host = { docked = false, destination = 'gannet', progress = 0.2, eta = 50 } }, 0)
  eq(C.ship(s).destination, 'gannet')
end)

test('gaining or losing host clears from, point and searching', function()
  local s = fresh()
  C.ship_status(s, { location = 'tiss' }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0.9, eta = 10 }, 1)
  C.ship_status(s, { docked = false }, 12)
  eq(C.ship(s).searching, 'gannet')
  C.ship_status(s, { docked = true, host = { docked = false } }, 13)
  eq(C.ship(s).searching, nil)
  local u = fresh()
  C.ship_status(u, { location = 'tiss' }, 0)
  C.ship_status(u, { destination = 'gannet', progress = 0.1, eta = 100 }, 1)
  eq(C.ship(u).from, 'tiss')
  C.ship_status(u, { docked = true, host = { destination = 'gannet', progress = 0.2, eta = 90 } }, 2)
  eq(C.ship(u).from, nil)
end)

test('a new system drops from, point and searching', function()
  local s = fresh()
  C.ship_status(s, { location = 'tiss' }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0.1, eta = 100 }, 1)
  eq(C.ship(s).from, 'tiss')
  C.space_charts(s, charts({ system = 'vega', bodies = {}, places = {
    { id = 'vega_halt', name = 'Vega Halt', kind = 'station' },
  } }))
  eq(C.ship(s).from, nil)
  eq(C.ship(s).searching, nil)
end)

-- Ship.Status comes before Space.Charts in the game's refresh (gmcp.ts), so out of a lane her
-- status at the far mouth lands while the charts are still the old system's.
local function maelor()
  return charts({ system = 'maelor', bodies = {
    { id = 'wenna_halt', name = 'Wenna Halt', kind = 'station',
      orbit = { parent = 'wenna', a = 700, period = 9000 } },
  }, places = {
    { id = 'wenna_halt', name = 'Wenna Halt', kind = 'station' },
    { id = 'mouth:maelor:senara', name = 'the Senara lane mouth', kind = 'mouth',
      edge = { r = 15000, bearing = 263, at = 5 } },
  } })
end

test('out of a lane, her first trip starts from the far mouth', function()
  local s = fresh()
  C.ship_status(s, { location = 'mouth:senara:maelor' }, 0)
  C.ship_status(s, { destination = 'mouth:maelor:senara', progress = 0, eta = 380 }, 1)
  C.ship_status(s, { location = 'mouth:maelor:senara' }, 381) -- before the new system's charts
  C.space_charts(s, maelor())
  C.ship_status(s, { destination = 'wenna_halt', progress = 0, eta = 600 }, 390)
  eq(C.ship(s).from, 'mouth:maelor:senara')
end)

test('a new system keeps a point in a frame it has', function()
  local s = fresh()
  C.ship_status(s, { destination = 'pt:wenna:100:200', progress = 0.9, eta = 2 }, 0)
  C.ship_status(s, { location = nil }, 2)
  eq(C.ship(s).point, 'pt:wenna:100:200')
  C.space_charts(s, maelor())
  eq(C.ship(s).point, nil) -- wenna is no body or place of this fixture: dropped
  local s2 = fresh()
  C.ship_status(s2, { destination = 'pt:tiss:1:2', progress = 0.9, eta = 2 }, 0)
  C.ship_status(s2, { location = nil }, 2)
  C.space_charts(s2, charts({ system = 'sol2' })) -- tiss is still there
  eq(C.ship(s2).point, 'pt:tiss:1:2')
end)

test('status nil clears the ship', function()
  local s = fresh()
  C.ship_status(s, { docked = true, location = 'tiss' }, 0)
  eq(C.ship_status(s, nil, 1), true)
  eq(C.ship(s), nil)
  eq(C.ship_status(s, nil, 2), false)
end)

test('reset clears the charts and the ship and keeps the chart on', function()
  local s = fresh()
  C.ship_status(s, { docked = true, location = 'tiss' }, 0)
  C.set_on(s, true)
  eq(C.reset(s), true)
  eq(C.charts(s), nil)
  eq(C.ship(s), nil)
  eq(C.on(s), true)
  eq(C.reset(s), false)
end)

test('set_on reports change', function()
  local s = C.new()
  eq(C.set_on(s, true), true)
  eq(C.set_on(s, true), false)
  eq(C.on(s), true)
end)

test('a debris delay on a belt trip is not a search', function()
  local s = fresh()
  C.ship_status(s, { location = 'tiss' }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0.5, eta = 100 }, 100)
  -- the game puts her arrival back 40 s: eta grows, progress falls
  C.ship_status(s, { destination = 'gannet', progress = 0.42, eta = 130 }, 110)
  eq(C.ship(s).searching, nil)
  eq(C.ship(s).from, 'tiss')
  C.ship_status(s, { destination = 'gannet', progress = 0.47, eta = 120 }, 120)
  eq(C.ship(s).searching, nil)
end)

test('a stop mid-trip to a point is not remembered', function()
  local s = fresh()
  C.ship_status(s, { location = 'tiss' }, 0)
  C.ship_status(s, { destination = 'pt:tamsin:1500:-2000', progress = 0.3, eta = 200 }, 1)
  C.ship_status(s, { docked = false }, 11)
  eq(C.ship(s).point, nil)
  eq(C.ship(s).searching, nil)
end)

test('a stop mid-trip to a belt is not a search', function()
  local s = fresh()
  C.ship_status(s, { location = 'tiss' }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0.3, eta = 200 }, 1)
  C.ship_status(s, { docked = false }, 11)
  eq(C.ship(s).searching, nil)
  eq(C.ship(s).point, nil)
end)

test('a real miss: the leg comes due, then a new leg or a sweep', function()
  local s = fresh()
  C.ship_status(s, { location = 'tiss' }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0.99, eta = 1 }, 299)
  C.ship_status(s, { destination = 'gannet', progress = 0, eta = 60 }, 300)
  eq(C.ship(s).searching, 'gannet')
  local u = fresh()
  C.ship_status(u, { location = 'tiss' }, 0)
  C.ship_status(u, { destination = 'gannet', progress = 0.99, eta = 1 }, 299)
  C.ship_status(u, { docked = false }, 300)
  eq(C.ship(u).searching, 'gannet')
end)

test('a stop once she is searching keeps the search', function()
  local s = fresh()
  C.ship_status(s, { destination = 'gannet', progress = 0.99, eta = 1 }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0, eta = 60 }, 1)
  C.ship_status(s, { docked = false }, 20)
  eq(C.ship(s).searching, 'gannet')
end)

test('depart is the first status of the trip, kept as progress rounds', function()
  local s = fresh()
  C.ship_status(s, { docked = true, location = 'tiss' }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0, eta = 300 }, 1)
  eq(C.ship(s).depart, 1)
  C.ship_status(s, { destination = 'gannet', progress = 0.9, eta = 30 }, 271)
  eq(C.ship(s).depart, 1)
  C.ship_status(s, { destination = 'gannet', progress = 0.99, eta = 2 }, 299)
  eq(C.ship(s).depart, 1)
  C.ship_status(s, { destination = 'gannet', progress = 1, eta = 0 }, 301)
  eq(C.ship(s).depart, 1)
  C.ship_status(s, { location = 'gannet' }, 302)
  eq(C.ship(s).depart, nil)
  C.ship_status(s, { destination = 'tiss', progress = 0, eta = 300 }, 400)
  eq(C.ship(s).depart, 400)
end)

test('depart is worked out from a first status already under way', function()
  local s = fresh()
  C.ship_status(s, { destination = 'gannet', progress = 0.5, eta = 100 }, 1000)
  eq(C.ship(s).depart, 900)
  C.ship_status(s, { destination = 'gannet', progress = 0.6, eta = 79 }, 1021)
  eq(C.ship(s).depart, 900)
  -- a debris delay doesn't move her departure
  C.ship_status(s, { destination = 'gannet', progress = 0.55, eta = 109 }, 1031)
  eq(C.ship(s).depart, 900)
end)

test('depart starts again with a new search leg', function()
  local s = fresh()
  C.ship_status(s, { destination = 'gannet', progress = 0, eta = 300 }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0.99, eta = 1 }, 299)
  C.ship_status(s, { destination = 'gannet', progress = 0, eta = 60 }, 300)
  eq(C.ship(s).depart, 300)
end)

test('no depart without a progress short of 1', function()
  local s = fresh()
  C.ship_status(s, { destination = 'gannet', progress = 1, eta = 0 }, 10)
  eq(C.ship(s).depart, nil)
  C.ship_status(s, { destination = 'gannet', eta = 50 }, 11)
  eq(C.ship(s).depart, nil)
end)

test('her name is kept', function()
  local s = fresh()
  C.ship_status(s, { name = 'Mule', docked = true, location = 'tiss' }, 0)
  eq(C.ship(s).name, 'Mule')
  C.ship_status(s, { name = 'Mule', docked = true, host = { name = 'Barge', docked = false } }, 1)
  eq(C.ship(s).name, 'Mule')
  C.ship_status(s, { name = 7, docked = true }, 2)
  eq(C.ship(s).name, nil)
end)

test('a point is cleared when a location arrives or she docks', function()
  local s = fresh()
  C.ship_status(s, { destination = 'pt:tamsin:1500:-2000', progress = 0.9, eta = 5 }, 0)
  C.ship_status(s, { docked = false }, 6)
  eq(C.ship(s).point, 'pt:tamsin:1500:-2000')
  C.ship_status(s, { docked = false, location = 'gannet' }, 7)
  eq(C.ship(s).point, nil)
  local u = fresh()
  C.ship_status(u, { destination = 'pt:tamsin:1500:-2000', progress = 0.9, eta = 5 }, 0)
  C.ship_status(u, { docked = false }, 6)
  C.ship_status(u, { docked = true, location = 'tiss' }, 7)
  eq(C.ship(u).point, nil)
end)

test('a point holds through later loose statuses', function()
  local s = fresh()
  C.ship_status(s, { destination = 'pt:tamsin:1500:-2000', progress = 0.9, eta = 5 }, 0)
  C.ship_status(s, { docked = false }, 6)
  C.ship_status(s, { docked = false }, 60)
  eq(C.ship(s).point, 'pt:tamsin:1500:-2000')
end)

test('searching ends on docking or a destination that is not a belt', function()
  local s = fresh()
  C.ship_status(s, { destination = 'gannet', progress = 0.9, eta = 1 }, 0)
  C.ship_status(s, { docked = false }, 1)
  eq(C.ship(s).searching, 'gannet')
  C.ship_status(s, { docked = true, location = 'tiss' }, 2)
  eq(C.ship(s).searching, nil)
  local u = fresh()
  C.ship_status(u, { destination = 'gannet', progress = 0.9, eta = 1 }, 0)
  C.ship_status(u, { docked = false }, 1)
  C.ship_status(u, { destination = 'tiss', progress = 0, eta = 100 }, 2)
  eq(C.ship(u).searching, nil)
end)

test('a point is dropped when she gains a host', function()
  local s = fresh()
  C.ship_status(s, { destination = 'pt:tamsin:1500:-2000', progress = 0.9, eta = 5 }, 0)
  C.ship_status(s, { docked = false }, 6)
  C.ship_status(s, { docked = true, host = { docked = false } }, 7)
  eq(C.ship(s).point, nil)
end)

-- A stop mid-trip (`stop` or `hold`, before the leg is due): the game leaves her at rest where
-- she was along the line and sends only "adrift". The trip she stopped on is kept as `stop`, so
-- the panel can place her, and her next trip starts from it.
local function stopped_on_the_way()
  local s = fresh()
  C.ship_status(s, { location = 'tiss' }, 0)
  C.ship_status(s, { destination = 'mouth:senara:maelor', progress = 0, eta = 800 }, 1)
  C.ship_status(s, { destination = 'mouth:senara:maelor', progress = 0.5, eta = 400 }, 401)
  C.ship_status(s, { status = 'adrift' }, 402)
  return s
end

test('a stop mid-trip keeps the trip she stopped on', function()
  local s = stopped_on_the_way()
  eq(C.ship(s).stop, { from = 'tiss', destination = 'mouth:senara:maelor', depart = 1, arrive = 801, at = 402 })
  eq(C.ship(s).point, nil)
  eq(C.ship(s).from, nil)
end)

test('her stop holds while she is adrift', function()
  local s = stopped_on_the_way()
  C.ship_status(s, { status = 'adrift' }, 500)
  eq(C.ship(s).stop.at, 402)
end)

test('the next trip starts from her stop', function()
  local s = stopped_on_the_way()
  C.ship_status(s, { destination = 'mouth:senara:maelor', progress = 0, eta = 266 }, 404)
  eq(C.ship(s).from, nil)
  eq(C.ship(s).stop.from, 'tiss')
  C.ship_status(s, { destination = 'mouth:senara:maelor', progress = 0.2, eta = 213 }, 457)
  eq(C.ship(s).stop.at, 402)
end)

test('a second stop keeps the first inside it', function()
  local s = stopped_on_the_way()
  C.ship_status(s, { destination = 'gannet', progress = 0, eta = 100 }, 404)
  C.ship_status(s, { status = 'adrift' }, 430)
  local st = C.ship(s).stop
  eq(st.destination, 'gannet')
  eq(st.from, nil)
  eq(st.stop.from, 'tiss')
  eq(st.at, 430)
end)

test('stops nest only so deep', function()
  local s = stopped_on_the_way()
  local t0 = 404
  for i = 1, 6 do
    C.ship_status(s, { destination = 'gannet', progress = 0, eta = 100 }, t0)
    C.ship_status(s, { status = 'adrift' }, t0 + 10)
    t0 = t0 + 20
  end
  local depth, st = 0, C.ship(s).stop
  while st do depth, st = depth + 1, st.stop end
  eq(depth <= 4, true)
end)

test('a stop with no start to it keeps nothing', function()
  local s = fresh()
  C.ship_status(s, { destination = 'mouth:senara:maelor', progress = 0.5, eta = 400 }, 1) -- panel started mid-trip
  C.ship_status(s, { status = 'adrift' }, 2)
  eq(C.ship(s).stop, nil)
end)

test('arriving somewhere drops her stop', function()
  local s = stopped_on_the_way()
  C.ship_status(s, { destination = 'tiss', progress = 0, eta = 10 }, 404)
  C.ship_status(s, { location = 'tiss' }, 414)
  eq(C.ship(s).stop, nil)
  eq(C.ship(s).from, nil)
end)

test('a trip that comes due and goes loose is no stop', function()
  local s = fresh()
  C.ship_status(s, { location = 'tiss' }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0, eta = 100 }, 1)
  C.ship_status(s, { status = 'adrift' }, 101)
  eq(C.ship(s).stop, nil)
end)

test('a new system drops a stop it has no place for', function()
  local s = stopped_on_the_way()
  C.space_charts(s, charts({ system = 'maelor', bodies = {}, places = {
    { id = 'wenna_halt', name = 'Wenna Halt', kind = 'station' },
  } }))
  eq(C.ship(s).stop, nil)
end)

t.done()
