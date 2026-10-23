// Records the game's own sky over Zennor for the plugin's tests (ui/lib/sky.test.js): the
// Space.Charts the game sends a character in Senara's system, and ground.ts's groundSky text
// either side of every tick where it changes over one Tamsin year (259,200 s), so every band
// of Senara, every T.I.S.S. pass and Orrin's risings are in it. Runs the game itself from its
// source; nothing in the game repo changes.
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

const PORT = "zennor";
const YEAR = 259200;

const w = new TestWorld();
const client = await w.newMiner("sky", "Lark");
const charts = client.gmcp.filter((f: { pkg: string }) => f.pkg === "Space.Charts").at(-1)?.data;
if (!charts) throw new Error("no Space.Charts sent");

const ticks = new Set<number>([0]);
let prev = groundSky(w.game, PORT, 0);
for (let tick = 1; tick <= YEAR; tick++) {
  const text = groundSky(w.game, PORT, tick);
  if (text !== prev) {
    ticks.add(tick - 1);
    ticks.add(tick);
  }
  prev = text;
}
const cases = [...ticks].sort((a, b) => a - b).map((tick) => ({ tick, text: groundSky(w.game, PORT, tick) }));
const empyreal =
  process.env.EMPYREAL_COMMIT ?? execFileSync("git", ["-C", root, "rev-parse", "--short", "HEAD"]).toString().trim();

process.stdout.write(JSON.stringify({ empyreal, port: PORT, charts, cases }, null, 1) + "\n");
process.exit(0);
