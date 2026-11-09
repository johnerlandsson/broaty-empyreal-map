// Records the game's own sky over each port for the plugin's tests (ui/lib/sky.test.js): the
// Space.Charts the game sends a character in Senara's system, and, for Zennor and Dolcoath, where
// ground.ts puts things either side of every tick where that changes over one year of the port's
// planet (its orbit's period, as the game works it out), so every band of Senara through every
// season, each point it rises and sets on, every pass of a station and the other planets' risings
// are in it. Runs the game itself from its source; nothing in the game repo changes.
//
// What's recorded is what the plugin still says, not the game's prose: the game's sky now says the
// weather (weather.ts, weather-words.ts), which is simulated per port, never saved and sent in no
// GMCP package, so the plugin can't say it. This runs groundSky with the weather stubbed out, as
// the game says it with none, and reads each sentence back into facts: Senara's band, whether it's
// climbing (its height a minute on, as ground.ts's `rising`), its point and the one opposite where
// the words name them, its colour where they name it, and each station and planet that's up, by
// name, how and where. A sentence that doesn't read as the port's words or a body's line stops it.
// A set of facts said more than once is kept once, in `facts`, and a case is [tick, its index].
//
//   node dev/sky-cases.ts > dev/sky-cases.json
//
// The game wants Node 24.7 or later (`npx -y node@24 dev/sky-cases.ts` where node is older).
// EMPYREAL=<path> runs a checkout other than ~/dev/empyreal (it needs its node_modules installed);
// EMPYREAL_COMMIT=<sha> names its commit when it isn't a git checkout (an exported copy).

import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.env.EMPYREAL ?? path.join(os.homedir(), "dev/empyreal");
const from = (rel: string) => import(pathToFileURL(path.join(root, rel)).href);

const { TestWorld } = await from("tests/harness.ts");
const { groundSky, sunAltitude } = await from("packages/game/src/systems/ground.ts");
const { portWords } = await from("packages/game/src/systems/port-words.ts");

const PORTS = ["zennor", "dolcoath"];

const w = new TestWorld();
const client = await w.newMiner("sky", "Lark");
const charts = client.gmcp.filter((f: { pkg: string }) => f.pkg === "Space.Charts").at(-1)?.data;
if (!charts) throw new Error("no Space.Charts sent");
// No weather: the sky as the game says it with none, the star's line in the port's own words.
w.game.weather.shown = () => undefined;

const o = w.game.space.orbits;

/** ground.ts's bands, by its comparisons, and the word each says. */
const bandOf = (alt: number) =>
  alt >= 60 ? "overhead" : alt >= 30 ? "well up" : alt >= 10 ? "low" : alt >= 0 ? "up" : alt > -10 ? "twilight" : "night";
const WORD: Record<string, (rising: boolean) => string> = {
  overhead: () => "high",
  "well up": () => "up",
  low: () => "low",
  up: (r) => (r ? "rises" : "sets"),
  twilight: (r) => (r ? "paling" : "dusk"),
  night: () => "night",
};

const escape = (s: string) => s.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
/** A sky word as a pattern that reads its {dir}, {away} and {colour} back, the rest as written. */
function pattern(line: string, star: string): RegExp {
  const seen = new Set<string>();
  const src = line
    .split(/(\{\w+\})/)
    .map((part) => {
      const k = /^\{(\w+)\}$/.exec(part)?.[1];
      if (!k) return escape(part);
      if (k === "star") return escape(star);
      if (k === "haze" || k === "reddened") return "[^.]*?";
      if (seen.has(k)) return `\\k<${k}>`;
      seen.add(k);
      return k === "colour" ? `(?<colour>[a-z -]+?)` : `(?<${k}>[a-z-]+)`;
    })
    .join("");
  return new RegExp(`^${src}(?: |$)`);
}

/** The stations' and planets' lines, as ground.ts says them. */
const LOOK = "(?:a bright, steady spark|a pale fleck against the sky)";
const BODY = new RegExp(
  `^(?<name>.+?) is (?:passing overhead, ${LOOK}, heading (?<heading>east|west)|climbing up out of the (?<climbing>east|west), ${LOOK}|sinking toward the (?<sinking>east|west), ${LOOK}|a steady golden star (?:(?<high>high overhead)|in the (?<dir>[a-z-]+)))\\.(?: |$)`,
);

type Facts = {
  band: string;
  rising: boolean;
  dir: string | null;
  away: string | null;
  colour: string | null;
  stations: [string, string, string][];
  planets: [string, string][];
};

function factsOf(port: string, tick: number): Facts {
  const text: string = groundSky(w.game, port, tick);
  const alt: number = sunAltitude(w.game, port, tick);
  const rising = sunAltitude(w.game, port, tick + 60) > alt;
  const band = bandOf(alt);
  const star = o.body(o.starOf(port))!.name;
  const words = portWords(w.game.space.station(port)!).sky;
  const m = pattern(words[WORD[band](rising)], star).exec(text);
  if (!m) throw new Error(`${port} tick ${tick}: "${text}" isn't its ${WORD[band](rising)} words`);
  const g = m.groups ?? {};
  const facts: Facts = { band, rising, dir: g.dir ?? null, away: g.away ?? null, colour: g.colour ?? null, stations: [], planets: [] };
  let rest = text.slice(m[0].length);
  while (rest) {
    const b = BODY.exec(rest);
    if (!b) throw new Error(`${port} tick ${tick}: can't read "${rest}"`);
    const v = b.groups!;
    if (v.heading) facts.stations.push([v.name, "overhead", v.heading]);
    else if (v.climbing) facts.stations.push([v.name, "climbing", v.climbing]);
    else if (v.sinking) facts.stations.push([v.name, "sinking", v.sinking]);
    else facts.planets.push([v.name, v.high ? "overhead" : v.dir]);
    rest = rest.slice(b[0].length);
  }
  return facts;
}

const facts: Facts[] = [];
const factIndex = new Map<string, number>();
const indexOf = (f: Facts) => {
  const key = JSON.stringify(f);
  if (!factIndex.has(key)) {
    factIndex.set(key, facts.length);
    facts.push(f);
  }
  return factIndex.get(key)!;
};
const ports: Record<string, { year: number; colour: string; cases: [number, number][] }> = {};
for (const port of PORTS) {
  const year = Math.ceil(o.period(o.body(o.body(port)!.orbit!.parent)!.orbit!));
  const ticks = new Set<number>([0]);
  const colours = new Set<string>();
  let prev = JSON.stringify(factsOf(port, 0));
  for (let tick = 1; tick <= year; tick++) {
    const f = factsOf(port, tick);
    if (f.colour) colours.add(f.colour);
    const key = JSON.stringify(f);
    if (key !== prev) {
      ticks.add(tick - 1);
      ticks.add(tick);
    }
    prev = key;
  }
  if (colours.size !== 1) throw new Error(`${port}: its words name the star ${[...colours].join(", ") || "no"} colour`);
  const cases = [...ticks].sort((a, b) => a - b).map((tick): [number, number] => [tick, indexOf(factsOf(port, tick))]);
  ports[port] = { year, colour: [...colours][0]!, cases };
}
const empyreal =
  process.env.EMPYREAL_COMMIT ?? execFileSync("git", ["-C", root, "rev-parse", "--short", "HEAD"]).toString().trim();

process.stdout.write(JSON.stringify({ empyreal, charts, facts, ports }) + "\n");
process.exit(0);
