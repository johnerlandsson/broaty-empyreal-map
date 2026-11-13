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
