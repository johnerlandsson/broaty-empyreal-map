import { describe, expect, it } from "vitest";
import { Belt, Starfield, approach, rockFaces, makeRock, targets } from "./space.js";
import { rng } from "./svg.js";

describe("targets", () => {
  it("station hides space", () => {
    expect(targets("station").space).toBe(0);
  });

  it("parked shows still stars, no rocks", () => {
    const t = targets("parked");
    expect(t).toMatchObject({ space: 1, belt: 0 });
    expect(t.speed).toBeLessThan(0.05);
  });

  it("travelling streams at full speed", () => {
    expect(targets("travelling")).toMatchObject({ space: 1, belt: 0, speed: 1 });
  });

  it("belt shows rocks and stops the stars", () => {
    expect(targets("belt")).toMatchObject({ space: 1, belt: 1, speed: 0 });
  });

  it("an unknown scene is the station", () => {
    expect(targets("nonsense")).toEqual(targets("station"));
  });
});

describe("approach", () => {
  it("moves part way toward the target", () => {
    const v = approach(0, 1, 0.1, 2);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it("snaps when close", () => {
    expect(approach(0.9995, 1, 0.016, 2)).toBe(1);
  });

  it("never moves away on a negative step (a frame stamped before the loop started)", () => {
    expect(approach(0, 1, -0.01, 2)).toBe(0);
  });

  it("never overshoots on a long frame", () => {
    expect(approach(0, 1, 10, 2)).toBe(1);
  });
});

describe("Starfield", () => {
  it("holds still at speed 0", () => {
    const f = new Starfield(50, rng(1));
    const before = structuredClone(f.stars);
    f.step(0.5, 0);
    expect(f.stars).toEqual(before);
  });

  it("brings stars nearer while moving", () => {
    const f = new Starfield(50, rng(1));
    const z0 = f.stars.map((s) => s.z);
    f.step(0.01, 1);
    f.stars.forEach((s, i) => expect(s.z).toBeLessThan(z0[i]));
  });

  it("recycles stars that pass the camera to the far plane", () => {
    const f = new Starfield(50, rng(1));
    for (let i = 0; i < 200; i++) f.step(0.05, 1);
    for (const s of f.stars) {
      expect(s.z).toBeGreaterThan(0);
      expect(s.z).toBeLessThanOrEqual(1);
    }
  });

  it("draws longer streaks at speed", () => {
    const len = (speed) => {
      const f = new Starfield(50, rng(1));
      f.step(0.016, speed);
      return f.segments(360, 220).reduce((a, [x0, y0, x1, y1]) => a + Math.hypot(x1 - x0, y1 - y0), 0);
    };
    expect(len(1)).toBeGreaterThan(len(0.01) * 10);
  });
});

describe("rocks", () => {
  it("shows only front faces, far to near, in the three tones", () => {
    const faces = rockFaces(makeRock(rng(3)), 0.7, 1.9);
    expect(faces.length).toBeGreaterThan(0);
    expect(faces.length).toBeLessThan(20);
    for (let i = 1; i < faces.length; i++) expect(faces[i].z).toBeGreaterThanOrEqual(faces[i - 1].z);
    for (const f of faces) {
      expect(f.pts).toHaveLength(3);
      expect([0, 1, 2]).toContain(f.tone);
    }
  });

  it("drift right to left and come back on the right", () => {
    const b = new Belt(12, rng(5));
    const w = 360;
    const h = 220;
    b.step(0, w, h);
    const x0 = b.rocks.map((r) => r.x);
    b.step(0.1, w, h);
    b.rocks.forEach((r, i) => expect(r.x).toBeLessThan(x0[i]));
    for (let i = 0; i < 2000; i++) b.step(0.1, w, h);
    for (const r of b.rocks) expect(r.x).toBeGreaterThan(-r.size * 2 - 1);
  });

  it("are listed far to near", () => {
    const b = new Belt(12, rng(5));
    b.step(0.1, 360, 220);
    for (let i = 1; i < b.rocks.length; i++) expect(b.rocks[i].d).toBeGreaterThanOrEqual(b.rocks[i - 1].d);
  });
});
