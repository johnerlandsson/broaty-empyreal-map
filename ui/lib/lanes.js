// The core's lanes, for the lanes map (docs/maps/lanes.md): the six systems inner to outer with
// their stations, and the lanes between them by id and class, as content/help/lanes.md makes them
// public. Only the topology: where the stars are and when a branch opens are the game's, not ours.
// lanes.test.js checks this against galaxy.yaml and system.yaml when ~/dev/empyreal is there.
// Pure: no DOM.

/** Inner to outer, each with its stations (a port such as Zennor among them). */
export const SYSTEMS = [
  { id: "petroc", name: "Petroc", stations: [{ id: "morvah_deep", name: "Morvah Deep" }] },
  { id: "keyne", name: "Keyne", stations: [{ id: "gwithian_reach", name: "Gwithian Reach" }] },
  {
    id: "senara",
    name: "Senara",
    stations: [
      { id: "tiss", name: "T.I.S.S." },
      { id: "orrin_station", name: "Orrin Station" },
      { id: "zennor", name: "Zennor" },
    ],
  },
  { id: "maelor", name: "Maelor", stations: [{ id: "wenna_halt", name: "Wenna Halt" }] },
  { id: "elowen", name: "Elowen", stations: [{ id: "carrow_yard", name: "Carrow Yard" }] },
  { id: "mabyn", name: "Mabyn", stations: [{ id: "lanyon_high", name: "Lanyon High" }] },
];

/** Every lane: its id (the two stars sorted, as the game names it), its class and its ends. */
export const LANES = [
  { id: "keyne-petroc", class: "trunk", between: ["petroc", "keyne"] },
  { id: "keyne-senara", class: "trunk", between: ["keyne", "senara"] },
  { id: "maelor-senara", class: "trunk", between: ["senara", "maelor"] },
  { id: "elowen-maelor", class: "trunk", between: ["maelor", "elowen"] },
  { id: "elowen-mabyn", class: "trunk", between: ["elowen", "mabyn"] },
  { id: "maelor-petroc", class: "branch", between: ["petroc", "maelor"] },
  { id: "keyne-mabyn", class: "branch", between: ["keyne", "mabyn"] },
];

export const BRANCHES = LANES.filter((l) => l.class === "branch");

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function systemName(id) {
  return SYSTEMS.find((s) => s.id === id)?.name ?? id;
}

/** A lane's name by its two stars, inner first: "Petroc–Maelor". */
export function laneName(id) {
  const l = LANES.find((x) => x.id === id);
  return l ? l.between.map(systemName).join("–") : id;
}

/** A lanes message from the Lua side made safe: unknown fields dropped, odd ones emptied. */
export function cleanLanes(msg) {
  const m = msg && typeof msg === "object" ? msg : {};
  const seen = {};
  if (m.seen && typeof m.seen === "object" && !Array.isArray(m.seen)) {
    for (const [id, s] of Object.entries(m.seen)) {
      if (s && typeof s.open === "boolean" && num(s.at) !== null) seen[id] = { open: s.open, at: s.at };
    }
  }
  const t = m.transit;
  const transit =
    t && typeof t === "object" && LANES.some((l) => l.id === t.lane) && typeof t.to === "string" && typeof t.from === "string"
      ? { lane: t.lane, from: t.from, to: t.to, progress: num(t.progress), eta: num(t.eta), received: num(t.received) }
      : null;
  return {
    system: typeof m.system === "string" ? m.system : null,
    visible: Array.isArray(m.visible) ? m.visible.filter((v) => typeof v === "string") : [],
    seen,
    transit,
  };
}

/** "2h 10m", "3d 4h", "5m": how long ago, from ms. */
export function agoText(ms) {
  const mins = Math.floor(Math.max(ms, 0) / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mins % 60}m`;
  return `${mins}m`;
}

/**
 * A lane's state as you know it at wall-clock t (ms): `open` true or false as last seen, or null
 * never seen; `now` while one of its mouths is in your system; and the words for it.
 */
export function laneState(lanes, id, t) {
  const s = lanes.seen[id];
  if (!s) return { open: null, now: false, words: "not seen" };
  const now = lanes.visible.includes(id);
  const state = s.open ? "open" : "closed";
  return { open: s.open, now, words: now ? `${state} · now` : `${state} · seen ${agoText(t - s.at * 1000)} ago` };
}

/**
 * Where she is in her lane at wall-clock t (ms): `k` 0 at the mouth she went in by to 1 at the far
 * one, and seconds `left`. Timed from her status's eta and progress (the game's progress is the
 * share of the trip done), as the chart times a trip.
 */
export function laneFix(transit, t) {
  if (!transit) return null;
  const { progress, eta, received } = transit;
  if (eta === null || received === null) return { k: Math.min(Math.max(progress ?? 0, 0), 1), left: null };
  const arrive = (received + eta) * 1000;
  const p = Math.min(Math.max(progress ?? 0, 0), 0.99);
  const total = (eta / (1 - p)) * 1000;
  const k = total > 0 ? 1 - (arrive - t) / total : 1;
  return { k: Math.min(Math.max(k, 0), 1), left: Math.max(0, (arrive - t) / 1000) };
}
