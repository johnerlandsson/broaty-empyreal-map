import { describe, expect, it } from "vitest";
import { stationTime } from "./clock.js";

// As the game sends it: today began at MIDNIGHT, a day of DAY ms (Tamsin's solar day).
const MIDNIGHT = Date.UTC(2026, 9, 26, 9, 0);
const DAY = 15247058.823529412;
const MINUTE = DAY / 1440;
const CLOCK = { weekday: "wednesday", day: 40, midnight: MIDNIGHT, dayMs: DAY };
/** Wall-clock ms at an Empyreal time today (or later, past 24:00). */
const at = (h, m, part = 0) => MIDNIGHT + (h * 60 + m + part) * MINUTE;

describe("station time", () => {
  it("is Empyreal time: a 24-hour day's share of the time since midnight", () => {
    expect(stationTime(CLOCK, at(0, 0)).time).toBe("00:00");
    expect(stationTime(CLOCK, at(7, 5)).time).toBe("07:05");
    expect(stationTime(CLOCK, at(14, 32, 0.5)).time).toBe("14:32");
    expect(stationTime(CLOCK, at(23, 59, 0.99)).time).toBe("23:59");
    // a quarter of a day in, about an hour of real time, is 06:00
    expect(stationTime(CLOCK, MIDNIGHT + DAY / 4).time).toBe("06:00");
  });

  it("is a minute's own minute at its exact time, as the game's clock is", () => {
    for (const m of [1, 59, 61, 841, 1439]) {
      const t = stationTime(CLOCK, MIDNIGHT + m * MINUTE);
      expect(t.time).toBe(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }
  });

  it("says today's weekday, and moves it on past midnight before the next message", () => {
    expect(stationTime(CLOCK, at(14, 32)).weekday).toBe("wednesday");
    expect(stationTime(CLOCK, at(24, 0))).toMatchObject({ time: "00:00", weekday: "thursday" });
    expect(stationTime(CLOCK, at(24 * 4 + 13, 37))).toMatchObject({ time: "13:37", weekday: "sunday" });
    expect(stationTime(CLOCK, at(24 * 5, 1))).toMatchObject({ time: "00:01", weekday: "monday" });
  });

  it("puts a client clock a little behind the server's just before midnight, the day before", () => {
    // the message came at midnight, but this clock is two seconds slow
    expect(stationTime(CLOCK, MIDNIGHT - 2000)).toMatchObject({ time: "23:59", weekday: "tuesday" });
  });

  it("takes the weekday in any case", () => {
    expect(stationTime({ ...CLOCK, weekday: "Saturday" }, at(1, 0)).weekday).toBe("saturday");
  });

  it("says how long until the Empyreal minute turns, about 10.6 real seconds a minute", () => {
    expect(MINUTE).toBeCloseTo(10588, 0);
    expect(stationTime(CLOCK, at(13, 52)).ms).toBe(Math.ceil(MINUTE));
    expect(stationTime(CLOCK, at(13, 52, 0.5)).ms).toBe(Math.ceil(MINUTE / 2));
    // waking when it says, it's the next minute
    const now = at(13, 52, 0.3);
    expect(stationTime(CLOCK, now + stationTime(CLOCK, now).ms).time).toBe("13:53");
  });

  it("is nothing without a clock that can run: no UTC to fall back on", () => {
    expect(stationTime(null, at(1, 0))).toBe(null);
    expect(stationTime(undefined, at(1, 0))).toBe(null);
    expect(stationTime({ ...CLOCK, weekday: "wed" }, at(1, 0))).toBe(null);
    expect(stationTime({ ...CLOCK, midnight: "noon" }, at(1, 0))).toBe(null);
    expect(stationTime({ ...CLOCK, dayMs: 0 }, at(1, 0))).toBe(null);
    expect(stationTime({ ...CLOCK, dayMs: Infinity }, at(1, 0))).toBe(null);
  });

  it("names no shift: shifts are T.I.S.S.'s own, not the game's", () => {
    expect(Object.keys(stationTime(CLOCK, at(13, 52))).sort()).toEqual(["ms", "time", "weekday"]);
  });
});
