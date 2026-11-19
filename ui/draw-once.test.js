// @vitest-environment happy-dom
// One draw a frame (lib/draw-soon.js): a message sets a view and the panel draws it once, at the next
// frame, however many messages came in it (the replay after "ready"). The chart's and the sky's
// timers are started once and left running, and redraw a second after the last draw, whoever drew.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chartCase } from "../dev/charts-cases.js";
import { pitCharts } from "../dev/charts-fixture.js";

const noop = new Proxy(function () {}, {
  get: (_, k) => (k === "width" ? 0 : noop),
  apply: () => noop,
  set: () => true,
});

let handlers;
let frames; // requestAnimationFrame callbacks, a cancelled one null
let draws; // view class name -> draws
const emit = (name, msg) => (handlers[name] ?? []).forEach((fn) => fn(msg));
function runFrames() {
  const due = frames;
  frames = [];
  for (const fn of due) fn?.(performance.now());
}
/** Count each draw of these classes, from now. */
function count(...classes) {
  draws = {};
  for (const C of classes) {
    const draw = C.prototype.draw;
    vi.spyOn(C.prototype, "draw").mockImplementation(function (t) {
      draws[C.name] = (draws[C.name] ?? 0) + 1;
      return draw.call(this, t);
    });
  }
}

beforeEach(async () => {
  HTMLCanvasElement.prototype.getContext = () => noop;
  frames = [];
  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  globalThis.cancelAnimationFrame = (id) => (frames[id - 1] = null);
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
  document.body.innerHTML = '<main class="station"><div id="model" class="band"></div><div class="separator"></div><div id="deck" class="band"></div><div id="info"></div></main>';
  handlers = {};
  window.panel = { on: (name, fn) => (handlers[name] = handlers[name] ?? []).push(fn), post: () => {}, tooltip: { show() {}, hide() {} } };
  vi.resetModules();
  await import("./main.js");
});
afterEach(() => {
  vi.restoreAllMocks();
  delete window.panel;
  vi.useRealTimers();
});

describe("one draw a frame", () => {
  it("draws the chart once for the replay's burst of messages", async () => {
    const { ChartView } = await import("./chart-view.js");
    const { LanesView } = await import("./lanes-view.js");
    const { BeltView } = await import("./belt-view.js");
    count(ChartView, LanesView, BeltView);
    const c = chartCase("at-gannet", Date.now());
    emit("charts", c.charts);
    emit("chart-ship", c.ship);
    emit("course", c.course);
    emit("chart-contacts", c.contacts);
    emit("chart", { on: true });
    emit("lanes-view", { on: false });
    emit("belt-view", { on: false });
    const marks = () => document.querySelectorAll(".chart [data-tip]").length;
    expect(draws).toEqual({}); // not yet: at the frame
    expect(marks()).toBe(0);
    runFrames();
    // the belt map, not shown, is set by the charts, the sweep and the course: one draw, a no-op
    expect(draws).toEqual({ ChartView: 1, BeltView: 1 });
    expect(marks()).toBeGreaterThan(0); // and that one draw is the chart, framed and marked
  });

  it("draws the chart once a status, parked, and its tick adds none while statuses come", async () => {
    const { ChartView } = await import("./chart-view.js");
    const c = chartCase("at-gannet", Date.now());
    emit("charts", c.charts);
    emit("chart-ship", c.ship);
    emit("chart", { on: true });
    runFrames();
    count(ChartView);
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(700); // her statuses, closer than a second
      emit("chart-ship", { ...c.ship });
      runFrames();
    }
    expect(draws).toEqual({ ChartView: 5 });
    vi.advanceTimersByTime(999); // they stop: the tick draws a second after the last
    expect(draws).toEqual({ ChartView: 5 });
    vi.advanceTimersByTime(1);
    expect(draws).toEqual({ ChartView: 6 });
    vi.advanceTimersByTime(2000);
    expect(draws).toEqual({ ChartView: 8 });
  });

  it("draws the chart once a status under way, with her smooth redraws between", async () => {
    const { ChartView } = await import("./chart-view.js");
    const c = chartCase("under-way-orrin", Date.now());
    emit("charts", c.charts);
    emit("chart-ship", c.ship);
    emit("chart", { on: true });
    runFrames();
    count(ChartView);
    emit("chart-ship", { ...c.ship });
    emit("chart-ship", { ...c.ship });
    runFrames(); // the status's draw; the smooth step, the same frame, needn't draw again
    expect(draws).toEqual({ ChartView: 1 });
    vi.advanceTimersByTime(100);
    runFrames();
    expect(draws).toEqual({ ChartView: 2 });
  });

  it("draws a port's sky once a location, its tick a second after the last draw", async () => {
    const { SkyView } = await import("./town-view.js");
    emit("charts", pitCharts(Date.now()));
    count(SkyView);
    const square = { roomId: "zennor.square", name: "The Square", district: "market-quarter", gravity: 0.8 };
    emit("location", square);
    runFrames();
    expect(draws).toEqual({ SkyView: 1 });
    vi.advanceTimersByTime(600);
    emit("location", { ...square });
    runFrames();
    expect(draws).toEqual({ SkyView: 2 });
    vi.advanceTimersByTime(400); // a second since the first, but the second's draw puts the tick off
    expect(draws).toEqual({ SkyView: 2 });
    vi.advanceTimersByTime(600);
    expect(draws).toEqual({ SkyView: 3 });
  });
});
