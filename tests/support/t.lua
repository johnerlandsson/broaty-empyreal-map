-- Minimal test helper: test(name, fn), eq(actual, expected, msg), done().
local T = {}

local passed, failed = 0, 0

local function deep_equal(a, b)
  if type(a) ~= type(b) then return false end
  if type(a) ~= 'table' then return a == b end
  for k, v in pairs(a) do
    if not deep_equal(v, b[k]) then return false end
  end
  for k in pairs(b) do
    if a[k] == nil then return false end
  end
  return true
end

local function show(v)
  if type(v) ~= 'table' then return tostring(v) end
  local keys = {}
  for k in pairs(v) do keys[#keys + 1] = k end
  table.sort(keys, function(x, y) return tostring(x) < tostring(y) end)
  local parts = {}
  for _, k in ipairs(keys) do parts[#parts + 1] = tostring(k) .. '=' .. show(v[k]) end
  return '{' .. table.concat(parts, ', ') .. '}'
end

function T.eq(actual, expected, msg)
  if not deep_equal(actual, expected) then
    error((msg and (msg .. ': ') or '') .. 'expected ' .. show(expected) .. ', got ' .. show(actual), 2)
  end
end

function T.test(name, fn)
  local ok, err = pcall(fn)
  if ok then
    passed = passed + 1
    print('PASS ' .. name)
  else
    failed = failed + 1
    print('FAIL ' .. name .. '\n     ' .. tostring(err))
  end
end

function T.done()
  print(string.format('%d passed, %d failed', passed, failed))
  if failed > 0 then os.exit(1) end
  os.exit(0)
end

return T
