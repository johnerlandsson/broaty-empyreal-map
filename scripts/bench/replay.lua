-- Lua replay for the perf bench (docs/maps/bench.md): runs src/main.lua under a stubbed Mallard and
-- feeds it a recorded session, counting what reaches the plugin and what it sends on.
--
--   lua scripts/bench/replay.lua [options] <session.mallardlog>...
--     --out FILE      the result, as JSON (default: stdout)
--     --stream FILE   every panel post of the first run, one JSON line each, for the WebKit replay
--     --panel FILE    the panel's own posts to play back to Lua (JSON lines {"after":e,"name","data"}),
--                     each after record e (0: before the first)
--     --runs N        timed runs; CPU is their median (default 5)
--
-- Logs are Mallard's JSONL (`{kind:"protocol", event:{kind:"gmcp", package, data}, t}`, session markers);
-- the bench's scenario files add `{kind:"panel", name, data}` (a post from the panel) and
-- `{kind:"mark", name}` (copied into the stream). Every file is one session, in the order given.
--
-- gmcp.on is Mallard's: a prefix, lowercased, matches a package equal to it or under it at a dot, and
-- each matching subscription gets its own JSON-to-Lua conversion, so a delivery is counted per
-- subscription with the bytes of the frame's JSON. Time (os.time) is the log's.

local here = arg[0]:match('^(.*)/[^/]*$') or '.'
package.path = here .. '/?.lua;' .. here .. '/../../src/?.lua;' .. package.path
local J = require('json')
local root = here .. '/../..'

local opts = { runs = 5, files = {} }
do
  local i = 1
  while i <= #arg do
    local a = arg[i]
    if a == '--out' or a == '--stream' or a == '--panel' or a == '--runs' then
      opts[a:sub(3)] = arg[i + 1]
      i = i + 2
    else
      opts.files[#opts.files + 1] = a
      i = i + 1
    end
  end
  opts.runs = tonumber(opts.runs)
  if #opts.files == 0 then
    io.stderr:write('usage: lua scripts/bench/replay.lua [--out F] [--stream F] [--panel F] [--runs N] <log>...\n')
    os.exit(2)
  end
end

-- Read every record once. Only GMCP the plugin could subscribe to is decoded in full; the rest is counted.
local records = {}
local seen_frames, unreadable = 0, 0
for _, path in ipairs(opts.files) do
  local f = assert(io.open(path, 'r'))
  for line in f:lines() do
    if line:find('"kind":"gmcp"', 1, true) then
      seen_frames = seen_frames + 1
      local ok, rec = pcall(J.decode, line)
      if ok and type(rec) == 'table' and type(rec.event) == 'table' and type(rec.event.package) == 'string' then
        records[#records + 1] = { kind = 'gmcp', package = rec.event.package, data = rec.event.data,
          bytes = J.spans[rec.event] or 4, t = tonumber(rec.t) or 0 }
      else
        unreadable = unreadable + 1
      end
    elseif line:find('"kind":"session"', 1, true) or line:find('"kind":"panel"', 1, true) or line:find('"kind":"mark"', 1, true) then
      local ok, rec = pcall(J.decode, line)
      if ok and type(rec) == 'table' then
        if rec.kind == 'session' then
          records[#records + 1] = { kind = 'session', marker = rec.marker, t = tonumber(rec.t) or 0 }
        elseif rec.kind == 'panel' then
          records[#records + 1] = { kind = 'panel', name = rec.name, data = rec.data, t = tonumber(rec.t) or 0 }
        elseif rec.kind == 'mark' then
          records[#records + 1] = { kind = 'mark', name = rec.name, t = tonumber(rec.t) or 0 }
        end
      else
        unreadable = unreadable + 1
      end
    end
  end
  f:close()
end
-- a record with no time takes the one before's
do
  local last = 0
  for _, r in ipairs(records) do
    if r.t == 0 then r.t = last else last = r.t end
  end
end

-- The panel's posts back, by the record they follow.
local panel_after = {}
if opts.panel then
  local f = assert(io.open(opts.panel, 'r'))
  for line in f:lines() do
    if line ~= '' then
      local p = J.decode(line)
      local at = tonumber(p.after) or 0
      panel_after[at] = panel_after[at] or {}
      table.insert(panel_after[at], { name = p.name, data = p.data, bytes = J.spans[p] or J.size(p.data) })
    end
  end
  f:close()
end

local function deep(v)
  if type(v) ~= 'table' then return v end
  local c = {}
  for k, x in pairs(v) do c[k] = deep(x) end
  return c
end

local clock = os.clock
local real_time = os.time

-- One run: a fresh plugin over every record. `stream` (a file) gets the panel posts.
local function run(stream)
  local r = {
    delivered = {}, posts = {}, storage = {}, panel = {}, cpu = {}, panel_cpu = 0, ignored = 0,
    stub = 0, -- os.clock spent inside the stubs (sizing, copying), taken off the plugin's time
  }
  local now_ms = 0
  local event = 0
  os.time = function(t)
    if t then return real_time(t) end
    return now_ms // 1000
  end

  local subs = {}
  local panel_handlers = {}
  local world_handlers = {}
  local post_index = 0

  local function tally(tbl, key, bytes)
    local e = tbl[key]
    if not e then e = { n = 0, bytes = 0 }; tbl[key] = e end
    e.n = e.n + 1
    e.bytes = e.bytes + bytes
  end

  local panel = {}
  function panel:post(name, data)
    local c0 = clock()
    local text = J.encode(data)
    tally(r.posts, name, #text)
    post_index = post_index + 1
    if stream then
      stream:write('{"i":', post_index, ',"e":', event, ',"t":', now_ms, ',"name":', J.encode(name), ',"data":', text, '}\n')
    end
    r.stub = r.stub + (clock() - c0)
  end
  function panel:on_message(name, fn)
    panel_handlers[name] = fn
  end

  local store = {}
  _G.mud = { panel = function() return panel end }
  _G.gmcp = {
    on = function(prefix, fn)
      local sub = { prefix = string.lower(prefix), fn = fn }
      subs[#subs + 1] = sub
      return { remove = function() for i, s in ipairs(subs) do if s == sub then table.remove(subs, i) return end end end }
    end,
  }
  _G.world = { on = function(ev, fn) world_handlers[ev] = world_handlers[ev] or {}; table.insert(world_handlers[ev], fn) end }
  _G.settings = { get = function() return nil end, on = function() end }
  _G.log = { debug = function() r.ignored = r.ignored + 1 end, info = function() end, warn = function() end }
  -- Mallard keeps storage as JSON, so a get hands back a copy of what was set
  _G.storage = {
    get = function(k)
      local c0 = clock()
      local v = store[k] and J.decode(store[k]) or nil
      r.stub = r.stub + (clock() - c0)
      return v
    end,
    set = function(k, v)
      local c0 = clock()
      local text = v == nil and 'null' or J.encode(v)
      tally(r.storage, (tostring(k):gsub(':.*', ':*')), #text)
      store[k] = v ~= nil and text or nil
      r.stub = r.stub + (clock() - c0)
    end,
  }

  for _, name in ipairs({ 'station_map.location', 'station_map.scene', 'station_map.charts', 'station_map.lanes',
      'station_map.work', 'station_map.manoeuvre', 'station_map.clearance', 'station_map.course',
      'station_map.belt', 'station_map.note', 'station_map.land' }) do
    package.loaded[name] = nil
  end
  dofile(root .. '/src/main.lua')

  local function deliver_panel(list)
    for _, p in ipairs(list or {}) do
      tally(r.panel, p.name, p.bytes)
      local fn = panel_handlers[p.name]
      if fn then
        local d = deep(p.data)
        local s0 = r.stub
        local c0 = clock()
        fn(d)
        r.panel_cpu = r.panel_cpu + (clock() - c0) - (r.stub - s0)
      end
    end
  end

  local connected = true
  deliver_panel(panel_after[0])
  for i, rec in ipairs(records) do
    event = i
    now_ms = rec.t
    if rec.kind == 'gmcp' then
      local lc = string.lower(rec.package)
      for _, sub in ipairs(subs) do
        local p = sub.prefix
        if lc == p or (lc:sub(1, #p) == p and lc:sub(#p + 1, #p + 1) == '.') then
          tally(r.delivered, rec.package, rec.bytes)
          local d = deep(rec.data) -- json_to_lua: a fresh table per subscription
          local s0 = r.stub
          local c0 = clock()
          sub.fn(rec.package, d)
          r.cpu[rec.package] = (r.cpu[rec.package] or 0) + (clock() - c0) - (r.stub - s0)
        end
      end
    elseif rec.kind == 'session' then
      if rec.marker == 'connected' then
        connected = true
      elseif connected and (rec.marker == 'disconnected' or rec.marker == 'error') then
        connected = false
        local s0 = r.stub
        local c0 = clock()
        for _, fn in ipairs(world_handlers.disconnect or {}) do fn() end
        r.cpu['(disconnect)'] = (r.cpu['(disconnect)'] or 0) + (clock() - c0) - (r.stub - s0)
      end
    elseif rec.kind == 'panel' then
      deliver_panel({ { name = rec.name, data = rec.data, bytes = J.size(rec.data) } })
    elseif rec.kind == 'mark' and stream then
      stream:write('{"mark":', J.encode(rec.name), ',"e":', i, ',"t":', now_ms, '}\n')
    end
    deliver_panel(panel_after[i])
  end
  os.time = real_time
  return r
end

local function counts_of(r)
  local function flat(tbl)
    local keys = {}
    for k in pairs(tbl) do keys[#keys + 1] = k end
    table.sort(keys)
    local out = {}
    for _, k in ipairs(keys) do out[#out + 1] = k .. '=' .. tbl[k].n .. '/' .. tbl[k].bytes end
    return table.concat(out, ' ')
  end
  return flat(r.delivered) .. '|' .. flat(r.posts) .. '|' .. flat(r.storage) .. '|' .. flat(r.panel) .. '|' .. r.ignored
end

local function median(xs)
  local s = {}
  for i, x in ipairs(xs) do s[i] = x end
  table.sort(s)
  local n = #s
  if n == 0 then return 0 end
  if n % 2 == 1 then return s[(n + 1) // 2] end
  return (s[n // 2] + s[n // 2 + 1]) / 2
end

local stream = opts.stream and assert(io.open(opts.stream, 'w')) or nil
local first = run(stream)
if stream then stream:close() end
local key = counts_of(first)

local totals, panel_cpus, per_package = {}, {}, {}
for i = 1, opts.runs do
  collectgarbage('collect')
  local r = run(nil)
  if counts_of(r) ~= key then
    io.stderr:write('replay: run ' .. i .. ' counted differently from the first; the plugin is not deterministic here\n')
    os.exit(1)
  end
  local total = r.panel_cpu
  for pkg, s in pairs(r.cpu) do
    total = total + s
    per_package[pkg] = per_package[pkg] or {}
    table.insert(per_package[pkg], s * 1000)
  end
  totals[#totals + 1] = total * 1000
  panel_cpus[#panel_cpus + 1] = r.panel_cpu * 1000
end

local function sum(tbl)
  local n, b = 0, 0
  for _, e in pairs(tbl) do n, b = n + e.n, b + e.bytes end
  return { n = n, bytes = b }
end

local by_package_cpu = {}
for pkg, xs in pairs(per_package) do by_package_cpu[pkg] = median(xs) end

local result = {
  gmcp_frames_in_logs = seen_frames,
  unreadable_lines = unreadable,
  delivered = { total = sum(first.delivered), by_package = first.delivered },
  ignored_by_plugin = first.ignored,
  posts = { total = sum(first.posts), by_name = first.posts },
  storage_set = { total = sum(first.storage), by_key = first.storage },
  panel_to_lua = { total = sum(first.panel), by_name = first.panel },
  cpu_ms = { runs = totals, median = median(totals), panel_median = median(panel_cpus), by_package_median = by_package_cpu },
}
local text = J.encode(result) .. '\n'
if opts.out then
  local f = assert(io.open(opts.out, 'w'))
  f:write(text)
  f:close()
else
  io.write(text)
end
