-- The generated land (areas `surface.*`) and the sites' rooms behind it (areas `site.*`): a room frame
-- becomes the message the panel draws the walked map from, and a saved record is checked before it
-- goes back to the panel. Nothing is kept here.

local G = {}

local function str(v) return type(v) == 'string' and v or nil end
local function num(v) return type(v) == 'number' and v == v and v or nil end

-- The exits of a frame as the panel takes them, by compass point as sent.
local function exits_of(data)
  local exits = {}
  if type(data.exits) == 'table' then
    for dir, e in pairs(data.exits) do
      if type(e) == 'table' then
        -- style: how the way goes, climb, road or trail (gmcp.md §9.5.3); none for a plain way
        exits[dir] = { id = e.id, area = e.area, inverse = e.inverse, style = str(e.style) }
      end
    end
  end
  return exits
end

-- A site's room (set-pieces.md §3): area `site.<id>`, with no coords (the game doesn't yet send a
-- site's rooms at its front's point), so the panel places it by its front.
local function site_room(data, area)
  local site = area:sub(6)
  local id = str(data.id)
  if site == '' or not id then return nil end
  return { id = id, name = data.name, area = area, areaName = data.areaName, site = site, exits = exits_of(data) }
end

-- The `land-room` message for a mudstd.room.info frame in the generated land or a site's room, or nil
-- for any other.
function G.frame(data)
  if type(data) ~= 'table' then return nil end
  local area = str(data.area)
  if area and area:sub(1, 5) == 'site.' then return site_room(data, area) end
  if not area or area:sub(1, 8) ~= 'surface.' then return nil end
  local id = str(data.id)
  local c = data.coords
  if not id or type(c) ~= 'table' or not num(c.x) or not num(c.y) then return nil end
  -- where x comes round, km (gmcp.md §9.5): on a world with no port the seam can be walked to
  local wrap = type(data.wrap) == 'table' and num(data.wrap.x) or nil
  if wrap and wrap <= 0 then wrap = nil end
  return {
    id = id,
    name = data.name,
    area = area,
    areaName = data.areaName,
    terrain = str(data.terrain), -- what's underfoot (gmcp.md §9.5.1); `room` where the game has none
    coords = { x = c.x, y = c.y, z = num(c.z) },
    wrap = wrap,
    exits = exits_of(data),
  }
end

-- What the panel saved, if it's a table; anything else is no map.
function G.record(saved)
  if type(saved) == 'table' then return saved end
  return nil
end

return G
