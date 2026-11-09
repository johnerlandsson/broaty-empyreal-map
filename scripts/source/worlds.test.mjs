import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CLIMATE_FIELDS, worldsOf } from "./worlds.mjs";

// A stand-in for the game's physics: each test says what it answers.
function game({ surface = () => "none", phase = () => "gone", veil = () => undefined } = {}) {
  return {
    sunlight: () => 1,
    temperatures: () => ({ mean: 200, bare: 200 }),
    surfaceOf: (v) => surface(v.of),
    phaseOf: (s) => phase(s.id),
    veilOf: veil,
    starColour: (t) => (t < 4300 ? "red" : "white"),
  };
}

const star = (id, more = {}) => ({ id, kind: "star", temperature: 3300, ...more });
const planet = (id, climate, parent = "sun") => ({ id, kind: "planet", orbit: { parent, a: 1000 }, ...(climate ? { climate } : {}) });
const subs = ["water", "methane", "carbon_dioxide"].map((id) => ({ id }));

describe("worldsOf", () => {
  it("gives each star its colour by temperature, and none to a star with no surface", () => {
    const { stars } = worldsOf([star("sun"), star("hot", { temperature: 9000 }), star("ns", { temperature: undefined, stage: "neutron_star" })], subs, game());
    expect(stars).toEqual({ hot: { colour: "white" }, ns: { colour: null }, sun: { colour: "red" } });
  });

  it("calls a planet with no climate a giant", () => {
    expect(worldsOf([star("sun"), planet("big")], subs, game()).planets).toEqual({ big: { star: "sun", giant: true } });
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

  it("reads every climate field the schema has today", () => {
    expect(CLIMATE_FIELDS).toEqual(["albedo", "air", "greenhouse", "gases", "volatiles"]);
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
    const { stars, planets } = worldsOf(bodies, substances, { ...climate, starColour });
    expect(stars.senara.colour).toBe("orange");
    expect(stars.feock.colour).toBe("red");
    expect(stars.piran.colour).toBe("blue-white");
    expect(planets.tamsin).toMatchObject({ ground: "rock", seas: [{ of: "water" }], veil: null });
    expect(planets.orrin).toMatchObject({ ground: "ice", air: 1 });
    expect(planets.kynance).toMatchObject({ ground: "ice", air: 0 });
    expect(planets.botallack).toMatchObject({ ground: "rock", air: 0, seas: [], veil: null });
    expect(planets.lamorna.veil).toMatch(/rust-brown haze/);
    expect(planets.lelant.veil).toMatch(/pale yellow cloud/);
    expect(planets.morvah).toEqual({ star: "petroc", giant: true });
    const { ports } = worldsOf(bodies, substances, { ...climate, starColour });
    expect(ports.zennor).toEqual({ planet: "tamsin", coast: 0.2 });
    expect(ports.dolcoath).toEqual({ planet: "orrin", coast: 0 });
    expect(planets.lamorna.star).toBe("feock");
  });
});
