// Panel entry: wires the Lua side's messages to the station model (top), the space scenes that
// replace it while you're out in your ship, and the deck plan (bottom). Each station has its own
// model and plan (a town on the ground has a skyline for its model); only the one you're on (or
// docked or landed at) shows. Aboard a ship (any "ship." room) the bottom band shows that ship's
// plan instead, one view per hull drawing, built on first use.
// The Lua side holds all state and replays it when we post "ready", so this file keeps only the
// last location, the docked station, and the level each plan last showed (a lift between floors
// keeps the plan where it was). The system chart (◎), the core lanes map (⋈) or the belt map can cover the
// top band, one at a time; while one does, the space scene doesn't draw. Docking and undocking, the station
// model shows through the space scene, drawing near or falling away on the game's clock. What you're
// doing (Char.Action) is a card in the deck band's corner, over whichever plan shows; the overview is
// left as it is.

import { ActionCard } from "./action-card.js";
import { BeltView } from "./belt-view.js";
import { ChartView } from "./chart-view.js";
import botallack from "./data/botallack.js";
import caradon from "./data/caradon.js";
import carrow from "./data/carrow.js";
import garrow from "./data/garrow.js";
import gwithian from "./data/gwithian.js";
import kilmar from "./data/kilmar.js";
import kynance from "./data/kynance.js";
import lamorna from "./data/lamorna.js";
import lanyon from "./data/lanyon.js";
import marazion from "./data/marazion.js";
import morvah from "./data/morvah.js";
import orrin from "./data/orrin.js";
import penwith from "./data/penwith.js";
import polperro from "./data/polperro.js";
import station from "./data/station.js";
import wenna from "./data/wenna.js";
import zennor from "./data/zennor.js";
import { DeckView } from "./deck-view.js";
import { LanesView } from "./lanes-view.js";
import { decksPlans } from "./decks-deck.js";
import { drumPlans } from "./drum-deck.js";
import { DECKS, buildDecksModel, decksCut, decksKey, indexDecks, locateDecks } from "./lib/decks.js";
import { DRUMS, buildDrumModel, drumHour, drumKey } from "./lib/drum.js";
import { hullOf, isShipRoom, shipInfo } from "./lib/hulls.js";
import { indexStation, infoLine, locate } from "./lib/locate.js";
import { moveCard } from "./lib/space.js";
import { noPlanLine, pickStation, stationOfDock } from "./lib/stations.js";
import { TOWNS, indexTown, locateTown, townInfo } from "./lib/town.js";
import { ModelView } from "./model-view.js";
import { SpaceView } from "./space-view.js";
import { shipPlans, updateShip } from "./ship-deck.js";
import { townPlans } from "./town-deck.js";
import { SkyView } from "./town-view.js";

const modelEl = document.getElementById("model");
const deckEl = document.getElementById("deck");

function tiss() {
  const index = indexStation(station);
  return { index, model: new ModelView(modelEl, index), deck: new DeckView(deckEl, index), lastLevel: null };
}

/** Wenna Halt: one drum, one plan. */
function drum(data, spec) {
  const index = indexStation(data);
  const model = new ModelView(modelEl, index, {
    faces: buildDrumModel(index, spec),
    keyOf: drumKey,
    hourOf: (where) => drumHour(index, where),
    labels: false,
  });
  return { index, model, deck: new DeckView(deckEl, index, drumPlans(spec)), lastLevel: null };
}

/** Orrin Station and the halts: a box on decks, cut away above your deck; a plan a deck, rooms placed by address. */
function decks(data, spec) {
  const index = indexDecks(data, spec);
  const model = new ModelView(modelEl, index, {
    faces: buildDecksModel(index, spec),
    keyOf: decksKey,
    hourOf: () => null,
    cutOf: (where) => decksCut(index, where),
    labels: false,
  });
  return { index, model, deck: new DeckView(deckEl, index, decksPlans(spec)), lastLevel: null, locate: locateDecks };
}

/** Zennor: a town on the ground, rooms placed by their compass exits; its sky over it. */
function town(data, spec) {
  const index = indexTown(data, spec);
  return { index, model: new SkyView(modelEl, index, "zennor"), deck: new DeckView(deckEl, index, townPlans(spec)), lastLevel: null, locate: locateTown, info: townInfo };
}

const stations = {
  tiss: tiss(),
  orrin: decks(orrin, DECKS.orrin),
  wenna: drum(wenna, DRUMS.wenna),
  zennor: town(zennor, TOWNS.zennor),
  morvah: decks(morvah, DECKS.morvah),
  gwithian: decks(gwithian, DECKS.gwithian),
  carrow: decks(carrow, DECKS.carrow),
  lanyon: decks(lanyon, DECKS.lanyon),
  kynance: decks(kynance, DECKS.kynance),
  marazion: decks(marazion, DECKS.marazion),
  penwith: decks(penwith, DECKS.penwith),
  botallack: decks(botallack, DECKS.botallack),
  polperro: decks(polperro, DECKS.polperro),
  lamorna: decks(lamorna, DECKS.lamorna),
  kilmar: decks(kilmar, DECKS.kilmar),
  caradon: decks(caradon, DECKS.caradon),
  garrow: decks(garrow, DECKS.garrow),
};
const ships = {}; // hull id -> the DeckView drawing that hull, built on first use
const space = new SpaceView(modelEl);
space.onAway = (away) => stations[current]?.model.setAway?.(away);
const doing = new ActionCard(deckEl);
const moving = new ActionCard(deckEl, moveCard); // her thrusters, or closing on a rock, under yours
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

/** Keep the town's sky moving, a redraw a second, while it's the band showing, there's a sky (out
 *  of doors, with charts that place the town), and nothing covers it: not the chart or the lanes map, not a space
 *  scene, not a hidden panel. Starting draws it for now at once. */
function runSky() {
  clearInterval(skyTimer);
  skyTimer = 0;
  const sky = stations.zennor.model;
  if (current !== "zennor" || !sky.live || chart.shown || lanes.shown || belt.shown || document.hidden || (scene && scene !== "station")) return;
  sky.draw(Date.now());
  skyTimer = setInterval(() => sky.draw(Date.now()), 1000);
}

let current; // the station showing: undefined till the first render, null for one there's no plan of
let docked = null; // where your ship is docked (a place id), from the scene message
let approaching = null; // the station a dock under way is drawing near (its place id), from the manoeuvre message
let last = null; // the last location message

/** Show the station model for key; the bottom band is render()'s, since a ship can take it. */
function show(key) {
  if (key === current) return;
  stations[current]?.model.setAway?.(0); // a model left behind part-way is put back
  current = key;
  for (const [k, s] of Object.entries(stations)) s.model.div.style.display = k === key ? "" : "none";
}

/** Show only this deck in the bottom band (a station's or a ship's), or none; true if it was hidden. */
function showDeck(view) {
  for (const d of [...Object.values(stations).map((s) => s.deck), ...Object.values(ships)]) {
    if (d !== view) d.div.style.display = "none";
  }
  if (!view) return false;
  const hidden = view.div.style.display === "none";
  view.div.style.display = "";
  return hidden;
}

function shipView(id) {
  if (!ships[id]) {
    ships[id] = new DeckView(deckEl, null, shipPlans(hullOf(id)));
    ships[id].div.style.display = "none"; // so showDeck() frames it once it's the only deck
  }
  return ships[id];
}

function render() {
  show(pickStation(last, docked ?? approaching, current === undefined ? "tiss" : current));
  const s = stations[current]; // none at a station there's no plan of: nothing shows, not the last one
  const where = s ? (s.locate ?? locate)(s.index, last, s.lastLevel) : null;
  if (s) {
    if (where.kind !== "off") s.lastLevel = where.level;
    s.model.set(where);
    s.deck.set(where);
    s.deck.dim(where.kind === "off");
  }
  if (isShipRoom(last?.roomId)) {
    const view = shipView(hullOf(last.hull).id);
    if (showDeck(view)) view.home();
    updateShip(view, last);
    view.set({ kind: "room", id: last.roomId, level: 0, room: last.shipRoom ?? null });
    info.textContent = shipInfo(last);
    return;
  }
  showDeck(s?.deck ?? null);
  info.textContent = s ? (s.info ?? infoLine)(where, last, s.index) : noPlanLine(last);
}

panel.on("settings", (msg) => {
  for (const s of Object.values(stations)) s.model.setTurning(msg?.turn_model !== false);
});

panel.on("scene", (msg) => {
  space.set(msg?.scene, msg?.port ?? null);
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
  if (timed) {
    const end = Date.now() + left * 1000;
    space.setManoeuvre({ verb, start: end - Math.max(total, left) * 1000, end });
  } else {
    space.setManoeuvre(null);
  }
  render();
});

panel.on("charts", (msg) => {
  chart.setCharts(msg);
  space.setCharts(chart.index);
  stations.zennor.model.setCharts(chart.index);
  runChart();
});

panel.on("chart-ship", (msg) => {
  chart.setShip(msg);
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

panel.on("action", (msg) => doing.set(msg));

panel.on("location", (msg) => {
  last = msg;
  render();
  runSky();
});

show("tiss");
showDeck(stations.tiss.deck);
panel.post("ready", {});
