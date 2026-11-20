-- The generated land (areas `surface.*`): a room frame becomes the message the panel draws the walked
-- map from, and a saved record is checked before it goes back to the panel. Nothing is kept here.

local G = {}

local function str(v) return type(v) == 'string' and v or nil end
local function num(v) return type(v) == 'number' and v == v and v or nil end

-- The `land-room` message for a mudstd.room.info frame in the generated land, or nil for any other.
function G.frame(data)
  if type(data) ~= 'table' then return nil end
  local area = str(data.area)
  if not area or area:sub(1, 8) ~= 'surface.' then return nil end
  local id = str(data.id)
  local c = data.coords
  if not id or type(c) ~= 'table' or not num(c.x) or not num(c.y) then return nil end
  local exits = {}
  if type(data.exits) == 'table' then
    for dir, e in pairs(data.exits) do
      if type(e) == 'table' then
        -- style: how the way goes, climb, road or trail (gmcp.md §9.5.3); none for a plain way
        exits[dir] = { id = e.id, area = e.area, inverse = e.inverse, style = str(e.style) }
      end
    end
  end
  return {
    id = id,
    name = data.name,
    area = area,
    areaName = data.areaName,
    terrain = str(data.terrain), -- what's underfoot (gmcp.md §9.5.1); `room` where the game has none
    coords = { x = c.x, y = c.y, z = num(c.z) },
    exits = exits,
  }
end

-- What the panel saved, if it's a table; anything else is no map.
function G.record(saved)
  if type(saved) == 'table' then return saved end
  return nil
end

return G
