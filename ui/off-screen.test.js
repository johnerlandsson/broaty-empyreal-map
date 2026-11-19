// @vitest-environment happy-dom
// Off screen, nothing animates (lib/on-screen.js): Mallard keeps a background tab's panel mounted with
// its iframe display:none and document.hidden false. There the sky's and the chart's redraws and the
// space scene's frames stop, and on coming back they draw at once, for the time it is then.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pitCharts } from "../dev/charts-fixture.js";

const noop = new Proxy(function () {}, {
  get: (_, k) => (k === "width" ? 0 : noop),
  apply: () => noop,
  set: () => true,
});

let handlers;
let observe; // the IntersectionObserver's callback
let frames; // requestAnimationFrame callbacks, a cancelled one null
const seen = (on) => observe([{ isIntersecting: on }]);
const emit = (name, msg) => (handlers[name] ?? []).forEach((fn) => fn(msg));
const pending = () => frames.filter(Boolean).length;
function runFrames(now) {
  const due = frames;
  frames = [];
  for (const fn of due) fn?.(now);
}
const skyOf = (port) => document.getElementById(`sky-clip-${port}`)?.closest("svg")?.querySelector('[data-tip="sky"]') ?? null;

beforeEach(async () => {
  HTMLCanvasElement.prototype.getContext = () => noop;
  frames = [];
  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  globalThis.cancelAnimationFrame = (id) => (frames[id - 1] = null);
  globalThis.IntersectionObserver = class {
    constructor(fn) {
      observe = fn;
    }
    observe() {}
  };
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
  document.body.innerHTML = '<main class="station"><div id="model" class="band"></div><div class="separator"></div><div id="deck" class="band"></div><div id="info"></div></main>';
  handlers = {};
  window.panel = { on: (name, fn) => (handlers[name] = handlers[name] ?? []).push(fn), post: () => {}, tooltip: { show() {}, hide() {} } };
  vi.resetModules();
  await import("./main.js");
});
afterEach(() => {
  delete window.panel;
  delete globalThis.IntersectionObserver;
  vi.useRealTimers();
});

describe("off screen", () => {
  it("lets a port's sky stand still, and draws it for now on coming back", () => {
    emit("charts", pitCharts(Date.now()));
    emit("location", { roomId: "zennor.square", name: "The Square", district: "market-quarter", gravity: 0.8 });
    runFrames(performance.now());
    const before = skyOf("zennor");
    expect(before).not.toBe(null);
    seen(false);
    vi.advanceTimersByTime(5000);
    expect(skyOf("zennor")).toBe(before);
    seen(true);
    runFrames(performance.now());
    const back = skyOf("zennor");
    expect(back).not.toBe(before); // at once (the next frame), not a second later
    vi.advanceTimersByTime(1100);
    expect(skyOf("zennor")).not.toBe(back); // and each second again
  });

  it("stops the chart's redraws, and draws it for now on coming back", async () => {
    const { ChartView } = await import("./chart-view.js");
    const at = [];
    const draw = ChartView.prototype.draw;
    ChartView.prototype.draw = function (now) {
      at.push(now);
      return draw.call(this, now);
    };
    emit("charts", pitCharts(Date.now()));
    emit("chart", { on: true });
    runFrames(performance.now());
    vi.advanceTimersByTime(2000);
    expect(at.length).toBeGreaterThan(0);
    seen(false);
    at.length = 0;
    vi.advanceTimersByTime(5000);
    expect(at).toEqual([]);
    seen(true);
    runFrames(performance.now());
    expect(at).toEqual([Date.now()]);
    ChartView.prototype.draw = draw;
  });

  it("asks for no space frames, even when the scene changes, and wakes on coming back", () => {
    emit("scene", { scene: "travelling" });
    runFrames(performance.now());
    expect(pending()).toBe(1);
    seen(false);
    expect(pending()).toBe(0); // the frame asked for is called off
    emit("scene", { scene: "parked" });
    vi.advanceTimersByTime(5000);
    expect(pending()).toBe(0);
    seen(true);
    expect(pending()).toBe(1);
  });
});
