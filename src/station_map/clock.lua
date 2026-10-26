-- Clock reducer: folds Empyreal.Clock (empyreal gmcp.md §8.8) into today by Empyreal time, for the
-- panel's station-time tab: its `weekday` ("wednesday"), `day` (days since tick 0's), `midnight`,
-- the wall-clock ms it began, and `dayMs`, how long a day is in ms (about 4.2 real hours). The panel
-- keeps the time from those; the game sends it again only at login, at each midnight and after a
-- restart. Nothing until the first, and nothing again after a disconnect: no UTC to fall back on.
-- Pure and cheap; never errors on missing or odd-typed fields.

local T = {}

local WEEKDAYS = {
  monday = true, tuesday = true, wednesday = true, thursday = true, friday = true, saturday = true,
  sunday = true,
}

local function finite(v)
  return type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge
end

-- In full: tostring would round a float's ms to 14 figures.
local function n(v)
  return v and string.format('%.17g', v) or ''
end

local function key(c)
  if not c then return '' end
  return table.concat({ c.weekday, n(c.day), n(c.midnight), n(c.dayMs) }, '|')
end

function T.new()
  return {}
end

-- Fold an Empyreal.Clock frame; true if the clock changed. A frame that can't run a clock (no
-- weekday the game names, no midnight, no day of positive length) is ignored: the last one stands.
function T.empyreal_clock(state, data)
  if type(data) ~= 'table' then return false end
  local weekday = type(data.weekday) == 'string' and string.lower(data.weekday) or nil
  if not WEEKDAYS[weekday] or not finite(data.midnight) or not finite(data.dayMs) or data.dayMs <= 0 then
    return false
  end
  local before = key(state.clock)
  state.clock = {
    weekday = weekday,
    day = finite(data.day) and data.day or nil,
    midnight = data.midnight,
    dayMs = data.dayMs,
  }
  return key(state.clock) ~= before
end

-- The panel's message: { clock = {...} } once one has come, else {}.
function T.message(state)
  local c = state.clock
  if not c then return {} end
  return { clock = { weekday = c.weekday, day = c.day, midnight = c.midnight, dayMs = c.dayMs } }
end

function T.reset(state)
  local was = state.clock ~= nil
  state.clock = nil
  return was
end

return T
