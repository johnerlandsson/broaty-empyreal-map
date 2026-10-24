import { describe, expect, it } from "vitest";
import { Glide, ago, cleanBelt, discFrame, headingOf, placeText, ringKms, toBand } from "./belt.js";

describe("placeText", () => {
  it("says it as the game does", () => {
    expect(placeText({ km: 11.2, bearing: 210 }, 18)).toBe("11 km out from the core, bearing 210°");
    expect(placeText({ km: 0.9, bearing: 40 }, 18)).toBe("at the core");
    expect(placeText({ km: 17.1, bearing: 5 }, 18)).toBe("at the outer edge, bearing 5°");
    expect(placeText({ km: 17, bearing: 5 }, 18)).toBe("17 km out from the core, bearing 5°");
    expect(placeText(null, 18)).toBe(null);
  });
});

describe("cleanBelt", () => {
  it("is null for nothing", () => {
    expect(cleanBelt(null)).toBe(null);
    expect(cleanBelt("x")).toBe(null);
  });

  it("keeps the well-formed parts", () => {
    const b = cleanBelt({
      id: "gannet-3",
      name: "Gannet Belt",
      radius: 18,
      place: { x: 3, y: 4, km: 5, bearing: 37 },
      host: null,
      array: false,
      log: {
        track: [[[1, 2], ["x", 3], [4, 5]], "bad", []],
        sweeps: [{ x: 1, y: 2, r: 5 }, { x: "a" }, { x: 3, y: 4 }],
        left: { x: 1, y: 1, name: "Full Measure", at: 99 },
      },
    });
    expect(b).toEqual({
      id: "gannet-3",
      name: "Gannet Belt",
      radius: 18,
      place: { x: 3, y: 4, km: 5, bearing: 37 },
      host: null,
      array: false,
      track: [[[1, 2], [4, 5]]],
      sweeps: [{ x: 1, y: 2, r: 5 }, { x: 3, y: 4, r: null }],
      left: { x: 1, y: 1, name: "Full Measure", at: 99 },
    });
  });

  it("works out km and bearing when they're missing, and drops a bad radius", () => {
    const b = cleanBelt({ id: "g", radius: -1, place: { x: -5, y: 0 }, log: "x" });
    expect(b.place).toEqual({ x: -5, y: 0, km: 5, bearing: 270 });
    expect(b.radius).toBe(null);
    expect(b.track).toEqual([]);
    expect(b.array).toBe(null);
  });
});

describe("framing", () => {
  it("fits the disc in the band's shorter side, bearing 0 up", () => {
    const f = discFrame(380, 252, 18);
    expect(f.r).toBe(102);
    expect(toBand(f, 0, 18)).toEqual([190, 24]);
    expect(toBand(f, 18, 0)).toEqual([292, 126]);
  });

  it("rings every 5 km short of the rim", () => {
    expect(ringKms(18)).toEqual([5, 10, 15]);
    expect(ringKms(15)).toEqual([5, 10]);
    expect(ringKms(15.6)).toEqual([5, 10, 15]);
  });

  it("headings are clockwise from 0", () => {
    expect(headingOf([0, 0], [0, 1])).toBe(0);
    expect(headingOf([0, 0], [1, 0])).toBe(90);
    expect(headingOf([0, 0], [-1, 0])).toBe(270);
    expect(headingOf([1, 1], [1, 1])).toBe(null);
  });
});

describe("ago", () => {
  it("reads as the lanes key does", () => {
    expect(ago(20)).toBe("just now");
    expect(ago(14 * 60)).toBe("14m");
    expect(ago(2 * 3600 + 300)).toBe("2h 5m");
    expect(ago(3 * 86400 + 4 * 3600)).toBe("3d 4h");
  });
});

describe("Glide", () => {
  it("puts her first place at once", () => {
    const g = new Glide();
    g.set("g", [1, 1], 1000);
    expect(g.at(1000)).toEqual([1, 1]);
    expect(g.moving(1000)).toBe(false);
  });

  it("moves her to the next place over the time since the last came", () => {
    const g = new Glide();
    g.set("g", [0, 0], 0);
    g.set("g", [0, 1], 1000);
    expect(g.moving(1500)).toBe(true);
    expect(g.at(1500)).toEqual([0, 0.5]);
    expect(g.at(2000)).toEqual([0, 1]);
    expect(g.heading).toBe(0);
    g.set("g", [1, 1], 3000); // a second later than due: still clamped to 1.5 s
    expect(g.end - g.start).toBe(1500);
    expect(g.heading).toBe(90);
  });

  it("jumps in a new belt, and the same place again changes nothing", () => {
    const g = new Glide();
    g.set("g", [0, 0], 0);
    g.set("c", [5, 5], 1000);
    expect(g.at(1000)).toEqual([5, 5]);
    g.set("c", [5, 5], 2000);
    expect(g.moving(2000)).toBe(false);
    g.set("c", null, 3000);
    expect(g.at(3000)).toBe(null);
  });
});
