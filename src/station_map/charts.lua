-- Charts reducer: folds Space.Charts and Ship.Status into the state the system
-- chart (the orrery) draws from: the cleaned charts, and her ship with what the
-- payload leaves out and this remembers: where she `from` left, the `point` she
-- holds at once her trip there ends, whether she is `searching` for a belt, and
-- when the status `received` (whole seconds), which fixes the trip's timing.
-- She reads from `host` when set, as scene.lua does.
-- Pure and cheap; never errors on missing or odd-typed fields.

local C = {}

local SLACK = 5 -- seconds an eta may grow by before it means a new leg

local function str(v)
  if type(v) == 'string' then return v end
  return nil
end

local function num(v)
  if type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge then return v end
  return nil
end

function C.new()
  return { charts = nil, ship = nil, prev = nil, on = false }
end

local function clean_orbit(o)
  if type(o) ~= 'table' then return nil end
  local parent, a, period = str(o.parent), num(o.a), num(o.period)
  if not (parent and a and period and period > 0) then return nil end
  return { parent = parent, a = a, e = num(o.e) or 0, peri = num(o.peri) or 0,
    phase = num(o.phase) or 0, period = period }
end

local function clean_fit(f)
  if type(f) ~= 'table' then return nil end
  local seen, err, at = num(f.seen), num(f.error), num(f.at)
  if not (seen and err and at) then return nil end
  return { seen = seen, error = err, at = at }
end

local function clean_edge(e)
  if type(e) ~= 'table' then return nil end
  local r, bearing, at = num(e.r), num(e.bearing), num(e.at)
  if not (r and bearing and at) then return nil end
  return { r = r, bearing = bearing, at = at }
end

local function clean_list(list, fn)
  local out = {}
  if type(list) ~= 'table' then return out end
  for _, v in ipairs(list) do
    if type(v) == 'table' and str(v.id) then out[#out + 1] = fn(v) end
  end
  return out
end

local function clean_charts(data)
  return {
    epoch = num(data.epoch) or 0,
    system = str(data.system),
    bodies = clean_list(data.bodies, function(b)
      return { id = b.id, name = str(b.name) or b.id, kind = str(b.kind),
        radius = num(b.radius), orbit = clean_orbit(b.orbit) }
    end),
    places = clean_list(data.places, function(p)
      return { id = p.id, name = str(p.name) or p.id, kind = str(p.kind),
        orbit = clean_orbit(p.orbit), fit = clean_fit(p.fit), edge = clean_edge(p.edge) }
    end),
  }
end

local function same(a, b)
  if type(a) ~= type(b) then return false end
  if type(a) ~= 'table' then return a == b end
  for k, v in pairs(a) do
    if not same(v, b[k]) then return false end
  end
  for k in pairs(b) do
    if a[k] == nil then return false end
  end
  return true
end

local function drop_memory(ship)
  if ship then
    ship.from, ship.point, ship.searching = nil, nil, nil
  end
end

function C.space_charts(state, data)
  if type(data) ~= 'table' then return false end
  local new = clean_charts(data)
  local old = state.charts
  if old and old.system ~= new.system then
    drop_memory(state.ship)
    state.prev = nil
  end
  state.charts = new
  return not same(old, new)
end

local function is_belt(state, id)
  if not (id and state.charts) then return false end
  for _, p in ipairs(state.charts.places) do
    if p.id == id and p.kind == 'belt' then return true end
  end
  return false
end

local function snapshot(ship)
  if not ship then return nil end
  local c = {}
  for k, v in pairs(ship) do
    if k ~= 'received' then c[k] = v end
  end
  return c
end

function C.ship_status(state, data, now)
  local before = snapshot(state.ship)
  if type(data) ~= 'table' then
    state.ship, state.prev = nil, nil
    return before ~= nil
  end
  local host = type(data.host) == 'table' and data.host or nil
  local at = host or data
  local cur = {
    docked = at.docked == true,
    location = str(at.location),
    destination = str(at.destination),
    progress = num(at.progress),
    eta = num(at.eta),
    received = num(now) or 0,
    hosted = host ~= nil,
  }
  local prev, old = state.prev, state.ship
  if prev and prev.hosted ~= cur.hosted then prev, old = nil, nil end -- not the same ship

  local from, point, searching
  if cur.destination then
    if prev and prev.destination == cur.destination then
      from = old and old.from
    elseif prev and not prev.destination then
      from = prev.location or (old and old.point)
    end
    if is_belt(state, cur.destination) then
      if old and old.searching == cur.destination then
        searching = cur.destination
      elseif prev and prev.destination == cur.destination and prev.progress and prev.eta
          and ((cur.progress and cur.progress < prev.progress)
            or (cur.eta and cur.eta > prev.eta - (cur.received - prev.received) + SLACK)) then
        searching = cur.destination
      end
    end
  elseif not cur.docked and not cur.location then -- loose
    if prev and prev.destination then
      if prev.destination:sub(1, 3) == 'pt:' then point = prev.destination end
      if is_belt(state, prev.destination) then searching = prev.destination end
    end
    point = point or (old and old.point)
    searching = searching or (old and old.searching)
  end

  state.prev = {
    destination = cur.destination, location = cur.location, docked = cur.docked,
    progress = cur.progress, eta = cur.eta, received = cur.received, hosted = cur.hosted,
  }
  state.ship = {
    docked = cur.docked, location = cur.location, destination = cur.destination,
    progress = cur.progress, eta = cur.eta, received = cur.received,
    from = from, point = point, searching = searching,
  }
  return not same(before, snapshot(state.ship))
end

function C.set_on(state, on)
  on = on == true
  if state.on == on then return false end
  state.on = on
  return true
end

function C.reset(state)
  local changed = state.charts ~= nil or state.ship ~= nil or state.on
  state.charts, state.ship, state.prev, state.on = nil, nil, nil, false
  return changed
end

function C.charts(state) return state.charts end
function C.ship(state) return state.ship end
function C.on(state) return state.on end

return C
