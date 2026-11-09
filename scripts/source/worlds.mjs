// How each world and star looks, from system.yaml and substances.yaml, by the game's own physics
// (climate.ts and stars.ts, imported from the checkout as port-words.ts is): what's seen of a
// world from orbit and a star's colour, and nothing a player can't see. Pure; build-data.mjs
// writes it as ui/data/worlds.js (docs/maps/space-scenes.md, "A world's face").

/**
 * The climate fields read here: all five, since a volatile's state needs the mean and bare
 * temperatures (albedo, greenhouse) and its pressure, and a haze needs the gases. Only what
 * follows from them is written: none of these figures reaches the map but `air` and `albedo`.
 */
export const CLIMATE_FIELDS = ["albedo", "air", "greenhouse", "gases", "volatiles"];

/** The schema's defaults, so a world's climate reads as the game's loader gives it. */
const climateOf = (c) => ({ air: 0, greenhouse: 0, volatiles: [], ...c });

/** A body's star: up its orbits' parents to the one of kind `star`. */
function starOf(byId, b) {
  for (let at = b, n = 0; at && n < 16; at = byId.get(at.orbit?.parent), n++) if (at.kind === "star") return at;
  return undefined;
}

/**
 * Each star's colour, as the canopy names it, and each planet's face from orbit.
 *
 * Every planet names its `star`, whose light it's seen by. One with a `climate` also gets
 * `{ air, albedo, ground, frost, seas, veil }`: its air in bar
 * (0 airless), its albedo, `ground` "ice" where something lies on it as ice and else "rock",
 * `frost` where a trace of something lies as ice, `seas` each liquid's substance and share of the
 * surface, and `veil` the game's words for what hides it from orbit, or null. A planet without one
 * is a giant, `{ star, giant: true }`: the game authors no air for it and its prose has its bands.
 * Each port gets `{ planet, coast }`: the planet it's on, and its site's `coast`, how near the sea is
 * (0 none, the default), which says whether and how much sea shows from over it.
 * Weather is no part of it: that changes, and GMCP doesn't carry it.
 * @param {object[]} bodies  system.yaml's `bodies`
 * @param {object[]} substances  substances.yaml's `substances`
 * @param {{ sunlight: Function, temperatures: Function, surfaceOf: Function, phaseOf: Function, veilOf: Function, starColour: Function }} game
 *   the game's climate.ts and stars.ts
 * @returns {{ stars: Record<string, {colour: string|null}>, planets: Record<string, object>, ports: Record<string, {planet: string, coast: number}> }}
 */
export function worldsOf(bodies, substances, game) {
  const byId = new Map(bodies.map((b) => [b.id, b]));
  const subs = new Map(substances.map((s) => [s.id, s]));
  const sorted = [...bodies].sort((a, b) => (a.id < b.id ? -1 : 1));
  const stars = {};
  for (const b of sorted) {
    if (b.kind !== "star") continue;
    // a neutron star's light isn't sunlight and a black hole has none: no colour (stars.md §2)
    stars[b.id] = { colour: typeof b.temperature === "number" ? game.starColour(b.temperature) : null };
  }
  const planets = {};
  for (const b of sorted) {
    if (b.kind !== "planet") continue;
    const star = starOf(byId, byId.get(b.orbit?.parent));
    if (!b.climate) {
      planets[b.id] = { star: star?.id ?? null, giant: true };
      continue;
    }
    const c = climateOf(b.climate);
    if (!star || typeof b.orbit?.a !== "number") throw new Error(`${b.id}: a climate with no star to warm it`);
    const t = game.temperatures(game.sunlight(star, b.orbit.a), c, b.gravity, b.locked);
    let ground = "rock";
    let frost = false;
    const seas = [];
    for (const v of c.volatiles) {
      const s = subs.get(v.of);
      if (!s) throw new Error(`${b.id}: no substance ${v.of} in substances.yaml`);
      const surface = game.surfaceOf(v, s, c.air, t);
      if (surface === "seas") seas.push({ of: v.of, share: v.sea });
      else if (surface === "ice") ground = "ice";
      else if (surface === "trace" && game.phaseOf(s, c.air, t) === "ice") frost = true;
    }
    planets[b.id] = { star: star.id, air: c.air, albedo: c.albedo, ground, frost: frost && ground !== "ice", seas, veil: game.veilOf(c, t, subs) ?? null };
  }
  const ports = {};
  for (const b of sorted) {
    if (b.kind !== "port" || !b.surface?.parent) continue;
    ports[b.id] = { planet: b.surface.parent, coast: b.surface.site?.coast ?? 0 };
  }
  return { stars, planets, ports };
}
