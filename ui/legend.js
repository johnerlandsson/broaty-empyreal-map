// The plan's legend (reference/plan-legend-options.png, option B): a ? under the zoom buttons opens
// a sheet over the plan, naming each symbol the plan on show draws. Any click or Escape closes it.
// A plan says which fixtures it has as `legend`; what comes and goes with the rooms is read off
// what it drew.

import { zoomButton } from "./lib/svg.js";
import { BIN, TRAY, WINDOW } from "./lib/marks.js";

const DIM = "#7d8a9a";
const LADDER = "#9fb0c3";
const LIFT = "#cfd8e3";
const GLASS = "#cfe3ff";
const STONE = "#8a8272";

const line = (d, stroke = DIM, w = 1.2) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const round = `<circle r="7" fill="#0e131a" stroke="${LADDER}" stroke-width="1.3"/><circle r="2.8" fill="none" stroke="${LADDER}" stroke-width="1"/>`;
const hatch = `<rect x="-4.5" y="-7" width="9" height="14" rx="1.5" fill="none" stroke="${LADDER}" stroke-width="1.3"/>`;

const drew = (plan, selector) => !!plan.g.querySelector(selector);

// [key, what it's called, its symbol, whether a plan drew it (else it's in the plan's `legend`)], in the sheet's order
const SYMBOLS = [
  ["lift", "Lift", `<circle r="7.5" fill="#0e131a" stroke="${LIFT}" stroke-width="1.5"/><text y="3.5" text-anchor="middle" font-size="10" fill="${LIFT}">⇅</text>`],
  ["ladder", "Ladderway hatch", `${hatch}${line("M-2.5,-3h5M-2.5,0h5M-2.5,3h5", LADDER, 1)}`],
  ["narrow", "Too narrow for a heavy droid", `${hatch}${line("M-3.5,-7v14M3.5,-7v14", LADDER, 2.6)}`, (p) => drew(p, "[data-jambs]")],
  ["hatch", "Hatch up or down", round],
  ["stair", "Stairs up", `<circle r="7" fill="#0e131a" stroke="${LIFT}" stroke-width="1.3"/>${line("M0,-4.5A4.5,4.5 0 1 1 -4.5,0", LIFT, 1)}`],
  ["ramp", "Ramp up", `<rect x="-4.5" y="-7.5" width="9" height="15" rx="1" fill="#0e131a" stroke="${LIFT}" stroke-width="1.3"/>${line("M-2.5,-1L0,-4L2.5,-1M-2.5,4L0,1L2.5,4", LIFT, 1)}`],
  ["airlock", "Airlock", `<rect x="-3" y="-7" width="6" height="14" rx="1.5" fill="#0e131a" stroke="${GLASS}" stroke-width="1.2"/>`, (p) => drew(p, "[data-airlock]")],
  ["stop", "Corridor stop", `<circle r="3.2" fill="#aab8c8"/>`],
  ["tram", "Tram line", line("M-8,4L8,-4", GLASS, 2.4)],
  ["well", "Wellhead", `<circle r="5.5" fill="none" stroke="${STONE}" stroke-width="1.6"/>`],
  ["closed", "Closed room", `<rect x="-7.5" y="-6" width="15" height="12" rx="2" fill="none" stroke="${DIM}" stroke-width="1.2" stroke-dasharray="3 2.5"/>`, (p) => [...p.g.querySelectorAll("text")].some((t) => t.textContent === "closed")],
  ["bin", "Refuse bin", line(BIN), (p) => drew(p, "[data-bin]")],
  ["jobs", "Jobs window", line(WINDOW), (p) => drew(p, '[data-job="jobs"]')],
  ["drop", "Drop point", line(TRAY), (p) => drew(p, '[data-job="drop"]')],
  ["here", "You are here", `<rect x="-7.5" y="-6" width="15" height="12" rx="2" fill="#ffb34755" stroke="#ffb347" stroke-width="1.6"/>`, () => true],
];

/** The symbols a plan draws, in the sheet's order, as [name, its symbol's svg]. */
export function legendOf(plan) {
  return SYMBOLS.filter(([key, , , has]) => plan.legend?.includes(key) || has?.(plan)).map(([, name, svg]) => [name, svg]);
}

/**
 * Add the ? to `zoom`, the plan's zoom buttons, and the sheet it opens over `div`.
 * @param {HTMLElement} div  the deck
 * @param {HTMLElement} zoom
 * @param {() => object} plan  the plan on show
 * @returns {{close: () => void}}
 */
export function attachLegend(div, zoom, plan) {
  let sheet = null;
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  function close() {
    sheet?.remove();
    sheet = null;
    document.removeEventListener("keydown", onKey);
  }
  function open() {
    sheet = document.createElement("div");
    sheet.className = "plan-legend";
    sheet.innerHTML = legendOf(plan()).map(([name, svg]) => `<div><svg viewBox="-9 -9 18 18" aria-hidden="true">${svg}</svg><span>${name}</span></div>`).join("");
    sheet.addEventListener("click", (e) => {
      e.stopPropagation();
      close();
    });
    // the plan under it neither pans nor zooms
    for (const type of ["pointerdown", "wheel"]) sheet.addEventListener(type, (e) => e.stopPropagation());
    div.appendChild(sheet);
    document.addEventListener("keydown", onKey);
  }
  zoomButton(zoom, "?", "What the symbols mean", () => (sheet ? close() : open()));
  return { close };
}
