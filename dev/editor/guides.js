// What the tweak editor draws on a decks plan to edit by, besides the handles: a grid under the deck's
// plate (option A of docs/maps/reference/editor-grid-options.png), cell edges solid and quarter
// cells faint, seen round the hull; and the hull of the deck above, dashed in amber, and below,
// dotted in teal, over the plan with a ring on each point (option C of editor-ghost-options.png):
// its path where it has one, else its box where it's inside the hull. Those points are what a
// dragged hull point lines up with (snap.js). A card in the plan's corner turns the grid on and off
// and picks the decks shown; the page keeps both across reloads.

import { el } from "../../ui/lib/svg.js";

const ABOVE = "#e8b04a";
const BELOW = "#3fb6b2";
const DARK = "#04060c";
const EDGE = "#3a4a5e"; // a cell's edge
const QUARTER = "#1f2935";
/** How far the grid reaches past the place's cells, in cells. */
const GRID_PAST = 3;
const SHOWS = ["above", "below", "both", "off"];
const KEYS = { grid: "tweak-editor.grid", decks: "tweak-editor.decks" };

const stored = (key, fallback, ok) => {
  try {
    const v = localStorage.getItem(key);
    return v != null && ok(v) ? v : fallback;
  } catch {
    return fallback; // no storage: the defaults each time
  }
};
const store = (key, v) => {
  try {
    localStorage.setItem(key, v);
  } catch {}
};

/**
 * The decks next to the plan's, each shown: {deck, dir, points, path}. `points` are the [x, y] the
 * file gives (a box's corners where it has no path), `path` the outline drawn (rounded corners
 * expanded).
 */
export function neighbours(p, show) {
  const { decks, hull, hullPaths } = p.views.index;
  const level = p.views.deck.level;
  const out = [];
  const add = (deck, dir) => {
    if (deck == null || !hull) return;
    const own = p.data.look?.hull?.[deck];
    if (Array.isArray(own) && own.length >= 3) return out.push({ deck, dir, points: own.map(([x, y]) => [x, y]), path: hullPaths?.[deck] ?? own });
    if (deck < hull.z0 || deck > hull.z1) return; // outside the hull: a blister's deck has none
    // the plate a deck without a path has: the box decksLayout draws round the hull, the same on every deck
    const { footprint: f, cellAt } = p.views.deck.plans[level].layout;
    const tidy = ([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))];
    const [[x0, y1], [x1, y0]] = [cellAt(f.x, f.y), cellAt(f.x + f.w, f.y + f.h)].map(tidy);
    const box = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    out.push({ deck, dir, points: box, path: box, box: true });
  };
  if (show === "above" || show === "both") add(decks[level - 1], "above"); // top deck first
  if (show === "below" || show === "both") add(decks[level + 1], "below");
  return out;
}

/**
 * Starts the guides.
 * @param {{pane: Element, changed: () => void}} deps `pane` holds the plan, for the card;
 *   `changed` is called when a switch on the card changes, for the plan to be drawn again
 * @returns {{draw: (p: object, plan: {g: Element, layout: object}) => void, hide: () => void,
 *   targets: (p: object) => {at: number[], label: string}[], settings: () => {grid: boolean, decks: string}}}
 */
export function createGuides({ pane, changed }) {
  let grid = stored(KEYS.grid, "on", (v) => v === "on" || v === "off") === "on";
  let decks = stored(KEYS.decks, "both", (v) => SHOWS.includes(v));
  let drawn = []; // what the last draw put on the plan

  const card = document.createElement("div");
  card.className = "plan-card";
  card.hidden = true;
  pane.append(card);

  function seg(name, options, on, pick) {
    const s = document.createElement("span");
    s.className = "seg";
    s.dataset.name = name;
    for (const value of options) {
      const o = document.createElement("span");
      o.textContent = value;
      o.dataset.value = value;
      if (value === on) o.className = "on";
      o.addEventListener("click", () => value !== on && pick(value));
      s.append(o);
    }
    return s;
  }

  function renderCard() {
    const label = (text) => Object.assign(document.createElement("span"), { className: "k", textContent: text });
    card.replaceChildren(
      label("grid"),
      seg("grid", ["on", "off"], grid ? "on" : "off", (v) => {
        grid = v === "on";
        store(KEYS.grid, v);
        changed();
      }),
      label("decks"),
      seg("decks", SHOWS, decks, (v) => {
        decks = v;
        store(KEYS.decks, v);
        changed();
      }),
    );
  }

  function drawGrid(plan, index) {
    const { centre } = plan.layout;
    const g = el("g", { class: "grid", "pointer-events": "none" });
    plan.g.insertBefore(g, plan.g.firstChild); // under the plate: seen round the hull, not over the rooms
    const { x0, x1, y0, y1 } = index.grid;
    const [lx, hx, ly, hy] = [x0 - GRID_PAST - 0.5, x1 + GRID_PAST + 0.5, y0 - GRID_PAST - 0.5, y1 + GRID_PAST + 0.5];
    // one path of quarter-cell lines, and one of the cells' edges over it
    const d = ["", ""];
    const line = (a, b, edge) => (d[edge ? 1 : 0] += `M${centre(a).join(",")}L${centre(b).join(",")}`);
    for (let k = 0; k <= (hx - lx) * 4; k++) line({ x: lx + k / 4, y: ly }, { x: lx + k / 4, y: hy }, k % 4 === 0);
    for (let k = 0; k <= (hy - ly) * 4; k++) line({ x: lx, y: ly + k / 4 }, { x: hx, y: ly + k / 4 }, k % 4 === 0);
    el("path", { class: "quarters", d: d[0], fill: "none", stroke: QUARTER, "stroke-width": 0.7 }, g);
    el("path", { class: "edges", d: d[1], fill: "none", stroke: EDGE, "stroke-width": 1 }, g);
    return g;
  }

  function drawDeck(plan, { deck, dir, points, path, box }) {
    const { centre } = plan.layout;
    const colour = dir === "above" ? ABOVE : BELOW;
    const g = el("g", { class: `deck-guide ${dir}`, "pointer-events": "none" }, plan.g);
    g.dataset.deck = String(deck);
    const d = `M${path.map(([x, y]) => centre({ x, y }).join(",")).join("L")}Z`;
    el("path", { d, fill: "none", stroke: colour, "stroke-width": 1.4, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-opacity": 0.85, "stroke-dasharray": dir === "above" ? "7 5" : "1.5 4" }, g);
    for (const [x, y] of points) {
      const [px, py] = centre({ x, y });
      el("circle", { cx: px, cy: py, r: 3.2, fill: DARK, stroke: colour, "stroke-width": 1.2 }, g);
    }
    // named at its fore-starboard-most point
    const [nx, ny] = points.reduce((a, q) => (q[0] + q[1] > a[0] + a[1] ? q : a));
    const [lx, ly] = centre({ x: nx, y: ny });
    el("text", { x: lx - 6, y: ly - 7, "font-size": 10, fill: colour, "text-anchor": "end", "font-family": "Inter, system-ui, sans-serif" }, g, `Deck ${deck} ${dir === "above" ? "▲" : "▼"}${box ? " (box)" : ""}`);
    return g;
  }

  /** Draws the grid and the decks shown on the plan afresh, and shows the card. */
  function draw(p, plan) {
    for (const n of drawn) n.remove();
    drawn = [];
    renderCard();
    card.hidden = false;
    if (grid && p.views.index.grid) drawn.push(drawGrid(plan, p.views.index));
    for (const n of neighbours(p, decks)) drawn.push(drawDeck(plan, n));
  }

  function hide() {
    for (const n of drawn) n.remove();
    drawn = [];
    card.hidden = true;
  }

  /** The points of the decks shown, for a dragged hull point to line up with. */
  const targets = (p) => neighbours(p, decks).flatMap(({ deck, points, box }) => points.map((at, i) => ({ at, label: box ? `Deck ${deck} · box` : `Deck ${deck} · point ${i}` })));

  return { draw, hide, targets, settings: () => ({ grid, decks }) };
}
