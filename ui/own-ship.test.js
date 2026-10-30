// @vitest-environment happy-dom
// Your own ship in the top band (main.js): out in her, her 3D model stands in front of the space
// scene, your room lit; docked at a station the station shows as before; the chart, the lanes map
// and the belt map cover her as they cover the scene; a guest aboard another's ship (no scene) sees
// what the panel always showed.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { senaraCharts } from "../dev/charts-fixture.js";

// happy-dom draws no canvas: a context whose every method does nothing (and returns one again)
const noop = new Proxy(function () {}, {
  get: (_, k) => (k === "width" ? 0 : noop),
  apply: () => noop,
  set: () => true,
});

let handlers;
let ModelView;
let awayCalls;

async function mount() {
  document.body.innerHTML = '<main class="station"><div id="model" class="band"></div><div class="separator"></div><div id="deck" class="band"></div><div id="info"></div></main>';
  handlers = {};
  window.panel = {
    on: (name, fn) => (handlers[name] = handlers[name] ?? []).push(fn),
    post: () => {},
    tooltip: { show() {}, hide() {} },
  };
  vi.resetModules();
  ({ ModelView } = await import("./model-view.js"));
  awayCalls = [];
  const setAway = ModelView.prototype.setAway;
  ModelView.prototype.setAway = function (away) {
    awayCalls.push({ view: this, away });
    return setAway.call(this, away);
  };
  await import("./main.js");
}
const emit = (name, msg) => (handlers[name] ?? []).forEach((fn) => fn(msg));

/** The top band's ship: the box her model is in. */
const ownShip = () => document.querySelector("#model .own-ship");
const shipShown = () => {
  const box = ownShip();
  if (!box || box.style.display === "none") return false;
  return [...box.children].some((c) => c.style.display !== "none");
};
/** The div of the ship model showing in the box. */
function shownModel() {
  const box = ownShip();
  const div = [...box.children].find((c) => c.style.display !== "none");
  return div;
}

const FREIGHTER = {
  roomId: "ship.42.hold",
  name: "Cargo Hold",
  area: "ship.42",
  areaName: "Full Measure",
  hull: "freighter",
  hullName: "medium freighter",
  shipRoom: "hold",
};

let sets;
let frames = [];
/** Run the frames queued so far (the space view's loop) at `now`. */
function runFrames(now) {
  const due = frames;
  frames = [];
  for (const fn of due) fn(now);
}
beforeEach(async () => {
  HTMLCanvasElement.prototype.getContext = () => noop;
  frames = [];
  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  globalThis.cancelAnimationFrame = () => {};
  await mount();
  watchSets();
});
afterEach(() => {
  vi.doUnmock("./data/ships.js");
  delete window.panel;
});
/** Record every ModelView.set from here on, in `sets`. */
function watchSets() {
  sets = [];
  const set = ModelView.prototype.set;
  ModelView.prototype.set = function (where, msg) {
    sets.push({ view: this, where });
    return set.call(this, where, msg);
  };
}

/** The ModelView whose div is the shown ship's. */
const shipView = () => {
  const div = shownModel();
  return sets.map((s) => s.view).find((v) => v.div === div);
};

describe("your own ship in the top band", () => {
  it("shows her model over the belt, faces keyed freighter.*, the hold lit and nothing behind her", () => {
    emit("scene", { scene: "belt" });
    emit("location", FREIGHTER);
    expect(shipShown()).toBe(true);
    expect(ownShip().classList.contains("manoeuvre")).toBe(false); // in the middle, no manoeuvre
    const view = shipView();
    expect(view).toBeDefined();
    expect(view.faces.some((f) => f.key?.startsWith("freighter."))).toBe(true);
    expect(view.faces.every((f) => f.key == null || f.key.startsWith("freighter."))).toBe(true);
    expect(view.key).toBe("freighter.hold");
    expect(view.shapes.childNodes.length).toBeGreaterThan(0); // the hold's faces, lit
    // transparent: no backdrop of stars, no background of her own; over the scene's canvas
    expect(view.div.style.background).toBe("transparent");
    expect(view.backdrop.childNodes.length).toBe(0);
    const canvas = document.querySelector("#model canvas");
    expect(canvas.compareDocumentPosition(ownShip()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("is hidden docked at a station, which shows as before", () => {
    emit("scene", { scene: "belt" });
    emit("location", FREIGHTER);
    expect(shipShown()).toBe(true);
    emit("scene", { scene: "station", station: "tiss" });
    expect(shipShown()).toBe(false);
  });

  it("goes when you leave her, and comes back aboard", () => {
    emit("scene", { scene: "parked" });
    emit("location", FREIGHTER);
    expect(shipShown()).toBe(true);
    emit("location", { roomId: "tiss.concourse", name: "Main Concourse", area: "tiss" });
    expect(shipShown()).toBe(false);
    emit("location", FREIGHTER);
    expect(shipShown()).toBe(true);
  });

  it("is covered by the chart, and shows again when it's off (and so for the lanes and belt maps)", () => {
    emit("scene", { scene: "belt" });
    emit("location", FREIGHTER);
    // each covers the band only with something to show: charts, lanes, a belt
    emit("charts", senaraCharts(Date.now()));
    emit("lanes", { system: "senara", visible: [], seen: {} });
    emit("belt", { id: "gannet", radius: 40 });
    expect(shipShown()).toBe(true);
    emit("chart", { on: true });
    expect(shipShown()).toBe(false);
    emit("chart", { on: false });
    expect(shipShown()).toBe(true);
    emit("lanes-view", { on: true });
    expect(shipShown()).toBe(false);
    emit("lanes-view", { on: false });
    emit("belt-view", { on: true });
    expect(shipShown()).toBe(false);
    emit("belt-view", { on: false });
    expect(shipShown()).toBe(true);
  });

  it("shows the scene whole, not the station behind it, when a map comes off a band it changed under", () => {
    emit("charts", senaraCharts());
    emit("lanes", { system: "senara", visible: [], seen: {} });
    emit("location", FREIGHTER);
    emit("scene", { scene: "station", station: "tiss" });
    emit("lanes-view", { on: true });
    // out of the berth and through a lane under the map, which drops as she comes out of it
    emit("scene", { scene: "travelling" });
    emit("scene", { scene: "parked" });
    runFrames(1000);
    emit("lanes-view", { on: false });
    runFrames(1016);
    expect(document.querySelector("#model canvas").style.opacity).toBe("1");
  });

  it("stays shown through an undock while the station model behind falls away", () => {
    emit("location", { ...FREIGHTER, hull: "skiff", hullName: "prospecting skiff", roomId: "ship.42.cockpit" });
    emit("scene", { scene: "station", station: "tiss" });
    expect(shipShown()).toBe(false);
    // the scene stays "station" till she's clear; the space view draws the station falling away
    emit("manoeuvre", { verb: "undock", left: 5, total: 10, at: "tiss" });
    expect(shipShown()).toBe(true);
    expect(ownShip().classList.contains("manoeuvre")).toBe(true); // aside, the station in the middle
    expect(shipView().key).toBe("hull-skiff.cockpit");
    runFrames(performance.now() + 16);
    const station = awayCalls.filter((c) => c.view !== shipView() && c.away > 0);
    expect(station.length).toBeGreaterThan(0); // setAway ran on the station model behind her
    expect(shipShown()).toBe(true);
    // clear of the berth: the scene goes to space and she stays
    emit("scene", { scene: "parked" });
    emit("manoeuvre", { verb: null });
    expect(shipShown()).toBe(true);
    expect(ownShip().classList.contains("manoeuvre")).toBe(false); // back to the middle
  });

  it("stays through a dock and goes once she's docked", () => {
    emit("location", { ...FREIGHTER, hull: "skiff", hullName: "prospecting skiff", roomId: "ship.42.cockpit" });
    emit("scene", { scene: "parked" });
    emit("manoeuvre", { verb: "dock", left: 20, total: 20, at: "orrin_station" });
    expect(shipShown()).toBe(true);
    expect(ownShip().classList.contains("manoeuvre")).toBe(true);
    emit("scene", { scene: "station", station: "orrin_station" });
    emit("manoeuvre", { verb: null });
    expect(shipShown()).toBe(false);
  });

  it("shows a plan with no tweaks (the tug, frozen with the untweaked look), her collar lit", async () => {
    vi.doMock("./data/ships.js", async (importOriginal) => {
      const real = await importOriginal();
      const tugPlain = (await import("../tests/fixtures/generated/plans/tug-plain.js")).default;
      return { ...real, plans: { ...real.plans, tug: tugPlain } };
    });
    await mount();
    watchSets();
    const tugPlain = (await import("../tests/fixtures/generated/plans/tug-plain.js")).default;
    expect((await import("./lib/ships.js")).planFor("tug")).toBe(tugPlain); // main.js got the frozen plan
    emit("scene", { scene: "parked" });
    emit("location", { roomId: "ship.5.collar", name: "Docking Collar", area: "ship.5", areaName: "Brock", hull: "tug", hullName: "tug", shipRoom: "collar" });
    expect(shipShown()).toBe(true);
    const view = shipView();
    expect(view).toBeDefined();
    expect(view.faces.length).toBeGreaterThan(0);
    expect(view.faces.every((f) => f.key == null || f.key.startsWith("tug."))).toBe(true);
    expect(view.key).toBe("tug.collar");
    expect(view.shapes.childNodes.length).toBeGreaterThan(0); // the collar's faces, lit
  });

  it("shows no ship model to a guest aboard another's ship (no scene)", () => {
    emit("location", FREIGHTER);
    expect(shipShown()).toBe(false);
    // her plan is still drawn below
    expect(document.querySelector("#deck").textContent).toContain("Full Measure");
  });
});
