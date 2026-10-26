import { describe, expect, it } from "vitest";
import { CAM, FRONT, P3, camera, project, roll } from "./geometry.js";

describe("geometry", () => {
  it("roll moves hour 0 to hour 3", () => {
    const a = roll(P3(1, 0, 0), 3);
    const b = P3(1, 3, 0);
    for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i], 9);
  });

  it("FRONT is about -0.6 hours for CAM 16/38", () => {
    expect(CAM).toEqual({ yaw: 16, pitch: 38 });
    expect(FRONT).toBeGreaterThan(-0.9);
    expect(FRONT).toBeLessThan(-0.3);
  });

  it("project puts a fore point lower on screen than the hub", () => {
    expect(project([0, 0, 200])[1]).toBeGreaterThan(project([0, 0, 0])[1]);
  });

  it("project gives larger depth to nearer points", () => {
    expect(project([0, -100, 0])[2]).toBeLessThan(project([0, 100, 0])[2]);
  });

  it("camera(CAM) is the default camera", () => {
    const c = camera(CAM);
    expect(c.project([1, 2, 3])).toEqual(project([1, 2, 3]));
    expect(c.front).toBe(FRONT);
  });

  it("camera at yaw 0, pitch 0 looks straight down the axis", () => {
    const [x, y, z] = camera({ yaw: 0, pitch: 0 }).project([1, 2, 3]);
    expect(x).toBeCloseTo(1, 12);
    expect(y).toBeCloseTo(-2, 12);
    expect(z).toBeCloseTo(3, 12);
  });
});
