// Shortest-turn maths for the self-turning station model. Pure; no DOM.

import { FRONT } from "./geometry.js";

/**
 * The roll target closest to `phi` that brings `hour` round to `front`,
 * i.e. `(target + hour) ≡ front (mod 12)`. The result stays in the same
 * continuous (unwrapped) space as `phi`, so it may lie outside 0..12.
 */
export function shortestTurn(phi, hour, front = FRONT) {
  const d = front - hour - phi;
  return phi + (d - 12 * Math.round(d / 12));
}

/** Animation time in milliseconds for a turn of `deltaHours`. */
export const turnDuration = (deltaHours) => 350 + 120 * Math.abs(deltaHours);
