import { describe, expect, it } from "vitest";
import { CAM, FRONT, P3, districtOf, project, roll } from "./geometry.js";

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

  it("districtOf follows the region inference", () => {
    expect(districtOf(0, 22)).toBe("concourse");
    expect(districtOf(0, 4)).toBe("residential");
    expect(districtOf(0, 12)).toBe("hydroponics");
    expect(districtOf(0, 18)).toBe("commons");
    expect(districtOf(1, 21)).toBe("offices");
    expect(districtOf(1, 9)).toBe("midring");
    expect(districtOf(2, 0)).toBe("industrial");
    expect(districtOf(3, 0)).toBe("docks");
  });
});
