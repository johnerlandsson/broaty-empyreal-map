import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CLIMATE_FIELDS, ENVELOPE_FIELDS, worldsOf } from "./worlds.mjs";

// A stand-in for the game's physics: each test says what it answers.
function game({ surface = () => "none", phase = () => "gone", veil = () => undefined, envelope = () => ({ mean: 150, night: 150 }), lock = () => 99 } = {}) {
  return {
    envelopeTemperatures: (light, e, g, day, locked, cp) => envelope({ light, e, g, day, locked, cp }),
    specificHeat: () => 14000,
    lockTime: (...args) => lock(...args),
    QUALITY: { envelope: 10_000 },
    sunlight: () => 1,
    temperatures: () => ({ mean: 200, bare: 200 }),
    surfaceOf: (v) => surface(v.of),
    phaseOf: (s) => phase(s.id),
    veilOf: veil,
    starColour: (t) => (t < 4300 ? "red" : "white"),
  };
}

const star = (id, more = {}) => ({ id, kind: "star", temperature: 3300, mass: 1, age: 5, stage: "main", ...more });
const planet = (id, climate, parent = "sun") => ({ id, kind: "planet", orbit: { parent, a: 1000 }, ...(climate ? { climate } : {}) });
const subs = [["water", 373], ["methane", 112], ["carbon_dioxide", 195], ["ammonia", 240], ["hydrogen", 20]].map(([id, boils]) => ({ id, boils }));
const gassy = (id, envelope, more = {}) => ({ id, kind: "planet", orbit: { parent: "sun", a: 1000 }, radius: 70000, gravity: 2.4, envelope, ...more });

describe("worldsOf", () => {
  it("gives each star its colour by temperature, and none to a star with no surface", () => {
    const { stars } = worldsOf([star("sun"), star("hot", { temperature: 9000 }), star("ns", { temperature: undefined, stage: "neutron_star" })], subs, game());
    expect(stars).toEqual({ hot: { colour: "white" }, ns: { colour: null }, sun: { colour: "red" } });
  });

  it("calls a planet with neither climate nor envelope a giant as before envelopes", () => {
    expect(worldsOf([star("sun"), planet("big")], subs, game()).planets).toEqual({ big: { star: "sun", giant: true } });
  });

  it("gives a gaseous world its albedo, the deck the coldest of its condensing gases makes, methane's tint and no figures", () => {
    const g = game({ phase: (id) => ({ ammonia: "ice", water: "ice", methane: "gone" })[id] ?? "gone" });
    const env = { albedo: 0.34, heat: 5, gases: { hydrogen: 0.86, ammonia: 0.001, water: 0.01, methane: 0.002 } };
    const { planets } = worldsOf([star("sun"), gassy("jove", env, { day: 8400 })], subs, g);
    expect(planets.jove).toEqual({ star: "sun", giant: true, albedo: 0.34, clouds: "ammonia", methane: 0.1, embers: 0 });
  });

  it("asks the game's phaseOf at 1 bar and the 1-bar mean, and gives a world with nothing condensing no deck", () => {
    const asked = [];
    const g = game({ envelope: () => ({ mean: 263, night: 263 }) });
    const env = { albedo: 0.3, heat: 0.4, gases: { hydrogen: 0.81, methane: 0.02 } };
    const pluck = { ...g, phaseOf: (s, air, t) => (asked.push([air, t.mean]), "gone") };
    const { planets } = worldsOf([star("sun"), gassy("ice", env, { day: 9000 })], subs, pluck);
    expect(planets.ice).toMatchObject({ clouds: null, methane: 1 });
    expect(asked).toEqual([[1, 263], [1, 263]]);
  });

  it("locks a gaseous world by the loader's rule, and its night glows past the Draper point", () => {
    const seen = [];
    const g = game({ envelope: ({ locked }) => (seen.push(locked), { mean: 1200, night: locked ? 1000 : 1200 }), lock: (m, r, gr, a, q) => (q === 10_000 ? 1 : 99) });
    const env = { albedo: 0.1, heat: 460, gases: { hydrogen: 0.99, water: 0.01 } };
    const { planets } = worldsOf([star("sun"), gassy("hot", env), gassy("spun", env, { day: 9000 }), gassy("old", env, { orbit: { parent: "dwarf", a: 9 } }), star("dwarf", { stage: "white_dwarf" })], subs, g);
    expect(planets.hot.embers).toBe(0.29); // (1,000 − 798) / (1,500 − 798)
    expect(planets.spun.embers).toBe(0.57); // turning, so not locked: its night is its mean, (1,200 − 798) / 702
    expect(seen).toEqual([true, false, false]); // hot, old (a white dwarf's tides don't lock), spun
  });

  it("stops on an envelope gas it has no substance for", () => {
    expect(() => worldsOf([star("sun"), gassy("x", { albedo: 0.3, heat: 1, gases: { unobtainium: 1 } })], subs, game())).toThrow(/unobtainium/);
  });

  it("gives an airless world no air, as the schema's default, and bare rock", () => {
    const { planets } = worldsOf([star("sun"), planet("moon", { albedo: 0.1 })], subs, game());
    expect(planets.moon).toEqual({ star: "sun", air: 0, albedo: 0.1, ground: "rock", frost: false, seas: [], veil: null });
  });

  it("lays seas by their share, ice as the ground, and a trace of ice as frost", () => {
    const vols = (...of) => ({ albedo: 0.3, air: 1, volatiles: of.map((o) => ({ of: o, amount: "abundant", sea: 0.1 })) });
    const g = game({
      surface: (of) => ({ water: "seas", methane: "ice", carbon_dioxide: "trace" })[of],
      phase: (of) => (of === "carbon_dioxide" ? "ice" : "liquid"),
    });
    const { planets } = worldsOf([star("sun"), planet("a", vols("water")), planet("b", vols("methane", "water")), planet("c", vols("carbon_dioxide"))], subs, g);
    expect(planets.a).toMatchObject({ ground: "rock", frost: false, seas: [{ of: "water", share: 0.1 }] });
    expect(planets.b).toMatchObject({ ground: "ice", seas: [{ of: "water", share: 0.1 }] });
    expect(planets.c).toMatchObject({ ground: "rock", frost: true, seas: [] });
  });

  it("calls a trace that's aloft, not ice, no frost", () => {
    const g = game({ surface: () => "trace", phase: () => "aloft" });
    const { planets } = worldsOf([star("sun"), planet("v", { albedo: 0.7, air: 90, volatiles: [{ of: "water", amount: "trace" }] })], subs, g);
    expect(planets.v.frost).toBe(false);
  });

  it("lights a moon at its planet's distance from the star, not its own from the planet", () => {
    const at = [];
    const g = { ...game(), sunlight: (s, km) => (at.push(km), 1) };
    const p = { ...planet("p", { albedo: 0.2 }), orbit: { parent: "sun", a: 150_000_000 } };
    const moon = { ...planet("m", { albedo: 0.2 }, "p"), orbit: { parent: "p", a: 20_000 } };
    worldsOf([star("sun"), p, moon], subs, g);
    expect(at).toEqual([150_000_000, 150_000_000]); // m, then p, by id
  });

  it("writes a sea with no share as 0, so no scene shows one", () => {
    const g = game({ surface: () => "seas" });
    const { planets } = worldsOf([star("sun"), planet("w", { albedo: 0.2, air: 1, volatiles: [{ of: "water", amount: "abundant" }] })], subs, g);
    expect(planets.w.seas).toEqual([{ of: "water", share: 0 }]);
  });

  it("gives the game's veil words, and finds the star up a moon's parents", () => {
    const g = game({ veil: (c) => (c.air > 1 ? "A haze hides it." : undefined) });
    const { planets } = worldsOf([star("sun"), planet("p", { albedo: 0.2, air: 0 }), planet("m", { albedo: 0.2, air: 1.5 }, "p")], subs, g);
    expect(planets.m.veil).toBe("A haze hides it.");
    expect(planets.p.veil).toBe(null);
  });

  it("gives each port its planet and how near its sea is, none where its site doesn't say", () => {
    const port = (id, surface) => ({ id, kind: "port", surface });
    const { ports } = worldsOf(
      [star("sun"), planet("p", { albedo: 0.2 }), port("town", { parent: "p", site: { coast: 0.2, height: 9 } }), port("camp", { parent: "p" })],
      subs,
      game(),
    );
    expect(ports).toEqual({ camp: { planet: "p", coast: 0 }, town: { planet: "p", coast: 0.2 } });
  });

  it("stops on a volatile it has no substance for, or a climate with no star", () => {
    const bad = { albedo: 0.2, volatiles: [{ of: "unobtainium", amount: "trace" }] };
    expect(() => worldsOf([star("sun"), planet("x", bad)], subs, game())).toThrow(/unobtainium/);
    expect(() => worldsOf([planet("x", { albedo: 0.2 }, "nowhere")], subs, game())).toThrow(/no star/);
  });

  it("reads every climate and envelope field the schema has today", () => {
    expect(CLIMATE_FIELDS).toEqual(["albedo", "air", "greenhouse", "gases", "volatiles"]);
    expect(ENVELOPE_FIELDS).toEqual(["albedo", "heat", "gases"]);
  });
});

// The real game's physics, where a checkout is at hand: the worlds the request names come out as the
// canopy describes them.
const E = join(homedir(), "dev/empyreal");
describe.runIf(existsSync(join(E, "content/game/substances.yaml")))("worldsOf with the game's own physics", () => {
  it("draws Tamsin with seas, Orrin and Kynance as ice, Lamorna and Lelant veiled, and Botallack bare", async () => {
    const climate = await import(join(E, "packages/game/src/systems/climate.ts"));
    const { starColour } = await import(join(E, "packages/game/src/systems/stars.ts"));
    const bodies = parse(readFileSync(join(E, "content/game/system.yaml"), "utf8")).bodies;
    const substances = parse(readFileSync(join(E, "content/game/substances.yaml"), "utf8")).substances;
    const tides = await import(join(E, "packages/game/src/systems/tides.ts"));
    const game = { ...climate, starColour, lockTime: tides.lockTime, QUALITY: tides.QUALITY };
    const { stars, planets } = worldsOf(bodies, substances, game);
    expect(stars.senara.colour).toBe("orange");
    expect(stars.feock.colour).toBe("red");
    expect(stars.piran.colour).toBe("blue-white");
    expect(planets.tamsin).toMatchObject({ ground: "rock", seas: [{ of: "water" }], veil: null });
    expect(planets.orrin).toMatchObject({ ground: "ice", air: 1 });
    expect(planets.kynance).toMatchObject({ ground: "ice", air: 0 });
    expect(planets.botallack).toMatchObject({ ground: "rock", air: 0, seas: [], veil: null });
    expect(planets.lamorna.veil).toMatch(/rust-brown haze/);
    expect(planets.lelant.veil).toMatch(/pale yellow cloud/);
    const { ports } = worldsOf(bodies, substances, game);
    expect(ports.zennor).toEqual({ planet: "tamsin", coast: 0.2 });
    expect(ports.dolcoath).toEqual({ planet: "orrin", coast: 0 });
    expect(planets.lamorna.star).toBe("feock");
  });

  it("gives the Jupiters ammonia cloud, the cool sub-Neptunes water, the ice giants none, and only Caradon 1 a glowing night", async () => {
    const climate = await import(join(E, "packages/game/src/systems/climate.ts"));
    const { starColour } = await import(join(E, "packages/game/src/systems/stars.ts"));
    const tides = await import(join(E, "packages/game/src/systems/tides.ts"));
    const bodies = parse(readFileSync(join(E, "content/game/system.yaml"), "utf8")).bodies;
    const substances = parse(readFileSync(join(E, "content/game/substances.yaml"), "utf8")).substances;
    const { planets } = worldsOf(bodies, substances, { ...climate, starColour, lockTime: tides.lockTime, QUALITY: tides.QUALITY });
    expect(planets.morvah).toEqual({ star: "petroc", giant: true, albedo: 0.34, clouds: "ammonia", methane: 0.1, embers: 0 });
    expect(planets.trencrom_3).toMatchObject({ clouds: "water", methane: 1 });
    expect(planets.keyne_4).toMatchObject({ clouds: null, methane: 1, embers: 0 });
    expect(planets.garrow_2).toMatchObject({ clouds: null }); // a warm Jupiter: too warm for ammonia
    expect(planets.caradon_1).toMatchObject({ albedo: 0.1, clouds: null, methane: 0 });
    expect(planets.caradon_1.embers).toBeGreaterThan(0);
    const glowing = Object.keys(planets).filter((id) => planets[id].embers > 0);
    expect(glowing).toEqual(["caradon_1"]);
  });
});
