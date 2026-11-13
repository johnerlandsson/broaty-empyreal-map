// How a star and a world look (docs/maps/space-scenes.md, "A world's face"; style guide §13.6):
// a star's colour as the canopy names it (the game's starColour, by temperature), and a planet's
// face from high orbit as low-poly facets from what data/worlds.js says of it: its ground, rock or
// ice, as bright as its albedo; its seas, by their share; frost where a trace of ice lies; a veil
// where the game says one hides it; and glowing air over its limb as thick as its air. A giant is
// its envelope's colour in facets, under its bands: its cloud deck's, or its clear gas's, tinted
// blue-green by its methane and as bright as its albedo, and a night side hot enough glows dull red.
// Over a port the same face is facets at the port's scale,
// with the sea far off where its planet has seas and its site a coast. All of it is seen by its
// star's light. No weather: cloud that comes and goes isn't sent, so none is drawn.

import WORLDS from "../data/worlds.js";
import { rng } from "./svg.js";

/** Each of starColour's words as the light it throws, [r, g, b]. */
export const STAR_RGB = {
  red: [255, 150, 110],
  orange: [255, 190, 130],
  gold: [255, 214, 150],
  "pale yellow": [255, 240, 205],
  white: [245, 247, 255],
  "blue-white": [205, 222, 255],
};
/** A star the data doesn't know, or one with no colour (a neutron star): the old warm white, #fffaf0. */
export const STARLESS = [255, 250, 240];
/** How much of a star's colour reaches the eye: an eye in its light half-adapts to it, so ice stays ice. */
export const TINT = 0.45;

/** [r, g, b] as "#rrggbb". */
export const hex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
/** [r, g, b] as "r,g,b", for rgba(). */
export const rgbText = (c) => c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(",");
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** A star's light, by its id: its colour's, or STARLESS. */
export function starRgb(id, worlds = WORLDS) {
  return STAR_RGB[worlds?.stars?.[id]?.colour] ?? STARLESS;
}

/** A star as a fill a little whiter than its light, so a small dot still reads as that colour: the chart's disc and the lanes map's dot. */
export const starFill = (id, worlds = WORLDS) => hex(mix(starRgb(id, worlds), [255, 255, 255], 0.3));

/** `c` as seen in light of colour `light`. */
export const lightBy = (c, light) => c.map((v, i) => v * (1 - TINT + TINT * (light[i] / 255)));

/**
 * The colour words a veil's prose can use, longest first so "rust-brown" wins over "brown", each
 * as the colour drawn. The words are the game's (substances.yaml's `veil`), never the map's.
 */
export const VEIL_WORDS = [
  ["rust-brown", [150, 82, 48]],
  ["pale yellow", [236, 222, 160]],
  ["orange", [205, 130, 70]],
  ["yellow", [222, 200, 120]],
  ["brown", [128, 94, 64]],
  ["white", [232, 236, 240]],
  ["grey", [150, 152, 158]],
  ["blue", [120, 150, 200]],
  ["green", [120, 150, 110]],
  ["red", [170, 80, 60]],
];
/** A veil whose words name no colour: a pale grey, the colour of haze with nothing to tell it by. */
export const VEIL_PLAIN = [176, 176, 180];

/** The colour a veil's words give it. */
export function veilRgb(words) {
  const w = String(words ?? "").toLowerCase();
  return VEIL_WORDS.find(([word]) => w.includes(word))?.[1] ?? VEIL_PLAIN;
}

/** A sea of water, deep blue; of anything else (methane, ethane), near black. */
export const SEA_RGB = { water: [38, 70, 112] };
export const SEA_DARK = [40, 30, 26];
export const seaRgb = (of) => SEA_RGB[of] ?? SEA_DARK;

/** Ground's own colour: ice white, a touch brighter as its albedo is; rock a brown-grey as bright as its albedo. */
export function groundRgb(p) {
  if (p.ground === "ice") return mix([200, 205, 212], [242, 245, 250], p.albedo);
  const k = 0.35 + p.albedo * 1.6;
  return [120 * k, 98 * k, 76 * k].map((v) => Math.min(235, v));
}
/** Frost on rock: the rock, about half way to white, so a trace reads as a dusting and not as snowfields. */
const FROST = (rock) => mix(rock, [236, 240, 246], 0.45);

/**
 * How strongly the air glows over the limb, 0..1: nothing airless, more as it thickens, by its log,
 * so a hundredth of a bar is a faint line, a bar about half and Lelant's 90 the most.
 */
export const airGlow = (air) => (air > 0 ? Math.min(1, 0.15 + 0.35 * Math.log10(1 + 10 * air)) : 0);
/** Clear air's glow over the limb: Glass (style guide §4.2), the colour it's always been. The space view's too. */
export const RIM = [207, 227, 255];

/** A giant's face under its bands where its envelope isn't known, the ochre every planet had before its climate was known. */
export const GIANT = [138, 112, 82];
/** That giant's bands, a pale cream. */
export const GIANT_BANDS = [232, 220, 200];

/**
 * A cloud deck's colours, by the gas it's of, before methane, albedo and the star: its bright
 * zones and its darker belts. Ammonia is Jupiter's cream and tan; water and carbon dioxide cloud
 * white. `clear` is no deck: hydrogen seen deep, a pale sky blue. A deck of any other gas is
 * drawn as DECK_PLAIN.
 */
export const DECKS = {
  ammonia: { zone: [238, 226, 202], belt: [178, 132, 90] },
  water: { zone: [238, 241, 245], belt: [200, 208, 218] },
  carbon_dioxide: { zone: [238, 241, 245], belt: [200, 208, 218] },
  clear: { zone: [180, 210, 220], belt: [164, 196, 210] },
};
export const DECK_PLAIN = { zone: [226, 226, 224], belt: [196, 196, 194] };
/** How much methane takes out of red, green and blue at full strength (2%, Uranus's and Neptune's): blue-green is what's left. */
export const METHANE_PULL = [0.5, 0.1, 0.08];
/** Over a cloud deck the light comes back from higher up, through less methane: this much of its pull. */
export const OVER_DECK = 0.5;
/** An envelope's brightness by its albedo: full at a Jupiter's .34, Caradon 1's .1 about half dark. */
export const envelopeBright = (albedo) => Math.min(1.05, 0.3 + (albedo / 0.34) * 0.7);

/**
 * An envelope's own colours, `{ zone, belt }`, before its star: its deck's (or clear gas's), with
 * methane's pull taken out and as bright as its albedo.
 */
export function envelopeRgb(p) {
  const deck = p.clouds ? (DECKS[p.clouds] ?? DECK_PLAIN) : DECKS.clear;
  const pull = (p.methane ?? 0) * (p.clouds ? OVER_DECK : 1);
  const k = envelopeBright(p.albedo);
  const of = (c) => c.map((v, i) => v * (1 - METHANE_PULL[i] * pull) * k);
  return { zone: of(deck.zone), belt: of(deck.belt) };
}

/** A night side's glow, by `embers` 0..1: dull red just past the Draper point, brighter and redder hotter. Its own light, not its star's. */
export const emberRgb = (embers) => mix([20, 8, 8], [150, 40, 20], 0.35 + 0.65 * embers);

/**
 * What the orbit scene draws of a planet, by its id: null for one the data doesn't know; else the
 * colours its facets take, all in its star's light, `glow` its air's (0 airless) and `rim` that
 * air's colour, its veil's where it has one. A giant (`giant: true`) is its envelope's colour, its
 * zones and belts half and half, with `bands` the colour its bands go over it in, its zones' a
 * little whiter, its air's glow that colour too, and `embers` its night side's glow or null; one
 * whose envelope the data doesn't know (no `clouds`) is GIANT under GIANT_BANDS with clear air's glow.
 */
export function faceOf(id, worlds = WORLDS) {
  const p = worlds?.planets?.[id];
  if (!p) return null;
  const light = starRgb(p.star, worlds);
  if (p.giant && !("clouds" in p)) {
    return { giant: true, light, ground: lightBy(GIANT, light), bands: lightBy(GIANT_BANDS, light), frost: null, seas: [], veiled: false, glow: 1, rim: lightBy(RIM, light), embers: null };
  }
  if (p.giant) {
    const { zone, belt } = envelopeRgb(p);
    return {
      giant: true,
      light,
      ground: lightBy(mix(zone, belt, 0.5), light),
      bands: lightBy(mix(zone, [255, 255, 255], 0.25), light),
      frost: null,
      seas: [],
      veiled: false,
      glow: 1,
      rim: lightBy(mix(RIM, zone, p.clouds ? 0.3 : 0.5), light),
      embers: p.embers > 0 ? emberRgb(p.embers) : null,
    };
  }
  const veil = p.veil ? veilRgb(p.veil) : null;
  const rock = groundRgb(p);
  return {
    giant: false,
    light,
    ground: lightBy(veil ?? rock, light),
    frost: !veil && p.frost ? lightBy(FROST(rock), light) : null,
    // only seas with a share to show, largest first, so every scene shows the same ones
    seas: veil ? [] : p.seas.filter((s) => s.share > 0).sort((a, b) => b.share - a.share).map((s) => ({ rgb: lightBy(seaRgb(s.of), light), share: s.share })),
    veiled: Boolean(veil),
    glow: airGlow(p.air),
    rim: lightBy(veil ? mix(veil, [255, 255, 255], 0.25) : RIM, light),
  };
}

/** The maps' seeded generator (svg.js's rng) seeded by a string's hash, so a planet's facets are the same every time it's drawn. */
export function seedOf(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return rng(h);
}

/** The facet grid: rings down from the limb and columns across, as the mockup picked (B). */
export const RINGS = 7;
export const COLS = 16;
/** Radians either side of straight down the view the facets reach: past the band's edges. */
export const SPREAD = 1.0;
/** Frost lies on about this share of a frosted world's facets. */
export const FROST_SHARE = 0.14;

/**
 * The face's facets, each `{ pts: [[d, a] ×3], fill: [r, g, b] }`: `d` 0 at the limb to about 1 at
 * the band's foot, `a` radians across from straight down the view. Two triangles a cell, shaded by
 * which way they lean and darker further down the face; seas lie as clumps of cells, about their
 * share of the face, and frost as scattered ones. A veil is nearly flat: what it hides has no relief.
 */
export function facets(face, rnd) {
  const pts = Array.from({ length: RINGS + 1 }, (_, i) =>
    Array.from({ length: COLS + 2 }, (_, j) => {
      const jitter = i > 0 && i < RINGS ? (rnd() - 0.5) * 0.3 : 0;
      return [(i + jitter) / RINGS, ((j - 0.5 + (i % 2) * 0.5) / COLS - 0.5) * 2 * SPREAD];
    }),
  );
  const cells = RINGS * (COLS + 1) * 2;
  const kind = new Map(); // "i,j,k" -> a sea's index, or "frost"
  face.seas.forEach((sea, n) => {
    const want = Math.round(sea.share * cells);
    let have = 0;
    for (let tries = 0; have < want && tries < cells * 4; tries++) {
      let i = Math.floor(rnd() * RINGS);
      let j = Math.floor(rnd() * (COLS + 1));
      for (let step = 0; step < 5 && have < want; step++) {
        const key = `${i},${j},${step % 2}`;
        if (!kind.has(key)) {
          kind.set(key, n);
          have++;
        }
        if (rnd() < 0.5) j = Math.min(COLS, j + 1);
        else i = Math.min(RINGS - 1, i + 1);
      }
    }
  });
  const out = [];
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j <= COLS; j++) {
      for (const k of [0, 1]) {
        const tri = k ? [pts[i][j], pts[i + 1][j + 1], pts[i + 1][j]] : [pts[i][j], pts[i][j + 1], pts[i + 1][j + 1]];
        const lean = (k ? 0.04 : -0.04) * (face.veiled ? 0.25 : 1);
        const shade = 0.88 + lean + (rnd() - 0.5) * (face.veiled ? 0.03 : 0.16) - (i / RINGS) * 0.18;
        const what = kind.get(`${i},${j},${k}`);
        let fill = what === undefined ? face.ground : face.seas[what].rgb;
        if (what === undefined && face.frost && rnd() < FROST_SHARE) fill = face.frost;
        out.push({ pts: tri, fill: fill.map((v) => Math.min(255, v * shade)) });
      }
    }
  }
  return out;
}

/**
 * A glowing night side's facets, from the face's day facets: each the face's `embers` colour, a
 * little different facet to facet and dimmer further down the face, as the day facets are.
 * Its own light, so no star tints it. Null where the face has no embers.
 */
export function emberFacets(face, cells, rnd) {
  if (!face?.embers) return null;
  return cells.map((f) => {
    const d = (f.pts[0][0] + f.pts[1][0] + f.pts[2][0]) / 3;
    const k = (0.75 + rnd() * 0.4) * (1 - Math.min(1, d) * 0.25);
    return { pts: f.pts, fill: face.embers.map((v) => v * k) };
  });
}

/**
 * The face under a port, by the port's id: `{ face, coast }`, its planet's faceOf and how near its
 * sea is (0 none), or null where the data doesn't know the port or its planet, or it's a giant's.
 */
export function portFace(id, worlds = WORLDS) {
  const p = worlds?.ports?.[id];
  const face = p && faceOf(p.planet, worlds);
  return face && !face.giant ? { face, coast: p.coast ?? 0 } : null;
}

/** Over a port, a facet's size in px: the high-orbit facets' size on screen, so the two scenes match. */
export const PORT_CELL = 17;
/** Over a port, the sea reaches this many cells in from the limb for each 0.1 of `coast`. */
export const SEA_REACH = 0.8;

/**
 * The face below a port as facets in band px, each `{ pts: [[x, y] ×3], fill, sea }`: a jittered
 * grid of PORT_CELL triangles over the band from `top` down, shaded as the high-orbit facets are.
 * Where the planet has seas (its largest, as from high orbit) and the port's site a `coast`, the sea lies along the far horizon on
 * one side (the port's seed says which), as deep as its coast says and never within 2.2 of `k` (the
 * town's size) of the port at (`tx`, `ty`): the port stands on its own land with the sea far off.
 * @param {{w: number, h: number, top: number, cx: number, cy: number, R: number, tx: number, ty: number, k: number}} geo
 */
export function portFacets({ face, coast }, geo, rnd) {
  const { w, h, top, cx, cy, R, tx, ty, k } = geo;
  const cell = PORT_CELL;
  const right = rnd() < 0.5;
  const reach = (coast / 0.1) * SEA_REACH * cell;
  const sea = face.seas[0];
  const wet = (x, y) => {
    if (!sea || coast <= 0) return false;
    if (Math.hypot(x - tx, (y - ty) * 1.6) <= k * 2.2) return false;
    if (right ? x < w * 0.6 : x > w * 0.4) return false;
    return R - Math.hypot(x - cx, y - cy) < reach + Math.sin((x / w) * 9) * cell * 0.4;
  };
  const rows = Math.ceil((h - top + 8) / (cell * 0.8)) + 1;
  const cols = Math.ceil(w / cell) + 2;
  const P = Array.from({ length: rows + 1 }, (_, i) =>
    Array.from({ length: cols + 1 }, (_, j) => {
      const inner = i > 0 && i < rows;
      return [(j - 1 + (i % 2) * 0.5) * cell + (inner ? (rnd() - 0.5) * cell * 0.45 : 0), top - 6 + i * cell * 0.8 + (inner ? (rnd() - 0.5) * cell * 0.35 : 0)];
    }),
  );
  const out = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (const n of [0, 1]) {
        const pts = n ? [P[i][j], P[i + 1][j + 1], P[i + 1][j]] : [P[i][j], P[i][j + 1], P[i + 1][j + 1]];
        const shade = 0.9 + (n ? 0.04 : -0.04) + (rnd() - 0.5) * 0.16 - (i / rows) * 0.16;
        const x = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
        const y = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
        const isSea = wet(x, y);
        let fill = isSea ? sea.rgb.map((v) => v * (0.92 + (shade - 0.9) * 0.3)) : face.ground.map((v) => v * shade);
        if (!isSea && face.frost && rnd() < FROST_SHARE) fill = face.frost.map((v) => v * shade);
        out.push({ pts, fill: fill.map((v) => Math.min(255, v)), sea: isSea });
      }
    }
  }
  return out;
}
