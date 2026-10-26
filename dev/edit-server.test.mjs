import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { build } from "../scripts/build-data.mjs";
import { startServer } from "./edit-server.mjs";

const repo = new URL("..", import.meta.url).pathname;
const fixtures = join(repo, "tests/fixtures/empyreal");

let cleanup = [];
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn();
  cleanup = [];
});

/**
 * A temp root with copies of the repo's data/tweaks and data/sync-report.json, a copy of the
 * fixture source with a locker to starboard of Mini's hall, and ui/data built from that source
 * (the repo's own ui/data names places the fixture hasn't, and the build refuses to remove them
 * all), then a server on it.
 */
async function setup({ build: buildWith, syncReport } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "edit-server-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, "root");
  const source = join(dir, "source");
  cpSync(join(repo, "data/tweaks"), join(root, "data/tweaks"), { recursive: true });
  cpSync(join(repo, "data/sync-report.json"), join(root, "data/sync-report.json"));
  cpSync(fixtures, source, { recursive: true });
  const area = join(source, "content/areas/mini.yaml");
  const doc = parse(readFileSync(area, "utf8"));
  doc.rooms.push({ id: "mini.locker", name: "Locker", address: "Deck 1, frame 2, starboard", exits: {} });
  writeFileSync(area, stringify(doc));
  mkdirSync(join(root, "ui"), { recursive: true });
  await build({ source, tweaksDir: join(root, "data/tweaks"), outDir: join(root, "ui/data"), reportPath: join(dir, "seed-report.json") });
  if (syncReport) writeFileSync(join(root, "data/sync-report.json"), `${JSON.stringify(syncReport, null, 2)}\n`);
  writeFileSync(join(root, "index.html"), "<p>hi</p>\n");
  writeFileSync(join(dir, "secret.txt"), "secret\n");

  const server = await startServer({ root, source, port: 0, ...(buildWith ? { build: buildWith } : {}) });
  cleanup.push(() => server.close());
  const read = (rel) => readFileSync(join(root, rel), "utf8");
  const put = (name, json, version) =>
    fetch(`${server.url}/api/tweaks/${name}`, { method: "PUT", body: JSON.stringify({ json, version }) });
  return { root, dir, source, url: server.url, read, put };
}

const tweakText = (t) => `${JSON.stringify(t, null, 2)}\n`;

/** The `data:` payloads of server-sent events, as they arrive. */
async function events(url) {
  const controller = new AbortController();
  const res = await fetch(`${url}/api/events`, { signal: controller.signal });
  cleanup.push(() => controller.abort());
  const seen = [];
  const waiters = [];
  (async () => {
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let end;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = block.split("\n").find((l) => l.startsWith("data: "));
          if (data) seen.push(JSON.parse(data.slice(6)));
          waiters.splice(0).forEach((w) => w());
        }
      }
    } catch {
      // aborted
    }
  })();
  const next = (ms) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no event within ${ms} ms`)), ms);
      const check = () => (seen.length ? (clearTimeout(timer), resolve(seen.shift())) : waiters.push(check));
      check();
    });
  return { seen, next };
}

describe("edit server", () => {
  it("serves the state: places, the report at start, the palette and the tweaks with versions", async () => {
    const { url, root } = await setup();
    const state = await (await fetch(`${url}/api/state`)).json();
    expect(state.places.map((p) => p.id)).toEqual(["mini", "wheelie"]);
    expect(state.report).toEqual(JSON.parse(readFileSync(join(root, "data/sync-report.json"), "utf8")));
    expect(state.palette.docks).toBe("#cfe3ff");
    expect(state.tweaks.palette.json).toEqual(state.palette);
    expect(state.tweaks.orrin.json).toEqual(JSON.parse(readFileSync(join(root, "data/tweaks/orrin.json"), "utf8")));
    expect(state.tweaks.orrin.version).toBe(statSync(join(root, "data/tweaks/orrin.json")).mtimeMs);
    expect(Object.keys(state.tweaks)).toContain("kilmar");
  });

  it("lists the ship plans by their hull's name, and announces a plan's rebuild by its id", async () => {
    const { put, read, url } = await setup();
    const state = await (await fetch(`${url}/api/state`)).json();
    expect(state.plans).toEqual([
      { id: "hull-skiff", name: "prospecting skiff", hulls: ["skiff"] },
      { id: "tub", name: "tub", hulls: ["tub"] },
    ]);
    const res = await put("tub", { surface: { seams: false } }, 0);
    expect(res.status).toBe(200);
    expect((await res.json()).changed).toEqual(["tub"]);
    expect(read("ui/data/plans/tub.js")).toContain('"seams": false');
  });

  it("serves static files under the root with their types, and nothing outside it", async () => {
    const { url } = await setup();
    const html = await fetch(`${url}/index.html`);
    expect(html.status).toBe(200);
    expect(html.headers.get("content-type")).toMatch(/^text\/html/);
    const js = await fetch(`${url}/ui/data/mini.js`);
    expect(js.headers.get("content-type")).toMatch(/^text\/javascript/);
    for (const path of ["/..%2Fsecret.txt", "/%2E%2E/secret.txt", "/ui/..%2F..%2Fsecret.txt"]) {
      const res = await fetch(`${url}${path}`);
      expect(res.status).not.toBe(200);
      expect(await res.text()).not.toContain("secret");
    }
    expect((await fetch(`${url}/nope.html`)).status).toBe(404);
  });

  it("saves a valid tweak in the ordered format, rebuilds ui/data and leaves the sync report alone", async () => {
    const { put, read, root, url } = await setup();
    const report = read("data/sync-report.json");
    const mini = read("ui/data/mini.js");
    const wheelie = read("ui/data/wheelie.js");
    const res = await put("mini", { footprints: { hall: { corners: "cut" } }, paint: { hall: "docks" } }, 0);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.changed).toEqual(["mini"]);
    expect(read("data/tweaks/mini.json")).toBe(tweakText({ paint: { hall: "docks" }, footprints: { hall: { corners: "cut" } } }));
    expect(body.version).toBe(statSync(join(root, "data/tweaks/mini.json")).mtimeMs);
    expect(read("ui/data/mini.js")).not.toBe(mini);
    expect(read("ui/data/mini.js")).toContain('"hall": "docks"');
    expect(read("ui/data/wheelie.js")).toBe(wheelie);
    expect(read("data/sync-report.json")).toBe(report);
    const state = await (await fetch(`${url}/api/state`)).json();
    expect(state.tweaks.mini.version).toBe(body.version);
  });

  it("refuses an invalid tweak with the build's message and writes nothing", async () => {
    const { put, read, root } = await setup();
    const mini = read("ui/data/mini.js");
    const places = read("ui/data/places.js");
    const res = await put("mini", { footprints: { hall: { span: { starboard: 0.6 } } } }, 0);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/data\/tweaks\/mini\.json.*mini\.hall.*mini\.locker.*overlap/);
    expect(existsSync(join(root, "data/tweaks/mini.json"))).toBe(false);
    expect(read("ui/data/mini.js")).toBe(mini);
    expect(read("ui/data/places.js")).toBe(places);

    // and an existing file stays as it was
    const ok = await (await put("mini", { paint: { hall: "docks" } }, 0)).json();
    const saved = read("data/tweaks/mini.json");
    const built = read("ui/data/mini.js");
    const bad = await put("mini", { paint: { hall: "docks" }, footprints: { hall: { span: { starboard: 0.6 } } } }, ok.version);
    expect(bad.status).toBe(422);
    expect(read("data/tweaks/mini.json")).toBe(saved);
    expect(read("ui/data/mini.js")).toBe(built);
  });

  it("saves the palette through the same flow, rebuilding every place", async () => {
    const { read, url } = await setup();
    const state = await (await fetch(`${url}/api/state`)).json();
    const palette = { ...state.palette, plum: "#8e4585" };
    const res = await fetch(`${url}/api/palette`, { method: "PUT", body: JSON.stringify({ json: palette, version: state.tweaks.palette.version }) });
    expect(res.status).toBe(200);
    expect((await res.json()).changed).toEqual(["hull-skiff", "mini", "tub", "wheelie"]);
    expect(JSON.parse(read("data/tweaks/palette.json")).plum).toBe("#8e4585");
    expect(read("ui/data/mini.js")).toContain('"plum": "#8e4585"');
  });

  // Review Focus 1
  it("takes two saves one at a time, the second sent before the first is answered, and keeps the second", async () => {
    const { put, read, url } = await setup();
    const first = put("mini", { paint: { hall: "docks" } }, 0);
    // The second request goes out now; its body, built from the first's answer, follows it.
    let feed;
    const body = new ReadableStream({ start: (c) => (feed = c) });
    const second = fetch(`${url}/api/tweaks/mini`, { method: "PUT", body, duplex: "half" });
    // and a save to another place, racing both builds
    const other = put("wheelie", { place: { "hub-freight": { x: 1, y: 0, z: 3 } } }, 0);
    const firstRes = await first;
    expect(firstRes.status).toBe(200);
    const { version } = await firstRes.json();
    feed.enqueue(new TextEncoder().encode(JSON.stringify({ json: { paint: { hall: "industrial" } }, version })));
    feed.close();
    const [secondRes, otherRes] = await Promise.all([second, other]);
    expect(secondRes.status).toBe(200);
    expect(otherRes.status).toBe(200);
    // builds that overlapped would each see the other's files change
    expect((await secondRes.json()).changed).toEqual(["mini"]);
    expect((await otherRes.json()).changed).toEqual(["wheelie"]);
    expect(read("data/tweaks/mini.json")).toBe(tweakText({ paint: { hall: "industrial" } }));
    expect(read("ui/data/mini.js")).toContain('"hall": "industrial"');
    expect(read("ui/data/wheelie.js")).toContain('"hub-freight"');
  });

  it("checks each save's version only once the save before it is written, so two on one version can't both win", async () => {
    const { put, read } = await setup();
    const [a, b] = await Promise.all([put("mini", { paint: { hall: "docks" } }, 0), put("mini", { paint: { hall: "industrial" } }, 0)]);
    // whichever the server takes first wins; the other's version is then stale
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const won = a.status === 200 ? "docks" : "industrial";
    expect(read("data/tweaks/mini.json")).toBe(tweakText({ paint: { hall: won } }));
  });

  // Review Focus 2
  it("refuses a save based on a version older than the file on disk, and keeps the disk's", async () => {
    const { put, read, root, url } = await setup();
    const state = await (await fetch(`${url}/api/state`)).json();
    const file = join(root, "data/tweaks/kilmar.json");
    const hand = tweakText({ ...state.tweaks.kilmar.json, paint: { market: "docks" } });
    writeFileSync(file, hand);
    const later = new Date(Date.now() + 5000);
    utimesSync(file, later, later);
    const res = await put("kilmar", { like: "orrin" }, state.tweaks.kilmar.version);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("changed on disk");
    expect(body.version).toBe(statSync(file).mtimeMs);
    expect(read("data/tweaks/kilmar.json")).toBe(hand);
  });

  it("refuses a save when the file is hand-edited during its candidate build, and keeps the hand edit", async () => {
    let hand = null;
    const ctx = await setup({
      // the candidate build (into a temp out dir) is where the hand edit lands
      build: async (opts) => {
        if (hand && !opts.outDir.startsWith(ctx.root)) {
          writeFileSync(join(ctx.root, "data/tweaks/kilmar.json"), hand);
          const later = new Date(Date.now() + 5000);
          utimesSync(join(ctx.root, "data/tweaks/kilmar.json"), later, later);
        }
        return build(opts);
      },
    });
    const state = await (await fetch(`${ctx.url}/api/state`)).json();
    hand = tweakText({ ...state.tweaks.kilmar.json, paint: { market: "docks" } });
    const res = await ctx.put("kilmar", { like: "orrin" }, state.tweaks.kilmar.version);
    expect(res.status).toBe(409);
    expect((await res.json()).version).toBe(statSync(join(ctx.root, "data/tweaks/kilmar.json")).mtimeMs);
    expect(ctx.read("data/tweaks/kilmar.json")).toBe(hand);
  });

  it("announces a real build that fails after its candidate passed as an error event", async () => {
    const ctx = await setup({
      build: async (opts) => {
        if (opts.outDir.startsWith(ctx.root)) throw new Error("the real build broke");
        return build(opts);
      },
    });
    const { next } = await events(ctx.url);
    const res = await ctx.put("mini", { paint: { hall: "docks" } }, 0);
    expect(res.status).toBe(500);
    expect(await next(2000)).toEqual({ type: "error", error: "the real build broke" });
  });

  it("answers a save written whose real build then fails with 500, saying it saved, and the new version", async () => {
    const ctx = await setup({
      build: async (opts) => {
        if (opts.outDir.startsWith(ctx.root)) throw new Error("the real build broke");
        return build(opts);
      },
    });
    const res = await ctx.put("mini", { paint: { hall: "docks" } }, 0);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("saved data/tweaks/mini.json, but rebuilding ui/data failed: the real build broke");
    expect(body.version).toBe(statSync(join(ctx.root, "data/tweaks/mini.json")).mtimeMs);
    expect(ctx.read("data/tweaks/mini.json")).toBe(tweakText({ paint: { hall: "docks" } }));
  });

  it("keeps the sync report's lists after a save, refreshing only orphans, unplaced and noBuilder", async () => {
    const synced = JSON.parse(readFileSync(join(repo, "data/sync-report.json"), "utf8"));
    const syncReport = {
      ...synced,
      newPlaces: [{ place: "mini", builder: "decks" }],
      rooms: { added: [{ place: "mini", id: "mini.locker" }], removed: [], renamed: [] },
      orphans: [{ place: "wheelie", key: "paint.stale" }],
      unplaced: [{ place: "wheelie", id: "wheelie.stale" }],
      noBuilder: [{ place: "stale", file: "content/areas/stale.yaml" }],
    };
    const { put, url } = await setup({ syncReport });
    expect((await put("mini", { paint: { hall: "docks", nowhere: "docks" } }, 0)).status).toBe(200);
    const { report } = await (await fetch(`${url}/api/state`)).json();
    expect(report.newPlaces).toEqual(syncReport.newPlaces);
    expect(report.rooms).toEqual(syncReport.rooms);
    expect(report.commit).toBe(syncReport.commit);
    expect(report.orphans).toEqual([{ place: "mini", key: "paint.nowhere" }]);
    expect(report.unplaced).toEqual([{ place: "wheelie", id: "wheelie.hub-freight" }]);
    expect(report.noBuilder).toEqual([]);
  });

  it("names a trial build's file as data/tweaks/<file>, not the temp copy, and says nothing was written", async () => {
    const { put, url } = await setup();
    const { tweaks } = await (await fetch(`${url}/api/state`)).json();
    const json = { ...tweaks.kilmar.json, hull: { 2: [[0, 0], [2, 2], [2, 0], [0, 2]] } };
    const res = await put("kilmar", json, tweaks.kilmar.version);
    expect(res.status).toBe(422);
    const { error } = await res.json();
    expect(error).toMatch(/^data\/tweaks\/kilmar\.json: hull\.2 crosses itself/);
    expect(error).toMatch(/Nothing written$/);
    expect(error).not.toContain(tmpdir());
  });

  it("refuses a request for another host, against DNS rebinding", async () => {
    const { url } = await setup();
    const { port } = new URL(url);
    const status = (host) =>
      new Promise((resolve, reject) => {
        const req = request({ host: "localhost", port, path: "/api/state", headers: { host } }, (res) => {
          res.resume();
          resolve(res.statusCode);
        });
        req.on("error", reject);
        req.end();
      });
    expect(await status(`evil.example:${port}`)).toBe(403);
    expect(await status("localhost:1")).toBe(403);
    expect(await status(`127.0.0.1:${port}`)).toBe(200);
    expect(await status(`localhost:${port}`)).toBe(200);
  });

  it("lists a tweak file that isn't JSON with its error, not failing the state", async () => {
    const { root, url } = await setup();
    writeFileSync(join(root, "data/tweaks/mini.json"), "{ nope");
    const res = await fetch(`${url}/api/state`);
    expect(res.status).toBe(200);
    const { tweaks } = await res.json();
    expect(tweaks.mini.json).toBeNull();
    expect(tweaks.mini.version).toBe(statSync(join(root, "data/tweaks/mini.json")).mtimeMs);
    expect(tweaks.mini.error).toMatch(/JSON/);
    expect(tweaks.orrin.json).toBeTruthy();
  });

  it("refuses a body over 1 MB with 413, writing nothing", async () => {
    const { put, root } = await setup();
    const res = await put("mini", { paint: { hall: "docks" }, pad: "x".repeat(1024 * 1024) }, 0);
    expect(res.status).toBe(413);
    expect(existsSync(join(root, "data/tweaks/mini.json"))).toBe(false);
  });

  // Review Focus 5
  it("refuses names that aren't a plain tweak name, and writes nothing", async () => {
    const { put, root, dir } = await setup();
    const tweaks = readdirSync(join(root, "data/tweaks")).sort();
    const data = readdirSync(join(root, "data")).sort();
    for (const name of ["..%2Fx", "%2Ftmp%2Fx", "orrin.txt", "palette", "Orrin", "..%2F..%2Fetc%2Fx"]) {
      const res = await put(name, { paint: {} }, 0);
      expect(res.status, name).toBe(400);
    }
    expect(readdirSync(join(root, "data/tweaks")).sort()).toEqual(tweaks);
    expect(readdirSync(join(root, "data")).sort()).toEqual(data);
    expect(existsSync(join(root, "x"))).toBe(false);
    expect(existsSync(join(dir, "x"))).toBe(false);
    expect(existsSync("/tmp/x.json")).toBe(false);
  });

  it("refuses a body that isn't {json, version}", async () => {
    const { url } = await setup();
    const res = await fetch(`${url}/api/tweaks/mini`, { method: "PUT", body: "not json" });
    expect(res.status).toBe(400);
  });

  it("announces a hand edit in data/tweaks as a built event within 2 s", async () => {
    const { root, url } = await setup();
    const { next } = await events(url);
    writeFileSync(join(root, "data/tweaks/mini.json"), tweakText({ paint: { hall: "docks" } }));
    const event = await next(2000);
    expect(event.type).toBe("built");
    expect(event.changed).toEqual(["mini"]);
    expect(typeof event.version).toBe("number");
  });

  it("announces its own save once, not again when the watcher sees the write", async () => {
    const { put, url } = await setup();
    const { next, seen } = await events(url);
    expect((await put("mini", { paint: { hall: "docks" } }, 0)).status).toBe(200);
    const event = await next(2000);
    expect(event).toMatchObject({ type: "built", changed: ["mini"] });
    await new Promise((r) => setTimeout(r, 600));
    expect(seen).toEqual([]);
  });

  it("listens on the port --port names", async () => {
    const free = createServer();
    await new Promise((done) => free.listen(0, "localhost", done));
    const { port } = free.address();
    await new Promise((done) => free.close(done));
    const child = spawn(process.execPath, [join(repo, "dev/edit-server.mjs"), "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
    cleanup.push(() => child.kill());
    let out = "";
    await new Promise((done, fail) => {
      const timer = setTimeout(() => fail(new Error(`no URL printed: ${out}`)), 5000);
      child.stdout.on("data", (chunk) => {
        out += chunk;
        if (out.includes("\n")) (clearTimeout(timer), done());
      });
      child.on("exit", (code) => (clearTimeout(timer), fail(new Error(`exited ${code}: ${out}`))));
    });
    expect(out).toBe(`Editor: http://localhost:${port}/dev/edit.html\n`);
  });
});
