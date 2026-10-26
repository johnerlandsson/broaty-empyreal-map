// @vitest-environment happy-dom
// buildPlace: each builder (decks, drum, town, wheel) gives a place's model, plan, index and locate,
// the same views the panel and the tweak editor draw.

import { describe, expect, it } from "vitest";
import caradon from "../tests/fixtures/generated/caradon.js";
import garrow from "../tests/fixtures/generated/garrow.js";
import kilmar from "../tests/fixtures/generated/kilmar.js";
import orrin from "../tests/fixtures/generated/orrin.js";
import wenna from "../tests/fixtures/generated/wenna.js";
import zennor from "../tests/fixtures/generated/zennor.js";
import tiss from "./data/tiss.js";
import { plans } from "./data/ships.js";
import { buildPlace, buildShip } from "./place-views.js";

const CASES = [
  ["decks", orrin],
  ["decks", kilmar],
  ["decks", caradon],
  ["decks", garrow],
  ["drum", wenna],
  ["town", zennor],
  ["wheel", tiss],
];

describe("buildPlace", () => {
  for (const [builder, data] of CASES) {
    it(`builds ${data.id} with the ${builder} builder`, () => {
      const modelEl = document.createElement("div");
      const deckEl = document.createElement("div");
      const place = buildPlace(data, builder, modelEl, deckEl);
      expect(place.index).toBeTruthy();
      expect(place.model).toBeTruthy();
      expect(place.deck).toBeTruthy();
      expect(typeof place.locate).toBe("function");
      const roomId = [...place.index.byId.keys()].sort()[0];
      const where = place.locate(place.index, { roomId, district: place.index.byId.get(roomId).district }, null);
      expect(where.kind).not.toBe("off");
      expect(modelEl.querySelector("svg")).toBeTruthy();
      expect(deckEl.querySelector("svg")).toBeTruthy();
    });
  }

  it("gives only a town its info line", () => {
    const make = (b, d) => buildPlace(d, b, document.createElement("div"), document.createElement("div"));
    expect(typeof make("town", zennor).info).toBe("function");
    expect(make("decks", orrin).info).toBeUndefined();
  });

  it("throws on an unknown builder", () => {
    expect(() => buildPlace(orrin, "nope", document.createElement("div"), document.createElement("div"))).toThrow();
  });
});

describe("buildShip", () => {
  for (const plan of Object.values(plans)) {
    it(`builds ${plan.id}'s plan and finds her rooms by their runtime ids`, () => {
      const deckEl = document.createElement("div");
      const ship = buildShip(plan, document.createElement("div"), deckEl, { name: "Mallard" });
      expect(ship.deck).toBeTruthy();
      expect(deckEl.querySelector("svg")).toBeTruthy();
      for (const id of ship.index.byId.keys()) {
        const key = id.slice(plan.id.length + 1);
        expect(ship.locate(ship.index, { roomId: `ship.7.${key}` })).toMatchObject({ kind: "room", id });
      }
      expect(ship.locate(ship.index, { roomId: `${plan.id}.cockpit` }).kind).toBe("off");
    });
  }
});
