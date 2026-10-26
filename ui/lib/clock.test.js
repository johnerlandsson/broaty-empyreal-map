import { describe, expect, it } from "vitest";
import { stationTime } from "./clock.js";

const utc = (h, m, s = 0, ms = 0) => Date.UTC(2026, 9, 26, h, m, s, ms);

describe("station time", () => {
  it("is UTC, as hours and minutes", () => {
    expect(stationTime(utc(13, 52)).time).toBe("13:52");
    expect(stationTime(utc(0, 0)).time).toBe("00:00");
    expect(stationTime(utc(7, 5)).time).toBe("07:05");
    expect(stationTime(utc(23, 59, 59)).time).toBe("23:59");
  });

  it("names the shift as help people does: first 06:00 to 14:00, second 14:00 to 22:00, the night watch otherwise", () => {
    const shift = (h, m) => stationTime(utc(h, m)).shift;
    expect(shift(5, 59)).toBe("night watch");
    expect(shift(6, 0)).toBe("first shift");
    expect(shift(13, 59)).toBe("first shift");
    expect(shift(14, 0)).toBe("second shift");
    expect(shift(21, 59)).toBe("second shift");
    expect(shift(22, 0)).toBe("night watch");
    expect(shift(0, 0)).toBe("night watch");
  });

  it("goes by UTC, whatever the local zone", () => {
    // 23:30 UTC is the next day in Stockholm; the clock still says the night watch at 23:30
    expect(stationTime(new Date("2026-10-26T23:30:00Z"))).toMatchObject({ time: "23:30", shift: "night watch" });
  });

  it("says how long until the minute turns, so the clock can wake for it", () => {
    expect(stationTime(utc(13, 52)).ms).toBe(60000);
    expect(stationTime(utc(13, 52, 59, 500)).ms).toBe(500);
    expect(stationTime(utc(13, 52, 15)).ms).toBe(45000);
  });
});
