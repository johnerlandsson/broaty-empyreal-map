// How each world and star looks, from system.yaml and substances.yaml, by the game's own physics
// (climate.ts, stars.ts and tides.ts, imported from the checkout as port-words.ts is): what's seen of a
// world from orbit and a star's colour, and nothing a player can't see. Pure; build-data.mjs
// writes it as ui/data/worlds.js (docs/maps/space-scenes.md, "A world's face").

/**
 * The climate fields read here: all five, since a volatile's state needs the mean and bare
 * temperatures (albedo, greenhouse) and its pressure, and a haze needs the gases. Only what
 * follows from them is written: none of these figures reaches the map but `air` and `albedo`.
 * sky.mjs keeps these from the report; any other climate field is reported as unread.
 */
export const CLIMATE_FIELDS = ["albedo", "air", "greenhouse", "gases", "volatiles"];

/**
 * The envelope fields read here, all three: a gaseous world's albedo and heat from inside give its
 * temperature at 1 bar (with its gases' heat capacity), which says which gas forms its cloud deck.
 * Only what follows from them is written: its albedo, its deck, how blue methane makes it, and how
 * a night side hot enough to see glows. sky.mjs keeps these from the report.
 */
export const ENVELOPE_FIELDS = ["albedo", "heat", "gases"];

/** A night side hotter than this (K), the Draper point, glows: dull red at first, brighter hotter. */
export const DRAPER = 798;
/** How hot (K) a night side is when it glows its brightest on the map, about a dim orange. */
export const EMBERS_FULL = 1500;
/** The methane share that tints a world as blue-green as it gets, about Uranus's and Neptune's. */
export const METHANE_FULL = 0.02;

/** The schema's defaults, so a world's climate reads as the game's loader gives it. */
const climateOf = (c) => ({ air: 0, greenhouse: 0, volatiles: [], ...c });

/**
 * A body's star, and the body on the way up that orbits it, whose distance its light is taken at,
 * as the game's loader has it (`lightOn`): a moon is lit at its planet's distance, not its own.
 */
function lightOf(byId, b) {
  let at = b;
  let up = byId.get(b.orbit?.parent);
  for (let n = 0; up && up.kind !== "star" && n < 16; n++) {
    at = up;
    up = byId.get(up.orbit?.parent);
  }
  return up?.kind === "star" ? { star: up, km: at.orbit?.a } : { star: undefined, km: undefined };
}

/**
 * Each star's colour, as the canopy names it, and each planet's face from orbit.
 *
 * Every planet names its `star`, whose light it's seen by. One with a `climate` also gets
 * `{ air, albedo, ground, frost, seas, veil }`: its air in bar
 * (0 airless), its albedo, `ground` "ice" where something lies on it as ice and else "rock",
 * `frost` where a trace of something lies as ice, `seas` each liquid's substance and share of the
 * surface, and `veil` the game's words for what hides it from orbit, or null. A gaseous world, one
 * with an `envelope`, is a giant, `{ star, giant: true, albedo, clouds, methane, embers }` (envelopeOf):
 * its prose has its bands. A planet with neither, from a source older than envelopes, is
 * `{ star, giant: true }`.
 * Each port gets `{ planet, coast }`: the planet it's on, and its site's `coast`, how near the sea is
 * (0 none, the default), which says whether and how much sea shows from over it.
 * Weather is no part of it: that changes, and GMCP doesn't carry it.
 * @param {object[]} bodies  system.yaml's `bodies`
 * @param {object[]} substances  substances.yaml's `substances`
 * @param {{ sunlight: Function, temperatures: Function, surfaceOf: Function, phaseOf: Function, veilOf: Function, starColour: Function,
 *   envelopeTemperatures: Function, specificHeat: Function, lockTime: Function, QUALITY: {envelope: number} }} game
 *   the game's climate.ts, stars.ts and tides.ts
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
    const { star, km } = lightOf(byId, b);
    if (b.envelope) {
      planets[b.id] = { star: star?.id ?? null, giant: true, ...envelopeOf(b, star, km, subs, game) };
      continue;
    }
    if (!b.climate) {
      // no envelope either: a source older than envelopes, drawn as giants were
      planets[b.id] = { star: star?.id ?? null, giant: true };
      continue;
    }
    const c = climateOf(b.climate);
    if (!star || typeof km !== "number") throw new Error(`${b.id}: a climate with no star to warm it`);
    const t = game.temperatures(game.sunlight(star, km), c, b.gravity, b.locked);
    let ground = "rock";
    let frost = false;
    const seas = [];
    for (const v of c.volatiles) {
      const s = subs.get(v.of);
      if (!s) throw new Error(`${b.id}: no substance ${v.of} in substances.yaml`);
      const surface = game.surfaceOf(v, s, c.air, t);
      // the loader wants a `sea` on anything liquid and plenty; 0 where it has none, so the scenes agree it has none to show
      if (surface === "seas") seas.push({ of: v.of, share: v.sea ?? 0 });
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

/** The stages whose tides the game's loader lets lock a world (loader.ts's lockWorlds). */
const LOCKING_STAGES = ["main", "subgiant", "giant"];

/**
 * Whether a gaseous world is locked to its star, by the game's loader's rule (lockWorlds, which
 * isn't exported): one that authors no `day`, going round a star of a stage that locks, whose tides
 * would have locked it at an envelope's tidal quality in less than the star's age (tides.ts).
 */
function lockedOf(b, star, game) {
  if (b.day !== undefined || b.orbit?.parent !== star.id) return false; // a moon's tides are its planet's, not its star's
  if (!star.mass || !star.age || !LOCKING_STAGES.includes(star.stage) || !b.radius || !b.gravity) return false;
  return game.lockTime(star.mass, b.radius, b.gravity, b.orbit.a, game.QUALITY.envelope) < star.age;
}

/**
 * What a gaseous world's face needs, by the game's own physics (planets.md §3.2): its `albedo`;
 * `clouds`, the gas its cloud deck is of, the one of its gases the game's phaseOf has frozen or
 * liquid at its temperature at 1 bar that does so coldest (it lies highest), or null where none
 * does and its gas is seen clear and deep; `methane`, 0..1, how much methane tints it blue-green,
 * 1 at METHANE_FULL; and `embers`, 0..1, how bright its night side glows, 0 below the Draper point
 * (Caradon 1, a locked hot Jupiter, is the only one today). Not its gases or temperatures themselves.
 */
export function envelopeOf(b, star, km, subs, game) {
  const e = b.envelope;
  if (!star || typeof km !== "number") throw new Error(`${b.id}: an envelope with no star to light it`);
  for (const gas of Object.keys(e.gases)) if (!subs.has(gas)) throw new Error(`${b.id}: no substance ${gas} in substances.yaml`);
  const locked = lockedOf(b, star, game);
  const t = game.envelopeTemperatures(game.sunlight(star, km), e, b.gravity ?? 1, b.day ?? 0, locked, game.specificHeat(e.gases, subs));
  // the gases that condense at 1 bar, the coldest to condense first: it's the deck on top
  const deck = Object.keys(e.gases)
    .map((gas) => subs.get(gas))
    .filter((s) => ["ice", "liquid"].includes(game.phaseOf(s, 1, { mean: t.mean, bare: t.mean })))
    .sort((x, y) => x.boils - y.boils)[0];
  const round = (v) => Math.round(v * 100) / 100;
  return {
    albedo: e.albedo,
    clouds: deck?.id ?? null,
    methane: round(Math.min(1, (e.gases.methane ?? 0) / METHANE_FULL)),
    embers: round(Math.max(0, Math.min(1, (t.night - DRAPER) / (EMBERS_FULL - DRAPER)))),
  };
}
