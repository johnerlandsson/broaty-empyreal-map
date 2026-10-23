-- Action reducer: folds Char.Action (actions.md §9) into what you're doing, for the plan's card:
-- its verb and label, its stage of how many, when it ends as a local timestamp (whole seconds,
-- the game sending `left` only as it starts, at each stage and as the queue changes, never as it
-- counts down) over how long it takes in all, and how many lines wait behind it. Null, as it ends,
-- or nothing usable is doing nothing. A move (`move`: climbing, hauling, dragging, pushing) is one
-- like any other; the game says nothing of which way it goes, so neither does this.
-- Pure and cheap; never errors on missing or odd-typed fields.

local A = {}

local function str(v)
  if type(v) == 'string' and v ~= '' then return v end
  return nil
end

-- A finite number of at least `min`, or nil.
local function num(v, min)
  if type(v) ~= 'number' or v ~= v or v == math.huge or v < min then return nil end
  return v
end

local function whole(v, min, default)
  local n = num(v, -math.huge)
  if not n then return default end
  return math.max(min, math.floor(n))
end

local function key(a)
  if not a then return '' end
  return table.concat({ a.verb or '', a.label, a.stage, a.stages, tostring(a.ends), tostring(a.total), a.queued }, '|')
end

function A.new()
  return {}
end

-- Fold a Char.Action frame received at `now` (os.time()); true if what's shown changed.
function A.char_action(state, data, now)
  local before = key(state.doing)
  local doing = nil
  if type(data) == 'table' then
    local verb = str(data.verb)
    local label = str(data.label) or verb
    if label then
      local stages = whole(data.stages, 1, 1)
      local left = num(data.left, 0)
      local ends = left and num(now, -math.huge) and now + left or nil
      doing = {
        verb = verb,
        label = label,
        stage = math.min(stages, whole(data.stage, 1, 1)),
        stages = stages,
        ends = ends,
        total = ends and math.max(left, num(data.total, 0) or 0) or nil,
        queued = whole(data.queued, 0, 0),
      }
    end
  end
  state.doing = doing
  return key(doing) ~= before
end

-- The panel's message: { action = {...} } while something's under way, else {}.
function A.message(state)
  local a = state.doing
  if not a then return {} end
  return { action = {
    verb = a.verb, label = a.label, stage = a.stage, stages = a.stages, ends = a.ends, total = a.total, queued = a.queued,
  } }
end

function A.reset(state)
  local was = state.doing ~= nil
  state.doing = nil
  return was
end

return A
