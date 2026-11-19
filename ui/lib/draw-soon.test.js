// lib/draw-soon.js: one draw a frame, a view on its own drawn at once, and a timer that redraws a
// second after the last draw.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let frames;
let mod;
const runFrames = () => {
  const due = frames;
  frames = [];
  for (const fn of due) fn(0);
};
/** A view as the panel's are: draw(t) starts with drawing(this, t). */
const view = (fn = () => {}) => ({ n: 0, draw(t) { mod.drawing(this, t); this.n++; fn(t); } });

beforeEach(async () => {
  frames = [];
  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.resetModules();
  mod = await import("./draw-soon.js");
});
afterEach(() => vi.useRealTimers());

describe("drawSoon", () => {
  it("draws a view at once until the panel defers", () => {
    const v = view();
    mod.drawSoon(v);
    expect(v.n).toBe(1);
  });

  it("draws each view once at the next frame, a draw meanwhile doing for it", () => {
    mod.deferDraws();
    const [a, b] = [view(), view()];
    mod.drawSoon(a);
    mod.drawSoon(a);
    mod.drawSoon(b);
    b.draw(Date.now()); // a pan's, say
    expect(frames.length).toBe(1);
    runFrames();
    expect([a.n, b.n]).toEqual([1, 1]);
  });

  it("draws the rest when one view's draw throws", () => {
    mod.deferDraws();
    const bad = view(() => {
      throw new Error("bad data");
    });
    const good = view();
    mod.drawSoon(bad);
    mod.drawSoon(good);
    runFrames();
    expect(good.n).toBe(1);
    expect(() => vi.runOnlyPendingTimers()).toThrow("bad data"); // still reported
  });
});

describe("drawEvery", () => {
  it("redraws a second after the last draw, whoever drew, and stops", () => {
    const v = view();
    const stop = mod.drawEvery(v, 1000);
    vi.advanceTimersByTime(1000);
    expect(v.n).toBe(1);
    vi.advanceTimersByTime(940);
    v.draw(Date.now()); // a message's, just before the tick
    vi.advanceTimersByTime(60);
    expect(v.n).toBe(2); // the tick put off
    vi.advanceTimersByTime(939);
    expect(v.n).toBe(2);
    vi.advanceTimersByTime(1); // a second after that draw, not two
    expect(v.n).toBe(3);
    stop();
    vi.advanceTimersByTime(5000);
    expect(v.n).toBe(3);
  });
});
