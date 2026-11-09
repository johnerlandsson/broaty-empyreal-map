// The sky over each port, from system.yaml and world.yaml: what Space.Charts doesn't carry and
// the game's ground.ts reads (planetside.md §4, calendar.md §8.2). Pure; build-data.mjs writes it.

import { CLIMATE_FIELDS } from "./worlds.mjs";

/**
 * A planet's fields the map reads: those Space.Charts carries (`day` as its ports' orbit period),
 * its `tilt` and `equinox`, which the sky reads from here, and of its `climate` the fields
 * worlds.mjs reads for its face from orbit. Any other is dropped by dotted name ("planet.gravity",
 * "planet.climate.clouds").
 */
export const PLANET_FIELDS = ["id", "name", "kind", "orbit", "radius", "day", "tilt", "equinox", ...CLIMATE_FIELDS.map((f) => `climate.${f}`)];
/**
 * A port's `surface` fields the map reads: `parent` and `bearing` as its orbit in the charts, its
 * `latitude`, and of its `site` only `coast`, which worlds.mjs reads for the sea seen over it. A
 * dotted name keeps that field and what's under it only, so `surface.site.height` is still reported.
 */
export const SURFACE_FIELDS = ["parent", "bearing", "latitude", "site.coast"];

/** Dotted names under `path` down to the leaves, as filter.mjs's for hulls. */
function leaves(path, value) {
  if (typeof value !== "object" || value === null || Array.isArray(value) || !Object.keys(value).length) return [path];
  return Object.entries(value).flatMap(([key, v]) => leaves(`${path}.${key}`, v));
}

const dropped = (prefix, raw, keep) => [
  ...new Set(
    Object.entries(raw ?? {})
      .filter(([key]) => !keep.includes(key))
      .flatMap(([key, value]) => leaves(`${prefix}.${key}`, value))
      .filter((leaf) => !keep.some((k) => leaf === `${prefix}.${k}` || leaf.startsWith(`${prefix}.${k}.`))),
  ),
];

/** The star a body is in the system of: up its parents (a port's is its surface's) to the one with none. */
function starOf(byId, id) {
  let b = byId.get(id);
  for (let i = 0; b && i < 16; i++) {
    if (b.kind === "star") return b;
    b = byId.get(b.surface?.parent ?? b.orbit?.parent);
  }
  return undefined;
}

/**
 * Each port's sky: its planet, that planet's `tilt` and `equinox`, its own `latitude` (each 0 where
 * the source gives none, as the game has it), its star's surface `temperature` in K, which the
 * game's sky words say as a colour (`{colour}`, stars.ts's starColour; null for a star with none),
 * and its sky words as the game's `portWords` gives them, Zennor's defaults under its own; and each
 * planet's and surface's fields the map doesn't read.
 * @param {object[]} bodies  system.yaml's `bodies`
 * @param {object[]} stations  world.yaml's `world.stations`, as written
 * @param {(station: object) => {sky: Record<string, string>}} portWords  the game's (systems/port-words.ts)
 * @returns {{ports: Record<string, object>, dropped: {place: string, dropped: {fields: string[], flags: string[]}}[]}}
 */
export function skyOf(bodies, stations, portWords) {
  const byId = new Map(bodies.map((b) => [b.id, b]));
  const ports = {};
  for (const b of [...bodies].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (b.kind !== "port" || !b.surface) continue;
    const planet = byId.get(b.surface.parent);
    ports[b.id] = {
      planet: b.surface.parent,
      tilt: planet?.tilt ?? 0,
      equinox: planet?.equinox ?? 0,
      latitude: b.surface.latitude ?? 0,
      temperature: starOf(byId, b.id)?.temperature ?? null,
      words: { ...portWords(stations.find((s) => s.id === b.id) ?? {}).sky },
    };
  }
  const out = [
    ...bodies.filter((b) => b.kind === "planet").map((b) => ({ place: b.id, dropped: { fields: dropped("planet", b, PLANET_FIELDS), flags: [] } })),
    ...bodies.filter((b) => b.surface).map((b) => ({ place: b.id, dropped: { fields: dropped("surface", b.surface, SURFACE_FIELDS), flags: [] } })),
  ];
  return { ports, dropped: out };
}
