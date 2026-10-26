package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local T = require('station_map.clock')
local test, eq = t.test, t.eq

local MIDNIGHT = 1792828800000
local DAY = 15247058.823529412

local function frame(over)
  local d = { weekday = 'wednesday', day = 40, midnight = MIDNIGHT, dayMs = DAY }
  for k, v in pairs(over or {}) do d[k] = v end
  return d
end

test('a fresh state has no clock', function()
  eq(T.message(T.new()), {})
end)

test('a clock, as the game sends it', function()
  local s = T.new()
  eq(T.empyreal_clock(s, frame()), true)
  eq(T.message(s), { clock = { weekday = 'wednesday', day = 40, midnight = MIDNIGHT, dayMs = DAY } })
end)

test('the same clock again changes nothing', function()
  local s = T.new()
  T.empyreal_clock(s, frame())
  eq(T.empyreal_clock(s, frame()), false)
end)

test('the next midnight, or a restart moving this one, is a change', function()
  local s = T.new()
  T.empyreal_clock(s, frame())
  eq(T.empyreal_clock(s, frame({ weekday = 'thursday', day = 41, midnight = MIDNIGHT + DAY })), true)
  eq(T.message(s).clock.weekday, 'thursday')
  -- a restart waits the clock out a little: a few ms later is still a new midnight
  eq(T.empyreal_clock(s, frame({ weekday = 'thursday', day = 41, midnight = MIDNIGHT + DAY + 3 })), true)
  eq(T.message(s).clock.midnight, MIDNIGHT + DAY + 3)
end)

test('the weekday in any case is kept in lower case', function()
  local s = T.new()
  T.empyreal_clock(s, frame({ weekday = 'Friday' }))
  eq(T.message(s).clock.weekday, 'friday')
end)

test('a frame that cannot run a clock is ignored, and the last one stands', function()
  for _, v in ipairs({ 'wednesday', 42, true, {}, frame({ weekday = 'wed' }), frame({ weekday = 3 }),
      frame({ midnight = 'noon' }), frame({ midnight = 0 / 0 }), frame({ dayMs = 0 }), frame({ dayMs = -DAY }),
      frame({ dayMs = math.huge }) }) do
    local s = T.new()
    T.empyreal_clock(s, frame())
    eq(T.empyreal_clock(s, v), false)
    eq(T.message(s).clock.midnight, MIDNIGHT)
  end
  local fresh = T.new()
  eq(T.empyreal_clock(fresh, nil), false)
  eq(T.message(fresh), {})
end)

test('an odd day is left out; the clock runs without it', function()
  local s = T.new()
  T.empyreal_clock(s, frame({ day = 'forty' }))
  eq(T.message(s), { clock = { weekday = 'wednesday', midnight = MIDNIGHT, dayMs = DAY } })
end)

test('reset clears it, and says whether there was one', function()
  local s = T.new()
  eq(T.reset(s), false)
  T.empyreal_clock(s, frame())
  eq(T.reset(s), true)
  eq(T.message(s), {})
end)

t.done()
