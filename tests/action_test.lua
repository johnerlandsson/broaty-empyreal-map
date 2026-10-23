package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local A = require('station_map.action')
local test, eq = t.test, t.eq

local NOW = 1000

local function frame(over)
  local d = { verb = 'repair', label = 'repairing the laser', stage = 2, stages = 3, left = 31, total = 48, queued = 1 }
  for k, v in pairs(over or {}) do d[k] = v end
  return d
end

test('a fresh state is doing nothing', function()
  eq(A.message(A.new()), {})
end)

test('a staged repair: its stage of how many, its end as a local timestamp, and what waits', function()
  local s = A.new()
  eq(A.char_action(s, frame(), NOW), true)
  eq(A.message(s), { action = {
    verb = 'repair', label = 'repairing the laser', stage = 2, stages = 3, ends = 1031, total = 48, queued = 1,
  } })
end)

test('a move is a timed action like any other, with no direction', function()
  local s = A.new()
  A.char_action(s, { verb = 'move', label = 'climbing', stage = 1, stages = 1, left = 10, total = 10, queued = 0 }, NOW)
  eq(A.message(s), { action = { verb = 'move', label = 'climbing', stage = 1, stages = 1, ends = 1010, total = 10, queued = 0 } })
end)

test('null, as an action ends, is doing nothing', function()
  local s = A.new()
  A.char_action(s, frame(), NOW)
  eq(A.char_action(s, nil, NOW + 31), true)
  eq(A.message(s), {})
end)

test('anything not a table is doing nothing', function()
  for _, v in ipairs({ 'repairing', 42, true, function() end }) do
    local s = A.new()
    A.char_action(s, frame(), NOW)
    eq(A.char_action(s, v, NOW), true)
    eq(A.message(s), {})
  end
end)

test('nothing to doing nothing is no change', function()
  local s = A.new()
  eq(A.char_action(s, nil, NOW), false)
end)

test('the same action sent again, as its queue stays put, is no change', function()
  local s = A.new()
  A.char_action(s, frame(), NOW)
  eq(A.char_action(s, frame({ left = 30 }), NOW + 1), false)
end)

test('the queue changing is a change', function()
  local s = A.new()
  A.char_action(s, frame(), NOW)
  eq(A.char_action(s, frame({ left = 30, queued = 2 }), NOW + 1), true)
  eq(A.message(s).action.queued, 2)
end)

test('the next stage is a change', function()
  local s = A.new()
  A.char_action(s, frame({ stage = 1, left = 48 }), NOW)
  eq(A.char_action(s, frame({ stage = 2, left = 40 }), NOW + 8), true)
  eq(A.message(s).action.stage, 2)
end)

test('without a label, the verb names it', function()
  local s = A.new()
  A.char_action(s, frame({ label = 7 }), NOW)
  eq(A.message(s).action.label, 'repair')
end)

test('with neither label nor verb there is nothing to show', function()
  local s = A.new()
  local f = frame({ label = '' })
  f.verb = nil
  A.char_action(s, f, NOW)
  eq(A.message(s), {})
end)

test('stages default to one of one, and a stage is kept within them', function()
  local s = A.new()
  local f = frame({ stage = 'two' })
  f.stages = nil
  A.char_action(s, f, NOW)
  eq({ A.message(s).action.stage, A.message(s).action.stages }, { 1, 1 })
  A.char_action(s, frame({ stage = 5, stages = 3 }), NOW)
  eq({ A.message(s).action.stage, A.message(s).action.stages }, { 3, 3 })
  A.char_action(s, frame({ stage = 0, stages = 0 }), NOW)
  eq({ A.message(s).action.stage, A.message(s).action.stages }, { 1, 1 })
  A.char_action(s, frame({ stage = 2.7, stages = 3.2 }), NOW)
  eq({ A.message(s).action.stage, A.message(s).action.stages }, { 2, 3 })
end)

test('no usable time left: no end and no total, the label still shown', function()
  for _, left in ipairs({ 'soon', -5, 0 / 0, math.huge }) do
    local s = A.new()
    A.char_action(s, frame({ left = left }), NOW)
    local a = A.message(s).action
    eq({ a.label, a.ends, a.total }, { 'repairing the laser', nil, nil }, tostring(left))
  end
end)

test('a total under what is left, or none, is what is left', function()
  local s = A.new()
  A.char_action(s, frame({ total = 10 }), NOW)
  eq(A.message(s).action.total, 31)
  A.char_action(s, frame({ total = 'long' }), NOW)
  eq(A.message(s).action.total, 31)
end)

test('no time left at all: it ends now, over a total of nothing', function()
  local s = A.new()
  A.char_action(s, frame({ left = 0, total = 0 }), NOW)
  eq({ A.message(s).action.ends, A.message(s).action.total }, { NOW, 0 })
end)

test('the queue is a whole count of none or more', function()
  local s = A.new()
  A.char_action(s, frame({ queued = -2 }), NOW)
  eq(A.message(s).action.queued, 0)
  A.char_action(s, frame({ queued = 'many' }), NOW)
  eq(A.message(s).action.queued, 0)
  A.char_action(s, frame({ queued = 2.5 }), NOW)
  eq(A.message(s).action.queued, 2)
end)

test('no clock: a time left with nowhere to count from has no end', function()
  local s = A.new()
  A.char_action(s, frame(), nil)
  eq(A.message(s).action.ends, nil)
end)

test('the message is a copy', function()
  local s = A.new()
  A.char_action(s, frame(), NOW)
  A.message(s).action.label = 'mended'
  eq(A.message(s).action.label, 'repairing the laser')
end)

test('reset clears it, true only if something was under way', function()
  local s = A.new()
  eq(A.reset(s), false)
  A.char_action(s, frame(), NOW)
  eq(A.reset(s), true)
  eq(A.message(s), {})
end)

t.done()
