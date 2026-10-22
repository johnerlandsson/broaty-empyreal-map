// Preview driver: replays a walk round T.I.S.S., then flights to Orrin Station and Wenna Halt and a
// walk round each, through the fake panel, using the same `location` and `scene` message shapes the Lua side posts
// (src/station_map/location.lua, src/station_map/scene.lua).
//
//   ?step=N   open on route step N, as a panel re-mounting mid-walk would (only step N is replayed)
//   ?walk     start the walk on load; ?until=N stops it after step N
//   ?repeat   with ?step: after it settles, re-send step N twice and report what changed
//   ?debug    count model turns / redraws and deck highlights / re-centres, shown bottom-right
//   ?still    send settings { turn_model: false }
//   ?scene=S  open on overview scene S (station, parked, travelling or belt); the bar's menu switches it
//   ?hull=H   aboard a ship, send hull H (skiff or courier) as the server will; the bar's menu switches it

import orrin from "../ui/data/orrin.js";
import station from "../ui/data/station.js";
import wenna from "../ui/data/wenna.js";
import { DeckView } from "../ui/deck-view.js";
import { ModelView } from "../ui/model-view.js";

const q = new URLSearchParams(location.search);
const debug = q.has("debug");
const byId = new Map([...station.rooms, ...orrin.rooms, ...wenna.rooms].map((r) => [r.id, r]));

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

const COCKPIT = { roomId: "ship.41", name: "Cockpit of the Magpie", area: "ship.41", areaName: "Magpie" };

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
  ...ride(3, "tiss.rim-0300", "tiss.mid-0300"),
  room("tiss.mid-0300"),
  room("tiss.gym"),
  room("tiss.mid-0300"),
  ...ride(3, "tiss.mid-0300", "tiss.inner-0300"),
  room("tiss.inner-0300"),
  room("tiss.fabricator"),
  room("tiss.inner-0300"),
  ...ride(3, "tiss.inner-0300", "tiss.hub"),
  room("tiss.hub"),
  room("tiss.bearing"),
  room("tiss.spine-1"),
  room("tiss.spine-2"),
  room("tiss.spine-3"),
  room("tiss.berth"),
  { label: "Cockpit of the Magpie (ship.41)", msg: COCKPIT },
  {
    label: "Cockpit of the Mule (skiff)",
    msg: { roomId: "ship.12", name: "Cockpit of the Mule", area: "ship.12", areaName: "Mule", hull: "skiff", hullName: "prospecting skiff" },
  },
  {
    label: "Cockpit of the Kittiwake (courier)",
    msg: { roomId: "ship.13", name: "Cockpit of the Kittiwake", area: "ship.13", areaName: "Kittiwake", hull: "courier", hullName: "courier" },
  },
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
const HULL_NAMES = { skiff: "prospecting skiff", courier: "courier" };
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
sceneMenu.addEventListener("change", () => fp.emit("scene", { scene: sceneMenu.value }));

hullMenu.addEventListener("change", () => {
  if (lastMsg?.roomId?.startsWith("ship.")) fp.emit("location", structuredClone(withHull(lastMsg, true)));
});

function start() {
  fp.emit("settings", { turn_model: !q.has("still") });
  if (q.has("scene")) {
    sceneMenu.value = q.get("scene");
    fp.emit("scene", { scene: sceneMenu.value });
  }
  if (q.has("hull")) hullMenu.value = q.get("hull");
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
