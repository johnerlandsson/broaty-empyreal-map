import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRANCHES, LANES, SYSTEMS, agoText, cleanLanes, laneFix, laneName, laneState } from "./lanes.js";

const GAME = join(homedir(), "dev/empyreal/content/game");
const galaxy = join(GAME, "galaxy.yaml");
const system = join(GAME, "system.yaml");

describe("the topology", () => {
  it("has six systems, five trunks in a chain and two branches", () => {
    expect(SYSTEMS.map((s) => s.id)).toEqual(["petroc", "keyne", "senara", "maelor", "elowen", "mabyn"]);
    const trunks = LANES.filter((l) => l.class === "trunk");
    expect(trunks).toHaveLength(5);
    for (let i = 0; i < 5; i++) expect(trunks[i].between).toEqual([SYSTEMS[i].id, SYSTEMS[i + 1].id]);
    expect(BRANCHES.map((b) => b.id)).toEqual(["maelor-petroc", "keyne-mabyn"]);
  });

  it("names every lane by its two stars sorted, as the Lua side does from a mouth", () => {
    for (const l of LANES) expect(l.id).toBe([...l.between].sort().join("-"));
  });

  it.skipIf(!existsSync(galaxy))("matches galaxy.yaml's lanes, ids, classes and ends, and its stars inner to outer", () => {
    const text = readFileSync(galaxy, "utf8");
    const lanes = [...text.matchAll(/- \{ id: ([\w-]+), class: (\w+), between: \[(\w+), (\w+)\]/g)].map((m) => ({
      id: m[1],
      class: m[2],
      between: [m[3], m[4]].sort(),
    }));
    const ours = LANES.map((l) => ({ id: l.id, class: l.class, between: [...l.between].sort() }));
    const byId = (a, b) => a.id.localeCompare(b.id);
    expect(ours.sort(byId)).toEqual(lanes.sort(byId));
    const stars = [...text.matchAll(/- \{ id: (\w+), a: ([\d.]+)/g)].map((m) => ({ id: m[1], a: Number(m[2]) }));
    expect(SYSTEMS.map((s) => s.id)).toEqual(stars.sort((x, y) => x.a - y.a).map((s) => s.id));
  });

  it.skipIf(!existsSync(system))("matches system.yaml's stations and ports, star by star", () => {
    const bodies = readFileSync(system, "utf8")
      .split(/\n {2}- id: /)
      .slice(1)
      .map((chunk) => ({
        id: chunk.split("\n")[0].trim(),
        name: /\n {4}name: (.+)/.exec(chunk)?.[1].trim(),
        kind: /\n {4}kind: (\w+)/.exec(chunk)?.[1],
        parent: /\n {4}(?:orbit|surface): \{ parent: (\w+)/.exec(chunk)?.[1] ?? null,
      }));
    const byId = new Map(bodies.map((b) => [b.id, b]));
    const starOf = (b) => (b.parent ? starOf(byId.get(b.parent)) : b.id);
    for (const s of SYSTEMS) {
      const want = bodies.filter((b) => (b.kind === "station" || b.kind === "port") && starOf(b) === s.id);
      expect(s.stations.map((x) => x.id).sort(), s.id).toEqual(want.map((b) => b.id).sort());
      for (const st of s.stations) {
        // T.I.S.S. goes by its short name, as the game's room names have it
        if (st.id !== "tiss") expect(st.name).toBe(byId.get(st.id).name);
      }
      expect(s.name).toBe(byId.get(s.id).name);
    }
  });
});

describe("laneName", () => {
  it("joins its stars inner first", () => {
    expect(laneName("maelor-petroc")).toBe("Petroc–Maelor");
    expect(laneName("nope")).toBe("nope");
  });
});

describe("cleanLanes", () => {
  it("keeps the good and drops the odd", () => {
    const m = cleanLanes({
      system: "senara",
      visible: ["maelor-senara", 3],
      seen: { "maelor-petroc": { open: true, at: 5 }, "keyne-mabyn": { open: "y", at: 1 }, x: null },
      transit: { lane: "maelor-senara", from: "senara", to: "maelor", progress: 0.4, eta: 220, received: 100 },
    });
    expect(m).toEqual({
      system: "senara",
      visible: ["maelor-senara"],
      seen: { "maelor-petroc": { open: true, at: 5 } },
      transit: { lane: "maelor-senara", from: "senara", to: "maelor", progress: 0.4, eta: 220, received: 100 },
    });
  });

  it("takes an empty table sent as an array, junk and nothing", () => {
    const empty = { system: null, visible: [], seen: {}, transit: null };
    expect(cleanLanes({ seen: [], visible: {} })).toEqual(empty);
    expect(cleanLanes(null)).toEqual(empty);
    expect(cleanLanes({ transit: { lane: "nowhere", from: "a", to: "b" } }).transit).toBe(null);
  });
});

describe("laneState", () => {
  const lanes = cleanLanes({
    visible: ["maelor-petroc"],
    seen: { "maelor-petroc": { open: false, at: 1000 }, "keyne-mabyn": { open: true, at: 1000 } },
  });
  it("says now while a mouth of it is here", () => {
    expect(laneState(lanes, "maelor-petroc", 5_000_000)).toEqual({ open: false, now: true, words: "closed · now" });
  });
  it("says when it was last seen otherwise", () => {
    expect(laneState(lanes, "keyne-mabyn", 1000_000 + 2 * 3600_000 + 10 * 60_000)).toEqual({
      open: true,
      now: false,
      words: "open · seen 2h 10m ago",
    });
  });
  it("says not seen for a lane never seen", () => {
    expect(laneState(cleanLanes({}), "keyne-mabyn", 0)).toEqual({ open: null, now: false, words: "not seen" });
  });
});

describe("agoText", () => {
  it("picks the two largest units", () => {
    expect(agoText(0)).toBe("0m");
    expect(agoText(-5)).toBe("0m");
    expect(agoText(3 * 86400_000 + 4 * 3600_000)).toBe("3d 4h");
  });
});

describe("laneFix", () => {
  it("runs from her status's progress to the far mouth at her eta", () => {
    const tr = { progress: 0.5, eta: 100, received: 1000 };
    expect(laneFix(tr, 1000_000)).toEqual({ k: 0.5, left: 100 });
    expect(laneFix(tr, 1050_000)).toEqual({ k: 0.75, left: 50 });
    expect(laneFix(tr, 1200_000)).toEqual({ k: 1, left: 0 });
  });
  it("holds at her progress with no eta, and is nothing with no transit", () => {
    expect(laneFix({ progress: 0.3, eta: null, received: null }, 0)).toEqual({ k: 0.3, left: null });
    expect(laneFix(null, 0)).toBe(null);
  });
});
