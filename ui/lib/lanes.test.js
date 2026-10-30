import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRANCHES, LANES, MID, R, RING, SYSTEMS, agoText, cleanLanes, lane, laneFix, laneName, lanePath, lanesOf, laneState, layout, openHere,
  seenOpenElsewhere, contactOf, contactWords,
} from "./lanes.js";

const GAME = join(homedir(), "dev/empyreal/content/game");
const galaxy = join(GAME, "galaxy.yaml");
const system = join(GAME, "system.yaml");
const help = join(homedir(), "dev/empyreal/content/help/lanes.md");

describe("the topology", () => {
  it("has the Shallows' twelve round the ring, then the Mid's eight", () => {
    expect(RING.map((s) => s.id)).toEqual([
      "petroc", "keyne", "senara", "maelor", "elowen", "mabyn", "piran", "breage", "euny", "madron", "germoe", "feock",
    ]);
    expect(MID.map((s) => s.id)).toEqual(["hensbarrow", "goonhilly", "dozmary", "godolphin", "trencrom", "kilmar", "garrow", "caradon"]);
    expect(SYSTEMS).toEqual([...RING, ...MID]);
    expect(SYSTEMS.filter((s) => s.deep).map((s) => s.id)).toEqual(["dozmary", "garrow"]);
    expect(SYSTEMS.filter((s) => !s.relay).map((s) => s.id)).toEqual(["hensbarrow", "goonhilly", "dozmary", "godolphin", "trencrom"]);
  });

  it("has a lane for every pair: twelve trunks round the ring, and 178 branches", () => {
    expect(LANES).toHaveLength((20 * 19) / 2);
    const trunks = LANES.filter((l) => l.class === "trunk");
    expect(trunks).toHaveLength(12);
    for (let i = 0; i < 12; i++) expect(trunks.map((l) => l.id)).toContain([RING[i].id, RING[(i + 1) % 12].id].sort().join("-"));
    expect(BRANCHES).toHaveLength(178);
    expect(LANES.filter((l) => l.class === "branch")).toHaveLength(66 - 12);
    expect(lane("dozmary-senara").class).toBe("mid");
    expect(lane("dozmary-garrow").class).toBe("mid");
    expect(lane("maelor-petroc").class).toBe("branch");
    expect(lane("nope")).toBe(undefined);
    expect(lanesOf("senara")).toHaveLength(19);
  });

  it("names every lane by its two stars sorted, as the Lua side does from a mouth", () => {
    for (const l of LANES) expect(l.id).toBe([...l.between].sort().join("-"));
    expect(new Set(LANES.map((l) => l.id)).size).toBe(LANES.length);
  });

  it("has the same stars as the Lua side", () => {
    const lua = readFileSync(new URL("../../src/station_map/lanes.lua", import.meta.url), "utf8");
    const block = /N\.STARS = \{([^}]*)\}/.exec(lua)[1];
    expect([...block.matchAll(/'(\w+)'/g)].map((m) => m[1])).toEqual(SYSTEMS.map((s) => s.id));
  });

  it.skipIf(!existsSync(galaxy))("matches galaxy.yaml's stars, bands and relays, its trunks, and a branch for every other pair", () => {
    const text = readFileSync(galaxy, "utf8");
    const stars = [...text.matchAll(/^ {4}- \{ id: (\w+), a: [^}]*\}/gm)].map((m) => ({
      id: m[1],
      band: /band: (\w+)/.exec(m[0])?.[1] ?? "shallows",
      relay: /relay: true/.test(m[0]),
    }));
    expect(SYSTEMS.map((s) => ({ id: s.id, band: s.band, relay: s.relay }))).toEqual(stars);
    const trunks = [...text.matchAll(/- \{ id: ([\w-]+), class: (\w+), between: \[(\w+), (\w+)\]/g)].map((m) => ({
      id: m[1],
      class: m[2],
      between: [m[3], m[4]].sort(),
    }));
    expect(trunks.every((l) => l.class === "trunk")).toBe(true);
    const ours = (cls) => LANES.filter((l) => l.class === cls).map((l) => ({ id: l.id, class: l.class, between: [...l.between].sort() }));
    const byId = (a, b) => a.id.localeCompare(b.id);
    expect(ours("trunk").sort(byId)).toEqual(trunks.sort(byId));
    const band = Object.fromEntries(stars.map((s) => [s.id, s.band]));
    const trunkIds = new Set(trunks.map((l) => l.id));
    const want = [];
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const [a, b] = [stars[i].id, stars[j].id];
        const id = [a, b].sort().join("-");
        if (!trunkIds.has(id)) want.push({ id, class: band[a] === "mid" || band[b] === "mid" ? "mid" : "branch" });
      }
    }
    expect(BRANCHES.map((l) => ({ id: l.id, class: l.class })).sort(byId)).toEqual(want.sort(byId));
    expect(text).toMatch(/\n {4}mid:\n/); // the class the Mid's branches are
  });

  it.skipIf(!existsSync(help))("goes round the ring as help lanes does, with the Mid that help mid names", () => {
    const text = readFileSync(help, "utf8");
    const ring = /^ {2}(Petroc \(.*)$/m.exec(text)[1];
    expect([...ring.matchAll(/(\w+) \(/g)].map((m) => m[1])).toEqual(RING.map((s) => s.name));
    expect(text).toContain(MID.map((s) => s.name).slice(0, -1).join(", ") + " and Caradon");
    expect(text).toContain("only Kilmar, Garrow and Caradon have relays");
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
  it("joins its stars ring first, then the Mid", () => {
    expect(laneName("maelor-petroc")).toBe("Petroc–Maelor");
    expect(laneName("garrow-senara")).toBe("Senara–Garrow");
    expect(laneName("nope")).toBe("nope");
  });
});

describe("cleanLanes", () => {
  it("keeps the good and drops the odd", () => {
    const m = cleanLanes({
      system: "senara",
      visible: ["maelor-senara", 3],
      uncharted: ["dozmary-senara", null],
      seen: { "maelor-petroc": { open: true, at: 5 }, "keyne-mabyn": { open: "y", at: 1 }, x: null },
      transit: { lane: "maelor-senara", from: "senara", to: "maelor", progress: 0.4, eta: 220, received: 100 },
    });
    expect(m).toEqual({
      contact: {},
      reach: null,
      system: "senara",
      visible: ["maelor-senara"],
      uncharted: ["dozmary-senara"],
      seen: { "maelor-petroc": { open: true, at: 5 } },
      transit: { lane: "maelor-senara", from: "senara", to: "maelor", progress: 0.4, eta: 220, received: 100 },
    });
  });

  it("takes an empty table sent as an array, junk and nothing", () => {
    const empty = { system: null, visible: [], uncharted: [], seen: {}, contact: {}, reach: null, transit: null };
    expect(cleanLanes({ seen: [], visible: {}, uncharted: {} })).toEqual(empty);
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
  it("says not charted for a lane of your system whose mouth isn't on your charts", () => {
    const here = cleanLanes({ system: "senara", uncharted: ["keyne-senara", "maelor-senara"],
      seen: { "maelor-senara": { open: true, at: 1000 } } });
    expect(laneState(here, "keyne-senara", 0)).toEqual({ open: null, now: false, words: "not charted" });
    // seen from the other end, it's what was seen there
    expect(laneState(here, "maelor-senara", 1000_000 + 5 * 60_000).words).toBe("open · seen 5m ago");
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

describe("openHere and seenOpenElsewhere", () => {
  const lanes = cleanLanes({
    system: "senara",
    visible: lanesOf("senara").map((l) => l.id),
    seen: {
      "keyne-senara": { open: true, at: 100 },
      "maelor-senara": { open: true, at: 100 },
      "garrow-senara": { open: true, at: 100 },
      "elowen-senara": { open: false, at: 100 },
      "maelor-petroc": { open: true, at: 50 },
      "kilmar-mabyn": { open: true, at: 90 },
      "elowen-maelor": { open: true, at: 50 },
      "caradon-maelor": { open: false, at: 50 },
    },
  });
  it("lists your system's open lanes and counts the rest closed", () => {
    const { open, closed, uncharted } = openHere(lanes);
    expect(open.map((l) => l.id)).toEqual(["keyne-senara", "maelor-senara", "garrow-senara"]);
    expect(closed).toBe(16);
    expect(uncharted).toEqual([]);
    expect(openHere(cleanLanes({}))).toEqual({ open: [], closed: 0, uncharted: [] });
  });
  it("lists the lanes not on your charts apart, open nor closed", () => {
    const fresh = cleanLanes({ system: "senara", visible: [], uncharted: lanesOf("senara").map((l) => l.id), seen: {} });
    expect(openHere(fresh)).toEqual({ open: [], closed: 0, uncharted: lanesOf("senara") });
    const some = cleanLanes({
      system: "senara",
      visible: ["maelor-senara", "elowen-senara"],
      uncharted: lanesOf("senara").map((l) => l.id).filter((id) => id !== "maelor-senara" && id !== "elowen-senara"),
      seen: { "maelor-senara": { open: true, at: 1 }, "elowen-senara": { open: false, at: 1 } },
    });
    const { open, closed, uncharted } = openHere(some);
    expect(open.map((l) => l.id)).toEqual(["maelor-senara"]);
    expect(closed).toBe(1);
    expect(uncharted.length).toBe(17);
  });
  it("lists branches seen open elsewhere, newest first, and never a trunk", () => {
    expect(seenOpenElsewhere(lanes, 100_000).map((x) => [x.lane.id, x.ago])).toEqual([
      ["kilmar-mabyn", 10_000],
      ["maelor-petroc", 50_000],
    ]);
  });
});

describe("layout", () => {
  const near = (a, b) => expect(Math.abs(a - b)).toBeLessThan(1e-9);
  it("puts the ring round from Petroc at the top, clockwise, evenly", () => {
    const { P } = layout();
    near(P.petroc.x, 0);
    near(P.petroc.y, -R);
    expect(P.keyne.x).toBeGreaterThan(0); // clockwise, y down
    for (const s of RING) near(Math.hypot(P[s.id].x, P[s.id].y), R);
    near(P.piran.y, R); // halfway round
  });
  it("puts the Mid inside, the deep two nearest the centre", () => {
    const { P, discs } = layout();
    const r = (id) => Math.hypot(P[id].x, P[id].y);
    for (const s of MID) expect(r(s.id)).toBeLessThan(discs[0].r);
    for (const s of MID.filter((x) => !x.deep)) expect(r(s.id)).toBeGreaterThan(r("dozmary"));
    expect(P.dozmary.x).toBeLessThan(0);
    expect(P.garrow.x).toBeGreaterThan(0);
    expect(discs.map((d) => d.band)).toEqual(["mid"]);
  });
  it("takes a Core in the middle, the Mid a band round it", () => {
    const core = [1, 2, 3].map((n) => ({ id: `c${n}`, name: `C${n}`, band: "core", relay: false, deep: false, stations: [] }));
    const { P, discs } = layout([...SYSTEMS, ...core]);
    expect(discs.map((d) => d.band)).toEqual(["mid", "core"]);
    const r = (id) => Math.hypot(P[id].x, P[id].y);
    for (const c of core) expect(r(c.id)).toBeLessThan(discs[1].r);
    for (const s of MID) expect(r(s.id)).toBeGreaterThan(discs[1].r);
  });
});

describe("lanePath", () => {
  const at = (id, k, l = layout()) => lanePath(lane(id), l)(k);
  it("runs from its first star to its second", () => {
    const { P } = layout();
    const p0 = at("maelor-petroc", 0);
    const p1 = at("maelor-petroc", 1);
    expect(p0.x).toBeCloseTo(P[lane("maelor-petroc").between[0]].x);
    expect(p1.y).toBeCloseTo(P[lane("maelor-petroc").between[1]].y);
  });
  it("keeps a trunk on the ring, Feock back to Petroc included", () => {
    for (const id of ["keyne-petroc", "feock-petroc"]) {
      const p = at(id, 0.5);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(R);
    }
  });
  it("bows a branch toward the centre", () => {
    const { P } = layout();
    const mid = at("elowen-senara", 0.5);
    const chordMid = Math.hypot((P.elowen.x + P.senara.x) / 2, (P.elowen.y + P.senara.y) / 2);
    expect(Math.hypot(mid.x, mid.y)).toBeLessThan(chordMid);
  });
  it("takes a Mid lane round the Core when there is one, and straight across when there isn't", () => {
    const core = [{ id: "c1", name: "C1", band: "core", relay: false, deep: false, stations: [] }];
    const l = layout([...SYSTEMS, ...core]);
    const p = lanePath(lane("dozmary-garrow"), l)(0.5);
    expect(Math.hypot(p.x, p.y)).toBeGreaterThan(l.discs[1].r);
    const q = at("dozmary-garrow", 0.5);
    expect(Math.hypot(q.x, q.y)).toBeLessThan(1e-9);
  });
});

describe("contact with the Bank", () => {
  const T = 1_000_000_000; // seconds
  const t = T * 1000;
  const H = 3600;
  const msg = (m) => cleanLanes({ system: "senara", ...m });
  const open = (at) => ({ open: true, at });
  const shut = (at) => ({ open: false, at });
  const closedAll = (star, at) =>
    Object.fromEntries(lanesOf(star).filter((l) => l.between.every((id) => SYSTEMS.find((s) => s.id === id).relay)).map((l) => [l.id, shut(at)]));

  it("has the Shallows always in contact and a star without relays always cut off, with no age", () => {
    const c = contactOf(msg({}), t);
    for (const s of RING) expect(c[s.id]).toEqual({ state: "in", at: null, now: false, fixed: true });
    for (const s of MID.filter((m) => !m.relay)) expect(c[s.id]).toEqual({ state: "out", at: null, now: false, fixed: true });
  });

  it("doesn't know a relayed Mid star with nothing seen", () => {
    expect(contactOf(msg({}), t).kilmar).toEqual({ state: "unknown", at: null, now: false, fixed: false });
  });

  it("works a chain out from what's seen, as old as its oldest lane", () => {
    const c = contactOf(msg({ visible: ["kilmar-senara"], seen: { "kilmar-senara": open(T), "caradon-kilmar": open(T - 5 * H) } }), t);
    expect(c.kilmar).toMatchObject({ state: "in", now: true });
    expect(c.caradon).toMatchObject({ state: "in", at: T - 5 * H, now: false });
  });

  it("takes the freshest way there", () => {
    const c = contactOf(msg({ seen: { "garrow-senara": open(T - 9 * H), "garrow-maelor": open(T - H) } }), t);
    expect(c.garrow.at).toBe(T - H);
  });

  it("doesn't count a pair joined only to each other, or a lane without relays at both ends", () => {
    const c = contactOf(msg({ seen: { "garrow-kilmar": open(T), "dozmary-senara": open(T), "dozmary-kilmar": open(T) } }), t);
    expect(c.kilmar.state).toBe("unknown");
    expect(c.garrow.state).toBe("unknown");
  });

  it("is cut off only when every way in is seen closed, as old as the oldest", () => {
    const seen = { ...closedAll("kilmar", T - H), "caradon-kilmar": shut(T - 2 * H) };
    expect(contactOf(msg({ seen }), t).kilmar).toMatchObject({ state: "out", at: T - 2 * H });
    const { "kilmar-senara": _, ...one } = seen;
    expect(contactOf(msg({ seen: one }), t).kilmar.state).toBe("unknown");
  });

  it("takes the live reading where you are, over what's worked out", () => {
    const cut = { system: "kilmar", visible: ["kilmar-senara"], seen: { "kilmar-senara": open(T) }, reach: { ok: false, after: T - 1 } };
    expect(contactOf(msg(cut), t).kilmar).toEqual({ state: "out", at: T, now: true, fixed: false });
    expect(contactOf(msg({ ...cut, reach: { ok: true, after: T - 1 } }), t).kilmar).toMatchObject({ state: "in", now: true });
  });

  it("ignores a live reading till it's settled", () => {
    expect(contactOf(msg({ system: "kilmar", reach: { ok: false, after: T + 5 } }), t).kilmar.state).toBe("unknown");
  });

  it("spreads a cut-off reading over the lanes open from it, so the pair is cut off", () => {
    const m = { system: "kilmar", visible: ["garrow-kilmar"], seen: { "garrow-kilmar": open(T) }, reach: { ok: false, after: T - 1 } };
    expect(contactOf(msg(m), t).garrow).toMatchObject({ state: "out", now: true });
    expect(contactOf(msg(m), t).caradon.state).toBe("unknown");
  });

  it("keeps a reading from when you left, with its age", () => {
    expect(contactOf(msg({ contact: { caradon: { ok: false, at: T - 3 * H } } }), t).caradon).toMatchObject({ state: "out", at: T - 3 * H });
    expect(contactOf(msg({ contact: { caradon: { ok: true, at: T - 3 * H } } }), t).caradon).toMatchObject({ state: "in", at: T - 3 * H });
  });

  it("goes by the newest of what it has", () => {
    const m = { contact: { kilmar: { ok: false, at: T - 3 * H } }, seen: { "kilmar-senara": open(T - H) } };
    expect(contactOf(msg(m), t).kilmar).toMatchObject({ state: "in", at: T - H });
  });

  it("says not known when what it has disagrees and is as new", () => {
    const m = { contact: { kilmar: { ok: false, at: T - H } }, seen: { "kilmar-senara": open(T - H) } };
    expect(contactOf(msg(m), t).kilmar.state).toBe("unknown");
  });

  it("gives no reading to a star's stored ok where it never had relays or always has contact", () => {
    const c = contactOf(msg({ contact: { dozmary: { ok: true, at: T }, maelor: { ok: false, at: T } } }), t);
    expect(c.dozmary.state).toBe("out");
    expect(c.maelor).toMatchObject({ state: "in", fixed: true });
  });

  it("doesn't change a star's state for its age alone", () => {
    const m = msg({ seen: { "kilmar-senara": open(T - 90 * 86400) } });
    expect(contactOf(m, t).kilmar.state).toBe("in");
  });

  it("drops odd contact from the message", () => {
    const m = cleanLanes({ contact: { kilmar: { ok: 1, at: 2 }, nope: { ok: true, at: 2 }, garrow: { ok: true, at: 3 } }, reach: { ok: "x" } });
    expect(m.contact).toEqual({ garrow: { ok: true, at: 3 } });
    expect(m.reach).toBe(null);
  });

  it("words it as the key does", () => {
    const words = (m) => contactWords(m, t);
    expect(words({ state: "in", at: null, now: false, fixed: true })).toBe("in contact · always");
    expect(words({ state: "out", at: T, now: true, fixed: false })).toBe("cut off · now");
    expect(words({ state: "in", at: T - 3 * H, now: false, fixed: false })).toBe("in contact · seen 3h 0m ago");
    expect(words({ state: "unknown", at: null, now: false, fixed: false })).toBe("not known");
  });
});
