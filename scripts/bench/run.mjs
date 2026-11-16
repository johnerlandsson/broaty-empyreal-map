// npm run bench: the plugin's repeatable performance baseline (docs/maps/bench.md).
//
//   npm run bench [-- options] [<session.mallardlog>...]
//     (no logs)         Mallard's empyreal-7 logs of 2026-11-14 and 2026-11-15
//     --fixture         tests/fixtures/sample.mallardlog instead (no private log needed)
//     --out FILE        the result (default bench-results/<branch>.json)
//     --runs N          timed runs, medians taken (default 5)
//     --seconds S       each idle scenario's window (default 30)
//     --cpus LIST       pin everything with taskset -c LIST (e.g. 2,3)
//     --quick           --runs 1 --seconds 10, for trying it out (not for comparing)
//     --lua-only        skip the WebKit half
//   npm run bench -- --compare base.json new.json
//
// The logs are read where they are and never copied into the checkout; work files go to a temp dir.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compare, table } from "./report.mjs";
import { SCENARIOS, sessionText } from "./scenarios.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return dflt;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};

if (flag("compare")) {
  if (args.length !== 2) {
    console.error("usage: npm run bench -- --compare base.json new.json");
    process.exit(2);
  }
  const [a, b] = args.map((f) => JSON.parse(readFileSync(f, "utf8")));
  console.log(compare(a, b, args[0], args[1]));
  process.exit(0);
}

const quick = flag("quick");
const luaOnly = flag("lua-only");
const fixture = flag("fixture");
const runs = Number(opt("runs", quick ? 1 : 5));
const seconds = Number(opt("seconds", quick ? 10 : 30));
const cpus = opt("cpus", null);
const playwright = opt("playwright", process.env.PLAYWRIGHT_DIR ?? path.join(os.homedir(), "dev/mallard/node_modules/playwright"));
const image = opt("image", "mcr.microsoft.com/playwright:v1.60.0-noble");
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" }).trim();
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const out = opt("out", path.join(root, "bench-results", `${branch.replace(/[^\w.-]+/g, "_")}.json`));
const LOGS = path.join(os.homedir(), ".local/share/net.mallard.app/logs/empyreal-7");
const logs = fixture ? [path.join(root, "tests/fixtures/sample.mallardlog")] : args.length ? args : ["2026-11-14.mallardlog", "2026-11-15.mallardlog"].map((f) => path.join(LOGS, f));
for (const l of logs) {
  if (!existsSync(l)) {
    console.error(`bench: no log at ${l} (give one, or --fixture)`);
    process.exit(2);
  }
}

const pin = (cmd) => (cpus ? ["taskset", "-c", cpus, ...cmd] : cmd);
const run = (cmd, opts = {}) => {
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: ["ignore", "inherit", "inherit"], ...opts });
  if (r.status !== 0) {
    console.error(`bench: ${cmd.join(" ")} failed (${r.status ?? r.signal})`);
    process.exit(1);
  }
};
const step = (s) => console.error(`\n== ${s}`);

const work = mkdtempSync(path.join(os.tmpdir(), "empyreal-bench-"));
try {
  const replay = (extra) => run(pin(["lua", path.join(root, "scripts/bench/replay.lua"), ...extra]));

  step("Lua: the recorded session, for the panel's stream");
  replay(["--runs", "0", "--stream", path.join(work, "session.jsonl"), "--out", path.join(work, "lua-0.json"), ...logs]);

  let panel = null;
  if (!luaOnly) {
    step("Lua: the idle scenarios");
    for (const s of SCENARIOS) {
      writeFileSync(path.join(work, `${s.name}.mallardlog`), sessionText(s));
      replay(["--runs", "0", "--stream", path.join(work, `${s.name}.jsonl`), "--out", path.join(work, `${s.name}-lua.json`), path.join(work, `${s.name}.mallardlog`)]);
    }
    writeFileSync(path.join(work, "scenarios.json"), JSON.stringify(SCENARIOS.map(({ records, ...s }) => s)));

    step(`WebKit: the session, then ${SCENARIOS.length} scenarios × (1 counted + ${runs} timed) of ${seconds} s`);
    const vol = (p, mode) => ["-v", `${p}:${p}:${mode},z`];
    run([
      "podman", "run", "--rm", "--network", "none", "--ipc", "host",
      ...vol(root, "ro"), ...vol(work, "rw"), ...vol(path.dirname(playwright), "ro"),
      "-e", `PLAYWRIGHT_DIR=${playwright}`,
      image,
      ...pin(["node", path.join(root, "scripts/bench/panel.mjs"), "--work", work, "--runs", String(runs), "--seconds", String(seconds)]),
    ]);
    panel = JSON.parse(readFileSync(path.join(work, "panel.json"), "utf8"));
  }

  step(`Lua: the session with the panel's posts back, ${runs} timed runs`);
  const posts = path.join(work, "panel-posts.jsonl");
  replay(["--runs", String(runs), ...(existsSync(posts) ? ["--panel", posts] : []), "--out", path.join(work, "lua.json"), ...logs]);
  const lua = JSON.parse(readFileSync(path.join(work, "lua.json"), "utf8"));

  const dirty = git("status", "--porcelain", "--untracked-files=no") !== "";
  const result = {
    meta: {
      branch,
      commit: git("rev-parse", "--short", "HEAD") + (dirty ? "+dirty" : ""),
      date: new Date().toISOString(),
      logs: logs.map((l) => path.basename(l)),
      runs,
      seconds,
      cpus: cpus ?? "any",
      host: { cpus: os.cpus().length, load: os.loadavg().map((x) => Math.round(x * 100) / 100), lua: execFileSync("lua", ["-v"], { encoding: "utf8" }).trim() },
    },
    lua,
    panel,
  };
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  console.log(table(result));
  console.log(`\nwritten: ${out}`);
} finally {
  if (!process.env.BENCH_KEEP) rmSync(work, { recursive: true, force: true });
  else console.error(`work files kept in ${work}`);
}
