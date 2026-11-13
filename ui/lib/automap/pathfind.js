// Cross-area shortest routing over the room graph. Pure: no DOM, no host
// APIs. Exits are directional `{ [dir]: { to } }`; area boundaries are ignored
// (cross-area edges are recorded by identity.js and are routable). Links
// (links.js) route too, at LINK_COST steps each: a lift or a portal is
// worth a short detour to avoid, not a long one.

import { linksOf } from "./links.js";

export const LINK_COST = 5;

// Every way out of a room: [{ to, cost, dir } | { to, cost, link }].
function waysOut(map, room) {
  const out = [];
  for (const dir of Object.keys(room.exits)) {
    const to = room.exits[dir].to;
    if (to != null && map.rooms[to]) out.push({ to, cost: 1, dir });
  }
  const links = linksOf(room);
  for (const to of Object.keys(links)) {
    if (map.rooms[to]) out.push({ to, cost: LINK_COST, link: links[to] });
  }
  return out;
}

// Dial's algorithm: costs are small integers, so a bucket per distance, each
// first-in first-out. With every cost 1 it visits rooms in breadth-first
// order, so routes over exits alone are what a BFS would find.
function search(map, fromId, toId) {
  const dist = { [fromId]: 0 };
  const prev = { [fromId]: null };   // roomId -> { from, way } | null (start)
  const buckets = [[fromId]];
  for (let d = 0; d < buckets.length; d++) {
    const bucket = buckets[d];
    if (!bucket) continue;
    for (let i = 0; i < bucket.length; i++) {
      const id = bucket[i];
      if (dist[id] !== d) continue;   // reached more cheaply since
      if (id === toId) return { dist, prev };
      for (const way of waysOut(map, map.rooms[id])) {
        const nd = d + way.cost;
        if (dist[way.to] !== undefined && dist[way.to] <= nd) continue;
        dist[way.to] = nd;
        prev[way.to] = { from: id, way };
        (buckets[nd] = buckets[nd] || []).push(way.to);
      }
    }
  }
  return { dist, prev };
}

export function distances(map, fromId) {
  if (!map.rooms[fromId]) return {};
  return search(map, fromId, null).dist;
}

// [{ fromId, dir, toId }] for an exit, [{ fromId, link, toId }] for a link;
// [] when already there; null when there's no known route.
export function findPath(map, fromId, toId) {
  if (!map.rooms[fromId] || !map.rooms[toId]) return null;
  if (fromId === toId) return [];
  const { prev } = search(map, fromId, toId);
  if (prev[toId] === undefined) return null;
  const steps = [];
  let cur = toId;
  while (prev[cur]) {
    const { from, way } = prev[cur];
    steps.unshift(way.link
      ? { fromId: from, link: way.link, toId: cur }
      : { fromId: from, dir: way.dir, toId: cur });
    cur = from;
  }
  return steps;
}
