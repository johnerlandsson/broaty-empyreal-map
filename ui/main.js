// Panel entry: wires the Lua side's messages to the station model (top), the space scenes that
// replace it while you're out in your ship, and the deck plan (bottom). Each station has its own
// model and plan; only the one you're on (or docked at) shows.
// The Lua side holds all state and replays it when we post "ready", so this file keeps only the
// last location, the docked station, and the level each plan last showed (a lift between floors
// keeps the plan where it was).

import orrin from "./data/orrin.js";
import station from "./data/station.js";
import { DeckView } from "./deck-view.js";
import { indexStation, infoLine, locate } from "./lib/locate.js";
import { buildOrrinModel, orrinHour, orrinKey } from "./lib/orrin.js";
import { pickStation, stationOfDock } from "./lib/stations.js";
import { ModelView } from "./model-view.js";
import { buildOrrinPlans } from "./orrin-deck.js";
import { SpaceView } from "./space-view.js";

const modelEl = document.getElementById("model");
const deckEl = document.getElementById("deck");

function tiss() {
  const index = indexStation(station);
  return { index, model: new ModelView(modelEl, index), deck: new DeckView(deckEl, index), lastLevel: null };
}

function orrinStation() {
  const index = indexStation(orrin);
  const model = new ModelView(modelEl, index, {
    faces: buildOrrinModel(index),
    keyOf: orrinKey,
    hourOf: (where) => orrinHour(index, where),
    labels: false,
  });
  return { index, model, deck: new DeckView(deckEl, index, buildOrrinPlans), lastLevel: null };
}

const stations = { tiss: tiss(), orrin: orrinStation() };
const space = new SpaceView(modelEl);
const info = document.getElementById("info");
const panel = window.panel;

let current = null;
let docked = null; // the station your ship is docked at, from the scene message
let last = null; // the last location message

function show(key) {
  if (key === current) return;
  current = key;
  for (const [k, s] of Object.entries(stations)) {
    s.model.div.style.display = k === key ? "" : "none";
    s.deck.div.style.display = k === key ? "" : "none";
  }
}

function render() {
  show(pickStation(last, docked, current ?? "tiss"));
  const s = stations[current];
  const where = locate(s.index, last, s.lastLevel);
  if (where.kind !== "off") s.lastLevel = where.level;
  s.model.set(where);
  s.deck.set(where);
  s.deck.dim(where.kind === "off");
  info.textContent = infoLine(where, last, s.index);
}

panel.on("settings", (msg) => {
  for (const s of Object.values(stations)) s.model.setTurning(msg?.turn_model !== false);
});

panel.on("scene", (msg) => {
  space.set(msg?.scene);
  docked = stationOfDock(msg?.station);
  render();
});

panel.on("location", (msg) => {
  last = msg;
  render();
});

show("tiss");
panel.post("ready", {});
