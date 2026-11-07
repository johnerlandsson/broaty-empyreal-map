// Records the game's own sky over each port for the plugin's tests (ui/lib/sky.test.js): the
// Space.Charts the game sends a character in Senara's system, and, for Zennor and Dolcoath,
// ground.ts's groundSky text either side of every tick where it changes over one year of the
// port's planet (its orbit's period, as the game works it out), so every band of Senara through
// every season, each point it rises and sets on, every pass of a station and the other planet's
// risings are in it. A text said more than once is kept once, in `texts`, and a case is
// [tick, its text's index]. Runs the game itself from its source; nothing in the game repo changes.
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
const { groundSky } = await from("packages/game/src/systems/ground.ts");

const PORTS = ["zennor", "dolcoath"];

const w = new TestWorld();
const client = await w.newMiner("sky", "Lark");
const charts = client.gmcp.filter((f: { pkg: string }) => f.pkg === "Space.Charts").at(-1)?.data;
if (!charts) throw new Error("no Space.Charts sent");

const o = w.game.space.orbits;
const texts: string[] = [];
const textIndex = new Map<string, number>();
const indexOf = (text: string) => {
  if (!textIndex.has(text)) {
    textIndex.set(text, texts.length);
    texts.push(text);
  }
  return textIndex.get(text)!;
};
const ports: Record<string, { year: number; cases: [number, number][] }> = {};
for (const port of PORTS) {
  const year = Math.ceil(o.period(o.body(o.body(port)!.orbit!.parent)!.orbit!));
  const ticks = new Set<number>([0]);
  let prev = groundSky(w.game, port, 0);
  for (let tick = 1; tick <= year; tick++) {
    const text = groundSky(w.game, port, tick);
    if (text !== prev) {
      ticks.add(tick - 1);
      ticks.add(tick);
    }
    prev = text;
  }
  const cases = [...ticks].sort((a, b) => a - b).map((tick): [number, number] => [tick, indexOf(groundSky(w.game, port, tick))]);
  ports[port] = { year, cases };
}
const empyreal =
  process.env.EMPYREAL_COMMIT ?? execFileSync("git", ["-C", root, "rev-parse", "--short", "HEAD"]).toString().trim();

process.stdout.write(JSON.stringify({ empyreal, charts, texts, ports }) + "\n");
process.exit(0);
