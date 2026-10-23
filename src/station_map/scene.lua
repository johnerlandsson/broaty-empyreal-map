-- Scene reducer: folds Ship.Status and Space.Charts into which picture the
-- overview shows: 'station', 'parked', 'travelling', 'belt' or 'port', which
-- station your ship is docked at, if she is, and which port she's over.
-- Ship.Status comes for the ship you're aboard and can fly, your own or one
-- you crew (crew get leaseLeft null, which this ignores), and is null off
-- her, so only as a guest aboard someone else's ship does this stay 'station'.
-- Docked at another ship, her own `docked` is true with no `location`, and
-- `host` says where her host is (gmcp.md §8.2): she rides with her host, so
-- the picture is the host's.
-- Over a port (a Space.Charts body of kind 'port', planetside.md §3), not
-- landed, the picture is the planet's face below with the town on it.
-- Pure and cheap; never errors on missing or odd-typed fields.

local S = {}

local function str(v)
  if type(v) == 'string' then return v end
  return nil
end

function S.new()
  return { belts = {}, ports = {} }
end

function S.scene(state)
  local ship = state.ship
  if not ship then return 'station' end
  local at = ship.host or ship -- riding a host: she's where her host is
  if at.docked then return 'station' end
  if at.destination then return 'travelling' end
  if at.location and state.belts[at.location] then return 'belt' end
  if at.location and state.ports[at.location] then return 'port' end
  return 'parked'
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

local function key(state)
  return S.scene(state) .. '|' .. (S.station(state) or '') .. '|' .. (S.port(state) or '')
end

-- Runs `fn`, returning true if the scene, the docked station or the port changed because of it.
local function track(state, fn)
  local before = key(state)
  fn()
  return key(state) ~= before
end

function S.ship_status(state, data)
  return track(state, function()
    if type(data) ~= 'table' then
      state.ship = nil
      return
    end
    local host = type(data.host) == 'table' and data.host or nil
    state.ship = {
      docked = data.docked == true,
      location = str(data.location),
      destination = str(data.destination),
      host = host and {
        docked = host.docked == true,
        location = str(host.location),
        destination = str(host.destination),
      } or nil,
    }
  end)
end

-- Belts are places of kind 'belt'; a port is a body of kind 'port' (among places
-- it's a 'station', gmcp.md §8.4).
function S.space_charts(state, data)
  if type(data) ~= 'table' then return false end
  if type(data.places) ~= 'table' and type(data.bodies) ~= 'table' then return false end
  local places = type(data.places) == 'table' and data.places or {}
  local bodies = type(data.bodies) == 'table' and data.bodies or {}
  return track(state, function()
    local belts, ports = {}, {}
    for _, p in ipairs(places) do
      if type(p) == 'table' and p.kind == 'belt' and str(p.id) then belts[p.id] = true end
    end
    for _, b in ipairs(bodies) do
      if type(b) == 'table' and b.kind == 'port' and str(b.id) then ports[b.id] = true end
    end
    state.belts = belts
    state.ports = ports
  end)
end

function S.reset(state)
  return track(state, function()
    state.ship = nil
    state.belts = {}
    state.ports = {}
  end)
end

return S
