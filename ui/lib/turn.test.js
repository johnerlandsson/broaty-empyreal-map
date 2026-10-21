import { describe, expect, it } from "vitest";
import { FRONT } from "./geometry.js";
import { shortestTurn, turnDuration } from "./turn.js";

const mod12 = (v) => ((v % 12) + 12) % 12;

describe("shortestTurn", () => {
  it("already facing", () => {
    expect(shortestTurn(FRONT - 2, 2)).toBeCloseTo(FRONT - 2, 9);
  });

  it("wraps forward across 12", () => {
    const phi = FRONT - 11;
    expect(shortestTurn(phi, 0) - phi).toBeCloseTo(-1, 9);
  });

  it("never turns more than 6 hours and always lands on the front", () => {
    for (let h = 0; h < 12; h++) {
      for (const phi of [0, 3.7, -5, 40.2]) {
        const t = shortestTurn(phi, h);
        expect(Math.abs(t - phi)).toBeLessThanOrEqual(6 + 1e-9);
        expect(mod12(t + h - FRONT)).toBeCloseTo(0, 6);
      }
    }
  });

  it("honours a custom front", () => {
    expect(mod12(shortestTurn(0, 3, 0) + 3)).toBeCloseTo(0, 9);
  });
});

describe("turnDuration", () => {
  it("is 350 + 120 per hour", () => {
    expect(turnDuration(2)).toBe(590);
    expect(turnDuration(-2)).toBe(590);
    expect(turnDuration(0)).toBe(350);
  });
});
