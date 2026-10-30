// Whether a heavy droid fits an opening, from the opening's `clear` and the heavy frame's width
// (data/frames.js, from the game's frames.yaml). Only ever says fits or not, never a width: help
// droids tells the player no more.

import frames from "../data/frames.js";

/** Whether a heavy droid goes through an opening `clear` wide. */
export const heavyFits = (clear) => clear >= frames.heavyWidth;

/** A tooltip row saying if a heavy droid fits `what` ("her airlock"), `clear` wide. */
export const heavyRow = (what, clear) => ({ label: "Heavy droid", value: `${heavyFits(clear) ? "fits" : "too wide for"} ${what}` });
