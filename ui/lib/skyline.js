// Zennor's skyline, as a section across the Carn's valley looking north up the river, so west is
// on the left as it is on the sky's dome over it (town-view.js): Westbank's ridge and its
// tenements and mill chimneys, the river, then the city up the east side, Riverside's mills, the
// Rows' tenements, the Courts' columns, the Market Quarter's Corn Exchange and Pannier Market,
// the old town's low roofs under the ridge, the tram's rails up the scarp, and the Downs on top
// with the field. Drawn from the rooms' prose in content/areas/zennor.yaml (empyreal 94cb413,
// planetside.md §5.1), where every view looks onto more city (decision 17); nothing in it is a
// room. The view is framed on the district you're in (Empyreal.Room's `district`): walking down
// the city slides it west to east. The Terraces are south of the city, off this section, and have
// one of their own, with the city small up the valley behind. Pure: town-skyline.js draws it.

import { rng } from "./svg.js";

/** A section: `land` the ground's [x, h] west to east (x east, h up), `props` what stands on it as
 *  [x, kind, w, h] (x its west end; world units), and what else it has. */
export const VALLEY = {
  land: [
    [-1600, 140], [-560, 140], [-500, 128], [-420, 105], [-320, 74], [-200, 40], [-100, 16], [-30, 3], [-18, -4],
    [18, -4], [28, 4], [70, 10], [110, 22], [150, 34], [195, 46], [250, 60], [300, 80], [365, 100], [380, 104],
    [392, 140], [405, 160], [425, 172], [1600, 172],
  ],
  river: [-18, 18],
  // the ridge above the old town, the Ridge Path's and the Overlook's, behind it to the north
  ridge: [[225, 58], [280, 104], [320, 128], [352, 136], [390, 126], [420, 150]],
  scarp: [380, 425], // its face, the Steps' and the tram's way up to the Downs
  tram: { from: 60, to: 430, car: 300 }, // Riverside Station to Downs Station, the car halfway
  props: [
    ...westbank(),
    [-24, "bridge", 48, 6], // Carn Bridge's five arches
    // Riverside: the mills on their lane, a chimney, the Kiln Yard
    [30, "mill", 16, 10], [50, "chimney", 3, 26], [56, "mill", 14, 9], [72, "kiln", 8, 14],
    // the Rows: tenements four and five storeys, stepping up the slope
    [84, "tenement", 10, 20], [95, "tenement", 10, 23], [106, "tenement", 10, 19], [117, "tenement", 10, 22],
    [128, "tenement", 10, 24], [139, "tenement", 9, 20],
    // the Courts: buildings of state, columned and grave, and the Founders' Garden's trees
    [152, "columns", 22, 12], [176, "tree", 4, 8], [182, "tree", 4, 9], [188, "columns", 10, 10],
    // the Market Quarter: the Corn Exchange's glass and iron vault, the Pannier Market's iron roof, the arcades
    [198, "vault", 26, 12], [226, "pannier", 18, 7], [245, "block", 9, 8],
    // the old town: low ochre houses, the Tinners' Hall, the Field Gate's arch at the foot of the scarp
    [256, "block", 9, 6], [267, "block", 11, 7], [280, "block", 8, 6], [289, "block", 6, 7], [296, "hall", 12, 11],
    [310, "block", 9, 8], [322, "block", 12, 6], [337, "block", 9, 7], [349, "block", 10, 6], [366, "arch", 8, 8],
    // the Downs: the tram's winding house at the edge, the Field Office, blast walls round the
    // field, the Port Office's squat tower, fuel tanks half sunk, a mast, a stone hut
    [430, "winding", 14, 10], [452, "block", 26, 6], [490, "wall", 40, 3], [540, "wall", 46, 3], [596, "tower", 12, 22],
    [640, "wall", 40, 3], [700, "tank", 12, 4], [716, "tank", 12, 4], [790, "mast", 1, 22], [900, "block", 6, 4],
    [1050, "tank", 12, 4],
  ],
};

/** Westbank, "as big again as this one and climbing the far side of the valley to its own ridge":
 *  tenements, with a mill chimney among them now and then. Seeded, so it's the same every time. */
function westbank() {
  const r = rng(7);
  const out = [];
  for (let x = -470; x < -30; x += 14 + r() * 10) out.push([Math.round(x), r() < 0.18 ? "chimney" : "tenement", Math.round(9 + r() * 6), Math.round(8 + r() * 12)]);
  return out;
}

/** The valley at the terraces, south of the city where it widens: long fields stepping down the
 *  east side, each held up by a wall with a leat along its top, and the Seed House among them. */
export const TERRACES = {
  land: [
    [-1600, 60], [-560, 60], [-420, 44], [-260, 22], [-120, 8], [-30, 2], [-16, -4],
    [16, -4], [30, 2], ...steps(40, 4, 9), [420, 72], [480, 84], [1600, 84],
  ],
  river: [-16, 16],
  props: [[226, "barn", 22, 9]],
};

/** n terraces up from x, h: a flat 30 wide, then a wall 6 high up to the next. */
function steps(x, h, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push([x + 34 * i, h + 6 * i], [x + 34 * i + 30, h + 6 * i]);
  return out;
}

/** The terraces' flats, [x0, x1, h] each, for their crops and leats. */
export function terraceFlats() {
  const land = TERRACES.land;
  const out = [];
  for (let i = 1; i < land.length; i++) {
    const [x0, h0] = land[i - 1], [x1, h1] = land[i];
    if (h0 === h1 && x0 >= 40 && x1 < 420) out.push([x0, x1, h0]);
  }
  return out;
}

/** Where each district is across the valley, west to east, on VALLEY: its middle. */
export const PLACES = { riverside: 48, rows: 120, courts: 172, "market-quarter": 222, "old-town": 320, downs: 470 };
export const DISTRICTS = [...Object.keys(PLACES), "terraces"];

/** The ground's height at x on a section's land. */
export function groundAt(land, x) {
  if (x <= land[0][0]) return land[0][1];
  for (let i = 1; i < land.length; i++) {
    const [x0, h0] = land[i - 1], [x1, h1] = land[i];
    if (x <= x1) return h0 + ((x - x0) / (x1 - x0)) * (h1 - h0);
  }
  return land[land.length - 1][1];
}

/**
 * What to draw for a district: a list of layers, far to near, each a section with how to frame it
 * into the band, x' = (x - x0) * k, y' = y0 - h * v, and a size factor for what stands on it. The
 * band's horizon is at y 52 and its foot at 100 (town-view.js). Null for a district that isn't
 * Zennor's (the tram car has none): keep showing the last.
 */
export function skylineFor(district) {
  if (district === "terraces")
    return [
      { section: VALLEY, far: true, x0: 200, k: 0.28, y0: 50, v: 0.34, size: 0.55 },
      { section: TERRACES, x0: 150, k: 0.9, y0: 100, v: 1.1, size: 1.6 },
    ];
  if (!Object.hasOwn(PLACES, district ?? "")) return null;
  return [{ section: VALLEY, x0: PLACES[district], k: 0.6, y0: 84, v: 0.86, size: 1.35 }];
}

/** A point of a section into the band, by its layer. */
export const project = (layer, x, h) => [(x - layer.x0) * layer.k, layer.y0 - h * layer.v];
