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
const picks = () => [...chart.picks.querySelectorAll("[data-level]")];
const pickOf = (id) => picks().find((p) => p.getAttribute("data-level") === id);
const press = (target, x = 0, y = 0, to = [x, y]) => {
  target.dispatchEvent(new PointerEvent("pointerdown", { clientX: x, clientY: y, button: 0, bubbles: true }));
  target.dispatchEvent(new PointerEvent("pointerup", { clientX: to[0], clientY: to[1], button: 0, bubbles: true }));
};
const toSystem = () => chart.chip.querySelector('button[data-chip=""]').click();

describe("the chart's levels", () => {
  it("opens docked at T.I.S.S. on Tamsin, the chip saying Senara ▸ Tamsin", () => {
    expect(chart.chip.hidden).toBe(false);
    expect(chip()).toEqual([["Senara", false], ["Tamsin", true]]);
  });

  it("shows the system from the chip's Senara, with a ring to click for each planet with places", () => {
    toSystem();
    expect(chip()).toEqual([["Senara", true]]);
    expect(chart.touched).toBe(true);
    expect(picks().map((p) => p.getAttribute("data-level"))).toEqual(["tamsin", "orrin"]);
    press(pickOf("orrin"));
    expect(chip()).toEqual([["Senara", false], ["Orrin", true]]);
    expect(picks().map((p) => p.getAttribute("data-level"))).toEqual(["tamsin"]); // at Orrin's level, Orrin has no ring
  });

  it("puts a planet's pick over her chevron, so a click on her there still picks it", () => {
    toSystem();
    const lit = chart.lit.compareDocumentPosition(chart.picks);
    expect(lit & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("takes no pick at the end of a drag", () => {
    toSystem();
    press(pickOf("tamsin"), 40, 0, [0, 0]);
    expect(chip()).toEqual([["Senara", true]]);
  });

  it("takes no pick from a press on the zoom buttons or a card, wherever it ends", () => {
    toSystem();
    const buttons = [...chart.div.querySelectorAll("button:not([data-chip])")];
    expect(buttons.length).toBeGreaterThan(2); // + − ⌂ and the card's
    for (const b of buttons) press(b);
    expect(chip()[0][0]).toBe("Senara");
    expect(chip().length).toBe(1);
  });

  it("frames a planet no narrower than the zoom goes", () => {
    const c = chartCase("docked-tiss", Date.now());
    // all that goes round Orrin pulled in to 20 km: its box far narrower than the zoom's 1,000 km
    for (const p of [...c.charts.bodies, ...c.charts.places]) if (p.orbit?.parent === "orrin") p.orbit = { ...p.orbit, a: 20 };
    chart.setCharts(c.charts);
    chart.showLevel("orrin");
    expect(chart.vb[2]).toBeGreaterThanOrEqual(1000);
  });
});
