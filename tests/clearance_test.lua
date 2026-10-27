package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local Q = require('station_map.clearance')
local test, eq = t.test, t.eq

local function nav(busy, left)
  return { id = 'nav', condition = 100, fault = nil, busy = busy, left = left, attachments = {} }
end

local function devices(...)
  return { devices = { { id = 'sensors', condition = 90, busy = nil, left = nil, attachments = {} }, ... } }
end

local function status(text)
  return { name = 'Mule', docked = true, location = 'tiss', status = text }
end

test('a fresh state is waiting on nothing', function()
  eq(Q.message(Q.new()), { verb = nil })
end)

test('a dock or undock with no end is waiting on Control', function()
  local q = Q.new()
  eq(Q.ship_devices(q, devices(nav('undock', nil))), true)
  eq(Q.message(q), { verb = 'undock' })
  q = Q.new()
  eq(Q.ship_devices(q, devices(nav('dock', nil))), true)
  eq(Q.message(q), { verb = 'dock' })
end)

test('the place is the one her status names while she waits', function()
  local q = Q.new()
  -- gmcp.ts sendShipGmcp sends Ship.Status first, then Ship.Devices
  eq(Q.ship_status(q, status('awaiting clearance at T.I.S.S.')), false)
  eq(Q.ship_devices(q, devices(nav('undock', nil))), true)
  eq(Q.message(q), { verb = 'undock', at = 'T.I.S.S.' })
end)

test('a status naming the place after the wait began changes it', function()
  local q = Q.new()
  Q.ship_devices(q, devices(nav('dock', nil)))
  eq(Q.ship_status(q, status('awaiting clearance at Zennor')), true)
  eq(Q.message(q), { verb = 'dock', at = 'Zennor' })
  eq(Q.ship_status(q, status('awaiting clearance at Zennor')), false)
  eq(Q.ship_status(q, status('awaiting clearance at the Full Measure')), true)
  eq(Q.message(q).at, 'the Full Measure')
end)

test('a run with an end is not waiting: cleared, she goes', function()
  local q = Q.new()
  Q.ship_status(q, status('awaiting clearance at T.I.S.S.'))
  Q.ship_devices(q, devices(nav('undock', nil)))
  eq(Q.ship_status(q, status('undocking from T.I.S.S.')), false) -- the place is kept till Ship.Devices says
  eq(Q.message(q), { verb = 'undock', at = 'T.I.S.S.' })
  eq(Q.ship_devices(q, devices(nav('undock', 10))), true)
  eq(Q.message(q), { verb = nil })
  q = Q.new()
  eq(Q.ship_devices(q, devices(nav('dock', 20))), false)
  eq(Q.message(q), { verb = nil })
end)

test('the next wait names its own place, not the last one', function()
  local q = Q.new()
  Q.ship_status(q, status('awaiting clearance at T.I.S.S.'))
  Q.ship_devices(q, devices(nav('undock', nil)))
  Q.ship_status(q, status('undocking from T.I.S.S.'))
  Q.ship_devices(q, devices(nav('undock', 10)))
  Q.ship_status(q, status('at Orrin Station'))
  Q.ship_devices(q, devices(nav('dock', nil)))
  eq(Q.message(q), { verb = 'dock' })
end)

test('a null sentinel for `left` is no end, as nil is', function()
  local q = Q.new()
  eq(Q.ship_devices(q, devices(nav('undock', setmetatable({}, { __name = 'null' })))), true)
  eq(Q.message(q), { verb = 'undock' })
end)

test('a resend while she waits changes nothing', function()
  local q = Q.new()
  Q.ship_devices(q, devices(nav('dock', nil)))
  eq(Q.ship_devices(q, devices(nav('dock', nil))), false)
end)

test('stopping, or the nav at anything else, ends the wait', function()
  local q = Q.new()
  Q.ship_devices(q, devices(nav('undock', nil)))
  eq(Q.ship_devices(q, devices(nav(nil, nil))), true)
  eq(Q.message(q), { verb = nil })
  Q.ship_devices(q, devices(nav('dock', nil)))
  eq(Q.ship_devices(q, devices(nav('rcs', nil))), true)
  eq(Q.message(q), { verb = nil })
end)

test('off her (Ship.Status null) the wait goes: Ship.Devices stops coming', function()
  local q = Q.new()
  Q.ship_status(q, status('awaiting clearance at T.I.S.S.'))
  Q.ship_devices(q, devices(nav('undock', nil)))
  eq(Q.ship_status(q, nil), true)
  eq(Q.message(q), { verb = nil })
  eq(Q.ship_status(q, nil), false)
end)

test('reset says whether there was a wait', function()
  local q = Q.new()
  eq(Q.reset(q), false)
  Q.ship_devices(q, devices(nav('dock', nil)))
  eq(Q.reset(q), true)
  eq(Q.message(q), { verb = nil })
end)

test('odd frames are no wait, and never an error', function()
  local q = Q.new()
  for _, d in ipairs({ nil, 'x', {}, { devices = 'x' }, { devices = { 'x', { id = 'nav', busy = 3 } } },
    devices(nav('dock', 0)) }) do
    Q.ship_devices(q, d)
    eq(Q.message(q), { verb = nil })
  end
  Q.ship_devices(q, devices(nav('dock', nil)))
  Q.ship_status(q, { status = 5 })
  Q.ship_status(q, { status = 'awaiting clearance at ' })
  eq(Q.message(q), { verb = 'dock' })
end)

t.done()
