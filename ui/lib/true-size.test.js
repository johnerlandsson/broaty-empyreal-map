import { describe, expect, it } from "vitest";
import { chartCase } from "../../dev/charts-cases.js";
import { MOUTH_MAX_KM, errorAt, fitBox, folded, homeBox, indexCharts, isLost, kmText, levelOf, levelPlanets, planetBox, positionOf, scaleKm, shipFix, systemBox, systemRadius } from "./orbits.js";

// The chart at the game's true sizes (true-size.md in the Empyreal source), from its own charts as
// dev/charts-cases.ts recorded them: Tamsin 6,400 km across 71.4 million km from Senara, T.I.S.S.
// 22,950 km round it, the mouths 464 million km out.

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

  it("put the edge no further than help lanes' 600 million km where no mouth has a bearing", () => {
    const charts = structuredClone(docked.charts);
    for (const p of charts.places) if (p.kind === "mouth") delete p.edge;
    expect(MOUTH_MAX_KM).toBe(600_000_000);
    expect(systemRadius(indexCharts(charts))).toBe(MOUTH_MAX_KM);
  });
});

describe("kmText", () => {
  // the game's own words for a distance (kmText in systems/space.ts)
  it("says km under a million, to the hundred from a thousand", () => {
    expect(kmText(140)).toBe("140 km");
    expect(kmText(999.4)).toBe("999 km");
    expect(kmText(1949)).toBe("1,900 km");
    expect(kmText(22_950)).toBe("23,000 km");
    expect(kmText(999_949)).toBe("999,900 km");
  });
  it("says millions to a tenth above", () => {
    expect(kmText(999_950)).toBe("1 million km");
    expect(kmText(71_400_000)).toBe("71.4 million km");
    expect(kmText(262_555_380.5)).toBe("262.6 million km");
    expect(kmText(1_500_000_000)).toBe("1,500 million km");
  });
});

describe("the scale bar at true sizes", () => {
  it("reads in the game's words at a planet's zoom and a system's", () => {
    expect(kmText(scaleKm(200, 90))).toBe("10,000 km");
    expect(kmText(scaleKm(1_000_000, 90))).toBe("50 million km");
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

  it("is no planet with the view somewhere else", () => {
    const vb = view(planetBox(index, "tamsin", now));
    expect(levelOf(index, [vb[0] + 10 * vb[2], vb[1], vb[2], vb[3]], now)).toBe(null);
  });
});
