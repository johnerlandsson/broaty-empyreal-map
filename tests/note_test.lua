package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local F = require('station_map.note')
local test, eq = t.test, t.eq

local MULE = 'ship.12'

local function entry(over)
  local e = { name = 'Mule', class = 'skiff', kind = 'prospecting skiff', aboard = false, note = nil }
  for k, v in pairs(over or {}) do e[k] = v end
  return e
end

local function list(...)
  return { ships = { ... } }
end

test('a fresh state has no note', function()
  eq(F.note(F.new(), MULE), nil)
end)

test('the note on the ship you are aboard, while you are in her', function()
  local s = F.new()
  eq(F.ship_list(s, list(entry({ aboard = true, note = 'hauls ore to Orrin' })), MULE), true)
  eq(F.note(s, MULE), 'hauls ore to Orrin')
end)

test('she is the one marked aboard, not the first or one by name', function()
  local s = F.new()
  F.ship_list(s, list(
    entry({ name = 'Fair Copy', note = 'mail run' }),
    entry({ name = 'Mule', aboard = true, note = 'hauls ore' }),
    entry({ name = 'Mule', note = 'not this one' })), MULE)
  eq(F.note(s, MULE), 'hauls ore')
end)

test('aboard none of yours, no note, though your others have them', function()
  local s = F.new()
  F.ship_list(s, list(entry({ note = 'hauls ore' }), entry({ name = 'Fair Copy', note = 'mail run' })), 'ship.40')
  eq(F.note(s, 'ship.40'), nil)
end)

test('no note on her: null, missing (an older server), empty or not a string', function()
  for _, note in ipairs({ false, '', 42, {} }) do
    local s = F.new()
    F.ship_list(s, list(entry({ aboard = true, note = note })), MULE)
    eq(F.note(s, MULE), nil)
  end
  local s = F.new()
  F.ship_list(s, list(entry({ aboard = true })), MULE)
  eq(F.note(s, MULE), nil)
end)

test('aboard must be true itself, not just truthy', function()
  local s = F.new()
  F.ship_list(s, list(entry({ aboard = 'yes', note = 'hauls ore' })), MULE)
  eq(F.note(s, MULE), nil)
end)

test('a cleared note goes', function()
  local s = F.new()
  F.ship_list(s, list(entry({ aboard = true, note = 'hauls ore' })), MULE)
  eq(F.ship_list(s, list(entry({ aboard = true })), MULE), true)
  eq(F.note(s, MULE), nil)
end)

test('the same list again changes nothing', function()
  local s = F.new()
  F.ship_list(s, list(entry({ aboard = true, note = 'hauls ore' })), MULE)
  eq(F.ship_list(s, list(entry({ aboard = true, note = 'hauls ore', fuel = 3 })), MULE), false)
end)

test('it is hers only in the ship it came in: anywhere else, no note, till you are back', function()
  local s = F.new()
  F.ship_list(s, list(entry({ aboard = true, note = 'hauls ore' })), MULE)
  eq(F.note(s, 'ship.40'), nil) -- stepped straight into someone else's, before the list says so
  eq(F.note(s, 'orrin'), nil)
  eq(F.note(s, nil), nil)
  eq(F.note(s, MULE), 'hauls ore')
end)

test('a list with no area to tie it to shows nowhere', function()
  local s = F.new()
  F.ship_list(s, list(entry({ aboard = true, note = 'hauls ore' })), nil)
  eq(F.note(s, nil), nil)
end)

test('anything not a list is no note', function()
  for _, v in ipairs({ 'ships', 42, true, {}, { ships = 'Mule' }, { ships = { 'Mule' } } }) do
    local s = F.new()
    F.ship_list(s, list(entry({ aboard = true, note = 'hauls ore' })), MULE)
    eq(F.ship_list(s, v, MULE), true)
    eq(F.note(s, MULE), nil)
  end
end)

test('reset forgets it', function()
  local s = F.new()
  F.ship_list(s, list(entry({ aboard = true, note = 'hauls ore' })), MULE)
  eq(F.reset(s), true)
  eq(F.note(s, MULE), nil)
  eq(F.reset(s), false)
end)

t.done()
