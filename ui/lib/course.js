// What the chart's corner card shows of the course she has plotted (src/station_map/course.lua):
// where to, its distance, time at cruise and fuel as the game words them (`courseText` in the
// game's plot.ts), whether it's ragged, and how long ago it was plotted. Only while she's at rest:
// under way, her trip line says where she's going and the card goes.

/** Seconds as the game's durationText: "3m 51s", "1h 2m", "40s". */
export function duration(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** How long ago, as bare `plot` says it: "just now", "4m ago", "2h 5m ago", "3d ago". */
export function plottedAgo(ms) {
  const mins = Math.floor(Math.max(0, ms) / 60000);
  if (mins < 1) return "just now";
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ${mins % 60}m ago`;
  return `${mins}m ago`;
}

/**
 * @param {{ course?: { to: string, name: string, km?: number, seconds?: number, fuel?: number, ragged: boolean, at?: number } }} msg
 * @param {{ destination?: string } | null} ship her chart state; under way, there's no card
 * @param {number} now ms since the epoch
 * @returns {{ label: string, figures: string, ragged: boolean, age: string } | null}
 */
export function courseCard(msg, ship, now) {
  const c = msg?.course;
  if (!c || typeof c !== "object" || typeof c.to !== "string" || c.to === "") return null;
  if (ship?.destination) return null;
  const fin = (v) => typeof v === "number" && Number.isFinite(v);
  const figures = [
    fin(c.km) ? `${Math.round(c.km).toLocaleString("en")} km` : null,
    fin(c.seconds) ? duration(c.seconds) : null,
    fin(c.fuel) ? `${Math.ceil(c.fuel)} fuel` : null,
  ].filter(Boolean).join(" · ");
  const age = fin(c.at) ? Math.max(0, now - c.at) : null;
  return {
    label: `Course for ${c.name || c.to}`,
    figures,
    ragged: c.ragged === true,
    age: age === null ? "" : `plotted ${plottedAgo(age)}`,
  };
}
