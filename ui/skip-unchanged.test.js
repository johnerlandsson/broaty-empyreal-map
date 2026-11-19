// @vitest-environment happy-dom
// A redraw that changes nothing on screen leaves the page alone (lib/same-draw.js). Parked, the chart,
// the lanes and belt maps and a port's sky are redrawn every second, but their marks drift by well under
// a pixel. Fresh nodes would make WebKit repaint the whole band, the starfield and the blurred lit
// layer with it, so the nodes from the last draw stay. Whatever draws came before, the page is always
// what a fresh draw would put there now, give or take half a px.

import { beforeEach, describe, expect, it } from "vitest";
import { chartCase } from "../dev/charts-cases.js";
import { senaraCharts } from "../dev/charts-fixture.js";
import { indexCharts } from "./lib/orbits.js";
import { putIn } from "./lib/same-draw.js";
import { groundSky, skyScene } from "./lib/sky.js";

const W = 480;
const H = 250;
let band;

beforeEach(() => {
  document.body.innerHTML = '<div id="band"></div>';
  band = document.getElementById("band");
  Object.defineProperty(band, "clientWidth", { value: W });
  Object.defineProperty(band, "clientHeight", { value: H });
});

/** The nodes in these layers now, to tell whether a draw put new ones in. */
const nodes = (...layers) => layers.flatMap((g) => [...g.childNodes]);
const same = (a, b) => a.length === b.length && a.every((n, i) => n === b[i]);
/**
 * Whether the page's layers are what a fresh draw at t puts there, within half a px (`within` units):
 * the layers are emptied, so the view's draw at t puts all of it in, and compared with what was there.
 */
function likeFresh(view, layers, t, within = 0.5) {
  const was = layers.map((g) => g.cloneNode(true));
  for (const g of layers) g.replaceChildren();
  view.draw(t);
  const fresh = layers.map((g) => {
    const f = document.createDocumentFragment();
    for (const n of g.childNodes) f.appendChild(n.cloneNode(true));
    return f;
  });
  return putIn(fresh, was, { within }) === "same";
}
/** Count setAttribute("viewBox") on the svg from now. */
function viewBoxSets(svg) {
  const sets = { n: 0 };
  const set = svg.setAttribute.bind(svg);
  svg.setAttribute = (k, v) => (k === "viewBox" && sets.n++, set(k, v));
  return sets;
}

describe("the chart", () => {
  let chart;
  let t;
  beforeEach(async () => {
    const { ChartView } = await import("./chart-view.js");
    chart = new ChartView(band);
    t = Date.now();
    const c = chartCase("at-gannet", t);
    chart.setCharts(c.charts);
    chart.setShip(c.ship);
    chart.setCourse(c.course);
    chart.setContacts?.(c.contacts);
    chart.setOn(true);
    chart.draw(t);
  });
  const layers = () => nodes(chart.marks, chart.lit, chart.picks, chart.over);
  const fresh = (at) => likeFresh(chart, [chart.marks, chart.lit, chart.picks, chart.over], at);

  it("keeps its nodes, and its viewBox, through a second's tick parked", () => {
    const before = layers();
    expect(before.length).toBeGreaterThan(0);
    const sets = viewBoxSets(chart.svg);
    chart.draw(t + 1000);
    expect(same(layers(), before)).toBe(true);
    expect(sets.n).toBe(0);
  });

  it("shows a pan you'd see", () => {
    const s = chart.scale();
    const [x, y, w, h] = chart.vb;
    chart.userView([x + 3 * s, y, w, h]);
    expect(fresh(Date.now())).toBe(true);
  });

  it("stays within half a px of where things are, tick after tick", () => {
    for (let k = 1; k <= 60; k++) {
      chart.draw(t + k * 10_000);
      if (k % 15 === 0) expect(fresh(t + k * 10_000)).toBe(true);
    }
  });
});

describe("the lanes map", () => {
  let lanes;
  let t;
  beforeEach(async () => {
    const { LanesView } = await import("./lanes-view.js");
    lanes = new LanesView(band);
    t = Date.now();
    lanes.setLanes({ system: "senara", visible: ["maelor-senara"], uncharted: [], seen: { "maelor-petroc": { open: true, at: t / 1000 - 600 } } });
    lanes.setOn(true);
    lanes.draw(t);
  });
  const layers = () => nodes(lanes.marks, lanes.lit);

  it("keeps its nodes through a second's tick", () => {
    const before = layers();
    expect(before.length).toBeGreaterThan(0);
    lanes.draw(t + 1000);
    expect(same(layers(), before)).toBe(true);
  });

  it("shows a sighting's new age", () => {
    const before = lanes.marks.textContent;
    lanes.draw(t + 60 * 60 * 1000); // 10 min old to 70: its age on the map, and its fade
    expect(lanes.marks.textContent).not.toBe(before);
    expect(likeFresh(lanes, [lanes.marks, lanes.lit], t + 60 * 60 * 1000)).toBe(true);
  });
});

describe("the belt map", () => {
  let belt;
  let t;
  const msg = (x) => ({ id: "gannet", name: "Gannet Belt", radius: 40, place: { x, y: 5, km: Math.hypot(x, 5), bearing: 0 }, host: null, array: false, log: { track: [[[x, 5]]], sweeps: [] } });
  beforeEach(async () => {
    const { BeltView } = await import("./belt-view.js");
    belt = new BeltView(band);
    t = Date.now();
    belt.setBelt(msg(10));
    belt.setOn(true);
    belt.draw(t + 60_000); // past any glide in
  });
  const layers = () => nodes(belt.marks, belt.lit, belt.words);

  it("keeps its nodes through a second's tick parked", () => {
    const before = layers();
    expect(before.length).toBeGreaterThan(0);
    belt.draw(t + 61_000);
    expect(same(layers(), before)).toBe(true);
  });

  it("shows her where she has moved to", () => {
    const before = belt.lit.innerHTML;
    belt.setBelt(msg(20));
    const at = Date.now() + 60_000;
    belt.draw(at);
    expect(belt.lit.innerHTML).not.toBe(before);
    expect(likeFresh(belt, [belt.marks, belt.lit, belt.words], at)).toBe(true);
  });
});

describe("a port's sky", () => {
  const charts = indexCharts(senaraCharts(Date.now()));
  /** A minute of the coming days when Zennor's sky has a glow of this kind on its horizon, for 5 min. */
  const glowing = (kind = "dusk") => {
    const glow = (t) => {
      const sky = groundSky(charts, "zennor", t);
      return sky && skyScene(sky).glow?.kind;
    };
    for (let t = Date.now(); t < Date.now() + 3 * 86400_000; t += 60_000) if (glow(t) === kind && glow(t + 5 * 60_000) === kind) return t;
    throw new Error(`no ${kind} in three days`);
  };
  let sky;
  beforeEach(async () => {
    const { SkyView } = await import("./town-view.js");
    sky = new SkyView(band, { byId: new Map([["zennor.square", { outdoors: true }]]) }, "zennor");
    sky.set({ kind: "room", id: "zennor.square" }, {});
    sky.setCharts(charts);
  });
  const glow = () => sky.svg.querySelector("ellipse");

  it("keeps its nodes through a second's tick", () => {
    const t = glowing();
    sky.draw(t);
    const before = nodes(sky.back, sky.front);
    expect(before.length).toBeGreaterThan(0);
    sky.draw(t + 1000);
    expect(same(nodes(sky.back, sky.front), before)).toBe(true);
  });

  it("shows the sky as it is now, its starfield kept", () => {
    const t = glowing();
    sky.draw(t);
    const field = sky.back.querySelector("[data-same]");
    expect(field.childNodes.length).toBeGreaterThan(0);
    for (let k = 1; k <= 30; k++) sky.draw(t + k * 10_000);
    expect(sky.back.querySelector("[data-same]")).toBe(field);
    expect(likeFresh(sky, [sky.back, sky.front], t + 300_000, sky.halfPx())).toBe(true);
  });

  it("centres dawn's paling on its glow", () => {
    const t = glowing("dawn");
    for (let k = 0; k <= 30; k++) {
      sky.draw(t + k * 10_000);
      expect(sky.back.querySelector("radialGradient").getAttribute("cx")).toBe(glow().getAttribute("cx"));
    }
  });

  it("keeps its glow's one node as the sun moves it, and hides it with no glow", () => {
    const t = glowing();
    sky.draw(t);
    const g = glow();
    expect(g.getAttribute("filter")).toMatch(/^url\(#sky-soft-zennor\)$/);
    const cx = g.getAttribute("cx");
    sky.draw(t + 5 * 60_000);
    expect(glow()).toBe(g);
    expect(g.getAttribute("cx")).not.toBe(cx);
    sky.set({ kind: "room", id: "zennor.indoors" }, {}); // in: no sky
    sky.draw(t + 5 * 60_000);
    expect(glow()).toBe(g);
    expect(g.getAttribute("display")).toBe("none");
  });
});
