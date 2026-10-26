// @vitest-environment happy-dom
// The bottom band aboard a ship: her generated plan (buildShip, the decks builder), the room you're
// in lit, her name in "Cockpit of the {name}", and the caption and your note under the hull.

import { describe, expect, it } from "vitest";
import { planFor } from "./lib/ships.js";
import { buildShip } from "./place-views.js";

const aboard = (msg) => {
  const deckEl = document.createElement("div");
  const ship = buildShip(planFor(msg.hull), document.createElement("div"), deckEl, { name: msg.areaName });
  const where = ship.update(msg);
  return { ship, where, deckEl };
};
const lit = (deck) => deck.plans.some((p) => p.hl.childNodes.length > 0);
const texts = (deckEl) => [...deckEl.querySelectorAll("text")].map((t) => t.textContent);
const shown = (deck) => deck.plans.filter((p) => p.g.getAttribute("display") !== "none").length;

const FREIGHTER = {
  roomId: "ship.42.hold",
  name: "Cargo Hold",
  area: "ship.42",
  areaName: "Full Measure",
  hull: "freighter",
  hullName: "medium freighter",
  shipRoom: "hold",
  note: "ore for Orrin, fuel cells back",
};

describe("buildShip", () => {
  it("lights the freighter's hold, with her caption and your note under the hull", () => {
    const { ship, where, deckEl } = aboard(FREIGHTER);
    expect(where).toMatchObject({ kind: "room", id: "freighter.hold" });
    expect(lit(ship.deck)).toBe(true);
    const t = texts(deckEl);
    expect(t).toContain("Full Measure · medium freighter");
    expect(t).toContain("ore for Orrin, fuel cells back");
  });

  it("fills her name into the cockpit's, on the plan and its hover", () => {
    const { ship, deckEl } = aboard({ ...FREIGHTER, roomId: "ship.42.cockpit", shipRoom: "cockpit" });
    expect(ship.index.byId.get("freighter.cockpit").name).toBe("Cockpit of the Full Measure");
    expect(texts(deckEl).join(" ")).not.toContain("{name}");
  });

  it("leaves the note off a ship that isn't yours, and clears it when it goes", () => {
    const { ship, deckEl } = aboard({ ...FREIGHTER, note: undefined });
    expect(texts(deckEl)).not.toContain("ore for Orrin, fuel cells back");
    ship.update(FREIGHTER);
    expect(texts(deckEl)).toContain("ore for Orrin, fuel cells back");
    ship.update({ ...FREIGHTER, note: undefined });
    expect(texts(deckEl)).not.toContain("ore for Orrin, fuel cells back");
  });

  it("lights the skiff's one cell, her cockpit", () => {
    const { ship, where, deckEl } = aboard({ roomId: "ship.12.cockpit", areaName: "Mule", hull: "skiff", hullName: "prospecting skiff", shipRoom: "cockpit", note: "hauls ore to Orrin" });
    expect(where).toMatchObject({ kind: "room", id: "hull-skiff.cockpit" });
    expect(lit(ship.deck)).toBe(true);
    expect(texts(deckEl)).toContain("Mule · prospecting skiff");
    expect(texts(deckEl)).toContain("hauls ore to Orrin");
  });

  it("draws the plain tug (no tweaks) and lights her collar", () => {
    const { ship, where } = aboard({ roomId: "ship.5.collar", areaName: "Brock", hull: "tug", hullName: "tug", shipRoom: "collar" });
    expect(where).toMatchObject({ kind: "room", id: "tug.collar" });
    expect(lit(ship.deck)).toBe(true);
  });

  it("draws an unknown hull's plan, the generic one, with nothing lit if the room isn't in it", () => {
    let r;
    expect(() => (r = aboard({ roomId: "ship.9.galley", areaName: "Odd Duck", hull: "frigate", hullName: "frigate", shipRoom: "galley" }))).not.toThrow();
    expect(r.where.kind).toBe("off");
    expect(lit(r.ship.deck)).toBe(false);
    expect(shown(r.ship.deck)).toBe(1);
    expect(r.deckEl.querySelectorAll("path, rect").length).toBeGreaterThan(5);
    expect(texts(r.deckEl)).toContain("Odd Duck · frigate");
  });

  it("draws the plan with nothing lit for a key missing from it, or a room with no key", () => {
    for (const roomId of ["ship.42.bridge", "ship.42", undefined]) {
      let r;
      expect(() => (r = aboard({ ...FREIGHTER, roomId }))).not.toThrow();
      expect(r.where.kind).toBe("off");
      expect(lit(r.ship.deck)).toBe(false);
      expect(shown(r.ship.deck)).toBe(1);
    }
  });

  it("lights again after an unlit room", () => {
    const { ship } = aboard({ ...FREIGHTER, roomId: "ship.42.bridge" });
    expect(ship.update(FREIGHTER)).toMatchObject({ kind: "room", id: "freighter.hold" });
    expect(lit(ship.deck)).toBe(true);
  });

  it("never throws on no message at all", () => {
    const ship = buildShip(planFor(undefined), document.createElement("div"), document.createElement("div"));
    expect(() => ship.update(null)).not.toThrow();
    expect(ship.index.byId.get("hull-skiff.cockpit").name).not.toContain("{name}");
  });
});
