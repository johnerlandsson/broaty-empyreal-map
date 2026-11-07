import { describe, expect, it } from "vitest";
import PORTS from "../data/sky.js";
import cases from "../../dev/sky-cases.json" with { type: "json" };
import { indexCharts } from "./orbits.js";
import { fillWords, groundSky, isDark, isUp, POINTS, skyAt, skyScene, sunAlt, sunBand, sunPhase } from "./sky.js";

// The game's own sky over Zennor and Dolcoath, recorded by dev/sky-cases.ts from ground.ts
// (empyreal 6441e998): its Space.Charts, and the text either side of every change over a year of
// each port's planet, a case [tick, its text's index in texts].
const idx = indexCharts(cases.charts);
const at = (tick, ms = 0) => idx.epoch + tick * 1000 + ms;
const casesOf = (port) => cases.ports[port].cases.map(([tick, i]) => ({ tick, text: cases.texts[i] }));
const STATION = { zennor: "tiss", dolcoath: "orrin_station" };
const OTHER = { zennor: "orrin", dolcoath: "tamsin" };

it("records both ports, each over its planet's year", () => {
  expect(Object.keys(cases.ports)).toEqual(["zennor", "dolcoath"]);
  expect(cases.ports.zennor.year).toBe(2592000);
  expect(cases.ports.dolcoath.year).toBeGreaterThan(7.3e6);
  for (const port of ["zennor", "dolcoath"]) expect(cases.ports[port].cases.at(-1)[0]).toBeGreaterThan(cases.ports[port].year - 3600);
});

describe.each(["zennor", "dolcoath"])("groundSky over %s against the game", (port) => {
  const all = casesOf(port);

  it("says what the game says, at every change over a year", () => {
    for (const c of all) expect(groundSky(idx, port, at(c.tick))?.text, `tick ${c.tick}`).toBe(c.text);
  });

  it("counts whole ticks: 999 ms into a tick is still that tick", () => {
    for (const c of all) expect(groundSky(idx, port, at(c.tick, 999))?.text, `tick ${c.tick}`).toBe(c.text);
  });

  it("says each of the port's own sky words, filled in", () => {
    const words = PORTS[port].words;
    const said = new Set(all.map((c) => groundSky(idx, port, at(c.tick)).sun.line));
    for (const [key, line] of Object.entries(words)) {
      const pattern = new RegExp(`^${line.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\w+)\}/g, ".+?")}$`);
      expect([...said].some((l) => pattern.test(l)), key).toBe(true);
    }
  });

  it("puts the sun where the game's words do: dawn as it comes up, dusk as it goes down", () => {
    const want = { overhead: "day", "well up": "day", low: "day", night: "night" };
    for (const c of all) {
      const { sun, band } = groundSky(idx, port, at(c.tick));
      const paling = fillWords(PORTS[port].words.paling, { star: sun.name, dir: sun.dir });
      const rises = fillWords(PORTS[port].words.rises, { star: sun.name, dir: sun.dir });
      const phase = want[band] ?? (c.text.startsWith(paling) || c.text.startsWith(rises) ? "dawn" : "dusk");
      expect(sunPhase(sun.alt, sun.rising), `tick ${c.tick}: ${c.text}`).toBe(phase);
    }
  });

  it("names the sun's point and the one opposite on the compass", () => {
    for (const c of all) {
      const { sun } = groundSky(idx, port, at(c.tick));
      expect(POINTS.indexOf(sun.away)).toBe((POINTS.indexOf(sun.dir) + 4) % 8);
      expect(sun.east).toBe(sun.e > 0);
    }
  });

  it("has sunAlt agree with the sky", () => {
    for (const c of all) expect(sunAlt(idx, port, at(c.tick))).toBe(groundSky(idx, port, at(c.tick)).sun.alt);
  });

  it("gives each sentence as its body's line, and the text as them joined", () => {
    for (const c of all) {
      const sky = groundSky(idx, port, at(c.tick));
      expect([sky.sun.line, ...sky.bodies.map((b) => b.line)].join(" ")).toBe(c.text);
    }
  });

  it("sees the planet's station cross, and the other planet at night", () => {
    const skies = all.map((c) => groundSky(idx, port, at(c.tick)));
    expect(skies.some((s) => s.bodies.some((b) => b.id === STATION[port] && b.kind === "station"))).toBe(true);
    expect(skies.some((s) => s.bodies.some((b) => b.id === OTHER[port] && b.kind === "planet"))).toBe(true);
  });
});

describe("groundSky for any port", () => {
  it("names T.I.S.S. by its short name", () => {
    const sky = casesOf("zennor").map((c) => groundSky(idx, "zennor", at(c.tick))).find((s) => s.bodies.some((b) => b.id === "tiss"));
    expect(sky.bodies).toContainEqual(expect.objectContaining({ id: "tiss", kind: "station", name: "T.I.S.S." }));
  });

  it("says Zennor's and Dolcoath's skies in their own words", () => {
    expect(PORTS.zennor.words.night).not.toBe(PORTS.dolcoath.words.night);
    const night = (port) => casesOf(port).find((c) => groundSky(idx, port, at(c.tick)).band === "night");
    expect(groundSky(idx, "zennor", at(night("zennor").tick)).sun.line).toBe(PORTS.zennor.words.night);
    expect(groundSky(idx, "dolcoath", at(night("dolcoath").tick)).sun.line).toBe(PORTS.dolcoath.words.night);
  });

  it("returns null for charts without the port", () => {
    const without = { ...cases.charts, bodies: cases.charts.bodies.filter((b) => b.id !== "zennor"), places: [] };
    expect(groundSky(indexCharts(without), "zennor", at(0))).toBeNull();
    expect(groundSky(indexCharts(null), "zennor", 0)).toBeNull();
    expect(groundSky(idx, "nowhere", at(0))).toBeNull();
    expect(sunAlt(idx, "nowhere", at(0))).toBeNull();
  });

  it("returns null for a port whose planet the charts can't place", () => {
    const without = { ...cases.charts, bodies: cases.charts.bodies.filter((b) => b.id !== "tamsin") };
    expect(groundSky(indexCharts(without), "zennor", at(0))).toBeNull();
  });

  it("returns null for a port data/sky.js has no sky for, or puts on another planet", () => {
    expect(groundSky(idx, "zennor", at(0), { ports: {} })).toBeNull();
    expect(groundSky(idx, "zennor", at(0), { ports: { zennor: { ...PORTS.zennor, planet: "orrin" } } })).toBeNull();
    expect(sunAlt(idx, "zennor", at(0), { ports: {} })).toBeNull();
  });

  it("lists other stations of the planet by chart name, never the port", () => {
    const tiss = cases.charts.bodies.find((b) => b.id === "tiss");
    const pier = { id: "pier", name: "Pier", kind: "station", orbit: { ...tiss.orbit, phase: tiss.orbit.phase + 180 } };
    const more = indexCharts({ ...cases.charts, places: [...cases.charts.places, pier] });
    const skies = casesOf("zennor").map((c) => groundSky(more, "zennor", at(c.tick)));
    expect(skies.some((s) => s.bodies.some((b) => b.id === "pier" && b.name === "Pier" && b.line.startsWith("Pier ")))).toBe(true);
    expect(skies.every((s) => s.bodies.every((b) => b.id !== "zennor"))).toBe(true);
  });
});

// A hand-placed sky: a star at the origin, a planet a billion km out that doesn't move in a
// minute, and a port 1 km up on it, on the equator of a planet with no tilt, in Zennor's words,
// turned so its star stands `alt` degrees up in the east (rising, the morning) or the west (setting).
const STUB = { x: { planet: "p", tilt: 0, equinox: 0, latitude: 0, words: PORTS.zennor.words } };
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
const sunAt = (alt, east = true) => groundSky(stub(alt, east), "x", 0, { ports: STUB });
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

// Each of the game's skies over a year at each port, with its scene.
const skies = ["zennor", "dolcoath"].flatMap((port) => casesOf(port).map((c) => groundSky(idx, port, at(c.tick))));
const lightness = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
};

describe("skyAt", () => {
  it("puts a station on the dome's arc, from the western foot through overhead to the eastern", () => {
    const near = (a, b) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));
    near(skyAt({ alt: 0, east: false }), [-1, 0]);
    near(skyAt({ alt: 30, east: false }), [-Math.sqrt(3) / 2, 0.5]);
    near(skyAt({ alt: 90, east: true }), [0, 1]);
    near(skyAt({ alt: 30, east: true }), [Math.sqrt(3) / 2, 0.5]);
    near(skyAt({ alt: 0, east: true }), [1, 0]);
  });

  it("puts the star and the planets by their east-west part and their height, dropping north and south", () => {
    const winterNoon = skyAt({ alt: 30, e: 0, n: -0.87 });
    expect(winterNoon[0]).toBe(0);
    expect(winterNoon[1]).toBeCloseTo(0.5, 9);
    expect(skyAt({ alt: 0, e: 0.9, n: 0.44 })).toEqual([0.9, 0]);
  });

  it("puts Zennor's noon sun due south in the dome's middle, higher in summer than winter", () => {
    const noon = (tick) => skyScene(groundSky(idx, "zennor", at(tick))).marks.find((m) => m.look === "sun");
    const summer = noon(639000);
    const winter = noon(1935000);
    expect(Math.abs(summer.at[0])).toBeLessThan(0.01);
    expect(Math.abs(winter.at[0])).toBeLessThan(0.01);
    expect(summer.at[1]).toBeCloseTo(Math.sin((70 * Math.PI) / 180), 2);
    expect(winter.at[1]).toBeCloseTo(0.5, 2);
    expect(summer.line).toMatch(/stands high overhead/);
    expect(winter.line).toBe("Senara is well up in the south of a pale, dusty sky.");
  });
});

describe("skyScene", () => {
  it("puts the sun on the dome only when it's up", () => {
    for (const sky of skies) {
      const suns = skyScene(sky).marks.filter((m) => m.look === "sun");
      if (sky.band === "night" || sky.band === "twilight") expect(suns).toEqual([]);
      else expect(suns).toEqual([expect.objectContaining({ id: "senara", name: "Senara", at: skyAt(sky.sun), line: sky.sun.line })]);
    }
  });

  it("steps the sky with the game's band", () => {
    const by = (band, rising) => skies.find((s) => s.band === band && (rising === undefined || s.sun.rising === rising));
    expect(skyScene(by("night"))).toMatchObject({ tint: null, stars: "all", glow: null });
    const dusk = by("twilight", false);
    expect(skyScene(dusk)).toMatchObject({ tint: null, stars: "few", glow: { east: dusk.sun.east, x: dusk.sun.e, kind: "dusk" } });
    const dawn = by("twilight", true);
    expect(skyScene(dawn)).toMatchObject({ tint: null, stars: "none", glow: { east: dawn.sun.east, x: dawn.sun.e, kind: "dawn" } });
    const tints = ["up", "low", "well up", "overhead"].map((b) => skyScene(by(b)));
    for (const t of tints) expect(t).toMatchObject({ stars: "none", glow: null });
    const l = tints.map((t) => lightness(t.tint));
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeGreaterThan(l[i - 1]);
  });

  it("is the same scene all through a band, the glow moving only with the sun", () => {
    const kept = (sc) => ({ tint: sc.tint, stars: sc.stars, glow: sc.glow && { east: sc.glow.east, kind: sc.glow.kind } });
    for (const sky of skies) {
      const other = skyScene(skies.find((s) => s.band === sky.band && s.sun.rising === sky.sun.rising && s.sun.east === sky.sun.east));
      expect(kept(skyScene(sky))).toEqual(kept(other));
      if (sky.band === "twilight") expect(skyScene(sky).glow.x).toBe(sky.sun.e);
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
      for (const b of sky.bodies) expect(s.marks.find((m) => m.id === b.id).at).toEqual(skyAt(b));
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
