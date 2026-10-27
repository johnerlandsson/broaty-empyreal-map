// @vitest-environment happy-dom
// The clearance card (main.js): while she waits on Control's answer to a dock or an undock, a card
// in the deck band's corner says so and where, under the cards for what you're doing and her move;
// it goes as the run starts, as she stops, or on a disconnect (each a clearance { verb: null }).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// happy-dom draws no canvas: a context whose every method does nothing (and returns one again)
const noop = new Proxy(function () {}, {
  get: (_, k) => (k === "width" ? 0 : noop),
  apply: () => noop,
  set: () => true,
});

let handlers;
const emit = (name, msg) => (handlers[name] ?? []).forEach((fn) => fn(msg));

beforeEach(async () => {
  HTMLCanvasElement.prototype.getContext = () => noop;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  document.body.innerHTML = '<main class="station"><div id="model" class="band"></div><div class="separator"></div><div id="deck" class="band"></div><div id="info"></div></main>';
  handlers = {};
  window.panel = { on: (name, fn) => (handlers[name] = handlers[name] ?? []).push(fn), post: () => {}, tooltip: { show() {}, hide() {} } };
  vi.resetModules();
  await import("./main.js");
});
afterEach(() => {
  delete window.panel;
});

const cards = () => [...document.querySelectorAll("#deck > .action-cards > .action-card")];
const shown = () => cards().filter((c) => !c.hidden);
const SKIFF = { roomId: "ship.42.cockpit", name: "Cockpit", area: "ship.42", areaName: "Mule", hull: "skiff", hullName: "prospecting skiff", shipRoom: "cockpit" };

describe("the clearance card", () => {
  it("is a third card in the deck band's corner, hidden till she waits", () => {
    expect(cards()).toHaveLength(3);
    expect(shown()).toHaveLength(0);
  });

  it("says she's awaiting clearance and where, with no seconds and no bar", () => {
    emit("scene", { scene: "station", station: "tiss" });
    emit("location", SKIFF);
    emit("clearance", { verb: "undock", at: "T.I.S.S." });
    const card = cards()[2];
    expect(shown()).toEqual([card]);
    expect(card.querySelector(".label").textContent).toBe("awaiting clearance · T.I.S.S.");
    expect(card.querySelector(".secs").textContent).toBe("");
    expect(card.querySelector(".detail").hidden).toBe(true);
    expect(card.querySelector(".bar").hidden).toBe(true);
    expect(card.getAttribute("aria-hidden")).toBe("true");
  });

  it("goes as the run starts, and the manoeuvre takes over", () => {
    emit("scene", { scene: "parked" });
    emit("location", SKIFF);
    emit("clearance", { verb: "dock", at: "Orrin Station" });
    expect(shown()).toHaveLength(1);
    emit("manoeuvre", { verb: "dock", left: 20, total: 20, at: "orrin_station" });
    emit("clearance", { verb: null });
    expect(shown()).toHaveLength(0);
  });

  it("stacks under what you're doing", () => {
    emit("action", { action: { verb: "repair", label: "repairing the laser", stage: 1, stages: 1, queued: 0 } });
    emit("clearance", { verb: "dock", at: "Zennor" });
    expect(shown().map((c) => c.querySelector(".label").textContent)).toEqual(["repairing the laser", "awaiting clearance · Zennor"]);
  });
});
