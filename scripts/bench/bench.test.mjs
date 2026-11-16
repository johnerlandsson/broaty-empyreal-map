import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compare, table } from "./report.mjs";
import { SCENARIOS, sessionText } from "./scenarios.mjs";

const replay = new URL("./replay.lua", import.meta.url).pathname;
const sample = new URL("../../tests/fixtures/sample.mallardlog", import.meta.url).pathname;
const lua = (...args) => JSON.parse(execFileSync("lua", [replay, ...args], { encoding: "utf8" }));

describe("bench Lua replay", () => {
  it("counts the frames Mallard would deliver, with their JSON bytes, the same every run", () => {
    const a = lua("--runs", "2", sample);
    const b = lua("--runs", "1", sample);
    // Room.Info isn't subscribed; the "not json" line is skipped
    expect(a.gmcp_frames_in_logs).toBe(10);
    expect(a.delivered.total).toEqual({ n: 9, bytes: 2454 });
    expect(a.delivered.by_package["mudstd.room.info"].n).toBe(5);
    expect(a.posts.by_name.location.n).toBe(9);
    expect(a.cpu_ms.runs).toHaveLength(2);
    for (const k of ["delivered", "posts", "storage_set", "panel_to_lua", "ignored_by_plugin"]) expect(b[k]).toEqual(a[k]);
  });

  it("sizes a delivery as the bytes of its JSON in the log", () => {
    const lines = readFileSync(sample, "utf8").split("\n").filter((l) => l.includes('"kind":"gmcp"'));
    let bytes = 0;
    for (const l of lines) {
      try {
        const e = JSON.parse(l).event;
        if (e.package !== "Room.Info") bytes += JSON.stringify(e.data).length;
      } catch {}
    }
    expect(lua("--runs", "0", sample).delivered.total.bytes).toBe(bytes);
  });

  it("matches gmcp.on prefixes at a dot, plays the panel's posts back and counts them", () => {
    const dir = mkdtempSync(join(tmpdir(), "bench-"));
    try {
      const log = join(dir, "s.mallardlog");
      const rec = (pkg, data) => JSON.stringify({ kind: "protocol", event: { kind: "gmcp", package: pkg, data }, t: 1000 });
      writeFileSync(
        log,
        [
          rec("Empyreal.Room.People", { people: [] }), // under Empyreal.Room: delivered, then ignored
          rec("Empyreal.Roomy", {}), // not at a dot: never delivered
          rec("char.status", { name: "Bench" }), // any casing
        ].join("\n") + "\n",
      );
      const posts = join(dir, "p.jsonl");
      writeFileSync(posts, JSON.stringify({ after: 3, name: "land-save", data: { who: "bench", record: { places: {} } } }) + "\n");
      const r = lua("--runs", "1", "--panel", posts, log);
      expect(Object.keys(r.delivered.by_package).sort()).toEqual(["Empyreal.Room.People", "char.status"]);
      expect(r.ignored_by_plugin).toBe(1);
      expect(r.panel_to_lua.by_name["land-save"]).toEqual({ n: 1, bytes: JSON.stringify({ who: "bench", record: { places: {} } }).length });
      expect(r.storage_set.by_key["land:*"].n).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs every scenario through the plugin, with a window mark", () => {
    const dir = mkdtempSync(join(tmpdir(), "bench-"));
    try {
      for (const s of SCENARIOS) {
        const f = join(dir, `${s.name}.mallardlog`);
        const stream = join(dir, `${s.name}.jsonl`);
        writeFileSync(f, sessionText(s));
        lua("--runs", "0", "--stream", stream, f);
        const lines = readFileSync(stream, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
        expect(lines.filter((l) => l.mark === "window"), s.name).toHaveLength(1);
        expect(lines.some((l) => l.name === "location"), s.name).toBe(true);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("bench report", () => {
  const result = (over = {}) => ({
    meta: { branch: "main", commit: "abc", runs: 5, seconds: 30, logs: ["a"] },
    lua: {
      delivered: { total: { n: 9, bytes: 100 }, by_package: { "Ship.List": { n: 9, bytes: 100 } } },
      posts: { total: { n: 2, bytes: 20 }, by_name: { location: { n: 2, bytes: 20 } } },
      storage_set: { total: { n: 0, bytes: 0 }, by_key: [] },
      panel_to_lua: { total: { n: 0, bytes: 0 }, by_name: [] },
      ignored_by_plugin: 0,
      cpu_ms: { runs: [1, 2, 3], median: 2, panel_median: 0, by_package_median: { "Ship.List": 2 } },
      ...over,
    },
    panel: null,
  });

  it("prints a table", () => {
    expect(table(result())).toContain("Ship.List");
  });

  it("lists the counts that changed and every timing", () => {
    const next = result({ posts: { total: { n: 1, bytes: 10 }, by_name: { location: { n: 1, bytes: 10 } } } });
    const text = compare(result(), next);
    expect(text).toMatch(/lua\.posts\.by_name\.location\.n\s+2\s+1\s+-1\s+-50\.0%/);
    expect(text).toMatch(/lua\.cpu_ms\.median/);
    expect(text).not.toMatch(/lua\.delivered\.total\.n/);
  });
});
