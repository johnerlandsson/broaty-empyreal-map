// @vitest-environment happy-dom
// The plan's legend (reference/plan-legend-options.png, option B): the ? opens a sheet naming what
// the plan on show draws; any click, Escape or a change of level closes it.

import { afterEach, describe, expect, it } from "vitest";
import freighter from "./data/plans/freighter.js";
import { data } from "./data/places.js";
import tiss from "./data/tiss.js";
import zennor from "./data/zennor.js";
import orrin from "../tests/fixtures/generated/orrin.js";
import { legendOf } from "./legend.js";
import { buildPlace, buildShip } from "./place-views.js";

const div = () => document.createElement("div");
const names = (plan) => legendOf(plan).map(([name]) => name);
const wheel = (opts) => buildPlace(tiss, "wheel", div(), div(), opts).deck;
const button = (deck) => deck.div.querySelector('button[title="What the symbols mean"]');
const sheet = (deck) => deck.div.querySelector(".plan-legend");

describe("what the legend names", () => {
  const [rim, mid, inner, docks] = wheel().plans;

  it("names only what each of T.I.S.S.'s plans draws", () => {
    expect(names(rim)).toEqual(expect.arrayContaining(["Lift", "Ladderway hatch", "Corridor stop", "Refuse bin", "Drop point", "You are here"]));
    expect(names(rim)).not.toContain("Jobs window");
    expect(names(mid)).toContain("Jobs window");
    expect(names(mid)).not.toContain("Drop point");
    expect(names(inner)).toContain("Drop point");
    expect(names(docks)).toEqual(["Lift", "Corridor stop", "You are here"]);
  });

  it("names a closed room only where there is one", () => {
    const closed = tiss.rooms.find((r) => r.closed && r.at?.z === 0);
    expect(closed).toBeDefined();
    expect(names(rim)).toContain("Closed room");
    expect(names(docks)).not.toContain("Closed room");
  });

  it("names a hatch's jambs where one is too narrow", () => {
    expect(names(rim)).toContain("Too narrow for a heavy droid");
  });

  it("names a decks station's hatches and airlocks, and none of the rings' fixtures", () => {
    const all = buildPlace(orrin, "decks", div(), div()).deck.plans.flatMap(names);
    expect(all).toEqual(expect.arrayContaining(["Hatch up or down", "Airlock"]));
    expect(all).not.toContain("Lift");
  });

  it("names a ship's airlock", () => {
    expect(names(buildShip(freighter, div(), div(), { name: "Mule" }).deck.plans[0])).toContain("Airlock");
  });

  it("names a drum's way up as it's built", () => {
    const wenna = names(buildPlace(data.wenna, "drum", div(), div()).deck.plans[0]);
    expect(wenna).toEqual(expect.arrayContaining(["Ramp up", "Airlock"]));
    expect(wenna).not.toContain("Stairs up");
  });

  it("names a town's tram and wells, and its bins", () => {
    expect(names(buildPlace(zennor, "town", div(), div()).deck.plans[0])).toEqual(expect.arrayContaining(["Tram line", "Wellhead", "Refuse bin"]));
  });
});

describe("the sheet", () => {
  let deck;
  afterEach(() => deck?.legend?.close());

  it("opens on the ?, over the plan, with a row a symbol", () => {
    deck = wheel();
    deck.show(1);
    button(deck).click();
    const rows = [...sheet(deck).children];
    expect(rows.map((r) => r.querySelector("span").textContent)).toEqual(names(deck.plans[1]));
    expect(rows.every((r) => r.querySelector("svg"))).toBe(true);
    expect(deck.svg.contains(sheet(deck))).toBe(false);
  });

  it("closes on a click on it, on the ? again, on Escape, and on a new level", () => {
    deck = wheel();
    for (const close of [() => sheet(deck).click(), () => button(deck).click(), () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })), () => deck.show(2)]) {
      button(deck).click();
      expect(sheet(deck)).not.toBeNull();
      close();
      expect(sheet(deck)).toBeNull();
    }
  });

  it("leaves the plan's view alone while the wheel turns over it", () => {
    deck = wheel();
    const view = deck.svg.getAttribute("viewBox");
    button(deck).click();
    sheet(deck).dispatchEvent(new WheelEvent("wheel", { deltaY: 200, bubbles: true }));
    expect(deck.svg.getAttribute("viewBox")).toBe(view);
  });

  it("isn't in the tweak editor", () => {
    expect(button(wheel({ pick: true }))).toBeNull();
  });
});
