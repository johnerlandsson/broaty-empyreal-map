package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local K = require('station_map.course')
local test, eq = t.test, t.eq

local AT = 1792828800000

local function frame(over)
  local d = { to = 'cinders', name = 'The Cinders', km = 2000, seconds = 231, fuel = 6.4, ragged = false, at = AT }
  for k, v in pairs(over or {}) do d[k] = v end
  return d
end

test('a fresh state has no course', function()
  eq(K.message(K.new()), {})
end)

test('a plotted course, as the game sends it', function()
  local s = K.new()
  eq(K.ship_course(s, frame()), true)
  eq(K.message(s), { course = {
    to = 'cinders', name = 'The Cinders', km = 2000, seconds = 231, fuel = 6.4, ragged = false, at = AT,
  } })
end)

test('a ragged course says so', function()
  local s = K.new()
  K.ship_course(s, frame({ ragged = true }))
  eq(K.message(s).course.ragged, true)
end)

test('a course for a ship keeps her key or contact number, and her name as the sweep had it', function()
  local s = K.new()
  K.ship_course(s, frame({ to = 'contact-2', name = 'contact-2' }))
  eq(K.message(s).course.to, 'contact-2')
  eq(K.message(s).course.name, 'contact-2')
end)

test('null, as she arrives or it is cleared, is no course', function()
  local s = K.new()
  K.ship_course(s, frame())
  eq(K.ship_course(s, nil), true)
  eq(K.message(s), {})
end)

test('anything not a table, or with no destination, is no course', function()
  for _, v in ipairs({ 'cinders', 42, true, function() end, {}, { to = '' }, { to = 7, name = 'x' } }) do
    local s = K.new()
    K.ship_course(s, frame())
    eq(K.ship_course(s, v), true)
    eq(K.message(s), {})
  end
end)

test('no name falls back to the destination, and odd figures are left out', function()
  local s = K.new()
  K.ship_course(s, { to = 'gannet', km = 'far', seconds = -1, fuel = 0 / 0, ragged = 'yes', at = math.huge })
  eq(K.message(s), { course = { to = 'gannet', name = 'gannet', fuel = nil, ragged = false } })
end)

test('the same course again is no change; a fresh plot of it is', function()
  local s = K.new()
  K.ship_course(s, frame())
  eq(K.ship_course(s, frame()), false)
  eq(K.ship_course(s, frame({ at = AT + 20000, ragged = true })), true)
  eq(K.ship_course(K.new(), nil), false)
end)

test('reset drops the course, and says whether there was one', function()
  local s = K.new()
  eq(K.reset(s), false)
  K.ship_course(s, frame())
  eq(K.reset(s), true)
  eq(K.message(s), {})
end)

t.done()
