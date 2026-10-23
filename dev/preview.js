// Preview driver: replays a walk round T.I.S.S. (into a bunk and a workshop on the way), then flights to Orrin Station, Wenna Halt and the
// four halts on decks (Morvah Deep, Gwithian Reach, Carrow Yard, Lanyon High) and a walk round
// each, then down to Zennor on Tamsin and a walk round the town, through the fake panel, using the same `location` and `scene` message shapes the Lua side posts
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
//   ?sky=S    stand in Zennor's Square under sky S (night, dusk, dawn, low, overhead or tiss-overhead): the game's
//             own charts from dev/sky-cases.json, shifted so a recorded moment of that sky is now; the bar's menu switches it

import carrow from "../ui/data/carrow.js";
import gwithian from "../ui/data/gwithian.js";
import lanyon from "../ui/data/lanyon.js";
import morvah from "../ui/data/morvah.js";
import orrin from "../ui/data/orrin.js";
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
const DATA = [station.rooms, orrin.rooms, wenna.rooms, morvah.rooms, gwithian.rooms, carrow.rooms, lanyon.rooms, town];
const byId = new Map(DATA.flat().map((r) => [r.id, r]));

// --- the route -------------------------------------------------------------------------------

const room = (id) => {
  const r = byId.get(id);
  return { label: r.name, msg: { roomId: id, name: r.name, address: r.address ?? undefined, gravity: r.gravity } };
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

/** Fly to a halt laid out as Orrin is (`prefix`, its dock `place`), dock, and go round it once. */
function halt(prefix, name, place) {
  const at = (key) => room(`${prefix}.${key}`);
  return [
    { label: `Flying to ${name}`, msg: COCKPIT, scene: { scene: "travelling" } },
    { label: `Docked at ${name}`, msg: COCKPIT, scene: { scene: "station", station: place } },
    ...["berth", "deck-3-frame-2", "freight", "deck-3-frame-2", "charts", "deck-3-frame-2", "deck-3-frame-1"].map(at),
    ...["concourse", "deck-2-frame-2", "market", "deck-2-frame-2", "gallery"].map(at),
  ];
}

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
