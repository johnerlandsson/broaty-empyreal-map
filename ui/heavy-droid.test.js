// @vitest-environment happy-dom
// Where a heavy droid can't pass (reference/heavy-droid-options.png, option C): a ship's airlock
// hatch on her port wall, a freighter's long, the rest short; a ladderway's hatch glyph between two
// jambs with its own tooltip; and a tooltip row that says whether it fits, never a width.

import { beforeEach, describe, expect, it } from "vitest";
import courier from "./data/plans/hull-courier.js";
import freighter from "./data/plans/freighter.js";
import skiff from "./data/plans/hull-skiff.js";
import tug from "./data/plans/tug.js";
import orrin from "../tests/fixtures/generated/orrin.js";
import tiss from "./data/tiss.js";
import { heavyFits, heavyRow } from "./lib/heavy.js";
import { buildPlace, buildShip } from "./place-views.js";

const div = () => document.createElement("div");
const ship = (data) => buildShip(data, div(), div(), { name: "Mule" }).deck.plans[0];
const hatch = (plan) => plan.g.querySelector("[data-airlock]");
const lap = (g, sel) => [...g.querySelectorAll(`g[transform="translate(0 0)"] ${sel}`)];

let shown;
beforeEach(() => {
  shown = [];
  window.panel = { tooltip: { show: (_, tip) => shown.push(tip), hide() {} } };
});
const tipOver = (node) => {
  node.dispatchEvent(new Event("mouseenter"));
  return shown.at(-1);
};

describe("heavyFits", () => {
  it("reads the frame's width: exactly as wide fits", () => {
    expect(heavyFits(110)).toBe(true);
    expect(heavyFits(109)).toBe(false);
  });

  it("words a row without a figure", () => {
    expect(heavyRow("its hatch", 70)).toEqual({ label: "Heavy droid", value: "too wide for its hatch" });
    expect(heavyRow("her airlock", 130)).toEqual({ label: "Heavy droid", value: "fits her airlock" });
  });
});

describe("a ship's airlock", () => {
  const length = (plan) => +hatch(plan).getAttribute("height");

  it("is long on a freighter and short on a skiff, a courier and a tug", () => {
    expect(length(ship(freighter))).toBeGreaterThan(length(ship(skiff)));
    expect(length(ship(courier))).toBe(length(ship(skiff)));
    expect(length(ship(tug))).toBe(length(ship(skiff)));
  });

  it("sits on her port wall, port of the room, with one hatch to a ship", () => {
    for (const data of [freighter, skiff, courier, tug]) {
      const plan = ship(data);
      expect(plan.g.querySelectorAll("[data-airlock]")).toHaveLength(1);
      const room = plan.layout.cells.find((c) => c.room.clear);
      expect(+hatch(plan).getAttribute("x")).toBeLessThan(room.cx - room.w / 2);
    }
  });

  it("says so in her airlock room's tooltip, and only there", () => {
    const tip = (data, name) => {
      const plan = ship(data);
      const box = [...plan.g.querySelectorAll("g")].find((g) => g.textContent.includes(name) && g.children.length <= 4);
      return tipOver(box);
    };
    expect(tip(freighter, "Airlock").rows).toEqual([{ label: "Heavy droid", value: "fits her airlock" }]);
    expect(tip(freighter, "Passage").rows).toEqual([]);
    expect(tip(tug, "Towing Collar").rows).toEqual([]);
  });
});

describe("T.I.S.S.'s ladderways", () => {
  const [rim, mid, inner, docks] = buildPlace(tiss, "wheel", div(), div()).deck.plans;

  it("puts the jambs on each of the twelve hatches once a lap, and none on the docks", () => {
    for (const plan of [rim, mid, inner]) expect(lap(plan.g, "[data-jambs]")).toHaveLength(4);
    expect(docks.g.querySelectorAll("[data-jambs]")).toHaveLength(0);
  });

  it("gives a hatch its own tooltip, over the stop's", () => {
    const stop = rim.layout.stops.find((s) => s.hour === 0);
    const area = lap(rim.g, "rect").find((r) => r.getAttribute("x") === String(stop.cx + 20) && r.getAttribute("fill") === "transparent");
    expect(tipOver(area)).toMatchObject({
      title: "Ladderway 12, Rim",
      rows: [{ label: "Heavy droid", value: "too wide for its hatch" }],
    });
  });
});

describe("what has no clearance", () => {
  it("leaves a station on decks alone", () => {
    const { deck } = buildPlace(orrin, "decks", div(), div());
    for (const plan of deck.plans) expect(plan.g.querySelectorAll("[data-airlock], [data-jambs]")).toHaveLength(0);
  });
});

describe("no spoilers", () => {
  it("draws no width on any plan", () => {
    const markup = [freighter, skiff, courier, tug].map((d) => ship(d).g.outerHTML).join("");
    expect(markup).not.toMatch(/\b(70|110|130) ?cm\b/);
  });
});
