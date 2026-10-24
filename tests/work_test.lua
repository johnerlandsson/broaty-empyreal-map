package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local W = require('station_map.work')
local test, eq = t.test, t.eq

local function devices(sensors, laser)
  local list = { { id = 'nav', condition = 100, fault = nil, busy = nil, left = nil, attachments = {} } }
  if sensors then list[#list + 1] = { id = 'sensors', condition = 90, busy = sensors[1], left = sensors[2], attachments = {} } end
  if laser then list[#list + 1] = { id = 'laser', condition = 80, busy = laser[1], left = laser[2], attachments = {} } end
  return { devices = list }
end

test('a fresh state has nothing under way', function()
  eq(W.message(W.new()), {})
end)

test('a scan keeps its verb, when it began and its end as local times', function()
  local s = W.new()
  eq(W.ship_devices(s, devices({ 'scan', 10 }, { nil, nil }), 1000), true)
  eq(W.message(s), { sensors = { busy = 'scan', since = 1000, ends = 1010 } })
end)

test('an assay likewise', function()
  local s = W.new()
  W.ship_devices(s, devices({ 'assay', 20 }), 50)
  eq(W.message(s), { sensors = { busy = 'assay', since = 50, ends = 70 } })
end)

test('mining has no end', function()
  local s = W.new()
  W.ship_devices(s, devices({ nil, nil }, { 'mine', nil }), 50)
  eq(W.message(s), { laser = { busy = 'mine', since = 50 } })
end)

test('the same frame again is no change', function()
  local s = W.new()
  W.ship_devices(s, devices({ 'scan', 10 }), 1000)
  eq(W.ship_devices(s, devices({ 'scan', 10 }), 1000), false)
end)

test('a moved end keeps when it began', function()
  local s = W.new()
  W.ship_devices(s, devices({ 'scan', 10 }), 1000)
  eq(W.ship_devices(s, devices({ 'scan', 12 }), 1003), true)
  eq(W.message(s).sensors, { busy = 'scan', since = 1000, ends = 1015 })
end)

test('a re-send with the end the same, a second off by rounding, is no change', function()
  local s = W.new()
  W.ship_devices(s, devices({ 'scan', 10 }), 1000)
  eq(W.ship_devices(s, devices({ 'scan', 4 }), 1005), false)
  eq(W.message(s).sensors.ends, 1010)
end)

test('another scan after the last ended begins afresh', function()
  local s = W.new()
  W.ship_devices(s, devices({ 'scan', 10 }), 1000)
  eq(W.ship_devices(s, devices({ 'scan', 10 }), 1011), true)
  eq(W.message(s).sensors, { busy = 'scan', since = 1011, ends = 1021 })
end)

test('a new verb begins afresh', function()
  local s = W.new()
  W.ship_devices(s, devices({ 'scan', 10 }), 1000)
  W.ship_devices(s, devices({ 'assay', 20 }), 1005)
  eq(W.message(s).sensors, { busy = 'assay', since = 1005, ends = 1025 })
end)

test('mining goes on through other frames with its start', function()
  local s = W.new()
  W.ship_devices(s, devices({ nil, nil }, { 'mine', nil }), 50)
  eq(W.ship_devices(s, devices({ 'scan', 10 }, { 'mine', nil }), 80), true)
  eq(W.message(s), { sensors = { busy = 'scan', since = 80, ends = 90 }, laser = { busy = 'mine', since = 50 } })
end)

test('idle again clears it', function()
  local s = W.new()
  W.ship_devices(s, devices({ 'scan', 10 }, { 'mine', nil }), 0)
  eq(W.ship_devices(s, devices({ nil, nil }, { nil, nil }), 10), true)
  eq(W.message(s), {})
end)

test('a device not fitted is idle', function()
  local s = W.new()
  W.ship_devices(s, devices({ 'scan', 10 }), 0)
  W.ship_devices(s, devices(nil, nil), 1)
  eq(W.message(s), {})
end)

test('any other verb is kept as it is', function()
  local s = W.new()
  W.ship_devices(s, devices({ 'repair', 30 }), 0)
  eq(W.message(s).sensors, { busy = 'repair', since = 0, ends = 30 })
end)

test('a negative left is the end now; a non-number has no end', function()
  local s = W.new()
  W.ship_devices(s, devices({ 'scan', -3 }, { 'mine', 'soon' }), 7)
  eq(W.message(s), { sensors = { busy = 'scan', since = 7, ends = 7 }, laser = { busy = 'mine', since = 7 } })
  W.ship_devices(s, devices({ 'assay', 0 / 0 }), 8)
  eq(W.message(s).sensors, { busy = 'assay', since = 8 })
  W.ship_devices(s, devices({ 'assay', math.huge }), 9)
  eq(W.message(s).sensors, { busy = 'assay', since = 8 })
end)

test('odd frames are total: nothing under way, no error', function()
  for _, bad in ipairs({ 'x', 42, true, {}, { devices = 'x' }, { devices = { 'x', 5, { id = 7 }, { id = 'sensors', busy = 9 } } } }) do
    local s = W.new()
    W.ship_devices(s, devices({ 'scan', 10 }), 0)
    W.ship_devices(s, bad, 1)
    eq(W.message(s), {})
  end
  local s = W.new()
  eq(W.ship_devices(s, nil, 0), false)
end)

test('the first of a device listed twice counts', function()
  local s = W.new()
  W.ship_devices(s, { devices = { { id = 'laser', busy = 'mine' }, { id = 'laser', busy = nil } } }, 3)
  eq(W.message(s), { laser = { busy = 'mine', since = 3 } })
end)

test('message is a copy', function()
  local s = W.new()
  W.ship_devices(s, devices({ 'scan', 10 }), 0)
  W.message(s).sensors.busy = 'x'
  eq(W.message(s).sensors.busy, 'scan')
end)

test('reset clears it and says whether anything was under way', function()
  local s = W.new()
  eq(W.reset(s), false)
  W.ship_devices(s, devices({ 'scan', 10 }), 0)
  eq(W.reset(s), true)
  eq(W.message(s), {})
end)

-- --- moving in the belt: nav's rcs and the belt place --------------------------------------

local function moving(nav, laser)
  return { devices = {
    { id = 'nav', busy = nav and nav[1], left = nav and nav[2] },
    { id = 'laser', busy = laser and laser[1], left = laser and laser[2] },
  } }
end

local function status(x, y, target)
  return { name = 'Sparrow', belt = { x = x, y = y, radius = 16, core_km = 0, core_bearing = 0 }, laser = { target = target } }
end

test('the thrusters under way keep nav with its end', function()
  local s = W.new()
  eq(W.ship_devices(s, moving({ 'rcs', 20 }), 100), true)
  eq(W.message(s), { nav = { busy = 'rcs', since = 100, ends = 120 } })
end)

test('nav doing anything but rcs is left out', function()
  for _, verb in ipairs({ 'dock', 'undock', 'travel', 'hold', 'repair' }) do
    local s = W.new()
    W.ship_devices(s, moving({ verb, 10 }), 100)
    eq(W.message(s), {})
  end
end)

test('halting the move clears nav', function()
  local s = W.new()
  W.ship_devices(s, moving({ 'rcs', 20 }), 100)
  eq(W.ship_devices(s, moving(nil), 108), true)
  eq(W.message(s), {})
end)

test('the first place seen in a belt has not moved', function()
  local s = W.new()
  eq(W.ship_status(s, status(0, 10), 100), true)
  eq(W.message(s), { belt = {} })
end)

test('a change of place stamps when, and the way she went against straight out', function()
  local s = W.new()
  W.ship_status(s, status(0, 10), 100)
  eq(W.ship_status(s, status(0, 10.3), 101), true)
  eq(W.message(s).belt, { moved = 101, way = 0 }) -- out
  W.ship_status(s, status(0, 10.1), 102)
  eq(W.message(s).belt, { moved = 102, way = 180 }) -- in
  W.ship_status(s, status(0.2, 10.1), 103)
  eq(W.message(s).belt, { moved = 103, way = 90 }) -- clockwise round the core
  W.ship_status(s, status(0, 10.1), 104)
  eq(W.message(s).belt, { moved = 104, way = -91 }) -- out from (0.2, 10.1) leans a degree clockwise
end)

test('the way is against straight out from where she was, wherever in the belt', function()
  local s = W.new()
  W.ship_status(s, status(-6, -8), 100) -- bearing 217°
  W.ship_status(s, status(-6.3, -8.4), 101) -- further out along it
  eq(W.message(s).belt.way, 0)
  W.ship_status(s, status(-6, -8), 102)
  eq(W.message(s).belt.way, 180)
end)

test('at the core there is no out: the last way holds', function()
  local s = W.new()
  W.ship_status(s, status(0, 0.8), 100)
  W.ship_status(s, status(0, 0.4), 101)
  eq(W.message(s).belt, { moved = 101, way = 180 })
  W.ship_status(s, status(0.2, 0.4), 102)
  eq(W.message(s).belt, { moved = 102, way = 180 })
end)

test('the same place again, as other fields change, is no change', function()
  local s = W.new()
  W.ship_status(s, status(0, 10), 100)
  W.ship_status(s, status(0, 10.3), 101)
  eq(W.ship_status(s, status(0, 10.3), 105), false)
  eq(W.message(s).belt, { moved = 101, way = 0 })
end)

test('the laser target is kept for the card', function()
  local s = W.new()
  eq(W.ship_status(s, status(0, 10, 'rock-12'), 100), true)
  eq(W.message(s).belt, { target = 'rock-12' })
  eq(W.ship_status(s, status(0, 10, 'rock-12'), 101), false)
  eq(W.ship_status(s, status(0, 10), 102), true)
  eq(W.message(s).belt, {})
end)

test('closing on a rock: mine busy as the place changes, then still beside it', function()
  local s = W.new()
  W.ship_status(s, status(0, 10, 'rock-12'), 100)
  W.ship_devices(s, moving(nil, { 'mine', nil }), 100)
  W.ship_status(s, status(0.2, 10, 'rock-12'), 101)
  eq(W.message(s).belt.way, 90)
  W.ship_status(s, status(0.4, 10, 'rock-12'), 102)
  eq(W.message(s), { laser = { busy = 'mine', since = 100 }, belt = { moved = 102, way = 89, target = 'rock-12' } })
  -- beside it: the place stays, so `moved` stays where it was
  eq(W.ship_status(s, status(0.4, 10, 'rock-12'), 110), false)
  eq(W.message(s).belt.moved, 102)
end)

test('mine stopping an rcs: nav clears, the laser takes over and she keeps moving', function()
  local s = W.new()
  W.ship_status(s, status(0, 10), 100)
  W.ship_devices(s, moving({ 'rcs', 20 }), 100)
  W.ship_status(s, status(0, 10.3), 101)
  W.ship_devices(s, moving(nil, { 'mine', nil }), 102)
  W.ship_status(s, status(0.2, 10.3, 'rock-12'), 103)
  eq(W.message(s), { laser = { busy = 'mine', since = 102 }, belt = { moved = 103, way = 90, target = 'rock-12' } })
end)

test('a halted move stops the place changing and clears nav', function()
  local s = W.new()
  W.ship_status(s, status(0, 10), 100)
  W.ship_devices(s, moving({ 'rcs', 20 }), 100)
  W.ship_status(s, status(0, 10.3), 101)
  W.ship_devices(s, moving(nil), 104)
  eq(W.message(s), { belt = { moved = 101, way = 0 } })
end)

test('out of the belt, or off her, the place goes', function()
  for _, off in ipairs({ { name = 'Sparrow', belt = nil }, { belt = 'x' }, { belt = { x = 'a', y = 1 } }, 'x', nil }) do
    local s = W.new()
    W.ship_status(s, status(0, 10), 100)
    W.ship_status(s, status(0, 10.3), 101)
    eq(W.ship_status(s, off, 102), true)
    eq(W.message(s), {})
  end
end)

test('a new belt is a first place, not a move', function()
  local s = W.new()
  W.ship_status(s, status(0, 10), 100)
  W.ship_status(s, { belt = nil }, 101)
  W.ship_status(s, status(5, 5), 200)
  eq(W.message(s), { belt = {} })
end)

test('reset clears the place too', function()
  local s = W.new()
  W.ship_status(s, status(0, 10), 100)
  eq(W.reset(s), true)
  eq(W.message(s), {})
end)

test('moving: the thrusters under way, from their start', function()
  local s = W.new()
  W.ship_status(s, status(0, 10), 100)
  eq(W.moving(s, 100), false)
  W.ship_devices(s, moving({ 'rcs', 20 }), 100)
  eq(W.moving(s, 100), true)
  W.ship_devices(s, moving(nil), 120)
  eq(W.moving(s, 120), false)
end)

test('moving: closing on a rock, and not once beside it and cutting', function()
  local s = W.new()
  W.ship_status(s, status(0, 10, 'rock-12'), 100)
  W.ship_devices(s, moving(nil, { 'mine', nil }), 100)
  eq(W.moving(s, 100), false) -- ordered, not yet moved
  W.ship_status(s, status(0.2, 10, 'rock-12'), 101)
  eq(W.moving(s, 101), true)
  eq(W.moving(s, 103), true) -- a stalled tick
  eq(W.moving(s, 104), false)
end)

test('moving: a place changed before the cut was ordered is not closing', function()
  local s = W.new()
  W.ship_status(s, status(0, 10), 100)
  W.ship_status(s, status(0, 10.3), 101)
  W.ship_devices(s, moving(nil, { 'mine', nil }), 102)
  eq(W.moving(s, 102), false)
  eq(W.moving(W.new(), 1), false)
end)

t.done()
