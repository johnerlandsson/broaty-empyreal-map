// The unsaved edits: added per file, dropped where a file is back as it was read, and taken over
// to a file changed on disk.

import { describe, expect, it } from "vitest";
import { addHullPoint, setHull, setPaint } from "./ops.js";
import { countOf, jsonOf, markedStale, rebased, staleOf, withEdit } from "./pending.js";

const ORRIN = { json: { paint: { market: "concourse" } }, version: 3 };

describe("pending edits", () => {
  it("runs each edit over the file as read, and counts them", () => {
    let p = withEdit({}, "orrin", ORRIN, (t) => setPaint(t, "market", "docks"));
    p = withEdit(p, "orrin", ORRIN, (t) => setPaint(t, "berth", "docks"));
    p = withEdit(p, "palette", { json: {}, version: 1 }, (t) => ({ ...t, plum: "#8e4585" }));
    expect(jsonOf(p)).toEqual({ orrin: { paint: { market: "docks", berth: "docks" } }, palette: { plum: "#8e4585" } });
    expect(p.orrin.version).toBe(3);
    expect(countOf(p)).toBe(3);
    expect(ORRIN.json.paint.market).toBe("concourse");
  });

  it("drops a file the edits bring back to how it was read", () => {
    let p = withEdit({}, "orrin", ORRIN, (t) => setPaint(t, "market", "docks"));
    p = withEdit(p, "orrin", ORRIN, (t) => setPaint(t, "market", "concourse"));
    expect(p).toEqual({});
  });

  it("reads a file with none on disk as empty, at version 0", () => {
    const p = withEdit({}, "mini", undefined, (t) => setPaint(t, "hall", "docks"));
    expect(p.mini).toMatchObject({ json: { paint: { hall: "docks" } }, version: 0, base: {} });
  });

  it("takes the edits over to a file changed on disk, running them again over it", () => {
    let p = withEdit({}, "orrin", ORRIN, (t) => setHull(t, "3", [[0, 0], [1, 0], [1, 1]]));
    p = withEdit(p, "orrin", ORRIN, (t) => addHullPoint(t, "3", 2, [0, 1]));
    const disk = { orrin: { json: { paint: { market: "docks" } }, version: 9 } };
    const { pending, moved } = rebased(p, disk);
    expect(moved).toEqual(["orrin"]);
    expect(pending.orrin.version).toBe(9);
    expect(pending.orrin.json).toEqual({ paint: { market: "docks" }, hull: { 3: [[0, 0], [1, 0], [1, 1], [0, 1]] } });
    expect(countOf(pending)).toBe(2);
  });

  it("leaves a file unchanged on disk as it was", () => {
    const p = withEdit({}, "orrin", ORRIN, (t) => setPaint(t, "market", "docks"));
    expect(rebased(p, { orrin: ORRIN })).toEqual({ pending: p, moved: [], saved: [], stale: [] });
  });

  it("drops a file now on disk as its pending JSON: this page's save, not applied twice", () => {
    const p = withEdit({}, "orrin", ORRIN, (t) => addHullPoint(setHull(t, "3", [[0, 0], [1, 0], [1, 1]]), "3", 2, [0, 1]));
    const { pending, saved } = rebased(p, { orrin: { json: structuredClone(p.orrin.json), version: 10 } });
    expect(pending).toEqual({});
    expect(saved).toEqual(["orrin"]);
  });

  it("marks stale a file whose edits no longer run over it, or that no longer parses, keeping its JSON", () => {
    let p = withEdit({}, "orrin", { json: { hull: { 3: [[0, 0], [1, 0], [1, 1]] } }, version: 3 }, (t) => addHullPoint(t, "3", 2, [0, 1]));
    p = withEdit(p, "kilmar", { json: {}, version: 1 }, (t) => setPaint(t, "market", "docks"));
    const { pending, stale } = rebased(p, { orrin: { json: {}, version: 4 }, kilmar: { json: null, version: 2, error: "data/tweaks/kilmar.json: bad JSON" } });
    expect(stale).toEqual(["orrin", "kilmar"]);
    expect(pending.orrin.stale).toMatch(/no path of its own/);
    expect(pending.orrin.json).toEqual(p.orrin.json);
    expect(pending.kilmar.stale).toMatch(/bad JSON/);
    expect(staleOf(pending)).toEqual(["orrin", "kilmar"]);
    expect(staleOf(markedStale(p, ["kilmar"], "refused"))).toEqual(["kilmar"]);
  });
});
