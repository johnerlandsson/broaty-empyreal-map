import { describe, expect, it } from "vitest";
import cases from "../../dev/sky-cases.json" with { type: "json" };
import { daylit, indexCharts } from "./orbits.js";
import { groundSky, isDark, isUp, skyAngle, skyScene, sunBand, sunPhase } from "./sky.js";

// The game's own sky over Zennor, recorded by dev/sky-cases.ts from ground.ts (empyreal 7492196):
// its Space.Charts, and the text either side of every change over a Tamsin year.
const idx = indexCharts(cases.charts);
const at = (tick, ms = 0) => idx.epoch + tick * 1000 + ms;

describe("groundSky against the game", () => {
  it("says what the game says, at every change over a year", () => {
    for (const c of cases.cases) expect(groundSky(idx, "zennor", at(c.tick))?.text, `tick ${c.tick}`).toBe(c.text);
  });

  it("counts whole ticks: 999 ms into a tick is still that tick", () => {
    for (const c of cases.cases) expect(groundSky(idx, "zennor", at(c.tick, 999))?.text, `tick ${c.tick}`).toBe(c.text);
  });

  it("puts the sun where the game's words do: dawn as it comes up, dusk as it goes down", () => {
    const words = { overhead: "day", "well up": "day", low: "day", night: "night" };
    for (const c of cases.cases) {
      const { sun, band } = groundSky(idx, "zennor", at(c.tick));
      const want = words[band] ?? (/has just come up|is paling/.test(c.text) ? "dawn" : "dusk");
      expect(sunPhase(sun.alt, sun.rising), `tick ${c.tick}: ${c.text}`).toBe(want);
    }
  });

  it("agrees with daylit()", () => {
    for (const c of cases.cases) expect(groundSky(idx, "zennor", at(c.tick)).sun.alt > 0).toBe(daylit(idx, "zennor", at(c.tick)));
  });

  it("names T.I.S.S. by its short name", () => {
    const sky = groundSky(idx, "zennor", at(cases.cases[0].tick));
    expect(sky.bodies).toContainEqual(expect.objectContaining({ id: "tiss", kind: "station", name: "T.I.S.S." }));
  });

  it("gives each sentence as its body's line, and the text as them joined", () => {
    for (const c of cases.cases) {
      const sky = groundSky(idx, "zennor", at(c.tick));
      expect([sky.sun.line, ...sky.bodies.map((b) => b.line)].join(" ")).toBe(c.text);
    }
  });

  it("returns null for charts without the port", () => {
    const without = { ...cases.charts, bodies: cases.charts.bodies.filter((b) => b.id !== "zennor"), places: [] };
    expect(groundSky(indexCharts(without), "zennor", at(0))).toBeNull();
    expect(groundSky(indexCharts(null), "zennor", 0)).toBeNull();
    expect(groundSky(idx, "nowhere", at(0))).toBeNull();
  });

  it("returns null for a port whose planet the charts can't place", () => {
    const without = { ...cases.charts, bodies: cases.charts.bodies.filter((b) => b.id !== "tamsin") };
    expect(groundSky(indexCharts(without), "zennor", at(0))).toBeNull();
  });

  it("lists other stations of the planet by chart name, never the port", () => {
    const tiss = cases.charts.bodies.find((b) => b.id === "tiss");
    const pier = { id: "pier", name: "Pier", kind: "station", orbit: { ...tiss.orbit, phase: tiss.orbit.phase + 180 } };
    const more = indexCharts({ ...cases.charts, places: [...cases.charts.places, pier] });
    const skies = cases.cases.map((c) => groundSky(more, "zennor", at(c.tick)));
    expect(skies.some((s) => s.bodies.some((b) => b.id === "pier" && b.name === "Pier" && b.line.startsWith("Pier ")))).toBe(true);
    expect(skies.every((s) => s.bodies.every((b) => b.id !== "zennor"))).toBe(true);
  });
});

// A hand-placed sky: a star at the origin, a planet a billion km out that doesn't move in a
// minute, and a port 1 km up on it, turned so its star stands `alt` degrees up in the east
// (rising, the morning) or the west (setting).
function stub(alt, east) {
  return indexCharts({
    epoch: 0,
    bodies: [
      { id: "s", name: "Sun", kind: "star" },
      { id: "p", name: "P", kind: "planet", orbit: { parent: "s", a: 1e9, period: 1e15 } },
      { id: "x", name: "X", kind: "port", orbit: { parent: "p", a: 1, period: 14400, phase: east ? 90 + alt : 270 - alt } },
    ],
    places: [],
  });
}
const sunAt = (alt, east = true) => groundSky(stub(alt, east), "x", 0);
const E = 0.01; // well clear of the stub's rounding (about 1e-7 degrees)

describe("groundSky's thresholds, as ground.ts's", () => {
  it("places the stub's star where asked", () => {
    expect(sunAt(25).sun).toMatchObject({ east: true, rising: true });
    expect(sunAt(25).sun.alt).toBeCloseTo(25, 6);
    expect(sunAt(25, false).sun).toMatchObject({ east: false, rising: false });
  });

  it("is overhead from 60", () => {
    expect(sunAt(60 + E).band).toBe("overhead");
    expect(sunAt(60 + E).sun.line).toBe("Sun stands high overhead, small and white, and the shadows are short.");
    expect(sunAt(60 - E).band).toBe("well up");
  });

  it("is well up from 30", () => {
    expect(sunAt(30 + E).sun.line).toBe("Sun is well up in the east of a pale, dusty sky.");
    expect(sunAt(30 - E).band).toBe("low");
  });

  it("is low from 10", () => {
    expect(sunAt(10 + E, false).sun.line).toBe("Sun is low in the west, and the shadows reach long to the east.");
    expect(sunAt(10 - E).band).toBe("up");
  });

  it("is just up or going down from 0", () => {
    expect(sunAt(E).sun.line).toBe("Sun has just come up over the eastern horizon, and everything it touches is gold.");
    expect(sunAt(E, false).sun.line).toBe("Sun is going down in the west, reddened by the dust.");
    expect(sunAt(-E).band).toBe("twilight");
  });

  it("is dawn or dusk down to -10, and night below", () => {
    expect(sunAt(-10 + E).sun.line).toBe("The sky is paling in the east: Sun will be up soon.");
    expect(sunAt(-10 + E, false).sun.line).toBe("Dusk: the west still glows where Sun went down, and the first stars are out.");
    expect(sunAt(-10 - E).band).toBe("night");
    expect(sunAt(-10 - E).sun.line).toBe("Night: the sky is black and crowded with stars.");
  });

  it("is dark below -5", () => {
    expect(sunAt(-5 + E).dark).toBe(false);
    expect(sunAt(-5 - E).dark).toBe(true);
  });
});

// Each of the game's skies over a year, with its scene.
const skies = cases.cases.map((c) => groundSky(idx, "zennor", at(c.tick)));
const lightness = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
};

describe("skyAngle", () => {
  it("runs from the western foot through overhead to the eastern", () => {
    expect(skyAngle(0, false)).toBe(0);
    expect(skyAngle(30, false)).toBe(30);
    expect(skyAngle(90, true)).toBe(90);
    expect(skyAngle(30, true)).toBe(150);
    expect(skyAngle(0, true)).toBe(180);
  });
});

describe("skyScene", () => {
  it("puts the sun on the dome only when it's up", () => {
    for (const sky of skies) {
      const suns = skyScene(sky).marks.filter((m) => m.look === "sun");
      if (sky.band === "night" || sky.band === "twilight") expect(suns).toEqual([]);
      else expect(suns).toEqual([expect.objectContaining({ id: "senara", name: "Senara", angle: skyAngle(sky.sun.alt, sky.sun.east), line: sky.sun.line })]);
    }
  });

  it("steps the sky with the game's band", () => {
    const by = (band, rising) => skies.find((s) => s.band === band && (rising === undefined || s.sun.rising === rising));
    expect(skyScene(by("night"))).toMatchObject({ tint: null, stars: "all", glow: null });
    const dusk = by("twilight", false);
    expect(skyScene(dusk)).toMatchObject({ tint: null, stars: "few", glow: { east: dusk.sun.east, kind: "dusk" } });
    const dawn = by("twilight", true);
    expect(skyScene(dawn)).toMatchObject({ tint: null, stars: "none", glow: { east: dawn.sun.east, kind: "dawn" } });
    const tints = ["up", "low", "well up", "overhead"].map((b) => skyScene(by(b)));
    for (const t of tints) expect(t).toMatchObject({ stars: "none", glow: null });
    const l = tints.map((t) => lightness(t.tint));
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeGreaterThan(l[i - 1]);
  });

  it("is the same scene all through a band", () => {
    for (const sky of skies) {
      const { tint, stars, glow } = skyScene(sky);
      const other = skyScene(skies.find((s) => s.band === sky.band && s.sun.rising === sky.sun.rising && s.sun.east === sky.sun.east));
      expect({ tint, stars, glow }).toEqual({ tint: other.tint, stars: other.stars, glow: other.glow });
    }
  });

  it("draws a station as a spark when dark, a fleck when not", () => {
    for (const sky of skies)
      for (const m of skyScene(sky).marks.filter((m) => m.id === "tiss")) expect(m.look).toBe(sky.dark ? "spark" : "fleck");
    expect(skies.some((s) => s.dark && s.bodies.some((b) => b.id === "tiss"))).toBe(true);
    expect(skies.some((s) => !s.dark && s.bodies.some((b) => b.id === "tiss"))).toBe(true);
  });

  it("draws a planet as gold", () => {
    const marks = skies.flatMap((s) => skyScene(s).marks.filter((m) => m.id === "orrin"));
    expect(marks.length).toBeGreaterThan(0);
    for (const m of marks) expect(m).toMatchObject({ look: "gold", name: "Orrin" });
  });

  it("marks exactly what the words list, where they put it", () => {
    for (const sky of skies) {
      const s = skyScene(sky);
      expect(s.marks.map((m) => m.line)).toEqual([...(sky.sun.alt >= 0 ? [sky.sun.line] : []), ...sky.bodies.map((b) => b.line)]);
      for (const b of sky.bodies) expect(s.marks.find((m) => m.id === b.id).angle).toBe(skyAngle(b.alt, b.east));
    }
  });

  it("hovers the empty sky with the sun's line", () => {
    for (const sky of skies) expect(skyScene(sky).hover).toBe(sky.sun.line);
  });
});

describe("the thresholds exactly on their lines, as ground.ts compares them", () => {
  it("bands Senara by >= 60, >= 30, >= 10, >= 0 and > -10", () => {
    expect(sunBand(60)).toBe("overhead");
    expect(sunBand(30)).toBe("well up");
    expect(sunBand(10)).toBe("low");
    expect(sunBand(0)).toBe("up");
    expect(sunBand(-10)).toBe("night");
    expect(sunBand(-9.999)).toBe("twilight");
  });

  it("is day from 10, night at -10, and dawn or dusk between by which way it's going", () => {
    expect(sunPhase(10, true)).toBe("day");
    expect(sunPhase(9.999, true)).toBe("dawn");
    expect(sunPhase(9.999, false)).toBe("dusk");
    expect(sunPhase(-9.999, true)).toBe("dawn");
    expect(sunPhase(-9.999, false)).toBe("dusk");
    expect(sunPhase(-10, false)).toBe("night");
  });

  it("is dark below -5, not at it", () => {
    expect(isDark(-5)).toBe(false);
    expect(isDark(-5.001)).toBe(true);
  });

  it("shows a station or planet above 0, not at it", () => {
    expect(isUp(0)).toBe(false);
    expect(isUp(0.001)).toBe(true);
  });
});
