// @vitest-environment happy-dom
// A port's sky in the top band, for any port (main.js): the charts reach each station's band that
// has a sky, and the sky is kept up out of doors wherever you are, Zennor's Square or the Pit;
// and from orbit the space scene draws a port as its hull says, Dolcoath's `pit` as the Pit and
// Zennor's `port` as the town it was.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pitCharts } from "../dev/charts-fixture.js";

const noop = new Proxy(function () {}, {
  get: (_, k) => (k === "width" ? 0 : noop),
  apply: () => noop,
  set: () => true,
});

let handlers;
async function mount() {
  document.body.innerHTML = '<main class="station"><div id="model" class="band"></div><div class="separator"></div><div id="deck" class="band"></div><div id="info"></div></main>';
  handlers = {};
  window.panel = { on: (name, fn) => (handlers[name] = handlers[name] ?? []).push(fn), post: () => {}, tooltip: { show() {}, hide() {} } };
  vi.resetModules();
  await import("./main.js");
}
const emit = (name, msg) => (handlers[name] ?? []).forEach((fn) => fn(msg));
/** The sky's svg of a port, by its own clip's id, and whether its dome is drawn (only with a sky). */
const skyOf = (port) => document.getElementById(`sky-clip-${port}`)?.closest("svg") ?? null;
const domed = (port) => !!skyOf(port)?.querySelector('[data-tip="sky"]');

beforeEach(async () => {
  HTMLCanvasElement.prototype.getContext = () => noop;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  await mount();
});
afterEach(() => {
  delete window.panel;
  vi.useRealTimers();
});

describe("a port's sky", () => {
  it("draws the sky over the Pit out of doors, with charts that came before the city was built", () => {
    emit("charts", pitCharts(Date.now()));
    emit("location", { roomId: "dolcoath.field", name: "The Pit", district: "pit", gravity: 1.5 });
    expect(domed("dolcoath")).toBe(true);
  });

  it("keeps it up each second, and drops it going in", () => {
    vi.useFakeTimers();
    emit("location", { roomId: "dolcoath.pithead", name: "The Pithead", district: "pit", gravity: 1.5 });
    expect(domed("dolcoath")).toBe(false); // no charts yet: the rim alone
    emit("charts", pitCharts(Date.now()));
    expect(domed("dolcoath")).toBe(true);
    const svg = skyOf("dolcoath");
    const before = svg.querySelector('[data-tip="sky"]');
    vi.advanceTimersByTime(1100);
    expect(svg.querySelector('[data-tip="sky"]')).not.toBe(before); // redrawn
    emit("location", { roomId: "dolcoath.lamp-room", name: "Lamp Room", district: "pit", gravity: 1.5 });
    expect(domed("dolcoath")).toBe(false);
  });

  it("still draws Zennor's", () => {
    emit("charts", pitCharts(Date.now()));
    emit("location", { roomId: "zennor.square", name: "The Square", district: "market-quarter", gravity: 0.8 });
    expect(domed("zennor")).toBe(true);
  });
});

describe("a port from orbit", () => {
  const ground = async (port) => {
    const { SpaceView } = await import("./space-view.js");
    const v = new SpaceView(document.getElementById("model"), { hulls: { dolcoath: "pit", zennor: "port" } });
    Object.assign(v, { w: 600, h: 300, ground: 1, lit: 1 });
    v.set("port", port);
    const drawn = [];
    v.drawPit = () => drawn.push("pit");
    v.drawTown = () => drawn.push("town");
    v.drawGround();
    return drawn;
  };

  it("draws Dolcoath as its pit, Zennor and a port of no known hull as a town", async () => {
    expect(await ground("dolcoath")).toEqual(["pit"]);
    expect(await ground("zennor")).toEqual(["town"]);
    expect(await ground("elsewhere")).toEqual(["town"]);
  });
});
