import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { collectRooms, completeStation, parseGmcpLines } from "./station-data.mjs";

const lines = readFileSync(
  new URL("../tests/fixtures/sample.mallardlog", import.meta.url),
  "utf8",
)
  .split("\n")
  .filter((l) => l.length > 0);

describe("parseGmcpLines", () => {
  it("skips non-gmcp and malformed lines", () => {
    const frames = parseGmcpLines(lines);
    expect(frames.length).toBe(lines.length - 1);
    for (const frame of frames) {
      expect(typeof frame.pkg).toBe("string");
      expect(typeof frame.t).toBe("number");
    }
  });

  it("drops protocol lines that are not gmcp", () => {
    const other = JSON.stringify({
      event: { kind: "telnet", data: {}, package: "x" },
      kind: "protocol",
      t: 1,
    });
    const text = JSON.stringify({ event: { kind: "text" }, kind: "output", t: 2 });
    expect(parseGmcpLines([other, text])).toEqual([]);
  });
});

describe("collectRooms", () => {
  const rooms = collectRooms(parseGmcpLines(lines));

  it("merges both formats", () => {
    const r = rooms.get("tiss.concourse");
    expect(r).toMatchObject({
      x: 0,
      y: 0,
      z: 0,
      name: "Main Concourse",
      address: "Rim 12:00",
      gravity: 0.9,
      walked: true,
    });
    expect(r.exits.N).toBe("tiss.market");
  });

  it("keeps new-format fields", () => {
    expect(rooms.get("tiss.market")).toMatchObject({
      region: "concourse",
      regionName: "the Concourse",
      terrain: "room",
      tags: ["market"],
    });
    expect(rooms.get("tiss.kitchen").y).toBe(-2);
  });

  it("ignores lifts and other areas", () => {
    expect(rooms.has("tiss.lift-9")).toBe(false);
    expect(rooms.has("ship.41")).toBe(false);
  });

  it("reads ladderway coords", () => {
    expect(rooms.get("tiss.ladderway-9-rim")).toMatchObject({ x: 19, y: 0, z: 0 });
  });

  it("lets later frames overwrite earlier ones field by field", () => {
    const frame = (pkg, data, t) => ({ pkg, data, t });
    const out = collectRooms([
      frame("mudstd.room.info", { id: "tiss.a", name: "Old", coords: { x: 1, y: 2, z: 3 } }, 1),
      frame("mudstd.room.info", { id: "tiss.a", name: "New", coords: { x: 1, y: 2, z: 3 } }, 2),
      frame("Empyreal.Room", { id: "tiss.a", address: "Rim 1:00", gravity: 0.5 }, 3),
    ]);
    expect(out.get("tiss.a")).toMatchObject({ name: "New", address: "Rim 1:00", gravity: 0.5 });
  });

  it("drops rooms that never had mudstd coords", () => {
    const out = collectRooms([
      { pkg: "Empyreal.Room", data: { id: "tiss.b", address: "x", part: "rim" }, t: 1 },
      { pkg: "mudstd.room.info", data: { id: "tiss.c", name: "No coords" }, t: 2 },
    ]);
    expect(out.size).toBe(0);
  });

  it("falls back to the old Room.Info package", () => {
    const out = collectRooms([
      {
        pkg: "Room.Info",
        data: {
          num: "tiss.old",
          name: "Old Room",
          coords: [4, 5, 6],
          address: "Rim 3:00",
          gravity: 0.9,
          exits: { north: "tiss.n", up: "tiss.u" },
        },
        t: 1,
      },
    ]);
    expect(out.get("tiss.old")).toMatchObject({
      name: "Old Room",
      x: 4,
      y: 5,
      z: 6,
      address: "Rim 3:00",
      exits: { N: "tiss.n", U: "tiss.u" },
    });
  });

  it("does not let Room.Info override mudstd data", () => {
    const out = collectRooms([
      { pkg: "mudstd.room.info", data: { id: "tiss.a", name: "New", coords: { x: 0, y: 0, z: 0 }, exits: { N: { id: "tiss.n" } } }, t: 1 },
      { pkg: "Room.Info", data: { num: "tiss.a", name: "Old", coords: [9, 9, 9], exits: { north: "tiss.zzz" } }, t: 2 },
    ]);
    expect(out.get("tiss.a")).toMatchObject({ name: "New", x: 0, exits: { N: "tiss.n" } });
  });
});

describe("completeStation", () => {
  const overrides = JSON.parse(
    readFileSync(new URL("../data/overrides.json", import.meta.url), "utf8"),
  );
  const logged = collectRooms(parseGmcpLines(lines));
  const out = completeStation(logged, overrides);
  const byId = new Map(out.map((r) => [r.id, r]));

  it("adds 12 ladderways", () => {
    expect(byId.get("tiss.ladderway-12-mid")).toMatchObject({
      x: 1,
      z: 1,
      terrain: "ladderway",
      walked: false,
    });
    expect(byId.get("tiss.ladderway-9-rim").walked).toBe(true);
    expect(out.filter((r) => r.id.startsWith("tiss.ladderway-")).length).toBe(12);
  });

  it("applies overrides", () => {
    const clinic = byId.get("tiss.clinic");
    expect(clinic).toMatchObject({ closed: true, walked: false });
    expect(clinic.closedReason.length).toBeGreaterThan(0);
    expect(byId.get("tiss.transfer")).toMatchObject({ z: 3, y: -1 });
  });

  it("keeps walked:true when an override merges onto a logged room", () => {
    const rooms = new Map([
      ["tiss.a", { id: "tiss.a", name: "A", x: 1, y: 0, z: 0, walked: true }],
    ]);
    const [a] = completeStation(rooms, { rooms: { "tiss.a": { closed: true } } }).filter(
      (r) => r.id === "tiss.a",
    );
    expect(a).toMatchObject({ walked: true, closed: true, name: "A" });
  });

  it("defaults closed to false", () => {
    expect(byId.get("tiss.concourse")).toMatchObject({ closed: false, closedReason: null });
  });

  it("infers region and terrain", () => {
    const bare = (room) =>
      completeStation(new Map([[room.id, room]]), { rooms: {} }).find((r) => r.id === room.id);
    expect(bare({ id: "tiss.inner-0430", x: 9, y: 0, z: 2 })).toMatchObject({
      region: "industrial",
      terrain: "corridor",
      gravity: 0.3,
    });
    expect(bare({ id: "tiss.x", x: 18, y: 0, z: 0 })).toMatchObject({
      terrain: "lobby",
      region: "commons",
    });
    expect(bare({ id: "tiss.y", x: 22, y: 2, z: 1 })).toMatchObject({
      terrain: "room",
      region: "offices",
    });
    expect(bare({ id: "tiss.hub", x: 0, y: 0, z: 3 })).toMatchObject({
      terrain: "hub",
      region: "hub",
      gravity: 0,
    });
    expect(bare({ id: "tiss.dock", x: 4, y: 3, z: 3 })).toMatchObject({ region: "docks" });
  });

  it("is sorted and drops coordless rooms", () => {
    const ids = out.map((r) => r.id);
    expect(ids).toEqual([...ids].sort());
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = completeStation(new Map(), { rooms: { "tiss.nowhere": { name: "Nowhere" } } });
    expect(res.find((r) => r.id === "tiss.nowhere")).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("tiss.nowhere"));
    warn.mockRestore();
  });
});
