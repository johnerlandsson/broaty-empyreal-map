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

  it("goes by UTC, whatever the local zone", () => {
    // 23:30 UTC is the next day in Stockholm; the clock still says 23:30
    expect(stationTime(new Date("2026-10-26T23:30:00Z")).time).toBe("23:30");
  });

  it("names no shift: shifts are T.I.S.S.'s own, not the game's", () => {
    expect(Object.keys(stationTime(utc(13, 52))).sort()).toEqual(["ms", "time"]);
  });

  it("says how long until the minute turns, so the clock can wake for it", () => {
    expect(stationTime(utc(13, 52)).ms).toBe(60000);
    expect(stationTime(utc(13, 52, 59, 500)).ms).toBe(500);
    expect(stationTime(utc(13, 52, 15)).ms).toBe(45000);
  });
});
