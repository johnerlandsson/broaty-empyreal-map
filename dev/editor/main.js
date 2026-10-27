// The tweak editor's page (dev/edit.html, served by npm run edit): layout A. Down the left, the
// last sync's report and every place; in the middle, the place's overview above its plan, as the
// panel stacks them; on the right, the selected room and the view, edited through panel.js.
// A room picked on either view, or in the "pretend I'm in" picker, is lit in both, as main.js
// lights where the player is. A build the server announces that names the open place re-imports
// its data and rebuilds the views, keeping the selection, the plan's deck and both view boxes.
// The URL hash (#<placeId>/<roomId>) holds the place and room, so a reload or a headless
// screenshot opens them. window.editor has small hooks for later tasks and tests.
// Below the stations, the ship classes: each generated plan (data/ships.js), by its hull's name,
// opened with buildShip as the panel draws a ship, her rooms' "{name}" filled with EXAMPLE.
// On a decks place or a plan the plan carries drag handles (handles.js): a drag patches the open place's
// look in memory and the views are rebuilt from it at most once a frame, the plan's cells kept
// where they were on the screen, until the change on release.
// Changes stay unsaved (panel.js) until Save, in the bar over the map (option A of
// docs/maps/reference/editor-save-options.png), which says what's unsaved and where; the rail dots
// each place with any. While edits are unsaved, a place the last trial build changed is drawn
// from that trial (served by the edit server), else from ui/data. Leaving the page with any asks
// first; Ctrl+S saves.

import { locateDecks } from "../../ui/lib/decks.js";
import { buildPlace, buildShip } from "../../ui/place-views.js";
import { createHandles } from "./handles.js";
import { createPanel } from "./panel.js";

/** The ship's name a plan's rooms are shown with: "Cockpit of the Example". */
const EXAMPLE = "Example";

const SHELL = `
  <nav class="rail"></nav>
  <div class="middle">
    <div class="pane"><div class="savebar" hidden></div><span class="tag">overview</span><div id="model"></div></div>
    <div class="rule"></div>
    <div class="pane"><span class="tag" id="plan-tag">plan</span><div id="deck"></div><div class="errbar" hidden></div></div>
  </div>
  <aside class="side">
    <div id="inspector"></div>
    <div id="view"></div>
    <div class="row"><label for="pretend">pretend I'm in</label><select id="pretend" class="btn"></select></div>
  </aside>
`;

const h = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The hash's place and room: `#orrin/orrin.market`. */
function parseHash(hash) {
  let text;
  try {
    text = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return { placeId: null, roomId: null, error: `bad place in the URL: ${hash}` };
  }
  const [placeId = "", roomId = ""] = text.split("/");
  return { placeId: placeId || null, roomId: roomId || null };
}

/** Per place, what the last sync says of it: new, rooms changed, orphans. In report order. */
function reportItems(report) {
  const items = new Map();
  const item = (place) => {
    if (!items.has(place)) items.set(place, { place, isNew: false, rooms: 0, orphans: 0 });
    return items.get(place);
  };
  for (const p of report?.newPlaces ?? []) item(p.place).isNew = true;
  for (const list of Object.values(report?.rooms ?? {})) for (const r of list) item(r.place).rooms++;
  for (const o of report?.orphans ?? []) item(o.place).orphans++;
  return [...items.values()];
}

/** A plan's room names with "{name}" filled with the example ship's. */
const named = (plan) => ({ ...plan, rooms: (plan?.rooms ?? []).map((r) => (typeof r.name === "string" ? { ...r, name: r.name.replaceAll("{name}", EXAMPLE) } : r)) });

/**
 * Starts the page in root.
 * @param {{root?: Element, fetch?: typeof fetch, EventSource?: typeof EventSource,
 *   importPlace?: (id: string, version: number, kind: "place" | "plan", trial?: number) => Promise<object>}} [deps]
 *   the page's own by default; tests pass stubs.
 */
export function startEditor({
  root = document.body,
  fetch: get = (...a) => window.fetch(...a),
  EventSource: Events = window.EventSource,
  importPlace = (id, version, kind, trial) =>
    import(/* @vite-ignore */ trial != null ? `/api/trial/${trial}/${kind === "plan" ? "plans/" : ""}${id}.js` : `/ui/data/${kind === "plan" ? "plans/" : ""}${id}.js?v=${version}`).then(
      (m) => m.default,
    ),
} = {}) {
  root.innerHTML = SHELL;
  const rail = root.querySelector(".rail");
  const modelEl = root.querySelector("#model");
  const deckEl = root.querySelector("#deck");
  const planTag = root.querySelector("#plan-tag");
  const errbar = root.querySelector(".errbar");
  const pretend = root.querySelector("#pretend");
  const savebar = root.querySelector(".savebar");
  const panel = createPanel({
    inspector: root.querySelector("#inspector"),
    view: root.querySelector("#view"),
    send: async (method, url, body) => {
      const res = await get(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
    place: () => place,
    state: () => state,
    refresh: () => fetchState(),
    showError: (text) => showError(text),
    run: (p) => (editor.busy = p),
    tried: (next) => tried(next),
    changedPending: () => {
      renderBar();
      renderRail();
    },
    hullPoint: () => handles.picked(),
  });
  const handles = createHandles({
    place: () => place,
    resolved: panel.resolved,
    change: panel.change,
    preview: (look) => preview(look),
    flush: () => flush(),
    restore: (look) => {
      preview(look ?? place?.built);
      flush();
    },
    run: (p) => (editor.busy = p),
    changed: () => {
      handles.draw();
      panel.render();
    },
    editable: () => !!place && !panel.broken(place.id),
    showError: (text) => showError(text),
  });

  let state = { places: [], plans: [], report: null, palette: {}, tweaks: {} };
  let version = Date.now(); // the data version to import by; each build bumps it
  const data = new Map(); // place id -> its data at `version`
  const changed = new Set(); // place ids rebuilt since their data was imported
  let place = null; // {id, builder, kind, data, views, roomId, lastLevel}; a plan's builder is decks
  let trial = null; // the last trial build of the unsaved edits: {n, changed: Set of ids it changed}

  /** The place or plan by id, as the state lists it: {id, builder, kind}, or undefined. */
  const entryOf = (id) => {
    const station = state.places.find((p) => p.id === id);
    if (station) return { id, builder: station.builder, kind: "place" };
    return (state.plans ?? []).some((p) => p.id === id) ? { id, builder: "decks", kind: "plan" } : undefined;
  };

  const load = async (id, kind = entryOf(id)?.kind ?? "place") => {
    if (!data.has(id) || changed.has(id)) {
      changed.delete(id);
      const fresh = await importPlace(id, version, kind, trial?.changed.has(id) ? trial.n : undefined);
      data.set(id, kind === "plan" ? named(fresh) : fresh);
    }
    return data.get(id);
  };

  function showError(text) {
    errbar.textContent = text ?? "";
    errbar.hidden = !text;
  }

  /** The bar over the map: what's unsaved, in which files, and Save and Discard; hidden with nothing unsaved. */
  function renderBar() {
    const { count, files, stale, checking } = panel.pending();
    savebar.hidden = !count;
    savebar.parentElement.classList.toggle("saving", !!count);
    if (!count) return savebar.replaceChildren();
    const what = h("span", "pend", `● ${plural(count, "unsaved change")}`);
    const list = h("span", "files");
    for (const [name, n] of files) list.append(h("span", stale.includes(name) ? "stale" : null, `${name}.json · ${n}`));
    const check = h("span", "checking", checking ? "checking…" : "");
    const discard = h("button", "btn discard", "Discard");
    discard.name = "discard";
    discard.addEventListener("click", () => panel.discard());
    const save = h("button", "btn save", files.length === 1 ? "Save" : `Save ${files.length} files`);
    save.name = "save";
    save.disabled = checking || stale.length > 0;
    save.addEventListener("click", () => panel.saveAll());
    savebar.replaceChildren(what, list, check, h("span", "gap"), discard, save);
  }

  /**
   * Has the views drawn from a trial build of the unsaved edits, or from ui/data again (null): each
   * place it or the last changed is imported afresh, the open one rebuilt as it was.
   */
  async function tried(next) {
    const ids = new Set([...(trial?.changed ?? []), ...(next?.changed ?? [])]);
    trial = next ? { n: next.trial, changed: new Set(next.changed) } : null;
    for (const id of ids) changed.add(id);
    renderRail();
    if (place && ids.has(place.id)) await rebuild();
  }

  function renderRail() {
    rail.replaceChildren();
    const open = (id) => () => openPlace(id).catch((err) => showError(err.message));
    const entry = (id, label, badges = []) => {
      const it = h("div", "it");
      it.dataset.place = id;
      it.classList.toggle("on", id === place?.id);
      const name = h("span", null, label);
      if (unsaved.has(id)) {
        const dot = h("i", "dot");
        dot.title = "unsaved";
        name.append(dot);
      }
      it.append(name);
      for (const [cls, text] of badges) it.append(h("span", `badge ${cls}`, text));
      it.addEventListener("click", open(id));
      return it;
    };
    const nameOf = (id) => data.get(id)?.name ?? id;
    const plans = state.plans ?? [];
    const known = new Set([...state.places, ...plans].map((p) => p.id));
    const unsaved = new Set(panel.pending().files.map(([name]) => name));

    const report = state.report;
    rail.append(h("div", "grp", report?.commit ? `From the last sync · ${report.commit}` : "From the last sync"));
    const items = reportItems(report);
    if (!items.length) rail.append(h("div", "it none", "nothing new"));
    for (const r of items) {
      const badges = [];
      if (r.isNew) badges.push(["new", "new"]);
      if (r.rooms) badges.push(["chg", plural(r.rooms, "room")]);
      if (r.orphans) badges.push(["orph", plural(r.orphans, "orphan")]);
      const it = entry(r.place, nameOf(r.place), badges);
      if (!known.has(r.place)) it.classList.add("gone"); // no data to open (yet)
      rail.append(it);
    }

    rail.append(h("div", "grp", "Stations"));
    for (const p of state.places) rail.append(entry(p.id, nameOf(p.id)));
    rail.append(h("div", "grp", "Ship classes"));
    if (!plans.length) rail.append(h("div", "it none", "none yet"));
    for (const p of plans) rail.append(entry(p.id, p.name));
  }

  function renderPicker() {
    pretend.replaceChildren(h("option", null, "(nowhere)"));
    pretend.firstChild.value = "";
    if (!place) return;
    const rooms = [...place.views.index.byId.values()].filter((r) => r?.id).sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
    for (const r of rooms) {
      const o = h("option", null, r.name ?? r.id);
      o.value = r.id;
      pretend.append(o);
    }
    pretend.value = place.roomId ?? "";
  }

  function renderPlanTag() {
    const level = place?.views.deck.level;
    const deck = place?.builder === "decks" ? place.views.index.decks[level] : undefined; // top deck first, as the plans are
    planTag.textContent = deck != null ? `plan · Deck ${deck}` : "plan";
  }

  function writeHash() {
    const hash = place ? `#${place.id}${place.roomId ? `/${place.roomId}` : ""}` : "";
    if (window.location.hash !== hash) history.replaceState(null, "", hash || window.location.pathname + window.location.search);
  }

  /** Light roomId in both views, as main.js lights where the player is; null clears it. */
  function select(roomId) {
    if (!place) return;
    const { views } = place;
    const room = roomId ? views.index.byId.get(roomId) : undefined;
    place.roomId = room ? roomId : null;
    const msg = room ? { roomId, district: room.district } : {};
    const where = views.locate(views.index, msg, place.lastLevel);
    if (where.kind !== "off") place.lastLevel = where.level;
    views.model.set(where, msg);
    views.deck.set(where);
    pretend.value = place.roomId ?? "";
    renderPlanTag();
    writeHash();
    handles.draw();
    panel.render();
  }

  /**
   * Build the views of the place's data, replacing any; keep is the old views' state to restore.
   * `built` is the look the last build gave (the data's own, unless it's a preview's).
   */
  function build(id, builder, placeData, roomId, keep, built = placeData.look) {
    place?.views.model.stop?.();
    modelEl.replaceChildren();
    deckEl.replaceChildren();
    const kind = entryOf(id)?.kind ?? "place";
    // a plan is drawn as the panel draws a ship, but picked and lit by its own room ids
    const views =
      kind === "plan" ? { ...buildShip(placeData, modelEl, deckEl, { pick: true, name: EXAMPLE }), locate: locateDecks } : buildPlace(placeData, builder, modelEl, deckEl, { pick: true });
    place = { id, builder, kind, data: placeData, views, roomId: null, lastLevel: keep?.lastLevel ?? null, built };
    views.model.onPick?.((rid) => select(rid));
    views.deck.onPick?.((rid) => select(rid));
    select(roomId);
    if (keep) {
      if (keep.level >= 0 && keep.level < views.deck.plans.length && views.deck.level !== keep.level) views.deck.show(keep.level);
      // where the hull's box has moved (a footprint reaching past it), move the view with it
      const origin = views.deck.plans[views.deck.level]?.layout?.centre?.({ x: 0, y: 0 });
      const [dx, dy] = keep.origin && origin ? [origin[0] - keep.origin[0], origin[1] - keep.origin[1]] : [0, 0];
      views.deck.setView([keep.deck[0] + dx, keep.deck[1] + dy, keep.deck[2], keep.deck[3]]);
      views.model.setView(keep.model);
      if (keep.phi != null && "phi" in views.model) {
        views.model.phi = keep.phi;
        views.model.draw?.();
      }
      renderPlanTag();
      handles.draw();
      panel.render();
    }
    renderPicker();
    renderRail();
  }

  /** The open place's views as they are, for build to restore. */
  function keepOf() {
    const { views, lastLevel } = place;
    const origin = views.deck.plans[views.deck.level]?.layout?.centre?.({ x: 0, y: 0 });
    return { model: views.model.vb.slice(), deck: views.deck.cur.slice(), level: views.deck.level, phi: views.model.phi, lastLevel, origin };
  }

  let frame = null; // the rebuild a preview has asked for, at the next frame

  /** Sets the open place's look in memory and rebuilds its views within a frame. */
  function preview(look) {
    if (!place) return;
    place.data = { ...place.data, look };
    frame ??= requestAnimationFrame(() => flush());
  }

  /** Rebuilds the open place's views now from its look in memory, if a preview asked for it. */
  function flush() {
    if (frame == null) return;
    cancelAnimationFrame(frame);
    frame = null;
    if (place) build(place.id, place.builder, place.data, place.roomId, keepOf(), place.built);
  }

  async function openPlace(id, roomId = null) {
    const entry = entryOf(id);
    if (!entry) throw new Error(`no such place: ${id}`);
    build(id, entry.builder, await load(id), roomId);
  }

  /** Re-import the open place and rebuild its views as they were. */
  async function rebuild() {
    const { id, builder, roomId } = place;
    const keep = keepOf();
    const fresh = await load(id);
    if (place?.id !== id) return; // another place was opened meanwhile
    build(id, builder, fresh, roomId, keep);
  }

  async function fetchState() {
    const res = await get("/api/state", { cache: "no-store" });
    if (!res.ok) throw new Error(`GET /api/state: ${res.status}`);
    state = await res.json();
    const broken = Object.values(state.tweaks ?? {}).find((t) => t.error);
    if (broken) showError(broken.error);
    state.plans ??= [];
    await Promise.all([...state.places.map((p) => load(p.id, "place").catch(() => {})), ...state.plans.map((p) => load(p.id, "plan").catch(() => {}))]);
    renderRail();
    panel.render();
  }

  /** Re-read the state, and rebuild the open place from data freshly imported. */
  async function reload() {
    showError(null);
    version = Date.now();
    for (const id of data.keys()) changed.add(id);
    await fetchState();
    if (place) await rebuild();
    await panel.rebase();
  }

  async function onBuilt(event) {
    version = event.version;
    for (const id of event.changed ?? []) changed.add(id);
    showError(null);
    await fetchState();
    if (place && event.changed?.includes(place.id)) await rebuild();
    await panel.rebase();
  }

  const editor = {
    get place() {
      return place;
    },
    get state() {
      return state;
    },
    select,
    reload: () => (editor.busy = reload().catch((err) => showError(err.message))),
    open: (id, roomId) => (editor.busy = openPlace(id, roomId).catch((err) => showError(err.message))),
    /** Rebuilds the views now if a drag's preview is waiting for its frame. */
    flush,
    /** Stops listening on the window and to the server, so a test's editor is gone after it. */
    stop: () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("keydown", onSaveKey);
      handles.stop();
      events.close?.();
      if (frame != null) cancelAnimationFrame(frame);
      frame = null;
      place?.views.model.stop?.();
    },
    busy: Promise.resolve(),
    ready: null,
  };

  pretend.addEventListener("change", () => select(pretend.value || null));
  function onHash() {
    const { placeId, roomId, error } = parseHash(window.location.hash);
    if (error) return showError(error);
    if (!placeId) return;
    if (placeId !== place?.id) editor.open(placeId, roomId);
    else if (roomId !== place.roomId) select(roomId);
  }
  window.addEventListener("hashchange", onHash);

  // leaving with edits unsaved asks first; Ctrl+S (or Cmd+S) saves
  function onLeave(e) {
    if (!panel.pending().count) return;
    e.preventDefault();
    e.returnValue = "";
  }
  function onSaveKey(e) {
    if (e.key !== "s" || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    e.preventDefault();
    if (panel.pending().count) panel.saveAll();
  }
  window.addEventListener("beforeunload", onLeave);
  window.addEventListener("keydown", onSaveKey);

  // The stream drops while the server is down; EventSource reconnects by itself. A build announced
  // meanwhile is lost, so on each reopen after the first the page reloads (which clears the bar).
  const events = new Events("/api/events");
  let opened = false;
  events.onerror = () => showError("lost the edit server; reconnecting…");
  events.onopen = () => {
    if (opened) editor.reload();
    opened = true;
  };
  events.onmessage = (e) => {
    let event;
    try {
      event = JSON.parse(e.data);
    } catch {
      return;
    }
    if (event.type === "error") showError(`build failed: ${event.error}`);
    else if (event.type === "built") editor.busy = onBuilt(event).catch((err) => showError(err.message));
  };

  editor.ready = editor.busy = (async () => {
    await fetchState();
    const { placeId, roomId, error } = parseHash(window.location.hash);
    if (error) showError(error);
    else if (placeId) await openPlace(placeId, roomId);
  })().catch((err) => showError(err.message));

  window.editor = editor;
  return editor;
}
