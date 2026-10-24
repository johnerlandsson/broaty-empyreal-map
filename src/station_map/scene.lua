-- Scene reducer: folds Ship.Status and Space.Charts into which picture the
-- overview shows: 'station', 'parked', 'travelling', 'belt', 'port' or 'orbit', which
-- station your ship is docked at, if she is, which port she's over and which planet.
-- Ship.Status comes for the ship you're aboard and can fly, your own or one
-- you crew (crew get leaseLeft null, which this ignores), and is null off
-- her, so only as a guest aboard someone else's ship does this stay 'station'.
-- Docked at another ship, her own `docked` is true with no `location`, and
-- `host` says where her host is (gmcp.md §8.2): she rides with her host, so
-- the picture is the host's.
-- Over a port (a Space.Charts body of kind 'port', planetside.md §3), not
-- landed, the picture is the planet's face below with the town on it.
-- In high orbit over a planet (a body of kind 'planet'; Empyreal 2a84c78, navigation.md §6) the
-- picture is its face below with no town. High orbit is a point, so `location` is null, as when
-- she stops mid-trip; her `status` says "over Tamsin" (the game's statusText, and only there: over
-- a port it's "at Zennor"), the planet by name. A host's whereabouts carry no status, so failing
-- that, a trip to a planet whose eta has come due (within SLACK, as charts.lua has it) and a loose
-- status after it is high orbit; a loose status before then is a stop. A short hop (T.I.S.S. to
-- Tamsin is 3 s) can come and go between two statuses, so the status is the one to trust.
-- Pure and cheap; never errors on missing or odd-typed fields.

local S = {}

local SLACK = 5 -- seconds early a trip's eta may come due, as charts.lua's

local function str(v)
  if type(v) == 'string' then return v end
  return nil
end

local function num(v)
  if type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge then return v end
  return nil
end

function S.new()
  return { belts = {}, ports = {}, planets = {}, planet_names = {} }
end

function S.scene(state)
  local ship = state.ship
  if not ship then return 'station' end
  local at = ship.host or ship -- riding a host: she's where her host is
  if at.docked then return 'station' end
  if at.destination then return 'travelling' end
  if at.location and state.belts[at.location] then return 'belt' end
  if at.location and state.ports[at.location] then return 'port' end
  if S.over(state, at) then return 'orbit' end
  return 'parked'
end

-- The planet a ship (hers or her host) is in high orbit over, by her status or her trip, or nil.
function S.over(state, at)
  local named = at.over_name and state.planet_names[at.over_name]
  if named then return named end
  if at.over and state.planets[at.over] then return at.over end
  return nil
end

-- The port your ship is over, not landed ('zennor'), or nil.
function S.port(state)
  if S.scene(state) ~= 'port' then return nil end
  local at = state.ship.host or state.ship
  return at.location
end

-- The station your ship is docked at ('tiss', 'orrin_station', 'wenna_halt', ...), or her
-- host's if she's docked at a ship docked at one, or nil.
function S.station(state)
  local ship = state.ship
  if not ship then return nil end
  local at = ship.host or ship
  if at.docked then return at.location end
  return nil
end

-- The station a dock or an undock starting now is about, if the overview has a picture of it:
-- undocking, the station she's leaving (or her host is docked at: she backs off the host's
-- collar into its approach), not a port, where she lifts off over the ground; docking, the
-- station whose approach she's parked at. Nil otherwise: off a host out in space, the picture
-- is the host's either side. Docking at a ship parked at a station's approach looks the same
-- as docking at the station (Ship.Status doesn't say which), so it's that station's. Pure.
function S.manoeuvre_at(state, verb)
  if verb == 'undock' then
    local st = S.station(state)
    if st and not state.ports[st] then return st end
    return nil
  end
  if verb == 'dock' and S.scene(state) == 'parked' then
    return state.ship.location -- a lane mouth too: the panel has no model for it
  end
  return nil
end

-- The planet your ship is in high orbit over ('tamsin'), or nil.
function S.planet(state)
  if S.scene(state) ~= 'orbit' then return nil end
  return S.over(state, state.ship.host or state.ship)
end

local function key(state)
  return S.scene(state) .. '|' .. (S.station(state) or '') .. '|' .. (S.port(state) or '')
    .. '|' .. (S.planet(state) or '')
end

-- Runs `fn`, returning true if the scene, the docked station or the port changed because of it.
local function track(state, fn)
  local before = key(state)
  fn()
  return key(state) ~= before
end

-- Where a ship (hers or her host) is, from its Ship.Status fields and what it was before
-- (`old`), at `now`: with `due`, when a trip's eta runs out, and `over`, the planet she's in
-- high orbit over, which a trip to it that has come due leaves her in while she's loose.
local function where(d, old, now)
  local at = {
    docked = d.docked == true,
    location = str(d.location),
    destination = str(d.destination),
  }
  local eta = num(d.eta)
  local status = str(d.status)
  if not at.docked and not at.location and not at.destination and status then
    at.over_name = status:match('^over (.+)$')
  end
  if at.destination then
    at.due = eta and now + eta or nil
  elseif not at.docked and not at.location and old then
    if old.destination and old.due and now >= old.due - SLACK then
      at.over = old.destination
    elseif not old.destination then
      at.over = old.over
    end
  end
  return at
end

-- `now` is os.time() seconds, to tell a trip's end from a stop mid-trip.
function S.ship_status(state, data, now)
  now = num(now) or 0
  return track(state, function()
    if type(data) ~= 'table' then
      state.ship = nil
      return
    end
    local old = state.ship
    local host = type(data.host) == 'table' and data.host or nil
    -- gaining or losing a host is another ship: what she was before says nothing
    local same = old and (old.host ~= nil) == (host ~= nil)
    state.ship = where(data, same and old or nil, now)
    state.ship.host = host and where(host, same and old.host or nil, now) or nil
  end)
end

-- Belts are places of kind 'belt'; a port is a body of kind 'port' (among places
-- it's a 'station', gmcp.md §8.4); a planet a body of kind 'planet'.
function S.space_charts(state, data)
  if type(data) ~= 'table' then return false end
  if type(data.places) ~= 'table' and type(data.bodies) ~= 'table' then return false end
  local places = type(data.places) == 'table' and data.places or {}
  local bodies = type(data.bodies) == 'table' and data.bodies or {}
  return track(state, function()
    local belts, ports, planets, names = {}, {}, {}, {}
    for _, p in ipairs(places) do
      if type(p) == 'table' and p.kind == 'belt' and str(p.id) then belts[p.id] = true end
    end
    for _, b in ipairs(bodies) do
      if type(b) == 'table' and b.kind == 'port' and str(b.id) then ports[b.id] = true end
      if type(b) == 'table' and b.kind == 'planet' and str(b.id) then
        planets[b.id] = true
        names[str(b.name) or b.id] = b.id
      end
    end
    state.belts = belts
    state.ports = ports
    state.planets = planets
    state.planet_names = names
  end)
end

function S.reset(state)
  return track(state, function()
    state.ship = nil
    state.belts = {}
    state.ports = {}
    state.planets = {}
    state.planet_names = {}
  end)
end

return S
