-- Charts reducer: folds Space.Charts and Ship.Status into the state the system
-- chart (the orrery) draws from: the cleaned charts, and her ship with what the
-- payload leaves out and this remembers: where she `from` left, the `point` she
-- holds at once her trip there ends, whether she is `searching` for a belt, and
-- when the status `received` and when her trip began, `depart` (whole seconds), which fix
-- the trip's timing; and her `name`. A lane mouth keeps its `open` (a closed branch's is false).
-- Stopped mid-trip she's at rest where she was along it, which the payload doesn't say: `stop`
-- keeps the trip she stopped on (its start, destination, depart and arrive) and when (`at`), so
-- the panel can place her there and start her next trip from it.
-- In high orbit over a planet (Empyreal 2a84c78) she's loose too, `location` null: a trip to a
-- planet that comes due and goes loose leaves her there, `over` it, keeping the trip she came in
-- on (its start and depart: she comes out on the side she came from) so the panel can place her
-- on the ring. Her status saying "over Tamsin" puts her there too, with no trip if none was seen
-- (a 3 s hop can fall between two statuses), and `name` in place of `planet` until the charts
-- name it. Her next trip starts from there, `from_over`.
-- She reads from `host` when set, as scene.lua does.
-- Pure and cheap; never errors on missing or odd-typed fields.

local C = {}

local SLACK = 5 -- seconds an eta may grow by before it means a new leg
local STOPS = 4 -- stops kept one inside another: a trip from a stop, stopped on in turn

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

local function bool(v)
  if type(v) == 'boolean' then return v end
  return nil
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
        orbit = clean_orbit(p.orbit), fit = clean_fit(p.fit), edge = clean_edge(p.edge),
        open = bool(p.open) }
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

-- True if the charts have id as a body or a place, or, for a point, its body.
local function knows(charts, id)
  if not id then return false end
  id = id:match('^pt:([^:]+):') or id
  for _, list in ipairs({ charts.bodies, charts.places }) do
    for _, it in ipairs(list) do
      if it.id == id then return true end
    end
  end
  return false
end

-- Into a new system, forget what's no place of it. Not all of it: out of a lane her status at the
-- far mouth comes before the new system's charts (gmcp.ts), and her next trip starts from there.
local function drop_memory(state, charts)
  local keep = function(id) return knows(charts, id) and id or nil end
  local ship, prev = state.ship, state.prev
  if ship then
    ship.from, ship.point, ship.searching = keep(ship.from), keep(ship.point), keep(ship.searching)
    if not keep(ship.destination) then ship.depart = nil end
    if ship.stop and not keep(ship.stop.destination) then ship.stop = nil end
    if ship.over and ship.over.planet and not keep(ship.over.planet) then ship.over = nil end
    if ship.from_over and not keep(ship.from_over.planet) then ship.from_over = nil end
  end
  if prev then
    prev.location = keep(prev.location)
    if not keep(prev.destination) then
      prev.destination, prev.progress, prev.eta, prev.depart_progress = nil, nil, nil, nil
    end
  end
end

function C.space_charts(state, data)
  if type(data) ~= 'table' then return false end
  local new = clean_charts(data)
  local old = state.charts
  if old and old.system ~= new.system then drop_memory(state, new) end
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

-- The id of the planet the charts name `name`, or nil.
local function planet_named(state, name)
  if not (name and state.charts) then return nil end
  for _, b in ipairs(state.charts.bodies) do
    if b.kind == 'planet' and b.name == name then return b.id end
  end
  return nil
end

local function is_planet(state, id)
  if not (id and state.charts) then return false end
  for _, b in ipairs(state.charts.bodies) do
    if b.id == id and b.kind == 'planet' then return true end
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

-- True once the leg the previous status timed has come due by now: a new leg (the game's
-- `missed`) or a trip's end only comes then. Before it, a growing eta is a delay (debris) and
-- a loose status is a stop or hold mid-trip, wherever she happened to be.
local function leg_due(prev, now)
  if not (prev and prev.eta and prev.received) then return false end
  return prev.eta - (now - prev.received) <= SLACK
end

-- The trip she's on as a stop's leg, if it has a start and a departure to place her by; nil else.
local function stop_of(ship, prev, now)
  if not (ship and ship.destination and ship.depart and prev.eta and prev.received) then return nil end
  if not (ship.from or ship.stop or ship.from_over) then return nil end
  local inner = ship.stop
  if not ship.from and inner then
    -- keep STOPS deep at most: past that the oldest is dropped, and with it where she is
    local depth, s = 1, inner
    while s.stop do depth, s = depth + 1, s.stop end
    if depth >= STOPS then return nil end
  end
  return { from = ship.from, stop = (not ship.from) and inner or nil, from_over = ship.from_over,
    destination = ship.destination, depart = ship.depart, arrive = prev.received + prev.eta, at = now }
end

-- The high orbit a trip to a planet leaves her in: the planet, and the trip's start and depart
-- if it had them, to say which side she came in on.
local function over_of(ship, planet)
  local t = ship and ship.destination == planet and ship or {}
  return { planet = planet, from = t.from, stop = t.stop, from_over = t.from_over, depart = t.depart }
end

-- When the trip began, whole seconds, from a status's progress and eta (the game's progress
-- is (tick - depart) / (arrive - depart)); nil when it can't be worked out.
local function depart_of(cur)
  local p, eta = cur.progress, cur.eta
  if not (p and eta and p >= 0 and p < 1) then return nil end
  return math.floor(cur.received - p * eta / (1 - p) + 0.5)
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
    status = str(at.status), -- a host's whereabouts carry none
  }
  local prev, old = state.prev, state.ship
  if prev and prev.hosted ~= cur.hosted then prev, old = nil, nil end -- not the same ship

  local from, point, searching, depart, depart_progress, stop, over, from_over
  if cur.destination then
    local same_trip = prev and prev.destination == cur.destination
    if same_trip then
      from = old and old.from
      stop = old and old.stop
      from_over = old and old.from_over
    elseif prev and not prev.destination then
      from = prev.location or (old and old.point)
      if not from then from_over = old and old.over end
      if not (from or from_over) then stop = old and old.stop end
    end
    local new_leg = false
    if is_belt(state, cur.destination) then
      new_leg = same_trip and prev.progress and prev.eta and leg_due(prev, cur.received)
        and ((cur.progress and cur.progress < prev.progress)
          or (cur.eta and cur.eta > prev.eta - (cur.received - prev.received) + SLACK)) or false
      if (old and old.searching == cur.destination) or new_leg then
        searching = cur.destination
      end
    end
    -- the trip's departure, from its lowest-progress status: the rounding of progress costs
    -- least there, and late in a trip it would swing by minutes
    depart, depart_progress = depart_of(cur), cur.progress
    if same_trip and not new_leg and old and old.depart and prev.depart_progress
        and not (depart and cur.progress < prev.depart_progress) then
      depart, depart_progress = old.depart, prev.depart_progress
    end
    if not depart then depart_progress = nil end
  elseif not cur.docked and not cur.location then -- loose
    if prev and prev.destination and leg_due(prev, cur.received) then
      if prev.destination:sub(1, 3) == 'pt:' then point = prev.destination end
      if is_belt(state, prev.destination) then searching = prev.destination end
      if is_planet(state, prev.destination) then over = over_of(old, prev.destination) end
    elseif prev and prev.destination and not (old and old.searching) then
      stop = stop_of(old, prev, cur.received) -- stopped where she was on the way
    end
    point = point or (old and old.point)
    searching = searching or (old and old.searching)
    if not (prev and prev.destination) then
      stop = old and old.stop
      over = old and old.over
    end
    -- her status names the planet: trust it over what the trips said
    local name = cur.status and cur.status:match('^over (.+)$')
    if name then
      local id = planet_named(state, name)
      local same_planet = over and ((id and over.planet == id) or (not id and over.name == name))
      if not same_planet then over = id and { planet = id } or { name = name } end
      stop = nil
    end
  end

  state.prev = {
    destination = cur.destination, location = cur.location, docked = cur.docked,
    progress = cur.progress, eta = cur.eta, received = cur.received, hosted = cur.hosted,
    depart_progress = depart_progress,
  }
  state.ship = {
    name = str(data.name),
    docked = cur.docked, location = cur.location, destination = cur.destination,
    progress = cur.progress, eta = cur.eta, received = cur.received, depart = depart,
    from = from, point = point, searching = searching, stop = stop, over = over, from_over = from_over,
  }
  return not same(before, snapshot(state.ship))
end

function C.set_on(state, on)
  on = on == true
  if state.on == on then return false end
  state.on = on
  return true
end

-- A disconnect: the charts and the ship go, but the chart stays on (the client outlives a
-- dropped connection); with no charts the panel hides it and its ◎ anyway.
function C.reset(state)
  local changed = state.charts ~= nil or state.ship ~= nil
  state.charts, state.ship, state.prev = nil, nil, nil
  return changed
end

function C.charts(state) return state.charts end
function C.ship(state) return state.ship end
function C.on(state) return state.on end

return C
