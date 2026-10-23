import { describe, expect, it } from "vitest";
import {
  EDGE_KM, ago, edgeMarker, errorAt, fitBox, folded, follows, frameOf, homeBox, indexCharts, isLost, legOf, mouthStar,
  daylit, followStep, markOf, offCentre, offsetOn, parentOf, parsePoint, positionOf, scaleKm, shipFix, systemRadius,
} from "./orbits.js";

const rad = (d) => (d * Math.PI) / 180;
const orbit = (parent, a, period, extra = {}) => ({ parent, a, e: 0, peri: 0, phase: 0, period, ...extra });

const charts = (edge) => ({
  epoch: 0,
  system: "senara",
  bodies: [
    { id: "senara", name: "Senara", kind: "star" },
    { id: "tamsin", name: "Tamsin", kind: "planet", radius: 6000, orbit: orbit("senara", 6000, 259200) },
    { id: "tiss", name: "Tiss", kind: "moon", orbit: orbit("tamsin", 900, 7200) },
    { id: "orrin", name: "Orrin", kind: "planet", orbit: orbit("senara", 12000, 733137, { e: 0.1, phase: 150 }) },
  ],
  places: [
    { id: "orrin_station", name: "Orrin Station", kind: "station", orbit: orbit("orrin", 800, 3600) },
    { id: "gannet", name: "Gannet", kind: "belt", orbit: orbit("tamsin", 2700, 50000) },
    { id: "mouth", name: "The Mouth", kind: "mouth", ...(edge ? { edge } : {}) },
  ],
});

const idx = indexCharts(charts({ r: 15000, bearing: 90, at: "senara" }));
const T = 123456789;

describe("EDGE_KM", () => {
  it("is 15000", () => expect(EDGE_KM).toBe(15000));
});

describe("indexCharts", () => {
  it("indexes bodies and places by id", () => {
    expect(idx.system).toBe("senara");
    expect(idx.epoch).toBe(0);
    expect(idx.items.get("tiss").name).toBe("Tiss");
    expect(idx.items.get("gannet").kind).toBe("belt");
  });

  it("merges a body and a place with the same id", () => {
    const i = indexCharts({
      epoch: 0,
      system: "s",
      bodies: [{ id: "x", name: "X", kind: "planet", radius: 5, orbit: orbit("s", 1, 1) }],
      places: [{ id: "x", name: "X", kind: "planet", fit: 3 }],
    });
    expect(i.items.get("x")).toMatchObject({ radius: 5, fit: 3 });
    expect(i.items.get("x").orbit.a).toBe(1);
  });

  it("copes with missing lists", () => {
    expect(indexCharts({}).items.size).toBe(0);
    expect(indexCharts(null).items.size).toBe(0);
  });
});

describe("offsetOn", () => {
  it("circular quarter turn", () => {
    const [x, y] = offsetOn(orbit("tamsin", 900, 7200), 0, 1800000);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(900, 6);
  });

  it("eccentric at periapsis and apoapsis", () => {
    const [x, y] = offsetOn({ a: 12000, e: 0.1, peri: 30, phase: 0, period: 1000 }, 0, 0);
    expect(x).toBeCloseTo(10800 * Math.cos(rad(30)), 6);
    expect(y).toBeCloseTo(10800 * Math.sin(rad(30)), 6);
    const [u, v] = offsetOn({ a: 12000, e: 0.1, peri: 30, phase: 180, period: 1000 }, 0, 0);
    expect(u).toBeCloseTo(13200 * Math.cos(rad(210)), 6);
    expect(v).toBeCloseTo(13200 * Math.sin(rad(210)), 6);
  });

  it("is [0,0] for bad data", () => {
    expect(offsetOn(null, 0, 0)).toEqual([0, 0]);
    expect(offsetOn({ a: 1, period: 0 }, 0, 0).every(Number.isFinite)).toBe(true);
  });
});

describe("positionOf", () => {
  it("nests a moon on its planet", () => {
    const t = positionOf(idx, "tamsin", T);
    const o = offsetOn(idx.items.get("tiss").orbit, 0, T);
    const p = positionOf(idx, "tiss", T);
    expect(p[0]).toBeCloseTo(t[0] + o[0], 6);
    expect(p[1]).toBeCloseTo(t[1] + o[1], 6);
  });

  it("puts the star at the origin", () => {
    expect(positionOf(idx, "senara", T)).toEqual([0, 0]);
  });

  it("places a point relative to its body", () => {
    const t = positionOf(idx, "tamsin", T);
    const p = positionOf(idx, "pt:tamsin:1500:-2000", T);
    expect(p[0]).toBeCloseTo(t[0] + 1500, 6);
    expect(p[1]).toBeCloseTo(t[1] - 2000, 6);
  });

  it("parses points", () => {
    expect(parsePoint("pt:tamsin:1500:-2000")).toEqual({ body: "tamsin", x: 1500, y: -2000 });
    expect(parsePoint("pt:tamsin:x:1")).toBeNull();
    expect(parsePoint("tamsin")).toBeNull();
    expect(parsePoint(null)).toBeNull();
  });

  it("puts the mouth on the edge, or nowhere", () => {
    const [x, y] = positionOf(idx, "mouth", T);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(15000, 6);
    const bare = indexCharts(charts(null));
    expect(positionOf(bare, "mouth", T)).toBeNull();
  });

  it("is null for unknown or cyclic parents", () => {
    const i = indexCharts({
      epoch: 0,
      system: "s",
      bodies: [
        { id: "a", name: "A", kind: "planet", orbit: orbit("b", 1, 1) },
        { id: "b", name: "B", kind: "planet", orbit: orbit("a", 1, 1) },
        { id: "c", name: "C", kind: "planet", orbit: orbit("nope", 1, 1) },
      ],
    });
    expect(positionOf(i, "a", 0)).toBeNull();
    expect(positionOf(i, "c", 0)).toBeNull();
    expect(positionOf(i, "zzz", 0)).toBeNull();
    expect(positionOf(i, "pt:nope:1:1", 0)).toBeNull();
  });
});

describe("parentOf", () => {
  it("names the body an item orbits", () => {
    expect(parentOf(idx, "tiss")).toBe("tamsin");
    expect(parentOf(idx, "pt:tamsin:1:1")).toBe("tamsin");
    expect(parentOf(idx, "senara")).toBeNull();
    expect(parentOf(idx, "mouth")).toBeNull();
  });
});

describe("frameOf", () => {
  it("finds the nearest body both orbit", () => {
    expect(frameOf(idx, "tiss", "gannet")).toBe("tamsin");
    expect(frameOf(idx, "tiss", "orrin_station")).toBe("senara");
    expect(frameOf(idx, "pt:tamsin:1:1", "tiss")).toBe("tamsin");
    expect(frameOf(idx, "tiss", "nope")).toBeNull();
  });

  it("lets a body be the frame of a trip to what orbits it", () => {
    expect(frameOf(idx, "tamsin", "tiss")).toBe("tamsin");
    expect(frameOf(idx, "pt:tamsin:1:1", "tamsin")).toBe("tamsin");
  });
});

describe("belt error", () => {
  it("holds until at", () => expect(errorAt({ seen: 0, error: 100, at: 3.6e6 }, 2700, 3.6e6)).toBe(100));
  it("grows as time^1.5", () => expect(errorAt({ seen: 0, error: 100, at: 3.6e6 }, 2700, 4 * 3.6e6)).toBeCloseTo(800, 6));
  it("holds for a fresh fit", () => {
    expect(errorAt({ seen: 0, error: 5, at: 300000 }, 2700, 1e12)).toBe(5);
  });
  it("caps at half way round", () => {
    expect(errorAt({ seen: 0, error: 100, at: 3.6e6 }, 2700, 1e12)).toBeCloseTo(Math.PI * 2700, 6);
  });
  it("is lost near the cap", () => {
    expect(isLost(0.9 * Math.PI * 2700, 2700)).toBe(true);
    expect(isLost(0.9 * Math.PI * 2700 - 1, 2700)).toBe(false);
  });
});

describe("legOf and shipFix", () => {
  const ship = { docked: false, from: "tiss", destination: "gannet", progress: 0.5, eta: 100, received: 1000 };
  const near = (a, b) => {
    expect(a[0]).toBeCloseTo(b[0], 6);
    expect(a[1]).toBeCloseTo(b[1], 6);
  };

  it("works out the leg", () => {
    const leg = legOf(idx, ship);
    expect(leg.arrive).toBe(1100000);
    expect(leg.depart).toBe(900000);
    expect(leg.frame).toBe("tamsin");
    near(leg.from, offsetOn(idx.items.get("tiss").orbit, 0, 900000));
    near(leg.to, offsetOn(idx.items.get("gannet").orbit, 0, 1100000));
  });

  it("copes with progress 1", () => {
    const s = { ...ship, progress: 1 };
    const leg = legOf(idx, s);
    expect(leg.depart).toBe(leg.arrive);
    const fix = shipFix(idx, s, 1100000);
    const f = positionOf(idx, "tamsin", 1100000);
    near(fix.pos, [f[0] + leg.to[0], f[1] + leg.to[1]]);
  });

  it("prefers the depart the Lua side kept", () => {
    // a 300 s trip that left at 1000: late on, progress rounds to 0.99 and then 1.00
    const late = { ...ship, depart: 1000, progress: 0.99, eta: 2, received: 1298 };
    expect(legOf(idx, late)).toMatchObject({ depart: 1000000, arrive: 1300000 });
    near(legOf(idx, late).from, offsetOn(idx.items.get("tiss").orbit, 0, 1000000));
    const done = { ...late, progress: 1, eta: 1, received: 1299 };
    expect(legOf(idx, done)).toMatchObject({ depart: 1000000, arrive: 1300000 });
    // not drawn at the destination before she gets there
    const f = positionOf(idx, "tamsin", 1299000);
    const leg = legOf(idx, done);
    const k = 299 / 300;
    near(shipFix(idx, done, 1299000).pos, [f[0] + leg.from[0] + (leg.to[0] - leg.from[0]) * k, f[1] + leg.from[1] + (leg.to[1] - leg.from[1]) * k]);
  });

  it("falls back to an estimate without a depart", () => {
    expect(legOf(idx, { ...ship, depart: null }).depart).toBe(900000);
    expect(legOf(idx, { ...ship, depart: "x", progress: 1 }).depart).toBe(1100000);
  });

  it("moves midway", () => {
    const leg = legOf(idx, ship);
    const fix = shipFix(idx, ship, 1000000);
    const f = positionOf(idx, "tamsin", 1000000);
    near(fix.pos, [f[0] + (leg.from[0] + leg.to[0]) / 2, f[1] + (leg.from[1] + leg.to[1]) / 2]);
    expect(fix.kind).toBe("moving");
    expect(fix.place).toBe("gannet");
    expect(fix.heading).toBeCloseTo(Math.atan2(leg.to[1] - leg.from[1], leg.to[0] - leg.from[0]), 9);
  });

  it("clamps before and after the leg", () => {
    const leg = legOf(idx, ship);
    const f = positionOf(idx, "tamsin", 5e6);
    near(shipFix(idx, ship, 5e6).pos, [f[0] + leg.to[0], f[1] + leg.to[1]]);
  });

  it("is at a place when docked or at a point", () => {
    const d = shipFix(idx, { docked: true, location: "orrin_station" }, T);
    expect(d).toMatchObject({ kind: "at", place: "orrin_station" });
    near(d.pos, positionOf(idx, "orrin_station", T));
    const p = shipFix(idx, { docked: false, point: "pt:tamsin:1500:-2000" }, T);
    expect(p.kind).toBe("at");
    near(p.pos, positionOf(idx, "pt:tamsin:1500:-2000", T));
  });

  it("is bound when she can't be placed", () => {
    expect(shipFix(idx, { ...ship, from: undefined }, T)).toEqual({ kind: "bound", place: "gannet" });
    expect(shipFix(idx, { ...ship, destination: "nowhere" }, T).kind).toBe("bound");
    expect(shipFix(idx, { ...ship, from: "nowhere" }, T).kind).toBe("bound");
  });

  it("is searching, never moving", () => {
    expect(shipFix(idx, { ...ship, searching: "gannet" }, T)).toEqual({ kind: "searching", place: "gannet" });
  });

  it("is none with nothing", () => {
    expect(shipFix(idx, null, T)).toEqual({ kind: "none" });
    expect(shipFix(idx, { docked: false }, T)).toEqual({ kind: "none" });
  });
});

describe("systemRadius", () => {
  it("is the edge when there is a mouth", () => expect(systemRadius(idx)).toBe(15000));
  it("is EDGE_KM for a mouth with no edge", () => {
    expect(systemRadius(indexCharts(charts()))).toBe(EDGE_KM);
  });
  it("sums apoapsis through parents without a mouth", () => {
    const i = indexCharts({ ...charts(), places: [{ id: "gannet", kind: "belt", orbit: orbit("tamsin", 2700, 1) }] });
    expect(systemRadius(i)).toBeCloseTo(13200, 6); // orrin: 12000 * 1.1
    const j = indexCharts({ bodies: [{ id: "s", kind: "star" }] });
    expect(Number.isFinite(systemRadius(j))).toBe(true);
  });
});

describe("homeBox", () => {
  it("frames the parent of a place out to its furthest satellite", () => {
    const [x0, y0, x1, y1] = homeBox(idx, { docked: true, location: "gannet" }, T);
    const c = positionOf(idx, "tamsin", T);
    expect((x0 + x1) / 2).toBeCloseTo(c[0], 6);
    expect((y0 + y1) / 2).toBeCloseTo(c[1], 6);
    expect((x1 - x0) / 2).toBeCloseTo(2700 * 1.15, 6);
    expect((y1 - y0) / 2).toBeCloseTo(2700 * 1.15, 6);
  });
  it("does the same while searching", () => {
    const b = homeBox(idx, { searching: "gannet" }, T);
    expect((b[2] - b[0]) / 2).toBeCloseTo(2700 * 1.15, 6);
  });
  it("is the whole system with no ship, or under the star", () => {
    for (const s of [null, { docked: true, location: "mouth" }, { docked: true, location: "nowhere" }]) {
      const b = homeBox(idx, s, T);
      expect(b[0]).toBeCloseTo(-1.08 * 15000, 6);
      expect(b[3]).toBeCloseTo(1.08 * 15000, 6);
    }
  });
  it("frames a trip with padding", () => {
    const ship = { docked: false, from: "tiss", destination: "gannet", progress: 0.5, eta: 100, received: 1000 };
    const t = 1000000;
    const [x0, y0, x1, y1] = homeBox(idx, ship, t);
    const leg = legOf(idx, ship);
    const f = positionOf(idx, "tamsin", t);
    const xs = [f[0] + leg.from[0], f[0] + leg.to[0]];
    const span = Math.max(Math.abs(xs[0] - xs[1]), Math.abs(f[1] + leg.from[1] - (f[1] + leg.to[1])));
    expect(x0).toBeLessThan(Math.min(...xs));
    expect(x1).toBeGreaterThan(Math.max(...xs));
    expect(Math.min(...xs) - x0).toBeGreaterThanOrEqual(0.15 * span - 1e-6);
    expect(y1).toBeGreaterThan(y0);
  });
  it("never throws or returns NaN on junk", () => {
    const b = homeBox(indexCharts(null), { docked: true, location: "x" }, T);
    expect(b.every(Number.isFinite)).toBe(true);
  });
});

describe("fitBox", () => {
  it("matches the aspect, flips y and stays centred", () => {
    const [x, y, vw, vh] = fitBox([-100, 0, 100, 200], 800, 400);
    expect(vw / vh).toBeCloseTo(2, 9);
    expect(vw).toBeGreaterThanOrEqual(1000);
    expect(x + vw / 2).toBeCloseTo(0, 9);
    expect(y + vh / 2).toBeCloseTo(-100, 9);
  });
  it("grows the narrower dimension", () => {
    const [, , vw, vh] = fitBox([-5000, -1000, 5000, 1000], 100, 100);
    expect(vw).toBe(10000);
    expect(vh).toBe(10000);
  });
  it("enforces 1000 km width", () => expect(fitBox([0, 0, 10, 10], 100, 50)[2]).toBe(1000));
});

describe("edgeMarker", () => {
  it("is null inside", () => expect(edgeMarker([0, 0, 100, 100], [50, 50], 5)).toBeNull());
  it("sits on the inset edge", () => {
    expect(edgeMarker([0, 0, 100, 100], [150, 50], 5)).toEqual({ x: 95, y: 50, angle: 0 });
  });
  it("follows the ray to a corner side", () => {
    const m = edgeMarker([0, 0, 100, 100], [150, 150], 0);
    expect(m.x).toBeCloseTo(100, 9);
    expect(m.y).toBeCloseTo(100, 9);
    expect(m.angle).toBeCloseTo(Math.PI / 4, 9);
  });
});

describe("offCentre", () => {
  it("is how far off the centre p is, as a share of the half width or height, the larger", () => {
    const vb = [0, 0, 200, 100];
    expect(offCentre(vb, [100, 50])).toBe(0);
    expect(offCentre(vb, [150, 50])).toBeCloseTo(0.5, 9);
    expect(offCentre(vb, [150, 90])).toBeCloseTo(0.8, 9);
    expect(offCentre(vb, [-100, 50])).toBeCloseTo(2, 9);
  });
  it("agrees with follows", () => {
    const vb = [0, 0, 100, 100];
    expect(follows(vb, [68, 50])).toBe(offCentre(vb, [68, 50]) > 0.35);
  });
});

describe("follows", () => {
  it("is true past the margin", () => {
    const vb = [0, 0, 100, 100];
    expect(follows(vb, [50, 50])).toBe(false);
    expect(follows(vb, [50 + 17, 50])).toBe(false);
    expect(follows(vb, [50 + 18, 50])).toBe(true);
    expect(follows(vb, [50, 50 - 18])).toBe(true);
    expect(follows(vb, [60, 50], 0.1)).toBe(true);
  });
});

describe("folded", () => {
  it("is true when the orbit is under 8 px across", () => {
    expect(folded(idx, "tiss", 1000)).toBe(true); // 1800 / 1000 < 8
    expect(folded(idx, "tiss", 100)).toBe(false);
    expect(folded(idx, "nowhere", 1)).toBe(false);
  });
});

describe("scaleKm", () => {
  it("picks 1, 2 or 5 x 10^n", () => {
    expect(scaleKm(10, 120)).toBe(1000);
    expect(scaleKm(37, 120)).toBe(2000);
    expect(scaleKm(50, 120)).toBe(5000);
    expect(scaleKm(0.01, 120)).toBe(1);
  });
});

describe("ago", () => {
  it("formats two units", () => {
    expect(ago(187200000)).toBe("2d 4h");
    expect(ago(3 * 3600000 + 2 * 60000)).toBe("3h 2m");
    expect(ago(12 * 60000)).toBe("12m");
    expect(ago(5000)).toBe("0m");
    expect(ago(-1)).toBe("0m");
    expect(ago(NaN)).toBe("0m");
  });
});

describe("mouthStar", () => {
  it("strips the dressing", () => {
    expect(mouthStar("the Maelor lane mouth")).toBe("Maelor");
    expect(mouthStar("The Maelor Lane Mouth")).toBe("Maelor");
    expect(mouthStar("Somewhere")).toBe("Somewhere");
    expect(mouthStar(null)).toBe("");
  });
});

describe("followStep", () => {
  const vb = [0, 0, 100, 100]; // centre (50, 50)

  it("never moves a view you've panned or zoomed, however far she drifts", () => {
    expect(followStep(vb, [99, 50], 0.4, true)).toEqual({ vb, margin: 0.4 });
    expect(followStep(vb, [500, 500], null, true)).toEqual({ vb, margin: null });
  });

  it("re-centres an untouched view on her once she passes the margin, keeping the zoom", () => {
    expect(followStep(vb, [90, 50], 0.35, false)).toEqual({ vb: [40, 0, 100, 100], margin: 0.35 });
  });

  it("holds an untouched view while she's within the margin, tightening it as she comes back", () => {
    expect(followStep(vb, [70, 50], 0.6, false)).toEqual({ vb, margin: 0.4 });
    expect(followStep(vb, [55, 50], 0.6, false)).toEqual({ vb, margin: 0.35 });
  });

  it("takes where ⌂ left her as the margin", () => {
    const step = followStep(vb, [80, 50], null, false);
    expect(step.vb).toEqual(vb);
    expect(step.margin).toBeCloseTo(0.6, 9);
  });
});

describe("markOf", () => {
  it("draws each known kind as itself", () => {
    for (const k of ["star", "planet", "station", "belt", "mouth"]) expect(markOf(k)).toBe(k);
  });

  it("draws a kind it doesn't know (a port, say) as a station, never as nothing", () => {
    expect(markOf("port")).toBe("station");
    expect(markOf(undefined)).toBe("station");
    expect(markOf(42)).toBe("station");
  });
});

describe("daylit", () => {
  // Tamsin at [6000, 0] at the epoch; a port on its 400 km surface turning once in 4 hours.
  const port = (phase) =>
    indexCharts({
      epoch: 0,
      bodies: [
        { id: "senara", kind: "star" },
        { id: "tamsin", kind: "planet", radius: 400, orbit: orbit("senara", 6000, 259200) },
        { id: "zennor", kind: "port", orbit: orbit("tamsin", 400, 14400, { phase }) },
      ],
    });

  it("is day with the town facing the star", () => {
    expect(daylit(port(180), "zennor", 0)).toBe(true);
  });

  it("is night with the town facing away", () => {
    expect(daylit(port(0), "zennor", 0)).toBe(false);
  });

  it("turns with the planet's day", () => {
    expect(daylit(port(0), "zennor", 7200 * 1000)).toBe(true);
    expect(daylit(port(0), "zennor", 14400 * 1000)).toBe(false);
  });

  it("is day just past the terminator and night just short of it", () => {
    expect(daylit(port(95), "zennor", 0)).toBe(true);
    expect(daylit(port(85), "zennor", 0)).toBe(false);
  });

  it("is null when the charts can't place it", () => {
    expect(daylit(port(0), "nowhere", 0)).toBe(null);
    expect(daylit(indexCharts({ bodies: [{ id: "zennor", kind: "port", orbit: orbit("tamsin", 400, 14400) }] }), "zennor", 0)).toBe(null);
  });
});
