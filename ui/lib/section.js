// A city of levels' section (Dolcoath's top band underground): John's pick C, a shaft diagram
// (docs/maps/reference/dolcoath-overview-options.png, 2026-11-07). Not to scale: the levels go
// down the band evenly spaced, top to bottom, the cage's shaft through every level it stops at
// and the man engine's beside it through every level it has a stage on, the Pit small on top.
// A level the cage doesn't stop at (the Pump Gallery, the Winze) hangs off the shaft, joined to
// the level a way down reaches it from. The cage is drawn only where Empyreal.Vehicle puts it,
// which the game sends only to those aboard: at its stop, or midway between the two it's between,
// pointing the way it's heading. Everything here is the diagram's layout and words; section-view.js
// draws it. Pure; no DOM.

import { waysOff } from "./levels.js";

export const ROW = 26; // between one level and the next
export const ENGINE = -12; // the man engine's shaft, west of the cage's at 0
export const LABEL = 40; // where the levels' names start
const HANG = 18; // a hanging level's column, out from the cage's shaft, one more each
export const PIT = 16; // the Pit's bowl, over the top level

/**
 * The diagram: a row a level, top down, each with its `y`, its `x` (0 on the shaft, out to the east
 * where it hangs off it), its name and depth, and `from`, the level it hangs from (null on the
 * shaft); the cage's shaft `cage` from the top stop's row to the bottom's (null without a cage),
 * the man engine's `engine` the same, and `bounds`.
 * @param {ReturnType<typeof import("./levels.js").indexLevels>} index
 */
export function sectionLayout(index) {
  const levels = index?.levels ?? [];
  const cage = (index?.cars ?? []).find((c) => c.kind === "cage") ?? null;
  const stops = new Set(cage?.stops ?? []);
  const ways = new Map(levels.map((lv) => [lv.level, waysOff(index, lv.level)]));
  const rows = [];
  let hung = 0;
  levels.forEach((lv, i) => {
    const onShaft = !!lv.stop && stops.has(lv.stop);
    // a level off the shaft hangs from the first level that has a way to it
    const from = onShaft ? null : (levels.find((o) => o !== lv && (ways.get(o.level) ?? []).some((w) => w.kind !== "cage" && (w.up?.level === lv.level || w.down?.level === lv.level)))?.level ?? null);
    rows.push({
      level: lv.level,
      name: String(lv.name ?? "").toUpperCase(),
      title: String(lv.name ?? ""),
      depth: lv.depth ?? null,
      tag: lv.depth ? `${lv.depth} FM` : "", // the surface needs no depth, and the Pump Gallery's isn't given
      y: i * ROW,
      x: onShaft ? 0 : HANG * ++hung,
      from,
      stop: onShaft ? lv.stop : null,
    });
  });
  const span = (keep) => {
    const ys = rows.filter(keep).map((r) => r.y);
    return ys.length ? { y0: Math.min(...ys), y1: Math.max(...ys) } : null;
  };
  const engine = span((r) => (ways.get(r.level) ?? []).some((w) => w.kind === "man-engine"));
  const shaft = cage ? span((r) => r.stop !== null) : null;
  const right = LABEL + 8 * Math.max(0, ...rows.map((r) => r.name.length)) * 0.62;
  return {
    rows,
    cage: shaft,
    engine,
    car: cage ? { id: cage.id, name: cage.name ?? "The Cage" } : null,
    bounds: { x0: -56, y0: -PIT - 14, x1: Math.max(right, LABEL + 60) + HANG * hung, y1: (rows.length - 1) * ROW + 16 },
  };
}

/**
 * Where the cage is, from the location message's `lift` while you ride it: `y` on its stop's row,
 * or midway between the rows of the two it's between, and `dir` the way it's heading, 1 down the
 * band, -1 up, 0 at a stop or not saying. Null when the message isn't the cage's, or names stops
 * the diagram hasn't.
 */
export function cageAt(layout, index, lift) {
  if (lift?.kind !== "cage") return null;
  const rowOf = (id) => {
    const level = index?.byId?.get(id)?.level;
    return layout.rows.find((r) => r.stop !== null && r.level === level) ?? null;
  };
  const dir = lift.heading === "down" ? 1 : lift.heading === "up" ? -1 : 0;
  if (typeof lift.at === "string" && lift.at !== "") {
    const r = rowOf(lift.at);
    return r ? { y: r.y, dir: 0, at: r.level } : null;
  }
  if (Array.isArray(lift.between) && lift.between.length === 2) {
    const [a, b] = lift.between.map(rowOf);
    if (!a || !b) return null;
    return { y: (a.y + b.y) / 2, dir, at: null };
  }
  return null;
}

/** The hover's words on a level's row: its name, and how deep. */
export function rowTip(row) {
  const deep = row.depth ? `${row.depth} fathoms down` : row.depth === 0 ? "At the surface" : "Depth not known";
  return { title: row.title.charAt(0).toUpperCase() + row.title.slice(1), body: deep };
}
