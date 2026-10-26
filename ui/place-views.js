// A place's views, built the one way for the panel (main.js) and the tweak editor: its 3D overview
// (a ModelView, or a SkyView for a town) in one element and its plan (a DeckView) in another.
// buildPlace picks the builder by name, as the generated index (data/places.js) gives it. A ship's
// plan (data/ships.js) is built the decks way by buildShip, with her name and the lines under her.

import { DeckView } from "./deck-view.js";
import { decksPlans } from "./decks-deck.js";
import { drumPlans } from "./drum-deck.js";
import { buildDecksModel, decksCut, decksKey, indexDecks, locateDecks } from "./lib/decks.js";
import { buildDrumModel, drumHour, drumKey } from "./lib/drum.js";
import { indexStation, locate } from "./lib/locate.js";
import { drumRooms, drumSpec, tissRooms, townData, townSpec } from "./lib/look.js";
import { shipKey } from "./lib/ships.js";
import { indexTown, locateTown, townInfo } from "./lib/town.js";
import { ModelView } from "./model-view.js";
import { captionShip, updateShip } from "./ship-deck.js";
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
  return { index, model, deck: new DeckView(deckEl, index, decksPlans(data), opts), locate: locateDecks };
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

/** A plan's room names with "{name}" filled with the ship's: "Cockpit of the {name}". */
function named(plan, name) {
  return { ...plan, rooms: (plan?.rooms ?? []).map((r) => (typeof r.name === "string" ? { ...r, name: r.name.replaceAll("{name}", name) } : r)) };
}

/**
 * A ship's views from her generated plan: buildPlace's decks views, her rooms' "{name}" filled
 * with `opts.name` (the ship's name; "ship" if none), and her caption and note under the hull.
 * `locate(index, msg)` takes the game's room id aboard, "ship.<n>.<key>", to the plan's
 * "<plan>.<key>"; a key the plan hasn't, or none, is "off": the plan drawn with nothing lit.
 * `update(msg)` lights the room the location message puts you in, sets the lines under the hull,
 * and returns where it put you. Never throws on a message.
 * @param {object} plan a generated plan (data/plans), as lib/ships.js planFor gives it
 */
export function buildShip(plan, modelEl, deckEl, opts = {}) {
  const { name, ...rest } = opts;
  const shipName = typeof name === "string" && name !== "" ? name : "ship";
  const place = buildPlace(named(plan, shipName), "decks", modelEl, deckEl, rest);
  captionShip(place.deck);
  place.deck.setView(place.deck.homeView());
  const locate = (index, msg) => {
    const key = shipKey(msg?.roomId);
    return locateDecks(index, { ...msg, roomId: key ? `${plan.id}.${key}` : undefined });
  };
  return {
    ...place,
    name: shipName,
    locate,
    update(msg) {
      const where = locate(place.index, msg);
      place.deck.set(where);
      updateShip(place.deck, msg);
      return where;
    },
  };
}
