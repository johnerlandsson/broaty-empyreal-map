// Records the game's own Space.Charts, Ship.Status, Ship.Course and Space.Contacts for the plugin's
// chart tests and the preview (dev/charts-cases.js reads them): a character flying her skiff in
// Senara's system (docked at T.I.S.S., a course plotted to Orrin Station, under way there, at Gannet
// Belt with a sweep, in high orbit over Tamsin, landed at Zennor) and in Maelor's (at the Senara lane
// mouth with all three mouths, and docked at Wenna Halt with Kestrel Belt on her charts). Each case is
// the last of each message as of `now` (wall-clock ms), with where the game has her (`pos`) and the
// ship message the Lua side would make of it (src/station_map/charts.lua): `from` where she set out
// and `depart` when, which the payload leaves out. Runs the game itself from its source; nothing in
// the game repo changes.
//
//   npx -y node@24 dev/charts-cases.ts > dev/charts-cases.json
//
// EMPYREAL=<path> runs a checkout other than ~/dev/empyreal (it needs its node_modules installed);
// EMPYREAL_COMMIT=<sha> names its commit when it isn't a git checkout (an exported copy).

import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.env.EMPYREAL ?? path.join(os.homedir(), "dev/empyreal");
const from = (rel: string) => import(pathToFileURL(path.join(root, rel)).href);

const { TestWorld, chartAll, entityOf, fixCheck } = await from("tests/harness.ts");
const { Charts } = await from("packages/game/src/world/components.ts");

type Client = { gmcp: { pkg: string; data: unknown }[]; send: (...l: string[]) => Promise<unknown>; take: () => string };

const cases: Record<string, unknown> = {};
const PKGS = { charts: "Space.Charts", status: "Ship.Status", course: "Ship.Course", contacts: "Space.Contacts" };

/** A miner aboard her skiff at T.I.S.S., every station and mouth on her charts, flying true. */
async function start() {
  const w = new TestWorld();
  const g = w.game;
  const c: Client = await w.newMiner("charts", "Lark");
  chartAll(c);
  const ship = g.ships.shipMeant(entityOf(c));
  await c.send("board");
  fixCheck(w, "travel", true);
  return { w, g, c, ship };
}

/** Tick until `done`, a tick at a time, or throw after `max`. */
function until(w: { ticks: (n: number) => void }, done: () => boolean, what: string, max = 4000) {
  for (let i = 0; i < max; i++) {
    if (done()) return;
    w.ticks(1);
  }
  throw new Error(`never ${what}`);
}

/** Record the case `name` as of now; `trip` is where she set out from, for an under-way ship. */
async function record(s: Awaited<ReturnType<typeof start>>, name: string, trip: { from?: string; over?: string } = {}) {
  const { c, g, ship } = s;
  await c.send("look"); // charts and status are sent as they change, after a command
  c.take();
  const out: Record<string, unknown> = { now: g.now };
  for (const [k, pkg] of Object.entries(PKGS)) out[k] = c.gmcp.filter((f) => f.pkg === pkg).at(-1)?.data ?? null;
  const pos = g.ships.pos(ship);
  out.pos = pos;
  const status = out.status as Record<string, unknown> | null;
  const msg: Record<string, unknown> | null = status && {
    name: status.name,
    docked: status.docked,
    location: status.location,
    destination: status.destination,
    progress: status.progress,
    eta: status.eta,
    received: Math.floor(g.now / 1000),
  };
  if (msg && pos.k === "transit") {
    msg.depart = Math.round((g.space.epoch + pos.depart * 1000) / 1000);
    if (trip.from) msg.from = trip.from;
  }
  if (msg && trip.over) msg.over = { planet: trip.over, from: trip.from, depart: trip.depart };
  out.ship = msg;
  cases[name] = out;
}

// --- Senara ---------------------------------------------------------------------------------------

{
  const s = await start();
  const { w, c } = s;
  await record(s, "docked-tiss");
  await c.send("undock");
  w.ticks(20);
  await c.send("plot orrin station");
  until(w, () => c.gmcp.some((f) => f.pkg === "Ship.Course" && f.data), "plotted");
  await record(s, "course-orrin");
  await c.send("travel orrin station");
  w.clearance();
  w.underWay(s.ship);
  const pos = s.g.ships.pos(s.ship);
  until(w, () => s.g.tick >= pos.depart + 0.4 * (pos.arrive - pos.depart), "40% of the way");
  await record(s, "under-way-orrin", { from: "tiss" });
}

{
  const s = await start();
  const { w, c, g, ship } = s;
  await c.send("undock");
  w.ticks(20);
  await c.send("travel gannet belt");
  w.clearance();
  w.underWay(ship);
  const pos = g.ships.pos(ship);
  until(w, () => g.tick >= pos.depart + 0.5 * (pos.arrive - pos.depart), "half way to Gannet");
  await record(s, "to-gannet", { from: "tiss" });
  until(w, () => g.ships.pos(ship).k === "space" && !g.ships.isBusy(ship, "nav"), "at Gannet");
  await record(s, "at-gannet");
  await c.send("scan");
  w.advanceUntil(c, "Sweep complete", 20_000);
  w.ticks(1);
  await record(s, "sweep-gannet");
}

{
  const s = await start();
  const { w, c, g, ship } = s;
  await c.send("undock");
  w.ticks(20);
  await c.send("travel tamsin");
  w.clearance();
  w.underWay(ship);
  const depart = Math.round((g.space.epoch + g.ships.pos(ship).depart * 1000) / 1000);
  until(w, () => g.ships.pos(ship).k !== "transit" && !g.ships.isBusy(ship, "nav"), "over Tamsin");
  await record(s, "high-orbit-tamsin", { from: "tiss", over: "tamsin", depart } as never);
  await c.send("travel zennor");
  w.clearance();
  until(w, () => g.ships.pos(ship).loc === "zennor" && !g.ships.isBusy(ship, "nav"), "over Zennor");
  await c.send("land");
  w.clearance();
  until(w, () => g.ships.pos(ship).k === "docked", "landed", 600);
  await record(s, "landed-zennor");
}

// --- Maelor -------------------------------------------------------------------------------------

{
  const s = await start();
  const { w, c, g, ship } = s;
  await c.send("undock");
  w.ticks(20);
  g.ships.setPos(ship, { k: "space", loc: "mouth:maelor:senara", frame: "maelor", x: 0, y: 0, bx: 0, by: 0 });
  // Kestrel Belt on her charts, seen an hour ago where it was, good to 5,000 km
  const kestrel = g.belts.open().map((b: number) => g.belts.data(b)).find((d: { profile: string }) => d.profile === "kestrel");
  if (kestrel) {
    const t = g.tick - 3600;
    const [x, y] = g.space.orbits.local(kestrel.orbit, t);
    const e = entityOf(c);
    const charts = g.world.get(e, Charts);
    g.world.set(e, Charts, { ...charts, obs: { ...charts.obs, [kestrel.key]: [{ t, x, y, s: 5000 }] } });
  }
  w.ticks(5);
  await record(s, "maelor-mouth");
  await c.send("travel wenna halt");
  w.clearance();
  w.underWay(ship);
  until(w, () => g.ships.pos(ship).k === "space" && !g.ships.isBusy(ship, "nav"), "at Wenna Halt");
  await c.send("dock");
  until(w, () => !g.ships.isBusy(ship, "nav") && c.gmcp.filter((f) => f.pkg === "Ship.Status").at(-1)?.data?.docked, "docked", 600);
  await record(s, "docked-wenna-halt");
}

const empyreal =
  process.env.EMPYREAL_COMMIT ?? execFileSync("git", ["-C", root, "rev-parse", "--short", "HEAD"]).toString().trim();

process.stdout.write(JSON.stringify({ empyreal, cases }) + "\n");
process.exit(0);
