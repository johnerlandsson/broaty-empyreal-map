-- Course reducer: folds Ship.Course (gmcp.md §8.6) into the course `plot` stored on the ship you
-- operate, for the chart's line and corner card: where it goes (`to`, a location id, or a ship's
-- vessel key or `contact-N`) and its `name`, its `km`, `seconds` and `fuel` from where she'd be when
-- it was done, whether it's `ragged` (a failed plot, ×1.15 time and fuel), and `at`, wall-clock ms
-- it was plotted. Null is no course: the game sends it as she arrives, as it's cleared, and with no
-- ship. A plot still being worked out isn't sent; the course is, once it's done.
-- Pure and cheap; never errors on missing or odd-typed fields.

local K = {}

local function str(v)
  if type(v) == 'string' and v ~= '' then return v end
  return nil
end

-- A finite number of 0 or more, or nil: a course that can't meet a ship has none.
local function num(v)
  if type(v) ~= 'number' or v ~= v or v == math.huge or v < 0 then return nil end
  return v
end

local function key(c)
  if not c then return '' end
  return table.concat({ c.to, c.name, tostring(c.km), tostring(c.seconds), tostring(c.fuel),
    tostring(c.ragged), tostring(c.at) }, '|')
end

function K.new()
  return {}
end

-- Fold a Ship.Course frame; true if what's shown changed.
function K.ship_course(state, data)
  local before = key(state.course)
  local course = nil
  if type(data) == 'table' and str(data.to) then
    course = {
      to = data.to,
      name = str(data.name) or data.to,
      km = num(data.km),
      seconds = num(data.seconds),
      fuel = num(data.fuel),
      ragged = data.ragged == true,
      at = num(data.at),
    }
  end
  state.course = course
  return key(course) ~= before
end

-- The panel's message: { course = {...} } while one is stored, else {}.
function K.message(state)
  local c = state.course
  if not c then return {} end
  return { course = {
    to = c.to, name = c.name, km = c.km, seconds = c.seconds, fuel = c.fuel, ragged = c.ragged, at = c.at,
  } }
end

function K.reset(state)
  local was = state.course ~= nil
  state.course = nil
  return was
end

return K
