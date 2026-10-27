// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachPanZoom, el, pulse, pulseAt, rng, stars } from "./svg.js";

// A stand-in for the band's div: records listeners and style, 100×100 px at the origin.
function fakeDiv() {
  const on = {};
  return {
    on,
    style: {},
    addEventListener: (type, fn) => (on[type] ??= []).push(fn),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    setPointerCapture() {},
    fire(type, e = {}) {
      const ev = { target: { closest: () => null }, preventDefault() { ev.prevented = true; }, ...e };
      for (const fn of on[type] ?? []) fn(ev);
      return ev;
    },
  };
}

function panned() {
  const div = fakeDiv();
  let vb = [0, 0, 100, 100];
  attachPanZoom(div, () => vb, (v) => (vb = v), { minW: 10, maxW: 1000 });
  return { div, vb: () => vb };
}

describe("attachPanZoom", () => {
  it("pans while the primary button is held, and stops on release", () => {
    const { div, vb } = panned();
    div.fire("pointerdown", { button: 0, buttons: 1, clientX: 50, clientY: 50, pointerId: 1 });
    div.fire("pointermove", { buttons: 1, clientX: 40, clientY: 50 });
    expect(vb()).toEqual([10, 0, 100, 100]);
    div.fire("pointerup", { button: 0, buttons: 0, clientX: 40, clientY: 50 });
    div.fire("pointermove", { buttons: 0, clientX: 0, clientY: 50 });
    expect(vb()).toEqual([10, 0, 100, 100]);
  });

  it("stops the native drag and selection a press would start (WebKit's image drag)", () => {
    const { div } = panned();
    expect(div.fire("pointerdown", { button: 0, buttons: 1, clientX: 5, clientY: 5 }).prevented).toBe(true);
    expect(div.fire("dragstart").prevented).toBe(true);
    expect(div.fire("selectstart").prevented).toBe(true);
    expect(div.style.userSelect).toBe("none");
    expect(div.style.webkitUserDrag).toBe("none");
  });

  it("lets go once the button is up, even if the release never reached it", () => {
    const { div, vb } = panned();
    div.fire("pointerdown", { button: 0, buttons: 1, clientX: 50, clientY: 50 });
    div.fire("pointermove", { buttons: 0, clientX: 20, clientY: 50 }); // the pointerup went elsewhere
    expect(vb()).toEqual([0, 0, 100, 100]);
  });

  it("lets go when it loses the pointer or a native drag takes over", () => {
    for (const lost of ["lostpointercapture", "dragstart", "pointercancel"]) {
      const { div, vb } = panned();
      div.fire("pointerdown", { button: 0, buttons: 1, clientX: 50, clientY: 50 });
      div.fire(lost);
      div.fire("pointermove", { buttons: 1, clientX: 20, clientY: 50 });
      expect(vb(), lost).toEqual([0, 0, 100, 100]);
    }
  });

  it("doesn't pan on a right-click (its release goes to the context menu)", () => {
    const { div, vb } = panned();
    const down = div.fire("pointerdown", { button: 2, buttons: 2, clientX: 50, clientY: 50 });
    expect(down.prevented).toBeUndefined();
    div.fire("pointermove", { buttons: 2, clientX: 20, clientY: 50 });
    expect(vb()).toEqual([0, 0, 100, 100]);
  });
});

describe("stars", () => {
  const field = (n, seed) => {
    const g = el("g");
    stars(g, 0, 0, 2400, 1400, n, seed);
    return [...g.children].map((p) => [p.tagName, p.getAttribute("d"), +p.getAttribute("opacity")]);
  };

  it("draws the same stars for the same seed, and others for another", () => {
    expect(field(2000, 31)).toEqual(field(2000, 31));
    expect(field(2000, 37)).not.toEqual(field(2000, 31));
  });

  it("draws a field in a path a shade, every star in one of them", () => {
    const paths = field(2000, 31);
    expect(paths.length).toBeLessThanOrEqual(16);
    expect(paths.every(([tag]) => tag === "path")).toBe(true);
    expect(paths.reduce((n, [, d]) => n + d.split("M").length - 1, 0)).toBe(2000);
    expect(paths.every(([, , o]) => o > 0.12 && o < 0.72)).toBe(true);
    expect(field(3, 11).length).toBeLessThanOrEqual(3); // no empty paths
  });

  it("keeps each star where the seed put it, as circles had it", () => {
    const r = rng(31);
    const [cx, cy, rad] = [r() * 2400, r() * 1400, r() * 1.3 + 0.3];
    const o = r() * 0.6 + 0.12;
    const [, d, opacity] = field(2000, 31).find(([, d]) => d.startsWith(`M${+(cx - +rad.toFixed(2)).toFixed(2)} ${+cy.toFixed(2)}a${+rad.toFixed(2)} `));
    expect(d).toBeTruthy();
    expect(Math.abs(opacity - o)).toBeLessThanOrEqual(0.6 / 32 + 1e-9);
  });
});

describe("pulse", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] }));
  afterEach(() => {
    document.body.replaceChildren();
    vi.advanceTimersByTime(100); // the nodes are off the page: the timer lets them go and stops
    vi.useRealTimers();
  });
  const lit = () => el("g", {}, el("svg", {}, document.body));
  const opacity = (node) => Number(node.getAttribute("opacity"));

  it("breathes 1 -> .55 -> 1 over 1.8 s, in straight lines", () => {
    expect(pulseAt(0)).toBe(1);
    expect(pulseAt(450)).toBe(0.775);
    expect(pulseAt(900)).toBe(0.55);
    expect(pulseAt(1350)).toBe(0.775);
    expect(pulseAt(1800)).toBe(1);
    expect(pulseAt(2700)).toBe(0.55);
  });

  it("starts from full and is set 15 times a second, not every frame", () => {
    const g = pulse(lit());
    expect(opacity(g)).toBe(1);
    const set = vi.spyOn(g, "setAttribute");
    vi.advanceTimersByTime(900);
    expect(set).toHaveBeenCalledTimes(13); // 15 a second over 0.9 s
    expect(opacity(g)).toBeCloseTo(0.55, 1);
    vi.advanceTimersByTime(900);
    expect(opacity(g)).toBeGreaterThan(0.95);
  });

  it("pulses again from full when asked, and never otherwise", () => {
    const g = pulse(lit());
    vi.advanceTimersByTime(800);
    expect(opacity(g)).toBeLessThan(0.65);
    pulse(g); // a new place lit
    expect(opacity(g)).toBe(1);
    vi.advanceTimersByTime(200);
    expect(opacity(g)).toBeCloseTo(pulseAt(200), 1);
  });

  it("leaves a node in a hidden view alone, and one off the page goes", () => {
    const hidden = pulse(lit());
    hidden.getClientRects = () => []; // display: none above it: no boxes
    const gone = pulse(lit());
    vi.advanceTimersByTime(600);
    expect(opacity(hidden)).toBe(1);
    expect(opacity(gone)).toBeLessThan(0.8);
    gone.remove();
    const set = vi.spyOn(gone, "setAttribute");
    vi.advanceTimersByTime(600);
    expect(set).not.toHaveBeenCalled();
  });

  it("waits for a node built before its view is on the page", () => {
    const g = pulse(el("g", {}, el("svg", {})));
    vi.advanceTimersByTime(300);
    expect(opacity(g)).toBe(1);
    document.body.appendChild(g.parentNode);
    vi.advanceTimersByTime(300);
    expect(opacity(g)).toBeLessThan(1);
  });
});
