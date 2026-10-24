// Preview driver: replays a walk round T.I.S.S. (into a bunk and a workshop on the way), then flights to Orrin Station, Wenna Halt and the
// thirteen halts on decks (Morvah Deep, Gwithian Reach, Carrow Yard, Lanyon High, the ring's Kynance
// Spindle, Marazion Quay, Penwith Vats, Botallack Head, Polperro Old Dock and Lamorna Light, and the
// Mid's Kilmar Steading, Caradon Works and Garrow Stop) and a walk round each, a stop at a made-up
// Pendeen Halt, which has no plan, then down to Zennor on Tamsin and a walk round the town, through the fake panel, using the same `location` and `scene` message shapes the Lua side posts
// (src/station_map/location.lua, src/station_map/scene.lua).
//
//   ?step=N   open on route step N, as a panel re-mounting mid-walk would (only step N is replayed)
//   ?walk     start the walk on load; ?until=N stops it after step N
//   ?repeat   with ?step: after it settles, re-send step N twice and report what changed
//   ?debug    count model turns / redraws and deck highlights / re-centres, shown bottom-right
//   ?still    send settings { turn_model: false }
//   ?scene=S  open on overview scene S (station, parked, travelling, belt, or port-day / port-night over
//             Zennor, which also emits charts placing it so); the bar's menu switches it
//   ?hull=H   aboard a ship, send hull H (skiff, courier or freighter) as the server will; the bar's menu switches it
//   ?chart=C  open the system chart on scenario C (parked-gannet, under-way-orrin, searching-cinders, at-point,
//             docked-tiss, landed-zennor, none, maelor, maelor-lanes, edge, to-mouth, adrift or from-stop), emitting charts, chart-ship and
//             chart { on: true }; the bar's menu switches it
//   ?lanes=L  open the core lanes map on scenario L (senara, in-trunk, in-branch or petroc), emitting lanes and
//             lanes-view { on: true }; the bar's menu switches it
//   ?belt=B   open the belt map on scenario B (arriving, rcs-rim, sweeps or skiff), emitting belt messages as
//             src/station_map/belt.lua posts them, a tick a second while she moves, and belt-view { on: true };
//             the bar's menu switches it
//   ?work=W   at a belt, the ship's work W (scanning, assaying, mining or idle) as the work message has it
//             (src/station_map/work.lua): a scan or assay starts now and starts again a second after it
//             ends, as a program at par would; the bar's menu switches it
//   ?move=M   at a belt, her moving in it (rcs-out: the thrusters out from the core for 20 s; closing-cut: `mine`
//             on rock-12 closing for 6 s, then the beam; halted: `rcs in` stopped 7 s in) as the work message
//             has it, the place changing each second as Ship.Status does; it plays over and over; the bar's
//             menu switches it
//   ?manoeuvre=M  aboard the Magpie, undock from T.I.S.S. (undock-tiss, 10 s) or dock at Orrin Station
//             (dock-orrin, 20 s), with the manoeuvre and scene messages the Lua side posts, the scene
//             changing as the run ends; ?left=N opens it with N s left, as a panel opened mid-run;
//             ?stop=N stops it N s in, as `stop` or a fault does, so it eases back; the bar's menu switches it
//   ?action=A play what you're doing, as the Lua side posts Char.Action (climbing on T.I.S.S., repair aboard the skiff in
//             three stages, or dragging a crate on Orrin): it runs to its end, a move landing you in the next room;
//             the bar's menu switches it
//   ?sky=S    stand in Zennor's Square under sky S (night, dusk, dawn, low, overhead or tiss-overhead): the game's
//             own charts from dev/sky-cases.json, shifted so a recorded moment of that sky is now; the bar's menu switches it

import botallack from "../ui/data/botallack.js";
import caradon from "../ui/data/caradon.js";
import carrow from "../ui/data/carrow.js";
import garrow from "../ui/data/garrow.js";
import gwithian from "../ui/data/gwithian.js";
import kilmar from "../ui/data/kilmar.js";
import kynance from "../ui/data/kynance.js";
import lamorna from "../ui/data/lamorna.js";
import lanyon from "../ui/data/lanyon.js";
import marazion from "../ui/data/marazion.js";
import morvah from "../ui/data/morvah.js";
import orrin from "../ui/data/orrin.js";
import penwith from "../ui/data/penwith.js";
import polperro from "../ui/data/polperro.js";
import station from "../ui/data/station.js";
import wenna from "../ui/data/wenna.js";
import zennor from "../ui/data/zennor.js";
import skyCases from "./sky-cases.json" with { type: "json" };
import { DeckView } from "../ui/deck-view.js";
import { ModelView } from "../ui/model-view.js";
import { EDGE, MAELOR_SHIP, SHIPS, maelorCharts, senaraCharts } from "./charts-fixture.js";

const q = new URLSearchParams(location.search);
const debug = q.has("debug");
const town = zennor.rooms.map((r) => ({ ...r, gravity: zennor.area.gravity })); // the area's gravity, as the game sends it
const DATA = [
  station.rooms,
  orrin.rooms,
  wenna.rooms,
  ...[morvah, gwithian, carrow, lanyon, kynance, marazion, penwith, botallack, polperro, lamorna, kilmar, caradon, garrow].map((d) => d.rooms),
  town,
];
const byId = new Map(DATA.flat().map((r) => [r.id, r]));

// --- the route -------------------------------------------------------------------------------

const room = (id) => {
  const r = byId.get(id);
  return { label: r.name, msg: { roomId: id, name: r.name, area: id.split(".")[0], address: r.address ?? undefined, gravity: r.gravity } };
};

/** Board lift `hour` at fromId, ride to toId; messages as Empyreal.Room + Empyreal.Vehicle fold them. */
function ride(hour, fromId, toId) {
  const id = `tiss.lift-${hour}`;
  const name = `Lift ${hour}`;
  const gravity = byId.get(fromId).gravity;
  const heading = byId.get(toId).z > byId.get(fromId).z ? "hubward" : "rimward";
  const to = byId.get(toId).name;
  return [
    { label: `${name} at ${byId.get(fromId).name}`, msg: { name, gravity, lift: { id, at: fromId, doors: "open" } } },
    { label: `${name} riding to ${to}`, msg: { name, gravity, lift: { id, between: [fromId, toId], heading, doors: "closed" } } },
    { label: `${name} at ${to}`, msg: { name, gravity, lift: { id, at: toId, heading, doors: "open" } } },
  ];
}

/** Inside a leased workshop or bunk, as the game builds it: no address, its office room's gravity,
 *  and the door out to that room, which is all the map is told of where it is. */
function unit(id, name, doorId) {
  return { label: `${name} (off ${byId.get(doorId).name})`, msg: { roomId: id, name, area: "tiss", areaName: "T.I.S.S.", gravity: byId.get(doorId).gravity, door: doorId } };
}

// a ship's rooms are ship.<n>.<room>, in the ship's own area, as the game names them now
const COCKPIT = { roomId: "ship.41.cockpit", name: "Cockpit of the Magpie", area: "ship.41", areaName: "Magpie" };

/** A room aboard the Old Reliable, a medium freighter (ship.98 in the session log of 2026-10-22). */
function freighter(key, name) {
  return {
    label: `${name} (freighter)`,
    msg: {
      roomId: `ship.98.${key}`,
      name,
      area: "ship.98",
      areaName: "Old Reliable",
      hull: "freighter",
      hullName: "medium freighter",
      shipRoom: key,
    },
  };
}

/** Fly to a halt (`prefix`, its dock `place`), dock, and go round it once: by `walk`, its rooms'
 *  keys, or as Orrin's are laid out. */
function halt(prefix, name, place, walk = ORRIN_WALK) {
  const at = (key) => room(`${prefix}.${key}`);
  return [
    { label: `Flying to ${name}`, msg: COCKPIT, scene: { scene: "travelling" } },
    { label: `Docked at ${name}`, msg: COCKPIT, scene: { scene: "station", station: place } },
    ...walk.map(at),
  ];
}
const ORRIN_WALK = [
  ...["berth", "deck-3-frame-2", "freight", "deck-3-frame-2", "charts", "deck-3-frame-2", "deck-3-frame-1"],
  ...["concourse", "deck-2-frame-2", "market", "deck-2-frame-2", "gallery"],
];

const ROUTE = [
  room("tiss.rim-1100"), // Rim 11:00 -> Main Concourse: the wheel should turn one hour, not eleven
  room("tiss.concourse"),
  room("tiss.market"),
  room("tiss.concourse"),
  room("tiss.rim-0100"),
  room("tiss.residential"),
  room("tiss.laundry"),
  room("tiss.residential"),
  room("tiss.rim-0300"),
  room("tiss.bunkhouse"),
  unit("bunk.3", "Juniper's bunk", "tiss.bunkhouse"),
  room("tiss.bunkhouse"),
  room("tiss.rim-0300"),
  ...ride(3, "tiss.rim-0300", "tiss.mid-0300"),
  room("tiss.mid-0300"),
  room("tiss.gym"),
  room("tiss.mid-0300"),
  ...ride(3, "tiss.mid-0300", "tiss.inner-0300"),
  room("tiss.inner-0300"),
  room("tiss.fabricator"),
  room("tiss.inner-0300"),
  room("tiss.inner-0430"),
  room("tiss.workshops"),
  unit("unit.7", "Juniper's small workshop", "tiss.workshops"),
  room("tiss.workshops"),
  room("tiss.inner-0430"),
  room("tiss.inner-0300"),
  ...ride(3, "tiss.inner-0300", "tiss.hub"),
  room("tiss.hub"),
  room("tiss.bearing"),
  room("tiss.spine-1"),
  room("tiss.spine-2"),
  room("tiss.spine-3"),
  room("tiss.berth"),
  // on to the bays and back, to board the Magpie at the Berths
  room("tiss.bay-1"),
  room("tiss.bay-2"),
  room("tiss.bay-1"),
  room("tiss.berth"),
  { label: "Cockpit of the Magpie (no hull)", msg: COCKPIT },
  {
    label: "Cockpit of the Mule (skiff)",
    msg: { roomId: "ship.12.cockpit", name: "Cockpit of the Mule", area: "ship.12", areaName: "Mule", hull: "skiff", hullName: "prospecting skiff" },
  },
  {
    label: "Cockpit of the Fair Copy (courier)",
    msg: { roomId: "ship.72.cockpit", name: "Cockpit of the Fair Copy", area: "ship.72", areaName: "Fair Copy", hull: "courier", hullName: "courier" },
  },
  freighter("airlock", "Airlock"),
  freighter("passage", "Passage"),
  freighter("cockpit", "Cockpit of the Old Reliable"),
  freighter("passage", "Passage"),
  freighter("collar", "Docking Collar"),
  freighter("passage", "Passage"),
  freighter("hold", "Cargo Hold"),
  freighter("engine", "Engine Room"),
  freighter("hold", "Cargo Hold"),
  freighter("passage", "Passage"),
  freighter("airlock", "Airlock"),
  { label: "Cockpit of the Magpie", msg: COCKPIT },
  { label: "Flying to Orrin Station", msg: COCKPIT, scene: { scene: "travelling" } },
  { label: "Docked at Orrin Station", msg: COCKPIT, scene: { scene: "station", station: "orrin_station" } },
  room("orrin.berth"),
  room("orrin.deck-3-frame-2"),
  room("orrin.freight"),
  room("orrin.deck-3-frame-2"),
  room("orrin.charts"),
  room("orrin.deck-3-frame-2"),
  room("orrin.deck-3-frame-1"),
  room("orrin.concourse"),
  room("orrin.deck-2-frame-2"),
  room("orrin.market"),
  room("orrin.deck-2-frame-2"),
  room("orrin.gallery"),
  room("orrin.deck-2-frame-2"),
  room("orrin.concourse"),
  room("orrin.deck-3-frame-1"),
  room("orrin.deck-3-frame-2"),
  room("orrin.berth"),
  { label: "Flying to Wenna Halt", msg: COCKPIT, scene: { scene: "travelling" } },
  { label: "Docked at Wenna Halt", msg: COCKPIT, scene: { scene: "station", station: "wenna_halt" } },
  room("wenna.berth"),
  room("wenna.concourse"),
  room("wenna.market"),
  room("wenna.concourse"),
  room("wenna.freight"),
  room("wenna.concourse"),
  room("wenna.charts"),
  room("wenna.concourse"),
  room("wenna.lounge"),
  room("wenna.concourse"),
  room("wenna.berth"),
  ...halt("morvah", "Morvah Deep", "morvah_deep"),
  ...halt("gwithian", "Gwithian Reach", "gwithian_reach"),
  ...halt("carrow", "Carrow Yard", "carrow_yard"),
  ...halt("lanyon", "Lanyon High", "lanyon_high"),
  ...halt("kynance", "Kynance Spindle", "kynance_spindle"),
  ...halt("marazion", "Marazion Quay", "marazion_quay"),
  ...halt("penwith", "Penwith Vats", "penwith_vats"),
  ...halt("botallack", "Botallack Head", "botallack_head"),
  ...halt("polperro", "Polperro Old Dock", "polperro_old_dock"),
  ...halt("lamorna", "Lamorna Light", "lamorna_light"),
  ...halt("kilmar", "Kilmar Steading", "kilmar_steading", ["berth", "deck-2-frame-2", "market", "deck-2-frame-2", "kitchen", "deck-2-frame-2", "commons", "gallery"]),
  ...halt("caradon", "Caradon Works", "caradon_works", ["berth", "deck-3-frame-1", "market", "deck-3-frame-1", "canteen", "deck-3-frame-1", "hall", "gallery"]),
  ...halt("garrow", "Garrow Stop", "garrow_stop", ["berth", "deck-2-frame-1", "market", "deck-2-frame-1", "snug", "deck-2-frame-1", "commons", "lookout"]),
  // a halt there's no plan of (made up, as the game has none now): nothing shows, not Garrow Stop's
  { label: "Flying to Pendeen Halt", msg: COCKPIT, scene: { scene: "travelling" } },
  { label: "Docked at Pendeen Halt (no plan)", msg: COCKPIT, scene: { scene: "station", station: "pendeen_halt" } },
  { label: "Berths (no plan)", msg: { roomId: "pendeen.berth", name: "Berths", area: "pendeen", areaName: "Pendeen Halt", address: "Deck 2, frame 3", gravity: 0 } },
  { label: "Flying to Zennor", msg: COCKPIT, scene: { scene: "travelling" } },
  { label: "Landed at Zennor", msg: COCKPIT, scene: { scene: "station", station: "zennor" } },
  room("zennor.field"),
  room("zennor.field-office"),
  room("zennor.field"),
  room("zennor.tower"),
  room("zennor.field"),
  room("zennor.gate"),
  room("zennor.fore-top"),
  room("zennor.ridge-path"),
  room("zennor.overlook"),
  room("zennor.ridge-path"),
  room("zennor.fore-top"),
  room("zennor.square"),
  room("zennor.exchange"),
  room("zennor.square"),
  room("zennor.inn"),
  room("zennor.square"),
  room("zennor.fore-foot"),
  room("zennor.water-house"),
  room("zennor.fore-foot"),
  room("zennor.terraces"),
  room("zennor.lower-terraces"),
];
window.ROUTE = ROUTE;

// --- debug counters (wrap the views' prototypes; main.js builds the views after this runs) ----

const counts = { turns: 0, modelDraws: 0, deckHighlights: 0, deckViews: 0 };
const lines = [];
const out = document.getElementById("debug");
function log(s) {
  if (!debug) return;
  lines.push(s);
  console.log(`[preview] ${s}`);
  out.textContent = lines.slice(-14).join("\n");
}
window.previewCounts = counts;

if (debug) {
  const wrap = (proto, name, fn) => {
    const orig = proto[name];
    proto[name] = function (...args) {
      fn.call(this, ...args);
      return orig.apply(this, args);
    };
  };
  wrap(ModelView.prototype, "animateTo", function (target) {
    counts.turns++;
    log(`turn #${counts.turns}: ${(target - this.phi).toFixed(2)} h`);
  });
  wrap(ModelView.prototype, "draw", () => counts.modelDraws++);
  wrap(DeckView.prototype, "drawHighlight", () => counts.deckHighlights++);
  wrap(DeckView.prototype, "setView", () => counts.deckViews++);
}

// --- driving the panel -----------------------------------------------------------------------

const status = document.getElementById("status");
const fp = window.fakePanel;

const hullMenu = document.getElementById("hull");
const HULL_NAMES = { skiff: "prospecting skiff", courier: "courier", freighter: "medium freighter" };
let lastMsg = null;

/** A ship room's message with the hull menu's choice on it ("(none)" leaves the step's own hull). */
function withHull(msg, always = false) {
  if (!msg?.roomId?.startsWith("ship.")) return msg;
  const h = hullMenu.value;
  if (!HULL_NAMES[h] && !always) return msg;
  const m = { ...msg };
  if (HULL_NAMES[h]) {
    m.hull = h;
    m.hullName = HULL_NAMES[h];
  } else {
    delete m.hull;
    delete m.hullName;
  }
  return m;
}

function emitLocation(msg) {
  lastMsg = msg;
  fp.emit("location", structuredClone(withHull(msg)));
}

function show(i) {
  const s = ROUTE[i];
  status.textContent = `${i} · ${s.label}`;
  log(`step ${i}: ${s.label}`);
  if (s.scene) fp.emit("scene", s.scene);
  emitLocation(s.msg);
}

let timer = 0;
function walk(from = 0, until = ROUTE.length - 1) {
  clearInterval(timer);
  let i = from;
  const tick = () => {
    show(i);
    if (++i > until) clearInterval(timer);
  };
  tick();
  timer = setInterval(tick, 1300);
}
document.getElementById("walk").addEventListener("click", () => walk());

const sceneMenu = document.getElementById("scene");
function emitScene(name) {
  const side = /^port-(day|night)$/.exec(name)?.[1];
  if (!side) return fp.emit("scene", { scene: name });
  fp.emit("charts", senaraCharts(Date.now(), null, side));
  fp.emit("scene", { scene: "port", port: "zennor" });
}
sceneMenu.addEventListener("change", () => emitScene(sceneMenu.value));

// --- docking and undocking: the manoeuvre message (src/station_map/manoeuvre.lua) and the scene change at its end ---

const MANOEUVRES = {
  "undock-tiss": { verb: "undock", total: 10, at: "tiss", before: { scene: "station", station: "tiss" }, after: { scene: "parked" } },
  "dock-orrin": { verb: "dock", total: 20, at: "orrin_station", before: { scene: "parked" }, after: { scene: "station", station: "orrin_station" } },
};
const manoeuvreMenu = document.getElementById("manoeuvre");
let manoeuvreTimers = [];

function emitManoeuvre(name) {
  manoeuvreTimers.forEach(clearTimeout);
  manoeuvreTimers = [];
  const m = MANOEUVRES[name];
  if (!m) return fp.emit("manoeuvre", { verb: null });
  const left = q.has("left") ? Math.max(0, Math.min(m.total, Number(q.get("left")) || 0)) : m.total;
  const stop = q.has("stop") ? Number(q.get("stop")) : null;
  emitLocation(COCKPIT);
  fp.emit("scene", m.before);
  fp.emit("manoeuvre", { verb: m.verb, left, total: m.total, at: m.at });
  status.textContent = `${name} · ${left} s left${stop !== null ? ` · stops ${stop} s in` : ""}`;
  const later = (s, fn) => manoeuvreTimers.push(setTimeout(fn, s * 1000));
  if (stop !== null && stop < left) {
    later(stop, () => {
      fp.emit("manoeuvre", { verb: null });
      status.textContent = `${name} · stopped`;
    });
    return;
  }
  later(left, () => {
    fp.emit("scene", m.after); // Ship.Status comes first, then Ship.Devices (gmcp.ts sendShipGmcp)
    fp.emit("manoeuvre", { verb: null });
    status.textContent = `${name} · done`;
  });
}
manoeuvreMenu.addEventListener("change", () => emitManoeuvre(manoeuvreMenu.value));

hullMenu.addEventListener("change", () => {
  if (lastMsg?.roomId?.startsWith("ship.")) fp.emit("location", structuredClone(withHull(lastMsg, true)));
});

// --- the system chart: Space.Charts and the ship's chart state, as the Lua side posts them ----

const chartMenu = document.getElementById("chart");

function emitChart(name) {
  if (!name) {
    fp.emit("chart", { on: false });
    return;
  }
  const now = Date.now();
  const stamp = (m) => {
    if (!m) return null;
    const received = Math.floor(now / 1000);
    // the Lua side keeps the trip's depart from its first status
    const depart = m.destination && m.progress < 1 ? received - Math.round((m.progress * m.eta) / (1 - m.progress)) : undefined;
    return { ...m, received, ...(depart !== undefined ? { depart } : {}) };
  };
  // bound for the Maelor lane mouth from T.I.S.S.; stopped two thirds of the way; and off again
  const s = Math.floor(now / 1000);
  const stop = { from: "tiss", destination: "mouth:senara:maelor", depart: s - 540, arrive: s + 270, at: s - 30 };
  const MOUTH_TRIPS = {
    "to-mouth": { name: "Mule", docked: false, from: "tiss", destination: "mouth:senara:maelor", progress: 0.4, eta: 480 },
    adrift: { name: "Mule", docked: false, stop, received: s },
    "from-stop": { name: "Mule", docked: false, stop, destination: "mouth:senara:maelor", progress: 0.2, eta: 210, depart: s - 50, received: s },
  };
  if (name === "maelor" || name === "maelor-lanes") {
    fp.emit("charts", maelorCharts(now, null, name === "maelor-lanes"));
    fp.emit("chart-ship", stamp(MAELOR_SHIP));
  } else if (MOUTH_TRIPS[name]) {
    fp.emit("charts", senaraCharts(now, EDGE(now)));
    fp.emit("chart-ship", name === "to-mouth" ? stamp(MOUTH_TRIPS[name]) : MOUTH_TRIPS[name]);
  } else {
    fp.emit("charts", senaraCharts(now, name === "edge" ? EDGE(now) : null));
    fp.emit("chart-ship", stamp(name === "edge" ? SHIPS["parked-gannet"] : SHIPS[name]));
  }
  fp.emit("chart", { on: true });
}
chartMenu.addEventListener("change", () => emitChart(chartMenu.value));

// --- the core lanes map: what the Lua side's lanes reducer posts ----------------------------

const lanesMenu = document.getElementById("lanes");

function emitLanes(name) {
  if (!name) {
    fp.emit("lanes-view", { on: false });
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  const SCENARIOS = {
    // docked at T.I.S.S.: the Petroc branch seen open two hours ago, the Keyne branch never
    senara: { system: "senara", visible: ["keyne-senara", "maelor-senara"],
      seen: { "maelor-petroc": { open: true, at: now - 7800 }, "keyne-senara": { open: true, at: now }, "maelor-senara": { open: true, at: now } } },
    // in the Senara–Maelor trunk, 40% through: the charts are Maelor's already
    "in-trunk": { system: "maelor", visible: ["elowen-maelor", "maelor-petroc", "maelor-senara"],
      seen: { "maelor-petroc": { open: false, at: now - 3 * 86400 }, "keyne-mabyn": { open: true, at: now - 1200 } },
      transit: { lane: "maelor-senara", from: "senara", to: "maelor", progress: 0.4, eta: 220, received: now } },
    // in the Keyne branch, out to Mabyn
    "in-branch": { system: "mabyn", visible: ["elowen-mabyn", "keyne-mabyn"],
      seen: { "keyne-mabyn": { open: true, at: now }, "maelor-petroc": { open: true, at: now - 5 * 3600 } },
      transit: { lane: "keyne-mabyn", from: "keyne", to: "mabyn", progress: 0.3, eta: 300, received: now } },
    // at Morvah Deep, the Maelor branch closed now
    petroc: { system: "petroc", visible: ["keyne-petroc", "maelor-petroc"],
      seen: { "maelor-petroc": { open: false, at: now } } },
  };
  fp.emit("lanes", SCENARIOS[name] ?? SCENARIOS.senara);
  fp.emit("lanes-view", { on: true });
}
lanesMenu.addEventListener("change", () => emitLanes(lanesMenu.value));

// --- the belt map: what the Lua side's belt reducer posts (src/station_map/belt.lua) ---------------

const beltMenu = document.getElementById("belt");
let beltTimer = 0;

/** A belt message, its place worked out as gmcp.ts beltGmcp does. */
function beltMsg(id, name, radius, x, y, log, extra = {}) {
  const tenth = (n) => Math.round(n * 10) / 10;
  const place = x === null ? null : {
    x: tenth(x), y: tenth(y), km: tenth(Math.hypot(x, y)),
    bearing: (Math.round((Math.atan2(x, y) * 180) / Math.PI) + 360) % 360,
  };
  return { id, name, radius, place, host: null, array: false, log: { track: [], sweeps: [], ...log }, ...extra };
}

/** km along a bearing from (x, y). */
const along = (x, y, bearing, km) => {
  const a = (bearing * Math.PI) / 180;
  return [x + Math.sin(a) * km, y + Math.cos(a) * km];
};

function emitBelt(name) {
  clearInterval(beltTimer);
  if (!name) {
    fp.emit("belt-view", { on: false });
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  sceneMenu.value = "belt";
  emitScene("belt");
  if (name === "arriving") {
    // just in at Gannet, mid-belt: one place, nothing logged yet
    fp.emit("belt", beltMsg("gannet-3", "Gannet Belt", 18, 6.1, -3.4, { track: [[[6.1, -3.4]]] }));
  } else if (name === "rcs-rim") {
    // `rcs out` from 7 km out in the Cinders, a tick a second at full drive, to the outer edge
    const start = [4.5, 5.4];
    const out = (Math.atan2(start[0], start[1]) * 180) / Math.PI;
    const track = [[[2, 1], start]];
    const sweeps = [{ x: start[0], y: start[1], r: 5 }];
    let km = 0;
    const tick = () => {
      const [x, y] = along(...start, out, km);
      const rim = Math.hypot(x, y) >= 16;
      const p = rim ? along(0, 0, out, 16) : [x, y];
      const pt = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
      track[0] = [...track[0].slice(0, 2), pt];
      fp.emit("belt", beltMsg("cinders-2", "The Cinders", 16, p[0], p[1], { track: track.map((s) => [...s]), sweeps }));
      km += 0.25;
      if (rim) clearInterval(beltTimer);
    };
    tick();
    beltTimer = setInterval(tick, 1000);
  } else if (name === "sweeps") {
    // three sweeps across Gannet, the last after closing on a rock, then out to 11 km at 210°
    fp.emit("belt", beltMsg("gannet-3", "Gannet Belt", 18, -5.5, -9.5, {
      track: [[[7.2, 5.1], [9.7, 0.8], [6.0, -4.0], [-5.5, -9.5]]],
      sweeps: [{ x: 7.2, y: 5.1, r: 5 }, { x: 9.7, y: 0.8, r: 5 }, { x: 6.0, y: -4.0, r: 5 }],
    }));
  } else if (name === "skiff") {
    // a skiff with a sensor array, away from her freighter in the Anvil: no range to draw
    fp.emit("belt", beltMsg("anvil-1", "The Anvil", 19, -8.2, 3.9, {
      track: [[[7.2, 5.1], [2.4, 9.3], [-3.1, 8.0], [-8.2, 3.9]]],
      sweeps: [{ x: 2.4, y: 9.3 }, { x: -3.1, y: 8.0 }],
      left: { x: 7.2, y: 5.1, name: "Full Measure", at: now - 14 * 60 },
    }, { array: true }));
  }
  fp.emit("belt-view", { on: true });
}
beltMenu.addEventListener("change", () => emitBelt(beltMenu.value));

// --- what you're doing: the action messages src/station_map/action.lua posts, played to their end -------

const actionMenu = document.getElementById("action");
const ACTIONS = {
  // up the ladder at Mid 3:00 to the Inner Ring, a move
  "climbing-tiss": {
    at: room("tiss.mid-0300").msg, scene: { scene: "station", station: "tiss" },
    verb: "move", label: "climbing", stages: [10], lands: room("tiss.inner-0300").msg,
  },
  // the mining laser aboard the Mule: finding the fault, fitting the parts (twice as long) and testing it, with a scan typed ahead
  "repair-skiff": {
    at: { roomId: "ship.12.cockpit", name: "Cockpit of the Mule", area: "ship.12", areaName: "Mule", hull: "skiff", hullName: "prospecting skiff" },
    scene: { scene: "station", station: "tiss" },
    verb: "repair", label: "repairing the mining laser", stages: [8, 16, 8], queued: 1,
  },
  // the crated stove from Orrin's Freight Office out to the deck, a move
  "drag-orrin": {
    at: room("orrin.freight").msg, scene: { scene: "station", station: "orrin_station" },
    verb: "move", label: "dragging the crated stove", stages: [20], lands: room("orrin.deck-3-frame-2").msg,
  },
};
let actionTimers = [];

function emitAction(name) {
  actionTimers.forEach(clearTimeout);
  actionTimers = [];
  const a = ACTIONS[name];
  if (!a) {
    fp.emit("action", {});
    return;
  }
  fp.emit("scene", a.scene);
  emitLocation(a.at);
  status.textContent = `${a.label} (${name})`;
  const total = a.stages.reduce((x, y) => x + y, 0);
  const start = Math.floor(Date.now() / 1000);
  const ends = start + total;
  let t = 0;
  a.stages.forEach((secs, i) => {
    const msg = { action: { verb: a.verb, label: a.label, stage: i + 1, stages: a.stages.length, ends, total, queued: a.queued ?? 0 } };
    actionTimers.push(setTimeout(() => fp.emit("action", msg), t * 1000));
    t += secs;
  });
  actionTimers.push(
    setTimeout(() => {
      if (a.lands) emitLocation(a.lands);
      fp.emit("action", {});
    }, total * 1000),
  );
}
actionMenu.addEventListener("change", () => emitAction(actionMenu.value));

// --- Zennor's sky: the game's recorded charts, shifted so a moment of the named sky is now ---------

const skyMenu = document.getElementById("sky");
const SKY_WORDS = {
  night: (t) => t.startsWith("Night:") && t.includes("Orrin") && t.includes("T.I.S.S."),
  dusk: (t) => t.startsWith("Dusk:"),
  dawn: (t) => t.startsWith("The sky is paling"),
  low: (t) => t.includes(" is low in "),
  overhead: (t) => t.includes("stands high overhead"),
  "tiss-overhead": (t) => t.includes("passing overhead, a bright"),
};

/** A tick half a minute into a stretch of that sky lasting five minutes or more. */
function skyTick(name) {
  const cs = skyCases.cases;
  const i = cs.findIndex((c, k) => SKY_WORDS[name](c.text) && cs[k + 1] && cs[k + 1].tick - c.tick >= 300);
  return i < 0 ? null : cs[i].tick + 30;
}

function emitSky(name) {
  const tick = name ? skyTick(name) : null;
  if (tick === null) return;
  log(`sky: ${name} at tick ${tick}`);
  fp.emit("charts", { ...skyCases.charts, epoch: Date.now() - tick * 1000 });
  fp.emit("scene", { scene: "station", station: "zennor" });
  show(ROUTE.findIndex((s) => s.msg?.roomId === "zennor.square"));
}
skyMenu.addEventListener("change", () => emitSky(skyMenu.value));

// --- the ship's work at a belt: the work message, local times in seconds --------------------

const workMenu = document.getElementById("work");
const WORK = {
  idle: () => ({}),
  scanning: (now) => ({ sensors: { busy: "scan", since: now, ends: now + 10 } }),
  assaying: (now) => ({ sensors: { busy: "assay", since: now, ends: now + 20 } }),
  mining: (now) => ({ laser: { busy: "mine", since: now } }),
};
let workTimer = 0;

function emitWork(name) {
  clearTimeout(workTimer);
  const make = WORK[name];
  if (!make) return;
  sceneMenu.value = "belt";
  emitScene("belt");
  const m = make(Math.floor(Date.now() / 1000));
  fp.emit("work", m);
  const ends = m.sensors?.ends;
  if (ends === undefined) return;
  workTimer = setTimeout(() => {
    fp.emit("work", {}); // done: the game sends the sensors idle
    workTimer = setTimeout(() => emitWork(name), 1000);
  }, ends * 1000 - Date.now());
}
workMenu.addEventListener("change", () => emitWork(workMenu.value));

// --- her moving in a belt: the work message, the place changing each second ----------------------

const moveMenu = document.getElementById("move");
// Each a timeline of seconds from its start, the work message at that second (null: as it was),
// and when it plays again.
const MOVE = {
  "rcs-out": { again: 24, at: (t, t0) => (t <= 20 ? { nav: { busy: "rcs", since: t0, ends: t0 + 20 }, belt: t ? { moved: t0 + t, way: 0 } : {} } : t === 21 ? { belt: { moved: t0 + 20, way: 0 } } : null) },
  "closing-cut": {
    again: 18,
    at: (t, t0) => (t <= 6 ? { laser: { busy: "mine", since: t0 }, belt: { ...(t ? { moved: t0 + t, way: 70 } : {}), target: "rock-12" } } : null),
  },
  halted: { again: 12, at: (t, t0) => (t < 7 ? { nav: { busy: "rcs", since: t0, ends: t0 + 20 }, belt: t ? { moved: t0 + t, way: 180 } : {} } : t === 7 ? { belt: { moved: t0 + 6, way: 180 } } : null) },
};
let moveTimer = 0;

function emitMove(name) {
  clearTimeout(moveTimer);
  const m = MOVE[name];
  if (!m) return;
  sceneMenu.value = "belt";
  emitScene("belt");
  const t0 = Math.floor(Date.now() / 1000);
  const tick = (t) => {
    if (t >= m.again) return emitMove(name);
    const msg = m.at(t, t0);
    if (msg) fp.emit("work", msg);
    moveTimer = setTimeout(() => tick(t + 1), (t0 + t + 1) * 1000 - Date.now());
  };
  tick(0);
}
moveMenu.addEventListener("change", () => emitMove(moveMenu.value));

function start() {
  fp.emit("settings", { turn_model: !q.has("still") });
  if (q.has("scene")) {
    sceneMenu.value = q.get("scene");
    emitScene(q.get("scene"));
  }
  if (q.has("hull")) hullMenu.value = q.get("hull");
  if (q.has("chart")) {
    chartMenu.value = q.get("chart");
    emitChart(chartMenu.value);
  }
  if (q.has("lanes")) {
    lanesMenu.value = q.get("lanes");
    emitLanes(lanesMenu.value);
  }
  if (q.has("belt")) {
    beltMenu.value = q.get("belt");
    emitBelt(beltMenu.value);
  }
  if (q.has("work")) {
    workMenu.value = q.get("work");
    emitWork(workMenu.value);
  }
  if (q.has("move")) {
    moveMenu.value = q.get("move");
    emitMove(moveMenu.value);
  }
  if (q.has("manoeuvre")) {
    manoeuvreMenu.value = q.get("manoeuvre");
    emitManoeuvre(manoeuvreMenu.value);
  }
  if (q.has("action")) {
    actionMenu.value = q.get("action");
    emitAction(actionMenu.value);
    return;
  }
  if (q.has("sky")) {
    skyMenu.value = q.get("sky");
    emitSky(skyMenu.value);
    return;
  }
  const n = q.has("step") ? Math.max(0, Math.min(ROUTE.length - 1, Number(q.get("step")) || 0)) : null;
  if (q.has("walk")) {
    const until = q.has("until") ? Number(q.get("until")) : ROUTE.length - 1;
    walk(n ?? 0, Math.min(until, ROUTE.length - 1));
    return;
  }
  if (n === null) {
    show(1); // Main Concourse
    return;
  }
  show(n);
  if (q.has("repeat")) {
    setTimeout(() => {
      const before = { ...counts };
      log(`re-sending step ${n} twice`);
      emitLocation(ROUTE[n].msg);
      emitLocation(ROUTE[n].msg);
      setTimeout(() => {
        const d = Object.keys(counts).map((k) => `${k} +${counts[k] - before[k]}`).join(", ");
        log(`repeat: ${d}`);
      }, 800);
    }, 2500);
  }
}

let started = false;
fp.onPost((name) => {
  if (name === "ready" && !started) {
    started = true;
    start();
  }
});
