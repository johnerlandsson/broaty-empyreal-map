import { describe, expect, it } from "vitest";
import tissData from "../data/tiss.js";
import generated from "../data/zennor.js";
import { CARS, carDoing, carInfo, carKind, carName, stopLine, stopNames } from "./cars.js";
import { indexStation } from "./locate.js";
import { tissRooms, townData, townSpec } from "./look.js";
import { indexTown } from "./town.js";

const tiss = indexStation(tissRooms(tissData));
const zennor = townData(generated);
const city = indexTown(zennor, townSpec(generated));
const tram = (lift) => ({ gravity: 1, lift: { id: "zennor.tram", kind: "tram", floors: zennor.cars[0].stops.map((id) => ({ id })), ...lift } });
const LIFT_FLOORS = ["tiss.rim-0300", "tiss.mid-0300", "tiss.inner-0300", "tiss.hub"].map((id) => ({ id }));
const lift = (l) => ({ name: "Lift 3", gravity: 0.9, lift: { id: "tiss.lift-3", kind: "lift", floors: LIFT_FLOORS, ...l } });

describe("cars", () => {
  it("takes a car without a kind for a lift, as before the tram", () => {
    expect(carKind({ id: "tiss.lift-3" })).toBe("lift");
    expect(carKind({ kind: "tram" })).toBe("tram");
    expect(carKind({ kind: "balloon" })).toBe("lift");
    expect(carKind(null)).toBe("lift");
    expect(Object.keys(CARS)).toEqual(["lift", "tram"]);
  });

  it("names the car: the game's name, else the plan's, else its kind's", () => {
    expect(carName(lift({}), tiss)).toBe("Lift 3");
    expect(carName(tram({}), city)).toBe("The Tram");
    expect(carName({ lift: { id: "x.tram", kind: "tram" } }, null)).toBe("The Tram");
  });

  it("calls a stop by its ring on T.I.S.S., a tram stop without ' Station', and in full on the info line", () => {
    const t = stopNames(tiss);
    expect(LIFT_FLOORS.map(t.short)).toEqual(["Rim", "Mid", "Inner", "Hub"]);
    expect(t.full({ id: "tiss.hub" })).toBe("The Hub");
    const z = stopNames(city);
    expect(zennor.cars[0].stops.map((id) => z.short({ id }))).toEqual(["Riverside", "Market", "Uptown", "Downs"]);
    expect(z.full({ id: "zennor.tram-market" })).toBe("Market Station");
    // a stop the plan doesn't have: the game's name, else its id
    expect(z.short({ id: "zennor.elsewhere", name: "Quay Station" })).toBe("Quay");
    expect(stopNames(null).short({ id: "q" })).toBe("q");
  });

  it("lays the stops out bottom to top, the car on its stop, or midway between two pointing its way", () => {
    const names = stopNames(city);
    const at = stopLine(tram({ at: "zennor.tram-market" }).lift, names, 300);
    expect(at.stops.map((s) => [s.name, s.x])).toEqual([["Riverside", -150], ["Market", -50], ["Uptown", 50], ["Downs", 150]]);
    expect(at.car).toEqual({ x: -50, dir: 0 });
    expect(stopLine(tram({ between: ["zennor.tram-market", "zennor.tram-uptown"] }).lift, names, 300).car).toEqual({ x: 0, dir: 1 });
    expect(stopLine(tram({ between: ["zennor.tram-downs", "zennor.tram-uptown"] }).lift, names, 300).car).toEqual({ x: 100, dir: -1 });
    // nowhere it knows: no car; no stops: nothing
    expect(stopLine(tram({ between: ["zennor.tram-market", "x"] }).lift, names, 300).car).toBe(null);
    expect(stopLine({ id: "tiss.lift-3" }, names, 300)).toEqual({ stops: [], car: null });
  });

  it("says what the car's doing in its own words", () => {
    const z = stopNames(city);
    expect(carDoing(tram({ at: "zennor.tram-riverside", doors: "open" }).lift, z)).toBe("at Riverside, doors open");
    expect(carDoing(tram({ at: "zennor.tram-riverside", doors: "closed" }).lift, z)).toBe("at Riverside");
    expect(carDoing(tram({ between: ["zennor.tram-market", "zennor.tram-uptown"], heading: "uphill" }).lift, z)).toBe("uphill, Market → Uptown");
    expect(carDoing(lift({ between: ["tiss.mid-0300", "tiss.rim-0300"], heading: "rimward" }).lift, stopNames(tiss))).toBe("descending rimward, Mid → Rim");
    expect(carDoing(lift({ heading: "hubward" }).lift, stopNames(tiss))).toBe("climbing hubward");
    expect(carDoing({}, z)).toBe("");
  });

  it("puts the car and what it's doing on the info line, a stop in full", () => {
    expect(carInfo(tram({ between: ["zennor.tram-market", "zennor.tram-uptown"], heading: "uphill" }), city)).toBe("THE TRAM · uphill, Market → Uptown");
    expect(carInfo(tram({ at: "zennor.tram-downs", doors: "open" }), city)).toBe("THE TRAM · at Downs Station");
    expect(carInfo(lift({ between: ["tiss.rim-0300", "tiss.mid-0300"], heading: "hubward" }), tiss)).toBe("LIFT 3 · climbing hubward, Rim → Mid");
    expect(carInfo(lift({ at: "tiss.hub" }), tiss)).toBe("LIFT 3 · at The Hub");
    expect(carInfo({ name: "Lift 9", lift: { id: "tiss.lift-9" } }, tiss)).toBe("LIFT 9");
    expect(carInfo(null, null)).toBe("LIFT");
  });
});
