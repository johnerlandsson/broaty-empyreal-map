// Each world's land as the map draws it, from land.yaml: the port it's measured from, the town's
// outline (km east and north of it) and where each road out of the town ends. Pure; build-data.mjs
// writes it. The rest of land.yaml (heights, valleys, tracks) would say what the player hasn't seen.

import { parse } from "yaml";

const point = ({ e, n }) => ({ e, n });

/**
 * @param {string} text  land.yaml's text
 * @returns {Record<string, {from: string, town: {e: number, n: number}[], joins: Record<string, {at: {e: number, n: number}, room: string}>}>}
 */
export function landData(text) {
  const out = {};
  for (const land of parse(text)?.lands ?? []) {
    const town = (land.strokes ?? []).find((s) => s.kind === "town");
    out[land.world] = {
      from: land.from,
      town: (town?.outline ?? []).map(point),
      joins: Object.fromEntries((land.joins ?? []).map((j) => [j.id, { at: point(j.at), room: j.room }])),
    };
  }
  return out;
}
