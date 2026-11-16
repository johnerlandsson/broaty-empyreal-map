-- A small JSON codec for the bench: decode a Mallard log line (keeping how many bytes each
-- `data` value took, which is what Mallard converts to Lua), and size what the plugin posts or
-- stores as Mallard's serde would write it (compact, UTF-8 left as is). Bench-only.

local J = {}

local byte, sub, find, char = string.byte, string.sub, string.find, string.char
local tointeger = math.tointeger

-- `spans[t]` is the length in bytes of t.data's JSON text, for each object t that has a `data` key.
J.spans = setmetatable({}, { __mode = 'k' })

local decode_value

local ESC = { [34] = '"', [92] = '\\', [47] = '/', [98] = '\b', [102] = '\f', [110] = '\n', [114] = '\r', [116] = '\t' }

local function utf8_of(cp)
  return utf8.char(cp)
end

local function decode_string(s, i)
  -- s[i] is the opening quote
  local j = i + 1
  local parts, n = nil, 0
  local start = j
  while true do
    local k = find(s, '["\\]', j)
    if not k then error('unterminated string at ' .. i) end
    if byte(s, k) == 34 then
      if not parts then return sub(s, start, k - 1), k + 1 end
      n = n + 1; parts[n] = sub(s, start, k - 1)
      return table.concat(parts), k + 1
    end
    parts = parts or {}
    n = n + 1; parts[n] = sub(s, start, k - 1)
    local e = byte(s, k + 1)
    if e == 117 then
      local cp = tonumber(sub(s, k + 2, k + 5), 16)
      local nxt = k + 6
      if cp >= 0xD800 and cp <= 0xDBFF and sub(s, nxt, nxt + 1) == '\\u' then
        local lo = tonumber(sub(s, nxt + 2, nxt + 5), 16)
        cp = 0x10000 + (cp - 0xD800) * 0x400 + (lo - 0xDC00)
        nxt = nxt + 6
      end
      n = n + 1; parts[n] = utf8_of(cp)
      j = nxt
    else
      n = n + 1; parts[n] = ESC[e] or char(e)
      j = k + 2
    end
    start = j
  end
end

local function skip(s, i)
  return find(s, '[^ \t\r\n]', i) or #s + 1
end

decode_value = function(s, i)
  i = skip(s, i)
  local c = byte(s, i)
  if c == 123 then -- {
    local t = {}
    i = skip(s, i + 1)
    if byte(s, i) == 125 then return t, i + 1 end
    while true do
      i = skip(s, i)
      local k
      k, i = decode_string(s, i)
      i = skip(s, i)
      i = i + 1 -- :
      local v0 = skip(s, i)
      local v
      v, i = decode_value(s, v0)
      if k == 'data' then J.spans[t] = i - v0 end
      t[k] = v
      i = skip(s, i)
      local d = byte(s, i)
      if d == 125 then return t, i + 1 end
      i = i + 1 -- ,
    end
  elseif c == 91 then -- [
    local t, n = {}, 0
    i = skip(s, i + 1)
    if byte(s, i) == 93 then return t, i + 1 end
    while true do
      local v
      v, i = decode_value(s, i)
      n = n + 1; t[n] = v
      i = skip(s, i)
      local d = byte(s, i)
      if d == 93 then return t, i + 1 end
      i = i + 1
    end
  elseif c == 34 then
    return decode_string(s, i)
  elseif c == 116 then return true, i + 4
  elseif c == 102 then return false, i + 5
  elseif c == 110 then return nil, i + 4
  else
    local _, e = find(s, '^-?[%d.eE+-]+', i)
    if not e then error('bad JSON at ' .. i) end
    local text = sub(s, i, e)
    local v = tonumber(text)
    -- serde_json -> mlua: integers stay integers, anything with a point or exponent is a float
    if not find(text, '[.eE]') then v = tointeger(v) or v else v = v + 0.0 end
    return v, e + 1
  end
end

function J.decode(s)
  local v = decode_value(s, 1)
  return v
end

-- Bytes of v as compact JSON, the way Mallard's serde_json writes a Lua value.
local function str_size(s)
  local n = #s
  -- one extra byte per escaped " or \, five more for other control characters (\u00XX)
  local _, q = s:gsub('["\\]', '')
  local _, c = s:gsub('[%z\1-\31]', '')
  local _, short = s:gsub('[\b\f\n\r\t]', '')
  return n + 2 + q + short + (c - short) * 5
end

local function num_text(v)
  if math.type(v) == 'integer' then return tostring(v) end
  if v ~= v or v == math.huge or v == -math.huge then return 'null' end
  if v == math.floor(v) and math.abs(v) < 1e16 then return string.format('%.1f', v) end
  for p = 15, 17 do
    local t = string.format('%.' .. p .. 'g', v)
    if tonumber(t) == v then return t end
  end
  return string.format('%.17g', v)
end

local function is_array(t)
  local n = #t
  if n == 0 then return next(t) == nil end
  local count = 0
  for _ in pairs(t) do count = count + 1 end
  return count == n
end

local size
size = function(v, seen)
  local ty = type(v)
  if ty == 'nil' then return 4 end
  if ty == 'boolean' then return v and 4 or 5 end
  if ty == 'number' then return #num_text(v) end
  if ty == 'string' then return str_size(v) end
  if ty ~= 'table' then return 4 end
  if seen[v] then return 4 end
  seen[v] = true
  local total
  if is_array(v) then
    total = 2
    for i = 1, #v do total = total + size(v[i], seen) + (i > 1 and 1 or 0) end
  else
    total = 2
    local n = 0
    for k, x in pairs(v) do
      n = n + 1
      total = total + str_size(tostring(k)) + 1 + size(x, seen) + (n > 1 and 1 or 0)
    end
  end
  seen[v] = nil
  return total
end

function J.size(v)
  return size(v, {})
end

-- Compact JSON text (for handing the panel's messages to the WebKit replay).
local encode
encode = function(v, out)
  local ty = type(v)
  if ty == 'nil' then out[#out + 1] = 'null'
  elseif ty == 'boolean' then out[#out + 1] = tostring(v)
  elseif ty == 'number' then out[#out + 1] = num_text(v)
  elseif ty == 'string' then
    out[#out + 1] = '"' .. v:gsub('[%c"\\]', function(c)
      local m = { ['"'] = '\\"', ['\\'] = '\\\\', ['\b'] = '\\b', ['\f'] = '\\f', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t' }
      return m[c] or string.format('\\u%04x', byte(c))
    end) .. '"'
  elseif ty == 'table' then
    if is_array(v) then
      out[#out + 1] = '['
      for i = 1, #v do
        if i > 1 then out[#out + 1] = ',' end
        encode(v[i], out)
      end
      out[#out + 1] = ']'
    else
      out[#out + 1] = '{'
      local keys = {}
      for k in pairs(v) do keys[#keys + 1] = tostring(k) end
      table.sort(keys)
      for i, k in ipairs(keys) do
        if i > 1 then out[#out + 1] = ',' end
        encode(k, out)
        out[#out + 1] = ':'
        local x = v[k]
        if x == nil then x = v[tonumber(k)] end
        encode(x, out)
      end
      out[#out + 1] = '}'
    end
  else out[#out + 1] = 'null' end
end

function J.encode(v)
  local out = {}
  encode(v, out)
  return table.concat(out)
end

return J
