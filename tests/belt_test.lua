package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local B = require('station_map.belt')
local test, eq = t.test, t.eq

-- Ship.Status at a belt, as gmcp.ts beltGmcp sends it.
local function at(id, x, y, extra)
  local km = math.floor(math.sqrt(x * x + y * y) * 10 + 0.5) / 10
  local bearing = (math.floor(math.deg(math.atan(x, y)) + 0.5) + 360) % 360
  local s = { name = 'Mule', docked = false, location = id, destination = nil, host = nil,
    belt = { x = x, y = y, radius = 18, core_km = km, core_bearing = bearing } }
  for k, v in pairs(extra or {}) do s[k] = v end
  return s
end

-- A skiff docked at her freighter at a belt: her own belt null, the host's location the belt.
local function riding(id)
  return { name = 'Mule', docked = true, location = nil, belt = nil,
    host = { id = 'ship.7', name = 'Full Measure', docked = false, location = id, destination = nil } }
end

local CHARTS = { system = 'senara', places = {
  { id = 'tiss', name = 'T.I.S.S.', kind = 'station' },
  { id = 'gannet-3', name = 'Gannet Belt', kind = 'belt' },
  { id = 'cinders-2', name = 'The Cinders', kind = 'belt' },
} }

local function sensors(busy, left, kinds)
  local att = {}
  for i, k in ipairs(kinds or {}) do att[i] = { id = 'a' .. i, kind = k } end
  return { devices = {
    { id = 'nav', busy = nil, left = nil, attachments = {} },
    { id = 'sensors', busy = busy, left = left, attachments = att },
  } }
end

test('a fresh state is nowhere, knows no belts and is off', function()
  local s = B.new()
  eq(B.message(s), { log = { track = {}, sweeps = {} } })
  eq(B.on(s), false)
  eq(B.saved(s), {})
end)

test('Ship.Status at a belt gives her place in it, named from the charts', function()
  local s = B.new()
  B.space_charts(s, CHARTS)
  eq(B.ship_status(s, at('gannet-3', -5.5, -9.5), 100), true)
  local m = B.message(s)
  eq(m.id, 'gannet-3')
  eq(m.name, 'Gannet Belt')
  eq(m.radius, 18)
  eq(m.place, { x = -5.5, y = -9.5, km = 11, bearing = 210 })
end)

test('null, odd and partial belts are no place, and never throw', function()
  local s = B.new()
  for _, data in ipairs({ nil, 'x', 42, {}, { belt = 'x' }, { location = 'gannet-3', belt = {} },
    { location = 'gannet-3', belt = { x = 'a', y = 1, radius = 18 } },
    { location = 'gannet-3', belt = { x = 0 / 0, y = 1, radius = 18 } },
    { location = 'gannet-3', belt = { x = 1, y = 1, radius = -3 } },
    { location = 'gannet-3', belt = { x = math.huge, y = 1, radius = 18 } },
    { location = 42, belt = { x = 1, y = 1, radius = 18 } },
    { host = 'x', belt = { x = 1, y = 1, radius = 18 } } }) do
    B.ship_status(s, data, 1)
    eq(B.message(s).place, nil)
  end
  B.ship_devices(s, 'nope', 1)
  B.ship_devices(s, { devices = 'x' }, 1)
  B.ship_devices(s, { devices = { 'x', { id = 3 } } }, 1)
  B.space_charts(s, 'x')
  B.space_charts(s, { places = { 'x', { kind = 'belt' } } })
  B.load(s, 'x')
  eq(B.saved(s), {})
end)

test('a missing core_km and bearing are worked out from x and y', function()
  local s = B.new()
  B.ship_status(s, { location = 'gannet-3', belt = { x = 3, y = 4, radius = 18 } }, 1)
  eq(B.message(s).place, { x = 3, y = 4, km = 5, bearing = 37 })
end)

test('the same status again changes nothing', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 1, 2), 1)
  eq(B.ship_status(s, at('gannet-3', 1, 2), 2), false)
end)

test('leaving the belt is no place, and her track stays', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 1, 2), 1)
  eq(B.ship_status(s, { name = 'Mule', location = nil, destination = 'tiss', belt = nil }, 2), true)
  local m = B.message(s)
  eq(m.id, nil)
  eq(m.place, nil)
  eq(B.saved(s)['gannet-3'].track, { { { 1, 2 } } })
end)

test('her track gathers each place she has been, a straight run as one line', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 0, 0), 1)
  B.ship_status(s, at('gannet-3', 0.2, 0), 2)
  B.ship_status(s, at('gannet-3', 0.5, 0), 3)
  B.ship_status(s, at('gannet-3', 1, 0), 4)
  B.ship_status(s, at('gannet-3', 1, 1), 9)
  eq(B.message(s).log.track, { { { 0, 0 }, { 1, 0 }, { 1, 1 } } })
end)

test('a tenth of a km off the line is still the line; a turn is kept', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 0, 0), 1)
  B.ship_status(s, at('gannet-3', 1, 0.1), 2)
  B.ship_status(s, at('gannet-3', 2, 0), 3)
  eq(B.message(s).log.track, { { { 0, 0 }, { 2, 0 } } })
  B.ship_status(s, at('gannet-3', 1, 0), 4) -- back the way she came
  eq(B.message(s).log.track, { { { 0, 0 }, { 2, 0 }, { 1, 0 } } })
end)

test('each visit is its own stretch of track', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 1, 1), 1)
  B.ship_status(s, { location = nil, destination = 'tiss' }, 2)
  B.ship_status(s, at('gannet-3', -4, 6), 3)
  eq(B.message(s).log.track, { { { 1, 1 } }, { { -4, 6 } } })
end)

test('arriving cues the view, once; moving within the belt does not', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 0, 0), 100)
  eq(B.take_cue(s), 'arrived')
  eq(B.take_cue(s), nil)
  B.ship_status(s, at('gannet-3', 0.2, 0), 110)
  eq(B.take_cue(s), nil)
  B.ship_status(s, { location = nil, destination = 'tiss' }, 120)
  B.ship_status(s, at('cinders-2', 1, 1), 200)
  eq(B.take_cue(s), 'arrived')
end)

test('a sweep run to its end is logged where she is as it ends, with the stock range', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 3, 4), 100)
  B.ship_devices(s, sensors(nil, nil, {}), 100)
  eq(B.message(s).array, false)
  B.ship_devices(s, sensors('scan', 10, {}), 100)
  eq(B.message(s).log.sweeps, {})
  eq(B.ship_devices(s, sensors(nil, nil, {}), 110), true)
  eq(B.message(s).log.sweeps, { { x = 3, y = 4, r = 5 } })
end)

test('with a sensor array the range is not known, so a sweep has none', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 3, 4), 100)
  B.ship_devices(s, sensors('scan', 10, { 'sensor_array' }), 100)
  eq(B.message(s).array, true)
  B.ship_devices(s, sensors(nil, nil, { 'sensor_array' }), 110)
  eq(B.message(s).log.sweeps, { { x = 3, y = 4 } })
end)

test('a sweep stopped short is not logged', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 3, 4), 100)
  B.ship_devices(s, sensors('scan', 10, {}), 100)
  B.ship_devices(s, sensors(nil, nil, {}), 104)
  eq(B.message(s).log.sweeps, {})
end)

test('back-to-back sweeps, as a program makes, each log', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 3, 4), 100)
  B.ship_devices(s, sensors('scan', 10, {}), 100)
  B.ship_devices(s, sensors('scan', 10, {}), 110) -- the next one, ending later
  B.ship_devices(s, sensors('scan', 9, {}), 111) -- its end resent, a second either way
  B.ship_devices(s, sensors(nil, nil, {}), 120)
  eq(#B.message(s).log.sweeps, 2)
end)

test('a sweep that ends off the belt is not logged', function()
  local s = B.new()
  B.ship_devices(s, sensors('scan', 10, {}), 100)
  B.ship_devices(s, sensors(nil, nil, {}), 110)
  eq(B.saved(s), {})
end)

test('stepping off her forgets the sweep under way', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 3, 4), 100)
  B.ship_devices(s, sensors('scan', 10, {}), 100)
  B.ship_status(s, nil, 105)
  B.ship_status(s, at('gannet-3', 3, 4), 106)
  B.ship_devices(s, sensors(nil, nil, {}), 110)
  eq(B.message(s).log.sweeps, {})
end)

test('riding a host at a belt: the belt, its log, no place of her own', function()
  local s = B.new()
  B.space_charts(s, CHARTS)
  B.ship_status(s, at('gannet-3', 2, 2), 50) -- an earlier visit gives the belt's radius
  B.ship_status(s, riding('gannet-3'), 100)
  local m = B.message(s)
  eq(m.id, 'gannet-3')
  eq(m.place, nil)
  eq(m.host, 'Full Measure')
  eq(m.radius, 18)
end)

test('riding a host somewhere that is not a belt is no belt', function()
  local s = B.new()
  B.space_charts(s, CHARTS)
  B.ship_status(s, riding('tiss'), 100)
  eq(B.message(s).id, nil)
  local travelling = riding('gannet-3')
  travelling.host.destination = 'tiss'
  B.ship_status(s, travelling, 101)
  eq(B.message(s).id, nil)
end)

test('undocking from a host at the belt marks where she left it, as her first place', function()
  local s = B.new()
  B.space_charts(s, CHARTS)
  B.ship_status(s, riding('gannet-3'), 100)
  B.take_cue(s)
  B.ship_status(s, at('gannet-3', 7.2, 5.1), 130)
  local m = B.message(s)
  eq(m.log.left, { x = 7.2, y = 5.1, name = 'Full Measure', at = 130 })
  eq(m.log.track, { { { 7.2, 5.1 } } })
  eq(B.take_cue(s), nil) -- she was already at the belt
  -- she moves off; the mark stays where it was
  B.ship_status(s, at('gannet-3', 0, 0), 200)
  eq(B.message(s).log.left.x, 7.2)
end)

test('docking back at her host clears the mark', function()
  local s = B.new()
  B.space_charts(s, CHARTS)
  B.ship_status(s, riding('gannet-3'), 100)
  B.ship_status(s, at('gannet-3', 7.2, 5.1), 130)
  B.ship_status(s, riding('gannet-3'), 200)
  eq(B.message(s).log.left, nil)
end)

test('undocking from a host that is travelling marks nothing', function()
  local s = B.new()
  B.space_charts(s, CHARTS)
  local t2 = riding('gannet-3')
  t2.host.destination = 'tiss'
  B.ship_status(s, t2, 100)
  B.ship_status(s, at('gannet-3', 1, 1), 130)
  eq(B.message(s).log.left, nil)
end)

test('a belt gone from its system\'s charts loses its log; another system\'s charts leave it be', function()
  local s = B.new()
  B.space_charts(s, CHARTS)
  B.ship_status(s, at('gannet-3', 1, 1), 1)
  B.ship_status(s, { location = nil, destination = 'mouth:senara:maelor' }, 2)
  eq(B.space_charts(s, { system = 'maelor', places = { { id = 'kestrel-1', name = 'Kestrel Belt', kind = 'belt' } } }), false)
  eq(B.saved(s)['gannet-3'] ~= nil, true)
  B.space_charts(s, CHARTS)
  eq(B.saved(s)['gannet-3'] ~= nil, true)
  eq(B.space_charts(s, { system = 'senara', places = { { id = 'cinders-2', name = 'The Cinders', kind = 'belt' } } }), false)
  eq(B.saved(s)['gannet-3'], nil)
  eq(B.take_unsaved(s), true)
end)

test('the belt she is at closing posts; its name coming in posts', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 1, 1), 1)
  eq(B.space_charts(s, CHARTS), true) -- her belt's name
  eq(B.message(s).name, 'Gannet Belt')
  eq(B.space_charts(s, CHARTS), false)
  eq(B.space_charts(s, { system = 'senara', places = {} }), true)
  eq(B.message(s).log, { track = {}, sweeps = {} })
end)

test('the sensors fitted change the message only at a belt', function()
  local s = B.new()
  eq(B.ship_devices(s, sensors(nil, nil, { 'sensor_array' }), 1), false)
  B.ship_status(s, at('gannet-3', 1, 1), 2)
  eq(B.ship_devices(s, sensors(nil, nil, {}), 3), true)
end)

test('a log from before the charts takes its system from the first charts that list it', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 1, 1), 1)
  B.space_charts(s, CHARTS)
  eq(B.saved(s)['gannet-3'].system, 'senara')
end)

test('the track keeps its newest points within the cap', function()
  local s = B.new()
  for i = 1, B.MAX_POINTS + 50 do
    -- a zig-zag, so no point folds into a line
    B.ship_status(s, at('gannet-3', (i % 2) * 2, i * 0.01), i * 10)
  end
  local n = 0
  for _, seg in ipairs(B.message(s).log.track) do n = n + #seg end
  eq(n, B.MAX_POINTS)
end)

test('stored logs load back, keeping only well-formed ones', function()
  local s = B.new()
  B.load(s, {
    ['gannet-3'] = { system = 'senara', name = 'Gannet Belt', radius = 18,
      track = { { { 1, 2 }, { 'x', 3 }, { 4, 5 } }, 'bad', {} },
      sweeps = { { x = 1, y = 2, r = 5 }, { x = 'a' }, { x = 3, y = 4 } },
      left = { x = 1, y = 1, name = 'Full Measure', at = 99 } },
    ['cinders-2'] = { track = 'x' },
    [7] = { },
    ['u-3'] = 'x',
  })
  local saved = B.saved(s)
  eq(saved['gannet-3'], { system = 'senara', name = 'Gannet Belt', radius = 18,
    track = { { { 1, 2 }, { 4, 5 } } }, sweeps = { { x = 1, y = 2, r = 5 }, { x = 3, y = 4 } },
    left = { x = 1, y = 1, name = 'Full Measure', at = 99 } })
  eq(saved['cinders-2'], { track = {}, sweeps = {} })
  eq(saved['u-3'], nil)
end)

test('a reset is nowhere and keeps the logs', function()
  local s = B.new()
  B.ship_status(s, at('gannet-3', 1, 1), 1)
  eq(B.reset(s), true)
  eq(B.message(s).id, nil)
  eq(B.saved(s)['gannet-3'] ~= nil, true)
  eq(B.reset(s), false)
end)

test('set_on reports only a change', function()
  local s = B.new()
  eq(B.set_on(s, true), true)
  eq(B.set_on(s, true), false)
  eq(B.on(s), true)
  eq(B.set_on(s, 'yes'), true)
  eq(B.on(s), false)
end)

t.done()
