package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local N = require('station_map.lanes')
local test, eq = t.test, t.eq

local function mouth(here, there, open)
  return { id = 'mouth:' .. here .. ':' .. there, name = 'the ' .. there .. ' lane mouth', kind = 'mouth', open = open }
end

-- Maelor's charts: its two trunks, and the Petroc branch's mouth if it's listed (open, or closed
-- with her at it or bound there); every other branch is closed, so off the charts.
local function maelor(pm_open)
  local places = {
    { id = 'wenna_halt', name = 'Wenna Halt', kind = 'station', open = nil },
    mouth('maelor', 'senara', true),
    mouth('maelor', 'elowen', true),
  }
  if pm_open ~= nil then places[#places + 1] = mouth('maelor', 'petroc', pm_open) end
  return { system = 'maelor', places = places }
end

-- Every lane of a star, sorted: one to each other star.
local function lanes_of(star)
  local out = {}
  for _, other in ipairs(N.STARS) do
    if other ~= star then out[#out + 1] = N.lane_of('mouth:' .. star .. ':' .. other).id end
  end
  table.sort(out)
  return out
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
  eq(N.message(s), { system = nil, visible = {}, uncharted = {}, seen = {}, transit = nil })
  eq(N.who(s), nil)
  eq(N.on(s), false)
end)

test('the stars are galaxy.yaml\'s twenty, the Shallows ring then the Mid', function()
  eq(#N.STARS, 20)
  eq(N.STARS[1], 'petroc')
  eq(N.STARS[12], 'feock')
  eq(N.STARS[13], 'hensbarrow')
  local seen = {}
  for _, id in ipairs(N.STARS) do
    eq(seen[id], nil, id)
    seen[id] = true
  end
  eq(#lanes_of('maelor'), 19)
end)

test('lane ids are the two stars sorted, as galaxy.yaml has them', function()
  eq(N.lane_of('mouth:senara:maelor'), { id = 'maelor-senara', here = 'senara', there = 'maelor' })
  eq(N.lane_of('mouth:petroc:maelor').id, 'maelor-petroc')
  eq(N.lane_of('mouth:keyne:mabyn').id, 'keyne-mabyn')
  eq(N.lane_of('tiss'), nil)
  eq(N.lane_of(nil), nil)
  eq(N.lane_of('mouth:senara'), nil)
end)

-- A star's lanes that aren't these, sorted.
local function lanes_but(star, ...)
  local skip = {}
  for _, id in ipairs({ ... }) do skip[id] = true end
  local out = {}
  for _, id in ipairs(lanes_of(star)) do
    if not skip[id] then out[#out + 1] = id end
  end
  return out
end

test('the trunks are the ring\'s twelve, Feock back to Petroc', function()
  eq(N.is_trunk('maelor-senara'), true)
  eq(N.is_trunk('feock-petroc'), true)
  eq(N.is_trunk('maelor-petroc'), false)
  eq(N.is_trunk('dozmary-garrow'), false)
  local n = 0
  for i = 1, #N.STARS do
    for j = i + 1, #N.STARS do
      if N.is_trunk(N.lane_of('mouth:' .. N.STARS[i] .. ':' .. N.STARS[j]).id) then n = n + 1 end
    end
  end
  eq(n, 12)
end)

test('Space.Charts records each mouth listed here as seen now; the rest are not charted', function()
  local s = N.new()
  eq(N.space_charts(s, maelor(false), 100), true)
  local m = N.message(s)
  eq(m.system, 'maelor')
  eq(m.visible, { 'elowen-maelor', 'maelor-petroc', 'maelor-senara' })
  eq(m.uncharted, lanes_but('maelor', 'elowen-maelor', 'maelor-petroc', 'maelor-senara'))
  eq(m.seen['maelor-petroc'], { open = false, at = 100 })
  eq(m.seen['maelor-senara'], { open = true, at = 100 })
  eq(m.seen['dozmary-maelor'], nil)
end)

test('a new character in Senara has every lane not charted, trunks and all', function()
  local s = N.new()
  N.space_charts(s, { system = 'senara', places = { { id = 'tiss', name = 'T.I.S.S.', kind = 'station' } } }, 100)
  local m = N.message(s)
  eq(m.visible, {})
  eq(m.uncharted, lanes_of('senara'))
  eq(m.seen, {})
end)

test('a trunk off the charts is not charted, never closed', function()
  local s = N.new()
  -- seen listed once, as a closed branch is never: then gone
  N.space_charts(s, senara(), 100)
  N.space_charts(s, { system = 'senara', places = { mouth('senara', 'maelor', true) } }, 200)
  local m = N.message(s)
  eq(m.seen['keyne-senara'], { open = true, at = 100 })
  eq(m.visible, { 'maelor-senara' })
  eq(m.uncharted, lanes_but('senara', 'maelor-senara'))
end)

test('a charted branch off the charts is closed, seen closed now', function()
  local s = N.new()
  N.space_charts(s, maelor(true), 100) -- the Petroc mouth listed: on her charts for good
  eq(N.space_charts(s, maelor(nil), 200), true)
  local m = N.message(s)
  eq(m.seen['maelor-petroc'], { open = false, at = 200 })
  eq(m.visible, { 'elowen-maelor', 'maelor-petroc', 'maelor-senara' })
  eq(m.uncharted, lanes_but('maelor', 'elowen-maelor', 'maelor-petroc', 'maelor-senara'))
end)

test('an uncharted branch off the charts is not charted, and keeps what was seen of it elsewhere', function()
  local s = N.new()
  -- the Petroc–Maelor branch seen open from Petroc's side
  N.space_charts(s, { system = 'petroc', places = { mouth('petroc', 'maelor', true) } }, 100)
  N.space_charts(s, maelor(nil), 200)
  local m = N.message(s)
  eq(m.seen['maelor-petroc'], { open = true, at = 200 }) -- stamped as she left Petroc
  local found = false
  for _, id in ipairs(m.uncharted) do found = found or id == 'maelor-petroc' end
  eq(found, true)
  eq(N.space_charts(s, maelor(nil), 300), false)
  eq(N.message(s).seen['maelor-petroc'], { open = true, at = 200 })
end)

test('a branch coming onto the charts opens it, and going off them closes it', function()
  local s = N.new()
  N.space_charts(s, maelor(nil), 100)
  eq(N.space_charts(s, maelor(nil), 150), false)
  eq(N.space_charts(s, maelor(true), 200), true)
  eq(N.message(s).seen['maelor-petroc'], { open = true, at = 200 })
  eq(N.space_charts(s, maelor(nil), 300), true)
  eq(N.message(s).seen['maelor-petroc'], { open = false, at = 300 })
end)

test('a system that is no star we know has only its mouths', function()
  local s = N.new()
  N.space_charts(s, { system = 'nowhere', places = { mouth('nowhere', 'senara', true) } }, 100)
  eq(N.message(s).visible, { 'nowhere-senara' })
  eq(N.message(s).seen, { ['nowhere-senara'] = { open = true, at = 100 } })
end)

test('a mouth with no open boolean is not a sighting, nor taken for closed', function()
  local s = N.new()
  local d = maelor(true)
  d.places[2].open = 'yes'
  N.space_charts(s, d, 100)
  eq(N.message(s).seen['maelor-senara'], nil)
  eq(N.message(s).seen['maelor-petroc'], { open = true, at = 100 })
  eq(N.message(s).seen['elowen-maelor'], { open = true, at = 100 })
  eq(N.message(s).visible[3], 'maelor-senara') -- listed all the same
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
  eq(N.message(s).uncharted, {})
  eq(N.message(s).seen, {}) -- with no places at all, nothing says what's off the charts
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

test('load takes a stored record, and drops what is not a sighting or a mouth', function()
  local s = N.new()
  N.load(s, { seen = { ['maelor-petroc'] = { open = false, at = 7 }, ['keyne-mabyn'] = { open = 'x', at = 1 },
      bad = 3, ['keyne-senara'] = { open = true }, ['maelor-senara'] = { open = false, at = 2 } },
    charted = { ['mouth:maelor:petroc'] = true, ['mouth:maelor:keyne'] = 'yes', tiss = true } })
  -- a trunk is never closed
  eq(N.message(s).seen, { ['maelor-petroc'] = { open = false, at = 7 } })
  eq(s.charted, { ['mouth:maelor:petroc'] = true })
  N.load(s, 'junk')
  eq(N.message(s).seen, { ['maelor-petroc'] = { open = false, at = 7 } })
end)

test('load takes the old sightings-only record, keeping only its open ones', function()
  local s = N.new()
  N.load(s, { ['maelor-petroc'] = { open = true, at = 7 }, ['dozmary-maelor'] = { open = false, at = 7 },
    ['maelor-senara'] = { open = false, at = 7 }, bad = 3 })
  eq(N.message(s).seen, { ['maelor-petroc'] = { open = true, at = 7 } })
  eq(s.charted, {})
end)

test('saved is the sightings and the mouths seen listed, to store', function()
  local s = N.new()
  N.space_charts(s, maelor(true), 100)
  local saved = N.saved(s)
  eq(saved.seen['maelor-petroc'], { open = true, at = 100 })
  eq(saved.charted['mouth:maelor:petroc'], true)
  eq(saved.charted['mouth:maelor:senara'], true)
  local back = N.new()
  N.load(back, saved)
  eq(N.saved(back), saved)
end)

test('who_of is Char.Status\'s name, lowercased', function()
  eq(N.who_of({ name = 'Tamsin Rowe' }), 'tamsin rowe')
  eq(N.who_of({ name = '' }), nil)
  eq(N.who_of({}), nil)
  eq(N.who_of('x'), nil)
end)

test('the first character named takes the sightings made before', function()
  local s = N.new()
  N.space_charts(s, maelor(true), 100)
  local was = N.become(s, 'ann', { seen = { ['keyne-mabyn'] = { open = true, at = 50 } } }, 150)
  eq(was, nil)
  eq(N.who(s), 'ann')
  eq(N.message(s).seen['keyne-mabyn'], { open = true, at = 50 })
  eq(N.message(s).seen['maelor-petroc'], { open = true, at = 150 })
  eq(s.charted['mouth:maelor:petroc'], true)
  eq(N.message(s).visible, { 'elowen-maelor', 'maelor-petroc', 'maelor-senara' })
  eq(N.become(s, 'ann', nil, 200), nil) -- the same name changes nothing
  eq(N.message(s).seen['maelor-petroc'], { open = true, at = 150 })
end)

test('another character swaps in hers, and hands back the one before\'s', function()
  local s = N.new()
  N.become(s, 'ann', nil, 0)
  N.space_charts(s, maelor(true), 100)
  local was, record = N.become(s, 'bea', { seen = { ['keyne-mabyn'] = { open = true, at = 50 } } }, 300)
  eq(was, 'ann')
  eq(record.seen['maelor-petroc'], { open = true, at = 300 })
  eq(record.charted['mouth:maelor:petroc'], true)
  eq(N.who(s), 'bea')
  eq(N.message(s).seen, { ['keyne-mabyn'] = { open = true, at = 50 } })
  eq(s.charted, {})
  eq(N.message(s).visible, {})
  -- Bea hasn't charted the Petroc mouth, so it's not charted, not closed, for her
  N.space_charts(s, maelor(nil), 400)
  eq(N.message(s).seen['maelor-petroc'], nil)
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
