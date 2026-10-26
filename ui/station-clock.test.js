// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import cases from "../dev/sky-cases.json" with { type: "json" };
import { indexCharts } from "./lib/orbits.js";
import { groundSky } from "./lib/sky.js";
import { StationClock } from "./station-clock.js";

afterEach(() => vi.useRealTimers());

const MIDNIGHT = Date.UTC(2026, 9, 26, 9, 0);
const DAY = 15247058.823529412;
const MINUTE = DAY / 1440;
const CLOCK = { weekday: "wednesday", day: 40, midnight: MIDNIGHT, dayMs: DAY };

describe("station clock", () => {
  it("is hidden until the game's clock comes: no UTC to fall back on", () => {
    vi.useFakeTimers();
    const frame = document.createElement("main");
    const clock = new StationClock(frame);
    const el = frame.querySelector(":scope > .station-clock");
    expect(el).toBe(clock.div);
    expect(el.hidden).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows Empyreal time and turns with each Empyreal minute, not each real one", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MIDNIGHT + (13 * 60 + 59.5) * MINUTE);
    const frame = document.createElement("main");
    const clock = new StationClock(frame);
    clock.set({ clock: CLOCK });
    const el = clock.div;
    expect(el.hidden).toBe(false);
    expect(el.textContent).toBe("Wed 13:59");
    expect(el.querySelector("b").textContent).toBe("13:59"); // the time bright, the day beside it
    vi.advanceTimersByTime(Math.ceil(MINUTE / 2));
    expect(el.textContent).toBe("Wed 14:00");
    vi.advanceTimersByTime(60000); // a real minute is five or six of Empyreal's
    expect(el.textContent).toBe("Wed 14:05");
    vi.advanceTimersByTime(Math.ceil(10 * 60 * MINUTE)); // past midnight, with no new message
    expect(el.textContent).toBe("Thu 00:05");
  });

  it("hides again when the clock is cleared at a disconnect, and stops", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MIDNIGHT + 60 * MINUTE);
    const frame = document.createElement("main");
    const clock = new StationClock(frame);
    clock.set({ clock: CLOCK });
    expect(vi.getTimerCount()).toBe(1);
    clock.set({});
    expect(clock.div.hidden).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a new clock, at midnight or after a restart, replaces the old one's timer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MIDNIGHT + DAY + 1000);
    const frame = document.createElement("main");
    const clock = new StationClock(frame);
    clock.set({ clock: CLOCK });
    clock.set({ clock: { ...CLOCK, weekday: "thursday", day: 41, midnight: MIDNIGHT + DAY } });
    expect(vi.getTimerCount()).toBe(1);
    expect(clock.div.textContent).toBe("Thu 00:00");
  });

  it("on a port, says where the sun is, as the game's `time` does, and off it, nothing", () => {
    vi.useFakeTimers();
    const idx = indexCharts(cases.charts);
    // a moment of each phase over Zennor, from the game's own recorded sky
    const find = (re) => idx.epoch + (cases.cases.find((c) => re.test(c.text)).tick + 30) * 1000;
    const frame = document.createElement("main");
    const clock = new StationClock(frame);
    for (const [re, word] of [[/^Dusk:/, "dusk"], [/is paling/, "dawn"], [/^Night:/, "night"], [/stands high overhead/, "day"]]) {
      const t = find(re);
      vi.setSystemTime(t);
      clock.set({ clock: { ...CLOCK, midnight: t - 60 * MINUTE } });
      clock.setPort(idx, "zennor");
      expect(clock.div.textContent, word).toBe(`Wed 01:00 · ${word}`);
    }
    clock.setPort(idx, null); // stepped aboard, or up to a station
    expect(clock.div.textContent).toBe("Wed 01:00");
    clock.setPort(null, "zennor"); // no charts to place it by
    expect(clock.div.textContent).toBe("Wed 01:00");
  });

  it("the sun moves on with the minute", () => {
    vi.useFakeTimers();
    const idx = indexCharts(cases.charts);
    // the last moment of day before dusk: groundSky turns from a "low" sun to one going down
    const i = cases.cases.findIndex((c, k) => / is low in the west/.test(c.text) && /going down/.test(cases.cases[k + 1]?.text ?? ""));
    const end = idx.epoch + cases.cases[i + 1].tick * 1000;
    vi.setSystemTime(end - 5000);
    expect(groundSky(idx, "zennor", Date.now()).band).toBe("low");
    const clock = new StationClock(document.createElement("main"));
    clock.set({ clock: { ...CLOCK, midnight: Date.now() - 60 * MINUTE } });
    clock.setPort(idx, "zennor");
    expect(clock.div.textContent).toMatch(/· day$/);
    vi.advanceTimersByTime(Math.ceil(MINUTE) + 5000);
    expect(clock.div.textContent).toMatch(/· dusk$/);
  });

  it("stops when removed", () => {
    vi.useFakeTimers();
    const frame = document.createElement("main");
    const clock = new StationClock(frame);
    clock.set({ clock: CLOCK });
    clock.remove();
    expect(frame.querySelector(".station-clock")).toBe(null);
    expect(vi.getTimerCount()).toBe(0);
  });
});
