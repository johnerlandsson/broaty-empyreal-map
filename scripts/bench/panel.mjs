// Panel replay in headless WebKit for the perf bench (docs/maps/bench.md). Runs inside the Playwright
// v1.60 container (scripts/bench/run.mjs starts it): the panel (ui/map.html, with dev/fake-panel.js
// standing in for Mallard's window.panel) in an iframe of a host page, as Mallard hosts it. Nothing
// is served over a port: every request to http://bench.invalid/ is answered from the checkout.
//
//   node scripts/bench/panel.mjs --work DIR [--runs N] [--seconds S] [--cap MS]
//
// DIR holds session.jsonl (replay.lua's stream of the recorded session) and <scenario>.jsonl for each
// scenario in scenarios.json; it gets panel.json (the result) and panel-posts.jsonl (the panel's posts,
// for replay.lua --panel).
//
// Counts come from a pass on Playwright's fake clock, paused and run forward in fixed steps, so they
// are the same every run: draw() calls per view class (each exported class's prototype draw, wrapped
// as its module loads), DOM nodes added (a MutationObserver, subtrees counted whole), and the
// requestAnimationFrame and timer callbacks that ran. CPU is a second, real-time pass: the WebKit
// processes' utime+stime from /proc over each window, the median of N runs.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PW = process.env.PLAYWRIGHT_DIR ?? "/home/john/dev/mallard/node_modules/playwright";
const { webkit } = await import(path.join(PW, "index.mjs"));

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const work = opt("work");
const RUNS = Number(opt("runs", 5));
const SECONDS = Number(opt("seconds", 30));
const CAP = Number(opt("cap", 2000)); // the most fake time run between two messages of the recorded session
const SETTLE = 2000; // fake or real ms after a scenario's setup, before its window
const ORIGIN = "http://bench.invalid";
const VIEWPORT = { width: 520, height: 760 };
const log = (...a) => console.error("[bench:panel]", ...a);
const debug = process.env.BENCH_DEBUG ? log : () => {};

const readLines = (f) =>
  readFileSync(f, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
const scenarios = JSON.parse(readFileSync(path.join(work, "scenarios.json"), "utf8"));

// ---- serving the checkout, with the draw counters spliced into each module ----

const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const HOST = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}
iframe{border:0;width:480px;height:720px;display:block}</style></head>
<body><iframe id="panel" src="/ui/map.html"></iframe></body></html>`;

async function serve(route) {
  const url = new URL(route.request().url());
  if (url.pathname === "/" || url.pathname === "/host.html") return route.fulfill({ body: HOST, contentType: "text/html" });
  const file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) return route.fulfill({ status: 403 });
  let body;
  try {
    body = readFileSync(file);
  } catch {
    return route.fulfill({ status: 404, body: "" });
  }
  const ext = path.extname(file);
  if (url.pathname === "/ui/map.html") {
    // Mallard puts window.panel in place before the panel's scripts; the fake does here
    body = body.toString().replace('<script type="module"', '<script src="../dev/fake-panel.js"></script>\n  <script type="module"');
  } else if (ext === ".js" && url.pathname.startsWith("/ui/")) {
    const text = body.toString();
    const classes = [...text.matchAll(/^export class (\w+)/gm)].map((m) => m[1]);
    if (classes.length) body = text + "\n" + classes.map((c) => `;globalThis.__benchWrap?.(${c}, ${JSON.stringify(c)});`).join("\n") + "\n";
  }
  return route.fulfill({ body, contentType: TYPES[ext] ?? "application/octet-stream" });
}

// Before Playwright's clock: keep the browser's own requestAnimationFrame, to wait for real rendering.
const NATIVE = () => {
  window.__nativeRaf = window.requestAnimationFrame.bind(window);
};

// After Playwright's clock (so it counts the callbacks of whatever timers the page really has).
// With `defer`, ResizeObserver callbacks are held and given only at the bench's fixed points (flushRO), not
// on whichever real rendering frame they land, so the counted pass is the same every run.
const COUNTERS = ({ defer }) => {
  if (!location.pathname.endsWith("/ui/map.html")) return;
  const zero = () => ({ draws: {}, raf: 0, timeouts: 0, intervals: 0, nodes: { svg: 0, html: 0, text: 0 } });
  const B = (window.__bench = { c: zero() });
  B.reset = () => {
    B.c = zero();
  };
  // Playwright's paused clock holds Date but lets performance.now() run on with real time, so on the
  // counted pass performance.now() and the frame times are the paused Date's, from page start.
  const t0 = Date.now();
  const now = () => Date.now() - t0;
  if (defer) Object.defineProperty(performance, "now", { value: now, configurable: true, writable: true });
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) {
    const by = defer === "stacks" ? (new Error().stack.split("\n").find((l) => l.includes("/ui/") && !l.includes("fake-panel")) ?? "?").replace(/^.*\/ui\//, "") : null;
    return raf.call(window, (t) => {
      B.c.raf++;
      if (by) (B.c.raf_by ??= {})[by] = (B.c.raf_by[by] ?? 0) + 1;
      cb(defer ? now() : t);
    });
  };
  const st = window.setTimeout;
  window.setTimeout = function (cb, ...rest) {
    if (typeof cb !== "function") return st.call(window, cb, ...rest);
    return st.call(window, (...a) => {
      B.c.timeouts++;
      cb(...a);
    }, ...rest);
  };
  const si = window.setInterval;
  window.setInterval = function (cb, ...rest) {
    if (typeof cb !== "function") return si.call(window, cb, ...rest);
    return si.call(window, (...a) => {
      B.c.intervals++;
      cb(...a);
    }, ...rest);
  };
  globalThis.__benchWrap = (cls, name) => {
    const proto = cls?.prototype;
    const draw = proto && Object.getOwnPropertyDescriptor(proto, "draw")?.value;
    if (typeof draw !== "function") return;
    proto.draw = function (...a) {
      B.c.draws[name] = (B.c.draws[name] ?? 0) + 1;
      return draw.apply(this, a);
    };
  };
  const SVG = "http://www.w3.org/2000/svg";
  const count = (n) => {
    if (n.nodeType === 3) return void B.c.nodes.text++;
    if (n.nodeType !== 1) return;
    const tally = (e) => (e.namespaceURI === SVG ? B.c.nodes.svg++ : B.c.nodes.html++);
    tally(n);
    for (const e of n.getElementsByTagName("*")) tally(e);
  };
  const held = new Map(); // observer -> Map(target -> its latest entry)
  B.flushRO = () => {
    const list = [...held];
    held.clear();
    for (const [o, entries] of list) o.cb([...entries.values()], o);
    return list.length;
  };
  if (defer) {
    const NativeRO = window.ResizeObserver;
    window.ResizeObserver = class {
      constructor(cb) {
        this.cb = cb;
        this.ro = new NativeRO((entries) => {
          const m = held.get(this) ?? new Map();
          for (const e of entries) m.set(e.target, e);
          held.set(this, m);
        });
      }
      observe(...a) {
        return this.ro.observe(...a);
      }
      unobserve(...a) {
        return this.ro.unobserve(...a);
      }
      disconnect() {
        held.delete(this);
        return this.ro.disconnect();
      }
    };
  }
  const mo = new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) count(n);
  });
  mo.observe(document, { childList: true, subtree: true });
};

// ---- the browser ----

const browser = await webkit.launch();

/** A fresh page on the host, its clock at `now` (paused unless `running`); resolves with the panel's frame. */
async function open(now, running) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  await page.route(`${ORIGIN}/**`, serve);
  await page.addInitScript(NATIVE);
  // pauseAt alone installs the clock paused: an install first would let the real ms till the pause into
  // the page's performance.now(), moving its 16 ms frames against the timers from run to run
  if (running) await page.clock.install({ time: now });
  else await page.clock.pauseAt(now);
  await page.addInitScript(COUNTERS, { defer: running ? false : process.env.BENCH_STACKS ? "stacks" : true });
  const posts = [];
  await page.exposeFunction("__benchPost", (name, data, after) => posts.push({ after, name, data }));
  debug("goto");
  await page.goto(`${ORIGIN}/host.html`);
  debug("loaded");
  const frame = page.frame({ url: /\/ui\/map\.html$/ });
  await frame.waitForFunction(() => window.fakePanel && window.__bench);
  debug("panel up");
  await frame.evaluate(() => {
    window.__benchAfter = 0;
    window.fakePanel.onPost((name, data) => window.__benchPost(name, data, window.__benchAfter));
  });
  return { context, page, frame, posts };
}

/** Let real rendering happen (layout, paint), then hand over the ResizeObserver callbacks it held, till
 *  there are none (a resize can lead to another). */
const frames = (frame) =>
  frame.evaluate(async () => {
    const raf = window.__pwClock?.builtins?.requestAnimationFrame ?? window.__nativeRaf;
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => raf(() => raf(() => r())));
      if (!window.__bench.flushRO()) return;
    }
  });

const emit = (frame, m) =>
  frame.evaluate((m) => {
    window.__benchAfter = m.e;
    if (window.__benchTracing) (window.__benchTrace ??= []).push(`${m.i} ${m.name} ${window.__bench.c.raf} ${window.__bench.c.timeouts} ${JSON.stringify(window.__bench.c.draws)}`);
    window.fakePanel.emit(m.name, m.data);
  }, m);

async function runFor(page, frame, ms, step = 1000) {
  for (let left = ms; left > 0; left -= step) {
    await page.clock.runFor(Math.min(step, left));
    await frames(frame);
  }
}

const counts = (frame) => frame.evaluate(() => JSON.parse(JSON.stringify(window.__bench.c)));
const reset = (frame) => frame.evaluate(() => window.__bench.reset());

// ---- WebKit's CPU from /proc ----

const HZ = 100; // USER_HZ on Linux
function cpuTicks() {
  const out = new Map(); // pid -> { comm, ticks }
  for (const pid of readdirSync("/proc")) {
    if (!/^\d+$/.test(pid)) continue;
    let stat;
    try {
      stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    } catch {
      continue;
    }
    const close = stat.lastIndexOf(")");
    const comm = stat.slice(stat.indexOf("(") + 1, close);
    if (!/WebKit|WPE|MiniBrowser|pw_run|playwright/i.test(comm)) continue;
    const f = stat.slice(close + 2).split(" ");
    out.set(pid, { comm, ticks: Number(f[11]) + Number(f[12]) }); // utime + stime: every thread of the process
  }
  return out;
}
/** CPU seconds since snapshot `a`, of the processes alive now (one that started since counts from 0). */
function cpuSince(a) {
  const d = { web: 0, all: 0 };
  for (const [pid, p] of cpuTicks()) {
    const s = Math.max(0, p.ticks - (a.get(pid)?.comm === p.comm ? a.get(pid).ticks : 0)) / HZ;
    d.all += s;
    if (/WebProces/.test(p.comm)) d.web += s;
  }
  return d;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n === 0 ? 0 : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

// ---- the recorded session, time-compressed ----

async function replaySession() {
  const stream = readLines(path.join(work, "session.jsonl")).filter((m) => m.name);
  if (!stream.length) return null;
  const t0 = stream[0].t;
  const { context, page, frame, posts } = await open(t0, false);
  await frames(frame);
  await reset(frame);
  const cpu0 = cpuTicks();
  const wall0 = Date.now();
  let last = t0;
  let fake = 0;
  if (process.env.BENCH_TRACE) await frame.evaluate(() => (window.__benchTracing = true));
  for (const m of stream) {
    const gap = m.t - last;
    if (gap > 0) {
      const run = Math.min(gap, CAP);
      await page.clock.runFor(run);
      if (gap > run) await page.clock.fastForward(gap - run);
      fake += run;
      last = m.t;
    }
    await emit(frame, m);
    await frames(frame);
  }
  if (process.env.BENCH_TRACE) writeFileSync(path.join(work, "trace.txt"), (await frame.evaluate(() => window.__benchTrace ?? [])).join("\n") + "\n");
  // the debounced land-save and anything else pending
  await runFor(page, frame, CAP);
  fake += CAP;
  const c = await counts(frame);
  const cpu = cpuSince(cpu0);
  const wall = (Date.now() - wall0) / 1000;
  await context.close();
  writeFileSync(path.join(work, "panel-posts.jsonl"), posts.map((p) => JSON.stringify(p)).join("\n") + (posts.length ? "\n" : ""));
  const back = {};
  for (const p of posts) {
    const e = (back[p.name] ??= { n: 0, bytes: 0 });
    e.n++;
    e.bytes += Buffer.byteLength(JSON.stringify(p.data ?? null));
  }
  log(`session: ${stream.length} messages, ${wall.toFixed(1)} s, ${cpu.web.toFixed(2)} s web CPU`);
  return { messages: stream.length, fake_seconds_run: fake / 1000, counts: c, panel_posts: back, cpu_s: cpu, wall_s: wall };
}

// ---- the idle scenarios ----

function split(s) {
  const stream = readLines(path.join(work, `${s.name}.jsonl`));
  const mark = stream.findIndex((m) => m.mark === "window");
  return { setup: stream.slice(0, mark).filter((m) => m.name), during: stream.slice(mark + 1).filter((m) => m.name) };
}

const hide = (page) => page.evaluate(() => (document.getElementById("panel").style.display = "none"));

async function countScenario(s) {
  const { setup, during } = split(s);
  const { context, page, frame } = await open(s.now, false);
  for (const m of setup) {
    await emit(frame, m);
    await frames(frame);
  }
  await runFor(page, frame, SETTLE);
  if (s.hidden) {
    await hide(page);
    await runFor(page, frame, SETTLE);
  }
  const hidden = await frame.evaluate(() => document.hidden);
  await reset(frame);
  for (const m of during) {
    await emit(frame, m);
    await frames(frame);
  }
  await runFor(page, frame, SECONDS * 1000);
  const c = await counts(frame);
  await context.close();
  return { counts: c, document_hidden: hidden };
}

async function cpuScenario(s) {
  const { setup, during } = split(s);
  const { context, page, frame } = await open(s.now, true);
  for (const m of setup) await emit(frame, m);
  await page.waitForTimeout(SETTLE);
  if (s.hidden) {
    await hide(page);
    await page.waitForTimeout(SETTLE);
  }
  const cpu0 = cpuTicks();
  for (const m of during) await emit(frame, m);
  await page.waitForTimeout(SECONDS * 1000);
  const cpu = cpuSince(cpu0);
  await context.close();
  return cpu;
}

const result = { seconds: SECONDS, runs: RUNS, cap_ms: CAP, viewport: { width: 480, height: 720 }, session: null, scenarios: {} };
result.session = await replaySession();
for (const s of process.env.BENCH_ONLY === "session" ? [] : scenarios) {
  const c = await countScenario(s);
  const web = [];
  const all = [];
  for (let i = 0; i < RUNS; i++) {
    const cpu = await cpuScenario(s);
    web.push(cpu.web);
    all.push(cpu.all);
  }
  const per = (n) => Math.round((n / SECONDS) * 100) / 100;
  result.scenarios[s.name] = {
    note: s.note,
    ...c,
    per_s: { raf: per(c.counts.raf), timers: per(c.counts.timeouts + c.counts.intervals) },
    cpu_s: { web_runs: web, web_median: median(web), all_runs: all, all_median: median(all) },
  };
  log(`${s.name}: draws ${JSON.stringify(c.counts.draws)} raf ${c.counts.raf} web CPU ${median(web).toFixed(2)} s`);
}
result.processes = [...new Set([...cpuTicks().values()].map((p) => p.comm))].sort();
await browser.close();
writeFileSync(path.join(work, "panel.json"), JSON.stringify(result, null, 2) + "\n");
