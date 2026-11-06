// @vitest-environment happy-dom
// Dolcoath's plans (reference/dolcoath-levels-options.png, pick B): one a level, switching as you
// change level; the ways off each drawn beside their rooms, with where they go on hover; the
// level you're on in words in the top band; and the cage's own drawing while you ride it.

import { describe, expect, it } from "vitest";
import dolcoath from "../tests/fixtures/generated/dolcoath.js";
import { carPlans, updateCar } from "./car-deck.js";
import { DeckView } from "./deck-view.js";
import { legendOf } from "./legend.js";
import { stopNames } from "./lib/cars.js";
import { buildPlace } from "./place-views.js";

const div = () => document.createElement("div");
const place = () => buildPlace(dolcoath, "levels", div(), div());
const names = (plan) => legendOf(plan).map(([name]) => name);
const at = (p, roomId) => {
  const where = p.locate(p.index, { roomId: `dolcoath.${roomId}` });
  p.model.set(where);
  p.deck.set(where);
  return where;
};

describe("Dolcoath's plans", () => {
  it("has a plan a level, top down, each titled by N ▲ with its level", () => {
    const { deck } = place();
    expect(deck.plans).toHaveLength(8);
    const titles = deck.plans.map((p) => p.g.querySelector("tspan[dx]")?.textContent);
    expect(titles).toEqual(["THE PIT", "TWENTY FATHOM · 20 FM", "FORTY FATHOM · 40 FM", "THE TOWN · 80 FM", "THE SMELTS · 120 FM", "THE WORKINGS · 160 FM", "PUMP GALLERY", "THE BOTTOM OF THE WINZE · 200 FM"]);
  });

  it("switches level as you change level, and frames the new one", () => {
    const p = place();
    at(p, "bal-cross");
    expect(p.deck.level).toBe(3);
    const town = p.deck.svg.getAttribute("viewBox");
    at(p, "smelters-road");
    expect(p.deck.level).toBe(4);
    expect(p.deck.svg.getAttribute("viewBox")).not.toBe(town);
    expect(p.deck.plans[4].hl.children.length).toBeGreaterThan(0);
    expect(p.deck.plans[3].hl.children.length).toBe(0);
  });

  it("draws the cage's shaft and the man engine on every station's level, and each level's other ways", () => {
    const { deck } = place();
    const kinds = deck.plans.map((p) => [...p.g.querySelectorAll("[data-way]")].map((g) => g.getAttribute("data-way")).sort());
    expect(kinds).toEqual([
      ["cage", "man-engine"],
      ["cage", "man-engine", "stair"],
      ["cage", "man-engine", "stair"],
      ["cage", "man-engine", "stair"],
      ["cage", "man-engine"],
      ["cage", "man-engine", "plain", "plain"],
      ["plain"],
      ["plain"],
    ]);
    // the Town's words: the cage's stations above and below, the man engine's seconds, the stair's name
    const words = [...deck.plans[3].g.querySelectorAll("[data-way] text")].map((t) => t.textContent);
    expect(words).toEqual(expect.arrayContaining(["▲ 40 FM", "▼ 120 FM", "▲ 16 s", "▼ 12 s", "▲ the Great Stair"]));
  });

  it("says where a way goes and its seconds on hover", () => {
    const { deck } = place();
    const shown = [];
    window.panel = { tooltip: { show: (_, tip) => shown.push(tip), hide() {} } };
    const hit = deck.plans[3].g.querySelector('[data-way="man-engine"] rect[fill="transparent"]');
    hit.dispatchEvent(new Event("mouseenter"));
    expect(shown.at(-1)).toMatchObject({ title: "The man engine", rows: [{ label: "Up", value: "Forty Fathom, about 16 s" }, { label: "Down", value: "the Smelts, about 12 s" }] });
    delete window.panel;
  });

  it("names the ways off a level in its legend, and the bins it draws", () => {
    const { deck } = place();
    expect(names(deck.plans[3])).toEqual(expect.arrayContaining(["Cage shaft", "Man engine", "The Great Stair", "Refuse bin", "You are here"]));
    expect(names(deck.plans[3])).not.toContain("A way up or down");
    expect(names(deck.plans[5])).toContain("A way up or down");
    expect(names(deck.plans[0])).not.toContain("The Great Stair");
  });

  it("tints the Exchange as a market and the Old Levels' other halls by their district", () => {
    const { deck } = place();
    const fillOf = (name) => [...deck.plans[1].g.querySelectorAll("text")].find((t) => t.textContent === name).parentNode.querySelector("rect").getAttribute("fill");
    expect(fillOf("The Exchange")).toBe(dolcoath.look.palette.concourse);
    expect(fillOf("Count House")).toBe(dolcoath.look.palette.commons);
  });

  it("names the level you're on over the plan, in words, and keeps it off the plan", () => {
    const p = place();
    const text = () => [...p.model.svg.querySelectorAll("text")].map((t) => t.textContent);
    expect(text()).toEqual(["DOLCOATH · 1.5 g", "THE PIT", "at the surface"]);
    at(p, "bal-cross");
    expect(text()).toEqual(["DOLCOATH · 1.5 g", "THE TOWN", "80 fathoms down"]);
    at(p, "cage");
    expect(text()[1]).toBe("THE TOWN");
    at(p, "pump-gallery");
    expect(text().slice(1)).toEqual(["PUMP GALLERY", ""]);
  });
});

describe("the cage", () => {
  it("draws its stations upright beside it, the cage on its way down, its gates shut", () => {
    const p = place();
    const view = new DeckView(div(), null, carPlans("cage"));
    const floors = p.index.cars[0].stops.map((id) => ({ id }));
    updateCar(view, { kind: "cage", floors, between: ["dolcoath.town-station", "dolcoath.smelts-station"], heading: "down", doors: "closed" }, stopNames(p.index));
    const plan = view.plans[0];
    expect(plan.caption.textContent).toBe("down, the Town → the Smelts");
    const labels = [...plan.line.querySelectorAll("text")];
    expect(labels.map((t) => t.textContent)).toEqual(["the Workings", "the Smelts", "the Town", "Forty Fathom", "Twenty Fathom", "the Pithead"]);
    // upright: one x, the Pithead at the top
    expect(new Set(labels.map((t) => t.getAttribute("x"))).size).toBe(1);
    expect(Number(labels[5].getAttribute("y"))).toBeLessThan(Number(labels[0].getAttribute("y")));
    expect(plan.doors.every((d) => d.getAttribute("display") !== "none")).toBe(true);
    updateCar(view, { kind: "cage", floors, at: "dolcoath.town-station", doors: "open" }, stopNames(p.index));
    expect(plan.caption.textContent).toBe("at the Town, gates open");
    expect(plan.doors.every((d) => d.getAttribute("display") === "none")).toBe(true);
  });
});
