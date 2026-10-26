import { describe, expect, it } from "vitest";
import { diffRooms, droppedOf, emptyReport, formatReport, sortReport } from "./report.mjs";

const room = (id, address, exits = {}) => ({ id, name: id, address, exits });

describe("diffRooms", () => {
  it("matches a renamed room by address, else by name", () => {
    const before = [room("p.a", "A"), room("p.b", "B"), { id: "p.c", name: "Cee", exits: {} }];
    const after = [room("p.a2", "A"), room("p.b", "B"), { id: "p.c2", name: "Cee", exits: {} }, room("p.d", "D")];
    const d = diffRooms("p", before, after);
    expect(d.rooms.renamed).toEqual([
      { place: "p", from: "p.a", to: "p.a2" },
      { place: "p", from: "p.c", to: "p.c2" },
    ]);
    expect(d.rooms.added).toEqual([{ place: "p", id: "p.d" }]);
    expect(d.rooms.removed).toEqual([]);
  });

  it("lists removed rooms", () => {
    const d = diffRooms("p", [room("p.a", "A"), room("p.b", "B")], [room("p.a", "A")]);
    expect(d.rooms.removed).toEqual([{ place: "p", id: "p.b" }]);
  });

  it("compares exits by room and direction, through renames, by target", () => {
    const before = [room("p.a", "A", { north: "p.b", up: "p.c" }), room("p.b", "B", { south: "p.a" }), room("p.c", "C")];
    const after = [
      room("p.a", "A", { north: "p.b2", up: { to: "p.c", via: "hatch" }, east: "p.c" }),
      room("p.b2", "B", { south: "p.a" }),
      room("p.c", "C"),
    ];
    const d = diffRooms("p", before, after);
    expect(d.exits.added).toEqual([{ place: "p", room: "p.a", dir: "east", to: "p.c" }]);
    expect(d.exits.removed).toEqual([]);
  });

  it("lists a removed exit and a changed target as removed and added", () => {
    const d = diffRooms("p", [room("p.a", "A", { north: "p.b", west: "p.c" })], [room("p.a", "A", { north: "p.c" })]);
    expect(d.exits.removed).toEqual([
      { place: "p", room: "p.a", dir: "north", to: "p.b" },
      { place: "p", room: "p.a", dir: "west", to: "p.c" },
    ]);
    expect(d.exits.added).toEqual([{ place: "p", room: "p.a", dir: "north", to: "p.c" }]);
  });
});

describe("droppedOf", () => {
  const rooms = [
    { place: "p", dropped: { fields: ["desc", "lore"], flags: ["shop"] } },
    { place: "q", dropped: { fields: ["off", "lore"], flags: ["shop", "charger"] } },
    { place: "p", dropped: { fields: [], flags: ["charger"] } },
  ];

  it("lists every dropped name, with its places, when there is no previous report", () => {
    const d = droppedOf(rooms, null);
    expect(d.droppedFlags).toEqual([
      { name: "charger", places: ["p", "q"] },
      { name: "shop", places: ["p", "q"] },
    ]);
    expect(d.unknownFields).toEqual([{ name: "lore", places: ["p", "q"] }]);
    expect(d.knownDroppedFlags).toEqual(["charger", "shop"]);
    expect(d.knownUnknownFields).toEqual(["lore"]);
  });

  it("lists only names the previous report didn't know", () => {
    const d = droppedOf(rooms, { knownDroppedFlags: ["shop"], knownUnknownFields: ["lore"] });
    expect(d.droppedFlags).toEqual([{ name: "charger", places: ["p", "q"] }]);
    expect(d.unknownFields).toEqual([]);
    expect(d.knownDroppedFlags).toEqual(["charger", "shop"]);
  });
});

describe("sortReport and formatReport", () => {
  it("sorts every list by place, then the rest", () => {
    const r = emptyReport("abc");
    r.unplaced.push({ place: "b", id: "b.x" }, { place: "a", id: "a.z" }, { place: "a", id: "a.y" });
    expect(sortReport(r).unplaced.map((e) => e.id)).toEqual(["a.y", "a.z", "b.x"]);
  });

  it("keeps the report's keys in a fixed order", () => {
    expect(Object.keys(emptyReport(null))).toEqual([
      "commit",
      "newPlaces",
      "removedPlaces",
      "noBuilder",
      "rooms",
      "exits",
      "unplaced",
      "orphans",
      "droppedFlags",
      "unknownFields",
      "knownDroppedFlags",
      "knownUnknownFields",
    ]);
  });

  it("says nothing needs you when every list is empty, whatever names are known", () => {
    const r = emptyReport("abc");
    r.knownDroppedFlags.push("shop");
    expect(formatReport(r)).toBe("nothing needs you");
  });

  it("prints one line per non-empty list", () => {
    const r = emptyReport("abc");
    r.newPlaces.push({ place: "mini", builder: "decks" });
    r.rooms.renamed.push({ place: "mini", from: "mini.a", to: "mini.b" });
    r.orphans.push({ place: "mini", key: "paint.gone" });
    r.droppedFlags.push({ name: "shop", places: ["mini"] });
    r.removedPlaces.push({ place: "old" });
    const lines = formatReport(r).split("\n");
    expect(lines).toHaveLength(5);
    expect(lines[0]).toMatch(/new places.*mini \(decks\)/);
    expect(lines[1]).toMatch(/places removed.*old/);
    expect(lines[2]).toMatch(/renamed.*mini\.a -> mini\.b/);
    expect(lines[3]).toMatch(/orphan.*mini: paint\.gone/);
    expect(lines[4]).toMatch(/flags dropped.*shop \(mini\)/);
  });

  it("marks a plan's entries as a plan", () => {
    const r = emptyReport("abc");
    r.newPlaces.push({ place: "tug", builder: "decks", kind: "plan" });
    r.removedPlaces.push({ place: "barge", kind: "plan" });
    r.noBuilder.push({ place: "raft", file: "content/plans/raft.yaml", kind: "plan" });
    expect(formatReport(r).split("\n")).toEqual([
      "new places (1): tug (decks plan)",
      "places removed (1): barge (plan)",
      "places with no builder (1): raft (plan)",
    ]);
  });
});
