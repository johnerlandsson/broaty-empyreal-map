// @vitest-environment happy-dom
// The system chart's two levels at true size (option B of true-size-nesting-mockup.html): the chip
// under the scale bar names the star and the planet the view is at, a click on either frames it, and
// a click within a planet's dotted ring from the system frames what goes round it.

import { beforeEach, describe, expect, it } from "vitest";
import { chartCase } from "../dev/charts-cases.js";

let ChartView;
let band;
let chart;

beforeEach(async () => {
  document.body.innerHTML = '<div id="band"></div>';
  band = document.getElementById("band");
  // happy-dom lays nothing out: a band 900 × 250 px
  Object.defineProperty(band, "clientWidth", { value: 900 });
  Object.defineProperty(band, "clientHeight", { value: 250 });
  ({ ChartView } = await import("./chart-view.js"));
  chart = new ChartView(band);
  chart.div.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 250, right: 900, bottom: 250 });
  const c = chartCase("docked-tiss", Date.now());
  chart.setCharts(c.charts);
  chart.setShip(c.ship);
  chart.setOn(true);
});

const chip = () => [...chart.chip.querySelectorAll("button")].map((b) => [b.textContent, b.classList.contains("on")]);
const click = (x, y) => {
  chart.div.dispatchEvent(new PointerEvent("pointerdown", { clientX: x, clientY: y, button: 0, bubbles: true }));
  chart.div.dispatchEvent(new PointerEvent("pointerup", { clientX: x, clientY: y, button: 0, bubbles: true }));
};

describe("the chart's levels", () => {
  it("opens docked at T.I.S.S. on Tamsin, the chip saying Senara ▸ Tamsin", () => {
    expect(chart.chip.hidden).toBe(false);
    expect(chip()).toEqual([["Senara", false], ["Tamsin", true]]);
  });

  it("shows the system from the chip's Senara, with a ring to click for each planet with places", () => {
    chart.chip.querySelector('button[data-level=""]').click();
    expect(chip()).toEqual([["Senara", true]]);
    expect(chart.touched).toBe(true);
    expect(chart.levelHits.map((h) => h.id)).toEqual(["tamsin", "orrin"]);
    const orrin = chart.levelHits.find((h) => h.id === "orrin");
    click(orrin.x + 2, orrin.y);
    expect(chip()).toEqual([["Senara", false], ["Orrin", true]]);
    expect(chart.levelHits.map((h) => h.id)).toEqual(["tamsin"]); // at Orrin's level, Orrin has no ring
  });

  it("takes no pick at the end of a drag", () => {
    chart.chip.querySelector('button[data-level=""]').click();
    const t = chart.levelHits.find((h) => h.id === "tamsin");
    chart.div.dispatchEvent(new PointerEvent("pointerdown", { clientX: t.x + 40, clientY: t.y, button: 0, bubbles: true }));
    chart.div.dispatchEvent(new PointerEvent("pointerup", { clientX: t.x, clientY: t.y, button: 0, bubbles: true }));
    expect(chip()).toEqual([["Senara", true]]);
  });
});
