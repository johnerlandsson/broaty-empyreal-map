// The tweak editor's side panel (the right column of layout A in
// docs/maps/reference/tweak-editor-options.png): the selected room, as the game gives it, then its
// paint and footprint; below, the place's view. Each value says where it comes from ("set here",
// or "from <place>" through `like`) and, where it's the place's own, has a reset.
// Every change runs one of ops.js's edits on the place's own tweak and is kept unsaved
// (pending.js), once the server's trial build of every unsaved file with it passes; the page
// previews that trial. One the trial refuses (422) shows its message in the bar at the plan's foot
// and puts the inputs back, and is dropped. A value unsaved is marked so, in amber. Save PUTs every
// unsaved file with the version it was read at, in one build; Discard drops them all. A save beaten
// by a hand edit (409) reads the state again and takes the edits over to the file as it is now,
// trying them again; so does a build the server announces, a hand edit's. One written whose
// rebuild of ui/data then failed (a 500 with versions) is held as saved, its message shown.
// What each kind of place allows matches the build: footprints only on decks rooms that aren't
// passages or blisters, a cutaway and a hull only on decks, a camera on anything but a town.
// The hull section is the plan's deck's: a path made round the rooms' footprints or back to the
// box, and the r of the point picked on the plan (handles.js draws and drags the path).
// A ship plan has a ship section: a switch for each detail of the hull's look (the profile's
// bevel, nose drop and spine; the surface's seams, windows, stripe and nav lights), the stripe's
// colour, and its greebles, each with a remove, and an add. A switch turned off sets the detail's
// "none" (0, null, false or []); turned on, it removes that again where what's left (inherited or
// the default) is on, else sets the default's value. handles.js drags the greebles.

import { CAM } from "../../ui/lib/geometry.js";
import { CORNER_R } from "../../ui/lib/footprint.js";
import { GREEBLE_KEYS, PALETTE_NAME, PROFILE_DEFAULTS, SURFACE_DEFAULTS } from "../../scripts/source/schema.mjs";
import { hullFromRooms, roomPieces } from "./hull.js";
import { ownGreebles, ownHull } from "./handles.js";
import { addGreeble, boxHull, origin, removeGreeble, reset, setFootprint, setHull, setHullCorner, setPaint, setProfile, setSurface, setView } from "./ops.js";
import { countOf, jsonOf, markedStale, rebased, staleOf, withEdit } from "./pending.js";

const CORNERS = ["square", "rounded", "cut"];
const CUTAWAYS = [
  ["off", "off"],
  ["hide-above", "hide above"],
  ["ghost-above", "ghost above"],
];
const SPANS = [
  ["fore", "fore"],
  ["aft", "aft"],
  ["port", "port"],
  ["starboard", "stbd"],
];

const h = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const local = (id) => id.slice(id.indexOf(".") + 1);
const round = (n, places = 2) => Number(n.toFixed(places));
/** n to the nearest 0.05, tidied. */
const snap = (n) => Number((Math.round(n / 0.05) * 0.05).toFixed(2)) || 0;

/**
 * Each hull-look detail a switch turns on and off: its section, key and label, its value for off,
 * and whether a value is on.
 */
const DETAILS = [
  ["profile", "bevel", "bevel", 0, (v) => v > 0],
  ["profile", "noseDrop", "nose drop", 0, (v) => v > 0],
  ["profile", "spine", "spine", null, (v) => v != null],
  ["surface", "seams", "seams", false, (v) => v !== false],
  ["surface", "windows", "windows", [], (v) => !Array.isArray(v) || v.length > 0],
  ["surface", "stripe", "stripe", null, (v) => v != null],
  ["surface", "navLights", "nav lights", false, (v) => v !== false],
];
const DEFAULTS = { profile: PROFILE_DEFAULTS, surface: SURFACE_DEFAULTS };
/** A number input's value, or undefined when it's empty or not a number. */
const numberOf = (input) => (input.value.trim() === "" || !Number.isFinite(Number(input.value)) ? undefined : Number(input.value));

/**
 * Starts the panel in its two elements.
 * @param {{inspector: Element, view: Element, send: (method: string, url: string, body: object) => Promise<{status: number, body: object}>,
 *   place: () => object | null, state: () => object, refresh: () => Promise<void>, showError: (text: string | null) => void,
 *   run: (p: Promise<void>) => void, tried: (trial: {trial: number, changed: string[]} | null) => Promise<void>,
 *   changedPending?: () => void, hullPoint?: () => number | null}} deps `place` and `state` are the
 *   page's; `refresh` re-reads the state; `run` is handed each change and save, for the page's
 *   `busy`; `tried` has the page preview a trial of the unsaved edits (null: none, ui/data as it
 *   is); `changedPending` is called when the unsaved edits or the checking of them change;
 *   `hullPoint` is the point of the plan's deck's path picked on the plan.
 * @returns {{render: () => void, change: (name: string, edit: (t: object) => object) => Promise<{ok: boolean}>,
 *   saveAll: () => Promise<void>, discard: () => Promise<void>, rebase: () => Promise<void>,
 *   pending: () => {count: number, files: [string, number][], stale: string[], checking: boolean},
 *   resolved: (placeId: string, keyPath: string[]) => {value: unknown, from: string | null, own: boolean},
 *   broken: (name: string) => string | null}} `change` resolves to whether the edit was kept
 */
export function createPanel({
  inspector,
  view,
  send,
  place: currentPlace,
  state: currentState,
  refresh,
  showError,
  run,
  tried,
  changedPending = () => {},
  hullPoint = () => null,
}) {
  let queue = Promise.resolve();
  let pending = {}; // pending.js's: the unsaved edits, by tweak file
  let checking = 0; // trials and saves under way

  /**
   * The tweaks as scripts/source/tweaks.mjs takes them: the palette and each place's own JSON,
   * each with its unsaved edits, or (`saved`) as last read.
   */
  function tweaks({ saved = false } = {}) {
    const s = currentState();
    const json = (name) => (!saved && pending[name] ? pending[name].json : s.tweaks?.[name]?.json);
    const places = {};
    for (const name of new Set([...Object.keys(s.tweaks ?? {}), ...Object.keys(pending)])) if (name !== "palette") places[name] = json(name) ?? {};
    return { palette: (saved || !pending.palette ? s.palette : pending.palette.json) ?? {}, places };
  }

  /** The palette, with its unsaved colours. */
  const palette = () => tweaks().palette;

  /** The value at [key, sub] of a place's tweaks as `tweaks` resolves them, and where it comes from. */
  function resolvedIn(t, placeId, keyPath) {
    const { from, own } = origin(t, placeId, keyPath);
    const [key, sub] = keyPath;
    const value = from ? (sub === undefined ? t.places[from][key] : t.places[from][key]?.[sub]) : undefined;
    return { value, from, own };
  }

  /** The place's resolved value at [key, sub], unsaved edits and all, and where it comes from: {value, from, own}. */
  function resolved(placeId, keyPath) {
    const t = tweaks();
    return resolvedIn(t, placeId, keyPath);
  }

  /** Whether the place's resolved value at [key, sub] differs from what's saved. */
  const unsaved = (placeId, keyPath) =>
    JSON.stringify(resolvedIn(tweaks(), placeId, keyPath)) !== JSON.stringify(resolvedIn(tweaks({ saved: true }), placeId, keyPath));

  const entryOf = (name) => currentState().tweaks?.[name] ?? { json: {}, version: 0 };
  const brokenError = (name) => currentState().tweaks?.[name]?.error ?? null;

  /** Runs `job` after every change and save before it, for the page's `busy`; it's checking meanwhile. */
  function enqueue(job) {
    const step = queue.then(async () => {
      checking++;
      changedPending();
      try {
        return await job();
      } finally {
        checking--;
        changedPending();
      }
    });
    queue = step.then(
      () => {},
      () => {},
    );
    run(queue);
    return step;
  }

  /**
   * Tries `next` as the unsaved edits with a trial build of every file in it; on a pass, makes it
   * the unsaved edits and has the page preview the trial. Resolves to the trial's error, or null.
   */
  async function tryOut(next) {
    if (!Object.keys(next).length) {
      pending = next;
      await tried(null);
      return null;
    }
    const { status, body } = await send("POST", "/api/trial", { files: jsonOf(next) });
    if (status !== 200) return body?.error ?? `POST /api/trial: ${status}`;
    pending = next;
    await tried({ trial: body.trial, changed: body.changed ?? [] });
    return null;
  }

  /**
   * Makes `edit` of a tweak file's own JSON (a place's, or "palette"), unsaved edits and all, after
   * any change before it; kept unsaved if a trial build of it and the rest passes.
   */
  function change(name, edit) {
    return enqueue(async () => {
      if (brokenError(name)) {
        render();
        return { ok: false };
      }
      let error;
      try {
        error = await tryOut(withEdit(pending, name, entryOf(name), edit));
      } catch (err) {
        error = err.message;
      }
      showError(error);
      render();
      return { ok: !error };
    });
  }

  /**
   * Takes the unsaved edits on each file changed on disk over to the file as it is now (read by the
   * page's last `refresh`), and tries them all again. Says what it did in the bar.
   */
  async function rebaseNow() {
    const { pending: next, moved, stale } = rebased(pending, currentState().tweaks ?? {});
    if (!moved.length && !stale.length && Object.keys(next).length === Object.keys(pending).length) return;
    const files = (names) => names.map((n) => `data/tweaks/${n}.json`).join(", ");
    let error;
    try {
      error = await tryOut(next);
    } catch (err) {
      error = err.message;
    }
    if (error) {
      // the edits ran but don't build over what's there now: kept, but not to be saved
      pending = markedStale(next, moved, error);
      await tried(null);
    }
    const lines = [];
    if (moved.length) lines.push(`${files(moved)} changed on disk; your unsaved edits are now on top of it`);
    if (error) lines.push(`and no longer build: ${error}`);
    for (const n of stale) lines.push(`data/tweaks/${n}.json changed on disk, and your unsaved edits to it no longer apply: ${pending[n].stale}`);
    if (staleOf(pending).length) lines.push("Discard to take the files as they are.");
    showError(lines.join("\n") || null);
    render();
  }

  /** rebaseNow after any change or save under way. */
  const rebase = () => enqueue(rebaseNow);

  /** Saves every unsaved file, with the version each was read at, in one build; none if any is stale. */
  function saveAll() {
    return enqueue(async () => {
      const names = Object.keys(pending);
      if (!names.length) return;
      const stale = staleOf(pending);
      if (stale.length) return showError(`${stale.map((n) => `data/tweaks/${n}.json`).join(", ")}: your unsaved edits no longer apply over the file on disk. Discard them first.`);
      const files = Object.fromEntries(names.map((n) => [n, { json: pending[n].json, version: pending[n].version }]));
      const { status, body } = await send("PUT", "/api/tweaks", { files });
      // any reply with versions but a 409 wrote the files: a 200, or a 500 whose rebuild failed
      if (status !== 409 && body?.versions) {
        const s = currentState();
        s.tweaks ??= {};
        for (const n of names) s.tweaks[n] = { json: files[n].json, version: body.versions[n] };
        if (files.palette) s.palette = files.palette.json;
        pending = {};
        await tried(null);
        showError(status === 200 ? null : (body.error ?? `PUT /api/tweaks: ${status}`));
      } else if (status === 409) {
        // nothing written: a file was changed by hand since it was read
        await refresh();
        await rebaseNow();
      } else showError(body?.error ?? `PUT /api/tweaks: ${status}`);
      render();
    });
  }

  /** Drops every unsaved edit. */
  function discard() {
    return enqueue(async () => {
      pending = {};
      await tried(null);
      showError(null);
      render();
    });
  }

  /** What's unsaved: how many edits, each file with its count, the stale ones, and whether a check is under way. */
  const summary = () => ({
    count: countOf(pending),
    files: Object.entries(pending).map(([n, p]) => [n, p.edits.length]),
    stale: staleOf(pending),
    checking: checking > 0,
  });

  /** "set here · reset", "from <place>" or "default", for the value at keyPath. */
  function mark(placeId, keyPath, disabled) {
    const { from, own } = origin(tweaks(), placeId, keyPath);
    const pend = unsaved(placeId, keyPath);
    const m = h("span", `${own ? "own" : "inh"}${pend ? " pend" : ""}`);
    m.dataset.key = keyPath.join(".");
    if (own) {
      m.append(pend ? "● unsaved" : "● set here");
      if (!disabled) {
        m.append(" · ");
        const r = h("u", "reset", "reset");
        r.addEventListener("click", () => change(placeId, (t) => reset(t, keyPath)));
        m.append(r);
      }
    } else m.append(`${pend ? "● unsaved · " : ""}${from ? `from ${from}` : "default"}`);
    return m;
  }

  function row(label, ...content) {
    const r = h("div", "row");
    r.append(h("span", null, label), ...content);
    return r;
  }

  /** A segmented choice; `on` lit, `pick(value)` on a click of another (it's lit at once). */
  function seg(name, options, on, disabled, pick) {
    const s = h("span", "seg");
    s.dataset.name = name;
    for (const [value, label] of options) {
      const o = h("span", value === on ? "on" : null, label);
      o.dataset.value = value;
      o.addEventListener("click", () => {
        if (disabled || value === on) return;
        for (const x of s.children) x.classList.toggle("on", x === o);
        pick(value);
      });
      s.append(o);
    }
    if (disabled) s.classList.add("off");
    return s;
  }

  function numberInput(name, value, { step, min, placeholder, disabled }, change) {
    const i = h("input", "num");
    i.type = "number";
    i.name = name;
    i.step = String(step);
    if (min != null) i.min = String(min);
    if (placeholder != null) i.placeholder = String(placeholder);
    i.defaultValue = value == null ? "" : String(value); // what's saved; a value unlike it is still being typed
    i.disabled = disabled;
    i.addEventListener("change", () => {
      i.defaultValue = i.value; // committed: a redraw shows what's saved, not this
      change(numberOf(i));
    });
    return i;
  }

  function renderRoom(p, room, disabled) {
    const id = local(room.id);
    const full = p.data.rooms?.find((r) => r.id === room.id) ?? room;
    const nameOf = (rid) => p.data.rooms?.find((r) => r.id === rid)?.name ?? rid;

    inspector.append(h("div", "h", full.name ?? room.id));
    inspector.append(h("div", "id", full.address ? `${room.id} · ${full.address}` : room.id));

    inspector.append(h("div", "sec", "From the game · read only"));
    const exits = Object.entries(full.exits ?? {});
    const exitList = h("span", "exits");
    for (const [dir, to] of exits) exitList.append(h("span", null, `${dir} → ${nameOf(to)}`));
    if (!exits.length) exitList.append("none");
    const exitRow = row("exits", exitList);
    exitRow.classList.add("ro");
    inspector.append(exitRow);
    const flagRow = row("flags", h("span", null, full.flags?.length ? full.flags.join(", ") : "none"));
    flagRow.classList.add("ro");
    inspector.append(flagRow);

    // paint
    inspector.append(h("div", "sec", "Paint"));
    const paint = resolved(p.id, ["paint", id]);
    const current = paint.value ?? p.data.look?.paint?.[id];
    const sw = h("span", "sw");
    for (const [name, colour] of Object.entries(palette())) {
      const i = h("i", name === current ? "on" : null);
      i.title = name;
      i.style.background = colour;
      i.addEventListener("click", () => {
        if (disabled || name === current) return;
        for (const x of sw.children) x.classList.toggle("on", x === i);
        change(p.id, (t) => setPaint(t, id, name));
      });
      sw.append(i);
    }
    const paintRow = h("div", "row wrap");
    paintRow.append(sw, mark(p.id, ["paint", id], disabled));
    inspector.append(paintRow);

    const paletteBroken = brokenError("palette");
    const name = h("input", "txt");
    name.name = "colour-name";
    name.placeholder = "new colour";
    const colour = h("input", "colour");
    colour.type = "color";
    colour.name = "colour";
    colour.defaultValue = "#8796a8";
    const add = h("button", "btn add-colour", "add");
    add.name = "add-colour";
    for (const x of [name, colour, add]) x.disabled = !!paletteBroken;
    add.addEventListener("click", () => {
      const n = name.value.trim();
      if (!n) return showError("a new colour needs a name");
      if (!PALETTE_NAME.test(n)) return showError(`${JSON.stringify(n)} is not a palette name: lower-case letters, digits and hyphens, starting with a letter`);
      if (Object.hasOwn(palette(), n)) return showError(`the palette already has ${n}`);
      name.defaultValue = name.value;
      colour.defaultValue = colour.value;
      change("palette", (t) => ({ ...t, [n]: colour.value }));
    });
    const addRow = h("div", "row");
    const addTools = h("span", "tools");
    addTools.append(name, colour, add);
    addRow.append(h("span", null, "add colour"), addTools);
    inspector.append(addRow);

    // footprint
    const index = p.views.index.byId.get(room.id);
    if (p.builder !== "decks" || index?.passage || index?.blister) return;
    const sec = h("div", "sec", "Footprint");
    sec.dataset.sec = "footprint";
    inspector.append(sec);
    const fp = resolved(p.id, ["footprints", id]).value ?? null;
    const footprint = (patch) =>
      change(p.id, (t) => {
        const next = structuredClone(resolved(p.id, ["footprints", id]).value ?? {});
        patch(next);
        if (next.span && !Object.keys(next.span).length) delete next.span;
        return setFootprint(t, id, Object.keys(next).length ? next : null);
      });

    const spans = h("span", "spans");
    for (const [key, label] of SPANS) {
      const l = h("label", null, label);
      l.append(
        numberInput(key, fp?.span?.[key], { step: 0.05, min: 0, placeholder: 0, disabled }, (n) =>
          footprint((next) => {
            next.span ??= {};
            if (n) next.span[key] = n;
            else delete next.span[key];
          }),
        ),
      );
      spans.append(l);
    }
    inspector.append(row("span", spans));
    inspector.append(
      row(
        "corners",
        seg("corners", CORNERS.map((c) => [c, c]), fp?.corners ?? "square", disabled, (c) =>
          footprint((next) => {
            if (c === "square") delete next.corners;
            else next.corners = c;
          }),
        ),
      ),
    );
    inspector.append(
      row(
        "r",
        numberInput("r", fp?.r, { step: 0.05, min: 0, placeholder: CORNER_R, disabled }, (n) =>
          footprint((next) => {
            if (n === undefined) delete next.r;
            else next.r = n;
          }),
        ),
      ),
    );
    if (fp?.outline) inspector.append(h("div", "note", "An outline drawn by hand replaces the span and corners."));
    const fpMark = h("div", "row");
    fpMark.append(h("span"), mark(p.id, ["footprints", id], disabled));
    inspector.append(fpMark);
  }

  function renderView(p, disabled) {
    view.append(h("div", "sec", p?.kind === "plan" ? "View · whole ship" : "View · whole station"));
    if (!p) return;
    if (p.builder === "decks") {
      const cut = resolved(p.id, ["view", "cutaway"]);
      view.append(row("cutaway", seg("cutaway", CUTAWAYS, cut.value ?? "hide-above", disabled, (c) => change(p.id, (t) => setView(t, { cutaway: c })))));
      const m = h("div", "row");
      m.append(h("span"), mark(p.id, ["view", "cutaway"], disabled));
      view.append(m);
    }
    if (p.builder === "town") return;
    const camera = () => ({ ...CAM, zoom: 1, ...resolved(p.id, ["view", "camera"]).value });
    const cam = camera();
    // the camera as it is when the change runs, after any before it
    const setCam = (patch) => change(p.id, (t) => setView(t, { camera: { ...camera(), ...patch } }));
    const inputs = h("span", "spans");
    for (const [key, step] of [
      ["yaw", 1],
      ["pitch", 1],
      ["zoom", 0.05],
    ]) {
      const l = h("label", null, key);
      l.append(numberInput(key, cam[key], { step, min: key === "zoom" ? step : null, disabled }, (n) => (n === undefined ? render() : setCam({ [key]: n }))));
      inputs.append(l);
    }
    view.append(row("camera", inputs));
    const fromView = h("button", "btn zoom-from-view", "set zoom from current view");
    fromView.name = "zoom-from-view";
    fromView.disabled = disabled;
    fromView.addEventListener("click", () => {
      const { home, vb } = p.views.model;
      if (!home || !vb?.[2]) return;
      // home is the whole model's framing over the zoom the overview was built with
      const built = p.data.look?.view?.camera?.zoom ?? 1;
      setCam({ zoom: round((built * home[2]) / vb[2]) });
    });
    const m = h("div", "row");
    m.append(fromView, mark(p.id, ["view", "camera"], disabled));
    view.append(m);
  }

  /** The plan's deck's hull: its path from the rooms or back to the box, and the picked point's r. */
  function renderHull(p, disabled) {
    const { index } = p.views;
    const deck = index.decks[p.views.deck.level];
    const layout = p.views.deck.plans[p.views.deck.level]?.layout;
    if (deck == null || !layout?.onHull) return;
    const key = String(deck);
    const sec = h("div", "sec", `Hull · Deck ${deck}`);
    sec.dataset.sec = "hull";
    view.append(sec);
    const points = p.data.look?.hull?.[key];
    const path = () => resolved(p.id, ["hull", key]).value;
    const button = (name, text, click) => {
      const b = h("button", "btn", text);
      b.name = name;
      b.disabled = disabled;
      b.addEventListener("click", click);
      return b;
    };
    const m = h("div", "row");
    if (!Array.isArray(points) || !points.length) {
      m.append(
        button("hull-from-rooms", "make hull from rooms", () => {
          // round the footprints as built, the place's own and those through like
          const footprints = p.data.look?.footprints ?? {};
          const traced = hullFromRooms(index, deck, footprints);
          if (!traced.length) return showError(`Deck ${deck} has no rooms to make a hull from`);
          const pieces = roomPieces(index, deck, footprints);
          const step = change(p.id, (t) => setHull(t, key, traced)).then(({ ok }) => {
            if (ok && pieces > 1) showError(`warning: the rooms on Deck ${deck} make ${pieces} pieces; the hull goes round the largest only`);
          });
          run(step);
        }),
      );
    } else {
      m.append(
        button("hull-box", "back to the box", () => {
          const like = tweaks().places[p.id]?.like;
          const inherited = !!like && Array.isArray(resolved(like, ["hull", key]).value);
          change(p.id, (t) => boxHull(t, key, inherited));
        }),
      );
    }
    m.append(mark(p.id, ["hull", key], disabled));
    view.append(m);
    if (!Array.isArray(points) || !points.length) return;
    const i = hullPoint();
    if (i != null && points[i]) {
      view.append(
        row(
          `point ${i} r`,
          numberInput("hull-r", points[i][2], { step: 0.05, min: 0, placeholder: 0, disabled }, (n) =>
            change(p.id, (t) => setHullCorner(ownHull(t, key, path()), key, i, n ?? 0)),
          ),
        ),
      );
    }
    view.append(h("div", "note", "Drag a point to move it, double-click an edge to add one; Delete removes the picked one."));
  }

  /** A ship plan's look: a switch for each detail of the hull, the stripe's colour, and the greebles. */
  function renderShip(p, disabled) {
    const sec = h("div", "sec", "Ship · hull look");
    sec.dataset.sec = "ship";
    view.append(sec);
    const canopies = () => (p.data.rooms ?? []).filter((r) => r.canopy).map((r) => local(r.id));
    const like = () => tweaks().places[p.id]?.like;
    /** A detail's value as the place resolves it (its own, else through like, else the default). */
    const valueOf = (from, section, key) => {
      const v = from ? resolved(from, [section, key]).value : undefined;
      if (v !== undefined) return v;
      return section === "surface" && key === "windows" ? canopies() : DEFAULTS[section][key];
    };
    // a spine where the plan has none: down the middle third of the hull's box, half its width
    const spine = () => {
      const { x0, x1, y0, y1 } = p.views.index.hull;
      const mid = (y0 + y1) / 2;
      return { from: snap(mid - (y1 - y0) / 6), to: snap(mid + (y1 - y0) / 6), width: snap((x1 - x0) / 2), height: 0.3 };
    };
    const onValue = (section, key) => {
      if (key === "spine") return spine();
      if (key === "windows") return canopies().length ? canopies() : (p.data.rooms ?? []).map((r) => local(r.id));
      return structuredClone(DEFAULTS[section][key]);
    };
    const setOf = { profile: setProfile, surface: setSurface };

    for (const [section, key, label, off, isOn] of DETAILS) {
      const box = h("input");
      box.type = "checkbox";
      box.name = `${section}-${key}`;
      box.checked = isOn(valueOf(p.id, section, key));
      box.disabled = disabled;
      box.addEventListener("change", () =>
        change(p.id, (t) => {
          const set = setOf[section];
          if (!box.checked) return set(t, { [key]: off });
          // on: the place's own value goes, where what's left is on; else the default's is set
          return isOn(valueOf(like(), section, key)) ? set(t, { [key]: undefined }) : set(t, { [key]: onValue(section, key) });
        }),
      );
      const l = h("label", "switch");
      l.append(box, ` ${label}`);
      const r = h("div", "row");
      r.append(l, mark(p.id, [section, key], disabled));
      view.append(r);
    }

    // the stripe's colour
    const stripe = valueOf(p.id, "surface", "stripe");
    if (stripe) {
      const sw = h("span", "sw stripe");
      for (const [name, colour] of Object.entries(palette())) {
        const i = h("i", name === stripe.paint ? "on" : null);
        i.title = name;
        i.style.background = colour;
        i.addEventListener("click", () => {
          if (disabled || name === stripe.paint) return;
          for (const x of sw.children) x.classList.toggle("on", x === i);
          change(p.id, (t) => setSurface(t, { stripe: { ...valueOf(p.id, "surface", "stripe"), paint: name } }));
        });
        sw.append(i);
      }
      view.append(row("stripe colour", sw));
    }

    // the greebles
    const gsec = h("div", "sec", "Greebles");
    gsec.dataset.sec = "greebles";
    view.append(gsec);
    const greebles = () => resolved(p.id, ["greebles"]).value ?? [];
    const own = (t) => ownGreebles(t, greebles());
    greebles().forEach((g, i) => {
      const b = h("button", "btn", "remove");
      b.name = `greeble-remove-${i}`;
      b.disabled = disabled;
      b.addEventListener("click", () => change(p.id, (t) => removeGreeble(own(t), i)));
      view.append(row(`${g.type} · ${g.side}, ${g.frame}`, b));
    });
    const type = h("select", "btn");
    type.name = "greeble-type";
    for (const name of Object.keys(GREEBLE_KEYS)) {
      const o = h("option", null, name);
      o.value = name;
      type.append(o);
    }
    type.disabled = disabled;
    const add = h("button", "btn", "add greeble");
    add.name = "greeble-add";
    add.disabled = disabled;
    add.addEventListener("click", () => {
      // on the centre line, half way along the hull's box; dragged from there on the plan
      const { y0, y1 } = p.views.index.hull;
      const g = { type: type.value, side: 0, frame: snap((y0 + y1) / 2) };
      if (g.type === "antenna") g.height = 0.6;
      if (g.type === "dish") g.r = 0.15;
      change(p.id, (t) => addGreeble(own(t), g));
    });
    const tools = h("span", "tools");
    tools.append(type, add);
    const m = h("div", "row");
    m.append(tools, mark(p.id, ["greebles"], disabled));
    view.append(m);
    view.append(h("div", "note", "Drag a greeble, a bell or the boom on the plan to move it."));
  }

  let drawn = null; // the place and room last drawn: "<place>/<room>"

  /**
   * The panel's inputs as they are, by name: each one's value where it's still being typed (unlike
   * its saved defaultValue), each picker's choice (the greeble type), and which has the focus, with
   * its caret.
   */
  function held() {
    const typed = new Map();
    for (const i of [...inspector.querySelectorAll("input[name]"), ...view.querySelectorAll("input[name]")]) {
      if (i.value !== i.defaultValue) typed.set(i.name, i.value);
    }
    for (const s of [...inspector.querySelectorAll("select[name]"), ...view.querySelectorAll("select[name]")]) typed.set(s.name, s.value);
    const a = document.activeElement;
    const focused = a?.name && (inspector.contains(a) || view.contains(a)) ? a : null;
    let caret = null;
    try {
      caret = focused && focused.selectionStart != null ? [focused.selectionStart, focused.selectionEnd] : null;
    } catch {} // number inputs have no caret to read
    return { typed, focus: focused?.name ?? null, caret };
  }

  function restore({ typed, focus, caret }) {
    const named = (n) => inspector.querySelector(`[name="${n}"]`) ?? view.querySelector(`[name="${n}"]`);
    for (const [n, value] of typed) {
      const i = named(n);
      if (i && !i.disabled) i.value = value;
    }
    const f = focus && named(focus);
    if (!f || f.disabled) return;
    f.focus();
    try {
      if (caret) f.setSelectionRange(...caret);
    } catch {}
  }

  /** Draws the panel afresh; on the same place and room, keeping what's being typed and the focus. */
  function render() {
    const p0 = currentPlace();
    const key = p0 ? `${p0.id}/${p0.roomId ?? ""}` : null;
    const keep = key === drawn && inspector.isConnected ? held() : null; // a panel off the page has no typing or focus
    drawn = key;
    draw();
    if (keep) restore(keep);
  }

  function draw() {
    inspector.replaceChildren();
    view.replaceChildren();
    const p = currentPlace();
    const disabled = !!(p && brokenError(p.id));
    if (disabled) inspector.append(h("div", "broken", `${brokenError(p.id)}. Fix the file by hand; edits here are off.`));
    const room = p?.roomId ? p.views.index.byId.get(p.roomId) : null;
    if (room) renderRoom(p, room, disabled);
    renderView(p, disabled);
    if (p?.builder === "decks") renderHull(p, disabled);
    if (p?.kind === "plan" && p.views.index.hull) renderShip(p, disabled);
  }

  return { render, change, saveAll, discard, rebase, pending: summary, resolved, broken: brokenError };
}
