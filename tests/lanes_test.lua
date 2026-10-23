package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local N = require('station_map.lanes')
local test, eq = t.test, t.eq

local function mouth(here, there, open)
  return { id = 'mouth:' .. here .. ':' .. there, name = 'the ' .. there .. ' lane mouth', kind = 'mouth', open = open }
end

local function maelor(pm_open)
  return { system = 'maelor', places = {
    { id = 'wenna_halt', name = 'Wenna Halt', kind = 'station', open = nil },
    mouth('maelor', 'senara', true),
    mouth('maelor', 'elowen', true),
    mouth('maelor', 'petroc', pm_open),
  } }
end

local function senara()
  return { system = 'senara', places = {
    { id = 'tiss', name = 'T.I.S.S.', kind = 'station' },
    mouth('senara', 'maelor', true),
    mouth('senara', 'keyne', true),
  } }
end

test('a fresh state knows nothing and is off', function()
  local s = N.new()
  eq(N.message(s), { system = nil, visible = {}, seen = {}, transit = nil })
  eq(N.on(s), false)
end)

test('lane ids are the two stars sorted, as galaxy.yaml has them', function()
  eq(N.lane_of('mouth:senara:maelor'), { id = 'maelor-senara', here = 'senara', there = 'maelor' })
  eq(N.lane_of('mouth:petroc:maelor').id, 'maelor-petroc')
  eq(N.lane_of('mouth:keyne:mabyn').id, 'keyne-mabyn')
  eq(N.lane_of('tiss'), nil)
  eq(N.lane_of(nil), nil)
  eq(N.lane_of('mouth:senara'), nil)
end)

test('Space.Charts records each mouth here as seen now', function()
  local s = N.new()
  eq(N.space_charts(s, maelor(false), 100), true)
  local m = N.message(s)
  eq(m.system, 'maelor')
  eq(m.visible, { 'elowen-maelor', 'maelor-petroc', 'maelor-senara' })
  eq(m.seen['maelor-petroc'], { open = false, at = 100 })
  eq(m.seen['maelor-senara'], { open = true, at = 100 })
end)

test('a mouth with no open boolean is not a sighting', function()
  local s = N.new()
  local d = maelor(nil)
  d.places[2].open = 'yes'
  N.space_charts(s, d, 100)
  eq(N.message(s).seen['maelor-petroc'], nil)
  eq(N.message(s).seen['maelor-senara'], nil)
  eq(N.message(s).seen['elowen-maelor'], { open = true, at = 100 })
end)

test('the same charts again change nothing, a branch opening does', function()
  local s = N.new()
  N.space_charts(s, maelor(false), 100)
  eq(N.space_charts(s, maelor(false), 200), false)
  eq(N.space_charts(s, maelor(true), 300), true)
  eq(N.message(s).seen['maelor-petroc'], { open = true, at = 300 })
end)

test('leaving a system stamps its lanes with when you last saw them', function()
  local s = N.new()
  N.space_charts(s, maelor(false), 100)
  N.space_charts(s, senara(), 5000)
  local m = N.message(s)
  eq(m.system, 'senara')
  eq(m.visible, { 'keyne-senara', 'maelor-senara' })
  eq(m.seen['maelor-petroc'], { open = false, at = 5000 })
  eq(m.seen['maelor-senara'], { open = true, at = 5000 })
end)

test('junk charts are ignored', function()
  local s = N.new()
  eq(N.space_charts(s, nil, 1), false)
  eq(N.space_charts(s, 'x', 1), false)
  eq(N.space_charts(s, { system = 'senara', places = 'no' }, 1), true)
  eq(N.message(s).system, 'senara')
  eq(N.message(s).visible, {})
end)

test('in a lane by its status: the lane, which way and her timing', function()
  local s = N.new()
  N.space_charts(s, maelor(false), 100)
  eq(N.ship_status(s, { destination = 'mouth:maelor:senara', progress = 0.4, eta = 220,
    status = 'in the Maelor lane 40%' }, 500), true)
  eq(N.message(s).transit, { lane = 'maelor-senara', from = 'senara', to = 'maelor',
    progress = 0.4, eta = 220, received = 500 })
end)

test('in a lane by where she left from, with no status (a host)', function()
  local s = N.new()
  N.ship_status(s, { host = { location = 'mouth:senara:maelor' } }, 10)
  N.ship_status(s, { host = { destination = 'mouth:maelor:senara', progress = 0, eta = 300 } }, 20)
  eq(N.message(s).transit.lane, 'maelor-senara')
  eq(N.message(s).transit.to, 'maelor')
end)

test('flying to a mouth in the system is not being in its lane', function()
  local s = N.new()
  N.space_charts(s, senara(), 1)
  N.ship_status(s, { location = 'tiss' }, 10)
  N.ship_status(s, { destination = 'mouth:senara:maelor', progress = 0.2, eta = 90,
    status = '→ the Maelor lane mouth 20%' }, 20)
  eq(N.message(s).transit, nil)
end)

test('out of the lane, transit goes', function()
  local s = N.new()
  N.ship_status(s, { location = 'mouth:senara:maelor' }, 10)
  N.ship_status(s, { destination = 'mouth:maelor:senara', progress = 0.5, eta = 100 }, 20)
  eq(N.ship_status(s, { location = 'mouth:maelor:senara' }, 130), true)
  eq(N.message(s).transit, nil)
  eq(N.ship_status(s, nil, 140), false)
end)

test('a lane trip keeps its lane through statuses that drop the clue', function()
  local s = N.new()
  N.ship_status(s, { location = 'mouth:senara:maelor' }, 10)
  N.ship_status(s, { destination = 'mouth:maelor:senara', progress = 0.1, eta = 300 }, 20)
  N.ship_status(s, { destination = 'mouth:maelor:senara', progress = 0.5, eta = 160 }, 160)
  eq(N.message(s).transit.progress, 0.5)
end)

test('load takes stored sightings, and drops what is not one', function()
  local s = N.new()
  N.load(s, { ['maelor-petroc'] = { open = true, at = 7 }, ['keyne-mabyn'] = { open = 'x', at = 1 },
    bad = 3, ['keyne-senara'] = { open = false } })
  eq(N.message(s).seen, { ['maelor-petroc'] = { open = true, at = 7 } })
  N.load(s, 'junk')
  eq(N.message(s).seen, { ['maelor-petroc'] = { open = true, at = 7 } })
end)

test('saved is the sightings, to store', function()
  local s = N.new()
  N.space_charts(s, maelor(true), 100)
  eq(N.saved(s)['maelor-petroc'], { open = true, at = 100 })
end)

test('a disconnect forgets where you are, stamps what you saw, keeps the sightings', function()
  local s = N.new()
  N.space_charts(s, maelor(true), 100)
  N.ship_status(s, { location = 'mouth:maelor:senara' }, 110)
  eq(N.reset(s, 900), true)
  local m = N.message(s)
  eq(m.system, nil)
  eq(m.visible, {})
  eq(m.seen['maelor-petroc'], { open = true, at = 900 })
  eq(N.reset(s, 950), false)
end)

test('set_on reports a change only', function()
  local s = N.new()
  eq(N.set_on(s, true), true)
  eq(N.set_on(s, true), false)
  eq(N.on(s), true)
  eq(N.set_on(s, 'yes'), true)
  eq(N.on(s), false)
end)

t.done()
