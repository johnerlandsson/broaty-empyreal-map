// What goes under a ship's plan in the bottom band: her name and class (the caption) and your note
// on her under that. The plan itself is her generated one (ui/data/plans), drawn by the decks
// builder (place-views.js buildShip); this adds the two lines under the hull, clear of her bells,
// and grows the plan's frame to take them.

import { label, DIM } from "./deck-view.js";
import { shipCaption } from "./lib/ships.js";

const CAPTION_FONT = 10;
const NOTE_FONT = 9;
const GAP = 16; // the caption's baseline under her aft-most point
const LINE = 13; // the note's under the caption's
const ROOM = GAP + LINE + 8; // how far the frame reaches under her for the two

/** Put an empty caption and note under each of the deck's plans (a ship's: each has `aft`). */
export function captionShip(deck) {
  for (const plan of deck.plans) {
    const fp = plan.layout?.footprint;
    if (!fp) continue;
    const bottom = Number.isFinite(plan.aft) ? plan.aft : fp.y + fp.h;
    const cx = fp.x + fp.w / 2;
    plan.caption = label(plan.g, cx, bottom + GAP, "", CAPTION_FONT, { fill: DIM });
    plan.note = label(plan.g, cx, bottom + GAP + LINE, "", NOTE_FONT, { fill: DIM, "font-style": "italic" });
    // the frame's bottom edge down to the note, its top where it was
    const below = bottom + ROOM - (plan.home[1] + plan.extent.h / 2);
    if (below > 0) {
      plan.extent = { ...plan.extent, h: plan.extent.h + below };
      plan.home = [plan.home[0], plan.home[1] + below / 2];
    }
  }
}

/** The ship's name and class under the hull, and your note on her under those (`msg.note`: the Lua
 *  side sends it only aboard your own ship). */
export function updateShip(deck, msg) {
  const caption = shipCaption(msg);
  const note = typeof msg?.note === "string" ? msg.note : "";
  for (const plan of deck.plans) {
    if (plan.caption) plan.caption.textContent = caption;
    if (plan.note) plan.note.textContent = note;
  }
}
