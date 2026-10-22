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

test('searching when progress falls', function()
  local s = fresh()
  C.ship_status(s, { destination = 'gannet', progress = 0.6, eta = 100 }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0.1, eta = 100 }, 10)
  eq(C.ship(s).searching, 'gannet')
end)

test('searching when eta grows', function()
  local s = fresh()
  C.ship_status(s, { destination = 'gannet', progress = 0.5, eta = 100 }, 0)
  C.ship_status(s, { destination = 'gannet', progress = 0.5, eta = 200 }, 10)
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
  C.space_charts(s, charts({ system = 'vega' }))
  eq(C.ship(s).from, nil)
  eq(C.ship(s).searching, nil)
end)

test('status nil clears the ship', function()
  local s = fresh()
  C.ship_status(s, { docked = true, location = 'tiss' }, 0)
  eq(C.ship_status(s, nil, 1), true)
  eq(C.ship(s), nil)
  eq(C.ship_status(s, nil, 2), false)
end)

test('reset clears all and turns the chart off', function()
  local s = fresh()
  C.ship_status(s, { docked = true, location = 'tiss' }, 0)
  C.set_on(s, true)
  eq(C.reset(s), true)
  eq(C.charts(s), nil)
  eq(C.ship(s), nil)
  eq(C.on(s), false)
  eq(C.reset(s), false)
end)

test('set_on reports change', function()
  local s = C.new()
  eq(C.set_on(s, true), true)
  eq(C.set_on(s, true), false)
  eq(C.on(s), true)
end)

t.done()
