-- Lanes reducer: folds Space.Charts and Ship.Status into what the lanes map draws from: the
-- system you're in, the lanes of it whose state the charts there say now (`visible`), those whose
-- mouth here isn't on your charts (`uncharted`), each lane's open or closed state as you last saw it
-- (`seen`), the mouths you've seen listed (`charted`), and the lane she's in while she's in one
-- (`transit`). Whether her account can be reached where she is (`reach`, Char.Status's
-- accountReachable), and each star's last such reading (`contact`). `seen`, `charted` and `contact`
-- are one character's, kept by main.lua in Mallard's storage under her name (`who`).
-- The charts list only the mouths on your charts (help charts), and of those not a closed branch's
-- unless she's at it or bound there (help lanes). So a lane of this system with no mouth listed is
-- a closed branch only if it's a branch whose mouth here you've seen listed before: charts are kept
-- for good, so it's still on them, and only being closed leaves it out. A trunk never closes, so
-- one missing is a mouth you haven't found; so is a branch never seen listed: "not charted", which
-- is what `plot` tells you too. Nothing here guesses when a branch will open.
-- accountReachable is false in a lane, and Char.Status comes only when it changes, every few seconds
-- at most, so the flag held as she comes into a system may be the one before's: it's only that
-- system's once she's been there, out of a lane, for GRACE seconds (`settled`). ui/lib/lanes.js's
-- contactOf works out the rest.
-- Pure and cheap; never errors on missing or odd-typed fields.

local N = {}

local function str(v)
  if type(v) == 'string' then return v end
  return nil
end

local function num(v)
  if type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge then return v end
  return nil
end

-- Every star, as galaxy.yaml has them: every pair of them has a lane, a trunk or a branch, so a
-- star's lanes are one to each of the others. ui/lib/lanes.js has the same list.
N.STARS = {
  'petroc', 'keyne', 'senara', 'maelor', 'elowen', 'mabyn',
  'piran', 'breage', 'euny', 'madron', 'germoe', 'feock',
  'hensbarrow', 'goonhilly', 'dozmary', 'godolphin', 'trencrom', 'kilmar', 'garrow', 'caradon',
}

local IS_STAR = {}
for _, id in ipairs(N.STARS) do IS_STAR[id] = true end

local function lane_id(a, b)
  if b < a then a, b = b, a end
  return a .. '-' .. b
end

-- The trunks: each Shallows star (the first twelve) to the next round the ring, Feock back to Petroc.
local TRUNK = {}
for i = 1, 12 do TRUNK[lane_id(N.STARS[i], N.STARS[i % 12 + 1])] = true end

function N.is_trunk(id) return TRUNK[id] == true end

local GRACE = 10

function N.new()
  return { system = nil, visible = {}, uncharted = {}, seen = {}, charted = {}, contact = {}, who = nil,
    reach = nil, settled = nil, transit = nil, left = nil, on = false }
end

-- A mouth's lane, from its id (`mouth:senara:maelor`, Senara's mouth facing Maelor): the lane's
-- id is its two stars sorted, as galaxy.yaml names lanes ("maelor-senara"). Nil for anything else.
function N.lane_of(id)
  if type(id) ~= 'string' then return nil end
  local here, there = id:match('^mouth:([%w_]+):([%w_]+)$')
  if not here then return nil end
  return { id = lane_id(here, there), here = here, there = there }
end

-- The lanes seen now are seen until `now`: what you saw of them is as of then.
local function stamp(state, now)
  for _, id in ipairs(state.visible) do
    local s = state.seen[id]
    if s then s.at = now end
  end
end

-- The flag, if it's this system's yet (see the top).
local function settled(state, now)
  if state.reach == nil or state.transit or not state.settled or not IS_STAR[state.system or ''] then return false end
  return now == nil or now >= state.settled + GRACE
end

-- This system's reading kept, as of now.
local function note(state, now)
  if settled(state, now) then state.contact[state.system] = { ok = state.reach, at = now } end
end

function N.space_charts(state, data, now)
  if type(data) ~= 'table' then return false end
  now = num(now) or 0
  note(state, now)
  local system = str(data.system)
  local changed = system ~= state.system
  if changed then
    stamp(state, now)
    state.settled = now
  end
  state.system = system
  local visible, uncharted, listed = {}, {}, {}
  local function sight(id, open)
    local old = state.seen[id]
    if not old or old.open ~= open then changed = true end
    state.seen[id] = { open = open, at = now }
  end
  if type(data.places) == 'table' then
    for _, p in ipairs(data.places) do
      local lane = type(p) == 'table' and p.kind == 'mouth' and N.lane_of(p.id)
      if lane and not listed[lane.id] then
        listed[lane.id] = true
        visible[#visible + 1] = lane.id
        state.charted[p.id] = true
        if type(p.open) == 'boolean' then sight(lane.id, p.open) end
      end
    end
    -- the lanes of a star we know with no mouth listed: a branch whose mouth here we've seen
    -- listed is closed, seen closed now; any other's mouth isn't on her charts
    if system and IS_STAR[system] then
      for _, other in ipairs(N.STARS) do
        local id = other ~= system and lane_id(system, other)
        if id and not listed[id] then
          if not TRUNK[id] and state.charted['mouth:' .. system .. ':' .. other] then
            visible[#visible + 1] = id
            sight(id, false)
          else
            uncharted[#uncharted + 1] = id
          end
        end
      end
    end
  end
  table.sort(visible)
  table.sort(uncharted)
  if table.concat(visible, ',') ~= table.concat(state.visible, ',') then changed = true end
  if table.concat(uncharted, ',') ~= table.concat(state.uncharted, ',') then changed = true end
  state.visible, state.uncharted = visible, uncharted
  return changed
end

local function same_transit(a, b)
  if a == nil or b == nil then return a == b end
  for _, k in ipairs({ 'lane', 'from', 'to', 'progress', 'eta', 'received' }) do
    if a[k] ~= b[k] then return false end
  end
  return true
end

-- In a lane, her destination is the far mouth, in another system. The game's status says so
-- ("in the Maelor lane 40%"); a host's whereabouts carry no status, so failing that, she's in it
-- if she left from the mouth facing it, or was already in it on this trip.
function N.ship_status(state, data, now)
  local before = state.transit
  local at_now = num(now) or 0
  if type(data) ~= 'table' then
    if before then state.settled = at_now end
    state.transit, state.left = nil, nil
    return before ~= nil
  end
  local host = type(data.host) == 'table' and data.host or nil
  local at = host or data
  local dest, loc = str(at.destination), str(at.location)
  local status = (not host) and str(data.status) or nil
  local transit = nil
  local lane = N.lane_of(dest)
  if lane then
    local by_status = status and status:match('^in the .+ lane') ~= nil
    local by_mouth = state.left == ('mouth:' .. lane.there .. ':' .. lane.here)
    local same = before and before.lane == lane.id and before.to == lane.here
    if by_status or by_mouth or same then
      transit = { lane = lane.id, from = lane.there, to = lane.here,
        progress = num(at.progress), eta = num(at.eta), received = num(now) or 0 }
    end
  end
  if loc then
    state.left = loc
  elseif not dest then
    state.left = nil
  end
  if transit and not before then note(state, at_now) end
  if before and not transit then state.settled = at_now end
  state.transit = transit
  return not same_transit(before, transit)
end

local function load_seen(state, seen, open_only)
  if type(seen) ~= 'table' then return end
  for id, s in pairs(seen) do
    if type(id) == 'string' and type(s) == 'table' and type(s.open) == 'boolean' and num(s.at)
        and (s.open or not (open_only or TRUNK[id])) then
      state.seen[id] = { open = s.open, at = s.at }
    end
  end
end

-- A character's stored record back in (`storage.get`), keeping only well-formed sightings and
-- mouths: `{ seen = { [lane] = { open, at } }, charted = { [mouth] = true }, contact = { [star] =
-- { ok, at } } }`. A trunk is never
-- closed. The old record, before charts were per character, was the sightings alone, keyed by
-- lane; its closed ones may only have been mouths not on the charts, so only its open ones are kept.
function N.load(state, saved)
  if type(saved) ~= 'table' then return end
  if saved.seen == nil and saved.charted == nil then
    load_seen(state, saved, true)
    return
  end
  load_seen(state, saved.seen, false)
  if type(saved.contact) == 'table' then
    for id, c in pairs(saved.contact) do
      if IS_STAR[id] and type(c) == 'table' and type(c.ok) == 'boolean' and num(c.at) then
        state.contact[id] = { ok = c.ok, at = c.at }
      end
    end
  end
  if type(saved.charted) == 'table' then
    for id, v in pairs(saved.charted) do
      if v == true and N.lane_of(id) then state.charted[id] = true end
    end
  end
end

-- The record, for main.lua to store under `who`.
function N.saved(state) return { seen = state.seen, charted = state.charted, contact = state.contact } end

-- Char.Status's accountReachable: what it said till now is kept, then the new one held. True if it changed.
function N.char_status(state, data, now)
  if type(data) ~= 'table' or type(data.accountReachable) ~= 'boolean' then return false end
  local ok = data.accountReachable
  now = num(now) or 0
  note(state, now)
  if ok == state.reach then return false end
  state.reach = ok
  return true
end

-- Whose sightings these are: a lowercased name, or nil before any.
function N.who(state) return state.who end

-- Char.Status's name as a storage key: lowercased, or nil if it has none.
function N.who_of(data)
  local name = type(data) == 'table' and str(data.name)
  if not name or name == '' then return nil end
  return name:lower()
end

-- Another character's sightings in for `who`'s (`saved`, as stored). The ones before are stamped
-- with now, and returned with their name, for main.lua to store; what's in sight goes till the next
-- Space.Charts, which is the new one's. Sightings from before anyone was named (charts before
-- Char.Status) are the first one named's. Nothing changes for the same name.
function N.become(state, who, saved, now)
  if who == nil or who == state.who then return nil end
  now = num(now) or 0
  stamp(state, now)
  note(state, now)
  local was, record = state.who, N.saved(state)
  state.who, state.seen, state.charted, state.contact = who, {}, {}, {}
  N.load(state, saved)
  if was == nil then
    for id, s in pairs(record.seen) do
      local old = state.seen[id]
      if not old or old.at <= s.at then state.seen[id] = s end
    end
    for id in pairs(record.charted) do state.charted[id] = true end
    for id, c in pairs(record.contact) do
      local old = state.contact[id]
      if not old or old.at <= c.at then state.contact[id] = c end
    end
    return nil
  end
  state.visible, state.uncharted, state.reach, state.settled = {}, {}, nil, now
  return was, record
end

-- A disconnect: you're nowhere, so what you could see is as of now; the sightings stay, hers
-- till another character's name comes.
function N.reset(state, now)
  local changed = state.system ~= nil or state.transit ~= nil or #state.visible > 0 or #state.uncharted > 0
  now = num(now) or 0
  stamp(state, now)
  note(state, now)
  state.system, state.visible, state.uncharted, state.transit, state.left = nil, {}, {}, nil, nil
  state.reach, state.settled = nil, nil
  return changed
end

function N.set_on(state, on)
  on = on == true
  if state.on == on then return false end
  state.on = on
  return true
end

function N.on(state) return state.on end

function N.message(state)
  return { system = state.system, visible = state.visible, uncharted = state.uncharted, seen = state.seen,
    contact = state.contact, transit = state.transit,
    reach = settled(state) and { ok = state.reach, after = state.settled + GRACE } or nil }
end

return N
