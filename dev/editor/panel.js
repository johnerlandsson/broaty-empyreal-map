// The tweak editor's side panel (the right column of layout A in
// docs/maps/reference/tweak-editor-options.png): the selected room, as the game gives it, then its
// paint and footprint; below, the place's view. Each value says where it comes from ("set here",
// or "from <place>" through `like`) and, where it's the place's own, has a reset.
// Every change runs one of ops.js's edits on the place's own tweak and PUTs it with the version
// the page holds, one save at a time. A save the build refuses (422) shows its message in the bar
// over the plan and puts the inputs back; one beaten by a hand edit (409) reloads the state.
// What each kind of place allows matches the build: footprints only on decks rooms that aren't
// passages or blisters, a cutaway only on decks, a camera on anything but a town.

import { CAM } from "../../ui/lib/geometry.js";
import { CORNER_R } from "../../ui/lib/footprint.js";
import { origin, reset, setFootprint, setPaint, setView } from "./ops.js";

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
/** A number input's value, or undefined when it's empty or not a number. */
const numberOf = (input) => (input.value.trim() === "" || !Number.isFinite(Number(input.value)) ? undefined : Number(input.value));

/**
 * Starts the panel in its two elements.
 * @param {{inspector: Element, view: Element, put: (url: string, body: object) => Promise<{status: number, body: object}>,
 *   place: () => object | null, state: () => object, reload: () => Promise<void>, showError: (text: string | null) => void,
 *   run: (p: Promise<void>) => void}} deps `place` and `state` are the page's; `reload` re-reads the
 *   state and rebuilds the open place; `run` is handed each save, for the page's `busy`.
 * @returns {{render: () => void}}
 */
export function createPanel({ inspector, view, put, place: currentPlace, state: currentState, reload, showError, run }) {
  let queue = Promise.resolve();

  /** The tweaks as scripts/source/tweaks.mjs takes them: the palette and each place's own JSON. */
  function tweaks() {
    const s = currentState();
    const places = {};
    for (const [name, entry] of Object.entries(s.tweaks ?? {})) if (name !== "palette") places[name] = entry.json ?? {};
    return { palette: s.palette ?? {}, places };
  }

  /** The place's resolved value at [key, sub] and where it comes from: {value, from, own}. */
  function resolved(placeId, keyPath) {
    const t = tweaks();
    const { from, own } = origin(t, placeId, keyPath);
    const [key, sub] = keyPath;
    const value = from ? (sub === undefined ? t.places[from][key] : t.places[from][key]?.[sub]) : undefined;
    return { value, from, own };
  }

  const entryOf = (name) => currentState().tweaks?.[name] ?? { json: {}, version: 0 };
  const brokenError = (name) => currentState().tweaks?.[name]?.error ?? null;

  /**
   * Saves `edit` of a tweak file's own JSON (a place's, or "palette"), after any save before it,
   * with the version held when it runs.
   */
  function save(name, edit) {
    const url = name === "palette" ? "/api/palette" : `/api/tweaks/${encodeURIComponent(name)}`;
    queue = queue
      .then(async () => {
        if (brokenError(name)) return render();
        const entry = entryOf(name);
        const json = edit(entry.json ?? {});
        const { status, body } = await put(url, { json, version: entry.version });
        if (status === 200) {
          const s = currentState();
          s.tweaks ??= {};
          s.tweaks[name] = { json, version: body.version };
          if (name === "palette") s.palette = json;
          showError(null);
          render();
        } else if (status === 409) {
          await reload();
          showError("changed on disk, reloaded");
        } else {
          showError(body?.error ?? `PUT ${url}: ${status}`);
          render();
        }
      })
      .catch((err) => {
        showError(err.message);
        render();
      });
    run(queue);
  }

  /** "set here · reset", "from <place>" or "default", for the value at keyPath. */
  function mark(placeId, keyPath, disabled) {
    const { from, own } = origin(tweaks(), placeId, keyPath);
    const m = h("span", own ? "own" : "inh");
    m.dataset.key = keyPath.join(".");
    if (own) {
      m.append("● set here");
      if (!disabled) {
        m.append(" · ");
        const r = h("u", "reset", "reset");
        r.addEventListener("click", () => save(placeId, (t) => reset(t, keyPath)));
        m.append(r);
      }
    } else m.append(from ? `from ${from}` : "default");
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
    i.value = value == null ? "" : String(value);
    i.disabled = disabled;
    i.addEventListener("change", () => change(numberOf(i)));
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
    const palette = currentState().palette ?? {};
    const sw = h("span", "sw");
    for (const [name, colour] of Object.entries(palette)) {
      const i = h("i", name === current ? "on" : null);
      i.title = name;
      i.style.background = colour;
      i.addEventListener("click", () => {
        if (disabled || name === current) return;
        for (const x of sw.children) x.classList.toggle("on", x === i);
        save(p.id, (t) => setPaint(t, id, name));
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
    colour.value = "#8796a8";
    const add = h("button", "btn add-colour", "add");
    for (const x of [name, colour, add]) x.disabled = !!paletteBroken;
    add.addEventListener("click", () => {
      const n = name.value.trim();
      if (!n) return showError("a new colour needs a name");
      if (Object.hasOwn(currentState().palette ?? {}, n)) return showError(`the palette already has ${n}`);
      save("palette", (t) => ({ ...t, [n]: colour.value }));
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
    const change = (patch) =>
      save(p.id, (t) => {
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
          change((next) => {
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
          change((next) => {
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
          change((next) => {
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
    view.append(h("div", "sec", "View · whole station"));
    if (!p) return;
    if (p.builder === "decks") {
      const cut = resolved(p.id, ["view", "cutaway"]);
      view.append(row("cutaway", seg("cutaway", CUTAWAYS, cut.value ?? "hide-above", disabled, (c) => save(p.id, (t) => setView(t, { cutaway: c })))));
      const m = h("div", "row");
      m.append(h("span"), mark(p.id, ["view", "cutaway"], disabled));
      view.append(m);
    }
    if (p.builder === "town") return;
    const camera = () => ({ ...CAM, zoom: 1, ...resolved(p.id, ["view", "camera"]).value });
    const cam = camera();
    // the camera as it is when the save runs, after any before it
    const setCam = (patch) => save(p.id, (t) => setView(t, { camera: { ...camera(), ...patch } }));
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

  function render() {
    inspector.replaceChildren();
    view.replaceChildren();
    const p = currentPlace();
    const disabled = !!(p && brokenError(p.id));
    if (disabled) inspector.append(h("div", "broken", `${brokenError(p.id)}. Fix the file by hand; edits here are off.`));
    const room = p?.roomId ? p.views.index.byId.get(p.roomId) : null;
    if (room) renderRoom(p, room, disabled);
    renderView(p, disabled);
  }

  return { render };
}
