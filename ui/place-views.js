// A place's views, built the one way for the panel (main.js) and the tweak editor: its 3D overview
// (a ModelView, or a SkyView for a town) in one element and its plan (a DeckView) in another.
// buildPlace picks the builder by name, as the generated index (data/places.js) gives it.

import { DeckView } from "./deck-view.js";
import { decksPlans } from "./decks-deck.js";
import { drumPlans } from "./drum-deck.js";
import { buildDecksModel, decksCut, decksKey, indexDecks, locateDecks } from "./lib/decks.js";
import { buildDrumModel, drumHour, drumKey } from "./lib/drum.js";
import { indexStation, locate } from "./lib/locate.js";
import { drumRooms, drumSpec, tissRooms, townData, townSpec } from "./lib/look.js";
import { indexTown, locateTown, townInfo } from "./lib/town.js";
import { ModelView } from "./model-view.js";
import { townPlans } from "./town-deck.js";
import { SkyView } from "./town-view.js";

/** A wheel (T.I.S.S.): its rings, hub and spine. */
function wheel(data, modelEl, deckEl, opts) {
  const index = indexStation(tissRooms(data));
  return { index, model: new ModelView(modelEl, index, { view: data.look?.view, ...opts }), deck: new DeckView(deckEl, index, undefined, opts), locate };
}

/** Wenna Halt: one drum, one plan. */
function drum(data, modelEl, deckEl, opts) {
  const spec = drumSpec(data);
  const index = indexStation({ rooms: drumRooms(data) });
  const model = new ModelView(modelEl, index, {
    faces: buildDrumModel(index, spec),
    keyOf: drumKey,
    hourOf: (where) => drumHour(index, where),
    labels: false,
    view: data.look?.view,
    ...opts,
  });
  return { index, model, deck: new DeckView(deckEl, index, drumPlans(spec), opts), locate };
}

/** Orrin Station and the halts: a box on decks, cut away above your deck; a plan a deck, rooms placed by address. */
function decks(data, modelEl, deckEl, opts) {
  const index = indexDecks(data);
  const model = new ModelView(modelEl, index, {
    faces: buildDecksModel(index, data),
    keyOf: decksKey,
    hourOf: () => null,
    cutOf: (where) => decksCut(index, where),
    labels: false,
    view: data.look?.view,
    ...opts,
  });
  return { index, model, deck: new DeckView(deckEl, index, decksPlans(), opts), locate: locateDecks };
}

/** Zennor: a city on the ground, rooms placed by their compass exits, ⌂ framing your district; its sky over it. */
function town(data, modelEl, deckEl, opts) {
  const spec = townSpec(data);
  const index = indexTown(townData(data), spec);
  return { index, model: new SkyView(modelEl, index, "zennor"), deck: new DeckView(deckEl, index, townPlans(spec), opts), locate: locateTown, info: townInfo };
}

const BUILDERS = { decks, drum, town, wheel };

/** The place's views: {index, model, deck, locate, info?}. `builder` is one of decks, drum, town and wheel;
 *  `opts` goes to the ModelView and the DeckView. `locate(index, msg, lastLevel)` is the place's own. */
export function buildPlace(data, builder, modelEl, deckEl, opts = {}) {
  if (!BUILDERS[builder]) throw new Error(`no such place builder: ${builder}`);
  return BUILDERS[builder](data, modelEl, deckEl, opts);
}
