import { describe, expect, it } from "vitest";
import { chartCase } from "../../dev/charts-cases.js";
import { MOUTH_MAX_KM, distanceText, errorAt, fitBox, folded, homeBox, indexCharts, isLost, levelOf, levelPlanets, planetBox, positionOf, scaleKm, scaleText, shipFix, systemBox, systemRadius } from "./orbits.js";

// The chart at the game's true sizes (true-size.md in the Empyreal source), from its own charts as
// dev/charts-cases.ts recorded them: Tamsin 6,400 km across 1.00 TU from Senara, T.I.S.S.
// 22,950 km round it, the mouths 6.50 TU out.

const at = (name) => {
  const c = chartCase(name);
  return { ...c, index: indexCharts(c.charts) };
};
const width = (b) => b[2] - b[0];

describe("the game's true sizes", () => {
  const docked = at("docked-tiss");

  it("are what the recording holds", () => {
    const tamsin = docked.index.items.get("tamsin");
    expect(tamsin.radius).toBe(6400);
    expect(tamsin.orbit.a).toBe(71_400_000);
    expect(docked.index.items.get("tiss").orbit.a).toBe(22_950);
  });

  it("put the edge at the mouths' distance", () => {
    expect(systemRadius(docked.index)).toBeCloseTo(464_164_484, -3);
    expect(systemRadius(at("docked-wenna-halt").index)).toBeCloseTo(462_307_826, -3);
  });

  it("put the edge no further than help lanes' 8.40 TU where no mouth has a bearing", () => {
    const charts = structuredClone(docked.charts);
    for (const p of charts.places) if (p.kind === "mouth") delete p.edge;
    expect(MOUTH_MAX_KM).toBe(600_000_000);
    expect(systemRadius(indexCharts(charts))).toBe(MOUTH_MAX_KM);
  });
});

describe("distanceText", () => {
  // the game's own words for a distance (distanceText in systems/space.ts, docs/tamsin-units.md)
  it("says km under a tenth of a TU, to the hundred from a thousand", () => {
    expect(distanceText(140)).toBe("140 km");
    expect(distanceText(999.4)).toBe("999 km");
    expect(distanceText(1949)).toBe("1,900 km");
    expect(distanceText(22_950)).toBe("23,000 km");
    expect(distanceText(999_949)).toBe("999,900 km");
  });
  it("writes km in full to ten thousand from a million, never millions", () => {
    expect(distanceText(999_950)).toBe("1,000,000 km");
    expect(distanceText(3_750_000)).toBe("3,750,000 km");
    expect(distanceText(4_000_000)).toBe("4,000,000 km");
    expect(distanceText(6_782_999)).toBe("6,780,000 km");
  });
  it("says TU to two places from 0.10 TU", () => {
    expect(distanceText(6_783_000)).toBe("0.10 TU");
    expect(distanceText(71_400_000)).toBe("1.00 TU");
    expect(distanceText(129_234_000)).toBe("1.81 TU");
    expect(distanceText(262_555_380.5)).toBe("3.68 TU");
    expect(distanceText(464_100_000)).toBe("6.50 TU");
    expect(distanceText(1_500_000_000)).toBe("21.01 TU");
  });
});

describe("the scale bar at true sizes", () => {
  // stays in km at every zoom, as the game's site keeps its map's scale bar
  it("reads in km written in full at a planet's zoom and a system's", () => {
    expect(scaleText(scaleKm(200, 90))).toBe("10,000 km");
    expect(scaleText(scaleKm(1_000_000, 90))).toBe("50,000,000 km");
  });
});

describe("opening the chart at true sizes", () => {
  const [w, h] = [900, 250];

  it("frames Tamsin with T.I.S.S., Zennor and its belts when she's docked at T.I.S.S.", () => {
    const { index, ship, now } = at("docked-tiss");
    const box = fitBox(homeBox(index, ship, now), w, h);
    const s = box[2] / w; // km a px
    for (const id of ["tiss", "cinders-1", "gannet-1"]) expect(folded(index, id, s)).toBe(false);
    expect(index.items.get("tamsin").radius / s).toBeGreaterThan(5); // the planet's disc is a disc
    expect(box[2]).toBeLessThan(1_000_000); // a planet's neighbourhood, not the system
  });

  it("frames her trip to Orrin Station across the system", () => {
    const { index, ship, now } = at("under-way-orrin");
    const fix = shipFix(index, ship, now);
    expect(fix.kind).toBe("moving");
    const box = homeBox(index, ship, now);
    for (const id of ["tamsin", "orrin"]) {
      const p = positionOf(index, id, now);
      expect(p[0]).toBeGreaterThan(box[0]);
      expect(p[0]).toBeLessThan(box[2]);
    }
    expect(width(box)).toBeGreaterThan(200_000_000);
  });

  it("frames her trip to Gannet round Tamsin", () => {
    const { index, ship, now } = at("to-gannet");
    expect(width(homeBox(index, ship, now))).toBeLessThan(300_000);
  });
});

describe("belt fits at true sizes", () => {
  it("keep a belt round a star found to within its own orbit, and lose none just charted", () => {
    const { index, now } = at("docked-tiss");
    for (const id of ["cinders-1", "gannet-1", "anvil-1"]) {
      const it = index.items.get(id);
      expect(isLost(errorAt(it.fit, it.orbit.a, now), it.orbit.a)).toBe(false);
    }
    const anvil = index.items.get("anvil-1");
    expect(errorAt(anvil.fit, anvil.orbit.a, now)).toBeGreaterThan(100_000);
  });
});

describe("the chart's two levels (option B of true-size-nesting-mockup.html)", () => {
  const { index, ship, now } = at("docked-tiss");
  const [w, h] = [900, 250];
  const view = (box) => fitBox(box, w, h);

  it("has a level for each planet with places on her charts, and none for the bare ones", () => {
    expect(levelPlanets(index)).toEqual(["tamsin", "orrin"]);
    expect(levelPlanets(at("docked-wenna-halt").index)).toEqual(["wenna"]);
  });

  it("frames a planet out to its furthest place, and the system out to its edge", () => {
    const b = planetBox(index, "tamsin", now);
    const c = positionOf(index, "tamsin", now);
    expect((b[0] + b[2]) / 2).toBeCloseTo(c[0], 3);
    expect(width(b) / 2).toBeCloseTo(index.items.get("gannet-1").orbit.a * 1.15, 3);
    expect(planetBox(index, "senara_1", now)).toBe(null); // nothing goes round it
    expect(width(systemBox(index)) / 2).toBeCloseTo(1.08 * systemRadius(index), 3);
  });

  it("is the planet ⌂ opens on when she's docked at T.I.S.S., and the system under way to Orrin", () => {
    expect(levelOf(index, view(homeBox(index, ship, now)), now)).toBe("tamsin");
    const u = at("under-way-orrin");
    expect(levelOf(u.index, view(homeBox(u.index, u.ship, u.now)), u.now)).toBe(null);
  });

  it("is the system zoomed out from a planet till its places fold, and the planet zoomed back in", () => {
    const vb = view(planetBox(index, "tamsin", now));
    const zoomed = (k) => [vb[0] + (vb[2] * (1 - k)) / 2, vb[1] + (vb[3] * (1 - k)) / 2, vb[2] * k, vb[3] * k];
    expect(levelOf(index, zoomed(4), now)).toBe("tamsin");
    expect(levelOf(index, zoomed(400), now)).toBe(null);
    expect(levelOf(index, view(systemBox(index)), now)).toBe(null);
  });

  it("is the planet with its centre just off the view but its places in it", () => {
    const vb = view(planetBox(index, "tamsin", now));
    // panned right by most of the box: Tamsin's centre off the left edge, Gannet's orbit still in view
    const reach = index.items.get("gannet-1").orbit.a;
    const off = [vb[0] + vb[2] / 2 + reach * 0.5, vb[1], vb[2], vb[3]];
    expect(levelOf(index, off, now)).toBe("tamsin");
  });

  it("weighs a tall band's height as a wide band's width", () => {
    const vb = view(planetBox(index, "tamsin", now));
    const c = [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2];
    const span = 2 * index.items.get("gannet-1").orbit.a * 1.15;
    const tall = [c[0] - span / 2, c[1] - 50 * span, span, 100 * span];
    expect(levelOf(index, tall, now)).toBe(null);
    const wide = [c[0] - 50 * span, c[1] - span / 2, 100 * span, span];
    expect(levelOf(index, wide, now)).toBe(null);
  });

  it("is no planet with the view somewhere else", () => {
    const vb = view(planetBox(index, "tamsin", now));
    expect(levelOf(index, [vb[0] + 10 * vb[2], vb[1], vb[2], vb[3]], now)).toBe(null);
  });
});
