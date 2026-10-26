// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { StationClock } from "./station-clock.js";

afterEach(() => vi.useRealTimers());

describe("station clock", () => {
  it("shows station time in the panel's frame, and turns with the minute", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 26, 13, 59, 30));
    const frame = document.createElement("main");
    const clock = new StationClock(frame);
    const el = frame.querySelector(":scope > .station-clock");
    expect(el).toBe(clock.div);
    expect(el.textContent).toBe("13:59");
    vi.advanceTimersByTime(30000);
    expect(el.textContent).toBe("14:00");
    vi.advanceTimersByTime(10 * 3600 * 1000);
    expect(el.textContent).toBe("00:00");
  });

  it("stops when removed", () => {
    vi.useFakeTimers();
    const frame = document.createElement("main");
    const clock = new StationClock(frame);
    clock.remove();
    expect(frame.querySelector(".station-clock")).toBe(null);
    expect(vi.getTimerCount()).toBe(0);
  });
});
