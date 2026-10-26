// Preview driver: replays a walk round T.I.S.S. (into a bunk and a workshop on the way), then flights to Orrin Station, Wenna Halt and the
// thirteen halts on decks (Morvah Deep, Gwithian Reach, Carrow Yard, Lanyon High, the ring's Kynance
// Spindle, Marazion Quay, Penwith Vats, Botallack Head, Polperro Old Dock and Lamorna Light, and the
// Mid's Kilmar Steading, Caradon Works and Garrow Stop) and a walk round each, a stop at a made-up
// Pendeen Halt, which has no plan, then down to Zennor on Tamsin and a walk round the city (dev/zennor-walk.js), through the fake panel, using the same `location` and `scene` message shapes the Lua side posts
// (src/station_map/location.lua, src/station_map/scene.lua).
//
//   ?step=N   open on route step N, as a panel re-mounting mid-walk would (only step N is replayed)
//   ?walk     start the walk on load; ?until=N stops it after step N
//   ?repeat   with ?step: after it settles, re-send step N twice and report what changed
//   ?debug    count model turns / redraws and deck highlights / re-centres, shown bottom-right
//   ?still    send settings { turn_model: false }
//   ?scene=S  open on overview scene S (station, parked, travelling, belt, port-day / port-night over
//             Zennor, which also emits charts placing it so, or orbit-day / orbit-night / orbit-unknown in high
//             orbit over Tamsin, which also emits charts and chart-ship putting her on that side, or on no
//             side known); the bar's menu switches it
//   ?hull=H   aboard a ship, send hull H (skiff, courier or freighter) as the server will; the bar's menu switches it
//   ?chart=C  open the system chart on scenario C (parked-gannet, under-way-orrin, searching-cinders, at-point,
//             docked-tiss, landed-zennor, none, maelor, maelor-lanes, edge, to-mouth, adrift, from-stop, to-tamsin,
//             high-orbit or high-orbit-unknown; sweep: Space.Contacts at Gannet Belt, chase: after contact-1 from it),
//             emitting charts, chart-ship, chart-contacts and chart { on: true }; the bar's menu switches it. &unfold
//             opens the sweep's card unfolded
//   ?course=K open the system chart with a plotted course (cinders-tiss, ragged-orrin, contact, from-orbit or
//             under-way, where the trip line has taken over), emitting course too; the bar's menu
//             switches it
//   ?lanes=L  open the lanes map on scenario L (senara, in-trunk, in-mid, dozmary, petroc, new or partly), emitting lanes and
//             lanes-view { on: true }; the bar's menu switches it. &zoom=F opens it zoomed by F, &unfold with
//             its key's card unfolded
//   ?belt=B   open the belt map on scenario B (arriving, rcs-rim, sweeps, skiff, freighter-seen, docked-pair, compass or worked),
//             emitting belt messages (and chart-contacts, for the last two) as
//             src/station_map/belt.lua posts them, a tick a second while she moves, and belt-view { on: true };
//             the bar's menu switches it. &zoom=F opens it zoomed by F about her, as + does
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
import tissData from "../ui/data/tiss.js";
import wenna from "../ui/data/wenna.js";
import zennorFile from "../ui/data/zennor.js";
import { TRAM, ZENNOR_WALK } from "./zennor-walk.js";
import skyCases from "./sky-cases.json" with { type: "json" };
import { DeckView } from "../ui/deck-view.js";
import { BeltView } from "../ui/belt-view.js";
import { LanesView } from "../ui/lanes-view.js";
import { ModelView } from "../ui/model-view.js";
import { lanesOf } from "../ui/lib/lanes.js";
import { tissRooms, townData } from "../ui/lib/look.js";
import { ChartView } from "../ui/chart-view.js";
import { indexCharts, positionOf } from "../ui/lib/orbits.js";
import { EDGE, MAELOR_SHIP, SHIPS, maelorCharts, senaraCharts, senaraContacts } from "./charts-fixture.js";

const q = new URLSearchParams(location.search);
const debug = q.has("debug");
const station = tissRooms(tissData); // the wheel's rooms, placed
const zennor = townData(zennorFile); // its rooms on foot, and the tram as a car
// the area's gravity and name, as the game sends them
const town = zennor.rooms.map((r) => ({ ...r, gravity: zennor.area.gravity, areaName: zennor.area.name }));
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
  return { label: r.name, msg: { roomId: id, name: r.name, area: id.split(".")[0], areaName: r.areaName, address: r.address ?? undefined, district: r.district ?? undefined, gravity: r.gravity } };
};

/** Board lift `hour` at fromId, ride to toId; messages as Empyreal.Room + Empyreal.Vehicle fold them,
 *  its shaft's floors rim to hub as the car's Empyreal.Room has them. */
function ride(hour, fromId, toId) {
  const id = `tiss.lift-${hour}`;
  const name = `Lift ${hour}`;
  const gravity = byId.get(fromId).gravity;
  const heading = byId.get(toId).z > byId.get(fromId).z ? "hubward" : "rimward";
  const to = byId.get(toId).name;
  const x = (hour % 12) * 2;
  const floors = [
    ...[0, 1, 2].map((z) => station.rooms.find((r) => r.terrain === "lobby" && r.z === z && r.x === x)).filter(Boolean),
    byId.get("tiss.hub"),
  ].map((r) => ({ id: r.id, name: r.name }));
  const car = { id, kind: "lift", floors };
  return [
    { label: `${name} at ${byId.get(fromId).name}`, msg: { name, gravity, lift: { ...car, at: fromId, doors: "open" } } },
    { label: `${name} riding to ${to}`, msg: { name, gravity, lift: { ...car, between: [fromId, toId], heading, doors: "closed" } } },
    { label: `${name} at ${to}`, msg: { name, gravity, lift: { ...car, at: toId, heading, doors: "open" } } },
  ];
}

/** Ride Zennor's tram from stop `from` to stop `to`, as the car's Empyreal.Room and Empyreal.Vehicle
 *  fold them: no name (the car has no address), its stops bottom to top, passing those between. */
function tramRide(from, to) {
  const car = zennor.cars.find((c) => c.id === TRAM);
  const floors = car.stops.map((id) => ({ id }));
  const [a, b] = [car.stops.indexOf(from), car.stops.indexOf(to)];
  const dir = Math.sign(b - a);
  const heading = dir > 0 ? "uphill" : "downhill";
  const msg = (lift) => ({ gravity: zennor.area.gravity, lift: { id: TRAM, kind: "tram", floors, ...lift } });
  const steps = [{ label: `The Tram at ${byId.get(from).name}`, msg: msg({ at: from, doors: "open" }) }];
  for (let i = a; i !== b; i += dir) {
    const [p, q] = [car.stops[i], car.stops[i + dir]];
    steps.push({ label: `The Tram, ${heading}, ${byId.get(p).name} to ${byId.get(q).name}`, msg: msg({ between: [p, q], heading, doors: "closed" }) });
  }
  steps.push({ label: `The Tram at ${byId.get(to).name}`, msg: msg({ at: to, heading, doors: "open" }) });
  return steps;
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
    label: "Cockpit of the Mule (skiff, your note)",
    msg: { roomId: "ship.12.cockpit", name: "Cockpit of the Mule", area: "ship.12", areaName: "Mule", hull: "skiff", hullName: "prospecting skiff", note: "hauls ore to Orrin" },
  },
  {
    label: "Cockpit of the Fair Copy (courier, a 60-character note)",
    msg: { roomId: "ship.72.cockpit", name: "Cockpit of the Fair Copy", area: "ship.72", areaName: "Fair Copy", hull: "courier", hullName: "courier", note: "mail to Wenna Halt, back by Orrin for ore and two fuel cells" },
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
  ...ZENNOR_WALK.flatMap((id, i) => (id === TRAM ? tramRide(ZENNOR_WALK[i - 1], ZENNOR_WALK[i + 1]) : [room(id)])),
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
/** Her in high orbit over Tamsin as the Lua side keeps it, come in from 2,000 km off it toward the
 *  star (day) or away from it (night), or with no trip known (unknown). */
function overTamsin(now, side) {
  const s = Math.floor(now / 1000);
  const p = positionOf(indexCharts(senaraCharts(now)), "tamsin", s * 1000 - 600000);
  const k = (side === "day" ? -2000 : 2000) / Math.hypot(p[0], p[1]);
  const from = `pt:tamsin:${(p[0] * k).toFixed(1)}:${(p[1] * k).toFixed(1)}`;
  const over = side === "unknown" ? { planet: "tamsin" } : { planet: "tamsin", from, depart: s - 600 };
  return { name: "Mule", docked: false, over, received: s };
}

function emitScene(name) {
  const high = /^orbit-(day|night|unknown)$/.exec(name)?.[1];
  if (high) {
    fp.emit("charts", senaraCharts(Date.now()));
    fp.emit("chart-ship", overTamsin(Date.now(), high));
    return fp.emit("scene", { scene: "orbit", planet: "tamsin" });
  }
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
    "to-tamsin": { name: "Mule", docked: false, from: "gannet", destination: "tamsin", progress: 0.6, eta: 120 },
  };
  if (name === "high-orbit" || name === "high-orbit-unknown") {
    fp.emit("charts", senaraCharts(now));
    fp.emit("chart-ship", overTamsin(now, name === "high-orbit" ? "night" : "unknown"));
    fp.emit("chart", { on: true });
    return;
  }
  if (name === "maelor" || name === "maelor-lanes") {
    fp.emit("charts", maelorCharts(now, null, name === "maelor-lanes"));
    fp.emit("chart-ship", stamp(MAELOR_SHIP));
  } else if (MOUTH_TRIPS[name]) {
    fp.emit("charts", senaraCharts(now, EDGE(now)));
    fp.emit("chart-ship", name === "to-mouth" || name === "to-tamsin" ? stamp(MOUTH_TRIPS[name]) : MOUTH_TRIPS[name]);
  } else if (name === "sweep" || name === "chase") {
    // a sweep at Gannet Belt 4 minutes back; chasing contact-1 from the belt, set off 2 minutes later
    const charts = senaraCharts(now);
    fp.emit("charts", charts);
    fp.emit("chart-contacts", senaraContacts(now, positionOf, indexCharts(charts)));
    fp.emit("chart-ship", name === "sweep"
      ? stamp(SHIPS["parked-gannet"])
      : { name: "Mule", docked: false, from: "gannet", destination: "contact-1", progress: 0.4, eta: 180, depart: s - 120, received: s });
  } else {
    fp.emit("charts", senaraCharts(now, name === "edge" ? EDGE(now) : null));
    fp.emit("chart-ship", stamp(name === "edge" ? SHIPS["parked-gannet"] : SHIPS[name]));
  }
  if (name !== "sweep" && name !== "chase") fp.emit("chart-contacts", null);
  fp.emit("chart", { on: true });
}
// ?unfold also opens the chart with its sweep's card unfolded
if (q.has("unfold")) ChartView.prototype.unfolded = true;
chartMenu.addEventListener("change", () => emitChart(chartMenu.value));

// --- the course she has plotted: what the Lua side's course reducer posts --------------------

const courseMenu = document.getElementById("course");
const COURSES = {
  // docked at T.I.S.S., plotted for the Cinders four minutes ago
  "cinders-tiss": ["docked-tiss", { to: "cinders", name: "The Cinders", km: 2000, seconds: 231, fuel: 6.4, ragged: false, ago: 4 * 60000 }],
  // parked at Gannet, a failed plot for Orrin Station over an hour ago
  "ragged-orrin": ["parked-gannet", { to: "orrin_station", name: "Orrin Station", km: 9840, seconds: 1265, fuel: 31.2, ragged: true, ago: 72 * 60000 }],
  // a ship on the sweep, seen only by her signature: the charts can't place her, so the card alone
  contact: ["at-point", { to: "contact-2", name: "contact-2", km: 610, seconds: 95, fuel: 1.8, ragged: false, ago: 20000 }],
  // in high orbit over Tamsin, plotted for the Cinders: the line from her place on the ring
  "from-orbit": ["high-orbit", { to: "cinders", name: "The Cinders", km: 1400, seconds: 170, fuel: 4.6, ragged: false, ago: 90000 }],
  // flying the course: her trip line has it, and the card goes
  "under-way": ["under-way-orrin", { to: "orrin_station", name: "Orrin Station", km: 6900, seconds: 420, fuel: 20, ragged: false, ago: 3 * 60000 }],
};

function emitCourse(name) {
  const c = COURSES[name];
  if (!c) {
    fp.emit("course", {});
    return;
  }
  const [scenario, { ago, ...course }] = c;
  chartMenu.value = scenario;
  emitChart(scenario);
  fp.emit("course", { course: { ...course, at: Date.now() - ago } });
}
courseMenu.addEventListener("change", () => emitCourse(courseMenu.value));

// --- the core lanes map: what the Lua side's lanes reducer posts ----------------------------

const lanesMenu = document.getElementById("lanes");
// ?zoom=F: once the lanes map is drawn, zoom it by F about its middle (0.5 is twice as near), as + does;
// ?unfold: open it with its key's card unfolded
if (q.has("unfold")) LanesView.prototype.unfolded = true;
if (q.has("zoom")) {
  for (const name of ["setLanes", "setOn"]) {
    const orig = LanesView.prototype[name];
    LanesView.prototype[name] = function (...args) {
      orig.apply(this, args);
      if (!this.zoomed && this.shown) {
        this.zoomed = true;
        this.zoom(Number(q.get("zoom")));
      }
    };
  }
}

// ?belt=B&zoom=F: once the belt map is drawn, zoom it by F about her (0.5 is twice as near), as + does
if (q.has("belt") && q.has("zoom")) {
  for (const name of ["setBelt", "setOn"]) {
    const orig = BeltView.prototype[name];
    BeltView.prototype[name] = function (...args) {
      orig.apply(this, args);
      if (!this.zoomed && this.shown) {
        this.zoomed = true;
        this.zoomBy(Number(q.get("zoom")));
      }
    };
  }
}

// A visit's sightings, as the reducer makes them for a character with every mouth there on her charts:
// every lane of the system, open if a trunk or listed open, closed if off the charts, all as of `at`.
function visit(seen, system, open, at) {
  for (const l of lanesOf(system)) {
    const other = l.between.find((id) => id !== system);
    seen[l.id] = { open: l.class === "trunk" || open.includes(other), at };
  }
  return seen;
}
const lanesHere = (system) => lanesOf(system).map((l) => l.id).sort();

function emitLanes(name) {
  if (!name) {
    fp.emit("lanes-view", { on: false });
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  const SCENARIOS = {
    // docked at T.I.S.S.: the Elowen and Garrow branches open now; Maelor two hours ago, Kilmar a day ago
    senara: () => {
      const seen = visit({}, "kilmar", ["mabyn", "caradon", "garrow"], now - 30 * 3600);
      visit(seen, "maelor", ["petroc", "caradon"], now - 7800);
      return { system: "senara", visible: lanesHere("senara"), seen: visit(seen, "senara", ["elowen", "garrow"], now) };
    },
    // in the Senara–Maelor trunk, 40% through: the charts are Maelor's already
    "in-trunk": () => {
      const seen = visit({}, "senara", ["elowen", "garrow"], now - 300);
      return { system: "maelor", visible: lanesHere("maelor"), seen: visit(seen, "maelor", ["petroc", "caradon"], now),
        transit: { lane: "maelor-senara", from: "senara", to: "maelor", progress: 0.4, eta: 220, received: now } };
    },
    // in the Garrow branch, into the Mid: the charts are Garrow's
    "in-mid": () => {
      const seen = visit({}, "senara", ["elowen", "garrow"], now - 200);
      return { system: "garrow", visible: lanesHere("garrow"), seen: visit(seen, "garrow", ["senara", "dozmary", "kilmar"], now),
        transit: { lane: "garrow-senara", from: "senara", to: "garrow", progress: 0.3, eta: 300, received: now } };
    },
    // at Dozmary, unsettled and deep, with only the Garrow branch open
    dozmary: () => {
      const seen = visit({}, "senara", ["elowen", "garrow"], now - 9000);
      visit(seen, "garrow", ["senara", "dozmary", "kilmar"], now - 3600);
      return { system: "dozmary", visible: lanesHere("dozmary"), seen: visit(seen, "dozmary", ["garrow"], now) };
    },
    // at Morvah Deep, with only its trunks open and nothing seen before
    petroc: () => ({ system: "petroc", visible: lanesHere("petroc"), seen: visit({}, "petroc", [], now) }),
    // a new character at T.I.S.S.: no lane mouth on her charts yet, so every lane not charted
    new: () => ({ system: "senara", visible: [], uncharted: lanesHere("senara"), seen: {} }),
    // at Wenna Halt, with Maelor's trunks and the Petroc branch (closed now) charted, and nothing else;
    // the Senara–Elowen branch seen open from Senara an hour ago
    partly: () => {
      const known = ["elowen-maelor", "maelor-petroc", "maelor-senara"];
      return {
        system: "maelor",
        visible: known,
        uncharted: lanesHere("maelor").filter((id) => !known.includes(id)),
        seen: {
          "elowen-maelor": { open: true, at: now },
          "maelor-senara": { open: true, at: now },
          "maelor-petroc": { open: false, at: now },
          "elowen-senara": { open: true, at: now - 3600 },
        },
      };
    },
  };
  fp.emit("lanes", (SCENARIOS[name] ?? SCENARIOS.senara)());
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

/** A Space.Contacts ship as charts.lua cleans it, seen at (x, y) in the belt from her at `from`: km
 *  and bearing to a tenth, as gmcp.ts sends them, and no x or y. */
function beltContact(from, x, y, c) {
  const dx = x - from[0];
  const dy = y - from[1];
  const tenth = (n) => Math.round(n * 10) / 10;
  const bearing = tenth((((Math.atan2(dx, dy) * 180) / Math.PI) + 360) % 360) % 360;
  return { hidden: null, missed: false, ...c, km: tenth(Math.hypot(dx, dy)), bearing };
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
  fp.emit("chart-contacts", null);
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
  } else if (name === "freighter-seen") {
    // a skiff at Gannet 14 minutes after leaving her freighter; a sweep 4 minutes ago saw the
    // freighter again, a dark contact and the Mule under drive; she's moved on since
    const at = Date.now() - 4 * 60000;
    const from = [-1.5, -3.5];
    fp.emit("belt", beltMsg("gannet-3", "Gannet Belt", 18, -5.5, -9.5, {
      track: [[[7.2, 5.1], [3, -1], from, [-5.5, -9.5]]],
      sweeps: [{ x: from[0], y: from[1], r: 5 }],
      left: { x: 7.2, y: 5.1, name: "Full Measure", id: "ship.7", at: now - 14 * 60 },
      seen: { at, x: from[0], y: from[1] },
    }));
    fp.emit("chart-contacts", { at, system: "senara", contacts: [
      beltContact(from, 9.4, 1.6, { kind: "ship", id: "ship.7", name: "Full Measure", moving: false, size: 3, hull: "freighter", owner: "Annet's" }),
      beltContact(from, -12.5, 3.2, { kind: "unknown", id: "contact-1", name: "contact-1" }),
      beltContact(from, 2.5, -13.4, { kind: "ship", id: "ship.42", name: "Mule", moving: true, size: 1, hull: "skiff", owner: "Dilbo's" }),
    ] });
  } else if (name === "docked-pair") {
    // docked at her freighter 8.7 km out at Gannet; a sweep 2 minutes ago saw the Mule (and her host)
    const at = Date.now() - 2 * 60000;
    const host = [4.2, -7.6];
    const m = beltMsg("gannet-3", "Gannet Belt", 18, null, null, {
      track: [[[-3, 2], host]],
      seen: { at, x: host[0], y: host[1] },
    }, { host: "Full Measure", host_id: "ship.7" });
    m.docked = beltMsg("", "", 18, ...host, {}).place;
    fp.emit("belt", m);
    fp.emit("chart-contacts", { at, system: "senara", contacts: [
      beltContact(host, ...host, { kind: "ship", id: "ship.7", name: "Full Measure", moving: false, size: 3, hull: "freighter", owner: "Annet's" }),
      beltContact(host, -6.8, 2.4, { kind: "ship", id: "ship.42", name: "Mule", moving: false, size: 1, hull: "skiff", owner: "Dilbo's" }),
    ] });
  } else if (name === "worked") {
    // a skiff that has worked the Cinders for hours: a dozen sweeps, two visits, back beside her host
    // (the last sweep saw the Old Reliable there, and the Magpie off to the west)
    const at = Date.now() - 10 * 60000;
    const here = [3.9, 0.2];
    const sweeps = [[-9.5, -4], [-8.2, -5.6], [-10.6, -6.3], [-7.4, -3.1], [-9.1, -7.2], [-6.8, -6], [-8.8, -2.4],
      [-10.2, -4.8], [1.4, 9.9], [2.6, 7.6], [3.6, 5.8], here].map(([x, y]) => ({ x, y, r: 5 }));
    fp.emit("charts", senaraCharts(Date.now(), EDGE(Date.now())));
    fp.emit("belt", beltMsg("cinders", "The Cinders", 16, ...here, {
      track: [[[-12.2, -4.9], [-7.8, -3.9], [-9.6, -6.7], [-7.2, -5.3], [-9.5, -2.6]], [[-7, 4.6], [1.6, 6], here]],
      sweeps,
      left: { x: 4.1, y: 0.7, name: "Old Reliable", id: "ship.7", at: now - 40 * 60 },
      seen: { at, x: here[0], y: here[1] },
    }));
    fp.emit("chart-contacts", { at, system: "senara", contacts: [
      beltContact(here, 3.9, 0.7, { kind: "ship", id: "ship.7", name: "Old Reliable", moving: false, size: 3, hull: "freighter", owner: "Annet's" }),
      beltContact(here, -1.9, 3.2, { kind: "ship", id: "ship.42", name: "Magpie", moving: false, size: 1, hull: "skiff", owner: "Dilbo's" }),
    ] });
  } else if (name === "compass") {
    // at Gannet with the Senara charts, the Maelor mouth's bearing known and a course plotted home:
    // the bearing ring marks the star, Tamsin, the stations, the mouth and where she'd go next
    fp.emit("charts", senaraCharts(Date.now(), EDGE(Date.now())));
    fp.emit("course", { course: { to: "tiss", name: "Tamsin International Space Station", km: 2140, seconds: 230, fuel: 6.1, ragged: false, at: Date.now() - 40000 } });
    fp.emit("belt", beltMsg("gannet", "Gannet Belt", 18, -5.5, -9.5, {
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
  if (q.has("course")) {
    courseMenu.value = q.get("course");
    emitCourse(courseMenu.value);
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
