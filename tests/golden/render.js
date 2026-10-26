// Every place as the panel draws it, for the golden renders (golden.test.js): built as ui/main.js
// builds it, into a detached 600×400 container, its model still and drawn once, then its plan with
// each level shown in turn; the starfields are left out. Needs a DOM (happy-dom).

import { DeckView } from "../../ui/deck-view.js";
import { decksPlans } from "../../ui/decks-deck.js";
import { drumPlans } from "../../ui/drum-deck.js";
import places, { data } from "../../ui/data/places.js";
import { buildDecksModel, decksCut, decksKey, indexDecks, locateDecks } from "../../ui/lib/decks.js";
import { buildDrumModel, drumHour, drumKey } from "../../ui/lib/drum.js";
import { indexStation, locate } from "../../ui/lib/locate.js";
import { decksSpec, drumRooms, drumSpec, tissRooms, townData, townSpec } from "../../ui/lib/look.js";
import { indexTown, locateTown } from "../../ui/lib/town.js";
import { ModelView } from "../../ui/model-view.js";
import { townPlans } from "../../ui/town-deck.js";
import { SkyView } from "../../ui/town-view.js";

const SKY_AT = Date.parse("2026-10-26T12:00:00Z"); // the one time the sky is drawn at

function box() {
  const div = document.createElement("div");
  Object.assign(div.style, { width: "600px", height: "400px" });
  return div;
}

// the builders of ui/main.js, each into its own pair of containers
function wheel(modelEl, deckEl, data) {
  const index = indexStation(tissRooms(data));
  return { index, model: new ModelView(modelEl, index), deck: new DeckView(deckEl, index), locate };
}

function drum(modelEl, deckEl, data) {
  const spec = drumSpec(data);
  const index = indexStation({ rooms: drumRooms(data) });
  const model = new ModelView(modelEl, index, {
    faces: buildDrumModel(index, spec),
    keyOf: drumKey,
    hourOf: (where) => drumHour(index, where),
    labels: false,
  });
  return { index, model, deck: new DeckView(deckEl, index, drumPlans(spec)), locate };
}

function decks(modelEl, deckEl, data) {
  const spec = decksSpec(data);
  const index = indexDecks(data, spec);
  const model = new ModelView(modelEl, index, {
    faces: buildDecksModel(index, spec),
    keyOf: decksKey,
    hourOf: () => null,
    cutOf: (where) => decksCut(index, where),
    labels: false,
  });
  return { index, model, deck: new DeckView(deckEl, index, decksPlans(spec)), locate: locateDecks };
}

function town(modelEl, deckEl, data) {
  const spec = townSpec(data);
  const index = indexTown(townData(data), spec);
  const model = new SkyView(modelEl, index, "zennor");
  model.draw(SKY_AT);
  return { index, model, deck: new DeckView(deckEl, index, townPlans(spec)), locate: locateTown };
}

// every place from its generated file, by its builder
const BUILDERS = { drum, decks, town, wheel };
const BUILD = Object.fromEntries(places.filter((p) => BUILDERS[p.builder] && data[p.id]).map((p) => [p.id, (m, d) => BUILDERS[p.builder](m, d, data[p.id])]));

// The SVG's markup without its seeded starfield (a constant, whatever the map data), and with the
// glow filter's instance number (which depends on what was built before) as 0.
function plain(svg, stars) {
  const copy = svg.cloneNode(true);
  if (!stars) throw new Error("no starfield to leave out");
  copy.children[[...svg.children].indexOf(stars)].remove();
  return copy.outerHTML.replace(/glow-[a-z]+-\d+/g, "glow-0");
}

const ids = (html) => html.replace(/glow-[a-z]+-\d+/g, "glow-0");

/** What the model lights for where you are: a ModelView's lit faces, its cut deck and that cut's
 *  dashed outline; a SkyView's open-sky flag and the district its skyline's framed on. */
function modelLight(model) {
  if (model instanceof SkyView) return `outdoors=${model.outdoors} district=${model.district}`;
  const wire = model.geo.querySelector("path[stroke-dasharray]");
  return ids(`cut=${model.cut} ${model.hot.outerHTML}${wire?.outerHTML ?? ""}`);
}

/** The place's model and each level of its plan, as SVG markup, then what each room lights. */
export async function renderPlace(id) {
  const { index, model, deck, locate } = BUILD[id](box(), box());
  model.setTurning(false); // nothing to turn yet, but set() below would turn the wheel to each hour
  const plans = deck.plans.map((_, level) => {
    deck.show(level);
    deck.home();
    return plain(deck.svg, deck.svg.querySelector(":scope > defs + g")); // stars() follows the glow's defs
  });
  const sky = model instanceof SkyView; // no backdrop: its stars are drawn only in a sky, and there's none
  const shown = { model: sky ? model.svg.outerHTML : plain(model.svg, model.backdrop), plans };

  // then each room in turn, as main.js's render() places you there: only the lights, kept short
  const highlights = {};
  let lastLevel = null;
  for (const roomId of [...index.byId.keys()].sort()) {
    const msg = { roomId, district: index.byId.get(roomId).district }; // the game sends a town room's district
    const where = locate(index, msg, lastLevel);
    if (where.kind !== "off") lastLevel = where.level;
    model.set(where, msg);
    deck.set(where);
    highlights[roomId] = { level: deck.level, view: deck.svg.getAttribute("viewBox"), plan: ids(deck.plans[deck.level].hl.outerHTML), model: modelLight(model) };
  }
  return { ...shown, highlights };
}
