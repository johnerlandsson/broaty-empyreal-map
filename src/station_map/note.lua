-- Ship note reducer: folds Ship.List (gmcp-schema.ts `shipList`, your own ships only, wherever you
-- are) into your note on the ship you're aboard (`ship note`, 60 characters at most), for the ship
-- plan. She's the entry marked `aboard`, never one picked by name; aboard someone else's ship none
-- is, so there's no note. A missing `note` (servers before empyreal 0a5f686) is no note.
-- The note is tied to the area you were in as the list came (`ship.<n>`, her own): stepping straight
-- into another ship shows none before the next list says you've left her.
-- Pure and cheap; never errors on missing or odd-typed fields.

local F = {}

local function str(v)
  if type(v) == 'string' and v ~= '' then return v end
  return nil
end

-- The aboard entry's note, or nil.
local function aboard_note(data)
  local ships = type(data) == 'table' and data.ships or nil
  if type(ships) ~= 'table' then return nil end
  for _, e in ipairs(ships) do
    if type(e) == 'table' and e.aboard == true then return str(e.note) end
  end
  return nil
end

function F.new()
  return {}
end

-- Fold a Ship.List frame, sent while you were in `area`; true if the note or its area changed.
function F.ship_list(state, data, area)
  local note = aboard_note(data)
  local at = note and str(area) or nil
  local changed = note ~= state.note or at ~= state.area
  state.note = note
  state.area = at
  return changed
end

-- Your note on her, while you're in `area` and it's the area her note came in; else nil.
function F.note(state, area)
  if state.note and state.area and state.area == area then return state.note end
  return nil
end

function F.reset(state)
  local was = state.note ~= nil
  state.note = nil
  state.area = nil
  return was
end

return F
