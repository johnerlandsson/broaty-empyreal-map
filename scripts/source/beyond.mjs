// The area an exit leads into when it leaves its own, as the game's mudstd.room.info names it
// (empyreal docs/gmcp.md §10.2): the area, never the room past the edge (decision 12). So far
// that's the generated land, `surface.<body>…`, whose area is `surface.<body>` and named for the
// body in system.yaml (surface-rooms.ts). Pure; build-data.mjs adds it to each such exit.

/**
 * @param {string} to  an exit's room id
 * @param {Map<string, string>} names  each body's name by id, from system.yaml
 * @returns {{area: string, areaName: string} | null}  null for a room in a content area, or land
 *   on a body the source doesn't have
 */
export function areaBeyond(to, names) {
  const m = /^surface\.([^.]+)(\.|$)/.exec(typeof to === "string" ? to : "");
  const name = m && names.get(m[1]);
  return typeof name === "string" && name ? { area: `surface.${m[1]}`, areaName: name } : null;
}

/**
 * A room's exits with each one onto another area given that area: `{ to, …, area, areaName }`,
 * a plain id made into `{ to }` first. Every other exit is as it was.
 * @param {Record<string, string|object>} exits
 * @param {Map<string, string>} names
 */
export function exitsBeyond(exits, names) {
  return Object.fromEntries(
    Object.entries(exits).map(([dir, e]) => {
      const to = typeof e === "string" ? e : e?.to;
      const beyond = areaBeyond(to, names);
      return [dir, beyond ? { ...(typeof e === "string" ? { to: e } : e), ...beyond } : e];
    }),
  );
}
