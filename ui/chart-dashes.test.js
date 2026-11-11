// @vitest-environment happy-dom
// Issue #1: CoreGraphics makes every dash of a dashed stroke, on screen or not, so a dashed ring or
// line millions of px long (the edge, a lost belt, her high-orbit ring or trip, at the narrowest
// zoom) hung WebKit's GPU process. Dashed marks are kept to about the band's size: rings that big
// are drawn solid, and lines are cut to the band.

import { beforeEach, describe, expect, it } from "vitest";
import { chartCase } from "../dev/charts-cases.js";
import { positionOf, systemRadius } from "./lib/orbits.js";

const W = 900;
const H = 250;
const DIAG = Math.hypot(W, H);
const NARROWEST = 1000; // km across: MIN_W in chart-view.js

let ChartView;
let chart;

beforeEach(async () => {
  document.body.innerHTML = '<div id="band"></div>';
  const band = document.getElementById("band");
  Object.defineProperty(band, "clientWidth", { value: W });
  Object.defineProperty(band, "clientHeight", { value: H });
  ({ ChartView } = await import("./chart-view.js"));
  chart = new ChartView(band);
});

function open(name, { lost = null } = {}) {
  const c = chartCase(name, Date.now());
  // a belt whose fit is out by more than its whole orbit: lost, drawn as its whole orbit dashed
  for (const p of c.charts.places) if (p.id === lost) p.fit.error = 1e12;
  chart.setCharts(c.charts);
  chart.setShip(c.ship);
  chart.setCourse(c.course);
  chart.setOn(true);
}

/** The view at its narrowest about km point p (y up), as a pan and zoom would leave it. */
function zoomOn(p, t = Date.now()) {
  const h = (NARROWEST * H) / W;
  chart.vb = [p[0] - NARROWEST / 2, -p[1] - h / 2, NARROWEST, h];
  chart.touched = true;
  chart.draw(t);
}

const dashed = () => [...chart.svg.querySelectorAll("[stroke-dasharray]")];
const num = (e, k) => Number(e.getAttribute(k));

/** Every dashed mark's size in px: a ring's radius, a line's length. */
function sizes() {
  return dashed().map((e) => {
    const tag = e.tagName.toLowerCase();
    if (tag === "circle") return num(e, "r");
    if (tag === "ellipse") return Math.max(num(e, "rx"), num(e, "ry"));
    if (tag === "line") return Math.hypot(num(e, "x2") - num(e, "x1"), num(e, "y2") - num(e, "y1"));
    return 0; // paths: the mouths' chevrons, a few px
  });
}

const expectSmallDashes = () => {
  for (const r of sizes()) expect(r).toBeLessThanOrEqual(4 * DIAG);
};

describe("dashed marks at the narrowest zoom", () => {
  it("draws the edge solid where it crosses a view zoomed right in on it", () => {
    open("docked-tiss");
    const R = systemRadius(chart.index);
    zoomOn([R, 0]);
    const edge = [...chart.marks.querySelectorAll("circle")].filter((e) => Math.abs(num(e, "r") - R / chart.scale()) < 1);
    expect(edge.length).toBeGreaterThan(0); // still drawn
    expectSmallDashes();
  });

  it("leaves the edge out when the view is well inside it", () => {
    open("docked-tiss");
    zoomOn([0, 0]);
    const R = systemRadius(chart.index) / chart.scale();
    expect([...chart.svg.querySelectorAll("circle")].some((e) => Math.abs(num(e, "r") - R) < 1)).toBe(false);
  });

  it("keeps the edge dotted at the system's own zoom", () => {
    open("docked-tiss");
    chart.home?.();
    chart.chip.querySelector('button[data-chip=""]')?.click();
    expect(dashed().some((e) => e.getAttribute("stroke-dasharray") === "1 5")).toBe(true);
  });

  it("draws a lost belt's orbit solid where it crosses a view zoomed right in on it", () => {
    open("docked-tiss", { lost: "cinders-1" });
    zoomOn(positionOf(chart.index, "cinders-1", Date.now()));
    expect(chart.svg.textContent).toContain("The Cinders · lost");
    // its orbit is still drawn across the view, solid
    const huge = [...chart.marks.querySelectorAll("circle, ellipse")].filter((e) => Math.max(num(e, "r"), num(e, "rx")) > 4 * DIAG);
    expect(huge.some((e) => e.getAttribute("stroke") !== "transparent" && !e.hasAttribute("stroke-dasharray"))).toBe(true);
    expectSmallDashes();
  });

  it("keeps her high-orbit ring small enough to dash, or draws it solid", () => {
    open("high-orbit-tamsin");
    chart.draw(Date.now());
    zoomOn([chart.shipAt[0], -chart.shipAt[1]]);
    expectSmallDashes();
  });

  for (const name of ["under-way-orrin", "to-gannet", "course-orrin"]) {
    it(`cuts her dashed line to the band (${name})`, () => {
      open(name);
      chart.draw(Date.now());
      zoomOn([chart.shipAt[0], -chart.shipAt[1]]);
      for (const e of dashed().filter((d) => d.tagName.toLowerCase() === "line")) {
        for (const [x, y] of [[num(e, "x1"), num(e, "y1")], [num(e, "x2"), num(e, "y2")]]) {
          expect(x).toBeGreaterThanOrEqual(-20);
          expect(x).toBeLessThanOrEqual(W + 20);
          expect(y).toBeGreaterThanOrEqual(-20);
          expect(y).toBeLessThanOrEqual(H + 20);
        }
      }
      expectSmallDashes();
    });
  }
});
