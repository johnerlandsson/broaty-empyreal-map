import { describe, expect, it } from "vitest";
import { clearanceCard } from "./clearance.js";

const REPAIR = { verb: "repair", label: "repairing the laser", stage: 2, stages: 3, ends: 1031, total: 48, queued: 0 };
const at = (s) => s * 1000;

describe("clearance card", () => {
  it("is nothing while she isn't waiting on Control", () => {
    expect(clearanceCard(undefined)).toBe(null);
    expect(clearanceCard({})).toBe(null);
    expect(clearanceCard({ verb: null })).toBe(null);
    expect(clearanceCard({ verb: "rcs", at: "T.I.S.S." })).toBe(null);
  });

  it("says she's awaiting clearance and where, with no time or bar: the game sends no countdown", () => {
    const none = { detail: "", seconds: null, fraction: null, ms: null };
    expect(clearanceCard({ verb: "undock", at: "T.I.S.S." })).toEqual({ label: "awaiting clearance · T.I.S.S.", ...none });
    expect(clearanceCard({ verb: "dock", at: "Zennor" })).toEqual({ label: "awaiting clearance · Zennor", ...none });
    expect(clearanceCard({ verb: "dock", at: "the Full Measure" }).label).toBe("awaiting clearance · the Full Measure");
  });

  it("with no place named, says only that she's waiting", () => {
    expect(clearanceCard({ verb: "dock" }).label).toBe("awaiting clearance");
    expect(clearanceCard({ verb: "dock", at: " " }).label).toBe("awaiting clearance");
    expect(clearanceCard({ verb: "dock", at: 4 }).label).toBe("awaiting clearance");
  });
});
