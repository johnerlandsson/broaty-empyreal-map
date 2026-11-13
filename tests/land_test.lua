package.path = './src/?.lua;./tests/?.lua;' .. package.path

local t = require('support.t')
local G = require('station_map.land')
local test, eq = t.test, t.eq

local function frame(over)
  local f = { id = 'surface.tamsin.1.2.3', name = 'Heath', area = 'surface.tamsin', areaName = 'Tamsin',
    coords = { x = 1, y = 2, z = 3 },
    exits = { N = { id = 'surface.tamsin.1.3.3', inverse = 'S' }, E = { id = 'zennor.port-road', area = 'zennor' } } }
  for k, v in pairs(over or {}) do f[k] = v end
  return f
end

test('a land frame passes through with coords and exits', function()
  local m = G.frame(frame())
  eq(m.id, 'surface.tamsin.1.2.3')
  eq(m.name, 'Heath')
  eq(m.area, 'surface.tamsin')
  eq(m.areaName, 'Tamsin')
  eq(m.coords, { x = 1, y = 2, z = 3 })
  eq(m.exits.N, { id = 'surface.tamsin.1.3.3', inverse = 'S' })
  eq(m.exits.E, { id = 'zennor.port-road', area = 'zennor' })
end)

test('only land frames with coords pass', function()
  eq(G.frame(frame({ area = 'zennor' })), nil)
  eq(G.frame(frame({ area = false })), nil)
  eq(G.frame(frame({ coords = false })), nil)
  eq(G.frame(frame({ coords = { x = 1 } })), nil)
  eq(G.frame(frame({ id = false })), nil)
  eq(G.frame('junk'), nil)
end)

test('non-table exits are dropped', function()
  eq(G.frame(frame({ exits = { N = 'x', S = { id = 'a' } } })).exits, { S = { id = 'a' } })
end)

test('a saved record must be a table', function()
  eq(G.record('junk'), nil)
  eq(G.record(nil), nil)
  eq(G.record({ a = 1 }), { a = 1 })
end)

t.done()
