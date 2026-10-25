import { describe, expect, it } from "vitest";
import zennor from "../ui/data/zennor.js";
import { exitTo } from "../ui/lib/town.js";
import { TRAM, ZENNOR_WALK } from "./zennor-walk.js";

const byId = new Map(zennor.rooms.map((r) => [r.id, r]));
const stops = zennor.cars.find((c) => c.id === TRAM).stops;

describe("the preview's walk round Zennor", () => {
  it("takes one exit a step, or boards or leaves the tram at a stop", () => {
    for (let i = 1; i < ZENNOR_WALK.length; i++) {
      const [from, to] = [ZENNOR_WALK[i - 1], ZENNOR_WALK[i]];
      if (from === TRAM || to === TRAM) {
        expect(stops, `${from} → ${to}`).toContain(from === TRAM ? to : from);
        continue;
      }
      const ways = Object.values(byId.get(from)?.exits ?? {}).map(exitTo);
      expect(ways, `${from} → ${to}`).toContain(to);
    }
  });

  it("goes everywhere in the city, starting and ending on the field", () => {
    expect(new Set(ZENNOR_WALK.filter((id) => id !== TRAM))).toEqual(new Set(byId.keys()));
    expect(ZENNOR_WALK[0]).toBe("zennor.field");
    expect(ZENNOR_WALK.at(-1)).toBe("zennor.field");
  });
});
