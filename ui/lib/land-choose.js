// Choosing the land's view (spec, "Choosing the view"): any generated land, an area `surface.<body>`,
// shows the walked land's map; and the land's data (ui/data/land.js) is picked by that body.

/** True when the location message is on generated land: its area starts with "surface.". */
export const landShown = (msg) => typeof msg?.area === "string" && msg.area.startsWith("surface.");

/** The entry in `land` (ui/data/land.js) for area `surface.<body>`; a land with no town or roads
 *  out for a body there's none of, so its walked places still draw. */
export function landWorld(area, land) {
  const body = typeof area === "string" && area.startsWith("surface.") ? area.slice("surface.".length) : "";
  return (Object.hasOwn(land, body) && land[body]) || { town: [], joins: {} };
}
