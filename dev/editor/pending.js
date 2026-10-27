// The editor's unsaved edits, by tweak file (a place's name, or "palette"): the file as the page
// last read it (its JSON and version) and each edit made on it since, in order, each one of
// ops.js's (a function from a tweak to a new one). Its pending JSON is those edits run over the
// file. A file changed on disk under them (a hand edit) takes them again over what's there now; a
// file left as it was read has nothing pending. Each function returns a new set and never changes
// the one it was given. No DOM, no Node; the editor page loads it.

import { ordered } from "./ops.js";

const same = (a, b) => JSON.stringify(ordered(a ?? {})) === JSON.stringify(ordered(b ?? {}));

/**
 * The set with `edit` made on the file `name`, read as `entry` ({json, version}) where nothing is
 * pending on it yet. Throws what the edit throws. A file the edits bring back to how it was read
 * leaves the set.
 * @param {Record<string, {json: object, version: number, base: object, edits: Function[], stale?: string}>} pending
 * @param {string} name
 * @param {{json?: object | null, version?: number}} entry
 * @param {(t: object) => object} edit
 */
export function withEdit(pending, name, entry, edit) {
  const cur = pending[name] ?? { base: entry?.json ?? {}, version: entry?.version ?? 0, edits: [], json: entry?.json ?? {} };
  const json = edit(cur.json);
  const out = { ...pending };
  if (same(json, cur.base)) delete out[name];
  else out[name] = { ...cur, edits: [...cur.edits, edit], json };
  return out;
}

/**
 * The set with each file changed on disk since it was read taken over to the file as it is now,
 * `tweaks` being the state's ({name: {json, version, error?}}): its edits run again over the new
 * JSON. A file now as its pending JSON (this page's own save) leaves the set. One whose edits no
 * longer run, or that no longer parses, keeps its pending JSON and is marked `stale` with why.
 * @returns {{pending: object, moved: string[], saved: string[], stale: string[]}}
 */
export function rebased(pending, tweaks) {
  const out = {};
  const moved = [];
  const saved = [];
  const stale = [];
  for (const [name, p] of Object.entries(pending)) {
    const entry = tweaks?.[name] ?? { json: {}, version: 0 };
    if (entry.version === p.version && !entry.error) {
      out[name] = p;
      continue;
    }
    if (entry.error) {
      out[name] = { ...p, stale: entry.error };
      stale.push(name);
      continue;
    }
    if (same(entry.json, p.json)) {
      saved.push(name);
      continue;
    }
    try {
      const json = p.edits.reduce((t, edit) => edit(t), entry.json ?? {});
      if (!same(json, entry.json)) out[name] = { base: entry.json ?? {}, version: entry.version, edits: p.edits, json };
      moved.push(name);
    } catch (err) {
      out[name] = { ...p, stale: err.message };
      stale.push(name);
    }
  }
  return { pending: out, moved, saved, stale };
}

/** The set with `names` marked stale for `why`. */
export function markedStale(pending, names, why) {
  const out = { ...pending };
  for (const name of names) if (out[name]) out[name] = { ...out[name], stale: why };
  return out;
}

/** Each file's pending JSON, by name. */
export const jsonOf = (pending) => Object.fromEntries(Object.entries(pending).map(([name, p]) => [name, p.json]));

/** How many edits are pending, over every file. */
export const countOf = (pending) => Object.values(pending).reduce((n, p) => n + p.edits.length, 0);

/** The files whose edits no longer apply over what's on disk. */
export const staleOf = (pending) => Object.keys(pending).filter((name) => pending[name].stale != null);
