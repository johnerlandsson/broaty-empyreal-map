// @vitest-environment happy-dom
// Whether the panel is on screen (on-screen.js): a hidden tab, or Mallard's background tab, whose
// iframe is display:none with document.hidden still false, read off its root's intersection with the
// top viewport; and the glow's breath (svg.js pulse), whose timer stops off screen.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let observe; // the IntersectionObserver's callback
let watched; // what it was asked to watch
let hidden;
const seen = (on) => observe([{ isIntersecting: on }]);
const tab = (h) => {
  hidden = h;
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  vi.resetModules();
  observe = null;
  hidden = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  globalThis.IntersectionObserver = class {
    constructor(fn, opts) {
      expect(opts?.root ?? null).toBe(null); // the top viewport, not the frame's own
      observe = fn;
    }
    observe(el) {
      watched = el;
    }
  };
});
afterEach(() => {
  delete document.hidden;
  delete globalThis.IntersectionObserver;
  vi.useRealTimers();
});

describe("onScreen", () => {
  it("watches the page's root, and counts as on screen till it hears otherwise", async () => {
    const { onScreen } = await import("./on-screen.js");
    expect(watched).toBe(document.documentElement);
    expect(onScreen()).toBe(true);
  });

  it("is off in a display:none frame, with document.hidden false, and says so once each way", async () => {
    const { onScreen, onScreenChange } = await import("./on-screen.js");
    const calls = [];
    onScreenChange(() => calls.push(onScreen()));
    seen(true); // the observer's first word: no change
    seen(false);
    seen(false);
    expect(onScreen()).toBe(false);
    seen(true);
    expect(calls).toEqual([false, true]);
  });

  it("is off on a hidden tab, as before, and a frame hidden as well says nothing more", async () => {
    const { onScreen, onScreenChange } = await import("./on-screen.js");
    const calls = [];
    onScreenChange(() => calls.push(onScreen()));
    tab(true);
    seen(false);
    tab(false); // still display:none
    expect(onScreen()).toBe(false);
    seen(true);
    expect(calls).toEqual([false, true]);
  });

  it("goes by document.hidden alone with no IntersectionObserver", async () => {
    delete globalThis.IntersectionObserver;
    const { onScreen } = await import("./on-screen.js");
    expect(onScreen()).toBe(true);
    tab(true);
    expect(onScreen()).toBe(false);
  });
});

describe("the glow's breath", () => {
  it("stops its timer off screen, and starts it again at the breath's own time on coming back", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "performance"] });
    const { el, pulse, pulseAt } = await import("./svg.js");
    const svg = el("svg", {}, document.body);
    const node = pulse(el("g", {}, svg));
    node.getClientRects = () => [{}];
    vi.advanceTimersByTime(450); // a quarter of a breath
    expect(+node.getAttribute("opacity")).toBeLessThan(1);
    seen(false);
    vi.advanceTimersByTime(100);
    expect(vi.getTimerCount()).toBe(0);
    const left = node.getAttribute("opacity");
    vi.advanceTimersByTime(900);
    expect(node.getAttribute("opacity")).toBe(left); // left as it was
    seen(true);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1000 / 15);
    expect(+node.getAttribute("opacity")).toBe(pulseAt(450 + 100 + 900 + 1000 / 15)); // where it is now, not where it stopped
  });
});
