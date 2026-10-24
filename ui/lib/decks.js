// Stations laid out on decks (station.md §2.6 in the Empyreal source): a station that doesn't
// spin, every room a cell of one grid, addressed "Deck 3, frame 2, port 1". The address is the
// cell, as the game's coords are: x the side (starboard positive), y the frame (counting fore), z
// the deck (counting up, away from the planet). Everything here is placed from those cells, so a
// new station on decks needs its rooms and a spec, not a hand-made layout. The model uses the
// other stations' frame (X = 3 o'clock, starboard; Y = 12 o'clock, up; Z = fore), so the one
// camera and renderer draw it. Pure; no DOM.

import { DISTRICT_COLOURS } from "./geometry.js";

// --- the stations ----------------------------------------------------------------------------

/**
 * What the addresses don't say. `prefix` is the rooms' id prefix; `tints` a district colour per
 * room; `blisters` the rooms that are glass blisters outside the hull, not cells of it; `cradles`
 * the blocks fore of the nose, each [side, deck, half-width, half-height, length] in cells; and
 * `masts`, if it has any, each stood up off the roof with a lamp at its top, [side, frame, height]
 * in cells (the height in decks).
 */
export const DECKS = {
  // A foundry port: orange paint inside, a docking well at the nose with big cradles for ore tugs
  // and drop cans and small ones for skiffs wedged in at the corners, and the Gallery a glass
  // blister under Deck 2 looking down at Orrin. (No thruster bells aft: on the plan they read as
  // a ship's stern under the station.)
  orrin: {
    prefix: "orrin",
    tints: {
      "orrin.berth": DISTRICT_COLOURS.docks,
      "orrin.deck-3-frame-2": DISTRICT_COLOURS.industrial, // foundry orange
      "orrin.deck-3-frame-1": DISTRICT_COLOURS.industrial,
      "orrin.freight": DISTRICT_COLOURS.industrial,
      "orrin.charts": DISTRICT_COLOURS.docks,
      "orrin.concourse": DISTRICT_COLOURS.industrial,
      "orrin.deck-2-frame-2": DISTRICT_COLOURS.industrial,
      "orrin.market": DISTRICT_COLOURS.concourse,
      "orrin.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["orrin.gallery"],
    cradles: [
      [0, 3, 0.3, 0.3, 0.22], // the docking well's mouth
      [-1, 3, 0.34, 0.3, 0.7], // ore tugs and drop cans
      [1, 3, 0.34, 0.3, 0.7],
      [0, 2, 0.34, 0.3, 0.7],
      [-1, 2, 0.18, 0.16, 0.36], // skiffs, at the corners
      [1, 2, 0.18, 0.16, 0.36],
    ],
  },
  // The halts below are laid out as Orrin is, room for room; only their paint and their cradles
  // differ.

  // A gas giant's skimmer port: passages in scuffed hazard yellow, a weather office for charts,
  // and squat, scoop-mouthed skimmers in short cradles round the well.
  morvah: {
    prefix: "morvah",
    tints: {
      "morvah.berth": DISTRICT_COLOURS.docks,
      "morvah.deck-3-frame-2": DISTRICT_COLOURS.concourse, // hazard yellow
      "morvah.deck-3-frame-1": DISTRICT_COLOURS.concourse,
      "morvah.freight": DISTRICT_COLOURS.midring, // spare parts in, waiting on the crews
      "morvah.charts": DISTRICT_COLOURS.offices, // Morvah's weather, storm band by storm band
      "morvah.concourse": DISTRICT_COLOURS.concourse,
      "morvah.deck-2-frame-2": DISTRICT_COLOURS.concourse,
      "morvah.market": DISTRICT_COLOURS.offices,
      "morvah.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["morvah.gallery"],
    cradles: [
      [0, 3, 0.3, 0.3, 0.22], // the docking well's mouth
      [-1, 3, 0.36, 0.32, 0.42], // skimmers: squat
      [1, 3, 0.36, 0.32, 0.42],
      [-1, 2, 0.36, 0.32, 0.42],
      [0, 2, 0.36, 0.32, 0.42],
      [1, 2, 0.36, 0.32, 0.42],
    ],
  },
  // A dry world's smelter port: rust-red paint over the red dust, ingots in the freight office,
  // and ore barges and one water tanker in the cradles.
  gwithian: {
    prefix: "gwithian",
    tints: {
      "gwithian.berth": DISTRICT_COLOURS.docks,
      "gwithian.deck-3-frame-2": DISTRICT_COLOURS.industrial, // rust red
      "gwithian.deck-3-frame-1": DISTRICT_COLOURS.industrial,
      "gwithian.freight": DISTRICT_COLOURS.midring, // ingots, waiting to go out
      "gwithian.charts": DISTRICT_COLOURS.docks,
      "gwithian.concourse": DISTRICT_COLOURS.industrial,
      "gwithian.deck-2-frame-2": DISTRICT_COLOURS.industrial,
      "gwithian.market": DISTRICT_COLOURS.concourse,
      "gwithian.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["gwithian.gallery"],
    cradles: [
      [0, 3, 0.3, 0.3, 0.22], // the docking well's mouth
      [-1, 3, 0.34, 0.3, 0.75], // ore barges
      [1, 3, 0.34, 0.3, 0.75],
      [0, 2, 0.3, 0.3, 0.95], // the water tanker
      [-1, 2, 0.18, 0.16, 0.36], // skiffs, at the corners
      [1, 2, 0.18, 0.16, 0.36],
    ],
  },
  // The shipyards' port: everything a sensible grey and kept that way, crates of ships' parts in
  // the freight office, buyers at the exchange, and the cradles in neat even rows.
  carrow: {
    prefix: "carrow",
    tints: {
      "carrow.berth": DISTRICT_COLOURS.docks,
      "carrow.deck-3-frame-2": DISTRICT_COLOURS.midring, // sensible grey
      "carrow.deck-3-frame-1": DISTRICT_COLOURS.midring,
      "carrow.freight": DISTRICT_COLOURS.industrial, // ships' parts from the yards
      "carrow.charts": DISTRICT_COLOURS.docks,
      "carrow.concourse": DISTRICT_COLOURS.midring,
      "carrow.deck-2-frame-2": DISTRICT_COLOURS.midring,
      "carrow.market": DISTRICT_COLOURS.offices, // the yards' standing bids
      "carrow.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["carrow.gallery"],
    cradles: [
      [0, 3, 0.3, 0.3, 0.22], // the docking well's mouth
      [-1, 3, 0.3, 0.28, 0.6], // all alike, in rows
      [1, 3, 0.3, 0.28, 0.6],
      [-1, 2, 0.3, 0.28, 0.6],
      [0, 2, 0.3, 0.28, 0.6],
      [1, 2, 0.3, 0.28, 0.6],
    ],
  },
  // An old garden world's port: handlines in green cord, herbs and trailing vines, grain sacks in
  // the freight office, and broad, slow grain ships in wide cradles.
  lanyon: {
    prefix: "lanyon",
    tints: {
      "lanyon.berth": DISTRICT_COLOURS.docks,
      "lanyon.deck-3-frame-2": DISTRICT_COLOURS.hydroponics, // green cord and herbs
      "lanyon.deck-3-frame-1": DISTRICT_COLOURS.hydroponics,
      "lanyon.freight": DISTRICT_COLOURS.concourse, // grain
      "lanyon.charts": DISTRICT_COLOURS.docks,
      "lanyon.concourse": DISTRICT_COLOURS.hydroponics, // planters and vines
      "lanyon.deck-2-frame-2": DISTRICT_COLOURS.hydroponics,
      "lanyon.market": DISTRICT_COLOURS.commons, // a factor in a good coat
      "lanyon.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["lanyon.gallery"],
    cradles: [
      [0, 3, 0.3, 0.3, 0.22], // the docking well's mouth
      [-1, 3, 0.44, 0.3, 0.8], // grain ships: broad and slow
      [1, 3, 0.44, 0.3, 0.8],
      [0, 2, 0.44, 0.3, 0.8],
    ],
  },  // An ice world's port, and very bright: passages lagged and felted in white, blue water tanks and
  // white ice crates in the freight office, a narrow docking well, and long ice haulers in the cradles.
  kynance: {
    prefix: "kynance",
    tints: {
      "kynance.berth": DISTRICT_COLOURS.docks,
      "kynance.deck-3-frame-2": DISTRICT_COLOURS.docks, // white lagging, very bright
      "kynance.deck-3-frame-1": DISTRICT_COLOURS.docks,
      "kynance.freight": DISTRICT_COLOURS.residential, // blue water tanks
      "kynance.charts": DISTRICT_COLOURS.residential, // the floes being worked, marked in blue
      "kynance.concourse": DISTRICT_COLOURS.docks,
      "kynance.deck-2-frame-2": DISTRICT_COLOURS.docks,
      "kynance.market": DISTRICT_COLOURS.concourse, // small and warm
      "kynance.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["kynance.gallery"],
    cradles: [
      [0, 3, 0.24, 0.26, 0.22], // the docking well's mouth: narrow
      [-1, 3, 0.32, 0.3, 0.9], // ice haulers: long
      [1, 3, 0.32, 0.3, 0.9],
      [0, 2, 0.32, 0.3, 0.9],
    ],
  },
  // A spice world's port, warm and close: berth numbers in green on gold, handlines in plaited fibre,
  // crates of greens and sacks of spice in the freight office, and the growers' traders in the cradles.
  marazion: {
    prefix: "marazion",
    tints: {
      "marazion.berth": DISTRICT_COLOURS.docks,
      "marazion.deck-3-frame-2": DISTRICT_COLOURS.concourse, // green on gold, and pepper
      "marazion.deck-3-frame-1": DISTRICT_COLOURS.concourse,
      "marazion.freight": DISTRICT_COLOURS.hydroponics, // greens and spice
      "marazion.charts": DISTRICT_COLOURS.offices, // Marazion's weather, redrawn by hand
      "marazion.concourse": DISTRICT_COLOURS.concourse,
      "marazion.deck-2-frame-2": DISTRICT_COLOURS.concourse,
      "marazion.market": DISTRICT_COLOURS.commons, // factors in bright shirts
      "marazion.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["marazion.gallery"],
    cradles: [
      [0, 3, 0.3, 0.3, 0.22], // the docking well's mouth
      [-1, 3, 0.34, 0.3, 0.6], // traders
      [1, 3, 0.34, 0.3, 0.6],
      [-1, 2, 0.34, 0.3, 0.6],
      [0, 2, 0.34, 0.3, 0.6],
      [1, 2, 0.34, 0.3, 0.6],
    ],
  },
  // The domed towns' port: a faded green touched up by hand, white vat drums and ice tanks in the
  // freight office, wide cargo collars at the hatches, the towns' carriers and an ice hauler in the
  // cradles.
  penwith: {
    prefix: "penwith",
    tints: {
      "penwith.berth": DISTRICT_COLOURS.docks,
      "penwith.deck-3-frame-2": DISTRICT_COLOURS.hydroponics, // faded green, touched up
      "penwith.deck-3-frame-1": DISTRICT_COLOURS.hydroponics,
      "penwith.freight": DISTRICT_COLOURS.midring, // vat drums and ice tanks
      "penwith.charts": DISTRICT_COLOURS.docks,
      "penwith.concourse": DISTRICT_COLOURS.hydroponics,
      "penwith.deck-2-frame-2": DISTRICT_COLOURS.hydroponics,
      "penwith.market": DISTRICT_COLOURS.offices, // a clerk with a town's crest
      "penwith.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["penwith.gallery"],
    cradles: [
      [0, 3, 0.3, 0.3, 0.22], // the docking well's mouth
      [-1, 3, 0.42, 0.3, 0.65], // the towns' carriers: wide
      [1, 3, 0.42, 0.3, 0.65],
      [0, 2, 0.3, 0.3, 0.9], // an ice hauler
    ],
  },
  // An old mining town lifted into orbit: grey grit in every seam, ore bins in the freight office, a
  // lamp from the old workings in the concourse, and heavy ore carriers low in their cradles, with
  // prospectors' skiffs at the corners.
  botallack: {
    prefix: "botallack",
    tints: {
      "botallack.berth": DISTRICT_COLOURS.docks,
      "botallack.deck-3-frame-2": DISTRICT_COLOURS.midring, // grey grit
      "botallack.deck-3-frame-1": DISTRICT_COLOURS.midring,
      "botallack.freight": DISTRICT_COLOURS.industrial, // ore bins
      "botallack.charts": DISTRICT_COLOURS.docks,
      "botallack.concourse": DISTRICT_COLOURS.industrial, // stained coveralls, the old workings' lamp
      "botallack.deck-2-frame-2": DISTRICT_COLOURS.midring,
      "botallack.market": DISTRICT_COLOURS.concourse, // the assay board
      "botallack.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["botallack.gallery"],
    cradles: [
      [0, 3, 0.3, 0.3, 0.22], // the docking well's mouth
      [-1, 3, 0.42, 0.22, 0.8], // ore carriers: low and heavy
      [1, 3, 0.42, 0.22, 0.8],
      [0, 2, 0.42, 0.22, 0.8],
      [-1, 2, 0.18, 0.16, 0.36], // prospectors' skiffs, at the corners
      [1, 2, 0.18, 0.16, 0.36],
    ],
  },
  // An old colony's dock, built for far more traffic than comes now: faded enamel signs, a customs
  // hall with a brass bell for the freight office, and a wide well with cradles in rows, most of them
  // empty. (No paint is named, so its passages wear a colour no other station's do.)
  polperro: {
    prefix: "polperro",
    tints: {
      "polperro.berth": DISTRICT_COLOURS.docks,
      "polperro.deck-3-frame-2": DISTRICT_COLOURS.commons, // faded enamel
      "polperro.deck-3-frame-1": DISTRICT_COLOURS.commons,
      "polperro.freight": DISTRICT_COLOURS.concourse, // the old customs hall's brass
      "polperro.charts": DISTRICT_COLOURS.docks,
      "polperro.concourse": DISTRICT_COLOURS.commons,
      "polperro.deck-2-frame-2": DISTRICT_COLOURS.commons,
      "polperro.market": DISTRICT_COLOURS.midring, // the empty mountings capped
      "polperro.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["polperro.gallery"],
    cradles: [
      [0, 3, 0.36, 0.32, 0.22], // the docking well's mouth: wide
      [-1, 3, 0.3, 0.28, 0.6], // more cradles than it needs
      [1, 3, 0.3, 0.28, 0.6],
      [-1, 2, 0.3, 0.28, 0.6],
      [0, 2, 0.3, 0.28, 0.6],
      [1, 2, 0.3, 0.28, 0.6],
    ],
  },
  // A stores depot at the inner edge, lit warm and low: passages in a pale cream, ration crates in the
  // freight office, stores tenders in the cradles, and the Light, an old lamp on a mast at the nose.
  lamorna: {
    prefix: "lamorna",
    tints: {
      "lamorna.berth": DISTRICT_COLOURS.docks,
      "lamorna.deck-3-frame-2": DISTRICT_COLOURS.concourse, // pale cream, lit warm
      "lamorna.deck-3-frame-1": DISTRICT_COLOURS.concourse,
      "lamorna.freight": DISTRICT_COLOURS.midring, // ration crates in tidy columns
      "lamorna.charts": DISTRICT_COLOURS.docks,
      "lamorna.concourse": DISTRICT_COLOURS.concourse,
      "lamorna.deck-2-frame-2": DISTRICT_COLOURS.concourse,
      "lamorna.market": DISTRICT_COLOURS.commons, // a clerk tallying the run
      "lamorna.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["lamorna.gallery"],
    cradles: [
      [0, 3, 0.3, 0.3, 0.22], // the docking well's mouth
      [-1, 3, 0.34, 0.3, 0.6], // stores tenders
      [1, 3, 0.34, 0.3, 0.6],
      [0, 2, 0.34, 0.3, 0.6],
    ],
    masts: [[-1.25, 3.35, 1.65]], // the Light, at the nose's port corner, clear of the berths
  },

  // The Mid's three halts are smaller than Orrin and laid out otherwise, six rooms each round one
  // passage, with a berth for nothing bigger than a medium ship; none is the Authority's.

  // A settlers' cooperative over a wet green moor: Deck 2 a cross of five cells, the passage's felt
  // a worn grey, grain and greens at the exchange, a warm kitchen and quilts in the commons, and the
  // Gallery a glass blister under the commons. Two even cradles for the settlers' own boats.
  kilmar: {
    prefix: "kilmar",
    tints: {
      "kilmar.berth": DISTRICT_COLOURS.docks,
      "kilmar.deck-2-frame-2": DISTRICT_COLOURS.midring, // grey felt
      "kilmar.market": DISTRICT_COLOURS.hydroponics, // grain and greens, Henwood mud on them
      "kilmar.kitchen": DISTRICT_COLOURS.concourse, // bread, the stove
      "kilmar.commons": DISTRICT_COLOURS.commons, // the quilts
      "kilmar.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["kilmar.gallery"],
    cradles: [
      [0, 2, 0.3, 0.3, 0.22], // the docking well's mouth
      [-1, 2, 0.3, 0.26, 0.55], // the settlers' boats
      [1, 2, 0.3, 0.26, 0.55],
    ],
  },
  // A mining company's port: company grey, its prices behind a grille, a canteen, and the Shift Hall
  // alone on Deck 2 over the Gallery's blister. Long, matched cradles for the company's ore boats.
  caradon: {
    prefix: "caradon",
    tints: {
      "caradon.berth": DISTRICT_COLOURS.docks,
      "caradon.deck-3-frame-1": DISTRICT_COLOURS.midring, // company grey
      "caradon.market": DISTRICT_COLOURS.offices, // the company's prices, behind a grille
      "caradon.canteen": DISTRICT_COLOURS.concourse, // meals on trays
      "caradon.hall": DISTRICT_COLOURS.industrial, // lockers and the time clock
      "caradon.gallery": DISTRICT_COLOURS.docks,
    },
    blisters: ["caradon.gallery"],
    cradles: [
      [0, 3, 0.3, 0.3, 0.22], // the docking well's mouth
      [-1, 3, 0.32, 0.3, 0.78], // ore boats, alike
      [1, 3, 0.32, 0.3, 0.78],
    ],
  },
  // The prospectors' last port before the Core: bare metal, ore on the assay scale, a warm snug,
  // hammocks in the commons, and fore of it the Lookout. Its glass bulges from a cell inside the box,
  // under the Berths, so it's drawn as a room of the hull, in glass's tint, not as a blister. Two
  // cramped cradles that don't match.
  garrow: {
    prefix: "garrow",
    tints: {
      "garrow.berth": DISTRICT_COLOURS.docks,
      "garrow.deck-2-frame-1": DISTRICT_COLOURS.midring, // scuffed bare to the metal
      "garrow.market": DISTRICT_COLOURS.industrial, // ore on the assay scale
      "garrow.snug": DISTRICT_COLOURS.concourse, // the stove and the bar
      "garrow.commons": DISTRICT_COLOURS.residential, // hammocks
      "garrow.lookout": DISTRICT_COLOURS.docks,
    },
    blisters: [],
    cradles: [
      [0, 2, 0.3, 0.3, 0.22], // the docking well's mouth
      [-1, 2, 0.3, 0.28, 0.55],
      [1, 2, 0.2, 0.18, 0.34], // smaller, and not its match
    ],
  },
};

// --- addresses and the index -----------------------------------------------------------------

const ADDRESS = /^\s*deck\s+(\d+)\s*,?\s*frame\s+(\d+)(?:\s*,?\s*(port|starboard)(?:\s+(\d+))?)?\s*$/i;

/** "Deck 3, frame 2, port 1" -> {x: -1, y: 2, z: 3}; a side alone is 1 off the centreline. */
export function parseAddress(address) {
  const m = typeof address === "string" ? ADDRESS.exec(address) : null;
  if (!m) return null;
  const n = m[4] === undefined ? 1 : Number(m[4]);
  const x = !m[3] ? 0 : m[3].toLowerCase() === "port" ? -n : n;
  return { x, y: Number(m[2]), z: Number(m[1]) };
}

/**
 * The station's rooms by id, each with its `cell` from its address, whether it's a `passage` (an
 * unnamed cell, named by its address) or a `blister`, and its `level`: the plan it's on, the top
 * deck first. `hull` is the box the cells that aren't blisters fill, in cells. Rooms without an
 * address the grid knows are left out.
 * @param {{rooms: object[]}} data
 * @param {typeof DECKS.orrin} spec
 */
export function indexDecks(data, spec) {
  const byId = new Map();
  for (const room of data?.rooms ?? []) {
    const cell = parseAddress(room.address);
    if (!cell) continue;
    const passage = String(room.name).toLowerCase() === String(room.address).toLowerCase();
    byId.set(room.id, { ...room, cell, passage, blister: spec.blisters?.includes(room.id) ?? false });
  }
  const decks = [...new Set([...byId.values()].map((r) => r.cell.z))].sort((a, b) => b - a);
  for (const room of byId.values()) room.level = decks.indexOf(room.cell.z);

  const cells = [...byId.values()].filter((r) => !r.blister).map((r) => r.cell);
  const span = (k) => [Math.min(...cells.map((c) => c[k])), Math.max(...cells.map((c) => c[k]))];
  const [x0, x1] = span("x");
  const [y0, y1] = span("y");
  const [z0, z1] = span("z");
  return { byId, decks, hull: cells.length ? { x0, x1, y0, y1, z0, z1 } : null };
}

/** The player's place: a room on the station and the plan it's on, or "off". Never throws. */
export function locateDecks(index, msg) {
  try {
    const room = typeof msg?.roomId === "string" ? index.byId.get(msg.roomId) : undefined;
    if (room) return { kind: "room", id: room.id, level: room.level, x: room.cell.x, y: room.cell.y };
    return { kind: "off", name: typeof msg?.name === "string" ? msg.name : "" };
  } catch {
    return { kind: "off", name: "" };
  }
}

/** The model face key for the player's place: the room's id, or null off the station. */
export function decksKey(where) {
  return where?.kind === "room" ? where.id : null;
}

/** The deck the model is cut away above for the player's place (their own), or null for none. */
export function decksCut(index, where) {
  if (where?.kind !== "room") return null;
  const z = index.byId.get(where.id)?.cell.z;
  return Number.isFinite(z) ? z : null;
}

// --- the model -------------------------------------------------------------------------------

/** Model units per cell: across (side), along (frame) and up (deck). */
export const CELL = { side: 64, frame: 96, deck: 52 };

// A unit cube's six faces, each its outward normal and its corners as signs, wound outward.
const CUBE = [
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], c: [[-1, 1, -1], [1, 1, -1], [1, -1, -1], [-1, -1, -1]] },
  { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [1, 0, 0], c: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { n: [-1, 0, 0], c: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]] },
];
// the blister's profile from the hull down: [radius, depth] as fractions of its radius
const DOME = [[0.66, 0], [0.66, 0.2], [1, 0.34], [0.96, 0.66], [0.76, 0.94], [0.42, 1.1]];
const DOME_SIDES = 12;

/**
 * The hull, a box of cells whose faces are tinted by the room behind them, cut away above the
 * player's deck (`deck`, `outline` and `lid`, see ModelView.draw); each room's cell as a ghost
 * box (`ghost`: drawn only when lit); the blisters in glass outside the hull, and the cradles fore
 * of the nose. Nothing turns.
 * @param {ReturnType<typeof indexDecks>} index
 * @param {typeof DECKS.orrin} spec
 */
export function buildDecksModel(index, spec) {
  const faces = [];
  const { hull } = index;
  if (!hull) return faces;
  const add = (pts, kind, key, extra) =>
    faces.push({
      pts,
      kind,
      key,
      tint: key ? (spec.tints[key] ?? null) : null,
      edges: pts.map(() => true),
      turns: false,
      cull: true,
      layer: 0,
      ...extra,
    });

  const mid = [(hull.x0 + hull.x1) / 2, (hull.y0 + hull.y1) / 2, (hull.z0 + hull.z1) / 2];
  // a cell (side, frame, deck) to model space
  const at = (x, y, z) => [(x - mid[0]) * CELL.side, (z - mid[2]) * CELL.deck, (y - mid[1]) * CELL.frame];
  const half = [CELL.side / 2, CELL.deck / 2, CELL.frame / 2];
  const corner = (c, s) => c.map((v, k) => v + s[k] * half[k]);

  const inHull = (x, y, z) =>
    x >= hull.x0 && x <= hull.x1 && y >= hull.y0 && y <= hull.y1 && z >= hull.z0 && z <= hull.z1;
  const roomAt = new Map();
  for (const r of index.byId.values()) if (!r.blister) roomAt.set(`${r.cell.x}:${r.cell.y}:${r.cell.z}`, r);
  // model axis k (X, Y, Z) -> the cell's step along it (side, deck, frame)
  const step = (cell, k, s) => {
    const [x, y, z] = cell;
    return k === 0 ? [x + s, y, z] : k === 1 ? [x, y, z + s] : [x, y + s, z];
  };

  // the hull: a facet for every cell face on the box's outside, tinted by the room behind it and
  // edged only where the box is, so a deck above the cut is an outline; and each deck's top, the
  // lid it shows when the decks above it are cut away
  for (let x = hull.x0; x <= hull.x1; x++) {
    for (let y = hull.y0; y <= hull.y1; y++) {
      for (let z = hull.z0; z <= hull.z1; z++) {
        const c = at(x, y, z);
        const room = roomAt.get(`${x}:${y}:${z}`);
        for (const { n, c: signs } of CUBE) {
          const k = n.findIndex((v) => v !== 0);
          const outside = !inHull(...step([x, y, z], k, n[k]));
          if (!outside && n[1] !== 1) continue;
          const edges = signs.map((a, i) => {
            const b = signs[(i + 1) % 4];
            const e = [0, 1, 2].find((j) => j !== k && a[j] === b[j]);
            return !inHull(...step([x, y, z], e, a[e]));
          });
          faces.push({
            pts: signs.map((s) => corner(c, s)),
            kind: "outer",
            key: null,
            tint: room ? (spec.tints[room.id] ?? null) : null,
            edges,
            turns: false,
            cull: true,
            layer: 0,
            ...(outside ? { deck: z, outline: true } : { lid: z }),
          });
        }
      }
    }
  }

  // each room's cell, for the highlight
  for (const room of roomAt.values()) {
    const c = at(room.cell.x, room.cell.y, room.cell.z);
    for (const { c: signs } of CUBE) add(signs.map((s) => corner(c, s)), "cell", room.id, { ghost: true, tint: null });
  }

  // blisters: a glass dome hanging off the hull face nearest them, under it or on top
  const bottom = at(0, 0, hull.z0)[1] - half[1];
  const top = at(0, 0, hull.z1)[1] + half[1];
  for (const room of index.byId.values()) {
    if (!room.blister) continue;
    const [cx, , cz] = at(room.cell.x, room.cell.y, room.cell.z);
    const down = room.cell.z < hull.z0 ? -1 : 1;
    const y0 = down < 0 ? bottom : top;
    const R = 0.42 * Math.min(CELL.side, CELL.frame);
    const ring = ([r, d]) =>
      Array.from({ length: DOME_SIDES }, (_, i) => {
        const a = ((i + 0.5) / DOME_SIDES) * 2 * Math.PI;
        return [cx + r * R * Math.sin(a), y0 + down * d * R, cz + r * R * Math.cos(a)];
      });
    const rings = DOME.map(ring);
    for (let j = 0; j + 1 < rings.length; j++) {
      const [p, q] = [rings[j], rings[j + 1]];
      for (let i = 0; i < DOME_SIDES; i++) {
        const i1 = (i + 1) % DOME_SIDES;
        const axis = [cx, (p[i][1] + q[i][1]) / 2, cz];
        add(outward([p[i], p[i1], q[i1], q[i]], axis), "blister", room.id, { layer: -1 });
      }
    }
    // capped at both ends: the top shows once the decks over it are cut away
    const last = rings[rings.length - 1];
    add(outward(last, [cx, last[0][1] - down, cz]), "blister-cap", room.id, { layer: -1 });
    add(outward(rings[0], [cx, y0 + down, cz]), "blister-cap", room.id, { layer: -1 });
  }

  // cradles fore of the nose: compartments, never lit
  const fore = at(0, hull.y1, 0)[2] + half[2];
  for (const [x, z, hx, hy, len] of spec.cradles ?? []) {
    const [cx, cy] = at(x, 0, z);
    const c = [cx, cy, fore + (len * CELL.frame) / 2];
    const h = [hx * CELL.side, hy * CELL.deck, (len * CELL.frame) / 2];
    for (const { c: signs } of CUBE) {
      add(signs.map((s) => c.map((v, k) => v + s[k] * h[k])), "dock", null, { layer: 1, deck: z });
    }
  }

  // masts up off the roof, each a lamp at its top, burning whatever the light; they go with the top
  // deck when it's cut away, as the cradles do
  const roof = at(0, 0, hull.z1)[1] + half[1];
  const box = (c, h, kind, layer) => {
    for (const { c: signs } of CUBE) add(signs.map((s) => c.map((v, k) => v + s[k] * h[k])), kind, null, { layer, deck: hull.z1 });
  };
  for (const [x, y, height] of spec.masts ?? []) {
    const [cx, , cz] = at(x, y, 0);
    const tall = height * CELL.deck;
    box([cx, roof + tall / 2, cz], [MAST, tall / 2, MAST], "mast", 1);
    box([cx, roof + tall, cz], [LAMP, LAMP, LAMP], "lamp", 2);
  }

  return faces;
}

const MAST = 3.5; // a mast's half-width, in model units
const LAMP = 11; // its lamp's

/** pts wound so their normal points away from `from`. */
function outward(pts, from) {
  const [a, b, c] = pts;
  const u = b.map((v, i) => v - a[i]);
  const w = c.map((v, i) => v - a[i]);
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const mid = pts.reduce((s, p) => s.map((v, i) => v + p[i] / pts.length), [0, 0, 0]);
  const d = n.reduce((s, v, i) => s + v * (mid[i] - from[i]), 0);
  return d >= 0 ? pts : pts.slice().reverse();
}

// --- the deck plans --------------------------------------------------------------------------

/** Plan units per cell, fore up and starboard right; a room box is inset in its cell. */
export const PLAN = { w: 140, h: 100, inset: 14, band: 18, blister: 40, pad: 12 };

const ACROSS = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] }; // plan direction

/**
 * One deck's plan: every room on it in its cell, the passages between them, and the hatches up and
 * down. A named room is a room box; a passage a band through its cell, running on through every
 * side it opens to; a blister a round glass room. `footprint` is the hull's outline, the same on
 * every deck so the frames line up; `onHull` says whether this deck is inside it.
 * @param {ReturnType<typeof indexDecks>} index
 * @param {number} deck
 */
export function decksLayout(index, deck) {
  const { hull } = index;
  const mid = hull ? [(hull.x0 + hull.x1) / 2, (hull.y0 + hull.y1) / 2] : [0, 0];
  const centre = ({ x, y }) => [(x - mid[0]) * PLAN.w, -(y - mid[1]) * PLAN.h];
  const rooms = [...index.byId.values()].filter((r) => r.cell.z === deck);
  const here = (id) => rooms.find((r) => r.id === id);

  const cells = rooms.map((room) => {
    const [cx, cy] = centre(room.cell);
    if (room.blister) return { room, kind: "blister", cx, cy, r: PLAN.blister };
    if (!room.passage) {
      return { room, kind: "room", cx, cy, w: PLAN.w - 2 * PLAN.inset, h: PLAN.h - 2 * PLAN.inset };
    }
    // a band through the cell: to the cell's edge on every side it opens to, else to where the
    // rooms beside it end
    const open = (dir) => !!here(room.exits?.[dir]);
    const reach = (dir, full) => (open(dir) ? full / 2 : Math.max(PLAN.band, full / 2 - PLAN.inset));
    const across = (open("east") || open("west")) && !open("north") && !open("south");
    if (across) {
      const l = reach("west", PLAN.w);
      const r = reach("east", PLAN.w);
      return { room, kind: "passage", cx: cx + (r - l) / 2, cy, w: l + r, h: 2 * PLAN.band };
    }
    const t = reach("north", PLAN.h);
    const b = reach("south", PLAN.h);
    return { room, kind: "passage", cx, cy: cy + (b - t) / 2, w: 2 * PLAN.band, h: t + b };
  });
  const cellOf = (id) => cells.find((c) => c.room.id === id);

  // passages joining a room to the next cell, once a pair, where the shapes don't already meet
  const links = [];
  const reachOf = (c, horizontal) => (c.kind === "blister" ? c.r : (horizontal ? c.w : c.h) / 2);
  for (const a of cells) {
    for (const [dir, [dx, dy]] of Object.entries(ACROSS)) {
      const b = cellOf(a.room.exits?.[dir]);
      if (!b || a.room.id > b.room.id) continue;
      const [ax, ay] = centre(a.room.cell);
      if (dx) {
        const from = a.cx + dx * reachOf(a, true);
        const to = b.cx - dx * reachOf(b, true);
        if ((to - from) * dx > 0.5) links.push({ x: Math.min(from, to), y: ay - 8, w: Math.abs(to - from), h: 16 });
      } else {
        const from = a.cy + dy * reachOf(a, false);
        const to = b.cy - dy * reachOf(b, false);
        if ((to - from) * dy > 0.5) links.push({ x: ax - 8, y: Math.min(from, to), w: 16, h: Math.abs(to - from) });
      }
    }
  }

  // hatches up and down: at a passage's centre, in a room box's corner (a room with both, as
  // Caradon's Shift Hall, has down in the corner below), over a blister's name; `side` is where its
  // "up" or "down" goes
  const hatches = [];
  for (const c of cells) {
    for (const dir of ["up", "down"]) {
      if (!c.room.exits?.[dir]) continue;
      const [x, y] = centre(c.room.cell);
      if (c.kind === "passage") hatches.push({ dir, cx: x, cy: y, side: "below" });
      else if (c.kind === "blister") hatches.push({ dir, cx: x, cy: y - c.r / 2 + 2, side: "right" });
      else if (dir === "down" && c.room.exits.up) hatches.push({ dir, cx: x + c.w / 2 - 14, cy: y + c.h / 2 - 30, side: "below" });
      else hatches.push({ dir, cx: x + c.w / 2 - 14, cy: y - c.h / 2 + 14, side: "below" });
    }
  }

  // blisters on the next deck down or up, whose outline this deck shows over them
  const nearby = [...index.byId.values()]
    .filter((r) => r.blister && Math.abs(r.cell.z - deck) === 1)
    .map((room) => ({ room, cx: centre(room.cell)[0], cy: centre(room.cell)[1], r: PLAN.blister, below: room.cell.z < deck }));

  const footprint = hull && {
    x: (hull.x0 - mid[0] - 0.5) * PLAN.w - PLAN.pad,
    y: -(hull.y1 - mid[1] + 0.5) * PLAN.h - PLAN.pad,
    w: (hull.x1 - hull.x0 + 1) * PLAN.w + 2 * PLAN.pad,
    h: (hull.y1 - hull.y0 + 1) * PLAN.h + 2 * PLAN.pad,
  };
  const frames = hull ? Array.from({ length: hull.y1 - hull.y0 + 1 }, (_, i) => ({ n: hull.y1 - i, cy: centre({ x: 0, y: hull.y1 - i })[1] })) : [];
  const onHull = !!hull && deck >= hull.z0 && deck <= hull.z1;
  return { deck, cells, links, hatches, nearby, footprint, frames, onHull, centre };
}

/** The glowing shape for the player's place on a deck's plan, or null. */
export function decksShape(layout, where) {
  if (!layout || where?.kind !== "room") return null;
  const c = layout.cells.find((x) => x.room.id === where.id);
  if (!c) return null;
  if (c.kind === "blister") return { kind: "circle", cx: c.cx, cy: c.cy, r: c.r };
  return { kind: "rect", x: c.cx - c.w / 2, y: c.cy - c.h / 2, width: c.w, height: c.h, rx: c.kind === "room" ? 5 : 3 };
}
