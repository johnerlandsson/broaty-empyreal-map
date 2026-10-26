import { describe, expect, it } from "vitest";
import { parseWheelAddress } from "./wheel.mjs";

describe("parseWheelAddress", () => {
  it("reads a ring address with a side", () => {
    expect(parseWheelAddress("Rim 1:00 aft")).toEqual({ part: "rim", hour: 1, side: "aft" });
  });

  it("reads a hub address with a side", () => {
    expect(parseWheelAddress("Hub, freight")).toEqual({ part: "hub", side: "freight" });
    expect(parseWheelAddress("Hub")).toEqual({ part: "hub" });
  });

  it("reads 12:00 as hour 0 and the half hour", () => {
    expect(parseWheelAddress("Inner 12:00")).toEqual({ part: "inner", hour: 0 });
    expect(parseWheelAddress("Mid 4:30 ladderway")).toEqual({ part: "mid", hour: 4.5, side: "ladderway" });
  });

  it("reads the spine and a lift", () => {
    expect(parseWheelAddress("Spine 4 fore")).toEqual({ part: "spine", spine: 4, side: "fore" });
    expect(parseWheelAddress("Spine 2")).toEqual({ part: "spine", spine: 2 });
    expect(parseWheelAddress("Lift 12")).toEqual({ part: "lift", hour: 0 });
  });

  it("refuses what isn't a wheel address", () => {
    expect(parseWheelAddress("Rim 4:15")).toBeNull();
    expect(parseWheelAddress("Spine 0")).toBeNull();
    expect(parseWheelAddress("Lift 13")).toBeNull();
    expect(parseWheelAddress("Deck 2, frame 3")).toBeNull();
    expect(parseWheelAddress(undefined)).toBeNull();
  });
});
