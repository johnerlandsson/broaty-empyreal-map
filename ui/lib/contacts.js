// The last sweep's picture (Space.Contacts, gmcp.md §8.5) for the system chart and the belt map: pure
// and DOM-free. What it saw stays where it saw it: nothing here moves a ship on from the sweep. A dark
// ship (`unknown`) is her contact number and where she was, nothing more (charts.lua strips the rest).
// A contact is where she was at the sweep plus its km and bearing, degrees clockwise from the
// system's zero, +y (navigation.md decision 18: every frame in a system has the star's axes).

import { ago } from "./orbits.js";

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const fmt = (n) => Math.round(n).toLocaleString("en");

// hulls.yaml's names, by the id a named ship's `hull` gives
export const HULLS = { skiff: "prospecting skiff", courier: "courier", freighter: "medium freighter" };

export const isShip = (c) => c?.kind === "ship" || c?.kind === "unknown";
export const isDark = (c) => c?.kind === "unknown";

/** A hull's name ("prospecting skiff"), or its id for one this doesn't know; null for none. */
export const hullName = (id) => (id ? (HULLS[id] ?? String(id)) : null);

/** The point km along a bearing (degrees clockwise from +y) from p. */
export function along(p, km, bearing) {
  const a = (bearing * Math.PI) / 180;
  return [p[0] + Math.sin(a) * km, p[1] + Math.cos(a) * km];
}

/** Where the sweep saw c: `from` (where she was at the sweep, in the frame wanted) plus its km and
 *  bearing; else its x and y, from a sweep saved before bearings or with no place for her; else null. */
export function placeOf(c, from) {
  const km = num(c?.km);
  const bearing = num(c?.bearing);
  if (from && km !== null && bearing !== null) return along(from, km, bearing);
  return num(c?.x) !== null && num(c?.y) !== null ? [c.x, c.y] : null;
}

/** The sweep, if it's of `system` (the charts'), indexed: `ships` to draw, `marks` (anything it had
 *  behind a body or missed) by id, every contact `byId`, `where` each was seen by id (placeOf, from
 *  `from`, her place at the sweep in the star's frame), and `seen`, the ships' alone, which
 *  positionOf reads for a chase. Null for no sweep, or another system's. */
export function sweepOf(contacts, system, from = null) {
  if (!contacts || typeof contacts !== "object" || !system || contacts.system !== system) return null;
  const at = num(contacts.at);
  if (at === null) return null;
  const ships = [];
  const marks = new Map();
  const byId = new Map();
  const where = new Map();
  const seen = new Map();
  for (const c of Array.isArray(contacts.contacts) ? contacts.contacts : []) {
    const p = c && typeof c.id === "string" ? placeOf(c, from) : null;
    if (!p) continue;
    byId.set(c.id, c);
    where.set(c.id, p);
    if (isShip(c)) {
      ships.push(c);
      seen.set(c.id, p);
    } else if (c.hidden || c.missed) marks.set(c.id, c);
  }
  return { at, system, ships, marks, byId, where, seen };
}

/** A contact's name as the sweep had it: a dark ship's is her contact number. */
export const nameOf = (c) => (isDark(c) ? c.id : String(c?.name ?? c?.id ?? ""));

/** A named ship's second line on the chart, "skiff · under drive"; "" for a dark one. */
export function shipLine(c) {
  if (isDark(c)) return "";
  const hull = hullName(c?.hull);
  const parts = [hull ? hull.split(" ").pop() : null, c?.moving ? "under drive" : null].filter(Boolean);
  return parts.join(" · ");
}

/** A ship's tooltip: hull and owner, moving or not, and how far off, all as of the sweep; a dark
 *  ship's says only where the sweep saw her. */
export function shipTip(c) {
  if (isDark(c)) return { title: c.id, body: "where the last sweep saw her" };
  const who = [hullName(c.hull), c.owner].filter(Boolean).join(", ");
  const km = num(c.km);
  const how = [c.moving === true ? "under drive" : c.moving === false ? "at rest" : null, km !== null ? `${fmt(km)} km off` : null]
    .filter(Boolean)
    .join(", ");
  return { title: nameOf(c), body: [who, how ? `${how} at the sweep` : "at the sweep"].filter(Boolean).join("\n") };
}

/** "T.I.S.S., behind Tamsin" or "Orrin Station, missed"; `body` names the body that hid it. */
export function markText(c, body = (id) => id) {
  if (c?.hidden) return `${nameOf(c)}, behind ${body(c.hidden)}`;
  if (c?.missed) return `${nameOf(c)}, missed`;
  return nameOf(c);
}

/** The ship she's chasing, if her destination is one on the sweep. */
export function chased(sweep, ship) {
  const c = sweep && ship?.destination ? sweep.byId.get(ship.destination) : null;
  return isShip(c) ? c : null;
}

/** "4m ago", "1h 2m ago", "just now": how old the sweep is at t (ms), to the minute. */
export function sweepAge(sweep, t) {
  const ms = t - sweep.at;
  return ms < 60000 ? "just now" : `${ago(ms)} ago`;
}

/** What the corner card says, folded and unfolded: `chase` (the ship she's after), `head` (the
 *  sweep's age), and the `rows` it unfolds to: each ship, then each station or mouth behind a body
 *  or missed, as [name, what of it]. */
export function card(sweep, ship, t, body = (id) => id) {
  const after = chased(sweep, ship);
  const rows = [];
  for (const c of [...sweep.ships].sort((a, b) => (num(a.km) ?? Infinity) - (num(b.km) ?? Infinity))) {
    const km = num(c.km);
    const what = isDark(c) ? [] : [hullName(c.hull)?.split(" ").pop(), c.moving ? "under drive" : null];
    rows.push([nameOf(c), [...what, km !== null ? `${fmt(km)} km` : null].filter(Boolean).join(" · ")]);
  }
  for (const c of sweep.marks.values()) rows.push([nameOf(c), c.hidden ? `behind ${body(c.hidden)}` : "missed"]);
  return { chase: after ? `After ${nameOf(after)}` : null, head: `Last sweep · ${sweepAge(sweep, t)}`, rows };
}
