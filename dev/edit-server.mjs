#!/usr/bin/env node
// The tweak editor's server: serves the repo, and lets the editor page read and save the tweak
// files in data/tweaks. A save is built first into a temp dir with the candidates in a copy of the
// tweaks; only if that build passes are the files written and ui/data rebuilt. A trial is that
// build alone: nothing is written, and the last trial's place files are served from its temp dir
// for the page to preview edits not yet saved. Builds go one at a time, and each, a hand edit's
// included, is announced over server-sent events. It writes only data/tweaks/*.json and, through
// the build, ui/data; never data/sync-report.json, never the source.
// Usage: npm run edit [-- --port N]   (8766 by default)

import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, watch, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../scripts/build-data.mjs";
import { ordered } from "./editor/ops.js";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

/** A tweak file's name: a plain lower-case name. The palette has its own route for one file. */
const NAME = /^[a-z0-9_-]+$/;

/** The largest request body taken, in bytes. */
const MAX_BODY = 1024 * 1024;

/** How long the watcher waits for a burst of changes to settle. */
const DEBOUNCE_MS = 200;

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const tweakText = (json) => `${JSON.stringify(ordered(json), null, 2)}\n`;
const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : null);
const versionOf = (file) => (existsSync(file) ? statSync(file).mtimeMs : 0);

/** The index array of a generated places.js (its default export, as JSON before `export const data`). */
function placesOf(file) {
  const text = read(file);
  if (text === null) return [];
  const start = text.indexOf("export default ") + "export default ".length;
  return JSON.parse(text.slice(start, text.indexOf(";\n\nexport const data")));
}

/**
 * The generated ship plans in a ui/data dir, by name: [{id, name, hulls}], each named by its first
 * hull in ships.js (its default export, as JSON before `export const plans`), else by its id.
 */
function plansOf(outDir) {
  const plansDir = join(outDir, "plans");
  if (!existsSync(plansDir)) return [];
  const plans = new Map(
    readdirSync(plansDir)
      .filter((f) => f.endsWith(".js"))
      .map((f) => f.slice(0, -".js".length))
      .map((id) => [id, { id, name: id, hulls: [] }]),
  );
  const text = read(join(outDir, "ships.js"));
  if (text !== null) {
    const start = text.indexOf("export default ") + "export default ".length;
    const { hulls = {} } = JSON.parse(text.slice(start, text.indexOf(";\n\nexport const plans")));
    for (const hull of Object.values(hulls)) {
      const plan = plans.get(hull.plan);
      if (!plan) continue;
      if (!plan.hulls.length) plan.name = hull.name ?? hull.id;
      plan.hulls.push(hull.id);
    }
  }
  return [...plans.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** The text of each generated place file in a dir, and each plan file in its plans/, by id. */
function snapshot(outDir) {
  const files = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".js") && f !== "places.js" && f !== "ships.js") : []);
  const plansDir = join(outDir, "plans");
  return new Map([
    ...files(outDir).map((f) => [f.slice(0, -".js".length), readFileSync(join(outDir, f), "utf8")]),
    ...files(plansDir).map((f) => [f.slice(0, -".js".length), readFileSync(join(plansDir, f), "utf8")]),
  ]);
}

/** The ids whose place or plan file differs between two snapshots, sorted. */
function changedIds(before, after) {
  const ids = new Set([...before.keys(), ...after.keys()]);
  return [...ids].filter((id) => before.get(id) !== after.get(id)).sort();
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": TYPES[".json"], "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  // Read to the end even past the cap, so the client hears the 413 rather than a reset.
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= MAX_BODY) chunks.push(chunk);
  }
  if (size > MAX_BODY) throw new HttpError(413, `the body is over ${MAX_BODY} bytes`);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "the body must be JSON");
  }
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** One file's {json, version}, checked. */
function fileOf(body, name = "") {
  const { json, version } = body ?? {};
  if (!isObject(json)) throw new HttpError(400, `${name ? `${name}: ` : ""}json must be an object`);
  if (typeof version !== "number") throw new HttpError(400, `${name ? `${name}: ` : ""}version must be a number`);
  return { json, version };
}

/** A body's {files: {name: …}}, each name a tweak file's (the palette's "palette"), each entry checked by `entry`. */
function filesOf(body, entry) {
  const files = body?.files;
  if (!isObject(files) || !Object.keys(files).length) throw new HttpError(400, "files must name a tweak file at least");
  return Object.fromEntries(
    Object.entries(files).map(([name, value]) => {
      if (!NAME.test(name)) throw new HttpError(400, `bad tweak name: ${name}`);
      return [`${name}.json`, entry(value, name)];
    }),
  );
}

/**
 * Starts the server.
 * @param {{root: string, source: string, port?: number, build?: typeof build}} opts `build` is the
 *   build to run, for tests to wrap; the build's own by default.
 * @returns {Promise<{url: string, close(): Promise<void>}>}
 */
export async function startServer({ root, source, port = 8766, build: runBuild = build }) {
  root = resolve(root);
  const tweaksDir = join(root, "data/tweaks");
  const outDir = join(root, "ui/data");
  const syncReport = join(root, "data/sync-report.json");
  // The last sync's report, read once: an editor build diffs ui/data against itself, so only the
  // lists that follow the tweaks (orphans, unplaced, noBuilder) are taken from it.
  const synced = JSON.parse(read(syncReport) ?? "null");
  let report = synced;
  let lastVersion = 0;
  const clients = new Set();
  let trial = null; // the last trial that passed: {n, dir}, its place files in dir/out

  // The text of each tweak file as the server last saw it, so the watcher tells a hand edit from
  // the server's own write.
  const tweakFiles = () => readdirSync(tweaksDir).filter((f) => f.endsWith(".json")).sort();
  const known = new Map(tweakFiles().map((f) => [f, read(join(tweaksDir, f))]));

  // One build at a time: each job waits for the one before it, failed or not.
  let queue = Promise.resolve();
  const enqueue = (job) => {
    const run = queue.then(job);
    queue = run.catch(() => {});
    return run;
  };

  function announce(event) {
    const text = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of clients) res.write(text);
  }

  /** A version for a build, newer than the last, for the page to re-import by. */
  const buildVersion = () => (lastVersion = Math.max(Date.now(), lastVersion + 1));

  /**
   * Builds ui/data from data/tweaks as they are. The report goes to a temp file seeded with
   * data/sync-report.json, so it's the report build:data would give, and the real one stays.
   */
  async function realBuild() {
    const temp = mkdtempSync(join(tmpdir(), "edit-server-"));
    try {
      const reportPath = join(temp, "sync-report.json");
      if (existsSync(syncReport)) cpSync(syncReport, reportPath);
      const before = snapshot(outDir);
      const built = (await runBuild({ source, tweaksDir, outDir, reportPath })).report;
      const { orphans, unplaced, noBuilder } = built;
      report = synced ? { ...synced, orphans, unplaced, noBuilder } : built;
      const changed = changedIds(before, snapshot(outDir));
      announce({ type: "built", changed, version: buildVersion() });
      return changed;
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }

  /**
   * Builds ui/data into a new temp dir from a copy of the tweaks with `texts` (file -> text) over
   * it: the dir, for the caller to remove, or a 422 with the build's message, the dir removed.
   */
  async function candidate(texts) {
    const temp = mkdtempSync(join(tmpdir(), "edit-server-"));
    try {
      cpSync(tweaksDir, join(temp, "tweaks"), { recursive: true });
      for (const [file, text] of Object.entries(texts)) writeFileSync(join(temp, "tweaks", file), text);
      await runBuild({
        source,
        tweaksDir: join(temp, "tweaks"),
        tweaksShownAs: "data/tweaks",
        outDir: join(temp, "out"),
        reportPath: join(temp, "report.json"),
      });
      return temp;
    } catch (err) {
      rmSync(temp, { recursive: true, force: true });
      throw new HttpError(422, err.message.includes("Nothing written") ? err.message : `${err.message}. Nothing written`);
    }
  }

  /** Each file whose version on disk isn't the one given, with the disk's: {} where all match. */
  function stale(files) {
    const out = {};
    for (const [file, { version }] of Object.entries(files)) {
      const now = versionOf(join(tweaksDir, file));
      if (now !== version) out[file.slice(0, -".json".length)] = now;
    }
    return out;
  }

  /**
   * Checks candidate tweak files (file -> {json, version}) with one build into a temp dir, then
   * writes them all and rebuilds; none is written if any is stale or the build refuses them.
   */
  function save(files) {
    return enqueue(async () => {
      const changedOnDisk = () => {
        const versions = stale(files);
        if (Object.keys(versions).length) throw new HttpError(409, "changed on disk", { versions });
      };
      changedOnDisk();
      const texts = Object.fromEntries(Object.entries(files).map(([file, { json }]) => [file, tweakText(json)]));
      rmSync(await candidate(texts), { recursive: true, force: true });

      // A hand edit during the candidate build wins. From this check to the renames nothing awaits.
      changedOnDisk();
      for (const [file, text] of Object.entries(texts)) {
        // Known before written, so the watcher sees no change. Renamed into place, never torn.
        known.set(file, text);
        const partial = join(tweaksDir, `.${file}.${process.pid}.tmp`);
        writeFileSync(partial, text);
        renameSync(partial, join(tweaksDir, file));
      }
      const versions = Object.fromEntries(Object.keys(files).map((file) => [file.slice(0, -".json".length), versionOf(join(tweaksDir, file))]));
      let changed;
      try {
        changed = await realBuild();
      } catch (err) {
        // The files are saved; say so, with their versions, and the next build fixes the view.
        announce({ type: "error", error: err.message });
        const names = Object.keys(files).map((f) => `data/tweaks/${f}`).join(", ");
        throw new HttpError(500, `saved ${names}, but rebuilding ui/data failed: ${err.message}`, { versions });
      }
      return { ok: true, versions, changed };
    });
  }

  /** save() of one file, answered as the one-file routes always were: with its `version`. */
  async function saveOne(file, body) {
    const name = file.slice(0, -".json".length);
    try {
      const { versions, ...rest } = await save({ [file]: fileOf(body) });
      return { ...rest, version: versions[name] };
    } catch (err) {
      if (err.extra?.versions) err.extra = { version: err.extra.versions[name] };
      throw err;
    }
  }

  /**
   * Builds the tweaks with candidate files (file -> json) over them, writing nothing. A trial that
   * passes is kept, the one before it removed, and its place and plan files served under
   * /api/trial/<n>/; it answers with n and the ids whose files differ from ui/data's.
   */
  function runTrial(files) {
    return enqueue(async () => {
      const texts = Object.fromEntries(Object.entries(files).map(([file, json]) => [file, tweakText(json)]));
      const dir = await candidate(texts);
      if (trial) rmSync(trial.dir, { recursive: true, force: true });
      trial = { n: buildVersion(), dir };
      return { ok: true, trial: trial.n, changed: changedIds(snapshot(outDir), snapshot(join(dir, "out"))) };
    });
  }

  /** A file of the last trial's: /api/trial/<n>/<id>.js or /api/trial/<n>/plans/<id>.js. */
  function serveTrial(pathname, res) {
    const m = /^\/api\/trial\/(\d+)\/((?:plans\/)?[a-z0-9_-]+\.js)$/.exec(pathname);
    if (!m) throw new HttpError(404, "no such trial file");
    if (!trial || Number(m[1]) !== trial.n) throw new HttpError(410, "a newer trial replaced this one");
    const file = join(trial.dir, "out", m[2]);
    if (!existsSync(file)) throw new HttpError(404, "not in the trial");
    res.writeHead(200, { "content-type": TYPES[".js"], "cache-control": "no-store" });
    res.end(readFileSync(file));
  }

  // A hand edit: rebuild once the changes settle, if any tweak file differs from what's known.
  let timer = null;
  const watcher = watch(tweaksDir, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      enqueue(async () => {
        const names = tweakFiles();
        const edited = names.some((f) => read(join(tweaksDir, f)) !== known.get(f)) || [...known.keys()].some((f) => !names.includes(f));
        if (!edited) return;
        known.clear();
        for (const f of names) known.set(f, read(join(tweaksDir, f)));
        try {
          await realBuild();
        } catch (err) {
          console.error(`edit: ${err.message}`);
          announce({ type: "error", error: err.message });
        }
      });
    }, DEBOUNCE_MS);
  });
  watcher.on("error", (err) => console.error(`edit: watching ${tweaksDir}: ${err.message}`));

  function state() {
    const tweaks = {};
    for (const f of tweakFiles()) {
      const path = join(tweaksDir, f);
      const entry = { json: null, version: versionOf(path) };
      try {
        entry.json = JSON.parse(readFileSync(path, "utf8"));
      } catch (err) {
        entry.error = `data/tweaks/${f}: ${err.message}`;
      }
      tweaks[f.slice(0, -".json".length)] = entry;
    }
    return { places: placesOf(join(outDir, "places.js")), plans: plansOf(outDir), report, palette: tweaks.palette?.json ?? {}, tweaks };
  }

  function serveStatic(pathname, res) {
    let rel;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      throw new HttpError(400, "bad path");
    }
    if (rel.includes("\0")) throw new HttpError(400, "bad path");
    const file = resolve(root, `.${rel}`);
    if (file !== root && !file.startsWith(root + sep)) throw new HttpError(403, "outside the root");
    if (!existsSync(file) || !statSync(file).isFile()) throw new HttpError(404, "not found");
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(readFileSync(file));
  }

  function events(req, res) {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    res.write(": connected\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
  }

  // Only this machine's names for the server, so a page on another site can't reach it by DNS rebinding.
  const hosts = () => [`localhost:${server.address().port}`, `127.0.0.1:${server.address().port}`];

  async function handle(req, res) {
    if (!hosts().includes(req.headers.host)) throw new HttpError(403, "unknown host");
    const { pathname } = new URL(req.url, "http://localhost");
    if (req.method === "GET" && pathname === "/api/state") return sendJson(res, 200, state());
    if (req.method === "GET" && pathname === "/api/events") return events(req, res);
    if (req.method === "PUT" && pathname === "/api/palette") return sendJson(res, 200, await saveOne("palette.json", await readJson(req)));
    if (req.method === "PUT" && pathname === "/api/tweaks") return sendJson(res, 200, await save(filesOf(await readJson(req), fileOf)));
    if (req.method === "POST" && pathname === "/api/trial") {
      const files = filesOf(await readJson(req), (json, name) => {
        if (!isObject(json)) throw new HttpError(400, `${name}: must be an object`);
        return json;
      });
      return sendJson(res, 200, await runTrial(files));
    }
    if (req.method === "GET" && pathname.startsWith("/api/trial/")) return serveTrial(pathname, res);
    if (pathname.startsWith("/api/tweaks/")) {
      if (req.method !== "PUT") throw new HttpError(405, "PUT only");
      let name;
      try {
        name = decodeURIComponent(pathname.slice("/api/tweaks/".length));
      } catch {
        throw new HttpError(400, "bad name");
      }
      if (!NAME.test(name) || name === "palette") throw new HttpError(400, `bad tweak name: ${name}`);
      return sendJson(res, 200, await saveOne(`${name}.json`, await readJson(req)));
    }
    if (pathname.startsWith("/api/")) throw new HttpError(404, "no such API");
    if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "GET only");
    return serveStatic(pathname, res);
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (!(err instanceof HttpError)) console.error(err);
      if (res.headersSent) return res.end();
      sendJson(res, err.status ?? 500, { error: err.message, ...err.extra });
    });
  });
  await new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(port, "localhost", done);
  });

  return {
    url: `http://localhost:${server.address().port}`,
    async close() {
      watcher.close();
      clearTimeout(timer);
      for (const res of clients) res.end();
      await queue;
      if (trial) rmSync(trial.dir, { recursive: true, force: true });
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  let port = 8766;
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== "--port") throw new Error(`Unknown argument: ${args[i]}`);
    port = Number(args[++i]);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`--port needs a port number, not ${args[i]}`);
  }
  const { url } = await startServer({ root, source: join(homedir(), "dev/empyreal"), port });
  console.log(`Editor: ${url}/dev/edit.html`);
}
