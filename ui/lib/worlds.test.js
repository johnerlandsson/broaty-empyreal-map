import { describe, expect, it } from "vitest";
import WORLDS from "../data/worlds.js";
import { COLS, DECKS, GIANT, GIANT_BANDS, PORT_CELL, RINGS, SEA_REACH, STARLESS, STAR_RGB, VEIL_PLAIN, VEIL_WORDS, airGlow, emberFacets, emberRgb, envelopeRgb, faceOf, facets, hex, lightBy, portFace, portFacets, seedOf, starFill, starRgb, veilRgb } from "./worlds.js";

const worlds = {
  stars: { sun: { colour: "red" }, pulsar: { colour: null } },
  ports: { shore: { planet: "dry", coast: 0.5 }, harbour: { planet: "wet", coast: 0.2 }, inland: { planet: "wet", coast: 0 }, camp: { planet: "frosty", coast: 0.4 }, gas: { planet: "big", coast: 0 } },
  planets: {
    big: { star: "sun", giant: true },
    jove: { star: "sun", giant: true, albedo: 0.34, clouds: "ammonia", methane: 0.1, embers: 0 },
    ice: { star: "sun", giant: true, albedo: 0.3, clouds: null, methane: 1, embers: 0 },
    misty: { star: "sun", giant: true, albedo: 0.3, clouds: "water", methane: 1, embers: 0 },
    hot: { star: "sun", giant: true, albedo: 0.1, clouds: null, methane: 0, embers: 0.29 },
    bare: { star: "sun", air: 0, albedo: 0.1, ground: "rock", frost: false, seas: [], veil: null },
    wet: { star: "sun", air: 1, albedo: 0.3, ground: "rock", frost: false, seas: [{ of: "water", share: 0.3 }], veil: null },
    dry: { star: "sun", air: 1, albedo: 0.3, ground: "rock", frost: false, seas: [{ of: "water", share: 0 }], veil: null },
    frosty: { star: "sun", air: 0.2, albedo: 0.3, ground: "rock", frost: true, seas: [], veil: null },
    hazy: { star: "sun", air: 1.5, albedo: 0.2, ground: "ice", frost: false, seas: [{ of: "methane", share: 0.05 }], veil: "A thick rust-brown haze hides it." },
  },
};
const lum = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;

describe("stars", () => {
  it("gives a star its colour's light, and the old warm white to one it doesn't know or with none", () => {
    expect(starRgb("sun", worlds)).toEqual(STAR_RGB.red);
    expect(starRgb("pulsar", worlds)).toEqual(STARLESS);
    expect(starRgb("nowhere", worlds)).toEqual(STARLESS);
    expect(hex(STARLESS)).toBe("#fffaf0");
  });

  it("has a light for every colour the game's stars come in today", () => {
    for (const [id, s] of Object.entries(WORLDS.stars)) if (s.colour) expect(STAR_RGB[s.colour], id).toBeDefined();
  });

  it("fills a star a little whiter than its light, so a red one stays red and a blue-white one blue", () => {
    const red = parseInt(starFill("feock").slice(1), 16);
    expect(red >> 16).toBeGreaterThan(red & 0xff);
    const blue = parseInt(starFill("piran").slice(1), 16);
    expect(blue & 0xff).toBeGreaterThan(blue >> 16);
  });
});

describe("faceOf", () => {
  it("knows nothing of a planet the data hasn't, and keeps a giant's bands", () => {
    expect(faceOf("nowhere", worlds)).toBe(null);
    expect(faceOf("big", worlds)).toMatchObject({ giant: true, light: STAR_RGB.red, ground: lightBy(GIANT, STAR_RGB.red), seas: [], frost: null, glow: 1 });
  });

  it("draws a giant whose envelope the data doesn't know in the old ochre and cream bands, with no embers", () => {
    expect(faceOf("big", worlds)).toMatchObject({ bands: lightBy(GIANT_BANDS, STAR_RGB.red), embers: null });
  });

  it("colours a giant by its envelope: a Jupiter's cream and tan, an ice giant blue-green, a hot Jupiter dark", () => {
    const blueGreen = ([r, g, b]) => g > r * 1.4 && b > r * 1.4;
    expect(envelopeRgb(worlds.planets.jove).zone[0]).toBeGreaterThan(envelopeRgb(worlds.planets.jove).zone[2]); // warm
    expect(blueGreen(envelopeRgb(worlds.planets.ice).zone)).toBe(true);
    expect(lum(envelopeRgb(worlds.planets.hot).zone)).toBeLessThan(lum(envelopeRgb(worlds.planets.jove).zone) * 0.5);
    // methane tints a deck half as much as clear gas: its light comes back from higher up
    const misty = envelopeRgb(worlds.planets.misty).zone;
    expect(misty[0] / misty[1]).toBeGreaterThan(envelopeRgb(worlds.planets.ice).zone[0] / envelopeRgb(worlds.planets.ice).zone[1]);
    expect(envelopeRgb({ albedo: 0.3, clouds: "argon", methane: 0 }).zone).not.toEqual(DECKS.clear.zone); // any other deck, plain
  });

  it("gives a giant its envelope's face, bands and air in its star's light, and embers only where its night glows", () => {
    const f = faceOf("jove", worlds);
    const { zone, belt } = envelopeRgb(worlds.planets.jove);
    expect(f.ground).toEqual(lightBy(zone.map((v, i) => (v + belt[i]) / 2), STAR_RGB.red));
    expect(lum(f.bands)).toBeGreaterThan(lum(f.ground));
    expect(f).toMatchObject({ giant: true, glow: 1, seas: [], frost: null, embers: null });
    expect(faceOf("hot", worlds).embers).toEqual(emberRgb(0.29));
    const [r, g, b] = emberRgb(0.29);
    expect(r).toBeGreaterThan(g * 2.5);
    expect(r).toBeGreaterThan(b * 2.5);
  });

  it("knows every gaseous world the game has today by its envelope, and only Caradon 1 glows at night", () => {
    const giants = Object.entries(WORLDS.planets).filter(([, p]) => p.giant);
    expect(giants.length).toBe(20);
    for (const [id, p] of giants) expect("clouds" in p, id).toBe(true);
    expect(giants.filter(([id]) => faceOf(id).embers).map(([id]) => id)).toEqual(["caradon_1"]);
    expect(WORLDS.planets.morvah.clouds).toBe("ammonia");
  });

  it("gives a glowing night side's facets the day facets' shapes in the embers' colour, and none without embers", () => {
    const face = faceOf("hot", worlds);
    const cells = facets(face, seedOf("hot"));
    const night = emberFacets(face, cells, seedOf("hot:night"));
    expect(night).toHaveLength(cells.length);
    expect(night.map((f) => f.pts)).toEqual(cells.map((f) => f.pts));
    for (const f of night) expect(lum(f.fill)).toBeLessThanOrEqual(lum(face.embers) * 1.15 + 1e-9);
    expect(emberFacets(faceOf("jove", worlds), cells, seedOf("x"))).toBe(null);
  });

  it("gives an airless world no glow, and air more as it thickens", () => {
    expect(faceOf("bare", worlds).glow).toBe(0);
    expect(airGlow(0.015)).toBeGreaterThan(0);
    expect(airGlow(0.015)).toBeLessThan(airGlow(1));
    expect(airGlow(1)).toBeLessThan(airGlow(90));
    expect(airGlow(90)).toBe(1);
  });

  it("makes brighter ground of a higher albedo, and ice brighter than rock", () => {
    const dark = faceOf("bare", worlds).ground;
    const light = faceOf("wet", worlds).ground;
    expect(lum(light)).toBeGreaterThan(lum(dark));
    expect(lum(faceOf("kynance").ground)).toBeGreaterThan(lum(faceOf("botallack").ground));
  });

  it("hides everything under a veil, in the colour its words name", () => {
    const f = faceOf("hazy", worlds);
    expect(f.veiled).toBe(true);
    expect(f.seas).toEqual([]);
    expect(f.frost).toBe(null);
    expect(lum(f.ground)).toBeLessThan(lum([255, 255, 255]));
    expect(veilRgb("A thick rust-brown haze")).toEqual(VEIL_WORDS[0][1]);
    expect(veilRgb("A deck of pale yellow cloud")).toEqual(VEIL_WORDS[1][1]);
    expect(veilRgb("A haze")).toEqual(VEIL_PLAIN);
  });

  it("names a colour for every veil the game has today", () => {
    for (const [id, p] of Object.entries(WORLDS.planets)) if (p.veil) expect(veilRgb(p.veil), id).not.toEqual(VEIL_PLAIN);
  });

  it("sees a world in its star's light: the same ice redder under a red star than a blue-white one", () => {
    const ice = { air: 0, albedo: 0.6, ground: "ice", frost: false, seas: [], veil: null };
    const w = { stars: { r: { colour: "red" }, b: { colour: "blue-white" } }, planets: { a: { ...ice, star: "r" }, z: { ...ice, star: "b" } } };
    const [ra, , ba] = faceOf("a", w).ground;
    const [rz, , bz] = faceOf("z", w).ground;
    expect(ra - ba).toBeGreaterThan(rz - bz);
  });
});

describe("seedOf", () => {
  it("is the maps' rng seeded by the text: the same text, the same run", () => {
    const a = seedOf("tamsin");
    const b = seedOf("tamsin");
    const c = seedOf("orrin");
    const run = (r) => [r(), r(), r()];
    const ra = run(a);
    expect(run(b)).toEqual(ra);
    expect(run(c)).not.toEqual(ra);
    for (const x of ra) expect(x >= 0 && x < 1).toBe(true);
  });
});

describe("facets", () => {
  const count = RINGS * (COLS + 1) * 2;

  it("covers the face in two triangles a cell, the same every time for a planet", () => {
    const a = facets(faceOf("wet", worlds), seedOf("wet"));
    expect(a).toHaveLength(count);
    expect(facets(faceOf("wet", worlds), seedOf("wet"))).toEqual(a);
    for (const f of a) expect(f.pts).toHaveLength(3);
    expect(Math.min(...a.flatMap((f) => f.pts.map((p) => p[0])))).toBe(0); // from the limb
  });

  it("lays seas on about their share of the face", () => {
    const face = faceOf("wet", worlds);
    const sea = face.seas[0].rgb;
    const wet = facets(face, seedOf("wet")).filter((f) => lum(f.fill) / lum(sea) < 1.2 && f.fill[2] > f.fill[0]);
    expect(wet.length / count).toBeGreaterThan(0.2);
    expect(wet.length / count).toBeLessThan(0.4);
  });

  it("puts no seas or frost on an airless rock, and frost on a frosted one", () => {
    const flat = (id) => new Set(facets(faceOf(id, worlds), seedOf(id)).map((f) => Math.round(lum(f.fill) / 40)));
    expect(Math.max(...flat("frosty"))).toBeGreaterThan(Math.max(...flat("bare")));
  });

  it("keeps a veil nearly flat", () => {
    const spread = (id) => {
      const l = facets(faceOf(id, worlds), seedOf(id)).filter((f) => f.pts.every((p) => p[0] < 0.2)).map((f) => lum(f.fill));
      return Math.max(...l) / Math.min(...l);
    };
    expect(spread("hazy")).toBeLessThan(spread("bare"));
  });
});

describe("over a port", () => {
  const geo = { w: 300, h: 160, top: 83, cx: 150, cy: 83 + 420, R: 420, tx: 150, ty: 121, k: 30 };
  const cells = (id) => portFacets(portFace(id, worlds), geo, seedOf(id));

  it("knows a port's planet and coast, and nothing of a port the data doesn't have or a giant's", () => {
    expect(portFace("harbour", worlds)).toEqual({ face: faceOf("wet", worlds), coast: 0.2 });
    expect(portFace("nowhere", worlds)).toBe(null);
    expect(portFace("gas", worlds)).toBe(null);
  });

  it("covers the band below the limb in facets, the same every time for a port", () => {
    const a = cells("harbour");
    expect(a.length).toBeGreaterThan(100);
    expect(cells("harbour")).toEqual(a);
    expect(Math.min(...a.flatMap((c) => c.pts.map((p) => p[1])))).toBeLessThan(geo.top);
    expect(Math.max(...a.flatMap((c) => c.pts.map((p) => p[1])))).toBeGreaterThan(geo.h);
  });

  it("lays the sea far off: on the far horizon, never near the port, and none inland", () => {
    const sea = cells("harbour").filter((c) => c.sea);
    expect(sea.length).toBeGreaterThan(0);
    for (const c of sea) {
      const x = (c.pts[0][0] + c.pts[1][0] + c.pts[2][0]) / 3;
      const y = (c.pts[0][1] + c.pts[1][1] + c.pts[2][1]) / 3;
      expect(Math.hypot(x - geo.tx, (y - geo.ty) * 1.6)).toBeGreaterThan(geo.k * 2.2);
      expect(geo.R - Math.hypot(x - geo.cx, y - geo.cy)).toBeLessThan((0.2 / 0.1) * SEA_REACH * PORT_CELL + PORT_CELL * 0.4); // by the limb
    }
    expect(cells("inland").some((c) => c.sea)).toBe(false);
    expect(cells("camp").some((c) => c.sea)).toBe(false); // a coast, but its world has no seas
    expect(cells("shore").some((c) => c.sea)).toBe(false); // a sea with no share: none from high orbit, so none here
    expect(faceOf("dry", worlds).seas).toEqual([]);
  });

  it("has the real ports as the game places them: Zennor's sea off on the horizon, none round the Pit", () => {
    const real = (id) => portFacets(portFace(id), geo, seedOf(id));
    expect(real("zennor").some((c) => c.sea)).toBe(true);
    expect(real("dolcoath").some((c) => c.sea)).toBe(false);
  });
});
