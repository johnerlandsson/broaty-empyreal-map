// @vitest-environment happy-dom
// A world's face in the space scenes (docs/maps/space-scenes.md, "A world's face"): kept through a
// fade-out, its facets drawn once at full alpha and blitted, so a dusk or a fade never doubles their
// edges; an airless world's limb a hard grey edge from above a port as from high orbit; and on the
// chart each star's glow its own colour.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { faceOf } from "./lib/worlds.js";

/** A 2D context that records what's called on it and what's set. */
function recorder() {
  const calls = [];
  const sets = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, k) => (k === "calls" ? calls : k === "sets" ? sets : (...args) => (calls.push([k, ...args]), { addColorStop() {} })),
      set: (_, k, v) => (sets.push([k, v]), true),
    },
  );
  return ctx;
}

let made;
beforeEach(() => {
  made = [];
  HTMLCanvasElement.prototype.getContext = function () {
    this._ctx ??= recorder();
    made.push(this._ctx);
    return this._ctx;
  };
  document.body.innerHTML = '<div id="band" style="width:300px;height:160px"></div>';
});
afterEach(() => {
  document.body.innerHTML = "";
});

async function view() {
  const { SpaceView } = await import("./space-view.js");
  const v = new SpaceView(document.getElementById("band"), { hulls: { dolcoath: "pit", zennor: "port" } });
  Object.assign(v, { w: 300, h: 160, lit: 1, high: 1, ground: 1 });
  v.drawTown = () => {};
  v.drawPit = () => {};
  return v;
}

describe("a world's face in the space scenes", () => {
  it("keeps the planet's face through the fade-out after high orbit, not the old ochre", async () => {
    const v = await view();
    v.set("orbit", null, "kynance");
    expect(v.face).toEqual(faceOf("kynance"));
    v.set("travelling");
    expect(v.planet).toBe(null);
    expect(v.face).toEqual(faceOf("kynance"));
    v.set("orbit", null, "lamorna");
    expect(v.face).toEqual(faceOf("lamorna"));
  });

  it("keeps the port's face through the fade-out after leaving it", async () => {
    const v = await view();
    v.set("port", "zennor");
    const below = v.below;
    expect(below?.coast).toBe(0.2);
    v.set("travelling");
    expect(v.below).toBe(below);
    expect(v.shownPort).toBe("zennor");
  });

  it("draws the facets once onto their own canvas and blits them, at a dusk too, the same image each frame", async () => {
    const v = await view();
    v.set("orbit", null, "tamsin");
    v.lit = 0.5;
    const main = v.g;
    main.calls.length = 0;
    v.drawOrbit();
    v.drawOrbit();
    const blits = main.calls.filter(([k]) => k === "drawImage");
    expect(blits).toHaveLength(2);
    expect(blits[0][1]).toBe(blits[1][1]); // drawn once, kept
    const off = blits[0][1].getContext("2d");
    expect(off.calls.filter(([k]) => k === "fill").length).toBe(v.facets.length);
    expect(off.sets.some(([k]) => k === "globalAlpha")).toBe(false); // at full alpha
  });

  it("gives an airless world's port a hard grey limb and no glow, as high orbit does", async () => {
    const v = await view();
    v.set("port", "zennor");
    v.below = { face: { ...faceOf("botallack"), seas: [] }, coast: 0 };
    v.g.calls.length = 0;
    v.g.sets.length = 0;
    v.drawGround();
    const strokes = v.g.sets.filter(([k]) => k === "strokeStyle").map(([, s]) => s);
    expect(strokes.at(-1)).toMatch(/^rgba\(120,130,145,/);
    expect(v.g.calls.filter(([k]) => k === "createRadialGradient")).toHaveLength(1); // the limb's darkening only: no air glowing
  });

  it("gives Zennor's world its air's limb, not the airless edge", async () => {
    const v = await view();
    v.set("port", "zennor");
    v.g.sets.length = 0;
    v.drawGround();
    const strokes = v.g.sets.filter(([k]) => k === "strokeStyle").map(([, s]) => s);
    expect(strokes.at(-1)).not.toMatch(/^rgba\(120,130,145,/);
  });
});

describe("the chart's stars", () => {
  it("gives each star a glow of its own colour, so two never share one", async () => {
    window.panel = { on() {}, post() {}, tooltip: { show() {}, hide() {} } };
    const { ChartView } = await import("./chart-view.js");
    const chart = new ChartView(document.getElementById("band"));
    const red = chart.sunFill("feock");
    const blue = chart.sunFill("piran");
    expect(red).not.toBe(blue);
    expect(chart.sunFill("feock")).toBe(red);
    const stops = (fill) => [...document.getElementById(fill.slice(5, -1)).querySelectorAll("stop")].map((s) => s.getAttribute("stop-color"));
    expect(new Set(stops(red))).toEqual(new Set(["#ff966e"]));
    expect(new Set(stops(blue))).toEqual(new Set(["#cddeff"]));
  });
});
