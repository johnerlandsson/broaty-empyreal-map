// Panel entry: wires the Lua side's messages to the station model (top), the space scenes that
// replace it while you're out in your ship, and the deck plan (bottom). Each station has its own
// model and plan (a town on the ground has a skyline for its model); only the one you're on (or
// docked or landed at) shows. Aboard a ship (any "ship." room) the bottom band shows that ship's
// generated plan instead (data/ships.js), one view per plan, built on first use and again for a
// ship of another name; and while she's out in space (a space scene, or a dock or an undock under
// way) her model stands in front of the scene in the top band, your room lit; riding a car (a lift or the tram),
// the car and its line of stops, one view per kind.
// The Lua side holds all state and replays it when we post "ready", so this file keeps only the
// last location, the docked station, and the level each plan last showed (a lift between floors
// keeps the plan where it was). The system chart (◎), the lanes map (⋈) or the belt map can cover the
// top band, one at a time; while one does, the space scene doesn't draw. Docking and undocking, the station
// model shows through the space scene, drawing near or falling away on the game's clock. Her waiting
// on Control's clearance for a dock or an undock is a card in the deck band's corner, over whichever plan
// shows; the overview is left as it is.
// Until the game says where you are, both bands show an unknown location (unknown-view.js), and no
// station is built till one is picked.
// Out on generated land (an area "surface.<world>"), the bands are the walked land's: Tamsin from
// above (land-globe.js) and the board of the places you've walked (land-deck.js), built on the first
// land location. The walked places are kept in a LandStore, fed "land-room" frames and the saved map
// ("land-load"), and posted back debounced ("land-save") for the Lua side to keep per character.

import { landLoad, landSaver } from "./lib/land-save.js";
import { CornerCard } from "./corner-card.js";
import { clearanceCard } from "./lib/clearance.js";
import { BeltView } from "./belt-view.js";
import { carPlans, nameCar, updateCar } from "./car-deck.js";
import { ChartView } from "./chart-view.js";
import places, { data } from "./data/places.js";
import { DeckView } from "./deck-view.js";
import { LanesView } from "./lanes-view.js";
import { carInfo, carKind, carName, stopNames } from "./lib/cars.js";
import { isShipRoom, planFor, shipInfo } from "./lib/ships.js";
import { infoLine, locate } from "./lib/locate.js";
import { landBody, landLatitude, landShown, landWorld } from "./lib/land-choose.js";
import { LandStore } from "./lib/land-store.js";
import land from "./data/land.js";
import sky from "./data/sky.js";
import { LandDeck } from "./land-deck.js";
import { LandGlobe } from "./land-globe.js";
import { moveCard } from "./lib/space.js";
import { noPlanLine, pickStation, stationOfDock } from "./lib/stations.js";
import { SpaceView } from "./space-view.js";
import { buildPlace, buildShip } from "./place-views.js";
import { UnknownView } from "./unknown-view.js";

const modelEl = document.getElementById("model");
const deckEl = document.getElementById("deck");

// Each station is built the first time it shows: a model and a plan apiece, each over its own
// starfield, cost tens of milliseconds and thousands of nodes, and most never show in a session.
// Every place in the generated index (data/places.js) by its builder.
const BUILDERS = new Set(["decks", "drum", "levels", "town", "wheel"]);
const BUILD = Object.fromEntries(places.filter((p) => BUILDERS.has(p.builder) && data[p.id]).map((p) => [p.id, () => ({ ...buildPlace(data[p.id], p.builder, modelEl, deckEl), lastLevel: null })]));
const stations = {}; // station key -> its views, once built
let turning = true; // the turn_model setting, for stations built after it came

/** The station key's views, built on first use; undefined for one there's no plan of. */
function built(key) {
  if (!stations[key] && BUILD[key]) {
    const s = (stations[key] = BUILD[key]());
    s.model.setTurning(turning);
    s.deck.div.style.display = "none"; // showDeck() shows it once it's the plan showing
    if (chart.index) s.model.setCharts?.(chart.index); // a port's sky needs the charts to place it
  }
  return stations[key];
}
const ships = {}; // plan id -> that plan's views (buildShip), for the ship of its `name`, built on first use
const cars = {}; // car kind (lift, tram) -> the DeckView drawing it, built on first use
// each port's hull, whose exterior says how it looks from orbit (a `pit` is Dolcoath's)
const space = new SpaceView(modelEl, { hulls: Object.fromEntries(places.flatMap((p) => Object.entries(p.hulls ?? {}))) });
// your ship's model, over the space scene's canvas (after it, at its z-index) and under the chart,
// the lanes map and the belt map; framed in the band's lower middle (map.css)
const shipModels = document.createElement("div");
shipModels.className = "own-ship";
shipModels.style.display = "none";
space.cv.after(shipModels);
space.onAway = (away) => stations[current]?.model.setAway?.(away);
let unknown = new UnknownView(modelEl, deckEl); // both bands until the game says where you are
const moving = new CornerCard(deckEl, moveCard); // her thrusters, or closing on a rock
const waiting = new CornerCard(deckEl, clearanceCard); // waiting on Control to dock or undock, under that
const info = document.getElementById("info");
const panel = window.panel;

// switching one of the chart, the lanes map and the belt map on switches the others off; the Lua side does too
const chart = new ChartView(modelEl, {
  onToggle(on) {
    panel.post("chart", { on });
    if (on) {
      lanes.setOn(false);
      belt.setOn(false);
    }
    runChart();
  },
});
const lanes = new LanesView(modelEl, {
  onToggle(on) {
    panel.post("lanes-view", { on });
    if (on) {
      chart.setOn(false);
      belt.setOn(false);
    }
    runChart();
  },
});
const belt = new BeltView(modelEl, {
  onToggle(on) {
    panel.post("belt-view", { on });
    if (on) {
      chart.setOn(false);
      lanes.setOn(false);
    }
    runChart();
  },
});
let chartTimer = 0;
let chartRaf = 0;
let chartLast = 0;
const CHART_SMOOTH = 100; // ms between redraws while she's under way

/** Redraw the chart, the lanes map or the belt map once a second while it's shown and the panel
 *  visible, more often while she moves, and not at all otherwise; and keep the space scene from
 *  drawing under it. */
function runChart() {
  runSky();
  runShip();
  const view = chart.shown ? chart : lanes.shown ? lanes : belt.shown ? belt : null;
  space.setCovered(!!view);
  clearInterval(chartTimer);
  cancelAnimationFrame(chartRaf);
  chartTimer = 0;
  chartRaf = 0;
  if (!view || document.hidden) return;
  view.draw(Date.now());
  if (view.moving) {
    const step = (now) => {
      if (!view.moving) return runChart(); // she's stopped: back to once a second
      if (now - chartLast >= CHART_SMOOTH) {
        chartLast = now;
        view.draw(Date.now());
      }
      chartRaf = requestAnimationFrame(step);
    };
    chartRaf = requestAnimationFrame(step);
  } else {
    chartTimer = setInterval(() => view.draw(Date.now()), 1000);
  }
}
document.addEventListener("visibilitychange", runChart);

let scene = null; // the overview scene from the scene message: anything but "station" draws over the band
let skyTimer = 0;

/** Keep a port's sky moving (Zennor's, the Pit's), a redraw a second, while it's the band showing,
 *  there's a sky (out of doors, with charts that place the port), and nothing covers it: not the chart or the lanes
 *  map, not a space scene, not a hidden panel. Starting draws it for now at once. A model with no
 *  sky has no `live`. */
function runSky() {
  clearInterval(skyTimer);
  skyTimer = 0;
  const sky = stations[current]?.model;
  if (!sky?.live || chart.shown || lanes.shown || belt.shown || document.hidden || (scene && scene !== "station")) return;
  sky.draw(Date.now());
  skyTimer = setInterval(() => sky.draw(Date.now()), 1000);
}

const UNKNOWN_LINE = "LOCATION UNKNOWN";
let current; // the station showing: undefined till one is picked, null for one there's no plan of
let docked = null; // where your ship is docked (a place id), from the scene message
let approaching = null; // the station a dock under way is drawing near (its place id), from the manoeuvre message
let manoeuvring = false; // a dock or an undock under way: the band is the space view, the station near or far
let last = null; // the last location message

/** Show the station model for key; the bottom band is render()'s, since a ship can take it. */
function show(key) {
  if (key === current) return;
  stations[current]?.model.setAway?.(0); // a model left behind part-way is put back
  current = key;
  built(key);
  for (const [k, s] of Object.entries(stations)) s.model.div.style.display = k === key ? "" : "none";
}

/** Show only this deck in the bottom band (a station's or a ship's), or none; true if it was hidden. */
function showDeck(view) {
  for (const d of [...Object.values(stations).map((s) => s.deck), ...Object.values(ships).map((v) => v.deck), ...Object.values(cars)]) {
    if (d !== view) d.div.style.display = "none";
  }
  if (!view) return false;
  const hidden = view.div.style.display === "none";
  view.div.style.display = "";
  return hidden;
}

/** The views of the plan the location message's hull has (an unknown hull's: the generic one),
 *  with her name in its rooms: built again, in place of the last, for a ship of another name. */
function shipView(msg) {
  const plan = planFor(msg?.hull);
  const name = typeof msg?.areaName === "string" && msg.areaName !== "" ? msg.areaName : "ship";
  if (ships[plan.id]?.name !== name) {
    ships[plan.id]?.deck.div.remove();
    ships[plan.id]?.model.div.remove();
    ships[plan.id] = buildShip(plan, shipModels, deckEl, { name, transparent: true });
    ships[plan.id].deck.div.style.display = "none"; // so showDeck() frames it once it's the only deck
  }
  return ships[plan.id];
}

/** Your ship's model in the top band: shown aboard a ship while the band is the space view (a
 *  space scene, or a dock or an undock under way) and nothing covers it; that ship's alone. A guest
 *  aboard another's ship has no scene, so none. During a dock or an undock she stands aside, smaller
 *  in the lower right, clear of the station drawing near or falling away. */
function runShip() {
  const out = (scene != null && scene !== "station") || manoeuvring;
  const covered = chart.shown || lanes.shown || belt.shown;
  const view = isShipRoom(last?.roomId) && out && !covered ? ships[planFor(last?.hull).id] : null;
  shipModels.style.display = view ? "" : "none";
  shipModels.classList.toggle("manoeuvre", manoeuvring); // aside, so the station coming and going shows
  for (const v of Object.values(ships)) v.model.div.style.display = v === view ? "" : "none";
}

function carView(kind) {
  if (!cars[kind]) {
    cars[kind] = new DeckView(deckEl, null, carPlans(kind));
    cars[kind].div.style.display = "none"; // so showDeck() frames it once it's the only deck
  }
  return cars[kind];
}

// The walked land: one store for every world's (a place's id carries its body, surface.<body>.…), and
// a board and globe for each world, built on its first land location.
const landStore = new LandStore();
const landViews = new Map(); // body -> { deck, globe }
const landSaver_ = landSaver(landStore, (who, record) => panel.post("land-save", { who, record }), 1000); // as the automapper's

landStore.onChange(() => landSaver_.soon());
// A panel closed or hidden within the debounce would lose the last change.
addEventListener("pagehide", () => landSaver_.flush());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) landSaver_.flush();
});

/** The board and globe for the land of area `surface.<body>`, built on first use. */
function landBuilt(area) {
  const body = landBody(area) ?? "";
  if (!landViews.has(body)) {
    const world = landWorld(area, land);
    const deck = new LandDeck(deckEl, world, body);
    const globe = new LandGlobe(modelEl, { latitude: landLatitude(world, sky), body });
    deck.show(false);
    globe.show(false);
    deck.onNote((id, text) => {
      landStore.setNote(id, text);
      landSaver_.now();
      deck.draw(landStore);
    });
    deck.onForget(() => {
      landStore.forget(`surface.${body}.`);
      landSaver_.now();
      deck.draw(landStore);
    });
    landViews.set(body, { deck, globe });
  }
  return landViews.get(body);
}

/** Show the views of the land of `area` (none for null), hiding every other world's. */
function showLand(area) {
  const on = area == null ? null : landBuilt(area);
  for (const v of landViews.values()) {
    v.deck.show(v === on);
    v.globe.show(v === on);
  }
  on?.deck.draw(landStore); // only redrawn while shown: catch up with what's changed
}

function render() {
  if (landShown(last)) {
    show(undefined);
    showDeck(null);
    if (unknown) {
      unknown.remove();
      unknown = null;
    }
    showLand(last.area);
    runShip();
    info.textContent = last.name ?? "";
    return;
  }
  showLand(null);
  show(pickStation(last, docked ?? approaching, current));
  if (unknown && (current !== undefined || last)) {
    unknown.remove(); // placed, or a location came that places you on no station: it never shows again
    unknown = null;
  }
  const s = stations[current]; // none at a station there's no plan of: nothing shows, not the last one
  const where = s ? (s.locate ?? locate)(s.index, last, s.lastLevel) : null;
  if (s) {
    if (where.kind !== "off") s.lastLevel = where.level;
    s.model.set(where, last);
    s.deck.set(where);
    s.deck.dim(where.kind === "off");
  }
  if (s && last?.lift) {
    // riding a car: the car itself, as a one-room ship is shown
    const view = carView(carKind(last.lift));
    if (showDeck(view)) view.home();
    nameCar(view, carName(last, s.index));
    updateCar(view, last.lift, stopNames(s.index));
    view.set({ kind: "room", id: last.lift.id, level: 0 });
    info.textContent = carInfo(last, s.index);
    runShip();
    return;
  }
  if (isShipRoom(last?.roomId)) {
    const ship = shipView(last);
    if (showDeck(ship.deck)) ship.deck.home();
    ship.update(last);
    info.textContent = shipInfo(last);
    runShip();
    return;
  }
  showDeck(s?.deck ?? null);
  runShip();
  info.textContent = s ? (s.info ?? infoLine)(where, last, s.index) : unknown ? UNKNOWN_LINE : noPlanLine(last);
}

panel.on("settings", (msg) => {
  turning = msg?.turn_model !== false;
  for (const s of Object.values(stations)) s.model.setTurning(turning);
});

panel.on("scene", (msg) => {
  space.set(msg?.scene, msg?.port ?? null, msg?.planet ?? null);
  scene = msg?.scene ?? null;
  docked = typeof msg?.station === "string" ? msg.station : null;
  render();
  runSky();
});

panel.on("work", (msg) => {
  space.setWork(msg);
  moving.set(msg);
});

// A dock or an undock, timed from now by what's left of it; the station it's about must be one we draw.
panel.on("manoeuvre", (msg) => {
  const verb = msg?.verb;
  const key = stationOfDock(msg?.at);
  const left = Number(msg?.left);
  const total = Number(msg?.total);
  const timed = (verb === "dock" || verb === "undock") && key && Number.isFinite(left) && Number.isFinite(total);
  approaching = timed && verb === "dock" ? msg.at : null;
  manoeuvring = !!timed;
  if (timed) {
    const end = Date.now() + left * 1000;
    space.setManoeuvre({ verb, start: end - Math.max(total, left) * 1000, end });
  } else {
    space.setManoeuvre(null);
  }
  render();
});

// Called in or out, she waits for Control's answer; the run, once cleared, is the manoeuvre message's.
panel.on("clearance", (msg) => waiting.set(msg));

panel.on("charts", (msg) => {
  chart.setCharts(msg);
  space.setCharts(chart.index);
  for (const s of Object.values(stations)) s.model.setCharts?.(chart.index);
  belt.setCharts(chart.index);
  runChart();
});

panel.on("chart-contacts", (msg) => {
  chart.setContacts(msg);
  belt.setContacts(msg);
  runChart(); // a chase she couldn't be placed on may be placed now
});

panel.on("chart-ship", (msg) => {
  chart.setShip(msg);
  space.setShip(msg);
  runChart();
});

panel.on("chart", (msg) => {
  chart.setOn(msg?.on);
  runChart();
});

panel.on("lanes", (msg) => {
  lanes.setLanes(msg);
  runChart();
});

panel.on("lanes-view", (msg) => {
  lanes.setOn(msg?.on);
  if (lanes.on) {
    chart.setOn(false);
    belt.setOn(false);
  }
  runChart();
});

panel.on("belt", (msg) => {
  belt.setBelt(msg);
  runChart();
});

panel.on("belt-view", (msg) => {
  belt.setOn(msg?.on);
  if (belt.on) {
    chart.setOn(false);
    lanes.setOn(false);
  }
  runChart();
});

panel.on("course", (msg) => {
  chart.setCourse(msg);
  belt.setCourse(msg);
});

panel.on("location", (msg) => {
  last = msg;
  render();
  runSky();
});

// A frame of the walked land, after its location: on the board and the globe.
panel.on("land-room", (msg) => {
  // false too for a step into a place walked before just as it is, which only moves where you are
  if (!landStore.ingest(msg) && landStore.here !== msg?.id) return;
  const v = landViews.get(landBody(msg.area) ?? ""); // drawn from the store once its land is built
  if (!v) return;
  v.deck.draw(landStore);
  v.deck.follow();
  v.globe.set(msg.coords);
});

// The character's saved map, when she becomes known: merged with what she's walked meanwhile. No one
// (a disconnect) clears it; either way the one before's waiting change is saved under her name first.
panel.on("land-load", (msg) => {
  if (!landLoad(landStore, landSaver_, msg)) return;
  for (const v of landViews.values()) v.deck.draw(landStore);
});

info.textContent = UNKNOWN_LINE;
panel.post("ready", {});
