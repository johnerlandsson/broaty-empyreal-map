// Every place as the panel draws it, for the golden renders (golden.test.js): built as ui/main.js
// builds it, into a detached 600×400 container, its model still and drawn once, then its plan with
// each level shown in turn; the starfields are left out. Needs a DOM (happy-dom).

import places, { data } from "../../ui/data/places.js";
import { buildPlace } from "../../ui/place-views.js";
import { SkyView } from "../../ui/town-view.js";

const SKY_AT = Date.parse("2026-10-26T12:00:00Z"); // the one time the sky is drawn at

function box() {
  const div = document.createElement("div");
  Object.assign(div.style, { width: "600px", height: "400px" });
  return div;
}

// every place from its generated file, by its builder
const BUILD = Object.fromEntries(
  places.filter((p) => data[p.id]).map((p) => [
    p.id,
    (modelEl, deckEl) => {
      const place = buildPlace(data[p.id], p.builder, modelEl, deckEl);
      if (place.model instanceof SkyView) place.model.draw(SKY_AT);
      return place;
    },
  ]),
);

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
