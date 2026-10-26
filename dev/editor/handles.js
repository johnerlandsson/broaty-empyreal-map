// The tweak editor's drag handles, on a decks place's plan, in an overlay <g class="handles"> over
// the plan's deck: a square mid-way along each side of the selected room's box, dragging that
// side's span (snapped to 0.05 cells, never below 0); the deck's hull path in blue with a square on
// each point and a ring with its r on a rounded one, as row 3 of
// docs/maps/reference/hull-path-options.png (a point drags, snapped to 0.01; a double-click on an
// edge adds one there; a picked point goes on Delete); and a diamond on each cradle's root, which
// drags along its side, and on each mast, which drags in side and frame (snapped to 0.05).
// Footprints only on rooms that aren't passages or blisters (nor drawn by hand, as an outline),
// the hull only on a deck inside it.
// A drag patches the open place's look as it goes, for the page to redraw, and saves on release
// through the panel's save flow; a save refused puts back the look the last build gave. A hull path or
// the fixtures only inherited through `like` are copied into the place's own tweak on its first
// edit, as the ops edit only the place's own.

import { noseAt, pathOf } from "../../ui/lib/footprint.js";
import { pathD } from "../../ui/lib/decks.js";
import { el } from "../../ui/lib/svg.js";
import { addHullPoint, moveFixture, moveHullPoint, removeHullPoint, setFootprint, setHull } from "./ops.js";

const EDIT = "#5aa9ff";
const DARK = "#04060c";
const SQUARE = 9; // a handle's size, in plan units
/** Each footprint side's way out, in cells: x to starboard, y fore. */
const OUT = { fore: [0, 1], aft: [0, -1], port: [-1, 0], starboard: [1, 0] };

/** v to the nearest step, tidied so 0.9 is 0.9, never 0.9000000000000001, and never -0. */
const snap = (v, step) => Number((Math.round(v / step) * step).toFixed(6)) || 0;
const local = (id) => id.slice(id.indexOf(".") + 1);

/** The tweak with the deck's hull path its own: the inherited one copied in where it has none. */
export function ownHull(t, deck, inherited) {
  return Array.isArray(t?.hull?.[deck]) ? t : setHull(t, deck, inherited ?? []);
}

/** The tweak with a fixtures list of its own: the inherited one copied in where it has none. */
export function ownFixtures(t, inherited) {
  if (Array.isArray(t?.fixtures)) return t;
  return { ...structuredClone(t ?? {}), fixtures: structuredClone(inherited ?? []) };
}

/**
 * Starts the handles. Nothing is drawn until draw().
 * @param {{place: () => object | null, resolved: (placeId: string, keyPath: string[]) => {value: unknown},
 *   save: (name: string, edit: (t: object) => object) => Promise<number | undefined>,
 *   preview: (look: object) => void, flush: () => void, restore: (look?: object) => void,
 *   run: (p: Promise<void>) => void, changed: () => void, editable: () => boolean,
 *   showError: (text: string | null) => void}} deps the page's: `preview` sets the open place's
 *   look and redraws it within a frame, `flush` redraws now if one is due, `restore` sets the look
 *   (the last built one, given none) and redraws now; `changed` is called when the picked hull point changes
 * @returns {{draw: () => void, picked: () => number | null, stop: () => void}}
 */
export function createHandles({ place, resolved, save, preview, flush, restore, run, changed, editable, showError }) {
  let layer = null; // the overlay drawn last
  let drag = null; // the drag going on
  let pick = null; // {placeId, deck, i}: the hull point picked

  const deckOf = (p) => p.views.index.decks[p.views.deck.level];
  const layoutOf = (p) => p.views.deck.plans[p.views.deck.level]?.layout;
  const cellOf = (p, e) => layoutOf(p).cellAt(...p.views.deck.toPlan(e.clientX, e.clientY));
  const pathOn = (p, deck) => p.data.look?.hull?.[deck];

  /** The picked point's index, if it's on the plan's deck of the open place. */
  function picked() {
    const p = place();
    if (!p || !pick || pick.placeId !== p.id || pick.deck !== deckOf(p)) return null;
    return pathOn(p, pick.deck)?.[pick.i] ? pick.i : null;
  }

  function setPick(next) {
    pick = next;
    changed();
  }

  /** The look with `key` set to `value` (or removed, for undefined). */
  const lookWith = (look, key, value) => {
    const out = { ...look };
    if (value === undefined) delete out[key];
    else out[key] = value;
    return out;
  };

  /**
   * Saves `edit` of the open place's tweak. If the build refuses it, puts back the last built look:
   * not the one before the edit, which may be an earlier preview still saving, and refused too.
   */
  function commit(edit, { refused } = {}) {
    const id = place().id;
    run(
      save(id, edit).then(({ status, written }) => {
        // a 409 has reloaded the place already
        if (written || status === 409 || place()?.id !== id) return;
        refused?.();
        restore();
      }),
    );
  }

  // --- what each drag changes ---------------------------------------------------------------

  /** The look's footprint for a room with one side's span set to v (0 none), or undefined for none at all. */
  function withSpan(fp, side, v) {
    const next = structuredClone(fp ?? {});
    next.span = { ...next.span };
    if (v) next.span[side] = v;
    else delete next.span[side];
    if (!Object.keys(next.span).length) delete next.span;
    return Object.keys(next).length ? next : undefined;
  }

  const KINDS = {
    span: {
      start: (p, d) => ({ from: p.data.look?.footprints?.[d.local]?.span?.[d.side] ?? 0 }),
      value: (d, [dx, dy]) => Math.max(0, snap(d.from + dx * OUT[d.side][0] + dy * OUT[d.side][1], 0.05)),
      look: (look, d, v) => {
        const fps = { ...look.footprints };
        const fp = withSpan(fps[d.local], d.side, v);
        if (fp) fps[d.local] = fp;
        else delete fps[d.local];
        return lookWith(look, "footprints", fps);
      },
      edit: (p, d, v) => (t) => {
        let fp = withSpan(resolved(p.id, ["footprints", d.local]).value, d.side, v);
        // a span the place would inherit through `like` is overridden with 0, not left to show again
        const like = resolved(p.id, ["like"]).value;
        const base = like ? resolved(like, ["footprints", d.local]).value : undefined;
        if (!v && base?.span?.[d.side]) fp = { ...fp, span: { ...fp?.span, [d.side]: 0 } };
        return setFootprint(t, d.local, fp ?? null);
      },
    },
    point: {
      start: (p, d) => ({ from: pathOn(p, d.deck)[d.i] }),
      value: (d, [dx, dy]) => [snap(d.from[0] + dx, 0.01), snap(d.from[1] + dy, 0.01)],
      look: (look, d, [x, y]) => {
        const points = look.hull[d.deck].map((q, k) => (k !== d.i ? q : q.length === 3 ? [x, y, q[2]] : [x, y]));
        return lookWith(look, "hull", { ...look.hull, [d.deck]: points });
      },
      edit: (p, d, v) => (t) => moveHullPoint(ownHull(t, d.deck, resolved(p.id, ["hull", d.deck]).value), d.deck, d.i, v),
    },
    fixture: {
      start: (p, d) => ({ from: p.data.look.fixtures[d.i] }),
      value: (d, [dx, dy]) =>
        d.from.type === "mast" ? { side: snap(d.from.side + dx, 0.05), frame: snap(d.from.frame + dy, 0.05) } : { side: snap(d.from.side + dx, 0.05) },
      look: (look, d, patch) => lookWith(look, "fixtures", look.fixtures.map((f, k) => (k === d.i ? { ...f, ...patch } : f))),
      edit: (p, d, patch) => (t) => moveFixture(ownFixtures(t, resolved(p.id, ["fixtures"]).value), d.i, patch),
    },
  };

  function begin(e, spec) {
    e.preventDefault();
    e.stopPropagation(); // not a pan, nor a pick
    if (e.button !== 0) return;
    const p = place();
    drag = { ...spec, ...KINDS[spec.kind].start(p, spec), placeId: p.id, at: cellOf(p, e), before: p.data.look, value: undefined };
  }

  function onMove(e) {
    if (!drag) return;
    if (!(e.buttons & 1)) return onUp(); // let go where we didn't hear it
    const p = place();
    if (p?.id !== drag.placeId) return void (drag = null);
    const [x, y] = cellOf(p, e);
    const kind = KINDS[drag.kind];
    const value = kind.value(drag, [x - drag.at[0], y - drag.at[1]]);
    const same = JSON.stringify(value) === JSON.stringify(drag.value ?? kind.value(drag, [0, 0]));
    if (same && drag.value === undefined) return; // not moved off where it started
    drag.value = value;
    preview(kind.look(p.data.look, drag, value));
  }

  function onUp() {
    if (!drag) return;
    const d = drag;
    drag = null;
    flush();
    const p = place();
    if (d.value === undefined || p?.id !== d.placeId) return; // a click
    if (JSON.stringify(d.value) === JSON.stringify(KINDS[d.kind].value(d, [0, 0]))) return restore(d.before); // back where it was
    commit(KINDS[d.kind].edit(p, d, d.value));
  }

  function addPoint(e, deck, i) {
    e.preventDefault();
    e.stopPropagation();
    const p = place();
    const [x, y] = cellOf(p, e);
    const v = [snap(x, 0.01), snap(y, 0.01)];
    const before = p.data.look;
    const points = [...pathOn(p, deck)];
    points.splice(i + 1, 0, v);
    preview(lookWith(before, "hull", { ...before.hull, [deck]: points }));
    flush();
    setPick({ placeId: p.id, deck, i: i + 1 });
    commit((t) => addHullPoint(ownHull(t, deck, resolved(p.id, ["hull", deck]).value), deck, i, v), {
      refused: () => {
        if (pick?.placeId === p.id && pick.deck === deck && pick.i === i + 1) setPick(null);
      },
    });
  }

  function onKey(e) {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (e.target?.closest?.("input, textarea, select")) return;
    const i = picked();
    if (i == null || !editable()) return;
    const p = place();
    const deck = pick.deck;
    const before = p.data.look;
    const points = pathOn(p, deck);
    if (points.length <= 3) return showError("a hull path needs 3 points at least");
    e.preventDefault();
    preview(lookWith(before, "hull", { ...before.hull, [deck]: points.filter((_, k) => k !== i) }));
    flush();
    setPick(null);
    commit((t) => removeHullPoint(ownHull(t, deck, resolved(p.id, ["hull", deck]).value), deck, i));
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKey);

  // --- drawing --------------------------------------------------------------------------------

  /** A square handle at (x, y) that starts a drag of spec; `on` filled. */
  function square(g, name, x, y, spec, on = false) {
    const r = el("rect", { x: x - SQUARE / 2, y: y - SQUARE / 2, width: SQUARE, height: SQUARE, fill: on ? EDIT : DARK, stroke: EDIT, "stroke-width": 1.6, cursor: "move" }, g);
    r.dataset.handle = name;
    if (on) r.classList.add("on");
    r.addEventListener("pointerdown", (e) => begin(e, spec));
    return r;
  }

  function drawFootprint(g, p, layout) {
    const room = p.roomId && p.views.index.byId.get(p.roomId);
    if (!room || room.passage || room.blister || room.footprint?.outline) return; // an outline drawn by hand has no span
    const c = layout.cells.find((x) => x.room.id === room.id && x.kind === "room");
    if (!c) return; // on another deck
    const at = { fore: [c.cx, c.cy - c.h / 2], aft: [c.cx, c.cy + c.h / 2], port: [c.cx - c.w / 2, c.cy], starboard: [c.cx + c.w / 2, c.cy] };
    for (const [side, [x, y]] of Object.entries(at)) square(g, `span-${side}`, x, y, { kind: "span", side, local: local(room.id) });
  }

  function drawHull(g, p, layout, deck) {
    const points = pathOn(p, deck);
    if (!layout.onHull || !Array.isArray(points) || points.length < 3) return;
    const toPlan = ([x, y]) => layout.centre({ x, y });
    const none = { "pointer-events": "none" };
    el("path", { class: "hull-path", d: pathD(pathOf(points).map(toPlan)), fill: "none", stroke: EDIT, "stroke-width": 1.6, "stroke-linejoin": "round", ...none }, g);
    // a wide, unseen line along each edge, to double-click
    points.forEach((q, i) => {
      const [x1, y1] = toPlan(q);
      const [x2, y2] = toPlan(points[(i + 1) % points.length]);
      const line = el("line", { x1, y1, x2, y2, stroke: "transparent", "stroke-width": 12, cursor: "copy" }, g);
      line.dataset.edge = String(i);
      line.addEventListener("pointerdown", (e) => e.stopPropagation()); // not a pan, which would take the double-click
      line.addEventListener("dblclick", (e) => addPoint(e, deck, i));
    });
    const on = picked();
    points.forEach(([x, y, r], i) => {
      const [px, py] = toPlan([x, y]);
      if (r) {
        el("circle", { class: "ring", cx: px, cy: py, r: 13, fill: "none", stroke: EDIT, "stroke-width": 1.4, ...none }, g);
        el("text", { class: "ring-label", x: px - 18, y: py - 16, "font-size": 10, fill: EDIT, "text-anchor": "end", "font-family": "Inter, system-ui, sans-serif", ...none }, g, `r ${r}`);
      }
      const h = square(g, `point-${i}`, px, py, { kind: "point", deck, i }, i === on);
      h.addEventListener("pointerdown", () => {
        if (pick?.placeId !== p.id || pick.deck !== deck || pick.i !== i) setPick({ placeId: p.id, deck, i });
      });
    });
  }

  /** A diamond on each cradle's root on this deck, and on each mast on the top deck. */
  function drawFixtures(g, p, layout, deck) {
    const { hull, hullPaths } = p.views.index;
    if (!hull) return;
    (p.data.look?.fixtures ?? []).forEach((f, i) => {
      let at;
      if (f.type === "cradle" && f.deck === deck) {
        const nose = hullPaths?.[deck] ? noseAt(hullPaths[deck], f.side) : hull.y1 + 0.5;
        if (nose === null) return;
        const [x0, y0] = layout.centre({ x: f.side - f.hw, y: nose + f.len });
        const [x1, y1] = layout.centre({ x: f.side + f.hw, y: nose });
        el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: "none", stroke: EDIT, "stroke-opacity": 0.6, "stroke-width": 1, "stroke-dasharray": "3 3", "pointer-events": "none" }, g);
        at = layout.centre({ x: f.side, y: nose });
      } else if (f.type === "mast" && deck === hull.z1) {
        at = layout.centre({ x: f.side, y: f.frame });
      } else return;
      const [x, y] = at;
      const s = SQUARE * 0.75;
      const d = el("path", { d: `M${x},${y - s}L${x + s},${y}L${x},${y + s}L${x - s},${y}Z`, fill: DARK, stroke: EDIT, "stroke-width": 1.6, cursor: f.type === "mast" ? "move" : "ew-resize" }, g);
      d.dataset.handle = `fixture-${i}`;
      d.addEventListener("pointerdown", (e) => begin(e, { kind: "fixture", i }));
      el("text", { x: x + s + 3, y: y - s - 2, "font-size": 9, fill: EDIT, "font-family": "Inter, system-ui, sans-serif", "pointer-events": "none" }, g, f.type);
    });
  }

  /** Draws the handles over the plan's deck afresh; none off decks, or while the tweak file is broken. */
  function draw() {
    layer?.remove();
    layer = null;
    const p = place();
    if (!p || p.builder !== "decks" || !editable()) return;
    const plan = p.views.deck.plans[p.views.deck.level];
    if (!plan?.layout) return;
    const deck = deckOf(p);
    layer = el("g", { class: "handles" }, plan.g);
    drawFootprint(layer, p, plan.layout);
    drawHull(layer, p, plan.layout, deck);
    drawFixtures(layer, p, plan.layout, deck);
  }

  function stop() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    window.removeEventListener("keydown", onKey);
  }

  return { draw, picked, stop };
}
