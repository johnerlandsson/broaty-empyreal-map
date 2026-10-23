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

t.done()
