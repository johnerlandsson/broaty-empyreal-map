// The bench's readable table, and the deltas between two results (docs/maps/bench.md).

const kb = (b) => (b / 1024).toFixed(1);
const ms = (x) => x.toFixed(2);
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

function rows(head, list, widths) {
  const line = (cells) => cells.map((c, i) => (i === 0 ? pad(c, widths[i]) : lpad(c, widths[i]))).join("  ");
  return [line(head), line(widths.map((w) => "-".repeat(w))), ...list.map(line)].join("\n");
}

const sorted = (obj, by) => Object.entries(obj ?? {}).sort((a, b) => by(b[1]) - by(a[1]) || (a[0] < b[0] ? -1 : 1));

/** The result as text tables. */
export function table(r) {
  const out = [];
  const m = r.meta ?? {};
  out.push(`empyreal-map bench: ${m.branch} ${m.commit}, ${m.date}, ${m.runs} runs, ${m.seconds} s windows, cpus ${m.cpus}, load ${m.host?.load?.join(" ")}`);
  out.push(`logs: ${(m.logs ?? []).join(", ")}`);

  const L = r.lua;
  if (L) {
    const cpu = L.cpu_ms;
    out.push("", `LUA  ${L.delivered.total.n} GMCP deliveries, ${kb(L.delivered.total.bytes)} KB JSON; CPU median ${ms(cpu.median)} ms (runs ${cpu.runs.map(ms).join(" ")})`);
    out.push(
      rows(
        ["delivered package", "n", "KB", "cpu ms"],
        sorted(L.delivered.by_package, (e) => e.bytes).map(([k, e]) => [k, e.n, kb(e.bytes), ms(cpu.by_package_median[k] ?? 0)]),
        [24, 7, 10, 8],
      ),
    );
    out.push("", rows(["post to panel", "n", "KB"], sorted(L.posts.by_name, (e) => e.bytes).map(([k, e]) => [k, e.n, kb(e.bytes)]), [24, 7, 10]));
    out.push(`total ${L.posts.total.n} posts, ${kb(L.posts.total.bytes)} KB`);
    out.push("", rows(["storage.set", "n", "KB"], sorted(L.storage_set.by_key, (e) => e.bytes).map(([k, e]) => [k, e.n, kb(e.bytes)]), [24, 7, 10]));
    out.push("", rows(["panel post to Lua", "n", "KB"], sorted(L.panel_to_lua.by_name, (e) => e.bytes).map(([k, e]) => [k, e.n, kb(e.bytes)]), [24, 7, 10]));
    out.push(`panel handlers' CPU median ${ms(cpu.panel_median)} ms; ${L.ignored_by_plugin} deliveries ignored by the plugin`);
  }

  const P = r.panel;
  if (P?.session) {
    const s = P.session;
    const c = s.counts;
    out.push("", `PANEL session replay: ${s.messages} messages (${s.fake_seconds_run} s of fake time run), ${s.wall_s.toFixed(1)} s wall, WebKit web CPU ${s.cpu_s.web.toFixed(2)} s (all ${s.cpu_s.all.toFixed(2)} s, one run)`);
    out.push(`  raf ${c.raf}, timeouts ${c.timeouts}, intervals ${c.intervals}, nodes added svg ${c.nodes.svg} html ${c.nodes.html} text ${c.nodes.text}`);
    out.push(`  draws: ${sorted(c.draws, (n) => n).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}`);
  }
  if (P?.scenarios) {
    out.push("", `PANEL idle scenarios, ${P.seconds} s each (counts on the fake clock; CPU real time, median of ${P.runs})`);
    out.push(
      rows(
        ["scenario", "draws", "raf/s", "timers/s", "svg+", "html+", "web cpu s", "all cpu s"],
        Object.entries(P.scenarios).map(([k, v]) => [
          k,
          Object.values(v.counts.draws).reduce((a, b) => a + b, 0),
          v.per_s.raf,
          v.per_s.timers,
          v.counts.nodes.svg,
          v.counts.nodes.html,
          v.cpu_s.web_median.toFixed(2),
          v.cpu_s.all_median.toFixed(2),
        ]),
        [16, 7, 7, 8, 8, 7, 9, 9],
      ),
    );
    for (const [k, v] of Object.entries(P.scenarios)) {
      out.push(`  ${pad(k, 16)} ${sorted(v.counts.draws, (n) => n).map(([c, n]) => `${c} ${n}`).join(", ") || "no draws"}${v.document_hidden ? " (document.hidden)" : ""}`);
    }
  }
  return out.join("\n");
}

// Time-like leaves vary run to run; everything else is a count and should match exactly.
const TIMED = /cpu|wall/i;
const SKIP = /^(meta|panel\.processes|panel\.(seconds|runs|cap_ms|viewport))|_runs$|\.runs$|\.runs\.|^lua\.cpu_ms\.runs/;

function flatten(v, prefix, out) {
  if (typeof v === "number") out[prefix] = v;
  else if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, x] of Object.entries(v)) flatten(x, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

/** Deltas from base to next: every count that changed, and every timing. */
export function compare(base, next, nameA = "base", nameB = "new") {
  const a = flatten(base, "", {});
  const b = flatten(next, "", {});
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !SKIP.test(k)).sort();
  const counts = [];
  const times = [];
  let same = 0;
  for (const k of keys) {
    const x = a[k] ?? 0;
    const y = b[k] ?? 0;
    const d = y - x;
    const pct = x === 0 ? (y === 0 ? "" : "new") : `${d >= 0 ? "+" : ""}${((d / x) * 100).toFixed(1)}%`;
    const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(3));
    const row = [k, fmt(x), fmt(y), `${d >= 0 ? "+" : ""}${fmt(d)}`, pct];
    if (TIMED.test(k)) times.push(row);
    else if (d !== 0) counts.push(row);
    else same++;
  }
  const w = [Math.max(10, ...keys.map((k) => k.length)), 12, 12, 12, 8];
  const head = ["", nameA, nameB, "delta", "%"];
  const out = [`base ${base.meta?.branch} ${base.meta?.commit} → new ${next.meta?.branch} ${next.meta?.commit}`];
  if (base.meta?.runs !== next.meta?.runs || base.meta?.seconds !== next.meta?.seconds || String(base.meta?.logs) !== String(next.meta?.logs)) {
    out.push("WARNING: the two were run with different logs, runs or windows; the counts don't compare");
  }
  out.push("", "COUNTS that changed (these are exact):", counts.length ? rows(head, counts, w) : "  none", `  (${same} counts unchanged)`);
  out.push("", "TIMINGS (medians; trust only differences well past the run-to-run spread):", rows(head, times, w));
  return out.join("\n");
}
