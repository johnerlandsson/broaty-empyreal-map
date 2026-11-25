// @vitest-environment happy-dom
// Logging in while standing in a site's room (main.js): the location comes before the saved map, so
// the site's front isn't walked yet and the land can't show; once the map loads, it must.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
  document.body.innerHTML = '<main class="station"><div id="model" class="band"></div><div class="separator"></div><div id="deck" class="band"></div><div id="info"></div></main>';
  handlers = {};
  window.panel = { on: (name, fn) => (handlers[name] = handlers[name] ?? []).push(fn), post: () => {}, tooltip: { show() {}, hide() {} } };
  vi.resetModules();
  await import("./main.js");
});
afterEach(() => {
  delete window.panel;
  vi.useRealTimers();
});

const FRONT = "surface.lanyon.site.lark";
const HULL = "site.lark.hull";
const record = {
  v: 1,
  places: [{ id: FRONT, name: "The Lark", x: 351.1, y: 3095.3, z: 0, exits: { n: { to: HULL, area: "site.lark" } } }],
  rooms: [{ id: HULL, name: "Inside the Hull", site: "lark", front: FRONT, exits: { s: { to: FRONT } } }],
};
const shownLand = () => [...document.querySelectorAll(".deck.land")].filter((d) => d.style.display !== "none");

describe("a site's room on login", () => {
  it("shows its land once the saved map, with its front, has loaded", () => {
    emit("location", { area: "site.lark", areaName: "The Lark", name: "Inside the Hull" });
    expect(shownLand()).toHaveLength(0); // no front walked yet
    emit("land-load", { who: "ada", record });
    expect(shownLand()).toHaveLength(1);
    emit("land-room", { id: HULL, name: "Inside the Hull", area: "site.lark", site: "lark", exits: { S: { id: FRONT, area: "surface.lanyon" } } });
    expect(document.querySelector(`[data-here="${HULL}"]`)).toBeTruthy();
  });
});
