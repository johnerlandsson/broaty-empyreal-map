// Choosing the land's view (spec, "Choosing the view"): any generated land, an area `surface.<body>`,
// shows the walked land's map; and the land's data (ui/data/land.js) is picked by that body, and the
// globe's latitude by the port it's measured from.

/** True when the location message is on generated land: its area starts with "surface.". */
export const landShown = (msg) => typeof msg?.area === "string" && msg.area.startsWith("surface.");

/** The entry in `land` (ui/data/land.js) for area `surface.<body>`; a land with no town or roads
 *  out for a body there's none of, so its walked places still draw. */
export function landWorld(area, land) {
  const body = landBody(area) ?? "";
  return (Object.hasOwn(land, body) && land[body]) || { town: [], joins: {} };
}

/** The body of area `surface.<body>`, or null for any other area. */
export function landBody(area) {
  if (typeof area !== "string" || !area.startsWith("surface.")) return null;
  return area.slice("surface.".length) || null;
}

/** The globe's latitude for a land: its port's (`world.from`) in ui/data/sky.js, else 0. */
export function landLatitude(world, sky) {
  const port = world?.from;
  const at = typeof port === "string" && Object.hasOwn(sky, port) ? sky[port]?.latitude : undefined;
  return typeof at === "number" && Number.isFinite(at) ? at : 0;
}

/** The name of a land's town, from the port it's measured from (`world.from`: "zennor" is Zennor,
 *  "dolcoath" Dolcoath), or null for a land with no town (a world with no port). */
export function townName(world) {
  const port = world?.from;
  if (typeof port !== "string" || port === "" || !world.town?.length) return null;
  return port.charAt(0).toUpperCase() + port.slice(1);
}

/** The land area (`surface.<body>`) a site's room is shown on, for area `site.<id>`: the land of the
 *  site's walked front (`surface.<body>.site.<id>`, set-pieces.md §3); null for any other area, or a
 *  site whose front isn't walked. */
export function siteLand(area, store) {
  if (typeof area !== "string" || !area.startsWith("site.") || area.length === 5) return null;
  const tail = `.site.${area.slice(5)}`;
  const front = store.places().find((p) => p.id.startsWith("surface.") && p.id.endsWith(tail));
  return front ? front.id.slice(0, -tail.length) : null;
}
