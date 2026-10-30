// The galaxy's lanes, for the lanes map (docs/maps/lanes.md): the twenty stars with their stations,
// and the lanes between them by id and class, as content/help/lanes.md and mid.md make them public.
// The Shallows' twelve in ring order, joined round by trunks; the Mid's eight, with branches only,
// Dozmary and Garrow the deepest; relays where help lanes says. Every pair of stars without a trunk
// has a branch, class mid if an end is in the Mid. Only the topology: where the stars are and when
// a branch opens are the game's, not ours. lanes.test.js checks this against galaxy.yaml and
// system.yaml when ~/dev/empyreal is there. src/station_map/lanes.lua has the same stars.
// Which systems can reach the Bank, as far as you know, is contactOf. Pure: no DOM.

const shallows = (id, name, stations) => ({ id, name, band: "shallows", relay: true, deep: false, stations });
const mid = (id, name, stations = [], { relay = false, deep = false } = {}) => ({ id, name, band: "mid", relay, deep, stations });

/** The Shallows round the ring from Petroc, then the Mid; each with its stations (a port such as Zennor among them). */
export const SYSTEMS = [
  shallows("petroc", "Petroc", [{ id: "morvah_deep", name: "Morvah Deep" }]),
  shallows("keyne", "Keyne", [{ id: "gwithian_reach", name: "Gwithian Reach" }]),
  shallows("senara", "Senara", [
    { id: "tiss", name: "T.I.S.S." },
    { id: "orrin_station", name: "Orrin Station" },
    { id: "zennor", name: "Zennor" },
  ]),
  shallows("maelor", "Maelor", [{ id: "wenna_halt", name: "Wenna Halt" }]),
  shallows("elowen", "Elowen", [{ id: "carrow_yard", name: "Carrow Yard" }]),
  shallows("mabyn", "Mabyn", [{ id: "lanyon_high", name: "Lanyon High" }]),
  shallows("piran", "Piran", [{ id: "kynance_spindle", name: "Kynance Spindle" }]),
  shallows("breage", "Breage", [{ id: "marazion_quay", name: "Marazion Quay" }]),
  shallows("euny", "Euny", [{ id: "penwith_vats", name: "Penwith Vats" }]),
  shallows("madron", "Madron", [{ id: "botallack_head", name: "Botallack Head" }]),
  shallows("germoe", "Germoe", [{ id: "polperro_old_dock", name: "Polperro Old Dock" }]),
  shallows("feock", "Feock", [{ id: "lamorna_light", name: "Lamorna Light" }]),
  mid("hensbarrow", "Hensbarrow"),
  mid("goonhilly", "Goonhilly"),
  mid("dozmary", "Dozmary", [], { deep: true }),
  mid("godolphin", "Godolphin"),
  mid("trencrom", "Trencrom"),
  mid("kilmar", "Kilmar", [{ id: "kilmar_steading", name: "Kilmar Steading" }], { relay: true }),
  mid("garrow", "Garrow", [{ id: "garrow_stop", name: "Garrow Stop" }], { relay: true, deep: true }),
  mid("caradon", "Caradon", [{ id: "caradon_works", name: "Caradon Works" }], { relay: true }),
];

export const RING = SYSTEMS.filter((s) => s.band === "shallows");
export const MID = SYSTEMS.filter((s) => s.band === "mid");

const laneId = (a, b) => [a, b].sort().join("-");

/**
 * Every lane: its id (the two stars sorted, as the game names it), its class and its ends, in
 * SYSTEMS' order. The trunks join each Shallows star to the next round the ring, Feock back to Petroc.
 */
export const LANES = (() => {
  const trunks = new Set(RING.map((s, i) => laneId(s.id, RING[(i + 1) % RING.length].id)));
  const out = [];
  SYSTEMS.forEach((a, i) => {
    for (const b of SYSTEMS.slice(i + 1)) {
      const id = laneId(a.id, b.id);
      const cls = trunks.has(id) ? "trunk" : a.band === "mid" || b.band === "mid" ? "mid" : "branch";
      out.push({ id, class: cls, between: [a.id, b.id] });
    }
  });
  return out;
})();

/** The lanes that open and close: every one but the trunks. */
export const BRANCHES = LANES.filter((l) => l.class !== "trunk");

const LANE = new Map(LANES.map((l) => [l.id, l]));
const STAR = new Map(SYSTEMS.map((s) => [s.id, s]));

/** A lane by id, or undefined. */
export function lane(id) {
  return LANE.get(id);
}

/** A star's lanes, one to each other star. */
export function lanesOf(star) {
  return LANES.filter((l) => l.between.includes(star));
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function systemName(id) {
  return SYSTEMS.find((s) => s.id === id)?.name ?? id;
}

/** A lane's name by its two stars, in SYSTEMS' order: "Petroc–Maelor", "Senara–Garrow". */
export function laneName(id) {
  const l = LANE.get(id);
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
  const contact = {};
  if (m.contact && typeof m.contact === "object" && !Array.isArray(m.contact)) {
    for (const [id, c] of Object.entries(m.contact)) {
      if (STAR.has(id) && c && typeof c.ok === "boolean" && num(c.at) !== null) contact[id] = { ok: c.ok, at: c.at };
    }
  }
  const t = m.transit;
  const transit =
    t && typeof t === "object" && LANE.has(t.lane) && typeof t.to === "string" && typeof t.from === "string"
      ? { lane: t.lane, from: t.from, to: t.to, progress: num(t.progress), eta: num(t.eta), received: num(t.received) }
      : null;
  const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  return {
    system: typeof m.system === "string" ? m.system : null,
    visible: strings(m.visible),
    uncharted: strings(m.uncharted),
    seen,
    contact,
    reach: m.reach && typeof m.reach.ok === "boolean" && num(m.reach.after) !== null ? { ok: m.reach.ok, after: m.reach.after } : null,
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
 * never seen; `now` while the charts in your system say it; and the words for it. A lane of your
 * system whose mouth there isn't on your charts, never seen from elsewhere, is "not charted".
 */
export function laneState(lanes, id, t) {
  const s = lanes.seen[id];
  if (!s) return { open: null, now: false, words: lanes.uncharted.includes(id) ? "not charted" : "not seen" };
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

/**
 * The lanes of your system open now, how many are closed, as the charts last said, and those whose
 * mouth here isn't on your charts, so the charts say nothing of them.
 */
export function openHere(lanes) {
  const open = [];
  const uncharted = [];
  let closed = 0;
  if (!lanes.system) return { open, closed, uncharted };
  for (const l of lanesOf(lanes.system)) {
    const s = lanes.seen[l.id];
    if (lanes.uncharted.includes(l.id)) uncharted.push(l);
    else if (s?.open && lanes.visible.includes(l.id)) open.push(l);
    else closed++;
  }
  return { open, closed, uncharted };
}

/** Branches seen open from somewhere you're not now, newest first, each with how long ago (ms) at wall-clock t. */
export function seenOpenElsewhere(lanes, t) {
  return Object.entries(lanes.seen)
    .filter(([id, s]) => s.open && !lanes.visible.includes(id) && LANE.get(id)?.class !== "trunk")
    .map(([id, s]) => ({ lane: LANE.get(id), ago: Math.max(0, t - s.at * 1000) }))
    .sort((a, b) => a.ago - b.ago || a.lane.id.localeCompare(b.lane.id));
}

/** The star whose system keeps the Bank's books: the Authority's home. */
export const HOME = "senara";

/** The lanes that can carry contact: relays at both ends (help lanes). */
const RELAYED = LANES.filter((l) => l.between.every((id) => STAR.get(id).relay));

/** From each seed ({star: at}) along lanes known open: each star's freshest way, as old as its oldest link. */
function spread(seeds, linkAt) {
  const best = { ...seeds };
  for (let again = true; again; ) {
    again = false;
    for (const l of RELAYED) {
      const link = linkAt(l);
      if (link === null) continue;
      const [a, b] = l.between;
      for (const [from, to] of [[a, b], [b, a]]) {
        const at = Math.min(best[from] ?? -Infinity, link);
        if (at > (best[to] ?? -Infinity)) {
          best[to] = at;
          again = true;
        }
      }
    }
  }
  return best;
}

/**
 * What you know of each star's contact with the Bank at wall-clock t (ms) (help money, help lanes;
 * bank.ts reachableFrom): {state: "in", "out" or "unknown", at (seconds, how old it is), now, fixed}.
 * A star is in contact while open lanes with relays at both ends join it to HOME; the trunks do that
 * for the Shallows for good, and with no relays a star never is: those are `fixed`, with no age. Any
 * other goes by the newest of what's known: a chain of lanes seen open, as old as its oldest; a reading
 * of accountReachable, there and over lanes seen open from there; or every way in seen closed. The
 * reading where you are, when there's one (`reach`), goes over all of it. Two as new that disagree are
 * not known. Age alone changes nothing, and nothing here says what's next.
 */
export function contactOf(lanes, t) {
  const secs = t / 1000;
  const live = lanes.reach && lanes.system && !lanes.transit && secs >= lanes.reach.after ? lanes.reach : null;
  const when = (l) => (lanes.visible.includes(l.id) ? secs : lanes.seen[l.id]?.at);
  const linkAt = (l) => (l.class === "trunk" ? Infinity : lanes.seen[l.id]?.open ? when(l) : null);
  const closed = (l) => l.class !== "trunk" && lanes.seen[l.id]?.open === false;

  const readings = (ok) => {
    const out = {};
    for (const [id, c] of Object.entries(lanes.contact)) if (c.ok === ok) out[id] = c.at;
    if (live?.ok === ok) out[lanes.system] = secs;
    if (live?.ok === !ok) delete out[lanes.system];
    return out;
  };
  const yes = spread({ ...readings(true), [HOME]: Infinity }, linkAt);
  const no = spread(readings(false), linkAt);

  // the stars a way to HOME might still reach, over every lane not seen closed
  const maybe = new Set(Object.keys(spread({ [HOME]: Infinity }, (l) => (closed(l) ? null : Infinity))));
  const shutOff = {};
  for (const l of RELAYED) {
    if (!closed(l)) continue;
    const at = when(l);
    for (const id of l.between) if (!maybe.has(id)) shutOff[id] = Math.min(shutOff[id] ?? Infinity, at);
  }

  const out = {};
  for (const s of SYSTEMS) {
    const fixed = (state) => ({ state, at: null, now: false, fixed: true });
    const said = (state, at) => ({ state, at, now: at >= secs, fixed: false });
    const y = yes[s.id] ?? -Infinity;
    const n = Math.max(no[s.id] ?? -Infinity, shutOff[s.id] ?? -Infinity);
    if (live && s.id === lanes.system) out[s.id] = said(live.ok ? "in" : "out", secs);
    else if (!s.relay) out[s.id] = fixed("out");
    else if (y === Infinity) out[s.id] = fixed("in");
    else if (y === -Infinity && n === -Infinity) out[s.id] = { state: "unknown", at: null, now: false, fixed: false };
    else if (y > n) out[s.id] = said("in", y);
    else if (n > y) out[s.id] = said("out", n);
    else out[s.id] = { state: "unknown", at: null, now: false, fixed: false };
  }
  return out;
}

/** A star's contact in the key's words: "in contact · now", "cut off · seen 3h 0m ago", "not known". */
export function contactWords(c, t) {
  if (c.state === "unknown") return "not known";
  const state = c.state === "in" ? "in contact" : "cut off";
  if (c.fixed) return `${state} · always`;
  return c.now ? `${state} · now` : `${state} · seen ${agoText(t - c.at * 1000)} ago`;
}

/** The radius of the Shallows ring in the layout's units. */
export const R = 100;

/**
 * Where each star is drawn, in units about the centre, y down: the Shallows round a ring of radius R
 * from Petroc at the top, clockwise in ring order and evenly spaced; the Mid inside it, its deep stars
 * (Dozmary and Garrow) nearest the centre; and when there's a Core, it in the middle and the Mid a band
 * round it. Nothing here is where the stars are: the bands and the ring's order are all it shows.
 * Returns the stars' points ({x, y, a}, a the angle out from the centre) and each inner band's disc.
 */
export function layout(systems = SYSTEMS) {
  const P = {};
  const round = (list, r, from) =>
    list.forEach((s, i) => {
      const a = from + (i * 2 * Math.PI) / list.length;
      P[s.id] = { x: r * Math.cos(a), y: r * Math.sin(a), a };
    });
  const ring = systems.filter((s) => s.band === "shallows");
  const mid = systems.filter((s) => s.band === "mid");
  const core = systems.filter((s) => s.band === "core");
  round(ring, R, -Math.PI / 2);
  const c = core.length > 0;
  round(mid.filter((s) => !s.deep), R * (c ? 0.55 : 0.5), -Math.PI / 2);
  round(mid.filter((s) => s.deep), R * (c ? 0.41 : 0.15), Math.PI);
  round(core, R * 0.15, -Math.PI / 4);
  const discs = [];
  if (mid.length) discs.push({ band: "mid", r: R * (c ? 0.72 : 0.68) });
  if (c) discs.push({ band: "core", r: R * 0.28 });
  return { P, discs };
}

/**
 * A lane's path as a function of k, 0 at `between[0]` to 1 at `between[1]`, in layout units: a trunk
 * along the ring the short way; a lane between two Mid stars round the Mid's band when there's a Core
 * inside it; any other a curve bowed toward the centre, so a branch between neighbours isn't on the ring.
 */
export function lanePath(l, { P, discs }, bands = Object.fromEntries(SYSTEMS.map((s) => [s.id, s.band]))) {
  const [a, b] = l.between.map((id) => P[id]);
  const aroundCore = discs.some((d) => d.band === "core") && l.between.every((id) => bands[id] === "mid");
  if (l.class === "trunk" || aroundCore) {
    const ra = Math.hypot(a.x, a.y);
    const rb = Math.hypot(b.x, b.y);
    const a0 = Math.atan2(a.y, a.x);
    let d = Math.atan2(b.y, b.x) - a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d <= -Math.PI) d += 2 * Math.PI;
    if (Math.abs(Math.abs(d) - Math.PI) < 1e-9) d = a.x < b.x ? Math.PI : -Math.PI; // straight across: over the top
    return (k) => {
      const t = a0 + d * k;
      const r = ra + (rb - ra) * k;
      return { x: r * Math.cos(t), y: r * Math.sin(t) };
    };
  }
  const c = { x: ((a.x + b.x) / 2) * 0.65, y: ((a.y + b.y) / 2) * 0.65 };
  return (k) => {
    const u = 1 - k;
    return { x: u * u * a.x + 2 * u * k * c.x + k * k * b.x, y: u * u * a.y + 2 * u * k * c.y + k * k * b.y };
  };
}
