import { describe, expect, it } from "vitest";
import { actionCard } from "./action.js";

const REPAIR = { verb: "repair", label: "repairing the laser", stage: 2, stages: 3, ends: 1031, total: 48, queued: 0 };
const at = (s) => s * 1000;

describe("action card", () => {
  it("is nothing while you're doing nothing", () => {
    expect(actionCard(undefined, at(1000))).toBe(null);
    expect(actionCard({}, at(1000))).toBe(null);
    expect(actionCard({ action: null }, at(1000))).toBe(null);
    expect(actionCard({ action: { label: "" } }, at(1000))).toBe(null);
    expect(actionCard({ action: "repairing" }, at(1000))).toBe(null);
  });

  it("gives a staged action's label, its stage of how many and the seconds left, counted down here", () => {
    expect(actionCard({ action: REPAIR }, at(1000))).toEqual({
      label: "repairing the laser",
      detail: "stage 2 of 3",
      seconds: 31,
      fraction: 31 / 48,
      ms: 31000,
    });
    const later = actionCard({ action: REPAIR }, at(1020.5));
    expect(later.seconds).toBe(11);
    expect(later.fraction).toBeCloseTo(10.5 / 48);
  });

  it("names no stage for an action of one, and says what waits", () => {
    const climb = { verb: "move", label: "climbing", stage: 1, stages: 1, ends: 1010, total: 10, queued: 0 };
    expect(actionCard({ action: climb }, at(1004)).detail).toBe("");
    expect(actionCard({ action: { ...climb, queued: 1 } }, at(1004)).detail).toBe("1 waiting");
    expect(actionCard({ action: { ...REPAIR, queued: 2 } }, at(1000)).detail).toBe("stage 2 of 3 · 2 waiting");
  });

  it("past its end, holds at nothing left until the game says it's over", () => {
    expect(actionCard({ action: REPAIR }, at(1040))).toMatchObject({ seconds: 0, fraction: 0, ms: 0 });
  });

  it("with no known end, shows the label without a time or a bar", () => {
    const card = actionCard({ action: { label: "eating spacer's stew", stage: 1, stages: 1, queued: 0 } }, at(1000));
    expect(card).toEqual({ label: "eating spacer's stew", detail: "", seconds: null, fraction: null, ms: null });
  });

  it("a total of nothing is an empty bar, not a division by zero", () => {
    expect(actionCard({ action: { ...REPAIR, ends: 1000, total: 0 } }, at(1000)).fraction).toBe(0);
  });

  it("keeps the fraction within the bar, a clock behind the game's notwithstanding", () => {
    expect(actionCard({ action: REPAIR }, at(900)).fraction).toBe(1);
  });
});
