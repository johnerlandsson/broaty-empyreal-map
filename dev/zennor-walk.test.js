import { describe, expect, it } from "vitest";
// The walk is checked against a frozen copy of Zennor, so a room the game adds doesn't fail the
// sync's tests; the preview simply won't walk into it until the walk is extended.
import generated from "../tests/fixtures/generated/zennor.js";
import { townData } from "../ui/lib/look.js";
import { exitTo } from "../ui/lib/town.js";
import { TRAM, ZENNOR_WALK } from "./zennor-walk.js";

const zennor = townData(generated);
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
