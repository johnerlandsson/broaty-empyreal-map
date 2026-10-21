// Panel entry: wires the Lua side's messages to the station model (top), the space scenes that
// replace it while you're out in your ship, and the deck plan (bottom).
// The Lua side holds all state and replays it when we post "ready", so this file keeps only the
// level the plan last showed (a lift between floors keeps the plan where it was).

import station from "./data/station.js";
import { DeckView } from "./deck-view.js";
import { indexStation, infoLine, locate } from "./lib/locate.js";
import { ModelView } from "./model-view.js";
import { SpaceView } from "./space-view.js";

const index = indexStation(station);
const model = new ModelView(document.getElementById("model"), index);
const space = new SpaceView(document.getElementById("model"));
const deck = new DeckView(document.getElementById("deck"), index);
const info = document.getElementById("info");
const panel = window.panel;

let lastLevel = null;

panel.on("settings", (s) => model.setTurning(s?.turn_model !== false));

panel.on("scene", (msg) => space.set(msg?.scene));

panel.on("location", (msg) => {
  const where = locate(index, msg, lastLevel);
  if (where.kind !== "off") lastLevel = where.level;
  model.set(where);
  deck.set(where);
  deck.dim(where.kind === "off");
  info.textContent = infoLine(where, msg, index);
});

panel.post("ready", {});
